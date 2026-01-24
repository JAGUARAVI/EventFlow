import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Tabs, Tab, Button, Input, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure, addToast, Avatar, Select, SelectItem, Card, CardBody, Chip, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from '@heroui/react';
import { Link as HeroLink } from '@heroui/link';
import { Download, Copy, Trash2, Settings, Share2, MoreVertical, Search, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useRealtimeLeaderboard } from '../hooks/useRealtimeLeaderboard';
import { useRealtimeBracket } from '../hooks/useRealtimeBracket';
import { useEventTheme } from '../hooks/useEventTheme';
import Leaderboard from '../components/Leaderboard';
import AuditLog from '../components/AuditLog';
import BracketView from '../components/BracketView';
import MatchEditor from '../components/MatchEditor';
import PollEditor from '../components/PollEditor';
import PollVote from '../components/PollVote';
import PollResults from '../components/PollResults';
import TimelineView from '../components/TimelineView';
import CsvManager from '../components/CsvManager';
import EventCloneDialog from '../components/EventCloneDialog';
import AnnouncementsFeed from '../components/AnnouncementsFeed';
import ThemeBuilder from '../components/ThemeBuilder';
import EventStatusManager from '../components/EventStatusManager';
import EventAnalytics from '../components/EventAnalytics';
import MetadataTemplateBuilder from '../components/MetadataTemplateBuilder';
import MetadataFieldsForm from '../components/MetadataFieldsForm';
import TeamMetadataDisplay from '../components/TeamMetadataDisplay';
import PdfExportDialog from '../components/PdfExportDialog';
import { generateSingleElimination, generateRoundRobin, generateSwiss } from '../lib/bracket';
import { useLiveVotes } from '../hooks/useLiveVotes';
import { useRealtimePolls } from '../hooks/useRealtimePolls';

