import { useState, useEffect, useMemo } from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  Divider,
  Spinner,
} from '@heroui/react';
import { TrendingUp, Eye, MessageSquare, BarChart3 } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function EventAnalytics({ eventId, matches = [], polls = [], votes = [], scoreHistory = [] }) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  // Use useMemo to prevent infinite dependency changes
  const matchesLength = useMemo(() => matches?.length || 0, [matches?.length]);
  const pollsLength = useMemo(() => polls?.length || 0, [polls?.length]);
  const votesLength = useMemo(() => votes?.length || 0, [votes?.length]);
  const historyLength = useMemo(() => scoreHistory?.length || 0, [scoreHistory?.length]);

  useEffect(() => {
    computeMetrics();
  }, [eventId, matchesLength, pollsLength, votesLength, historyLength]);

  const computeMetrics = async () => {
    try {
      setLoading(true);

      // Compute engagement metrics
      const data = {
        totalMatches: matches?.length || 0,
        completedMatches: matches?.filter((m) => m.status === 'completed').length || 0,
        totalPolls: polls?.length || 0,
        totalVotes: votes?.length || 0,
        pollEngagementRate: 0,
        scoreActivityRate: 0,
        avgScoreChangePerRound: 0,
        mostActiveTeamId: null,
      };

      // Poll engagement rate
      if (data.totalPolls > 0 && data.totalVotes > 0) {
        data.pollEngagementRate = Math.round((data.totalVotes / (data.totalPolls * 10)) * 100);
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
        data.mostActiveTeamId = Object.entries(teamCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

        // Average score changes
        const totalChanges = scoreHistory.reduce((sum, s) => sum + Math.abs(s.delta), 0);
        data.avgScoreChangePerRound = (totalChanges / scoreHistory.length).toFixed(1);
      }

      setMetrics(data);
    } catch (err) {
      console.error('Failed to compute analytics:', err);
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

  if (!metrics) {
    return null;
  }

  const engagementColor =
    metrics.pollEngagementRate > 70
      ? 'success'
      : metrics.pollEngagementRate > 40
      ? 'warning'
      : 'default';

  const activityColor =
    metrics.scoreActivityRate > 70 ? 'success' : metrics.scoreActivityRate > 40 ? 'warning' : 'default';

  return (
    <Card className="w-full">
      <CardHeader className="flex gap-2 items-center">
        <BarChart3 size={20} />
        <div className="flex flex-col gap-1">
          <p className="text-lg font-semibold">Event Analytics</p>
          <p className="text-sm text-default-600">Engagement metrics and activity overview</p>
        </div>
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
                        {Math.round((metrics.completedMatches / metrics.totalMatches) * 100)}%
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
                    <p className="text-sm text-default-600">Poll Participation</p>
                    <p className="text-2xl font-semibold">{metrics.totalVotes}</p>
                    <p className="text-xs text-default-500">{metrics.totalPolls} polls</p>
                  </div>
                  <div className={`text-${engagementColor}`}>
                    <p className="text-sm font-semibold">{metrics.pollEngagementRate}%</p>
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
                    <p className="text-sm text-default-600">Competitive Intensity</p>
                    <p className="text-2xl font-semibold">
                      {metrics.scoreActivityRate}%
                    </p>
                    <p className="text-xs text-default-500">Teams with score changes</p>
                  </div>
                  <Eye size={20} className={`text-${activityColor}`} />
                </div>
              </CardBody>
            </Card>
          </div>
        </div>

        {/* Detailed Breakdown */}
        <div>
          <h4 className="font-semibold text-sm mb-3">Summary</h4>
          <div className="space-y-2 text-sm">
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
              <li>• High competitive intensity. Scores are changing rapidly.</li>
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
