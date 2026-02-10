import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useRealtimeLeaderboard } from '../hooks/useRealtimeLeaderboard';
import { useRealtimeCategories } from '../hooks/useRealtimeCategories';
import Leaderboard from '../components/Leaderboard';

export default function PublicLeaderboard() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [teams, setTeams] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryScores, setCategoryScores] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!id) return;
    const [eRes, tRes, catRes, catScoreRes] = await Promise.all([
      supabase.from('events').select('id, name, settings').eq('id', id).single(),
      supabase.from('teams').select('*').eq('event_id', id).order('created_at'),
      supabase.from('categories').select('*').eq('event_id', id).order('created_at'),
      supabase.from('category_scores').select('*').eq('event_id', id),
    ]);
    setEvent(eRes.data || null);
    setTeams(tRes.data || []);
    setCategories(catRes.data || []);
    setCategoryScores(catScoreRes.data || []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  useRealtimeLeaderboard(id, setTeams);
  useRealtimeCategories(id, setCategories, setCategoryScores);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-default-500 text-2xl">Loading…</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-danger text-2xl">Event not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-default-50 p-6 md:p-12">
      <h1 className="text-3xl md:text-5xl font-bold mb-2">{event.name}</h1>
      <p className="text-default-500 text-xl mb-8">Leaderboard</p>
      <Leaderboard 
        teams={teams} 
        canJudge={false} 
        bigScreen 
        sortOrder={event?.settings?.leaderboard_sort_order || 'desc'}
        categories={categories}
        categoryScores={categoryScores}
        categoriesEnabled={!!event?.settings?.categories_enabled}
      />
    </div>
  );
}