export default function EventPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, profile } = useAuth();
  const [event, setEvent] = useState(null);
  const [teams, setTeams] = useState([]);
  const [judges, setJudges] = useState([]);
  const [auditItems, setAuditItems] = useState([]);
  const [matches, setMatches] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [scoreHistory, setScoreHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bracketType, setBracketType] = useState('single_elim');
  const [generatingBracket, setGeneratingBracket] = useState(false);
  const [regeneratingBracket, setRegeneratingBracket] = useState(false);
  const [fixingBracket, setFixingBracket] = useState(false);

  const { isOpen: isMatchOpen, onOpen: onMatchOpen, onClose: onMatchClose } = useDisclosure();
  const [selectedMatch, setSelectedMatch] = useState(null);

  const [polls, setPolls] = useState([]);
  const [pollOptions, setPollOptions] = useState({});
  const { isOpen: isPollEditorOpen, onOpen: onPollEditorOpen, onClose: onPollEditorClose } = useDisclosure();
  const [selectedPoll, setSelectedPoll] = useState(null);
  const [selectedPollForVote, setSelectedPollForVote] = useState(null);
  const [pollSearch, setPollSearch] = useState('');

  const { isOpen: isTeamOpen, onOpen: onTeamOpen, onClose: onTeamClose } = useDisclosure();
  const [teamName, setTeamName] = useState('');
  const [teamMetadata, setTeamMetadata] = useState({});
  const [teamSaving, setTeamSaving] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [changingRegistrationStatus, setChangingRegistrationStatus] = useState(false);
  const [teamSearch, setTeamSearch] = useState('');
  const [expandedTeams, setExpandedTeams] = useState(new Set());

  const { isOpen: isJudgeOpen, onOpen: onJudgeOpen, onClose: onJudgeClose } = useDisclosure();
  const [judgeQuery, setJudgeQuery] = useState('');
  const [judgeSaving, setJudgeSaving] = useState(false);
  const [judgeSearchResults, setJudgeSearchResults] = useState([]);

  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deletingEvent, setDeletingEvent] = useState(false);

  // New Phase 6/7 modals
  const { isOpen: isCloneOpen, onOpen: onCloneOpen, onClose: onCloneClose } = useDisclosure();
  const { isOpen: isPdfExportOpen, onOpen: onPdfExportOpen, onClose: onPdfExportClose } = useDisclosure();
  const { isOpen: isThemeOpen, onOpen: onThemeOpen, onClose: onThemeClose } = useDisclosure();
  const { isOpen: isMetadataOpen, onOpen: onMetadataOpen, onClose: onMetadataClose } = useDisclosure();

  const role = profile?.role || '';
  const isAdmin = role === 'admin';
  const eventTypes = Array.isArray(event?.event_types) && event.event_types.length > 0
    ? event.event_types
    : event?.type === 'hybrid'
      ? ['points', 'bracket', 'poll']
      : event?.type
        ? [event.type]
        : ['points'];
  const hasType = (t) => eventTypes.includes(t);
  const canManage = event && (isAdmin || (event.created_by === user?.id && role !== 'viewer'));
  const canJudge = event && (canManage || (judges.some((j) => j.user_id === user?.id)));
  const registrationsOpen = event?.status === 'registration_open';
  const isTeamRegistered = teams.some((t) => t.created_by === user?.id);
  const settings = event?.settings || {};
  const showAnalytics = canManage || !settings.hide_analytics;
  const showTimeline = canManage || !settings.hide_timeline;
  const showJudges = canManage || !settings.hide_judges;

  // Load and apply event-specific theme
  const { eventTheme, updateEventTheme, hasEventTheme } = useEventTheme(id, canManage);

  const toggleTeamExpansion = (teamId) => {
    setExpandedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  };

  const filteredTeams = teams.filter((t) => {
    const search = teamSearch.toLowerCase();
    const matchesName = t.name.toLowerCase().includes(search);
    const matchesDesc = t.description && t.description.toLowerCase().includes(search);
    const matchesMetadata = t.metadata_values && Object.values(t.metadata_values).some(val => {
      if (Array.isArray(val)) {
        return val.some(item => String(item).toLowerCase().includes(search));
      }
      return String(val).toLowerCase().includes(search);
    });
    return matchesName || matchesDesc || matchesMetadata;
  });

  const fetch = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [eRes, tRes, jRes, aRes, mRes, pRes, auditRes, rRes] = await Promise.all([
      supabase.from('events').select('*').eq('id', id).single(),
      supabase.from('teams').select('*').eq('event_id', id).order('created_at'),
      supabase.from('event_judges').select('user_id, created_at').eq('event_id', id),
      supabase.from('score_history').select('*, teams(name)').eq('event_id', id).order('created_at', { ascending: true }),
      supabase.from('matches').select('*').eq('event_id', id).order('round', { ascending: false }).order('position'),
      supabase.from('polls').select('*').eq('event_id', id).order('created_at', { ascending: false }),
      supabase.from('event_audit').select('*').eq('event_id', id).order('created_at', { ascending: false }).limit(100),
      supabase.from('rounds').select('*').eq('event_id', id).order('number'),
    ]);

    // for each judge fetch their public.profile info
    if (jRes.data) {
      const judgeDetails = await Promise.all(jRes.data.map(async (j) => {
        const { data: profileData } = await supabase.from('profiles').select('display_name, avatar_url, email').eq('id', j.user_id).single();
        return {
          user_id: j.user_id,
          created_at: j.created_at,
          display_name: profileData?.display_name || null,
          avatar_url: profileData?.avatar_url || null,
          email: profileData?.email || null,
        };
      }));
      jRes.data = judgeDetails;
    }
    
    setLoading(false);
    if (eRes.error) {
      setError('Event not found');
      setEvent(null);
      setTeams([]);
      setJudges([]);
      setAuditItems([]);
      setMatches([]);
      setPolls([]);
      setPollOptions({});
      return;
    }
    setEvent(eRes.data);
    setTeams(tRes.data || []);
    setJudges(jRes.data || []);
    setRounds(rRes.data || []);
    setScoreHistory(aRes.data || []);
    const scoreItems = (aRes.data || []).map((x) => ({ ...x, kind: 'score' }));
    const auditItems = (auditRes.data || []).map((x) => ({ ...x, kind: 'event' }));
    const mergedAudit = [...scoreItems, ...auditItems].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 200);
    setAuditItems(mergedAudit);
    setMatches(mRes.data || []);
    setPolls(pRes.data || []);
    if (mRes.data && mRes.data.length > 0) {
      setBracketType(mRes.data[0].bracket_type || 'single_elim');
    }
    
    // Fetch options for each poll
    if (pRes.data && pRes.data.length > 0) {
      const optionsMap = {};
      for (const poll of pRes.data) {
        const { data: opts } = await supabase.from('poll_options').select('*').eq('poll_id', poll.id).order('display_order');
        optionsMap[poll.id] = opts || [];
      }
      setPollOptions(optionsMap);
    } else {
      setPollOptions({});
    }
    
    setError('');
  }, [id]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  useEffect(() => {
    if (!canManage) return;
    if (!matches || matches.length === 0) return;
    if (matches[0]?.bracket_type !== 'single_elim') return;

    const needsLink = matches.some((m) => m.round > 0 && (!m.next_match_id || !m.next_match_slot));
    const needsBye = matches.some((m) => {
      const hasA = !!m.team_a_id;
      const hasB = !!m.team_b_id;
      return !m.winner_id && m.status !== 'completed' && ((hasA && !hasB) || (!hasA && hasB));
    });

    if ((needsLink || needsBye) && !fixingBracket) {
      finalizeSingleElimBracket().then(() => fetch());
    }
  }, [canManage, matches, fixingBracket, fetch]);

  useRealtimeLeaderboard(id, setTeams);
  useRealtimeBracket(id, setMatches);
  useRealtimePolls(id, setPolls, setPollOptions);

  const buildBracketMatches = (type) => {
    if (type === 'single_elim') return generateSingleElimination(id, teams);
    if (type === 'round_robin') return generateRoundRobin(id, teams);
    if (type === 'swiss') return generateSwiss(id, teams);
    return [];
  };

  const handleGenerateBracket = async () => {
    if (!teams || teams.length === 0) {
      addToast({ title: 'No teams', description: 'Add teams first', severity: 'warning' });
      return;
    }
    setGeneratingBracket(true);
    const generated = buildBracketMatches(bracketType);
    const { error: e } = await supabase.from('matches').insert(generated);
    setGeneratingBracket(false);
    if (e) {
      addToast({ title: 'Generation failed', description: e.message, severity: 'danger' });
      return;
    }
    await supabase.from('event_audit').insert({
      event_id: id,
      action: 'bracket.generate',
      entity_type: 'bracket',
      message: `Generated ${bracketType.replace('_', ' ')} bracket`,
      created_by: user?.id,
      metadata: { bracket_type: bracketType },
    });
    await finalizeSingleElimBracket();
    fetch();
    addToast({ title: 'Bracket generated', severity: 'success' });
  };

  const handleRegenerateBracket = async () => {
    if (!teams || teams.length === 0) {
      addToast({ title: 'No teams', description: 'Add teams first', severity: 'warning' });
      return;
    }
    if (!confirm('Regenerate bracket? This will delete all existing matches.')) return;
    setRegeneratingBracket(true);
    const { error: delErr } = await supabase.from('matches').delete().eq('event_id', id);
    if (delErr) {
      setRegeneratingBracket(false);
      addToast({ title: 'Regenerate failed', description: delErr.message, severity: 'danger' });
      return;
    }
    const generated = buildBracketMatches(bracketType);
    const { error: insErr } = await supabase.from('matches').insert(generated);
    setRegeneratingBracket(false);
    if (insErr) {
      addToast({ title: 'Regenerate failed', description: insErr.message, severity: 'danger' });
      return;
    }
    await supabase.from('event_audit').insert({
      event_id: id,
      action: 'bracket.regenerate',
      entity_type: 'bracket',
      message: `Regenerated ${bracketType.replace('_', ' ')} bracket`,
      created_by: user?.id,
      metadata: { bracket_type: bracketType },
    });
    await finalizeSingleElimBracket();
    fetch();
    addToast({ title: 'Bracket regenerated', severity: 'success' });
  };

  const handleEditMatch = (match) => {
    setSelectedMatch(match);
    onMatchOpen();
  };

  const handleDeletePoll = async (pollId) => {
    if (!confirm('Delete this poll? This will remove all its votes.')) return;
    const target = polls.find((p) => p.id === pollId);
    const { error: e } = await supabase.from('polls').delete().eq('id', pollId);
    if (e) {
      addToast({ title: 'Delete failed', description: e.message, severity: 'danger' });
      return;
    }
    await supabase.from('event_audit').insert({
      event_id: id,
      action: 'poll.delete',
      entity_type: 'poll',
      entity_id: pollId,
      message: target ? `Deleted poll "${target.question}"` : 'Deleted poll',
      created_by: user?.id,
    });
    fetch();
    addToast({ title: 'Poll deleted', severity: 'success' });
  };

  const handleDeleteEvent = async () => {
    if (!event?.name) return;
    if (deleteConfirmName !== event.name) {
      addToast({ title: 'Name mismatch', description: 'Type the event name exactly to confirm.', severity: 'warning' });
      return;
    }
    setDeletingEvent(true);
    const { error: e } = await supabase.from('events').delete().eq('id', id);
    setDeletingEvent(false);
    if (e) {
      addToast({ title: 'Delete failed', description: e.message, severity: 'danger' });
      return;
    }
    addToast({ title: 'Event deleted', severity: 'success' });
    onDeleteClose();
    navigate('/dashboard');
  };

  const finalizeSingleElimBracket = async () => {
    if (!id || bracketType !== 'single_elim') return;
    setFixingBracket(true);

    // Fetch current matches for event
    const { data: allMatches } = await supabase
      .from('matches')
      .select('*')
      .eq('event_id', id)
      .eq('bracket_type', 'single_elim');

    if (!allMatches || allMatches.length === 0) {
      setFixingBracket(false);
      return;
    }

    // Build map by round/position for next match linking
    const map = new Map();
    allMatches.forEach((m) => map.set(`${m.round}_${m.position}`, m));

    const linkUpdates = [];
    allMatches.forEach((m) => {
      if (m.round > 0) {
        const nextRound = m.round - 1;
        const nextPos = Math.floor(m.position / 2);
        const nextMatch = map.get(`${nextRound}_${nextPos}`);
        const slot = m.position % 2 === 0 ? 'a' : 'b';
        if (nextMatch && (m.next_match_id !== nextMatch.id || m.next_match_slot !== slot)) {
          linkUpdates.push({ id: m.id, next_match_id: nextMatch.id, next_match_slot: slot });
        }
      }
    });

    if (linkUpdates.length > 0) {
      await Promise.all(
        linkUpdates.map((u) =>
          supabase.from('matches').update({
            next_match_id: u.next_match_id,
            next_match_slot: u.next_match_slot,
          }).eq('id', u.id)
        )
      );
    }

    // Auto-advance byes until no more single-team matches
    for (let i = 0; i < 6; i++) {
      const { data: current } = await supabase
        .from('matches')
        .select('*')
        .eq('event_id', id)
        .eq('bracket_type', 'single_elim');

      if (!current || current.length === 0) break;

      const byeMatches = current.filter((m) => {
        const hasA = !!m.team_a_id;
        const hasB = !!m.team_b_id;
        return !m.winner_id && m.status !== 'completed' && ((hasA && !hasB) || (!hasA && hasB));
      });

      if (byeMatches.length === 0) break;

      await Promise.all(
        byeMatches.map((m) =>
          supabase.from('matches').update({
            winner_id: m.team_a_id || m.team_b_id,
            status: 'completed',
          }).eq('id', m.id)
        )
      );
    }

    setFixingBracket(false);
  };

  const openAddTeam = () => {
    setEditingTeam(null);
    setTeamName('');
    setTeamMetadata({});
    onTeamOpen();
  };

  const openEditTeam = (t) => {
    setEditingTeam(t);
    setTeamName(t.name);
    setTeamMetadata(t.metadata_values || {});
    onTeamOpen();
  };

  const saveTeam = async () => {
    const name = teamName.trim();
    const created_by = user?.id || null;
    if (!name) return;
    setTeamSaving(true);
    if (editingTeam) {
      const { error: e } = await supabase
        .from('teams')
        .update({ name, metadata_values: teamMetadata, created_by })
        .eq('id', editingTeam.id);
      setTeamSaving(false);
      if (e) {
        setError(e.message);
        return;
      }
    } else {
      const { error: e } = await supabase
        .from('teams')
        .insert([{ event_id: id, name, metadata_values: teamMetadata, created_by: user?.id }]);
      setTeamSaving(false);
      if (e) {
        setError(e.message);
        return;
      }
    }
    onTeamClose();
    fetch();
  };

  const removeTeam = async (teamId) => {
    if (!confirm('Remove this team?')) return;
    const { error: e } = await supabase.from('teams').delete().eq('id', teamId);
    if (e) setError(e.message);
    else fetch();
  };

  const updateRegistrationStatus = async (newStatus) => {
    try {
      setChangingRegistrationStatus(true);
      const { error } = await supabase
        .from('events')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) {
        addToast({ title: 'Failed to update registration status', description: error.message, severity: 'danger' });
      } else {
        await fetch();
        addToast({ title: `Registrations ${newStatus === 'registration_open' ? 'opened' : 'closed'}`, severity: 'success' });
      }
    } finally {
      setChangingRegistrationStatus(false);
    }
  };

  const openAddJudge = () => {
    setJudgeQuery('');
    setJudgeSearchResults([]);
    onJudgeOpen();
  };

  const searchJudges = async (query) => {
    setJudgeQuery(query);

    if (!query.trim()) {
      setJudgeSearchResults([]);
      return;
    }

    const q = query.trim();

    const { data, error } = await supabase.rpc('search_profiles', { q });

    if (error) {
      console.error(error);
      setJudgeSearchResults([]);
      return;
    }

    setJudgeSearchResults(data || []);
  };


  const saveJudge = async (uid) => {
    setJudgeSaving(true);
    const { error: e } = await supabase.from('event_judges').insert([{ event_id: id, user_id: uid }]);
    setJudgeSaving(false);
    if (e) {
      setError(e.message);
      return;
    }
    onJudgeClose();
    fetch();
  };

  const removeJudge = async (userId) => {
    if (!confirm('Remove this judge?')) return;
    const { error: e } = await supabase.from('event_judges').delete().eq('event_id', id).eq('user_id', userId);
    if (e) setError(e.message);
    else fetch();
  };

  const handleUndo = async () => {
    const { data: last, error: e1 } = await supabase
      .from('score_history')
      .select('id, team_id, points_before, points_after, delta')
      .eq('event_id', id)
      .is('undo_id', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (e1 || !last) {
      addToast({ title: 'Nothing to undo', severity: 'default' });
      return;
    }
    const { error: e2 } = await supabase.from('score_history').insert([{
      event_id: id, team_id: last.team_id, points_before: last.points_after, points_after: last.points_before, delta: -Number(last.delta), changed_by: user.id, undo_id: last.id,
    }]);
    if (e2) {
      addToast({ title: 'Undo failed', description: e2.message, severity: 'danger' });
      return;
    }
    const { error: e3 } = await supabase.from('teams').update({ score: last.points_before }).eq('id', last.team_id);
    if (e3) {
      addToast({ title: 'Undo failed', description: e3.message, severity: 'danger' });
      return;
    }
    fetch();
  };

  const handleScoreChange = async (teamId, deltaVal) => {
    const t = teams.find((x) => x.id === teamId);
    if (!t || !user?.id) return;
    const prev = Number(t.score) || 0;
    const next = prev + deltaVal;
    setTeams((old) => old.map((x) => (x.id === teamId ? { ...x, score: next } : x)));
    const { error: histErr } = await supabase.from('score_history').insert([{
      event_id: id, team_id: teamId, points_before: prev, points_after: next, delta: deltaVal, changed_by: user.id,
    }]);
    if (histErr) {
      setTeams((old) => old.map((x) => (x.id === teamId ? { ...x, score: prev } : x)));
      addToast({ title: 'Score update failed', description: histErr.message, severity: 'danger' });
      return;
    }
    const { error: e } = await supabase.from('teams').update({ score: next }).eq('id', teamId);
    if (e) {
      setTeams((old) => old.map((x) => (x.id === teamId ? { ...x, score: prev } : x)));
      addToast({ title: 'Score update failed', description: e.message, severity: 'danger' });
    }
  };

  const teamColumns = [
    <TableColumn key="name">NAME</TableColumn>,
    ...(canManage ? [<TableColumn key="actions" align="end">ACTIONS</TableColumn>] : []),
  ];

  const teamRows = teams.map((t) => {
    const cells = [<TableCell key="name">{t.name}</TableCell>];
    if (canManage) {
      cells.push(
        <TableCell key="actions" align="right">
          <Button size="sm" variant="light" onPress={() => openEditTeam(t)}>Edit</Button>
          <Button size="sm" color="danger" variant="light" onPress={() => removeTeam(t.id)}>Remove</Button>
        </TableCell>
      );
    }
    return <TableRow key={t.id}>{cells}</TableRow>;
  });

  const judgeColumns = [
    <TableColumn key="judge">JUDGE</TableColumn>,
    <TableColumn key="user_id">USER ID</TableColumn>,
    ...(canManage ? [<TableColumn key="actions" align="end">ACTIONS</TableColumn>] : []),
  ];

  const judgeRows = judges.map((j) => {
    const cells = [
      <TableCell key="judge">
        <div className="flex items-center gap-3">
          <Avatar
            src={j.avatar_url || undefined}
            name={j.display_name}
            size="sm"
          />
          <div className="flex flex-col">
            <span className="font-medium leading-tight">
              {j.display_name || "Unnamed Judge"}
            </span>
            <span className="text-xs text-foreground-500">
              {j.email}
            </span>
          </div>
        </div>
      </TableCell>,
      <TableCell key="user_id">
        <code className="text-xs text-foreground-500">
          {j.user_id}
        </code>
      </TableCell>,
    ];

    if (canManage) {
      cells.push(
        <TableCell key="actions" align="right">
          <Button
            size="sm"
            color="danger"
            variant="light"
            onPress={() => removeJudge(j.user_id)}
          >
            Remove
          </Button>
        </TableCell>
      );
    }

    return <TableRow key={j.user_id}>{cells}</TableRow>;
  });

  const handleImportTeams = async (importedTeams) => {
    if (!importedTeams || importedTeams.length === 0) return;

    // Add event_id and created_by to each team
    const teamsToInsert = importedTeams.map(t => ({
      event_id: id,
      name: t.name,
      score: t.score || 0,
      description: t.description || '',
      metadata_values: t.metadata || {},
      created_by: user?.id
    }));

    const { error } = await supabase.from('teams').insert(teamsToInsert);
    
    if (error) {
      console.error('Import error:', error);
      throw new Error(error.message);
    }
    
    await supabase.from('event_audit').insert({
        event_id: id,
        action: 'teams.import',
        entity_type: 'team',
        message: `Imported ${teamsToInsert.length} teams from CSV`,
        created_by: user?.id,
    });

    await fetch();
    addToast({ title: `Imported ${teamsToInsert.length} teams`, severity: 'success' });
  };

  if (loading && !event) {
    return (
      <div className="p-6 flex justify-center">
        <p className="text-default-500">Loading…</p>
      </div>
    );
  }

  if (error && !event) {
    return (
      <div className="p-6">
        <p className="text-danger">{error}</p>
        <Link to="/dashboard" className="text-primary underline">Back to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {event?.banner_url && (
        <div className="mb-6 rounded-lg overflow-hidden">
          <img
            src={event.banner_url}
            alt="Event banner"
            className="w-full h-48 object-cover"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        </div>
      )}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold">{event?.name}</h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {eventTypes.map((t) => (
              <Chip key={t} size="sm" variant="flat" color="primary">{t}</Chip>
            ))}
            <Chip size="sm" variant="flat">{event?.visibility}</Chip>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage && (
            <Button as={Link} to={`/events/${id}/edit`} size="sm" variant="flat">
              Edit event
            </Button>
          )}
          {canManage && (
            <EventStatusManager event={event} eventId={id} onStatusChange={() => fetch()} />
          )}
          {canManage && (
            <>
              <Button size="sm" variant="flat" startContent={<Download size={16} />} onPress={onPdfExportOpen}>
                PDF Export
              </Button>
              <PdfExportDialog
                isOpen={isPdfExportOpen}
                onClose={onPdfExportClose}
                event={event}
                teams={teams}
                matches={matches}
                polls={polls}
              />
            </>
          )}
          {canManage && (
            <>
              <Button size="sm" variant="flat" startContent={<Copy size={16} />} onPress={onCloneOpen}>
                Clone Event
              </Button>
              <EventCloneDialog
                isOpen={isCloneOpen}
                onOpenChange={onCloneClose}
                event={event}
                onCloneSuccess={(newEventId) => navigate(`/events/${newEventId}`)}
              />
            </>
          )}
          {canManage && (
            <CsvManager 
              event={event} 
              teams={teams} 
              matches={matches}
              polls={polls}
              onImportTeams={handleImportTeams} 
            />
          )}
          {canManage && (
            <Button size="sm" variant="flat" onPress={onThemeOpen}>
              Customize Theme
            </Button>
          )}
          {canManage && (
            <Button color="danger" variant="flat" size="sm" onPress={() => {
              setDeleteConfirmName('');
              onDeleteOpen();
            }}>
              Delete event
            </Button>
          )}
          <Button size="sm" variant="flat" onPress={() => {
            const url = `${window.location.origin}/events/${id}`;
            navigator.clipboard.writeText(url);
            addToast({ title: 'Event link copied to clipboard', severity: 'success' });
          }}>
            Share event
          </Button>
        </div>
      </div>
      {error && <p className="text-danger text-sm mb-2">{error}</p>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card>
          <CardBody className="text-center">
            <p className="text-xs text-default-500 uppercase tracking-wide">Teams</p>
            <p className="text-xl font-semibold">{teams.length}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <p className="text-xs text-default-500 uppercase tracking-wide">Judges</p>
            <p className="text-xl font-semibold">{judges.length}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <p className="text-xs text-default-500 uppercase tracking-wide">Matches</p>
            <p className="text-xl font-semibold">{matches.length}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <p className="text-xs text-default-500 uppercase tracking-wide">Polls</p>
            <p className="text-xl font-semibold">{polls.length}</p>
          </CardBody>
        </Card>
      </div>

      <Tabs 
        aria-label="Event sections" 
        selectedKey={searchParams.get('tab') || 'details'} 
        onSelectionChange={(key) => setSearchParams({ tab: key })}
      >
        <Tab key="details" title="Details">
          <div className="pt-4 space-y-4">
            <div className="space-y-2">
              <p><span className="text-default-500">Description:</span> {event?.description || '—'}</p>
              <p><span className="text-default-500">Type:</span> {event?.type}</p>
              <p><span className="text-default-500">Visibility:</span> {event?.visibility}</p>
              <p>
                <span className="text-default-500">Registration Status:</span>
                <Chip className="ml-2" color={registrationsOpen ? 'success' : 'default'} variant="flat">
                  {event?.status === 'registration_open' ? 'Open' : 'Closed'}
                </Chip>
              </p>
            </div>
            {canManage && (
              <div className="flex gap-2">
                {!registrationsOpen ? (
                  <Button
                    size="sm"
                    color="primary"
                    onPress={() => updateRegistrationStatus('registration_open')}
                    isLoading={changingRegistrationStatus}
                    isDisabled={changingRegistrationStatus}
                  >
                    Open Registrations
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    color="warning"
                    variant="flat"
                    onPress={() => updateRegistrationStatus('registration_closed')}
                    isLoading={changingRegistrationStatus}
                    isDisabled={changingRegistrationStatus}
                  >
                    Close Registrations
                  </Button>
                )}
              </div>
            )}
          </div>
        </Tab>
        <Tab key="announcements" title="Announcements">
          <div className="pt-4">
            <AnnouncementsFeed eventId={id} currentUserId={user?.id} canManage={canManage} />
          </div>
        </Tab>
        <Tab key="teams" title="Teams">
          <div className="pt-4 space-y-6">
            {registrationsOpen && !canManage && !isTeamRegistered && (
              <Button
                color="primary"
                size="lg"
                onPress={openAddTeam}
                className="w-full"
              >
                Register Your Team
              </Button>
            )}
            {canManage && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Team Metadata Template</h3>
                  <MetadataTemplateBuilder eventId={id} onUpdate={() => fetch()} />
                </div>
                <div className="border-t border-default-200 pt-4">
                  <Button size="sm" color="primary" className="mb-3" onPress={openAddTeam}>
                    Add team
                  </Button>
                </div>
              </div>
            )}
            {!canManage && (
              <Button size="sm" color="primary" className="mb-3" onPress={openAddTeam} isDisabled={!registrationsOpen}>
                {registrationsOpen ? 'Register Team' : 'Registrations Closed'}
              </Button>
            )}
            
            <Input
              startContent={<Search className="text-default-400" size={16} />}
              placeholder="Search teams..."
              value={teamSearch}
              onValueChange={setTeamSearch}
              className="mb-2"
              isClearable
              onClear={() => setTeamSearch('')}
            />

            <div className="space-y-2">
              {filteredTeams.length === 0 ? (
                <p className="text-default-500 text-sm">{teams.length === 0 ? 'No teams yet.' : 'No teams found matching your search.'}</p>
              ) : (
                filteredTeams.map((t) => {
                  const isExpanded = expandedTeams.has(t.id);
                  return (
                    <Card key={t.id} isBlurred>
                      <CardBody className="gap-3">
                        <div className="flex items-center justify-between">
                          <div 
                            className="flex-1 cursor-pointer flex items-center gap-2" 
                            onClick={() => toggleTeamExpansion(t.id)}
                          >
                            <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                              <ChevronDown size={20} className="text-default-500" />
                            </div>
                            <div>
                              <p className="font-semibold text-lg">{t.name}</p>
                              {t.description && (
                                <p className="text-sm text-default-500 mt-1">{t.description}</p>
                              )}
                            </div>
                          </div>
                          {canManage && (
                            <div className="flex gap-2">
                              <Button size="sm" variant="light" onPress={() => openEditTeam(t)}>
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                color="danger"
                                variant="light"
                                onPress={() => removeTeam(t.id)}
                              >
                                Remove
                              </Button>
                            </div>
                          )}
                        </div>
                        {isExpanded && (
                          <div className="pt-2 mt-2 border-t border-default-100">
                            <TeamMetadataDisplay eventId={id} teamMetadata={t.metadata_values || {}} />
                          </div>
                        )}
                      </CardBody>
                    </Card>
                  );
                })
              )}
            </div>
          </div>
        </Tab>
        {hasType('bracket') && (
        <Tab key="bracket" title="Bracket">
          <div className="pt-4">
            {canManage && (
              <div className="flex flex-wrap items-end gap-3 mb-4">
                <Select
                  label="Bracket Type"
                  selectedKeys={[bracketType]}
                  onSelectionChange={(keys) => setBracketType([...keys][0] || 'single_elim')}
                  className="max-w-xs"
                >
                  <SelectItem key="single_elim">Single Elimination</SelectItem>
                  <SelectItem key="round_robin">Round Robin</SelectItem>
                  <SelectItem key="swiss">Swiss System</SelectItem>
                </Select>
                {matches.length === 0 ? (
                  <Button
                    color="primary"
                    isLoading={generatingBracket}
                    onPress={handleGenerateBracket}
                  >
                    Generate Bracket
                  </Button>
                ) : (
                  <Button
                    color="warning"
                    variant="flat"
                    isLoading={regeneratingBracket}
                    onPress={handleRegenerateBracket}
                  >
                    Regenerate Bracket
                  </Button>
                )}
              </div>
            )}
            {matches.length === 0 ? (
              <p className="text-default-500 text-sm">No bracket generated yet.</p>
            ) : (
              <BracketView
                matches={matches}
                teams={teams}
                bracketType={matches[0]?.bracket_type || 'single_elim'}
                canEdit={canJudge}
                onEditMatch={handleEditMatch}
              />
            )}
          </div>
        </Tab>
        )}

        {hasType('points') && (
        <Tab key="leaderboard" title="Leaderboard">
          <div className="pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <HeroLink showAnchorIcon href={`/events/${id}/leaderboard`} isExternal={true}>
                Big-screen view
              </HeroLink>
              {canJudge && (
                <Button size="sm" variant="flat" onPress={handleUndo}>
                  Undo last
                </Button>
              )}
            </div>
            <Leaderboard teams={teams} canJudge={canJudge} onScoreChange={handleScoreChange} />
          </div>
        </Tab>
        )}
        {showJudges && (
        <Tab key="judges" title="Judges">
          <div className="pt-4">
            {canManage && (
              <Button size="sm" color="primary" className="mb-3" onPress={openAddJudge}>
                Add judge
              </Button>
            )}
            <Table aria-label="Judges">
              <TableHeader>{judgeColumns}</TableHeader>
              <TableBody>{judgeRows}</TableBody>
            </Table>
          </div>
        </Tab>
        )}
        {hasType('poll') && (
        <Tab key="polls" title="Polls">
          <div className="pt-4">
            <div className="flex flex-col md:flex-row gap-3 justify-between items-start mb-4">
              <Input
                startContent={<Search className="text-default-400" size={16} />}
                placeholder="Search polls..."
                value={pollSearch}
                onValueChange={setPollSearch}
                className="max-w-xs"
                isClearable
                onClear={() => setPollSearch('')}
              />
              {canManage && (
                <Button size="sm" color="primary" onPress={() => {
                  setSelectedPoll(null);
                  onPollEditorOpen();
                }}>
                  Create poll
                </Button>
              )}
            </div>
            
            {polls.length === 0 ? (
              <p className="text-default-500 text-sm">No polls yet.</p>
            ) : (
              <div className="space-y-3">
                {polls
                  .filter(p => !pollSearch || p.question.toLowerCase().includes(pollSearch.toLowerCase()))
                  .map((poll) => (
                  <div key={poll.id} className="border border-default-200 rounded-lg p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{poll.question}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Chip size="sm" variant="flat" color={poll.status === 'open' ? 'success' : poll.status === 'closed' ? 'default' : 'warning'}>
                            {poll.status}
                          </Chip>
                          <span className="text-xs text-default-400">
                             {new Date(poll.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      {canManage && (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="xs"
                            variant="light"
                            onPress={() => {
                              setSelectedPoll(poll);
                              onPollEditorOpen();
                            }}
                          >
                            Edit
                          </Button>
                          {poll.status === 'draft' && (
                            <Button
                              size="xs"
                              color="primary"
                              onPress={async () => {
                                await supabase.from('polls').update({ status: 'open' }).eq('id', poll.id);
                                await supabase.from('event_audit').insert({
                                  event_id: id,
                                  action: 'poll.open',
                                  entity_type: 'poll',
                                  entity_id: poll.id,
                                  message: `Opened poll "${poll.question}"`,
                                  created_by: user?.id,
                                });
                                fetch();
                              }}
                            >
                              Open
                            </Button>
                          )}
                          {poll.status === 'open' && (
                            <Button
                              size="xs"
                              variant="flat"
                              onPress={async () => {
                                await supabase.from('polls').update({ status: 'closed' }).eq('id', poll.id);
                                await supabase.from('event_audit').insert({
                                  event_id: id,
                                  action: 'poll.close',
                                  entity_type: 'poll',
                                  entity_id: poll.id,
                                  message: `Closed poll "${poll.question}"`,
                                  created_by: user?.id,
                                });
                                fetch();
                              }}
                            >
                              Close
                            </Button>
                          )}
                          {poll.status === 'closed' && (
                            <Button
                              size="xs"
                              variant="flat"
                              onPress={async () => {
                                await supabase.from('polls').update({ status: 'open' }).eq('id', poll.id);
                                await supabase.from('event_audit').insert({
                                  event_id: id,
                                  action: 'poll.reopen',
                                  entity_type: 'poll',
                                  entity_id: poll.id,
                                  message: `Reopened poll "${poll.question}"`,
                                  created_by: user?.id,
                                });
                                fetch();
                              }}
                            >
                              Reopen
                            </Button>
                          )}
                          {poll.status === 'closed' && (
                            <Button
                              size="xs"
                              color="success"
                              onPress={async () => {
                                const { error } = await supabase.rpc('award_poll_points', { poll_id: poll.id });
                                if (error) {
                                  addToast({ title: 'Award failed', description: error.message, severity: 'danger' });
                                } else {
                                  await supabase.from('event_audit').insert({
                                    event_id: id,
                                    action: 'poll.award',
                                    entity_type: 'poll',
                                    entity_id: poll.id,
                                    message: `Awarded points for poll "${poll.question}"`,
                                    created_by: user?.id,
                                  });
                                  fetch();
                                  addToast({ title: 'Points awarded', severity: 'success' });
                                }
                              }}
                            >
                              Award points
                            </Button>
                          )}
                          <Button
                            size="xs"
                            color="danger"
                            variant="light"
                            onPress={() => handleDeletePoll(poll.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      )}
                    </div>
                    {poll.status === 'open' && (
                      <PollVote poll={poll} options={pollOptions[poll.id] || []} showQuestion={false} />
                    )}
                    <PollResultsLive
                      pollId={poll.id}
                      options={pollOptions[poll.id] || []}
                      isLive={poll.status === 'open'}
                      pollType={poll.poll_type}
                      resultsHidden={poll.results_hidden}
                      canManage={canManage}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </Tab>
        )}



        {showTimeline && (
        <Tab key="timeline" title="Timeline">
          <div className="pt-4">
            <TimelineView eventId={id} rounds={rounds} matches={matches} scoreHistory={scoreHistory} />
          </div>
        </Tab>
        )}

        {showAnalytics && (
        <Tab key="analytics" title="Analytics">
          <div className="pt-4">
            <EventAnalytics eventId={id} matches={matches} polls={polls} scoreHistory={scoreHistory} />
          </div>
        </Tab>
        )}

        {canManage && (<Tab key="audit" title="Audit log">
          <div className="pt-4">
            <div className="flex justify-end mb-2">
              <Button 
                size="sm" 
                variant="flat" 
                onPress={() => fetch()} 
                startContent={<RefreshCw size={16} />}
              >
                Refresh Log
              </Button>
            </div>
            <AuditLog items={auditItems} currentUserId={user?.id} />
          </div>
        </Tab>)}
      </Tabs>

      <Modal isOpen={isTeamOpen} onClose={onTeamClose}>
        <ModalContent>
          <ModalHeader>{editingTeam ? 'Edit team' : 'Add team'}</ModalHeader>
          <ModalBody className="space-y-4">
            <Input
              label="Name"
              value={teamName}
              onValueChange={setTeamName}
              placeholder="Team name"
            />
            <MetadataFieldsForm
              eventId={id}
              teamMetadata={teamMetadata}
              onMetadataChange={setTeamMetadata}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onTeamClose}>Cancel</Button>
            <Button color="primary" onPress={saveTeam} isLoading={teamSaving}>Save</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={isJudgeOpen} onClose={onJudgeClose} size="md">
        <ModalContent>
          <ModalHeader>Add judge</ModalHeader>
          <ModalBody className="space-y-3">
            <Input
              label="Search by name or ID"
              placeholder="Type name or user ID..."
              value={judgeQuery}
              onValueChange={searchJudges}
            />
            <p className="text-default-500 text-sm">Search by name or user ID</p>
            
            {judgeSearchResults.length > 0 && (
              <div className="border border-default-200 rounded-lg max-h-48 overflow-y-auto">
                {judgeSearchResults.map((result) => (
                  <div
                    key={result.id}
                    className="p-2 border-b border-default-100 last:border-b-0 cursor-pointer hover:bg-default-100"
                    onClick={() => saveJudge(result.id)}
                  >
                    <p className="text-sm font-semibold">{result.display_name || '(No name)'}</p>
                    <p className="text-xs text-default-500 break-all">{result.id}</p>
                  </div>
                ))}
              </div>
            )}
            
            {judgeQuery && judgeSearchResults.length === 0 && (
              <p className="text-sm text-default-500">No results found</p>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onJudgeClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <MatchEditor
        isOpen={isMatchOpen}
        onClose={onMatchClose}
        match={selectedMatch}
        teams={teams}
        onUpdate={() => fetch()}
        onAudit={async (match, update) => {
          const teamA = teams.find((t) => t.id === match.team_a_id)?.name || 'Team A';
          const teamB = teams.find((t) => t.id === match.team_b_id)?.name || 'Team B';
          const winnerName = teams.find((t) => t.id === update.winner_id)?.name || 'TBD';
          await supabase.from('event_audit').insert({
            event_id: id,
            action: 'match.update',
            entity_type: 'match',
            entity_id: match.id,
            message: `${teamA} ${update.team_a_score} - ${update.team_b_score} ${teamB} (winner: ${winnerName})`,
            created_by: user?.id,
            metadata: { status: update.status },
          });
        }}
      />

      <PollEditor
        isOpen={isPollEditorOpen}
        onClose={onPollEditorClose}
        poll={selectedPoll}
        eventId={id}
        teams={teams}
        onUpdate={() => fetch()}
        currentUserId={user?.id}
      />

      <Modal isOpen={isDeleteOpen} onClose={onDeleteClose} size="md">
        <ModalContent>
          <ModalHeader>Delete event</ModalHeader>
          <ModalBody className="space-y-2">
            <p className="text-sm text-default-500">
              This will permanently delete the event, its teams, matches, and polls.
            </p>
            <p className="text-sm">
              Type <span className="font-semibold">"{event?.name}"</span> to confirm.
            </p>
            <Input
              label="Event name"
              placeholder={event?.name || ''}
              value={deleteConfirmName}
              onValueChange={setDeleteConfirmName}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onDeleteClose}>Cancel</Button>
            <Button
              color="danger"
              isLoading={deletingEvent}
              isDisabled={deleteConfirmName !== event?.name}
              onPress={handleDeleteEvent}
            >
              Delete
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Event Theme Customization Modal */}
      <Modal isOpen={isThemeOpen} onClose={onThemeClose} size="lg">
        <ModalContent>
          <ModalHeader>
            Customize Event Theme
            {hasEventTheme && <span className="text-sm text-default-500 ml-2">(Visible to all viewers)</span>}
          </ModalHeader>
          <ModalBody>
            <p className="text-sm text-default-500 mb-4">
              Set custom colors for this event. These colors will be visible to all viewers when they visit this event.
            </p>
            <ThemeBuilder // add save functionality
              initialColors={eventTheme?.colors_json}
              onOpenChange={() => {}}
              onSave={(colors) => {
                console.log('Saving event theme colors:', colors);
                updateEventTheme(colors);
                addToast({ title: 'Event theme saved', severity: 'success' });
                onThemeClose();
              }}
            />
          </ModalBody>
        </ModalContent>
      </Modal>
    </div>
  );
}

function PollResultsLive({ pollId, options, isLive, pollType, resultsHidden, canManage }) {
  const votes = useLiveVotes(pollId);
  return (
    <PollResults 
      options={options} 
      votes={votes} 
      isLive={isLive} 
      pollType={pollType} 
      resultsHidden={resultsHidden}
      canManage={canManage}
    />
  );
}
