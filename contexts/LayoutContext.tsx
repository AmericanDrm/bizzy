import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';

export interface LayoutItem {
  id: string;
  visible: boolean;
}

export interface CardConfig {
  id: string;
  label: string;
  icon: string;
}

export interface TabConfig {
  id: string;
  label: string;
  icon: string;
}

export const AVAILABLE_CARDS: CardConfig[] = [
  { id: 'clients', label: 'Clients', icon: 'Users' },
  { id: 'schedule', label: 'Upcoming', icon: 'Calendar' },
  { id: 'time', label: 'Hours', icon: 'Clock' },
  { id: 'invoices', label: 'Invoices', icon: 'Receipt' },
  { id: 'finances', label: 'Finances', icon: 'DollarSign' },
];

export const AVAILABLE_TABS: TabConfig[] = [
  { id: 'index', label: 'Home', icon: 'Home' },
  { id: 'clients', label: 'Clients', icon: 'Users' },
  { id: 'schedule', label: 'Schedule', icon: 'Calendar' },
  { id: 'camera', label: 'Camera', icon: 'Camera' },
  { id: 'time', label: 'Time', icon: 'Clock' },
  { id: 'invoices', label: 'Invoices', icon: 'Receipt' },
  { id: 'notes', label: 'Notes', icon: 'FileText' },
  { id: 'finances', label: 'Finances', icon: 'DollarSign' },
  { id: 'routes', label: 'Routes', icon: 'Route' },
  { id: 'hr', label: 'HR', icon: 'Users' },
];

export const AVAILABLE_QUICK_ACTIONS: CardConfig[] = [
  { id: 'clients', label: 'Clients', icon: 'Users' },
  { id: 'schedule', label: 'Schedule', icon: 'Calendar' },
  { id: 'time', label: 'Time', icon: 'Clock' },
  { id: 'invoices', label: 'Invoices', icon: 'Receipt' },
  { id: 'finances', label: 'Finances', icon: 'DollarSign' },
];

export type ClientSwipeActionId = 'call' | 'schedule' | 'invoice' | 'message' | 'delete';
export type InvoiceSwipeActionId = 'mark_paid' | 'pdf' | 'send' | 'remind' | 'delete';

export interface SwipeActionsClients {
  right: ClientSwipeActionId[];
}

export interface SwipeActionsInvoices {
  right: InvoiceSwipeActionId[];
  left: InvoiceSwipeActionId[];
}

export const DEFAULT_SWIPE_ACTIONS_CLIENTS: SwipeActionsClients = {
  right: ['call', 'schedule', 'delete'],
};

export const DEFAULT_SWIPE_ACTIONS_INVOICES: SwipeActionsInvoices = {
  right: ['mark_paid', 'pdf', 'delete'],
  left: ['remind'],
};

export const AVAILABLE_CLIENT_SWIPE_ACTIONS: { id: ClientSwipeActionId; label: string; color: string }[] = [
  { id: 'call', label: 'Call', color: '#16a34a' },
  { id: 'schedule', label: 'Schedule', color: '#1B4D6E' },
  { id: 'invoice', label: 'New Invoice', color: '#0891b2' },
  { id: 'message', label: 'Message', color: '#7c3aed' },
  { id: 'delete', label: 'Delete', color: '#dc2626' },
];

export const AVAILABLE_INVOICE_RIGHT_SWIPE_ACTIONS: { id: InvoiceSwipeActionId; label: string; color: string }[] = [
  { id: 'mark_paid', label: 'Mark Paid', color: '#16a34a' },
  { id: 'pdf', label: 'PDF', color: '#1B4D6E' },
  { id: 'send', label: 'Send', color: '#0891b2' },
  { id: 'delete', label: 'Delete', color: '#dc2626' },
];

export const AVAILABLE_INVOICE_LEFT_SWIPE_ACTIONS: { id: InvoiceSwipeActionId; label: string; color: string }[] = [
  { id: 'remind', label: 'Remind', color: '#d97706' },
  { id: 'send', label: 'Send', color: '#0891b2' },
  { id: 'pdf', label: 'PDF', color: '#1B4D6E' },
];

export const AVAILABLE_NOTES_TABS: TabConfig[] = [
  { id: 'notes', label: 'Notes', icon: 'FileText' },
  { id: 'todos', label: 'To-Do', icon: 'CheckSquare' },
  { id: 'team', label: 'Team', icon: 'Users' },
  { id: 'checklists', label: 'Checklists', icon: 'ListChecks' },
  { id: 'supplies', label: 'Supplies', icon: 'Package' },
];

const DEFAULT_CARDS: LayoutItem[] = [
  { id: 'clients', visible: true },
  { id: 'schedule', visible: true },
  { id: 'time', visible: true },
  { id: 'invoices', visible: true },
];

