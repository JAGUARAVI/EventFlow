import { useState, useEffect } from 'react';
import { Card, CardBody, CardHeader, Input, Button, Select, SelectItem, Chip, Avatar } from '@heroui/react';
import { Search, UserCog, Shield } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function AdminRoles() {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredUsers(users);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredUsers(
        users.filter(
          (u) =>
            u.display_name?.toLowerCase().includes(query) ||
            u.email?.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, users]);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, email, avatar_url, role')
      .order('display_name');

    if (!error && data) {
      setUsers(data);
      setFilteredUsers(data);
    }
    setLoading(false);
  };

  const updateUserRole = async (userId, newRole) => {
    setUpdating(userId);
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);

    if (!error) {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
    }
    setUpdating(null);
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin':
        return 'danger';
      case 'club_coordinator':
        return 'warning';
      case 'judge':
        return 'primary';
      case 'viewer':
      default:
        return 'default';
    }
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'admin':
        return 'Admin';
      case 'club_coordinator':
        return 'Club Coordinator';
      case 'judge':
        return 'Judge';
      case 'viewer':
      default:
        return 'Viewer';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2 mb-2">
          <Shield className="w-8 h-8" />
          User Role Management
        </h1>
        <p className="text-default-500">
          Manage user roles and permissions across the platform.
        </p>
      </div>

      <Card className="mb-6">
        <CardBody>
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            startContent={<Search className="w-4 h-4" />}
            isClearable
            onClear={() => setSearchQuery('')}
          />
        </CardBody>
      </Card>

      <div className="space-y-3">
        {filteredUsers.map((user) => (
          <Card key={user.id}>
            <CardBody>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <Avatar
                    src={user.avatar_url}
                    name={user.display_name || user.email}
                    size="md"
                  />
                  <div className="flex-1">
                    <div className="font-semibold">
                      {user.display_name || 'No Name'}
                    </div>
                    <div className="text-sm text-default-500">{user.email}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Chip color={getRoleColor(user.role)} variant="flat">
                    {getRoleLabel(user.role)}
                  </Chip>

                  <Select
                    label="Change Role"
                    selectedKeys={[user.role || 'viewer']}
                    onChange={(e) => updateUserRole(user.id, e.target.value)}
                    disabled={updating === user.id}
                    className="w-48"
                    size="sm"
                  >
                    <SelectItem key="viewer" value="viewer">
                      Viewer
                    </SelectItem>
                    {/*<SelectItem key="judge" value="judge">
                      Judge
                    </SelectItem>*/}
                    <SelectItem key="club_coordinator" value="club_coordinator">
                      Club Coordinator
                    </SelectItem>
                    <SelectItem key="admin" value="admin">
                      Admin
                    </SelectItem>
                  </Select>
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {filteredUsers.length === 0 && (
        <Card>
          <CardBody>
            <div className="text-center text-default-500 py-8">
              No users found matching your search.
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
