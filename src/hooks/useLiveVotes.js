import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Subscribe to votes for a poll and track live vote counts.
 * @param {string} pollId
 * @returns {Array} votes
 */
export function useLiveVotes(pollId) {
  const [votes, setVotes] = useState([]);
  const channelRef = useRef(null);

  useEffect(() => {
    if (!pollId) return;

    // Fetch initial votes
    supabase
      .from('votes')
      .select('*')
      .eq('poll_id', pollId)
      .then(({ data }) => setVotes(data || []));

    const setupChannel = () => {
      // Subscribe to new votes
      const channel = supabase
        .channel(`votes:${pollId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'votes', filter: `poll_id=eq.${pollId}` },
          (payload) => {
            setVotes((prev) => {
              // Avoid duplicates
              if (prev.some(v => v.id === payload.new.id)) return prev;
              return [...prev, payload.new];
            });
          }
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'votes', filter: `poll_id=eq.${pollId}` },
          (payload) => {
            setVotes((prev) => prev.filter((v) => v.id !== payload.old.id));
          }
        )
        .subscribe((status, err) => {
          if (status === 'CHANNEL_ERROR') {
            console.error('Votes channel error:', err);
            // Attempt to reconnect after a delay
            setTimeout(() => {
              if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
              }
              channelRef.current = setupChannel();
            }, 2000);
          }
        });

      return channel;
    };

    channelRef.current = setupChannel();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [pollId]);

  return votes;
}
