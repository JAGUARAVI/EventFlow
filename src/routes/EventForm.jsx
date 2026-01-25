import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Input, Textarea, Select, SelectItem, Button, Checkbox } from '@heroui/react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

const EVENT_TYPES = [
  { value: 'points', label: 'Points' },
  { value: 'bracket', label: 'Bracket' },
  { value: 'poll', label: 'Poll' },
];

const VISIBILITY = [
  { value: 'public', label: 'Public' },
  { value: 'private', label: 'Private' },
];

export default function EventForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const isEdit = Boolean(id);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [types, setTypes] = useState(['points']);
  const [visibility, setVisibility] = useState('private');
  const [bannerUrl, setBannerUrl] = useState('');
  const [hideAnalytics, setHideAnalytics] = useState(false);
  const [hideTimeline, setHideTimeline] = useState(false);
  const [hideJudges, setHideJudges] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(isEdit);
  const [error, setError] = useState('');

  useEffect(() => {
    // Wait for auth to finish loading before fetching event
    if (authLoading) return;
    if (!isEdit) {
      setFetchLoading(false);
      return;
    }
    (async () => {
      const { data, error: e } = await supabase.from('events').select('*').eq('id', id).single();
      setFetchLoading(false);
      if (e || !data) {
        setError('Event not found');
        return;
      }
      const canManage = user && (profile?.role === 'admin' || data.created_by === user.id);
      if (!canManage) {
        setError('You cannot edit this event');
        setTimeout(() => navigate(`/events/${id}`), 1500);
        return;
      }
      setName(data.name || '');
      setDescription(data.description || '');
      if (Array.isArray(data.event_types) && data.event_types.length > 0) {
        setTypes(data.event_types);
      } else if (data.type === 'hybrid') {
        setTypes(['points', 'bracket', 'poll']);
      } else if (data.type) {
        setTypes([data.type]);
      } else {
        setTypes(['points']);
      }
      setVisibility(data.visibility || 'private');
      setBannerUrl(data.banner_url || '');
      const settings = data.settings || {};
      setHideAnalytics(settings.hide_analytics || false);
      setHideTimeline(settings.hide_timeline || false);
      setHideJudges(settings.hide_judges || false);
    })();
  }, [id, isEdit, user, profile?.role, navigate, authLoading]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const normalizedTypes = types.length > 0 ? types : ['points'];
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      type: normalizedTypes[0] || 'points',
      event_types: normalizedTypes,
      visibility,
      banner_url: bannerUrl.trim() || null,
      settings: {
        hide_analytics: hideAnalytics,
        hide_timeline: hideTimeline,
        hide_judges: hideJudges,
      },
      updated_at: new Date().toISOString(),
    };

    if (isEdit) {
      const { error: e } = await supabase.from('events').update(payload).eq('id', id);
      setLoading(false);
      if (e) {
        setError(e.message || 'Update failed');
        return;
      }
      navigate(`/events/${id}`);
    } else {
      const { data, error: e } = await supabase.from('events').insert([{ ...payload, created_by: user.id }]).select('id').single();
      setLoading(false);
      if (e) {
        setError(e.message || 'Create failed');
        return;
      }
      navigate(`/events/${data.id}`);
    }
  };

  if (fetchLoading) {
    return (
      <div className="p-6 flex justify-center">
        <p className="text-default-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">{isEdit ? 'Edit event' : 'New event'}</h1>
      {error && <p className="text-danger text-sm mb-2">{error}</p>}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Name"
          placeholder="Event name"
          value={name}
          onValueChange={setName}
          isRequired
        />
        <Textarea
          label="Description"
          placeholder="Optional description"
          value={description}
          onValueChange={setDescription}
        />
        <Input
          label="Banner Image URL"
          placeholder="https://example.com/banner.jpg (optional)"
          value={bannerUrl}
          onValueChange={setBannerUrl}
          description="Add a banner image to display at the top of your event page"
        />
        <Select
          label="Event types"
          selectionMode="multiple"
          selectedKeys={new Set(types)}
          onSelectionChange={(s) => {
            const next = Array.from(s);
            setTypes(next.length ? next : ['points']);
          }}
        >
          {EVENT_TYPES.map((o) => (
            <SelectItem key={o.value}>{o.label}</SelectItem>
          ))}
        </Select>
        <Select label="Visibility" selectedKeys={[visibility]} onSelectionChange={(s) => setVisibility([...s][0] || 'private')}>
          {VISIBILITY.map((o) => (
            <SelectItem key={o.value}>{o.label}</SelectItem>
          ))}
        </Select>
        <div className="space-y-2">
          <p className="text-sm text-default-500">Tab Visibility Settings (for non-managers)</p>
          <Checkbox isSelected={hideAnalytics} onValueChange={setHideAnalytics}>
            Hide Analytics tab from viewers
          </Checkbox>
          <Checkbox isSelected={hideTimeline} onValueChange={setHideTimeline}>
            Hide Timeline tab from viewers
          </Checkbox>
          <Checkbox isSelected={hideJudges} onValueChange={setHideJudges}>
            Hide Judges tab from viewers
          </Checkbox>
        </div>
        <div className="flex gap-2">
          <Button type="submit" color="primary" isLoading={loading}>
            {isEdit ? 'Save' : 'Create'}
          </Button>
          <Button type="button" variant="flat" onPress={() => navigate(isEdit ? `/events/${id}` : '/dashboard')}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
