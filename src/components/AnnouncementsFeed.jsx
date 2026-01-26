import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Card,
  CardBody,
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Textarea,
  Input,
  Avatar,
  Divider,
  Spinner,
} from '@heroui/react';
import { Pin, PinOff, Trash2, Plus, Edit2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { supabase } from '../lib/supabase';
import { playNotificationSound, sendPushNotification } from '../lib/notifications';
import { useAuth } from '../hooks/useAuth';
import { useRealtimeTable } from '../context/RealtimeContext';

export default function AnnouncementsFeed({ eventId, canManage = false }) {
  const { user, profile } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const userIdRef = useRef(user?.id);
  const isMountedRef = useRef(true);

  useEffect(() => {
    userIdRef.current = user?.id;
  }, [user?.id]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchProfile = async (userId) => {
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, email')
      .eq('id', userId)
      .single();
    return data || { id: userId };
  };

  const handleRealtimeChange = useCallback(async (payload) => {
    if (!isMountedRef.current) return;

    if (payload.eventType === 'INSERT') {
      const author = await fetchProfile(payload.new.created_by);
      if (!isMountedRef.current) return;
      
      setAnnouncements((prev) => {
        // Avoid duplicates
        if (prev.some(a => a.id === payload.new.id)) return prev;
        return [{ ...payload.new, author }, ...prev];
      });

      if (payload.new.created_by !== userIdRef.current) {
        playNotificationSound('announcement.wav');
        sendPushNotification({
          title: 'New Announcement',
          body: payload.new.title || 'A new announcement was posted.',
          tag: `announcement-${payload.new.id}`,
          data: { eventId, announcementId: payload.new.id },
        });
      }
    } else if (payload.eventType === 'UPDATE') {
      setAnnouncements((prev) => {
        const updated = prev.map((a) => {
          if (a.id === payload.new.id) {
            // Preserve author if created_by hasn't changed
            return { ...payload.new, author: a.created_by === payload.new.created_by ? a.author : undefined };
          }
          return a;
        });
        
        // Re-sort: Pinned first, then by date descending
        return updated.sort((a, b) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
          return new Date(b.created_at) - new Date(a.created_at);
        });
      });
    } else if (payload.eventType === 'DELETE') {
      setAnnouncements((prev) => prev.filter((a) => a.id !== payload.old.id));
    }
  }, [eventId]);

  // Use centralized realtime subscriptions
  useRealtimeTable('announcements', eventId, handleRealtimeChange);

  useEffect(() => {
    loadAnnouncements();
  }, [eventId]);

  const loadAnnouncements = async () => {
    try {
      const { data: announcementsData, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('event_id', eventId)
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      if (announcementsData && announcementsData.length > 0) {
        const userIds = [...new Set(announcementsData.map(a => a.created_by))];
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url, email')
          .in('id', userIds);
          
        const profileMap = new Map((profilesData || []).map(p => [p.id, p]));
        
        const merged = announcementsData.map(a => ({
          ...a,
          author: profileMap.get(a.created_by) || { id: a.created_by }
        }));
        
        setAnnouncements(merged);
      } else {
        setAnnouncements([]);
      }

    } catch (err) {
      console.error('Failed to load announcements:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAnnouncement = async () => {
    if (!title.trim() || !body.trim()) return;

    setPosting(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from('announcements')
          .update({
            title,
            body_markdown: body,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('announcements').insert({
          event_id: eventId,
          title,
          body_markdown: body,
          created_by: user.id,
        }).select().single();

        if (error) throw error;
      }

      handleCloseModal();
    } catch (err) {
      console.error('Failed to save announcement:', err);
    } finally {
      setPosting(false);
    }
  };

  const handleCloseModal = () => {
    setTitle('');
    setBody('');
    setEditingId(null);
    setIsOpen(false);
  };

  const handleEdit = (announcement) => {
    setEditingId(announcement.id);
    setTitle(announcement.title);
    setBody(announcement.body_markdown);
    setIsOpen(true);
  };

  const togglePin = async (id, currentlyPinned) => {
    try {
      const { error } = await supabase
        .from('announcements')
        .update({ pinned: !currentlyPinned })
        .eq('id', id);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to toggle pin:', err);
    }
  };

  const deleteAnnouncement = async (id) => {
    try {
      const { error } = await supabase.from('announcements').delete().eq('id', id);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to delete announcement:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-4">
        <Spinner />
      </div>
    );
  }

  return (
    <Card className="w-full">
      <CardBody className="gap-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Announcements</h3>
          {canManage && (
            <Button
              isIconOnly
              size="sm"
              color="primary"
              variant="light"
              onPress={() => setIsOpen(true)}
              title="Post announcement"
            >
              <Plus size={18} />
            </Button>
          )}
        </div>

        {announcements.length === 0 ? (
          <p className="text-default-600 text-center py-4">No announcements yet</p>
        ) : (
          <div className="space-y-4">
            {announcements.map((announcement) => (
              <div key={announcement.id}>
                <Card isBlurred={announcement.pinned} className={announcement.pinned ? 'bg-warning-50' : ''}>
                  <CardBody className="gap-4">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Avatar
                            size="sm"
                            src={announcement.author?.avatar_url}
                            name={announcement.author?.display_name || announcement.author?.email}
                          />
                          <div>
                            <p className="text-sm font-semibold">
                              {announcement.author?.display_name || announcement.author?.email || 'Unknown'}
                            </p>
                            <p className="text-xs text-default-500">
                              {new Date(announcement.created_at).toLocaleString()}
                            </p>
                          </div>
                          {announcement.pinned && (
                            <Pin size={14} className="ml-auto text-warning" fill="currentColor" />
                          )}
                        </div>

                        <h4 className="font-semibold text-base mb-2">{announcement.title}</h4>

                        <div className="prose prose-sm max-w-none">
                          <ReactMarkdown>{announcement.body_markdown}</ReactMarkdown>
                        </div>
                      </div>

                      {canManage && (
                        <div className="flex gap-1 flex-col">
                          {user?.id === announcement.created_by && (
                            <Button
                              isIconOnly
                              size="sm"
                              variant="light"
                              onPress={() => handleEdit(announcement)}
                              title="Edit"
                            >
                              <Edit2 size={16} />
                            </Button>
                          )}
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            color={announcement.pinned ? 'warning' : 'default'}
                            onPress={() => togglePin(announcement.id, announcement.pinned)}
                            title={announcement.pinned ? 'Unpin' : 'Pin'}
                          >
                            {announcement.pinned ? (
                              <PinOff size={16} />
                            ) : (
                              <Pin size={16} />
                            )}
                          </Button>
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            color="danger"
                            onPress={() => deleteAnnouncement(announcement.id)}
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardBody>
                </Card>
                {/*<Divider className="mt-4" />*/}
              </div>
            ))}
          </div>
        )}
      </CardBody>

      {/* Post/Edit Announcement Modal */}
      <Modal isOpen={isOpen} onOpenChange={(open) => !open && handleCloseModal()} size="2xl">
        <ModalContent>
          <ModalHeader>{editingId ? 'Edit Announcement' : 'Post Announcement'}</ModalHeader>
          <ModalBody>
            <Input
              label="Title"
              placeholder="Announcement title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <div>
              <label className="text-sm font-semibold mb-2 block">Content (Markdown)</label>
              <Textarea
                placeholder="Write your announcement here... Markdown supported!"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                minRows={6}
              />
              <p className="text-xs text-default-600 mt-1">
                Supports **bold**, *italic*, [links](url), and more
              </p>
            </div>

            {body && (
              <div>
                <label className="text-sm font-semibold mb-2 block">Preview</label>
                <Card isBlurred>
                  <CardBody className="prose prose-sm max-w-none">
                    <ReactMarkdown>{body}</ReactMarkdown>
                  </CardBody>
                </Card>
              </div>
            )}
          </ModalBody>

          <ModalFooter>
            <Button color="default" onPress={handleCloseModal}>
              Cancel
            </Button>
            <Button
              color="primary"
              onPress={handleSaveAnnouncement}
              isLoading={posting}
              isDisabled={!title.trim() || !body.trim()}
            >
              {editingId ? 'Save Changes' : 'Post'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Card>
  );
}
