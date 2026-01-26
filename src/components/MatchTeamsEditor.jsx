import { useState, useEffect } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Select, SelectItem, addToast } from '@heroui/react';
import { supabase, withRetry } from '../lib/supabase';
import { Users } from 'lucide-react';

/**
 * MatchTeamsEditor: Modal for changing teams in a match or creating a new match
 */
export default function MatchTeamsEditor({ 
  isOpen, 
  onClose, 
  match, 
  teams, 
  eventId,
  round = 0,
  bracketType = 'single_elim',
  onUpdate, 
  onAudit,
  isNewMatch = false 
}) {
  const [teamAId, setTeamAId] = useState('');
  const [teamBId, setTeamBId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (match) {
        setTeamAId(match.team_a_id || '');
        setTeamBId(match.team_b_id || '');
      } else {
        setTeamAId('');
        setTeamBId('');
      }
    }
  }, [match, isOpen]);
  
  useEffect(() => {
    if (!isOpen) {
      setSaving(false);
    }
  }, [isOpen]);

  const handleSave = async () => {
    if (saving) return;
    
    if (!teamAId && !teamBId) {
      addToast({ title: 'Select at least one team', severity: 'warning' });
      return;
    }
    
    if (teamAId && teamBId && teamAId === teamBId) {
      addToast({ title: 'Team A and Team B cannot be the same', severity: 'warning' });
      return;
    }
    
    setSaving(true);

    try {
      if (isNewMatch) {
        // Create a new match
        const newMatch = {
          event_id: eventId,
          round: round,
          position: 0, // Will be updated by caller if needed
          team_a_id: teamAId || null,
          team_b_id: teamBId || null,
          status: 'pending',
          team_a_score: 0,
          team_b_score: 0,
          bracket_type: bracketType,
        };

        const { data, error } = await withRetry(() => 
          supabase.from('matches').insert(newMatch).select().single()
        );
        
        if (error) throw error;

        addToast({ title: 'Match created', severity: 'success' });
        onUpdate?.(data);
        onAudit?.('create_match', { match: data });
      } else {
        // Update existing match
        const update = {
          team_a_id: teamAId || null,
          team_b_id: teamBId || null,
          // Clear winner if teams changed and winner is no longer valid
          winner_id: (match.winner_id === teamAId || match.winner_id === teamBId) 
            ? match.winner_id 
            : null,
        };

        const { error } = await withRetry(() => 
          supabase.from('matches').update(update).eq('id', match.id)
        );
        
        if (error) throw error;

        addToast({ title: 'Teams updated', severity: 'success' });
        onUpdate?.(match.id, update);
        onAudit?.(match, update);
      }
      
      onClose?.();
    } catch (err) {
      console.error('[MatchTeamsEditor] Save error:', err);
      addToast({ title: 'Save failed', description: err.message, severity: 'danger' });
    } finally {
      setSaving(false);
    }
  };

  const currentTeamA = match?.team_a_id;
  const currentTeamB = match?.team_b_id;

  // Filter teams for selection - allow TBD (empty) or any team except the other selected one
  const teamAOptions = teams.filter(t => t.id !== teamBId);
  const teamBOptions = teams.filter(t => t.id !== teamAId);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <Users size={20} />
          {isNewMatch ? 'Create New Match' : 'Change Teams'}
        </ModalHeader>
        <ModalBody className="space-y-4">
          {!isNewMatch && match && (
            <div className="text-sm text-default-500 bg-default-100 p-3 rounded-lg">
              Round {match.round}, Position {match.position}
            </div>
          )}
          
          {isNewMatch && (
            <div className="text-sm text-default-500 bg-default-100 p-3 rounded-lg">
              Creating match for Round {round}
            </div>
          )}

          <Select
            label="Team A"
            placeholder="Select Team A (or leave empty for TBD)"
            selectedKeys={teamAId ? [teamAId] : []}
            onSelectionChange={(keys) => setTeamAId([...keys][0] || '')}
          >
            {teamAOptions.map((team) => (
              <SelectItem key={team.id}>{team.name}</SelectItem>
            ))}
          </Select>

          <div className="text-center text-default-400 font-bold">VS</div>

          <Select
            label="Team B"
            placeholder="Select Team B (or leave empty for TBD/Bye)"
            selectedKeys={teamBId ? [teamBId] : []}
            onSelectionChange={(keys) => setTeamBId([...keys][0] || '')}
          >
            {teamBOptions.map((team) => (
              <SelectItem key={team.id}>{team.name}</SelectItem>
            ))}
          </Select>

          {!isNewMatch && match?.winner_id && 
            match.winner_id !== teamAId && 
            match.winner_id !== teamBId && (
            <p className="text-warning text-sm">
              ⚠️ Current winner will be cleared because neither selected team is the winner.
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={onClose}>
            Cancel
          </Button>
          <Button color="primary" onPress={handleSave} isLoading={saving}>
            {isNewMatch ? 'Create Match' : 'Save Changes'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
