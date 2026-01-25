import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { playNotificationSound, sendPushNotification } from '../lib/notifications';

/**
 * Subscribe to match changes for an event and merge into setMatches.
 * @param {string} eventId
 * @param {function} setMatches - (updater: (prev) => next) => void
 */
export function useRealtimeBracket(eventId, setMatches, onMatchCompletion, onReload, options = {}) {
  const onMatchCompletionRef = useRef(onMatchCompletion);
  const onReloadRef = useRef(onReload);
  const optionsRef = useRef(options);
  const channelRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimeoutRef = useRef(null);
  const isMountedRef = useRef(true);
  const isIntentionalCloseRef = useRef(false);
  const maxReconnectAttempts = 5;

  useEffect(() => {
    onMatchCompletionRef.current = onMatchCompletion;
    onReloadRef.current = onReload;
    optionsRef.current = options;
  }, [onMatchCompletion, onReload, options]);

  const cleanupChannel = useCallback(() => {
    // Clear any pending reconnection timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    // Mark as intentional close to prevent reconnection attempts
    isIntentionalCloseRef.current = true;
    
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  const setupChannel = useCallback(() => {
    if (!eventId || !isMountedRef.current) return null;
    
    // Clean up any existing channel first
    if (channelRef.current) {
      isIntentionalCloseRef.current = true;
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    
    // Reset the intentional close flag for the new channel
    isIntentionalCloseRef.current = false;
    
    console.debug(`[useRealtimeBracket] Setting up channel for event: ${eventId}`);
    
    const channel = supabase
      .channel(`bracket:${eventId}`, {
        config: {
          broadcast: { self: true },
        },
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches', filter: `event_id=eq.${eventId}` },
        (payload) => {
          if (!isMountedRef.current) return;
          
          // Reset reconnect attempts on successful message
          reconnectAttempts.current = 0;
          
          if (payload.eventType === 'INSERT') {
            setMatches((prev) => {
              if (prev.some((m) => m.id === payload.new.id)) return prev;
              return [...prev, payload.new];
            });
          } else if (payload.eventType === 'UPDATE') {
            setMatches((prev) => {
              // Check for completion event
              const oldMatch = prev.find(m => m.id === payload.new.id);
              if (
                oldMatch && 
                oldMatch.status !== 'completed' && 
                payload.new.status === 'completed' && 
                payload.new.winner_id
              ) {
                onMatchCompletionRef.current?.(payload.new);
              }
              
              return prev.map((m) => (m.id === payload.new.id ? { ...m, ...payload.new } : m));
            });
          } else if (payload.eventType === 'DELETE') {
            setMatches((prev) => prev.filter((m) => m.id !== payload.old.id));
          }

          if (payload.eventType === 'UPDATE') {
            const myTeamIds = optionsRef.current.myTeamIds;
            const currentUserId = optionsRef.current.currentUserId;
            if (currentUserId && myTeamIds instanceof Set) {
              const teamIds = [payload.new?.team_a_id, payload.new?.team_b_id].filter(Boolean);
              const isMyMatch = teamIds.some((id) => myTeamIds.has(id));
              if (isMyMatch) {
                playNotificationSound('bracket.wav');
                sendPushNotification({
                  title: 'Match Updated',
                  body: 'A match involving your team has been updated at ' + new Date().toLocaleTimeString() + '.',
                  tag: `match-${payload.new?.id || payload.old?.id}`,
                  data: { eventId, matchId: payload.new?.id || payload.old?.id },
                });
              }
            }
          }
        }
      )
      .on("broadcast", { event: "reload" }, () => {
        if (isMountedRef.current) {
          onReloadRef.current?.();
        }
      })
      .subscribe((status, err) => {
        console.debug(`[useRealtimeBracket] Channel status: ${status}`, err || '');
        
        // Ignore status updates if we're unmounted or this was intentional
        if (!isMountedRef.current) return;
        
        if (status === 'SUBSCRIBED') {
          reconnectAttempts.current = 0;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          // Skip reconnection if this was an intentional close (cleanup or channel replacement)
          if (isIntentionalCloseRef.current) {
            console.debug('[useRealtimeBracket] Ignoring close event (intentional)');
            return;
          }
          
          console.error('[useRealtimeBracket] Channel error:', status, err);
          
          if (reconnectAttempts.current < maxReconnectAttempts) {
            reconnectAttempts.current++;
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current - 1), 10000);
            console.warn(`[useRealtimeBracket] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`);
            
            // Clear any existing reconnect timeout
            if (reconnectTimeoutRef.current) {
              clearTimeout(reconnectTimeoutRef.current);
            }
            
            reconnectTimeoutRef.current = setTimeout(() => {
              reconnectTimeoutRef.current = null;
              if (isMountedRef.current && !isIntentionalCloseRef.current) {
                channelRef.current = setupChannel();
              }
            }, delay);
          } else {
            console.error('[useRealtimeBracket] Max reconnection attempts reached');
            // Trigger a reload callback so the UI can refresh data
            onReloadRef.current?.();
          }
        }
      });
    
    return channel;
  }, [eventId, setMatches]);

  useEffect(() => {
    isMountedRef.current = true;
    
    if (!eventId) return;

    channelRef.current = setupChannel();
    
    // Listen for global reconnection events
    const handleReconnect = () => {
      if (!isMountedRef.current) return;
      console.debug('[useRealtimeBracket] Global reconnection detected, re-subscribing');
      reconnectAttempts.current = 0;
      channelRef.current = setupChannel();
    };
    
    window.addEventListener('supabase-reconnected', handleReconnect);

    return () => {
      isMountedRef.current = false;
      window.removeEventListener('supabase-reconnected', handleReconnect);
      cleanupChannel();
    };
  }, [eventId, setupChannel, cleanupChannel]);
}
