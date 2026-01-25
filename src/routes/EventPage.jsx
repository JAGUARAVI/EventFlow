import { useState, useEffect, useCallback } from "react";
import {
  useParams,
  Link,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {
  Tabs,
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
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { useRealtimeLeaderboard } from "../hooks/useRealtimeLeaderboard";
import { useRealtimeBracket } from "../hooks/useRealtimeBracket";

import Leaderboard from "../components/Leaderboard";
import AuditLog from "../components/AuditLog";
import BracketView from "../components/BracketView";
import MatchEditor from "../components/MatchEditor";
import PollEditor from "../components/PollEditor";
import PollVote from "../components/PollVote";
import PollResults from "../components/PollResults";
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
import {
  generateSingleElimination,
  generateRoundRobin,
  generateSwiss,
  shuffleTeams,
} from "../lib/bracket";
import { useLiveVotes } from "../hooks/useLiveVotes";
import { useRealtimePolls } from "../hooks/useRealtimePolls";
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
  const canManage =
    event && (isAdmin || (event.created_by === user?.id && role !== "viewer"));
  const isCompleted = event?.status === "completed";
  const canJudge =
    event && (canManage || judges.some((j) => j.user_id === user?.id));
  const registrationsOpen = event?.status === "registration_open";
  const isTeamRegistered = teams.some((t) => t.created_by === user?.id);
  const settings = event?.settings || {};
  const showAnalytics = canManage || !settings.hide_analytics;
  const showTimeline = canManage || !settings.hide_timeline;
  const showJudges = canManage || !settings.hide_judges;

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
              .select("user_id, created_at")
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

  useRealtimeLeaderboard(id, setTeams);
  
  const onMatchComplete = useCallback((completedMatch) => {
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#0070f3", "#7c3aed", "#ec4899", "#ffffff"],
    });
  }, []);

  useRealtimeBracket(id, setMatches, onMatchComplete, () => fetch());
  useRealtimePolls(id, setPolls, setPollOptions);

  const buildBracketMatches = (type) => {
    const shuffledTeams = shuffleTeams(teams);
    if (type === "single_elim") return generateSingleElimination(id, shuffledTeams);
    if (type === "round_robin") return generateRoundRobin(id, shuffledTeams);
    if (type === "swiss") return generateSwiss(id, shuffledTeams);
    return [];
  };

  const handleGenerateBracket = async () => {
    if (!teams || teams.length === 0) {
      addToast({
        title: "No teams",
        description: "Add teams first",
        severity: "warning",
      });
      return;
    }
    setGeneratingBracket(true);
    const generated = buildBracketMatches(bracketType);
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
    await supabase.from("event_audit").insert({
      event_id: id,
      action: "bracket.generate",
      entity_type: "bracket",
      message: `Generated ${bracketType.replace("_", " ")} bracket`,
      created_by: user?.id,
      metadata: { bracket_type: bracketType },
    });
    await finalizeSingleElimBracket();
    fetch();
    addToast({ title: "Bracket generated", severity: "success" });
  };

  const handleRegenerateBracket = async () => {
    if (!teams || teams.length === 0) {
      addToast({
        title: "No teams",
        description: "Add teams first",
        severity: "warning",
      });
      return;
    }
    if (!confirm("Regenerate bracket? This will delete all existing matches."))
      return;
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
    const generated = buildBracketMatches(bracketType);
    const { error: insErr } = await supabase.from("matches").insert(generated);
    setRegeneratingBracket(false);
    if (insErr) {
      addToast({
        title: "Regenerate failed",
        description: insErr.message,
        severity: "danger",
      });
      return;
    }
    await supabase.from("event_audit").insert({
      event_id: id,
      action: "bracket.regenerate",
      entity_type: "bracket",
      message: `Regenerated ${bracketType.replace("_", " ")} bracket`,
      created_by: user?.id,
      metadata: { bracket_type: bracketType },
    });
    await finalizeSingleElimBracket();

    // Broadcast reload to force sync clients
    const channel = supabase.channel(`bracket:${id}`);
    channel.send({ type: "broadcast", event: "reload", payload: {} });

    fetch();
    addToast({ title: "Bracket regenerated", severity: "success" });
  };

  const handleEditMatch = (match) => {
    setSelectedMatch(match);
    onMatchOpen();
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

  const saveTeam = async () => {
    const name = teamName.trim();
    const created_by = user?.id || null;
    if (!name) return;
    setTeamSaving(true);
    if (editingTeam) {
      const { error: e } = await supabase
        .from("teams")
        .update({ name, metadata_values: teamMetadata, created_by })
        .eq("id", editingTeam.id);
      setTeamSaving(false);
      if (e) {
        setError(e.message);
        return;
      }
    } else {
      const { error: e } = await supabase.from("teams").insert([
        {
          event_id: id,
          name,
          metadata_values: teamMetadata,
          created_by: user?.id,
        },
      ]);
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
    if (!confirm("Remove this team?")) return;
    const { error: e } = await supabase.from("teams").delete().eq("id", teamId);
    if (e) setError(e.message);
    else fetch();
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
    onJudgeClose();
    fetch();
  };

  const removeJudge = async (userId) => {
    if (!confirm("Remove this judge?")) return;
    const { error: e } = await supabase
      .from("event_judges")
      .delete()
      .eq("event_id", id)
      .eq("user_id", userId);
    if (e) setError(e.message);
    else fetch();
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

  const handleScoreChange = async (teamId, deltaVal) => {
    const t = teams.find((x) => x.id === teamId);
    if (!t || !user?.id) return;
    const prev = Number(t.score) || 0;
    const next = prev + deltaVal;
    setTeams((old) =>
      old.map((x) => (x.id === teamId ? { ...x, score: next } : x)),
    );
    const { error: histErr } = await supabase.from("score_history").insert([
      {
        event_id: id,
        team_id: teamId,
        points_before: prev,
        points_after: next,
        delta: deltaVal,
        changed_by: user.id,
      },
    ]);
    if (histErr) {
      setTeams((old) =>
        old.map((x) => (x.id === teamId ? { ...x, score: prev } : x)),
      );
      addToast({
        title: "Score update failed",
        description: histErr.message,
        severity: "danger",
      });
      return;
    }
    const { error: e } = await supabase
      .from("teams")
      .update({ score: next })
      .eq("id", teamId);
    if (e) {
      setTeams((old) =>
        old.map((x) => (x.id === teamId ? { ...x, score: prev } : x)),
      );
      addToast({
        title: "Score update failed",
        description: e.message,
        severity: "danger",
      });
    }
  };

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

      <div className="max-w-7xl mx-auto px-6 relative z-20 pb-12">
        {/* Event Header Card */}
        <Card className="border-none shadow-xl mb-8 bg-background/80 backdrop-blur-md">
          <CardBody className="p-6 md:p-8 flex flex-col md:flex-row gap-6 justify-between items-start">
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
                </div>
                <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-linear-to-r from-foreground to-default-500 p-2">
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
                    startContent={<Edit3 size={16} />}
                  >
                    Edit Event
                  </Button>

                  <Dropdown>
                    <DropdownTrigger>
                      <Button
                        variant="flat"
                        startContent={<Settings size={16} />}
                      >
                        Settings
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
                      onOpenChange={onCloneClose}
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

              <Button
                variant="flat"
                color="success"
                startContent={<Share2 size={16} />}
                onPress={() => {
                  const url = `${window.location.origin}/events/${id}`;
                  navigator.clipboard.writeText(url);
                  addToast({
                    title: "Event link copied to clipboard",
                    severity: "success",
                  });
                }}
              >
                Share Event Link
              </Button>
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
                tab: "max-w-fit px-6 h-12 text-default-500",
                tabContent:
                  "group-data-[selected=true]:text-primary font-medium",
              }}
              selectedKey={searchParams.get("tab") || "details"}
              onSelectionChange={(key) => setSearchParams({ tab: key })}
            >
              <Tab key="details" title="Details" className="p-6">
                <div className="space-y-6">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="border-none shadow-sm bg-default-50 hover:bg-default-100 transition-colors">
                      <CardBody className="p-4 flex flex-row items-center gap-4">
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
                      <CardBody className="p-4 flex flex-row items-center gap-4">
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
                      <CardBody className="p-4 flex flex-row items-center gap-4">
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
                      <CardBody className="p-4 flex flex-row items-center gap-4">
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
                    <div className="p-6 rounded-xl bg-content2/50  border border-default-200/50 space-y-4">
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
                      <div className="p-6 rounded-xl bg-content2/50 border border-default-200/50">
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
              <Tab key="announcements" title="Announcements" className="p-6">
                <AnnouncementsFeed
                  eventId={id}
                  currentUserId={user?.id}
                  canManage={canManage}
                />
              </Tab>
              <Tab key="teams" title="Teams" className="p-6">
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
                      {canManage && (
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
                          trigger={
                            <Button
                              variant="flat"
                              startContent={<Settings size={16} />}
                            >
                              Fields
                            </Button>
                          }
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

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredTeams.length === 0 ? (
                      <div className="col-span-full py-12 text-center text-default-400 border border-dashed border-default-200 rounded-xl">
                        <Users size={48} className="mx-auto mb-4 opacity-50" />
                        <p>No teams found</p>
                      </div>
                    ) : (
                      filteredTeams.map((t) => {
                        const isExpanded = expandedTeams.has(t.id);
                        return (
                          <Card
                            key={t.id}
                            className="group border border-transparent hover:border-primary/20 transition-all"
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
                                {canManage && (
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
                      })
                    )}
                  </div>
                </div>
              </Tab>
              {hasType("bracket") && (
                <Tab key="bracket" title="Bracket" className="p-6">
                  <div className="space-y-6">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div>
                        <h3 className="text-xl font-bold flex items-center gap-2">
                          <Trophy className="text-warning" size={24} />{" "}
                          Tournament Bracket
                        </h3>
                        <p className="text-default-500 text-sm">
                          Follow the tournament progress and results
                        </p>
                      </div>
                      {canManage && (
                        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                          <Select
                            aria-label="Bracket Type"
                            placeholder="Bracket Type"
                            size="sm"
                            selectedKeys={[bracketType]}
                            onSelectionChange={(keys) =>
                              setBracketType([...keys][0] || "single_elim")
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
                            <SelectItem key="swiss">Swiss System</SelectItem>
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
                        </div>
                      )}
                    </div>

                    <Card className="border-none bg-default-50/50 shadow-none">
                      <CardBody className="p-0 overflow-hidden">
                        {matches.length === 0 ? (
                          <div className="text-center py-24 text-default-400 bg-default-50 rounded-xl border border-dashed border-default-200">
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
                          <div className="overflow-x-auto p-6 pb-8 min-h-[400px]">
                            <BracketView
                              matches={matches}
                              teams={teams}
                              bracketType={
                                matches[0]?.bracket_type ||
                                ("single_elim" && !isCompleted)
                              }
                              canEdit={canJudge}
                              onEditMatch={handleEditMatch}
                            />
                          </div>
                        )}
                      </CardBody>
                    </Card>
                  </div>
                </Tab>
              )}

              {hasType("points") && (
                <Tab key="leaderboard" title="Leaderboard" className="p-6">
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
                      as={HeroLink}
                      href={`/events/${id}/leaderboard`}
                      isExternal
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
                  />
                </Tab>
              )}

              {showJudges && (
                <Tab key="judges" title="Judges" className="p-6">
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
              )}

              {hasType("poll") && (
                <Tab key="polls" title="Polls" className="p-6">
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
                      {canManage && (
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
                      {canManage && polls && polls.length > 0 && (
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
                        {canManage && (
                          <p className="text-sm mt-2">
                            Create a poll to engage your audience
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-6">
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
                              <CardBody className="p-6 space-y-4">
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

                                  {canManage && (
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
              )}

              {showTimeline && (
                <Tab key="timeline" title="Timeline" className="p-6">
                  <TimelineView
                    eventId={id}
                    rounds={rounds}
                    matches={matches}
                    scoreHistory={scoreHistory}
                  />
                </Tab>
              )}

              {showAnalytics && (
                <Tab key="analytics" title="Analytics" className="p-6">
                  <EventAnalytics
                    eventId={id}
                    matches={matches}
                    polls={polls}
                    scoreHistory={scoreHistory}
                    teams={teams}
                  />
                </Tab>
              )}

              {canManage && (
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
              )}
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

      </div>
  );
}

function PollResultsLive({
  pollId,
  options,
  isLive,
  pollType,
  resultsHidden,
  canManage,
}) {
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
