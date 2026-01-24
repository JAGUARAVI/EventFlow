import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Subscribe to votes for a poll and track live vote counts.
 * @param {string} pollId
 * @returns {Array} votes
 */
export function useLiveVotes(pollId) {
  const [votes, setVotes] = useState([]);

  useEffect(() => {
    if (!pollId) return;

    // Fetch initial votes
    supabase
      .from('votes')
      .select('*')
      .eq('poll_id', pollId)
      .then(({ data }) => setVotes(data || []));

    // Subscribe to new votes
    const channel = supabase
      .channel(`votes:${pollId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'votes', filter: `poll_id=eq.${pollId}` },
        (payload) => {
          setVotes((prev) => [...prev, payload.new]);
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'votes', filter: `poll_id=eq.${pollId}` },
        (payload) => {
          setVotes((prev) => prev.filter((v) => v.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pollId]);

  return votes;
}
