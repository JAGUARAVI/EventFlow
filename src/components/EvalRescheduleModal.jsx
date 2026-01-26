import { useState } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Textarea,
  Select,
  SelectItem,
  addToast,
} from '@heroui/react';
import { supabase, withRetry } from '../lib/supabase';

/**
 * EvalRescheduleModal: Modal for rescheduling an evaluation slot
 */
export default function EvalRescheduleModal({
  isOpen,
  onClose,
  slot,
  team,
  eventId,
  onUpdate,
  currentUserId,
}) {
  const [scheduledDate, setScheduledDate] = useState(() => {
    if (slot?.scheduled_at) {
      const dt = new Date(slot.scheduled_at);
      return dt.toISOString().split('T')[0];
    }
    return new Date().toISOString().split('T')[0];
  });
  const [scheduledTime, setScheduledTime] = useState(() => {
    if (slot?.scheduled_at) {
      const dt = new Date(slot.scheduled_at);
      return dt.toTimeString().slice(0, 5);
    }
    return '09:00';
  });
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const handleReschedule = async () => {
    if (!scheduledDate || !scheduledTime) {
      addToast({ title: 'Please set new date and time', severity: 'warning' });
      return;
    }
    if (saving) return;
    setSaving(true);

    try {
      const newScheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();

      // Update the slot with new time and mark as rescheduled
      const { error } = await withRetry(() =>
        supabase
          .from('eval_slots')
          .update({
            scheduled_at: newScheduledAt,
            status: 'rescheduled',
            reschedule_reason: reason || null,
            original_slot_id: slot.original_slot_id || slot.id,
          })
          .eq('id', slot.id)
      );
      if (error) throw error;

      await supabase.from('event_audit').insert({
        event_id: eventId,
        action: 'eval_slot.reschedule',
        entity_type: 'eval_slot',
        entity_id: slot.id,
        message: `Rescheduled eval for "${team?.name || 'Unknown'}"`,
        created_by: currentUserId || null,
        metadata: {
          old_time: slot.scheduled_at,
          new_time: newScheduledAt,
          reason: reason || null,
        },
      });

      addToast({ title: 'Evaluation rescheduled', severity: 'success' });
      onUpdate?.();
      onClose?.();
    } catch (err) {
      addToast({
        title: 'Reschedule failed',
        description: err.message,
        severity: 'danger',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalContent>
        <ModalHeader>Reschedule Evaluation</ModalHeader>
        <ModalBody className="space-y-4">
          <p className="text-default-500">
            Rescheduling evaluation for <strong>{team?.name || 'Unknown Team'}</strong>
          </p>

          <div className="p-3 bg-default-100 rounded-lg">
            <p className="text-sm text-default-500">Current time:</p>
            <p className="font-medium">
              {slot?.scheduled_at
                ? new Date(slot.scheduled_at).toLocaleString()
                : 'Not set'}
            </p>
          </div>

          <div className="flex gap-3">
            <Input
              label="New Date"
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="flex-1"
              isRequired
            />
            <Input
              label="New Time"
              type="time"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              className="flex-1"
              isRequired
            />
          </div>

          <Textarea
            label="Reason for rescheduling"
            placeholder="Optional - explain why this eval is being rescheduled"
            value={reason}
            onValueChange={setReason}
            minRows={2}
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={onClose} isDisabled={saving}>
            Cancel
          </Button>
          <Button color="warning" onPress={handleReschedule} isLoading={saving}>
            Reschedule
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
