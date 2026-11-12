import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { Profile, School, UserRole } from '@/types';

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  /** The signed-in user's school. null while loading, or before onboarding. */
  school: School | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
  ) => Promise<{ error: string | null; needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
  /** Re-fetch profile + school (after onboarding, or after settings change). */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function mapSchool(row: Record<string, unknown>): School {
  return {
    id: row.id as string,
    name: row.name as string,
    motto: (row.motto as string) ?? '',
    address: (row.address as string) ?? '',
    phone: (row.phone as string) ?? '',
    email: (row.email as string) ?? '',
    kraPin: (row.kra_pin as string) ?? '',
    paybillNumber: (row.paybill_number as string) ?? '',
    paybillVerified: Boolean(row.paybill_verified),
    currentTerm: row.current_term as string,
    subscriptionStatus: row.subscription_status as School['subscriptionStatus'],
    trialEndsAt: (row.trial_ends_at as string) ?? null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [school, setSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfileAndSchool = useCallback(async (userId: string) => {
    const { data: p } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (!p) {
      setProfile(null);
      setSchool(null);
      return;
    }
    setProfile({
      id: p.id,
      fullName: p.full_name ?? '',
      email: p.email ?? '',
      role: p.role as UserRole,
      schoolId: p.school_id ?? null,
    });

    if (p.school_id) {
      const { data: s } = await supabase.from('schools').select('*').eq('id', p.school_id).maybeSingle();
      setSchool(s ? mapSchool(s) : null);
    } else {
      setSchool(null);
    }
  }, []);

  useEffect(() => {
    // Without Supabase settings there's nothing to sign in to. Don't touch the (null) client —
    // App shows a "not configured" message instead of crashing to a blank page.
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(async ({ data }) => {
      const u = data.session?.user ?? null;
      setUser(u);
      if (u) await loadProfileAndSchool(u.id);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        // Defer the query out of the auth callback to avoid deadlocking the client.
        setTimeout(() => void loadProfileAndSchool(u.id), 0);
      } else {
        setProfile(null);
        setSchool(null);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfileAndSchool]);

  const refresh = useCallback(async () => {
    if (user) await loadProfileAndSchool(user.id);
  }, [user, loadProfileAndSchool]);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signUp(email: string, password: string, fullName: string) {
    // The profile row is created by a database trigger from this metadata, so it
    // works whether or not the project requires email confirmation.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) return { error: error.message, needsEmailConfirmation: false };
    return { error: null, needsEmailConfirmation: !data.session };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ user, profile, school, loading, signIn, signUp, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

/** For components that only render once a school exists. */
export function useSchool(): School {
  const { school } = useAuth();
  if (!school) throw new Error('useSchool called before a school was loaded');
  return school;
}
