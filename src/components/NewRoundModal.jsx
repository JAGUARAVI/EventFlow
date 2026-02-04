import { useState, useEffect, useMemo } from 'react';
import { 
  Modal, 
  ModalContent, 
  ModalHeader, 
  ModalBody, 
  ModalFooter, 
  Button, 
  Select, 
  SelectItem, 
  Slider,
  Chip,
  Divider,
  addToast,
  Switch,
  RadioGroup,
  Radio,
  Input
} from '@heroui/react';
import { supabase, withRetry } from '../lib/supabase';
import { 
  Plus, 
  Trophy, 
  Users, 
  Zap,
  ArrowRight,
  Tag,
  Medal,
  Target
} from 'lucide-react';
import { 
  generateSingleElimination, 
  generateRoundRobin, 
  generateSwiss,
  computeRoundRobinStandings,
  computeSwissStandings,
  computeSingleElimStandings,
  shuffleTeams
} from '../lib/bracket';

const ROUND_TYPE_OPTIONS = [
  { key: 'single_elim', label: 'Single Elimination', description: 'Knockout format - lose once and you\'re out', icon: Zap },
  { key: 'round_robin', label: 'Round Robin', description: 'Everyone plays everyone in the round', icon: Users },
  { key: 'swiss', label: 'Swiss System', description: 'Pair teams with similar records', icon: Target },
];

const TEAM_SELECTION_MODES = [
  { key: 'all', label: 'All Teams', description: 'Include all teams in the new round' },
  { key: 'top', label: 'Top Teams', description: 'Select top N teams by standings' },
  { key: 'custom', label: 'Custom Selection', description: 'Manually pick which teams to include' },
];

/**
 * NewRoundModal: Modal for creating a new round with different tournament styles
 * Allows transitioning from group stage to playoffs, etc.
 */
