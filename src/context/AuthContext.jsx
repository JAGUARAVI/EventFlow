import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (uid) => {
    if (!uid) {
      setProfile(null);
      return;
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('id, role, display_name, avatar_url')
      .eq('id', uid)
      .single();
    if (error) {
      if (error.code === 'PGRST116') {
        // no rows: ensure profile exists (trigger may not have run)
        await supabase.from('profiles').upsert(
          { id: uid, role: 'viewer' },
          { onConflict: 'id' }
        );
        const { data: d } = await supabase.from('profiles').select('id, role, display_name, avatar_url').eq('id', uid).single();
        setProfile(d || null);
      } else {
        setProfile(null);
      }
      return;
    }
    setProfile(data);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user?.id) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user?.id) {
        await fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }, []);

  const signInWithEmailOtp = useCallback(async (email) => {
    const { error } = await supabase.auth.signInWithOtp({ email });
    return { error };
  }, []);

  const signInWithPhoneOtp = useCallback(async (phone) => {
    const { error } = await supabase.auth.signInWithOtp({ phone });
    return { error };
  }, []);

  const value = {
    user,
    profile,
    loading,
    signOut,
    signInWithEmailOtp,
    signInWithPhoneOtp,
    refreshProfile: () => user?.id && fetchProfile(user.id),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
