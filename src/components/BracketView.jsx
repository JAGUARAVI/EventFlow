import { Button } from '@heroui/react';
import { motion } from 'framer-motion';

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
      <div className="flex gap-8 p-4 min-w-max">
        {rounds.map((roundNum) => (
          <div key={roundNum} className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-default-500 text-center">
              {roundNum === 0 ? 'Final' : `Round ${rounds.length - roundNum}`}
            </h3>
            <div className="flex flex-col gap-3">
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
      className={`border border-default-200 rounded-lg p-3 min-w-[220px] bg-default-50 transition ${canClick ? 'cursor-pointer hover:bg-default-100' : ''}`}
      onClick={canClick ? onEdit : undefined}
    >
      {/* Team A */}
      <div
        className={`flex justify-between items-center py-1 px-2 rounded ${
          teamAWon ? 'bg-success-100 font-semibold' : ''
        }`}
      >
        <span className="text-sm">{teamA?.name || '(Pending)'}</span>
        <span className="text-xs font-mono">{match.team_a_score || 0}</span>
      </div>

      {/* VS */}
      <div className="text-center text-xs text-default-400 py-1">vs</div>

      {/* Team B */}
      <div
        className={`flex justify-between items-center py-1 px-2 rounded ${
          teamBWon ? 'bg-success-100 font-semibold' : ''
        }`}
      >
        <span className="text-sm">{teamB?.name || '(Pending)'}</span>
        <span className="text-xs font-mono">{match.team_b_score || 0}</span>
      </div>

      {/* Status */}
      <div className="text-xs text-default-400 text-center pt-2">
        {isCompleted ? '✓ Done' : match.status === 'live' ? '◉ Live' : 'Pending'}
      </div>

      {canEdit && (
        <div className="mt-2 pt-2 border-t border-default-200">
          <Button size="xs" variant="flat" fullWidth onClick={(e) => {
            e.stopPropagation();
            onEdit?.();
          }}>
            Edit
          </Button>
        </div>
      )}
    </motion.div>
  );
}

/**
 * BracketViewList: Displays round-robin or Swiss matches as a simple list.
 */
function BracketViewList({ matches, teams, canEdit, onEditMatch }) {
  return (
    <div className="space-y-2">
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
            className={`border border-default-200 rounded-lg p-3 bg-default-50 flex items-center justify-between transition ${canClick ? 'cursor-pointer hover:bg-default-100' : ''}`}
            onClick={canClick ? () => onEditMatch?.(match) : undefined}
          >
            <div className="flex-1">
              <div className={`text-sm ${teamAWon ? 'font-semibold text-success' : ''}`}>
                {teamA?.name} {match.team_a_score || 0}
              </div>
              <div className={`text-sm ${teamBWon ? 'font-semibold text-success' : ''}`}>
                {teamB?.name} {match.team_b_score || 0}
              </div>
            </div>
            <div className="text-xs text-default-400 ml-4">
              {isCompleted ? '✓' : match.status === 'live' ? '◉' : '-'}
            </div>
            {canEdit && (
              <Button size="xs" variant="light" onClick={(e) => {
                e.stopPropagation();
                onEditMatch?.(match);
              }}>
                Edit
              </Button>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
