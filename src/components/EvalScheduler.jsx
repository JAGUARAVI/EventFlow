import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Chip,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
  Avatar,
  AvatarGroup,
  Tooltip,
  useDisclosure,
  addToast,
  Divider,
  Tabs,
  Tab,
  Accordion,
  AccordionItem,
} from '@heroui/react';
import {
  Plus,
  MoreVertical,
  Clock,
  MapPin,
  Users,
  Play,
  Pause,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Edit3,
  Trash2,
  RefreshCw,
  UserPlus,
  Timer,
  XCircle,
  Eye,
  Search,
} from 'lucide-react';
import { supabase, withRetry } from '../lib/supabase';
import { useRealtimeEvals } from '../hooks/useRealtimeEvals';
import EvalPanelEditor from './EvalPanelEditor';
import EvalSlotEditor from './EvalSlotEditor';
import EvalRescheduleModal from './EvalRescheduleModal';
import ReactMarkdown from 'react-markdown';

/**
 * Status configurations for display
 */
const SLOT_STATUS_CONFIG = {
  scheduled: { color: 'default', icon: Calendar, label: 'Scheduled' },
  live: { color: 'success', icon: Play, label: 'Live' },
  completed: { color: 'primary', icon: CheckCircle2, label: 'Completed' },
  rescheduled: { color: 'warning', icon: RefreshCw, label: 'Rescheduled' },
  no_show: { color: 'danger', icon: XCircle, label: 'Did Not Show' },
  cancelled: { color: 'default', icon: XCircle, label: 'Cancelled' },
};

const PANEL_STATUS_CONFIG = {
  active: { color: 'success', label: 'Active' },
  paused: { color: 'warning', label: 'Paused' },
  delayed: { color: 'danger', label: 'Delayed' },
  completed: { color: 'primary', label: 'Completed' },
};

/**
 * EvalScheduler: Main component for managing evaluation panels and schedules
 */
