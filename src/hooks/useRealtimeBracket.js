import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Subscribe to match changes for an event and merge into setMatches.
 * @param {string} eventId
 * @param {function} setMatches - (updater: (prev) => next) => void
 */
export function useRealtimeBracket(eventId, setMatches) {
  useEffect(() => {
    if (!eventId) return;

    const channel = supabase
      .channel(`bracket:${eventId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches', filter: `event_id=eq.${eventId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setMatches((prev) => [...prev, payload.new]);
          } else if (payload.eventType === 'UPDATE') {
            setMatches((prev) => prev.map((m) => (m.id === payload.new.id ? { ...m, ...payload.new } : m)));
          } else if (payload.eventType === 'DELETE') {
            setMatches((prev) => prev.filter((m) => m.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, setMatches]);
}
