import { Button, Card, CardBody, Chip } from '@heroui/react';
import { motion } from 'framer-motion';
import { Trophy, Clock, PlayCircle, CheckCircle2 } from 'lucide-react';

/**
 * BracketView: Visualizes bracket matches in columns (one per round).
 * Single-elimination layout:
 *   - Round with highest number on left (first matches)
 *   - Round 0 (final) on right
 * Supports editing matches if canEdit is true.
 */
export default function BracketView({ matches, teams, bracketType = 'single_elim', canEdit = false, onEditMatch }) {
  if (!matches || matches.length === 0) {
    return <p className="text-default-500">No bracket matches yet.</p>;
  }

  if (bracketType === 'round_robin' || bracketType === 'swiss') {
    return <BracketViewList matches={matches} teams={teams} canEdit={canEdit} onEditMatch={onEditMatch} />;
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
            <h3 className="text-sm font-bold text-default-400 uppercase tracking-widest text-center">
              {roundNum === 0 ? 'Grand Final' : roundNum === 1 ? 'Semifinals' : roundNum === 2 ? 'Quarterfinals' : `Round ${rounds.length - roundNum}`}
            </h3>
            <div className="flex flex-col justify-around h-full gap-6">
              {roundMap[roundNum].map((match) => (
                <SingleElimMatchCard
                  key={match.id}
                  match={match}
                  teams={teams}
                  canEdit={canEdit}
                  onEdit={() => onEditMatch?.(match)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SingleElimMatchCard({ match, teams, canEdit, onEdit }) {
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
        ${canClick ? 'cursor-pointer hover:border-primary/50' : ''}
      `}
      onClick={canClick ? onEdit : undefined}
    >
      <div className="flex flex-col divide-y divide-default-100">
        {/* Team A */}
        <div className={`
          flex justify-between items-center p-3 transition-colors
          ${teamAWon ? 'bg-success/10' : ''}
          ${isCompleted && !teamAWon ? 'opacity-50' : ''}
        `}>
          <div className="flex items-center gap-2 overflow-hidden">
            {teamAWon && <Trophy size={14} className="text-warning shrink-0" />}
            <span className={`text-sm truncate ${teamAWon ? 'font-bold text-foreground' : 'font-medium text-default-700'}`}>
              {teamA?.name || <span className="text-default-300 italic">TBD</span>}
            </span>
          </div>
          <span className={`text-sm font-mono font-bold ${teamAWon ? 'text-success' : 'text-default-400'}`}>
            {match.team_a_score ?? '-'}
          </span>
        </div>

        {/* Team B */}
        <div className={`
          flex justify-between items-center p-3 transition-colors
          ${teamBWon ? 'bg-success/10' : ''}
          ${isCompleted && !teamBWon ? 'opacity-50' : ''}
        `}>
          <div className="flex items-center gap-2 overflow-hidden">
            {teamBWon && <Trophy size={14} className="text-warning shrink-0" />}
            <span className={`text-sm truncate ${teamBWon ? 'font-bold text-foreground' : 'font-medium text-default-700'}`}>
              {teamB?.name || <span className="text-default-300 italic">TBD</span>}
            </span>
          </div>
          <span className={`text-sm font-mono font-bold ${teamBWon ? 'text-success' : 'text-default-400'}`}>
            {match.team_b_score ?? '-'}
          </span>
        </div>
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
          <span className="text-[9px] bg-default-200 px-1.5 py-0.5 rounded text-default-600">
            Edit
          </span>
        )}
      </div>
    </motion.div>
  );
}

/**
 * BracketViewList: Displays round-robin or Swiss matches as a simple list.
 */
function BracketViewList({ matches, teams, canEdit, onEditMatch }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {matches.map((match) => {
        const teamA = teams.find((t) => t.id === match.team_a_id);
        const teamB = teams.find((t) => t.id === match.team_b_id);
        const isCompleted = match.status === 'completed';
        const teamAWon = match.winner_id === match.team_a_id;
        const teamBWon = match.winner_id === match.team_b_id;
        const canClick = canEdit && typeof onEditMatch === 'function';

        return (
          <motion.div
            key={match.id}
            layout
            whileHover={{ scale: 1.01 }}
            className={`
              border rounded-xl p-0 overflow-hidden bg-content1
              ${isCompleted ? 'border-default-200' : match.status === 'live' ? 'border-primary shadow-md' : 'border-default-100'}
              ${canClick ? 'cursor-pointer hover:border-primary/50' : ''}
            `}
            onClick={canClick ? () => onEditMatch?.(match) : undefined}
          >
            <div className="flex flex-col divide-y divide-default-100">
              <div className={`flex justify-between p-3 ${teamAWon ? 'bg-success/5 font-bold' : ''}`}>
               <span className="text-sm truncate">{teamA?.name || 'TBD'}</span>
               <span className="font-mono text-sm">{match.team_a_score ?? '-'}</span>
              </div>
              <div className={`flex justify-between p-3 ${teamBWon ? 'bg-success/5 font-bold' : ''}`}>
               <span className="text-sm truncate">{teamB?.name || 'TBD'}</span>
               <span className="font-mono text-sm">{match.team_b_score ?? '-'}</span>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
