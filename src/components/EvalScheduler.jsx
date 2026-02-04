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
  Wand2,
  Shuffle,
  ChevronRight,
  ChevronsRight,
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
  delayed: { color: 'danger', icon: Clock, label: 'Delayed' },
  no_show: { color: 'danger', icon: XCircle, label: 'Did Not Show' },
  cancelled: { color: 'default', icon: XCircle, label: 'Cancelled' },
};

const PANEL_STATUS_CONFIG = {
  scheduled: { color: 'default', label: 'Scheduled' },
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
  
  // Generate schedule modal state
  const [generatePanel, setGeneratePanel] = useState(null);
  const [generateTeams, setGenerateTeams] = useState([]);
  const [generateDuration, setGenerateDuration] = useState('15');
  const [generateGap, setGenerateGap] = useState('5');
  const [generateStartDate, setGenerateStartDate] = useState('');
  const [generateStartTime, setGenerateStartTime] = useState('09:00');
  const [generating, setGenerating] = useState(false);
  
  // Cascade edit state
  const [cascadeSlot, setCascadeSlot] = useState(null);
  const [cascadeNewDate, setCascadeNewDate] = useState('');
  const [cascadeNewTime, setCascadeNewTime] = useState('');
  const [cascadeApplyToAll, setCascadeApplyToAll] = useState(true);
  const [cascadeMarkDelayed, setCascadeMarkDelayed] = useState(false);
  
  // Delay from slot state
  const [delayFromSlot, setDelayFromSlot] = useState(null);

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
  const {
    isOpen: isGenerateOpen,
    onOpen: onGenerateOpen,
    onClose: onGenerateClose,
  } = useDisclosure();
  const {
    isOpen: isCascadeOpen,
    onOpen: onCascadeOpen,
    onClose: onCascadeClose,
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
          .select('*, eval_panels!eval_slots_panel_id_fkey!inner(event_id)')
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
      if (slot.status === 'delayed') return 'delayed';
      // For scheduled slots, check panel status
      if (panel?.status === 'paused') return 'paused';
      if (panel?.status === 'delayed') return 'delayed';
      return 'scheduled';
    },
    []
  );

  /**
   * Get effective panel status (considering time and slot statuses)
   */
  const getEffectivePanelStatus = useCallback(
    (panel, panelSlots) => {
      // If panel is explicitly completed, paused, or delayed, use that
      if (panel.status === 'completed') return 'completed';
      if (panel.status === 'paused') return 'paused';
      if (panel.status === 'delayed') return 'delayed';
      
      // If no slots, show as scheduled
      if (panelSlots.length === 0) return 'scheduled';
      
      // Check if any slot has been started (live or completed)
      const hasStartedSlot = panelSlots.some(s => ['live', 'completed', 'no_show'].includes(s.status));
      if (hasStartedSlot) return 'active';
      
      // Check if current time is before the first scheduled slot
      const scheduledSlots = panelSlots
        .filter(s => ['scheduled', 'rescheduled', 'delayed'].includes(s.status))
        .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
      
      if (scheduledSlots.length > 0) {
        const firstSlotTime = new Date(scheduledSlots[0].scheduled_at);
        if (new Date() < firstSlotTime) {
          return 'scheduled';
        }
      }
      
      return panel.status || 'active';
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
  const setPanelStatus = async (panel, status, delayMins = null, reason = null, fromSlotId = null) => {
    const updateData = {
      status,
      delay_minutes: status === 'delayed' ? delayMins : 0,
      delay_reason: status === 'delayed' ? reason : null,
      delay_from_slot_id: status === 'delayed' ? fromSlotId : null,
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
    const fromSlot = fromSlotId ? slots.find(s => s.id === fromSlotId) : null;
    const fromTeam = fromSlot ? teams.find(t => t.id === fromSlot.team_id) : null;
    await supabase.from('event_audit').insert({
      event_id: eventId,
      action: `eval_panel.${status}`,
      entity_type: 'eval_panel',
      entity_id: panel.id,
      message: `Set panel "${panel.name}" to ${status}${delayMins ? ` (${delayMins} min)` : ''}${fromTeam ? ` starting from ${fromTeam.name}` : ''}`,
      created_by: currentUserId,
      metadata: { status, delay_minutes: delayMins, reason, delay_from_slot_id: fromSlotId },
    });
    addToast({ title: `Panel ${status}`, severity: 'success' });
    fetchData();
  };

  const openDelayModal = (panel) => {
    setDelayPanel(panel);
    setDelayMinutes(String(panel.delay_minutes || 15));
    setDelayReason(panel.delay_reason || '');
    setDelayFromSlot(panel.delay_from_slot_id || null);
    onDelayOpen();
  };

  const handleSetDelay = async () => {
    if (!delayPanel) return;
    const mins = parseInt(delayMinutes, 10) || 0;
    await setPanelStatus(delayPanel, 'delayed', mins, delayReason, delayFromSlot);
    onDelayClose();
    setDelayPanel(null);
    setDelayFromSlot(null);
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
   * Get adjusted time for a slot considering panel delay
   */
  const getAdjustedTime = useCallback((slot, panel, allSlots) => {
    const originalTime = new Date(slot.scheduled_at);
    if (panel?.status === 'delayed' && panel.delay_minutes > 0 && slot.status === 'scheduled') {
      // Check if delay has a starting slot
      if (panel.delay_from_slot_id && allSlots) {
        const fromSlot = allSlots.find(s => s.id === panel.delay_from_slot_id);
        if (fromSlot) {
          const fromTime = new Date(fromSlot.scheduled_at);
          // Only apply delay if this slot is at or after the delay start slot
          if (originalTime >= fromTime) {
            return new Date(originalTime.getTime() + panel.delay_minutes * 60000);
          }
          return originalTime;
        }
      }
      return new Date(originalTime.getTime() + panel.delay_minutes * 60000);
    }
    return originalTime;
  }, []);

  /**
   * Check if a slot is affected by panel delay
   */
  const isSlotDelayed = useCallback((slot, panel, allSlots) => {
    if (panel?.status !== 'delayed' || slot.status !== 'scheduled') return false;
    if (panel.delay_from_slot_id && allSlots) {
      const fromSlot = allSlots.find(s => s.id === panel.delay_from_slot_id);
      if (fromSlot) {
        const slotTime = new Date(slot.scheduled_at);
        const fromTime = new Date(fromSlot.scheduled_at);
        return slotTime >= fromTime;
      }
    }
    return true;
  }, []);

  /**
   * Generate schedule modal
   */
  const openGenerateModal = (panel) => {
    setGeneratePanel(panel);
    // Get teams already scheduled in this panel
    const scheduledTeamIds = new Set(slots.filter(s => s.panel_id === panel.id).map(s => s.team_id));
    // Pre-select teams not yet scheduled
    setGenerateTeams(teams.filter(t => !scheduledTeamIds.has(t.id)).map(t => t.id));
    setGenerateDuration('15');
    setGenerateGap('5');
    // Default to today
    const now = new Date();
    setGenerateStartDate(now.toISOString().split('T')[0]);
    setGenerateStartTime('09:00');
    onGenerateOpen();
  };

  const toggleTeamInGenerate = (teamId) => {
    setGenerateTeams(prev => 
      prev.includes(teamId) 
        ? prev.filter(id => id !== teamId)
        : [...prev, teamId]
    );
  };

  const shuffleGenerateTeams = () => {
    setGenerateTeams(prev => {
      const shuffled = [...prev];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    });
  };

  const handleGenerateSchedule = async () => {
    if (!generatePanel || generateTeams.length === 0) {
      addToast({ title: 'Select at least one team', severity: 'warning' });
      return;
    }
    
    setGenerating(true);
    try {
      const duration = parseInt(generateDuration, 10) || 15;
      const gap = parseInt(generateGap, 10) || 5;
      const slotInterval = duration + gap;
      
      let currentTime = new Date(`${generateStartDate}T${generateStartTime}`);
      const slotsToInsert = [];
      
      for (const teamId of generateTeams) {
        slotsToInsert.push({
          panel_id: generatePanel.id,
          team_id: teamId,
          scheduled_at: currentTime.toISOString(),
          duration_minutes: duration,
          status: 'scheduled',
        });
        currentTime = new Date(currentTime.getTime() + slotInterval * 60000);
      }
      
      const { error } = await supabase.from('eval_slots').insert(slotsToInsert);
      if (error) throw error;
      
      await supabase.from('event_audit').insert({
        event_id: eventId,
        action: 'eval_slots.generate',
        entity_type: 'eval_panel',
        entity_id: generatePanel.id,
        message: `Generated ${slotsToInsert.length} eval slots for panel "${generatePanel.name}"`,
        created_by: currentUserId,
        metadata: { team_count: slotsToInsert.length, duration, gap },
      });
      
      addToast({ title: `Generated ${slotsToInsert.length} slots`, severity: 'success' });
      onGenerateClose();
      fetchData();
    } catch (err) {
      addToast({ title: 'Generation failed', description: err.message, severity: 'danger' });
    } finally {
      setGenerating(false);
    }
  };

  /**
   * Cascade edit - open modal for editing slot time with cascade option
   */
  const openCascadeEdit = (slot, panel) => {
    setCascadeSlot({ slot, panel });
    const dt = new Date(slot.scheduled_at);
    setCascadeNewDate(dt.toISOString().split('T')[0]);
    setCascadeNewTime(dt.toTimeString().slice(0, 5));
    setCascadeApplyToAll(true);
    setCascadeMarkDelayed(false);
    onCascadeOpen();
  };

  const handleCascadeEdit = async () => {
    if (!cascadeSlot) return;
    
    const { slot, panel } = cascadeSlot;
    const oldTime = new Date(slot.scheduled_at);
    const newTime = new Date(`${cascadeNewDate}T${cascadeNewTime}`);
    const timeDelta = newTime.getTime() - oldTime.getTime();
    
    if (timeDelta === 0 && !cascadeMarkDelayed) {
      onCascadeClose();
      return;
    }
    
    try {
      if (cascadeApplyToAll) {
        // Get all slots after this one in the same panel
        const panelSlots = slots
          .filter(s => s.panel_id === panel.id)
          .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
        
        const slotIndex = panelSlots.findIndex(s => s.id === slot.id);
        const slotsToUpdate = panelSlots.slice(slotIndex);
        
        // Update all slots from this one onwards
        for (const s of slotsToUpdate) {
          const originalTime = new Date(s.scheduled_at);
          const adjustedTime = new Date(originalTime.getTime() + timeDelta);
          
          const updateData = { scheduled_at: adjustedTime.toISOString() };
          if (cascadeMarkDelayed && ['scheduled', 'rescheduled', 'delayed'].includes(s.status)) {
            updateData.status = 'delayed';
          }
          
          await supabase
            .from('eval_slots')
            .update(updateData)
            .eq('id', s.id);
        }
        
        await supabase.from('event_audit').insert({
          event_id: eventId,
          action: 'eval_slots.cascade_edit',
          entity_type: 'eval_panel',
          entity_id: panel.id,
          message: `Cascade edited ${slotsToUpdate.length} slots in panel "${panel.name}"${cascadeMarkDelayed ? ' (marked as delayed)' : ''}`,
          created_by: currentUserId,
          metadata: { time_delta_minutes: timeDelta / 60000, slots_affected: slotsToUpdate.length, marked_delayed: cascadeMarkDelayed },
        });
        
        addToast({ title: `Updated ${slotsToUpdate.length} slots`, severity: 'success' });
      } else {
        // Update only this slot
        const updateData = { scheduled_at: newTime.toISOString() };
        if (cascadeMarkDelayed && ['scheduled', 'rescheduled', 'delayed'].includes(slot.status)) {
          updateData.status = 'delayed';
        }
        
        await supabase
          .from('eval_slots')
          .update(updateData)
          .eq('id', slot.id);
        
        addToast({ title: 'Slot updated', severity: 'success' });
      }
      
      onCascadeClose();
      fetchData();
    } catch (err) {
      addToast({ title: 'Update failed', description: err.message, severity: 'danger' });
    }
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
          {canJudge && (
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
            {canJudge && (
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
            const effectivePanelStatus = getEffectivePanelStatus(panel, panelSlots);
            const statusConfig = PANEL_STATUS_CONFIG[effectivePanelStatus] || PANEL_STATUS_CONFIG.active;
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
                    <span className="text-default-400 text-sm hidden sm:inline">
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
                        <Button
                          size="sm"
                          variant="flat"
                          color="secondary"
                          startContent={<Wand2 size={16} />}
                          onPress={() => openGenerateModal(panel)}
                        >
                          Generate
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
                    {canJudge && (
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
                    <div className="w-full overflow-x-auto pb-2" style={{ WebkitOverflowScrolling: 'touch' }}>
                      <Table aria-label="Evaluation slots" removeWrapper classNames={{ wrapper: "min-w-[600px]" }}>
                          <TableHeader>
                            <TableColumn>TEAM</TableColumn>
                            <TableColumn>TIME</TableColumn>
                            <TableColumn>DURATION</TableColumn>
                            <TableColumn>STATUS</TableColumn>
                            {isPanelJudge ? <TableColumn>ACTIONS</TableColumn> : <TableColumn className="w-0 p-0"> </TableColumn>}
                          </TableHeader>
                          <TableBody>
                            {panelSlots
                              .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))
                              .map((slot) => {
                            const team = teams.find((t) => t.id === slot.team_id);
                            const effectiveStatus = getEffectiveSlotStatus(slot, panel);
                            const originalTime = new Date(slot.scheduled_at);
                            const adjustedTime = getAdjustedTime(slot, panel, panelSlots);
                            const slotIsDelayed = isSlotDelayed(slot, panel, panelSlots);
                            const statusCfg =
                              effectiveStatus === 'paused'
                                ? { color: 'warning', icon: Pause, label: 'Paused' }
                                : effectiveStatus === 'delayed' && slotIsDelayed
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
                                    <span>{adjustedTime.toLocaleDateString()}</span>
                                    <div className="flex items-center gap-1">
                                      {slotIsDelayed && (
                                        <span className="text-default-400 text-sm line-through">
                                          {originalTime.toLocaleTimeString([], {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                          })}
                                        </span>
                                      )}
                                      <span className={`text-sm ${slotIsDelayed ? 'text-danger font-medium' : 'text-default-500'}`}>
                                        {slotIsDelayed && '→ '}
                                        {adjustedTime.toLocaleTimeString([], {
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })}
                                      </span>
                                    </div>
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
                                <TableCell className={isPanelJudge ? '' : 'w-0 p-0'}>
                                  {isPanelJudge && (
                                    <Dropdown>
                                      <DropdownTrigger>
                                        <Button size="sm" variant="light" isIconOnly>
                                          <MoreVertical size={16} />
                                        </Button>
                                      </DropdownTrigger>
                                      <DropdownMenu>
                                        {['scheduled', 'delayed', 'rescheduled'].includes(slot.status) && (
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
                                        {['scheduled', 'rescheduled', 'delayed'].includes(slot.status) && (
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
                                        {['scheduled', 'rescheduled', 'delayed'].includes(slot.status) && (
                                          <DropdownItem
                                            key="cascade"
                                            startContent={<ChevronsRight size={16} />}
                                            onPress={() => openCascadeEdit(slot, panel)}
                                          >
                                            Edit Time (Cascade)
                                          </DropdownItem>
                                        )}
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
                    </div>
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
      <Modal isOpen={isDelayOpen} onClose={onDelayClose} size="md">
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
            
            {/* Delay from specific slot */}
            <div>
              <h4 className="text-sm font-semibold mb-2">Apply delay starting from</h4>
              <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-1">
                <div
                  className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                    delayFromSlot === null ? 'bg-primary-100' : 'hover:bg-default-100'
                  }`}
                  onClick={() => setDelayFromSlot(null)}
                >
                  <input
                    type="radio"
                    checked={delayFromSlot === null}
                    onChange={() => setDelayFromSlot(null)}
                    className="pointer-events-none"
                  />
                  <span className="font-medium">All slots (entire panel)</span>
                </div>
                {delayPanel && getSlotsForPanel(delayPanel.id)
                  .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))
                  .filter(slot => ['scheduled', 'rescheduled'].includes(slot.status))
                  .map((slot) => {
                    const team = teams.find((t) => t.id === slot.team_id);
                    return (
                      <div
                        key={slot.id}
                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                          delayFromSlot === slot.id ? 'bg-primary-100' : 'hover:bg-default-100'
                        }`}
                        onClick={() => setDelayFromSlot(slot.id)}
                      >
                        <input
                          type="radio"
                          checked={delayFromSlot === slot.id}
                          onChange={() => setDelayFromSlot(slot.id)}
                          className="pointer-events-none"
                        />
                        <div className="flex-1">
                          <span className="font-medium">{team?.name || 'Unknown'}</span>
                          <span className="text-default-400 text-sm ml-2">
                            {new Date(slot.scheduled_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
              <p className="text-xs text-default-400 mt-1">
                Slots before the selected team will not be affected by the delay.
              </p>
            </div>
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

      {/* Generate Schedule Modal */}
      <Modal isOpen={isGenerateOpen} onClose={onGenerateClose} size="2xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>Generate Evaluation Schedule - {generatePanel?.name}</ModalHeader>
          <ModalBody className="space-y-4">
            {/* Team Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold">Select Teams ({generateTeams.length} selected)</h4>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="flat"
                    onPress={() => setGenerateTeams(teams.map((t) => t.id))}
                  >
                    Select All
                  </Button>
                  <Button size="sm" variant="flat" onPress={() => setGenerateTeams([])}>
                    Clear
                  </Button>
                  <Button
                    size="sm"
                    variant="flat"
                    color="secondary"
                    startContent={<Shuffle size={14} />}
                    onPress={shuffleGenerateTeams}
                    isDisabled={generateTeams.length < 2}
                  >
                    Shuffle
                  </Button>
                </div>
              </div>
              <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-1">
                {teams.map((team) => (
                  <div
                    key={team.id}
                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                      generateTeams.includes(team.id) ? 'bg-primary-100' : 'hover:bg-default-100'
                    }`}
                    onClick={() => toggleTeamInGenerate(team.id)}
                  >
                    <input
                      type="checkbox"
                      checked={generateTeams.includes(team.id)}
                      onChange={() => toggleTeamInGenerate(team.id)}
                      className="pointer-events-none"
                    />
                    <span>{team.name}</span>
                    {generateTeams.includes(team.id) && (
                      <Chip size="sm" variant="flat">
                        #{generateTeams.indexOf(team.id) + 1}
                      </Chip>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <Divider />

            {/* Schedule Settings */}
            <div className="grid grid-cols-2 gap-4">
              <Input
                type="number"
                label="Duration per eval (minutes)"
                value={generateDuration}
                onValueChange={setGenerateDuration}
                min={1}
                endContent={<span className="text-default-400 text-sm">min</span>}
              />
              <Input
                type="number"
                label="Gap between evals (minutes)"
                value={generateGap}
                onValueChange={setGenerateGap}
                min={0}
                endContent={<span className="text-default-400 text-sm">min</span>}
              />
              <Input
                type="date"
                label="Start Date"
                value={generateStartDate}
                onValueChange={setGenerateStartDate}
              />
              <Input
                type="time"
                label="Start Time"
                value={generateStartTime}
                onValueChange={setGenerateStartTime}
              />
            </div>

            <Divider />

            {/* Preview */}
            <div>
              <h4 className="text-sm font-semibold mb-2">Preview</h4>
              {generateTeams.length > 0 && generateStartDate && generateStartTime ? (
                <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-1">
                  {generateTeams.map((teamId, index) => {
                    const team = teams.find((t) => t.id === teamId);
                    const startMinutes =
                      index * (parseInt(generateDuration) + parseInt(generateGap));
                    const startDate = new Date(`${generateStartDate}T${generateStartTime}`);
                    startDate.setMinutes(startDate.getMinutes() + startMinutes);
                    return (
                      <div
                        key={teamId}
                        className="flex items-center justify-between p-2 bg-default-50 rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <Chip size="sm" variant="flat">
                            {index + 1}
                          </Chip>
                          <span className="font-medium">{team?.name}</span>
                        </div>
                        <div className="text-sm text-default-500">
                          {startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {' - '}
                          {new Date(
                            startDate.getTime() + parseInt(generateDuration) * 60000
                          ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-default-500 text-sm">
                  Select teams and set start date/time to see preview.
                </p>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onGenerateClose}>
              Cancel
            </Button>
            <Button
              color="primary"
              startContent={<Wand2 size={16} />}
              onPress={handleGenerateSchedule}
              isDisabled={!generateTeams.length || !generateStartDate || !generateStartTime}
            >
              Generate {generateTeams.length} Slots
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Cascade Edit Modal */}
      <Modal isOpen={isCascadeOpen} onClose={onCascadeClose} size="lg">
        <ModalContent>
          <ModalHeader>
            <div className="flex items-center gap-2">
              <ChevronsRight size={20} />
              Edit Time (Cascade)
            </div>
          </ModalHeader>
          <ModalBody className="space-y-4">
            {cascadeSlot && (
              <>
                {/* Current Slot Info */}
                <div className="p-3 bg-default-100 rounded-lg">
                  <p className="text-sm text-default-500">Current Slot</p>
                  <p className="font-semibold">
                    {teams.find((t) => t.id === cascadeSlot.team_id)?.name}
                  </p>
                  <p className="text-sm">
                    {new Date(cascadeSlot.scheduled_time).toLocaleString()}
                  </p>
                </div>

                {/* New Time */}
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    type="date"
                    label="New Date"
                    value={cascadeNewDate}
                    onValueChange={setCascadeNewDate}
                  />
                  <Input
                    type="time"
                    label="New Time"
                    value={cascadeNewTime}
                    onValueChange={setCascadeNewTime}
                  />
                </div>

                {/* Cascade Option */}
                <div
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border-2 transition-colors ${
                    cascadeApplyToAll ? 'border-primary bg-primary-50' : 'border-default-200'
                  }`}
                  onClick={() => setCascadeApplyToAll(!cascadeApplyToAll)}
                >
                  <input
                    type="checkbox"
                    checked={cascadeApplyToAll}
                    onChange={(e) => setCascadeApplyToAll(e.target.checked)}
                    className="pointer-events-none"
                  />
                  <div>
                    <p className="font-medium">Apply to subsequent slots</p>
                    <p className="text-sm text-default-500">
                      All slots after this one will be shifted by the same time difference
                    </p>
                  </div>
                </div>

                {/* Mark as Delayed Option */}
                <div
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border-2 transition-colors ${
                    cascadeMarkDelayed ? 'border-danger bg-danger-50' : 'border-default-200'
                  }`}
                  onClick={() => setCascadeMarkDelayed(!cascadeMarkDelayed)}
                >
                  <input
                    type="checkbox"
                    checked={cascadeMarkDelayed}
                    onChange={(e) => setCascadeMarkDelayed(e.target.checked)}
                    className="pointer-events-none"
                  />
                  <div>
                    <p className="font-medium">Mark as Delayed</p>
                    <p className="text-sm text-default-500">
                      {cascadeApplyToAll ? 'All affected slots' : 'This slot'} will be marked with "Delayed" status
                    </p>
                  </div>
                </div>

                {/* Preview of affected slots */}
                {cascadeApplyToAll && cascadeNewDate && cascadeNewTime && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Affected Slots</h4>
                    <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-1">
                      {(() => {
                        const panel = panels.find((p) => p.id === cascadeSlot.panel_id);
                        const panelSlots = slots
                          .filter((s) => s.panel_id === cascadeSlot.panel_id)
                          .sort(
                            (a, b) => new Date(a.scheduled_time) - new Date(b.scheduled_time)
                          );
                        const currentIndex = panelSlots.findIndex(
                          (s) => s.id === cascadeSlot.id
                        );
                        const affectedSlots = panelSlots.slice(currentIndex);

                        const oldTime = new Date(cascadeSlot.scheduled_time);
                        const newTime = new Date(`${cascadeNewDate}T${cascadeNewTime}`);
                        const diffMs = newTime - oldTime;

                        return affectedSlots.map((slot, idx) => {
                          const team = teams.find((t) => t.id === slot.team_id);
                          const originalTime = new Date(slot.scheduled_time);
                          const adjustedTime = new Date(originalTime.getTime() + diffMs);
                          return (
                            <div
                              key={slot.id}
                              className="flex items-center justify-between p-2 bg-default-50 rounded-lg"
                            >
                              <span className="font-medium">{team?.name}</span>
                              <div className="text-sm flex items-center gap-2">
                                <span className="text-default-400 line-through">
                                  {originalTime.toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                                <ChevronRight size={14} />
                                <span className="text-primary">
                                  {adjustedTime.toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}
              </>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onCascadeClose}>
              Cancel
            </Button>
            <Button
              color="primary"
              startContent={<ChevronsRight size={16} />}
              onPress={handleCascadeEdit}
              isDisabled={!cascadeNewDate || !cascadeNewTime}
            >
              {cascadeApplyToAll ? 'Apply to All' : 'Update Slot'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
