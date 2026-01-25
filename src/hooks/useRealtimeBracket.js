import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { playNotificationSound, sendPushNotification } from '../lib/notifications';

/**
 * Subscribe to match changes for an event and merge into setMatches.
 * @param {string} eventId
 * @param {function} setMatches - (updater: (prev) => next) => void
 */
export function useRealtimeBracket(eventId, setMatches, onMatchCompletion, onReload, options = {}) {
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

          if (payload.eventType === 'UPDATE') {
            const myTeamIds = options.myTeamIds;
            const currentUserId = options.currentUserId;
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
        onReload?.();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, setMatches, onMatchCompletion, onReload, options.currentUserId, options.myTeamIds]);
}
