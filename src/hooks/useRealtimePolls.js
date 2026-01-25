import { useEffect, useRef, useCallback } from 'react';
import { useRealtimeTable } from '../context/RealtimeContext';
import { supabase } from '../lib/supabase';
import { playNotificationSound, sendPushNotification } from '../lib/notifications';

/**
 * Subscribe to poll changes for an event and merge into setPolls.
 * Uses the centralized RealtimeContext for connection management.
 * 
 * @param {string} eventId
 * @param {function} setPolls - (updater: (prev) => next) => void
 * @param {function} setPollOptions - (updater: (prev) => next) => void
 * @param {object} options - { currentUserId }
 */
export function useRealtimePolls(eventId, setPolls, setPollOptions, options = {}) {
  const optionsRef = useRef(options);
  const setPollOptionsRef = useRef(setPollOptions);
  const isMountedRef = useRef(true);

  useEffect(() => {
    optionsRef.current = options;
    setPollOptionsRef.current = setPollOptions;
  }, [options, setPollOptions]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleChange = useCallback(async (payload) => {
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
      
      // Fetch poll options after a small delay to ensure they're inserted
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
      // Clean up options for deleted poll
      if (setPollOptionsRef.current) {
        setPollOptionsRef.current(prev => {
          const next = { ...prev };
          delete next[payload.old.id];
          return next;
        });
      }
    }
  }, [eventId, setPolls]);

  useRealtimeTable('polls', eventId, handleChange);
}
