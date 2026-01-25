import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { playNotificationSound, sendPushNotification } from '../lib/notifications';

export function useRealtimePolls(eventId, setPolls, setPollOptions, options = {}) {
  const optionsRef = useRef(options);
  const setPollOptionsRef = useRef(setPollOptions);
  const channelRef = useRef(null);

  useEffect(() => {
    optionsRef.current = options;
    setPollOptionsRef.current = setPollOptions;
  }, [options, setPollOptions]);

  useEffect(() => {
    if (!eventId) return;

    const setupChannel = () => {
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
                  const { data } = await supabase
                    .from('poll_options')
                    .select('*')
                    .eq('poll_id', payload.new.id)
                    .order('display_order');
                  
                  if (data) {
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
          if (status === 'CHANNEL_ERROR') {
            console.error('Polls channel error:', err);
            // Attempt to reconnect after a delay
            setTimeout(() => {
              if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
              }
              channelRef.current = setupChannel();
            }, 2000);
          }
        });

      return channel;
    };

    channelRef.current = setupChannel();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [eventId, setPolls]); // Removed setPollOptions from dependencies to avoid resubscribe if it changes (it shouldn't usually, but safety)
}
