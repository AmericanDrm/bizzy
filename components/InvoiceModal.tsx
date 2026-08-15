import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  Switch,
  Linking,
  Animated,
  NativeScrollEvent,
  NativeSyntheticEvent,
  LayoutChangeEvent,
} from 'react-native';
import { X, ChevronDown, Plus, Minus, Trash2, Send, Mail, MessageSquare, UserPlus, Briefcase, CircleAlert as AlertCircle, CalendarDays, Check, Eye, Search, DollarSign, CreditCard, UserCog, MapPin, Wrench } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import DatePicker from './DatePicker';
import InvoicePreviewModal from './InvoicePreviewModal';
import { PDFGenerator } from '@/lib/pdfGenerator';
import type { InvoicePDFData } from '@/lib/pdfGenerator';
import { supabase, invokeFunction } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { calculateLateFee, roundPrice, PriceRoundingSettings } from '@/lib/utilities';
import AIAssistButton from './AIAssistButton';
import ClientModal from './ClientModal';
import EquipmentEditModal from './EquipmentEditModal';
import CollapsibleField from './CollapsibleField';
import { useCollapsibleForm } from '@/hooks/useCollapsibleForm';
import { getEffectivePanePrice, getEffectivePanePriceFromJobType, getEffectivePanePriceWithClientOverride, getClientPaneCount, SERVICE_SCOPE_OPTIONS, calculateMixedPaneTotal, calculateMixedPaneTotalWithClientPrices, hasMixedPaneTypes, hasPerTypePricing, getPriceForPaneType, getEffectivePanePriceForType, hasSplitPaneDetails, calculateSplitPaneTotal, calculateSplitPaneTotalWithClientPrices, getPaneTypesFromSplitDetails, getExteriorSplitForPaneType, normalizePaneDetails } from '@/lib/panePricingService';
import type { ServiceScope, ClientPaneTypePriceEntry } from '@/lib/panePricingService';
import { useRegisterModal } from '@/contexts/ModalStackContext';
import { uploadPdfAndGetUrl, getOrCreateShortLink } from '@/lib/pdfUploadService';
import PaneCountStepper from '@/components/shared/PaneCountStepper';
import SelectionSheet from '@/components/shared/SelectionSheet';
import { seedStarterJobTypes } from '@/lib/starterJobTypesService';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { AddressData, buildFullAddress, emptyAddressData } from '@/lib/addressService';

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  secondary_contact_name?: string | null;
  secondary_contact_phone?: string | null;
}

interface ClientAddress {
  id: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  label: string;
  is_primary: boolean;
}

interface JobType {
  id: string;
  name: string;
  hourly_rate: number;
  unit_of_measure: string;
  custom_unit_label: string;
  is_flat_rate: boolean;
  category_id?: string | null;
  category_service_type?: string | null;
  scope_options?: 'both' | 'exterior_only' | 'interior_only' | null;
  exterior_split_percent?: number | null;
  exterior_split_percent_standard?: number | null;
  exterior_split_percent_french?: number | null;
  exterior_split_percent_storm?: number | null;
  exterior_split_percent_skylights?: number | null;
  interior_split_percent?: number | null;
  interior_split_percent_standard?: number | null;
  interior_split_percent_french?: number | null;
  interior_split_percent_storm?: number | null;
  interior_split_percent_skylights?: number | null;
  price_per_pane_standard?: number | null;
  price_per_pane_french?: number | null;
  price_per_pane_storm?: number | null;
  price_per_pane_skylights?: number | null;
}

interface InvoiceItem {
  id?: string;
  job_type_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  service_scope?: ServiceScope;
  pane_details?: Record<string, number> | null;
  companion_item_index?: number;
}

interface Invoice {
  id: string;
  client_id: string;
  invoice_number: string;
  status: string;
  issue_date: string;
  due_date: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  notes: string;
  sent_via?: string;
  sent_at?: string;
  payment_terms?: string;
}

interface InvoicePrefill {
  clientId: string;
  items: InvoiceItem[];
  notes?: string;
  taxRate?: string;
  scheduleEventId?: string;
}

interface InvoiceModalProps {
  visible: boolean;
  invoice: Invoice | null;
  onClose: () => void;
  onSave: () => void;
  prefill?: InvoicePrefill | null;
  autoOpenSend?: boolean;
  scheduleEventId?: string;
}

