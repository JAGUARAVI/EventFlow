import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useRealtime } from '../context/RealtimeContext';

/**
 * Subscribe to ALL votes for an event (across all polls) using a single channel.
 * This prevents channel exhaustion when many polls are displayed.
 * Uses the centralized RealtimeContext for connection management.
 * 
 * @param {string} eventId - The event ID
 * @param {string[]} pollIds - Array of poll IDs to track
 * @returns {Object} - Map of pollId -> votes array
 */
export function useEventVotes(eventId, pollIds = []) {
  const [votesByPoll, setVotesByPoll] = useState({});
  const { isReady, subscribe } = useRealtime();
  const pollIdsRef = useRef(pollIds);
  const initialFetchDone = useRef(new Set());
  const isMountedRef = useRef(true);

  // Update ref when pollIds change
  useEffect(() => {
    pollIdsRef.current = pollIds;
  }, [pollIds]);

  // Track mount state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Fetch votes for newly added polls
  useEffect(() => {
    const fetchVotesForPolls = async () => {
      const newPollIds = pollIds.filter(id => !initialFetchDone.current.has(id));
      if (newPollIds.length === 0) return;

      for (const pollId of newPollIds) {
        initialFetchDone.current.add(pollId);
        const { data } = await supabase
          .from('votes')
          .select('*')
          .eq('poll_id', pollId);
        
        if (data && isMountedRef.current) {
          setVotesByPoll(prev => ({
            ...prev,
            [pollId]: data
          }));
        }
      }
    };

    fetchVotesForPolls();
  }, [pollIds]);

  // Set up subscription for all votes in this event
  useEffect(() => {
    if (!isReady || !eventId) return;

    const handleChange = (payload) => {
      if (!isMountedRef.current) return;

      if (payload.eventType === 'INSERT') {
        const pollId = payload.new.poll_id;
        // Only process if this poll is in our tracked list
        if (pollIdsRef.current.includes(pollId)) {
          setVotesByPoll(prev => {
            const existing = prev[pollId] || [];
            // Avoid duplicates
            if (existing.some(v => v.id === payload.new.id)) return prev;
            return {
              ...prev,
              [pollId]: [...existing, payload.new]
            };
          });
        }
      } else if (payload.eventType === 'DELETE') {
        const pollId = payload.old.poll_id;
        if (pollIdsRef.current.includes(pollId)) {
          setVotesByPoll(prev => ({
            ...prev,
            [pollId]: (prev[pollId] || []).filter(v => v.id !== payload.old.id)
          }));
        }
      } else if (payload.eventType === 'UPDATE') {
        const pollId = payload.new.poll_id;
        if (pollIdsRef.current.includes(pollId)) {
          setVotesByPoll(prev => ({
            ...prev,
            [pollId]: (prev[pollId] || []).map(v => 
              v.id === payload.new.id ? payload.new : v
            )
          }));
        }
      }
    };

    // Use a custom channel key for event votes (no filter since we want all votes)
    // and filter in the callback
    const unsubscribe = subscribe(
      { table: 'votes', eventId, filter: null },
      handleChange
    );

    return () => {
      unsubscribe?.();
    };
  }, [isReady, eventId, subscribe]);

  // Helper to get votes for a specific poll
  const getVotesForPoll = useCallback((pollId) => {
    return votesByPoll[pollId] || [];
  }, [votesByPoll]);

  return { votesByPoll, getVotesForPoll };
}
