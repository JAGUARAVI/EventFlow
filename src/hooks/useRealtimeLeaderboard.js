import { useEffect, useRef, useCallback } from 'react';
import { useRealtimeTable } from '../context/RealtimeContext';
import { sendPushNotification } from '../lib/notifications';

/**
 * Subscribe to team changes for an event and merge into setTeams.
 * Uses the centralized RealtimeContext for connection management.
 * 
 * @param {string} eventId
 * @param {function} setTeams - (updater: (prev) => next) => void
 * @param {object} options - { currentUserId }
 */
export function useRealtimeLeaderboard(eventId, setTeams, options = {}) {
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const handleChange = useCallback((payload) => {
    if (payload.eventType === 'INSERT') {
      setTeams((prev) => {
        if (prev.some((t) => t.id === payload.new.id)) return prev;
        return [...prev, payload.new];
      });
    } else if (payload.eventType === 'UPDATE') {
      setTeams((prev) => {
        const exists = prev.find((t) => t.id === payload.new.id);
        if (!exists) return prev;
        return prev.map((t) => (t.id === payload.new.id ? { ...t, ...payload.new } : t));
      });
      
      // Send notification if user's team was updated
      const currentUserId = optionsRef.current.currentUserId;
      const teamOwner = payload.new?.created_by;
      if (currentUserId && teamOwner === currentUserId) {
        sendPushNotification({
          title: 'Leaderboard Update',
          body: `Your team score was updated.`,
          tag: `leaderboard-${eventId}`,
          data: { eventId, teamId: payload.new?.id },
        });
      }
    } else if (payload.eventType === 'DELETE') {
      setTeams((prev) => prev.filter((t) => t.id !== payload.old.id));
    }
  }, [eventId, setTeams]);

  useRealtimeTable('teams', eventId, handleChange);
}
