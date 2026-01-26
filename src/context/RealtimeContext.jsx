import { createContext, useContext, useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

/**
 * Centralized Realtime Connection Manager
 * 
 * This context provides a single source of truth for all realtime subscriptions.
 * It handles:
 * - Connection state management
 * - Automatic reconnection with exponential backoff
 * - Proper cleanup on unmount
 * - Auth-aware subscriptions (waits for auth to be ready)
 * - Channel deduplication
 */

const RealtimeContext = createContext(null);

// Connection states
const ConnectionState = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
};

export function RealtimeProvider({ children }) {
  const { loading: authLoading } = useAuth();
  const [connectionState, setConnectionState] = useState(ConnectionState.DISCONNECTED);
  const [lastConnectedAt, setLastConnectedAt] = useState(null);
  
  // Track all active subscriptions: Map<channelKey, { channel, subscribers: Set<string>, handlers: Map }>
  const subscriptionsRef = useRef(new Map());
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const isMountedRef = useRef(true);
  const maxReconnectAttempts = 5;
  
  // Track pending cleanups to allow debouncing during navigation
  const pendingCleanupsRef = useRef(new Map()); // Map<channelKey, timeoutId>
  const CLEANUP_DEBOUNCE_MS = 500; // Wait 500ms before actually removing a channel

  // Generate unique subscriber IDs
  const subscriberIdCounter = useRef(0);
  const generateSubscriberId = useCallback(() => {
    subscriberIdCounter.current++;
    return `sub_${subscriberIdCounter.current}_${Date.now()}`;
  }, []);

  /**
   * Get reconnection delay with exponential backoff and jitter
   */
  const getReconnectDelay = useCallback((attempt) => {
    const base = Math.min(1000 * Math.pow(2, attempt), 30000);
    const jitter = Math.random() * 1000;
    return base + jitter;
  }, []);

  /**
   * Clean up a specific channel (immediate)
   */
  const cleanupChannel = useCallback(async (channelKey) => {
    // Cancel any pending cleanup for this channel
    const pendingTimeout = pendingCleanupsRef.current.get(channelKey);
    if (pendingTimeout) {
      clearTimeout(pendingTimeout);
      pendingCleanupsRef.current.delete(channelKey);
    }
    
    const subscription = subscriptionsRef.current.get(channelKey);
    if (subscription?.channel) {
      try {
        await supabase.removeChannel(subscription.channel);
      } catch (err) {
        console.warn(`[Realtime] Error removing channel ${channelKey}:`, err);
      }
    }
    subscriptionsRef.current.delete(channelKey);
  }, []);

  /**
   * Schedule a channel cleanup with debounce
   * This prevents race conditions when navigating between pages
   */
  const scheduleChannelCleanup = useCallback((channelKey) => {
    // Cancel any existing pending cleanup for this channel
    const existingTimeout = pendingCleanupsRef.current.get(channelKey);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    
    // Schedule new cleanup
    const timeoutId = setTimeout(() => {
      pendingCleanupsRef.current.delete(channelKey);
      
      // Double-check that no subscribers have re-subscribed during the debounce period
      const sub = subscriptionsRef.current.get(channelKey);
      if (sub && sub.subscribers.size === 0) {
        console.debug(`[Realtime] Cleanup debounce complete, removing channel ${channelKey}`);
        cleanupChannel(channelKey);
      }
    }, CLEANUP_DEBOUNCE_MS);
    
    pendingCleanupsRef.current.set(channelKey, timeoutId);
    console.debug(`[Realtime] Scheduled cleanup for ${channelKey} in ${CLEANUP_DEBOUNCE_MS}ms`);
  }, [cleanupChannel]);

  /**
   * Clean up all channels
   */
  const cleanupAllChannels = useCallback(async () => {
    const cleanupPromises = [];
    for (const [key] of subscriptionsRef.current) {
      cleanupPromises.push(cleanupChannel(key));
    }
    await Promise.all(cleanupPromises);
    subscriptionsRef.current.clear();
  }, [cleanupChannel]);

  /**
   * Internal function to set up a channel
   */
  const setupChannelInternal = useCallback((channelKey, config, handlers, subscribers, broadcastHandlers) => {
    const { table, filter, eventId } = config;
    
    let channel = supabase
      .channel(channelKey, {
        config: {
          broadcast: { self: true },
        },
      })
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table, 
          filter: filter || `event_id=eq.${eventId}` 
        },
        (payload) => {
          if (!isMountedRef.current) return;
          
          // Reset reconnect attempts on successful message
          reconnectAttemptsRef.current = 0;
          
          // Notify all handlers for this channel
          const subscription = subscriptionsRef.current.get(channelKey);
          if (subscription) {
            for (const [, handler] of subscription.handlers) {
              try {
                handler(payload);
              } catch (err) {
                console.error(`[Realtime] Handler error for ${channelKey}:`, err);
              }
            }
          }
        }
      )
    // Add broadcast handlers if provided
    if (broadcastHandlers && broadcastHandlers.size > 0) {
      // Get unique broadcast events
      const broadcastEvents = new Set();
      for (const [, { event }] of broadcastHandlers) {
        broadcastEvents.add(event);
      }
      
      for (const eventName of broadcastEvents) {
        channel = channel.on('broadcast', { event: eventName }, (payload) => {
          if (!isMountedRef.current) return;
          
          const subscription = subscriptionsRef.current.get(channelKey);
          if (subscription?.broadcastHandlers) {
            for (const [, handler] of subscription.broadcastHandlers) {
              if (handler.event === eventName) {
                try {
                  handler.callback(payload);
                } catch (err) {
                  console.error(`[Realtime] Broadcast handler error for ${channelKey}:`, err);
                }
              }
            }
          }
        });
      }
    }

    channel.subscribe((status, err) => {
        if (!isMountedRef.current) return;
        
        console.debug(`[Realtime] Channel ${channelKey} status: ${status}`, err || '');
        
        if (status === 'SUBSCRIBED') {
          reconnectAttemptsRef.current = 0;
          setConnectionState(ConnectionState.CONNECTED);
          setLastConnectedAt(Date.now());
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          // Check if this channel still has active subscribers
          const subscription = subscriptionsRef.current.get(channelKey);
          if (!subscription || subscription.subscribers.size === 0) {
            console.debug(`[Realtime] Ignoring error for inactive channel ${channelKey}`);
            return;
          }
          
          console.warn(`[Realtime] Channel ${channelKey} error:`, status, err);
          setConnectionState(ConnectionState.DISCONNECTED);
        }
      });

    subscriptionsRef.current.set(channelKey, {
      channel,
      config,
      handlers,
      subscribers,
      broadcastHandlers: broadcastHandlers || new Map(),
    });

    return channel;
  }, []);

  /**
   * Force reconnect all subscriptions
   */
  const reconnect = useCallback(async () => {
    if (connectionState === ConnectionState.RECONNECTING) {
      return;
    }

    setConnectionState(ConnectionState.RECONNECTING);
    console.info('[Realtime] Starting reconnection...');

    try {
      // Store current subscriptions info before cleanup
      const activeSubscriptions = new Map();
      for (const [key, sub] of subscriptionsRef.current) {
        if (sub.subscribers.size > 0) {
          activeSubscriptions.set(key, {
            config: sub.config,
            handlers: new Map(sub.handlers),
            subscribers: new Set(sub.subscribers),
            broadcastHandlers: new Map(sub.broadcastHandlers || []),
          });
        }
      }

      // Clean up existing channels
      await cleanupAllChannels();

      // Disconnect and reconnect the realtime client
      await supabase.realtime.disconnect();
      await new Promise(resolve => setTimeout(resolve, 500));
      await supabase.realtime.connect();

      // Re-establish subscriptions
      for (const [key, info] of activeSubscriptions) {
        const { config, handlers, subscribers, broadcastHandlers } = info;
        setupChannelInternal(key, config, handlers, subscribers, broadcastHandlers);
      }

      reconnectAttemptsRef.current = 0;
      setConnectionState(ConnectionState.CONNECTED);
      setLastConnectedAt(Date.now());
      console.info('[Realtime] Reconnection successful');

      // Notify listeners
      window.dispatchEvent(new CustomEvent('realtime-reconnected'));
    } catch (err) {
      console.error('[Realtime] Reconnection failed:', err);
      setConnectionState(ConnectionState.DISCONNECTED);
      
      // Schedule retry
      if (reconnectAttemptsRef.current < maxReconnectAttempts) {
        reconnectAttemptsRef.current++;
        const delay = getReconnectDelay(reconnectAttemptsRef.current);
        console.warn(`[Realtime] Scheduling retry in ${Math.round(delay)}ms (attempt ${reconnectAttemptsRef.current})`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            reconnect();
          }
        }, delay);
      }
    }
  }, [connectionState, cleanupAllChannels, getReconnectDelay, setupChannelInternal]);

  /**
   * Subscribe to a table's changes
   * Returns an unsubscribe function
   * @param {object} config - { table, eventId, filter, broadcastEvent }
   * @param {function} handler - Postgres changes handler
   * @param {function} broadcastHandler - Optional broadcast event handler
   */
  const subscribe = useCallback((config, handler, broadcastHandler) => {
    const { table, eventId, filter, broadcastEvent } = config;
    const channelKey = filter 
      ? `${table}:${filter}` 
      : `${table}:event_id=eq.${eventId}`;
    const subscriberId = generateSubscriberId();

    // Check if channel already exists
    let subscription = subscriptionsRef.current.get(channelKey);
    
    if (subscription) {
      // Cancel any pending cleanup - a new subscriber is joining!
      const pendingTimeout = pendingCleanupsRef.current.get(channelKey);
      if (pendingTimeout) {
        clearTimeout(pendingTimeout);
        pendingCleanupsRef.current.delete(channelKey);
        console.debug(`[Realtime] Cancelled pending cleanup for ${channelKey} - new subscriber joining`);
      }
      
      // Add new handler and subscriber to existing channel
      subscription.handlers.set(subscriberId, handler);
      subscription.subscribers.add(subscriberId);
      
      // Add broadcast handler if provided
      if (broadcastEvent && broadcastHandler) {
        subscription.broadcastHandlers.set(subscriberId, { event: broadcastEvent, callback: broadcastHandler });
      }
      
      console.debug(`[Realtime] Added subscriber ${subscriberId} to existing channel ${channelKey}`);
    } else {
      // Create new channel
      const handlers = new Map([[subscriberId, handler]]);
      const subscribers = new Set([subscriberId]);
      const broadcastHandlers = new Map();
      
      if (broadcastEvent && broadcastHandler) {
        broadcastHandlers.set(subscriberId, { event: broadcastEvent, callback: broadcastHandler });
      }
      
      console.debug(`[Realtime] Creating new channel ${channelKey}`);
      setupChannelInternal(channelKey, config, handlers, subscribers, broadcastHandlers);
    }

    // Return unsubscribe function
    return () => {
      const sub = subscriptionsRef.current.get(channelKey);
      if (sub) {
        sub.handlers.delete(subscriberId);
        sub.subscribers.delete(subscriberId);
        sub.broadcastHandlers?.delete(subscriberId);
        
        console.debug(`[Realtime] Removed subscriber ${subscriberId} from ${channelKey} (remaining: ${sub.subscribers.size})`);
        
        // If no more subscribers, schedule cleanup with debounce
        // This allows time for navigation to complete and new subscribers to join
        if (sub.subscribers.size === 0) {
          scheduleChannelCleanup(channelKey);
        }
      }
    };
  }, [generateSubscriberId, setupChannelInternal, scheduleChannelCleanup]);

  /**
   * Check if ready to subscribe (auth is loaded)
   */
  const isReady = !authLoading;

  // Clean up on unmount
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      // Clear all pending cleanup timeouts
      for (const [, timeoutId] of pendingCleanupsRef.current) {
        clearTimeout(timeoutId);
      }
      pendingCleanupsRef.current.clear();
      
      // Clean up all channels synchronously on unmount
      for (const [, sub] of subscriptionsRef.current) {
        if (sub.channel) {
          supabase.removeChannel(sub.channel);
        }
      }
      subscriptionsRef.current.clear();
    };
  }, []);

  // Listen for visibility changes to reconnect when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        // Only do anything if there are active subscriptions
        const hasActiveSubscriptions = subscriptionsRef.current.size > 0;
        
        if (hasActiveSubscriptions) {
          // Refresh the auth session (token might be stale after tab was hidden)
          try {
            const { data, error } = await supabase.auth.getSession();
            if (error) {
              console.warn('[Realtime] Failed to refresh session on visibility change:', error);
            } else if (data.session) {
              console.debug('[Realtime] Session refreshed on visibility change');
            }
          } catch (err) {
            console.warn('[Realtime] Error refreshing session:', err);
          }
          
          // Reconnect if connection is not healthy
          if (connectionState === ConnectionState.DISCONNECTED) {
            console.info('[Realtime] Tab became visible with active subscriptions, reconnecting...');
            reconnect();
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [connectionState, reconnect]);

  // Also listen for online/offline events
  useEffect(() => {
    const handleOnline = async () => {
      // Refresh auth session first
      try {
        await supabase.auth.getSession();
      } catch (err) {
        console.warn('[Realtime] Error refreshing session on online:', err);
      }
      
      // Only reconnect if there are active subscriptions
      const hasActiveSubscriptions = subscriptionsRef.current.size > 0;
      if (hasActiveSubscriptions) {
        console.info('[Realtime] Network came online, reconnecting...');
        reconnect();
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [reconnect]);

  const value = {
    connectionState,
    lastConnectedAt,
    isReady,
    isConnected: connectionState === ConnectionState.CONNECTED,
    subscribe,
    reconnect,
  };

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtime must be used within RealtimeProvider');
  }
  return context;
}

/**
 * Hook to subscribe to a specific table's changes
 * Automatically handles subscription/unsubscription based on eventId
 * @param {string} table - Table name to subscribe to
 * @param {string} eventId - Event ID for filtering (or use options.filter for custom)
 * @param {function} handler - Postgres changes handler
 * @param {object} options - { filter, broadcastEvent, onBroadcast }
 */
export function useRealtimeTable(table, eventId, handler, options = {}) {
  const { isReady, subscribe } = useRealtime();
  const handlerRef = useRef(handler);
  const unsubscribeRef = useRef(null);
  const optionsRef = useRef(options);
  
  // Keep refs updated
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);
  
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    // Don't subscribe until ready and we have an eventId (or custom filter)
    if (!isReady || (!eventId && !optionsRef.current.filter)) {
      return;
    }

    const wrappedHandler = (payload) => {
      handlerRef.current?.(payload);
    };

    const wrappedBroadcastHandler = optionsRef.current.onBroadcast 
      ? (payload) => optionsRef.current.onBroadcast?.(payload)
      : undefined;

    unsubscribeRef.current = subscribe(
      { 
        table, 
        eventId, 
        filter: optionsRef.current.filter,
        broadcastEvent: optionsRef.current.broadcastEvent,
      },
      wrappedHandler,
      wrappedBroadcastHandler
    );

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [isReady, eventId, table, subscribe]);

  return null;
}
