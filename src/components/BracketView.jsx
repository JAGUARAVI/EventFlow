import { Button, Card, CardBody, Chip, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from '@heroui/react';
import { motion } from 'framer-motion';
import { Trophy, Clock, PlayCircle, CheckCircle2, Plus, MoreVertical, Edit3, Trash2, Users, Layers } from 'lucide-react';

/**
 * BracketView: Visualizes bracket matches in columns (one per round).
 * Single-elimination layout:
 *   - Round with highest number on left (first matches)
 *   - Round 0 (final) on right
 * Supports editing matches if canEdit is true.
 */
export default function BracketView({ 
  matches, 
  teams, 
  bracketType = 'single_elim', 
  canEdit = false, 
  onEditMatch,
  onAddMatch,
  onEditTeams,
  onDeleteMatch,
  onCreateNewRound
}) {
  if (!matches || matches.length === 0) {
    return <p className="text-default-500">No bracket matches yet.</p>;
  }

  if (bracketType === 'round_robin' || bracketType === 'swiss') {
    return (
      <BracketViewList 
        matches={matches} 
        teams={teams} 
        canEdit={canEdit} 
        onEditMatch={onEditMatch}
        onAddMatch={onAddMatch}
        onEditTeams={onEditTeams}
        onDeleteMatch={onDeleteMatch}
        bracketType={bracketType}
        onCreateNewRound={onCreateNewRound}
      />
    );
  }

  // Single-elimination: group by phase (group_id) first, then by round
  // Phases are displayed left to right in order of their minimum round number
  // Within each phase, rounds are displayed in traditional single-elim order
  
  // Group matches by phase
  const phaseMap = {};
  matches.forEach((m) => {
    const phase = m.group_id || 'Main';
    if (!phaseMap[phase]) phaseMap[phase] = [];
    phaseMap[phase].push(m);
  });
  
  // Get phases sorted by their minimum round number (earlier phases first)
  const phases = Object.keys(phaseMap).sort((a, b) => {
    const minRoundA = Math.min(...phaseMap[a].map(m => m.round));
    const minRoundB = Math.min(...phaseMap[b].map(m => m.round));
    return minRoundA - minRoundB;
  });
  
  // Check if all matches are complete for showing "Create New Round" button
  const allMatchesComplete = matches.every((m) => m.status === 'completed');

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-8 p-4 min-w-max items-start">
        {phases.map((phaseName, phaseIdx) => {
          const phaseMatches = phaseMap[phaseName];
          
          // Group matches within this phase by round
          const roundMap = {};
          phaseMatches.forEach((m) => {
            if (!roundMap[m.round]) roundMap[m.round] = [];
            roundMap[m.round].push(m);
          });
          
          // Sort rounds within the phase
          // For legacy "Main" phase (original bracket), rounds go descending (highest = first, 0 = final)
          // For new phases created via NewRoundModal, rounds go ascending
          const isLegacyPhase = phaseName === 'Main';
          const rounds = Object.keys(roundMap).map(Number).sort((a, b) => 
            isLegacyPhase ? b - a : a - b
          );
          
          // Determine round labels within this phase
          const getRoundLabel = (roundNum, roundIdx, totalRounds) => {
            if (isLegacyPhase) {
              // Legacy: round 0 = Final, round 1 = Semifinals, etc.
              if (roundNum === 0) return 'Final';
              if (roundNum === 1) return 'Semifinals';
              if (roundNum === 2) return 'Quarterfinals';
              return `Round ${totalRounds - roundIdx}`;
            } else {
              // New phases: last round in list is Final
              const reverseIdx = totalRounds - 1 - roundIdx;
              if (reverseIdx === 0) return 'Final';
              if (reverseIdx === 1) return 'Semifinals';
              if (reverseIdx === 2) return 'Quarterfinals';
              return `Round ${roundIdx + 1}`;
            }
          };
          
          return (
            <div key={phaseName} className="flex gap-4 items-start">
              {/* Phase divider for non-first phases */}
              {phaseIdx > 0 && (
                <div className="flex flex-col items-center justify-center h-full py-8">
                  <div className="w-px h-full bg-primary/30 min-h-[200px]" />
                  <Chip 
                    size="sm" 
                    color="primary" 
                    variant="flat"
                    className="my-2 rotate-0"
                  >
                    {phaseName}
                  </Chip>
                  <div className="w-px h-full bg-primary/30 min-h-[200px]" />
                </div>
              )}
              
              {/* Phase content */}
              <div className="flex flex-col gap-2">
                {/* Show phase name for first phase if it's not default 'Main' */}
                {phaseIdx === 0 && phaseName !== 'Main' && (
                  <Chip size="sm" color="primary" variant="flat" className="self-start mb-2">
                    {phaseName}
                  </Chip>
                )}
                <div className="flex gap-16 items-center">
                  {rounds.map((roundNum, roundIdx) => (
                    <div key={roundNum} className="flex flex-col gap-8 relative">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-bold text-default-400 uppercase tracking-widest text-center">
                          {getRoundLabel(roundNum, roundIdx, rounds.length)}
                        </h3>
                        {canEdit && onAddMatch && (
                          <Button
                            size="sm"
                            variant="light"
                            isIconOnly
                            onPress={() => onAddMatch(roundNum)}
                          >
                            <Plus size={14} />
                          </Button>
                        )}
                    </div>
                    <div className="flex flex-col justify-around h-full gap-6">
                      {roundMap[roundNum].map((match) => (
                        <SingleElimMatchCard
                          key={match.id}
                          match={match}
                          teams={teams}
                          canEdit={canEdit}
                          onEdit={() => onEditMatch?.(match)}
                          onEditTeams={onEditTeams}
                          onDelete={onDeleteMatch}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              </div>
            </div>
          );
        })}
        
        {/* Create New Round button for single elimination */}
        {canEdit && onCreateNewRound && allMatchesComplete && (
          <div className="flex flex-col gap-8 relative items-center justify-center min-h-[200px]">
            <Button
              variant="flat"
              color="primary"
              startContent={<Layers size={16} />}
              onPress={onCreateNewRound}
            >
              New Phase
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function SingleElimMatchCard({ match, teams, canEdit, onEdit, onEditTeams, onDelete }) {
  const teamA = teams.find((t) => t.id === match.team_a_id);
  const teamB = teams.find((t) => t.id === match.team_b_id);
  const isCompleted = match.status === 'completed';
  const teamAWon = match.winner_id === match.team_a_id;
  const teamBWon = match.winner_id === match.team_b_id;
  const canClick = canEdit && typeof onEdit === 'function';

  return (
    <motion.div
      layout
      whileHover={{ scale: 1.02 }}
      className={`
        relative w-64 rounded-xl border-2 transition-all overflow-hidden
        ${isCompleted 
          ? 'border-default-200 bg-content1/50' 
          : match.status === 'live'
            ? 'border-primary shadow-lg shadow-primary/20 bg-content1'
            : 'border-default-100 bg-content2/30'
        }
      `}
    >
      <div className="flex flex-col divide-y divide-default-100">
        {/* Team A */}
        <motion.div 
          className={`
          flex justify-between items-center p-3 transition-colors cursor-pointer
          ${teamAWon ? 'bg-success/10' : ''}
          ${isCompleted && !teamAWon ? 'opacity-50' : ''}
        `}
          onClick={canClick ? onEdit : undefined}
        >
          <div className="flex items-center gap-2 overflow-hidden">
            {teamAWon && (
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
              >
                <Trophy size={14} className="text-warning shrink-0" />
              </motion.div>
            )}
            <span className={`text-sm truncate ${teamAWon ? 'font-bold text-foreground' : 'font-medium text-default-700'}`}>
              {teamA?.name || <span className="text-default-300 italic">TBD</span>}
            </span>
          </div>
          <span className={`text-sm font-mono font-bold ${teamAWon ? 'text-success' : 'text-default-400'}`}>
            {match.team_a_score ?? '-'}
          </span>
        </motion.div>

        {/* Team B */}
        <motion.div 
          className={`
          flex justify-between items-center p-3 transition-colors cursor-pointer
          ${teamBWon ? 'bg-success/10' : ''}
          ${isCompleted && !teamBWon ? 'opacity-50' : ''}
        `}
          onClick={canClick ? onEdit : undefined}
        >
          <div className="flex items-center gap-2 overflow-hidden">
            {teamBWon && (
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
              >
                <Trophy size={14} className="text-warning shrink-0" />
              </motion.div>
            )}
            <span className={`text-sm truncate ${teamBWon ? 'font-bold text-foreground' : 'font-medium text-default-700'}`}>
              {teamB?.name || <span className="text-default-300 italic">TBD</span>}
            </span>
          </div>
          <span className={`text-sm font-mono font-bold ${teamBWon ? 'text-success' : 'text-default-400'}`}>
            {match.team_b_score ?? '-'}
          </span>
        </motion.div>
      </div>

      {/* Status Bar */}
      <div className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider flex justify-between items-center
        ${isCompleted ? 'bg-default-100 text-default-500' : match.status === 'live' ? 'bg-primary/10 text-primary' : 'bg-default-50 text-default-400'}
      `}>
        <div className="flex items-center gap-1">
          {isCompleted ? (
            <>
              <CheckCircle2 size={10} /> Finished
            </>
          ) : match.status === 'live' ? (
            <>
              <PlayCircle size={10} /> Live
            </>
          ) : (
            <>
              <Clock size={10} /> Pending
            </>
          )}
        </div>
        
        {canEdit && (
          <Dropdown>
            <DropdownTrigger>
              <Button
                size="sm"
                variant="light"
                isIconOnly
                className="min-w-6 w-6 h-5"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical size={12} />
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label="Match actions"
              onAction={(key) => {
                if (key === 'edit') onEdit?.();
                else if (key === 'teams') onEditTeams?.(match);
                else if (key === 'delete') onDelete?.(match);
              }}
            >
              <DropdownItem key="edit" startContent={<Edit3 size={14} />}>
                Edit Score
              </DropdownItem>
              <DropdownItem key="teams" startContent={<Users size={14} />}>
                Change Teams
              </DropdownItem>
              <DropdownItem key="delete" startContent={<Trash2 size={14} />} className="text-danger" color="danger">
                Delete Match
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        )}
      </div>
    </motion.div>
  );
}

/**
 * BracketViewList: Displays round-robin or Swiss matches.
 * For Swiss, groups matches by round number.
 * Also handles mixed bracket types (e.g., Swiss + Single Elim playoffs)
 */
function BracketViewList({ matches, teams, canEdit, onEditMatch, onAddMatch, onEditTeams, onDeleteMatch, bracketType, onCreateNewRound }) {
  // Check if all matches are complete (for showing "Create New Round" button)
  const allMatchesComplete = matches.every((m) => m.status === 'completed');
  
  // For Swiss (or mixed swiss+playoffs), group by round
  if (bracketType === 'swiss') {
    const roundMap = {};
    matches.forEach((m) => {
      const round = m.round ?? 0;
      if (!roundMap[round]) roundMap[round] = [];
      roundMap[round].push(m);
    });
    
    const rounds = Object.keys(roundMap).map(Number).sort((a, b) => a - b);
    
    // Detect if we have mixed bracket types (swiss + playoffs)
    const bracketTypes = [...new Set(matches.map(m => m.bracket_type))];
    const hasMixedTypes = bracketTypes.length > 1;
    
    // Find where playoffs start (first round with single_elim bracket_type)
    let playoffStartRound = null;
    if (hasMixedTypes) {
      for (const roundNum of rounds) {
        const roundMatches = roundMap[roundNum];
        if (roundMatches.some(m => m.bracket_type === 'single_elim')) {
          playoffStartRound = roundNum;
          break;
        }
      }
    }
    
    // Helper to get round label
    const getRoundLabel = (roundNum, roundMatches) => {
      const isPlayoffRound = playoffStartRound !== null && roundNum >= playoffStartRound;
      const matchBracketType = roundMatches[0]?.bracket_type;
      
      if (isPlayoffRound && matchBracketType === 'single_elim') {
        const playoffRoundNum = roundNum - playoffStartRound;
        const totalPlayoffRounds = rounds.filter(r => r >= playoffStartRound).length;
        
        if (playoffRoundNum === totalPlayoffRounds - 1) {
          return 'Grand Final';
        } else if (playoffRoundNum === totalPlayoffRounds - 2) {
          return 'Semifinals';
        } else if (playoffRoundNum === totalPlayoffRounds - 3) {
          return 'Quarterfinals';
        } else {
          return `Playoff Round ${playoffRoundNum + 1}`;
        }
      }
      
      return `Round ${roundNum + 1}`;
    };
    
    return (
      <div className="space-y-8">
        {rounds.map((roundNum, idx) => {
          const roundMatches = roundMap[roundNum];
          const allCompleted = roundMatches.every((m) => m.status === 'completed');
          const anyLive = roundMatches.some((m) => m.status === 'live');
          const isPlayoffRound = playoffStartRound !== null && roundNum >= playoffStartRound;
          const isFirstPlayoffRound = roundNum === playoffStartRound;
          
          return (
            <div key={roundNum}>
              {/* Show playoff divider */}
              {isFirstPlayoffRound && (
                <div className="flex items-center gap-3 mb-4 pb-2 border-b border-primary/30">
                  <Trophy size={16} className="text-primary" />
                  <span className="text-sm font-bold text-primary uppercase tracking-wider">Playoffs</span>
                </div>
              )}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-bold text-default-500 uppercase tracking-wider">
                    {getRoundLabel(roundNum, roundMatches)}
                  </h3>
                  <Chip 
                    size="sm" 
                    variant="flat" 
                    color={allCompleted ? 'success' : anyLive ? 'primary' : 'default'}
                  >
                    {allCompleted ? 'Complete' : anyLive ? 'In Progress' : 'Pending'}
                  </Chip>
                  {isPlayoffRound && (
                    <Chip size="sm" variant="flat" color="secondary">
                      Elimination
                    </Chip>
                  )}
                  {canEdit && onAddMatch && (
                    <Button
                      size="sm"
                      variant="light"
                      startContent={<Plus size={14} />}
                      onPress={() => onAddMatch(roundNum)}
                    >
                      Add Match
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {roundMatches.map((match) => (
                    <MatchCard 
                      key={match.id} 
                      match={match} 
                      teams={teams} 
                      canEdit={canEdit} 
                      onEditMatch={onEditMatch}
                      onEditTeams={onEditTeams}
                      onDeleteMatch={onDeleteMatch}
                    />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
        {canEdit && (
          <div className="flex gap-2 flex-wrap">
            {onAddMatch && (
              <Button
                variant="flat"
                startContent={<Plus size={16} />}
                onPress={() => onAddMatch(rounds.length)}
              >
                Add Match to New Round
              </Button>
            )}
            {onCreateNewRound && allMatchesComplete && (
              <Button
                variant="flat"
                color="primary"
                startContent={<Layers size={16} />}
                onPress={onCreateNewRound}
              >
                Create New Round (Playoffs)
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }
  
  // Round-robin: flat grid
  const allRRComplete = matches.every((m) => m.status === 'completed');
  
  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {canEdit && onAddMatch && (
          <Button
            size="sm"
            variant="flat"
            startContent={<Plus size={14} />}
            onPress={() => onAddMatch(0)}
          >
            Add Match
          </Button>
        )}
        {canEdit && onCreateNewRound && allRRComplete && (
          <Button
            size="sm"
            variant="flat"
            color="primary"
            startContent={<Layers size={14} />}
            onPress={onCreateNewRound}
          >
            Create Playoffs
          </Button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {matches.map((match) => (
          <MatchCard 
            key={match.id} 
            match={match} 
            teams={teams} 
            canEdit={canEdit} 
            onEditMatch={onEditMatch}
            onEditTeams={onEditTeams}
            onDeleteMatch={onDeleteMatch}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Simple match card component used by BracketViewList
 * Styled consistently with SingleElimMatchCard
 */
function MatchCard({ match, teams, canEdit, onEditMatch, onEditTeams, onDeleteMatch }) {
  const teamA = teams.find((t) => t.id === match.team_a_id);
  const teamB = teams.find((t) => t.id === match.team_b_id);
  const isCompleted = match.status === 'completed';
  const teamAWon = match.winner_id === match.team_a_id;
  const teamBWon = match.winner_id === match.team_b_id;
  const canClick = canEdit && typeof onEditMatch === 'function';

  return (
    <motion.div
      layout
      whileHover={{ scale: 1.01 }}
      className={`
        border-2 rounded-xl p-0 overflow-hidden bg-content1
        ${isCompleted 
          ? 'border-default-200' 
          : match.status === 'live' 
            ? 'border-primary shadow-md shadow-primary/20' 
            : 'border-default-100'}
      `}
    >
      <div className="flex flex-col divide-y divide-default-100">
        {/* Team A */}
        <div 
          className={`
            flex justify-between items-center p-3 transition-colors
            ${teamAWon ? 'bg-success/10' : ''}
            ${isCompleted && !teamAWon ? 'opacity-50' : ''}
            ${canClick ? 'cursor-pointer hover:bg-default-100' : ''}
          `}
          onClick={canClick ? () => onEditMatch?.(match) : undefined}
        >
          <div className="flex items-center gap-2 overflow-hidden">
            {teamAWon && (
              <Trophy size={14} className="text-warning shrink-0" />
            )}
            <span className={`text-sm truncate ${teamAWon ? 'font-bold text-foreground' : 'font-medium text-default-700'}`}>
              {teamA?.name || <span className="text-default-300 italic">TBD</span>}
            </span>
          </div>
          <span className={`text-sm font-mono font-bold ${teamAWon ? 'text-success' : 'text-default-400'}`}>
            {match.team_a_score ?? '-'}
          </span>
        </div>
        
        {/* Team B */}
        <div 
          className={`
            flex justify-between items-center p-3 transition-colors
            ${teamBWon ? 'bg-success/10' : ''}
            ${isCompleted && !teamBWon ? 'opacity-50' : ''}
            ${canClick ? 'cursor-pointer hover:bg-default-100' : ''}
          `}
          onClick={canClick ? () => onEditMatch?.(match) : undefined}
        >
          <div className="flex items-center gap-2 overflow-hidden">
            {teamBWon && (
              <Trophy size={14} className="text-warning shrink-0" />
            )}
            <span className={`text-sm truncate ${teamBWon ? 'font-bold text-foreground' : 'font-medium text-default-700'}`}>
              {teamB?.name || <span className="text-default-300 italic">TBD</span>}
            </span>
          </div>
          <span className={`text-sm font-mono font-bold ${teamBWon ? 'text-success' : 'text-default-400'}`}>
            {match.team_b_score ?? '-'}
          </span>
        </div>
      </div>
      
      {/* Status bar with actions */}
      {canEdit && (
        <div className="flex justify-between items-center px-2 py-1 bg-default-50 border-t border-default-100">
          <span className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1
            ${isCompleted ? 'text-default-500' : match.status === 'live' ? 'text-primary' : 'text-default-400'}
          `}>
            {isCompleted ? (
              <><CheckCircle2 size={10} /> Done</>
            ) : match.status === 'live' ? (
              <><PlayCircle size={10} /> Live</>
            ) : (
              <><Clock size={10} /> Pending</>
            )}
          </span>
          <Dropdown>
            <DropdownTrigger>
              <Button size="sm" variant="light" isIconOnly className="min-w-6 w-6 h-5">
                <MoreVertical size={12} />
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label="Match actions"
              onAction={(key) => {
                if (key === 'edit') onEditMatch?.(match);
                else if (key === 'teams') onEditTeams?.(match);
                else if (key === 'delete') onDeleteMatch?.(match);
              }}
            >
              <DropdownItem key="edit" startContent={<Edit3 size={14} />}>
                Edit Score
              </DropdownItem>
              <DropdownItem key="teams" startContent={<Users size={14} />}>
                Change Teams
              </DropdownItem>
              <DropdownItem key="delete" startContent={<Trash2 size={14} />} className="text-danger" color="danger">
                Delete Match
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>
      )}
    </motion.div>
  );
}
