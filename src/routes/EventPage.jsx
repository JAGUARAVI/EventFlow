import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  useParams,
  Link,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {
  Tabs,
  Spinner,
  Tab,
  Button,
  Input,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  addToast,
  Avatar,
  Select,
  SelectItem,
  Card,
  CardBody,
  Chip,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Spacer,
  Tooltip,
  AvatarGroup,
  Divider,
} from "@heroui/react";
import { Link as HeroLink } from "@heroui/link";
import {
  Download,
  Copy,
  Trash2,
  Settings,
  Share2,
  MoreVertical,
  Search,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Calendar,
  Clock,
  Users,
  Trophy,
  BarChart2,
  Hash,
  Gavel,
  Plus,
  ExternalLink,
  Palette,
  Edit3,
  Shield,
  Info,
  Activity,
  Eye,
  Mail,
  QrCode,
  Edit,
  ClipboardList,
} from "lucide-react";
import { supabase, withRetry } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { useRealtimeLeaderboard } from "../hooks/useRealtimeLeaderboard";
import { useRealtimeBracket } from "../hooks/useRealtimeBracket";

import Leaderboard from "../components/Leaderboard";
import AuditLog from "../components/AuditLog";
import BracketView from "../components/BracketView";
import MatchEditor from "../components/MatchEditor";
import MatchTeamsEditor from "../components/MatchTeamsEditor";
import NewRoundModal from "../components/NewRoundModal";
import PollEditor from "../components/PollEditor";
import PollVote from "../components/PollVote";
import PollResults from "../components/PollResults";
import PollVoteManager from "../components/PollVoteManager";
import TimelineView from "../components/TimelineView";
import CsvManager from "../components/CsvManager";
import EventCloneDialog from "../components/EventCloneDialog";
import { exportPollsAnalysisToCSV } from "../lib/csvUtils";
import AnnouncementsFeed from "../components/AnnouncementsFeed";
import ThemeBuilder from "../components/ThemeBuilder";
import EventStatusManager from "../components/EventStatusManager";
import EventAnalytics from "../components/EventAnalytics";
import MetadataTemplateBuilder from "../components/MetadataTemplateBuilder";
import MetadataFieldsForm from "../components/MetadataFieldsForm";
import TeamMetadataDisplay from "../components/TeamMetadataDisplay";
import PdfExportDialog from "../components/PdfExportDialog";
import EvalScheduler from "../components/EvalScheduler";
import {
  generateSingleElimination,
  generateRoundRobin,
  generateSwiss,
  shuffleTeams,
} from "../lib/bracket";
import { useEventVotes } from "../hooks/useEventVotes";
import { useRealtimePolls } from "../hooks/useRealtimePolls";
import { sendPushNotification } from "../lib/notifications";
import { useTheme } from "../context/ThemeContext";
import confetti from "canvas-confetti";


