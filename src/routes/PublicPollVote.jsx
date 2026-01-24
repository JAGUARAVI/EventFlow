import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardBody, Button, Spinner, addToast } from '@heroui/react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import PollVote from '../components/PollVote';
import PollResults from '../components/PollResults';
import { useLiveVotes } from '../hooks/useLiveVotes';

export default function PublicPollVote() {
  const { id: eventId } = useParams();
  const { user } = useAuth();
  const [event, setEvent] = useState(null);
  const [polls, setPolls] = useState([]);
  const [pollOptions, setPollOptions] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedPollId, setSelectedPollId] = useState('');

  const selectedPoll = polls.find((p) => p.id === selectedPollId);
  const liveVotes = useLiveVotes(selectedPollId);

  useEffect(() => {
    fetchData();
  }, [eventId]);

  const fetchData = async () => {
    setLoading(true);
    const [eRes, pRes] = await Promise.all([
      supabase.from('events').select('id, name').eq('id', eventId).single(),
      supabase.from('polls').select('*').eq('event_id', eventId).eq('status', 'open'),
    ]);
    setLoading(false);

    if (eRes.error || !eRes.data) {
      addToast({ title: 'Event not found', severity: 'danger' });
      return;
    }

    setEvent(eRes.data);
    setPolls(pRes.data || []);

    // Fetch options for each poll
    if (pRes.data && pRes.data.length > 0) {
      const optionsMap = {};
      for (const poll of pRes.data) {
        const { data: opts } = await supabase.from('poll_options').select('*').eq('poll_id', poll.id).order('display_order');
        optionsMap[poll.id] = opts || [];
      }
      setPollOptions(optionsMap);
      setSelectedPollId(pRes.data[0].id);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-danger">Event not found</p>
        <Link to="/" className="text-primary underline">Go home</Link>
      </div>
    );
  }

  if (polls.length === 0) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-default-500">No active polls for this event</p>
        <Link to="/" className="text-primary underline">Go home</Link>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-default-500">Sign in to vote</p>
        <Link to="/login" className="text-primary underline">Sign in</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-default-50 to-default-100 p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">{event.name}</h1>
        <p className="text-default-500 mb-6">Live Voting</p>

        {polls.length > 1 && (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            {polls.map((poll) => (
              <Button
                key={poll.id}
                variant={selectedPollId === poll.id ? 'solid' : 'bordered'}
                size="sm"
                onPress={() => setSelectedPollId(poll.id)}
              >
                {poll.question.substring(0, 20)}...
              </Button>
            ))}
          </div>
        )}

        {selectedPoll && (
          <Card className="mb-4">
            <CardBody className="gap-4">
              <PollVote
                poll={selectedPoll}
                options={pollOptions[selectedPollId] || []}
                onVoted={() => fetchData()}
              />
            </CardBody>
          </Card>
        )}

        {selectedPoll && polls.length === 1 && (
          <Card>
            <CardBody>
              <p className="text-sm font-semibold mb-3">Live Results</p>
              <PollResults
                options={pollOptions[selectedPollId] || []}
                votes={liveVotes}
                isLive={true}
                pollType={selectedPoll?.poll_type}
              />
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
