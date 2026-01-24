import { useState, useEffect } from 'react';
import { Button, addToast } from '@heroui/react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

export default function PollVote({ poll, options, onVoted }) {
  const { user } = useAuth();
  const [selectedOptionId, setSelectedOptionId] = useState('');
  const [voting, setVoting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);

  useEffect(() => {
    if (poll?.id && user?.id) {
      checkVoted();
    }
  }, [poll?.id, user?.id]);

  const checkVoted = async () => {
    const { data } = await supabase
      .from('votes')
      .select('id')
      .eq('poll_id', poll.id)
      .eq('user_id', user.id)
      .single();
    setHasVoted(!!data);
  };

  const handleVote = async () => {
    if (!selectedOptionId) {
      addToast({ title: 'Select an option', severity: 'warning' });
      return;
    }
    if (!user?.id) {
      addToast({ title: 'Sign in to vote', severity: 'warning' });
      return;
    }

    setVoting(true);
    const { error } = await supabase.from('votes').insert({
      poll_id: poll.id,
      option_id: selectedOptionId,
      user_id: user.id,
    });
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

  return (
    <div className="space-y-3">
      <p className="text-base font-semibold">{poll?.question}</p>
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
          onPress={handleVote}
        >
          Vote
        </Button>
      )}
      {hasVoted && <p className="text-sm text-success">Your vote is recorded</p>}
    </div>
  );
}
