import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, CardBody, Spinner } from '@heroui/react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

export default function Dashboard() {
  const { user, profile } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  const canCreate = profile && ['admin', 'club_coordinator'].includes(profile.role);
  const isAdmin = profile && profile.role === 'admin';
  const isViewer = profile && profile.role === 'viewer';

  useEffect(() => {
    if (!user?.id || !profile?.role) return;
    (async () => {
      const baseEventsQuery = supabase
        .from('events')
        .select('id, name, type, event_types, visibility, created_at')
        .order('created_at', { ascending: false });

      const [created, judged] = await Promise.all([
        isAdmin
          ? baseEventsQuery
          : isViewer
            ? baseEventsQuery.eq('visibility', 'public')
            : baseEventsQuery.eq('created_by', user.id),
        supabase.from('event_judges').select('event_id').eq('user_id', user.id),
      ]);

      const ids = new Set((created.data || []).map((e) => e.id));
      for (const j of judged.data || []) {
        if (!ids.has(j.event_id)) ids.add(j.event_id);
      }
      const extra = [...ids].filter((x) => !(created.data || []).some((e) => e.id === x));
      let more = [];
      if (extra.length) {
        const { data } = await supabase.from('events').select('id, name, type, event_types, visibility, created_at').in('id', extra);
        more = data || [];
      }
      const merged = [...(created.data || []), ...more];
      merged.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setEvents(merged);

      if (isAdmin) {
        const [
          eventsCount,
          teamsCount,
          matchesCount,
          pollsCount,
          votesCount,
          judgesCount,
          openPollsCount,
        ] = await Promise.all([
          supabase.from('events').select('id', { count: 'exact', head: true }),
          supabase.from('teams').select('id', { count: 'exact', head: true }),
          supabase.from('matches').select('id', { count: 'exact', head: true }),
          supabase.from('polls').select('id', { count: 'exact', head: true }),
          supabase.from('votes').select('id', { count: 'exact', head: true }),
          supabase.from('event_judges').select('event_id', { count: 'exact', head: true }),
          supabase.from('polls').select('id', { count: 'exact', head: true }).eq('status', 'open'),
        ]);
        setStats({
          events: eventsCount.count || 0,
          teams: teamsCount.count || 0,
          matches: matchesCount.count || 0,
          polls: pollsCount.count || 0,
          votes: votesCount.count || 0,
          judges: judgesCount.count || 0,
          openPolls: openPollsCount.count || 0,
        });
      }

      setLoading(false);
    })();
  }, [user?.id, profile?.role, isAdmin, isViewer]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-default-500 text-sm">Role: {profile?.role ?? '—'}</p>
        </div>
        {canCreate && (
          <Button as={Link} to="/events/new" color="primary">
            Create event
          </Button>
        )}
      </div>

      {isAdmin && stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
          <StatCard label="Events" value={stats.events} />
          <StatCard label="Teams" value={stats.teams} />
          <StatCard label="Judges" value={stats.judges} />
          <StatCard label="Matches" value={stats.matches} />
          <StatCard label="Polls" value={stats.polls} />
          <StatCard label="Open polls" value={stats.openPolls} />
          <StatCard label="Votes" value={stats.votes} />
        </div>
      )}

      <h2 className="text-lg font-semibold mb-3">
        {isViewer ? 'Public events' : 'Your events'}
      </h2>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : events.length === 0 ? (
        <p className="text-default-500">No events yet. {canCreate && 'Create one to get started.'}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {events.map((e) => (
            <Card key={e.id} as={Link} to={`/events/${e.id}`} isPressable className="text-left">
              <CardBody className="flex flex-row items-center justify-between">
                <div>
                  <p className="font-semibold">{e.name}</p>
                  <p className="text-sm text-default-500">
                    {(Array.isArray(e.event_types) && e.event_types.length > 0 ? e.event_types.join(', ') : e.type)} · {e.visibility}
                  </p>
                </div>
                <span className="text-default-400">→</span>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <Card>
      <CardBody className="text-center">
        <p className="text-xs text-default-500 uppercase tracking-wide">{label}</p>
        <p className="text-xl font-semibold">{value}</p>
      </CardBody>
    </Card>
  );
}
