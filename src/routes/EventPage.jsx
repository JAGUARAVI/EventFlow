import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Tabs, Tab, Button, Input, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure, addToast, Avatar, AvatarIcon} from '@heroui/react';
import { Link as HeroLink } from '@heroui/link';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useRealtimeLeaderboard } from '../hooks/useRealtimeLeaderboard';
import Leaderboard from '../components/Leaderboard';
import AuditLog from '../components/AuditLog';

export default function EventPage() {
  const { id } = useParams();
  const { user, profile } = useAuth();
  const [event, setEvent] = useState(null);
  const [teams, setTeams] = useState([]);
  const [judges, setJudges] = useState([]);
  const [auditItems, setAuditItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { isOpen: isTeamOpen, onOpen: onTeamOpen, onClose: onTeamClose } = useDisclosure();
  const [teamName, setTeamName] = useState('');
  const [teamSaving, setTeamSaving] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);

  const { isOpen: isJudgeOpen, onOpen: onJudgeOpen, onClose: onJudgeClose } = useDisclosure();
  const [judgeQuery, setJudgeQuery] = useState('');
  const [judgeSaving, setJudgeSaving] = useState(false);
  const [judgeSearchResults, setJudgeSearchResults] = useState([]);

  const isAdmin = profile?.role === 'admin';
  const canManage = event && (isAdmin || event.created_by === user?.id);
  const canJudge = event && (canManage || (judges.some((j) => j.user_id === user?.id)));

  const fetch = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [eRes, tRes, jRes, aRes] = await Promise.all([
      supabase.from('events').select('*').eq('id', id).single(),
      supabase.from('teams').select('*').eq('event_id', id).order('created_at'),
      supabase.from('event_judges').select('user_id, created_at').eq('event_id', id),
      supabase.from('score_history').select('*, teams(name)').eq('event_id', id).order('created_at', { ascending: false }).limit(100),
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
      return;
    }
    setEvent(eRes.data);
    setTeams(tRes.data || []);
    setJudges(jRes.data || []);
    setAuditItems(aRes.data || []);
    setError('');
  }, [id]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  useRealtimeLeaderboard(id, setTeams);

  const openAddTeam = () => {
    setEditingTeam(null);
    setTeamName('');
    onTeamOpen();
  };

  const openEditTeam = (t) => {
    setEditingTeam(t);
    setTeamName(t.name);
    onTeamOpen();
  };

  const saveTeam = async () => {
    const name = teamName.trim();
    if (!name) return;
    setTeamSaving(true);
    if (editingTeam) {
      const { error: e } = await supabase.from('teams').update({ name }).eq('id', editingTeam.id);
      setTeamSaving(false);
      if (e) {
        setError(e.message);
        return;
      }
    } else {
      const { error: e } = await supabase.from('teams').insert([{ event_id: id, name }]);
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
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h1 className="text-2xl font-bold">{event?.name}</h1>
        <div>
          {canManage && (
            <Button as={Link} to={`/events/${id}/edit`} size="sm" variant="flat">
              Edit event
            </Button>
          )}
          {/** add share event link button copy to clipboard*/}
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

      <Tabs aria-label="Event sections">
        <Tab key="details" title="Details">
          <div className="pt-4 space-y-2">
            <p><span className="text-default-500">Description:</span> {event?.description || '—'}</p>
            <p><span className="text-default-500">Type:</span> {event?.type}</p>
            <p><span className="text-default-500">Visibility:</span> {event?.visibility}</p>
          </div>
        </Tab>
        <Tab key="teams" title="Teams">
          <div className="pt-4">
            {canManage && (
              <Button size="sm" color="primary" className="mb-3" onPress={openAddTeam}>
                Add team
              </Button>
            )}
            <Table aria-label="Teams">
              <TableHeader>
                <TableColumn>NAME</TableColumn>
                {canManage && <TableColumn align="end">ACTIONS</TableColumn>}
              </TableHeader>
              <TableBody>
                {teams.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{t.name}</TableCell>
                    {canManage && (
                      <TableCell align="right">
                        <Button size="sm" variant="light" onPress={() => openEditTeam(t)}>Edit</Button>
                        <Button size="sm" color="danger" variant="light" onPress={() => removeTeam(t.id)}>Remove</Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Tab>
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
        <Tab key="judges" title="Judges">
          <div className="pt-4">
            {canManage && (
              <Button size="sm" color="primary" className="mb-3" onPress={openAddJudge}>
                Add judge
              </Button>
            )}
            <Table aria-label="Judges">
              <TableHeader>
                <TableColumn>JUDGE</TableColumn>
                <TableColumn>USER ID</TableColumn>
                {canManage && <TableColumn align="end">ACTIONS</TableColumn>}
              </TableHeader>
              <TableBody>
                {judges.map((j) => (
                  <TableRow key={j.user_id}>
                    {/* 👤 Profile cell */}
                    <TableCell>
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
                    </TableCell>

                    {/* 🆔 UUID */}
                    <TableCell>
                      <code className="text-xs text-foreground-500">
                        {j.user_id}
                      </code>
                    </TableCell>

                    {/* 🧨 Actions */}
                    {canManage && (
                      <TableCell align="right">
                        <Button
                          size="sm"
                          color="danger"
                          variant="light"
                          onPress={() => removeJudge(j.user_id)}
                        >
                          Remove
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Tab>
        <Tab key="audit" title="Audit log">
          <div className="pt-4">
            <AuditLog items={auditItems} currentUserId={user?.id} />
          </div>
        </Tab>
      </Tabs>

      <Modal isOpen={isTeamOpen} onClose={onTeamClose}>
        <ModalContent>
          <ModalHeader>{editingTeam ? 'Edit team' : 'Add team'}</ModalHeader>
          <ModalBody>
            <Input label="Name" value={teamName} onValueChange={setTeamName} placeholder="Team name" />
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
    </div>
  );
}
