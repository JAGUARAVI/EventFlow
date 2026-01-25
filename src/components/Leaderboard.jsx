import { Input, Button, Chip } from '@heroui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useRef, useEffect, useMemo } from 'react';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

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
  const prevRanks = useRef({});
  const [movements, setMovements] = useState({});

  const rows = useMemo(() => sortedWithRank(teams), [teams]);

  useEffect(() => {
    const newMovements = {};
    rows.forEach((t) => {
      const prev = prevRanks.current[t.id];
      if (prev !== undefined && prev !== t.rank) {
        newMovements[t.id] = prev > t.rank ? 'up' : 'down';
      }
      prevRanks.current[t.id] = t.rank;
    });
    
    if (Object.keys(newMovements).length > 0) {
        setMovements(prev => ({...prev, ...newMovements}));
        // Clear movements after animation
        const timer = setTimeout(() => {
            setMovements({});
        }, 3000);
        return () => clearTimeout(timer);
    }
  }, [rows]);

  const handleAdd = (team) => {
    const d = Number(delta[team.id]) || 0;
    if (d === 0) return;
    onScoreChange(team.id, d);
    setDelta((prev) => ({ ...prev, [team.id]: '' }));
  };

  const textSize = bigScreen ? 'text-3xl md:text-5xl' : 'text-base';
  const rowClass = bigScreen
    ? 'flex items-center gap-6 md:gap-12 py-6 px-8 rounded-xl bg-content1/50 border border-content2 shadow-sm'
    : 'flex items-center gap-4 py-3 border-b border-default-100 hover:bg-default-50 transition-colors px-2';

  return (
    <div aria-label="Leaderboard" className={bigScreen ? 'space-y-4 max-w-5xl mx-auto' : 'space-y-1'}>
      <AnimatePresence>
      {rows.map((t) => {
         const move = movements[t.id];
         return (
        <motion.div
          key={t.id}
          layout
          initial={false}
          animate={{ scale: 1, backgroundColor: move === 'up' ? 'var(--heroui-success-50)' : move === 'down' ? 'var(--heroui-danger-50)' : '' }}
          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
          className={rowClass}
        >
          <div className={`flex items-center justify-center w-12 md:w-20 font-bold ${textSize} ${bigScreen ? 'text-default-400' : ''}`}>
             {t.rank}
          </div>
          
          <div className="flex flex-col items-center justify-center w-8">
             {move === 'up' && <ArrowUp className="text-success animate-bounce" size={bigScreen ? 32 : 16} />}
             {move === 'down' && <ArrowDown className="text-danger animate-bounce" size={bigScreen ? 32 : 16} />}
             {!move && bigScreen && <Minus className="text-default-200" size={24} />}
          </div>

          <div className="flex-1 min-w-0">
             <span className={`font-bold truncate block ${textSize}`}>{t.name}</span>
             {bigScreen && t.description && <p className="text-default-500 text-lg truncate">{t.description}</p>}
          </div>

          <div className={`w-24 md:w-40 text-right font-mono font-bold ${textSize} ${move === 'up' ? 'text-success' : move === 'down' ? 'text-danger' : 'text-primary'}`}>
            {(Number(t.score) || 0).toLocaleString()}
          </div>
          
          {canJudge && !bigScreen && (
            <div className="flex gap-2 items-center ml-4">
              <Input
                type="number"
                size="sm"
                variant="bordered"
                classNames={{ input: 'w-16 text-right', base: 'w-24' }}
                placeholder="0"
                value={delta[t.id] ?? ''}
                onValueChange={(v) => setDelta((p) => ({ ...p, [t.id]: v }))}
              />
              <Button size="sm" isIconOnly color="primary" variant="flat" onPress={() => handleAdd(t)}>
                +
              </Button>
            </div>
          )}
        </motion.div>
      )})}
      </AnimatePresence>
    </div>
  );
}
