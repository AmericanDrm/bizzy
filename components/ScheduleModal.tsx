import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StyleSheet,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  X,
  ChevronDown,
  Users,
  Clock,
  CalendarDays,
  Trash2,
  Plus,
  Minus,
  MapPin,
  Search,
  History,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { fetchLastJobForClient, LastJobData } from '@/lib/lastJobService';
import { roundPrice, PriceRoundingSettings } from '@/lib/utilities';
import { getEffectivePanePrice, ServiceScope } from '@/lib/panePricingService';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useToast } from '@/contexts/ToastContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUserRole } from '@/hooks/useUserRole';
import { scheduleModalStyles as styles } from '@/styles/scheduleModalStyles';
import TimePicker from '@/components/TimePicker';
import DatePicker from '@/components/DatePicker';
import ClickableContact from '@/components/ClickableContact';
import ClientQuickSendModal from '@/components/ClientQuickSendModal';
import { useRegisterModal } from '@/contexts/ModalStackContext';
import PaneCountStepper from '@/components/shared/PaneCountStepper';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScheduleModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (event?: any) => void;
  onDelete?: (event: any) => void;
  event?: any | null;
  editEvent?: any | null;
  preselectedDate?: Date | null;
  initialDate?: Date;
  initialLatitude?: number;
  initialLongitude?: number;
  clients?: any[];
  onClientAdded?: (client: any) => void;
  prefillFromClient?: {
    clientId?: string;
    clientName?: string;
    phone?: string;
    email?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    typicalJobDuration?: number;
    priceOverride?: number;
    jobTitle?: string;
    serviceScope?: 'interior' | 'exterior' | 'both';
    jobTypeName?: string;
    startHour?: number;
    startMinute?: number;
  } | null;
  prefillFromEstimate?: {
    estimateId?: string;
    clientId?: string;
    title?: string;
    description?: string;
    amount?: number;
  } | null;
}

interface TeamMember {
  id: string;
  user_id: string;
  name: string;
}

interface PaneType {
  id: string;
  name: string;
}

interface PaneChecklistItem {
  pane_type_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  enabled: boolean;
}

