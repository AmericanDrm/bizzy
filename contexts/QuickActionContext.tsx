import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';
import { useOrganization } from './OrganizationContext';
import type { ParsedAction } from '@/lib/quickActionParser';

interface RecentAction {
  id: string;
  action_type: string;
  label: string;
  description: string;
  raw_input: string;
  metadata: Record<string, any>;
  use_count: number;
  last_used_at: string;
}

interface QuickActionContextType {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  recentActions: RecentAction[];
  clients: { id: string; name: string }[];
  recordAction: (action: ParsedAction) => Promise<void>;
  refreshClients: () => Promise<void>;
}

const QuickActionContext = createContext<QuickActionContextType>({
  isOpen: false,
  open: () => {},
  close: () => {},
  toggle: () => {},
  recentActions: [],
  clients: [],
  recordAction: async () => {},
  refreshClients: async () => {},
});

export const useQuickAction = () => useContext(QuickActionContext);

export function QuickActionProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [recentActions, setRecentActions] = useState<RecentAction[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const clientsFetchedRef = useRef(false);
  const lastOpenFetchRef = useRef<number>(0);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen(prev => !prev), []);

  const fetchRecentActions = useCallback(async () => {
    if (!user?.id || !currentOrganization?.id) return;
    const { data } = await supabase
      .from('recent_quick_actions')
      .select('*')
      .eq('user_id', user.id)
      .eq('organization_id', currentOrganization.id)
      .order('last_used_at', { ascending: false })
      .limit(20);
    if (data) setRecentActions(data);
  }, [user?.id, currentOrganization?.id]);

  const refreshClients = useCallback(async () => {
    if (!currentOrganization?.id) return;
    const { data } = await supabase
      .from('clients')
      .select('id, name')
      .eq('organization_id', currentOrganization.id)
      .order('name', { ascending: true });
    if (data) setClients(data);
  }, [currentOrganization?.id]);

  const recordAction = useCallback(async (action: ParsedAction) => {
    if (!user?.id || !currentOrganization?.id) return;

    const metadata: Record<string, any> = {};
    if (action.clientName) metadata.clientName = action.clientName;
    if (action.amount) metadata.amount = action.amount;
    if (action.day) metadata.day = action.day;
    if (action.navigateTo) metadata.navigateTo = action.navigateTo;

    const matchKey = `${action.type}:${action.clientName || ''}:${action.navigateTo || ''}`;

    const existing = recentActions.find(r => {
      const existingKey = `${r.action_type}:${r.metadata?.clientName || ''}:${r.metadata?.navigateTo || ''}`;
      return existingKey === matchKey;
    });

    if (existing) {
      await supabase
        .from('recent_quick_actions')
        .update({
          use_count: existing.use_count + 1,
          last_used_at: new Date().toISOString(),
          label: action.label,
          description: action.description,
        })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('recent_quick_actions')
        .insert({
          user_id: user.id,
          organization_id: currentOrganization.id,
          action_type: action.type,
          label: action.label,
          description: action.description,
          raw_input: action.raw,
          metadata,
        });
    }

    fetchRecentActions();
  }, [user?.id, currentOrganization?.id, recentActions, fetchRecentActions]);

  useEffect(() => {
    if (user?.id && currentOrganization?.id) {
      fetchRecentActions();
      if (!clientsFetchedRef.current) {
        refreshClients();
        clientsFetchedRef.current = true;
      }
    }
  }, [user?.id, currentOrganization?.id]);

  useEffect(() => {
    if (isOpen && user?.id && currentOrganization?.id) {
      const now = Date.now();
      if (now - lastOpenFetchRef.current > 30000) {
        lastOpenFetchRef.current = now;
        fetchRecentActions();
        refreshClients();
      }
    }
  }, [isOpen, user?.id, currentOrganization?.id, fetchRecentActions, refreshClients]);

  const contextValue = useMemo(() => ({
    isOpen, open, close, toggle, recentActions, clients, recordAction, refreshClients,
  }), [isOpen, open, close, toggle, recentActions, clients, recordAction, refreshClients]);

  return (
    <QuickActionContext.Provider value={contextValue}>
      {children}
    </QuickActionContext.Provider>
  );
}
