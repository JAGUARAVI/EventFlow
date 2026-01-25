import { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Divider,
  Spinner,
  Button,
} from "@heroui/react";
import {
  TrendingUp,
  Eye,
  MessageSquare,
  BarChart3,
  Trophy,
  Hash,
  Sigma,
  Download,
  Activity,
} from "lucide-react";
import { supabase } from "../lib/supabase";

export default function EventAnalytics({
  eventId,
  matches = [],
  polls = [],
  votes = [],
  scoreHistory = [],
  teams = [],
}) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  // Use useMemo to prevent infinite dependency changes
  const matchesLength = useMemo(() => matches?.length || 0, [matches?.length]);
  const pollsLength = useMemo(() => polls?.length || 0, [polls?.length]);
  const votesLength = useMemo(() => votes?.length || 0, [votes?.length]);
  const historyLength = useMemo(
    () => scoreHistory?.length || 0,
    [scoreHistory?.length],
  );
  const teamsLength = useMemo(() => teams?.length || 0, [teams?.length]);

  useEffect(() => {
    computeMetrics();
  }, [
    eventId,
    matchesLength,
    pollsLength,
    votesLength,
    historyLength,
    teamsLength,
  ]);

  const computeMetrics = async () => {
    try {
      setLoading(true);

      // Compute engagement metrics
      const data = {
        totalMatches: matches?.length || 0,
        completedMatches:
          matches?.filter((m) => m.status === "completed").length || 0,
        totalPolls: polls?.length || 0,
        totalVotes: votes?.length || 0,
        pollEngagementRate: 0,
        scoreActivityRate: 0,
        avgScoreChangePerRound: 0,
        mostActiveTeamId: null,
        totalTeams: teams?.length || 0,
        topScorer: null,
        averageScore: 0,
        medianScore: 0,
        modeScore: "N/A",
        variance: 0,
        stdDev: 0,
        skewness: 0,
        kurtosis: 0,
        gini: 0,
        iqr: 0,
      };

      // Team Performance Metrics
      if (teams && teams.length > 0) {
        // Top Scorer
        const sortedTeams = [...teams].sort(
          (a, b) => (b.score || 0) - (a.score || 0),
        );
        if (sortedTeams.length > 0 && (sortedTeams[0].score || 0) > 0) {
          data.topScorer = {
            name: sortedTeams[0].name,
            score: sortedTeams[0].score || 0,
          };
        }

        // Statistical Calculations
        const scores = teams.map((t) => t.score || 0).sort((a, b) => a - b);
        const count = scores.length;

        // Mean (Average)
        const totalScore = scores.reduce((acc, s) => acc + s, 0);
        const mean = totalScore / count;
        data.averageScore = mean.toFixed(1);

        // Median
        let median = 0;
        if (count > 0) {
          if (count % 2 === 0) {
            median = (scores[count / 2 - 1] + scores[count / 2]) / 2;
          } else {
            median = scores[Math.floor(count / 2)];
          }
        }
        data.medianScore = median.toFixed(1);

        // Mode
        const frequency = {};
        let maxFreq = 0;
        scores.forEach((s) => {
          frequency[s] = (frequency[s] || 0) + 1;
          if (frequency[s] > maxFreq) maxFreq = frequency[s];
        });

        let modes = [];
        if (maxFreq > 1) {
          for (const s in frequency) {
            if (frequency[s] === maxFreq) modes.push(s);
          }
        }
        data.modeScore = modes.length > 0 ? modes.join(", ") : "None";

        // Variance & Standard Deviation
        const variance =
          scores.reduce((acc, s) => acc + Math.pow(s - mean, 2), 0) / count;
        data.variance = variance.toFixed(1);
        data.stdDev = Math.sqrt(variance).toFixed(1);

        // Scientific Metrics
        if (count > 1 && variance > 0) {
          // Skewness
          const m3 =
            scores.reduce((acc, s) => acc + Math.pow(s - mean, 3), 0) / count;
          data.skewness = (m3 / Math.pow(Math.sqrt(variance), 3)).toFixed(2);

          // Kurtosis (excess)
          const m4 =
            scores.reduce((acc, s) => acc + Math.pow(s - mean, 4), 0) / count;
          data.kurtosis = (m4 / Math.pow(variance, 2) - 3).toFixed(2);

          // IQR
          const q1 = scores[Math.floor(count * 0.25)];
          const q3 = scores[Math.floor(count * 0.75)];
          data.iqr = (q3 - q1).toFixed(1);

          // Gini Coefficient
          let sumAbsDiff = 0;
          for (let i = 0; i < count; i++) {
            for (let j = 0; j < count; j++) {
              sumAbsDiff += Math.abs(scores[i] - scores[j]);
            }
          }
          data.gini = (
            mean > 0 ? sumAbsDiff / (2 * count * count * mean) : 0
          ).toFixed(3);
        }
      }

      // Poll engagement rate
      if (data.totalPolls > 0 && data.totalVotes > 0) {
        data.pollEngagementRate = Math.round(
          (data.totalVotes / (data.totalPolls * 10)) * 100,
        );
      }

      // Score activity: how many teams have had score changes
      if (scoreHistory && scoreHistory.length > 0) {
        const uniqueTeams = new Set(scoreHistory.map((s) => s.team_id));
        data.scoreActivityRate = Math.round((uniqueTeams.size / 10) * 100);

        // Find team with most score updates
        const teamCounts = {};
        scoreHistory.forEach((s) => {
          teamCounts[s.team_id] = (teamCounts[s.team_id] || 0) + 1;
        });
        data.mostActiveTeamId = Object.entries(teamCounts).sort(
          (a, b) => b[1] - a[1],
        )[0]?.[0];

        // Average score changes
        const totalChanges = scoreHistory.reduce(
          (sum, s) => sum + Math.abs(s.delta),
          0,
        );
        data.avgScoreChangePerRound = (
          totalChanges / scoreHistory.length
        ).toFixed(1);
      }

      setMetrics(data);
    } catch (err) {
      console.error("Failed to compute analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-4">
        <Spinner />
      </div>
    );
  }

  const downloadCSV = () => {
    if (!metrics || !teams) return;

    let csv = "Metric,Value\n";
    csv += `Total Teams,${metrics.totalTeams}\n`;
    csv += `Total Matches,${metrics.totalMatches}\n`;
    csv += `Average Score,${metrics.averageScore}\n`;
    csv += `Median Score,${metrics.medianScore}\n`;
    csv += `Standard Deviation,${metrics.stdDev}\n`;
    csv += `Skewness,${metrics.skewness || 0}\n`;
    csv += `Kurtosis,${metrics.kurtosis || 0}\n`;
    csv += `Gini Coefficient,${metrics.gini || 0}\n`;
    csv += `IQR,${metrics.iqr || 0}\n`;

    csv += "\nTeam,Score,Rank\n";
    const sortedTeams = [...teams].sort(
      (a, b) => (b.score || 0) - (a.score || 0),
    );
    sortedTeams.forEach((t, i) => {
      csv += `"${t.name}",${t.score || 0},${i + 1}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `event_analytics_${eventId}.csv`;
    a.click();
  };

  if (!metrics) {
    return null;
  }

  const engagementColor =
    metrics.pollEngagementRate > 70
      ? "success"
      : metrics.pollEngagementRate > 40
        ? "warning"
        : "default";

  const activityColor =
    metrics.scoreActivityRate > 70
      ? "success"
      : metrics.scoreActivityRate > 40
        ? "warning"
        : "default";

  return (
    <Card className="w-full">
      <CardHeader className="flex justify-between items-center">
        <div className="flex gap-2 items-center">
          <BarChart3 size={20} />
          <div className="flex flex-col gap-1">
            <p className="text-lg font-semibold">Event Analytics</p>
            <p className="text-sm text-default-600">
              Engagement metrics and activity overview
            </p>
          </div>
        </div>
        <Button
          size="sm"
          color="primary"
          variant="flat"
          onPress={downloadCSV}
          startContent={<Download size={16} />}
        >
          Export CSV
        </Button>
      </CardHeader>

      <Divider />

      <CardBody className="gap-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Match Progress */}
          <div>
            <Card isBlurred>
              <CardBody className="gap-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-default-600">Match Progress</p>
                    <p className="text-2xl font-semibold">
                      {metrics.completedMatches} / {metrics.totalMatches}
                    </p>
                  </div>
                  <div className="text-success">
                    {metrics.totalMatches > 0 ? (
                      <p className="text-sm font-semibold">
                        {Math.round(
                          (metrics.completedMatches / metrics.totalMatches) *
                            100,
                        )}
                        %
                      </p>
                    ) : (
                      <p className="text-sm text-default-500">No matches</p>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Poll Participation */}
          <div>
            <Card isBlurred>
              <CardBody className="gap-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-default-600">
                      Poll Participation
                    </p>
                    <p className="text-2xl font-semibold">
                      {metrics.totalVotes}
                    </p>
                    <p className="text-xs text-default-500">
                      {metrics.totalPolls} polls
                    </p>
                  </div>
                  <div className={`text-${engagementColor}`}>
                    <p className="text-sm font-semibold">
                      {metrics.pollEngagementRate}%
                    </p>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Top Team */}
          <div>
            <Card isBlurred>
              <CardBody className="gap-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-default-600">Top Team</p>
                    <p
                      className="text-xl font-semibold truncate max-w-[150px]"
                      title={metrics.topScorer?.name}
                    >
                      {metrics.topScorer ? metrics.topScorer.name : "N/A"}
                    </p>
                    <p className="text-xs text-default-500">
                      Score: {metrics.topScorer ? metrics.topScorer.score : 0}
                    </p>
                  </div>
                  <div className="text-warning">
                    <Trophy size={20} />
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Average Score */}
          <div>
            <Card isBlurred>
              <CardBody className="gap-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-default-600">Avg Score</p>
                    <p className="text-2xl font-semibold">
                      {metrics.averageScore}
                    </p>
                    <p className="text-xs text-default-500">
                      Across {metrics.totalTeams} teams
                    </p>
                  </div>
                  <div className="text-secondary">
                    <Hash size={20} />
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Score Activity */}
          <div>
            <Card isBlurred>
              <CardBody className="gap-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-default-600">Score Updates</p>
                    <p className="text-2xl font-semibold">
                      {scoreHistory?.length || 0}
                    </p>
                    <p className="text-xs text-default-500">
                      Avg Δ: {metrics.avgScoreChangePerRound} points
                    </p>
                  </div>
                  <TrendingUp size={20} className="text-primary" />
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Competitive Intensity */}
          <div>
            <Card isBlurred>
              <CardBody className="gap-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-default-600">
                      Competitive Intensity
                    </p>
                    <p className="text-2xl font-semibold">
                      {metrics.scoreActivityRate}%
                    </p>
                    <p className="text-xs text-default-500">
                      Teams with score changes
                    </p>
                  </div>
                  <Eye size={20} className={`text-${activityColor}`} />
                </div>
              </CardBody>
            </Card>
          </div>
        </div>

        {/* Advanced Statistics */}
        <div>
          <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Sigma size={16} /> Score Statistics
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <Card className="bg-default-50 border-none shadow-none">
              <CardBody className="p-3 text-center">
                <p className="text-xs text-default-500 mb-1">Mean</p>
                <p className="text-lg font-semibold">{metrics.averageScore}</p>
              </CardBody>
            </Card>
            <Card className="bg-default-50 border-none shadow-none">
              <CardBody className="p-3 text-center">
                <p className="text-xs text-default-500 mb-1">Median</p>
                <p className="text-lg font-semibold">{metrics.medianScore}</p>
              </CardBody>
            </Card>
            <Card className="bg-default-50 border-none shadow-none">
              <CardBody className="p-3 text-center">
                <p className="text-xs text-default-500 mb-1">Std Dev</p>
                <p className="text-lg font-semibold">{metrics.stdDev}</p>
              </CardBody>
            </Card>
            <Card className="bg-default-50 border-none shadow-none">
              <CardBody className="p-3 text-center">
                <p className="text-xs text-default-500 mb-1">Mode</p>
                <p className="text-lg font-semibold">{metrics.modeScore}</p>
              </CardBody>
            </Card>
          </div>

          <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Activity size={16} /> Scientific Analysis
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <Card className="bg-default-50 border-none shadow-none">
              <CardBody className="p-3 text-center">
                <p className="text-xs text-default-500 mb-1">Skewness</p>
                <p className="text-lg font-semibold">{metrics.skewness || 0}</p>
                <p className="text-[10px] text-default-400">
                  Distribution asymmetry
                </p>
              </CardBody>
            </Card>
            <Card className="bg-default-50 border-none shadow-none">
              <CardBody className="p-3 text-center">
                <p className="text-xs text-default-500 mb-1">Kurtosis</p>
                <p className="text-lg font-semibold">{metrics.kurtosis || 0}</p>
                <p className="text-[10px] text-default-400">Tail heaviness</p>
              </CardBody>
            </Card>
            <Card className="bg-default-50 border-none shadow-none">
              <CardBody className="p-3 text-center">
                <p className="text-xs text-default-500 mb-1">Gini Coeff</p>
                <p className="text-lg font-semibold">{metrics.gini || 0}</p>
                <p className="text-[10px] text-default-400">Inequality index</p>
              </CardBody>
            </Card>
            <Card className="bg-default-50 border-none shadow-none">
              <CardBody className="p-3 text-center">
                <p className="text-xs text-default-500 mb-1">IQR</p>
                <p className="text-lg font-semibold">{metrics.iqr || 0}</p>
                <p className="text-[10px] text-default-400">Mid-spread</p>
              </CardBody>
            </Card>
          </div>
        </div>

        {/* Detailed Breakdown */}
        <div>
          <h4 className="font-semibold text-sm mb-3">Summary</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-default-600">Total Teams:</span>
              <span className="font-semibold">{metrics.totalTeams}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-default-600">Total Matches:</span>
              <span className="font-semibold">{metrics.totalMatches}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-default-600">Completed Matches:</span>
              <span className="font-semibold">{metrics.completedMatches}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-default-600">Total Polls:</span>
              <span className="font-semibold">{metrics.totalPolls}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-default-600">Total Votes Cast:</span>
              <span className="font-semibold">{metrics.totalVotes}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-default-600">Score Updates:</span>
              <span className="font-semibold">{scoreHistory?.length || 0}</span>
            </div>
          </div>
        </div>

        {/* Insights */}
        <div className="bg-info-50 border border-info rounded p-3">
          <p className="text-sm font-semibold text-info mb-1">Insights</p>
          <ul className="text-sm text-info space-y-1">
            {metrics.completedMatches === 0 && metrics.totalMatches > 0 && (
              <li>• No matches completed yet. Keep the event going!</li>
            )}
            {metrics.pollEngagementRate > 70 && (
              <li>• Great poll participation! Teams are highly engaged.</li>
            )}
            {metrics.scoreActivityRate > 70 && (
              <li>
                • High competitive intensity. Scores are changing rapidly.
              </li>
            )}
            {metrics.totalVotes === 0 && metrics.totalPolls > 0 && (
              <li>• No poll votes yet. Encourage teams to participate.</li>
            )}
          </ul>
        </div>
      </CardBody>
    </Card>
  );
}
