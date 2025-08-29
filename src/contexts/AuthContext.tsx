import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'teacher' | 'student';
  section?: string | null;
  roll_number?: string | null;
  face_descriptor?: any;
  notification_token?: string | null;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener (keep callback synchronous to avoid deadlocks)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      console.log('Auth state changed:', event, newSession?.user?.id);
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        console.log('Fetching profile for user:', newSession.user.id);
        // Use Promise directly to avoid async callback
        supabase
          .from('profiles')
          .select('*')
          .eq('id', newSession.user.id)
          .maybeSingle()
          .then(({ data, error }) => {
            if (error) {
              console.error('Profile fetch (auth change) error:', error);
              setProfile(null);
            } else {
              console.log('Profile fetched:', data);
              setProfile((data as Profile) ?? null);
            }
            setLoading(false);
          })
      } else {
        console.log('No user, clearing profile');
        setProfile(null);
        setLoading(false);
      }
    });

    // Check for existing session on load
    const initAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        console.log('Initial session check:', session?.user?.id);
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          console.log('Fetching initial profile for user:', session.user.id);
          const { data, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();
          
          if (profileError) {
            console.error('Profile fetch (init) error:', profileError);
            setProfile(null);
          } else {
            console.log('Initial profile fetched:', data);
            setProfile((data as Profile) ?? null);
          }
        }
      } catch (e) {
        console.error('getSession error:', e);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };


  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      // Even if server-side logout fails, clear local state
      console.warn('Server logout failed, clearing local session:', error);
    } finally {
      // Always clear local state
      setSession(null);
      setUser(null);
      setProfile(null);
    }
  };

  const value = {
    user,
    profile,
    session,
    loading,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};