export default function EventPage() {
  const { id } = useParams();
  const { isDark, setThemePreset } = useTheme();
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
  const [error, setError] = useState("");
  const [bracketType, setBracketType] = useState("single_elim");
  const [generatingBracket, setGeneratingBracket] = useState(false);
  const [regeneratingBracket, setRegeneratingBracket] = useState(false);
  const [fixingBracket, setFixingBracket] = useState(false);
  
  // Track pending score changes per team to handle rapid updates correctly
  // Maps teamId -> { pendingDelta: number, lastKnownScore: number }
  const pendingScoreChangesRef = useRef(new Map());
  
  // Ref to track latest teams state for score changes (avoids stale closure issues)
  const teamsRef = useRef(teams);
  useEffect(() => {
    teamsRef.current = teams;
  }, [teams]);

  useEffect(() => {
    const eventTheme = event?.settings?.theme;
    if (eventTheme) {
      const BACKUP_KEY = "eventflow-last-user-theme";
      const currentStored =
        localStorage.getItem("eventflow-theme-preset") || "modern";

      if (!localStorage.getItem(BACKUP_KEY)) {
        if (currentStored !== eventTheme) {
          localStorage.setItem(BACKUP_KEY, currentStored);
        }
      }

      setThemePreset(eventTheme);

      return () => {
        const backup = localStorage.getItem(BACKUP_KEY);
        if (backup) {
          setThemePreset(backup);
          localStorage.removeItem(BACKUP_KEY);
        }
      };
    }
  }, [event?.settings?.theme, setThemePreset]);

  const {
    isOpen: isMatchOpen,
    onOpen: onMatchOpen,
    onClose: onMatchClose,
  } = useDisclosure();
  const [selectedMatch, setSelectedMatch] = useState(null);
  
  // Match teams editor modal (for changing teams or creating new match)
  const {
    isOpen: isMatchTeamsOpen,
    onOpen: onMatchTeamsOpen,
    onClose: onMatchTeamsClose,
  } = useDisclosure();
  const [matchTeamsTarget, setMatchTeamsTarget] = useState(null); // match to edit or null for new
  const [newMatchRound, setNewMatchRound] = useState(0);
  
  // Bracket team selection modal
  const {
    isOpen: isBracketTeamSelectOpen,
    onOpen: onBracketTeamSelectOpen,
    onClose: onBracketTeamSelectClose,
  } = useDisclosure();
  const [selectedBracketTeams, setSelectedBracketTeams] = useState(new Set());
  const [bracketGenerateMode, setBracketGenerateMode] = useState('generate'); // 'generate' or 'regenerate'

  // New round modal (for creating playoffs or new tournament phase)
  const {
    isOpen: isNewRoundOpen,
    onOpen: onNewRoundOpen,
    onClose: onNewRoundClose,
  } = useDisclosure();

  const [polls, setPolls] = useState([]);
  const [pollOptions, setPollOptions] = useState({});
  const {
    isOpen: isPollEditorOpen,
    onOpen: onPollEditorOpen,
    onClose: onPollEditorClose,
  } = useDisclosure();
  const [selectedPoll, setSelectedPoll] = useState(null);
  const [selectedPollForVote, setSelectedPollForVote] = useState(null);
  const [pollSearch, setPollSearch] = useState("");

  const {
    isOpen: isTeamOpen,
    onOpen: onTeamOpen,
    onClose: onTeamClose,
  } = useDisclosure();
  const [teamName, setTeamName] = useState("");
  const [teamMetadata, setTeamMetadata] = useState({});
  const [isMetadataValid, setIsMetadataValid] = useState(true);
  const [teamSaving, setTeamSaving] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [changingRegistrationStatus, setChangingRegistrationStatus] =
    useState(false);
  const [teamSearch, setTeamSearch] = useState("");
  const [expandedTeams, setExpandedTeams] = useState(new Set());

  const {
    isOpen: isJudgeOpen,
    onOpen: onJudgeOpen,
    onClose: onJudgeClose,
  } = useDisclosure();
  const [judgeQuery, setJudgeQuery] = useState("");
  const [judgeSaving, setJudgeSaving] = useState(false);
  const [judgeSearchResults, setJudgeSearchResults] = useState([]);

  const {
    isOpen: isDeleteOpen,
    onOpen: onDeleteOpen,
    onClose: onDeleteClose,
  } = useDisclosure();
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deletingEvent, setDeletingEvent] = useState(false);

  // New Phase 6/7 modals
  const {
    isOpen: isCloneOpen,
    onOpen: onCloneOpen,
    onClose: onCloneClose,
  } = useDisclosure();
  const {
    isOpen: isPdfExportOpen,
    onOpen: onPdfExportOpen,
    onClose: onPdfExportClose,
  } = useDisclosure();
  const {
    isOpen: isThemeOpen,
    onOpen: onThemeOpen,
    onClose: onThemeClose,
  } = useDisclosure();
  const {
    isOpen: isMetadataOpen,
    onOpen: onMetadataOpen,
    onClose: onMetadataClose,
  } = useDisclosure();
  const {
    isOpen: isPocOpen,
    onOpen: onPocOpen,
    onClose: onPocClose,
  } = useDisclosure();
  const {
    isOpen: isQrOpen,
    onOpen: onQrOpen,
    onClose: onQrClose,
  } = useDisclosure();
  const {
    isOpen: isVoteManagerOpen,
    onOpen: onVoteManagerOpen,
    onClose: onVoteManagerClose,
  } = useDisclosure();
  const [selectedPoc, setSelectedPoc] = useState(null);
  const [pocLoading, setPocLoading] = useState(false);
  const [managingPoll, setManagingPoll] = useState(null);

  const role = profile?.role || "";
  const isAdmin = role === "admin";
  const eventTypes =
    Array.isArray(event?.event_types) && event.event_types.length > 0
      ? event.event_types
      : event?.type === "hybrid"
        ? ["points", "bracket", "poll"]
        : event?.type
          ? [event.type]
          : ["points"];
  const hasType = (t) => eventTypes.includes(t);
  const isCoManager = judges.some((j) => j.user_id === user?.id && j.can_manage);
  const canManage =
    event && (isAdmin || (event.created_by === user?.id && role !== "viewer") || isCoManager);
  const isCompleted = event?.status === "completed";
  const canJudge =
    event && (canManage || judges.some((j) => j.user_id === user?.id));
  const registrationsOpen = event?.status === "registration_open";
  const isTeamRegistered = teams.some((t) => t.created_by === user?.id);
  const settings = event?.settings || {};
  const showAnalytics = canManage || !settings.hide_analytics;
  const showTimeline = canManage || !settings.hide_timeline;
  const showJudges = canManage || !settings.hide_judges;
  const showTeams = canManage || !settings.hide_teams;

  // Tab ordering from settings
  const defaultTabOrder = ['details', 'announcements', 'teams', 'bracket', 'leaderboard', 'judges', 'polls', 'evals', 'timeline', 'analytics', 'audit'];
  const tabOrder = settings.tab_order && Array.isArray(settings.tab_order) ? settings.tab_order : defaultTabOrder;
  
  // Helper to get sort index for a tab key
  const getTabSortIndex = useCallback((key) => {
    const idx = tabOrder.indexOf(key);
    return idx === -1 ? 999 : idx;
  }, [tabOrder]);

  // Get first visible tab based on order and visibility
  const firstVisibleTab = useMemo(() => {
    const tabVisibility = {
      details: true,
      announcements: true,
      teams: showTeams,
      bracket: hasType("bracket"),
      leaderboard: hasType("points"),
      judges: showJudges,
      polls: hasType("poll"),
      evals: hasType("evals"),
      timeline: showTimeline,
      analytics: showAnalytics,
      audit: canManage,
    };
    const sorted = [...tabOrder].filter(key => tabVisibility[key]);
    return sorted[0] || 'details';
  }, [tabOrder, showTeams, showJudges, showTimeline, showAnalytics, canManage, hasType]);

  const myTeamIds = useMemo(() => {
    if (!user?.id) return new Set();
    return new Set(teams.filter((t) => t.created_by === user.id).map((t) => t.id));
  }, [teams, user?.id]);

  const canEditTeam = useCallback((team) => {
    if (canManage) return true;
    if (!user || !event) return false;
    const isMyTeam = team.created_by === user.id;
    const isLive = ["live", "completed", "archived"].includes(event.status);
    return isMyTeam && !isLive;
  }, [canManage, user, event]);

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
    const matchesDesc =
      t.description && t.description.toLowerCase().includes(search);
    const matchesMetadata =
      t.metadata_values &&
      Object.values(t.metadata_values).some((val) => {
        if (Array.isArray(val)) {
          return val.some((item) =>
            String(item).toLowerCase().includes(search),
          );
        }
        return String(val).toLowerCase().includes(search);
      });
    return matchesName || matchesDesc || matchesMetadata;
  });

  const fetch = useCallback(
    async (showLoading = false) => {
      if (!id) return;
      if (showLoading) setLoading(true);
      try {
        const [eRes, tRes, jRes, aRes, mRes, pRes, auditRes, rRes] =
          await Promise.all([
            supabase.from("events").select("*").eq("id", id).single(),
            supabase
              .from("teams")
              .select("*")
              .eq("event_id", id)
              .order("created_at"),
            supabase
              .from("event_judges")
              .select("user_id, created_at, can_manage")
              .eq("event_id", id),
            supabase
              .from("score_history")
              .select("*, teams(name)")
              .eq("event_id", id)
              .order("created_at", { ascending: true }),
            supabase
              .from("matches")
              .select("*")
              .eq("event_id", id)
              .order("round", { ascending: false })
              .order("position"),
            supabase
              .from("polls")
              .select("*")
              .eq("event_id", id)
              .order("created_at", { ascending: false }),
            supabase
              .from("event_audit")
              .select("*")
              .eq("event_id", id)
              .order("created_at", { ascending: false })
              .limit(100),
            supabase
              .from("rounds")
              .select("*")
              .eq("event_id", id)
              .order("number"),
          ]);

        // for each judge fetch their public.profile info
        if (jRes.data) {
          const judgeDetails = await Promise.all(
            jRes.data.map(async (j) => {
              const { data: profileData } = await supabase
                .from("profiles")
                .select("display_name, avatar_url, email")
                .eq("id", j.user_id)
                .single();
              return {
                user_id: j.user_id,
                created_at: j.created_at,
                can_manage: j.can_manage || false,
                display_name: profileData?.display_name || null,
                avatar_url: profileData?.avatar_url || null,
                email: profileData?.email || null,
              };
            }),
          );
          jRes.data = judgeDetails;
        }

        if (eRes.error) {
          setError("Event not found");
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
        const rawScoreHistory = aRes.data || [];
        const undoneIds = new Set();
        rawScoreHistory.forEach((item) => {
          if (item.undo_id) undoneIds.add(item.undo_id);
        });

        const scoreItems = rawScoreHistory.map((x) => ({
          ...x,
          kind: "score",
          undo_id: undoneIds.has(x.id) ? "undone" : null,
        }));
        const auditItems = (auditRes.data || []).map((x) => ({
          ...x,
          kind: "event",
        }));

        const userIds = new Set();
        [...scoreItems, ...auditItems].forEach((item) => {
          const uid = item.changed_by || item.created_by;
          if (uid) userIds.add(uid);
        });

        let profileMap = {};
        if (userIds.size > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, display_name, email")
            .in("id", Array.from(userIds));

          if (profiles) {
            profiles.forEach((p) => {
              profileMap[p.id] = p.display_name || p.email;
            });
          }
        }

        const mergedAudit = [...scoreItems, ...auditItems]
          .map((item) => {
            return {
              ...item,
              created_by: item.created_by
                ? profileMap[item.created_by] || item.created_by
                : null,
              changed_by: item.changed_by
                ? profileMap[item.changed_by] || item.changed_by
                : null,
            };
          })
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 200);
        setAuditItems(mergedAudit);
        setMatches(mRes.data || []);
        setPolls(pRes.data || []);
        if (mRes.data && mRes.data.length > 0) {
          setBracketType(mRes.data[0].bracket_type || "single_elim");
        }

        // Fetch options for each poll
        if (pRes.data && pRes.data.length > 0) {
          const optionsMap = {};
          for (const poll of pRes.data) {
            const { data: opts } = await supabase
              .from("poll_options")
              .select("*")
              .eq("poll_id", poll.id)
              .order("display_order");
            optionsMap[poll.id] = opts || [];
          }
          setPollOptions(optionsMap);
        } else {
          setPollOptions({});
        }

        setError("");
      } catch (err) {
        console.error("Error fetching event data:", err);
        setError("Failed to load event data");
      } finally {
        setLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    fetch(true);
  }, [fetch]);

  // RealtimeContext now handles connection health and reconnection automatically

  useRealtimeLeaderboard(id, setTeams, { currentUserId: user?.id });

  const onMatchComplete = useCallback((completedMatch) => {
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#0070f3", "#7c3aed", "#ec4899", "#ffffff"],
    });
  }, []);

  useRealtimeBracket(id, setMatches, onMatchComplete, fetch, {
    currentUserId: user?.id,
    myTeamIds,
  });
  useRealtimePolls(id, setPolls, setPollOptions, { currentUserId: user?.id });
  
  // Single centralized hook for all poll votes - prevents channel exhaustion
  const pollIds = useMemo(() => polls.map(p => p.id).filter(Boolean), [polls]);
  const { getVotesForPoll } = useEventVotes(id, pollIds);

  const buildBracketMatches = (type, selectedTeamIds = null) => {
    // Use selected teams if provided, otherwise use all teams
    const teamsToUse = selectedTeamIds && selectedTeamIds.size > 0
      ? teams.filter(t => selectedTeamIds.has(t.id))
      : teams;
    const shuffledTeams = shuffleTeams(teamsToUse);
    if (type === "single_elim") return generateSingleElimination(id, shuffledTeams);
    if (type === "round_robin") return generateRoundRobin(id, shuffledTeams);
    if (type === "swiss") return generateSwiss(id, shuffledTeams);
    return [];
  };

  const notifyBracketInclusion = (generatedMatches) => {
    if (!user?.id || myTeamIds.size === 0) return;
    const includesMyTeam = generatedMatches.some(
      (m) => myTeamIds.has(m.team_a_id) || myTeamIds.has(m.team_b_id),
    );
    if (includesMyTeam) {
      sendPushNotification({
        title: "Bracket Generated",
        body: "Your team is in the newly generated bracket.",
        tag: `bracket-${id}`,
        data: { eventId: id },
      });
    }
  };

  // Open team selection modal for generating bracket
  const handleOpenBracketTeamSelect = (mode = 'generate') => {
    if (!teams || teams.length === 0) {
      addToast({
        title: "No teams",
        description: "Add teams first",
        severity: "warning",
      });
      return;
    }
    if (mode === 'regenerate' && !confirm("Regenerate bracket? This will delete all existing matches.")) {
      return;
    }
    setBracketGenerateMode(mode);
    setSelectedBracketTeams(new Set(teams.map(t => t.id))); // Select all by default
    onBracketTeamSelectOpen();
  };

  const handleGenerateBracket = async () => {
    handleOpenBracketTeamSelect('generate');
  };

  const handleRegenerateBracket = async () => {
    handleOpenBracketTeamSelect('regenerate');
  };

  // Actual bracket generation after team selection
  const handleConfirmBracketGeneration = async () => {
    if (selectedBracketTeams.size < 2) {
      addToast({
        title: "Not enough teams",
        description: "Select at least 2 teams to generate a bracket",
        severity: "warning",
      });
      return;
    }

    onBracketTeamSelectClose();

    if (bracketGenerateMode === 'regenerate') {
      setRegeneratingBracket(true);
      const { error: delErr } = await supabase
        .from("matches")
        .delete()
        .eq("event_id", id);
      if (delErr) {
        setRegeneratingBracket(false);
        addToast({
          title: "Regenerate failed",
          description: delErr.message,
          severity: "danger",
        });
        return;
      }
    } else {
      setGeneratingBracket(true);
    }

    const generated = buildBracketMatches(bracketType, selectedBracketTeams);
    const { error: e } = await supabase.from("matches").insert(generated);
    
    if (bracketGenerateMode === 'regenerate') {
      setRegeneratingBracket(false);
    } else {
      setGeneratingBracket(false);
    }

    if (e) {
      addToast({
        title: "Generation failed",
        description: e.message,
        severity: "danger",
      });
      return;
    }

    notifyBracketInclusion(generated);
    await supabase.from("event_audit").insert({
      event_id: id,
      action: bracketGenerateMode === 'regenerate' ? "bracket.regenerate" : "bracket.generate",
      entity_type: "bracket",
      message: `${bracketGenerateMode === 'regenerate' ? 'Regenerated' : 'Generated'} ${bracketType.replace("_", " ")} bracket with ${selectedBracketTeams.size} teams`,
      created_by: user?.id,
      metadata: { bracket_type: bracketType, team_count: selectedBracketTeams.size },
    });
    await finalizeSingleElimBracket();

    if (bracketGenerateMode === 'regenerate') {
      // Broadcast reload to force sync clients - use existing channel pattern
      const channel = supabase.channel(`bracket:${id}`);
      await channel.subscribe();
      await channel.send({ type: "broadcast", event: "reload", payload: {} });
      await supabase.removeChannel(channel);
    }

    fetch();
    addToast({ title: `Bracket ${bracketGenerateMode === 'regenerate' ? 'regenerated' : 'generated'}`, severity: "success" });
  };

  // Swiss bracket: Generate next round after current round is completed
  const handleGenerateNextSwissRound = async () => {
    if (!teams || teams.length === 0) {
      addToast({
        title: "No teams",
        description: "Add teams first",
        severity: "warning",
      });
      return;
    }

    // Determine current round number (highest round in matches)
    const currentRound = Math.max(...matches.map((m) => m.round), -1);
    
    // Check if all matches in current round are completed
    const currentRoundMatches = matches.filter((m) => m.round === currentRound);
    const allCompleted = currentRoundMatches.every((m) => m.status === "completed");
    
    if (!allCompleted) {
      addToast({
        title: "Round not complete",
        description: "Complete all matches in the current round first",
        severity: "warning",
      });
      return;
    }

    setGeneratingBracket(true);
    
    // Generate next round with all existing matches for record calculation
    const nextRound = currentRound + 1;
    const generated = generateSwiss(id, teams, nextRound, matches);
    
    if (generated.length === 0) {
      setGeneratingBracket(false);
      addToast({
        title: "Cannot generate round",
        description: "Not enough teams to pair for the next round",
        severity: "warning",
      });
      return;
    }
    
    const { error: e } = await supabase.from("matches").insert(generated);
    setGeneratingBracket(false);
    
    if (e) {
      addToast({
        title: "Generation failed",
        description: e.message,
        severity: "danger",
      });
      return;
    }
    
    notifyBracketInclusion(generated);
    await supabase.from("event_audit").insert({
      event_id: id,
      action: "bracket.swiss_round",
      entity_type: "bracket",
      message: `Generated Swiss round ${nextRound + 1}`,
      created_by: user?.id,
      metadata: { bracket_type: "swiss", round: nextRound },
    });
    
    fetch();
    addToast({ title: `Swiss round ${nextRound + 1} generated`, severity: "success" });
  };

  const handleEditMatch = (match) => {
    setSelectedMatch(match);
    onMatchOpen();
  };

  // Handler for adding a new match to a round
  const handleAddMatch = (roundNum) => {
    setMatchTeamsTarget(null);
    setNewMatchRound(roundNum);
    onMatchTeamsOpen();
  };

  // Handler for editing teams in a match
  const handleEditTeams = (match) => {
    setMatchTeamsTarget(match);
    setNewMatchRound(match.round);
    onMatchTeamsOpen();
  };

  // Handler for deleting a match
  const handleDeleteMatch = async (match) => {
    if (!confirm("Delete this match? This action cannot be undone.")) return;
    
    const teamA = teams.find((t) => t.id === match.team_a_id)?.name || "Team A";
    const teamB = teams.find((t) => t.id === match.team_b_id)?.name || "Team B";
    
    const { error } = await supabase.from("matches").delete().eq("id", match.id);
    if (error) {
      addToast({
        title: "Delete failed",
        description: error.message,
        severity: "danger",
      });
      return;
    }
    
    await supabase.from("event_audit").insert({
      event_id: id,
      action: "match.delete",
      entity_type: "match",
      entity_id: match.id,
      message: `Deleted match: ${teamA} vs ${teamB} (Round ${match.round})`,
      created_by: user?.id,
    });
    
    fetch();
    addToast({ title: "Match deleted", severity: "success" });
  };

  const handleDeletePoll = async (pollId) => {
    if (!confirm("Delete this poll? This will remove all its votes.")) return;
    const target = polls.find((p) => p.id === pollId);
    const { error: e } = await supabase.from("polls").delete().eq("id", pollId);
    if (e) {
      addToast({
        title: "Delete failed",
        description: e.message,
        severity: "danger",
      });
      return;
    }
    await supabase.from("event_audit").insert({
      event_id: id,
      action: "poll.delete",
      entity_type: "poll",
      entity_id: pollId,
      message: target ? `Deleted poll "${target.question}"` : "Deleted poll",
      created_by: user?.id,
    });
    fetch();
    addToast({ title: "Poll deleted", severity: "success" });
  };

  const handleDownloadPollCSV = async (poll) => {
    try {
      const { data: votesData, error } = await supabase
        .from("votes")
        .select("*")
        .eq("poll_id", poll.id);
      if (error) {
        addToast({ title: "Download failed", description: error.message, severity: "danger" });
        return;
      }

      // attach options from pollOptions map if not present on poll
      const pollWithOptions = { ...poll, options: poll.options || pollOptions[poll.id] || [] };
      const csv = exportPollsAnalysisToCSV([pollWithOptions], votesData || []);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `poll-${poll.id}-analysis.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      addToast({ title: "CSV downloaded", severity: "success" });
    } catch (err) {
      console.error(err);
      addToast({ title: "Download failed", description: String(err), severity: "danger" });
    }
  };

  const handleDownloadAllPollsCSV = async () => {
    try {
      if (!polls || polls.length === 0) {
        addToast({ title: "No polls", description: "There are no polls to export", severity: "warning" });
        return;
      }

      const pollIds = polls.map((p) => p.id).filter(Boolean);
      const { data: votesData, error } = await supabase
        .from("votes")
        .select("*")
        .in("poll_id", pollIds);
      if (error) {
        addToast({ title: "Download failed", description: error.message, severity: "danger" });
        return;
      }

      // Ensure each poll has options attached
      const pollsWithOptions = polls.map((p) => ({ ...p, options: p.options || pollOptions[p.id] || [] }));
      const csv = exportPollsAnalysisToCSV(pollsWithOptions, votesData || []);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `event-${id}-polls-analysis.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      addToast({ title: "CSV downloaded", severity: "success" });
    } catch (err) {
      console.error(err);
      addToast({ title: "Download failed", description: String(err), severity: "danger" });
    }
  };

  const handleDeleteEvent = async () => {
    if (!event?.name) return;
    if (deleteConfirmName !== event.name) {
      addToast({
        title: "Name mismatch",
        description: "Type the event name exactly to confirm.",
        severity: "warning",
      });
      return;
    }
    setDeletingEvent(true);
    const { error: e } = await supabase.from("events").delete().eq("id", id);
    setDeletingEvent(false);
    if (e) {
      addToast({
        title: "Delete failed",
        description: e.message,
        severity: "danger",
      });
      return;
    }
    addToast({ title: "Event deleted", severity: "success" });
    onDeleteClose();
    navigate("/dashboard");
  };

  const finalizeSingleElimBracket = async () => {
    if (!id || bracketType !== "single_elim") return;
    setFixingBracket(true);

    // Fetch current matches for event
    const { data: allMatches } = await supabase
      .from("matches")
      .select("*")
      .eq("event_id", id)
      .eq("bracket_type", "single_elim");

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
        const slot = m.position % 2 === 0 ? "a" : "b";
        if (
          nextMatch &&
          (m.next_match_id !== nextMatch.id || m.next_match_slot !== slot)
        ) {
          linkUpdates.push({
            id: m.id,
            next_match_id: nextMatch.id,
            next_match_slot: slot,
          });
        }
      }
    });

    if (linkUpdates.length > 0) {
      await Promise.all(
        linkUpdates.map((u) =>
          supabase
            .from("matches")
            .update({
              next_match_id: u.next_match_id,
              next_match_slot: u.next_match_slot,
            })
            .eq("id", u.id),
        ),
      );
    }

    // Create a set of slots that are fed by previous matches
    const slotsFed = new Set();
    // Since we might have just updated links, we should rely on the calculated logic or fetch again if complex.
    // But for simplicity/speed, let's use the local 'allMatches' plus the 'linkUpdates' logic imagination
    // Actually, fetching 'current' inside the loop is safer as it gets the latest state including links if they were saved?
    // No, the link updates above are async awaited. So the DB is consistent.
    // We will fetch fresh data inside the loop.

    // Auto-advance byes until no more single-team matches
    for (let i = 0; i < 6; i++) {
      const { data: current } = await supabase
        .from("matches")
        .select("*")
        .eq("event_id", id)
        .eq("bracket_type", "single_elim");

      if (!current || current.length === 0) break;

      // Build the set of fed slots from the CURRENT state of matches
      const currentFedInfo = new Set();
      current.forEach((m) => {
        if (m.next_match_id) {
          currentFedInfo.add(`${m.next_match_id}_${m.next_match_slot || "a"}`);
        }
      });

      const byeMatches = current.filter((m) => {
        const hasA = !!m.team_a_id;
        const hasB = !!m.team_b_id;

        if (m.winner_id || m.status === "completed") return false;
        if (hasA && hasB) return false; // Both present = normal match
        if (!hasA && !hasB) return false; // Both missing = waiting

        // One is present, one is missing.
        // Is the missing one pending a previous match?
        const fedA = currentFedInfo.has(`${m.id}_a`);
        const fedB = currentFedInfo.has(`${m.id}_b`);

        if (hasA && !hasB && !fedB) return true; // Yes, B is missing and NOT fed -> Bye
        if (!hasA && hasB && !fedA) return true; // Yes, A is missing and NOT fed -> Bye

        return false; // Otherwise it's pending
      });

      if (byeMatches.length === 0) break;

      await Promise.all(
        byeMatches.map((m) =>
          supabase
            .from("matches")
            .update({
              winner_id: m.team_a_id || m.team_b_id,
              status: "completed",
            })
            .eq("id", m.id),
        ),
      );
    }

    setFixingBracket(false);
  };

  const openAddTeam = () => {
    setEditingTeam(null);
    setTeamName("");
    setTeamMetadata({});
    onTeamOpen();
  };

  const openEditTeam = (t) => {
    setEditingTeam(t);
    setTeamName(t.name);
    setTeamMetadata(t.metadata_values || {});
    onTeamOpen();
  };

  const viewTeamPoc = async (team) => {
    if (!team.created_by) {
      setSelectedPoc({ isPlaceholder: true, teamName: team.name });
      onPocOpen();
      return;
    }
    
    setPocLoading(true);
    setSelectedPoc(null);
    onPocOpen();
    
    try {
      // Fetch user profile
      const { data: pocProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, role')
        .eq('id', team.created_by)
        .single();
      
      if (profileError) throw profileError;
      
      // Fetch user email from auth (only available to admins via profiles join or if self)
      const { data: authUser } = await supabase.auth.admin?.getUserById?.(team.created_by) || {};
      
      // Fetch statistics
      const [eventsOrganized, teamsRegistered, eventsJudged] = await Promise.all([
        supabase.from('events').select('id', { count: 'exact', head: true }).eq('created_by', team.created_by),
        supabase.from('teams').select('id', { count: 'exact', head: true }).eq('created_by', team.created_by),
        supabase.from('event_judges').select('event_id', { count: 'exact', head: true }).eq('user_id', team.created_by),
      ]);
      
      setSelectedPoc({
        id: pocProfile.id,
        displayName: pocProfile.display_name,
        avatarUrl: pocProfile.avatar_url,
        role: pocProfile.role,
        email: pocProfile.email|| authUser?.user?.email || null,
        teamName: team.name,
        stats: {
          eventsOrganized: eventsOrganized.count || 0,
          teamsRegistered: teamsRegistered.count || 0,
          eventsJudged: eventsJudged.count || 0,
        },
      });
    } catch (err) {
      console.error('Failed to fetch POC details:', err);
      setSelectedPoc({ error: true, teamName: team.name });
    } finally {
      setPocLoading(false);
    }
  };

  const saveTeam = async () => {
    const name = teamName.trim();
    if (!name) return;
    setTeamSaving(true);
    if (editingTeam) {
      const oldName = editingTeam.name;
      const { error: e } = await supabase
        .from("teams")
        .update({ name, metadata_values: teamMetadata })
        .eq("id", editingTeam.id);
      setTeamSaving(false);
      if (e) {
        setError(e.message);
        return;
      }
      // Audit log for team update
      await supabase.from("event_audit").insert({
        event_id: id,
        action: "team.update",
        entity_type: "team",
        entity_id: editingTeam.id,
        message: oldName !== name 
          ? `Renamed team "${oldName}" to "${name}"`
          : `Updated team "${name}"`,
        created_by: user?.id,
        metadata: { old_name: oldName, new_name: name, metadata_values: teamMetadata },
      });
    } else {
      const { data: newTeam, error: e } = await supabase
        .from("teams")
        .insert([
          {
            event_id: id,
            name,
            metadata_values: teamMetadata,
            created_by: user?.id,
          },
        ])
        .select()
        .single();
      setTeamSaving(false);
      if (e) {
        setError(e.message);
        return;
      }
      // Audit log for team creation
      await supabase.from("event_audit").insert({
        event_id: id,
        action: "team.create",
        entity_type: "team",
        entity_id: newTeam?.id,
        message: `Created team "${name}"`,
        created_by: user?.id,
        metadata: { name, metadata_values: teamMetadata },
      });
    }
    onTeamClose();
    fetch();
  };

  const removeTeam = async (teamId) => {
    if (!confirm("Remove this team?")) return;
    const teamToRemove = teams.find(t => t.id === teamId);
    const { error: e } = await supabase.from("teams").delete().eq("id", teamId);
    if (e) {
      setError(e.message);
    } else {
      // Audit log for team deletion
      await supabase.from("event_audit").insert({
        event_id: id,
        action: "team.delete",
        entity_type: "team",
        entity_id: teamId,
        message: `Deleted team "${teamToRemove?.name || 'Unknown'}"`,
        created_by: user?.id,
        metadata: { name: teamToRemove?.name, score: teamToRemove?.score },
      });
      fetch();
    }
  };

  const updateRegistrationStatus = async (newStatus) => {
    try {
      setChangingRegistrationStatus(true);
      const { error } = await supabase
        .from("events")
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) {
        addToast({
          title: "Failed to update registration status",
          description: error.message,
          severity: "danger",
        });
      } else {
        await fetch();
        addToast({
          title: `Registrations ${newStatus === "registration_open" ? "opened" : "closed"}`,
          severity: "success",
        });
      }
    } finally {
      setChangingRegistrationStatus(false);
    }
  };

  const openAddJudge = () => {
    setJudgeQuery("");
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

    const { data, error } = await supabase.rpc("search_profiles", { q });

    if (error) {
      console.error(error);
      setJudgeSearchResults([]);
      return;
    }

    setJudgeSearchResults(data || []);
  };

  const saveJudge = async (uid) => {
    setJudgeSaving(true);
    const { error: e } = await supabase
      .from("event_judges")
      .insert([{ event_id: id, user_id: uid }]);
    setJudgeSaving(false);
    if (e) {
      setError(e.message);
      return;
    }
    
    // Get judge profile for audit log
    const judgeProfile = judgeSearchResults.find(j => j.id === uid);
    const judgeName = judgeProfile?.display_name || judgeProfile?.email || 'Unknown';
    
    // Audit log
    await supabase.from('event_audit').insert({
      event_id: id,
      action: 'judge.add',
      entity_type: 'judge',
      entity_id: uid,
      message: `Added ${judgeName} as a judge`,
      created_by: user?.id,
      metadata: { user_id: uid, display_name: judgeName },
    });
    
    onJudgeClose();
    fetch();
  };

  const removeJudge = async (userId) => {
    if (!confirm("Remove this judge?")) return;
    
    // Get judge info before deletion for audit log
    const judgeToRemove = judges.find(j => j.user_id === userId);
    const judgeName = judgeToRemove?.display_name || judgeToRemove?.email || 'Unknown';
    
    const { error: e } = await supabase
      .from("event_judges")
      .delete()
      .eq("event_id", id)
      .eq("user_id", userId);
    if (e) {
      setError(e.message);
      return;
    }
    
    // Audit log
    await supabase.from('event_audit').insert({
      event_id: id,
      action: 'judge.remove',
      entity_type: 'judge',
      entity_id: userId,
      message: `Removed ${judgeName} as a judge`,
      created_by: user?.id,
      metadata: { user_id: userId, display_name: judgeName },
    });
    
    fetch();
  };

  const handleUndo = async () => {
    const { data: last, error: e1 } = await supabase
      .from("score_history")
      .select("id, team_id, points_before, points_after, delta")
      .eq("event_id", id)
      .is("undo_id", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (e1 || !last) {
      addToast({ title: "Nothing to undo", severity: "default" });
      return;
    }
    const { error: e2 } = await supabase.from("score_history").insert([
      {
        event_id: id,
        team_id: last.team_id,
        points_before: last.points_after,
        points_after: last.points_before,
        delta: -Number(last.delta),
        changed_by: user.id,
        undo_id: last.id,
      },
    ]);
    if (e2) {
      addToast({
        title: "Undo failed",
        description: e2.message,
        severity: "danger",
      });
      return;
    }
    const { error: e3 } = await supabase
      .from("teams")
      .update({ score: last.points_before })
      .eq("id", last.team_id);
    if (e3) {
      addToast({
        title: "Undo failed",
        description: e3.message,
        severity: "danger",
      });
      return;
    }
    fetch();
  };

  const handleAuditUndo = async (item) => {
    if (!item || item.kind !== "score" || !item.team_id) return;
    if (!confirm(`Undo score change for ${item.teams?.name || "team"}?`))
      return;

    const t = teams.find((x) => x.id === item.team_id);
    if (!t) {
      addToast({
        title: "Undo failed",
        description: "Team no longer exists",
        severity: "danger",
      });
      return;
    }

    const currentScore = Number(t.score) || 0;
    const deltaToUndo = Number(item.delta);
    const inverseDelta = -deltaToUndo;
    const nextScore = currentScore + inverseDelta;

    const { error: e2 } = await supabase.from("score_history").insert([
      {
        event_id: id,
        team_id: item.team_id,
        points_before: currentScore,
        points_after: nextScore,
        delta: inverseDelta,
        changed_by: user.id,
        undo_id: item.id,
      },
    ]);

    if (e2) {
      addToast({
        title: "Undo failed",
        description: e2.message,
        severity: "danger",
      });
      return;
    }

    const { error: e3 } = await supabase
      .from("teams")
      .update({ score: nextScore })
      .eq("id", item.team_id);

    if (e3) {
      addToast({
        title: "Undo failed",
        description: e3.message,
        severity: "danger",
      });
      return;
    }

    fetch();
    addToast({ title: "Change undone", severity: "success" });
  };

  const handleScoreChange = useCallback(async (teamId, deltaVal) => {
    if (!user?.id) {
      console.debug('[EventPage] handleScoreChange: No user, ignoring');
      return;
    }
    
    console.debug('[EventPage] handleScoreChange:', { teamId, deltaVal });
    
    // Track this pending change to handle rapid sequential updates
    const pending = pendingScoreChangesRef.current.get(teamId) || { pendingDelta: 0 };
    
    // Get the base score (either from last known state or current teams)
    const t = teamsRef.current.find((x) => x.id === teamId);
    if (!t) {
      console.debug('[EventPage] handleScoreChange: Team not found:', teamId);
      return;
    }
    
    // Calculate prev based on current displayed score (includes any pending optimistic updates)
    const currentDisplayedScore = Number(t.score) || 0;
    const prev = currentDisplayedScore;
    const next = prev + deltaVal;
    
    console.debug('[EventPage] handleScoreChange: Score change', { prev, next, deltaVal });
    
    // Track this delta as pending
    pending.pendingDelta += deltaVal;
    pendingScoreChangesRef.current.set(teamId, pending);
    
    // Optimistic update - also update the ref immediately
    setTeams((old) => {
      const updated = old.map((x) => (x.id === teamId ? { ...x, score: next } : x));
      teamsRef.current = updated; // Sync ref immediately
      return updated;
    });
    
    const { error: histErr } = await withRetry(() => 
      supabase.from("score_history").insert([
        {
          event_id: id,
          team_id: teamId,
          points_before: prev,
          points_after: next,
          delta: deltaVal,
          changed_by: user.id,
        },
      ])
    );
    
    if (histErr) {
      console.error('[EventPage] handleScoreChange: history insert failed:', histErr);
      // Rollback this specific delta
      pending.pendingDelta -= deltaVal;
      if (pending.pendingDelta === 0) {
        pendingScoreChangesRef.current.delete(teamId);
      } else {
        pendingScoreChangesRef.current.set(teamId, pending);
      }
      
      setTeams((old) => {
        const updated = old.map((x) => (x.id === teamId ? { ...x, score: x.score - deltaVal } : x));
        teamsRef.current = updated;
        return updated;
      });
      addToast({
        title: "Score update failed",
        description: histErr.message,
        severity: "danger",
      });
      return;
    }
    
    const { error: e } = await withRetry(() =>
      supabase
        .from("teams")
        .update({ score: next })
        .eq("id", teamId)
    );
      
    // Clear this delta from pending (whether success or fail, DB has the truth now)
    pending.pendingDelta -= deltaVal;
    if (pending.pendingDelta === 0) {
      pendingScoreChangesRef.current.delete(teamId);
    } else {
      pendingScoreChangesRef.current.set(teamId, pending);
    }
    
    if (e) {
      console.error('[EventPage] handleScoreChange: team update failed:', e);
      // Rollback this specific delta
      setTeams((old) => {
        const updated = old.map((x) => (x.id === teamId ? { ...x, score: x.score - deltaVal } : x));
        teamsRef.current = updated;
        return updated;
      });
      addToast({
        title: "Score update failed",
        description: e.message,
        severity: "danger",
      });
    } else {
      console.debug('[EventPage] handleScoreChange: Success');
    }
  }, [id, user?.id]);

  const teamColumns = [
    <TableColumn key="name">NAME</TableColumn>,
    ...(canManage
      ? [
        <TableColumn key="actions" align="end">
          ACTIONS
        </TableColumn>,
      ]
      : []),
  ];

  const teamRows = teams.map((t) => {
    const cells = [<TableCell key="name">{t.name}</TableCell>];
    if (canManage) {
      cells.push(
        <TableCell key="actions" align="right">
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
        </TableCell>,
      );
    }
    return <TableRow key={t.id}>{cells}</TableRow>;
  });

  const judgeColumns = [
    <TableColumn key="judge">JUDGE</TableColumn>,
    <TableColumn key="role">ROLE</TableColumn>,
    <TableColumn key="user_id">USER ID</TableColumn>,
    ...(canManage
      ? [
        <TableColumn key="actions" align="end">
          ACTIONS
        </TableColumn>,
      ]
      : []),
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
            <span className="text-xs text-foreground-500">{j.email}</span>
          </div>
        </div>
      </TableCell>,
      <TableCell key="role">
        <Chip
          size="sm"
          variant="flat"
          color={j.can_manage ? "secondary" : "primary"}
        >
          {j.can_manage ? "Co-Organizer" : "Judge"}
        </Chip>
      </TableCell>,
      <TableCell key="user_id">
        <code className="text-xs text-foreground-500">{j.user_id}</code>
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
        </TableCell>,
      );
    }

    return <TableRow key={j.user_id}>{cells}</TableRow>;
  });

  const handleImportTeams = async (importedTeams) => {
    if (!importedTeams || importedTeams.length === 0) return;

    // Add event_id and created_by to each team
    const teamsToInsert = importedTeams.map((t) => ({
      event_id: id,
      name: t.name,
      score: t.score || 0,
      description: t.description || "",
      metadata_values: t.metadata || {},
      created_by: user?.id,
    }));

    const { error } = await supabase.from("teams").insert(teamsToInsert);

    if (error) {
      console.error("Import error:", error);
      throw new Error(error.message);
    }

    await supabase.from("event_audit").insert({
      event_id: id,
      action: "teams.import",
      entity_type: "team",
      message: `Imported ${teamsToInsert.length} teams from CSV`,
      created_by: user?.id,
    });

    await fetch();
    addToast({
      title: `Imported ${teamsToInsert.length} teams`,
      severity: "success",
    });
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
        <Link to="/dashboard" className="text-primary underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-background via-default-50/50 to-background">
      {/* Hero Header */}

      <div className="relative w-full h-75 -mb-15">
        {event?.banner_url ? (
          <>
            <div className="absolute inset-0 bg-black/40 z-10" />
            <img
              src={event.banner_url}
              alt="Event banner"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.style.display = "none";
              }}
            />
          </>
        ) : (
          <div className="w-full h-full bg-linear-to-r from-sunset-blue to-sunset-purple" />
        )}
      </div>

      <div className="max-w-7xl mx-auto px-2 sm:px-6 relative z-20 pb-12">
        {/* Event Header Card */}
        <Card className="border-none shadow-xl mb-8 bg-background/80 backdrop-blur-md">
          <CardBody className="p-3 md:p-8 flex flex-col md:flex-row gap-4 md:gap-6 justify-between items-start">
            <div className="space-y-4 flex-1">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Chip
                    size="sm"
                    color={registrationsOpen ? "success" : "default"}
                    variant="flat"
                    className="uppercase font-bold tracking-wider"
                  >
                    {event?.status === "registration_open"
                      ? "Registrations Open"
                      : "Registrations Closed"}
                  </Chip>
                  <Chip
                    size="sm"
                    variant="dot"
                    color={event?.visibility === "public" ? "primary" : "secondary"}
                    className="capitalize"
                  >
                    {event?.visibility}
                  </Chip>
                  {/* Role indicator chips */}
                  {isAdmin && (
                    <Chip
                      size="sm"
                      variant="flat"
                      color="danger"
                      startContent={<Shield size={12} className="ml-1" />}
                    >
                      Admin
                    </Chip>
                  )}
                  {!isAdmin && event?.created_by === user?.id && (
                    <Chip
                      size="sm"
                      variant="flat"
                      color="warning"
                      startContent={<Users size={12} className="ml-1" />}
                    >
                      Owner
                    </Chip>
                  )}
                  {!isAdmin && event?.created_by !== user?.id && isCoManager && (
                    <Chip
                      size="sm"
                      variant="flat"
                      color="secondary"
                      startContent={<Users size={12} className="ml-1" />}
                    >
                      Co-Organizer
                    </Chip>
                  )}
                  {!canManage && judges.some((j) => j.user_id === user?.id) && (
                    <Chip
                      size="sm"
                      variant="flat"
                      color="primary"
                      startContent={<Gavel size={12} className="ml-1" />}
                    >
                      Judge
                    </Chip>
                  )}
                </div>
                <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-linear-to-r from-foreground to-default-500 p-0 md:p-2">
                  {event?.name}
                </h1>
              </div>

              <div className="flex flex-wrap gap-2">
                {eventTypes.map((t) => (
                  <Chip
                    key={t}
                    size="sm"
                    variant="flat"
                    color="secondary"
                    startContent={<Activity size={14} className="ml-1" />}
                  >
                    {t.replace("_", " ")}
                  </Chip>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 w-full md:w-auto">
              {canManage ? (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    as={Link}
                    to={`/events/${id}/edit`}
                    color="primary"
                    variant="shadow"
                    startContent={<Settings size={16} />}
                  >
                    Event Settings
                  </Button>

                  <Dropdown>
                    <DropdownTrigger>
                      <Button
                        variant="flat"
                        startContent={<Edit size={16} />}
                      >
                        Actions
                      </Button>
                    </DropdownTrigger>
                    <DropdownMenu aria-label="Event actions">
                      <DropdownItem
                        key="theme"
                        startContent={<Palette size={16} />}
                        onPress={onThemeOpen}
                      >
                        Change Theme
                      </DropdownItem>
                      <DropdownItem
                        key="clone"
                        startContent={<Copy size={16} />}
                        onPress={onCloneOpen}
                      >
                        Clone Event
                      </DropdownItem>
                      <DropdownItem
                        key="pdf"
                        startContent={<Download size={16} />}
                        onPress={onPdfExportOpen}
                      >
                        Export PDF
                      </DropdownItem>
                      <DropdownItem
                        key="delete"
                        className="text-danger"
                        color="danger"
                        startContent={<Trash2 size={16} />}
                        onPress={() => {
                          setDeleteConfirmName("");
                          onDeleteOpen();
                        }}
                      >
                        Delete Event
                      </DropdownItem>
                    </DropdownMenu>
                  </Dropdown>

                  <EventStatusManager
                    event={event}
                    eventId={id}
                    onStatusChange={() => fetch()}
                    variant="flat"
                  />

                  {/* Hidden elements that need to be in DOM for logic */}
                  <div className="hidden">
                    <EventCloneDialog
                      isOpen={isCloneOpen}
                      onOpenChange={(open) => !open && onCloneClose()}
                      event={event}
                      onCloneSuccess={(newEventId) =>
                        navigate(`/events/${newEventId}`)
                      }
                    />
                    <PdfExportDialog
                      isOpen={isPdfExportOpen}
                      onClose={onPdfExportClose}
                      event={event}
                      teams={teams}
                      matches={matches}
                      polls={polls}
                    />
                    <CsvManager
                      event={event}
                      teams={teams}
                      matches={matches}
                      polls={polls}
                      onImportTeams={handleImportTeams}
                    />
                  </div>
                </div>
              ) : null}

              <Dropdown>
                <DropdownTrigger>
                  <Button
                    variant="flat"
                    color="success"
                    startContent={<Share2 size={16} />}
                    endContent={<ChevronDown size={14} />}
                  >
                    Share Event
                  </Button>
                </DropdownTrigger>
                <DropdownMenu aria-label="Share options">
                  <DropdownItem
                    key="copy"
                    startContent={<Copy size={14} />}
                    onPress={() => {
                      const url = `${window.location.origin}/events/${id}`;
                      navigator.clipboard.writeText(url);
                      addToast({
                        title: "Event link copied to clipboard",
                        severity: "success",
                      });
                    }}
                  >
                    Copy Link
                  </DropdownItem>
                  <DropdownItem
                    key="qr"
                    startContent={<QrCode size={14} />}
                    onPress={onQrOpen}
                  >
                    Show QR Code
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
            </div>
          </CardBody>
        </Card>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-danger/10 text-danger border border-danger/20">
            {error}
          </div>
        )}

        <Card className="border-none shadow-lg bg-background/60 backdrop-blur-lg">
          <CardBody className="p-0">
            <Tabs
              aria-label="Event sections"
              variant="underlined"
              color="primary"
              classNames={{
                tabList:
                  "gap-6 w-full relative rounded-none p-0 border-b border-divider",
                cursor: "w-full bg-primary",
                tab: "max-w-fit px-4 sm:px-6 h-12 text-default-500",
                tabContent:
                  "group-data-[selected=true]:text-primary font-medium",
              }}
              selectedKey={searchParams.get("tab") || firstVisibleTab}
              onSelectionChange={(key) => setSearchParams({ tab: key })}
            >
              {[
                { key: 'details', visible: true, element: (
              <Tab key="details" title="Details" className="p-3 md:p-6">
                <div className="space-y-6">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="border-none shadow-sm bg-default-50 hover:bg-default-100 transition-colors">
                      <CardBody className="p-3 sm:p-4 flex flex-row items-center gap-4">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                          <Users size={20} />
                        </div>
                        <div>
                          <p className="text-default-500 text-xs font-bold uppercase tracking-wider">
                            Teams
                          </p>
                          <p className="text-xl font-bold">{teams.length}</p>
                        </div>
                      </CardBody>
                    </Card>
                    <Card className="border-none shadow-sm bg-default-50 hover:bg-default-100 transition-colors">
                      <CardBody className="p-3 sm:p-4 flex flex-row items-center gap-4">
                        <div className="p-2 rounded-lg bg-secondary/10 text-secondary">
                          <Gavel size={20} />
                        </div>
                        <div>
                          <p className="text-default-500 text-xs font-bold uppercase tracking-wider">
                            Judges
                          </p>
                          <p className="text-xl font-bold">{judges.length}</p>
                        </div>
                      </CardBody>
                    </Card>
                    <Card className="border-none shadow-sm bg-default-50 hover:bg-default-100 transition-colors">
                      <CardBody className="p-3 sm:p-4 flex flex-row items-center gap-4">
                        <div className="p-2 rounded-lg bg-warning/10 text-warning">
                          <Trophy size={20} />
                        </div>
                        <div>
                          <p className="text-default-500 text-xs font-bold uppercase tracking-wider">
                            Matches
                          </p>
                          <p className="text-xl font-bold">{matches.length}</p>
                        </div>
                      </CardBody>
                    </Card>
                    <Card className="border-none shadow-sm bg-default-50 hover:bg-default-100 transition-colors">
                      <CardBody className="p-3 sm:p-4 flex flex-row items-center gap-4">
                        <div className="p-2 rounded-lg bg-success/10 text-success">
                          <BarChart2 size={20} />
                        </div>
                        <div>
                          <p className="text-default-500 text-xs font-bold uppercase tracking-wider">
                            Polls
                          </p>
                          <p className="text-xl font-bold">{polls.length}</p>
                        </div>
                      </CardBody>
                    </Card>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="p-3 md:p-6 rounded-xl bg-content2/50  border border-default-200/50 space-y-4">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Info size={18} /> About Event
                      </h3>
                      <p className="text-default-500 leading-relaxed">
                        {event?.description ||
                          "No description provided for this event."}
                      </p>

                      <Divider className="my-4" />

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-default-400">Type</p>
                          <p className="font-medium capitalize">
                            {event?.type}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-default-400">Visibility</p>
                          <p className="font-medium capitalize">
                            {event?.visibility}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-default-400">Created</p>
                          <p className="font-medium">
                            {new Date(event?.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>

                      {canManage && (
                      <div className="p-3 md:p-6 rounded-xl bg-content2/50 border border-default-200/50">
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                          <Shield size={18} /> Admin Controls
                        </h3>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">Registration Status</p>
                              <p className="text-xs text-default-400">
                                Control if users can join
                              </p>
                            </div>
                            {!registrationsOpen ? (
                              <Button
                                size="sm"
                                color="success"
                                variant="flat"
                                onPress={() =>
                                  updateRegistrationStatus("registration_open")
                                }
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
                                onPress={() =>
                                  updateRegistrationStatus(
                                    "registration_closed",
                                  )
                                }
                                isLoading={changingRegistrationStatus}
                                isDisabled={changingRegistrationStatus}
                              >
                                Close Registrations
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Tab>
                )},
                { key: 'announcements', visible: true, element: (
              <Tab key="announcements" title="Announcements" className="p-3 md:p-6">
                <AnnouncementsFeed
                  eventId={id}
                  currentUserId={user?.id}
                  canManage={canManage}
                />
              </Tab>
                )},
                { key: 'teams', visible: showTeams, element: (
              <Tab key="teams" title="Teams" className="p-3 md:p-6">
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between gap-4 items-center">
                    <div className="w-full sm:w-auto flex-1 max-w-md">
                      <Input
                        startContent={
                          <Search className="text-default-400" size={16} />
                        }
                        placeholder="Search teams..."
                        value={teamSearch}
                        onValueChange={setTeamSearch}
                        isClearable
                        onClear={() => setTeamSearch("")}
                        variant="bordered"
                      />
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto items-center">
                      {registrationsOpen && !canManage && !isTeamRegistered && (
                        user ? (
                          <Button
                            color="primary"
                            onPress={openAddTeam}
                            endContent={<Plus size={16} />}
                          >
                            Register Team
                          </Button>
                        ) : (
                          <Button
                            as={Link}
                            to="/login"
                            color="primary"
                            endContent={<Plus size={16} />}
                          >
                            Sign in to Register
                          </Button>
                        )
                      )}
                      {canJudge && (
                        <Button
                          color="primary"
                          onPress={openAddTeam}
                          isDisabled={isCompleted}
                          endContent={<Plus size={16} />}
                        >
                          Add Team
                        </Button>
                      )}
                      {canManage && (
                        <MetadataTemplateBuilder
                          eventId={id}
                          onUpdate={() => fetch()}
                        />
                      )}
                      {canManage && (
                        <>
                          <CsvManager
                            event={event}
                            teams={teams}
                            matches={matches}
                            polls={polls}
                            onImportTeams={handleImportTeams}
                            isOpen={isMetadataOpen}
                            onClose={onMetadataClose}
                          />
                          <Button
                            variant="light"
                            startContent={<Download size={16} />}
                            onPress={onMetadataOpen}
                          >
                            CSV Import/Export
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {filteredTeams.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-default-200 rounded-xl">
                      <Users size={48} className="mb-4 text-default-300" />
                      <p className="text-default-500">No teams found</p>
                    </div>
                  ) : (
                    (() => {
                      const renderTeam = (t) => {
                        const isExpanded = expandedTeams.has(t.id);
                        const allowEdit = canEditTeam(t);
                        return (
                          <Card
                            key={t.id}
                            className={`group border border-transparent hover:border-primary/20 transition-all ${t.created_by === user?.id ? "border-primary/50 bg-primary/5" : ""}`}
                          >
                            <CardBody className="gap-3">
                              <div className="flex items-start justify-between">
                                <div
                                  className="flex-1 cursor-pointer"
                                  onClick={() => toggleTeamExpansion(t.id)}
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <h4 className="font-bold text-lg line-clamp-1">
                                      {t.name}
                                    </h4>
                                    <ChevronDown
                                      size={16}
                                      className={`text-default-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                                    />
                                  </div>
                                  {t.description && (
                                    <p className="text-sm text-default-500 line-clamp-2">
                                      {t.description}
                                    </p>
                                  )}
                                </div>
                                {(canManage || allowEdit) && (
                                  <Dropdown>
                                    <DropdownTrigger>
                                      <Button
                                        isIconOnly
                                        size="sm"
                                        variant="light"
                                        className="opacity-0 group-hover:opacity-100"
                                      >
                                        <MoreVertical size={16} />
                                      </Button>
                                    </DropdownTrigger>
                                    <DropdownMenu>
                                      <DropdownItem
                                        startContent={<Eye size={14} />}
                                        onPress={() => viewTeamPoc(t)}
                                      >
                                        View Team POC
                                      </DropdownItem>
                                      <DropdownItem
                                        startContent={<Edit3 size={14} />}
                                        onPress={() => openEditTeam(t)}
                                      >
                                        Edit Details
                                      </DropdownItem>
                                      <DropdownItem
                                        startContent={<Trash2 size={14} />}
                                        className="text-danger"
                                        color="danger"
                                        onPress={() => removeTeam(t.id)}
                                      >
                                        Remove Team
                                      </DropdownItem>
                                    </DropdownMenu>
                                  </Dropdown>
                                )}
                              </div>
                              {isExpanded && (
                                <div className="pt-3 border-t border-divider">
                                  <TeamMetadataDisplay
                                    eventId={id}
                                    teamMetadata={t.metadata_values || {}}
                                  />
                                </div>
                              )}
                            </CardBody>
                          </Card>
                        );
                      };

                      const myTeams = filteredTeams.filter(
                        (t) => t.created_by === user?.id
                      );
                      const otherTeams = filteredTeams.filter(
                        (t) => t.created_by !== user?.id
                      );

                      return (
                        <div className="space-y-8">
                          {myTeams.length > 0 && (
                            <div className="space-y-4">
                              <h3 className="text-xl font-bold flex items-center gap-2 text-primary">
                                Your Team
                              </h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {myTeams.map(renderTeam)}
                              </div>
                              <Divider className="my-6" />
                            </div>
                          )}
                          <div className="space-y-4">
                            {myTeams.length > 0 && (
                              <h3 className="text-xl font-bold flex items-center gap-2">
                                All Teams
                              </h3>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {otherTeams.length === 0 &&
                              myTeams.length > 0 ? (
                                <p className="text-default-500 italic">
                                  No other teams found.
                                </p>
                              ) : (
                                otherTeams.map(renderTeam)
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  )}
                </div>
              </Tab>
                )},
                { key: 'bracket', visible: hasType("bracket"), element: (
                <Tab
                    key="bracket"
                    title="Bracket"
                    className="p-3 md:p-6"
                  >
                  <div className="space-y-6">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div>
                        <h3 className="text-xl font-bold flex items-center gap-2">
                          <Trophy
                            className="text-warning"
                            size={24}
                          />{" "}
                          Tournament Bracket
                        </h3>
                        <p className="text-default-500 text-sm">
                          Follow the tournament
                          progress and results
                        </p>
                      </div>
                      {canJudge && (
                        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                          <Select
                            aria-label="Bracket Type"
                            placeholder="Bracket Type"
                            size="sm"
                            selectedKeys={[
                              bracketType,
                            ]}
                            onSelectionChange={(
                              keys,
                            ) =>
                              setBracketType(
                                [...keys][0] ||
                                "single_elim",
                              )
                            }
                            className="w-40"
                            startContent={
                              <Settings
                                size={14}
                                className="text-default-400"
                              />
                            }
                          >
                            <SelectItem key="single_elim">
                              Single Elimination
                            </SelectItem>
                            <SelectItem key="round_robin">
                              Round Robin
                            </SelectItem>
                            <SelectItem key="swiss">
                              Swiss System
                            </SelectItem>
                          </Select>

                          {matches.length === 0 ? (
                            <Button
                              size="sm"
                              color="primary"
                              isLoading={generatingBracket}
                              isDisabled={isCompleted}
                              onPress={handleGenerateBracket}
                              startContent={<Activity size={16} />}
                            >
                              Generate
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              color="warning"
                              variant="flat"
                              isLoading={regeneratingBracket}
                              isDisabled={isCompleted}
                              onPress={handleRegenerateBracket}
                              startContent={<RefreshCw size={16} />}
                            >
                              Regenerate
                            </Button>
                          )}
                          
                          {/* Swiss: Generate Next Round button */}
                          {matches.length > 0 && bracketType === "swiss" && (() => {
                            const currentRound = Math.max(...matches.map((m) => m.round), -1);
                            const currentRoundMatches = matches.filter((m) => m.round === currentRound);
                            const allCompleted = currentRoundMatches.length > 0 && currentRoundMatches.every((m) => m.status === "completed");
                            return allCompleted ? (
                              <Button
                                size="sm"
                                color="success"
                                isLoading={generatingBracket}
                                isDisabled={isCompleted}
                                onPress={handleGenerateNextSwissRound}
                                startContent={<Plus size={16} />}
                              >
                                Round {currentRound + 2}
                              </Button>
                            ) : null;
                          })()}
                          
                          {/* Create New Round / Playoffs button for all bracket types when matches complete */}
                          {matches.length > 0 && canJudge && !isCompleted && (() => {
                            const allMatchesComplete = matches.every((m) => m.status === "completed");
                            return allMatchesComplete ? (
                              <Button
                                size="sm"
                                color="secondary"
                                variant="flat"
                                onPress={onNewRoundOpen}
                                startContent={<Trophy size={16} />}
                              >
                                {bracketType === 'single_elim' ? 'New Phase' : 'Create Playoffs'}
                              </Button>
                            ) : null;
                          })()}
                        </div>
                      )}
                    </div>

                    <Card className="border-none bg-default-50/50 shadow-none">
                      <CardBody className="p-0 overflow-hidden">
                          {matches.length === 0 ? (
                          <div className="text-center py-20 text-default-400 bg-default-50 rounded-xl border border-dashed border-default-200">
                            <div className="bg-default-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                              <Trophy size={40} className="opacity-20" />
                            </div>
                            <h4 className="text-lg font-medium text-default-600">
                              No Bracket Generated
                            </h4>
                            <p className="text-sm">
                              Generate a bracket to start the tournament
                              matches.
                            </p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto p-3 md:p-6 pb-8 min-h-[400px]">
                            <BracketView
                              matches={matches}
                              teams={teams}
                              bracketType={
                                // Use the bracket type from the earliest round (lowest round number)
                                // to ensure we use the group stage type, not playoffs
                                [...matches].sort((a, b) => (a.round || 0) - (b.round || 0))[0]?.bracket_type ||
                                bracketType
                              }
                              canEdit={canJudge}
                              onEditMatch={handleEditMatch}
                              onAddMatch={handleAddMatch}
                              onEditTeams={handleEditTeams}
                              onDeleteMatch={handleDeleteMatch}
                              onCreateNewRound={onNewRoundOpen}
                            />
                          </div>
                        )}
                      </CardBody>
                    </Card>
                  </div>
                </Tab>
                )},

                { key: 'leaderboard', visible: hasType("points"), element: (
                <Tab key="leaderboard" title="Leaderboard" className="p-3 md:p-6">
                  <div className="flex justify-end mb-4 gap-2">
                    {canJudge && (
                      <Button
                        size="sm"
                        variant="flat"
                        onPress={handleUndo}
                        startContent={<RefreshCw size={14} />}
                      >
                        Undo Last Score
                      </Button>
                    )}
                    <Button
                      as={Link}
                      href={`/events/${id}/leaderboard`}
                      size="sm"
                      color="secondary"
                      variant="flat"
                      endContent={<ExternalLink size={14} />}
                    >
                      Big Screen Mode
                    </Button>
                  </div>
                  <Leaderboard
                    teams={teams}
                    canJudge={canJudge && !isCompleted}
                    onScoreChange={handleScoreChange}
                    sortOrder={event?.settings?.leaderboard_sort_order || 'desc'}
                  />
                </Tab>
                )},

                { key: 'judges', visible: showJudges, element: (
                <Tab key="judges" title="Judges" className="p-3 md:p-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-semibold">Event Judges</h3>
                      {canManage && (
                        <Button
                          size="sm"
                          color="primary"
                          onPress={openAddJudge}
                          startContent={<Plus size={16} />}
                        >
                          Add Judge
                        </Button>
                      )}
                    </div>

                    <div className="border border-default-200 rounded-xl overflow-hidden">
                      <Table
                        aria-label="Judges table"
                        shadow="none"
                        classNames={{ wrapper: "p-0" }}
                      >
                        <TableHeader>{judgeColumns}</TableHeader>
                        <TableBody emptyContent="No judges assigned yet.">
                          {judgeRows}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </Tab>
                )},

                { key: 'polls', visible: hasType("poll"), element: (
                <Tab key="polls" title="Polls" className="p-3 md:p-6">
                  <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                      <Input
                        startContent={
                          <Search className="text-default-400" size={16} />
                        }
                        placeholder="Search polls..."
                        value={pollSearch}
                        onValueChange={setPollSearch}
                        className="max-w-xs w-full"
                        isClearable
                        onClear={() => setPollSearch("")}
                      />
                      {canJudge && (
                        <Button
                          color="primary"
                          onPress={() => {
                            setSelectedPoll(null);
                            onPollEditorOpen();
                          }}
                          startContent={<Plus size={16} />}
                        >
                          Create Poll
                        </Button>
                      )}
                      {canJudge && polls && polls.length > 0 && (
                        <Button
                          color="flat"
                          variant="outline"
                          onPress={() => handleDownloadAllPollsCSV()}
                          startContent={<Download size={16} />}
                        >
                          Download All Polls (Analysis)
                        </Button>
                      )}
                    </div>

                    {polls.length === 0 ? (
                      <div className="text-center py-20 text-default-400">
                        <BarChart2
                          size={48}
                          className="mx-auto mb-4 opacity-20"
                        />
                        <p>No active polls</p>
                        {canJudge && (
                          <p className="text-sm mt-2">
                            Create a poll to engage your audience
                          </p>
                        )}
                      </div>
                    ) : (
                          <div className="grid grid-cols-1 gap-4">
                        {polls
                          .filter(
                            (p) =>
                              !pollSearch ||
                              p.question
                                .toLowerCase()
                                .includes(pollSearch.toLowerCase()),
                          )
                          .map((poll) => (
                            <Card
                              key={poll.id}
                              className="border border-default-200 bg-content1/50"
                            >
                              <CardBody className="p-3 md:p-6 space-y-3">
                                <div className="flex flex-col md:flex-row justify-between gap-4">
                                  <div>
                                    <div className="flex items-center gap-2 mb-2">
                                      <Chip
                                        size="sm"
                                        variant="flat"
                                        color={
                                          poll.status === "open"
                                            ? "success"
                                            : poll.status === "closed"
                                              ? "default"
                                              : "warning"
                                        }
                                      >
                                        {poll.status.toUpperCase()}
                                      </Chip>
                                      <span className="text-xs text-default-400">
                                        {new Date(
                                          poll.created_at,
                                        ).toLocaleString()}
                                      </span>
                                    </div>
                                    <h3 className="text-xl font-bold">
                                      {poll.question}
                                    </h3>
                                  </div>

                                  {canJudge && (
                                    <div className="flex flex-wrap gap-2 items-center">
                                      {poll.status === "draft" && (
                                        <Button
                                          size="sm"
                                          color="primary"
                                          onPress={async () => {
                                            await supabase
                                              .from("polls")
                                              .update({
                                                status: "open",
                                              })
                                              .eq("id", poll.id);
                                            await supabase
                                              .from("event_audit")
                                              .insert({
                                                event_id: id,
                                                action: "poll.open",
                                                entity_type: "poll",
                                                entity_id: poll.id,
                                                message: `Opened poll "${poll.question}"`,
                                                created_by: user?.id,
                                              });
                                            fetch();
                                          }}
                                        >
                                          Launch Poll
                                        </Button>
                                      )}
                                      {poll.status === "open" && (
                                        <Button
                                          size="sm"
                                          variant="flat"
                                          color="warning"
                                          onPress={async () => {
                                            await supabase
                                              .from("polls")
                                              .update({
                                                status: "closed",
                                              })
                                              .eq("id", poll.id);
                                            await supabase
                                              .from("event_audit")
                                              .insert({
                                                event_id: id,
                                                action: "poll.close",
                                                entity_type: "poll",
                                                entity_id: poll.id,
                                                message: `Closed poll "${poll.question}"`,
                                                created_by: user?.id,
                                              });
                                            fetch();
                                          }}
                                        >
                                          Close Voting
                                        </Button>
                                      )}
                                      {poll.status === "closed" && (
                                        <Button
                                          size="sm"
                                          variant="flat"
                                          onPress={async () => {
                                            await supabase
                                              .from("polls")
                                              .update({
                                                status: "open",
                                              })
                                              .eq("id", poll.id);
                                            await supabase
                                              .from("event_audit")
                                              .insert({
                                                event_id: id,
                                                action: "poll.reopen",
                                                entity_type: "poll",
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

                                      <Dropdown>
                                        <DropdownTrigger>
                                          <Button
                                            isIconOnly
                                            size="sm"
                                            variant="light"
                                          >
                                            <MoreVertical size={16} />
                                          </Button>
                                        </DropdownTrigger>
                                        <DropdownMenu>
                                          <DropdownItem
                                            key="edit"
                                            startContent={<Edit3 size={14} />}
                                            onPress={() => {
                                              setSelectedPoll(poll);
                                              onPollEditorOpen();
                                            }}
                                          >
                                            Edit Poll
                                          </DropdownItem>
                                          {poll.status === "closed" && (
                                            <DropdownItem
                                              key="award"
                                              color="success"
                                              startContent={
                                                <Trophy size={14} />
                                              }
                                              onPress={async () => {
                                                const { error } =
                                                  await supabase.rpc(
                                                    "award_poll_points",
                                                    {
                                                      poll_id: poll.id,
                                                    },
                                                  );
                                                if (error) {
                                                  addToast({
                                                    title: "Award failed",
                                                    description: error.message,
                                                    severity: "danger",
                                                  });
                                                } else {
                                                  await supabase
                                                    .from("event_audit")
                                                    .insert({
                                                      event_id: id,
                                                      action: "poll.award",
                                                      entity_type: "poll",
                                                      entity_id: poll.id,
                                                      message: `Awarded points for poll "${poll.question}"`,
                                                      created_by: user?.id,
                                                    });
                                                  fetch();
                                                  addToast({
                                                    title: "Points awarded",
                                                    severity: "success",
                                                  });
                                                }
                                              }}
                                            >
                                              Award Points
                                            </DropdownItem>
                                          )}
                                          <DropdownItem
                                            key="manage-votes"
                                            startContent={<Users size={14} />}
                                            onPress={() => {
                                              setManagingPoll(poll);
                                              onVoteManagerOpen();
                                            }}
                                          >
                                            Manage Votes
                                          </DropdownItem>
                                          <DropdownItem
                                            key="download"
                                            startContent={<Download size={14} />}
                                            onPress={() => handleDownloadPollCSV(poll)}
                                          >
                                            Download CSV (Analysis)
                                          </DropdownItem>
                                          <DropdownItem
                                            key="delete"
                                            className="text-danger"
                                            color="danger"
                                            startContent={<Trash2 size={14} />}
                                            onPress={() =>
                                              handleDeletePoll(poll.id)
                                            }
                                          >
                                            Delete Poll
                                          </DropdownItem>
                                        </DropdownMenu>
                                      </Dropdown>
                                    </div>
                                  )}
                                </div>

                                <Divider />

                                <div className="grid md:grid-cols-2 gap-8">
                                  <div>
                                    {poll.status === "open" && (
                                      <PollVote
                                        poll={poll}
                                        options={pollOptions[poll.id] || []}
                                        showQuestion={false}
                                        canJudge={canJudge}
                                        canManage={canManage}
                                      />
                                    )}
                                    {poll.status !== "open" && (
                                      <div className="h-full flex items-center justify-center text-default-400 p-4 bg-default-50/50 rounded-lg border border-dashed border-default-200">
                                        <p>
                                          {poll.status === "draft"
                                            ? "Poll hasn't started yet"
                                            : "Voting is closed"}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                  <div>
                                    <h4 className="text-sm font-semibold uppercase text-default-500 mb-3">
                                      Live Result
                                    </h4>
                                    <PollResultsLive
                                      pollId={poll.id}
                                      votes={getVotesForPoll(poll.id)}
                                      options={pollOptions[poll.id] || []}
                                      isLive={poll.status === "open"}
                                      pollType={poll.poll_type}
                                      resultsHidden={poll.results_hidden}
                                      canManage={canManage}
                                    />
                                  </div>
                                </div>
                              </CardBody>
                            </Card>
                          ))}
                      </div>
                    )}
                  </div>
                </Tab>
                )},

                { key: 'evals', visible: hasType("evals"), element: (
                <Tab key="evals" title="Evaluations" className="p-3 md:p-6">
                  <EvalScheduler
                    eventId={id}
                    teams={teams}
                    canManage={canManage}
                    canJudge={canJudge}
                    currentUserId={user?.id}
                  />
                </Tab>
                )},

                { key: 'timeline', visible: showTimeline, element: (
                <Tab key="timeline" title="Timeline" className="p-6">
                  <TimelineView
                    eventId={id}
                    rounds={rounds}
                    matches={matches}
                    scoreHistory={scoreHistory}
                  />
                </Tab>
                )},

                { key: 'analytics', visible: showAnalytics, element: (
                <Tab key="analytics" title="Analytics" className="p-6">
                  <EventAnalytics
                    eventId={id}
                    matches={matches}
                    polls={polls}
                    scoreHistory={scoreHistory}
                    teams={teams}
                  />
                </Tab>
                )},

                { key: 'audit', visible: canManage, element: (
                <Tab key="audit" title="Audit Log" className="p-6">
                  <div className="flex justify-end mb-4">
                    <Button
                      size="sm"
                      variant="flat"
                      onPress={() => fetch()}
                      startContent={<RefreshCw size={14} />}
                    >
                      Refresh Log
                    </Button>
                  </div>
                  <div className="border border-default-200 rounded-xl overflow-hidden">
                    <AuditLog
                      items={auditItems}
                      currentUserId={
                        profile?.display_name || user?.email || user?.id
                      }
                      onUndo={handleAuditUndo}
                    />
                  </div>
                </Tab>
                )},
              ]
                .filter(tab => tab.visible)
                .sort((a, b) => getTabSortIndex(a.key) - getTabSortIndex(b.key))
                .map(tab => tab.element)
              }
            </Tabs>
          </CardBody>
        </Card>
      </div>

      <Modal isOpen={isTeamOpen} onClose={onTeamClose}>
        <ModalContent>
          <ModalHeader>{editingTeam ? "Edit team" : "Add team"}</ModalHeader>
          <ModalBody className="space-y-4">
            <Input
              label="Name"
              value={teamName}
              onValueChange={setTeamName}
              placeholder="Team name"
              variant="bordered"
            />
            <MetadataFieldsForm
              eventId={id}
              teamMetadata={teamMetadata}
              onMetadataChange={setTeamMetadata}
              onValidationChange={setIsMetadataValid}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onTeamClose}>
              Cancel
            </Button>
            <Button
              color="primary"
              onPress={saveTeam}
              isLoading={teamSaving}
              isDisabled={!teamName || !isMetadataValid}
            >
              Save
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={isJudgeOpen} onClose={onJudgeClose} size="md">
        <ModalContent>
          <ModalHeader>Add Judge</ModalHeader>
          <ModalBody className="space-y-3">
            <Input
              label="Search user"
              placeholder="Type name or user ID..."
              value={judgeQuery}
              onValueChange={searchJudges}
              startContent={<Search size={16} className="text-default-400" />}
              variant="bordered"
            />

            {judgeSearchResults.length > 0 ? (
              <div className="border border-default-200 rounded-lg max-h-48 overflow-y-auto">
                {judgeSearchResults.map((result) => (
                  <div
                    key={result.id}
                    className="p-3 border-b border-default-100 last:border-b-0 cursor-pointer hover:bg-default-100 flex items-center justify-between"
                    onClick={() => saveJudge(result.id)}
                  >
                    <div>
                      <p className="text-sm font-semibold">
                        {result.display_name || "Unnamed User"}
                      </p>
                      <p className="text-xs text-default-500">{result.email}</p>
                    </div>
                    <Plus size={16} className="text-primary" />
                  </div>
                ))}
              </div>
            ) : judgeQuery ? (
              <p className="text-sm text-default-500 text-center py-4">
                No users found
              </p>
            ) : null}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onJudgeClose}>
              Close
            </Button>
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
          const teamA =
            teams.find((t) => t.id === match.team_a_id)?.name || "Team A";
          const teamB =
            teams.find((t) => t.id === match.team_b_id)?.name || "Team B";
          const winnerName =
            teams.find((t) => t.id === update.winner_id)?.name || "TBD";
          await supabase.from("event_audit").insert({
            event_id: id,
            action: "match.update",
            entity_type: "match",
            entity_id: match.id,
            message: `${teamA} ${update.team_a_score} - ${update.team_b_score} ${teamB} (winner: ${winnerName})`,
            created_by: user?.id,
            metadata: { status: update.status },
          });
        }}
      />

      <MatchTeamsEditor
        isOpen={isMatchTeamsOpen}
        onClose={onMatchTeamsClose}
        match={matchTeamsTarget}
        teams={teams}
        eventId={id}
        round={newMatchRound}
        bracketType={bracketType}
        isNewMatch={!matchTeamsTarget}
        allMatches={matches}
        onUpdate={(matchOrId, update) => {
          fetch();
        }}
        onAudit={async (matchOrAction, data) => {
          if (matchOrAction === 'create_match') {
            const teamA = teams.find((t) => t.id === data.match.team_a_id)?.name || "TBD";
            const teamB = teams.find((t) => t.id === data.match.team_b_id)?.name || "TBD";
            await supabase.from("event_audit").insert({
              event_id: id,
              action: "match.create",
              entity_type: "match",
              entity_id: data.match.id,
              message: `Created match: ${teamA} vs ${teamB} (Round ${data.match.round})`,
              created_by: user?.id,
            });
          } else {
            // Edit teams
            const oldTeamA = teams.find((t) => t.id === matchOrAction.team_a_id)?.name || "TBD";
            const oldTeamB = teams.find((t) => t.id === matchOrAction.team_b_id)?.name || "TBD";
            const newTeamA = teams.find((t) => t.id === data.team_a_id)?.name || "TBD";
            const newTeamB = teams.find((t) => t.id === data.team_b_id)?.name || "TBD";
            await supabase.from("event_audit").insert({
              event_id: id,
              action: "match.teams_update",
              entity_type: "match",
              entity_id: matchOrAction.id,
              message: `Changed teams: ${oldTeamA} vs ${oldTeamB} → ${newTeamA} vs ${newTeamB}`,
              created_by: user?.id,
            });
          }
        }}
      />

      {/* New Round Modal */}
      <NewRoundModal
        isOpen={isNewRoundOpen}
        onClose={onNewRoundClose}
        eventId={id}
        teams={teams}
        matches={matches}
        currentBracketType={bracketType}
        onRoundCreated={() => fetch()}
        currentUserId={user?.id}
      />

      {/* Bracket Team Selection Modal */}
      <Modal isOpen={isBracketTeamSelectOpen} onClose={onBracketTeamSelectClose} size="lg" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader className="flex items-center gap-2">
            <Users size={20} />
            Select Teams for Bracket
          </ModalHeader>
          <ModalBody className="space-y-4">
            <div className="text-sm text-default-500 bg-default-100 p-3 rounded-lg">
              Choose which teams to include in the {bracketType.replace('_', ' ')} bracket.
              {bracketType === 'single_elim' && (
                <span className="block mt-1 text-warning-600">
                  Note: For single elimination, teams will be padded to the nearest power of 2 with byes.
                </span>
              )}
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">
                {selectedBracketTeams.size} of {teams.length} teams selected
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="flat"
                  onPress={() => setSelectedBracketTeams(new Set(teams.map(t => t.id)))}
                >
                  Select All
                </Button>
                <Button
                  size="sm"
                  variant="flat"
                  onPress={() => setSelectedBracketTeams(new Set())}
                >
                  Clear
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
              {teams.map((team) => (
                <div
                  key={team.id}
                  className={`
                    flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all
                    ${selectedBracketTeams.has(team.id) 
                      ? 'border-primary bg-primary/10' 
                      : 'border-default-200 hover:border-default-300'}
                  `}
                  onClick={() => {
                    const newSet = new Set(selectedBracketTeams);
                    if (newSet.has(team.id)) {
                      newSet.delete(team.id);
                    } else {
                      newSet.add(team.id);
                    }
                    setSelectedBracketTeams(newSet);
                  }}
                >
                  <div className={`
                    w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
                    ${selectedBracketTeams.has(team.id) 
                      ? 'border-primary bg-primary text-white' 
                      : 'border-default-300'}
                  `}>
                    {selectedBracketTeams.has(team.id) && (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm font-medium truncate">{team.name}</span>
                  {team.score > 0 && (
                    <Chip size="sm" variant="flat" className="ml-auto">
                      {team.score} pts
                    </Chip>
                  )}
                </div>
              ))}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onBracketTeamSelectClose}>
              Cancel
            </Button>
            <Button 
              color="primary" 
              onPress={handleConfirmBracketGeneration}
              isDisabled={selectedBracketTeams.size < 2}
              isLoading={generatingBracket || regeneratingBracket}
            >
              {bracketGenerateMode === 'regenerate' ? 'Regenerate Bracket' : 'Generate Bracket'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

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
          <ModalHeader className="text-danger flex items-center gap-2">
            <Trash2 size={20} /> Delete Event
          </ModalHeader>
          <ModalBody className="space-y-4">
            <div className="p-3 bg-danger/10 text-danger text-sm rounded-lg">
              This action cannot be undone. This will permanently delete the
              event, teams, matches, and polls.
            </div>
            <p className="text-sm">
              Type <span className="font-bold">{event?.name}</span> to confirm.
            </p>
            <Input
              placeholder={event?.name || ""}
              value={deleteConfirmName}
              onValueChange={setDeleteConfirmName}
              variant="bordered"
              color="danger"
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onDeleteClose}>
              Cancel
            </Button>
            <Button
              color="danger"
              isLoading={deletingEvent}
              isDisabled={deleteConfirmName !== event?.name}
              onPress={handleDeleteEvent}
            >
              Delete Event
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Team POC Modal */}
      <Modal isOpen={isPocOpen} onClose={onPocClose} size="md">
        <ModalContent>
          <ModalHeader>Team POC Details</ModalHeader>
          <ModalBody>
            {pocLoading ? (
              <div className="flex justify-center py-8">
                <Spinner size="lg" />
              </div>
            ) : selectedPoc?.isPlaceholder ? (
              <div className="text-center py-8">
                <div className="bg-default-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users size={32} className="text-default-400" />
                </div>
                <p className="text-default-500 font-medium">No POC Assigned</p>
                <p className="text-sm text-default-400 mt-1">
                  Team "{selectedPoc.teamName}" was not created by a registered user
                </p>
              </div>
            ) : selectedPoc?.error ? (
              <div className="text-center py-8">
                <p className="text-danger">Failed to load POC details</p>
              </div>
            ) : selectedPoc ? (
              <div className="space-y-6">
                {/* User Info */}
                <div className="flex items-center gap-4">
                  <Avatar
                    src={selectedPoc.avatarUrl}
                    name={selectedPoc.displayName || 'User'}
                    size="lg"
                    className="w-16 h-16"
                  />
                  <div>
                    <h3 className="text-lg font-bold">
                      {selectedPoc.displayName || 'Unnamed User'}
                    </h3>
                    <p className="text-sm text-default-500 capitalize">
                      {selectedPoc.role?.replace('_', ' ') || 'User'}
                    </p>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-3 bg-default-50 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <Mail size={16} className="text-default-400" />
                    <div>
                      <p className="text-xs text-default-400">Email</p>
                      <p className="text-sm font-medium">
                        {selectedPoc.email || <span className="text-default-400 italic">Not available</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Hash size={16} className="text-default-400" />
                    <div>
                      <p className="text-xs text-default-400">User ID</p>
                      <p className="text-sm font-mono text-default-600 break-all">
                        {selectedPoc.id}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Statistics */}
                <div>
                  <h4 className="text-sm font-semibold mb-3 text-default-600">Statistics</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-primary/10 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-primary">
                        {selectedPoc.stats?.eventsOrganized || 0}
                      </p>
                      <p className="text-xs text-default-500">Events Organized</p>
                    </div>
                    <div className="bg-secondary/10 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-secondary">
                        {selectedPoc.stats?.teamsRegistered || 0}
                      </p>
                      <p className="text-xs text-default-500">Teams Created</p>
                    </div>
                    <div className="bg-warning/10 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-warning">
                        {selectedPoc.stats?.eventsJudged || 0}
                      </p>
                      <p className="text-xs text-default-500">Events Judged</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onPocClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Theme Builder Modal */}
      <ThemeBuilder
        isOpen={isThemeOpen}
        onOpenChange={onThemeClose}
        eventId={id}
        currentTheme={event?.settings?.theme}
        onSave={(newTheme) => {
          setEvent(prev => ({
            ...prev,
            settings: { ...prev.settings, theme: newTheme }
          }));
          fetch();
        }}
      />

      {/* QR Code Modal */}
      <Modal isOpen={isQrOpen} onClose={onQrClose} size="sm">
        <ModalContent>
          <ModalHeader className="flex items-center gap-2">
            <QrCode size={20} />
            Event QR Code
          </ModalHeader>
          <ModalBody className="items-center pb-6">
            <div className="bg-white p-4 rounded-xl shadow-inner">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${window.location.origin}/events/${id}`)}`}
                alt="Event QR Code"
                width={200}
                height={200}
                className="block"
              />
            </div>
            <p className="text-sm text-default-500 text-center mt-4">
              Scan this QR code to open the event page
            </p>
            <p className="text-xs text-default-400 text-center font-mono break-all px-4">
              {`${window.location.origin}/events/${id}`}
            </p>
          </ModalBody>
          <ModalFooter className="justify-center gap-2">
            <Button
              variant="flat"
              startContent={<Copy size={14} />}
              onPress={() => {
                const url = `${window.location.origin}/events/${id}`;
                navigator.clipboard.writeText(url);
                addToast({
                  title: "Link copied to clipboard",
                  severity: "success",
                });
              }}
            >
              Copy Link
            </Button>
            <Button
              color="primary"
              startContent={<Download size={14} />}
              onPress={() => {
                const link = document.createElement('a');
                link.href = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(`${window.location.origin}/events/${id}`)}`;
                link.download = `event-${id}-qr.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                addToast({
                  title: "QR code downloaded",
                  severity: "success",
                });
              }}
            >
              Download
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Poll Vote Manager Modal */}
      <PollVoteManager
        isOpen={isVoteManagerOpen}
        onClose={() => {
          onVoteManagerClose();
          setManagingPoll(null);
        }}
        poll={managingPoll}
        options={managingPoll ? (pollOptions[managingPoll.id] || []) : []}
        votes={managingPoll ? getVotesForPoll(managingPoll.id) : []}
        eventId={id}
        userId={user?.id}
        onRefresh={fetch}
      />

    </div>
  );
}

function PollResultsLive({
  pollId,
  votes,
  options,
  isLive,
  pollType,
  resultsHidden,
  canManage,
}) {
  // votes are now passed in from the centralized useEventVotes hook
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
