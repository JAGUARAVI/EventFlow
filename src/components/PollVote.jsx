import { useState, useEffect } from 'react';
import { Button, Slider, addToast } from '@heroui/react';
import { motion } from 'framer-motion';
import { X, Plus, GripVertical } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

export default function PollVote({ poll, options, onVoted, showQuestion = true }) {
  const { user } = useAuth();
  const [selectedOptionId, setSelectedOptionId] = useState('');
  const [rankedOrdered, setRankedOrdered] = useState([]); // For ranked: list of option objects
  const [pointsMap, setPointsMap] = useState({}); // For vote_to_points: { optionId: number }

  const [voting, setVoting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);

  useEffect(() => {
    if (poll?.id && user?.id) {
      checkVoted();
    }
  }, [poll?.id, user?.id]);

  useEffect(() => {
    // Initialize state based on poll type
    if (poll?.poll_type === 'ranked') {
      setRankedOrdered([]);
    } else if (poll?.poll_type === 'vote_to_points') {
      const initialMap = {};
      options.forEach((o) => (initialMap[o.id] = 0));
      setPointsMap(initialMap);
    }
  }, [poll?.poll_type, options]);

  const checkVoted = async () => {
    const { data } = await supabase
      .from('votes')
      .select('id')
      .eq('poll_id', poll.id)
      .eq('user_id', user.id)
      .limit(1);

    setHasVoted(data && data.length > 0);
  };

  const handleSimpleVote = async () => {
    if (!selectedOptionId) {
      addToast({ title: 'Select an option', severity: 'warning' });
      return;
    }
    await submitVotes([{ option_id: selectedOptionId }]);
  };

  const handleRankedVote = async () => {
    if (rankedOrdered.length === 0) {
      addToast({ title: 'Rank at least one option', severity: 'warning' });
      return;
    }
    // Prepare payload: { option_id, rank }
    const payload = rankedOrdered.map((opt, idx) => ({
      option_id: opt.id,
      rank: idx + 1,
    }));
    await submitVotes(payload);
  };

  const handlePointsVote = async () => {
    // Check if at least one option has points? Or allow all 0?
    // Let's assume user must engage.
    const hasPoints = Object.values(pointsMap).some((v) => v > 0);
    if (!hasPoints) {
      addToast({ title: 'Assign points to at least one option', severity: 'warning' });
      // return; // Allow 0 points if they really want? Maybe not.
      return;
    }
    const payload = options.map((opt) => ({
      option_id: opt.id,
      value: pointsMap[opt.id] || 0,
    }));
    await submitVotes(payload);
  };

  const submitVotes = async (votesPayload) => {
    if (!user?.id) {
      addToast({ title: 'Sign in to vote', severity: 'warning' });
      return;
    }

    setVoting(true);

    // Delete existing votes to avoid conflict (or just in case we allow revoting logic later)
    // RLS might block delete if not creator? No, usually users can delete own data.
    // Assuming policy: "Users can insert/delete their own votes"
    const { error: deleteError } = await supabase
      .from('votes')
      .delete()
      .match({ poll_id: poll.id, user_id: user.id });

    if (deleteError) {
      console.warn('Error clearing previous votes:', deleteError);
    }

    // Insert new votes
    const rows = votesPayload.map((v) => ({
      poll_id: poll.id,
      user_id: user.id,
      option_id: v.option_id,
      rank: v.rank || 1,
      value: v.value || 0, // ensure value is set
    }));

    const { error } = await supabase.from('votes').insert(rows);
    setVoting(false);

    if (error) {
      if (error.code === '23505') {
        addToast({ title: 'Already voted', severity: 'info' });
        setHasVoted(true);
      } else {
        addToast({ title: 'Vote failed', description: error.message, severity: 'danger' });
      }
      return;
    }

    setHasVoted(true);
    addToast({ title: 'Vote recorded', severity: 'success' });
    onVoted?.();
  };

  if (poll?.status === 'closed') {
    return <p className="text-default-500 text-sm">This poll is closed.</p>;
  }

  // --- Render: Ranked Choice ---
  if (poll?.poll_type === 'ranked') {
    const unrankedOptions = options.filter(
      (o) => !rankedOrdered.find((r) => r.id === o.id)
    );

    return (
      <div className="space-y-4">
        {showQuestion && <p className="text-base font-semibold">{poll?.question}</p>}

        {/* Your Ranking List */}
        <div className="space-y-2">
          <p className="text-sm text-default-500">Your Ranking (Top is #1)</p>
          {rankedOrdered.length === 0 && (
            <div className="p-4 border border-dashed rounded-lg text-center text-default-400 text-sm">
              Tap options below to add them to your ranking
            </div>
          )}

          <div className="flex flex-col gap-2">
            {rankedOrdered.map((opt, idx) => (
              <motion.div
                key={opt.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg border border-primary/20"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm">
                  {idx + 1}
                </div>
                <span className="flex-1 font-medium">{opt.label}</span>
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  color="danger"
                  onPress={() =>
                    setRankedOrdered((prev) => prev.filter((p) => p.id !== opt.id))
                  }
                >
                  <X size={16} />
                </Button>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Available Options */}
        {unrankedOptions.length > 0 && (
          <div className="space-y-2 pt-2">
            <p className="text-sm text-default-500">Available Options</p>
            <div className="grid grid-cols-1 gap-2">
              {unrankedOptions.map((opt) => (
                <Button
                  key={opt.id}
                  variant="flat"
                  className="justify-start h-auto py-3"
                  onPress={() => setRankedOrdered((prev) => [...prev, opt])}
                >
                  <Plus size={16} className="mr-2" />
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {!hasVoted ? (
          <Button
            color="primary"
            fullWidth
            isLoading={voting}
            onPress={handleRankedVote}
            isDisabled={rankedOrdered.length === 0}
            className="mt-4"
          >
            Submit Ranking
          </Button>
        ) : (
          <p className="text-sm text-success text-center mt-2">Ranking submitted!</p>
        )}
      </div>
    );
  }

  // --- Render: Vote to Points (Rating) ---
  if (poll?.poll_type === 'vote_to_points') {
    return (
      <div className="space-y-4">
        {showQuestion && <p className="text-base font-semibold">{poll?.question}</p>}
        <p className="text-sm text-default-500">Rate each option (0-10)</p>

        <div className="space-y-4">
          {options.map((opt) => (
            <div key={opt.id} className="space-y-2 p-3 bg-content2 rounded-lg">
              <div className="flex justify-between items-center">
                <label className="font-medium">{opt.label}</label>
                <span className="text-lg font-bold text-primary">
                  {pointsMap[opt.id] || 0}
                </span>
              </div>
              <Slider
                size="md"
                step={1}
                maxValue={10}
                minValue={0}
                value={pointsMap[opt.id] || 0}
                onChange={(val) =>
                  setPointsMap((prev) => ({ ...prev, [opt.id]: val }))
                }
                className="max-w-full"
                aria-label={`Rate ${opt.label}`}
                isDisabled={hasVoted}
              />
            </div>
          ))}
        </div>

        {!hasVoted ? (
          <Button
            color="primary"
            fullWidth
            isLoading={voting}
            onPress={handlePointsVote}
            className="mt-4"
          >
            Submit Ratings
          </Button>
        ) : (
          <p className="text-sm text-success text-center mt-2">Ratings submitted!</p>
        )}
      </div>
    );
  }

  // --- Render: Simple ---
  return (
    <div className="space-y-3">
      {showQuestion && (
        <p className="text-base font-semibold">{poll?.question}</p>
      )}
      <div className="space-y-2">
        {options.map((opt) => (
          <motion.button
            key={opt.id}
            whileHover={{ scale: 1.02 }}
            onClick={() => setSelectedOptionId(opt.id)}
            className={`w-full p-3 rounded-lg text-left transition ${
              selectedOptionId === opt.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-default-100 hover:bg-default-200'
            }`}
            disabled={hasVoted}
          >
            {opt.label}
          </motion.button>
        ))}
      </div>
      {!hasVoted && (
        <Button
          color="primary"
          fullWidth
          isLoading={voting}
          onPress={handleSimpleVote}
        >
          Vote
        </Button>
      )}
      {hasVoted && <p className="text-sm text-success">Your vote is recorded</p>}
    </div>
  );
}
