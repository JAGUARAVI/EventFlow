import { useEffect, useRef, useCallback } from 'react';
import { useRealtimeTable } from '../context/RealtimeContext';

/**
 * Subscribe to categories and category_scores changes for an event.
 *
 * @param {string} eventId
 * @param {function} setCategories  - state updater for categories array
 * @param {function} setCategoryScores - state updater for category_scores array
 */
export function useRealtimeCategories(eventId, setCategories, setCategoryScores) {
  const handleCategoryChange = useCallback((payload) => {
    if (payload.eventType === 'INSERT') {
      setCategories((prev) => {
        if (prev.some((c) => c.id === payload.new.id)) return prev;
        return [...prev, payload.new];
      });
    } else if (payload.eventType === 'UPDATE') {
      setCategories((prev) =>
        prev.map((c) => (c.id === payload.new.id ? { ...c, ...payload.new } : c))
      );
    } else if (payload.eventType === 'DELETE') {
      setCategories((prev) => prev.filter((c) => c.id !== payload.old.id));
    }
  }, [setCategories]);

  const handleScoreChange = useCallback((payload) => {
    if (payload.eventType === 'INSERT') {
      setCategoryScores((prev) => {
        if (prev.some((s) => s.id === payload.new.id)) return prev;
        return [...prev, payload.new];
      });
    } else if (payload.eventType === 'UPDATE') {
      setCategoryScores((prev) =>
        prev.map((s) => (s.id === payload.new.id ? { ...s, ...payload.new } : s))
      );
    } else if (payload.eventType === 'DELETE') {
      setCategoryScores((prev) => prev.filter((s) => s.id !== payload.old.id));
    }
  }, [setCategoryScores]);

  useRealtimeTable('categories', eventId, handleCategoryChange);
  useRealtimeTable('category_scores', eventId, handleScoreChange);
}
