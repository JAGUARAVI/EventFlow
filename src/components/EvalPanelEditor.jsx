import { useState, useEffect } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Textarea,
  addToast,
} from '@heroui/react';
import { supabase, withRetry } from '../lib/supabase';

/**
 * EvalPanelEditor: Modal for creating/editing evaluation panels
 */
export default function EvalPanelEditor({
  isOpen,
  onClose,
  panel,
  eventId,
  onUpdate,
  currentUserId,
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (panel && isOpen) {
      setName(panel.name || '');
      setDescription(panel.description || '');
      setLocation(panel.location || '');
    } else if (!panel && isOpen) {
      setName('');
      setDescription('');
      setLocation('');
    }
  }, [panel, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setSaving(false);
    }
  }, [isOpen]);

  const handleSave = async () => {
    if (!name.trim()) {
      addToast({ title: 'Panel name required', severity: 'warning' });
      return;
    }
    if (saving) return;
    setSaving(true);

    try {
      if (panel?.id) {
        // Update existing panel
        const { error } = await withRetry(() =>
          supabase
            .from('eval_panels')
            .update({ name, description, location })
            .eq('id', panel.id)
        );
        if (error) throw error;

        await supabase.from('event_audit').insert({
          event_id: eventId,
          action: 'eval_panel.update',
          entity_type: 'eval_panel',
          entity_id: panel.id,
          message: `Updated panel "${name}"`,
          created_by: currentUserId || null,
        });

        addToast({ title: 'Panel updated', severity: 'success' });
      } else {
        // Create new panel
        const { data: newPanel, error } = await withRetry(() =>
          supabase
            .from('eval_panels')
            .insert({ event_id: eventId, name, description, location })
            .select()
            .single()
        );
        if (error) throw error;

        await supabase.from('event_audit').insert({
          event_id: eventId,
          action: 'eval_panel.create',
          entity_type: 'eval_panel',
          entity_id: newPanel.id,
          message: `Created panel "${name}"`,
          created_by: currentUserId || null,
        });

        addToast({ title: 'Panel created', severity: 'success' });
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
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalContent>
        <ModalHeader>{panel ? 'Edit Panel' : 'Create Panel'}</ModalHeader>
        <ModalBody className="space-y-4">
          <Input
            label="Panel Name"
            placeholder="e.g., Panel A, Design Review"
            value={name}
            onValueChange={setName}
            isRequired
          />
          <Input
            label="Location / Room"
            placeholder="e.g., Room 101, Zoom Link"
            value={location}
            onValueChange={setLocation}
          />
          <Textarea
            label="Description (Markdown supported)"
            placeholder="Panel guidelines, evaluation criteria, etc."
            value={description}
            onValueChange={setDescription}
            minRows={4}
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={onClose} isDisabled={saving}>
            Cancel
          </Button>
          <Button color="primary" onPress={handleSave} isLoading={saving}>
            {panel ? 'Save Changes' : 'Create Panel'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
