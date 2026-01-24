import { useMemo } from 'react';
import { motion } from 'framer-motion';

export default function PollResults({ options, votes, isLive, pollType = 'simple' }) {
  // Compute results based on poll type
  const { resultsMap, maxVal, totalMetric } = useMemo(() => {
    const map = {}; // optionId -> value (count or score)
    let max = 0;
    
    if (pollType === 'ranked') {
      // Borda Count: (N - rank + 1) points per vote
      // N = options.length
      const N = options.length;
      votes.forEach(v => {
        const points = Math.max(0, N - (v.rank || 1) + 1);
        map[v.option_id] = (map[v.option_id] || 0) + points;
      });
    } else if (pollType === 'vote_to_points') {
      // Average Rating (0-10)
      // Accumulate sum and count
      const sums = {}; // optionId -> total points
      const counts = {}; // optionId -> num voters (wait, vote rows)
      
      votes.forEach(v => {
        sums[v.option_id] = (sums[v.option_id] || 0) + (v.value || 0);
        counts[v.option_id] = (counts[v.option_id] || 0) + 1;
      });
      
      // Calculate average
      options.forEach(opt => {
        const count = counts[opt.id] || 0;
        map[opt.id] = count > 0 ? (sums[opt.id] / count).toFixed(1) : 0;
      });
      
      // For maxVal, find max (it will be <= 10)
      max = 10; 
    } else {
      // Simple: Vote Count
      votes.forEach((v) => {
        map[v.option_id] = (map[v.option_id] || 0) + 1;
      });
    }

    if (pollType !== 'vote_to_points') {
        max = Math.max(...options.map((o) => map[o.id] || 0), 1);
    }
    
    // Total measure
    const total = pollType === 'simple' ? votes.length : null; // For others, total votes might be complex
    
    return { resultsMap: map, maxVal: max, totalMetric: total };
  }, [votes, options, pollType]);

  return (
    <div className="space-y-3">
      {isLive && <p className="text-xs text-default-500">Live results</p>}
      {options.map((opt) => {
        const val = Number(resultsMap[opt.id] || 0);
        const percent = maxVal > 0 ? (val / maxVal) * 100 : 0;
        
        let displayVal = val;
        // Format display
        if (pollType === 'simple') {
            displayVal = `${val} votes`;
        } else if (pollType === 'ranked') {
            displayVal = `${val} score`;
        } else if (pollType === 'vote_to_points') {
            displayVal = `${val} / 10 avg`;
        }

        return (
          <motion.div key={opt.id} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>{opt.label}</span>
              <span className="font-mono text-default-500">{displayVal}</span>
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
      {totalMetric !== null && (
          <p className="text-xs text-default-400">Total votes: {totalMetric}</p>
      )}
    </div>
  );
}
