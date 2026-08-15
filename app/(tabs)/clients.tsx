import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
  Image,
  Modal,
  Pressable,
} from 'react-native';
import { LogOut, Search, X, Download, Tag, FileText, CalendarClock, SlidersHorizontal, ArrowUpDown, Settings2, Send, Menu, ChevronDown, ChevronUp, Check, MailX, Building2, MapPin, Calendar, MessageSquare, Receipt, ClipboardList, Users, UserPlus, Phone, Trash2 } from 'lucide-react-native';
import SwipeableRow from '@/components/SwipeableRow';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import { useRouter } from 'expo-router';
import { useLayout } from '@/contexts/LayoutContext';
import SwipeActionsSettingsModal from '@/components/SwipeActionsSettingsModal';
import { useTabNavigation } from '@/contexts/TabNavigationContext';
import { useWalkthrough } from '@/contexts/WalkthroughContext';
import { AnimatedTabContent } from '@/components/AnimatedTabContent';
import ClientModal from '@/components/ClientModal';
import InvoiceModal from '@/components/InvoiceModal';
import EstimateModal from '@/components/EstimateModal';
import ClientStatementModal from '@/components/ClientStatementModal';
import WorkflowFab from '@/components/WorkflowFab';
import type { FabAction } from '@/components/WorkflowFab';
import ContactImportModal from '@/components/ContactImportModal';
import ScheduleModal from '@/components/ScheduleModal';
import DatePicker from '@/components/DatePicker';
import ScheduleCalendarPickerModal from '@/components/ScheduleCalendarPickerModal';
import WorkRequestsModal from '@/components/WorkRequestsModal';
import BroadcastMessageModal from '@/components/BroadcastMessageModal';
import ClientQuickSendModal from '@/components/ClientQuickSendModal';
import ClickableContact from '@/components/ClickableContact';
import BlurHeader from '@/components/BlurHeader';
import { getSlideDirection, getDynamicTabOrder } from '@/utils/tabAnimations';
import getDynamicStyles from '@/styles/clientStyles';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useQuickActionHandler } from '@/hooks/useQuickActionHandler';
import { useTimerPrefill } from '@/contexts/TimerPrefillContext';
import { HapticPatterns } from '@/lib/haptics';

interface ClientAddressRow {
  id: string;
  label: string;
  address: string;
  is_primary: boolean;
  service_window_start?: string | null;
  service_window_end?: string | null;
  target_week_of_month?: number | null;
  preferred_day?: string | null;
  use_client_service_window?: boolean;
  typical_job_duration?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  price_override?: number | null;
  price_override_enabled?: boolean;
  access_code?: string | null;
  access_code_type?: string | null;
  address_type?: string | null;
}

interface CommercialAddressJob {
  addressId: string;
  addressLabel: string;
  address: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  targetWeek: number | null;
  preferredDay: string | null;
  serviceWindowStart: string | null;
  serviceWindowEnd: string | null;
  typicalJobDuration: number | null;
}

type ClientListTab = 'all' | 'commercial';

interface ClientEstimateSummary {
  total_estimates: number;
  pending_total: number;
  approved_total: number;
}

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  typical_job_duration?: number;
  notification_preference?: string;
  client_type?: string | null;
  commercial_service_window_start?: string | null;
  commercial_service_window_end?: string | null;
  client_addresses?: ClientAddressRow[];
  estimate_summary?: ClientEstimateSummary;
  job_type_ids?: string[];
  category_ids?: string[];
  secondary_contact_name?: string | null;
  secondary_contact_phone?: string | null;
  secondary_contact_email?: string | null;
  review_follow_up_sent_at?: string | null;
  first_name?: string;
  last_name?: string;
}

interface JobType {
  id: string;
  name: string;
}

interface JobTypeCategory {
  id: string;
  name: string;
  color: string;
}

type SortOption = 'name_asc' | 'first_name' | 'last_name';

