import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useRealtimeTable } from '../context/RealtimeContext';

/**
 * Subscribe to votes for a poll and track live vote counts.
 * Uses the centralized RealtimeContext for connection management.
 * 
 * @param {string} pollId
 * @returns {Array} votes
 */
export function useLiveVotes(pollId) {
  const [votes, setVotes] = useState([]);
  const isMountedRef = useRef(true);

  // Fetch initial votes
  useEffect(() => {
    isMountedRef.current = true;
    
    if (!pollId) return;

    supabase
      .from('votes')
      .select('*')
      .eq('poll_id', pollId)
      .then(({ data }) => {
        if (isMountedRef.current) {
          setVotes(data || []);
        }
      });

    return () => {
      isMountedRef.current = false;
    };
  }, [pollId]);

  const handleChange = useCallback((payload) => {
    if (payload.eventType === 'INSERT') {
      setVotes((prev) => {
        // Avoid duplicates
        if (prev.some(v => v.id === payload.new.id)) return prev;
        return [...prev, payload.new];
      });
    } else if (payload.eventType === 'DELETE') {
      setVotes((prev) => prev.filter((v) => v.id !== payload.old.id));
    } else if (payload.eventType === 'UPDATE') {
      setVotes((prev) => 
        prev.map((v) => v.id === payload.new.id ? payload.new : v)
      );
    }
  }, []);

  // Use custom filter for poll_id instead of event_id
  useRealtimeTable('votes', null, handleChange, {
    filter: pollId ? `poll_id=eq.${pollId}` : null,
  });

  return votes;
}
