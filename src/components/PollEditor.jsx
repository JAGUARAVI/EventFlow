import { useState, useEffect } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Input, Select, SelectItem, addToast } from '@heroui/react';
import { supabase } from '../lib/supabase';

export default function PollEditor({ isOpen, onClose, poll, eventId, teams, onUpdate, currentUserId }) {
  const [question, setQuestion] = useState('');
  const [pollType, setPollType] = useState('simple');
  const [options, setOptions] = useState([]);
  const [newOptionLabel, setNewOptionLabel] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (poll && isOpen) {
      setQuestion(poll.question || '');
      setPollType(poll.poll_type || 'simple');
      fetchOptions();
    } else if (!poll && isOpen) {
      setQuestion('');
      setPollType('simple');
      setOptions([]);
    }
  }, [poll, isOpen]);

  const fetchOptions = async () => {
    if (!poll?.id) return;
    const { data } = await supabase
      .from('poll_options')
      .select('*')
      .eq('poll_id', poll.id)
      .order('display_order');
    setOptions(data || []);
  };

  const addOption = () => {
    if (!newOptionLabel.trim()) return;
    setOptions([...options, { label: newOptionLabel, points: 1, team_id: null, display_order: options.length }]);
    setNewOptionLabel('');
  };

  const removeOption = (idx) => {
    setOptions(options.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!question.trim()) {
      addToast({ title: 'Question required', severity: 'warning' });
      return;
    }
    if (options.length === 0) {
      addToast({ title: 'Add at least one option', severity: 'warning' });
      return;
    }
    setSaving(true);

    try {
      if (poll?.id) {
        // Update existing poll
        await supabase.from('polls').update({ question, poll_type: pollType }).eq('id', poll.id);
        await supabase.from('event_audit').insert({
          event_id: eventId,
          action: 'poll.edit',
          entity_type: 'poll',
          entity_id: poll.id,
          message: `Edited poll "${question}"`,
          created_by: currentUserId || null,
        });
        // Update options
        for (let i = 0; i < options.length; i++) {
          const opt = options[i];
          if (opt.id) {
            await supabase.from('poll_options').update({ label: opt.label, points: opt.points, display_order: i }).eq('id', opt.id);
          } else {
            await supabase.from('poll_options').insert({ poll_id: poll.id, label: opt.label, points: opt.points, display_order: i });
          }
        }
      } else {
        // Create new poll
        const { data: newPoll, error: pollErr } = await supabase
          .from('polls')
          .insert({ event_id: eventId, question, poll_type: pollType })
          .select()
          .single();
        if (pollErr) throw pollErr;

        // Insert options
        const optionsToInsert = options.map((opt, i) => ({
          poll_id: newPoll.id,
          label: opt.label,
          points: opt.points,
          team_id: opt.team_id,
          display_order: i,
        }));
        const { error: optErr } = await supabase.from('poll_options').insert(optionsToInsert);
        if (optErr) throw optErr;
        await supabase.from('event_audit').insert({
          event_id: eventId,
          action: 'poll.create',
          entity_type: 'poll',
          entity_id: newPoll.id,
          message: `Created poll "${question}"`,
          created_by: currentUserId || null,
        });
      }

      setSaving(false);
      onUpdate?.();
      addToast({ title: 'Poll saved', severity: 'success' });
      onClose?.();
    } catch (err) {
      setSaving(false);
      addToast({ title: 'Save failed', description: err.message, severity: 'danger' });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalContent>
        <ModalHeader>{poll ? 'Edit poll' : 'Create poll'}</ModalHeader>
        <ModalBody className="space-y-3">
          <Input
            label="Question"
            placeholder="What is your question?"
            value={question}
            onValueChange={setQuestion}
          />

          <Select
            label="Poll type"
            selectedKeys={[pollType]}
            onSelectionChange={(keys) => setPollType([...keys][0] || 'simple')}
          >
            <SelectItem key="simple">Simple vote</SelectItem>
            <SelectItem key="vote_to_points">Vote to points</SelectItem>
            <SelectItem key="ranked">Ranked choice</SelectItem>
          </Select>

          <div className="space-y-2">
            <label className="text-sm font-semibold">Options</label>
            {options.map((opt, idx) => (
              <div key={idx} className="flex gap-2 items-end">
                <Input
                  size="sm"
                  placeholder="Option label"
                  value={opt.label}
                  onValueChange={(val) => {
                    const updated = [...options];
                    updated[idx].label = val;
                    setOptions(updated);
                  }}
                />
                <Input
                  size="sm"
                  type="number"
                  placeholder="Points"
                  value={(opt.points || 1).toString()}
                  onValueChange={(val) => {
                    const updated = [...options];
                    updated[idx].points = Number(val) || 1;
                    setOptions(updated);
                  }}
                  className="w-20"
                />
                <Button
                  size="sm"
                  color="danger"
                  variant="light"
                  onPress={() => removeOption(idx)}
                >
                  Remove
                </Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input
                size="sm"
                placeholder="New option..."
                value={newOptionLabel}
                onValueChange={setNewOptionLabel}
                onKeyPress={(e) => e.key === 'Enter' && addOption()}
              />
              <Button size="sm" color="primary" variant="flat" onPress={addOption}>
                Add
              </Button>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={onClose}>
            Cancel
          </Button>
          <Button color="primary" isLoading={saving} onPress={handleSave}>
            Save
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
