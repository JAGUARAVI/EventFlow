import { useState, useEffect, useMemo } from 'react';
import { Card, CardBody, CardHeader, Input, Button, Select, SelectItem, Chip, Avatar, Pagination, addToast } from '@heroui/react';
import { Search, UserCog, Shield, ArrowUpDown, ArrowUp, ArrowDown, Pencil, Check, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

const ROLES = [
  { key: 'all', label: 'All Roles' },
  { key: 'admin', label: 'Admin' },
  { key: 'club_coordinator', label: 'Club Coordinator' },
  { key: 'judge', label: 'Judge' },
  { key: 'viewer', label: 'Viewer' },
];

const SORT_OPTIONS = [
  { key: 'display_name_asc', label: 'Name (A-Z)', field: 'display_name', dir: 'asc' },
  { key: 'display_name_desc', label: 'Name (Z-A)', field: 'display_name', dir: 'desc' },
  { key: 'email_asc', label: 'Email (A-Z)', field: 'email', dir: 'asc' },
  { key: 'email_desc', label: 'Email (Z-A)', field: 'email', dir: 'desc' },
  { key: 'role_asc', label: 'Role (A-Z)', field: 'role', dir: 'asc' },
  { key: 'role_desc', label: 'Role (Z-A)', field: 'role', dir: 'desc' },
];

const ITEMS_PER_PAGE = 10;

export default function AdminRoles() {
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [sortKey, setSortKey] = useState('display_name_asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [editingName, setEditingName] = useState(null);
  const [editNameValue, setEditNameValue] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, roleFilter, sortKey]);

  const filteredAndSortedUsers = useMemo(() => {
    let result = [...users];

    // Filter by search query
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (u) =>
          u.display_name?.toLowerCase().includes(query) ||
          u.email?.toLowerCase().includes(query)
      );
    }

    // Filter by role
    if (roleFilter !== 'all') {
      result = result.filter((u) => (u.role || 'viewer') === roleFilter);
    }

    // Sort
    const sortOption = SORT_OPTIONS.find((s) => s.key === sortKey);
    if (sortOption) {
      result.sort((a, b) => {
        const aVal = (a[sortOption.field] || '').toLowerCase();
        const bVal = (b[sortOption.field] || '').toLowerCase();
        if (aVal < bVal) return sortOption.dir === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortOption.dir === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [users, searchQuery, roleFilter, sortKey]);

  // Paginated users
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAndSortedUsers.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredAndSortedUsers, currentPage]);

  const totalPages = Math.ceil(filteredAndSortedUsers.length / ITEMS_PER_PAGE);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, email, avatar_url, role')
      .order('display_name');

    if (!error && data) {
      setUsers(data);
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

  const startEditingName = (user) => {
    setEditingName(user.id);
    setEditNameValue(user.display_name || '');
  };

  const cancelEditingName = () => {
    setEditingName(null);
    setEditNameValue('');
  };

  const saveDisplayName = async (userId) => {
    const trimmedName = editNameValue.trim();
    if (!trimmedName) {
      addToast({ title: 'Display name cannot be empty', color: 'danger' });
      return;
    }

    setUpdating(userId);
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: trimmedName })
      .eq('id', userId);

    if (error) {
      addToast({ title: 'Failed to update display name', description: error.message, color: 'danger' });
    } else {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, display_name: trimmedName } : u))
      );
      addToast({ title: 'Display name updated', color: 'success' });
    }
    setUpdating(null);
    setEditingName(null);
    setEditNameValue('');
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
          <div className="flex flex-col sm:flex-row gap-4">
            <Input
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              startContent={<Search className="w-4 h-4" />}
              isClearable
              onClear={() => setSearchQuery('')}
              className="flex-1"
            />
            <Select
              label="Filter by Role"
              selectedKeys={[roleFilter]}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full sm:w-48"
              size="sm"
            >
              {ROLES.map((role) => (
                <SelectItem key={role.key} value={role.key}>
                  {role.label}
                </SelectItem>
              ))}
            </Select>
            <Select
              label="Sort by"
              selectedKeys={[sortKey]}
              onChange={(e) => setSortKey(e.target.value)}
              className="w-full sm:w-48"
              size="sm"
              startContent={<ArrowUpDown className="w-4 h-4" />}
            >
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.key} value={option.key}>
                  {option.label}
                </SelectItem>
              ))}
            </Select>
          </div>
        </CardBody>
      </Card>

      <div className="mb-4 text-sm text-default-500">
        Showing {paginatedUsers.length} of {filteredAndSortedUsers.length} users
        {roleFilter !== 'all' && ` (filtered by ${ROLES.find(r => r.key === roleFilter)?.label})`}
      </div>

      <div className="space-y-3">
        {paginatedUsers.map((user) => (
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
                    {editingName === user.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          size="sm"
                          value={editNameValue}
                          onChange={(e) => setEditNameValue(e.target.value)}
                          placeholder="Display name"
                          className="max-w-xs"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveDisplayName(user.id);
                            if (e.key === 'Escape') cancelEditingName();
                          }}
                        />
                        <Button
                          isIconOnly
                          size="sm"
                          color="success"
                          variant="flat"
                          onPress={() => saveDisplayName(user.id)}
                          isLoading={updating === user.id}
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          isIconOnly
                          size="sm"
                          variant="flat"
                          onPress={cancelEditingName}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">
                          {user.display_name || 'No Name'}
                        </span>
                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          onPress={() => startEditingName(user)}
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
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

      {totalPages > 1 && (
        <div className="flex justify-center mt-6">
          <Pagination
            total={totalPages}
            page={currentPage}
            onChange={setCurrentPage}
            showControls
            showShadow
          />
        </div>
      )}

      {filteredAndSortedUsers.length === 0 && (
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