export default function NewRoundModal({ 
  isOpen, 
  onClose, 
  eventId,
  teams,
  matches,
  currentBracketType,
  onRoundCreated,
  currentUserId
}) {
  const [roundType, setRoundType] = useState('single_elim');
  const [teamSelectionMode, setTeamSelectionMode] = useState('top');
  const [topTeamsCount, setTopTeamsCount] = useState(4);
  const [selectedTeamIds, setSelectedTeamIds] = useState(new Set());
  const [shuffleOrder, setShuffleOrder] = useState(false);
  const [phaseName, setPhaseName] = useState('');
  const [saving, setSaving] = useState(false);

  // Calculate current standings based on existing matches
  const standings = useMemo(() => {
    if (!matches || matches.length === 0 || !teams || teams.length === 0) {
      return teams.map(t => ({ 
        teamId: t.id, 
        name: t.name, 
        wins: 0, 
        losses: 0, 
        points: t.score || 0,
        scoreDiff: 0,
        rank: 0 
      }));
    }

    // Determine the bracket type from matches
    const bracketType = matches[0]?.bracket_type || currentBracketType;
    let rawStandings;

    if (bracketType === 'round_robin') {
      rawStandings = computeRoundRobinStandings(matches, teams);
    } else if (bracketType === 'swiss') {
      rawStandings = computeSwissStandings(matches, teams);
    } else {
      rawStandings = computeSingleElimStandings(matches, teams);
    }

    // Convert to array and add team names
    const standingsArray = Object.values(rawStandings).map(s => ({
      ...s,
      name: teams.find(t => t.id === s.teamId)?.name || 'Unknown',
      score: teams.find(t => t.id === s.teamId)?.score || 0,
    }));

    // Sort by points (or wins), then by score diff, then by team score
    standingsArray.sort((a, b) => {
      if ((b.points || 0) !== (a.points || 0)) return (b.points || 0) - (a.points || 0);
      if ((b.wins || 0) !== (a.wins || 0)) return (b.wins || 0) - (a.wins || 0);
      if ((b.scoreDiff || 0) !== (a.scoreDiff || 0)) return (b.scoreDiff || 0) - (a.scoreDiff || 0);
      return (b.score || 0) - (a.score || 0);
    });

    // Add rank
    standingsArray.forEach((s, idx) => {
      s.rank = idx + 1;
    });

    return standingsArray;
  }, [matches, teams, currentBracketType]);

  // Get teams that will be included based on selection mode
  const selectedTeams = useMemo(() => {
    if (teamSelectionMode === 'all') {
      return standings.map(s => teams.find(t => t.id === s.teamId)).filter(Boolean);
    } else if (teamSelectionMode === 'top') {
      const topStandings = standings.slice(0, topTeamsCount);
      return topStandings.map(s => teams.find(t => t.id === s.teamId)).filter(Boolean);
    } else {
      // Custom selection
      return teams.filter(t => selectedTeamIds.has(t.id));
    }
  }, [teamSelectionMode, standings, topTeamsCount, selectedTeamIds, teams]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      // Smart defaults based on current bracket type
      if (currentBracketType === 'round_robin' || currentBracketType === 'swiss') {
        setRoundType('single_elim');
        setTeamSelectionMode('top');
        // Default to power of 2 for elimination
        const teamCount = teams.length;
        const defaultTop = teamCount >= 8 ? 8 : teamCount >= 4 ? 4 : 2;
        setTopTeamsCount(Math.min(defaultTop, teamCount));
      } else if (currentBracketType === 'single_elim') {
        // For single elim, offer options to continue with different formats
        // Default to another single_elim round (e.g., consolation bracket, or new phase)
        setRoundType('single_elim');
        setTeamSelectionMode('custom');
        // Pre-select teams that lost in the last round (for consolation) or winners
        const completedMatches = matches.filter(m => m.status === 'completed');
        if (completedMatches.length > 0) {
          // Find the highest round (most recent)
          const maxRound = Math.max(...completedMatches.map(m => m.round || 0));
          const lastRoundMatches = completedMatches.filter(m => m.round === maxRound);
          // Get losers from last round for potential consolation bracket
          const losers = new Set();
          lastRoundMatches.forEach(m => {
            if (m.winner_id === m.team_a_id && m.team_b_id) {
              losers.add(m.team_b_id);
            } else if (m.winner_id === m.team_b_id && m.team_a_id) {
              losers.add(m.team_a_id);
            }
          });
          setSelectedTeamIds(losers);
        }
      } else {
        setRoundType('swiss');
        setTeamSelectionMode('all');
      }
      setShuffleOrder(false);
      // Set default phase name
      if (currentBracketType === 'round_robin' || currentBracketType === 'swiss') {
        setPhaseName('Playoffs');
      } else {
        setPhaseName('');
      }
    }
  }, [isOpen, currentBracketType, teams.length, matches]);

  // Calculate next round number
  const nextRoundNumber = useMemo(() => {
    if (!matches || matches.length === 0) return 0;
    const maxRound = Math.max(...matches.map(m => m.round || 0));
    return maxRound + 1;
  }, [matches]);

  // Check if current round is complete
  const currentRoundComplete = useMemo(() => {
    if (!matches || matches.length === 0) return true;
    const maxRound = Math.max(...matches.map(m => m.round || 0));
    const currentRoundMatches = matches.filter(m => m.round === maxRound);
    return currentRoundMatches.every(m => m.status === 'completed');
  }, [matches]);

  // Generate matches for new round
  const handleCreateRound = async () => {
    if (selectedTeams.length < 2) {
      addToast({ 
        title: 'Not enough teams', 
        description: 'Select at least 2 teams for the new round',
        severity: 'warning' 
      });
      return;
    }

    if (!currentRoundComplete) {
      addToast({ 
        title: 'Current round not complete', 
        description: 'Complete all matches in the current round first',
        severity: 'warning' 
      });
      return;
    }

    setSaving(true);

    try {
      // Prepare teams for bracket generation
      let teamsForBracket = [...selectedTeams];
      
      if (shuffleOrder) {
        teamsForBracket = shuffleTeams(teamsForBracket);
      } else if (teamSelectionMode === 'top') {
        // Keep seeded order (top teams first)
        teamsForBracket = standings
          .slice(0, topTeamsCount)
          .map(s => teams.find(t => t.id === s.teamId))
          .filter(Boolean);
      }

      // Generate matches based on round type
      let generatedMatches = [];
      
      if (roundType === 'single_elim') {
        generatedMatches = generateSingleElimination(eventId, teamsForBracket);
      } else if (roundType === 'round_robin') {
        generatedMatches = generateRoundRobin(eventId, teamsForBracket);
      } else if (roundType === 'swiss') {
        generatedMatches = generateSwiss(eventId, teamsForBracket, 0, []);
      }

      // Adjust round numbers - new rounds should come AFTER existing rounds
      // Single elim generates rounds counting down (highest round = first matches, round 0 = final)
      // We need to reverse this and offset so playoffs appear after group stage
      const phaseLabel = phaseName.trim() || `Phase ${nextRoundNumber + 1}`;
      
      if (roundType === 'single_elim') {
        // Single elim: convert descending round numbers to ascending
        // Original: round 2 (quarters) -> round 1 (semis) -> round 0 (final)
        // We need: nextRound (quarters) -> nextRound+1 (semis) -> nextRound+2 (final)
        const maxGenRound = Math.max(...generatedMatches.map(m => m.round), 0);
        generatedMatches = generatedMatches.map(m => ({
          ...m,
          // Invert the round number and add offset
          // maxGenRound - m.round gives us: 0, 1, 2 for quarters, semis, final
          // Then add nextRoundNumber to offset after existing matches
          round: nextRoundNumber + (maxGenRound - m.round),
          group_id: phaseLabel,
        }));
      } else {
        // For round_robin and swiss, just offset by next round number
        generatedMatches = generatedMatches.map(m => ({
          ...m,
          round: m.round + nextRoundNumber,
          group_id: phaseLabel,
        }));
      }

      if (generatedMatches.length === 0) {
        addToast({ 
          title: 'No matches generated', 
          description: 'Could not generate matches for the selected teams',
          severity: 'warning' 
        });
        setSaving(false);
        return;
      }

      // Insert matches
      const { error } = await withRetry(() => 
        supabase.from('matches').insert(generatedMatches)
      );

      if (error) throw error;

      // Audit log
      await supabase.from('event_audit').insert({
        event_id: eventId,
        action: 'bracket.new_round',
        entity_type: 'bracket',
        message: `Created new ${roundType.replace('_', ' ')} round with ${selectedTeams.length} teams`,
        created_by: currentUserId,
        metadata: { 
          round_type: roundType, 
          team_count: selectedTeams.length,
          team_selection: teamSelectionMode,
          round_number: nextRoundNumber,
        },
      });

      addToast({ 
        title: 'Round created', 
        description: `${roundType.replace('_', ' ')} round with ${generatedMatches.length} matches`,
        severity: 'success' 
      });

      onRoundCreated?.();
      onClose();
    } catch (err) {
      console.error('[NewRoundModal] Create error:', err);
      addToast({ 
        title: 'Failed to create round', 
        description: err.message, 
        severity: 'danger' 
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleTeamSelection = (teamId) => {
    const newSet = new Set(selectedTeamIds);
    if (newSet.has(teamId)) {
      newSet.delete(teamId);
    } else {
      newSet.add(teamId);
    }
    setSelectedTeamIds(newSet);
  };

  // Helper to get recommended team count for elimination
  const getRecommendedCounts = () => {
    const counts = [];
    [2, 4, 8, 16, 32].forEach(n => {
      if (n <= teams.length) counts.push(n);
    });
    return counts;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <Plus size={20} />
          Create New Round
        </ModalHeader>
        <ModalBody className="space-y-6">
          {/* Current standings preview */}
          {matches.length > 0 && (
            <div className="p-3 bg-default-50 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-default-600">
                <Trophy size={16} />
                Current Standings
              </div>
              <div className="flex flex-wrap gap-2">
                {standings.slice(0, 8).map((s, idx) => (
                  <Chip 
                    key={s.teamId} 
                    size="sm" 
                    variant="flat"
                    color={idx < 3 ? 'success' : 'default'}
                    startContent={<span className="font-bold text-xs">#{s.rank}</span>}
                  >
                    {s.name} ({s.wins || 0}W)
                  </Chip>
                ))}
                {standings.length > 8 && (
                  <Chip size="sm" variant="flat">+{standings.length - 8} more</Chip>
                )}
              </div>
            </div>
          )}

          {!currentRoundComplete && (
            <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg text-warning-600 text-sm">
              ⚠️ Complete all matches in the current round before creating a new one.
            </div>
          )}

          {/* Round Type Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Round Format</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {ROUND_TYPE_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isSelected = roundType === option.key;
                return (
                  <div
                    key={option.key}
                    className={`
                      p-4 rounded-xl border-2 cursor-pointer transition-all
                      ${isSelected 
                        ? 'border-primary bg-primary/10' 
                        : 'border-default-200 hover:border-default-300'}
                    `}
                    onClick={() => setRoundType(option.key)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon size={18} className={isSelected ? 'text-primary' : 'text-default-400'} />
                      <span className={`font-medium ${isSelected ? 'text-primary' : ''}`}>
                        {option.label}
                      </span>
                    </div>
                    <p className="text-xs text-default-500">{option.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Phase Name Input */}
          <div className="space-y-2">
            <Input
              label="Phase Name"
              placeholder="e.g., Playoffs, Consolation, Finals"
              value={phaseName}
              onValueChange={setPhaseName}
              startContent={<Tag size={16} className="text-default-400" />}
              description="Optional name to identify this phase in the bracket"
            />
          </div>

          <Divider />

          {/* Team Selection Mode */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Team Selection</label>
            <RadioGroup 
              value={teamSelectionMode} 
              onValueChange={setTeamSelectionMode}
              orientation="horizontal"
            >
              {TEAM_SELECTION_MODES.map((mode) => (
                <Radio key={mode.key} value={mode.key} description={mode.description}>
                  {mode.label}
                </Radio>
              ))}
            </RadioGroup>
          </div>

          {/* Top N Teams Slider */}
          {teamSelectionMode === 'top' && (
            <div className="space-y-3 p-4 bg-default-50 rounded-xl">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Top Teams to Include</label>
                <Chip color="primary" variant="flat" size="sm">
                  <Medal size={12} className="mr-1" />
                  {topTeamsCount} teams
                </Chip>
              </div>
              <Slider
                size="sm"
                step={1}
                minValue={2}
                maxValue={teams.length}
                value={topTeamsCount}
                onChange={setTopTeamsCount}
                className="max-w-full"
                marks={getRecommendedCounts().map(n => ({ value: n, label: `${n}` }))}
              />
              {roundType === 'single_elim' && (
                <div className="flex gap-2 flex-wrap">
                  <span className="text-xs text-default-500">Quick select:</span>
                  {getRecommendedCounts().map(n => (
                    <Button
                      key={n}
                      size="sm"
                      variant={topTeamsCount === n ? 'solid' : 'flat'}
                      color={topTeamsCount === n ? 'primary' : 'default'}
                      onPress={() => setTopTeamsCount(n)}
                    >
                      Top {n}
                    </Button>
                  ))}
                </div>
              )}
              
              {/* Preview of selected teams */}
              <div className="mt-3 space-y-1">
                <p className="text-xs text-default-500 font-medium">Teams advancing:</p>
                <div className="flex flex-wrap gap-1">
                  {standings.slice(0, topTeamsCount).map((s, idx) => (
                    <Chip 
                      key={s.teamId} 
                      size="sm" 
                      variant="flat"
                      color={idx < topTeamsCount ? 'success' : 'default'}
                    >
                      #{s.rank} {s.name}
                    </Chip>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Custom Team Selection */}
          {teamSelectionMode === 'custom' && (
            <div className="space-y-3 p-4 bg-default-50 rounded-xl">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Select Teams</label>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="flat"
                    onPress={() => setSelectedTeamIds(new Set(teams.map(t => t.id)))}
                  >
                    All
                  </Button>
                  <Button
                    size="sm"
                    variant="flat"
                    onPress={() => setSelectedTeamIds(new Set())}
                  >
                    None
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[200px] overflow-y-auto">
                {standings.map((s) => (
                  <div
                    key={s.teamId}
                    className={`
                      flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all
                      ${selectedTeamIds.has(s.teamId) 
                        ? 'border-primary bg-primary/10' 
                        : 'border-default-200 hover:border-default-300'}
                    `}
                    onClick={() => toggleTeamSelection(s.teamId)}
                  >
                    <div className={`
                      w-4 h-4 rounded border-2 flex items-center justify-center
                      ${selectedTeamIds.has(s.teamId) 
                        ? 'border-primary bg-primary text-white' 
                        : 'border-default-300'}
                    `}>
                      {selectedTeamIds.has(s.teamId) && (
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className="text-xs font-medium truncate">
                      #{s.rank} {s.name}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-default-500">
                {selectedTeamIds.size} teams selected
              </p>
            </div>
          )}

          {/* Options */}
          <div className="flex items-center justify-between p-3 bg-default-50 rounded-lg">
            <div>
              <p className="text-sm font-medium">Shuffle Seeding</p>
              <p className="text-xs text-default-500">
                Randomize team order instead of seeding by standings
              </p>
            </div>
            <Switch 
              isSelected={shuffleOrder} 
              onValueChange={setShuffleOrder}
              size="sm"
            />
          </div>

          {/* Summary */}
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
            <div className="flex items-center gap-2 text-sm font-medium text-primary mb-2">
              <ArrowRight size={16} />
              Round Summary
            </div>
            <div className="text-sm text-default-600 space-y-1">
              <p>
                <span className="font-medium">{selectedTeams.length}</span> teams will compete in a 
                <span className="font-medium"> {ROUND_TYPE_OPTIONS.find(o => o.key === roundType)?.label}</span> format
              </p>
              <p className="text-xs text-default-500">
                {roundType === 'single_elim' && `${Math.ceil(Math.log2(selectedTeams.length))} rounds, ${selectedTeams.length - 1} total matches`}
                {roundType === 'round_robin' && `${(selectedTeams.length * (selectedTeams.length - 1)) / 2} total matches`}
                {roundType === 'swiss' && `First Swiss round with ${Math.floor(selectedTeams.length / 2)} matches`}
              </p>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={onClose}>
            Cancel
          </Button>
          <Button 
            color="primary" 
            onPress={handleCreateRound} 
            isLoading={saving}
            isDisabled={selectedTeams.length < 2 || !currentRoundComplete}
            startContent={<Plus size={16} />}
          >
            Create Round
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
