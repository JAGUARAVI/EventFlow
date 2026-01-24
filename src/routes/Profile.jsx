import { useState, useEffect } from 'react';
import { Input, Button, Card, CardBody, Spinner, addToast } from '@heroui/react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

export default function Profile() {
  const { user, profile, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!profile);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setAvatarUrl(profile.avatar_url || '');
      setLoading(false);
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: displayName.trim() || null,
        avatar_url: avatarUrl.trim() || null,
      })
      .eq('id', user.id);
    setSaving(false);
    if (error) {
      addToast({ title: 'Save failed', description: error.message, severity: 'danger' });
      return;
    }
    await refreshProfile();
    addToast({ title: 'Profile updated', severity: 'success' });
  };

  if (loading) {
    return (
      <div className="p-6 flex justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-6">Profile</h1>

      <div className="space-y-4">
        <Card>
          <CardBody className="text-sm text-default-500">
            <p><strong>User ID:</strong></p>
            <code className="text-xs break-all">{user?.id}</code>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="text-sm text-default-500">
            <p><strong>Email:</strong></p>
            <p>{user?.email || '—'}</p>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="text-sm text-default-500">
            <p><strong>Role:</strong></p>
            <p className="capitalize font-semibold">{profile?.role || '—'}</p>
          </CardBody>
        </Card>
      </div>

      <div className="space-y-4 mt-6">
        <Input
          label="Display Name"
          placeholder="Your name"
          value={displayName}
          onValueChange={setDisplayName}
        />

        <Input
          label="Avatar URL"
          placeholder="https://..."
          value={avatarUrl}
          onValueChange={setAvatarUrl}
          type="url"
        />

        <Button
          color="primary"
          fullWidth
          onPress={handleSave}
          isLoading={saving}
        >
          Save changes
        </Button>
      </div>
    </div>
  );
}
