import { useMemo } from 'react';
import { motion } from 'framer-motion';

export default function PollResults({ options, votes, isLive }) {
  const voteCountMap = useMemo(() => {
    const map = {};
    votes.forEach((v) => {
      map[v.option_id] = (map[v.option_id] || 0) + 1;
    });
    return map;
  }, [votes]);

  const maxVotes = Math.max(...options.map((o) => voteCountMap[o.id] || 0), 1);

  return (
    <div className="space-y-3">
      {isLive && <p className="text-xs text-default-500">Live results</p>}
      {options.map((opt) => {
        const count = voteCountMap[opt.id] || 0;
        const percent = maxVotes > 0 ? (count / maxVotes) * 100 : 0;
        return (
          <motion.div key={opt.id} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>{opt.label}</span>
              <span className="font-mono text-default-500">{count}</span>
            </div>
            <motion.div
              className="h-2 bg-default-200 rounded-full overflow-hidden"
              initial={{ width: 0 }}
              animate={{ width: '100%' }}
            >
              <motion.div
                className="h-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${percent}%` }}
                transition={{ duration: 0.5 }}
              />
            </motion.div>
          </motion.div>
        );
      })}
      <p className="text-xs text-default-400">Total votes: {votes.length}</p>
    </div>
  );
}
