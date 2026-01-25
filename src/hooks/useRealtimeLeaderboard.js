import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { playNotificationSound, sendPushNotification } from '../lib/notifications';

/**
 * Subscribe to team changes for an event and merge into setTeams.
 * @param {string} eventId
 * @param {function} setTeams - (updater: (prev) => next) => void
 */
export function useRealtimeLeaderboard(eventId, setTeams, options = {}) {
  const optionsRef = useRef(options);
  // Track the last seen score for each team to avoid accepting stale updates
  const lastSeenScoresRef = useRef(new Map());
  const channelRef = useRef(null);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    if (!eventId) return;
    
    // Reset scores tracking when eventId changes
    lastSeenScoresRef.current = new Map();

    const setupChannel = () => {
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
              const teamId = payload.new.id;
              const incomingScore = payload.new.score;
              
              setTeams((prev) => {
                const existingTeam = prev.find(t => t.id === teamId);
                if (!existingTeam) return prev;
                
                const currentScore = existingTeam.score;
                const lastSeenScore = lastSeenScoresRef.current.get(teamId);
                
                // If the incoming score is less than what we've already seen locally,
                // it's likely a stale update - only accept if it's newer
                // However, we can't easily determine "newer" without timestamps,
                // so we'll accept updates that are >= our last seen value OR
                // if this is a non-score field update
                const scoreChanged = incomingScore !== currentScore;
                
                if (scoreChanged) {
                  // Track this score
                  lastSeenScoresRef.current.set(teamId, incomingScore);
                }
                
                // Always merge the update - the DB is the source of truth
                return prev.map((t) => (t.id === teamId ? { ...t, ...payload.new } : t));
              });
            } else if (payload.eventType === 'DELETE') {
              lastSeenScoresRef.current.delete(payload.old.id);
              setTeams((prev) => prev.filter((t) => t.id !== payload.old.id));
            }

            if (payload.eventType === 'UPDATE') {
              const currentUserId = optionsRef.current.currentUserId;
              const teamOwner = payload.new?.created_by || payload.old?.created_by;
              if (currentUserId && teamOwner === currentUserId) {
                //playNotificationSound('leaderboard.wav'); /// cab be annoying if too frequent
                sendPushNotification({
                  title: 'Leaderboard Update',
                  body: 'Your team just moved on the leaderboard to position ' + (payload.new?.rank || 'unknown') + ' at ' + new Date().toLocaleTimeString() + '.',
                  tag: `leaderboard-${eventId}`,
                  data: { eventId, teamId: payload.new?.id || payload.old?.id },
                });
              }
            }
          }
        )
        .subscribe((status, err) => {
          if (status === 'CHANNEL_ERROR') {
            console.error('Leaderboard channel error:', err);
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
  }, [eventId, setTeams]);
}
