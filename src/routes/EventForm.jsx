import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Input, Textarea, Select, SelectItem, Button } from '@heroui/react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

const EVENT_TYPES = [
  { value: 'points', label: 'Points' },
  { value: 'bracket', label: 'Bracket' },
  { value: 'poll', label: 'Poll' },
  { value: 'hybrid', label: 'Hybrid' },
];

const VISIBILITY = [
  { value: 'public', label: 'Public' },
  { value: 'private', label: 'Private' },
];

export default function EventForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const isEdit = Boolean(id);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('points');
  const [visibility, setVisibility] = useState('private');
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(isEdit);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isEdit) return;
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
      setType(data.type || 'points');
      setVisibility(data.visibility || 'private');
    })();
  }, [id, isEdit, user, profile?.role, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const payload = { name: name.trim(), description: description.trim() || null, type, visibility, updated_at: new Date().toISOString() };

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
        <Select label="Type" selectedKeys={[type]} onSelectionChange={(s) => setType([...s][0] || 'points')}>
          {EVENT_TYPES.map((o) => (
            <SelectItem key={o.value}>{o.label}</SelectItem>
          ))}
        </Select>
        <Select label="Visibility" selectedKeys={[visibility]} onSelectionChange={(s) => setVisibility([...s][0] || 'private')}>
          {VISIBILITY.map((o) => (
            <SelectItem key={o.value}>{o.label}</SelectItem>
          ))}
        </Select>
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
