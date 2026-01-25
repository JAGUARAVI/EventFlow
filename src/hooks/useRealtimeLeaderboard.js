import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { playNotificationSound, sendPushNotification } from '../lib/notifications';

/**
 * Subscribe to team changes for an event and merge into setTeams.
 * @param {string} eventId
 * @param {function} setTeams - (updater: (prev) => next) => void
 */
export function useRealtimeLeaderboard(eventId, setTeams, options = {}) {
  const optionsRef = useRef(options);
  // Track the last seen score for each team to avoid accepting stale updates
  const lastSeenScoresRef = useRef(new Map());
  const channelRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimeoutRef = useRef(null);
  const isMountedRef = useRef(true);
  const isIntentionalCloseRef = useRef(false);
  const maxReconnectAttempts = 5;

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const cleanupChannel = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    isIntentionalCloseRef.current = true;
    
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  const setupChannel = useCallback(() => {
    if (!eventId || !isMountedRef.current) return null;
    
    if (channelRef.current) {
      isIntentionalCloseRef.current = true;
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    
    isIntentionalCloseRef.current = false;
    
    console.debug(`[useRealtimeLeaderboard] Setting up channel for event: ${eventId}`);

    const channel = supabase
      .channel(`leaderboard:${eventId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'teams', filter: `event_id=eq.${eventId}` },
        (payload) => {
          if (!isMountedRef.current) return;
          
          // Reset reconnect attempts on successful message
          reconnectAttempts.current = 0;
          
          if (payload.eventType === 'INSERT') {
            setTeams((prev) => {
              if (prev.some((t) => t.id === payload.new.id)) return prev;
              return [...prev, payload.new];
            });
          } else if (payload.eventType === 'UPDATE') {
            const teamId = payload.new.id;
            const incomingScore = payload.new.score;
            
            setTeams((prev) => {
              const existingTeam = prev.find(t => t.id === teamId);
              if (!existingTeam) return prev;
              
              const currentScore = existingTeam.score;
              const scoreChanged = incomingScore !== currentScore;
              
              if (scoreChanged) {
                // Track this score
                lastSeenScoresRef.current.set(teamId, incomingScore);
              }
              
              // Always merge the update - the DB is the source of truth
              return prev.map((t) => (t.id === teamId ? { ...t, ...payload.new } : t));
            });
          } else if (payload.eventType === 'DELETE') {
            lastSeenScoresRef.current.delete(payload.old.id);
            setTeams((prev) => prev.filter((t) => t.id !== payload.old.id));
          }

          if (payload.eventType === 'UPDATE') {
            const currentUserId = optionsRef.current.currentUserId;
            const teamOwner = payload.new?.created_by || payload.old?.created_by;
            if (currentUserId && teamOwner === currentUserId) {
              sendPushNotification({
                title: 'Leaderboard Update',
                body: 'Your team just moved on the leaderboard to position ' + (payload.new?.rank || 'unknown') + ' at ' + new Date().toLocaleTimeString() + '.',
                tag: `leaderboard-${eventId}`,
                data: { eventId, teamId: payload.new?.id || payload.old?.id },
              });
            }
          }
        }
      )
      .subscribe((status, err) => {
        console.debug(`[useRealtimeLeaderboard] Channel status: ${status}`, err || '');
        
        if (!isMountedRef.current) return;
        
        if (status === 'SUBSCRIBED') {
          reconnectAttempts.current = 0;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          if (isIntentionalCloseRef.current) {
            console.debug('[useRealtimeLeaderboard] Ignoring close event (intentional)');
            return;
          }
          
          console.error('[useRealtimeLeaderboard] Channel error:', status, err);
          
          if (reconnectAttempts.current < maxReconnectAttempts) {
            reconnectAttempts.current++;
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current - 1), 10000);
            console.warn(`[useRealtimeLeaderboard] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`);
            
            if (reconnectTimeoutRef.current) {
              clearTimeout(reconnectTimeoutRef.current);
            }
            
            reconnectTimeoutRef.current = setTimeout(() => {
              reconnectTimeoutRef.current = null;
              if (isMountedRef.current && !isIntentionalCloseRef.current) {
                channelRef.current = setupChannel();
              }
            }, delay);
          } else {
            console.error('[useRealtimeLeaderboard] Max reconnection attempts reached');
          }
        }
      });

    return channel;
  }, [eventId, setTeams]);

  useEffect(() => {
    isMountedRef.current = true;
    
    if (!eventId) return;
    
    // Reset scores tracking when eventId changes
    lastSeenScoresRef.current = new Map();
    reconnectAttempts.current = 0;

    channelRef.current = setupChannel();
    
    // Listen for global reconnection events
    const handleReconnect = () => {
      if (!isMountedRef.current) return;
      console.debug('[useRealtimeLeaderboard] Global reconnection detected, re-subscribing');
      reconnectAttempts.current = 0;
      channelRef.current = setupChannel();
    };
    
    window.addEventListener('supabase-reconnected', handleReconnect);

    return () => {
      isMountedRef.current = false;
      window.removeEventListener('supabase-reconnected', handleReconnect);
      cleanupChannel();
    };
  }, [eventId, setupChannel, cleanupChannel]);
}