interface LineItem {
  id: string;
  description: string;
  quantity: string;
  unit_price: string;
  scope: 'interior' | 'exterior' | 'both';
  job_type_id?: string;
  showJobTypePicker?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDateDisplay = (date: Date): string => {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatTimeDisplay = (date: Date): string => {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

const generateId = () => Math.random().toString(36).substr(2, 9);

const mapScopeToServiceScope = (scope: 'interior' | 'exterior' | 'both'): ServiceScope => {
  if (scope === 'interior') return 'interior_only';
  if (scope === 'exterior') return 'exterior_only';
  return 'full_service';
};

const applyScope = (basePrice: number, scope: 'interior' | 'exterior' | 'both', jobType: any): number => {
  if (!jobType || scope === 'both') return basePrice;
  const svcScope = mapScopeToServiceScope(scope);
  return getEffectivePanePrice(
    basePrice,
    jobType.exterior_split_percent ?? null,
    svcScope,
    jobType.interior_split_percent ?? null,
  );
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ScheduleModal({
  visible,
  onClose,
  onSave,
  onDelete,
  event,
  editEvent,
  preselectedDate,
  initialDate,
  initialLatitude,
  initialLongitude,
  clients: clientsProp,
  onClientAdded,
  prefillFromClient,
  prefillFromEstimate,
}: ScheduleModalProps) {
  const isDirtyRef = useRef(false);
  useRegisterModal('schedule-modal', visible, onClose, () => isDirtyRef.current);
  const rawEvent = event || editEvent || null;
  const resolvedEvent = rawEvent
    ? { ...rawEvent, id: rawEvent.id?.replace(/-\d{4}-\d{2}-\d{2}$/, '') ?? rawEvent.id }
    : null;

  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const { showToast } = useToast();
  const { isAdminOrManager } = useUserRole();

  // ── Core form state ────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [clientId, setClientId] = useState<string>('');
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [quickSendVisible, setQuickSendVisible] = useState(false);

  // ── Date / time ───────────────────────────────────────────────────────────
  const [startTime, setStartTime] = useState<Date>(new Date());
  const [endTime, setEndTime] = useState<Date>(() => {
    const d = new Date();
    d.setHours(d.getHours() + 2);
    return d;
  });
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  // ── Job type ──────────────────────────────────────────────────────────────
  const [jobTypeId, setJobTypeId] = useState<string>('');
  const [selectedJobType, setSelectedJobType] = useState<any | null>(null);
  const [jobTypes, setJobTypes] = useState<any[]>([]);
  const [showJobTypePicker, setShowJobTypePicker] = useState(false);
  const [primaryQuantity, setPrimaryQuantity] = useState('1');
  const [primaryUnitPrice, setPrimaryUnitPrice] = useState('');
  const [baseUnitPrice, setBaseUnitPrice] = useState('');

  // ── Service scope ─────────────────────────────────────────────────────────
  const [serviceScope, setServiceScope] = useState<'interior' | 'exterior' | 'both'>('exterior');

  // ── Team members ──────────────────────────────────────────────────────────
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedTeamMembers, setSelectedTeamMembers] = useState<string[]>([]);
  const [assignedTo, setAssignedTo] = useState<string | null>(null);

  // ── Pane checklist ────────────────────────────────────────────────────────
  const [paneChecklist, setPaneChecklist] = useState<PaneChecklistItem[]>([]);

  // ── Line items ────────────────────────────────────────────────────────────
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  // ── Crew size ─────────────────────────────────────────────────────────────
  const [crewSize, setCrewSize] = useState(1);

  // ── Payment ───────────────────────────────────────────────────────────────
  const [paymentStatus, setPaymentStatus] = useState<'unpaid' | 'partial' | 'paid'>('unpaid');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [useCredit, setUseCredit] = useState(false);
  const [roundingSettings, setRoundingSettings] = useState<PriceRoundingSettings | null>(null);
  const [scopeDescriptions, setScopeDescriptions] = useState<{ full_service: string; exterior_only: string; interior_only: string }>({ full_service: '', exterior_only: '', interior_only: '' });
  const [pendingJobTypeName, setPendingJobTypeName] = useState<string | null>(null);

  const applyScopeToPrice = useCallback((base: string, scope: 'interior' | 'exterior' | 'both', jobType: any): string => {
    const baseVal = parseFloat(base || '0');
    if (!baseVal || !jobType) return base;
    const effective = applyScope(baseVal, scope, jobType);
    return String(parseFloat(effective.toFixed(2)));
  }, []);

  useEffect(() => {
    if (baseUnitPrice && selectedJobType) {
      setPrimaryUnitPrice(applyScopeToPrice(baseUnitPrice, serviceScope, selectedJobType));
    }
  }, [serviceScope, baseUnitPrice, selectedJobType, applyScopeToPrice]);

  const roundLineItemTotal = useCallback((qty: string, unitPrice: string, scope?: 'interior' | 'exterior' | 'both', jobType?: any): number => {
    const effectivePrice = scope && jobType
      ? applyScope(parseFloat(unitPrice || '0'), scope, jobType)
      : parseFloat(unitPrice || '0');
    const raw = parseFloat(qty || '0') * effectivePrice;
    return roundPrice(raw, roundingSettings);
  }, [roundingSettings]);

  const computedTotal = React.useMemo(() => {
    const primaryTotal = roundLineItemTotal(primaryQuantity, primaryUnitPrice);
    const lineItemsTotal = lineItems.reduce((sum, li) => {
      const liJobType = jobTypes.find((jt) => jt.id === li.job_type_id) || selectedJobType;
      return sum + roundLineItemTotal(li.quantity, li.unit_price, li.scope, liJobType);
    }, 0);
    return primaryTotal + lineItemsTotal;
  }, [primaryQuantity, primaryUnitPrice, lineItems, roundLineItemTotal, selectedJobType, jobTypes]);

  useEffect(() => {
    if (computedTotal > 0) {
      setPaymentAmount(String(computedTotal));
    }
  }, [computedTotal]);

  // ── Recurring ─────────────────────────────────────────────────────────────
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<'weekly' | 'biweekly' | 'monthly' | 'custom'>('weekly');
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [recurringEndDate, setRecurringEndDate] = useState<Date | null>(null);

  // ── Address ───────────────────────────────────────────────────────────────
  const [clientAddresses, setClientAddresses] = useState<any[]>([]);
  const [selectedAddressIds, setSelectedAddressIds] = useState<string[]>([]);
  const [addressSearch, setAddressSearch] = useState('');
  const [showAddressPicker, setShowAddressPicker] = useState(false);

  // ── Client property data ────────────────────────────────────────────────
  const [clientUnitQuantities, setClientUnitQuantities] = useState<any[]>([]);

  // ── Delete confirm ────────────────────────────────────────────────────────
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // ── Last job auto-fill ──────────────────────────────────────────────────
  const [lastJobInfo, setLastJobInfo] = useState<{ date: string; addressId?: string | null } | null>(null);
  const [lastJobLoading, setLastJobLoading] = useState(false);

  const applyLastJobData = useCallback((data: LastJobData) => {
    if (data.jobTypeId) setJobTypeId(data.jobTypeId);
    if (data.serviceScope) {
      const scope = data.serviceScope === 'exterior_only' ? 'exterior' : data.serviceScope === 'interior_only' ? 'interior' : data.serviceScope === 'full_service' ? 'both' : data.serviceScope;
      setServiceScope(scope as any);
    }
    if (data.crewSize > 1) setCrewSize(data.crewSize);
    if (data.amount != null) setPaymentAmount(String(data.amount));
    if (data.assignedTo) setAssignedTo(data.assignedTo);
    if (data.teamMembers && data.teamMembers.length > 0) setSelectedTeamMembers(data.teamMembers);
    if (data.description) setNotes(data.description);
    if (data.lineItems.length > 0) {
      setLineItems(data.lineItems.map((li) => ({
        id: li.id,
        description: li.description,
        quantity: li.quantity,
        unit_price: li.unit_price,
        scope: li.scope as any,
      })));
    }
    setLastJobInfo({ date: data.lastJobDate, addressId: data.clientAddressId });
  }, []);

  const loadLastJob = useCallback(async (cId: string, addressId?: string | null) => {
    if (!currentOrganization?.id) return;
    setLastJobLoading(true);
    try {
      const data = await fetchLastJobForClient(cId, currentOrganization.id, addressId);
      if (data) {
        applyLastJobData(data);
      }
    } catch (err) {
      console.error('Error loading last job:', err);
    } finally {
      setLastJobLoading(false);
    }
  }, [currentOrganization?.id, applyLastJobData]);

  const clearLastJobFill = useCallback(() => {
    setLastJobInfo(null);
    setJobTypeId('');
    setSelectedJobType(null);
    setServiceScope('exterior');
    setCrewSize(1);
    setPaymentAmount('');
    setAssignedTo(null);
    setSelectedTeamMembers([]);
    setNotes('');
    setLineItems([]);
  }, []);

  // ─── Data loading ─────────────────────────────────────────────────────────

  const loadClients = useCallback(async () => {
    try {
      let query = supabase
        .from('clients')
        .select('id, name, email, phone, address, price_override, price_override_enabled')
        .order('name', { ascending: true });
      if (currentOrganization?.id) {
        query = query.eq('organization_id', currentOrganization.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      setClients(data || []);
    } catch (err) {
      console.error('Error loading clients:', err);
    }
  }, [currentOrganization?.id]);

  const loadJobTypes = useCallback(async () => {
    try {
      let query = supabase
        .from('job_types')
        .select('id, name, hourly_rate, exterior_split_percent, interior_split_percent, exterior_split_percent_standard, exterior_split_percent_french, exterior_split_percent_storm, interior_split_percent_standard, interior_split_percent_french, interior_split_percent_storm')
        .order('name', { ascending: true });
      if (currentOrganization?.id) {
        query = query.eq('organization_id', currentOrganization.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      setJobTypes(data || []);
    } catch (err) {
      console.error('Error loading job types:', err);
    }
  }, [currentOrganization?.id]);

  const loadRoundingSettings = useCallback(async () => {
    if (!currentOrganization?.id) return;
    try {
      const { data } = await supabase
        .from('business_settings')
        .select('price_rounding_enabled, price_rounding_target, price_rounding_custom_amount, scope_description_full_service, scope_description_exterior_only, scope_description_interior_only')
        .eq('organization_id', currentOrganization.id)
        .maybeSingle();
      if (data) {
        setRoundingSettings({
          price_rounding_enabled: data.price_rounding_enabled ?? false,
          price_rounding_target: data.price_rounding_target || '1',
          price_rounding_custom_amount: data.price_rounding_custom_amount,
        });
        setScopeDescriptions({
          full_service: data.scope_description_full_service || '',
          exterior_only: data.scope_description_exterior_only || '',
          interior_only: data.scope_description_interior_only || '',
        });
      }
    } catch (err) {
      console.error('Error loading rounding settings:', err);
    }
  }, [currentOrganization?.id]);

  const loadTeamMembers = useCallback(async () => {
    try {
      let query = supabase
        .from('organization_members')
        .select('id, user_id, role, profiles(id, display_name, email)')
        .order('role', { ascending: true });
      if (currentOrganization?.id) {
        query = query.eq('organization_id', currentOrganization.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      const members: TeamMember[] = (data || []).map((m: any) => ({
        id: m.id,
        user_id: m.user_id,
        name: m.profiles?.display_name || m.profiles?.email || 'Unknown',
      }));
      setTeamMembers(members);
    } catch (err) {
      console.error('Error loading team members:', err);
    }
  }, [currentOrganization?.id]);

  const loadPaneTypes = useCallback(async () => {
    try {
      let query = supabase
        .from('pane_types')
        .select('id, name')
        .order('name', { ascending: true });
      if (currentOrganization?.id) {
        query = query.eq('organization_id', currentOrganization.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      const items: PaneChecklistItem[] = (data || []).map((p: PaneType) => ({
        pane_type_id: p.id,
        name: p.name,
        quantity: 0,
        unit_price: 0,
        enabled: false,
      }));
      setPaneChecklist(items);
    } catch (err) {
      console.error('Error loading pane types:', err);
    }
  }, [currentOrganization?.id]);

  const loadClientAddresses = useCallback(async (cId: string) => {
    try {
      const { data, error } = await supabase
        .from('client_addresses')
        .select('id, label, address, is_primary, latitude, longitude, price_override, price_override_enabled, typical_job_duration')
        .eq('client_id', cId)
        .order('is_primary', { ascending: false });
      if (error) throw error;
      setClientAddresses(data || []);
      const primary = (data || []).find((a: any) => a.is_primary);
      if (primary) {
        setSelectedAddressIds([primary.id]);
      } else if (data && data.length > 0) {
        setSelectedAddressIds([data[0].id]);
      }
    } catch (err) {
      console.error('Error loading client addresses:', err);
    }
  }, []);

  const loadClientUnitQuantities = useCallback(async (cId: string) => {
    try {
      const { data, error } = await supabase
        .from('client_unit_quantities')
        .select('job_type_id, quantity, pane_details, address_id')
        .eq('client_id', cId);
      if (error) throw error;
      setClientUnitQuantities(data || []);
    } catch (err) {
      console.error('Error loading client unit quantities:', err);
    }
  }, []);

  // ─── Init / Reset ──────────────────────────────────────────────────────────

  const resetForm = useCallback(() => {
    const baseDate = preselectedDate || initialDate || new Date();
    const start = new Date(baseDate);
    start.setHours(8, 0, 0, 0);
    const end = new Date(baseDate);
    end.setHours(10, 0, 0, 0);

    setTitle('');
    setNotes('');
    setClientId('');
    setSelectedClient(null);
    setClientSearch('');
    setShowClientPicker(false);
    setStartTime(start);
    setEndTime(end);
    setJobTypeId('');
    setSelectedJobType(null);
    setShowJobTypePicker(false);
    setPrimaryQuantity('1');
    setPrimaryUnitPrice('');
    setBaseUnitPrice('');
    setServiceScope('exterior');
    setSelectedTeamMembers([]);
    setAssignedTo(null);
    setCrewSize(1);
    setPaymentStatus('unpaid');
    setPaymentAmount('');
    setPaymentMethod('');
    setUseCredit(false);
    setIsRecurring(false);
    setRecurrenceType('weekly');
    setRecurrenceInterval(1);
    setSelectedDays([]);
    setRecurringEndDate(null);
    setClientAddresses([]);
    setSelectedAddressIds([]);
    setAddressSearch('');
    setShowAddressPicker(false);
    setClientUnitQuantities([]);
    setLineItems([]);
    setShowDeleteConfirm(false);
    setLastJobInfo(null);
    setLastJobLoading(false);
    setPendingJobTypeName(null);
  }, [preselectedDate, initialDate]);

  const initFromEvent = useCallback((ev: any) => {
    setTitle(ev.title || '');
    setNotes(ev.description || ev.notes || '');
    if (ev.client_id) {
      setClientId(ev.client_id);
    }
    setStartTime(ev.start_time ? new Date(ev.start_time) : new Date());
    setEndTime(ev.end_time ? new Date(ev.end_time) : new Date());
    setJobTypeId(ev.job_type_id || '');
    const rawScope = ev.service_scope || 'exterior';
    const mappedScope = rawScope === 'exterior_only' ? 'exterior' : rawScope === 'interior_only' ? 'interior' : rawScope === 'full_service' ? 'both' : rawScope;
    setServiceScope(mappedScope as any);
    setCrewSize(ev.crew_size || 1);
    setPaymentStatus(ev.payment_status || 'unpaid');
    setPaymentAmount(ev.amount ? String(ev.amount) : '');
    setPaymentMethod(ev.payment_method || '');
    setIsRecurring(ev.is_recurring || false);
    setRecurrenceType(ev.recurrence_type || 'weekly');
    setRecurrenceInterval(ev.recurrence_interval || 1);
    setSelectedDays(ev.recurrence_days_of_week || []);
    setRecurringEndDate(ev.recurrence_end_date ? new Date(ev.recurrence_end_date) : null);
    if (ev.assigned_to) setAssignedTo(ev.assigned_to);

    if (ev.id) {
      // Load persisted team member assignments
      supabase
        .from('schedule_event_team_members')
        .select('member_id')
        .eq('schedule_event_id', ev.id)
        .then(({ data: assignmentRows }) => {
          if (assignmentRows && assignmentRows.length > 0) {
            setSelectedTeamMembers(assignmentRows.map((r: any) => r.member_id));
          }
        });

      supabase
        .from('schedule_event_line_items')
        .select('*')
        .eq('schedule_event_id', ev.id)
        .order('display_order')
        .then(({ data: items }) => {
          if (items && items.length > 0) {
            const primary = items.find((i: any) => i.display_order === 0);
            if (primary) {
              setPrimaryQuantity(String(primary.quantity || '1'));
              const price = String(primary.unit_price || '');
              setBaseUnitPrice(price);
              setPrimaryUnitPrice(price);
            }
            const additional = items.filter((i: any) => i.display_order > 0);
            if (additional.length > 0) {
              setLineItems(additional.map((i: any) => ({
                id: i.id,
                description: i.description || '',
                quantity: String(i.quantity || '1'),
                unit_price: String(i.unit_price || ''),
                scope: (i.service_scope || 'exterior') as any,
                job_type_id: i.job_type_id || undefined,
              })));
            }
          }
        });
    }
  }, []);

  const applyPrefillFromClient = useCallback((prefill: NonNullable<typeof prefillFromClient>) => {
    if (prefill.clientId) {
      setClientId(prefill.clientId);
      if (prefill.clientName) {
        setSelectedClient({ id: prefill.clientId, name: prefill.clientName, email: prefill.email, phone: prefill.phone, address: prefill.address });
      }
      loadLastJob(prefill.clientId);
    }
    if (prefill.priceOverride) setPaymentAmount(String(prefill.priceOverride));

    if (prefill.jobTitle) setTitle(prefill.jobTitle);
    if (prefill.serviceScope) setServiceScope(prefill.serviceScope);

    if (prefill.jobTypeName) {
      setPendingJobTypeName(prefill.jobTypeName.toLowerCase());
    }

    if (prefill.startHour !== undefined) {
      const baseDate = preselectedDate || initialDate || new Date();
      const start = new Date(baseDate);
      start.setHours(prefill.startHour, prefill.startMinute || 0, 0, 0);
      const end = new Date(start);
      end.setHours(start.getHours() + 2, start.getMinutes(), 0, 0);
      setStartTime(start);
      setEndTime(end);
    }
  }, [loadLastJob, preselectedDate, initialDate]);

  const applyPrefillFromEstimate = useCallback((prefill: NonNullable<typeof prefillFromEstimate>) => {
    if (prefill.clientId) setClientId(prefill.clientId);
    if (prefill.title) setTitle(prefill.title);
    if (prefill.description) setNotes(prefill.description);
    if (prefill.amount) setPaymentAmount(String(prefill.amount));
  }, []);

  useEffect(() => {
    if (!visible) return;
    isDirtyRef.current = false;
    resetForm();
    loadClients();
    loadJobTypes();
    loadTeamMembers();
    loadPaneTypes();
    loadRoundingSettings();

    if (resolvedEvent) {
      initFromEvent(resolvedEvent);
    } else if (prefillFromEstimate) {
      applyPrefillFromEstimate(prefillFromEstimate);
    } else if (prefillFromClient) {
      applyPrefillFromClient(prefillFromClient);
    }
  }, [visible]);

  // Load client data when clientId changes
  useEffect(() => {
    if (!clientId) {
      setSelectedClient(null);
      setClientAddresses([]);
      setSelectedAddressIds([]);
      setClientUnitQuantities([]);
      return;
    }
    const found = clients.find((c) => c.id === clientId);
    if (found) setSelectedClient(found);
    loadClientAddresses(clientId);
    loadClientUnitQuantities(clientId);
  }, [clientId, clients]);

  // Sync job type selection
  useEffect(() => {
    if (!jobTypeId) {
      setSelectedJobType(null);
      return;
    }
    const found = jobTypes.find((jt) => jt.id === jobTypeId);
    setSelectedJobType(found || null);
  }, [jobTypeId, jobTypes]);

  // Auto-select job type from pending name after jobTypes are loaded
  useEffect(() => {
    if (!pendingJobTypeName || jobTypes.length === 0) return;
    const match = jobTypes.find((jt) =>
      jt.name.toLowerCase().includes(pendingJobTypeName) ||
      pendingJobTypeName.includes(jt.name.toLowerCase())
    );
    if (match) {
      setJobTypeId(match.id);
    }
    setPendingJobTypeName(null);
  }, [jobTypes, pendingJobTypeName]);

  // Auto-fill quantity from client unit quantities when job type + client data available
  useEffect(() => {
    if (!jobTypeId || clientUnitQuantities.length === 0) return;
    const selectedAddr = selectedAddressIds[0] || null;
    const match = clientUnitQuantities.find((q: any) =>
      q.job_type_id === jobTypeId && (!selectedAddr || q.address_id === selectedAddr || !q.address_id)
    ) || clientUnitQuantities.find((q: any) => q.job_type_id === jobTypeId);
    if (match && match.quantity) {
      setPrimaryQuantity(String(match.quantity));
    }
  }, [jobTypeId, clientUnitQuantities, selectedAddressIds]);

  // Auto-fill price override from selected address, falling back to client-level override
  useEffect(() => {
    const addr = clientAddresses.find((a: any) => a.id === selectedAddressIds[0]);
    if (addr?.price_override_enabled && addr?.price_override != null) {
      const price = String(addr.price_override);
      setBaseUnitPrice(price);
      setPrimaryUnitPrice(price);
    } else if (!addr?.price_override_enabled) {
      const clientData = clients.find((c: any) => c.id === clientId);
      if (clientData?.price_override_enabled && clientData?.price_override != null) {
        const price = String(clientData.price_override);
        setBaseUnitPrice(price);
        setPrimaryUnitPrice(price);
      }
    }
  }, [selectedAddressIds, clientAddresses, clientId, clients]);

  // Auto-fill job duration from selected address
  useEffect(() => {
    if (selectedAddressIds.length === 0 || clientAddresses.length === 0) return;
    const addr = clientAddresses.find((a: any) => a.id === selectedAddressIds[0]);
    if (addr?.typical_job_duration && addr.typical_job_duration > 0) {
      const newEnd = new Date(startTime.getTime() + addr.typical_job_duration * 60000);
      setEndTime(newEnd);
    }
  }, [selectedAddressIds, clientAddresses]);

  // ─── Save / Delete ────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!title.trim() && !selectedClient && !clientId) {
      showToast({ message: 'Please enter a title or select a client', type: 'error' });
      return;
    }

    setLoading(true);
    try {
      const eventTitle = title.trim() || (selectedClient ? selectedClient.name : (clientId ? (clients.find(c => c.id === clientId)?.name || 'Scheduled Job') : 'Untitled Event'));

      const primaryAddressId = selectedAddressIds[0] || null;
      const primaryAddress = clientAddresses.find((a) => a.id === primaryAddressId);

      const primaryEffectivePrice = parseFloat(primaryUnitPrice || '0');
      const primaryTotal = roundPrice(parseFloat(primaryQuantity || '0') * primaryEffectivePrice, roundingSettings);
      const lineItemsTotal = lineItems.reduce((sum, li) => {
        const liJobType = jobTypes.find((jt) => jt.id === li.job_type_id) || selectedJobType;
        const liEffective = applyScope(parseFloat(li.unit_price || '0'), li.scope, liJobType);
        return sum + roundPrice(parseFloat(li.quantity || '0') * liEffective, roundingSettings);
      }, 0);
      const computedAmount = primaryTotal + lineItemsTotal;
      const finalAmount = paymentAmount ? parseFloat(paymentAmount) : (computedAmount > 0 ? computedAmount : null);

      const payload: any = {
        title: eventTitle,
        description: notes,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        client_id: clientId || null,
        client_address_id: primaryAddressId || null,
        job_type_id: jobTypeId || null,
        service_scope: mapScopeToServiceScope(serviceScope),
        crew_size: crewSize,
        payment_status: paymentStatus,
        amount: finalAmount,
        payment_method: paymentMethod || null,
        is_recurring: isRecurring,
        recurrence_type: isRecurring ? recurrenceType : null,
        recurrence_interval: isRecurring ? recurrenceInterval : null,
        recurrence_days_of_week: isRecurring && selectedDays.length > 0 ? selectedDays : null,
        recurrence_end_date: isRecurring && recurringEndDate ? recurringEndDate.toISOString().split('T')[0] : null,
        assigned_to: assignedTo || null,
        location: primaryAddress?.address || null,
        organization_id: currentOrganization?.id || null,
        user_id: user?.id || null,
      };

      let result;
      if (resolvedEvent?.id) {
        const { data, error } = await supabase
          .from('schedule_events')
          .update(payload)
          .eq('id', resolvedEvent.id)
          .select()
          .single();
        if (error) throw error;
        result = data;

        await supabase
          .from('schedule_event_line_items')
          .delete()
          .eq('schedule_event_id', resolvedEvent.id);
      } else {
        const { data, error } = await supabase
          .from('schedule_events')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        result = data;
      }

      if (result?.id) {
        const allLineItems: any[] = [];

        if (primaryUnitPrice && parseFloat(primaryUnitPrice) > 0) {
          allLineItems.push({
            schedule_event_id: result.id,
            job_type_id: jobTypeId || null,
            description: selectedJobType?.name || eventTitle,
            quantity: parseFloat(primaryQuantity || '1'),
            unit_price: parseFloat(primaryUnitPrice),
            total: primaryTotal,
            service_scope: mapScopeToServiceScope(serviceScope),
            display_order: 0,
            organization_id: currentOrganization?.id || null,
          });
        }

        lineItems.forEach((li, idx) => {
          const qty = parseFloat(li.quantity || '0');
          const price = parseFloat(li.unit_price || '0');
          const liJobType = jobTypes.find((jt) => jt.id === li.job_type_id) || selectedJobType;
          const liEffective = applyScope(price, li.scope, liJobType);
          if (li.description || qty > 0) {
            allLineItems.push({
              schedule_event_id: result.id,
              job_type_id: li.job_type_id || null,
              description: li.description,
              quantity: qty,
              unit_price: price,
              total: roundPrice(qty * liEffective, roundingSettings),
              service_scope: li.scope,
              display_order: idx + 1,
              organization_id: currentOrganization?.id || null,
            });
          }
        });

        if (allLineItems.length > 0) {
          const { error: liError } = await supabase
            .from('schedule_event_line_items')
            .insert(allLineItems);
          if (liError) console.error('Error saving line items:', liError);
        }

        // Save team member assignments
        await supabase
          .from('schedule_event_team_members')
          .delete()
          .eq('schedule_event_id', result.id);

        if (selectedTeamMembers.length > 0) {
          const assignmentRows = selectedTeamMembers.map((memberId) => ({
            schedule_event_id: result.id,
            member_id: memberId,
            organization_id: currentOrganization?.id || null,
          }));
          const { error: assignError } = await supabase
            .from('schedule_event_team_members')
            .insert(assignmentRows);
          if (assignError) console.error('Error saving assignments:', assignError);
        }
      }

      showToast({ message: resolvedEvent?.id ? 'Event updated successfully' : 'Event scheduled successfully', type: 'success' });
      isDirtyRef.current = false;
      setLoading(false);
      onSave(result);
    } catch (err: any) {
      console.error('Error saving event:', err);
      showToast({ message: err.message || 'Failed to save event', type: 'error' });
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!resolvedEvent?.id) return;
    setDeleteLoading(true);
    try {
      const { error } = await supabase
        .from('schedule_events')
        .delete()
        .eq('id', resolvedEvent.id);
      if (error) throw error;
      showToast({ message: 'Event deleted', type: 'success' });
      setDeleteLoading(false);
      setShowDeleteConfirm(false);
      if (onDelete) {
        onDelete(resolvedEvent);
      } else {
        onSave();
      }
    } catch (err: any) {
      console.error('Error deleting event:', err);
      showToast({ message: err.message || 'Failed to delete event', type: 'error' });
      setDeleteLoading(false);
    }
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const toggleTeamMember = (memberId: string) => {
    setSelectedTeamMembers((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const toggleAddressSelection = (addressId: string) => {
    setSelectedAddressIds((prev) => {
      const isDeselecting = prev.includes(addressId);
      const next = isDeselecting
        ? prev.filter((id) => id !== addressId)
        : [...prev, addressId];
      if (!isDeselecting && !resolvedEvent?.id && clientId) {
        loadLastJob(clientId, addressId);
      }
      return next;
    });
  };

  const addLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      {
        id: generateId(),
        description: '',
        quantity: '1',
        unit_price: '',
        scope: 'exterior' as const,
        job_type_id: undefined,
        showJobTypePicker: false,
      },
    ]);
  };

  const removeLineItem = (id: string) => {
    setLineItems((prev) => prev.filter((li) => li.id !== id));
  };

  const updateLineItem = (id: string, field: string, value: any) => {
    setLineItems((prev) =>
      prev.map((li) => (li.id === id ? { ...li, [field]: value } : li))
    );
  };

  const togglePaneItem = (paneTypeId: string) => {
    setPaneChecklist((prev) =>
      prev.map((p) =>
        p.pane_type_id === paneTypeId ? { ...p, enabled: !p.enabled, quantity: p.enabled ? 0 : 1 } : p
      )
    );
  };

  const updatePaneQuantity = (paneTypeId: string, qty: string) => {
    const num = parseInt(qty, 10);
    setPaneChecklist((prev) =>
      prev.map((p) =>
        p.pane_type_id === paneTypeId ? { ...p, quantity: isNaN(num) ? 0 : num } : p
      )
    );
  };

  const totalPanes = paneChecklist.reduce((sum, p) => sum + (p.enabled ? p.quantity : 0), 0);

  const filteredClients = clients.filter((c) =>
    c.name?.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.email?.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const isEditing = !!resolvedEvent?.id;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerTitleContainer}>
                <Text style={styles.title}>
                  {isEditing ? 'Edit Event' : 'Schedule Job'}
                </Text>
                <Text style={styles.headerSubtitle}>
                  {isEditing ? 'Update event details' : 'Add a new event to the schedule'}
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Scrollable form */}
            <ScrollView
              style={styles.flex1}
              contentContainerStyle={styles.form}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Title */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Title</Text>
                <TextInput
                  style={styles.input}
                  value={title}
                  onChangeText={(t) => { isDirtyRef.current = true; setTitle(t); }}
                  placeholder="Enter event title"
                  placeholderTextColor="#94a3b8"
                />
              </View>

              {/* Client Picker */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Client</Text>
                <TouchableOpacity
                  style={styles.picker}
                  onPress={() => setShowClientPicker((v) => !v)}
                >
                  <Text
                    style={[
                      styles.pickerText,
                      !selectedClient && styles.placeholderText,
                    ]}
                  >
                    {selectedClient ? selectedClient.name : 'Select a client'}
                  </Text>
                  <ChevronDown size={16} color="#94a3b8" />
                </TouchableOpacity>

                {showClientPicker && (
                  <View style={styles.pickerList}>
                    <View style={styles.clientSearchContainer}>
                      <Search size={15} color="#94a3b8" />
                      <TextInput
                        style={styles.clientSearchInput}
                        value={clientSearch}
                        onChangeText={setClientSearch}
                        placeholder="Search clients..."
                        placeholderTextColor="#94a3b8"
                        autoFocus
                      />
                    </View>
                    <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled">
                      {filteredClients.map((c) => (
                        <TouchableOpacity
                          key={c.id}
                          style={styles.pickerItem}
                          onPress={() => {
                            isDirtyRef.current = true;
                            setClientId(c.id);
                            setSelectedClient(c);
                            setShowClientPicker(false);
                            setClientSearch('');
                            if (!resolvedEvent?.id) {
                              loadLastJob(c.id);
                            }
                          }}
                        >
                          <Text style={styles.pickerItemText}>{c.name}</Text>
                          {c.email ? (
                            <Text style={styles.pickerItemSubtext}>{c.email}</Text>
                          ) : null}
                        </TouchableOpacity>
                      ))}
                      {filteredClients.length === 0 && (
                        <View style={styles.pickerItem}>
                          <Text style={styles.pickerItemSubtext}>No clients found</Text>
                        </View>
                      )}
                    </ScrollView>
                  </View>
                )}

                {/* Client details + addresses */}
                {selectedClient && (
                  <View style={styles.clientDetails}>
                    {selectedClient.email ? (
                      <View style={styles.clientDetailRow}>
                        <ClickableContact
                          type="email"
                          value={selectedClient.email}
                          iconSize={14}
                          showSmsButton={false}
                        />
                      </View>
                    ) : null}
                    {selectedClient.phone ? (
                      <View style={styles.clientDetailRow}>
                        <ClickableContact
                          type="phone"
                          value={selectedClient.phone}
                          iconSize={14}
                          showSmsButton={false}
                          onBizzySms={() => setQuickSendVisible(true)}
                        />
                      </View>
                    ) : null}

                    {/* Address chips */}
                    {clientAddresses.length > 0 && (
                      <View style={styles.addressSelectorSection}>
                        <Text style={styles.addressSelectorLabel}>Service Address</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          <View style={styles.addressSelectorRow}>
                            {clientAddresses.map((addr) => {
                              const isSelected = selectedAddressIds.includes(addr.id);
                              return (
                                <TouchableOpacity
                                  key={addr.id}
                                  style={[
                                    styles.addressToggleChip,
                                    isSelected && styles.addressToggleChipActive,
                                  ]}
                                  onPress={() => toggleAddressSelection(addr.id)}
                                >
                                  <View
                                    style={[
                                      styles.primaryDot,
                                      isSelected && styles.primaryDotActive,
                                    ]}
                                  />
                                  <Text
                                    style={[
                                      styles.addressToggleChipText,
                                      isSelected && styles.addressToggleChipTextActive,
                                    ]}
                                  >
                                    {addr.label || 'Address'}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </ScrollView>
                        {selectedAddressIds.length > 0 &&
                          selectedAddressIds.map((addrId) => {
                            const addr = clientAddresses.find((a) => a.id === addrId);
                            if (!addr) return null;
                            const openMap = () => {
                              const encoded = encodeURIComponent(addr.address);
                              const url = Platform.OS === 'ios'
                                ? `maps://?q=${encoded}`
                                : `geo:0,0?q=${encoded}`;
                              Linking.openURL(url).catch(() => {
                                Linking.openURL(`https://maps.google.com/?q=${encoded}`);
                              });
                            };
                            return (
                              <TouchableOpacity key={addrId} onPress={openMap} activeOpacity={0.7}>
                                <Text style={[styles.selectedAddressText, { textDecorationLine: 'underline' }]}>
                                  {addr.address}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                      </View>
                    )}
                  </View>
                )}
              </View>

              {/* Last Job Banner */}
              {lastJobLoading && (
                <View style={lastJobBannerStyles.container}>
                  <ActivityIndicator size="small" color="#0284c7" />
                  <Text style={lastJobBannerStyles.text}>Loading last job details...</Text>
                </View>
              )}
              {lastJobInfo && !lastJobLoading && (
                <View style={lastJobBannerStyles.container}>
                  <History size={14} color="#0284c7" />
                  <Text style={lastJobBannerStyles.text}>
                    Showing details from last job — {lastJobInfo.date}
                  </Text>
                  <TouchableOpacity
                    onPress={clearLastJobFill}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <X size={14} color="#64748b" />
                  </TouchableOpacity>
                </View>
              )}

              {/* Date / Time Row */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Date & Time</Text>
                <View style={styles.dateTimeRow}>
                  {/* Start */}
                  <View style={styles.dateTimeColumn}>
                    <Text style={styles.dateTimeLabel}>START</Text>
                    <TouchableOpacity
                      style={styles.dateTimeTouchable}
                      onPress={() => setShowStartDatePicker(true)}
                    >
                      <Text style={styles.dateTimeValue}>{formatDateDisplay(startTime)}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.dateTimeTouchable}
                      onPress={() => setShowStartTimePicker(true)}
                    >
                      <Text style={[styles.dateTimeValue, { color: '#007AFF' }]}>
                        {formatTimeDisplay(startTime)}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.dateTimeDivider} />

                  {/* End */}
                  <View style={styles.dateTimeColumn}>
                    <Text style={styles.dateTimeLabel}>END</Text>
                    <TouchableOpacity
                      style={styles.dateTimeTouchable}
                      onPress={() => setShowEndDatePicker(true)}
                    >
                      <Text style={styles.dateTimeValue}>{formatDateDisplay(endTime)}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.dateTimeTouchable}
                      onPress={() => setShowEndTimePicker(true)}
                    >
                      <Text style={[styles.dateTimeValue, { color: '#007AFF' }]}>
                        {formatTimeDisplay(endTime)}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Job Type */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Job Type</Text>
                <TouchableOpacity
                  style={styles.picker}
                  onPress={() => setShowJobTypePicker((v) => !v)}
                >
                  <Text
                    style={[
                      styles.pickerText,
                      !selectedJobType && styles.placeholderText,
                    ]}
                  >
                    {selectedJobType ? selectedJobType.name : 'Select job type'}
                  </Text>
                  <ChevronDown size={16} color="#94a3b8" />
                </TouchableOpacity>
                {showJobTypePicker && (
                  <View style={styles.pickerList}>
                    <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled">
                      {jobTypes.map((jt) => (
                        <TouchableOpacity
                          key={jt.id}
                          style={styles.pickerItem}
                          onPress={() => {
                            setJobTypeId(jt.id);
                            setSelectedJobType(jt);
                            setShowJobTypePicker(false);
                            if (jt.scope_options === 'exterior_only') setServiceScope('exterior');
                            else if (jt.scope_options === 'interior_only') setServiceScope('interior');
                            const addrId = selectedAddressIds[0] || null;
                            const addrData = addrId ? clientAddresses.find((a: any) => a.id === addrId) : null;
                            const clientData = clients.find((c: any) => c.id === clientId);
                            if (addrData?.price_override_enabled && addrData?.price_override != null) {
                              const price = String(addrData.price_override);
                              setBaseUnitPrice(price);
                              setPrimaryUnitPrice(price);
                            } else if (clientData?.price_override_enabled && clientData?.price_override != null) {
                              const price = String(clientData.price_override);
                              setBaseUnitPrice(price);
                              setPrimaryUnitPrice(price);
                            } else if (jt.hourly_rate) {
                              const price = String(jt.hourly_rate);
                              setBaseUnitPrice(price);
                              setPrimaryUnitPrice(price);
                            }
                            const cuq = clientUnitQuantities.find((q: any) =>
                              q.job_type_id === jt.id && (!addrId || q.address_id === addrId || !q.address_id)
                            ) || clientUnitQuantities.find((q: any) => q.job_type_id === jt.id);
                            if (cuq?.quantity) {
                              setPrimaryQuantity(String(cuq.quantity));
                            }
                          }}
                        >
                          <Text style={styles.pickerItemText}>{jt.name}</Text>
                          {jt.hourly_rate ? (
                            <Text style={styles.jobTypeRate}>${jt.hourly_rate}/hr</Text>
                          ) : null}
                        </TouchableOpacity>
                      ))}
                      {jobTypes.length === 0 && (
                        <View style={styles.pickerItem}>
                          <Text style={styles.pickerItemSubtext}>No job types found</Text>
                        </View>
                      )}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* Service Scope */}
              <View style={styles.serviceScopeSection}>
                <Text style={styles.label}>Service Scope</Text>
                <View style={styles.serviceScopeButtons}>
                  {([
                    { key: 'exterior' as const, label: 'Exterior' },
                    { key: 'interior' as const, label: 'Interior' },
                    { key: 'both' as const, label: 'Full Service' },
                  ]).filter(({ key }) => {
                    const so = selectedJobType?.scope_options || 'both';
                    if (so === 'exterior_only') return key === 'exterior';
                    if (so === 'interior_only') return key === 'interior';
                    return true;
                  }).map(({ key, label }) => (
                    <TouchableOpacity
                      key={key}
                      style={[
                        styles.serviceScopeButton,
                        serviceScope === key && styles.serviceScopeButtonActive,
                      ]}
                      onPress={() => setServiceScope(key)}
                    >
                      <Text
                        style={[
                          styles.serviceScopeButtonText,
                          serviceScope === key && styles.serviceScopeButtonTextActive,
                        ]}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {(() => {
                  const svcScope = mapScopeToServiceScope(serviceScope);
                  const desc = svcScope === 'full_service' ? scopeDescriptions.full_service
                    : svcScope === 'exterior_only' ? scopeDescriptions.exterior_only
                    : scopeDescriptions.interior_only;
                  return desc ? (
                    <Text style={{ fontSize: 12, color: '#64748b', marginTop: 4, fontStyle: 'italic' }}>
                      {desc}
                    </Text>
                  ) : null;
                })()}
              </View>

              {/* Primary Job Pricing */}
              <View style={styles.lineItemQtyRow}>
                <View style={styles.lineItemQtyField}>
                  <Text style={styles.lineItemFieldLabel}>QTY</Text>
                  <TextInput
                    style={styles.lineItemInput}
                    value={primaryQuantity}
                    onChangeText={setPrimaryQuantity}
                    keyboardType="numeric"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
                <View style={styles.lineItemQtyField}>
                  <Text style={styles.lineItemFieldLabel}>UNIT PRICE</Text>
                  <TextInput
                    style={styles.lineItemInput}
                    value={primaryUnitPrice}
                    onChangeText={(val) => {
                      setPrimaryUnitPrice(val);
                      if (serviceScope === 'both') {
                        setBaseUnitPrice(val);
                      }
                    }}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
                <View style={styles.lineItemTotalField}>
                  <Text style={styles.lineItemFieldLabel}>TOTAL</Text>
                  <Text style={styles.lineItemTotalValue}>
                    ${roundLineItemTotal(primaryQuantity, primaryUnitPrice).toFixed(2)}
                  </Text>
                </View>
              </View>

              {/* Team Members — only visible to owners, admins, and managers */}
              {isAdminOrManager && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Assign Team Members</Text>
                <View style={styles.teamMemberPickerContainer}>
                  <ScrollView
                    style={styles.teamMemberPickerList}
                    scrollEnabled={teamMembers.length > 4}
                    nestedScrollEnabled
                  >
                    {teamMembers.map((member, idx) => {
                      const isSelected = selectedTeamMembers.includes(member.id);
                      return (
                        <TouchableOpacity
                          key={member.id}
                          style={[
                            styles.teamMemberCheckboxRow,
                            idx > 0 && styles.teamMemberRowDivider,
                          ]}
                          onPress={() => toggleTeamMember(member.id)}
                        >
                          <View
                            style={[
                              styles.checkbox,
                              isSelected && styles.checkboxChecked,
                            ]}
                          >
                            {isSelected && (
                              <Text style={styles.checkmark}>✓</Text>
                            )}
                          </View>
                          <Text
                            style={[
                              styles.teamMemberName,
                              !isSelected && styles.teamMemberNameDim,
                            ]}
                          >
                            {member.name}
                          </Text>
                          {member.production_rate ? (
                            <View style={styles.rateBadge}>
                              <Text style={styles.rateBadgeText}>
                                {member.production_rate}/hr
                              </Text>
                            </View>
                          ) : (
                            <View style={styles.missingRatePill}>
                              <Text style={styles.missingRateText}>No rate</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                    {teamMembers.length === 0 && (
                      <View style={styles.teamMemberCheckboxRow}>
                        <Text style={styles.teamMemberNameDim}>No team members found</Text>
                      </View>
                    )}
                  </ScrollView>
                </View>
              </View>
              )}

              {/* Pane Checklist */}
              {paneChecklist.length > 0 && (
                <View style={styles.paneChecklistSection}>
                  <View style={styles.paneChecklistHeader}>
                    <Text style={styles.paneChecklistTitle}>Pane Checklist</Text>
                    <TouchableOpacity
                      onPress={() => {
                        const allEnabled = paneChecklist.every((p) => p.enabled);
                        setPaneChecklist((prev) =>
                          prev.map((p) => ({
                            ...p,
                            enabled: !allEnabled,
                            quantity: !allEnabled ? (p.quantity || 1) : 0,
                          }))
                        );
                      }}
                    >
                      <Text style={styles.paneChecklistToggleAll}>
                        {paneChecklist.every((p) => p.enabled) ? 'Clear All' : 'Select All'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.paneChecklistTable}>
                    {/* Table header */}
                    <View style={styles.paneChecklistTableHeader}>
                      <View style={{ width: 22, marginRight: 4 }} />
                      <Text style={[styles.paneChecklistColHead, { flex: 1 }]}>TYPE</Text>
                      <Text style={[styles.paneChecklistColHead, { width: 110, textAlign: 'center' }]}>QTY</Text>
                      <Text style={[styles.paneChecklistColHead, { width: 70, textAlign: 'right' }]}>SUBTOTAL</Text>
                    </View>

                    {paneChecklist.map((pane, idx) => (
                      <TouchableOpacity
                        key={pane.pane_type_id}
                        style={[
                          styles.paneChecklistRow,
                          idx > 0 && styles.paneChecklistRowDivider,
                          pane.enabled && styles.paneChecklistRowActive,
                        ]}
                        onPress={() => togglePaneItem(pane.pane_type_id)}
                      >
                        <View
                          style={[
                            styles.paneChecklistCheckbox,
                            pane.enabled && styles.paneChecklistCheckboxActive,
                          ]}
                        >
                          {pane.enabled && (
                            <Text style={styles.checkmark}>✓</Text>
                          )}
                        </View>
                        <Text
                          style={[
                            styles.paneChecklistTypeLabel,
                            !pane.enabled && styles.paneChecklistTypeLabelDim,
                            { flex: 1 },
                          ]}
                        >
                          {pane.name}
                        </Text>
                        <View style={{ width: 110 }} onStartShouldSetResponder={() => true}>
                          <PaneCountStepper
                            value={pane.quantity}
                            onChange={v => updatePaneQuantity(pane.pane_type_id, String(v))}
                            disabled={!pane.enabled}
                            compact
                          />
                        </View>
                        <Text
                          style={[
                            styles.paneChecklistCell,
                            styles.paneChecklistSubtotal,
                            { width: 70 },
                            !pane.enabled && styles.paneChecklistCellDim,
                          ]}
                        >
                          {pane.enabled && pane.quantity > 0
                            ? `$${(pane.quantity * pane.unit_price).toFixed(0)}`
                            : '—'}
                        </Text>
                      </TouchableOpacity>
                    ))}

                    {/* Total row */}
                    <View style={styles.paneChecklistTotalRow}>
                      <Text style={styles.paneChecklistTotalLabel}>
                        Total Panes: {totalPanes}
                      </Text>
                      <Text style={styles.paneChecklistTotalValue}>
                        $
                        {paneChecklist
                          .filter((p) => p.enabled)
                          .reduce((sum, p) => sum + p.quantity * p.unit_price, 0)
                          .toFixed(0)}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Line Items / Services */}
              <View style={styles.lineItemsSection}>
                <View style={styles.lineItemsHeader}>
                  <Text style={styles.lineItemsHeaderText}>Additional Services</Text>
                </View>

                {lineItems.map((li, idx) => (
                  <View key={li.id} style={styles.lineItemCard}>
                    <View style={styles.lineItemHeaderRow}>
                      <Text style={styles.lineItemNumber}>Service #{idx + 1}</Text>
                      <TouchableOpacity
                        style={styles.lineItemRemoveBtn}
                        onPress={() => removeLineItem(li.id)}
                      >
                        <X size={14} color="#ef4444" />
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      style={styles.picker}
                      onPress={() => {
                        setLineItems((prev) =>
                          prev.map((item) =>
                            item.id === li.id
                              ? { ...item, showJobTypePicker: !item.showJobTypePicker }
                              : { ...item, showJobTypePicker: false }
                          )
                        );
                      }}
                    >
                      <Text
                        style={[
                          styles.pickerText,
                          !li.description && styles.placeholderText,
                        ]}
                      >
                        {li.description || 'Select job type'}
                      </Text>
                      <ChevronDown size={16} color="#94a3b8" />
                    </TouchableOpacity>
                    {li.showJobTypePicker && (
                      <View style={styles.pickerList}>
                        <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled">
                          {jobTypes.map((jt) => (
                            <TouchableOpacity
                              key={jt.id}
                              style={styles.pickerItem}
                              onPress={() => {
                                setLineItems((prev) =>
                                  prev.map((item) =>
                                    item.id === li.id
                                      ? {
                                          ...item,
                                          job_type_id: jt.id,
                                          description: jt.name,
                                          unit_price: item.unit_price || (jt.hourly_rate ? String(jt.hourly_rate) : ''),
                                          showJobTypePicker: false,
                                        }
                                      : item
                                  )
                                );
                              }}
                            >
                              <Text style={styles.pickerItemText}>{jt.name}</Text>
                              {jt.hourly_rate ? (
                                <Text style={styles.jobTypeRate}>${jt.hourly_rate}/hr</Text>
                              ) : null}
                            </TouchableOpacity>
                          ))}
                          {jobTypes.length === 0 && (
                            <View style={styles.pickerItem}>
                              <Text style={styles.pickerItemSubtext}>No job types found</Text>
                            </View>
                          )}
                        </ScrollView>
                      </View>
                    )}

                    <View style={styles.lineItemDetails}>
                      <View style={styles.lineItemScopeRow}>
                        {(['interior', 'exterior', 'both'] as const).map((s) => (
                          <TouchableOpacity
                            key={s}
                            style={[
                              styles.lineItemScopeBtn,
                              li.scope === s && styles.lineItemScopeBtnActive,
                            ]}
                            onPress={() => updateLineItem(li.id, 'scope', s)}
                          >
                            <Text
                              style={[
                                styles.lineItemScopeBtnText,
                                li.scope === s && styles.lineItemScopeBtnTextActive,
                              ]}
                            >
                              {s.charAt(0).toUpperCase() + s.slice(1)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      <View style={styles.lineItemQtyRow}>
                        <View style={styles.lineItemQtyField}>
                          <Text style={styles.lineItemFieldLabel}>QTY</Text>
                          <TextInput
                            style={styles.lineItemInput}
                            value={li.quantity}
                            onChangeText={(v) => updateLineItem(li.id, 'quantity', v)}
                            keyboardType="numeric"
                            placeholderTextColor="#94a3b8"
                          />
                        </View>
                        <View style={styles.lineItemQtyField}>
                          <Text style={styles.lineItemFieldLabel}>UNIT PRICE</Text>
                          <TextInput
                            style={styles.lineItemInput}
                            value={li.unit_price}
                            onChangeText={(v) => updateLineItem(li.id, 'unit_price', v)}
                            keyboardType="decimal-pad"
                            placeholder="0.00"
                            placeholderTextColor="#94a3b8"
                          />
                        </View>
                        <View style={styles.lineItemTotalField}>
                          <Text style={styles.lineItemFieldLabel}>TOTAL</Text>
                          <Text style={styles.lineItemTotalValue}>
                            ${roundLineItemTotal(li.quantity, li.unit_price, li.scope, jobTypes.find((jt) => jt.id === li.job_type_id) || selectedJobType).toFixed(2)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                ))}

                <View style={styles.addServiceButtonRow}>
                  <TouchableOpacity
                    style={styles.addServiceButton}
                    onPress={addLineItem}
                  >
                    <LinearGradient
                      colors={['#1B4D6E', '#245d82']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.addServiceButtonGradient}
                    >
                      <Plus size={14} color="#fff" />
                      <Text style={styles.addServiceButtonText}>Add Service</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Crew Size */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Crew Size</Text>
                <View style={styles.crewSizeContainer}>
                  <TouchableOpacity
                    style={[styles.crewButton, crewSize <= 1 && styles.crewButtonDisabled]}
                    onPress={() => setCrewSize((n) => Math.max(1, n - 1))}
                    disabled={crewSize <= 1}
                  >
                    <LinearGradient
                      colors={crewSize <= 1 ? ['#cbd5e1', '#cbd5e1'] : ['#1B4D6E', '#245d82']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.crewButtonGradient}
                    >
                      <Text style={styles.crewButtonText}>−</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                  <View style={styles.crewSizeDisplay}>
                    <Users size={16} color="#1B4D6E" />
                    <Text style={styles.crewSizeText}>{crewSize} {crewSize === 1 ? 'person' : 'people'}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.crewButton}
                    onPress={() => setCrewSize((n) => n + 1)}
                  >
                    <LinearGradient
                      colors={['#1B4D6E', '#245d82']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.crewButtonGradient}
                    >
                      <Text style={styles.crewButtonText}>+</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Payment Section */}
              <View style={styles.paymentSection}>
                <View style={styles.paymentHeader}>
                  <Text style={styles.paymentHeaderText}>Payment</Text>
                </View>

                {/* Payment status buttons */}
                <View style={styles.paymentStatusRow}>
                  {(
                    [
                      { key: 'unpaid', label: 'Unpaid' },
                      { key: 'partial', label: 'Partial' },
                      { key: 'paid', label: 'Paid' },
                    ] as const
                  ).map(({ key, label }) => (
                    <TouchableOpacity
                      key={key}
                      style={[
                        styles.paymentStatusButton,
                        paymentStatus === key && styles.paymentStatusButtonActive,
                        paymentStatus === key && key === 'paid' && styles.paymentStatusButtonPaid,
                        paymentStatus === key && key === 'partial' && styles.paymentStatusButtonPartial,
                      ]}
                      onPress={() => setPaymentStatus(key)}
                    >
                      <Text
                        style={[
                          styles.paymentStatusButtonText,
                          paymentStatus === key && styles.paymentStatusButtonTextActive,
                        ]}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Amount */}
                <View style={[styles.paymentAmountRow, { marginTop: 12 }]}>
                  <View style={styles.paymentAmountField}>
                    <Text style={styles.label}>Amount{computedTotal > 0 ? ' (auto-calculated)' : ''}</Text>
                    <TextInput
                      style={styles.input}
                      value={paymentAmount}
                      onChangeText={setPaymentAmount}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                </View>

                {/* Payment method */}
                <View style={{ marginTop: 12 }}>
                  <Text style={styles.label}>Payment Method</Text>
                  <View style={styles.paymentMethodRow}>
                    {['cash', 'check', 'card', 'venmo', 'zelle', 'other'].map((method) => (
                      <TouchableOpacity
                        key={method}
                        style={[
                          styles.paymentMethodButton,
                          paymentMethod === method && styles.paymentMethodButtonActive,
                        ]}
                        onPress={() =>
                          setPaymentMethod((prev) => (prev === method ? '' : method))
                        }
                      >
                        <Text
                          style={[
                            styles.paymentMethodButtonText,
                            paymentMethod === method && styles.paymentMethodButtonTextActive,
                          ]}
                        >
                          {method.charAt(0).toUpperCase() + method.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              {/* Notes */}
              <View style={[styles.inputGroup, { marginTop: 16 }]}>
                <Text style={styles.label}>Notes</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Add notes..."
                  placeholderTextColor="#94a3b8"
                  multiline
                  textAlignVertical="top"
                />
              </View>

              {/* Recurring */}
              <View style={styles.inputGroup}>
                <TouchableOpacity
                  style={styles.recurringToggle}
                  onPress={() => setIsRecurring((v) => !v)}
                >
                  <View
                    style={[
                      styles.checkbox,
                      isRecurring && styles.checkboxChecked,
                    ]}
                  >
                    {isRecurring && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text
                    style={[
                      styles.recurringToggleText,
                      isRecurring && styles.recurringToggleTextActive,
                    ]}
                  >
                    Recurring Event
                  </Text>
                </TouchableOpacity>

                {isRecurring && (
                  <View style={styles.recurringOptions}>
                    <Text style={styles.subLabel}>Frequency</Text>
                    <View style={styles.recurrenceTypeRow}>
                      {(
                        [
                          { key: 'weekly', label: 'Weekly' },
                          { key: 'biweekly', label: 'Bi-Weekly' },
                          { key: 'monthly', label: 'Monthly' },
                          { key: 'custom', label: 'Custom' },
                        ] as const
                      ).map(({ key, label }) => (
                        <TouchableOpacity
                          key={key}
                          style={[
                            styles.recurrenceTypeButton,
                            recurrenceType === key && styles.recurrenceTypeButtonActive,
                          ]}
                          onPress={() => setRecurrenceType(key)}
                        >
                          <Text
                            style={[
                              styles.recurrenceTypeButtonText,
                              recurrenceType === key && styles.recurrenceTypeButtonTextActive,
                            ]}
                          >
                            {label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {recurrenceType === 'weekly' || recurrenceType === 'biweekly' ? (
                      <View>
                        <Text style={[styles.subLabel, { marginBottom: 8 }]}>Days of Week</Text>
                        <View style={styles.daysOfWeekRow}>
                          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                            <TouchableOpacity
                              key={i}
                              style={[
                                styles.dayButton,
                                selectedDays.includes(i) && styles.dayButtonActive,
                              ]}
                              onPress={() =>
                                setSelectedDays((prev) =>
                                  prev.includes(i)
                                    ? prev.filter((d) => d !== i)
                                    : [...prev, i]
                                )
                              }
                            >
                              <Text
                                style={[
                                  styles.dayButtonText,
                                  selectedDays.includes(i) && styles.dayButtonTextActive,
                                ]}
                              >
                                {day}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    ) : null}
                  </View>
                )}
              </View>
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
              {isEditing && (
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => {
                    Alert.alert(
                      'Delete Event',
                      'Are you sure you want to delete this event?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: handleDelete },
                      ]
                    );
                  }}
                  disabled={deleteLoading}
                >
                  {deleteLoading ? (
                    <ActivityIndicator size="small" color="#ef4444" />
                  ) : (
                    <Trash2 size={18} color="#ef4444" />
                  )}
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveButton, styles.saveButtonSolid, loading && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>
                    {isEditing ? 'Update' : 'Schedule'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

        </View>
      </KeyboardAvoidingView>
    </Modal>

      <TimePicker
        visible={showStartTimePicker}
        value={`${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')}`}
        onConfirm={(time) => {
          const [h, m] = time.split(':').map(Number);
          const d = new Date(startTime);
          d.setHours(h, m, 0, 0);
          setStartTime(d);
          if (d >= endTime) {
            const newEnd = new Date(d);
            newEnd.setHours(newEnd.getHours() + 1);
            setEndTime(newEnd);
          }
          setShowStartTimePicker(false);
        }}
        onCancel={() => setShowStartTimePicker(false)}
      />

      <TimePicker
        visible={showEndTimePicker}
        value={`${endTime.getHours().toString().padStart(2, '0')}:${endTime.getMinutes().toString().padStart(2, '0')}`}
        onConfirm={(time) => {
          const [h, m] = time.split(':').map(Number);
          const d = new Date(endTime);
          d.setHours(h, m, 0, 0);
          setEndTime(d);
          setShowEndTimePicker(false);
        }}
        onCancel={() => setShowEndTimePicker(false)}
      />

      <DatePicker
        visible={showStartDatePicker}
        value={`${startTime.getFullYear()}-${(startTime.getMonth() + 1).toString().padStart(2, '0')}-${startTime.getDate().toString().padStart(2, '0')}`}
        onConfirm={(date) => {
          const [y, mo, dy] = date.split('-').map(Number);
          const d = new Date(startTime);
          d.setFullYear(y, mo - 1, dy);
          setStartTime(d);
          if (d > endTime) {
            const newEnd = new Date(d);
            newEnd.setHours(endTime.getHours(), endTime.getMinutes(), 0, 0);
            setEndTime(newEnd);
          }
          setShowStartDatePicker(false);
        }}
        onCancel={() => setShowStartDatePicker(false)}
      />

      <DatePicker
        visible={showEndDatePicker}
        value={`${endTime.getFullYear()}-${(endTime.getMonth() + 1).toString().padStart(2, '0')}-${endTime.getDate().toString().padStart(2, '0')}`}
        onConfirm={(date) => {
          const [y, mo, dy] = date.split('-').map(Number);
          const d = new Date(endTime);
          d.setFullYear(y, mo - 1, dy);
          setEndTime(d);
          setShowEndDatePicker(false);
        }}
        onCancel={() => setShowEndDatePicker(false)}
      />

      <ClientQuickSendModal
        visible={quickSendVisible}
        onClose={() => setQuickSendVisible(false)}
        clientName={selectedClient?.name || ''}
        primaryPhone={selectedClient?.phone || ''}
        secondaryContactName={selectedClient?.secondary_contact_name || undefined}
        secondaryPhone={selectedClient?.secondary_contact_phone || undefined}
      />
    </>
  );
}

const lastJobBannerStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  text: {
    flex: 1,
    fontSize: 12,
    color: '#0369a1',
    fontWeight: '500',
  },
});
