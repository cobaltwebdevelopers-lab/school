import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { Profile } from '@/types';

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null; needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('id', userId)
      .maybeSingle();
    if (data) {
      setProfile({ id: data.id, fullName: data.full_name ?? '', role: data.role });
    } else {
      setProfile(null);
    }
  }

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event: string, session: Session | null) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function signUp(email: string, password: string, fullName: string) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message, needsEmailConfirmation: false };
    if (!data.user) return { error: 'Sign up did not return a user.', needsEmailConfirmation: false };

    if (!data.session) {
      // Email confirmation is required before a session exists, so we can't
      // create the profile row yet (RLS needs an authenticated session).
      // Stash the name and finish setup on their first successful sign-in.
      try {
        localStorage.setItem('pendingTeacherSignup', JSON.stringify({ userId: data.user.id, fullName }));
      } catch {
        // localStorage unavailable — they'll just need to contact an admin once, no big deal.
      }
      return { error: null, needsEmailConfirmation: true };
    }

    await createTeacherProfile(data.user.id, fullName);
    return { error: null, needsEmailConfirmation: false };
  }

  async function createTeacherProfile(userId: string, fullName: string) {
    // New accounts always start as 'teacher' — the least-privileged role.
    // Enforced by the database (see migration 20260910000002), not just here.
    await supabase.from('profiles').insert({ id: userId, full_name: fullName, role: 'teacher' });
    await loadProfile(userId);
  }

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };

    if (data.user) {
      try {
        const raw = localStorage.getItem('pendingTeacherSignup');
        if (raw) {
          const pending = JSON.parse(raw) as { userId: string; fullName: string };
          if (pending.userId === data.user.id) {
            await createTeacherProfile(data.user.id, pending.fullName);
          }
          localStorage.removeItem('pendingTeacherSignup');
        }
      } catch {
        // Ignore — worst case, they see the "contact an administrator" screen once.
      }
    }

    return { error: null };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