const DEFAULT_TABS: LayoutItem[] = [
  { id: 'index', visible: true },
  { id: 'clients', visible: false },
  { id: 'schedule', visible: true },
  { id: 'time', visible: false },
  { id: 'invoices', visible: true },
  { id: 'notes', visible: true },
  { id: 'finances', visible: true },
  { id: 'routes', visible: false },
  { id: 'hr', visible: false },
];

const DEFAULT_QUICK_ACTIONS: LayoutItem[] = [
  { id: 'clients', visible: true },
  { id: 'schedule', visible: true },
  { id: 'time', visible: true },
  { id: 'invoices', visible: true },
  { id: 'finances', visible: true },
];

const DEFAULT_NOTES_TABS: LayoutItem[] = [
  { id: 'notes', visible: true },
  { id: 'todos', visible: true },
  { id: 'team', visible: false },
  { id: 'checklists', visible: false },
  { id: 'supplies', visible: false },
];

interface LayoutContextType {
  homeCards: LayoutItem[];
  tabs: LayoutItem[];
  quickActions: LayoutItem[];
  notesTabs: LayoutItem[];
  defaultTab: string | null;
  dominantHand: 'right' | 'left';
  swipeActionsClients: SwipeActionsClients;
  swipeActionsInvoices: SwipeActionsInvoices;
  loading: boolean;
  setHomeCards: (cards: LayoutItem[]) => Promise<void>;
  setTabs: (tabs: LayoutItem[]) => Promise<void>;
  setQuickActions: (actions: LayoutItem[]) => Promise<void>;
  setNotesTabs: (tabs: LayoutItem[]) => Promise<void>;
  setDefaultTab: (tabId: string | null) => void;
  setDominantHand: (hand: 'right' | 'left') => void;
  setSwipeActionsClients: (prefs: SwipeActionsClients) => Promise<void>;
  setSwipeActionsInvoices: (prefs: SwipeActionsInvoices) => Promise<void>;
  reorderCards: (fromIndex: number, toIndex: number) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  reorderQuickActions: (fromIndex: number, toIndex: number) => void;
  reorderNotesTabs: (fromIndex: number, toIndex: number) => void;
  toggleCardVisibility: (id: string) => void;
  toggleTabVisibility: (id: string) => void;
  toggleQuickActionVisibility: (id: string) => void;
  toggleNotesTabVisibility: (id: string) => void;
  savePreferences: () => Promise<void>;
  visibleCards: LayoutItem[];
  visibleTabs: LayoutItem[];
  visibleQuickActions: LayoutItem[];
  visibleNotesTabs: LayoutItem[];
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export function LayoutProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [homeCards, setHomeCardsState] = useState<LayoutItem[]>(DEFAULT_CARDS);
  const [tabs, setTabsState] = useState<LayoutItem[]>(DEFAULT_TABS);
  const [quickActions, setQuickActionsState] = useState<LayoutItem[]>(DEFAULT_QUICK_ACTIONS);
  const [notesTabs, setNotesTabsState] = useState<LayoutItem[]>(DEFAULT_NOTES_TABS);
  const [defaultTab, setDefaultTabState] = useState<string | null>(null);
  const [dominantHand, setDominantHandState] = useState<'right' | 'left'>('right');
  const [swipeActionsClients, setSwipeActionsClientsState] = useState<SwipeActionsClients>(DEFAULT_SWIPE_ACTIONS_CLIENTS);
  const [swipeActionsInvoices, setSwipeActionsInvoicesState] = useState<SwipeActionsInvoices>(DEFAULT_SWIPE_ACTIONS_INVOICES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (user?.id) {
      loadPreferences().catch((err) => {
        console.error('Failed to load layout preferences:', err);
        setLoading(false);
      });
    } else {
      setHomeCardsState(DEFAULT_CARDS);
      setTabsState(DEFAULT_TABS);
      setQuickActionsState(DEFAULT_QUICK_ACTIONS);
      setNotesTabsState(DEFAULT_NOTES_TABS);
      setLoading(false);
    }
  }, [user?.id, authLoading]);

  const loadPreferences = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('layout_preferences')
        .select('home_cards, tabs, quick_actions, notes_tabs, default_tab, dominant_hand, swipe_actions_clients, swipe_actions_invoices')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const loadedCards = Array.isArray(data.home_cards) ? data.home_cards as LayoutItem[] : DEFAULT_CARDS;
        const loadedTabs = Array.isArray(data.tabs) ? data.tabs as LayoutItem[] : DEFAULT_TABS;
        const loadedQuickActions = Array.isArray(data.quick_actions) ? data.quick_actions as LayoutItem[] : DEFAULT_QUICK_ACTIONS;
        const loadedNotesTabs = Array.isArray(data.notes_tabs) ? data.notes_tabs as LayoutItem[] : DEFAULT_NOTES_TABS;

        const mergedCards = mergeWithDefaults(loadedCards, DEFAULT_CARDS, AVAILABLE_CARDS);
        const mergedTabs = mergeWithDefaults(loadedTabs, DEFAULT_TABS, AVAILABLE_TABS);
        const mergedQuickActions = mergeWithDefaults(loadedQuickActions, DEFAULT_QUICK_ACTIONS, AVAILABLE_QUICK_ACTIONS);
        const mergedNotesTabs = mergeWithDefaults(loadedNotesTabs, DEFAULT_NOTES_TABS, AVAILABLE_NOTES_TABS);

        setHomeCardsState(mergedCards);
        setTabsState(mergedTabs);
        setQuickActionsState(mergedQuickActions);
        setNotesTabsState(mergedNotesTabs);
        setDefaultTabState(data.default_tab || null);
        setDominantHandState((data as any).dominant_hand === 'left' ? 'left' : 'right');
        setSwipeActionsClientsState((data as any).swipe_actions_clients || DEFAULT_SWIPE_ACTIONS_CLIENTS);
        setSwipeActionsInvoicesState((data as any).swipe_actions_invoices || DEFAULT_SWIPE_ACTIONS_INVOICES);
      } else {
        setHomeCardsState(DEFAULT_CARDS);
        setTabsState(DEFAULT_TABS);
        setQuickActionsState(DEFAULT_QUICK_ACTIONS);
        setNotesTabsState(DEFAULT_NOTES_TABS);
        setDefaultTabState(null);
        setDominantHandState('right');
        setSwipeActionsClientsState(DEFAULT_SWIPE_ACTIONS_CLIENTS);
        setSwipeActionsInvoicesState(DEFAULT_SWIPE_ACTIONS_INVOICES);
      }
    } catch (error) {
      console.error('Error loading layout preferences:', error);
      setHomeCardsState(DEFAULT_CARDS);
      setTabsState(DEFAULT_TABS);
      setQuickActionsState(DEFAULT_QUICK_ACTIONS);
      setNotesTabsState(DEFAULT_NOTES_TABS);
      setSwipeActionsClientsState(DEFAULT_SWIPE_ACTIONS_CLIENTS);
      setSwipeActionsInvoicesState(DEFAULT_SWIPE_ACTIONS_INVOICES);
    } finally {
      setLoading(false);
    }
  };

  const mergeWithDefaults = (
    saved: LayoutItem[],
    defaults: LayoutItem[],
    available: { id: string }[]
  ): LayoutItem[] => {
    if (!Array.isArray(saved) || saved.length === 0) return defaults;
    const savedIds = new Set(saved.map(item => item.id));
    const availableIds = new Set(available.map(item => item.id));

    const validSaved = saved.filter(item => availableIds.has(item.id));

    const defaultVisibility = new Map(defaults.map(item => [item.id, item.visible]));
    const missingItems = available
      .filter(item => !savedIds.has(item.id))
      .map(item => ({ id: item.id, visible: defaultVisibility.get(item.id) ?? false }));

    return [...validSaved, ...missingItems];
  };

  const savePreferences = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('layout_preferences')
        .upsert({
          user_id: user.id,
          home_cards: homeCards,
          tabs: tabs,
          quick_actions: quickActions,
          notes_tabs: notesTabs,
          default_tab: defaultTab,
          dominant_hand: dominantHand,
          swipe_actions_clients: swipeActionsClients,
          swipe_actions_invoices: swipeActionsInvoices,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error saving layout preferences:', error);
      throw error;
    }
  }, [user?.id, homeCards, tabs, quickActions, notesTabs, defaultTab, dominantHand, swipeActionsClients, swipeActionsInvoices]);

  const setSwipeActionsClients = useCallback(async (prefs: SwipeActionsClients) => {
    setSwipeActionsClientsState(prefs);
    if (!user?.id) return;
    try {
      await supabase
        .from('layout_preferences')
        .upsert({ user_id: user.id, swipe_actions_clients: prefs, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    } catch (err) {
      console.error('Error saving swipe actions (clients):', err);
    }
  }, [user?.id]);

  const setSwipeActionsInvoices = useCallback(async (prefs: SwipeActionsInvoices) => {
    setSwipeActionsInvoicesState(prefs);
    if (!user?.id) return;
    try {
      await supabase
        .from('layout_preferences')
        .upsert({ user_id: user.id, swipe_actions_invoices: prefs, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    } catch (err) {
      console.error('Error saving swipe actions (invoices):', err);
    }
  }, [user?.id]);

  const setDominantHand = useCallback(async (hand: 'right' | 'left') => {
    setDominantHandState(hand);
    if (!user?.id) return;
    try {
      await supabase
        .from('layout_preferences')
        .upsert({ user_id: user.id, dominant_hand: hand, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    } catch (err) {
      console.error('Error saving dominant hand:', err);
    }
  }, [user?.id]);

  const setDefaultTab = (tabId: string | null) => {
    setDefaultTabState(tabId);
  };


  const setHomeCards = async (cards: LayoutItem[]) => {
    setHomeCardsState(cards);
  };

  const setTabs = async (newTabs: LayoutItem[]) => {
    setTabsState(newTabs);
  };

  const setQuickActions = async (actions: LayoutItem[]) => {
    setQuickActionsState(actions);
  };

  const setNotesTabs = async (tabs: LayoutItem[]) => {
    setNotesTabsState(tabs);
  };

  const reorderCards = (fromIndex: number, toIndex: number) => {
    const newCards = [...homeCards];
    const [removed] = newCards.splice(fromIndex, 1);
    newCards.splice(toIndex, 0, removed);
    setHomeCardsState(newCards);
  };

  const reorderTabs = (fromIndex: number, toIndex: number) => {
    const newTabs = [...tabs];
    const [removed] = newTabs.splice(fromIndex, 1);
    newTabs.splice(toIndex, 0, removed);
    setTabsState(newTabs);
  };

  const reorderQuickActions = (fromIndex: number, toIndex: number) => {
    const newActions = [...quickActions];
    const [removed] = newActions.splice(fromIndex, 1);
    newActions.splice(toIndex, 0, removed);
    setQuickActionsState(newActions);
  };

  const reorderNotesTabs = (fromIndex: number, toIndex: number) => {
    const newTabs = [...notesTabs];
    const [removed] = newTabs.splice(fromIndex, 1);
    newTabs.splice(toIndex, 0, removed);
    setNotesTabsState(newTabs);
  };

  const toggleCardVisibility = (id: string) => {
    const visibleCount = homeCards.filter(c => c.visible).length;
    const card = homeCards.find(c => c.id === id);

    if (card?.visible || visibleCount < 6) {
      setHomeCardsState(prev =>
        prev.map(c => c.id === id ? { ...c, visible: !c.visible } : c)
      );
    }
  };

  const toggleTabVisibility = (id: string) => {
    if (id === 'index') return;

    const visibleCount = tabs.filter(t => t.visible).length;
    const tab = tabs.find(t => t.id === id);

    if (tab?.visible || visibleCount < 6) {
      setTabsState(prev =>
        prev.map(t => t.id === id ? { ...t, visible: !t.visible } : t)
      );
    }
  };

  const toggleQuickActionVisibility = (id: string) => {
    const visibleCount = quickActions.filter(a => a.visible).length;
    const action = quickActions.find(a => a.id === id);

    if (action?.visible || visibleCount < 6) {
      setQuickActionsState(prev =>
        prev.map(a => a.id === id ? { ...a, visible: !a.visible } : a)
      );
    }
  };

  const toggleNotesTabVisibility = (id: string) => {
    const visibleCount = notesTabs.filter(t => t.visible).length;
    const tab = notesTabs.find(t => t.id === id);

    if (tab?.visible || visibleCount < 2) {
      setNotesTabsState(prev =>
        prev.map(t => t.id === id ? { ...t, visible: !t.visible } : t)
      );
    }
  };

  const visibleCards = homeCards.filter(c => c.visible);
  const visibleTabs = tabs.filter(t => t.visible);
  const visibleQuickActions = quickActions.filter(a => a.visible);
  const visibleNotesTabs = notesTabs.filter(t => t.visible);

  return (
    <LayoutContext.Provider
      value={{
        homeCards,
        tabs,
        quickActions,
        notesTabs,
        defaultTab,
        dominantHand,
        swipeActionsClients,
        swipeActionsInvoices,
        loading,
        setHomeCards,
        setTabs,
        setQuickActions,
        setNotesTabs,
        setDefaultTab,
        setDominantHand,
        setSwipeActionsClients,
        setSwipeActionsInvoices,
        reorderCards,
        reorderTabs,
        reorderQuickActions,
        reorderNotesTabs,
        toggleCardVisibility,
        toggleTabVisibility,
        toggleQuickActionVisibility,
        toggleNotesTabVisibility,
        savePreferences,
        visibleCards,
        visibleTabs,
        visibleQuickActions,
        visibleNotesTabs,
      }}
    >
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout() {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error('useLayout must be used within a LayoutProvider');
  }
  return context;
}
