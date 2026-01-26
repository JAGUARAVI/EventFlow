import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  CardBody,
  Chip,
  Divider,
  Spinner,
} from '@heroui/react';
import {
  Clock,
  MapPin,
  Calendar,
  Play,
  Pause,
  CheckCircle2,
  XCircle,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useRealtimeEvals } from '../hooks/useRealtimeEvals';

/**
 * Status configurations for display
 */
const SLOT_STATUS_CONFIG = {
  scheduled: { color: 'default', icon: Calendar, label: 'Scheduled' },
  live: { color: 'success', icon: Play, label: 'Live Now' },
  completed: { color: 'primary', icon: CheckCircle2, label: 'Completed' },
  rescheduled: { color: 'warning', icon: RefreshCw, label: 'Rescheduled' },
  no_show: { color: 'danger', icon: XCircle, label: 'Did Not Show' },
  cancelled: { color: 'default', icon: XCircle, label: 'Cancelled' },
};

const PANEL_STATUS_CONFIG = {
  active: { color: 'success', label: 'Active' },
  paused: { color: 'warning', label: 'Paused', icon: Pause },
  delayed: { color: 'danger', label: 'Delayed', icon: AlertTriangle },
  completed: { color: 'primary', label: 'Completed' },
};

/**
 * EvalPublicView: Public view of evaluation schedules for participants
 * Shows only the team's own slots with panel information
 */
