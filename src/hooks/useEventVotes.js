import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Subscribe to ALL votes for an event (across all polls) using a single channel.
 * This prevents channel exhaustion when many polls are displayed.
 * 
 * @param {string} eventId - The event ID
 * @param {string[]} pollIds - Array of poll IDs to track
 * @returns {Object} - Map of pollId -> votes array
 */
export function useEventVotes(eventId, pollIds = []) {
  const [votesByPoll, setVotesByPoll] = useState({});
  const channelRef = useRef(null);
  const pollIdsRef = useRef(pollIds);
  const initialFetchDone = useRef(new Set());

  // Update ref when pollIds change
  useEffect(() => {
    pollIdsRef.current = pollIds;
  }, [pollIds]);

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
        
        if (data) {
          setVotesByPoll(prev => ({
            ...prev,
            [pollId]: data
          }));
        }
      }
    };

    fetchVotesForPolls();
  }, [pollIds]);

  // Set up single channel for all votes in this event
  useEffect(() => {
    if (!eventId) return;

    const setupChannel = () => {
      // Subscribe to votes table filtered by event's polls
      // We'll filter in the callback since we can't easily filter by poll_id IN (...)
      const channel = supabase
        .channel(`event-votes:${eventId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'votes' },
          (payload) => {
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
          }
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'votes' },
          (payload) => {
            const pollId = payload.old.poll_id;
            if (pollIdsRef.current.includes(pollId)) {
              setVotesByPoll(prev => ({
                ...prev,
                [pollId]: (prev[pollId] || []).filter(v => v.id !== payload.old.id)
              }));
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'votes' },
          (payload) => {
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
        )
        .subscribe((status, err) => {
          if (status === 'CHANNEL_ERROR') {
            console.error('Event votes channel error:', err);
            // Attempt reconnection
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
  }, [eventId]);

  // Helper to get votes for a specific poll
  const getVotesForPoll = useCallback((pollId) => {
    return votesByPoll[pollId] || [];
  }, [votesByPoll]);

  return { votesByPoll, getVotesForPoll };
}
