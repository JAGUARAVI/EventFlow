import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (uid) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, role, display_name, avatar_url')
        .eq('id', uid)
        .single();

      if (error && error.code === 'PGRST116') {
        // Fallback: Create profile if missing
        const { data: newProfile } = await supabase
          .from('profiles')
          .upsert({ id: uid, role: 'viewer' })
          .select()
          .single();
        setProfile(newProfile);
      } else {
        setProfile(data);
      }
    } catch (err) {
      console.error("Profile fetch error:", err);
    }
  }, []);

  useEffect(() => {
    const initializeAuth = async () => {
      // 1. Get initial session
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      
      if (session?.user) {
        await fetchProfile(session.user.id);
      }
      
      setLoading(false); // Only stop loading after profile check

      // 2. Listen for changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        
        if (currentUser) {
          await fetchProfile(currentUser.id);
        } else {
          setProfile(null);
        }
        
        setLoading(false);
      });

      return subscription;
    };

    const authSub = initializeAuth();
    return () => {
      authSub.then(sub => sub?.unsubscribe());
    };
  }, [fetchProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }, []);

  const signInWithEmailOtp = useCallback(async (email) => {
    const { error } = await supabase.auth.signInWithOtp({ email, options: {
      emailRedirectTo: `${window.location.origin}/login`,
    } });
    return { error };
  }, []);

  const signInWithPhoneOtp = useCallback(async (phone) => {
    const { error } = await supabase.auth.signInWithOtp({ phone });
    return { error };
  }, []);

  const signInWithEmailPassword = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  }, []);

  const signUpWithEmailPassword = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });
    return { data, error };
  }, []);

  const value = useMemo(() => ({
    user,
    profile,
    loading,
    signOut,
    signInWithEmailOtp,
    signInWithPhoneOtp,
    refreshProfile: () => user?.id && fetchProfile(user.id),
    signInWithEmailPassword,
    signUpWithEmailPassword,
  }), [user, profile, loading, signOut, signInWithEmailOtp, signInWithPhoneOtp, fetchProfile, signInWithEmailPassword, signUpWithEmailPassword]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

