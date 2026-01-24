import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useRealtimePolls(eventId, setPolls, setPollOptions) {
  useEffect(() => {
    if (!eventId) return;

    const channel = supabase
      .channel(`polls:event_id=eq.${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'polls',
          filter: `event_id=eq.${eventId}`,
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            setPolls((prev) => [payload.new, ...prev]);
            
            // If checking specifically for a new poll, we should also fetch its options.
            // Give a small delay to ensure options are inserted.
            if (setPollOptions) {
              setTimeout(async () => {
                const { data } = await supabase
                  .from('poll_options')
                  .select('*')
                  .eq('poll_id', payload.new.id)
                  .order('display_order');
                
                if (data) {
                  setPollOptions((prev) => ({
                    ...prev,
                    [payload.new.id]: data,
                  }));
                }
              }, 1000);
            }
          } else if (payload.eventType === 'UPDATE') {
            setPolls((prev) =>
              prev.map((p) => (p.id === payload.new.id ? payload.new : p))
            );
          } else if (payload.eventType === 'DELETE') {
            setPolls((prev) => prev.filter((p) => p.id !== payload.old.id));
            // Should also clean up options? Not strictly necessary for functionality but good for memory.
            if (setPollOptions) {
                setPollOptions(prev => {
                    const next = { ...prev };
                    delete next[payload.old.id];
                    return next;
                });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, setPolls, setPollOptions]);
}
