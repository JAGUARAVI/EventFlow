import { Input, Button } from '@heroui/react';
import { motion } from 'framer-motion';
import { useState } from 'react';

function sortedWithRank(teams) {
  const arr = [...(teams || [])].map((t) => ({ ...t, _score: Number(t.score) || 0 }));
  arr.sort((a, b) => {
    if (b._score !== a._score) return b._score - a._score;
    return (a.created_at || '').localeCompare(b.created_at || '');
  });
  return arr.map((t, i) => ({ ...t, rank: i + 1 }));
}

export default function Leaderboard({ teams = [], canJudge, onScoreChange, bigScreen = false }) {
  const [delta, setDelta] = useState({});
  const rows = sortedWithRank(teams);

  const handleAdd = (team) => {
    const d = Number(delta[team.id]) || 0;
    if (d === 0) return;
    onScoreChange(team.id, d);
    setDelta((prev) => ({ ...prev, [team.id]: '' }));
  };

  const textSize = bigScreen ? 'text-2xl md:text-4xl' : 'text-base';
  const rowClass = bigScreen
    ? 'flex items-center gap-6 md:gap-12 py-4 md:py-6 px-4 rounded-lg bg-default-100/50'
    : 'flex items-center gap-4 py-2 border-b border-default-200';

  return (
    <div aria-label="Leaderboard" className={bigScreen ? 'space-y-2' : ''}>
      {rows.map((t) => (
        <motion.div
          key={t.id}
          layout
          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
          className={rowClass}
        >
          <span className={`w-12 md:w-16 font-bold ${textSize}`}>{t.rank}</span>
          <span className={`flex-1 font-medium ${textSize}`}>{t.name}</span>
          <span className={`w-20 md:w-28 text-right font-mono ${textSize}`}>
            {(Number(t.score) || 0).toLocaleString()}
          </span>
          {canJudge && !bigScreen && (
            <div className="flex gap-1 items-center">
              <Input
                type="number"
                size="sm"
                classNames={{ input: 'w-16 text-right' }}
                placeholder="+"
                value={delta[t.id] ?? ''}
                onValueChange={(v) => setDelta((p) => ({ ...p, [t.id]: v }))}
              />
              <Button size="sm" color="primary" onPress={() => handleAdd(t)}>
                Add
              </Button>
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}