export default function InvoiceModal({ visible, invoice, onClose, onSave, prefill, autoOpenSend, scheduleEventId: scheduleEventIdProp }: InvoiceModalProps) {
  const isDirtyRef = useRef(false);
  const loadingExistingInvoiceRef = useRef(false);
  const editModeItemsLoadedRef = useRef(false);
  const paneItemsInitializedForAddressRef = useRef<string | null>(null);
  useRegisterModal('invoice-modal', visible, onClose, () => isDirtyRef.current);
  const [clients, setClients] = useState<Client[]>([]);
  const [jobTypes, setJobTypes] = useState<JobType[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string; color: string; service_type?: string | null }[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [seedingStarters, setSeedingStarters] = useState(false);
  const [activeCategoryByItem, setActiveCategoryByItem] = useState<Record<number, string>>({});
  const [categoryUsageCounts, setCategoryUsageCounts] = useState<Record<string, number>>({});
  const [jobTypeUsageCounts, setJobTypeUsageCounts] = useState<Record<string, number>>({});
  const [selectedClientId, setSelectedClientId] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [taxRate, setTaxRate] = useState('0');
  const [notes, setNotes] = useState('');
  const [memo, setMemo] = useState('');
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [rateInputTexts, setRateInputTexts] = useState<Record<string, string>>({});
  const [totalInputTexts, setTotalInputTexts] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [showJobTypePicker, setShowJobTypePicker] = useState<number | null>(null);
  const [jobTypeSearchQuery, setJobTypeSearchQuery] = useState('');
  const [showServiceSheet, setShowServiceSheet] = useState(false);
  const [serviceSheetIndex, setServiceSheetIndex] = useState<number | null>(null);
  const jobTypeSearchRef = useRef<TextInput>(null);
  const [showEquipmentEditModal, setShowEquipmentEditModal] = useState(false);
  const [showSendOptions, setShowSendOptions] = useState(false);
  const [sendToSelf, setSendToSelf] = useState(false);
  const [phonePickerVisible, setPhonePickerVisible] = useState(false);
  const [phonePickerOptions, setPhonePickerOptions] = useState<{ label: string; phone: string }[]>([]);
  const phonePickerResolveRef = React.useRef<((phone: string | null) => void) | null>(null);

  const pickPhone = (client: Client): Promise<string | null> => {
    if (!client.secondary_contact_phone) return Promise.resolve(client.phone);
    return new Promise(resolve => {
      phonePickerResolveRef.current = resolve;
      setPhonePickerOptions([
        { label: `${client.name} (Primary)`, phone: client.phone },
        { label: `${client.secondary_contact_name || 'Secondary Contact'}`, phone: client.secondary_contact_phone! },
      ]);
      setPhonePickerVisible(true);
    });
  };
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientAddress, setNewClientAddress] = useState('');
  const [savingClient, setSavingClient] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState('draft');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [amountPaid, setAmountPaid] = useState('0');
  const [showPaymentStatusPicker, setShowPaymentStatusPicker] = useState(false);
  const [showPaymentMethodPicker, setShowPaymentMethodPicker] = useState(false);
  const [paymentTerms, setPaymentTerms] = useState('net_30');
  const [showPaymentTermsPicker, setShowPaymentTermsPicker] = useState(false);
  const [showNewJobTypeForm, setShowNewJobTypeForm] = useState(false);
  const [newJobTypeName, setNewJobTypeName] = useState('');
  const [newJobTypeRate, setNewJobTypeRate] = useState('');
  const [newJobTypeUnit, setNewJobTypeUnit] = useState('hour');
  const [newJobTypeCustomUnit, setNewJobTypeCustomUnit] = useState('');
  const [newJobTypeIsFlatRate, setNewJobTypeIsFlatRate] = useState(false);
  const [savingJobType, setSavingJobType] = useState(false);
  const [currentItemIndex, setCurrentItemIndex] = useState<number | null>(null);
  const [lateFeePercentage, setLateFeePercentage] = useState('0');
  const [lateFeeAmount, setLateFeeAmount] = useState(0);
  const [showIssueDatePicker, setShowIssueDatePicker] = useState(false);
  const [showDueDatePicker, setShowDueDatePicker] = useState(false);
  const [datePickerInitialMode, setDatePickerInitialMode] = useState<'scroll' | 'type'>('scroll');
  const [showPreview, setShowPreview] = useState(false);
  const [businessSettings, setBusinessSettings] = useState<any>(null);
  const [clientDisableRounding, setClientDisableRounding] = useState(false);
  const [tallyInputs, setTallyInputs] = useState<Record<number, string>>({});
  const tallyInputRefs = useRef<Record<number, TextInput | null>>({});
  const [directCountInputs, setDirectCountInputs] = useState<Record<number, string>>({});
  const [addonTallyInputs, setAddonTallyInputs] = useState<Record<number, Record<string, string>>>({});
  const addonTallyInputRefs = useRef<Record<number, Record<string, TextInput | null>>>({});
  const [addonDirectInputs, setAddonDirectInputs] = useState<Record<number, Record<string, string>>>({});
  const [clientPaneQuantities, setClientPaneQuantities] = useState<any[]>([]);
  const [clientPaneTypePrices, setClientPaneTypePrices] = useState<ClientPaneTypePriceEntry[]>([]);
  const [showScopePicker, setShowScopePicker] = useState<number | null>(null);
  const [paneAddonCounts, setPaneAddonCounts] = useState<Record<number, Record<string, number>>>({});
  const [showAddonsByItem, setShowAddonsByItem] = useState<Record<number, boolean>>({});
  const [clientBalance, setClientBalance] = useState(0);
  const [applyCredit, setApplyCredit] = useState(false);
  const [clientAddressPriceOverride, setClientAddressPriceOverride] = useState<number | null>(null);
  const [clientAddresses, setClientAddresses] = useState<ClientAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [newAddressData, setNewAddressData] = useState<AddressData>(emptyAddressData);
  const [newAddressLabel, setNewAddressLabel] = useState('');
  const [savingNewAddress, setSavingNewAddress] = useState(false);
  const [jobTypePriceOverrides, setJobTypePriceOverrides] = useState<Record<string, number>>({});
  const [includeCcFee, setIncludeCcFee] = useState(false);
  const [ccFeePercent, setCcFeePercent] = useState(0);
  const [showCcFeeNotice, setShowCcFeeNotice] = useState(false);
  const [showFloatingTotal, setShowFloatingTotal] = useState(false);
  const scrollOffsetRef = useRef(0);
  const totalsCardYRef = useRef(0);
  const scrollViewHeightRef = useRef(0);
  const floatingTotalOpacity = useRef(new Animated.Value(0)).current;
  const { user } = useAuth();
  const { showToast } = useToast();
  const { colors } = useTheme();
  const { currentOrganization } = useOrganization();
  const { activeFieldId, toggleField } = useCollapsibleForm();

  const taxRateInputRef = useRef<TextInput>(null);
  const notesInputRef = useRef<TextInput>(null);
  const memoInputRef = useRef<TextInput>(null);
  const clientSearchRef = useRef<TextInput>(null);
  const newClientNameRef = useRef<TextInput>(null);
  const newJobTypeNameRef = useRef<TextInput>(null);
  const newJobTypeCustomUnitRef = useRef<TextInput>(null);

  const calculateDueDate = (issueDate: string, terms: string): string => {
    if (!issueDate || terms === 'custom') return issueDate;
    const date = new Date(issueDate);
    switch (terms) {
      case 'due_on_receipt':
        return issueDate;
      case 'net_15':
        date.setDate(date.getDate() + 15);
        break;
      case 'net_30':
        date.setDate(date.getDate() + 30);
        break;
      case 'net_60':
        date.setDate(date.getDate() + 60);
        break;
      case 'net_90':
        date.setDate(date.getDate() + 90);
        break;
      case 'net_3_months':
        date.setMonth(date.getMonth() + 3);
        break;
      default:
        date.setDate(date.getDate() + 30);
    }
    return date.toISOString().split('T')[0];
  };

  useEffect(() => {
    if (visible && currentOrganization?.id) {
      fetchClients();
      fetchJobTypes();
      fetchCategories();
      fetchBusinessSettings();
      setShowNewJobTypeForm(false);
      setActiveCategoryByItem({});
    }
  }, [visible, currentOrganization?.id]);

  useEffect(() => {
    if (visible && autoOpenSend) {
      const timer = setTimeout(() => setShowSendOptions(true), 400);
      return () => clearTimeout(timer);
    }
  }, [visible, autoOpenSend]);

  useEffect(() => {
    if (showClientPicker) {
      setTimeout(() => clientSearchRef.current?.focus(), 100);
    }
  }, [showClientPicker]);

  useEffect(() => {
    if (!selectedAddressId) return;
    if (!clientPaneQuantities || clientPaneQuantities.length === 0) return;
    if (loadingExistingInvoiceRef.current) return;
    if (editModeItemsLoadedRef.current) return;
    // Only initialize pane items once per address — subsequent changes to prices/quantities
    // must not overwrite counts the user has already set in this session
    if (paneItemsInitializedForAddressRef.current === selectedAddressId) return;
    paneItemsInitializedForAddressRef.current = selectedAddressId;
    resetPaneItemsForAddress(clientPaneQuantities, selectedAddressId, clientPaneTypePrices);
  }, [selectedAddressId, clientPaneQuantities, clientPaneTypePrices]);

  const prefillAppliedRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      prefillAppliedRef.current = false;
      isDirtyRef.current = false;
      loadingExistingInvoiceRef.current = false;
      editModeItemsLoadedRef.current = false;
      paneItemsInitializedForAddressRef.current = null;
      return;
    }
    isDirtyRef.current = false;
    if (invoice) {
      loadingExistingInvoiceRef.current = true;
      setSelectedClientId(invoice.client_id);
      setIssueDate(invoice.issue_date);
      setDueDate(invoice.due_date);
      setTaxRate(invoice.tax_rate.toString());
      setNotes(invoice.notes);
      setMemo((invoice as any).memo || '');
      setPaymentStatus((invoice as any).payment_status || 'draft');
      setPaymentMethod((invoice as any).payment_method || '');
      setAmountPaid(((invoice as any).amount_paid || 0).toString());
      setPaymentTerms(invoice.payment_terms || 'net_30');
      setIncludeCcFee(((invoice as any).cc_fee_percent ?? 0) > 0);
      if ((invoice as any).service_address_id) {
        setSelectedAddressId((invoice as any).service_address_id);
      }
      fetchInvoiceItems(invoice.id).finally(() => {
        loadingExistingInvoiceRef.current = false;
        editModeItemsLoadedRef.current = true;
      });
      fetchClientPaneQuantities(invoice.client_id, (invoice as any).service_address_id || null);
      fetchClientBalance(invoice.client_id);
      fetchClientAddressOverride(invoice.client_id);
      fetchClientAddresses(invoice.client_id, true);
      fetchClientRoundingSetting(invoice.client_id);
      fetchJobTypePriceOverrides(invoice.client_id, (invoice as any).service_address_id);
    } else if (prefill && !prefillAppliedRef.current) {
      prefillAppliedRef.current = true;
      resetForm();
      setSelectedClientId(prefill.clientId);
      if (prefill.items.length > 0) {
        setItems(prefill.items);
        const initAddons: Record<number, Record<string, number>> = {};
        prefill.items.forEach((item, idx) => {
          if (item.pane_details) {
            const { standard: _std, ...rest } = item.pane_details as Record<string, number>;
            const nonStd = Object.fromEntries(Object.entries(rest).filter(([, v]) => (v as number) > 0));
            if (Object.keys(nonStd).length > 0) initAddons[idx] = nonStd;
          }
        });
        if (Object.keys(initAddons).length > 0) setPaneAddonCounts(initAddons);
      }
      if (prefill.notes) setNotes(prefill.notes);
      if (prefill.taxRate) setTaxRate(prefill.taxRate);
      fetchClientBalance(prefill.clientId);
      fetchClientAddressOverride(prefill.clientId);
      fetchClientAddresses(prefill.clientId).then(resolvedAddressId => {
        fetchClientPaneQuantities(prefill.clientId, resolvedAddressId || null);
        fetchJobTypePriceOverrides(prefill.clientId, resolvedAddressId || undefined);
      });
      fetchClientRoundingSetting(prefill.clientId);
    } else if (!prefill && !invoice) {
      resetForm();
    }
  }, [invoice, visible, prefill]);

  const fetchClients = async () => {
    let query = supabase
      .from('clients')
      .select('id, name, email, phone, secondary_contact_name, secondary_contact_phone');
    if (currentOrganization?.id) {
      query = query.eq('organization_id', currentOrganization.id);
    }
    const { data } = await query.order('name');
    setClients(data || []);
  };

  const fetchClientRoundingSetting = async (clientId: string) => {
    const { data } = await supabase
      .from('clients')
      .select('disable_rounding')
      .eq('id', clientId)
      .maybeSingle();
    setClientDisableRounding((data as any)?.disable_rounding ?? false);
  };

  const fetchJobTypes = async () => {
    setLoadingTypes(true);
    let jtQuery = supabase
      .from('job_types')
      .select('id, name, hourly_rate, unit_of_measure, custom_unit_label, is_flat_rate, category_id, scope_options, exterior_split_percent, exterior_split_percent_standard, exterior_split_percent_french, exterior_split_percent_storm, exterior_split_percent_skylights, interior_split_percent, interior_split_percent_standard, interior_split_percent_french, interior_split_percent_storm, interior_split_percent_skylights, price_per_pane_standard, price_per_pane_french, price_per_pane_storm, price_per_pane_skylights, job_type_categories(service_type)')
      .eq('is_active', true)
      .order('name');
    let catQuery = supabase
      .from('job_type_categories')
      .select('id, name, color, service_type')
      .order('sort_order');
    if (currentOrganization?.id) {
      jtQuery = jtQuery.eq('organization_id', currentOrganization.id);
      catQuery = catQuery.eq('organization_id', currentOrganization.id);
    }
    const [jtResult, catResult] = await Promise.all([jtQuery, catQuery]);
    if (jtResult.error) console.error('[InvoiceModal] fetch job_types error:', jtResult.error);
    if (catResult.error) console.error('[InvoiceModal] fetch job_type_categories error:', catResult.error);
    const mapped = (jtResult.data || []).map((jt: any) => ({
      ...jt,
      category_service_type: jt.job_type_categories?.service_type ?? null,
    }));
    setJobTypes(mapped);
    setCategories(catResult.data || []);
    await fetchCategoryUsageCounts();
    setLoadingTypes(false);
  };

  const fetchCategoryUsageCounts = async () => {
    if (!currentOrganization?.id) {
      setCategoryUsageCounts({});
      setJobTypeUsageCounts({});
      return;
    }
    const { data, error } = await supabase
      .from('invoice_items')
      .select('job_type_id, job_types!inner(category_id, organization_id)')
      .eq('job_types.organization_id', currentOrganization.id)
      .not('job_type_id', 'is', null)
      .limit(5000);
    if (error) {
      console.error('[InvoiceModal] fetch usage counts error:', error);
      return;
    }
    const catCounts: Record<string, number> = {};
    const jtCounts: Record<string, number> = {};
    (data || []).forEach((row: any) => {
      const jtId = row.job_type_id;
      const catId = row.job_types?.category_id || '__none__';
      if (jtId) jtCounts[jtId] = (jtCounts[jtId] || 0) + 1;
      catCounts[catId] = (catCounts[catId] || 0) + 1;
    });
    setCategoryUsageCounts(catCounts);
    setJobTypeUsageCounts(jtCounts);
  };

  const fetchCategories = async () => {
    let query = supabase
      .from('job_type_categories')
      .select('id, name, color, service_type')
      .order('sort_order');
    if (currentOrganization?.id) {
      query = query.eq('organization_id', currentOrganization.id);
    }
    const { data } = await query;
    setCategories(data || []);
  };

  const fetchClientPaneQuantities = async (clientId: string, addressId?: string | null) => {
    const { data } = await supabase
      .from('client_unit_quantities')
      .select('job_type_id, quantity, pane_details, address_id')
      .eq('client_id', clientId);
    const quantities = (data || []).map((q: any) => ({
      ...q,
      pane_details: normalizePaneDetails(q.pane_details, Number(q.quantity) || 0),
    }));
    setClientPaneQuantities(quantities);
    const { data: priceData } = await supabase
      .from('client_pane_type_prices')
      .select('job_type_id, pane_type_key, price_mode, price_per_pane, flat_rate_amount, address_id')
      .eq('client_id', clientId);
    const mappedPrices = (priceData || []).map((d: any) => ({
      job_type_id: d.job_type_id,
      pane_type_key: d.pane_type_key,
      price_mode: d.price_mode as 'per_pane' | 'flat_rate',
      price_per_pane: d.price_per_pane ?? null,
      flat_rate_amount: d.flat_rate_amount ?? null,
      address_id: d.address_id ?? null,
    }));
    setClientPaneTypePrices(mappedPrices);
    if (addressId && !loadingExistingInvoiceRef.current && !editModeItemsLoadedRef.current) {
      resetPaneItemsForAddress(data || [], addressId, mappedPrices);
    }
  };

  const saveProfilePaneCount = async (jobTypeId: string, totalPanes: number, paneDetails: Record<string, number>) => {
    if (!selectedClientId || !currentOrganization?.id || !jobTypeId) return;
    const addressId = selectedAddressId && selectedAddressId.trim() !== '' ? selectedAddressId : null;
    // Check if a record already exists so we can update vs insert
    const { data: existing } = await supabase
      .from('client_unit_quantities')
      .select('id')
      .eq('client_id', selectedClientId)
      .eq('job_type_id', jobTypeId)
      .is('address_id', addressId)
      .maybeSingle();
    if (existing?.id) {
      await supabase
        .from('client_unit_quantities')
        .update({ quantity: totalPanes, pane_details: paneDetails })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('client_unit_quantities')
        .insert({
          client_id: selectedClientId,
          organization_id: currentOrganization.id,
          job_type_id: jobTypeId,
          address_id: addressId,
          quantity: totalPanes,
          pane_details: paneDetails,
        });
    }
    setClientPaneQuantities(prev => {
      const filtered = prev.filter(
        q => !(q.job_type_id === jobTypeId && (q.address_id ?? null) === addressId),
      );
      return [...filtered, { job_type_id: jobTypeId, address_id: addressId, quantity: totalPanes, pane_details: paneDetails }];
    });
  };

  const resetPaneItemsForAddress = (paneQuantities: any[], addressId: string, paneTypePricesOverride?: any[]) => {
    const pricesForLookup = paneTypePricesOverride ?? clientPaneTypePrices;
    setItems(prev => prev.map(item => {
      if (!item.job_type_id) return item;
      // Items in a companion pair have independently-set counts — never overwrite them from the shared DB record
      if (item.companion_item_index !== undefined && item.companion_item_index !== null) return item;
      const jobType = jobTypes.find(jt => jt.id === item.job_type_id);
      if (!jobType || jobType.unit_of_measure !== 'pane' || jobType.is_flat_rate) return item;
      const entry = paneQuantities.find((q: any) => q.job_type_id === item.job_type_id && q.address_id === addressId);
      const dbQty = entry ? Number(entry.quantity) || 0 : 0;
      const rawPaneDetails = entry?.pane_details && typeof entry.pane_details === 'object' ? entry.pane_details as Record<string, number> : null;
      const filteredPaneDetails: Record<string, number> = rawPaneDetails
        ? Object.fromEntries(Object.entries(rawPaneDetails).filter(([, v]) => Number(v) > 0).map(([k, v]) => [k, Number(v)]))
        : {};
      const breakdownSum = Object.values(filteredPaneDetails).reduce((s, v) => s + v, 0);
      const newPaneDetails: Record<string, number> = breakdownSum > 0 && breakdownSum === dbQty
        ? filteredPaneDetails
        : { standard: dbQty };
      const primaryKey = Object.keys(newPaneDetails).find(k => k !== 'standard' && newPaneDetails[k] > 0) || 'standard';
      const scope = (item.service_scope as ServiceScope) || 'full_service';
      const newUnitPrice = pricesForLookup.length > 0
        ? getEffectivePanePriceWithClientOverride(jobType, primaryKey as any, scope, pricesForLookup, item.job_type_id, addressId).price
        : getEffectivePanePriceForType(jobType, primaryKey as any, scope);
      const total = computeItemTotal(dbQty, newUnitPrice, newPaneDetails, jobType, scope, item.job_type_id, addressId);
      return { ...item, quantity: dbQty, pane_details: newPaneDetails, pane_type: primaryKey, unit_price: newUnitPrice, total };
    }));
  };

  const fetchClientBalance = async (clientId: string) => {
    const { data } = await supabase
      .from('clients')
      .select('account_balance')
      .eq('id', clientId)
      .maybeSingle();
    const bal = Number(data?.account_balance) || 0;
    setClientBalance(bal);
    if (bal <= 0) setApplyCredit(false);
  };

  const fetchClientAddressOverride = async (clientId: string) => {
    const { data } = await supabase
      .from('client_addresses')
      .select('price_override, price_override_enabled')
      .eq('client_id', clientId)
      .eq('price_override_enabled', true)
      .order('is_primary', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.price_override_enabled && data?.price_override !== null) {
      setClientAddressPriceOverride(Number(data.price_override));
    } else {
      setClientAddressPriceOverride(null);
    }
  };

  const fetchClientAddresses = async (clientId: string, preserveCurrentAddress?: boolean): Promise<string> => {
    const { data } = await supabase
      .from('client_addresses')
      .select('id, street, city, state, zip:postal_code, label, is_primary')
      .eq('client_id', clientId)
      .order('is_primary', { ascending: false })
      .order('label');
    setClientAddresses(data || []);
    const primary = (data || []).find((a: ClientAddress) => a.is_primary);
    const resolvedId = primary?.id || (data?.[0]?.id ?? '');
    if (!preserveCurrentAddress) {
      setSelectedAddressId(resolvedId);
    }
    return resolvedId;
  };

  const handleSaveNewAddress = async () => {
    if (!selectedClientId || !currentOrganization?.id) return;
    const fullAddress = buildFullAddress(newAddressData.street, newAddressData.city, newAddressData.state, newAddressData.postalCode, newAddressData.country || 'US');
    if (!fullAddress.trim()) return;
    setSavingNewAddress(true);
    try {
      const { data, error } = await supabase
        .from('client_addresses')
        .insert({
          client_id: selectedClientId,
          organization_id: currentOrganization.id,
          user_id: user?.id,
          address: fullAddress,
          street: newAddressData.street,
          city: newAddressData.city,
          state: newAddressData.state,
          postal_code: newAddressData.postalCode,
          country: newAddressData.country || 'US',
          label: newAddressLabel.trim() || '',
          is_primary: clientAddresses.length === 0,
          latitude: newAddressData.latitude ?? null,
          longitude: newAddressData.longitude ?? null,
          normalized: newAddressData.normalized ?? false,
        })
        .select('id, street, city, state, zip:postal_code, label, is_primary')
        .single();
      if (error) throw error;
      const updated = [...clientAddresses, data as ClientAddress];
      setClientAddresses(updated);
      setSelectedAddressId(data.id);
      setShowNewAddressForm(false);
      setNewAddressData(emptyAddressData);
      setNewAddressLabel('');
      fetchJobTypePriceOverrides(selectedClientId, data.id);
      toggleField('billingAddress');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save address. Please try again.');
    } finally {
      setSavingNewAddress(false);
    }
  };

  const fetchJobTypePriceOverrides = async (clientId: string, addressId?: string) => {
    let query = supabase
      .from('client_unit_quantities')
      .select('job_type_id, price_override, price_override_enabled, address_id')
      .eq('client_id', clientId)
      .eq('price_override_enabled', true)
      .not('price_override', 'is', null);
    const { data } = await query;
    if (!data) { setJobTypePriceOverrides({}); return; }
    const overrides: Record<string, number> = {};
    const addrEntries = data.filter((d: any) => d.address_id && d.address_id === (addressId || ''));
    const clientEntries = data.filter((d: any) => !d.address_id);
    [...clientEntries, ...addrEntries].forEach((d: any) => {
      overrides[d.job_type_id] = Number(d.price_override);
    });
    setJobTypePriceOverrides(overrides);
  };

  const formatAddress = (addr: ClientAddress): string => {
    const parts = [addr.street, addr.city, addr.state, addr.zip].filter(Boolean);
    return parts.join(', ');
  };

  const fetchBusinessSettings = async () => {
    if (!currentOrganization?.id) return;
    const { data } = await supabase
      .from('business_settings')
      .select('*')
      .eq('organization_id', currentOrganization.id)
      .maybeSingle();
    if (data) {
      setBusinessSettings(data);
      if (!invoice && (data.default_tax_rate ?? 0) > 0 && (data.auto_apply_tax ?? true)) {
        setTaxRate(data.default_tax_rate.toString());
      }
      setCcFeePercent(data.cc_processing_fee_percent ?? 0);
      setShowCcFeeNotice(data.show_cc_fee_notice ?? false);
      if (!invoice && (data.cc_processing_fee_percent ?? 0) > 0 && data.stripe_payment_link) {
        setIncludeCcFee(true);
      }
    }
  };

  const fetchInvoiceItems = async (invoiceId: string) => {
    const { data } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invoiceId);
    if (data) {
      const mappedItems = data.map(item => ({
        id: item.id,
        job_type_id: item.job_type_id,
        description: item.description,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        total: Number(item.total),
        service_scope: item.service_scope as ServiceScope | undefined,
        pane_details: item.pane_details || null,
      }));
      setItems(mappedItems);
      const initAddons: Record<number, Record<string, number>> = {};
      mappedItems.forEach((item, idx) => {
        if (item.pane_details) {
          const { standard: _std, ...rest } = item.pane_details as Record<string, number>;
          const nonStd = Object.fromEntries(Object.entries(rest).filter(([, v]) => v > 0));
          if (Object.keys(nonStd).length > 0) initAddons[idx] = nonStd;
        }
      });
      if (Object.keys(initAddons).length > 0) setPaneAddonCounts(initAddons);
    }
  };

  const resetForm = () => {
    setSelectedClientId('');
    const today = new Date().toISOString().split('T')[0];
    const defaultTerms = 'net_30';
    setIssueDate(today);
    setPaymentTerms(defaultTerms);
    setDueDate(calculateDueDate(today, defaultTerms));
    setTaxRate('0');
    setNotes('');
    setMemo('');
    setItems([{ description: '', quantity: 1, unit_price: 0, total: 0 }]);
    setError('');
    setShowNewClientForm(false);
    setNewClientName('');
    setNewClientEmail('');
    setNewClientPhone('');
    setNewClientAddress('');
    setPaymentStatus('draft');
    setPaymentMethod('');
    setAmountPaid('0');
    setClientPaneQuantities([]);
    setClientPaneTypePrices([]);
    setClientDisableRounding(false);
    setShowScopePicker(null);
    setClientBalance(0);
    setApplyCredit(false);
    setClientAddressPriceOverride(null);
    setClientAddresses([]);
    setSelectedAddressId('');
    setIncludeCcFee(false);
    setRateInputTexts({});
  };

  const handleCreateClient = async () => {
    if (!newClientName.trim()) {
      setError('Client name is required');
      return;
    }

    setSavingClient(true);
    setError('');

    try {
      const { data, error } = await supabase
        .from('clients')
        .insert({
          user_id: user?.id,
          organization_id: currentOrganization?.id,
          name: newClientName.trim(),
          email: newClientEmail.trim(),
          phone: newClientPhone.trim(),
          address: newClientAddress.trim(),
        })
        .select('id, name, email, phone')
        .single();

      if (error) throw error;

      setClients(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedClientId(data.id);
      setShowNewClientForm(false);
      setShowClientPicker(false);
      setNewClientName('');
      setNewClientEmail('');
      setNewClientPhone('');
      setNewClientAddress('');
    } catch (error: any) {
      setError(error.message || 'Failed to create client');
    } finally {
      setSavingClient(false);
    }
  };

  const handleCreateJobType = async () => {
    if (!newJobTypeName.trim()) {
      setError('Job type name is required');
      return;
    }
    if (!newJobTypeRate || Number(newJobTypeRate) <= 0) {
      setError('Valid rate is required');
      return;
    }
    if (newJobTypeUnit === 'custom' && !newJobTypeCustomUnit.trim()) {
      setError('Custom unit label is required');
      return;
    }

    setSavingJobType(true);
    setError('');

    if (!currentOrganization?.id) {
      setError('Organization not found');
      setSavingJobType(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('job_types')
        .insert({
          organization_id: currentOrganization.id,
          name: newJobTypeName.trim(),
          hourly_rate: Number(newJobTypeRate),
          unit_of_measure: newJobTypeUnit,
          custom_unit_label: newJobTypeUnit === 'custom' ? newJobTypeCustomUnit.trim() : null,
          is_flat_rate: newJobTypeIsFlatRate,
          is_active: true,
        })
        .select('id, name, hourly_rate, unit_of_measure, custom_unit_label, is_flat_rate')
        .single();

      if (error) throw error;

      setJobTypes(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));

      if (currentItemIndex !== null) {
        selectJobType(currentItemIndex, data);
      }

      setShowNewJobTypeForm(false);
      setShowJobTypePicker(null);
      setNewJobTypeName('');
      setNewJobTypeRate('');
      setNewJobTypeUnit('hour');
      setNewJobTypeCustomUnit('');
      setNewJobTypeIsFlatRate(false);
      setCurrentItemIndex(null);
    } catch (error: any) {
      setError(error.message || 'Failed to create job type');
    } finally {
      setSavingJobType(false);
    }
  };

  const handlePaymentTermsChange = (terms: string) => {
    setPaymentTerms(terms);
    if (terms !== 'custom' && issueDate) {
      setDueDate(calculateDueDate(issueDate, terms));
    }
    setShowPaymentTermsPicker(false);
  };

  const handleIssueDateChange = (date: string) => {
    setIssueDate(date);
    if (paymentTerms !== 'custom' && date) {
      setDueDate(calculateDueDate(date, paymentTerms));
    }
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const tax = subtotal * (Number(taxRate) / 100);
    const lateFee = (subtotal + tax) * (Number(lateFeePercentage) / 100);
    const baseTotal = subtotal + tax + lateFee;
    const roundedBase = clientDisableRounding ? baseTotal : roundPrice(baseTotal, businessSettings as PriceRoundingSettings | null);
    let ccFee = 0;
    if (includeCcFee && ccFeePercent > 0) {
      ccFee = roundedBase / (1 - ccFeePercent / 100) - roundedBase;
    }
    const total = roundedBase + ccFee;
    return { subtotal, taxAmount: tax, lateFee, ccFee, total };
  };

  useEffect(() => {
    if (dueDate && !invoice) {
      const isOverdue = new Date(dueDate) < new Date();
      if (isOverdue && paymentStatus !== 'paid') {
        const { subtotal, taxAmount } = calculateTotals();
        const calculatedLateFee = calculateLateFee(subtotal + taxAmount, new Date(dueDate));
        const percentage = subtotal + taxAmount > 0 ? (calculatedLateFee / (subtotal + taxAmount)) * 100 : 0;
        setLateFeePercentage(percentage.toFixed(2));
        setLateFeeAmount(calculatedLateFee);
      } else {
        setLateFeePercentage('0');
        setLateFeeAmount(0);
      }
    }
  }, [dueDate, paymentStatus, items, taxRate]);

  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    isDirtyRef.current = true;
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === 'quantity' || field === 'unit_price') {
      const qty = field === 'quantity' ? Number(value) : newItems[index].quantity;
      const price = field === 'unit_price' ? Number(value) : newItems[index].unit_price;
      newItems[index].total = Math.round(qty * price * 100) / 100;
    }
    setItems(newItems);
  };

  // Updates only the rate/total for a pane item without touching quantity or pane_details.
  const updateItemRate = (index: number, newUnitPrice: number) => {
    isDirtyRef.current = true;
    setItems(prev => {
      const arr = [...prev];
      const item = arr[index];
      const jobType = jobTypes.find(jt => jt.id === item.job_type_id);
      const scope = (item.service_scope as ServiceScope) || 'full_service';
      const total = computeItemTotal(item.quantity, newUnitPrice, item.pane_details ?? null, jobType, scope, item.job_type_id, selectedAddressId);
      arr[index] = { ...item, unit_price: newUnitPrice, total };
      return arr;
    });
  };

  const commitRateInput = (index: number) => {
    const raw = rateInputTexts[index];
    if (raw === undefined) return;
    const parsed = parseFloat(raw);
    const val = isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100;
    updateItem(index, 'unit_price', val);
    setRateInputTexts(prev => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  const commitTotalInput = (index: number) => {
    const raw = totalInputTexts[index];
    if (raw === undefined) return;
    const parsed = parseFloat(raw);
    const newTotal = isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100;
    setTotalInputTexts(prev => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
    const item = items[index];
    if (!item || item.quantity <= 0) return;
    const newRate = Math.round((newTotal / item.quantity) * 100) / 100;
    const jt = jobTypes.find(j => j.id === item.job_type_id);
    const scope = (item.service_scope as ServiceScope) || 'full_service';
    if (jt && isPaneJobType(jt) && scope === 'exterior_only') {
      const extPercent = getExteriorSplitForPaneType(jt, 'standard');
      const baseRate = extPercent > 0 ? Math.round((newRate / (extPercent / 100)) * 100) / 100 : newRate;
      updateItemRate(index, newRate);
      const primaryType = (item.pane_details ? (Object.keys(item.pane_details).find(k => k !== 'standard' && (item.pane_details![k] ?? 0) > 0) || 'standard') : 'standard') as any;
      setClientPaneTypePrices(prev => {
        const rest = prev.filter(p => !(p.job_type_id === jt.id && p.pane_type_key === primaryType && (p.address_id === (selectedAddressId || null) || p.address_id === null)));
        return [...rest, { job_type_id: jt.id, pane_type_key: primaryType, price_mode: 'per_pane' as const, price_per_pane: baseRate, flat_rate_amount: null, address_id: selectedAddressId || null }];
      });
    } else {
      updateItemRate(index, newRate);
      if (jt && isPaneJobType(jt)) {
        const primaryType = (item.pane_details ? (Object.keys(item.pane_details).find(k => k !== 'standard' && (item.pane_details![k] ?? 0) > 0) || 'standard') : 'standard') as any;
        setClientPaneTypePrices(prev => {
          const rest = prev.filter(p => !(p.job_type_id === jt.id && p.pane_type_key === primaryType && (p.address_id === (selectedAddressId || null) || p.address_id === null)));
          return [...rest, { job_type_id: jt.id, pane_type_key: primaryType, price_mode: 'per_pane' as const, price_per_pane: newRate, flat_rate_amount: null, address_id: selectedAddressId || null }];
      });
      }
    }
  };

  const getJobTypeUnitDisplay = (jobType: JobType | undefined): string => {
    if (!jobType) return '/hr';
    if (jobType.is_flat_rate) {
      return '/job';
    }
    if (jobType.unit_of_measure === 'custom') {
      return `/${jobType.custom_unit_label || 'unit'}`;
    }
    const unitMap: Record<string, string> = {
      hour: '/hr',
      sqft: '/sqft',
      linear_ft: '/ft',
      pane: '/pane',
      item: '/item',
      day: '/day',
      mile: '/mile',
    };
    return unitMap[jobType.unit_of_measure] || '/hr';
  };

  const getJobTypeQuantityLabel = (jobType: JobType | undefined): string => {
    if (!jobType) return 'Quantity';
    if (jobType.is_flat_rate) {
      return 'Qty';
    }
    if (jobType.unit_of_measure === 'custom') {
      return jobType.custom_unit_label || 'Quantity';
    }
    const labelMap: Record<string, string> = {
      hour: 'Hours',
      sqft: 'Square Feet',
      linear_ft: 'Linear Feet',
      pane: 'Panes',
      item: 'Items',
      day: 'Days',
      mile: 'Miles',
    };
    return labelMap[jobType.unit_of_measure] || 'Quantity';
  };

  const getScopeDescription = (scope: ServiceScope): string => {
    if (!businessSettings) return '';
    if (scope === 'full_service') return businessSettings.scope_description_full_service || '';
    if (scope === 'exterior_only') return businessSettings.scope_description_exterior_only || '';
    return '';
  };

  const buildDescription = (jobTypeName: string, scope: ServiceScope | undefined): string => {
    const scopeDesc = scope ? getScopeDescription(scope) : '';
    return scopeDesc ? `${jobTypeName} - ${scopeDesc}` : jobTypeName;
  };

  const getClientPaneDetails = (jobTypeId: string, addressId?: string | null): Record<string, number> | null => {
    const resolvedAddrId = addressId && addressId.trim() !== '' ? addressId : null;
    if (resolvedAddrId) {
      const addrMatch = clientPaneQuantities.find((q: any) => q.job_type_id === jobTypeId && q.address_id === resolvedAddrId);
      return addrMatch?.pane_details || null;
    }
    const match = clientPaneQuantities.find((q: any) => q.job_type_id === jobTypeId && !q.address_id);
    return match?.pane_details || null;
  };

  const computeItemTotal = (qty: number, unitPrice: number, paneDetails: Record<string, number> | null | undefined, jobType: JobType | undefined, scope: ServiceScope, jobTypeId?: string, addrId?: string | null): number => {
    if (paneDetails && jobType) {
      if (hasSplitPaneDetails(paneDetails)) {
        if (clientPaneTypePrices.length > 0 && jobTypeId) {
          return calculateSplitPaneTotalWithClientPrices(paneDetails, jobType, clientPaneTypePrices, jobTypeId, addrId, scope);
        }
        return calculateSplitPaneTotal(paneDetails, jobType, scope);
      }
      if (hasMixedPaneTypes(paneDetails)) {
        if (clientPaneTypePrices.length > 0 && jobTypeId) {
          return calculateMixedPaneTotalWithClientPrices(paneDetails, jobType, scope, clientPaneTypePrices, jobTypeId, addrId);
        }
        return calculateMixedPaneTotal(paneDetails, jobType, scope);
      }
    }
    return qty * unitPrice;
  };

  const selectJobType = (index: number, jobType: JobType) => {
    const newItems = [...items];
    const isPane = jobType.unit_of_measure === 'pane' && !jobType.is_flat_rate;
    const forcedScope: ServiceScope | null = jobType.scope_options === 'exterior_only' ? 'exterior_only' : null;
    const existingScope: ServiceScope = forcedScope || (newItems[index].service_scope as ServiceScope) || 'full_service';
    const clientPaneCount = isPane ? getClientPaneCount(clientPaneQuantities, jobType.id, selectedAddressId) : 0;
    const clientPaneDetailsData = isPane ? getClientPaneDetails(jobType.id, selectedAddressId) : null;
    const quantity = jobType.is_flat_rate
      ? 1
      : isPane
      ? clientPaneCount
      : newItems[index].quantity;

    const jobTypePriceOverride = jobTypePriceOverrides[jobType.id] ?? null;

    if (jobTypePriceOverride !== null) {
      const q = isPane ? clientPaneCount : (jobType.is_flat_rate ? 1 : newItems[index].quantity);
      newItems[index] = {
        ...newItems[index],
        job_type_id: jobType.id,
        description: buildDescription(jobType.name, isPane ? existingScope : undefined),
        quantity: q,
        unit_price: jobTypePriceOverride,
        total: q * jobTypePriceOverride,
        service_scope: isPane ? existingScope : undefined,
        pane_details: isPane ? clientPaneDetailsData : undefined,
      };
      setItems(newItems);
      setShowJobTypePicker(null);
      return;
    }

    if (isPane && clientAddressPriceOverride !== null) {
      newItems[index] = {
        ...newItems[index],
        job_type_id: jobType.id,
        description: buildDescription(jobType.name, existingScope),
        quantity: clientPaneCount,
        unit_price: clientAddressPriceOverride,
        total: clientPaneCount * clientAddressPriceOverride,
        service_scope: existingScope,
        pane_details: clientPaneDetailsData,
      };
      setItems(newItems);
      setShowJobTypePicker(null);
      return;
    }

    const effectivePrice = isPane
      ? (clientPaneTypePrices.length > 0
        ? getEffectivePanePriceWithClientOverride(jobType, 'standard', existingScope, clientPaneTypePrices, jobType.id, selectedAddressId).price
        : getEffectivePanePriceFromJobType(jobType, existingScope))
      : jobType.hourly_rate;
    const total = isPane
      ? computeItemTotal(quantity, effectivePrice, clientPaneDetailsData, jobType, existingScope, jobType.id, selectedAddressId)
      : quantity * effectivePrice;
    newItems[index] = {
      ...newItems[index],
      job_type_id: jobType.id,
      description: buildDescription(jobType.name, isPane ? existingScope : undefined),
      quantity,
      unit_price: effectivePrice,
      total,
      service_scope: isPane ? existingScope : undefined,
      pane_details: isPane ? clientPaneDetailsData : undefined,
    };
    setItems(newItems);
    setShowJobTypePicker(null);
  };

  const updateServiceScope = (index: number, scope: ServiceScope) => {
    const newItems = [...items];
    const item = newItems[index];
    const jobType = jobTypes.find(jt => jt.id === item.job_type_id);
    if (!jobType) return;
    const effectivePrice = isPaneJobType(jobType)
      ? (clientPaneTypePrices.length > 0
        ? getEffectivePanePriceWithClientOverride(jobType, 'standard', scope, clientPaneTypePrices, item.job_type_id!, selectedAddressId).price
        : getEffectivePanePriceFromJobType(jobType, scope))
      : jobType.hourly_rate;
    const total = computeItemTotal(item.quantity, effectivePrice, item.pane_details, jobType, scope, item.job_type_id, selectedAddressId);
    newItems[index] = {
      ...item,
      service_scope: scope,
      description: buildDescription(jobType.name, scope),
      unit_price: effectivePrice,
      total,
    };
    setItems(newItems);
    setShowScopePicker(null);
  };

  const isPaneJobType = (jt: JobType) => jt.unit_of_measure === 'pane' && !jt.is_flat_rate;

  const isWindowRelatedJobLocal = (jt: JobType) => {
    if (isPaneJobType(jt)) return true;
    return jt.name.toLowerCase().includes('window');
  };

  const isWindowCleaningCategory = (jt: JobType) =>
    jt.category_service_type === 'window_cleaning' || isWindowRelatedJobLocal(jt);

  const PANE_ADDONS = [
    { key: 'french', label: 'French Panes' },
    { key: 'storm', label: 'Storm Windows' },
    { key: 'skylights', label: 'Skylights' },
    { key: 'commercial', label: 'Commercial' },
  ];

  const updatePaneAddon = (itemIndex: number, paneKey: string, count: number) => {
    const jobTypeId = items[itemIndex]?.job_type_id;
    let savedTotalPanes = 0;
    let savedPaneDetails: Record<string, number> = {};
    setPaneAddonCounts(prev => {
      const itemAddons = { ...(prev[itemIndex] || {}) };
      if (count <= 0) {
        delete itemAddons[paneKey];
      } else {
        itemAddons[paneKey] = count;
      }
      const next = { ...prev, [itemIndex]: itemAddons };
      const standardQty = items[itemIndex]?.pane_details?.standard ?? items[itemIndex]?.quantity ?? 0;
      const addonTotal = Object.values(itemAddons).reduce((s, v) => s + v, 0);
      savedTotalPanes = standardQty + addonTotal;
      savedPaneDetails = { standard: standardQty, ...itemAddons };
      setItems(prev2 => {
        const arr = [...prev2];
        const item = arr[itemIndex];
        const jobType = jobTypes.find(jt => jt.id === item.job_type_id);
        const scope = (item.service_scope as ServiceScope) || 'full_service';
        const total = computeItemTotal(savedTotalPanes, item.unit_price, savedPaneDetails, jobType, scope, item.job_type_id, selectedAddressId);
        arr[itemIndex] = { ...item, pane_details: savedPaneDetails, quantity: savedTotalPanes, total };

        return arr;
      });
      return next;
    });
    const isCompanionPair = items[itemIndex]?.companion_item_index !== undefined && items[itemIndex]?.companion_item_index !== null;
    if (jobTypeId && !isCompanionPair) saveProfilePaneCount(jobTypeId, savedTotalPanes, savedPaneDetails);
  };

  const updateStandardPaneCount = (itemIndex: number, count: number) => {
    let jobTypeId: string | undefined;
    let totalPanes = count;
    let newPaneDetails: Record<string, number> = { standard: count };
    setItems(prev => {
      const arr = [...prev];
      const item = arr[itemIndex];
      const addons = paneAddonCounts[itemIndex] || {};
      const addonTotal = Object.values(addons).reduce((s, v) => s + v, 0);
      totalPanes = count + addonTotal;
      newPaneDetails = { standard: count, ...addons };
      jobTypeId = item.job_type_id;
      const jobType = jobTypes.find(jt => jt.id === item.job_type_id);
      const scope = (item.service_scope as ServiceScope) || 'full_service';
      const total = computeItemTotal(totalPanes, item.unit_price, newPaneDetails, jobType, scope, item.job_type_id, selectedAddressId);
      arr[itemIndex] = { ...item, quantity: totalPanes, pane_details: newPaneDetails, total };

      return arr;
    });
    const isCompanionPair = items[itemIndex]?.companion_item_index !== undefined && items[itemIndex]?.companion_item_index !== null;
    if (jobTypeId && !isCompanionPair) saveProfilePaneCount(jobTypeId, totalPanes, newPaneDetails);
  };

  const addItem = () => {
    setItems([...items, { description: '', quantity: 1, unit_price: 0, total: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const addCompanionItem = (index: number, companionScope: ServiceScope) => {
    const sourceItem = items[index];
    const jobType = jobTypes.find(jt => jt.id === sourceItem.job_type_id);
    if (!jobType) return;
    const companionPrice = getEffectivePanePriceForType(jobType, 'standard', companionScope);
    const companionItem: InvoiceItem = {
      job_type_id: sourceItem.job_type_id,
      description: buildDescription(jobType.name, companionScope),
      quantity: sourceItem.quantity,
      unit_price: companionPrice,
      total: sourceItem.quantity * companionPrice,
      service_scope: companionScope,
      pane_details: sourceItem.pane_details ? { ...sourceItem.pane_details } : null,
    };
    const newItems = [...items];
    newItems.splice(index + 1, 0, companionItem);
    newItems[index] = { ...newItems[index], companion_item_index: index + 1 };
    newItems[index + 1] = { ...newItems[index + 1], companion_item_index: index };
    setItems(newItems);
  };

  const removeCompanionItem = (index: number) => {
    const sourceItem = items[index];
    const companionIdx = sourceItem.companion_item_index;
    if (companionIdx === undefined || companionIdx === null) return;
    const newItems = items.filter((_, i) => i !== companionIdx);
    newItems.forEach(item => { item.companion_item_index = undefined; });
    setItems(newItems);
  };

  const resolvedScheduleEventId = scheduleEventIdProp || prefill?.scheduleEventId || null;

  const markJobCompleted = async (invoiceId: string) => {
    if (!resolvedScheduleEventId) return;
    await supabase
      .from('schedule_events')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        invoice_id: invoiceId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', resolvedScheduleEventId)
      .eq('status', 'scheduled');
  };

  const handleSave = async (sendVia?: 'email' | 'sms') => {
    if (!selectedClientId) {
      setError('Please select a client');
      return;
    }
    if (items.length === 0 || !items.some(item => item.description.trim() || item.job_type_id)) {
      setError('Please add at least one line item');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { subtotal, taxAmount, lateFee, ccFee, total } = calculateTotals();
      let invoiceId = invoice?.id;
      let invoiceNumber = invoice?.invoice_number;

      if (!invoice) {
        const { data: numData } = await supabase.rpc('generate_invoice_number');
        invoiceNumber = numData || `INV-${Date.now()}`;
      }

      const creditApplied = applyCredit && clientBalance > 0 ? Math.min(clientBalance, total) : 0;
      const baseAmountPaid = Number(amountPaid) || 0;
      const finalAmountPaid = baseAmountPaid + creditApplied;
      const finalPaymentStatus = finalAmountPaid >= total ? 'paid' : (finalAmountPaid > 0 ? 'partial' : paymentStatus);

      const invoiceData = {
        client_id: selectedClientId,
        invoice_number: invoiceNumber!,
        status: 'draft' as string,
        issue_date: issueDate,
        due_date: dueDate,
        payment_terms: paymentTerms,
        subtotal,
        tax_rate: Number(taxRate),
        tax_amount: taxAmount,
        late_fee_amount: lateFee,
        cc_fee_percent: includeCcFee ? ccFeePercent : 0,
        cc_fee_amount: ccFee,
        total,
        notes,
        memo: memo.trim() || null,
        service_address_id: selectedAddressId || null,
        sent_via: null as string | null,
        sent_at: null as string | null,
        payment_status: finalPaymentStatus,
        payment_method: paymentMethod || null,
        amount_paid: finalAmountPaid,
        paid_date: finalAmountPaid >= total ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      };

      if (invoice) {
        const { error } = await supabase
          .from('invoices')
          .update(invoiceData)
          .eq('id', invoice.id)
          .eq('user_id', user!.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('invoices')
          .insert({ ...invoiceData, user_id: user?.id })
          .select('id')
          .single();
        if (error) throw error;
        invoiceId = data.id;
      }

      if (invoice) {
        await supabase.from('invoice_items').delete().eq('invoice_id', invoice.id);
      }

      const itemsToInsert = items
        .filter(item => item.description.trim() || item.job_type_id)
        .map(item => ({
          invoice_id: invoiceId,
          job_type_id: item.job_type_id || null,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.total,
          pane_details: item.pane_details || null,
          service_scope: item.service_scope || null,
        }));

      if (itemsToInsert.length > 0) {
        const { error } = await supabase.from('invoice_items').insert(itemsToInsert);
        if (error) throw error;
      }

      if (creditApplied > 0) {
        await supabase
          .from('clients')
          .update({ account_balance: clientBalance - creditApplied })
          .eq('id', selectedClientId);
        setClientBalance(clientBalance - creditApplied);
        setApplyCredit(false);
      }

      if (selectedClientId && currentOrganization?.id) {
        const paneItems = items.filter(item => item.job_type_id && item.quantity > 0);
        const saveAddressId = selectedAddressId || null;
        for (const item of paneItems) {
          const jobType = jobTypes.find(jt => jt.id === item.job_type_id);
          if (!jobType || jobType.is_flat_rate || jobType.unit_of_measure !== 'pane') continue;
          // Skip companion-pair items — they share a job_type_id and would overwrite each other
          if (item.companion_item_index !== undefined && item.companion_item_index !== null) continue;
          let rowQuery = supabase
            .from('client_unit_quantities')
            .select('id')
            .eq('client_id', selectedClientId)
            .eq('job_type_id', item.job_type_id!);
          rowQuery = saveAddressId
            ? rowQuery.eq('address_id', saveAddressId)
            : rowQuery.is('address_id', null);
          const { data: row } = await rowQuery.maybeSingle();
          const normalizedForSave = normalizePaneDetails(item.pane_details, Number(item.quantity) || 0);
          if (row) {
            await supabase
              .from('client_unit_quantities')
              .update({ quantity: item.quantity, pane_details: normalizedForSave, updated_at: new Date().toISOString() })
              .eq('id', row.id);
          } else {
            await supabase
              .from('client_unit_quantities')
              .insert({
                client_id: selectedClientId,
                job_type_id: item.job_type_id,
                quantity: item.quantity,
                pane_details: normalizedForSave,
                organization_id: currentOrganization.id,
                address_id: saveAddressId,
              });
          }
        }
      }

      // Persist per-pane-type price overrides to client profile
      if (selectedClientId && currentOrganization?.id) {
        for (const pe of clientPaneTypePrices) {
          if (pe.price_per_pane == null && pe.flat_rate_amount == null) continue;
          await supabase.from('client_pane_type_prices').upsert({
            client_id: selectedClientId,
            organization_id: currentOrganization.id,
            job_type_id: pe.job_type_id,
            pane_type_key: pe.pane_type_key,
            price_mode: pe.price_mode,
            price_per_pane: pe.price_per_pane ?? null,
            flat_rate_amount: pe.flat_rate_amount ?? null,
            address_id: pe.address_id ?? null,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'organization_id,client_id,address_id,job_type_id,pane_type_key', ignoreDuplicates: false });
        }
      }

      if (sendVia === 'email') {
        try {
          const client = clients.find(c => c.id === selectedClientId);
          if (client?.email) {
            const emailChannel = businessSettings?.email_send_channel || 'native';

            if (emailChannel === 'native') {
              const memoOrNum = memo.trim() ? memo.trim() : `#${invoiceNumber}`;

              const hasCcFee = ccFeePercent > 0 && ccFee > 0;
              const baseTotal = hasCcFee ? total - ccFee : total;

              let nativeEmailPdfUrl: string | null = null;
              if (invoiceId && currentOrganization?.id) {
                try {
                  const pdfData: InvoicePDFData = {
                    invoice_number: invoiceNumber || 'NEW',
                    memo: memo.trim() || undefined,
                    issue_date: new Date(issueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                    due_date: new Date(dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                    client_name: client.name,
                    client_email: client.email || '',
                    client_phone: client.phone || '',
                    client_address: selectedAddressString,
                    business_name: businessSettings?.business_name || '',
                    business_address: businessSettings?.business_address || '',
                    business_phone: businessSettings?.business_phone || '',
                    business_email: businessSettings?.business_email || '',
                    logo_url: businessSettings?.logo_url || undefined,
                    items: items.filter(i => i.description.trim() || i.job_type_id).map(i => ({
                      description: i.description,
                      quantity: i.quantity,
                      unit_price: (i.unit_price || (i.quantity > 0 ? Math.round((i.total / i.quantity) * 100) / 100 : 0)),
                      total: i.total,
                      service_scope: i.service_scope || undefined,
                    })),
                    subtotal,
                    tax_rate: Number(taxRate),
                    tax_amount: taxAmount,
                    total,
                    notes: notes || '',
                    payment_terms: paymentTerms,
                    late_fee_amount: lateFee > 0 ? lateFee : undefined,
                    cc_fee_percent: includeCcFee ? ccFeePercent : undefined,
                    cc_fee_amount: ccFee > 0 ? ccFee : undefined,
                    show_cc_fee_notice: showCcFeeNotice && ccFeePercent > 0 ? true : undefined,
                    venmo_username: businessSettings?.venmo_username || undefined,
                    cashapp_username: businessSettings?.cashapp_username || undefined,
                    zelle_email: businessSettings?.zelle_email || undefined,
                    zelle_phone: businessSettings?.zelle_phone || undefined,
                    check_payable_to: businessSettings?.check_payable_to || undefined,
                    check_mailing_address: businessSettings?.check_mailing_address || undefined,
                    stripe_payment_link: businessSettings?.stripe_payment_link || undefined,
                  };
                  const { buildInvoicePDF } = await import('@/lib/webPdfBuilder');
                  const pdfDoc = await buildInvoicePDF(pdfData);
                  const pdfBlob = pdfDoc.output('blob');
                  const pdfBase64 = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      if (reader.result && typeof reader.result === 'string') {
                        resolve(reader.result.split(',')[1]);
                      } else {
                        reject(new Error('Failed to convert PDF to base64'));
                      }
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(pdfBlob);
                  });
                  const invLabel = memo.trim() || invoiceNumber || undefined;
                  nativeEmailPdfUrl = await uploadPdfAndGetUrl(pdfBase64, 'invoice', invoiceId, currentOrganization.id, invLabel);
                  if (nativeEmailPdfUrl) {
                    await supabase.from('invoices').update({ pdf_url: nativeEmailPdfUrl }).eq('id', invoiceId);
                  }
                } catch (e) {
                  console.error('PDF generation/upload for native email failed:', e);
                }
                if (!nativeEmailPdfUrl) {
                  try {
                    const invLabel = memo.trim() || invoiceNumber || undefined;
                    nativeEmailPdfUrl = await getOrCreateShortLink('invoice', invoiceId, currentOrganization.id, invLabel);
                  } catch (e) {
                    console.error('Short link fallback for native email failed:', e);
                  }
                }
              }

              const paymentLines = (() => {
                const lines: string[] = [];
                if (businessSettings?.venmo_username) {
                  const handle = businessSettings.venmo_username.replace(/^@/, '');
                  const invoiceRef = encodeURIComponent(`Invoice ${memoOrNum}`);
                  lines.push(`Pay with Venmo ($${baseTotal.toFixed(2)}): https://venmo.com/${handle}?txn=pay&amount=${baseTotal.toFixed(2)}&note=${invoiceRef}`);
                }
                if (businessSettings?.cashapp_username) {
                  const tag = businessSettings.cashapp_username.replace(/^\$/, '');
                  lines.push(`Pay with Cash App ($${baseTotal.toFixed(2)}): https://cash.app/$${tag}/${baseTotal.toFixed(2)}`);
                }
                if (businessSettings?.zelle_email || businessSettings?.zelle_phone) {
                  const zelleTarget = businessSettings.zelle_email || businessSettings.zelle_phone || '';
                  lines.push(`Pay with Zelle ($${baseTotal.toFixed(2)}): Send to ${zelleTarget} - Memo: Invoice ${memoOrNum}`);
                }
                if (businessSettings?.check_payable_to) {
                  const checkInfo = [`Make check payable to: ${businessSettings.check_payable_to}`, businessSettings.check_mailing_address ? `Mail to: ${businessSettings.check_mailing_address}` : ''].filter(Boolean).join(', ');
                  lines.push(`Pay by Check ($${baseTotal.toFixed(2)}): ${checkInfo}`);
                }
                if (businessSettings?.stripe_payment_link) {
                  lines.push(`Pay Online by Card ($${total.toFixed(2)}): ${businessSettings.stripe_payment_link}`);
                }
                return lines.length > 0 ? '\n\n' + lines.join('\n\n') : '';
              })();

              const emailSubject = `Invoice ${memoOrNum}`;
              const emailBody =
                `Hi ${client.name},\n\nPlease find your invoice ${memoOrNum} for ${baseTotal.toFixed(2)}.\n\nDue: ${dueDate ? new Date(dueDate).toLocaleDateString() : 'N/A'}${paymentLines}\n\nThank you!`;

              if (Platform.OS === 'web') {
                const pdfLine = nativeEmailPdfUrl ? `\n\nView PDF: ${nativeEmailPdfUrl}` : '';
                const mailtoUrl = `mailto:${client.email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody + pdfLine)}`;
                if (typeof window !== 'undefined' && window.location) {
                  window.location.href = mailtoUrl;
                } else {
                  await Linking.openURL(mailtoUrl);
                }
              } else {
                const pdfData: InvoicePDFData = {
                  invoice_number: invoiceNumber || 'NEW',
                  memo: memo.trim() || undefined,
                  issue_date: new Date(issueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                  due_date: new Date(dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                  client_name: client.name,
                  client_email: client.email || '',
                  client_phone: client.phone || '',
                  client_address: selectedAddressString,
                  business_name: businessSettings?.business_name || '',
                  business_address: businessSettings?.business_address || '',
                  business_phone: businessSettings?.business_phone || '',
                  business_email: businessSettings?.business_email || '',
                  logo_url: businessSettings?.logo_url || undefined,
                  items: items.filter(i => i.description.trim() || i.job_type_id).map(i => ({
                    description: i.description,
                    quantity: i.quantity,
                    unit_price: (i.unit_price || (i.quantity > 0 ? Math.round((i.total / i.quantity) * 100) / 100 : 0)),
                    total: i.total,
                    service_scope: i.service_scope || undefined,
                  })),
                  subtotal,
                  tax_rate: Number(taxRate),
                  tax_amount: taxAmount,
                  total,
                  notes: notes || '',
                  payment_terms: paymentTerms,
                  late_fee_amount: lateFee > 0 ? lateFee : undefined,
                  cc_fee_percent: includeCcFee ? ccFeePercent : undefined,
                  cc_fee_amount: ccFee > 0 ? ccFee : undefined,
                  show_cc_fee_notice: showCcFeeNotice && ccFeePercent > 0 ? true : undefined,
                  venmo_username: businessSettings?.venmo_username || undefined,
                  cashapp_username: businessSettings?.cashapp_username || undefined,
                  zelle_email: businessSettings?.zelle_email || undefined,
                  zelle_phone: businessSettings?.zelle_phone || undefined,
                  check_payable_to: businessSettings?.check_payable_to || undefined,
                  check_mailing_address: businessSettings?.check_mailing_address || undefined,
                  stripe_payment_link: businessSettings?.stripe_payment_link || undefined,
                };
                const shared = await PDFGenerator.shareInvoicePDF(pdfData);
                if (!shared) {
                  const mailtoUrl = `mailto:${client.email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
                  await Linking.openURL(mailtoUrl);
                }
              }

              await supabase
                .from('invoices')
                .update({ status: 'sent', sent_via: 'email', sent_at: new Date().toISOString() })
                .eq('id', invoiceId);
              await markJobCompleted(invoiceId!);
              showToast({ message: 'Invoice sent. Email app opened with PDF attached.', type: 'success', duration: 3000 });
            } else {
              let pdfBase64 = '';

              try {
                const pdfData: InvoicePDFData = {
                  invoice_number: invoiceNumber || 'NEW',
                  memo: memo.trim() || undefined,
                  issue_date: new Date(issueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                  due_date: new Date(dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                  client_name: client.name,
                  client_email: client.email || '',
                  client_phone: client.phone || '',
                  client_address: selectedAddressString,
                  business_name: businessSettings?.business_name || '',
                  business_address: businessSettings?.business_address || '',
                  business_phone: businessSettings?.business_phone || '',
                  business_email: businessSettings?.business_email || '',
                  logo_url: businessSettings?.logo_url || undefined,
                  items: items.filter(i => i.description.trim() || i.job_type_id).map(i => ({
                    description: i.description,
                    quantity: i.quantity,
                    unit_price: (i.unit_price || (i.quantity > 0 ? Math.round((i.total / i.quantity) * 100) / 100 : 0)),
                    total: i.total,
                  })),
                  subtotal,
                  tax_rate: Number(taxRate),
                  tax_amount: taxAmount,
                  total,
                  notes: notes || '',
                  payment_terms: paymentTerms,
                  late_fee_amount: lateFee > 0 ? lateFee : undefined,
                  cc_fee_percent: includeCcFee ? ccFeePercent : undefined,
                  cc_fee_amount: ccFee > 0 ? ccFee : undefined,
                  show_cc_fee_notice: showCcFeeNotice && ccFeePercent > 0 ? true : undefined,
                  venmo_username: businessSettings?.venmo_username || undefined,
                  cashapp_username: businessSettings?.cashapp_username || undefined,
                  zelle_email: businessSettings?.zelle_email || undefined,
                  zelle_phone: businessSettings?.zelle_phone || undefined,
                  check_payable_to: businessSettings?.check_payable_to || undefined,
                  check_mailing_address: businessSettings?.check_mailing_address || undefined,
                  stripe_payment_link: businessSettings?.stripe_payment_link || undefined,
                };

                const { buildInvoicePDF } = await import('@/lib/webPdfBuilder');
                const pdfDoc = await buildInvoicePDF(pdfData);
                const pdfBlob = pdfDoc.output('blob');
                const reader = new FileReader();

                await new Promise<void>((resolve, reject) => {
                  reader.onloadend = () => {
                    if (reader.result && typeof reader.result === 'string') {
                      pdfBase64 = reader.result.split(',')[1];
                      resolve();
                    } else {
                      reject(new Error('Failed to convert PDF to base64'));
                    }
                  };
                  reader.onerror = reject;
                  reader.readAsDataURL(pdfBlob);
                });
              } catch (pdfError) {
                console.error('PDF generation failed:', pdfError);
              }

              const { data: functionData, error: functionError } = await invokeFunction(
                'send-invoice-email',
                {
                  invoiceId,
                  clientEmail: client.email,
                  clientName: client.name,
                  memo: memo.trim() || undefined,
                  sendToSelf,
                  pdfBase64: pdfBase64 || undefined,
                }
              );

              if (!functionError && functionData?.success) {
                await supabase
                  .from('invoices')
                  .update({ status: 'sent', sent_via: 'email', sent_at: new Date().toISOString() })
                  .eq('id', invoiceId);
                await markJobCompleted(invoiceId!);
                showToast({
                  message: functionData.hasPdf ? 'Invoice sent successfully with PDF attachment' : 'Invoice sent successfully',
                  type: 'success',
                  duration: 3000
                });
              } else {
                const errorMsg = functionError?.message || functionData?.error || 'Email delivery failed';
                showToast({ message: `Invoice saved but email failed: ${errorMsg}`, type: 'error', duration: 5000 });
              }
            }
          } else {
            showToast({
              message: 'Invoice saved. No email address found for this client.',
              type: 'warning',
              duration: 4000
            });
          }
        } catch (emailError: any) {
          showToast({
            message: `Invoice saved but email failed: ${emailError?.message || 'Unknown error'}`,
            type: 'error',
            duration: 5000
          });
        }
      } else if (sendVia === 'sms') {
        try {
          const client = clients.find(c => c.id === selectedClientId);
          if (!client?.phone) {
            throw new Error('Client phone not found');
          }

          const chosenPhone = await pickPhone(client);
          if (!chosenPhone) return;

          const smsCcFee = ccFeePercent > 0 && ccFee > 0;
          const smsBaseTotal = smsCcFee ? total - ccFee : total;
          const invoiceTotal = smsBaseTotal.toFixed(2);
          const dueDateStr = dueDate ? new Date(dueDate).toLocaleDateString() : 'N/A';
          const memoRef = memo.trim() ? ` (${memo.trim()})` : ` #${invoiceNumber}`;


          let smsPdfBase64 = '';
          try {
            const pdfData: InvoicePDFData = {
              invoice_number: invoiceNumber || 'NEW',
              memo: memo.trim() || undefined,
              issue_date: new Date(issueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
              due_date: new Date(dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
              client_name: client.name,
              client_email: client.email || '',
              client_phone: client.phone || '',
              client_address: selectedAddressString,
              business_name: businessSettings?.business_name || '',
              business_address: businessSettings?.business_address || '',
              business_phone: businessSettings?.business_phone || '',
              business_email: businessSettings?.business_email || '',
              logo_url: businessSettings?.logo_url || undefined,
              items: items.filter(i => i.description.trim() || i.job_type_id).map(i => ({
                description: i.description,
                quantity: i.quantity,
                unit_price: (i.unit_price || (i.quantity > 0 ? Math.round((i.total / i.quantity) * 100) / 100 : 0)),
                total: i.total,
              })),
              subtotal,
              tax_rate: Number(taxRate),
              tax_amount: taxAmount,
              total,
              notes: notes || '',
              payment_terms: paymentTerms,
              late_fee_amount: lateFee > 0 ? lateFee : undefined,
              cc_fee_percent: includeCcFee ? ccFeePercent : undefined,
              cc_fee_amount: ccFee > 0 ? ccFee : undefined,
              show_cc_fee_notice: showCcFeeNotice && ccFeePercent > 0 ? true : undefined,
              venmo_username: businessSettings?.venmo_username || undefined,
              cashapp_username: businessSettings?.cashapp_username || undefined,
              zelle_email: businessSettings?.zelle_email || undefined,
              zelle_phone: businessSettings?.zelle_phone || undefined,
              check_payable_to: businessSettings?.check_payable_to || undefined,
              check_mailing_address: businessSettings?.check_mailing_address || undefined,
              stripe_payment_link: businessSettings?.stripe_payment_link || undefined,
            };
            const { buildInvoicePDF } = await import('@/lib/webPdfBuilder');
            const pdfDoc = await buildInvoicePDF(pdfData);
            const pdfBlob = pdfDoc.output('blob');
            const reader = new FileReader();
            await new Promise<void>((resolve, reject) => {
              reader.onloadend = () => {
                if (reader.result && typeof reader.result === 'string') {
                  smsPdfBase64 = reader.result.split(',')[1];
                  resolve();
                } else {
                  reject(new Error('Failed to convert PDF to base64'));
                }
              };
              reader.onerror = reject;
              reader.readAsDataURL(pdfBlob);
            });
          } catch (pdfErr) {
            console.error('PDF generation for SMS failed:', pdfErr);
          }

          let smsPdfUrl: string | null = null;
          if (invoiceId && currentOrganization?.id) {
            const smsInvLabel = memo.trim() || invoiceNumber || undefined;
            if (smsPdfBase64) {
              smsPdfUrl = await uploadPdfAndGetUrl(smsPdfBase64, 'invoice', invoiceId, currentOrganization.id, smsInvLabel);
              if (smsPdfUrl) {
                await supabase.from('invoices').update({ pdf_url: smsPdfUrl }).eq('id', invoiceId);
              }
            }
            if (!smsPdfUrl) {
              smsPdfUrl = await getOrCreateShortLink('invoice', invoiceId, currentOrganization.id, smsInvLabel);
            }
          }

          const smsPayLines = (() => {
            const lines: string[] = [];
            if (businessSettings?.venmo_username) {
              const handle = businessSettings.venmo_username.replace(/^@/, '');
              const invoiceRef = encodeURIComponent(`Invoice ${memo.trim() || `#${invoiceNumber}`}`);
              lines.push(`Venmo: https://venmo.com/${handle}?txn=pay&amount=${smsBaseTotal.toFixed(2)}&note=${invoiceRef}`);
            }
            if (businessSettings?.cashapp_username) {
              const tag = businessSettings.cashapp_username.replace(/^\$/, '');
              lines.push(`Cash App: https://cash.app/${tag}/${smsBaseTotal.toFixed(2)}`);
            }
            if (businessSettings?.zelle_email || businessSettings?.zelle_phone) {
              const zelleTarget = businessSettings.zelle_email || businessSettings.zelle_phone || '';
              lines.push(`Zelle: ${zelleTarget}`);
            }
            if (businessSettings?.check_payable_to) {
              const checkInfo = businessSettings.check_mailing_address
                ? `${businessSettings.check_payable_to}, ${businessSettings.check_mailing_address}`
                : businessSettings.check_payable_to;
              lines.push(`Check: ${checkInfo}`);
            }
            if (businessSettings?.stripe_payment_link) {
              const cardTotal = smsCcFee ? total.toFixed(2) : smsBaseTotal.toFixed(2);
              lines.push(`Card (${cardTotal}): ${businessSettings.stripe_payment_link}`);
            }
            return lines;
          })();
          const smsPdfLine = smsPdfUrl ? `\nPDF: ${smsPdfUrl}` : '';
          const message = `Hi ${client.name}, your invoice${memoRef} for ${invoiceTotal} is ready. Due: ${dueDateStr}.${smsPayLines.length > 0 ? '\n' + smsPayLines.join('\n') : ''}${smsPdfLine}`;

          const smsChannel = businessSettings?.sms_send_channel || 'native';

          if (smsChannel === 'native') {

            const phoneNumber = chosenPhone.replace(/\D/g, '');
            const smsUrl = Platform.OS === 'ios'
              ? `sms:${phoneNumber}&body=${encodeURIComponent(message)}`
              : `sms:${phoneNumber}?body=${encodeURIComponent(message)}`;

            const canOpen = await Linking.canOpenURL(smsUrl);
            if (canOpen) {
              await Linking.openURL(smsUrl);
              await supabase
                .from('invoices')
                .update({ status: 'sent', sent_via: 'sms', sent_at: new Date().toISOString() })
                .eq('id', invoiceId);
              await markJobCompleted(invoiceId!);
              showToast({ message: 'Invoice saved. SMS app opened.', type: 'success', duration: 3000 });
            } else {
              showToast({ message: 'Invoice saved but unable to open SMS app', type: 'warning', duration: 4000 });
            }
          } else {
            const { data: smsData, error: smsError } = await invokeFunction(
              'send-sms',
              {
                organization_id: currentOrganization?.id,
                to: chosenPhone,
                body: message,
              }
            );

            if (!smsError && smsData?.success) {
              await supabase
                .from('invoices')
                .update({ status: 'sent', sent_via: 'sms', sent_at: new Date().toISOString() })
                .eq('id', invoiceId);
              await markJobCompleted(invoiceId!);
              showToast({ message: 'Invoice sent via SMS', type: 'success', duration: 3000 });
            } else {
              const errorMsg = smsError?.message || smsData?.error || 'SMS delivery failed';
              showToast({ message: `Invoice saved but SMS failed: ${errorMsg}`, type: 'error', duration: 5000 });
            }
          }
        } catch (smsErr: any) {
          showToast({
            message: `Invoice saved but SMS failed: ${smsErr.message || 'Unknown error'}`,
            type: 'error',
            duration: 5000
          });
        }
      } else {
        if (finalPaymentStatus === 'paid' && selectedClient?.email) {
          try {
            await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/send-receipt-email`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
              },
              body: JSON.stringify({
                invoiceId: invoiceId,
                organizationId: currentOrganization?.id,
              }),
            });
            showToast({ message: 'Invoice saved and receipt sent to client', type: 'success' });
          } catch {
            showToast({ message: 'Invoice saved, but receipt email failed to send', type: 'warning', duration: 4000 });
          }
        } else {
          showToast({ message: 'Invoice saved', type: 'success' });
        }
      }

      isDirtyRef.current = false;
      resetForm();
      onSave();
    } catch (error: any) {
      setError(error.message || 'An error occurred');
    } finally {
      setLoading(false);
      setShowSendOptions(false);
    }
  };

  const { subtotal, taxAmount, lateFee, ccFee, total } = calculateTotals();
  const selectedClient = clients.find(c => c.id === selectedClientId);
  const selectedAddress = clientAddresses.find(a => a.id === selectedAddressId);
  const selectedAddressString = selectedAddress ? formatAddress(selectedAddress) : '';
  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
    client.email?.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
    client.phone?.toLowerCase().includes(clientSearchQuery.toLowerCase())
  );
  const dynamicStyles = getDynamicStyles(colors);
  const isOverdue = !!dueDate && new Date(dueDate) < new Date() && paymentStatus !== 'paid';

  const updateFloatingTotalVisibility = () => {
    const totalsBottom = totalsCardYRef.current + 80;
    const viewportBottom = scrollOffsetRef.current + scrollViewHeightRef.current;
    const isVisible = totalsCardYRef.current > 0 && viewportBottom >= totalsBottom;
    if (!isVisible && !showFloatingTotal) {
      setShowFloatingTotal(true);
      Animated.timing(floatingTotalOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    } else if (isVisible && showFloatingTotal) {
      Animated.timing(floatingTotalOpacity, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
        setShowFloatingTotal(false);
      });
    }
  };

  const handleInvoiceScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
    updateFloatingTotalVisibility();
  };

  const handleScrollViewLayout = (e: LayoutChangeEvent) => {
    scrollViewHeightRef.current = e.nativeEvent.layout.height;
  };

  const handleTotalsCardLayout = (e: LayoutChangeEvent) => {
    totalsCardYRef.current = e.nativeEvent.layout.y;
  };

  return (
    <>
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <View style={styles.overlay}>
          <View style={[styles.modal, { backgroundColor: colors.surface }]}>
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              <Text style={[styles.title, { color: colors.text }]}>
                {invoice ? 'Edit Invoice' : 'New Invoice'}
              </Text>
              <TouchableOpacity onPress={onClose} disabled={loading}>
                <X size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {error ? (
              <View style={[styles.errorContainer, { backgroundColor: colors.errorBackground }]}>
                <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
              </View>
            ) : null}

            <ScrollView style={styles.form} keyboardShouldPersistTaps="handled" onScroll={handleInvoiceScroll} scrollEventThrottle={16} onLayout={handleScrollViewLayout}>
              <CollapsibleField
                label="Client"
                fieldId="client"
                activeFieldId={activeFieldId}
                onToggle={toggleField}
                onOpen={() => setShowClientPicker(true)}
                displayValue={selectedClient?.name}
                required
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TouchableOpacity
                    style={[styles.picker, { backgroundColor: colors.inputBackground, borderColor: colors.border, flex: 1 }]}
                    onPress={() => setShowClientPicker(!showClientPicker)}
                    disabled={loading}
                  >
                    <Text style={[styles.pickerText, { color: selectedClient ? colors.text : colors.textSecondary }]}>
                      {selectedClient?.name || 'Select a client'}
                    </Text>
                  </TouchableOpacity>
                  {selectedClient && (
                    <TouchableOpacity
                      style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.primary + '14', borderWidth: 1, borderColor: colors.primary + '30' }}
                      onPress={() => setShowClientModal(true)}
                      activeOpacity={0.7}
                    >
                      <UserCog size={18} color={colors.primary} />
                    </TouchableOpacity>
                  )}
                </View>
                {showClientPicker && (
                  <View style={[styles.pickerList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={[styles.searchContainer, { borderBottomColor: colors.border }]}>
                      <Search size={18} color={colors.textSecondary} />
                      <TextInput
                        ref={clientSearchRef}
                        style={[styles.searchInput, { color: colors.text }]}
                        placeholder="Search clients..."
                        placeholderTextColor={colors.textSecondary}
                        value={clientSearchQuery}
                        onChangeText={setClientSearchQuery}
                      />
                    </View>
                    <ScrollView style={styles.pickerScrollView}>
                      <TouchableOpacity
                        style={[styles.pickerItem, styles.addClientItem, { borderBottomColor: colors.border, backgroundColor: colors.primaryLight }]}
                        onPress={() => {
                          setShowNewClientForm(true);
                          setShowClientPicker(false);
                          setClientSearchQuery('');
                          setTimeout(() => newClientNameRef.current?.focus(), 150);
                        }}
                      >
                        <UserPlus size={18} color={colors.primary} />
                        <Text style={[styles.pickerItemText, { color: colors.primary, fontWeight: '600' }]}>Add New Client</Text>
                      </TouchableOpacity>
                      {filteredClients.map(client => (
                        <TouchableOpacity
                          key={client.id}
                          style={[styles.pickerItem, { borderBottomColor: colors.border }]}
                          onPress={() => {
                            isDirtyRef.current = true;
                            setSelectedClientId(client.id);
                            setShowClientPicker(false);
                            setClientSearchQuery('');
                            setSelectedAddressId('');
                            setClientPaneQuantities([]);
                            setClientPaneTypePrices([]);
                            fetchClientBalance(client.id);
                            fetchClientAddressOverride(client.id);
                            fetchClientAddresses(client.id).then(resolvedAddressId => {
                              fetchClientPaneQuantities(client.id, resolvedAddressId || null);
                              fetchJobTypePriceOverrides(client.id, resolvedAddressId || undefined);
                            });
                            fetchClientRoundingSetting(client.id);
                            toggleField('client');
                          }}
                        >
                          <Text style={[styles.pickerItemText, { color: colors.text }]}>{client.name}</Text>
                          {client.email && (
                            <Text style={[styles.pickerItemSubtext, { color: colors.textSecondary }]}>{client.email}</Text>
                          )}
                        </TouchableOpacity>
                      ))}
                      {filteredClients.length === 0 && (
                        <View style={styles.emptyState}>
                          <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                            No clients found
                          </Text>
                        </View>
                      )}
                    </ScrollView>
                  </View>
                )}

                {showNewClientForm && (
                  <View style={[styles.newClientForm, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                    <Text style={[styles.newClientTitle, { color: colors.text }]}>New Client</Text>
                    <TextInput
                      ref={newClientNameRef}
                      style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                      value={newClientName}
                      onChangeText={setNewClientName}
                      placeholder="Client Name *"
                      placeholderTextColor={colors.textSecondary}
                      editable={!savingClient}
                    />
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                      value={newClientEmail}
                      onChangeText={setNewClientEmail}
                      placeholder="Email (optional)"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      editable={!savingClient}
                    />
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                      value={newClientPhone}
                      onChangeText={setNewClientPhone}
                      placeholder="Phone (optional)"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="phone-pad"
                      editable={!savingClient}
                    />
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                      value={newClientAddress}
                      onChangeText={setNewClientAddress}
                      placeholder="Address (optional)"
                      placeholderTextColor={colors.textSecondary}
                      editable={!savingClient}
                    />
                    <View style={styles.newClientButtons}>
                      <TouchableOpacity
                        style={[styles.newClientCancel, { borderColor: colors.border }]}
                        onPress={() => {
                          setShowNewClientForm(false);
                          setNewClientName('');
                          setNewClientEmail('');
                          setNewClientPhone('');
                          setNewClientAddress('');
                        }}
                        disabled={savingClient}
                      >
                        <Text style={[styles.newClientCancelText, { color: colors.textSecondary }]}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.newClientSave, savingClient && styles.buttonDisabled]}
                        onPress={handleCreateClient}
                        disabled={savingClient}
                      >
                        <LinearGradient
                          colors={['#1B4D6E', '#245d82']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.gradientPrimary}
                        >
                          {savingClient ? (
                            <ActivityIndicator color="#fff" size="small" />
                          ) : (
                            <Text style={styles.newClientSaveText}>Create Client</Text>
                          )}
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </CollapsibleField>

              {selectedClientId && (
                <CollapsibleField
                  label="Service Address"
                  fieldId="billingAddress"
                  activeFieldId={activeFieldId}
                  onToggle={toggleField}
                  displayValue={
                    selectedAddressId && clientAddresses.find(a => a.id === selectedAddressId)
                      ? formatAddress(clientAddresses.find(a => a.id === selectedAddressId)!)
                      : undefined
                  }
                >
                  {clientAddresses.map(addr => (
                    <TouchableOpacity
                      key={addr.id}
                      style={[
                        styles.picker,
                        {
                          backgroundColor: addr.id === selectedAddressId ? colors.primary + '14' : colors.inputBackground,
                          borderColor: addr.id === selectedAddressId ? colors.primary : colors.border,
                          marginBottom: 8,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 10,
                        },
                      ]}
                      onPress={() => {
                        setSelectedAddressId(addr.id);
                        fetchJobTypePriceOverrides(selectedClientId, addr.id);
                        toggleField('billingAddress');
                      }}
                    >
                      <MapPin size={16} color={addr.id === selectedAddressId ? colors.primary : colors.textSecondary} />
                      <View style={{ flex: 1 }}>
                        {addr.label ? (
                          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary, marginBottom: 2 }}>{addr.label}{addr.is_primary ? ' (Primary)' : ''}</Text>
                        ) : addr.is_primary ? (
                          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary, marginBottom: 2 }}>Primary</Text>
                        ) : null}
                        <Text style={{ fontSize: 14, color: colors.text }}>{formatAddress(addr)}</Text>
                      </View>
                      {addr.id === selectedAddressId && (
                        <Check size={18} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  ))}

                  {showNewAddressForm ? (
                    <View style={{ marginTop: 8, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.primary + '50', backgroundColor: colors.inputBackground }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 8 }}>New Address</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text, marginBottom: 8 }]}
                        value={newAddressLabel}
                        onChangeText={setNewAddressLabel}
                        placeholder="Label (e.g. Home, Office)"
                        placeholderTextColor={colors.textSecondary}
                      />
                      <AddressAutocomplete
                        value={newAddressData}
                        onChange={setNewAddressData}
                        organizationId={currentOrganization?.id || ''}
                        label="Street Address"
                      />
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                        <TouchableOpacity
                          style={{ flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: colors.primary, alignItems: 'center' }}
                          onPress={handleSaveNewAddress}
                          disabled={savingNewAddress || !newAddressData.street.trim()}
                        >
                          {savingNewAddress
                            ? <ActivityIndicator size="small" color="#fff" />
                            : <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>Save Address</Text>
                          }
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{ flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}
                          onPress={() => { setShowNewAddressForm(false); setNewAddressData(emptyAddressData); setNewAddressLabel(''); }}
                        >
                          <Text style={{ fontSize: 14, color: colors.textSecondary }}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 4, marginTop: 4 }}
                      onPress={() => setShowNewAddressForm(true)}
                    >
                      <Plus size={15} color={colors.primary} />
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary }}>Add new address</Text>
                    </TouchableOpacity>
                  )}
                </CollapsibleField>
              )}

              <CollapsibleField
                label="Dates"
                fieldId="dates"
                activeFieldId={activeFieldId}
                onToggle={toggleField}
                onOpen={() => setShowIssueDatePicker(true)}
                displayValue={issueDate ? `${issueDate} → ${dueDate || '—'}` : undefined}
                required
              >
                <View style={{ gap: 12 }}>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.smallLabel, { color: colors.textSecondary, marginBottom: 4 }]}>Created</Text>
                      <TouchableOpacity
                        style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                        onPress={() => {
                          if (!loading) {
                            setDatePickerInitialMode('scroll');
                            setShowIssueDatePicker(true);
                          }
                        }}
                        onLongPress={() => {
                          if (!loading) {
                            setDatePickerInitialMode('type');
                            setShowIssueDatePicker(true);
                          }
                        }}
                        delayLongPress={500}
                      >
                        <Text style={[{ color: issueDate ? colors.text : colors.textSecondary, fontSize: 15 }]}>
                          {issueDate ? new Date(issueDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Select'}
                        </Text>
                        <CalendarDays size={18} color={colors.textSecondary} />
                      </TouchableOpacity>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.smallLabel, { color: colors.textSecondary, marginBottom: 4 }]}>Due</Text>
                      <TouchableOpacity
                        style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                        onPress={() => {
                          if (!loading || paymentTerms === 'custom') {
                            setDatePickerInitialMode('scroll');
                            setShowDueDatePicker(true);
                          }
                        }}
                        onLongPress={() => {
                          if (!loading) {
                            setDatePickerInitialMode('type');
                            setShowDueDatePicker(true);
                          }
                        }}
                        delayLongPress={500}
                      >
                        <Text style={[{ color: dueDate ? colors.text : colors.textSecondary, fontSize: 15 }]}>
                          {dueDate ? new Date(dueDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Select'}
                        </Text>
                        <CalendarDays size={18} color={colors.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View>
                    <Text style={[styles.smallLabel, { color: colors.textSecondary, marginBottom: 4 }]}>Payment Terms</Text>
                    <TouchableOpacity
                      style={[styles.picker, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                      onPress={() => setShowPaymentTermsPicker(!showPaymentTermsPicker)}
                      disabled={loading}
                    >
                      <Text style={[styles.pickerText, { color: colors.text, fontSize: 14 }]}>
                        {paymentTerms === 'due_on_receipt' && 'Due on Receipt'}
                        {paymentTerms === 'net_15' && 'Net 15 Days'}
                        {paymentTerms === 'net_30' && 'Net 30 Days'}
                        {paymentTerms === 'net_60' && 'Net 60 Days'}
                        {paymentTerms === 'net_90' && 'Net 90 Days'}
                        {paymentTerms === 'net_3_months' && '3 Months'}
                        {paymentTerms === 'custom' && 'Custom'}
                      </Text>
                    </TouchableOpacity>
                    {showPaymentTermsPicker && (
                      <ScrollView style={[styles.pickerList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        {[
                          { value: 'due_on_receipt', label: 'Due on Receipt' },
                          { value: 'net_15', label: 'Net 15 Days' },
                          { value: 'net_30', label: 'Net 30 Days' },
                          { value: 'net_60', label: 'Net 60 Days' },
                          { value: 'net_90', label: 'Net 90 Days' },
                          { value: 'net_3_months', label: '3 Months' },
                          { value: 'custom', label: 'Custom' },
                        ].map(term => (
                          <TouchableOpacity
                            key={term.value}
                            style={[styles.pickerItem, { borderBottomColor: colors.border }]}
                            onPress={() => {
                              handlePaymentTermsChange(term.value);
                              setShowPaymentTermsPicker(false);
                            }}
                          >
                            <Text style={[styles.pickerItemText, { color: colors.text }]}>{term.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    )}
                  </View>
                </View>
              </CollapsibleField>

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Line Items</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => setShowEquipmentEditModal(true)}
                      disabled={loading}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#0369a1' + '12', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: '#0369a1' + '30' }}
                    >
                      <Wrench size={13} color="#0369a1" />
                      <Text style={{ fontSize: 11, fontWeight: '600', color: '#0369a1' }}>Equipment Type</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={addItem} disabled={loading}>
                      <Plus size={20} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                </View>

                {items.map((item, index) => (
                  <View key={`${selectedAddressId || 'no-addr'}-${index}`} style={[styles.itemCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                    <View style={styles.itemHeader}>
                      <Text style={[styles.smallLabel, { color: colors.textSecondary }]}>Line Item #{index + 1}</Text>
                      {items.length > 1 && (
                        <TouchableOpacity onPress={() => removeItem(index)}>
                          <Trash2 size={18} color={colors.error} />
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* ── JOB TYPE DROPDOWN (sorted by most used) ── */}
                    {(() => {
                      const selectedJt = jobTypes.find(j => j.id === item.job_type_id);
                      const isPickerOpen = showJobTypePicker === index;

                      if (loadingTypes) {
                        return (
                          <View style={{ marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <ActivityIndicator size="small" color={colors.primary} />
                            <Text style={{ fontSize: 13, color: colors.textSecondary }}>Loading job types...</Text>
                          </View>
                        );
                      }

                      if (jobTypes.length === 0) {
                        const handleSeed = async () => {
                          if (!currentOrganization?.id || seedingStarters) return;
                          try {
                            setSeedingStarters(true);
                            const result = await seedStarterJobTypes(currentOrganization.id);
                            await fetchJobTypes();
                            await fetchCategories();
                            showToast({
                              message: `Added ${result.categoriesCreated} categor${result.categoriesCreated === 1 ? 'y' : 'ies'} and ${result.jobTypesCreated} job types`,
                              type: 'success',
                              duration: 3000,
                            });
                          } catch (err: any) {
                            showToast({
                              message: err?.message || 'Failed to load starter job types',
                              type: 'error',
                              duration: 4000,
                            });
                          } finally {
                            setSeedingStarters(false);
                          }
                        };

                        return (
                          <View style={{
                            marginBottom: 12,
                            padding: 14,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: colors.border,
                            backgroundColor: colors.inputBackground,
                            gap: 10,
                          }}>
                            <Text style={{ fontSize: 13, color: colors.text, fontWeight: '600' }}>
                              No job types set up yet
                            </Text>
                            {currentOrganization?.name ? (
                              <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                                Organization: <Text style={{ fontWeight: '600', color: colors.text }}>{currentOrganization.name}</Text>
                              </Text>
                            ) : null}
                            <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 17 }}>
                              Tap below to load a starter pack of categories (Window Cleaning, Gutter Cleaning, Pressure Washing, Soft Washing, Christmas Lights) with common job types. You can edit or remove them later in Business Settings.
                            </Text>
                            <TouchableOpacity
                              onPress={handleSeed}
                              disabled={seedingStarters}
                              style={{
                                paddingVertical: 11,
                                paddingHorizontal: 14,
                                borderRadius: 10,
                                backgroundColor: colors.primary,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8,
                                opacity: seedingStarters ? 0.7 : 1,
                              }}
                            >
                              {seedingStarters ? (
                                <ActivityIndicator size="small" color="#fff" />
                              ) : (
                                <Plus size={16} color="#fff" />
                              )}
                              <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>
                                {seedingStarters ? 'Loading...' : 'Load Starter Categories & Job Types'}
                              </Text>
                            </TouchableOpacity>
                            <Text style={{ fontSize: 11, color: colors.textSecondary, textAlign: 'center' }}>
                              Or customize from scratch in Business Settings
                            </Text>
                          </View>
                        );
                      }

                      const sortedJobTypes = jobTypes.slice().sort((a, b) => {
                        const ua = jobTypeUsageCounts[a.id] || 0;
                        const ub = jobTypeUsageCounts[b.id] || 0;
                        if (ub !== ua) return ub - ua;
                        return a.name.localeCompare(b.name);
                      });

                      const filteredJobTypes = jobTypeSearchQuery.trim()
                        ? sortedJobTypes.filter(jt => jt.name.toLowerCase().includes(jobTypeSearchQuery.toLowerCase()))
                        : sortedJobTypes;

                      const catNameFor = (jt: JobType): string => {
                        if (!jt.category_id) return '';
                        const cat = categories.find(c => c.id === jt.category_id);
                        return cat?.name || '';
                      };

                      return (
                        <View style={{ marginBottom: 12 }}>
                          <TouchableOpacity
                            style={[styles.picker, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                            onPress={() => {
                              setServiceSheetIndex(index);
                              setShowServiceSheet(true);
                            }}
                          >
                            <Text style={[styles.pickerText, { color: selectedJt ? colors.text : colors.textSecondary }]}>
                              {selectedJt ? selectedJt.name : 'Service'}
                            </Text>
                            <ChevronDown size={20} color={colors.textSecondary} />
                          </TouchableOpacity>

                          {showNewJobTypeForm && currentItemIndex === index && (
                            <View style={[styles.newClientForm, { backgroundColor: colors.inputBackground, borderColor: colors.border, marginTop: 8 }]}>
                              <Text style={[styles.newClientTitle, { color: colors.text }]}>New Service Type</Text>
                              <TextInput
                                ref={newJobTypeNameRef}
                                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                                placeholder="Service name"
                                placeholderTextColor={colors.textSecondary}
                                value={newJobTypeName}
                                onChangeText={setNewJobTypeName}
                              />
                              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                                <TextInput
                                  style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text, flex: 1 }]}
                                  placeholder="Rate"
                                  placeholderTextColor={colors.textSecondary}
                                  value={newJobTypeRate}
                                  onChangeText={setNewJobTypeRate}
                                  keyboardType="numeric"
                                />
                                <View style={{ flexDirection: 'row', gap: 6, flex: 1 }}>
                                  {['hour', 'sqft', 'linear_ft', 'pane', 'item', 'day', 'flat'].map(u => (
                                    <TouchableOpacity
                                      key={u}
                                      onPress={() => { setNewJobTypeUnit(u); setNewJobTypeIsFlatRate(u === 'flat'); }}
                                      style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: newJobTypeUnit === u ? colors.primary : colors.border, backgroundColor: newJobTypeUnit === u ? colors.primary + '14' : colors.surface }}
                                    >
                                      <Text style={{ fontSize: 12, fontWeight: '600', color: newJobTypeUnit === u ? colors.primary : colors.textSecondary }}>{u === 'flat' ? 'flat' : u === 'linear_ft' ? 'ft' : u}</Text>
                                    </TouchableOpacity>
                                  ))}
                                </View>
                              </View>
                              <View style={[styles.newClientButtons, { marginTop: 12 }]}>
                                <TouchableOpacity
                                  style={{ flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}
                                  onPress={() => {
                                    setShowNewJobTypeForm(false);
                                    setNewJobTypeName('');
                                    setNewJobTypeRate('');
                                    setNewJobTypeUnit('hour');
                                    setNewJobTypeIsFlatRate(false);
                                    setCurrentItemIndex(null);
                                  }}
                                >
                                  <Text style={{ color: colors.textSecondary, fontSize: 15, fontWeight: '600' }}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}
                                  onPress={handleCreateJobType}
                                  disabled={savingJobType}
                                >
                                  {savingJobType ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                  ) : (
                                    <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Create</Text>
                                  )}
                                </TouchableOpacity>
                              </View>
                            </View>
                          )}
                        </View>
                      );
                    })()}


                    {/* ── JOB TYPE SPECIFIC PANEL ── */}
                    {item.job_type_id && (() => {
                      const jt = jobTypes.find(j => j.id === item.job_type_id);
                      if (!jt) return null;
                      const isWindowCleaning = isWindowCleaningCategory(jt);
                      const isPane = isPaneJobType(jt);
                      const addons = paneAddonCounts[index] || {};
                      const standardCount = isWindowCleaning ? (item.pane_details?.standard ?? item.quantity) : item.quantity;

                      if (isWindowCleaning) {
                        const scopeOptions = SERVICE_SCOPE_OPTIONS.filter(o => {
                          const so = jt.scope_options || 'both';
                          if (so === 'exterior_only') return o.value === 'exterior_only';
                          return true;
                        });
                        const so = jt.scope_options || 'both';
                        const defaultScope = so === 'exterior_only' ? 'exterior_only' : 'full_service';
                        const activeScope = item.service_scope || defaultScope;
                        const profileCount = isPane ? getClientPaneCount(clientPaneQuantities, jt.id) : 0;

                        return (
                          <View style={{ marginBottom: 12, padding: 12, borderRadius: 10, backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.border }}>
                            <View style={{ marginBottom: 10 }}>
                              {/* Label row */}
                              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                <View>
                                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>Standard Panes</Text>
                                  {profileCount > 0 && (
                                    <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>Client profile: {profileCount}</Text>
                                  )}
                                </View>
                              </View>
                              {/* Count row: editable total on left, −/+ on right */}
                              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                <TextInput
                                  style={{ fontSize: 28, fontWeight: '700', color: colors.primary, minWidth: 60, paddingVertical: 2, paddingHorizontal: 4, borderBottomWidth: 2, borderBottomColor: colors.primary }}
                                  value={directCountInputs[index] !== undefined ? directCountInputs[index] : String(standardCount)}
                                  onChangeText={v => {
                                    const cleaned = v.replace(/[^0-9]/g, '');
                                    setDirectCountInputs(prev => ({ ...prev, [index]: cleaned }));
                                  }}
                                  onBlur={() => {
                                    const raw = directCountInputs[index];
                                    if (raw !== undefined) {
                                      const parsed = parseInt(raw, 10);
                                      updateStandardPaneCount(index, isNaN(parsed) ? 0 : Math.max(0, parsed));
                                      setDirectCountInputs(prev => { const n = { ...prev }; delete n[index]; return n; });
                                    }
                                  }}
                                  keyboardType="number-pad"
                                  selectTextOnFocus
                                />
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                  <TouchableOpacity style={[styles.tallyBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => updateStandardPaneCount(index, Math.max(0, standardCount - 1))}>
                                    <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>−</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity style={[styles.tallyBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => updateStandardPaneCount(index, standardCount + 1)}>
                                    <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>+</Text>
                                  </TouchableOpacity>
                                </View>
                              </View>
                              {/* Add-by-amount row below */}
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                                <TextInput
                                  ref={(r: TextInput | null) => { tallyInputRefs.current[index] = r; }}
                                  style={[styles.tallyAddInput, { flex: 1, backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                                  value={tallyInputs[index] ?? ''}
                                  onChangeText={v => setTallyInputs(prev => ({ ...prev, [index]: v.replace(/[^0-9]/g, '') }))}
                                  keyboardType="number-pad"
                                  placeholder="Add amount"
                                  placeholderTextColor={colors.textSecondary}
                                  maxLength={4}
                                />
                                <TouchableOpacity
                                  style={[styles.tallyBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
                                  onPress={() => {
                                    const val = parseInt(tallyInputs[index] || '0', 10);
                                    if (val > 0) { updateStandardPaneCount(index, standardCount + val); setTallyInputs(prev => ({ ...prev, [index]: '' })); setTimeout(() => tallyInputRefs.current[index]?.focus(), 100); }
                                  }}
                                >
                                  <Plus size={16} color="#fff" />
                                </TouchableOpacity>
                              </View>
                              {/* Standard pane rate */}
                              {isPane && (() => {
                                const rateKey = `${index}_standard`;
                                const stdGlobalRate = getPriceForPaneType(jt, 'standard');
                                const stdClientEntry = clientPaneTypePrices.find(p => p.job_type_id === jt.id && p.pane_type_key === 'standard' && (p.address_id === (selectedAddressId || null) || p.address_id === null));
                                const stdHasCustom = stdClientEntry != null && stdClientEntry.price_per_pane != null;
                                const stdRateDisplay = rateInputTexts[rateKey] !== undefined ? rateInputTexts[rateKey] : (stdClientEntry?.price_per_pane != null ? String(stdClientEntry.price_per_pane) : '');
                                return (
                                  <View style={{ marginTop: 8 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                      <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary }}>Rate per Pane</Text>
                                      {stdHasCustom && (
                                        <TouchableOpacity onPress={() => {
                                          setClientPaneTypePrices(prev => prev.filter(p => !(p.job_type_id === jt.id && p.pane_type_key === 'standard')));
                                          setRateInputTexts(prev => { const n = { ...prev }; delete n[rateKey]; return n; });
                                          updateItemRate(index, getEffectivePanePriceForType(jt, 'standard', (item.service_scope as ServiceScope) || 'full_service'));
                                        }}>
                                          <Text style={{ fontSize: 11, color: colors.primary }}>Reset to default</Text>
                                        </TouchableOpacity>
                                      )}
                                    </View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, borderWidth: 1, borderColor: stdHasCustom ? colors.primary : colors.border, borderRadius: 6, backgroundColor: colors.inputBackground, paddingHorizontal: 6, paddingVertical: 3 }}>
                                        <Text style={{ fontSize: 12, color: colors.textSecondary, marginRight: 2 }}>$</Text>
                                        <TextInput
                                          style={{ flex: 1, fontSize: 13, fontWeight: '600', color: colors.text, paddingVertical: 0 }}
                                          value={stdRateDisplay}
                                          onChangeText={v => setRateInputTexts(prev => ({ ...prev, [rateKey]: v.replace(/[^0-9.]/g, '') }))}
                                          onBlur={() => {
                                            const raw = rateInputTexts[rateKey];
                                            if (raw === undefined) return;
                                            const parsed = parseFloat(raw);
                                            const newRate = isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100;
                                            setRateInputTexts(prev => { const n = { ...prev }; delete n[rateKey]; return n; });
                                            const scope = (item.service_scope as ServiceScope) || 'full_service';
                                            const effectiveRate = scope === 'exterior_only' ? newRate * (getExteriorSplitForPaneType(jt, 'standard') / 100) : newRate;
                                            updateItemRate(index, effectiveRate);
                                            setClientPaneTypePrices(prev => {
                                              const rest = prev.filter(p => !(p.job_type_id === jt.id && p.pane_type_key === 'standard' && (p.address_id === (selectedAddressId || null) || p.address_id === null)));
                                              return [...rest, { job_type_id: jt.id, pane_type_key: 'standard', price_mode: 'per_pane' as const, price_per_pane: newRate, flat_rate_amount: null, address_id: selectedAddressId || null }];
                                            });
                                          }}
                                          placeholder={stdGlobalRate > 0 ? stdGlobalRate.toFixed(2) : '0.00'}
                                          placeholderTextColor={colors.textSecondary}
                                          keyboardType="decimal-pad"
                                          editable={!loading}
                                        />
                                        <Text style={{ fontSize: 11, color: colors.textSecondary }}>/pane</Text>
                                      </View>
                                      {stdHasCustom && (
                                        <View style={{ paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, backgroundColor: colors.primary + '18' }}>
                                          <Text style={{ fontSize: 10, fontWeight: '700', color: colors.primary }}>Custom</Text>
                                        </View>
                                      )}
                                    </View>
                                    {!stdHasCustom && stdGlobalRate > 0 && (
                                      <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 3 }}>Default: ${stdGlobalRate.toFixed(2)}/pane</Text>
                                    )}
                                  </View>
                                );
                              })()}
                            </View>

                            <TouchableOpacity
                              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}
                              onPress={() => setShowAddonsByItem(prev => ({ ...prev, [index]: !prev[index] }))}
                            >
                              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>Additional Window Types</Text>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                {Object.keys(addons).length > 0 && (
                                  <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, backgroundColor: colors.primary + '18' }}>
                                    <Text style={{ fontSize: 10, fontWeight: '700', color: colors.primary }}>{Object.values(addons).reduce((s, v) => s + v, 0)}</Text>
                                  </View>
                                )}
                                <ChevronDown size={16} color={colors.textSecondary} style={{ transform: [{ rotate: showAddonsByItem[index] ? '180deg' : '0deg' }] }} />
                              </View>
                            </TouchableOpacity>
                            {showAddonsByItem[index] && PANE_ADDONS.map(addon => {
                              const checked = addon.key in addons;
                              const addonCount = addons[addon.key] || 0;
                              const addonDirect = addonDirectInputs[index]?.[addon.key];
                              const addonTally = addonTallyInputs[index]?.[addon.key] ?? '';
                              return (
                                <View key={addon.key} style={{ marginBottom: 6 }}>
                                  <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }} onPress={() => { if (checked) { updatePaneAddon(index, addon.key, 0); } else { updatePaneAddon(index, addon.key, 1); } }}>
                                    <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: checked ? colors.primary : colors.border, backgroundColor: checked ? colors.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                                      {checked && <Check size={12} color="#fff" />}
                                    </View>
                                    <Text style={{ fontSize: 13, color: colors.text }}>{addon.label}</Text>
                                  </TouchableOpacity>
                                  {checked && (
                                    <View style={{ marginTop: 6, marginLeft: 28 }}>
                                      {/* Count row */}
                                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <TextInput
                                          style={{ fontSize: 28, fontWeight: '700', color: colors.primary, minWidth: 60, paddingVertical: 2, paddingHorizontal: 4, borderBottomWidth: 2, borderBottomColor: colors.primary }}
                                          value={addonDirect !== undefined ? addonDirect : String(addonCount)}
                                          onChangeText={v => {
                                            const cleaned = v.replace(/[^0-9]/g, '');
                                            setAddonDirectInputs(prev => ({ ...prev, [index]: { ...prev[index], [addon.key]: cleaned } }));
                                          }}
                                          onBlur={() => {
                                            if (addonDirect !== undefined) {
                                              const parsed = parseInt(addonDirect, 10);
                                              updatePaneAddon(index, addon.key, isNaN(parsed) ? 1 : Math.max(1, parsed));
                                              setAddonDirectInputs(prev => { const n = { ...prev }; if (n[index]) { const ni = { ...n[index] }; delete ni[addon.key]; n[index] = ni; } return n; });
                                            }
                                          }}
                                          keyboardType="number-pad"
                                          selectTextOnFocus
                                        />
                                        <View style={{ flexDirection: 'row', gap: 8 }}>
                                          <TouchableOpacity style={[styles.tallyBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => updatePaneAddon(index, addon.key, Math.max(1, addonCount - 1))}>
                                            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>−</Text>
                                          </TouchableOpacity>
                                          <TouchableOpacity style={[styles.tallyBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => updatePaneAddon(index, addon.key, addonCount + 1)}>
                                            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>+</Text>
                                          </TouchableOpacity>
                                        </View>
                                      </View>
                                      {/* Tally row */}
                                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                                        <TextInput
                                          ref={(r: TextInput | null) => { if (!addonTallyInputRefs.current[index]) addonTallyInputRefs.current[index] = {}; addonTallyInputRefs.current[index][addon.key] = r; }}
                                          style={[styles.tallyAddInput, { flex: 1, backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                                          value={addonTally}
                                          onChangeText={v => setAddonTallyInputs(prev => ({ ...prev, [index]: { ...prev[index], [addon.key]: v.replace(/[^0-9]/g, '') } }))}
                                          keyboardType="number-pad"
                                          placeholder="Add amount"
                                          placeholderTextColor={colors.textSecondary}
                                          maxLength={4}
                                        />
                                        <TouchableOpacity
                                          style={[styles.tallyBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
                                          onPress={() => {
                                            const val = parseInt(addonTally || '0', 10);
                                            if (val > 0) {
                                              updatePaneAddon(index, addon.key, addonCount + val);
                                              setAddonTallyInputs(prev => ({ ...prev, [index]: { ...prev[index], [addon.key]: '' } }));
                                              setTimeout(() => addonTallyInputRefs.current[index]?.[addon.key]?.focus(), 100);
                                            }
                                          }}
                                        >
                                          <Plus size={16} color="#fff" />
                                        </TouchableOpacity>
                                      </View>
                                      {/* Per-addon-type rate input */}
                                      {isPane && (() => {
                                        const rateKey = `${index}_${addon.key}`;
                                        const addonGlobalRate = getPriceForPaneType(jt, addon.key as any);
                                        const addonClientEntry = clientPaneTypePrices.find(p => p.job_type_id === jt.id && p.pane_type_key === addon.key && (p.address_id === (selectedAddressId || null) || p.address_id === null));
                                        const addonHasCustom = addonClientEntry != null && addonClientEntry.price_per_pane != null;
                                        const addonRateDisplay = rateInputTexts[rateKey] !== undefined ? rateInputTexts[rateKey] : (addonClientEntry?.price_per_pane != null ? String(addonClientEntry.price_per_pane) : '');
                                        return (
                                          <View style={{ marginTop: 8 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                              <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary }}>Rate per Pane</Text>
                                              {addonHasCustom && (
                                                <TouchableOpacity onPress={() => {
                                                  setClientPaneTypePrices(prev => prev.filter(p => !(p.job_type_id === jt.id && p.pane_type_key === addon.key)));
                                                  setRateInputTexts(prev => { const n = { ...prev }; delete n[rateKey]; return n; });
                                                  updateItemRate(index, getEffectivePanePriceForType(jt, addon.key as any, (item.service_scope as ServiceScope) || 'full_service'));
                                                }}>
                                                  <Text style={{ fontSize: 11, color: colors.primary }}>Reset to default</Text>
                                                </TouchableOpacity>
                                              )}
                                            </View>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, borderWidth: 1, borderColor: addonHasCustom ? colors.primary : colors.border, borderRadius: 6, backgroundColor: colors.inputBackground, paddingHorizontal: 6, paddingVertical: 3 }}>
                                                <Text style={{ fontSize: 12, color: colors.textSecondary, marginRight: 2 }}>$</Text>
                                                <TextInput
                                                  style={{ flex: 1, fontSize: 13, fontWeight: '600', color: colors.text, paddingVertical: 0 }}
                                                  value={addonRateDisplay}
                                                  onChangeText={v => setRateInputTexts(prev => ({ ...prev, [rateKey]: v.replace(/[^0-9.]/g, '') }))}
                                                  onBlur={() => {
                                                    const raw = rateInputTexts[rateKey];
                                                    if (raw === undefined) return;
                                                    const parsed = parseFloat(raw);
                                                    const newRate = isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100;
                                                    setRateInputTexts(prev => { const n = { ...prev }; delete n[rateKey]; return n; });
                                                    const scope = (item.service_scope as ServiceScope) || 'full_service';
                                                    const effectiveRate = scope === 'exterior_only' ? newRate * (getExteriorSplitForPaneType(jt, addon.key as any) / 100) : newRate;
                                                    updateItemRate(index, effectiveRate);
                                                    setClientPaneTypePrices(prev => {
                                                      const rest = prev.filter(p => !(p.job_type_id === jt.id && p.pane_type_key === addon.key && (p.address_id === (selectedAddressId || null) || p.address_id === null)));
                                                      return [...rest, { job_type_id: jt.id, pane_type_key: addon.key, price_mode: 'per_pane' as const, price_per_pane: newRate, flat_rate_amount: null, address_id: selectedAddressId || null }];
                                                    });
                                                  }}
                                                  placeholder={addonGlobalRate > 0 ? addonGlobalRate.toFixed(2) : '0.00'}
                                                  placeholderTextColor={colors.textSecondary}
                                                  keyboardType="decimal-pad"
                                                  editable={!loading}
                                                />
                                                <Text style={{ fontSize: 11, color: colors.textSecondary }}>/pane</Text>
                                              </View>
                                              {addonHasCustom && (
                                                <View style={{ paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, backgroundColor: colors.primary + '18' }}>
                                                  <Text style={{ fontSize: 10, fontWeight: '700', color: colors.primary }}>Custom</Text>
                                                </View>
                                              )}
                                            </View>
                                            {!addonHasCustom && addonGlobalRate > 0 && (
                                              <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 3 }}>Default: ${addonGlobalRate.toFixed(2)}/pane</Text>
                                            )}
                                          </View>
                                        );
                                      })()}
                                    </View>
                                  )}
                                </View>
                              );
                            })}

                            <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
                              {item.pane_details && hasMixedPaneTypes(item.pane_details) && !hasSplitPaneDetails(item.pane_details) && (() => null)()}
                              {item.pane_details && !hasSplitPaneDetails(item.pane_details) && hasMixedPaneTypes(item.pane_details) && (() => {
                                const jt = jobTypes.find(j => j.id === item.job_type_id);
                                const scope = (item.service_scope as ServiceScope) || 'full_service';
                                const entries = Object.entries(item.pane_details).filter(([, v]) => v > 0);
                                const allSamePrice = jt ? !hasPerTypePricing(jt, item.pane_details) : true;
                                if (!allSamePrice && jt) {
                                  return (
                                    <View style={{ marginBottom: 8 }}>
                                      {entries.map(([paneType, count]) => {
                                        const price = getEffectivePanePriceForType(jt, paneType as any, scope);
                                        return (
                                          <View key={paneType} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                                            <Text style={{ fontSize: 12, color: colors.textSecondary, textTransform: 'capitalize' }}>{paneType} × {count} @ ${price.toFixed(2)}</Text>
                                            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text }}>${(count * price).toFixed(2)}</Text>
                                          </View>
                                        );
                                      })}
                                    </View>
                                  );
                                }
                                return null;
                              })()}
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>Total Panes</Text>
                                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.primary }}>{item.quantity}</Text>
                              </View>
                            </View>


                            {isPane && scopeOptions.length > 1 && (
                              <View style={{ marginTop: 10 }}>
                                <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>Service Scope</Text>
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                  {scopeOptions.map(opt => {
                                    const active = activeScope === opt.value;
                                    return (
                                      <TouchableOpacity key={opt.value} onPress={() => updateServiceScope(index, opt.value)} style={{ flex: 1, paddingVertical: 7, borderRadius: 20, alignItems: 'center', borderWidth: 1.5, borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary : colors.surface }}>
                                        <Text style={{ fontSize: 11, fontWeight: '600', color: active ? '#fff' : colors.textSecondary }}>{opt.label}</Text>
                                      </TouchableOpacity>
                                    );
                                  })}
                                </View>
                                {activeScope === 'exterior_only' && (
                                  <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 3 }}>Effective rate: ${item.unit_price.toFixed(2)}/pane</Text>
                                )}
                                {isPane && activeScope === 'full_service' && item.companion_item_index === undefined && (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
                                      <Text style={{ fontSize: 13, color: colors.text, fontWeight: '500' }}>Add Exterior Only line</Text>
                                      <Switch
                                        value={false}
                                        onValueChange={() => addCompanionItem(index, 'exterior_only')}
                                        trackColor={{ false: colors.border, true: colors.primary }}
                                        thumbColor="#fff"
                                      />
                                    </View>
                                )}
                                {isPane && item.companion_item_index !== undefined && (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
                                      <Text style={{ fontSize: 13, color: colors.text, fontWeight: '500' }}>Exterior Only line added</Text>
                                      <Switch
                                        value={true}
                                        onValueChange={() => removeCompanionItem(index)}
                                        trackColor={{ false: colors.border, true: colors.primary }}
                                        thumbColor="#fff"
                                      />
                                    </View>
                                )}
                              </View>
                            )}
                          </View>
                        );
                      }

                      return (
                        <View style={{ marginBottom: 12 }}>
                          <Text style={[styles.smallLabel, { color: colors.textSecondary, marginBottom: 6 }]}>{getJobTypeQuantityLabel(jt)}</Text>
                          <PaneCountStepper value={item.quantity} onChange={v => updateItem(index, 'quantity', v)} disabled={loading} />
                          {isPane && (() => {
                            const scopeOpts = SERVICE_SCOPE_OPTIONS.filter(o => {
                              const so = jt.scope_options || 'both';
                              if (so === 'exterior_only') return o.value === 'exterior_only';
                              return true;
                            });
                            if (scopeOpts.length <= 1) return null;
                            const so = jt.scope_options || 'both';
                            const ds = so === 'exterior_only' ? 'exterior_only' : 'full_service';
                            const as2 = item.service_scope || ds;
                            return (
                              <View style={{ marginTop: 8 }}>
                                <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>Service Scope</Text>
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                  {scopeOpts.map(opt => {
                                    const active = as2 === opt.value;
                                    return (
                                      <TouchableOpacity key={opt.value} onPress={() => updateServiceScope(index, opt.value)} style={{ flex: 1, paddingVertical: 7, borderRadius: 20, alignItems: 'center', borderWidth: 1.5, borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary : colors.inputBackground }}>
                                        <Text style={{ fontSize: 12, fontWeight: '600', color: active ? '#fff' : colors.textSecondary }}>{opt.label}</Text>
                                      </TouchableOpacity>
                                    );
                                  })}
                                </View>
                                {as2 === 'full_service' && item.companion_item_index === undefined && (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
                                      <Text style={{ fontSize: 13, color: colors.text, fontWeight: '500' }}>Add Exterior Only line</Text>
                                      <Switch
                                        value={false}
                                        onValueChange={() => addCompanionItem(index, 'exterior_only')}
                                        trackColor={{ false: colors.border, true: colors.primary }}
                                        thumbColor="#fff"
                                      />
                                    </View>
                                )}
                                {item.companion_item_index !== undefined && (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
                                      <Text style={{ fontSize: 13, color: colors.text, fontWeight: '500' }}>Exterior Only line added</Text>
                                      <Switch
                                        value={true}
                                        onValueChange={() => removeCompanionItem(index)}
                                        trackColor={{ false: colors.border, true: colors.primary }}
                                        thumbColor="#fff"
                                      />
                                    </View>
                                )}
                              </View>
                            );
                          })()}
                        </View>
                      );
                    })()}

                    {!item.job_type_id && (
                      <View style={{ marginBottom: 12 }}>
                        <Text style={[styles.smallLabel, { color: colors.textSecondary, marginBottom: 6 }]}>Quantity</Text>
                        <PaneCountStepper value={item.quantity} onChange={v => updateItem(index, 'quantity', v)} disabled={loading} />
                      </View>
                    )}

                    <TextInput
                      style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                      value={item.description}
                      onChangeText={v => updateItem(index, 'description', v)}
                      placeholder="Description"
                      placeholderTextColor={colors.textSecondary}
                      editable={!loading}
                    />
                    <View style={styles.itemRow}>
                      {(() => {
                        const jt = jobTypes.find(j => j.id === item.job_type_id);
                        const isPane = jt && jt.unit_of_measure === 'pane' && !jt.is_flat_rate;
                        if (isPane) return null;
                        return (
                          <View style={styles.itemField}>
                            <Text style={[styles.smallLabel, { color: colors.textSecondary }]}>Rate</Text>
                            <TextInput
                              style={[styles.smallInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                              value={rateInputTexts[index] !== undefined ? rateInputTexts[index] : String(item.unit_price)}
                              onChangeText={v => {
                                const cleaned = v.replace(/[^0-9.]/g, '');
                                setRateInputTexts(prev => ({ ...prev, [index]: cleaned }));
                              }}
                              onBlur={() => commitRateInput(index)}
                              keyboardType="decimal-pad"
                              editable={!loading}
                            />
                          </View>
                        );
                      })()}
                      <View style={styles.itemField}>
                        <Text style={[styles.smallLabel, { color: colors.textSecondary }]}>Total</Text>
                        {(() => {
                          const jt2 = jobTypes.find(j => j.id === item.job_type_id);
                          const isPane2 = jt2 && jt2.unit_of_measure === 'pane' && !jt2.is_flat_rate;
                          if (isPane2) {
                            return (
                              <TextInput
                                style={[styles.smallInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                                value={totalInputTexts[index] !== undefined ? totalInputTexts[index] : item.total.toFixed(2)}
                                onChangeText={v => {
                                  const cleaned = v.replace(/[^0-9.]/g, '');
                                  setTotalInputTexts(prev => ({ ...prev, [index]: cleaned }));
                                }}
                                onBlur={() => commitTotalInput(index)}
                                keyboardType="decimal-pad"
                                editable={!loading}
                              />
                            );
                          }
                          return (
                            <Text style={[styles.itemTotal, { color: colors.text }]}>${item.total.toFixed(2)}</Text>
                          );
                        })()}
                      </View>
                    </View>
                  </View>
                ))}

              <TouchableOpacity
                style={[styles.addItemBtn, { borderColor: colors.primary, backgroundColor: colors.primary + '10' }]}
                onPress={addItem}
                disabled={loading}
              >
                <Plus size={16} color={colors.primary} />
                <Text style={[styles.addItemBtnText, { color: colors.primary }]}>Add Line Item</Text>
              </TouchableOpacity>
              </View>

              <CollapsibleField
                label="Other"
                fieldId="other"
                activeFieldId={activeFieldId}
                onToggle={toggleField}
                onOpen={() => setTimeout(() => taxRateInputRef.current?.focus(), 150)}
                displayValue={Number(taxRate) > 0 ? `${taxRate}% tax` : notes ? (notes.length > 30 ? notes.substring(0, 30) + '...' : notes) : memo || undefined}
              >
                <View style={{ gap: 16 }}>
                  <View>
                    <Text style={[styles.smallLabel, { color: colors.textSecondary, marginBottom: 4 }]}>Tax Rate (%)</Text>
                    <View style={styles.taxInputRow}>
                      <TextInput
                        ref={taxRateInputRef}
                        style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text, flex: 1 }]}
                        value={taxRate}
                        onChangeText={setTaxRate}
                        placeholder="0"
                        keyboardType="decimal-pad"
                        placeholderTextColor={colors.textSecondary}
                        editable={!loading}
                      />
                      {businessSettings?.default_tax_rate > 0 && (
                        <TouchableOpacity
                          style={styles.taxQuickBtn}
                          onPress={() => setTaxRate(businessSettings.default_tax_rate.toString())}
                        >
                          <LinearGradient
                            colors={['#1B4D6E', '#245d82']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.gradientTaxQuick}
                          >
                            <Plus size={14} color="#fff" />
                          </LinearGradient>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  <View>
                    <View style={styles.labelRow}>
                      <Text style={[styles.smallLabel, { color: colors.textSecondary, marginBottom: 0 }]}>Notes</Text>
                      <AIAssistButton
                        type="invoice_summary"
                        context={{ items: items.map(i => ({ description: i.description, quantity: i.quantity })) }}
                        onGenerate={(text) => setNotes(text)}
                        disabled={loading}
                        compact
                      />
                    </View>
                    <TextInput
                      ref={notesInputRef}
                      style={[styles.input, styles.textArea, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                      value={notes}
                      onChangeText={setNotes}
                      placeholder="Additional notes..."
                      placeholderTextColor={colors.textSecondary}
                      multiline
                      numberOfLines={3}
                      editable={!loading}
                    />
                  </View>

                  <View>
                    <Text style={[styles.smallLabel, { color: colors.textSecondary, marginBottom: 4 }]}>Memo</Text>
                    <TextInput
                      ref={memoInputRef}
                      style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                      value={memo}
                      onChangeText={setMemo}
                      placeholder="e.g. Spring Cleaning – 123 Main St"
                      placeholderTextColor={colors.textSecondary}
                      editable={!loading}
                    />
                    <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 4 }}>
                      Replaces the invoice number on the PDF and in email subjects.
                    </Text>
                  </View>
                </View>
              </CollapsibleField>

              <View style={[styles.paidToggleCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <Check size={20} color={paymentStatus === 'paid' ? '#34C759' : colors.textSecondary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.paidToggleTitle, { color: colors.text }]}>
                      Already Paid
                    </Text>
                    <Text style={[styles.paidToggleSub, { color: colors.textSecondary }]}>
                      {paymentStatus === 'paid'
                        ? 'Marked as paid — a receipt will be sent to the client'
                        : 'Toggle on if payment was received outside the app'}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={paymentStatus === 'paid'}
                  onValueChange={(val) => {
                    if (val) {
                      setPaymentStatus('paid');
                      setAmountPaid(total.toFixed(2));
                      setPaymentMethod('other');
                    } else {
                      setPaymentStatus('draft');
                      setAmountPaid('0');
                      setPaymentMethod('');
                    }
                  }}
                  trackColor={{ false: '#ccc', true: '#34C759' }}
                  thumbColor="#fff"
                />
              </View>

              <View style={[styles.totalsCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]} onLayout={handleTotalsCardLayout}>
                <View style={styles.totalRow}>
                  <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Subtotal</Text>
                  <Text style={[styles.totalValue, { color: colors.text }]}>${subtotal.toFixed(2)}</Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Tax ({taxRate}%)</Text>
                  <Text style={[styles.totalValue, { color: colors.text }]}>${taxAmount.toFixed(2)}</Text>
                </View>
                {lateFee > 0 && (
                  <View style={styles.totalRow}>
                    <View style={styles.lateFeeLabel}>
                      <AlertCircle size={14} color="#1B4D6E" />
                      <Text style={[styles.totalLabel, { color: '#1B4D6E', marginLeft: 4 }]}>
                        Late Fee ({lateFeePercentage}%)
                      </Text>
                    </View>
                    <Text style={[styles.totalValue, { color: '#1B4D6E' }]}>${lateFee.toFixed(2)}</Text>
                  </View>
                )}
                {ccFeePercent > 0 && (
                  <TouchableOpacity
                    style={[styles.totalRow, { paddingVertical: 8 }]}
                    onPress={() => setIncludeCcFee(!includeCcFee)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={[styles.ccFeeCheckbox, includeCcFee && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                        {includeCcFee && <Check size={10} color="#fff" />}
                      </View>
                      <CreditCard size={14} color={includeCcFee ? colors.primary : colors.textSecondary} />
                      <Text style={[styles.totalLabel, { color: includeCcFee ? colors.primary : colors.textSecondary }]}>
                        CC Fee ({ccFeePercent}%)
                      </Text>
                    </View>
                    <Text style={[styles.totalValue, { color: includeCcFee ? colors.primary : colors.textSecondary }]}>
                      ${ccFee.toFixed(2)}
                    </Text>
                  </TouchableOpacity>
                )}
                <View style={[styles.totalRow, styles.grandTotalRow, { borderTopColor: colors.border }]}>
                  <Text style={[styles.grandTotalLabel, { color: colors.text }]}>Total</Text>
                  <Text style={[styles.grandTotalValue, { color: colors.primary }]}>${total.toFixed(2)}</Text>
                </View>
                {clientAddressPriceOverride !== null && (
                  <View style={styles.addressOverrideBadge}>
                    <DollarSign size={12} color="#1B4D6E" />
                    <Text style={styles.addressOverrideBadgeText}>
                      Flat rate from client address (${clientAddressPriceOverride.toFixed(2)})
                    </Text>
                  </View>
                )}
                {clientBalance > 0 && total > 0 && (
                  <TouchableOpacity
                    style={[styles.creditBanner, applyCredit && styles.creditBannerActive]}
                    onPress={() => setApplyCredit(!applyCredit)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.creditBannerLeft}>
                      <View style={[styles.creditCheckbox, applyCredit && styles.creditCheckboxChecked]}>
                        {applyCredit && <Check size={12} color="#fff" />}
                      </View>
                      <View>
                        <Text style={[styles.creditBannerTitle, applyCredit && { color: '#155724' }]}>
                          Apply account credit
                        </Text>
                        <Text style={[styles.creditBannerSub, applyCredit && { color: '#155724' }]}>
                          ${Math.min(clientBalance, total).toFixed(2)} of ${clientBalance.toFixed(2)} available
                        </Text>
                      </View>
                    </View>
                    {applyCredit && (
                      <Text style={styles.creditBannerAmount}>
                        -{`$${Math.min(clientBalance, total).toFixed(2)}`}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
                {isOverdue && paymentStatus !== 'paid' && (
                  <View style={[styles.overdueNotice, { backgroundColor: '#eaf2f8' }]}>
                    <AlertCircle size={16} color="#1B4D6E" />
                    <Text style={styles.overdueText}>
                      This invoice is overdue. Late fees have been applied.
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>

            {showFloatingTotal && (
              <Animated.View style={[styles.floatingTotalBar, { backgroundColor: colors.cardBackground, borderTopColor: colors.border, opacity: floatingTotalOpacity }]}>
                <Text style={[styles.floatingTotalLabel, { color: colors.text }]}>Total</Text>
                <Text style={[styles.floatingTotalValue, { color: colors.primary }]}>${total.toFixed(2)}</Text>
              </Animated.View>
            )}

            <View style={[styles.footer, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: colors.border }]}
                onPress={onClose}
                disabled={loading}
              >
                <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.previewButton, { borderColor: colors.primary }]}
                onPress={() => setShowPreview(true)}
                disabled={loading}
              >
                <Eye size={18} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, styles.saveButtonSolid, loading && styles.buttonDisabled]}
                onPress={() => handleSave()}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save Draft</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sendButton, loading && styles.buttonDisabled]}
                onPress={() => setShowSendOptions(true)}
                disabled={loading}
              >
                <LinearGradient
                  colors={['#2D8B57', '#34a065']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.gradientSend}
                >
                  <Send size={18} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <Modal visible={showSendOptions} transparent animationType="fade">
              <View style={styles.sendOverlay}>
                <View style={[styles.sendModal, { backgroundColor: colors.surface }]}>
                  <Text style={[styles.sendTitle, { color: colors.text }]}>Send Invoice</Text>
                  <Text style={[styles.sendSubtitle, { color: colors.textSecondary }]}>
                    {selectedClient ? `Send to ${selectedClient.name}` : 'Select how to send'}
                  </Text>
                  <TouchableOpacity
                    style={[styles.sendOption, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
                    onPress={() => handleSave('email')}
                    disabled={!selectedClient?.email}
                  >
                    <Mail size={24} color={selectedClient?.email ? colors.primary : colors.textSecondary} />
                    <View style={styles.sendOptionText}>
                      <Text style={[styles.sendOptionTitle, { color: selectedClient?.email ? colors.text : colors.textSecondary }]}>
                        Email
                      </Text>
                      <Text style={[styles.sendOptionDesc, { color: colors.textSecondary }]}>
                        {selectedClient?.email || 'No email on file'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.sendOption, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
                    onPress={() => handleSave('sms')}
                    disabled={!selectedClient?.phone}
                  >
                    <MessageSquare size={24} color={selectedClient?.phone ? colors.primary : colors.textSecondary} />
                    <View style={styles.sendOptionText}>
                      <Text style={[styles.sendOptionTitle, { color: selectedClient?.phone ? colors.text : colors.textSecondary }]}>
                        Text Message
                      </Text>
                      <Text style={[styles.sendOptionDesc, { color: colors.textSecondary }]}>
                        {selectedClient?.phone || 'No phone on file'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.sendSelfRow, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
                    onPress={() => setSendToSelf(!sendToSelf)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.sendSelfCheckbox, { borderColor: sendToSelf ? colors.primary : colors.border, backgroundColor: sendToSelf ? colors.primary : 'transparent' }]}>
                      {sendToSelf && <Check size={14} color="#fff" />}
                    </View>
                    <Text style={[styles.sendSelfLabel, { color: colors.text }]}>Send copy to myself</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.cancelSend, { borderColor: colors.border }]}
                    onPress={() => setShowSendOptions(false)}
                  >
                    <Text style={[styles.cancelSendText, { color: colors.textSecondary }]}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>

      <DatePicker
        visible={showIssueDatePicker}
        value={issueDate || new Date().toISOString().split('T')[0]}
        onConfirm={(d) => {
          handleIssueDateChange(d);
          setShowIssueDatePicker(false);
        }}
        onCancel={() => setShowIssueDatePicker(false)}
        title="Issue Date"
        initialMode={datePickerInitialMode}
      />

      <DatePicker
        visible={showDueDatePicker}
        value={dueDate || new Date().toISOString().split('T')[0]}
        onConfirm={(d) => {
          setDueDate(d);
          setShowDueDatePicker(false);
        }}
        onCancel={() => setShowDueDatePicker(false)}
        title="Due Date"
        initialMode={datePickerInitialMode}
      />

      {showClientModal && selectedClient && (
        <ClientModal
          visible={showClientModal}
          client={{
            id: selectedClient.id,
            name: selectedClient.name,
            email: selectedClient.email || '',
            phone: selectedClient.phone || '',
          } as any}
          onClose={() => setShowClientModal(false)}
          onSave={() => {
            setShowClientModal(false);
            fetchClients();
            if (selectedClientId) {
              fetchClientPaneQuantities(selectedClientId);
              fetchClientBalance(selectedClientId);
              fetchClientAddressOverride(selectedClientId);
              fetchClientAddresses(selectedClientId);
              fetchJobTypePriceOverrides(selectedClientId, selectedAddressId || undefined);
            }
            showToast({ message: 'Client updated', type: 'success' });
          }}
        />
      )}

      <InvoicePreviewModal
        visible={showPreview}
        invoice={showPreview ? {
          invoice_number: invoice?.invoice_number || 'NEW',
          issue_date: issueDate,
          due_date: dueDate,
          client_name: selectedClient?.name || '',
          client_email: selectedClient?.email || '',
          client_phone: selectedClient?.phone || '',
          client_address: selectedAddressString,
          items: items.filter(i => i.description.trim() || i.job_type_id).map(i => ({ ...i, unit_price: (i.unit_price || (i.quantity > 0 ? Math.round((i.total / i.quantity) * 100) / 100 : 0)) })),
          subtotal,
          tax_rate: Number(taxRate),
          tax_amount: taxAmount,
          total,
          notes,
          business_name: businessSettings?.business_name || '',
          business_address: businessSettings?.business_address || '',
          business_phone: businessSettings?.business_phone || '',
          business_email: businessSettings?.business_email || '',
          logo_url: businessSettings?.logo_url || undefined,
          late_fee_amount: lateFee > 0 ? lateFee : undefined,
          cc_fee_percent: includeCcFee ? ccFeePercent : undefined,
          cc_fee_amount: ccFee > 0 ? ccFee : undefined,
          show_cc_fee_notice: showCcFeeNotice && ccFeePercent > 0 ? true : undefined,
          payment_terms: paymentTerms,
          memo: memo.trim() || undefined,
        } : null}
        onClose={() => setShowPreview(false)}
        onSend={() => {
          setShowPreview(false);
          setShowSendOptions(true);
        }}
        onDownload={async () => {
          const success = await PDFGenerator.shareInvoicePDF({
            invoice_number: invoice?.invoice_number || 'NEW',
            memo: memo.trim() || undefined,
            issue_date: issueDate,
            due_date: dueDate,
            client_name: selectedClient?.name || '',
            client_email: selectedClient?.email || '',
            client_phone: selectedClient?.phone || '',
            client_address: selectedAddressString,
            items: items.filter(i => i.description.trim() || i.job_type_id).map(i => ({ ...i, unit_price: (i.unit_price || (i.quantity > 0 ? Math.round((i.total / i.quantity) * 100) / 100 : 0)) })),
            subtotal,
            tax_rate: Number(taxRate),
            tax_amount: taxAmount,
            total,
            notes,
            business_name: businessSettings?.business_name || '',
            business_address: businessSettings?.business_address || '',
            business_phone: businessSettings?.business_phone || '',
            business_email: businessSettings?.business_email || '',
            logo_url: businessSettings?.logo_url || undefined,
            late_fee_amount: lateFee > 0 ? lateFee : undefined,
            cc_fee_percent: includeCcFee ? ccFeePercent : undefined,
            cc_fee_amount: ccFee > 0 ? ccFee : undefined,
            show_cc_fee_notice: showCcFeeNotice && ccFeePercent > 0 ? true : undefined,
            payment_terms: paymentTerms,
            stripe_payment_link: businessSettings?.stripe_payment_link || undefined,
            venmo_username: businessSettings?.venmo_username || undefined,
            cashapp_username: businessSettings?.cashapp_username || undefined,
            zelle_email: businessSettings?.zelle_email || undefined,
            zelle_phone: businessSettings?.zelle_phone || undefined,
            check_payable_to: businessSettings?.check_payable_to || undefined,
            check_mailing_address: businessSettings?.check_mailing_address || undefined,
          });
          if (success) {
            showToast({ message: 'Invoice PDF ready', type: 'success' });
          }
        }}
      />
      <EquipmentEditModal
        visible={showEquipmentEditModal}
        onClose={() => setShowEquipmentEditModal(false)}
        equipmentId={null}
        onSaved={() => setShowEquipmentEditModal(false)}
      />

      {/* Service selection sheet */}
      <SelectionSheet
        visible={showServiceSheet}
        title="Select Service"
        subtitle="Choose a service for this line item"
        items={jobTypes.slice().sort((a, b) => {
          const ua = jobTypeUsageCounts[a.id] || 0;
          const ub = jobTypeUsageCounts[b.id] || 0;
          if (ub !== ua) return ub - ua;
          return a.name.localeCompare(b.name);
        }).map(jt => {
          const cat = categories.find(c => c.id === jt.category_id);
          const usageCount = jobTypeUsageCounts[jt.id] || 0;
          return {
            id: jt.id,
            label: jt.name,
            sublabel: cat?.name,
            badge: usageCount > 0 ? `${usageCount}x` : undefined,
          };
        })}
        selectedId={serviceSheetIndex !== null ? items[serviceSheetIndex]?.job_type_id : undefined}
        onDismiss={() => setShowServiceSheet(false)}
        onSelect={(id) => {
          const jt = jobTypes.find(j => j.id === id);
          if (jt && serviceSheetIndex !== null) {
            selectJobType(serviceSheetIndex, jt);
            setCurrentItemIndex(serviceSheetIndex);
          }
          setShowServiceSheet(false);
        }}
        searchPlaceholder="Search services..."
        showAddNew
        addNewLabel="Add New Service"
        onAddNew={() => {
          if (serviceSheetIndex !== null) {
            setShowNewJobTypeForm(true);
            setCurrentItemIndex(serviceSheetIndex);
            setTimeout(() => newJobTypeNameRef.current?.focus(), 150);
          }
        }}
      />

      {/* Phone picker sheet for secondary contact selection */}
      <Modal visible={phonePickerVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.phonePickerOverlay}
          activeOpacity={1}
          onPress={() => {
            phonePickerResolveRef.current?.(null);
            phonePickerResolveRef.current = null;
            setPhonePickerVisible(false);
          }}
        >
          <View style={[styles.phonePickerSheet, { backgroundColor: colors.card }]}>
            <Text style={[styles.phonePickerTitle, { color: colors.text }]}>Send To</Text>
            {phonePickerOptions.map((opt) => (
              <TouchableOpacity
                key={opt.phone}
                style={[styles.phonePickerOption, { borderColor: colors.border }]}
                onPress={() => {
                  phonePickerResolveRef.current?.(opt.phone);
                  phonePickerResolveRef.current = null;
                  setPhonePickerVisible(false);
                }}
              >
                <Text style={[styles.phonePickerOptionLabel, { color: colors.text }]}>{opt.label}</Text>
                <Text style={[styles.phonePickerOptionPhone, { color: colors.textSecondary }]}>{opt.phone}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.phonePickerCancel, { borderColor: colors.border }]}
              onPress={() => {
                phonePickerResolveRef.current?.(null);
                phonePickerResolveRef.current = null;
                setPhonePickerVisible(false);
              }}
            >
              <Text style={[styles.phonePickerCancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const getDynamicStyles = (colors: any) => StyleSheet.create({});


const styles = StyleSheet.create({
  container: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '95%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  title: { fontSize: 18, fontWeight: '700' },
  form: { padding: 20 },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  input: { borderRadius: 8, padding: 12, fontSize: 16, borderWidth: 1 },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  picker: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 8, padding: 12, borderWidth: 1 },
  pickerText: { fontSize: 16, lineHeight: 22 },
  pickerList: { marginTop: 8, borderRadius: 8, borderWidth: 1, maxHeight: 300 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderBottomWidth: 1 },
  searchInput: { flex: 1, fontSize: 16, padding: 0, margin: 0, borderWidth: 0, backgroundColor: 'transparent', ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) } as any,
  pickerScrollView: { maxHeight: 240 },
  pickerItem: { padding: 12, borderBottomWidth: 1 },
  pickerItemText: { fontSize: 16, lineHeight: 22 },
  pickerItemSubtext: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  emptyState: { padding: 24, alignItems: 'center' },
  emptyStateText: { fontSize: 14 },
  row: { flexDirection: 'row', gap: 12 },
  section: { marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '600' },
  itemCard: { borderRadius: 8, padding: 12, marginBottom: 12, borderWidth: 1 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  jobTypeButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1 },
  jobTypeButtonText: { fontSize: 12, fontWeight: '600' },
  itemRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  itemField: { flex: 1 },
  smallLabel: { fontSize: 12, marginBottom: 4 },
  smallInput: { borderRadius: 6, padding: 8, fontSize: 14, borderWidth: 1 },
  itemTotal: { fontSize: 16, fontWeight: '600', padding: 8 },
  totalsCard: { borderRadius: 12, padding: 16, marginTop: 8, borderWidth: 1 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  totalLabel: { fontSize: 14 },
  totalValue: { fontSize: 14, fontWeight: '500' },
  addItemBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 6, marginTop: 8, marginBottom: 4, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed' as const },
  addItemBtnText: { fontSize: 14, fontWeight: '600' as const },
  taxInputRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  taxQuickBtn: { width: 34, height: 34, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const, overflow: 'hidden' as const },
  grandTotalRow: { borderTopWidth: 1, paddingTop: 8, marginTop: 4, marginBottom: 0 },
  grandTotalLabel: { fontSize: 18, fontWeight: '700' },
  grandTotalValue: { fontSize: 20, fontWeight: '700' },
  lateFeeLabel: { flexDirection: 'row', alignItems: 'center' },
  ccFeeCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#999',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressOverrideBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#e8f0f6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  addressOverrideBadgeText: {
    fontSize: 12,
    color: '#1B4D6E',
    fontWeight: '600',
  },
  overdueNotice: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 8, marginTop: 12 },
  overdueText: { flex: 1, fontSize: 13, color: '#1B4D6E', fontWeight: '500' },
  creditBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f0faf4',
    borderWidth: 1,
    borderColor: '#c3e6cb',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  creditBannerActive: {
    backgroundColor: '#d4edda',
    borderColor: '#28a745',
  },
  creditBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  creditCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#28a745',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  creditCheckboxChecked: {
    backgroundColor: '#28a745',
    borderColor: '#28a745',
  },
  creditBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1a6e35',
  },
  creditBannerSub: {
    fontSize: 12,
    color: '#2d8a50',
    marginTop: 1,
  },
  creditBannerAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#155724',
  },
  paidToggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginTop: 8,
  },
  paidToggleTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  paidToggleSub: {
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },
  footer: { flexDirection: 'row', gap: 12, padding: 20, borderTopWidth: 1 },
  cancelButton: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, alignItems: 'center' },
  cancelButtonText: { fontSize: 16, fontWeight: '600' },
  saveButton: { flex: 1, borderRadius: 8, alignItems: 'center', overflow: 'hidden' },
  saveButtonSolid: { backgroundColor: '#1B4D6E', paddingVertical: 14, justifyContent: 'center' },
  saveButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  previewButton: { padding: 16, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  sendButton: { borderRadius: 8, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  buttonDisabled: { opacity: 0.6 },
  errorContainer: { padding: 12, marginHorizontal: 20, marginTop: 12, borderRadius: 8 },
  errorText: { fontSize: 14, textAlign: 'center' },
  sendOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  sendModal: { borderRadius: 16, padding: 24, width: '100%', maxWidth: 400 },
  sendTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  sendSubtitle: { fontSize: 14, marginBottom: 20 },
  sendOption: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 12, gap: 16 },
  sendOptionText: { flex: 1 },
  sendOptionTitle: { fontSize: 16, fontWeight: '600' },
  sendOptionDesc: { fontSize: 14, marginTop: 2 },
  cancelSend: { padding: 16, borderRadius: 8, borderWidth: 1, alignItems: 'center', marginTop: 8 },
  cancelSendText: { fontSize: 16, fontWeight: '600' },
  sendSelfRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 1, marginTop: 8, gap: 12 },
  sendSelfCheckbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  sendSelfLabel: { fontSize: 15, fontWeight: '500' },
  addClientItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  newClientForm: { marginTop: 12, padding: 16, borderRadius: 12, borderWidth: 1 },
  newClientTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  newClientButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  newClientCancel: { flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, alignItems: 'center' },
  newClientCancelText: { fontSize: 14, fontWeight: '600' },
  newClientSave: { flex: 1, borderRadius: 8, alignItems: 'center', overflow: 'hidden' },
  newClientSaveText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  unitPickerList: { marginTop: 8, borderRadius: 8, borderWidth: 1, maxHeight: 150 },
  unitPickerItem: { padding: 10, borderBottomWidth: 1 },
  tallyFullRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'nowrap', width: '100%' },
  tallyStackedControls: { flexDirection: 'column' as const, alignItems: 'flex-start' as const, gap: 6 },
  tallyStepperRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  tallyQuickAddRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  tallyBtn: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  tallyTotal: { width: 45, height: 36, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  tallyTotalText: { fontSize: 16, fontWeight: '700' },
  tallyAddInput: { minWidth: 44, borderRadius: 8, paddingHorizontal: 8, fontSize: 14, borderWidth: 1, height: 36 },
  tallyAddBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 36, borderRadius: 8, flexShrink: 0, overflow: 'hidden' },
  tallyAddBtnText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  gradientPrimary: { flex: 1, padding: 12, alignItems: 'center', justifyContent: 'center' },
  gradientTallyAdd: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 10, height: 36 },
  gradientTaxQuick: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  gradientSave: { flex: 1, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  gradientSend: { padding: 16, alignItems: 'center', justifyContent: 'center' },
  floatingTotalBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1 },
  floatingTotalLabel: { fontSize: 16, fontWeight: '700' },
  floatingTotalValue: { fontSize: 20, fontWeight: '700' },
  phonePickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  phonePickerSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32 },
  phonePickerTitle: { fontSize: 16, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  phonePickerOption: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 10 },
  phonePickerOptionLabel: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  phonePickerOptionPhone: { fontSize: 13 },
  phonePickerCancel: { padding: 14, borderRadius: 12, borderWidth: 1, alignItems: 'center', marginTop: 4 },
  phonePickerCancelText: { fontSize: 15, fontWeight: '600' },
});
