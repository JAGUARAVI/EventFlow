import { useState, useEffect } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Select,
  SelectItem,
  Input,
  Textarea,
  addToast,
} from '@heroui/react';
import { supabase, withRetry } from '../lib/supabase';

/**
 * EvalSlotEditor: Modal for creating/editing evaluation time slots for teams
 */
export default function EvalSlotEditor({
  isOpen,
  onClose,
  slot,
  panelId,
  eventId,
  teams,
  existingSlots,
  onUpdate,
  currentUserId,
}) {
  const [teamId, setTeamId] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [duration, setDuration] = useState('15');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Filter out teams that already have slots in this panel (unless editing)
  const availableTeams = teams.filter((t) => {
    if (slot?.team_id === t.id) return true; // Allow current team when editing
    return !existingSlots?.some((s) => s.team_id === t.id && s.id !== slot?.id);
  });

  useEffect(() => {
    if (slot && isOpen) {
      setTeamId(slot.team_id || '');
      // Parse scheduled_at into date and time
      if (slot.scheduled_at) {
        const dt = new Date(slot.scheduled_at);
        setScheduledDate(dt.toISOString().split('T')[0]);
        setScheduledTime(dt.toTimeString().slice(0, 5));
      }
      setDuration(String(slot.duration_minutes || 15));
      setNotes(slot.notes || '');
    } else if (!slot && isOpen) {
      setTeamId('');
      // Default to current date + rounded time
      const now = new Date();
      now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15);
      setScheduledDate(now.toISOString().split('T')[0]);
      setScheduledTime(now.toTimeString().slice(0, 5));
      setDuration('15');
      setNotes('');
    }
  }, [slot, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setSaving(false);
    }
  }, [isOpen]);

  const handleSave = async () => {
    if (!teamId) {
      addToast({ title: 'Please select a team', severity: 'warning' });
      return;
    }
    if (!scheduledDate || !scheduledTime) {
      addToast({ title: 'Please set date and time', severity: 'warning' });
      return;
    }
    if (saving) return;
    setSaving(true);

    try {
      const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
      const durationMinutes = parseInt(duration, 10) || 15;
      const teamName = teams.find((t) => t.id === teamId)?.name || 'Unknown';

      if (slot?.id) {
        // Update existing slot
        const { error } = await withRetry(() =>
          supabase
            .from('eval_slots')
            .update({
              team_id: teamId,
              scheduled_at: scheduledAt,
              duration_minutes: durationMinutes,
              notes,
            })
            .eq('id', slot.id)
        );
        if (error) throw error;

        await supabase.from('event_audit').insert({
          event_id: eventId,
          action: 'eval_slot.update',
          entity_type: 'eval_slot',
          entity_id: slot.id,
          message: `Updated eval slot for "${teamName}"`,
          created_by: currentUserId || null,
        });

        addToast({ title: 'Slot updated', severity: 'success' });
      } else {
        // Create new slot
        const { data: newSlot, error } = await withRetry(() =>
          supabase
            .from('eval_slots')
            .insert({
              panel_id: panelId,
              team_id: teamId,
              scheduled_at: scheduledAt,
              duration_minutes: durationMinutes,
              notes,
            })
            .select()
            .single()
        );
        if (error) throw error;

        await supabase.from('event_audit').insert({
          event_id: eventId,
          action: 'eval_slot.create',
          entity_type: 'eval_slot',
          entity_id: newSlot.id,
          message: `Scheduled eval for "${teamName}"`,
          created_by: currentUserId || null,
        });

        addToast({ title: 'Slot created', severity: 'success' });
      }

      onUpdate?.();
      onClose?.();
    } catch (err) {
      addToast({
        title: 'Save failed',
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
        <ModalHeader>{slot ? 'Edit Slot' : 'Schedule Evaluation'}</ModalHeader>
        <ModalBody className="space-y-4">
          <Select
            label="Team"
            placeholder="Select a team"
            selectedKeys={teamId ? [teamId] : []}
            onSelectionChange={(keys) => setTeamId([...keys][0] || '')}
            isRequired
          >
            {availableTeams.map((t) => (
              <SelectItem key={t.id}>{t.name}</SelectItem>
            ))}
          </Select>

          <div className="flex gap-3">
            <Input
              label="Date"
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="flex-1"
              isRequired
            />
            <Input
              label="Time"
              type="time"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              className="flex-1"
              isRequired
            />
          </div>

          <Input
            label="Duration (minutes)"
            type="number"
            min="5"
            max="180"
            value={duration}
            onValueChange={setDuration}
          />

          <Textarea
            label="Notes"
            placeholder="Any special instructions or notes"
            value={notes}
            onValueChange={setNotes}
            minRows={2}
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={onClose} isDisabled={saving}>
            Cancel
          </Button>
          <Button color="primary" onPress={handleSave} isLoading={saving}>
            {slot ? 'Save Changes' : 'Schedule'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
