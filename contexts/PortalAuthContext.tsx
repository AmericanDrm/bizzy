import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { portalSupabase, portalPostAuth } from '@/lib/portalSupabase';

interface PortalClient {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
}

interface PortalAccount {
  id: string;
  client_id: string;
  organization_id: string;
  is_active: boolean;
}

interface PortalAuthState {
  session: Session | null;
  user: User | null;
  portalClient: PortalClient | null;
  portalAccount: PortalAccount | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshPortalClient: () => Promise<void>;
}

const PortalAuthContext = createContext<PortalAuthState>({
  session: null,
  user: null,
  portalClient: null,
  portalAccount: null,
  loading: true,
  signIn: async () => ({ error: null }),
  signOut: async () => {},
  refreshPortalClient: async () => {},
});

export function PortalAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [portalClient, setPortalClient] = useState<PortalClient | null>(null);
  const [portalAccount, setPortalAccount] = useState<PortalAccount | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    portalSupabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        loadPortalClient(s.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = portalSupabase.auth.onAuthStateChange(
      (event, s) => {
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) {
          loadPortalClient(s.user.id);
        } else {
          setPortalClient(null);
          setPortalAccount(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const loadPortalClient = async (userId: string) => {
    try {
      const { data: account, error: accountErr } = await portalSupabase
        .from('client_portal_accounts')
        .select('id, client_id, organization_id, is_active')
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();

      if (accountErr || !account) {
        setPortalClient(null);
        setPortalAccount(null);
        setLoading(false);
        return;
      }

      setPortalAccount(account);

      const { data: client, error: clientErr } = await portalSupabase
        .from('clients')
        .select('id, name, email, phone, address')
        .eq('id', account.client_id)
        .maybeSingle();

      if (!clientErr && client) {
        setPortalClient(client);
      }

      const { data: { session: currentSession } } = await portalSupabase.auth.getSession();
      if (currentSession?.access_token) {
        await portalPostAuth({ action: 'update_last_login' }, currentSession.access_token);
      }
    } catch {
      setPortalClient(null);
      setPortalAccount(null);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await portalSupabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  };

  const signOut = async () => {
    await portalSupabase.auth.signOut();
    setPortalClient(null);
    setPortalAccount(null);
  };

  const refreshPortalClient = async () => {
    if (user) await loadPortalClient(user.id);
  };

  return (
    <PortalAuthContext.Provider
      value={{ session, user, portalClient, portalAccount, loading, signIn, signOut, refreshPortalClient }}
    >
      {children}
    </PortalAuthContext.Provider>
  );
}

export function usePortalAuth() {
  return useContext(PortalAuthContext);
}
