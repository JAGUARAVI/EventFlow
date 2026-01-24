import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Subscribe to team changes for an event and merge into setTeams.
 * @param {string} eventId
 * @param {function} setTeams - (updater: (prev) => next) => void
 */
export function useRealtimeLeaderboard(eventId, setTeams) {
  useEffect(() => {
    if (!eventId) return;

    const channel = supabase
      .channel(`leaderboard:${eventId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'teams', filter: `event_id=eq.${eventId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setTeams((prev) => {
              if (prev.some((t) => t.id === payload.new.id)) return prev;
              return [...prev, payload.new];
            });
          } else if (payload.eventType === 'UPDATE') {
            setTeams((prev) => prev.map((t) => (t.id === payload.new.id ? { ...t, ...payload.new } : t)));
          } else if (payload.eventType === 'DELETE') {
            setTeams((prev) => prev.filter((t) => t.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, setTeams]);
}
