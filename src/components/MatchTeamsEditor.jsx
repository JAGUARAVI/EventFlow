import { useState, useEffect, useMemo } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Select, SelectItem, addToast, Chip, Tooltip } from '@heroui/react';
import { supabase, withRetry } from '../lib/supabase';
import { Users, Shuffle, AlertCircle } from 'lucide-react';

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
  isNewMatch = false,
  allMatches = [] // All matches in the event for determining teams in round
}) {
  const [teamAId, setTeamAId] = useState('');
  const [teamBId, setTeamBId] = useState('');
  const [saving, setSaving] = useState(false);

  // Calculate teams that are already in the current round (excluding current match)
  const teamsInRound = useMemo(() => {
    const roundMatches = allMatches.filter(m => m.round === (match?.round ?? round));
    const teamIds = new Set();
    roundMatches.forEach(m => {
      // Exclude the current match being edited
      if (match && m.id === match.id) return;
      if (m.team_a_id) teamIds.add(m.team_a_id);
      if (m.team_b_id) teamIds.add(m.team_b_id);
    });
    return teamIds;
  }, [allMatches, match, round]);

  // Teams not in the current round (available for random selection)
  const availableTeams = useMemo(() => {
    return teams.filter(t => !teamsInRound.has(t.id));
  }, [teams, teamsInRound]);

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

  // Pick random teams from available teams (not in current round)
  const handleRandomTeams = () => {
    // Get teams that are available and not already selected
    const selectableTeams = availableTeams.filter(t => t.id !== teamAId && t.id !== teamBId);
    
    if (selectableTeams.length < 2) {
      addToast({ 
        title: 'Not enough available teams', 
        description: 'Need at least 2 teams not already in this round',
        severity: 'warning' 
      });
      return;
    }

    // Shuffle and pick 2
    const shuffled = [...selectableTeams].sort(() => Math.random() - 0.5);
    setTeamAId(shuffled[0].id);
    setTeamBId(shuffled[1].id);
    addToast({ title: 'Random teams selected', severity: 'success' });
  };

  // Pick random Team A from available teams
  const handleRandomTeamA = () => {
    const selectableTeams = availableTeams.filter(t => t.id !== teamBId);
    if (selectableTeams.length === 0) {
      addToast({ title: 'No available teams for Team A', severity: 'warning' });
      return;
    }
    const randomTeam = selectableTeams[Math.floor(Math.random() * selectableTeams.length)];
    setTeamAId(randomTeam.id);
  };

  // Pick random Team B from available teams
  const handleRandomTeamB = () => {
    const selectableTeams = availableTeams.filter(t => t.id !== teamAId);
    if (selectableTeams.length === 0) {
      addToast({ title: 'No available teams for Team B', severity: 'warning' });
      return;
    }
    const randomTeam = selectableTeams[Math.floor(Math.random() * selectableTeams.length)];
    setTeamBId(randomTeam.id);
  };

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

          {/* Random team selection section */}
          {isNewMatch && availableTeams.length >= 2 && (
            <div className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-lg">
              <div className="flex items-center gap-2">
                <Shuffle size={16} className="text-primary" />
                <span className="text-sm">
                  <span className="font-medium">{availableTeams.length}</span> teams not in this round
                </span>
              </div>
              <Tooltip content="Pick 2 random teams not already in this round">
                <Button
                  size="sm"
                  color="primary"
                  variant="flat"
                  startContent={<Shuffle size={14} />}
                  onPress={handleRandomTeams}
                >
                  Random Match
                </Button>
              </Tooltip>
            </div>
          )}

          {isNewMatch && availableTeams.length > 0 && availableTeams.length < 2 && (
            <div className="flex items-center gap-2 p-3 bg-warning/10 border border-warning/20 rounded-lg text-warning-600 text-sm">
              <AlertCircle size={16} />
              Only {availableTeams.length} team{availableTeams.length === 1 ? '' : 's'} available (not in this round)
            </div>
          )}

          <div className="flex items-end gap-2">
            <Select
              label="Team A"
              placeholder="Select Team A (or leave empty for TBD)"
              selectedKeys={teamAId ? [teamAId] : []}
              onSelectionChange={(keys) => setTeamAId([...keys][0] || '')}
              className="flex-1"
              description={isNewMatch && teamsInRound.size > 0 ? `${teamAOptions.filter(t => !teamsInRound.has(t.id)).length} available` : undefined}
            >
              {teamAOptions.map((team) => (
                <SelectItem 
                  key={team.id}
                  className={teamsInRound.has(team.id) ? 'text-default-400' : ''}
                >
                  {team.name}{teamsInRound.has(team.id) ? ' (in round)' : ''}
                </SelectItem>
              ))}
            </Select>
            {isNewMatch && (
              <Tooltip content="Random team not in this round">
                <Button
                  size="sm"
                  variant="flat"
                  isIconOnly
                  onPress={handleRandomTeamA}
                  isDisabled={availableTeams.filter(t => t.id !== teamBId).length === 0}
                >
                  <Shuffle size={14} />
                </Button>
              </Tooltip>
            )}
          </div>

          <div className="text-center text-default-400 font-bold">VS</div>

          <div className="flex items-end gap-2">
            <Select
              label="Team B"
              placeholder="Select Team B (or leave empty for TBD/Bye)"
              selectedKeys={teamBId ? [teamBId] : []}
              onSelectionChange={(keys) => setTeamBId([...keys][0] || '')}
              className="flex-1"
              description={isNewMatch && teamsInRound.size > 0 ? `${teamBOptions.filter(t => !teamsInRound.has(t.id)).length} available` : undefined}
            >
              {teamBOptions.map((team) => (
                <SelectItem 
                  key={team.id}
                  className={teamsInRound.has(team.id) ? 'text-default-400' : ''}
                >
                  {team.name}{teamsInRound.has(team.id) ? ' (in round)' : ''}
                </SelectItem>
              ))}
            </Select>
            {isNewMatch && (
              <Tooltip content="Random team not in this round">
                <Button
                  size="sm"
                  variant="flat"
                  isIconOnly
                  onPress={handleRandomTeamB}
                  isDisabled={availableTeams.filter(t => t.id !== teamAId).length === 0}
                >
                  <Shuffle size={14} />
                </Button>
              </Tooltip>
            )}
          </div>

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