export default function EvalScheduler({
  eventId,
  teams,
  canManage,
  canJudge,
  currentUserId,
}) {
  const [panels, setPanels] = useState([]);
  const [slots, setSlots] = useState([]);
  const [panelJudges, setPanelJudges] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedPanel, setSelectedPanel] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [rescheduleSlot, setRescheduleSlot] = useState(null);
  const [delayPanel, setDelayPanel] = useState(null);
  const [delayMinutes, setDelayMinutes] = useState('15');
  const [delayReason, setDelayReason] = useState('');
  const [judgePanel, setJudgePanel] = useState(null);
  const [judgeQuery, setJudgeQuery] = useState('');
  const [judgeSearchResults, setJudgeSearchResults] = useState([]);
  const [teamSearch, setTeamSearch] = useState('');

  // Modals
  const {
    isOpen: isPanelEditorOpen,
    onOpen: onPanelEditorOpen,
    onClose: onPanelEditorClose,
  } = useDisclosure();
  const {
    isOpen: isSlotEditorOpen,
    onOpen: onSlotEditorOpen,
    onClose: onSlotEditorClose,
  } = useDisclosure();
  const {
    isOpen: isRescheduleOpen,
    onOpen: onRescheduleOpen,
    onClose: onRescheduleClose,
  } = useDisclosure();
  const {
    isOpen: isDelayOpen,
    onOpen: onDelayOpen,
    onClose: onDelayClose,
  } = useDisclosure();
  const {
    isOpen: isJudgeOpen,
    onOpen: onJudgeOpen,
    onClose: onJudgeClose,
  } = useDisclosure();
  const {
    isOpen: isDescriptionOpen,
    onOpen: onDescriptionOpen,
    onClose: onDescriptionClose,
  } = useDisclosure();
  const [viewingPanel, setViewingPanel] = useState(null);

  /**
   * Fetch all panels and slots for the event
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

      // Fetch judges for each panel
      if (panelsRes.data && panelsRes.data.length > 0) {
        const judgesMap = {};
        for (const panel of panelsRes.data) {
          const { data: judges } = await supabase
            .from('eval_panel_judges')
            .select('user_id, can_manage, profiles(display_name, avatar_url, email)')
            .eq('panel_id', panel.id);
          judgesMap[panel.id] = judges || [];
        }
        setPanelJudges(judgesMap);
      }
    } catch (err) {
      console.error('Failed to fetch evals data:', err);
      addToast({
        title: 'Failed to load evaluations',
        description: err.message,
        severity: 'danger',
      });
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime updates
  useRealtimeEvals(eventId, setPanels, setSlots);

  /**
   * Get slots for a specific panel
   */
  const getSlotsForPanel = useCallback(
    (panelId) => {
      return slots.filter((s) => s.panel_id === panelId);
    },
    [slots]
  );

  /**
   * Get effective status for a slot (considering panel delay/pause)
   */
  const getEffectiveSlotStatus = useCallback(
    (slot, panel) => {
      if (slot.status === 'live') return 'live';
      if (slot.status === 'completed') return 'completed';
      if (slot.status === 'no_show') return 'no_show';
      if (slot.status === 'cancelled') return 'cancelled';
      if (slot.status === 'rescheduled') return 'rescheduled';
      // For scheduled slots, check panel status
      if (panel?.status === 'paused') return 'paused';
      if (panel?.status === 'delayed') return 'delayed';
      return 'scheduled';
    },
    []
  );

  /**
   * Panel actions
   */
  const openAddPanel = () => {
    setSelectedPanel(null);
    onPanelEditorOpen();
  };

  const openEditPanel = (panel) => {
    setSelectedPanel(panel);
    onPanelEditorOpen();
  };

  const handleDeletePanel = async (panel) => {
    if (!confirm(`Delete panel "${panel.name}"? This will remove all scheduled evaluations.`))
      return;
    const { error } = await supabase.from('eval_panels').delete().eq('id', panel.id);
    if (error) {
      addToast({ title: 'Delete failed', description: error.message, severity: 'danger' });
      return;
    }
    await supabase.from('event_audit').insert({
      event_id: eventId,
      action: 'eval_panel.delete',
      entity_type: 'eval_panel',
      entity_id: panel.id,
      message: `Deleted panel "${panel.name}"`,
      created_by: currentUserId,
    });
    addToast({ title: 'Panel deleted', severity: 'success' });
    fetchData();
  };

  /**
   * Panel status actions
   */
  const setPanelStatus = async (panel, status, delayMins = null, reason = null) => {
    const updateData = {
      status,
      delay_minutes: status === 'delayed' ? delayMins : 0,
      delay_reason: status === 'delayed' ? reason : null,
      paused_at: status === 'paused' ? new Date().toISOString() : null,
    };
    const { error } = await supabase
      .from('eval_panels')
      .update(updateData)
      .eq('id', panel.id);
    if (error) {
      addToast({ title: 'Status update failed', description: error.message, severity: 'danger' });
      return;
    }
    await supabase.from('event_audit').insert({
      event_id: eventId,
      action: `eval_panel.${status}`,
      entity_type: 'eval_panel',
      entity_id: panel.id,
      message: `Set panel "${panel.name}" to ${status}${delayMins ? ` (${delayMins} min)` : ''}`,
      created_by: currentUserId,
      metadata: { status, delay_minutes: delayMins, reason },
    });
    addToast({ title: `Panel ${status}`, severity: 'success' });
    fetchData();
  };

  const openDelayModal = (panel) => {
    setDelayPanel(panel);
    setDelayMinutes(String(panel.delay_minutes || 15));
    setDelayReason(panel.delay_reason || '');
    onDelayOpen();
  };

  const handleSetDelay = async () => {
    if (!delayPanel) return;
    const mins = parseInt(delayMinutes, 10) || 0;
    await setPanelStatus(delayPanel, 'delayed', mins, delayReason);
    onDelayClose();
    setDelayPanel(null);
  };

  /**
   * Slot actions
   */
  const openAddSlot = (panel) => {
    setSelectedPanel(panel);
    setSelectedSlot(null);
    onSlotEditorOpen();
  };

  const openEditSlot = (slot, panel) => {
    setSelectedPanel(panel);
    setSelectedSlot(slot);
    onSlotEditorOpen();
  };

  const openReschedule = (slot) => {
    setRescheduleSlot(slot);
    onRescheduleOpen();
  };

  const updateSlotStatus = async (slot, status) => {
    const team = teams.find((t) => t.id === slot.team_id);
    const updateData = { status };
    if (status === 'live') {
      updateData.actual_start = new Date().toISOString();
    }
    if (status === 'completed') {
      updateData.actual_end = new Date().toISOString();
    }
    const { error } = await supabase.from('eval_slots').update(updateData).eq('id', slot.id);
    if (error) {
      addToast({ title: 'Update failed', description: error.message, severity: 'danger' });
      return;
    }
    await supabase.from('event_audit').insert({
      event_id: eventId,
      action: `eval_slot.${status}`,
      entity_type: 'eval_slot',
      entity_id: slot.id,
      message: `Marked eval for "${team?.name || 'Unknown'}" as ${status}`,
      created_by: currentUserId,
    });
    addToast({ title: `Evaluation ${status}`, severity: 'success' });
    fetchData();
  };

  const handleDeleteSlot = async (slot) => {
    const team = teams.find((t) => t.id === slot.team_id);
    if (!confirm(`Remove evaluation slot for "${team?.name || 'Unknown'}"?`)) return;
    const { error } = await supabase.from('eval_slots').delete().eq('id', slot.id);
    if (error) {
      addToast({ title: 'Delete failed', description: error.message, severity: 'danger' });
      return;
    }
    await supabase.from('event_audit').insert({
      event_id: eventId,
      action: 'eval_slot.delete',
      entity_type: 'eval_slot',
      entity_id: slot.id,
      message: `Removed eval slot for "${team?.name || 'Unknown'}"`,
      created_by: currentUserId,
    });
    addToast({ title: 'Slot removed', severity: 'success' });
    fetchData();
  };

  /**
   * Judge management
   */
  const openJudgeModal = (panel) => {
    setJudgePanel(panel);
    setJudgeQuery('');
    setJudgeSearchResults([]);
    onJudgeOpen();
  };

  const searchJudges = async (query) => {
    if (!query.trim()) {
      setJudgeSearchResults([]);
      return;
    }
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, email, avatar_url')
      .or(`display_name.ilike.%${query}%,email.ilike.%${query}%`)
      .limit(10);
    // Filter out already assigned judges
    const existingIds = new Set((panelJudges[judgePanel?.id] || []).map((j) => j.user_id));
    setJudgeSearchResults((data || []).filter((u) => !existingIds.has(u.id)));
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (judgeQuery) searchJudges(judgeQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [judgeQuery]);

  const addJudgeToPanel = async (userId) => {
    if (!judgePanel) return;
    const { error } = await supabase.from('eval_panel_judges').insert({
      panel_id: judgePanel.id,
      user_id: userId,
      can_manage: false,
    });
    if (error) {
      addToast({ title: 'Failed to add judge', description: error.message, severity: 'danger' });
      return;
    }
    await supabase.from('event_audit').insert({
      event_id: eventId,
      action: 'eval_panel_judge.add',
      entity_type: 'eval_panel',
      entity_id: judgePanel.id,
      message: `Added judge to panel "${judgePanel.name}"`,
      created_by: currentUserId,
    });
    addToast({ title: 'Judge added', severity: 'success' });
    setJudgeQuery('');
    fetchData();
  };

  const removeJudgeFromPanel = async (panelId, userId) => {
    const { error } = await supabase
      .from('eval_panel_judges')
      .delete()
      .eq('panel_id', panelId)
      .eq('user_id', userId);
    if (error) {
      addToast({ title: 'Failed to remove judge', description: error.message, severity: 'danger' });
      return;
    }
    addToast({ title: 'Judge removed', severity: 'success' });
    fetchData();
  };

  const toggleJudgeCanManage = async (panelId, userId, currentValue) => {
    const { error } = await supabase
      .from('eval_panel_judges')
      .update({ can_manage: !currentValue })
      .eq('panel_id', panelId)
      .eq('user_id', userId);
    if (error) {
      addToast({ title: 'Update failed', description: error.message, severity: 'danger' });
      return;
    }
    addToast({ title: 'Permissions updated', severity: 'success' });
    fetchData();
  };

  /**
   * Check if current user can manage a specific panel
   */
  const canManagePanel = useCallback(
    (panel) => {
      if (canManage) return true;
      const judges = panelJudges[panel.id] || [];
      return judges.some((j) => j.user_id === currentUserId && j.can_manage);
    },
    [canManage, panelJudges, currentUserId]
  );

  /**
   * Check if current user can judge a specific panel
   */
  const canJudgePanel = useCallback(
    (panel) => {
      if (canJudge) return true;
      const judges = panelJudges[panel.id] || [];
      return judges.some((j) => j.user_id === currentUserId);
    },
    [canJudge, panelJudges, currentUserId]
  );

  const viewDescription = (panel) => {
    setViewingPanel(panel);
    onDescriptionOpen();
  };

  /**
   * Search results - teams matching search across all panels
   */
  const teamSearchResults = useMemo(() => {
    if (!teamSearch.trim()) return [];
    const query = teamSearch.toLowerCase();
    const results = [];
    
    for (const slot of slots) {
      const team = teams.find((t) => t.id === slot.team_id);
      if (!team) continue;
      
      if (team.name.toLowerCase().includes(query)) {
        const panel = panels.find((p) => p.id === slot.panel_id);
        results.push({
          slot,
          team,
          panel,
        });
      }
    }
    
    // Sort by scheduled time
    results.sort((a, b) => new Date(a.slot.scheduled_at) - new Date(b.slot.scheduled_at));
    return results;
  }, [teamSearch, slots, teams, panels]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold">Evaluations</h2>
          <p className="text-default-500 text-sm">
            Schedule and manage team evaluations across panels
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Input
            placeholder="Search team across panels..."
            value={teamSearch}
            onValueChange={setTeamSearch}
            startContent={<Search size={16} className="text-default-400" />}
            isClearable
            onClear={() => setTeamSearch('')}
            className="w-full sm:w-64"
            size="sm"
          />
          {canManage && (
            <Button color="primary" startContent={<Plus size={18} />} onPress={openAddPanel}>
              Add Panel
            </Button>
          )}
        </div>
      </div>

      {/* Team Search Results */}
      {teamSearch.trim() && (
        <Card className="border border-primary/20 bg-primary/5">
          <CardBody className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Search size={16} className="text-primary" />
              <span className="font-semibold">
                Search Results for "{teamSearch}"
              </span>
              <Chip size="sm" variant="flat">{teamSearchResults.length} found</Chip>
            </div>
            {teamSearchResults.length === 0 ? (
              <p className="text-default-500 text-sm">No teams found matching your search.</p>
            ) : (
              <div className="space-y-2">
                {teamSearchResults.map(({ slot, team, panel }) => {
                  const statusCfg = SLOT_STATUS_CONFIG[slot.status] || SLOT_STATUS_CONFIG.scheduled;
                  const StatusIcon = statusCfg.icon;
                  return (
                    <div
                      key={slot.id}
                      className="flex flex-wrap items-center justify-between gap-2 p-3 bg-background rounded-lg border border-default-200"
                    >
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="font-medium">{team.name}</p>
                          <p className="text-xs text-default-500 flex items-center gap-1">
                            <MapPin size={12} />
                            {panel?.name || 'Unknown Panel'}
                            {panel?.location && ` • ${panel.location}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-sm font-medium">
                            {new Date(slot.scheduled_at).toLocaleDateString()}
                          </p>
                          <p className="text-xs text-default-500">
                            {new Date(slot.scheduled_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                        <Chip size="sm" color={statusCfg.color} variant="flat" startContent={<StatusIcon size={12} />}>
                          {statusCfg.label}
                        </Chip>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Panels */}
      {panels.length === 0 ? (
        <Card>
          <CardBody className="text-center py-12">
            <Calendar className="mx-auto mb-4 text-default-400" size={48} />
            <p className="text-default-500">No evaluation panels yet.</p>
            {canManage && (
              <Button
                color="primary"
                variant="flat"
                className="mt-4"
                onPress={openAddPanel}
              >
                Create your first panel
              </Button>
            )}
          </CardBody>
        </Card>
      ) : (
        <Accordion variant="splitted" selectionMode="multiple">
          {panels.map((panel) => {
            const panelSlots = getSlotsForPanel(panel.id);
            const judges = panelJudges[panel.id] || [];
            const statusConfig = PANEL_STATUS_CONFIG[panel.status] || PANEL_STATUS_CONFIG.active;
            const isPanelManager = canManagePanel(panel);
            const isPanelJudge = canJudgePanel(panel);

            return (
              <AccordionItem
                key={panel.id}
                aria-label={panel.name}
                title={
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{panel.name}</span>
                    <Chip size="sm" color={statusConfig.color} variant="flat">
                      {statusConfig.label}
                      {panel.status === 'delayed' && panel.delay_minutes > 0 && (
                        <span className="ml-1">({panel.delay_minutes} min)</span>
                      )}
                    </Chip>
                    {panel.location && (
                      <span className="text-default-500 text-sm flex items-center gap-1">
                        <MapPin size={14} />
                        {panel.location}
                      </span>
                    )}
                    <span className="text-default-400 text-sm">
                      {panelSlots.length} evaluation{panelSlots.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                }
                startContent={
                  <AvatarGroup max={3} size="sm">
                    {judges.map((j) => (
                      <Tooltip key={j.user_id} content={j.profiles?.display_name || j.profiles?.email}>
                        <Avatar
                          src={j.profiles?.avatar_url}
                          name={j.profiles?.display_name || j.profiles?.email}
                          size="sm"
                        />
                      </Tooltip>
                    ))}
                  </AvatarGroup>
                }
              >
                <div className="space-y-4">
                  {/* Panel Actions */}
                  <div className="flex flex-wrap gap-2">
                    {panel.description && (
                      <Button
                        size="sm"
                        variant="flat"
                        startContent={<Eye size={16} />}
                        onPress={() => viewDescription(panel)}
                      >
                        View Description
                      </Button>
                    )}
                    {isPanelManager && (
                      <>
                        <Button
                          size="sm"
                          variant="flat"
                          startContent={<Edit3 size={16} />}
                          onPress={() => openEditPanel(panel)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="flat"
                          startContent={<UserPlus size={16} />}
                          onPress={() => openJudgeModal(panel)}
                        >
                          Judges
                        </Button>
                      </>
                    )}
                    {isPanelJudge && (
                      <>
                        <Button
                          size="sm"
                          variant="flat"
                          color="primary"
                          startContent={<Plus size={16} />}
                          onPress={() => openAddSlot(panel)}
                        >
                          Schedule
                        </Button>
                        <Dropdown>
                          <DropdownTrigger>
                            <Button size="sm" variant="flat" startContent={<Timer size={16} />}>
                              Status
                            </Button>
                          </DropdownTrigger>
                          <DropdownMenu>
                            <DropdownItem
                              key="active"
                              startContent={<Play size={16} />}
                              onPress={() => setPanelStatus(panel, 'active')}
                            >
                              Set Active
                            </DropdownItem>
                            <DropdownItem
                              key="paused"
                              startContent={<Pause size={16} />}
                              onPress={() => setPanelStatus(panel, 'paused')}
                            >
                              Pause Panel
                            </DropdownItem>
                            <DropdownItem
                              key="delayed"
                              startContent={<Clock size={16} />}
                              onPress={() => openDelayModal(panel)}
                            >
                              Set Delay
                            </DropdownItem>
                            <DropdownItem
                              key="completed"
                              startContent={<CheckCircle2 size={16} />}
                              onPress={() => setPanelStatus(panel, 'completed')}
                            >
                              Mark Completed
                            </DropdownItem>
                          </DropdownMenu>
                        </Dropdown>
                      </>
                    )}
                    {canManage && (
                      <Button
                        size="sm"
                        variant="flat"
                        color="danger"
                        startContent={<Trash2 size={16} />}
                        onPress={() => handleDeletePanel(panel)}
                      >
                        Delete
                      </Button>
                    )}
                  </div>

                  {/* Slots Table */}
                  {panelSlots.length === 0 ? (
                    <div className="text-center py-8 text-default-500">
                      <Clock className="mx-auto mb-2" size={32} />
                      <p>No evaluations scheduled yet.</p>
                    </div>
                  ) : (
                    <Table aria-label="Evaluation slots" removeWrapper>
                      <TableHeader>
                        <TableColumn>TEAM</TableColumn>
                        <TableColumn>TIME</TableColumn>
                        <TableColumn>DURATION</TableColumn>
                        <TableColumn>STATUS</TableColumn>
                        <TableColumn>ACTIONS</TableColumn>
                      </TableHeader>
                      <TableBody>
                        {panelSlots
                          .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))
                          .map((slot) => {
                            const team = teams.find((t) => t.id === slot.team_id);
                            const effectiveStatus = getEffectiveSlotStatus(slot, panel);
                            const statusCfg =
                              effectiveStatus === 'paused'
                                ? { color: 'warning', icon: Pause, label: 'Paused' }
                                : effectiveStatus === 'delayed'
                                  ? { color: 'danger', icon: Clock, label: `Delayed ${panel.delay_minutes}m` }
                                  : SLOT_STATUS_CONFIG[slot.status] || SLOT_STATUS_CONFIG.scheduled;
                            const StatusIcon = statusCfg.icon;

                            return (
                              <TableRow key={slot.id}>
                                <TableCell>
                                  <div className="flex flex-col">
                                    <span className="font-medium">{team?.name || 'Unknown Team'}</span>
                                    {slot.reschedule_reason && (
                                      <span className="text-xs text-warning">
                                        Rescheduled: {slot.reschedule_reason}
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-col">
                                    <span>{new Date(slot.scheduled_at).toLocaleDateString()}</span>
                                    <span className="text-default-500 text-sm">
                                      {new Date(slot.scheduled_at).toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell>{slot.duration_minutes} min</TableCell>
                                <TableCell>
                                  <Chip
                                    size="sm"
                                    color={statusCfg.color}
                                    variant="flat"
                                    startContent={<StatusIcon size={14} />}
                                  >
                                    {statusCfg.label}
                                  </Chip>
                                </TableCell>
                                <TableCell>
                                  {isPanelJudge && (
                                    <Dropdown>
                                      <DropdownTrigger>
                                        <Button size="sm" variant="light" isIconOnly>
                                          <MoreVertical size={16} />
                                        </Button>
                                      </DropdownTrigger>
                                      <DropdownMenu>
                                        {slot.status === 'scheduled' && (
                                          <DropdownItem
                                            key="start"
                                            startContent={<Play size={16} />}
                                            onPress={() => updateSlotStatus(slot, 'live')}
                                          >
                                            Start Eval
                                          </DropdownItem>
                                        )}
                                        {slot.status === 'live' && (
                                          <DropdownItem
                                            key="complete"
                                            startContent={<CheckCircle2 size={16} />}
                                            onPress={() => updateSlotStatus(slot, 'completed')}
                                          >
                                            Mark Complete
                                          </DropdownItem>
                                        )}
                                        {['scheduled', 'rescheduled'].includes(slot.status) && (
                                          <>
                                            <DropdownItem
                                              key="reschedule"
                                              startContent={<RefreshCw size={16} />}
                                              onPress={() => openReschedule(slot)}
                                            >
                                              Reschedule
                                            </DropdownItem>
                                            <DropdownItem
                                              key="noshow"
                                              startContent={<XCircle size={16} />}
                                              color="danger"
                                              onPress={() => updateSlotStatus(slot, 'no_show')}
                                            >
                                              No Show
                                            </DropdownItem>
                                          </>
                                        )}
                                        <DropdownItem
                                          key="edit"
                                          startContent={<Edit3 size={16} />}
                                          onPress={() => openEditSlot(slot, panel)}
                                        >
                                          Edit
                                        </DropdownItem>
                                        {isPanelManager && (
                                          <DropdownItem
                                            key="delete"
                                            startContent={<Trash2 size={16} />}
                                            color="danger"
                                            onPress={() => handleDeleteSlot(slot)}
                                          >
                                            Delete
                                          </DropdownItem>
                                        )}
                                      </DropdownMenu>
                                    </Dropdown>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      {/* Panel Editor Modal */}
      <EvalPanelEditor
        isOpen={isPanelEditorOpen}
        onClose={onPanelEditorClose}
        panel={selectedPanel}
        eventId={eventId}
        onUpdate={fetchData}
        currentUserId={currentUserId}
      />

      {/* Slot Editor Modal */}
      <EvalSlotEditor
        isOpen={isSlotEditorOpen}
        onClose={onSlotEditorClose}
        slot={selectedSlot}
        panelId={selectedPanel?.id}
        eventId={eventId}
        teams={teams}
        existingSlots={selectedPanel ? getSlotsForPanel(selectedPanel.id) : []}
        onUpdate={fetchData}
        currentUserId={currentUserId}
      />

      {/* Reschedule Modal */}
      <EvalRescheduleModal
        isOpen={isRescheduleOpen}
        onClose={onRescheduleClose}
        slot={rescheduleSlot}
        team={teams.find((t) => t.id === rescheduleSlot?.team_id)}
        eventId={eventId}
        onUpdate={fetchData}
        currentUserId={currentUserId}
      />

      {/* Delay Modal */}
      <Modal isOpen={isDelayOpen} onClose={onDelayClose} size="sm">
        <ModalContent>
          <ModalHeader>Set Panel Delay</ModalHeader>
          <ModalBody className="space-y-4">
            <p className="text-default-500">
              Mark <strong>{delayPanel?.name}</strong> as delayed.
            </p>
            <Input
              label="Delay (minutes)"
              type="number"
              min="1"
              max="180"
              value={delayMinutes}
              onValueChange={setDelayMinutes}
            />
            <Input
              label="Reason (optional)"
              placeholder="e.g., Technical difficulties"
              value={delayReason}
              onValueChange={setDelayReason}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onDelayClose}>
              Cancel
            </Button>
            <Button color="warning" onPress={handleSetDelay}>
              Set Delay
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Judge Management Modal */}
      <Modal isOpen={isJudgeOpen} onClose={onJudgeClose} size="lg">
        <ModalContent>
          <ModalHeader>Manage Panel Judges</ModalHeader>
          <ModalBody className="space-y-4">
            {/* Current Judges */}
            <div>
              <h4 className="text-sm font-semibold mb-2">Current Judges</h4>
              {(panelJudges[judgePanel?.id] || []).length === 0 ? (
                <p className="text-default-500 text-sm">No judges assigned yet.</p>
              ) : (
                <div className="space-y-2">
                  {(panelJudges[judgePanel?.id] || []).map((judge) => (
                    <div
                      key={judge.user_id}
                      className="flex items-center justify-between p-2 bg-default-100 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={judge.profiles?.avatar_url}
                          name={judge.profiles?.display_name || judge.profiles?.email}
                          size="sm"
                        />
                        <div>
                          <p className="font-medium">
                            {judge.profiles?.display_name || judge.profiles?.email}
                          </p>
                          {judge.can_manage && (
                            <Chip size="sm" variant="flat" color="primary">
                              Can manage
                            </Chip>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="flat"
                          onPress={() =>
                            toggleJudgeCanManage(judgePanel.id, judge.user_id, judge.can_manage)
                          }
                        >
                          {judge.can_manage ? 'Revoke manage' : 'Allow manage'}
                        </Button>
                        <Button
                          size="sm"
                          variant="flat"
                          color="danger"
                          isIconOnly
                          onPress={() => removeJudgeFromPanel(judgePanel.id, judge.user_id)}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Divider />

            {/* Add Judge */}
            <div>
              <h4 className="text-sm font-semibold mb-2">Add Judge</h4>
              <Input
                label="Search users"
                placeholder="Enter name or email"
                value={judgeQuery}
                onValueChange={setJudgeQuery}
              />
              {judgeSearchResults.length > 0 && (
                <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                  {judgeSearchResults.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-2 bg-default-50 rounded-lg hover:bg-default-100 cursor-pointer"
                      onClick={() => addJudgeToPanel(user.id)}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar src={user.avatar_url} name={user.display_name || user.email} size="sm" />
                        <span>{user.display_name || user.email}</span>
                      </div>
                      <Plus size={16} className="text-primary" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button onPress={onJudgeClose}>Done</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Panel Description Modal */}
      <Modal isOpen={isDescriptionOpen} onClose={onDescriptionClose} size="lg">
        <ModalContent>
          <ModalHeader>{viewingPanel?.name} - Description</ModalHeader>
          <ModalBody>
            {viewingPanel?.description ? (
              <div className="prose dark:prose-invert max-w-none">
                <ReactMarkdown>{viewingPanel.description}</ReactMarkdown>
              </div>
            ) : (
              <p className="text-default-500">No description available.</p>
            )}
          </ModalBody>
          <ModalFooter>
            <Button onPress={onDescriptionClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
