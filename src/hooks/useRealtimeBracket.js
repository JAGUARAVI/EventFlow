import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Subscribe to match changes for an event and merge into setMatches.
 * @param {string} eventId
 * @param {function} setMatches - (updater: (prev) => next) => void
 */
export function useRealtimeBracket(eventId, setMatches, onMatchCompletion, onReload) {
  useEffect(() => {
    if (!eventId) return;

    const channel = supabase
      .channel(`bracket:${eventId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches', filter: `event_id=eq.${eventId}` },
        (payload) => {
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
                onMatchCompletion?.(payload.new);
              }
              
              return prev.map((m) => (m.id === payload.new.id ? { ...m, ...payload.new } : m));
            });
          } else if (payload.eventType === 'DELETE') {
            setMatches((prev) => prev.filter((m) => m.id !== payload.old.id));
          }
        }
      )
      .on("broadcast", { event: "reload" }, () => {
        onReload?.();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, setMatches, onMatchCompletion, onReload]);
}