export default function EvalPublicView({ eventId, teamIds = [] }) {
  const [panels, setPanels] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);

  const teamIdSet = useMemo(() => new Set(teamIds), [teamIds]);

  /**
   * Fetch panels and slots
   */
  const fetchData = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const [panelsRes, slotsRes] = await Promise.all([
        supabase
          .from('eval_panels')
          .select('*')
          .eq('event_id', eventId)
          .order('created_at'),
        supabase
          .from('eval_slots')
          .select('*, eval_panels!inner(event_id)')
          .eq('eval_panels.event_id', eventId)
          .order('scheduled_at'),
      ]);

      if (panelsRes.error) throw panelsRes.error;
      if (slotsRes.error) throw slotsRes.error;

      setPanels(panelsRes.data || []);
      setSlots(slotsRes.data || []);
    } catch (err) {
      console.error('Failed to fetch evals data:', err);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime updates
  useRealtimeEvals(eventId, setPanels, setSlots);

  // Filter slots for user's teams
  const mySlots = useMemo(() => {
    if (teamIdSet.size === 0) return [];
    return slots.filter((s) => teamIdSet.has(s.team_id));
  }, [slots, teamIdSet]);

  // Group slots by panel
  const slotsByPanel = useMemo(() => {
    const grouped = {};
    mySlots.forEach((slot) => {
      if (!grouped[slot.panel_id]) {
        grouped[slot.panel_id] = [];
      }
      grouped[slot.panel_id].push(slot);
    });
    return grouped;
  }, [mySlots]);

  /**
   * Get effective status considering panel state
   */
  const getEffectiveStatus = (slot, panel) => {
    if (slot.status === 'live') return 'live';
    if (slot.status === 'completed') return 'completed';
    if (slot.status === 'no_show') return 'no_show';
    if (slot.status === 'cancelled') return 'cancelled';
    if (slot.status === 'rescheduled') return 'rescheduled';
    if (panel?.status === 'paused') return 'paused';
    if (panel?.status === 'delayed') return 'delayed';
    return 'scheduled';
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (mySlots.length === 0) {
    return (
      <Card>
        <CardBody className="text-center py-12">
          <Calendar className="mx-auto mb-4 text-default-400" size={48} />
          <p className="text-default-500">
            {teamIdSet.size === 0
              ? 'Sign in and register a team to see your evaluation schedule.'
              : 'No evaluations scheduled for your team yet.'}
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Your Evaluation Schedule</h2>
        <p className="text-default-500 text-sm">
          View your scheduled evaluation slots
        </p>
      </div>

      {Object.entries(slotsByPanel).map(([panelId, panelSlots]) => {
        const panel = panels.find((p) => p.id === panelId);
        if (!panel) return null;

        const panelStatusCfg = PANEL_STATUS_CONFIG[panel.status] || PANEL_STATUS_CONFIG.active;

        return (
          <Card key={panelId} className="border border-default-200">
            <CardBody className="space-y-4">
              {/* Panel Header */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <h3 className="font-bold text-lg">{panel.name}</h3>
                  <Chip size="sm" color={panelStatusCfg.color} variant="flat">
                    {panelStatusCfg.label}
                    {panel.status === 'delayed' && panel.delay_minutes > 0 && (
                      <span className="ml-1">(+{panel.delay_minutes} min)</span>
                    )}
                  </Chip>
                </div>
                {panel.location && (
                  <div className="flex items-center gap-1 text-default-500 text-sm">
                    <MapPin size={14} />
                    {panel.location}
                  </div>
                )}
              </div>

              {/* Panel Status Banner */}
              {panel.status === 'paused' && (
                <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg flex items-center gap-2 text-warning">
                  <Pause size={16} />
                  <span className="text-sm font-medium">
                    This panel is currently on break. Evaluations will resume shortly.
                  </span>
                </div>
              )}
              {panel.status === 'delayed' && (
                <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg flex items-center gap-2 text-danger">
                  <AlertTriangle size={16} />
                  <span className="text-sm font-medium">
                    This panel is running {panel.delay_minutes} minutes behind schedule.
                    {panel.delay_reason && ` Reason: ${panel.delay_reason}`}
                  </span>
                </div>
              )}

              <Divider />

              {/* Slots */}
              <div className="space-y-3">
                {panelSlots
                  .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))
                  .map((slot) => {
                    const effectiveStatus = getEffectiveStatus(slot, panel);
                    const statusCfg =
                      effectiveStatus === 'paused'
                        ? { color: 'warning', icon: Pause, label: 'On Break' }
                        : effectiveStatus === 'delayed'
                          ? { color: 'danger', icon: Clock, label: `~${panel.delay_minutes}m delay` }
                          : SLOT_STATUS_CONFIG[slot.status] || SLOT_STATUS_CONFIG.scheduled;
                    const StatusIcon = statusCfg.icon;

                    const scheduledTime = new Date(slot.scheduled_at);
                    const adjustedTime =
                      panel.status === 'delayed' && slot.status === 'scheduled'
                        ? new Date(scheduledTime.getTime() + (panel.delay_minutes || 0) * 60000)
                        : scheduledTime;

                    return (
                      <div
                        key={slot.id}
                        className={`p-4 rounded-lg border ${
                          slot.status === 'live'
                            ? 'border-success bg-success/10'
                            : 'border-default-200 bg-default-50'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-4">
                            <div className="text-center">
                              <p className="text-2xl font-bold">
                                {adjustedTime.toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                              <p className="text-xs text-default-500">
                                {adjustedTime.toLocaleDateString([], {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </p>
                              {panel.status === 'delayed' && slot.status === 'scheduled' && (
                                <p className="text-xs text-danger mt-1">
                                  (was {scheduledTime.toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })})
                                </p>
                              )}
                            </div>
                            <div>
                              <p className="text-sm text-default-500">
                                Duration: {slot.duration_minutes} minutes
                              </p>
                              {slot.reschedule_reason && (
                                <p className="text-xs text-warning mt-1">
                                  Rescheduled: {slot.reschedule_reason}
                                </p>
                              )}
                            </div>
                          </div>
                          <Chip
                            size="md"
                            color={statusCfg.color}
                            variant={slot.status === 'live' ? 'solid' : 'flat'}
                            startContent={<StatusIcon size={14} />}
                          >
                            {statusCfg.label}
                          </Chip>
                        </div>

                        {slot.notes && (
                          <div className="mt-3 p-2 bg-default-100 rounded text-sm text-default-600">
                            {slot.notes}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
