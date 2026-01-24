import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, CardBody, Spinner } from '@heroui/react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

export default function Dashboard() {
  const { user, profile } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const canCreate = profile && ['admin', 'club_coordinator'].includes(profile.role);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const [created, judged] = await Promise.all([
        supabase.from('events').select('id, name, type, visibility, created_at').eq('created_by', user.id).order('created_at', { ascending: false }),
        supabase.from('event_judges').select('event_id').eq('user_id', user.id),
      ]);
      const ids = new Set((created.data || []).map((e) => e.id));
      for (const j of judged.data || []) {
        if (!ids.has(j.event_id)) ids.add(j.event_id);
      }
      const extra = [...ids].filter((x) => !(created.data || []).some((e) => e.id === x));
      let more = [];
      if (extra.length) {
        const { data } = await supabase.from('events').select('id, name, type, visibility, created_at').in('id', extra);
        more = data || [];
      }
      const merged = [...(created.data || []), ...more];
      merged.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setEvents(merged);
      setLoading(false);
    })();
  }, [user?.id]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        {canCreate && (
          <Button as={Link} to="/events/new" color="primary">
            Create event
          </Button>
        )}
      </div>
      <p className="text-default-500 mb-4">Role: {profile?.role ?? '—'}</p>

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
                  <p className="text-sm text-default-500">{e.type} · {e.visibility}</p>
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
