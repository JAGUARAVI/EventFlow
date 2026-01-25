import { useMemo } from "react";
import { motion } from "framer-motion";
import { EyeOff } from "lucide-react";

const COLORS = [
  "#006FEE", // primary
  "#17C964", // success
  "#F5A524", // warning
  "#F31260", // danger
  "#9353D3", // secondary
  "#06B6D4", // cyan
];

export default function PollResults({
  options,
  votes,
  isLive,
  pollType = "simple",
  resultsHidden = false,
  canManage = false,
}) {
  // Compute results based on poll type
  const { resultsMap, maxVal, totalMetric } = useMemo(() => {
    const map = {}; // optionId -> value (count or score)
    let max = 0;

    if (pollType === "ranked") {
      // Borda Count: (N - rank + 1) points per vote
      // N = options.length
      const N = options.length;
      votes.forEach((v) => {
        const points = Math.max(0, N - (v.rank || 1) + 1);
        map[v.option_id] = (map[v.option_id] || 0) + points;
      });
    } else if (pollType === "vote_to_points") {
      // Average Rating (0-10)
      // Accumulate sum and count
      const sums = {}; // optionId -> total points
      const counts = {}; // optionId -> num voters (wait, vote rows)

      votes.forEach((v) => {
        sums[v.option_id] = (sums[v.option_id] || 0) + (v.value || 0);
        counts[v.option_id] = (counts[v.option_id] || 0) + 1;
      });

      // Calculate average
      options.forEach((opt) => {
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

    if (pollType !== "vote_to_points") {
      max = Math.max(...options.map((o) => map[o.id] || 0), 1);
    }

    // Total measure
    const total = pollType === "simple" ? votes.length : null; // For others, total votes might be complex

    return { resultsMap: map, maxVal: max, totalMetric: total };
  }, [votes, options, pollType]);

  const pieSlices = useMemo(() => {
    if (pollType === "vote_to_points") return [];

    const total = options.reduce(
      (sum, opt) => sum + (resultsMap[opt.id] || 0),
      0,
    );
    if (total === 0) return [];

    let currentAngle = 0;
    return options.map((opt, i) => {
      const value = resultsMap[opt.id] || 0;
      const percent = value / total;
      const angle = percent * 360;

      const slice = {
        id: opt.id,
        label: opt.label,
        value,
        percent,
        startAngle: currentAngle,
        endAngle: currentAngle + angle,
        color: COLORS[i % COLORS.length],
      };
      currentAngle += angle;
      return slice;
    });
  }, [options, resultsMap, pollType]);

  const createArc = (start, end) => {
    const r = 50;
    const cx = 50;
    const cy = 50;

    if (Math.abs(end - start) >= 360) {
      return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r}`;
    }

    const startRad = ((start - 90) * Math.PI) / 180;
    const endRad = ((end - 90) * Math.PI) / 180;

    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);

    const largeArc = end - start > 180 ? 1 : 0;

    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
  };

  if (resultsHidden && !canManage) {
    return (
      <div className="p-4 border border-dashed rounded-lg flex flex-col items-center justify-center text-default-500 gap-2">
        <EyeOff size={24} />
        <p className="text-sm">Results hidden by host</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isLive && <p className="text-xs text-default-500">Live results</p>}

      <div className="flex flex-col sm:flex-row gap-8 items-center">
        {pieSlices.length > 0 && (
          <div className="relative w-32 h-32 shrink-0">
            <svg
              viewBox="0 0 100 100"
              className="w-full h-full transform transition-transform hover:scale-105"
            >
              {pieSlices.map((slice) => (
                <path
                  key={slice.id}
                  d={createArc(slice.startAngle, slice.endAngle)}
                  fill={slice.color}
                  stroke="transparent"
                />
              ))}
            </svg>
          </div>
        )}

        <div className="flex-1 w-full space-y-3">
          {options.map((opt, i) => {
            const val = Number(resultsMap[opt.id] || 0);
            const percent = maxVal > 0 ? (val / maxVal) * 100 : 0;

            let displayVal = val;
            if (pollType === "simple") {
              displayVal = `${val} votes`;
            } else if (pollType === "ranked") {
              displayVal = `${val} score`;
            } else if (pollType === "vote_to_points") {
              displayVal = `${val} / 10 avg`;
            }

            const color = COLORS[i % COLORS.length];

            return (
              <motion.div key={opt.id} className="space-y-1">
                <div className="flex justify-between text-sm items-center">
                  <div className="flex items-center gap-2">
                    {pollType !== "vote_to_points" && (
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                    )}
                    <span>{opt.label}</span>
                  </div>
                  <span className="font-mono text-default-500">
                    {displayVal}
                  </span>
                </div>
                <motion.div
                  className="h-2 bg-default-200 rounded-full overflow-hidden"
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                >
                  <motion.div
                    className="h-full"
                    style={{
                      backgroundColor:
                        pollType !== "vote_to_points"
                          ? color
                          : "var(--heroui-primary, #006FEE)",
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${percent}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </motion.div>
              </motion.div>
            );
          })}
        </div>
      </div>
      {totalMetric !== null && (
        <p className="text-xs text-default-400">Total votes: {totalMetric}</p>
      )}
    </div>
  );
}
