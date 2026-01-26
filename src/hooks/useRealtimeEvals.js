import { useEffect, useRef, useCallback } from 'react';
import { useRealtimeTable } from '../context/RealtimeContext';
import { playNotificationSound, sendPushNotification } from '../lib/notifications';

/**
 * Subscribe to eval_panels and eval_slots changes for an event.
 * Uses the centralized RealtimeContext for connection management.
 *
 * @param {string} eventId
 * @param {function} setPanels - (updater: (prev) => next) => void
 * @param {function} setSlots - (updater: (prev) => next) => void
 * @param {object} options - { myTeamIds: Set, currentUserId: string }
 */
export function useRealtimeEvals(eventId, setPanels, setSlots, options = {}) {
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  // Handle panel changes
  const handlePanelChange = useCallback(
    (payload) => {
      if (payload.eventType === 'INSERT') {
        setPanels((prev) => {
          if (prev.some((p) => p.id === payload.new.id)) return prev;
          return [...prev, payload.new];
        });
      } else if (payload.eventType === 'UPDATE') {
        setPanels((prev) =>
          prev.map((p) => (p.id === payload.new.id ? { ...p, ...payload.new } : p))
        );

        // Notify if panel status changed (delayed/paused)
        const newStatus = payload.new?.status;
        if (newStatus === 'delayed' || newStatus === 'paused') {
          playNotificationSound('notification.wav');
        }
      } else if (payload.eventType === 'DELETE') {
        setPanels((prev) => prev.filter((p) => p.id !== payload.old.id));
      }
    },
    [setPanels]
  );

  // Handle slot changes - we watch all slots and filter based on panel relationship
  const handleSlotChange = useCallback(
    (payload) => {
      if (payload.eventType === 'INSERT') {
        setSlots((prev) => {
          if (prev.some((s) => s.id === payload.new.id)) return prev;
          return [...prev, payload.new];
        });

        // Notify if my team was scheduled
        const myTeamIds = optionsRef.current.myTeamIds;
        const currentUserId = optionsRef.current.currentUserId;
        if (currentUserId && myTeamIds instanceof Set && myTeamIds.has(payload.new?.team_id)) {
          playNotificationSound('notification.wav');
          sendPushNotification({
            title: 'Evaluation Scheduled',
            body: 'Your team has been scheduled for evaluation.',
            tag: `eval-slot-${payload.new?.id}`,
            data: { slotId: payload.new?.id },
          });
        }
      } else if (payload.eventType === 'UPDATE') {
        setSlots((prev) =>
          prev.map((s) => (s.id === payload.new.id ? { ...s, ...payload.new } : s))
        );

        // Notify if my team's slot was updated
        const myTeamIds = optionsRef.current.myTeamIds;
        const currentUserId = optionsRef.current.currentUserId;
        if (currentUserId && myTeamIds instanceof Set && myTeamIds.has(payload.new?.team_id)) {
          const newStatus = payload.new?.status;
          if (newStatus === 'live') {
            playNotificationSound('notification.wav');
            sendPushNotification({
              title: 'Your Evaluation is Starting!',
              body: 'Your team\'s evaluation has begun.',
              tag: `eval-live-${payload.new?.id}`,
              data: { slotId: payload.new?.id },
            });
          } else if (newStatus === 'rescheduled') {
            playNotificationSound('notification.wav');
            sendPushNotification({
              title: 'Evaluation Rescheduled',
              body: 'Your team\'s evaluation has been rescheduled.',
              tag: `eval-reschedule-${payload.new?.id}`,
              data: { slotId: payload.new?.id },
            });
          }
        }
      } else if (payload.eventType === 'DELETE') {
        setSlots((prev) => prev.filter((s) => s.id !== payload.old.id));
      }
    },
    [setSlots]
  );

  // Subscribe to eval_panels table changes
  useRealtimeTable('eval_panels', eventId, handlePanelChange);

  // For eval_slots, we need to listen at a broader level since they don't have event_id directly
  // We'll use a custom filter or no filter and rely on the component to filter correctly
  // Since Supabase realtime needs a filter, we'll watch all eval_slots changes
  // and let the state management in EvalScheduler handle the filtering
  useRealtimeTable('eval_slots', null, handleSlotChange, {
    // Watch all changes - component-level filtering will handle the rest
    filter: undefined,
  });
}
