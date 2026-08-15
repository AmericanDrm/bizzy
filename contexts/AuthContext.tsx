import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { clearOrgCache } from '@/lib/supabaseClient';
import { invalidateAllCache } from '@/lib/cacheService';
import Constants from 'expo-constants';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string) => Promise<{ data: any; error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  googleAuthAvailable: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ data: null, error: null }),
  signInWithGoogle: async () => ({ error: null }),
  signOut: async () => {},
  googleAuthAvailable: false,
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const isWeb = Platform.OS === 'web';

const getRedirectUrl = (): string => {
  const configuredUrl = Constants.expoConfig?.extra?.authRedirectUrl;
  if (configuredUrl) return configuredUrl;
  if (isWeb && typeof window !== 'undefined') {
    return `${window.location.origin}`;
  }
  return 'https://bizzy.bolt.host';
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let oauthHandled = false;

    const initAuth = async () => {
      try {
        if (isWeb && typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          const code = url.searchParams.get('code');

          if (code) {
            oauthHandled = true;
            try {
              const { data, error } = await supabase.auth.exchangeCodeForSession(code);
              if (!error && isMounted) {
                setSession(data.session);
                setUser(data.session?.user ?? null);
              }
            } catch (exchangeErr) {
              console.warn('Code exchange failed (may already be handled):', exchangeErr);
            }
            url.searchParams.delete('code');
            window.history.replaceState({}, '', url.toString());
          }
        }

        if (!oauthHandled) {
          const { data: { session: existingSession } } = await supabase.auth.getSession();
          if (isMounted) {
            setSession(existingSession);
            setUser(existingSession?.user ?? null);
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        setSession(session);
        setUser(session?.user ?? null);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { error, data } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        console.error('Sign in error:', error);
      } else {
        console.log('Sign in successful:', data.user?.email);
      }
      return { error };
    } catch (e) {
      console.error('Sign in exception:', e);
      return { error: e as any };
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    return { data, error };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/contacts.readonly',
        redirectTo: getRedirectUrl(),
      },
    });
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    try {
      clearOrgCache();
      await invalidateAllCache();
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Sign out error:', error);
      setUser(null);
      setSession(null);
    }
  }, []);

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    googleAuthAvailable: isWeb,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
