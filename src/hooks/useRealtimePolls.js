import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { playNotificationSound, sendPushNotification } from '../lib/notifications';

export function useRealtimePolls(eventId, setPolls, setPollOptions, options = {}) {
  const optionsRef = useRef(options);
  const setPollOptionsRef = useRef(setPollOptions);
  const channelRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimeoutRef = useRef(null);
  const isMountedRef = useRef(true);
  const isIntentionalCloseRef = useRef(false);
  const maxReconnectAttempts = 5;

  useEffect(() => {
    optionsRef.current = options;
    setPollOptionsRef.current = setPollOptions;
  }, [options, setPollOptions]);

  const cleanupChannel = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    isIntentionalCloseRef.current = true;
    
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  const setupChannel = useCallback(() => {
    if (!eventId || !isMountedRef.current) return null;
    
    if (channelRef.current) {
      isIntentionalCloseRef.current = true;
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    
    isIntentionalCloseRef.current = false;
    
    console.debug(`[useRealtimePolls] Setting up channel for event: ${eventId}`);

    const channel = supabase
      .channel(`polls:event_id=eq.${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'polls',
          filter: `event_id=eq.${eventId}`,
        },
        async (payload) => {
          if (!isMountedRef.current) return;
          
          // Reset reconnect attempts on successful message
          reconnectAttempts.current = 0;
          
          if (payload.eventType === 'INSERT') {
            setPolls((prev) => [payload.new, ...prev]);

            playNotificationSound('poll.wav');

            if (payload.new?.created_by !== optionsRef.current.currentUserId) {
              sendPushNotification({
                title: 'New Poll',
                body: 'A new poll has been posted. Cast your vote now!',
                tag: `poll-${payload.new.id}`,
                data: { eventId, pollId: payload.new.id },
              });
            }
            
            // If checking specifically for a new poll, we should also fetch its options.
            // Give a small delay to ensure options are inserted.
            if (setPollOptionsRef.current) {
              setTimeout(async () => {
                if (!isMountedRef.current) return;
                const { data } = await supabase
                  .from('poll_options')
                  .select('*')
                  .eq('poll_id', payload.new.id)
                  .order('display_order');
                
                if (data && isMountedRef.current) {
                  setPollOptionsRef.current((prev) => ({
                    ...prev,
                    [payload.new.id]: data,
                  }));
                }
              }, 1000);
            }
          } else if (payload.eventType === 'UPDATE') {
            setPolls((prev) =>
              prev.map((p) => (p.id === payload.new.id ? payload.new : p))
            );
          } else if (payload.eventType === 'DELETE') {
            setPolls((prev) => prev.filter((p) => p.id !== payload.old.id));
            // Should also clean up options? Not strictly necessary for functionality but good for memory.
            if (setPollOptionsRef.current) {
                setPollOptionsRef.current(prev => {
                    const next = { ...prev };
                    delete next[payload.old.id];
                    return next;
                });
            }
          }
        }
      )
      .subscribe((status, err) => {
        console.debug(`[useRealtimePolls] Channel status: ${status}`, err || '');
        
        if (!isMountedRef.current) return;
        
        if (status === 'SUBSCRIBED') {
          reconnectAttempts.current = 0;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          if (isIntentionalCloseRef.current) {
            console.debug('[useRealtimePolls] Ignoring close event (intentional)');
            return;
          }
          
          console.error('[useRealtimePolls] Channel error:', status, err);
          
          if (reconnectAttempts.current < maxReconnectAttempts) {
            reconnectAttempts.current++;
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current - 1), 10000);
            console.warn(`[useRealtimePolls] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`);
            
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
            console.error('[useRealtimePolls] Max reconnection attempts reached');
          }
        }
      });

    return channel;
  }, [eventId, setPolls]);

  useEffect(() => {
    isMountedRef.current = true;
    
    if (!eventId) return;

    reconnectAttempts.current = 0;
    channelRef.current = setupChannel();
    
    // Listen for global reconnection events
    const handleReconnect = () => {
      if (!isMountedRef.current) return;
      console.debug('[useRealtimePolls] Global reconnection detected, re-subscribing');
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
