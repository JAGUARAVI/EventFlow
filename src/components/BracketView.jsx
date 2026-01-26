import { Button, Card, CardBody, Chip, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from '@heroui/react';
import { motion } from 'framer-motion';
import { Trophy, Clock, PlayCircle, CheckCircle2, Plus, MoreVertical, Edit3, Trash2, Users } from 'lucide-react';

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
  onDeleteMatch 
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
      />
    );
  }

  // Single-elimination: group by round and display as columns
  const roundMap = {};
  matches.forEach((m) => {
    if (!roundMap[m.round]) roundMap[m.round] = [];
    roundMap[m.round].push(m);
  });

  const rounds = Object.keys(roundMap).map(Number).sort((a, b) => b - a);

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-16 p-4 min-w-max items-center">
        {rounds.map((roundNum, idx) => (
          <div key={roundNum} className="flex flex-col gap-8 relative">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-default-400 uppercase tracking-widest text-center">
                {roundNum === 0 ? 'Grand Final' : roundNum === 1 ? 'Semifinals' : roundNum === 2 ? 'Quarterfinals' : `Round ${rounds.length - roundNum}`}
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
 */
function BracketViewList({ matches, teams, canEdit, onEditMatch, onAddMatch, onEditTeams, onDeleteMatch, bracketType }) {
  // For Swiss, group by round
  if (bracketType === 'swiss') {
    const roundMap = {};
    matches.forEach((m) => {
      const round = m.round ?? 0;
      if (!roundMap[round]) roundMap[round] = [];
      roundMap[round].push(m);
    });
    
    const rounds = Object.keys(roundMap).map(Number).sort((a, b) => a - b);
    
    return (
      <div className="space-y-8">
        {rounds.map((roundNum) => {
          const roundMatches = roundMap[roundNum];
          const allCompleted = roundMatches.every((m) => m.status === 'completed');
          const anyLive = roundMatches.some((m) => m.status === 'live');
          
          return (
            <div key={roundNum} className="space-y-3">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-bold text-default-500 uppercase tracking-wider">
                  Round {roundNum + 1}
                </h3>
                <Chip 
                  size="sm" 
                  variant="flat" 
                  color={allCompleted ? 'success' : anyLive ? 'primary' : 'default'}
                >
                  {allCompleted ? 'Complete' : anyLive ? 'In Progress' : 'Pending'}
                </Chip>
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
          );
        })}
        {canEdit && onAddMatch && (
          <Button
            variant="flat"
            startContent={<Plus size={16} />}
            onPress={() => onAddMatch(rounds.length)}
          >
            Add New Round
          </Button>
        )}
      </div>
    );
  }
  
  // Round-robin: flat grid
  return (
    <div className="space-y-4">
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
        border rounded-xl p-0 overflow-hidden bg-content1
        ${isCompleted ? 'border-default-200' : match.status === 'live' ? 'border-primary shadow-md' : 'border-default-100'}
      `}
    >
      <div className="flex flex-col divide-y divide-default-100">
        <div 
          className={`flex justify-between p-3 ${teamAWon ? 'bg-success/5 font-bold' : ''} ${canClick ? 'cursor-pointer hover:bg-default-100' : ''}`}
          onClick={canClick ? () => onEditMatch?.(match) : undefined}
        >
         <span className="text-sm truncate">{teamA?.name || 'TBD'}</span>
         <span className="font-mono text-sm">{match.team_a_score ?? '-'}</span>
        </div>
        <div 
          className={`flex justify-between p-3 ${teamBWon ? 'bg-success/5 font-bold' : ''} ${canClick ? 'cursor-pointer hover:bg-default-100' : ''}`}
          onClick={canClick ? () => onEditMatch?.(match) : undefined}
        >
         <span className="text-sm truncate">{teamB?.name || 'TBD'}</span>
         <span className="font-mono text-sm">{match.team_b_score ?? '-'}</span>
        </div>
      </div>
      {canEdit && (
        <div className="flex justify-end p-1 bg-default-50 border-t border-default-100">
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
