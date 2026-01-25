import { useEffect, useRef, useCallback } from 'react';
import { useRealtimeTable } from '../context/RealtimeContext';
import { playNotificationSound, sendPushNotification } from '../lib/notifications';

/**
 * Subscribe to match changes for an event and merge into setMatches.
 * Uses the centralized RealtimeContext for connection management.
 * 
 * @param {string} eventId
 * @param {function} setMatches - (updater: (prev) => next) => void
 * @param {function} onMatchCompletion - Called when a match is completed
 * @param {function} onReload - Called on broadcast reload event
 * @param {object} options - { myTeamIds: Set, currentUserId: string }
 */
export function useRealtimeBracket(eventId, setMatches, onMatchCompletion, onReload, options = {}) {
  const onMatchCompletionRef = useRef(onMatchCompletion);
  const onReloadRef = useRef(onReload);
  const optionsRef = useRef(options);

  useEffect(() => {
    onMatchCompletionRef.current = onMatchCompletion;
    onReloadRef.current = onReload;
    optionsRef.current = options;
  }, [onMatchCompletion, onReload, options]);

  const handleChange = useCallback((payload) => {
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
      
      // Send notification if user's team is involved
      const myTeamIds = optionsRef.current.myTeamIds;
      const currentUserId = optionsRef.current.currentUserId;
      if (currentUserId && myTeamIds instanceof Set) {
        const teamIds = [payload.new?.team_a_id, payload.new?.team_b_id].filter(Boolean);
        const isMyMatch = teamIds.some((id) => myTeamIds.has(id));
        if (isMyMatch) {
          playNotificationSound('bracket.wav');
          sendPushNotification({
            title: 'Match Updated',
            body: 'A match involving your team has been updated.',
            tag: `match-${payload.new?.id}`,
            data: { eventId, matchId: payload.new?.id },
          });
        }
      }
    } else if (payload.eventType === 'DELETE') {
      setMatches((prev) => prev.filter((m) => m.id !== payload.old.id));
    }
  }, [eventId, setMatches]);

  const handleBroadcastReload = useCallback(() => {
    onReloadRef.current?.();
  }, []);

  useRealtimeTable('matches', eventId, handleChange, {
    broadcastEvent: 'reload',
    onBroadcast: handleBroadcastReload,
  });
}
