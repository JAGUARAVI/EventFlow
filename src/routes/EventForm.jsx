import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  Input, 
  Textarea, 
  Select, 
  SelectItem, 
  Button, 
  Checkbox,
  Card,
  CardBody,
  Chip,
  Avatar,
  Divider,
  addToast,
  Tabs,
  Tab,
} from '@heroui/react';
import { Search, UserPlus, Shield, Settings, Users } from 'lucide-react';
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
  const [leaderboardSortOrder, setLeaderboardSortOrder] = useState('desc');
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(isEdit);
  const [error, setError] = useState('');
  
  // Co-organizers (managers) state
  const [managers, setManagers] = useState([]);
  const [managerQuery, setManagerQuery] = useState('');
  const [managerSearchResults, setManagerSearchResults] = useState([]);
  const [managerSearching, setManagerSearching] = useState(false);
  const [eventCreatedBy, setEventCreatedBy] = useState(null);
  const [eventCreator, setEventCreator] = useState(null);

  // Fetch event data and managers
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
      setEventCreatedBy(data.created_by);
      
      // Fetch creator profile
      const { data: creatorProfile } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, email')
        .eq('id', data.created_by)
        .single();
      if (creatorProfile) {
        setEventCreator(creatorProfile);
      }
      
      // Check if user can manage - include co-managers
      const { data: managerCheck } = await supabase
        .from('event_judges')
        .select('can_manage')
        .eq('event_id', id)
        .eq('user_id', user?.id)
        .eq('can_manage', true)
        .maybeSingle();
      
      const canManage = user && (profile?.role === 'admin' || data.created_by === user.id || managerCheck?.can_manage);
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
      setLeaderboardSortOrder(settings.leaderboard_sort_order || 'desc');
      
      // Fetch co-managers
      const { data: managersData } = await supabase
        .from('event_judges')
        .select('user_id, can_manage, profiles:user_id(id, display_name, avatar_url, email)')
        .eq('event_id', id)
        .eq('can_manage', true);
      
      if (managersData) {
        setManagers(managersData.map(m => ({
          id: m.user_id,
          display_name: m.profiles?.display_name,
          avatar_url: m.profiles?.avatar_url,
          email: m.profiles?.email,
        })));
      }
    })();
  }, [id, isEdit, user, profile?.role, navigate, authLoading]);

  // Search for users to add as managers
  const searchManagers = async (query) => {
    setManagerQuery(query);
    if (!query.trim()) {
      setManagerSearchResults([]);
      return;
    }
    setManagerSearching(true);
    const { data, error } = await supabase.rpc('search_profiles', { q: query.trim() });
    setManagerSearching(false);
    if (error) {
      console.error(error);
      setManagerSearchResults([]);
      return;
    }
    // Filter out existing managers, the event creator, and current user
    const filtered = (data || []).filter(p => 
      !managers.some(m => m.id === p.id) && 
      p.id !== eventCreatedBy &&
      p.id !== user?.id
    );
    setManagerSearchResults(filtered);
  };

  // Add a co-manager
  const addManager = async (userToAdd) => {
    // Check if they're already a judge
    const { data: existing } = await supabase
      .from('event_judges')
      .select('*')
      .eq('event_id', id)
      .eq('user_id', userToAdd.id)
      .maybeSingle();
    
    if (existing) {
      // Update existing record
      const { error } = await supabase
        .from('event_judges')
        .update({ can_manage: true })
        .eq('event_id', id)
        .eq('user_id', userToAdd.id);
      
      if (error) {
        addToast({ title: 'Failed to grant manage access', description: error.message, severity: 'danger' });
        return;
      }
    } else {
      // Insert new record
      const { error } = await supabase
        .from('event_judges')
        .insert({ event_id: id, user_id: userToAdd.id, can_manage: true });
      
      if (error) {
        addToast({ title: 'Failed to add manager', description: error.message, severity: 'danger' });
        return;
      }
    }
    
    // Audit log
    await supabase.from('event_audit').insert({
      event_id: id,
      action: 'manager.add',
      entity_type: 'manager',
      entity_id: userToAdd.id,
      message: `Granted manage access to ${userToAdd.display_name || 'user'}`,
      created_by: user?.id,
      metadata: { user_id: userToAdd.id, display_name: userToAdd.display_name },
    });
    
    setManagers(prev => [...prev, {
      id: userToAdd.id,
      display_name: userToAdd.display_name,
      avatar_url: userToAdd.avatar_url,
      email: userToAdd.email,
    }]);
    setManagerQuery('');
    setManagerSearchResults([]);
    addToast({ title: `${userToAdd.display_name || 'User'} can now manage this event`, severity: 'success' });
  };

  // Remove a co-manager
  const removeManager = async (managerId) => {
    const managerToRemove = managers.find(m => m.id === managerId);
    
    // Check if they're also a judge (without manage access they stay as judge)
    const { error } = await supabase
      .from('event_judges')
      .update({ can_manage: false })
      .eq('event_id', id)
      .eq('user_id', managerId);
    
    if (error) {
      addToast({ title: 'Failed to remove manager', description: error.message, severity: 'danger' });
      return;
    }
    
    // Audit log
    await supabase.from('event_audit').insert({
      event_id: id,
      action: 'manager.remove',
      entity_type: 'manager',
      entity_id: managerId,
      message: `Revoked manage access from ${managerToRemove?.display_name || 'user'}`,
      created_by: user?.id,
      metadata: { user_id: managerId, display_name: managerToRemove?.display_name },
    });
    
    setManagers(prev => prev.filter(m => m.id !== managerId));
    addToast({ title: 'Manage access revoked', severity: 'success' });
  };

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
        leaderboard_sort_order: leaderboardSortOrder,
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
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">{isEdit ? 'Edit event' : 'New event'}</h1>
      {error && <p className="text-danger text-sm mb-2">{error}</p>}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {isEdit ? (
          <Tabs aria-label="Event settings" classNames={{ panel: "pt-4" }}>
            <Tab
              key="general"
              title={
                <div className="flex items-center gap-2">
                  <Settings size={16} />
                  <span>General</span>
                </div>
              }
            >
              <div className="flex flex-col gap-4">
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
                <Card className="border border-default-200">
                  <CardBody className="gap-2">
                    <p className="text-sm font-medium">Tab Visibility Settings</p>
                    <p className="text-xs text-default-500 mb-2">Control which tabs are visible to non-managers</p>
                    <Checkbox isSelected={hideAnalytics} onValueChange={setHideAnalytics}>
                      Hide Analytics tab from viewers
                    </Checkbox>
                    <Checkbox isSelected={hideTimeline} onValueChange={setHideTimeline}>
                      Hide Timeline tab from viewers
                    </Checkbox>
                    <Checkbox isSelected={hideJudges} onValueChange={setHideJudges}>
                      Hide Judges tab from viewers
                    </Checkbox>
                  </CardBody>
                </Card>
                <Select
                  label="Leaderboard Sort Order"
                  selectedKeys={[leaderboardSortOrder]}
                  onSelectionChange={(s) => setLeaderboardSortOrder([...s][0] || 'desc')}
                  description="Choose how teams are ranked on the leaderboard"
                >
                  <SelectItem key="desc">Descending (highest score first)</SelectItem>
                  <SelectItem key="asc">Ascending (lowest score first)</SelectItem>
                </Select>
              </div>
            </Tab>
            
            <Tab
              key="access"
              title={
                <div className="flex items-center gap-2">
                  <Users size={16} />
                  <span>Manage Access</span>
                </div>
              }
            >
              <div className="flex flex-col gap-4">
                <Card className="border border-default-200">
                  <CardBody className="gap-4">
                    <div className="flex items-center gap-2">
                      <Shield size={18} className="text-primary" />
                      <h3 className="font-semibold">Event Organizers</h3>
                    </div>
                    <p className="text-sm text-default-500">
                      Co-organizers have full manage access to this event, including editing settings, managing teams, and viewing audit logs.
                    </p>
                    
                    {/* Event Creator (read-only) */}
                    {eventCreator && (
                      <div className="flex items-center gap-3 p-3 bg-default-100 rounded-lg">
                        <Avatar
                          src={eventCreator.avatar_url}
                          name={(eventCreator.display_name || eventCreator.email)?.[0]}
                          size="sm"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{eventCreator.display_name || eventCreator.email || 'Unknown'}</p>
                          <p className="text-xs text-default-500">Event Creator</p>
                        </div>
                        <Chip size="sm" variant="flat" color="primary">Owner</Chip>
                      </div>
                    )}
                    
                    <Divider />
                    
                    {/* Search input */}
                    <div className="relative">
                      <Input
                        placeholder="Search users by name or email..."
                        value={managerQuery}
                        onValueChange={searchManagers}
                        startContent={<Search size={16} className="text-default-400" />}
                        description="Add users who should have manage access"
                      />
                      
                      {/* Search results dropdown */}
                      {managerSearchResults.length > 0 && (
                        <Card className="absolute z-10 w-full mt-1 shadow-lg border border-default-200">
                          <CardBody className="p-2 gap-1">
                            {managerSearchResults.map((result) => (
                              <div
                                key={result.id}
                                className="flex items-center justify-between p-2 hover:bg-default-100 rounded-lg cursor-pointer"
                                onClick={() => addManager(result)}
                              >
                                <div className="flex items-center gap-2">
                                  <Avatar
                                    src={result.avatar_url}
                                    name={result.display_name?.[0]}
                                    size="sm"
                                  />
                                  <span className="text-sm">{result.display_name || result.email || result.id}</span>
                                </div>
                                <UserPlus size={16} className="text-primary" />
                              </div>
                            ))}
                          </CardBody>
                        </Card>
                      )}
                      
                      {managerSearching && (
                        <p className="text-xs text-default-400 mt-1">Searching...</p>
                      )}
                    </div>
                    
                    {/* Current managers list */}
                    {managers.length > 0 && (
                      <>
                        <Divider />
                        <div>
                          <p className="text-sm font-medium mb-2">Co-Organizers</p>
                          <div className="flex flex-wrap gap-2">
                            {managers.map((manager) => (
                              <Chip
                                key={manager.id}
                                variant="flat"
                                onClose={() => removeManager(manager.id)}
                                avatar={
                                  <Avatar
                                    src={manager.avatar_url}
                                    name={(manager.display_name || manager.email)?.[0]}
                                    size="sm"
                                  />
                                }
                              >
                                {manager.display_name || manager.email || 'User'}
                              </Chip>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                    
                    {managers.length === 0 && (
                      <p className="text-sm text-default-400 text-center py-2">
                        No co-organizers added yet
                      </p>
                    )}
                  </CardBody>
                </Card>
              </div>
            </Tab>
          </Tabs>
        ) : (
          /* Non-edit mode: show simple form without tabs */
          <>
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
            <Select
              label="Leaderboard Sort Order"
              selectedKeys={[leaderboardSortOrder]}
              onSelectionChange={(s) => setLeaderboardSortOrder([...s][0] || 'desc')}
              description="Choose how teams are ranked on the leaderboard"
            >
              <SelectItem key="desc">Descending (highest score first)</SelectItem>
              <SelectItem key="asc">Ascending (lowest score first)</SelectItem>
            </Select>
          </>
        )}
        
        <div className="flex gap-2 pt-4">
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
