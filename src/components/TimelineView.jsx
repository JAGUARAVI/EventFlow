import { useState, useEffect, useMemo } from 'react';
import { Card, CardBody, Tabs, Tab, Chip, Spinner, Progress } from '@heroui/react';
import { Clock, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function TimelineView({ eventId, rounds = [], matches = [], scoreHistory = [] }) {
  const [timelineData, setTimelineData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scoreChart, setScoreChart] = useState([]);

  // Use useMemo to prevent infinite dependency changes
  const roundsLength = useMemo(() => rounds?.length || 0, [rounds?.length]);
  const matchesLength = useMemo(() => matches?.length || 0, [matches?.length]);
  const historyLength = useMemo(() => scoreHistory?.length || 0, [scoreHistory?.length]);

  useEffect(() => {
    loadTimelineData();
  }, [eventId, roundsLength, matchesLength, historyLength]);

  const loadTimelineData = async () => {
    try {
      setLoading(true);

      // Combine rounds, matches, and score history into chronological timeline
      const events = [];

      // Add round events
      if (rounds && rounds.length > 0) {
        rounds.forEach((round) => {
          events.push({
            type: 'round',
            timestamp: round.start_date || new Date().toISOString(),
            data: round,
            label: `Round ${round.number}`,
            status: round.status,
          });
        });
      }

      // Add match completion events
      if (matches && matches.length > 0) {
        matches.forEach((match) => {
          if (match.status === 'completed' && match.updated_at) {
            events.push({
              type: 'match',
              timestamp: match.updated_at,
              data: match,
              label: `Match completed: Round ${match.round}`,
            });
          }
        });
      }

      // Add score history events
      if (scoreHistory && scoreHistory.length > 0) {
        scoreHistory.forEach((entry) => {
          events.push({
            type: 'score',
            timestamp: entry.created_at,
            data: entry,
            label: `Score update`,
          });
        });
      }

      // Sort by timestamp
      const sorted = events.sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
      );

      setTimelineData(sorted);

      // Build score chart data (team score over time)
      if (scoreHistory.length > 0) {
        const chartData = aggregateScoreHistory(scoreHistory);
        setScoreChart(chartData);
      }
    } catch (err) {
      console.error('Failed to load timeline data:', err);
    } finally {
      setLoading(false);
    }
  };

  const aggregateScoreHistory = (history) => {
    // Group by team, track score progression
    const teamProgress = {};

    history.forEach((entry) => {
      if (!teamProgress[entry.team_id]) {
        teamProgress[entry.team_id] = [];
      }
      teamProgress[entry.team_id].push({
        time: new Date(entry.created_at),
        score: entry.points_after,
      });
    });

    return teamProgress;
  };

  const getRoundProgress = () => {
    if (!rounds || rounds.length === 0) return 0;
    const completed = rounds.filter((r) => r.status === 'completed').length;
    return (completed / rounds.length) * 100;
  };

  const getMatchProgress = () => {
    if (!matches || matches.length === 0) return 0;
    const completed = matches.filter((m) => m.status === 'completed').length;
    return (completed / matches.length) * 100;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'default';
      case 'active':
      case 'live':
        return 'warning';
      case 'completed':
        return 'success';
      default:
        return 'default';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-4">
        <Spinner />
      </div>
    );
  }

  return (
    <Card className="w-full">
      <CardBody className="gap-6">
        <h3 className="text-lg font-semibold">Event Timeline</h3>

        <Tabs defaultSelectedKey="progress">
          <Tab key="progress" title="Progress">
            <div className="space-y-4 p-4">
              {rounds && rounds.length > 0 && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-semibold">Rounds Progress</h4>
                    <span className="text-sm text-default-600">
                      {rounds.filter((r) => r.status === 'completed').length} / {rounds.length}
                    </span>
                  </div>
                  <Progress value={getRoundProgress()} className="h-2" />
                </div>
              )}

              {matches && matches.length > 0 && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-semibold">Matches Progress</h4>
                    <span className="text-sm text-default-600">
                      {matches.filter((m) => m.status === 'completed').length} / {matches.length}
                    </span>
                  </div>
                  <Progress value={getMatchProgress()} className="h-2" />
                </div>
              )}

              {/* Round status breakdown */}
              {rounds && rounds.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Rounds</h4>
                  <div className="space-y-2">
                    {rounds.map((round) => (
                      <div key={round.id} className="flex items-center justify-between p-2 bg-default-100 rounded">
                        <span className="font-sm">Round {round.number}</span>
                        <div className="flex gap-2">
                          <Chip
                            size="sm"
                            color={getStatusColor(round.status)}
                            variant="flat"
                          >
                            {round.status}
                          </Chip>
                          <span className="text-xs text-default-600">
                            {round.start_date
                              ? new Date(round.start_date).toLocaleDateString()
                              : 'Not scheduled'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Tab>

          <Tab key="timeline" title="Events">
            <div className="p-4">
              {timelineData.length === 0 ? (
                <p className="text-default-600 text-center py-4">No timeline events yet</p>
              ) : (
                <div className="space-y-3">
                  {timelineData.map((event, idx) => (
                    <div key={idx} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-3 h-3 rounded-full ${
                          event.type === 'round'
                            ? 'bg-primary'
                            : event.type === 'match'
                            ? 'bg-success'
                            : 'bg-secondary'
                        }`} />
                        {idx < timelineData.length - 1 && (
                          <div className="w-0.5 h-12 bg-default-300" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold">{event.label}</p>
                            <p className="text-sm text-default-600">
                              {new Date(event.timestamp).toLocaleString()}
                            </p>
                          </div>
                          {event.status && (
                            <Chip size="sm" color={getStatusColor(event.status)} variant="flat">
                              {event.status}
                            </Chip>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Tab>

          <Tab key="scores" title="Score History">
            <div className="p-4">
              {Object.entries(scoreChart).length === 0 ? (
                <p className="text-default-600 text-center py-4">No score history yet</p>
              ) : (
                <div className="space-y-4">
                  {Object.entries(scoreChart).map(([teamId, progression]) => (
                    <div key={teamId} className="border-b pb-3">
                      <p className="text-sm font-semibold mb-2">{teamId}</p>
                      <div className="flex gap-1 flex-wrap">
                        {progression.map((point, idx) => (
                          <div key={idx} className="text-xs">
                            <span className="bg-default-200 px-2 py-1 rounded">
                              {point.score}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Tab>
        </Tabs>
      </CardBody>
    </Card>
  );
}
