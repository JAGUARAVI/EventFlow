import { useState, useEffect } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Input, Select, SelectItem, addToast } from '@heroui/react';
import { supabase } from '../lib/supabase';

export default function MatchEditor({ isOpen, onClose, match, teams, onUpdate, onAudit }) {
  const [scoreA, setScoreA] = useState('0');
  const [scoreB, setScoreB] = useState('0');
  const [winnerId, setWinnerId] = useState('');
  const [status, setStatus] = useState('pending');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (match && isOpen) {
      setScoreA((match.team_a_score || 0).toString());
      setScoreB((match.team_b_score || 0).toString());
      setWinnerId(match.winner_id || '');
      setStatus(match.status || 'pending');
    }
  }, [match, isOpen]);

  const handleSave = async () => {
    if (!match) return;
    setSaving(true);

    const update = {
      team_a_score: Number(scoreA) || 0,
      team_b_score: Number(scoreB) || 0,
      winner_id: winnerId || null,
      status,
    };

    const { error } = await supabase.from('matches').update(update).eq('id', match.id);
    setSaving(false);

    if (error) {
      addToast({ title: 'Save failed', description: error.message, severity: 'danger' });
      return;
    }

    onUpdate?.(match.id, update);
    onAudit?.(match, update);
    addToast({ title: 'Match updated', severity: 'success' });
    onClose?.();
  };

  if (!match) return null;

  const teamAName = teams.find((t) => t.id === match.team_a_id)?.name || '(TBD)';
  const teamBName = teams.find((t) => t.id === match.team_b_id)?.name || '(TBD / Bye)';

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalContent>
        <ModalHeader>Edit Match</ModalHeader>
        <ModalBody className="space-y-3">
          <div className="text-sm">
            <p className="font-semibold">
              {teamAName} vs {teamBName}
            </p>
            <p className="text-default-500 text-xs">Round {match.round}, Position {match.position}</p>
          </div>

          <Input
            label="Team A Score"
            type="number"
            value={scoreA}
            onValueChange={setScoreA}
            placeholder="0"
          />

          <Input
            label="Team B Score"
            type="number"
            value={scoreB}
            onValueChange={setScoreB}
            placeholder="0"
          />

          <Select
            label="Winner"
            selectedKeys={winnerId ? [winnerId] : []}
            onSelectionChange={(keys) => setWinnerId([...keys][0] || '')}
          >
            {match.team_a_id && (
              <SelectItem key={match.team_a_id}>{teamAName}</SelectItem>
            )}
            {match.team_b_id && (
              <SelectItem key={match.team_b_id}>{teamBName}</SelectItem>
            )}
          </Select>

          <Select
            label="Status"
            selectedKeys={[status]}
            onSelectionChange={(keys) => setStatus([...keys][0] || 'pending')}
          >
            <SelectItem key="pending">Pending</SelectItem>
            <SelectItem key="live">Live</SelectItem>
            <SelectItem key="completed">Completed</SelectItem>
          </Select>
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={onClose}>
            Cancel
          </Button>
          <Button color="primary" onPress={handleSave} isLoading={saving}>
            Save
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