export default function ClientsScreen() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [schedulePrefill, setSchedulePrefill] = useState<{ clientId: string; clientName: string; address?: string; latitude?: number; longitude?: number; phone?: string; email?: string; typicalJobDuration?: number; priceOverride?: number; priceOverrideEnabled?: boolean; accessCode?: string; accessCodeType?: string; addressId?: string } | null>(null);
  const [scheduleCalendarPickerVisible, setScheduleCalendarPickerVisible] = useState(false);
  const [schedulePreselectedDate, setSchedulePreselectedDate] = useState<Date | null>(null);
  const [workRequestsModalVisible, setWorkRequestsModalVisible] = useState(false);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [broadcastVisible, setBroadcastVisible] = useState(false);
  const [clientListTab, setClientListTab] = useState<ClientListTab>('all');
  const [quickSendVisible, setQuickSendVisible] = useState(false);
  const [quickSendClient, setQuickSendClient] = useState<Client | null>(null);
  const [fabOpen, setFabOpen] = useState(false);
  const [invoiceModalVisible, setInvoiceModalVisible] = useState(false);
  const [invoicePrefill, setInvoicePrefill] = useState<{ clientId: string; items: any[]; notes?: string; taxRate?: string } | null>(null);
  const [estimateModalVisible, setEstimateModalVisible] = useState(false);
  const [estimatePrefill, setEstimatePrefill] = useState<{ clientId: string } | null>(null);
  const [statementModalVisible, setStatementModalVisible] = useState(false);
  const [statementClient, setStatementClient] = useState<{ id: string; name: string; email: string; phone: string } | null>(null);
  const [contextClient, setContextClient] = useState<Client | null>(null);
  const [clientPrefillName, setClientPrefillName] = useState('');
  const [clientPrefillPhone, setClientPrefillPhone] = useState('');
  const [clientPrefillAddress, setClientPrefillAddress] = useState('');
  const [clientPrefillLanguage, setClientPrefillLanguage] = useState('');
  const [quickActionScheduleVisible, setQuickActionScheduleVisible] = useState(false);
  const [quickActionSchedulePrefill, setQuickActionSchedulePrefill] = useState<any>(null);
  const [quickActionScheduleDate, setQuickActionScheduleDate] = useState<Date | null>(null);
  const [clientAddSheetVisible, setClientAddSheetVisible] = useState(false);
  const [clientModalInitialMode, setClientModalInitialMode] = useState<'chooser' | 'quick' | 'full'>('chooser');

  const [jobTypes, setJobTypes] = useState<JobType[]>([]);
  const [categories, setCategories] = useState<JobTypeCategory[]>([]);
  const [selectedJobTypeIds, setSelectedJobTypeIds] = useState<Set<string>>(new Set());
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set());
  const [selectedClientTypes, setSelectedClientTypes] = useState<Set<string>>(new Set());
  const [sortOption, setSortOption] = useState<SortOption>('name_asc');
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [sortPanelOpen, setSortPanelOpen] = useState(false);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [unsubscribedEmails, setUnsubscribedEmails] = useState<Set<string>>(new Set());
  const [clientPage, setClientPage] = useState(1);
  const CLIENT_PAGE_SIZE = 25;

  const { user, signOut } = useAuth();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const { startWalkthrough } = useWalkthrough();
  const router = useRouter();
  const { setTimerPrefill } = useTimerPrefill();
  const { currentTab: globalCurrentTab, previousTab: globalPreviousTab } = useTabNavigation();
  const { currentOrganization } = useOrganization();
  const pendingDeleteRef = useRef<{ client: Client; timeoutId: ReturnType<typeof setTimeout> } | null>(null);
  const { visibleTabs, dominantHand, swipeActionsClients } = useLayout();
  const [swipeSettingsVisible, setSwipeSettingsVisible] = useState(false);
  const dynamicStyles = getDynamicStyles(colors);
  const dynamicOrder = getDynamicTabOrder(visibleTabs);
  const slideDirection = getSlideDirection(globalPreviousTab, globalCurrentTab, dynamicOrder);

  const filteredClients = useMemo(() => {
    let list = [...clients];

    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase();
      list = list.filter(
        (client) =>
          client.name.toLowerCase().includes(query) ||
          (client.email || '').toLowerCase().includes(query) ||
          (client.phone || '').includes(query) ||
          (client.address || '').toLowerCase().includes(query) ||
          (client.client_addresses || []).some(a =>
            (a.address || '').toLowerCase().includes(query) ||
            (a.label || '').toLowerCase().includes(query)
          )
      );
    }

    if (selectedClientTypes.size > 0) {
      list = list.filter(client => client.client_type && selectedClientTypes.has(client.client_type));
    }

    if (selectedCategoryIds.size > 0) {
      list = list.filter(client =>
        (client.category_ids || []).some(id => selectedCategoryIds.has(id))
      );
    }

    if (selectedJobTypeIds.size > 0) {
      list = list.filter(client =>
        (client.job_type_ids || []).some(id => selectedJobTypeIds.has(id))
      );
    }

    list.sort((a, b) => {
      if (sortOption === 'first_name') {
        const aFirst = a.name.trim().split(' ')[0] || '';
        const bFirst = b.name.trim().split(' ')[0] || '';
        return aFirst.localeCompare(bFirst);
      }
      if (sortOption === 'last_name') {
        const aParts = a.name.trim().split(' ');
        const bParts = b.name.trim().split(' ');
        const aLast = aParts.length > 1 ? aParts[aParts.length - 1] : aParts[0];
        const bLast = bParts.length > 1 ? bParts[bParts.length - 1] : bParts[0];
        return aLast.localeCompare(bLast);
      }
      return a.name.localeCompare(b.name);
    });

    return list;
  }, [clients, debouncedSearchQuery, selectedJobTypeIds, selectedCategoryIds, selectedClientTypes, sortOption]);

  // When categories are selected, only show job types that exist on clients
  // belonging to those categories. When no categories are selected, show all.
  const visibleJobTypes = useMemo(() => {
    if (selectedCategoryIds.size === 0) return jobTypes;
    const allowedIds = new Set(
      clients
        .filter(c => (c.category_ids || []).some(id => selectedCategoryIds.has(id)))
        .flatMap(c => c.job_type_ids || [])
    );
    return jobTypes.filter(jt => allowedIds.has(jt.id));
  }, [jobTypes, clients, selectedCategoryIds]);

  const commercialAddressJobs = useMemo((): CommercialAddressJob[] => {
    const jobs: CommercialAddressJob[] = [];
    for (const client of clients) {
      if (!client.client_addresses || client.client_addresses.length === 0) continue;
      const isClientCommercial = client.client_type === 'commercial';
      for (const addr of client.client_addresses) {
        const isAddrCommercial = addr.address_type === 'commercial' || (isClientCommercial && addr.address_type !== 'residential');
        if (!isAddrCommercial) continue;
        const useClientWindow = addr.use_client_service_window !== false;
        jobs.push({
          addressId: addr.id,
          addressLabel: addr.label,
          address: addr.address,
          clientId: client.id,
          clientName: client.name,
          clientPhone: client.phone,
          clientEmail: client.email,
          targetWeek: addr.target_week_of_month ?? null,
          preferredDay: addr.preferred_day ?? null,
          serviceWindowStart: useClientWindow
            ? (client.commercial_service_window_start ?? addr.service_window_start ?? null)
            : (addr.service_window_start ?? null),
          serviceWindowEnd: useClientWindow
            ? (client.commercial_service_window_end ?? addr.service_window_end ?? null)
            : (addr.service_window_end ?? null),
          typicalJobDuration: addr.typical_job_duration ?? client.typical_job_duration ?? null,
        });
      }
    }
    if (debouncedSearchQuery.trim()) {
      const q = debouncedSearchQuery.toLowerCase();
      return jobs.filter(j =>
        j.clientName.toLowerCase().includes(q) ||
        j.address.toLowerCase().includes(q) ||
        j.addressLabel.toLowerCase().includes(q)
      );
    }
    return jobs;
  }, [clients, debouncedSearchQuery]);

  const commercialCount = useMemo(() =>
    commercialAddressJobs.length
  , [commercialAddressJobs]);

  const pagedClients = useMemo(() =>
    filteredClients.slice(0, clientPage * CLIENT_PAGE_SIZE)
  , [filteredClients, clientPage]);

  const handleLoadMoreClients = useCallback(() => {
    if (pagedClients.length < filteredClients.length) {
      setClientPage(p => p + 1);
    }
  }, [pagedClients.length, filteredClients.length]);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setClientPage(1);
    }, 300);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery]);

  useEffect(() => {
    setClientPage(1);
  }, [selectedJobTypeIds, selectedCategoryIds, selectedClientTypes, sortOption]);

  const lastFetchOrgRef = useRef<string | null>(null);

  useEffect(() => {
    if (!currentOrganization?.id) return;
    if (lastFetchOrgRef.current !== currentOrganization.id) {
      lastFetchOrgRef.current = currentOrganization.id;
      fetchClients();
      return;
    }
    if (globalCurrentTab === 'clients') {
      fetchClients();
    }
  }, [currentOrganization?.id, globalCurrentTab]);

  const fetchPendingRequestCount = async () => {
    if (!currentOrganization) return;
    const { count } = await supabase
      .from('client_work_requests')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', currentOrganization.id)
      .eq('status', 'pending');
    setPendingRequestCount(count ?? 0);
  };

  const fetchClients = async () => {
    if (!currentOrganization) {
      setLoading(false);
      return;
    }
    fetchPendingRequestCount();
    try {
      const [clientsRes, estimatesRes, jobTypesRes, scheduledJobsRes, categoriesRes, clientCategoriesRes, unsubRes] = await Promise.all([
        supabase
          .from('clients')
          .select('*, client_addresses(id, label, address, street, city, state, postal_code, is_primary, service_window_start, service_window_end, target_week_of_month, preferred_day, use_client_service_window, typical_job_duration, latitude, longitude, price_override, price_override_enabled, access_code, access_code_type, address_type)')
          .eq('organization_id', currentOrganization.id)
          .order('name', { ascending: true }),
        supabase
          .from('estimates')
          .select('client_id, total, status')
          .eq('organization_id', currentOrganization.id)
          .in('status', ['draft', 'sent', 'approved', 'accepted']),
        supabase
          .from('job_types')
          .select('id, name')
          .eq('organization_id', currentOrganization.id)
          .order('name', { ascending: true }),
        supabase
          .from('schedule_events')
          .select('client_id, job_type_id')
          .eq('organization_id', currentOrganization.id)
          .not('job_type_id', 'is', null),
        supabase
          .from('job_type_categories')
          .select('id, name, color')
          .eq('organization_id', currentOrganization.id)
          .order('name', { ascending: true }),
        supabase
          .from('client_categories')
          .select('client_id, category_id')
          .eq('organization_id', currentOrganization.id),
        supabase
          .from('email_unsubscribes')
          .select('email')
          .eq('organization_id', currentOrganization.id),
      ]);

      if (clientsRes.error) throw clientsRes.error;

      setJobTypes(jobTypesRes.data || []);
      setCategories(categoriesRes.data || []);

      const unsubSet = new Set<string>();
      (unsubRes.data || []).forEach(row => {
        if (row.email) unsubSet.add(row.email.toLowerCase());
      });
      setUnsubscribedEmails(unsubSet);

      const clientJobTypeMap: Record<string, Set<string>> = {};
      (scheduledJobsRes.data || []).forEach(row => {
        if (!row.client_id || !row.job_type_id) return;
        if (!clientJobTypeMap[row.client_id]) clientJobTypeMap[row.client_id] = new Set();
        clientJobTypeMap[row.client_id].add(row.job_type_id);
      });

      const clientCategoryMap: Record<string, string[]> = {};
      (clientCategoriesRes.data || []).forEach(row => {
        if (!row.client_id || !row.category_id) return;
        if (!clientCategoryMap[row.client_id]) clientCategoryMap[row.client_id] = [];
        clientCategoryMap[row.client_id].push(row.category_id);
      });

      const estimatesByClient: Record<string, ClientEstimateSummary> = {};
      (estimatesRes.data || []).forEach(est => {
        if (!est.client_id) return;
        if (!estimatesByClient[est.client_id]) {
          estimatesByClient[est.client_id] = { total_estimates: 0, pending_total: 0, approved_total: 0 };
        }
        const s = estimatesByClient[est.client_id];
        s.total_estimates += 1;
        if (est.status === 'approved' || est.status === 'accepted') {
          s.approved_total += Number(est.total) || 0;
        } else {
          s.pending_total += Number(est.total) || 0;
        }
      });

      const merged = (clientsRes.data || []).map(c => ({
        ...c,
        estimate_summary: estimatesByClient[c.id] || null,
        job_type_ids: clientJobTypeMap[c.id] ? Array.from(clientJobTypeMap[c.id]) : [],
        category_ids: clientCategoryMap[c.id] || [],
      }));

      setClients(merged);
    } catch (error: any) {
      let msg = 'Failed to load clients.';
      if (error?.message && typeof error.message === 'string') {
        try {
          const parsed = JSON.parse(error.message);
          msg = parsed?.message || parsed?.error || msg;
        } catch {
          msg = error.message;
        }
      }
      showToast({
        message: msg,
        type: 'error',
        duration: 8000,
        action: { label: 'Retry', onPress: () => fetchClients() },
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddClient = useCallback((mode?: 'chooser' | 'quick' | 'full') => {
    setSelectedClient(null);
    setClientModalInitialMode(mode || 'chooser');
    setModalVisible(true);
  }, []);

  const handleEditClient = useCallback((client: Client) => {
    setSelectedClient(client);
    setModalVisible(true);
  }, []);

  const closeFab = useCallback(() => setFabOpen(false), []);
  const toggleFab = useCallback(() => {
    if (!contextClient) {
      setClientAddSheetVisible(true);
    } else {
      setFabOpen(prev => !prev);
    }
  }, [contextClient]);

  const handleQuickAction = useQuickActionHandler({
    onAddClient: (name, phone, address, language) => {
      setSelectedClient(null);
      setClientPrefillName(name || '');
      setClientPrefillPhone(phone || '');
      setClientPrefillAddress(address || '');
      setClientPrefillLanguage(language || '');
      setClientModalInitialMode('quick');
      setModalVisible(true);
    },
    onScheduleClient: (prefill, date) => {
      setQuickActionSchedulePrefill(prefill);
      setQuickActionScheduleDate(date);
      setQuickActionScheduleVisible(true);
    },
    onInvoiceClient: (prefill) => {
      setInvoicePrefill(prefill);
      setInvoiceModalVisible(true);
    },
  });

  const handleContextInvoice = useCallback(() => {
    closeFab();
    if (contextClient) {
      setInvoicePrefill({ clientId: contextClient.id, items: [] });
      setInvoiceModalVisible(true);
    }
  }, [contextClient]);

  const handleContextEstimate = useCallback(() => {
    closeFab();
    if (contextClient) {
      setEstimatePrefill({ clientId: contextClient.id });
      setEstimateModalVisible(true);
    }
  }, [contextClient]);

  const handleContextScheduleJob = useCallback(() => {
    closeFab();
    if (contextClient) {
      const primaryAddr = contextClient.client_addresses?.find(a => a.is_primary) || contextClient.client_addresses?.[0];
      setSchedulePrefill({
        clientId: contextClient.id,
        clientName: contextClient.name,
        address: primaryAddr?.address || contextClient.address,
        phone: contextClient.phone,
        email: contextClient.email,
        typicalJobDuration: primaryAddr?.typical_job_duration || contextClient.typical_job_duration,
        addressId: primaryAddr?.id,
        priceOverride: primaryAddr?.price_override ?? undefined,
        priceOverrideEnabled: primaryAddr?.price_override_enabled ?? undefined,
        accessCode: primaryAddr?.access_code ?? undefined,
        accessCodeType: primaryAddr?.access_code_type ?? undefined,
      });
      setSchedulePreselectedDate(null);
      setScheduleCalendarPickerVisible(true);
    }
  }, [contextClient]);

  const fabActions = useMemo((): FabAction[] => {
    if (contextClient) {
      return [
        { id: 'invoice', label: 'New Invoice', icon: Receipt, color: '#059669', onPress: handleContextInvoice },
        { id: 'estimate', label: 'New Estimate', icon: ClipboardList, color: '#2563eb', onPress: handleContextEstimate },
        { id: 'schedule', label: 'Schedule Job', icon: Calendar, color: '#d97706', onPress: handleContextScheduleJob },
      ];
    }
    return [];
  }, [contextClient, handleContextInvoice, handleContextEstimate, handleContextScheduleJob]);

  const handleDeleteClient = useCallback((client: Client) => {
    if (pendingDeleteRef.current) {
      clearTimeout(pendingDeleteRef.current.timeoutId);
      executeDelete(pendingDeleteRef.current.client);
    }

    setClients((prev) => prev.filter((c) => c.id !== client.id));

    const timeoutId = setTimeout(() => {
      executeDelete(client);
      pendingDeleteRef.current = null;
    }, 5000);

    pendingDeleteRef.current = { client, timeoutId };

    showToast({
      message: `${client.name} deleted`,
      type: 'info',
      duration: 5000,
      action: {
        label: 'Undo',
        onPress: () => {
          if (pendingDeleteRef.current?.client.id === client.id) {
            clearTimeout(pendingDeleteRef.current.timeoutId);
            pendingDeleteRef.current = null;
            setClients((prev) => [...prev, client].sort((a, b) => a.name.localeCompare(b.name)));
            showToast({ message: 'Client restored', type: 'success', duration: 2000 });
          }
        },
      },
    });
  }, [showToast]);

  const executeDelete = async (client: Client) => {
    HapticPatterns.delete();
    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', client.id)
        .eq('user_id', user!.id);
      if (error) throw error;
    } catch (error: any) {
      HapticPatterns.error();
      showToast({
        message: error?.message || 'Failed to delete client',
        type: 'error',
        duration: 4000,
      });
      fetchClients();
    }
  };

  const handleSignOut = useCallback(async () => {
    await signOut();
    router.replace('/login');
  }, [signOut, router]);

  const toggleJobTypeFilter = useCallback((id: string) => {
    setSelectedJobTypeIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleCategoryFilter = useCallback((id: string) => {
    setSelectedCategoryIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);

      // After the category set changes, clear any job type selections that are
      // no longer visible (i.e. not present on clients in the new category set).
      if (next.size > 0) {
        const allowedJobTypeIds = new Set(
          clients
            .filter(c => (c.category_ids || []).some(cid => next.has(cid)))
            .flatMap(c => c.job_type_ids || [])
        );
        setSelectedJobTypeIds(prev2 => {
          const filtered = new Set([...prev2].filter(jtId => allowedJobTypeIds.has(jtId)));
          return filtered.size === prev2.size ? prev2 : filtered;
        });
      }

      return next;
    });
  }, [clients]);

  const toggleClientTypeFilter = useCallback((type: string) => {
    setSelectedClientTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setSelectedJobTypeIds(new Set());
    setSelectedCategoryIds(new Set());
    setSelectedClientTypes(new Set());
    setSortOption('name_asc');
    setSearchQuery('');
  }, []);

  const getFilterLabel = () => {
    if (selectedClientTypes.size > 0) {
      const labels = Array.from(selectedClientTypes).map(t => t.charAt(0).toUpperCase() + t.slice(1));
      return labels.join(', ') + ' clients';
    }
    if (selectedCategoryIds.size > 0) {
      const names = categories.filter(c => selectedCategoryIds.has(c.id)).map(c => c.name);
      return names.join(', ') + ' clients';
    }
    if (selectedJobTypeIds.size === 0) return undefined;
    const names = jobTypes.filter(jt => selectedJobTypeIds.has(jt.id)).map(jt => jt.name);
    return names.join(', ') + ' clients';
  };

  const hasActiveFilters = selectedJobTypeIds.size > 0 || selectedCategoryIds.size > 0 || selectedClientTypes.size > 0 || sortOption !== 'name_asc';

  const renderClient = useCallback(({ item }: { item: Client }) => {
    const addrs = item.client_addresses && item.client_addresses.length > 0
      ? item.client_addresses
      : item.address ? [{ id: 'legacy', label: '', address: item.address, is_primary: true }] : [];

    const clientActionMap: Record<string, { label: string; icon: React.ReactNode; color: string; onPress: () => void } | null> = {
      call: item.phone ? {
        label: 'Call',
        icon: <Phone size={18} color="#fff" />,
        color: '#16a34a',
        onPress: () => {
          const url = `tel:${item.phone}`;
          import('react-native').then(({ Linking }) => Linking.openURL(url).catch(() => {}));
        },
      } : null,
      schedule: {
        label: 'Schedule',
        icon: <Calendar size={18} color="#fff" />,
        color: '#1B4D6E',
        onPress: () => {
          const primaryAddr = item.client_addresses?.find(a => a.is_primary) || item.client_addresses?.[0];
          setSchedulePrefill({
            clientId: item.id,
            clientName: item.name,
            address: primaryAddr?.address || item.address,
            phone: item.phone,
            email: item.email,
            typicalJobDuration: primaryAddr?.typical_job_duration || item.typical_job_duration,
            addressId: primaryAddr?.id,
          });
          setSchedulePreselectedDate(null);
          setScheduleCalendarPickerVisible(true);
        },
      },
      invoice: {
        label: 'Invoice',
        icon: <Receipt size={18} color="#fff" />,
        color: '#0891b2',
        onPress: () => {
          setInvoicePrefill({ clientId: item.id, items: [] });
          setInvoiceModalVisible(true);
        },
      },
      message: (item.phone || item.secondary_contact_phone) ? {
        label: 'Message',
        icon: <MessageSquare size={18} color="#fff" />,
        color: '#7c3aed',
        onPress: () => {
          setQuickSendClient(item);
          setQuickSendVisible(true);
        },
      } : null,
      delete: {
        label: 'Delete',
        icon: <Trash2 size={18} color="#fff" />,
        color: '#dc2626',
        onPress: () => handleDeleteClient(item),
      },
    };

    const rightActionIds = swipeActionsClients?.right ?? ['call', 'schedule', 'delete'];
    const swipeActions = rightActionIds
      .map(id => clientActionMap[id])
      .filter((a): a is NonNullable<typeof a> => a !== null);

    return (
      <SwipeableRow rightActions={swipeActions}>
        <TouchableOpacity
          style={dynamicStyles.clientCard}
          onPress={() => handleEditClient(item)}
          activeOpacity={0.7}
        >
        <View style={dynamicStyles.clientHeader}>
          <Text style={[dynamicStyles.clientName, { flex: 1 }]}>{item.name}</Text>
          {item.review_follow_up_sent_at && (
            <View style={localStyles.reviewSentBadge}>
              <Check size={11} color="#16a34a" strokeWidth={2.5} />
            </View>
          )}
          {(item.phone || item.secondary_contact_phone) && (
            <TouchableOpacity
              style={localStyles.quickSendBtn}
              onPress={(e) => {
                e.stopPropagation();
                setQuickSendClient(item);
                setQuickSendVisible(true);
              }}
              activeOpacity={0.7}
            >
              <MessageSquare size={14} color="#1B4D6E" />
              <Text style={localStyles.quickSendBtnText}>Message</Text>
            </TouchableOpacity>
          )}
        </View>
        {item.email ? (
          <View style={dynamicStyles.clientInfo}>
            <ClickableContact type="email" value={item.email} />
            {unsubscribedEmails.has(item.email.toLowerCase()) && (
              <View style={localStyles.unsubBadge}>
                <MailX size={10} color="#dc2626" />
                <Text style={localStyles.unsubBadgeText}>Unsubscribed</Text>
              </View>
            )}
          </View>
        ) : null}
        {item.phone ? (
          <View style={dynamicStyles.clientInfo}>
            <ClickableContact type="phone" value={item.phone} />
          </View>
        ) : null}
        {addrs.map((addr) => (
          <View key={addr.id} style={dynamicStyles.clientInfo}>
            {addr.label ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Tag size={12} color="#6B7280" />
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B7280', marginRight: 4 }}>
                  {addr.label}
                </Text>
              </View>
            ) : null}
            <ClickableContact type="address" value={[addr.street, addr.city, addr.state, addr.postal_code].filter(Boolean).join(', ') || addr.address} shortAddress={true} />
          </View>
        ))}
        {item.category_ids && item.category_ids.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
            {item.category_ids.slice(0, 3).map(catId => {
              const cat = categories.find(c => c.id === catId);
              if (!cat) return null;
              return (
                <View key={catId} style={[localStyles.jobTypePill, { backgroundColor: cat.color + '18' }]}>
                  <View style={[localStyles.catPillDot, { backgroundColor: cat.color }]} />
                  <Text style={[localStyles.jobTypePillText, { color: cat.color }]} numberOfLines={1}>{cat.name}</Text>
                </View>
              );
            })}
            {item.category_ids.length > 3 && (
              <View style={localStyles.jobTypePill}>
                <Text style={localStyles.jobTypePillText}>+{item.category_ids.length - 3} more</Text>
              </View>
            )}
          </View>
        )}
        {(!item.category_ids || item.category_ids.length === 0) && item.job_type_ids && item.job_type_ids.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
            {item.job_type_ids.slice(0, 3).map(jtId => {
              const jt = jobTypes.find(j => j.id === jtId);
              if (!jt) return null;
              return (
                <View key={jtId} style={localStyles.jobTypePill}>
                  <Text style={localStyles.jobTypePillText} numberOfLines={1}>{jt.name}</Text>
                </View>
              );
            })}
            {item.job_type_ids.length > 3 && (
              <View style={localStyles.jobTypePill}>
                <Text style={localStyles.jobTypePillText}>+{item.job_type_ids.length - 3} more</Text>
              </View>
            )}
          </View>
        )}
        {item.estimate_summary && item.estimate_summary.total_estimates > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surface, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 }}>
              <FileText size={11} color={colors.textSecondary} />
              <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                {item.estimate_summary.total_estimates} estimate{item.estimate_summary.total_estimates !== 1 ? 's' : ''}
              </Text>
            </View>
            {item.estimate_summary.approved_total > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 }}>
                <Text style={{ fontSize: 11, color: '#15803d', fontWeight: '600' }}>
                  ${item.estimate_summary.approved_total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} approved
                </Text>
              </View>
            )}
            {item.estimate_summary.pending_total > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fef9c3', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 }}>
                <Text style={{ fontSize: 11, color: '#a16207', fontWeight: '600' }}>
                  ${item.estimate_summary.pending_total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} pending
                </Text>
              </View>
            )}
          </View>
        )}
        </TouchableOpacity>
      </SwipeableRow>
    );
  }, [dynamicStyles, colors, categories, jobTypes, unsubscribedEmails, handleEditClient, handleDeleteClient, setQuickSendClient, setQuickSendVisible, setSchedulePrefill, setSchedulePreselectedDate, setScheduleCalendarPickerVisible]);

  const sortLabels: Record<SortOption, string> = {
    name_asc: 'Name (A–Z)',
    first_name: 'First Name',
    last_name: 'Last Name',
  };

  return (
    <AnimatedTabContent
      activeTab={globalCurrentTab}
      tabKey="clients"
      direction={slideDirection}
    >
      <View style={dynamicStyles.container}>
        <BlurHeader style={dynamicStyles.header}>
          <Text style={dynamicStyles.headerTitle}>{t('clients_title')}</Text>
          <View style={dynamicStyles.headerLeft}>
            <Text style={dynamicStyles.headerSubtitle}>
              {filteredClients.length}{filteredClients.length !== clients.length ? ` of ${clients.length}` : ''} total
            </Text>
          </View>
          <View style={{ position: 'relative' }}>
            <TouchableOpacity
              onPress={() => setShowHeaderMenu(true)}
              style={dynamicStyles.iconButton}
              activeOpacity={0.7}
            >
              <Menu size={20} color={colors.textSecondary} />
              {pendingRequestCount > 0 && (
                <View style={{
                  position: 'absolute', top: 2, right: 2,
                  minWidth: 8, height: 8, borderRadius: 4,
                  backgroundColor: '#FF3B30',
                }} />
              )}
            </TouchableOpacity>
          </View>
        </BlurHeader>

        <Modal
          transparent
          visible={showHeaderMenu}
          animationType="fade"
          onRequestClose={() => setShowHeaderMenu(false)}
        >
          <Pressable style={localStyles.menuOverlay} onPress={() => setShowHeaderMenu(false)}>
            <View style={[localStyles.menuDropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {pendingRequestCount > 0 && (
                <>
                  <TouchableOpacity
                    style={localStyles.menuItem}
                    onPress={() => { setShowHeaderMenu(false); setWorkRequestsModalVisible(true); }}
                    activeOpacity={0.7}
                  >
                    <CalendarClock size={16} color='#FF9500' />
                    <Text style={[localStyles.menuItemText, { color: colors.text }]}>
                      Work Requests
                      <Text style={{ color: '#FF9500' }}> ({pendingRequestCount})</Text>
                    </Text>
                  </TouchableOpacity>
                  <View style={[localStyles.menuDivider, { backgroundColor: colors.border }]} />
                </>
              )}
              {pendingRequestCount === 0 && (
                <>
                  <TouchableOpacity
                    style={localStyles.menuItem}
                    onPress={() => { setShowHeaderMenu(false); setWorkRequestsModalVisible(true); }}
                    activeOpacity={0.7}
                  >
                    <CalendarClock size={16} color={colors.textSecondary} />
                    <Text style={[localStyles.menuItemText, { color: colors.text }]}>Work Requests</Text>
                  </TouchableOpacity>
                  <View style={[localStyles.menuDivider, { backgroundColor: colors.border }]} />
                </>
              )}
              <TouchableOpacity
                style={localStyles.menuItem}
                onPress={() => { setBroadcastVisible(true); setShowHeaderMenu(false); }}
                activeOpacity={0.7}
              >
                <Send size={16} color={colors.textSecondary} />
                <Text style={[localStyles.menuItemText, { color: colors.text }]}>Broadcast Message</Text>
              </TouchableOpacity>
              <View style={[localStyles.menuDivider, { backgroundColor: colors.border }]} />
              <TouchableOpacity
                style={localStyles.menuItem}
                onPress={() => { setImportModalVisible(true); setShowHeaderMenu(false); }}
                activeOpacity={0.7}
              >
                <Download size={16} color={colors.textSecondary} />
                <Text style={[localStyles.menuItemText, { color: colors.text }]}>Import Contacts</Text>
              </TouchableOpacity>
              <View style={[localStyles.menuDivider, { backgroundColor: colors.border }]} />
              <TouchableOpacity
                style={localStyles.menuItem}
                onPress={() => { setShowHeaderMenu(false); handleSignOut(); }}
                activeOpacity={0.7}
              >
                <LogOut size={16} color="#ef4444" />
                <Text style={[localStyles.menuItemText, { color: '#ef4444' }]}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>

        <View style={localStyles.clientTabBar}>
          <TouchableOpacity
            style={[localStyles.clientTab, clientListTab === 'all' && localStyles.clientTabActive]}
            onPress={() => setClientListTab('all')}
            activeOpacity={0.7}
          >
            <Text style={[localStyles.clientTabText, clientListTab === 'all' && localStyles.clientTabTextActive]}>
              All Clients
            </Text>
            <View style={[localStyles.clientTabCount, clientListTab === 'all' && localStyles.clientTabCountActive]}>
              <Text style={[localStyles.clientTabCountText, clientListTab === 'all' && localStyles.clientTabCountTextActive]}>
                {clients.length}
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[localStyles.clientTab, clientListTab === 'commercial' && localStyles.clientTabActive]}
            onPress={() => setClientListTab('commercial')}
            activeOpacity={0.7}
          >
            <Building2 size={14} color={clientListTab === 'commercial' ? '#1B4D6E' : '#6B7280'} />
            <Text style={[localStyles.clientTabText, clientListTab === 'commercial' && localStyles.clientTabTextActive]}>
              Commercial
            </Text>
            <View style={[localStyles.clientTabCount, clientListTab === 'commercial' && localStyles.clientTabCountActive]}>
              <Text style={[localStyles.clientTabCountText, clientListTab === 'commercial' && localStyles.clientTabCountTextActive]}>
                {commercialCount}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={dynamicStyles.searchContainer}>
          <Search size={18} color={colors.textSecondary} />
          <TextInput
            style={dynamicStyles.searchInput}
            placeholder={clientListTab === 'commercial' ? 'Search commercial addresses...' : t('clients_search')}
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <TouchableOpacity
            onPress={() => { setFilterPanelOpen(!filterPanelOpen); setSortPanelOpen(false); }}
            style={[localStyles.filterBtn, ((selectedJobTypeIds.size > 0 || selectedCategoryIds.size > 0 || selectedClientTypes.size > 0 || sortOption !== 'name_asc') || filterPanelOpen) && localStyles.filterBtnActive]}
            activeOpacity={0.7}
          >
            <SlidersHorizontal size={15} color={(selectedJobTypeIds.size > 0 || selectedCategoryIds.size > 0 || selectedClientTypes.size > 0 || sortOption !== 'name_asc') ? colors.primary : colors.textSecondary} />
            {(selectedJobTypeIds.size + selectedCategoryIds.size + selectedClientTypes.size + (sortOption !== 'name_asc' ? 1 : 0)) > 0 && (
              <View style={[localStyles.filterBadge, { backgroundColor: colors.primary }]}>
                <Text style={localStyles.filterBadgeText}>{selectedJobTypeIds.size + selectedCategoryIds.size + selectedClientTypes.size + (sortOption !== 'name_asc' ? 1 : 0)}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSwipeSettingsVisible(true)}
            style={localStyles.filterBtn}
            activeOpacity={0.7}
          >
            <Settings2 size={15} color={colors.textSecondary} />
          </TouchableOpacity>
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
              <X size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {filterPanelOpen && (
          <View style={[localStyles.filterPanel, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <View style={localStyles.filterPanelHeader}>
              <Text style={[localStyles.filterPanelTitle, { color: colors.text }]}>Sort By</Text>
              {sortOption !== 'name_asc' && (
                <TouchableOpacity onPress={() => setSortOption('name_asc')}>
                  <Text style={[localStyles.clearText, { color: colors.primary }]}>Reset</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 10 }}>
              {(['name_asc', 'first_name', 'last_name'] as SortOption[]).map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={[
                    localStyles.sortChip,
                    { borderColor: sortOption === opt ? colors.primary : colors.border, backgroundColor: sortOption === opt ? colors.primary : colors.inputBackground },
                  ]}
                  onPress={() => setSortOption(opt)}
                  activeOpacity={0.7}
                >
                  {sortOption === opt && <Check size={12} color="#fff" />}
                  <Text style={[localStyles.sortChipText, { color: sortOption === opt ? '#fff' : colors.text }]}>
                    {sortLabels[opt]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={[localStyles.filterPanelHeader, { marginTop: 4 }]}>
              <Text style={[localStyles.filterPanelTitle, { color: colors.text }]}>Client Type</Text>
              {selectedClientTypes.size > 0 && (
                <TouchableOpacity onPress={() => setSelectedClientTypes(new Set())}>
                  <Text style={[localStyles.clearText, { color: colors.primary }]}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 8 }}>
              {(['residential', 'commercial', 'contractor'] as const).map(type => {
                const isSelected = selectedClientTypes.has(type);
                const label = type.charAt(0).toUpperCase() + type.slice(1);
                const count = clients.filter(c => c.client_type === type).length;
                return (
                  <TouchableOpacity
                    key={type}
                    style={[
                      localStyles.filterChip,
                      { borderColor: isSelected ? colors.primary : colors.border, backgroundColor: isSelected ? colors.primary : colors.inputBackground },
                    ]}
                    onPress={() => toggleClientTypeFilter(type)}
                    activeOpacity={0.7}
                  >
                    {isSelected && <Check size={12} color="#fff" />}
                    <Text style={[localStyles.filterChipText, { color: isSelected ? '#fff' : colors.text }]} numberOfLines={1}>{label}</Text>
                    <View style={[localStyles.filterChipCount, { backgroundColor: isSelected ? 'rgba(255,255,255,0.25)' : colors.border }]}>
                      <Text style={[localStyles.filterChipCountText, { color: isSelected ? '#fff' : colors.textSecondary }]}>{count}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {categories.length > 0 && (
              <>
                <View style={localStyles.filterPanelHeader}>
                  <Text style={[localStyles.filterPanelTitle, { color: colors.text }]}>Filter by Category</Text>
                  {selectedCategoryIds.size > 0 && (
                    <TouchableOpacity onPress={() => setSelectedCategoryIds(new Set())}>
                      <Text style={[localStyles.clearText, { color: colors.primary }]}>Clear</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 8 }}>
                  {categories.map(cat => {
                    const isSelected = selectedCategoryIds.has(cat.id);
                    const count = clients.filter(c => (c.category_ids || []).includes(cat.id)).length;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={[
                          localStyles.filterChip,
                          isSelected
                            ? { borderColor: cat.color, backgroundColor: cat.color }
                            : { borderColor: cat.color + '50', backgroundColor: cat.color + '15' },
                        ]}
                        onPress={() => toggleCategoryFilter(cat.id)}
                        activeOpacity={0.7}
                      >
                        {isSelected && <Check size={12} color="#fff" />}
                        <Text style={[localStyles.filterChipText, { color: isSelected ? '#fff' : cat.color }]} numberOfLines={1}>
                          {cat.name}
                        </Text>
                        <View style={[localStyles.filterChipCount, { backgroundColor: isSelected ? 'rgba(255,255,255,0.25)' : cat.color + '30' }]}>
                          <Text style={[localStyles.filterChipCountText, { color: isSelected ? '#fff' : cat.color }]}>{count}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            )}
            <View style={localStyles.filterPanelHeader}>
              <Text style={[localStyles.filterPanelTitle, { color: colors.text }]}>Filter by Job Type</Text>
              {selectedJobTypeIds.size > 0 && (
                <TouchableOpacity onPress={() => setSelectedJobTypeIds(new Set())}>
                  <Text style={[localStyles.clearText, { color: colors.primary }]}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>
            {visibleJobTypes.length === 0 ? (
              <Text style={[localStyles.emptyFilterText, { color: colors.textSecondary }]}>
                {selectedCategoryIds.size > 0
                  ? 'No job types for the selected categories.'
                  : 'No job types found. Add job types in Settings.'}
              </Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                {visibleJobTypes.map(jt => {
                  const isSelected = selectedJobTypeIds.has(jt.id);
                  const count = clients.filter(c => (c.job_type_ids || []).includes(jt.id)).length;
                  return (
                    <TouchableOpacity
                      key={jt.id}
                      style={[
                        localStyles.filterChip,
                        { borderColor: isSelected ? colors.primary : colors.border, backgroundColor: isSelected ? colors.primary : colors.inputBackground },
                      ]}
                      onPress={() => toggleJobTypeFilter(jt.id)}
                      activeOpacity={0.7}
                    >
                      {isSelected && <Check size={12} color="#fff" />}
                      <Text style={[localStyles.filterChipText, { color: isSelected ? '#fff' : colors.text }]} numberOfLines={1}>
                        {jt.name}
                      </Text>
                      <View style={[localStyles.filterChipCount, { backgroundColor: isSelected ? 'rgba(255,255,255,0.25)' : colors.border }]}>
                        <Text style={[localStyles.filterChipCountText, { color: isSelected ? '#fff' : colors.textSecondary }]}>{count}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>
        )}


        {hasActiveFilters && (
          <View style={[localStyles.activeFilterBar, { backgroundColor: colors.inputBackground, borderBottomColor: colors.border }]}>
            <Text style={[localStyles.activeFilterText, { color: colors.textSecondary }]}>
              {selectedClientTypes.size > 0
                ? `Type: ${Array.from(selectedClientTypes).map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(', ')}`
                : selectedCategoryIds.size > 0
                ? `Category: ${categories.filter(c => selectedCategoryIds.has(c.id)).map(c => c.name).join(', ')}`
                : selectedJobTypeIds.size > 0
                ? `Job Type: ${jobTypes.filter(jt => selectedJobTypeIds.has(jt.id)).map(jt => jt.name).join(', ')}`
                : `Sorted by ${sortLabels[sortOption]}`}
              {(selectedClientTypes.size > 0 || selectedCategoryIds.size > 0 || selectedJobTypeIds.size > 0) && sortOption !== 'name_asc' && ` · Sorted by ${sortLabels[sortOption]}`}
            </Text>
            <TouchableOpacity onPress={clearFilters}>
              <Text style={[localStyles.clearText, { color: colors.primary }]}>Clear All</Text>
            </TouchableOpacity>
          </View>
        )}

        {clientListTab === 'all' ? (
          <FlatList
            data={pagedClients}
            renderItem={renderClient}
            keyExtractor={(item) => item.id}
            contentContainerStyle={dynamicStyles.list}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            onEndReached={handleLoadMoreClients}
            onEndReachedThreshold={0.3}
            ListEmptyComponent={
              <View style={dynamicStyles.emptyContainer}>
                <Text style={dynamicStyles.emptyText}>
                  {hasActiveFilters || searchQuery ? 'No clients match' : 'No clients yet'}
                </Text>
                <Text style={dynamicStyles.emptySubtext}>
                  {hasActiveFilters || searchQuery
                    ? 'Try adjusting your filters or search'
                    : 'Tap the + button to add your first client'}
                </Text>
                {hasActiveFilters && (
                  <TouchableOpacity style={{ marginTop: 12 }} onPress={clearFilters}>
                    <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 14 }}>Clear Filters</Text>
                  </TouchableOpacity>
                )}
              </View>
            }
          />
        ) : (
          <FlatList
            data={commercialAddressJobs}
            keyExtractor={(item) => item.addressId}
            contentContainerStyle={dynamicStyles.list}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            renderItem={({ item: job }) => {
              const WEEK_LABELS: Record<number, string> = { 1: '1st week', 2: '2nd week', 3: '3rd week', 4: '4th week' };
              const dayLabel = job.preferredDay ? job.preferredDay.charAt(0).toUpperCase() + job.preferredDay.slice(1) : null;
              const weekLabel = job.targetWeek ? WEEK_LABELS[job.targetWeek] : null;
              const windowLabel = job.serviceWindowStart && job.serviceWindowEnd
                ? `${job.serviceWindowStart.slice(0, 5)} - ${job.serviceWindowEnd.slice(0, 5)}`
                : null;

              return (
                <TouchableOpacity
                  style={[dynamicStyles.clientCard, { borderLeftWidth: 3, borderLeftColor: '#1B4D6E' }]}
                  onPress={() => {
                    const client = clients.find(c => c.id === job.clientId);
                    if (client) handleEditClient(client);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[dynamicStyles.clientName, { fontSize: 15 }]}>{job.clientName}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                        <MapPin size={12} color="#6B7280" />
                        <Text style={{ fontSize: 13, color: '#6B7280' }} numberOfLines={1}>
                          {job.addressLabel ? `${job.addressLabel}: ` : ''}{job.address}
                        </Text>
                      </View>
                    </View>
                    <Building2 size={16} color="#1B4D6E" style={{ opacity: 0.4 }} />
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {weekLabel && (
                      <View style={localStyles.commPill}>
                        <Calendar size={10} color="#1B4D6E" />
                        <Text style={localStyles.commPillText}>{weekLabel}</Text>
                      </View>
                    )}
                    {dayLabel && (
                      <View style={localStyles.commPill}>
                        <Text style={localStyles.commPillText}>{dayLabel}</Text>
                      </View>
                    )}
                    {windowLabel && (
                      <View style={localStyles.commPill}>
                        <Text style={localStyles.commPillText}>{windowLabel}</Text>
                      </View>
                    )}
                    {job.typicalJobDuration && (
                      <View style={localStyles.commPill}>
                        <Text style={localStyles.commPillText}>{job.typicalJobDuration}m</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={dynamicStyles.emptyContainer}>
                <Building2 size={40} color={colors.textSecondary} style={{ marginBottom: 12, opacity: 0.4 }} />
                <Text style={dynamicStyles.emptyText}>No commercial clients</Text>
                <Text style={dynamicStyles.emptySubtext}>
                  {searchQuery ? 'No addresses match your search' : 'Add a client and set their type to Commercial'}
                </Text>
              </View>
            }
          />
        )}

        <WorkflowFab
          actions={fabActions}
          isOpen={fabOpen}
          onToggle={toggleFab}
          onClose={closeFab}
          style={dynamicStyles.fab}
          onQuickAction={handleQuickAction}
          dominantHand={dominantHand}
          showQuickAction={false}
        />

        <ClientModal
          visible={modalVisible}
          client={selectedClient}
          initialMode={!selectedClient ? clientModalInitialMode : undefined}
          prefillName={!selectedClient ? clientPrefillName || undefined : undefined}
          prefillPhone={!selectedClient ? clientPrefillPhone || undefined : undefined}
          prefillAddress={!selectedClient ? clientPrefillAddress || undefined : undefined}
          prefillLanguage={!selectedClient ? clientPrefillLanguage || undefined : undefined}
          onClose={() => {
            setModalVisible(false);
            setSelectedClient(null);
            setContextClient(null);
            setClientPrefillName('');
            setClientPrefillPhone('');
            setClientPrefillAddress('');
            setClientPrefillLanguage('');
            closeFab();
          }}
          onSave={() => {
            setModalVisible(false);
            setSelectedClient(null);
            setContextClient(null);
            setClientPrefillName('');
            setClientPrefillPhone('');
            setClientPrefillAddress('');
            setClientPrefillLanguage('');
            closeFab();
            fetchClients();
          }}
          onScheduleJob={(prefill) => {
            setSchedulePrefill(prefill);
            setModalVisible(false);
            setSelectedClient(null);
            setContextClient(null);
            setSchedulePreselectedDate(null);
            setScheduleCalendarPickerVisible(true);
          }}
          onStartTimer={(clientId, clientName) => {
            setTimerPrefill({ clientId, clientName });
            setModalVisible(false);
            setSelectedClient(null);
            setContextClient(null);
            router.push('/(tabs)/time' as any);
          }}
          onCreateInvoice={(clientId) => {
            setInvoicePrefill({ clientId, items: [] });
            setModalVisible(false);
            setSelectedClient(null);
            setContextClient(null);
            setInvoiceModalVisible(true);
          }}
          onCreateEstimate={(clientId) => {
            setEstimatePrefill({ clientId });
            setModalVisible(false);
            setSelectedClient(null);
            setContextClient(null);
            setEstimateModalVisible(true);
          }}
          onSendStatement={(clientId, clientName, clientEmail, clientPhone) => {
            setStatementClient({ id: clientId, name: clientName, email: clientEmail, phone: clientPhone });
            setStatementModalVisible(true);
          }}
        />

        <InvoiceModal
          visible={invoiceModalVisible}
          invoice={null}
          prefill={invoicePrefill}
          onClose={() => { setInvoiceModalVisible(false); setInvoicePrefill(null); }}
          onSave={() => { setInvoiceModalVisible(false); setInvoicePrefill(null); }}
        />

        <EstimateModal
          visible={estimateModalVisible}
          estimate={null}
          prefill={estimatePrefill}
          onClose={() => { setEstimateModalVisible(false); setEstimatePrefill(null); }}
          onSave={() => { setEstimateModalVisible(false); setEstimatePrefill(null); }}
        />

        <ClientStatementModal
          visible={statementModalVisible}
          onClose={() => { setStatementModalVisible(false); setStatementClient(null); }}
          clientId={statementClient?.id || ''}
          clientName={statementClient?.name || ''}
          clientEmail={statementClient?.email || undefined}
          clientPhone={statementClient?.phone || undefined}
        />

        <ScheduleCalendarPickerModal
          visible={scheduleCalendarPickerVisible}
          selectedDate={schedulePreselectedDate?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0]}
          onConfirm={(dateStr) => {
            const picked = new Date(dateStr + 'T00:00:00');
            setSchedulePreselectedDate(picked);
            setScheduleCalendarPickerVisible(false);
            setScheduleModalVisible(true);
          }}
          onCancel={() => {
            setScheduleCalendarPickerVisible(false);
            setSchedulePrefill(null);
          }}
          title="Select Job Date"
        />

        <ScheduleModal
          visible={scheduleModalVisible}
          event={null}
          preselectedDate={schedulePreselectedDate}
          prefillFromClient={schedulePrefill}
          onClose={() => {
            setScheduleModalVisible(false);
            setSchedulePrefill(null);
            setSchedulePreselectedDate(null);
          }}
          onSave={() => {
            setScheduleModalVisible(false);
            setSchedulePrefill(null);
            setSchedulePreselectedDate(null);
          }}
        />

        <ScheduleModal
          visible={quickActionScheduleVisible}
          event={null}
          preselectedDate={quickActionScheduleDate}
          prefillFromClient={quickActionSchedulePrefill}
          onClose={() => {
            setQuickActionScheduleVisible(false);
            setQuickActionSchedulePrefill(null);
            setQuickActionScheduleDate(null);
          }}
          onSave={() => {
            setQuickActionScheduleVisible(false);
            setQuickActionSchedulePrefill(null);
            setQuickActionScheduleDate(null);
          }}
        />

        <ContactImportModal
          visible={importModalVisible}
          onClose={() => setImportModalVisible(false)}
          onSuccess={() => {
            fetchClients();
            showToast({
              message: 'Contacts imported successfully',
              type: 'success',
              duration: 3000,
            });
          }}
        />

        <WorkRequestsModal
          visible={workRequestsModalVisible}
          onClose={() => {
            setWorkRequestsModalVisible(false);
            fetchPendingRequestCount();
          }}
        />

        <BroadcastMessageModal
          visible={broadcastVisible}
          onClose={() => setBroadcastVisible(false)}
          clients={filteredClients.map(c => ({ id: c.id, name: c.name, phone: c.phone, email: c.email, client_type: c.client_type }))}
          filterLabel={getFilterLabel()}
        />
        <ClientQuickSendModal
          visible={quickSendVisible}
          onClose={() => { setQuickSendVisible(false); setQuickSendClient(null); }}
          clientName={quickSendClient?.name || ''}
          primaryPhone={quickSendClient?.phone || ''}
          secondaryContactName={quickSendClient?.secondary_contact_name || undefined}
          secondaryPhone={quickSendClient?.secondary_contact_phone || undefined}
        />

        <SwipeActionsSettingsModal
          visible={swipeSettingsVisible}
          onClose={() => setSwipeSettingsVisible(false)}
          context="clients"
        />

        {/* Client Add Choice Sheet */}
        <Modal
          visible={clientAddSheetVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setClientAddSheetVisible(false)}
          statusBarTranslucent
        >
          <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}
            onPress={() => setClientAddSheetVisible(false)}
          >
            <Pressable onPress={e => e.stopPropagation()}>
              <View style={[dynamicStyles.addClientSheet, { backgroundColor: colors.cardBackground }]}>
                <View style={[dynamicStyles.addClientSheetHandle, { backgroundColor: colors.border }]} />
                <Text style={[dynamicStyles.addClientSheetTitle, { color: colors.text }]}>Add Client</Text>
                <Text style={[dynamicStyles.addClientSheetSubtitle, { color: colors.textSecondary }]}>
                  How much detail do you want to add right now?
                </Text>

                {/* Quick Add */}
                <TouchableOpacity
                  style={[dynamicStyles.addClientSheetOption, { backgroundColor: '#1B4D6E' }]}
                  activeOpacity={0.85}
                  onPress={() => {
                    setClientAddSheetVisible(false);
                    handleAddClient('quick');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Quick Add Client"
                >
                  <View style={dynamicStyles.addClientSheetOptionIcon}>
                    <Users size={22} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={dynamicStyles.addClientSheetOptionTitle}>Quick Add Client</Text>
                    <Text style={dynamicStyles.addClientSheetOptionDesc}>Name + phone or email. Done in seconds.</Text>
                  </View>
                  <View style={dynamicStyles.addClientSheetArrow}>
                    <ChevronDown size={16} color="rgba(255,255,255,0.6)" style={{ transform: [{ rotate: '-90deg' }] }} />
                  </View>
                </TouchableOpacity>

                {/* Full Add */}
                <TouchableOpacity
                  style={[dynamicStyles.addClientSheetOption, dynamicStyles.addClientSheetOptionSecondary, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  activeOpacity={0.85}
                  onPress={() => {
                    setClientAddSheetVisible(false);
                    handleAddClient('full');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Full Add Client"
                >
                  <View style={[dynamicStyles.addClientSheetOptionIcon, { backgroundColor: 'rgba(27,77,110,0.12)' }]}>
                    <FileText size={22} color="#1B4D6E" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[dynamicStyles.addClientSheetOptionTitle, { color: colors.text }]}>Full Add Client</Text>
                    <Text style={[dynamicStyles.addClientSheetOptionDesc, { color: colors.textSecondary }]}>All fields: addresses, equipment, notes, and more.</Text>
                  </View>
                  <View style={[dynamicStyles.addClientSheetArrow, { backgroundColor: 'rgba(27,77,110,0.08)' }]}>
                    <ChevronDown size={16} color="#1B4D6E" style={{ transform: [{ rotate: '-90deg' }] }} />
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[dynamicStyles.addClientSheetCancel, { backgroundColor: colors.inputBackground }]}
                  onPress={() => setClientAddSheetVisible(false)}
                  activeOpacity={0.7}
                >
                  <Text style={[dynamicStyles.addClientSheetCancelText, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </AnimatedTabContent>
  );
}

const localStyles = StyleSheet.create({
  quickSendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1B4D6E',
    backgroundColor: 'rgba(27,77,110,0.06)',
    marginLeft: 8,
  },
  quickSendBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1B4D6E',
  },
  filterBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  filterBtnActive: {
    backgroundColor: Platform.select({ web: 'rgba(27,77,110,0.08)', default: 'rgba(27,77,110,0.08)' }),
  },
  filterBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  filterBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
  },
  filterPanel: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  filterPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  filterPanelTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  clearText: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyFilterText: {
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 4,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    maxWidth: 200,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  filterChipCount: {
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterChipCountText: {
    fontSize: 10,
    fontWeight: '700',
  },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  sortChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  activeFilterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderBottomWidth: 1,
  },
  activeFilterText: {
    fontSize: 12,
    flex: 1,
    marginRight: 8,
  },
  jobTypePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(27,77,110,0.09)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  jobTypePillText: {
    fontSize: 11,
    color: '#1B4D6E',
    fontWeight: '500',
  },
  catPillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  reviewSentBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  unsubBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#fef2f2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 6,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  unsubBadgeText: {
    fontSize: 10,
    color: '#dc2626',
    fontWeight: '600',
  },
  clientTabBar: {
    flexDirection: 'row',
    marginHorizontal: 24,
    marginTop: 4,
    marginBottom: 4,
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 10,
    padding: 3,
  },
  clientTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    borderRadius: 8,
  },
  clientTabActive: {
    backgroundColor: '#fff',
    ...Platform.select({
      web: { boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } as any,
      default: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
    }),
  },
  clientTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  clientTabTextActive: {
    color: '#1B4D6E',
    fontWeight: '700',
  },
  clientTabCount: {
    backgroundColor: 'rgba(0,0,0,0.06)',
    minWidth: 20,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  clientTabCountActive: {
    backgroundColor: 'rgba(27,77,110,0.12)',
  },
  clientTabCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B7280',
  },
  clientTabCountTextActive: {
    color: '#1B4D6E',
  },
  commPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(27,77,110,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  commPillText: {
    fontSize: 11,
    color: '#1B4D6E',
    fontWeight: '500',
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 56,
    paddingRight: 12,
  },
  menuDropdown: {
    borderRadius: 10,
    borderWidth: 1,
    minWidth: 190,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '500',
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 12,
  },
});
