import { useState, useEffect } from 'react';
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
import { Pin, PinOff, Trash2, Plus } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

export default function AnnouncementsFeed({ eventId, canManage = false }) {
  const { user, profile } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    loadAnnouncements();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`announcements:event_id=eq.${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'announcements',
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setAnnouncements((prev) => [payload.new, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setAnnouncements((prev) =>
              prev.map((a) => (a.id === payload.new.id ? payload.new : a))
            );
          } else if (payload.eventType === 'DELETE') {
            setAnnouncements((prev) => prev.filter((a) => a.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  const loadAnnouncements = async () => {
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*, created_by(*)')
        .eq('event_id', eventId)
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAnnouncements(data || []);
    } catch (err) {
      console.error('Failed to load announcements:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePostAnnouncement = async () => {
    if (!title.trim() || !body.trim()) return;

    setPosting(true);
    try {
      const { error } = await supabase.from('announcements').insert({
        event_id: eventId,
        title,
        body_markdown: body,
        created_by: user.id,
      });

      if (error) throw error;

      setTitle('');
      setBody('');
      setIsOpen(false);
    } catch (err) {
      console.error('Failed to post announcement:', err);
    } finally {
      setPosting(false);
    }
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
                  <CardBody className="gap-3">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Avatar
                            size="sm"
                            src={announcement.created_by?.avatar_url}
                            name={announcement.created_by?.full_name}
                          />
                          <div>
                            <p className="text-sm font-semibold">
                              {announcement.created_by?.full_name || 'Unknown'}
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
                <Divider className="mt-4" />
              </div>
            ))}
          </div>
        )}
      </CardBody>

      {/* Post Announcement Modal */}
      <Modal isOpen={isOpen} onOpenChange={setIsOpen} size="2xl">
        <ModalContent>
          <ModalHeader>Post Announcement</ModalHeader>
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
            <Button color="default" onPress={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button
              color="primary"
              onPress={handlePostAnnouncement}
              isLoading={posting}
              isDisabled={!title.trim() || !body.trim()}
            >
              Post
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Card>
  );
}
