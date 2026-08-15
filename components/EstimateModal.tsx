import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Switch,
  Linking,
  Image,
  Animated,
  NativeScrollEvent,
  NativeSyntheticEvent,
  LayoutChangeEvent,
} from 'react-native';
import { X, ChevronDown, Plus, Minus, Trash2, Send, Mail, MessageSquare, UserPlus, Briefcase, Calendar, Copy, ChevronUp, Percent, DollarSign, PenTool, SquareCheck as CheckSquare, Check, Eye, Search, Images, MapPin, Receipt, FileText, UserCog, Wrench } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { supabase, invokeFunction } from '@/lib/supabase';
import DatePicker from '@/components/DatePicker';
import EstimatePreviewModal from './EstimatePreviewModal';
import AddressConfirmationModal from './AddressConfirmationModal';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { AddressData, buildFullAddress, emptyAddressData } from '@/lib/addressService';
import { LocationService } from '@/lib/locationService';
import { PDFGenerator } from '@/lib/pdfGenerator';
import type { EstimatePDFData } from '@/lib/pdfGenerator';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { roundPrice, PriceRoundingSettings } from '@/lib/utilities';
import { seedStarterJobTypes } from '@/lib/starterJobTypesService';
import InvoiceModal from './InvoiceModal';
import ScheduleModal from './ScheduleModal';
import ClientModal from './ClientModal';
import EquipmentEditModal from './EquipmentEditModal';
import AIAssistButton from './AIAssistButton';
import CollapsibleField from './CollapsibleField';
import { useCollapsibleForm } from '@/hooks/useCollapsibleForm';
import { getEffectivePanePrice, getEffectivePanePriceForType, getEffectivePanePriceFromJobType, getEffectivePanePriceWithClientOverride, getClientPaneCount, SERVICE_SCOPE_OPTIONS, PANE_TYPES, calculateMixedPaneTotal, calculateMixedPaneTotalWithClientPrices, hasMixedPaneTypes, hasPerTypePricing, getPriceForPaneType, hasSplitPaneDetails, calculateSplitPaneTotal, calculateSplitPaneTotalWithClientPrices, getPaneTypesFromSplitDetails, getExteriorSplitForPaneType, normalizePaneDetails } from '@/lib/panePricingService';
import type { ServiceScope, PaneType, ClientPaneTypePriceEntry } from '@/lib/panePricingService';
import { inferPaneDetailsFromDescription } from '@/lib/productionRateService';
import PaneCountStepper from '@/components/shared/PaneCountStepper';
import SelectionSheet from '@/components/shared/SelectionSheet';
import { useRegisterModal } from '@/contexts/ModalStackContext';
import { uploadPdfAndGetUrl } from '@/lib/pdfUploadService';

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  secondary_contact_name?: string | null;
  secondary_contact_phone?: string | null;
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
  interior_split_percent?: number | null;
  interior_split_percent_standard?: number | null;
  interior_split_percent_french?: number | null;
  interior_split_percent_storm?: number | null;
  price_per_pane_standard?: number | null;
  price_per_pane_french?: number | null;
  price_per_pane_storm?: number | null;
}

interface EstimateItem {
  id?: string;
  job_type_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  discount_percentage: number;
  is_optional: boolean;
  notes: string;
  display_order: number;
  total: number;
  service_scope?: ServiceScope;
  pane_type?: PaneType;
  pane_details?: Record<string, number> | null;
  companion_item_index?: number;
}

interface Estimate {
  id: string;
  client_id: string;
  estimate_number: string;
  memo?: string;
  status: string;
  issue_date: string;
  valid_until: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount_amount: number;
  discount_percentage: number;
  total: number;
  notes: string;
  sent_via?: string;
  sent_at?: string;
  validity_period?: string;
  requires_signature?: boolean;
  signed_at?: string;
  signature_data?: string;
  signed_by_name?: string;
  signed_by_email?: string;
  client_notes?: string;
}

export interface EstimatePrefillData {
  clientId: string;
  notes?: string;
  taxRate?: string;
}

interface EstimateModalProps {
  visible: boolean;
  estimate: Estimate | null;
  onClose: () => void;
  onSave: () => void;
  prefill?: EstimatePrefillData | null;
  autoOpenSend?: boolean;
}

export default function EstimateModal({ visible, estimate, onClose, onSave, prefill, autoOpenSend }: EstimateModalProps) {
  const isDirtyRef = useRef(false);
  useRegisterModal('estimate-modal', visible, onClose, () => isDirtyRef.current);
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
  const [validUntil, setValidUntil] = useState('');
  const [taxRate, setTaxRate] = useState('0');
  const [overallDiscountType, setOverallDiscountType] = useState<'amount' | 'percentage'>('amount');
  const [overallDiscountAmount, setOverallDiscountAmount] = useState('0');
  const [overallDiscountPercentage, setOverallDiscountPercentage] = useState('0');
  const [notes, setNotes] = useState('');
  const [memo, setMemo] = useState('');
  const [requiresSignature, setRequiresSignature] = useState(false);
  const [items, setItems] = useState<EstimateItem[]>([]);
  const [expandedItem, setExpandedItem] = useState<number | null>(null);
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
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientAddress, setNewClientAddress] = useState('');
  const [newClientAddressData, setNewClientAddressData] = useState<AddressData>(emptyAddressData);
  const [savingClient, setSavingClient] = useState(false);
  const [validityPeriod, setValidityPeriod] = useState('30_days');
  const [showValidityPeriodPicker, setShowValidityPeriodPicker] = useState(false);
  const [showNewJobTypeForm, setShowNewJobTypeForm] = useState(false);
  const [newJobTypeName, setNewJobTypeName] = useState('');
  const [newJobTypeRate, setNewJobTypeRate] = useState('');
  const [newJobTypeUnit, setNewJobTypeUnit] = useState('hour');
  const [newJobTypeCustomUnit, setNewJobTypeCustomUnit] = useState('');
  const [newJobTypeIsFlatRate, setNewJobTypeIsFlatRate] = useState(false);
  const [savingJobType, setSavingJobType] = useState(false);
  const [currentItemIndex, setCurrentItemIndex] = useState<number | null>(null);
  const [showIssueDatePicker, setShowIssueDatePicker] = useState(false);
  const [showValidUntilPicker, setShowValidUntilPicker] = useState(false);
  const [tallyInputs, setTallyInputs] = useState<Record<number, string>>({});
  const [directCountInputs, setDirectCountInputs] = useState<Record<number, string>>({});
  const [addonTallyInputs, setAddonTallyInputs] = useState<Record<number, Record<string, string>>>({});
  const [addonDirectInputs, setAddonDirectInputs] = useState<Record<number, Record<string, string>>>({});
  const [showAddonPicker, setShowAddonPicker] = useState<number | null>(null);
  const [unitPriceInputs, setUnitPriceInputs] = useState<Record<number, string>>({});
  const [totalInputTexts, setTotalInputTexts] = useState<Record<number, string>>({});
  const [clientPaneQuantities, setClientPaneQuantities] = useState<any[]>([]);
  const clientPaneQuantitiesRef = useRef<any[]>([]);
  const [clientPropertyQualities, setClientPropertyQualities] = useState<any[]>([]);
  const [clientPaneTypePrices, setClientPaneTypePrices] = useState<ClientPaneTypePriceEntry[]>([]);
  const [showScopePicker, setShowScopePicker] = useState<number | null>(null);
  const [showPaneTypePicker, setShowPaneTypePicker] = useState<number | null>(null);
  const [paneAddonCounts, setPaneAddonCounts] = useState<Record<number, Record<string, number>>>({});
  const [showPreview, setShowPreview] = useState(false);
  const [businessSettings, setBusinessSettings] = useState<any>(null);
  const [clientDisableRounding, setClientDisableRounding] = useState(false);
  const [locationChecked, setLocationChecked] = useState(false);
  const [detectedLocation, setDetectedLocation] = useState<{
    latitude: number;
    longitude: number;
    address: string;
  } | null>(null);
  const [showAddressConfirmation, setShowAddressConfirmation] = useState(false);
  const [clientAddresses, setClientAddresses] = useState<any[]>([]);
  const [selectedClientAddresses, setSelectedClientAddresses] = useState<any[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [newAddressData, setNewAddressData] = useState<AddressData>(emptyAddressData);
  const [newAddressLabel, setNewAddressLabel] = useState('');
  const [savingNewAddress, setSavingNewAddress] = useState(false);
  const [clientPhotos, setClientPhotos] = useState<{ id: string; photo_url: string; annotated_url?: string | null; caption?: string | null }[]>([]);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  const [showPhotoAttach, setShowPhotoAttach] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const fabAnim = useRef(new Animated.Value(0)).current;
  const fabRotation = useRef(new Animated.Value(0)).current;
  const [showFloatingTotal, setShowFloatingTotal] = useState(false);
  const [phonePickerVisible, setPhonePickerVisible] = useState(false);
  const [phonePickerOptions, setPhonePickerOptions] = useState<{ label: string; phone: string }[]>([]);
  const phonePickerResolveRef = useRef<((phone: string | null) => void) | null>(null);
  const scrollOffsetRef = useRef(0);
  const totalsCardYRef = useRef(0);
  const scrollViewHeightRef = useRef(0);
  const floatingTotalOpacity = useRef(new Animated.Value(0)).current;
  const { user } = useAuth();
  const { showToast } = useToast();
  const { colors } = useTheme();
  const { currentOrganization } = useOrganization();
  const { activeFieldId, toggleField } = useCollapsibleForm();

  const discountInputRef = useRef<TextInput>(null);
  const memoInputRef = useRef<TextInput>(null);
  const clientSearchRef = useRef<TextInput>(null);
  const newClientNameRef = useRef<TextInput>(null);
  const newJobTypeNameRef = useRef<TextInput>(null);
  const newJobTypeCustomUnitRef = useRef<TextInput>(null);
  const expandedDiscountRef = useRef<TextInput>(null);

  const calculateValidUntil = (issueDate: string, period: string): string => {
    if (!issueDate || period === 'custom') return issueDate;
    const date = new Date(issueDate);
    switch (period) {
      case '15_days':
        date.setDate(date.getDate() + 15);
        break;
      case '30_days':
        date.setDate(date.getDate() + 30);
        break;
      case '60_days':
        date.setDate(date.getDate() + 60);
        break;
      case '90_days':
        date.setDate(date.getDate() + 90);
        break;
      case '3_months':
        date.setMonth(date.getMonth() + 3);
        break;
      default:
        date.setDate(date.getDate() + 30);
    }
    return date.toISOString().split('T')[0];
  };

  useEffect(() => {
    if (visible) {
      fetchClients();
      fetchJobTypes();
      fetchCategories();
      fetchBusinessSettings();
      checkLocationAndAutofill();
      setShowNewJobTypeForm(false);
      setActiveCategoryByItem({});
    }
  }, [visible]);

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
    resetPaneItemsForAddress(clientPaneQuantities, selectedAddressId, clientPaneTypePrices);
  }, [selectedAddressId, clientPaneQuantities, clientPaneTypePrices]);

  useEffect(() => {
    isDirtyRef.current = false;
    if (estimate) {
      setSelectedClientId(estimate.client_id);
      setIssueDate(estimate.issue_date);
      setValidUntil(estimate.valid_until);
      setTaxRate(estimate.tax_rate.toString());
      setOverallDiscountAmount(estimate.discount_amount?.toString() || '0');
      setOverallDiscountPercentage(estimate.discount_percentage?.toString() || '0');
      setNotes(estimate.notes);
      setMemo(estimate.memo || '');
      setRequiresSignature(estimate.requires_signature || false);
      setValidityPeriod(estimate.validity_period || '30_days');
      const serviceAddressId: string | null = (estimate as any).service_address_id || null;
      if (serviceAddressId) {
        setSelectedAddressId(serviceAddressId);
      }
      // Run items and pane quantities in parallel, then apply quantities to items
      const addressIdForPanes = serviceAddressId;
      Promise.all([
        fetchEstimateItems(estimate.id),
        fetchClientPaneQuantities(estimate.client_id, null),
      ]).then(([loadedItems, quantities]) => {
        if (addressIdForPanes && quantities.length > 0 && loadedItems.length > 0) {
          // Apply pane counts to loaded items directly without relying on state timing
          const updated = loadedItems.map(item => {
            if (!item.job_type_id) return item;
            const jt = jobTypes.find(jt => jt.id === item.job_type_id);
            if (!jt || jt.unit_of_measure !== 'pane' || jt.is_flat_rate) return item;
            const addrMatch = quantities.find((q: any) => q.job_type_id === item.job_type_id && q.address_id === addressIdForPanes);
            const newQty = addrMatch ? Number(addrMatch.quantity) : 0;
            if (newQty > 0 && newQty !== item.quantity) {
              const baseTotal = newQty * item.unit_price;
              const discount = item.discount_percentage > 0
                ? baseTotal * (item.discount_percentage / 100)
                : item.discount_amount > 0 ? item.discount_amount : 0;
              return { ...item, quantity: newQty, total: Math.max(0, baseTotal - discount) };
            }
            return item;
          });
          setItems(updated);
        }
      });
      fetchClientPhotos(estimate.client_id);
      fetchSelectedClientAddresses(estimate.client_id, true);
      fetchClientRoundingSetting(estimate.client_id);
    } else if (prefill && visible) {
      resetForm();
      setSelectedClientId(prefill.clientId);
      if (prefill.notes) setNotes(prefill.notes);
      if (prefill.taxRate) setTaxRate(prefill.taxRate);
      fetchClientPhotos(prefill.clientId);
      fetchSelectedClientAddresses(prefill.clientId).then(resolvedAddressId => {
        fetchClientPaneQuantities(prefill.clientId, resolvedAddressId);
      });
      fetchClientRoundingSetting(prefill.clientId);
    } else {
      resetForm();
    }
  }, [estimate, visible, prefill]);

  const fetchClients = async () => {
    let query = supabase
      .from('clients')
      .select('id, name, email, phone, secondary_contact_name, secondary_contact_phone');
    if (currentOrganization?.id) {
      query = query.eq('organization_id', currentOrganization.id);
    } else {
      query = query.eq('user_id', user!.id);
    }
    const { data } = await query.order('name');
    setClients(data || []);
  };

  const pickPhone = (client: Client): Promise<string | null> => {
    if (!client.secondary_contact_phone) return Promise.resolve(client.phone);
    return new Promise(resolve => {
      phonePickerResolveRef.current = resolve;
      setPhonePickerOptions([
        { label: `${client.name} (Primary)`, phone: client.phone },
        { label: client.secondary_contact_name || 'Secondary Contact', phone: client.secondary_contact_phone! },
      ]);
      setPhonePickerVisible(true);
    });
  };

  const fetchJobTypes = async () => {
    setLoadingTypes(true);
    let jtQuery = supabase
      .from('job_types')
      .select('id, name, hourly_rate, unit_of_measure, custom_unit_label, is_flat_rate, category_id, scope_options, exterior_split_percent, exterior_split_percent_standard, exterior_split_percent_french, exterior_split_percent_storm, interior_split_percent, interior_split_percent_standard, interior_split_percent_french, interior_split_percent_storm, price_per_pane_standard, price_per_pane_french, price_per_pane_storm, job_type_categories(service_type)')
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
    if (jtResult.error) console.error('[EstimateModal] fetch job_types error:', jtResult.error);
    if (catResult.error) console.error('[EstimateModal] fetch job_type_categories error:', catResult.error);
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
      .from('estimate_items')
      .select('job_type_id, job_types!inner(category_id, organization_id)')
      .eq('job_types.organization_id', currentOrganization.id)
      .not('job_type_id', 'is', null)
      .limit(5000);
    if (error) {
      console.error('[EstimateModal] fetch usage counts error:', error);
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
    const { data } = await supabase
      .from('job_type_categories')
      .select('id, name, color, service_type')
      .order('sort_order');
    setCategories(data || []);
  };

  const fetchClientRoundingSetting = async (clientId: string) => {
    const { data } = await supabase
      .from('clients')
      .select('disable_rounding')
      .eq('id', clientId)
      .maybeSingle();
    setClientDisableRounding((data as any)?.disable_rounding ?? false);
  };

  const fetchClientPaneQuantities = async (clientId: string, addressId?: string | null): Promise<any[]> => {
    const { data } = await supabase
      .from('client_unit_quantities')
      .select('job_type_id, quantity, pane_details, address_id')
      .eq('client_id', clientId);
    const quantities = (data || []).map((q: any) => ({
      ...q,
      pane_details: normalizePaneDetails(q.pane_details, Number(q.quantity) || 0),
    }));
    clientPaneQuantitiesRef.current = quantities;
    setClientPaneQuantities(quantities);
    const { data: pqData } = await supabase
      .from('client_property_qualities')
      .select('id, label, unit_type, custom_unit_label, quantity, tally, address_id')
      .eq('client_id', clientId)
      .order('sort_order', { ascending: true });
    setClientPropertyQualities(pqData || []);
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
    if (addressId) {
      resetPaneItemsForAddress(quantities, addressId, mappedPrices);
    }
    return quantities;
  };

  const resetPaneItemsForAddress = (paneQuantities: any[], addressId: string, paneTypePricesOverride?: any[]) => {
    const pricesForLookup = paneTypePricesOverride ?? clientPaneTypePrices;
    const newAddonCounts: Record<number, Record<string, number>> = {};
    setItems(prev => prev.map((item, index) => {
      if (!item.job_type_id) return item;
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
      const addonEntries = Object.fromEntries(Object.entries(newPaneDetails).filter(([k]) => k !== 'standard'));
      if (Object.keys(addonEntries).length > 0) {
        newAddonCounts[index] = addonEntries;
      }
      const primaryKey = Object.keys(newPaneDetails).find(k => k !== 'standard' && newPaneDetails[k] > 0) || 'standard';
      const scope = (item.service_scope as ServiceScope) || 'full_service';
      const newUnitPrice = pricesForLookup.length > 0
        ? getEffectivePanePriceWithClientOverride(jobType, primaryKey as any, scope, pricesForLookup, item.job_type_id, addressId).price
        : getEffectivePanePriceForType(jobType, primaryKey as any, scope);
      const updated = {
        ...item,
        quantity: dbQty,
        pane_details: newPaneDetails,
        pane_type: primaryKey,
        unit_price: newUnitPrice,
      };
      updated.total = calculateItemTotalInternal(updated, addressId, pricesForLookup);
      return updated;
    }));
    setPaneAddonCounts(newAddonCounts);
  };

  const calculateItemTotalInternal = (item: EstimateItem, addressIdOverride: string | null, pricesForLookup: any[]): number => {
    let baseTotal = item.quantity * item.unit_price;
    if (item.pane_details && item.job_type_id) {
      const jt = jobTypes.find(j => j.id === item.job_type_id);
      if (jt && isPaneJobType(jt)) {
        if (hasSplitPaneDetails(item.pane_details)) {
          const splitScope = (item.service_scope as ServiceScope) || 'full_service';
          baseTotal = pricesForLookup.length > 0
            ? calculateSplitPaneTotalWithClientPrices(item.pane_details, jt, pricesForLookup, item.job_type_id, addressIdOverride, splitScope)
            : calculateSplitPaneTotal(item.pane_details, jt, splitScope);
        } else if (hasMixedPaneTypes(item.pane_details)) {
          const scope = (item.service_scope as ServiceScope) || 'full_service';
          baseTotal = pricesForLookup.length > 0
            ? calculateMixedPaneTotalWithClientPrices(item.pane_details, jt, scope, pricesForLookup, item.job_type_id, addressIdOverride)
            : calculateMixedPaneTotal(item.pane_details, jt, scope);
        }
      }
    }
    let discount = 0;
    if (item.discount_percentage > 0) {
      discount = baseTotal * (item.discount_percentage / 100);
    } else if (item.discount_amount > 0) {
      discount = item.discount_amount;
    }
    return Math.max(0, baseTotal - discount);
  };

  const fetchSelectedClientAddresses = async (clientId: string, preserveCurrentAddress?: boolean): Promise<string | null> => {
    if (!currentOrganization?.id) return null;
    const { data } = await supabase
      .from('client_addresses')
      .select('id, label, address, is_primary')
      .eq('client_id', clientId)
      .eq('organization_id', currentOrganization.id)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true });
    const addrs = data || [];
    setSelectedClientAddresses(addrs);
    if (addrs.length > 0) {
      const primary = addrs.find((a: any) => a.is_primary) || addrs[0];
      if (!preserveCurrentAddress) {
        setSelectedAddressId(primary.id);
      }
      return primary.id;
    } else {
      if (!preserveCurrentAddress) {
        setSelectedAddressId(null);
      }
      return null;
    }
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
          street: newAddressData.street,
          city: newAddressData.city,
          state: newAddressData.state,
          postal_code: newAddressData.postalCode,
          country: newAddressData.country || 'US',
          label: newAddressLabel.trim() || null,
          is_primary: selectedClientAddresses.length === 0,
          latitude: newAddressData.latitude ?? null,
          longitude: newAddressData.longitude ?? null,
          address: fullAddress,
        })
        .select('id, label, address, is_primary')
        .single();
      if (error) throw error;
      const updated = [...selectedClientAddresses, data];
      setSelectedClientAddresses(updated);
      setSelectedAddressId(data.id);
      setShowNewAddressForm(false);
      setNewAddressData(emptyAddressData);
      setNewAddressLabel('');
    } catch (e: any) {
      console.error('Failed to save address:', e.message);
    } finally {
      setSavingNewAddress(false);
    }
  };

  const fetchClientPhotos = async (clientId: string) => {
    const { data } = await supabase
      .from('client_photos')
      .select('id, photo_url, annotated_url, caption')
      .eq('client_id', clientId)
      .order('captured_at', { ascending: false })
      .limit(30);
    setClientPhotos(data || []);
    setSelectedPhotoIds(new Set());
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
      if (!estimate && (data.default_tax_rate ?? 0) > 0 && (data.auto_apply_tax ?? true)) {
        setTaxRate(data.default_tax_rate.toString());
      }
    }
  };

  const fetchClientAddresses = async () => {
    if (!currentOrganization?.id) return [];
    const { data } = await supabase
      .from('client_addresses')
      .select('*, clients(name)')
      .eq('organization_id', currentOrganization.id)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);
    return data || [];
  };

  const checkSmartAutofillSettings = async () => {
    if (!currentOrganization?.id) return { enabled: true, radius: 100 };
    const { data } = await supabase
      .from('organization_defaults')
      .select('smart_address_autofill_enabled, smart_address_autofill_radius_meters')
      .eq('organization_id', currentOrganization.id)
      .maybeSingle();
    return {
      enabled: data?.smart_address_autofill_enabled ?? true,
      radius: data?.smart_address_autofill_radius_meters ?? 100,
    };
  };

  const checkLocationAndAutofill = async () => {
    try {
      if (estimate || locationChecked) return;

      const settings = await checkSmartAutofillSettings();
      if (!settings.enabled) {
        setLocationChecked(true);
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationChecked(true);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const addresses = await fetchClientAddresses();
      setClientAddresses(addresses);

      const nearbyClients = LocationService.findNearbyClients(
        {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        },
        addresses.map((addr: any) => ({
          id: addr.id,
          name: addr.clients?.name || '',
          address: addr.formatted_address || '',
          latitude: addr.latitude,
          longitude: addr.longitude,
        })),
        settings.radius
      );

      if (nearbyClients.length > 0) {
        setLocationChecked(true);
        return;
      }

      const geocoded = await LocationService.reverseGeocode(
        location.coords.latitude,
        location.coords.longitude
      );

      if (geocoded) {
        setDetectedLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          address: geocoded.formattedAddress || '',
        });
        setShowAddressConfirmation(true);
      }

      setLocationChecked(true);
    } catch (error) {
      console.error('Error checking location:', error);
      setLocationChecked(true);
    }
  };

  const handleConfirmAddress = () => {
    if (detectedLocation) {
      setNotes((prev) =>
        prev ? `${prev}\n\nLocation: ${detectedLocation.address}` : `Location: ${detectedLocation.address}`
      );
    }
    setShowAddressConfirmation(false);
  };

  const handleEditAddress = () => {
    setShowAddressConfirmation(false);
  };

  const handleCancelAddress = () => {
    setDetectedLocation(null);
    setShowAddressConfirmation(false);
  };

  const fetchEstimateItems = async (estimateId: string): Promise<EstimateItem[]> => {
    const { data } = await supabase
      .from('estimate_items')
      .select('*')
      .eq('estimate_id', estimateId)
      .order('display_order', { ascending: true });
    const mapped: EstimateItem[] = (data || []).map((item: any, index: number) => {
      const pd = item.pane_details as Record<string, any> | null;
      const restoredPaneType: PaneType | undefined = pd?.pane_type as PaneType | undefined;
      return {
        id: item.id,
        job_type_id: item.job_type_id,
        description: item.description,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        discount_amount: Number(item.discount_amount || 0),
        discount_percentage: Number(item.discount_percentage || 0),
        is_optional: item.is_optional || false,
        notes: item.notes || '',
        display_order: item.display_order || index,
        total: Number(item.total),
        service_scope: item.service_scope || undefined,
        pane_type: restoredPaneType,
        pane_details: pd || null,
      };
    });
    setItems(mapped);
    return mapped;
  };

  const resetForm = () => {
    setSelectedClientId('');
    const today = new Date().toISOString().split('T')[0];
    const defaultPeriod = '30_days';
    setIssueDate(today);
    setValidityPeriod(defaultPeriod);
    setValidUntil(calculateValidUntil(today, defaultPeriod));
    setTaxRate('0');
    setOverallDiscountAmount('0');
    setOverallDiscountPercentage('0');
    setNotes('');
    setMemo('');
    setRequiresSignature(false);
    setItems([{ description: '', quantity: 1, unit_price: 0, discount_amount: 0, discount_percentage: 0, is_optional: false, notes: '', display_order: 0, total: 0 }]);
    setError('');
    setTallyInputs({});
    setShowNewClientForm(false);
    setShowIssueDatePicker(false);
    setShowValidUntilPicker(false);
    setNewClientName('');
    setNewClientEmail('');
    setNewClientPhone('');
    setNewClientAddress('');
    setExpandedItem(null);
    setSelectedClientAddresses([]);
    setSelectedAddressId(null);
    setClientDisableRounding(false);
    setShowPaneTypePicker(null);
    clientPaneQuantitiesRef.current = [];
    setClientPaneQuantities([]);
  };

  const handleCreateClient = async () => {
    if (!newClientName.trim()) {
      setError('Client name is required');
      return;
    }

    setSavingClient(true);
    setError('');

    try {
      const hasStructuredAddress = newClientAddressData.street.trim() || newClientAddressData.fullAddress.trim();
      const addressToSave = hasStructuredAddress
        ? (newClientAddressData.fullAddress || buildFullAddress(newClientAddressData.street, newClientAddressData.city, newClientAddressData.state, newClientAddressData.postalCode, newClientAddressData.country))
        : (newClientAddress.trim() || detectedLocation?.address || '');
      const clientInsert: Record<string, any> = {
        user_id: user?.id,
        organization_id: currentOrganization?.id,
        name: newClientName.trim(),
        email: newClientEmail.trim(),
        phone: newClientPhone.trim(),
        address: addressToSave,
      };
      if (hasStructuredAddress && newClientAddressData.latitude) {
        clientInsert.latitude = newClientAddressData.latitude;
        clientInsert.longitude = newClientAddressData.longitude;
      } else if (detectedLocation && !newClientAddress.trim()) {
        clientInsert.latitude = detectedLocation.latitude;
        clientInsert.longitude = detectedLocation.longitude;
      }

      const { data, error } = await supabase
        .from('clients')
        .insert(clientInsert)
        .select('id, name, email, phone')
        .single();

      if (error) throw error;

      if (addressToSave && currentOrganization?.id) {
        const addressInsert: Record<string, any> = {
          client_id: data.id,
          organization_id: currentOrganization.id,
          address: addressToSave,
          label: 'Primary',
          is_primary: true,
        };
        if (hasStructuredAddress) {
          addressInsert.street = newClientAddressData.street;
          addressInsert.city = newClientAddressData.city;
          addressInsert.state = newClientAddressData.state;
          addressInsert.postal_code = newClientAddressData.postalCode;
          addressInsert.country = newClientAddressData.country;
          addressInsert.latitude = newClientAddressData.latitude;
          addressInsert.longitude = newClientAddressData.longitude;
          addressInsert.normalized = newClientAddressData.normalized;
        } else if (detectedLocation) {
          addressInsert.latitude = detectedLocation.latitude;
          addressInsert.longitude = detectedLocation.longitude;
        }
        await supabase.from('client_addresses').insert(addressInsert);
      }

      const itemsWithJobType = items.filter(
        item => item.job_type_id && item.quantity > 0
      );

      if (itemsWithJobType.length > 0 && currentOrganization?.id) {
        const quantities = itemsWithJobType.map(item => {
          const jt = jobTypes.find(j => j.id === item.job_type_id);
          const isPaneJob = jt?.unit_of_measure === 'pane' && !jt?.is_flat_rate;
          const resolvedPaneDetails = item.pane_details ||
            (isPaneJob ? inferPaneDetailsFromDescription(item.description, item.quantity) : null);
          return {
            client_id: data.id,
            job_type_id: item.job_type_id,
            quantity: item.quantity,
            pane_details: resolvedPaneDetails || null,
            organization_id: currentOrganization.id,
            address_id: null,
          };
        });

        await supabase
          .from('client_unit_quantities')
          .insert(quantities);
      }

      setClients(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedClientId(data.id);
      if (itemsWithJobType.length > 0) {
        const savedQuantities = itemsWithJobType.map(item => ({
          job_type_id: item.job_type_id,
          quantity: item.quantity,
          pane_details: item.pane_details || null,
          address_id: null,
        }));
        setClientPaneQuantities(savedQuantities);
      }
      setShowNewClientForm(false);
      setShowClientPicker(false);
      setNewClientName('');
      setNewClientEmail('');
      setNewClientPhone('');
      setNewClientAddress('');
      setNewClientAddressData(emptyAddressData);
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

    if (!currentOrganization?.id) {
      setError('Organization not found');
      setSavingJobType(false);
      return;
    }

    setSavingJobType(true);
    setError('');

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

  const handleValidityPeriodChange = (period: string) => {
    setValidityPeriod(period);
    if (period !== 'custom' && issueDate) {
      setValidUntil(calculateValidUntil(issueDate, period));
    }
    setShowValidityPeriodPicker(false);
  };

  const handleIssueDateChange = (date: string) => {
    setIssueDate(date);
    if (validityPeriod !== 'custom' && date) {
      setValidUntil(calculateValidUntil(date, validityPeriod));
    }
  };

  const getJobTypeUnitDisplay = (jobType?: JobType): string => {
    if (!jobType) {
      return '/hr';
    }
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

  const getJobTypeQuantityLabel = (jobType?: JobType): string => {
    if (!jobType) {
      return 'Quantity';
    }
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

  const calculateItemTotal = (item: EstimateItem, addressIdOverride?: string | null): number => {
    const addressIdForPricing = addressIdOverride !== undefined ? addressIdOverride : selectedAddressId;
    let baseTotal = item.quantity * item.unit_price;
    if (item.pane_details && item.job_type_id) {
      const jt = jobTypes.find(j => j.id === item.job_type_id);
      if (jt && isPaneJobType(jt)) {
        if (hasSplitPaneDetails(item.pane_details)) {
          const splitScope = (item.service_scope as ServiceScope) || 'full_service';
          baseTotal = clientPaneTypePrices.length > 0
            ? calculateSplitPaneTotalWithClientPrices(item.pane_details, jt, clientPaneTypePrices, item.job_type_id, addressIdForPricing, splitScope)
            : calculateSplitPaneTotal(item.pane_details, jt, splitScope);
        } else if (hasMixedPaneTypes(item.pane_details)) {
          const scope = (item.service_scope as ServiceScope) || 'full_service';
          baseTotal = clientPaneTypePrices.length > 0
            ? calculateMixedPaneTotalWithClientPrices(item.pane_details, jt, scope, clientPaneTypePrices, item.job_type_id, addressIdForPricing)
            : calculateMixedPaneTotal(item.pane_details, jt, scope);
        }
      }
    }
    let discount = 0;
    if (item.discount_percentage > 0) {
      discount = baseTotal * (item.discount_percentage / 100);
    } else if (item.discount_amount > 0) {
      discount = item.discount_amount;
    }
    return Math.max(0, baseTotal - discount);
  };

  const calculateTotals = () => {
    const itemsSubtotal = items.reduce((sum, item) => sum + calculateItemTotal(item), 0);

    let overallDiscount = 0;
    if (overallDiscountType === 'percentage' && Number(overallDiscountPercentage) > 0) {
      overallDiscount = itemsSubtotal * (Number(overallDiscountPercentage) / 100);
    } else if (overallDiscountType === 'amount' && Number(overallDiscountAmount) > 0) {
      overallDiscount = Number(overallDiscountAmount);
    }

    const subtotal = Math.max(0, itemsSubtotal - overallDiscount);
    const tax = subtotal * (Number(taxRate) / 100);
    const rawTotal = subtotal + tax;
    const total = clientDisableRounding ? rawTotal : roundPrice(rawTotal, businessSettings as PriceRoundingSettings | null);

    const scopeSubtotals: Record<string, number> = {};
    for (const item of items) {
      const scope = (item.service_scope as string) || 'full_service';
      scopeSubtotals[scope] = (scopeSubtotals[scope] || 0) + calculateItemTotal(item);
    }
    const activeScopes = Object.keys(scopeSubtotals);
    const hasMultipleScopes = activeScopes.length > 1;

    const discountRatio = itemsSubtotal > 0 ? (subtotal / itemsSubtotal) : 1;
    const taxRateNum = Number(taxRate) / 100;

    const scopeTotals: { scope: string; label: string; subtotal: number; total: number }[] = activeScopes.map(scope => {
      const scopeSubtotal = scopeSubtotals[scope] * discountRatio;
      const scopeTotal = clientDisableRounding
        ? scopeSubtotal * (1 + taxRateNum)
        : roundPrice(scopeSubtotal * (1 + taxRateNum), businessSettings as PriceRoundingSettings | null);
      const scopeLabel = scope === 'full_service' ? 'Full Service' : scope === 'exterior_only' ? 'Exterior Only' : scope;
      return { scope, label: scopeLabel, subtotal: scopeSubtotal, total: scopeTotal };
    });

    return {
      itemsSubtotal,
      overallDiscount,
      subtotal,
      taxAmount: tax,
      total,
      hasMultipleScopes,
      scopeTotals,
    };
  };

  const updateItem = (index: number, field: keyof EstimateItem, value: any) => {
    isDirtyRef.current = true;
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    if (field === 'quantity' || field === 'unit_price' || field === 'discount_amount' || field === 'discount_percentage') {
      newItems[index].total = calculateItemTotal(newItems[index]);
    }

    setItems(newItems);
  };

  const isPaneJobType = (jt: JobType) => jt.unit_of_measure === 'pane' && !jt.is_flat_rate;

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
      updateItem(index, 'unit_price', newRate);
      const primaryType = (item.pane_details ? (Object.keys(item.pane_details).find(k => k !== 'standard' && (item.pane_details![k] ?? 0) > 0) || 'standard') : 'standard') as any;
      setClientPaneTypePrices(prev => {
        const rest = prev.filter(p => !(p.job_type_id === jt.id && p.pane_type_key === primaryType && (p.address_id === (selectedAddressId || null) || p.address_id === null)));
        return [...rest, { job_type_id: jt.id, pane_type_key: primaryType, price_mode: 'per_pane' as const, price_per_pane: baseRate, flat_rate_amount: null, address_id: selectedAddressId || null }];
      });
    } else {
      updateItem(index, 'unit_price', newRate);
      if (jt && isPaneJobType(jt)) {
        const primaryType = (item.pane_details ? (Object.keys(item.pane_details).find(k => k !== 'standard' && (item.pane_details![k] ?? 0) > 0) || 'standard') : 'standard') as any;
        setClientPaneTypePrices(prev => {
          const rest = prev.filter(p => !(p.job_type_id === jt.id && p.pane_type_key === primaryType && (p.address_id === (selectedAddressId || null) || p.address_id === null)));
          return [...rest, { job_type_id: jt.id, pane_type_key: primaryType, price_mode: 'per_pane' as const, price_per_pane: newRate, flat_rate_amount: null, address_id: selectedAddressId || null }];
        });
      }
    }
  };

  const isWindowRelatedJob = (jt: JobType) => {
    if (isPaneJobType(jt)) return true;
    const n = jt.name.toLowerCase();
    return n.includes('window');
  };

  const isWindowCleaningCategory = (jt: JobType) =>
    jt.category_service_type === 'window_cleaning' || isWindowRelatedJob(jt);

  const PANE_ADDONS = [
    { key: 'french', label: 'French Panes' },
    { key: 'storm', label: 'Storm Windows' },
    { key: 'skylights', label: 'Skylights' },
    { key: 'commercial', label: 'Commercial' },
  ];

  const updatePaneAddon = (itemIndex: number, paneKey: string, count: number) => {
    setPaneAddonCounts(prev => {
      const itemAddons = { ...(prev[itemIndex] || {}) };
      if (count <= 0) {
        delete itemAddons[paneKey];
      } else {
        itemAddons[paneKey] = count;
      }
      const next = { ...prev, [itemIndex]: itemAddons };
      const jt = jobTypes.find(j => j.id === items[itemIndex]?.job_type_id);
      if (!jt) return next;
      const standardQty = items[itemIndex]?.quantity || 0;
      const addonTotal = Object.values(itemAddons).reduce((s, v) => s + v, 0);
      const totalPanes = standardQty + addonTotal;
      const newPaneDetails: Record<string, number> = { standard: standardQty, ...itemAddons };
      setItems(prev2 => {
        const arr = [...prev2];
        arr[itemIndex] = { ...arr[itemIndex], pane_details: newPaneDetails, quantity: totalPanes };
        arr[itemIndex].total = calculateItemTotal(arr[itemIndex]);
        return arr;
      });
      return next;
    });
  };

  const updateStandardPaneCount = (itemIndex: number, count: number) => {
    setItems(prev => {
      const arr = [...prev];
      const addons = paneAddonCounts[itemIndex] || {};
      const addonTotal = Object.values(addons).reduce((s, v) => s + v, 0);
      const totalPanes = count + addonTotal;
      const newPaneDetails: Record<string, number> = { standard: count, ...addons };
      arr[itemIndex] = { ...arr[itemIndex], quantity: totalPanes, pane_details: newPaneDetails };
      arr[itemIndex].total = calculateItemTotal(arr[itemIndex]);
      return arr;
    });
  };

  const getScopeDescription = (scope: ServiceScope): string => {
    if (!businessSettings) return '';
    if (scope === 'full_service') return businessSettings.scope_description_full_service || '';
    if (scope === 'exterior_only') return businessSettings.scope_description_exterior_only || '';
    if (scope === 'interior_only') return businessSettings.scope_description_interior_only || '';
    return '';
  };

  const buildDescription = (jobTypeName: string, scope: ServiceScope | undefined): string => {
    const scopeDesc = scope ? getScopeDescription(scope) : '';
    return scopeDesc ? `${jobTypeName} - ${scopeDesc}` : jobTypeName;
  };

  const selectJobType = (index: number, jobType: JobType) => {
    const newItems = [...items];
    const isPane = isPaneJobType(jobType);
    const showsPaneType = isWindowRelatedJob(jobType);
    const forcedScope: ServiceScope | null = jobType.scope_options === 'exterior_only' ? 'exterior_only' : jobType.scope_options === 'interior_only' ? 'interior_only' : null;
    const existingScope: ServiceScope = forcedScope || (newItems[index].service_scope as ServiceScope) || 'full_service';
    const defaultPaneType: PaneType = 'standard';
    // Use ref so we always read the latest fetched quantities even if state hasn't re-rendered yet
    const latestPaneQuantities = clientPaneQuantitiesRef.current.length > 0
      ? clientPaneQuantitiesRef.current
      : clientPaneQuantities;
    const clientPaneCount = isPane ? getClientPaneCount(latestPaneQuantities, jobType.id, selectedAddressId) : 0;
    const clientPaneEntry = isPane
      ? latestPaneQuantities.find((q: any) => q.job_type_id === jobType.id && (selectedAddressId ? q.address_id === selectedAddressId : !q.address_id))
      : null;
    const clientPaneDetailsData = clientPaneEntry?.pane_details || null;
    const quantity = jobType.is_flat_rate
      ? 1
      : isPane && clientPaneCount > 0
      ? clientPaneCount
      : newItems[index].quantity;
    const effectivePrice = isPane
      ? (clientPaneTypePrices.length > 0
        ? getEffectivePanePriceWithClientOverride(jobType, defaultPaneType, existingScope, clientPaneTypePrices, jobType.id, selectedAddressId).price
        : getEffectivePanePriceForType(jobType, defaultPaneType, existingScope))
      : jobType.hourly_rate;
    newItems[index] = {
      ...newItems[index],
      job_type_id: jobType.id,
      description: buildDescription(jobType.name, isPane ? existingScope : undefined),
      quantity,
      unit_price: effectivePrice,
      service_scope: isPane ? existingScope : undefined,
      pane_type: showsPaneType ? defaultPaneType : undefined,
      pane_details: clientPaneDetailsData,
    };
    newItems[index].total = calculateItemTotal(newItems[index]);
    if (clientPaneDetailsData) {
      const { standard: _std, ...nonStd } = clientPaneDetailsData as Record<string, number>;
      const filtered = Object.fromEntries(Object.entries(nonStd).filter(([, v]) => v > 0));
      if (Object.keys(filtered).length > 0) {
        setPaneAddonCounts(prev => ({ ...prev, [index]: filtered }));
      }
    }
    setItems(newItems);
    setShowJobTypePicker(null);
  };

  const updateServiceScope = (index: number, scope: ServiceScope) => {
    const newItems = [...items];
    const item = newItems[index];
    const jobType = jobTypes.find(jt => jt.id === item.job_type_id);
    if (!jobType) return;
    const paneType = item.pane_type || 'standard';
    const effectivePrice = isPaneJobType(jobType)
      ? (clientPaneTypePrices.length > 0
        ? getEffectivePanePriceWithClientOverride(jobType, paneType, scope, clientPaneTypePrices, item.job_type_id!, selectedAddressId).price
        : getEffectivePanePriceForType(jobType, paneType, scope))
      : getEffectivePanePrice(jobType.hourly_rate, jobType.exterior_split_percent ?? null, scope);
    const jobTypeName = jobType.name;
    newItems[index] = { ...item, service_scope: scope, unit_price: effectivePrice, description: buildDescription(jobTypeName, scope) };
    newItems[index].total = calculateItemTotal(newItems[index]);
    setItems(newItems);
    setShowScopePicker(null);
  };

  const updatePaneType = (index: number, paneType: PaneType) => {
    const newItems = [...items];
    const item = newItems[index];
    const jobType = jobTypes.find(jt => jt.id === item.job_type_id);
    if (!jobType) return;
    const scope: ServiceScope = (item.service_scope as ServiceScope) || 'full_service';
    const effectivePrice = getEffectivePanePriceWithClientOverride(jobType, paneType, scope, clientPaneTypePrices, item.job_type_id!, selectedAddressId).price;
    newItems[index] = { ...item, pane_type: paneType, unit_price: effectivePrice };
    newItems[index].total = calculateItemTotal(newItems[index]);
    setItems(newItems);
    setShowPaneTypePicker(null);
  };

  const addItem = () => {
    const newItem: EstimateItem = {
      description: '',
      quantity: 1,
      unit_price: 0,
      discount_amount: 0,
      discount_percentage: 0,
      is_optional: false,
      notes: '',
      display_order: items.length,
      total: 0
    };
    setItems([...items, newItem]);
  };

  const duplicateItem = (index: number) => {
    const itemToDuplicate = items[index];
    const newItem: EstimateItem = {
      ...itemToDuplicate,
      id: undefined,
      display_order: items.length,
    };
    setItems([...items, newItem]);
    showToast({ message: 'Item duplicated', type: 'success' });
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      const newItems = items.filter((_, i) => i !== index);
      newItems.forEach((item, i) => item.display_order = i);
      setItems(newItems);
    }
  };

  const addCompanionItem = (index: number, companionScope: ServiceScope) => {
    const sourceItem = items[index];
    const jobType = jobTypes.find(jt => jt.id === sourceItem.job_type_id);
    if (!jobType) return;
    const paneType = sourceItem.pane_type || 'standard';
    const companionPrice = getEffectivePanePriceForType(jobType, paneType, companionScope);
    const companionItem: EstimateItem = {
      job_type_id: sourceItem.job_type_id,
      description: buildDescription(jobType.name, companionScope),
      quantity: sourceItem.quantity,
      unit_price: companionPrice,
      discount_amount: 0,
      discount_percentage: 0,
      is_optional: false,
      notes: '',
      display_order: index + 1,
      total: sourceItem.quantity * companionPrice,
      service_scope: companionScope,
      pane_type: sourceItem.pane_type,
      pane_details: sourceItem.pane_details ? { ...sourceItem.pane_details } : null,
    };
    const newItems = [...items];
    newItems.splice(index + 1, 0, companionItem);
    newItems.forEach((item, i) => { item.display_order = i; });
    newItems[index] = { ...newItems[index], companion_item_index: index + 1 };
    newItems[index + 1] = { ...newItems[index + 1], companion_item_index: index };
    setItems(newItems);
  };

  const removeCompanionItem = (index: number) => {
    const sourceItem = items[index];
    const companionIdx = sourceItem.companion_item_index;
    if (companionIdx === undefined || companionIdx === null) return;
    const newItems = items.filter((_, i) => i !== companionIdx);
    newItems.forEach((item, i) => { item.display_order = i; item.companion_item_index = undefined; });
    setItems(newItems);
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === items.length - 1)) {
      return;
    }

    const newItems = [...items];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
    newItems.forEach((item, i) => item.display_order = i);
    setItems(newItems);
  };

  const toggleFab = () => {
    const next = !fabOpen;
    setFabOpen(next);
    Animated.spring(fabAnim, { toValue: next ? 1 : 0, useNativeDriver: true, friction: 6, tension: 80 }).start();
    Animated.spring(fabRotation, { toValue: next ? 1 : 0, useNativeDriver: true, friction: 6, tension: 80 }).start();
  };

  const closeFab = () => {
    setFabOpen(false);
    Animated.spring(fabAnim, { toValue: 0, useNativeDriver: true, friction: 6, tension: 80 }).start();
    Animated.spring(fabRotation, { toValue: 0, useNativeDriver: true, friction: 6, tension: 80 }).start();
  };

  const handleFabInvoice = () => {
    closeFab();
    setShowInvoiceModal(true);
  };

  const handleFabSchedule = () => {
    closeFab();
    setShowScheduleModal(true);
  };

  const handleFabEditClient = () => {
    closeFab();
    setShowClientModal(true);
  };

  const fabRotationDeg = fabRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  const estimateFabActions = [
    { id: 'invoice', label: 'Create Invoice', icon: Receipt, color: '#10b981', gradientColors: ['#2D8B57', '#34a065'] as [string, string], onPress: handleFabInvoice },
    { id: 'schedule', label: 'Schedule Job', icon: Calendar, color: '#f59e0b', gradientColors: ['#d4850a', '#c27608'] as [string, string], onPress: handleFabSchedule },
    { id: 'edit-client', label: 'Edit Client', icon: UserCog, color: '#6366f1', gradientColors: ['#1B4D6E', '#245d82'] as [string, string], onPress: handleFabEditClient },
  ];

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
      const { itemsSubtotal, overallDiscount, subtotal, taxAmount, total } = calculateTotals();
      let estimateId = estimate?.id;
      let estimateNumber = estimate?.estimate_number;

      if (!estimate) {
        const { data: numData } = await supabase.rpc('generate_estimate_number');
        estimateNumber = numData || `EST-${Date.now()}`;
      }

      const estimateData = {
        client_id: selectedClientId,
        estimate_number: estimateNumber!,
        memo: memo.trim() || null,
        status: sendVia ? 'sent' : 'draft',
        issue_date: issueDate,
        valid_until: validUntil,
        validity_period: validityPeriod,
        subtotal,
        tax_rate: Number(taxRate),
        tax_amount: taxAmount,
        discount_amount: overallDiscountType === 'amount' ? Number(overallDiscountAmount) : 0,
        discount_percentage: overallDiscountType === 'percentage' ? Number(overallDiscountPercentage) : 0,
        total,
        notes,
        requires_signature: requiresSignature,
        service_address_id: selectedAddressId || null,
        sent_via: sendVia || null,
        sent_at: sendVia ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      };

      if (estimate) {
        const { error } = await supabase
          .from('estimates')
          .update(estimateData)
          .eq('id', estimate.id)
          .eq('user_id', user!.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('estimates')
          .insert({ ...estimateData, user_id: user?.id })
          .select('id')
          .single();
        if (error) throw error;
        estimateId = data.id;
      }

      if (estimate) {
        await supabase.from('estimate_items').delete().eq('estimate_id', estimate.id);
      }

      const itemsToInsert = items
        .filter(item => item.description.trim() || item.job_type_id)
        .map((item, index) => {
          const paneDetails = item.pane_type
            ? { ...(item.pane_details || {}), pane_type: item.pane_type }
            : item.pane_details || null;
          return {
            estimate_id: estimateId,
            job_type_id: item.job_type_id || null,
            description: item.description,
            quantity: item.quantity,
            unit_price: (item.unit_price || (item.quantity > 0 ? Math.round((item.total / item.quantity) * 100) / 100 : 0)),
            discount_amount: item.discount_amount,
            discount_percentage: item.discount_percentage,
            is_optional: item.is_optional,
            notes: item.notes,
            display_order: index,
            total: calculateItemTotal(item),
            service_scope: item.service_scope || null,
            pane_details: paneDetails,
          };
        });

      if (itemsToInsert.length > 0) {
        const { error } = await supabase.from('estimate_items').insert(itemsToInsert);
        if (error) throw error;
      }

      if (selectedClientId && currentOrganization?.id) {
        const paneItems = items.filter(
          item => item.job_type_id && item.quantity > 0
        );
        const saveAddressId = selectedAddressId || null;
        for (const item of paneItems) {
          const jobType = jobTypes.find(jt => jt.id === item.job_type_id);
          const isPaneJob = jobType?.unit_of_measure === 'pane' && !jobType?.is_flat_rate;
          if (!isPaneJob) continue;
          const resolvedPaneDetails = item.pane_details ||
            inferPaneDetailsFromDescription(item.description, item.quantity);

          let rowQuery = supabase
            .from('client_unit_quantities')
            .select('id, pane_details')
            .eq('client_id', selectedClientId)
            .eq('job_type_id', item.job_type_id!);
          rowQuery = saveAddressId
            ? rowQuery.eq('address_id', saveAddressId)
            : rowQuery.is('address_id', null);
          const { data: row } = await rowQuery.maybeSingle();

          const normalizedForSave = normalizePaneDetails(
            resolvedPaneDetails || (row as any)?.pane_details || null,
            Number(item.quantity) || 0,
          );
          if (row) {
            await supabase
              .from('client_unit_quantities')
              .update({
                quantity: item.quantity,
                pane_details: normalizedForSave,
                updated_at: new Date().toISOString(),
              })
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

        const { data: currentClient } = await supabase
          .from('clients')
          .select('email, phone, address')
          .eq('id', selectedClientId)
          .maybeSingle();

        if (currentClient) {
          const client = clients.find(c => c.id === selectedClientId);
          const updates: Record<string, string> = {};

          if (!currentClient.email && client?.email) {
            updates.email = client.email;
          }
          if (!currentClient.phone && client?.phone) {
            updates.phone = client.phone;
          }

          if (detectedLocation?.address && !currentClient.address) {
            updates.address = detectedLocation.address;
          }

          if (Object.keys(updates).length > 0) {
            updates.updated_at = new Date().toISOString();
            await supabase
              .from('clients')
              .update(updates)
              .eq('id', selectedClientId);
          }

          if (detectedLocation && currentOrganization?.id) {
            const { data: existingAddresses } = await supabase
              .from('client_addresses')
              .select('id')
              .eq('client_id', selectedClientId)
              .eq('organization_id', currentOrganization.id);

            if (!existingAddresses || existingAddresses.length === 0) {
              if (detectedLocation.address) {
                await supabase.from('client_addresses').insert({
                  client_id: selectedClientId,
                  organization_id: currentOrganization.id,
                  formatted_address: detectedLocation.address,
                  latitude: detectedLocation.latitude,
                  longitude: detectedLocation.longitude,
                  label: 'Primary',
                  is_primary: true,
                });
              }
            }
          }
        }
      }

      if (sendVia === 'email') {
        try {
          const client = clients.find(c => c.id === selectedClientId);
          if (client?.email) {
            const attachedPhotoUrls = selectedPhotoIds.size > 0
              ? clientPhotos
                  .filter((p) => selectedPhotoIds.has(p.id))
                  .map((p) => p.annotated_url || p.photo_url)
              : undefined;

            const emailChannel = businessSettings?.email_send_channel || 'native';

            if (emailChannel === 'native') {
              const memoOrNum = memo.trim() ? memo.trim() : `#${estimateNumber}`;

              let nativeEstimatePdfUrl: string | null = null;
              if (estimateId && currentOrganization?.id) {
                try {
                  const { data: clientData } = await supabase
                    .from('clients')
                    .select('address, phone')
                    .eq('id', selectedClientId)
                    .maybeSingle();

                  const pdfData: EstimatePDFData = {
                    estimate_number: estimateNumber!,
                    memo: memo.trim() || undefined,
                    issue_date: new Date(issueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                    valid_until: new Date(validUntil).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                    business_name: businessSettings?.business_name || 'Your Business',
                    business_address: businessSettings?.business_address || '',
                    business_phone: businessSettings?.business_phone || '',
                    business_email: businessSettings?.business_email || '',
                    client_name: client.name,
                    client_address: clientData?.address || '',
                    client_phone: clientData?.phone || client.phone || '',
                    client_email: client.email,
                    items: itemsToInsert.map(item => ({
                      description: item.description,
                      quantity: item.quantity,
                      unit_price: (item.unit_price || (item.quantity > 0 ? Math.round((item.total / item.quantity) * 100) / 100 : 0)),
                      discount_amount: item.discount_amount || 0,
                      discount_percentage: item.discount_percentage || 0,
                      is_optional: item.is_optional || false,
                      notes: item.notes || '',
                      total: item.total,
                      service_scope: item.service_scope || undefined,
                    })),
                    subtotal,
                    tax_rate: Number(taxRate),
                    tax_amount: taxAmount,
                    discount_amount: overallDiscountType === 'amount' ? Number(overallDiscountAmount) : 0,
                    discount_percentage: overallDiscountType === 'percentage' ? Number(overallDiscountPercentage) : 0,
                    total,
                    notes: notes || '',
                  };

                  const { buildEstimatePDF } = await import('@/lib/webPdfBuilder');
                  const pdfDoc = await buildEstimatePDF(pdfData);
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
                  const estLabel = memo.trim() || estimateNumber || undefined;
                  nativeEstimatePdfUrl = await uploadPdfAndGetUrl(pdfBase64, 'estimate', estimateId, currentOrganization.id, estLabel);
                  if (nativeEstimatePdfUrl) {
                    await supabase.from('estimates').update({ pdf_url: nativeEstimatePdfUrl }).eq('id', estimateId);
                  }
                } catch (e) {
                  console.error('PDF generation/upload for native email failed:', e);
                }
              }

              const emailSubject = `Estimate ${memoOrNum}`;
              const emailBody = `Hi ${client.name},\n\nPlease find your estimate ${memoOrNum} for ${total.toFixed(2)}.\n\nThank you!`;

              if (Platform.OS === 'web') {
                const pdfLine = nativeEstimatePdfUrl ? `\n\nView your estimate PDF: ${nativeEstimatePdfUrl}` : '';
                const mailtoUrl = `mailto:${client.email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody + pdfLine)}`;
                if (typeof window !== 'undefined' && window.location) {
                  window.location.href = mailtoUrl;
                } else {
                  await Linking.openURL(mailtoUrl);
                }
              } else {
                const { data: clientData } = await supabase
                  .from('clients')
                  .select('address, phone')
                  .eq('id', selectedClientId)
                  .maybeSingle();

                const pdfData: EstimatePDFData = {
                  estimate_number: estimateNumber!,
                  memo: memo.trim() || undefined,
                  issue_date: new Date(issueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                  valid_until: new Date(validUntil).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                  business_name: businessSettings?.business_name || 'Your Business',
                  business_address: businessSettings?.business_address || '',
                  business_phone: businessSettings?.business_phone || '',
                  business_email: businessSettings?.business_email || '',
                  client_name: client.name,
                  client_address: clientData?.address || '',
                  client_phone: clientData?.phone || client.phone || '',
                  client_email: client.email,
                  items: itemsToInsert.map(item => ({
                    description: item.description,
                    quantity: item.quantity,
                    unit_price: (item.unit_price || (item.quantity > 0 ? Math.round((item.total / item.quantity) * 100) / 100 : 0)),
                    discount_amount: item.discount_amount || 0,
                    discount_percentage: item.discount_percentage || 0,
                    is_optional: item.is_optional || false,
                    notes: item.notes || '',
                    total: item.total,
                    service_scope: item.service_scope || undefined,
                  })),
                  subtotal,
                  tax_rate: Number(taxRate),
                  tax_amount: taxAmount,
                  discount_amount: overallDiscountType === 'amount' ? Number(overallDiscountAmount) : 0,
                  discount_percentage: overallDiscountType === 'percentage' ? Number(overallDiscountPercentage) : 0,
                  total,
                  notes: notes || '',
                };
                const shared = await PDFGenerator.shareEstimatePDF(pdfData);
                if (!shared) {
                  const mailtoUrl = `mailto:${client.email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
                  await Linking.openURL(mailtoUrl);
                }
              }
              showToast({ message: 'Estimate sent. Email app opened with PDF attached.', type: 'success', duration: 3000 });
            } else {
              let pdfBase64 = '';

              try {
                const { data: fetchedBusinessSettings } = await supabase
                  .from('business_settings')
                  .select('*')
                  .eq('organization_id', currentOrganization?.id)
                  .maybeSingle();

                const { data: clientData } = await supabase
                  .from('clients')
                  .select('address, phone')
                  .eq('id', selectedClientId)
                  .maybeSingle();

                const pdfData: EstimatePDFData = {
                  estimate_number: estimateNumber!,
                  memo: memo.trim() || undefined,
                  issue_date: new Date(issueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                  valid_until: new Date(validUntil).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                  business_name: fetchedBusinessSettings?.business_name || 'Your Business',
                  business_address: fetchedBusinessSettings?.business_address || '',
                  business_phone: fetchedBusinessSettings?.business_phone || '',
                  business_email: fetchedBusinessSettings?.business_email || '',
                  client_name: client.name,
                  client_address: clientData?.address || '',
                  client_phone: clientData?.phone || client.phone || '',
                  client_email: client.email,
                  items: itemsToInsert.map(item => ({
                    description: item.description,
                    quantity: item.quantity,
                    unit_price: (item.unit_price || (item.quantity > 0 ? Math.round((item.total / item.quantity) * 100) / 100 : 0)),
                    discount_amount: item.discount_amount || 0,
                    discount_percentage: item.discount_percentage || 0,
                    is_optional: item.is_optional || false,
                    notes: item.notes || '',
                    total: item.total,
                    service_scope: item.service_scope || undefined,
                  })),
                  subtotal,
                  tax_rate: Number(taxRate),
                  tax_amount: taxAmount,
                  discount_amount: overallDiscountType === 'amount' ? Number(overallDiscountAmount) : 0,
                  discount_percentage: overallDiscountType === 'percentage' ? Number(overallDiscountPercentage) : 0,
                  total,
                  notes: notes || '',
                };

                const { buildEstimatePDF } = await import('@/lib/webPdfBuilder');
                const pdfDoc = await buildEstimatePDF(pdfData);
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

              let estimatePdfUrl: string | null = null;
              if (pdfBase64 && estimateId && currentOrganization?.id) {
                try {
                  const estLabel = memo.trim() || estimateNumber || undefined;
                  estimatePdfUrl = await uploadPdfAndGetUrl(pdfBase64, 'estimate', estimateId, currentOrganization.id, estLabel);
                  if (estimatePdfUrl) {
                    await supabase.from('estimates').update({ pdf_url: estimatePdfUrl }).eq('id', estimateId);
                  }
                } catch (uploadError) {
                  console.error('PDF upload failed:', uploadError);
                }
              }

              const { data: functionData, error: functionError } = await invokeFunction(
                'send-estimate-email',
                {
                  estimateId,
                  clientEmail: client.email,
                  clientName: client.name,
                  sendToSelf,
                  pdfBase64: pdfBase64 || undefined,
                  pdfUrl: estimatePdfUrl || undefined,
                  photoUrls: attachedPhotoUrls,
                }
              );

              if (!functionError && functionData?.success) {
                showToast({
                  message: functionData.hasPdf ? 'Estimate sent successfully with PDF attachment' : 'Estimate sent successfully',
                  type: 'success',
                  duration: 3000
                });
              } else {
                const errorMsg = functionError?.message || functionData?.error || 'Email delivery failed';
                showToast({ message: `Estimate saved but email failed: ${errorMsg}`, type: 'error', duration: 5000 });
              }
            }
          } else {
            showToast({
              message: 'Estimate saved. No email address found for this client.',
              type: 'warning',
              duration: 4000
            });
          }
        } catch (emailError: any) {
          showToast({
            message: `Estimate saved but email failed: ${emailError?.message || 'Unknown error'}`,
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

          const token = Array.from(crypto.getRandomValues(new Uint8Array(24)))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');

          const expiresAt = new Date(validUntil || Date.now());
          expiresAt.setDate(expiresAt.getDate() + 7);

          const { error: tokenError } = await supabase
            .from('estimate_approval_tokens')
            .insert({
              estimate_id: estimateId,
              token,
              expires_at: expiresAt.toISOString(),
            });

          if (tokenError) {
            console.error('Token error:', tokenError);
          }

          const approvalUrl = `https://bizzypro.app/approve/${token}`;
          const phoneNumber = chosenPhone.replace(/\D/g, '');
          const estimateTotal = total.toFixed(2);

          const { data: smsSettingsData } = await supabase
            .from('business_settings')
            .select('sms_send_channel')
            .eq('organization_id', currentOrganization?.id)
            .maybeSingle();
          const smsChannel = smsSettingsData?.sms_send_channel || 'native';

          let smsPdfUrl: string | null = null;
          if (estimateId && currentOrganization?.id) {
            let smsPdfBase64 = '';
            try {
              const { data: bsData } = await supabase
                .from('business_settings')
                .select('*')
                .eq('organization_id', currentOrganization?.id)
                .maybeSingle();
              const { data: clientData } = await supabase
                .from('clients')
                .select('address, phone')
                .eq('id', selectedClientId)
                .maybeSingle();
              const pdfData: EstimatePDFData = {
                estimate_number: estimateNumber!,
                memo: memo.trim() || undefined,
                issue_date: new Date(issueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                valid_until: new Date(validUntil).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                business_name: bsData?.business_name || 'Your Business',
                business_address: bsData?.business_address || '',
                business_phone: bsData?.business_phone || '',
                business_email: bsData?.business_email || '',
                client_name: client.name,
                client_address: clientData?.address || '',
                client_phone: clientData?.phone || client.phone || '',
                client_email: client.email || '',
                items: itemsToInsert.map(item => ({
                  description: item.description,
                  quantity: item.quantity,
                  unit_price: (item.unit_price || (item.quantity > 0 ? Math.round((item.total / item.quantity) * 100) / 100 : 0)),
                  discount_amount: item.discount_amount || 0,
                  discount_percentage: item.discount_percentage || 0,
                  is_optional: item.is_optional || false,
                  notes: item.notes || '',
                  total: item.total,
                })),
                subtotal,
                tax_rate: Number(taxRate),
                tax_amount: taxAmount,
                discount_amount: overallDiscountType === 'amount' ? Number(overallDiscountAmount) : 0,
                discount_percentage: overallDiscountType === 'percentage' ? Number(overallDiscountPercentage) : 0,
                total,
                notes: notes || '',
              };
              const { buildEstimatePDF } = await import('@/lib/webPdfBuilder');
              const pdfDoc = await buildEstimatePDF(pdfData);
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

            if (smsPdfBase64) {
              const smsEstLabel = memo.trim() || estimateNumber || undefined;
              smsPdfUrl = await uploadPdfAndGetUrl(smsPdfBase64, 'estimate', estimateId, currentOrganization.id, smsEstLabel);
              if (smsPdfUrl) {
                await supabase.from('estimates').update({ pdf_url: smsPdfUrl }).eq('id', estimateId);
              }
            }
          }

          const estimateMemoOrNum = memo.trim() ? memo.trim() : `#${estimateNumber}`;
          const message = `Hi ${client.name}, your estimate ${estimateMemoOrNum} for ${estimateTotal} is ready. Review & approve: ${approvalUrl}`;

          if (smsChannel === 'twilio') {
            const { data: smsData, error: smsError } = await invokeFunction('send-sms', {
              organization_id: currentOrganization?.id,
              to: chosenPhone,
              body: message,
            });

            if (!smsError && smsData?.success) {
              await supabase
                .from('estimates')
                .update({ status: 'sent', sent_via: 'sms', sent_at: new Date().toISOString() })
                .eq('id', estimateId);
              showToast({ message: 'Estimate sent via SMS', type: 'success', duration: 3000 });
            } else {
              const errorMsg = smsError?.message || smsData?.error || 'SMS delivery failed';
              showToast({ message: `Estimate saved but SMS failed: ${errorMsg}`, type: 'error', duration: 5000 });
            }
          } else {
            const smsUrl = Platform.OS === 'ios'
              ? `sms:${phoneNumber}&body=${encodeURIComponent(message)}`
              : `sms:${phoneNumber}?body=${encodeURIComponent(message)}`;

            const canOpen = await Linking.canOpenURL(smsUrl);
            if (canOpen) {
              await Linking.openURL(smsUrl);
              await supabase
                .from('estimates')
                .update({ status: 'sent', sent_via: 'sms', sent_at: new Date().toISOString() })
                .eq('id', estimateId);
              showToast({ message: 'Estimate sent. SMS app opened with PDF link.', type: 'success', duration: 3000 });
            } else {
              showToast({ message: 'Estimate saved but unable to open SMS app', type: 'warning', duration: 4000 });
            }
          }
        } catch (smsError: any) {
          console.error('SMS error:', smsError);
          showToast({
            message: `Estimate saved but SMS failed: ${smsError.message || 'Unknown error'}`,
            type: 'error',
            duration: 5000
          });
        }
      } else {
        showToast({ message: 'Estimate saved', type: 'success' });
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

  const { itemsSubtotal, overallDiscount, subtotal, taxAmount, total, hasMultipleScopes, scopeTotals } = calculateTotals();
  const selectedClient = clients.find(c => c.id === selectedClientId);
  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
    client.email?.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
    client.phone?.toLowerCase().includes(clientSearchQuery.toLowerCase())
  );

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

  const handleEstimateScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
    updateFloatingTotalVisibility();
  };

  const handleScrollViewLayout = (e: LayoutChangeEvent) => {
    scrollViewHeightRef.current = e.nativeEvent.layout.height;
  };

  const handleTotalsSectionLayout = (e: LayoutChangeEvent) => {
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
                {estimate ? 'Edit Estimate' : 'New Estimate'}
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

            <ScrollView style={styles.form} keyboardShouldPersistTaps="handled" onScroll={handleEstimateScroll} scrollEventThrottle={16} onLayout={handleScrollViewLayout}>
              <CollapsibleField
                label="Client"
                fieldId="client"
                activeFieldId={activeFieldId}
                onToggle={toggleField}
                onOpen={() => setShowClientPicker(true)}
                displayValue={selectedClient?.name}
                required
              >
              <View style={styles.inputGroup}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TouchableOpacity
                    style={[styles.picker, { backgroundColor: colors.inputBackground, borderColor: colors.border, flex: 1 }]}
                    onPress={() => setShowClientPicker(!showClientPicker)}
                    disabled={loading}
                  >
                    <Text style={[styles.pickerText, { color: selectedClient ? colors.text : colors.textSecondary }]}>
                      {selectedClient?.name || 'Select a client'}
                    </Text>
                    <ChevronDown size={20} color={colors.textSecondary} />
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
                            setSelectedClientId(client.id);
                            setShowClientPicker(false);
                            setClientSearchQuery('');
                            setSelectedAddressId(null);
                            setClientPaneQuantities([]);
                            setClientPaneTypePrices([]);
                            fetchClientPhotos(client.id);
                            fetchSelectedClientAddresses(client.id).then(resolvedAddressId => {
                              fetchClientPaneQuantities(client.id, resolvedAddressId);
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
                    <AddressAutocomplete
                      value={newClientAddressData}
                      onChange={(data) => {
                        setNewClientAddressData(data);
                        setNewClientAddress(data.fullAddress || buildFullAddress(data.street, data.city, data.state, data.postalCode, data.country));
                      }}
                      organizationId={currentOrganization?.id || ''}
                      label="Address (optional)"
                      showMapButton={false}
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
                          setNewClientAddressData(emptyAddressData);
                        }}
                        disabled={savingClient}
                      >
                        <Text style={[styles.newClientCancelText, { color: colors.textSecondary }]}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.newClientSave, { overflow: 'hidden', padding: 0 }, savingClient && styles.buttonDisabled]}
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
              </View>
              </CollapsibleField>

              {selectedClientId && (
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.text }]}>Service Address</Text>
                  {selectedClientAddresses.length > 0 && (
                    <>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.addressChipsRow}>
                        {selectedClientAddresses.map((addr: any) => {
                          const isActive = selectedAddressId === addr.id;
                          return (
                            <TouchableOpacity
                              key={addr.id}
                              style={[styles.addressChip, isActive && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                              onPress={() => setSelectedAddressId(addr.id)}
                            >
                              <MapPin size={12} color={isActive ? '#fff' : colors.primary} />
                              <Text style={[styles.addressChipText, isActive && { color: '#fff' }]}>{addr.label || 'Primary'}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                      {selectedAddressId && (
                        <Text style={[styles.selectedAddressText, { color: colors.textSecondary }]} numberOfLines={2}>
                          {selectedClientAddresses.find((a: any) => a.id === selectedAddressId)?.address || ''}
                        </Text>
                      )}
                    </>
                  )}
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
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 2, marginTop: 4 }}
                      onPress={() => setShowNewAddressForm(true)}
                    >
                      <Plus size={15} color={colors.primary} />
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary }}>Add new address</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              <CollapsibleField
                label="Validity Period"
                fieldId="validityPeriod"
                activeFieldId={activeFieldId}
                onToggle={toggleField}
                onOpen={() => setShowValidityPeriodPicker(true)}
                displayValue={
                  validityPeriod === '15_days' ? '15 Days' :
                  validityPeriod === '30_days' ? '30 Days' :
                  validityPeriod === '60_days' ? '60 Days' :
                  validityPeriod === '90_days' ? '90 Days' :
                  validityPeriod === '3_months' ? '3 Months' :
                  validityPeriod === 'custom' ? 'Custom' : undefined
                }
              >
              <View style={styles.inputGroup}>
                <TouchableOpacity
                  style={[styles.picker, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                  onPress={() => setShowValidityPeriodPicker(!showValidityPeriodPicker)}
                  disabled={loading}
                >
                  <Text style={[styles.pickerText, { color: colors.text }]}>
                    {validityPeriod === '15_days' && '15 Days'}
                    {validityPeriod === '30_days' && '30 Days'}
                    {validityPeriod === '60_days' && '60 Days'}
                    {validityPeriod === '90_days' && '90 Days'}
                    {validityPeriod === '3_months' && '3 Months'}
                    {validityPeriod === 'custom' && 'Custom'}
                  </Text>
                  <ChevronDown size={20} color={colors.textSecondary} />
                </TouchableOpacity>
                {showValidityPeriodPicker && (
                  <ScrollView style={[styles.pickerList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    {[
                      { value: '15_days', label: '15 Days' },
                      { value: '30_days', label: '30 Days' },
                      { value: '60_days', label: '60 Days' },
                      { value: '90_days', label: '90 Days' },
                      { value: '3_months', label: '3 Months' },
                      { value: 'custom', label: 'Custom' },
                    ].map(period => (
                      <TouchableOpacity
                        key={period.value}
                        style={[styles.pickerItem, { borderBottomColor: colors.border }]}
                        onPress={() => {
                          handleValidityPeriodChange(period.value);
                          toggleField('validityPeriod');
                        }}
                      >
                        <Text style={[styles.pickerItemText, { color: colors.text }]}>{period.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
              </CollapsibleField>

              <CollapsibleField
                label="Issue Date"
                fieldId="issueDate"
                activeFieldId={activeFieldId}
                onToggle={(fieldId) => {
                  toggleField(fieldId);
                  if (activeFieldId !== 'issueDate') {
                    setShowIssueDatePicker(true);
                  }
                }}
                displayValue={issueDate ? new Date(issueDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : undefined}
              >
                <TouchableOpacity
                  style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 8 }]}
                  onPress={() => setShowIssueDatePicker(true)}
                  disabled={loading}
                >
                  <Calendar size={16} color={colors.textSecondary} />
                  <Text style={{ fontSize: 16, color: issueDate ? colors.text : colors.textSecondary }}>
                    {issueDate || 'Select date'}
                  </Text>
                </TouchableOpacity>
              </CollapsibleField>

              <CollapsibleField
                label="Valid Until"
                fieldId="validUntil"
                activeFieldId={activeFieldId}
                onToggle={(fieldId) => {
                  toggleField(fieldId);
                  if (activeFieldId !== 'validUntil') {
                    setShowValidUntilPicker(true);
                  }
                }}
                displayValue={validUntil ? new Date(validUntil + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : undefined}
              >
                <TouchableOpacity
                  style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 8 }]}
                  onPress={() => setShowValidUntilPicker(true)}
                  disabled={loading && validityPeriod !== 'custom'}
                >
                  <Calendar size={16} color={colors.textSecondary} />
                  <Text style={{ fontSize: 16, color: validUntil ? colors.text : colors.textSecondary }}>
                    {validUntil || 'Select date'}
                  </Text>
                </TouchableOpacity>
              </CollapsibleField>

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Line Items</Text>
                  <TouchableOpacity
                    onPress={() => setShowEquipmentEditModal(true)}
                    disabled={loading}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#0369a1' + '12', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: '#0369a1' + '30' }}
                  >
                    <Wrench size={13} color="#0369a1" />
                    <Text style={{ fontSize: 11, fontWeight: '600', color: '#0369a1' }}>Equipment Type</Text>
                  </TouchableOpacity>
                </View>

                {items.map((item, index) => (
                  <View key={`${selectedAddressId || 'no-addr'}-${index}`} style={[styles.itemCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                    <View style={styles.itemHeader}>
                      <View style={styles.itemHeaderLeft}>
                        <Text style={[styles.itemNumber, { color: colors.textSecondary }]}>#{index + 1}</Text>
                        {item.is_optional && (
                          <View style={[styles.optionalBadge, { backgroundColor: colors.warning + '20', borderColor: colors.warning }]}>
                            <Text style={[styles.optionalText, { color: colors.warning }]}>Optional</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.itemActions}>
                        {index > 0 && (
                          <TouchableOpacity onPress={() => moveItem(index, 'up')} style={styles.iconButton}>
                            <ChevronUp size={18} color={colors.textSecondary} />
                          </TouchableOpacity>
                        )}
                        {index < items.length - 1 && (
                          <TouchableOpacity onPress={() => moveItem(index, 'down')} style={styles.iconButton}>
                            <ChevronDown size={18} color={colors.textSecondary} />
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity onPress={() => duplicateItem(index)} style={styles.iconButton}>
                          <Copy size={18} color={colors.primary} />
                        </TouchableOpacity>
                        {items.length > 1 && (
                          <TouchableOpacity onPress={() => removeItem(index)} style={styles.iconButton}>
                            <Trash2 size={18} color={colors.error} />
                          </TouchableOpacity>
                        )}
                      </View>
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
                        const profileCount = isPane ? getClientPaneCount(clientPaneQuantities, jt.id, selectedAddressId) : 0;

                        return (
                          <View style={{ marginBottom: 12, padding: 12, borderRadius: 10, backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.border }}>
                            {/* Standard panes tally */}
                            <View style={{ marginBottom: 10 }}>
                              {/* Label row */}
                              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                <View>
                                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>Standard Panes</Text>
                                  {profileCount > 0 && (
                                    <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>
                                      Client profile: {profileCount}
                                    </Text>
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
                                  <TouchableOpacity
                                    style={[styles.tallyBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                                    onPress={() => updateStandardPaneCount(index, Math.max(0, standardCount - 1))}
                                  >
                                    <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>−</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={[styles.tallyBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                                    onPress={() => updateStandardPaneCount(index, standardCount + 1)}
                                  >
                                    <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>+</Text>
                                  </TouchableOpacity>
                                </View>
                              </View>
                              {/* Add-by-amount row below */}
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                                <TextInput
                                  style={[styles.tallyAddInput, { flex: 1, backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                                  value={tallyInputs[index] ?? ''}
                                  onChangeText={v => setTallyInputs(prev => ({ ...prev, [index]: v.replace(/[^0-9]/g, '') }))}
                                  keyboardType="number-pad"
                                  placeholder="Add amount"
                                  placeholderTextColor={colors.textSecondary}
                                />
                                <TouchableOpacity
                                  style={[styles.tallyBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
                                  onPress={() => {
                                    const val = parseInt(tallyInputs[index] || '0', 10);
                                    if (val > 0) {
                                      updateStandardPaneCount(index, standardCount + val);
                                      setTallyInputs(prev => ({ ...prev, [index]: '' }));
                                    }
                                  }}
                                >
                                  <Plus size={16} color="#fff" />
                                </TouchableOpacity>
                              </View>
                            </View>

                            {/* Active add-on pane types (already selected) */}
                            {PANE_ADDONS.filter(addon => addon.key in addons).map(addon => {
                              const addonCount = addons[addon.key] || 0;
                              const addonDirect = addonDirectInputs[index]?.[addon.key];
                              const addonTally = addonTallyInputs[index]?.[addon.key] ?? '';
                              return (
                                <View key={addon.key} style={{ marginBottom: 10, padding: 10, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                                  {/* Header row with remove button */}
                                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{addon.label}</Text>
                                    <TouchableOpacity
                                      onPress={() => updatePaneAddon(index, addon.key, 0)}
                                      style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.primary, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}
                                    >
                                      <Text style={{ fontSize: 14, color: '#fff', lineHeight: 16, marginTop: -1 }}>×</Text>
                                    </TouchableOpacity>
                                  </View>
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
                                      <TouchableOpacity style={[styles.tallyBtn, { backgroundColor: colors.inputBackground, borderColor: colors.border }]} onPress={() => updatePaneAddon(index, addon.key, Math.max(1, addonCount - 1))}>
                                        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>−</Text>
                                      </TouchableOpacity>
                                      <TouchableOpacity style={[styles.tallyBtn, { backgroundColor: colors.inputBackground, borderColor: colors.border }]} onPress={() => updatePaneAddon(index, addon.key, addonCount + 1)}>
                                        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>+</Text>
                                      </TouchableOpacity>
                                    </View>
                                  </View>
                                  {/* Tally row */}
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                                    <TextInput
                                      style={[styles.tallyAddInput, { flex: 1, backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                                      value={addonTally}
                                      onChangeText={v => setAddonTallyInputs(prev => ({ ...prev, [index]: { ...prev[index], [addon.key]: v.replace(/[^0-9]/g, '') } }))}
                                      keyboardType="number-pad"
                                      placeholder="Add amount"
                                      placeholderTextColor={colors.textSecondary}
                                    />
                                    <TouchableOpacity
                                      style={[styles.tallyBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
                                      onPress={() => {
                                        const val = parseInt(addonTally || '0', 10);
                                        if (val > 0) {
                                          updatePaneAddon(index, addon.key, addonCount + val);
                                          setAddonTallyInputs(prev => ({ ...prev, [index]: { ...prev[index], [addon.key]: '' } }));
                                        }
                                      }}
                                    >
                                      <Plus size={16} color="#fff" />
                                    </TouchableOpacity>
                                  </View>
                                </View>
                              );
                            })}

                            {/* Add other window type button */}
                            {PANE_ADDONS.some(addon => !(addon.key in addons)) && (
                              <View>
                                {showAddonPicker === index ? (
                                  <View style={{ marginTop: 4, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 }}>
                                    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>Add Window Type</Text>
                                    {PANE_ADDONS.filter(addon => !(addon.key in addons)).map(addon => (
                                      <TouchableOpacity
                                        key={addon.key}
                                        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 }}
                                        onPress={() => {
                                          updatePaneAddon(index, addon.key, 1);
                                          setShowAddonPicker(null);
                                        }}
                                      >
                                        <View style={{
                                          width: 20, height: 20, borderRadius: 4, borderWidth: 2,
                                          borderColor: colors.border, backgroundColor: 'transparent',
                                          alignItems: 'center', justifyContent: 'center',
                                        }} />
                                        <Text style={{ fontSize: 13, color: colors.text }}>{addon.label}</Text>
                                      </TouchableOpacity>
                                    ))}
                                    <TouchableOpacity onPress={() => setShowAddonPicker(null)} style={{ marginTop: 4 }}>
                                      <Text style={{ fontSize: 12, color: colors.textSecondary }}>Cancel</Text>
                                    </TouchableOpacity>
                                  </View>
                                ) : (
                                  <TouchableOpacity
                                    onPress={() => setShowAddonPicker(index)}
                                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, paddingVertical: 4 }}
                                  >
                                    <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                                      <Text style={{ fontSize: 14, color: colors.primary, lineHeight: 16, marginTop: -1 }}>+</Text>
                                    </View>
                                    <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '500' }}>Add other window type</Text>
                                  </TouchableOpacity>
                                )}
                              </View>
                            )}

                            {/* Total pane count */}
                            <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
                              {item.pane_details && hasMixedPaneTypes(item.pane_details) && !hasSplitPaneDetails(item.pane_details) && (() => null)()}
                              {item.pane_details && !hasSplitPaneDetails(item.pane_details) && hasMixedPaneTypes(item.pane_details) && (() => {
                                const jt2 = jobTypes.find(j => j.id === item.job_type_id);
                                const scope2 = (item.service_scope as ServiceScope) || 'full_service';
                                const entries2 = Object.entries(item.pane_details).filter(([, v]) => v > 0);
                                if (jt2 && hasPerTypePricing(jt2, item.pane_details)) {
                                  return (
                                    <View style={{ marginBottom: 8 }}>
                                      {entries2.map(([paneType, count]) => {
                                        const price2 = getEffectivePanePriceForType(jt2, paneType as any, scope2);
                                        return (
                                          <View key={paneType} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                                            <Text style={{ fontSize: 12, color: colors.textSecondary, textTransform: 'capitalize' }}>{paneType} × {count} @ ${price2.toFixed(2)}</Text>
                                            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text }}>${(count * price2).toFixed(2)}</Text>
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
                              {(() => {
                                const jt2 = jobTypes.find(j => j.id === item.job_type_id);
                                if (!jt2 || !isPaneJobType(jt2)) return null;
                                const paneTypeKey = (item.pane_type || 'standard') as any;
                                const fullPriceEntry = clientPaneTypePrices.length > 0
                                  ? getEffectivePanePriceWithClientOverride(jt2, paneTypeKey, 'full_service', clientPaneTypePrices, item.job_type_id!, selectedAddressId)
                                  : { price: getEffectivePanePriceForType(jt2, paneTypeKey, 'full_service'), isFlatRate: false };
                                const extPriceEntry = clientPaneTypePrices.length > 0
                                  ? getEffectivePanePriceWithClientOverride(jt2, paneTypeKey, 'exterior_only', clientPaneTypePrices, item.job_type_id!, selectedAddressId)
                                  : { price: getEffectivePanePriceForType(jt2, paneTypeKey, 'exterior_only'), isFlatRate: false };
                                const basePrice = fullPriceEntry.price;
                                const extPrice = extPriceEntry.price;
                                if (basePrice <= 0) return null;
                                const fullTotal = item.quantity * basePrice;
                                const extTotal = item.quantity * extPrice;
                                return (
                                  <View style={{ gap: 3 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                      <Text style={{ fontSize: 11, color: colors.textSecondary }}>Full Service @ ${basePrice.toFixed(2)}/pane</Text>
                                      <Text style={{ fontSize: 11, fontWeight: '600', color: colors.text }}>${fullTotal.toFixed(2)}</Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                      <Text style={{ fontSize: 11, color: colors.textSecondary }}>Exterior Only @ ${extPrice.toFixed(2)}/pane</Text>
                                      <Text style={{ fontSize: 11, fontWeight: '600', color: colors.text }}>${extTotal.toFixed(2)}</Text>
                                    </View>
                                  </View>
                                );
                              })()}
                            </View>

                            {isPane && (() => {
                              const primaryType = (item.pane_details ? (Object.keys(item.pane_details).find(k => k !== 'standard' && (item.pane_details![k] ?? 0) > 0) || 'standard') : 'standard') as any;
                              const globalRate = getPriceForPaneType(jt, primaryType);
                              const clientEntry = clientPaneTypePrices.find(p => p.job_type_id === jt.id && p.pane_type_key === primaryType && (p.address_id === (selectedAddressId || null) || p.address_id === null));
                              const hasCustom = clientEntry != null && (clientEntry.price_per_pane != null || clientEntry.flat_rate_amount != null);
                              const rateDisplay = unitPriceInputs[index] !== undefined ? unitPriceInputs[index] : (clientEntry?.price_per_pane != null ? String(clientEntry.price_per_pane) : '');
                              return (
                                <View style={{ marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>Rate per Pane</Text>
                                    {hasCustom && (
                                      <TouchableOpacity onPress={() => {
                                        setClientPaneTypePrices(prev => prev.filter(p => !(p.job_type_id === jt.id && p.pane_type_key === primaryType)));
                                        setUnitPriceInputs(prev => { const n = { ...prev }; delete n[index]; return n; });
                                        updateItem(index, 'unit_price', getEffectivePanePriceForType(jt, primaryType, (item.service_scope as ServiceScope) || 'full_service'));
                                      }}>
                                        <Text style={{ fontSize: 11, color: colors.primary }}>Reset to default</Text>
                                      </TouchableOpacity>
                                    )}
                                  </View>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, borderWidth: 1, borderColor: hasCustom ? colors.primary : colors.border, borderRadius: 6, backgroundColor: colors.inputBackground, paddingHorizontal: 6, paddingVertical: 3 }}>
                                      <Text style={{ fontSize: 12, color: colors.textSecondary, marginRight: 2 }}>$</Text>
                                      <TextInput
                                        style={{ flex: 1, fontSize: 13, fontWeight: '600', color: colors.text, paddingVertical: 0 }}
                                        value={rateDisplay}
                                        onChangeText={v => setUnitPriceInputs(prev => ({ ...prev, [index]: v.replace(/[^0-9.]/g, '') }))}
                                        onBlur={() => {
                                          const raw = unitPriceInputs[index];
                                          if (raw === undefined) return;
                                          const parsed = parseFloat(raw);
                                          const newRate = isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100;
                                          setUnitPriceInputs(prev => { const n = { ...prev }; delete n[index]; return n; });
                                          const scope = (item.service_scope as ServiceScope) || 'full_service';
                                          const effectiveRate = scope === 'exterior_only' ? newRate * (getExteriorSplitForPaneType(jt, primaryType) / 100) : newRate;
                                          updateItem(index, 'unit_price', effectiveRate);
                                          setClientPaneTypePrices(prev => {
                                            const rest = prev.filter(p => !(p.job_type_id === jt.id && p.pane_type_key === primaryType && (p.address_id === (selectedAddressId || null) || p.address_id === null)));
                                            return [...rest, { job_type_id: jt.id, pane_type_key: primaryType, price_mode: 'per_pane' as const, price_per_pane: newRate, flat_rate_amount: null, address_id: selectedAddressId || null }];
                                          });
                                        }}
                                        placeholder={globalRate > 0 ? globalRate.toFixed(2) : '0.00'}
                                        placeholderTextColor={colors.textSecondary}
                                        keyboardType="decimal-pad"
                                        editable={!loading}
                                      />
                                      <Text style={{ fontSize: 11, color: colors.textSecondary }}>/pane</Text>
                                    </View>
                                    {hasCustom && (
                                      <View style={{ paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, backgroundColor: colors.primary + '18' }}>
                                        <Text style={{ fontSize: 10, fontWeight: '700', color: colors.primary }}>Custom</Text>
                                      </View>
                                    )}
                                  </View>
                                  {!hasCustom && globalRate > 0 && (
                                    <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 4 }}>Default: ${globalRate.toFixed(2)}/pane</Text>
                                  )}
                                </View>
                              );
                            })()}

                            {/* Service scope (only when pane unit) */}
                            {isPane && scopeOptions.length > 1 && (
                              <View style={{ marginTop: 10 }}>
                                <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>Service Scope</Text>
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                  {scopeOptions.map(opt => {
                                    const active = activeScope === opt.value;
                                    return (
                                      <TouchableOpacity
                                        key={opt.value}
                                        onPress={() => updateServiceScope(index, opt.value)}
                                        style={{ flex: 1, paddingVertical: 7, borderRadius: 20, alignItems: 'center', borderWidth: 1.5, borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary : colors.surface }}
                                      >
                                        <Text style={{ fontSize: 11, fontWeight: '600', color: active ? '#fff' : colors.textSecondary }}>{opt.label}</Text>
                                      </TouchableOpacity>
                                    );
                                  })}
                                </View>
                                {activeScope === 'exterior_only' && (
                                  <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 3 }}>
                                    Effective rate: ${item.unit_price.toFixed(2)}/pane
                                  </Text>
                                )}
                                {/* Companion line item toggle — exterior only from full service */}
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
                                {/* Remove companion toggle (when this item has a companion) */}
                                {isPane && item.companion_item_index !== undefined && (() => {
                                  return (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
                                      <Text style={{ fontSize: 13, color: colors.text, fontWeight: '500' }}>Exterior Only line added</Text>
                                      <Switch
                                        value={true}
                                        onValueChange={() => removeCompanionItem(index)}
                                        trackColor={{ false: colors.border, true: colors.primary }}
                                        thumbColor="#fff"
                                      />
                                    </View>
                                  );
                                })()}
                              </View>
                            )}
                          </View>
                        );
                      }

                      return (
                        <View style={{ marginBottom: 12 }}>
                          <Text style={[styles.inputLabel, { color: colors.text }]}>
                            {getJobTypeQuantityLabel(jt)}
                          </Text>
                          <PaneCountStepper
                            value={item.quantity}
                            onChange={v => updateItem(index, 'quantity', v)}
                            disabled={loading}
                          />
                          {isPane && (() => {
                            const scopeOptions2 = SERVICE_SCOPE_OPTIONS.filter(o => {
                              const so2 = jt.scope_options || 'both';
                              if (so2 === 'exterior_only') return o.value === 'exterior_only';
                              return true;
                            });
                            if (scopeOptions2.length <= 1) return null;
                            const so2 = jt.scope_options || 'both';
                            const defaultScope2 = so2 === 'exterior_only' ? 'exterior_only' : 'full_service';
                            const activeScope2 = item.service_scope || defaultScope2;
                            return (
                              <View style={{ marginTop: 8 }}>
                                <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>Service Scope</Text>
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                  {scopeOptions2.map(opt => {
                                    const active = activeScope2 === opt.value;
                                    return (
                                      <TouchableOpacity key={opt.value} onPress={() => updateServiceScope(index, opt.value)} style={{ flex: 1, paddingVertical: 7, borderRadius: 20, alignItems: 'center', borderWidth: 1.5, borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary : colors.inputBackground }}>
                                        <Text style={{ fontSize: 12, fontWeight: '600', color: active ? '#fff' : colors.textSecondary }}>{opt.label}</Text>
                                      </TouchableOpacity>
                                    );
                                  })}
                                </View>
                                {activeScope2 === 'full_service' && item.companion_item_index === undefined && (
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

                    {/* When no job type selected, show generic quantity */}
                    {!item.job_type_id && (
                      <View style={{ marginBottom: 12 }}>
                        <Text style={[styles.inputLabel, { color: colors.text }]}>Quantity</Text>
                        <PaneCountStepper
                          value={item.quantity}
                          onChange={v => updateItem(index, 'quantity', v)}
                          disabled={loading}
                        />
                      </View>
                    )}

                    <TextInput
                      style={[styles.input, styles.descriptionInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                      value={item.description}
                      onChangeText={v => updateItem(index, 'description', v)}
                      placeholder="Item description *"
                      placeholderTextColor={colors.textSecondary}
                      editable={!loading}
                    />

                    {(() => {
                      const jt = jobTypes.find(j => j.id === item.job_type_id);
                      const isPane = jt && isPaneJobType(jt);
                      if (isPane) return null;
                      return (
                        <View style={{ marginTop: 8 }}>
                          <Text style={[styles.inputLabel, { color: colors.text }]}>Rate</Text>
                          <TextInput
                            style={[styles.itemInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                            value={unitPriceInputs[index] !== undefined ? unitPriceInputs[index] : String(item.unit_price)}
                            onChangeText={v => {
                              const cleaned = v.replace(/[^0-9.]/g, '').replace(/^(\d*\.?\d*).*/, '$1');
                              setUnitPriceInputs(prev => ({ ...prev, [index]: cleaned }));
                            }}
                            onBlur={() => {
                              const raw = unitPriceInputs[index];
                              if (raw !== undefined) {
                                const parsed = raw === '' ? 0 : parseFloat(raw) || 0;
                                updateItem(index, 'unit_price', parsed);
                                setUnitPriceInputs(prev => { const n = { ...prev }; delete n[index]; return n; });
                              }
                            }}
                            keyboardType="decimal-pad"
                            editable={!loading}
                            placeholder="0.00"
                            placeholderTextColor={colors.textSecondary}
                          />
                        </View>
                      );
                    })()}

                    <TouchableOpacity
                      style={[styles.expandButton, { borderTopColor: colors.border }]}
                      onPress={() => {
                        const nextVal = expandedItem === index ? null : index;
                        setExpandedItem(nextVal);
                        if (nextVal !== null) {
                          setTimeout(() => expandedDiscountRef.current?.focus(), 200);
                        }
                      }}
                    >
                      <Text style={[styles.expandButtonText, { color: colors.primary }]}>
                        {expandedItem === index ? 'Less Options' : 'More Options (Discount, Notes, Optional)'}
                      </Text>
                      <ChevronDown
                        size={16}
                        color={colors.primary}
                        style={{ transform: [{ rotate: expandedItem === index ? '180deg' : '0deg' }] }}
                      />
                    </TouchableOpacity>

                    {expandedItem === index && (
                      <View style={[styles.expandedSection, { borderTopColor: colors.border }]}>
                        <View style={styles.discountRow}>
                          <View style={styles.discountField}>
                            <Text style={[styles.inputLabel, { color: colors.text }]}>Discount $</Text>
                            <TextInput
                              ref={expandedDiscountRef}
                              style={[styles.itemInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                              value={String(item.discount_amount)}
                              onChangeText={v => {
                                updateItem(index, 'discount_amount', Number(v) || 0);
                                updateItem(index, 'discount_percentage', 0);
                              }}
                              keyboardType="decimal-pad"
                              editable={!loading}
                              placeholder="0.00"
                              placeholderTextColor={colors.textSecondary}
                            />
                          </View>
                          <Text style={[styles.orText, { color: colors.textSecondary }]}>OR</Text>
                          <View style={styles.discountField}>
                            <Text style={[styles.inputLabel, { color: colors.text }]}>Discount %</Text>
                            <TextInput
                              style={[styles.itemInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                              value={String(item.discount_percentage)}
                              onChangeText={v => {
                                updateItem(index, 'discount_percentage', Number(v) || 0);
                                updateItem(index, 'discount_amount', 0);
                              }}
                              keyboardType="decimal-pad"
                              editable={!loading}
                              placeholder="0"
                              placeholderTextColor={colors.textSecondary}
                            />
                          </View>
                        </View>

                        <View style={styles.optionalRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.label, { color: colors.text }]}>Mark as optional item</Text>
                            <Text style={[styles.optionalHint, { color: colors.textSecondary }]}>
                              Optional items will have toggles on the approval page
                            </Text>
                          </View>
                          <Switch
                            value={item.is_optional}
                            onValueChange={v => updateItem(index, 'is_optional', v)}
                            trackColor={{ false: colors.border, true: colors.primary }}
                          />
                        </View>

                        <View style={styles.inputGroup}>
                          <Text style={[styles.label, { color: colors.text }]}>Item Notes</Text>
                          <TextInput
                            style={[styles.input, styles.textArea, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                            value={item.notes}
                            onChangeText={v => updateItem(index, 'notes', v)}
                            placeholder="Additional notes for this item..."
                            placeholderTextColor={colors.textSecondary}
                            multiline
                            numberOfLines={2}
                            editable={!loading}
                          />
                        </View>
                      </View>
                    )}

                    <View style={[styles.itemTotalRow, { borderTopColor: colors.border }]}>
                      <Text style={[styles.itemTotalLabel, { color: colors.textSecondary }]}>Item Total:</Text>
                      {(() => {
                        const jt2 = jobTypes.find(j => j.id === item.job_type_id);
                        const isPane2 = jt2 && isPaneJobType(jt2);
                        if (isPane2) {
                          return (
                            <TextInput
                              style={[styles.itemTotalValue, { color: colors.text, borderWidth: 1, borderColor: colors.border, borderRadius: 6, backgroundColor: colors.inputBackground, paddingHorizontal: 8, paddingVertical: 2, minWidth: 80 }]}
                              value={totalInputTexts[index] !== undefined ? totalInputTexts[index] : calculateItemTotal(item).toFixed(2)}
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
                          <Text style={[styles.itemTotalValue, { color: colors.text }]}>
                            ${calculateItemTotal(item).toFixed(2)}
                          </Text>
                        );
                      })()}
                    </View>
                  </View>
                ))}
                <TouchableOpacity
                  style={[styles.addButton, { overflow: 'hidden', paddingHorizontal: 0, paddingVertical: 0, alignSelf: 'flex-start' }]}
                  onPress={addItem}
                  disabled={loading}
                >
                  <LinearGradient
                    colors={['#1B4D6E', '#245d82']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.gradientAddButton}
                  >
                    <Plus size={16} color="#fff" />
                    <Text style={styles.addButtonText}>Add Item</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              <View style={[styles.totalsSection, { backgroundColor: colors.cardBackground, borderColor: colors.border }]} onLayout={handleTotalsSectionLayout}>
                <View style={styles.totalRow}>
                  <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Items Subtotal</Text>
                  <Text style={[styles.totalValue, { color: colors.text }]}>${itemsSubtotal.toFixed(2)}</Text>
                </View>

                <CollapsibleField
                  label="Discount"
                  fieldId="discount"
                  activeFieldId={activeFieldId}
                  onToggle={toggleField}
                  onOpen={() => setTimeout(() => discountInputRef.current?.focus(), 150)}
                  displayValue={
                    overallDiscountType === 'amount' && Number(overallDiscountAmount) > 0
                      ? `$${Number(overallDiscountAmount).toFixed(2)}`
                      : overallDiscountType === 'percentage' && Number(overallDiscountPercentage) > 0
                      ? `${overallDiscountPercentage}%`
                      : undefined
                  }
                >
                <View style={[styles.discountSection, { borderTopColor: colors.border, borderBottomColor: colors.border }]}>
                  <View style={styles.discountToggle}>
                    <TouchableOpacity
                      style={[
                        styles.discountToggleButton,
                        { borderColor: colors.border },
                        overallDiscountType === 'amount' && { backgroundColor: colors.primary }
                      ]}
                      onPress={() => setOverallDiscountType('amount')}
                    >
                      <DollarSign size={16} color={overallDiscountType === 'amount' ? '#fff' : colors.textSecondary} />
                      <Text style={[styles.discountToggleText, { color: overallDiscountType === 'amount' ? '#fff' : colors.text }]}>
                        Amount
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.discountToggleButton,
                        { borderColor: colors.border },
                        overallDiscountType === 'percentage' && { backgroundColor: colors.primary }
                      ]}
                      onPress={() => setOverallDiscountType('percentage')}
                    >
                      <Percent size={16} color={overallDiscountType === 'percentage' ? '#fff' : colors.textSecondary} />
                      <Text style={[styles.discountToggleText, { color: overallDiscountType === 'percentage' ? '#fff' : colors.text }]}>
                        Percent
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {overallDiscountType === 'amount' ? (
                    <TextInput
                      ref={discountInputRef}
                      style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                      value={overallDiscountAmount}
                      onChangeText={setOverallDiscountAmount}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      placeholderTextColor={colors.textSecondary}
                      editable={!loading}
                    />
                  ) : (
                    <TextInput
                      ref={discountInputRef}
                      style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                      value={overallDiscountPercentage}
                      onChangeText={setOverallDiscountPercentage}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={colors.textSecondary}
                      editable={!loading}
                    />
                  )}
                </View>
                </CollapsibleField>

                {overallDiscount > 0 && (
                  <View style={styles.totalRow}>
                    <Text style={[styles.totalLabel, { color: colors.success }]}>Discount Applied</Text>
                    <Text style={[styles.totalValue, { color: colors.success }]}>-${overallDiscount.toFixed(2)}</Text>
                  </View>
                )}

                {!hasMultipleScopes && (
                  <View style={styles.totalRow}>
                    <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Subtotal After Discount</Text>
                    <Text style={[styles.totalValue, { color: colors.text }]}>${subtotal.toFixed(2)}</Text>
                  </View>
                )}

                <View style={styles.taxRow}>
                  <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Tax Rate (%)</Text>
                  <View style={styles.taxInputRow}>
                    <TextInput
                      style={[styles.taxInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                      value={taxRate}
                      onChangeText={setTaxRate}
                      placeholder="0"
                      keyboardType="decimal-pad"
                      placeholderTextColor={colors.textSecondary}
                      editable={!loading}
                    />
                    {businessSettings?.default_tax_rate > 0 && (
                      <TouchableOpacity
                        style={[styles.taxQuickBtn, { overflow: 'hidden' }]}
                        onPress={() => setTaxRate(businessSettings.default_tax_rate.toString())}
                      >
                        <LinearGradient
                          colors={['#1B4D6E', '#245d82']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.gradientTaxQuickBtn}
                        >
                          <Plus size={14} color="#fff" />
                        </LinearGradient>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {!hasMultipleScopes && (
                  <View style={styles.totalRow}>
                    <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Tax ({taxRate}%)</Text>
                    <Text style={[styles.totalValue, { color: colors.text }]}>${taxAmount.toFixed(2)}</Text>
                  </View>
                )}

                {hasMultipleScopes ? (
                  <>
                    {scopeTotals.map(st => (
                      <View key={st.scope} style={[styles.totalRow, styles.grandTotalRow, { borderTopColor: colors.border }]}>
                        <Text style={[styles.grandTotalLabel, { color: colors.text }]}>{st.label} Total (incl. tax)</Text>
                        <Text style={[styles.grandTotalValue, { color: colors.primary }]}>${st.total.toFixed(2)}</Text>
                      </View>
                    ))}
                  </>
                ) : (
                  <View style={[styles.totalRow, styles.grandTotalRow, { borderTopColor: colors.border }]}>
                    <Text style={[styles.grandTotalLabel, { color: colors.text }]}>Total</Text>
                    <Text style={[styles.grandTotalValue, { color: colors.primary }]}>${total.toFixed(2)}</Text>
                  </View>
                )}
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.labelRow}>
                  <Text style={[styles.label, { color: colors.text }]}>Notes</Text>
                  <AIAssistButton
                    type="estimate_notes"
                    context={{
                      serviceNames: items
                        .map(item => {
                          const jobType = jobTypes.find(jt => jt.id === item.job_type_id);
                          return jobType?.name || item.description;
                        })
                        .filter((name, index, self) => self.indexOf(name) === index),
                      items: items.map(i => i.description),
                      hasMaterials: items.some(item => item.description && item.description.toLowerCase().includes('material'))
                    }}
                    onGenerate={(text) => setNotes(text)}
                    disabled={loading}
                    compact
                  />
                </View>
                <TextInput
                  style={[styles.input, styles.textArea, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Additional notes for this estimate..."
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  numberOfLines={3}
                  editable={!loading}
                />
              </View>

              <CollapsibleField
                label="Memo"
                fieldId="estimate-memo"
                activeFieldId={activeFieldId}
                onToggle={toggleField}
                onOpen={() => setTimeout(() => memoInputRef.current?.focus(), 150)}
                displayValue={memo || undefined}
              >
                <Text style={[styles.label, { color: colors.text }]}>Memo</Text>
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
                  When filled, this replaces the estimate number on the PDF and in email subjects.
                </Text>
              </CollapsibleField>

              <View style={[styles.signatureSection, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                <View style={styles.signatureHeader}>
                  <View style={styles.signatureHeaderLeft}>
                    <PenTool size={20} color={colors.primary} />
                    <Text style={[styles.signatureTitle, { color: colors.text }]}>Client Signature</Text>
                  </View>
                  <Switch
                    value={requiresSignature}
                    onValueChange={setRequiresSignature}
                    trackColor={{ false: colors.border, true: colors.primary }}
                  />
                </View>
                {requiresSignature && (
                  <View style={[styles.signatureInfo, { backgroundColor: colors.primaryLight }]}>
                    <CheckSquare size={16} color={colors.primary} />
                    <Text style={[styles.signatureInfoText, { color: colors.primary }]}>
                      Client will be asked to review, select items, and sign before approval
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

            <View style={fabStyles.footerWrapper}>
              {estimate && selectedClientId && (
                <>
                  {fabOpen && (
                    <Pressable style={fabStyles.fabBackdrop} onPress={closeFab} />
                  )}
                  <View style={fabStyles.fabArea} pointerEvents="box-none">
                    {estimateFabActions.map((action, i) => {
                      const IconComp = action.icon;
                      const translateY = fabAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -(56 * (i + 1))],
                      });
                      const opacity = fabAnim.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [0, 0, 1],
                      });
                      return (
                        <Animated.View
                          key={action.id}
                          style={[fabStyles.fabActionRow, { transform: [{ translateY }], opacity }]}
                          pointerEvents={fabOpen ? 'auto' : 'none'}
                        >
                          <Text style={fabStyles.fabLabel}>{action.label}</Text>
                          <TouchableOpacity
                            style={[fabStyles.fabActionBtn, { overflow: 'hidden' }]}
                            onPress={action.onPress}
                          >
                            <LinearGradient
                              colors={action.gradientColors}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={fabStyles.fabActionBtnGradient}
                            >
                              <IconComp size={18} color="#fff" />
                            </LinearGradient>
                          </TouchableOpacity>
                        </Animated.View>
                      );
                    })}
                    <TouchableOpacity
                      style={[fabStyles.fabMain, { overflow: 'hidden' }]}
                      onPress={toggleFab}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={['#1B4D6E', '#245d82']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={fabStyles.fabMainGradient}
                      >
                        <Animated.View style={{ transform: [{ rotate: fabRotationDeg }] }}>
                          <Plus size={22} color="#fff" strokeWidth={2.5} />
                        </Animated.View>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </>
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
                  style={[styles.saveButton, { overflow: 'hidden', padding: 0 }, loading && styles.buttonDisabled]}
                  onPress={() => handleSave()}
                  disabled={loading}
                >
                  <LinearGradient
                    colors={['#1B4D6E', '#245d82']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.gradientSaveButton}
                  >
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save Draft</Text>}
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sendButton, { overflow: 'hidden', padding: 0 }, loading && styles.buttonDisabled]}
                  onPress={() => setShowSendOptions(true)}
                  disabled={loading}
                >
                  <LinearGradient
                    colors={['#2D8B57', '#34a065']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.gradientSendButton}
                  >
                    <Send size={18} color="#fff" />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>

            <Modal visible={showSendOptions} transparent animationType="fade">
              <View style={styles.sendOverlay}>
                <View style={[styles.sendModal, { backgroundColor: colors.surface }]}>
                  <Text style={[styles.sendTitle, { color: colors.text }]}>Send Estimate</Text>
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

                  {clientPhotos.length > 0 && (
                    <View style={[styles.photoAttachSection, { borderColor: colors.border, backgroundColor: colors.cardBackground }]}>
                      <TouchableOpacity
                        style={styles.photoAttachHeader}
                        onPress={() => setShowPhotoAttach(!showPhotoAttach)}
                        activeOpacity={0.7}
                      >
                        <Images size={18} color={colors.primary} />
                        <Text style={[styles.photoAttachLabel, { color: colors.text }]}>
                          Attach photos {selectedPhotoIds.size > 0 ? `(${selectedPhotoIds.size} selected)` : ''}
                        </Text>
                        {showPhotoAttach ? (
                          <ChevronUp size={16} color={colors.textSecondary} />
                        ) : (
                          <ChevronDown size={16} color={colors.textSecondary} />
                        )}
                      </TouchableOpacity>
                      {showPhotoAttach && (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoAttachScroll}>
                          {clientPhotos.map((photo) => {
                            const isSelected = selectedPhotoIds.has(photo.id);
                            return (
                              <TouchableOpacity
                                key={photo.id}
                                style={[styles.photoThumb, isSelected && { borderColor: colors.primary, borderWidth: 3 }]}
                                onPress={() => {
                                  setSelectedPhotoIds((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(photo.id)) next.delete(photo.id);
                                    else next.add(photo.id);
                                    return next;
                                  });
                                }}
                              >
                                <Image
                                  source={{ uri: photo.annotated_url || photo.photo_url }}
                                  style={styles.photoThumbImg}
                                  resizeMode="cover"
                                />
                                {isSelected && (
                                  <View style={[styles.photoThumbCheck, { backgroundColor: colors.primary }]}>
                                    <Check size={12} color="#fff" />
                                  </View>
                                )}
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      )}
                    </View>
                  )}

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
        title="Issue Date"
        onConfirm={(d) => {
          handleIssueDateChange(d);
          setShowIssueDatePicker(false);
        }}
        onCancel={() => setShowIssueDatePicker(false)}
      />

      <DatePicker
        visible={showValidUntilPicker}
        value={validUntil || issueDate || new Date().toISOString().split('T')[0]}
        title="Valid Until"
        onConfirm={(d) => {
          setValidUntil(d);
          setShowValidUntilPicker(false);
        }}
        onCancel={() => setShowValidUntilPicker(false)}
      />

      <EstimatePreviewModal
        visible={showPreview}
        estimate={showPreview ? {
          estimate_number: estimate?.estimate_number || 'NEW',
          issue_date: issueDate,
          valid_until: validUntil,
          client_name: selectedClient?.name || '',
          client_email: selectedClient?.email || '',
          client_phone: selectedClient?.phone || '',
          client_address: '',
          items: items.filter(i => i.description.trim() || i.job_type_id).map(i => ({ ...i, unit_price: (i.unit_price || (i.quantity > 0 ? Math.round((i.total / i.quantity) * 100) / 100 : 0)) })),
          subtotal: itemsSubtotal,
          tax_rate: Number(taxRate),
          tax_amount: taxAmount,
          discount_amount: overallDiscountType === 'amount' ? Number(overallDiscountAmount) : 0,
          discount_percentage: overallDiscountType === 'percentage' ? Number(overallDiscountPercentage) : 0,
          total,
          notes,
          business_name: businessSettings?.business_name || '',
          business_address: businessSettings?.business_address || '',
          business_phone: businessSettings?.business_phone || '',
          business_email: businessSettings?.business_email || '',
          logo_url: businessSettings?.logo_url || undefined,
        } : null}
        onClose={() => setShowPreview(false)}
        onSend={() => {
          setShowPreview(false);
          setShowSendOptions(true);
        }}
        onDownload={async () => {
          const success = await PDFGenerator.shareEstimatePDF({
            estimate_number: estimate?.estimate_number || 'NEW',
            issue_date: issueDate,
            valid_until: validUntil,
            client_name: selectedClient?.name || '',
            client_email: selectedClient?.email || '',
            client_phone: selectedClient?.phone || '',
            client_address: '',
            items: items.filter(i => i.description.trim() || i.job_type_id),
            subtotal: itemsSubtotal,
            tax_rate: Number(taxRate),
            tax_amount: taxAmount,
            discount_amount: overallDiscountType === 'amount' ? Number(overallDiscountAmount) : 0,
            discount_percentage: overallDiscountType === 'percentage' ? Number(overallDiscountPercentage) : 0,
            total,
            notes,
            business_name: businessSettings?.business_name || '',
            business_address: businessSettings?.business_address || '',
            business_phone: businessSettings?.business_phone || '',
            business_email: businessSettings?.business_email || '',
            logo_url: businessSettings?.logo_url || undefined,
            rounding_settings: businessSettings as PriceRoundingSettings | null,
          });
          if (success) {
            showToast({ message: 'Estimate PDF ready', type: 'success' });
          }
        }}
      />

      <AddressConfirmationModal
        visible={showAddressConfirmation}
        address={detectedLocation?.address || ''}
        onConfirm={handleConfirmAddress}
        onEdit={handleEditAddress}
        onCancel={handleCancelAddress}
      />

      <InvoiceModal
        visible={showInvoiceModal}
        invoice={null}
        onClose={() => setShowInvoiceModal(false)}
        onSave={() => {
          setShowInvoiceModal(false);
          showToast({ message: 'Invoice created from estimate', type: 'success' });
        }}
        prefill={showInvoiceModal && selectedClientId ? {
          clientId: selectedClientId,
          items: items.filter(i => i.description.trim() || i.job_type_id).map(i => ({
            job_type_id: i.job_type_id || undefined,
            description: i.description,
            quantity: i.quantity,
            unit_price: (i.unit_price || (i.quantity > 0 ? Math.round((i.total / i.quantity) * 100) / 100 : 0)),
            total: i.total,
          })),
          notes: notes || undefined,
          taxRate: taxRate || undefined,
        } : undefined}
      />

      {showScheduleModal && (
        <ScheduleModal
          visible={showScheduleModal}
          event={null}
          onClose={() => setShowScheduleModal(false)}
          onSave={() => {
            setShowScheduleModal(false);
            showToast({ message: 'Job scheduled from estimate', type: 'success' });
          }}
          prefillFromEstimate={showScheduleModal && estimate ? {
            estimateId: estimate.id,
            clientId: selectedClientId,
            title: items[0]?.description || '',
            description: notes || '',
            amount: total,
          } : undefined}
          prefillFromClient={showScheduleModal && selectedClientId && !estimate ? (() => {
            const client = clients.find(c => c.id === selectedClientId);
            if (!client) return undefined;
            const selectedAddr = selectedAddressId
              ? selectedClientAddresses.find((a: any) => a.id === selectedAddressId)
              : selectedClientAddresses.find((a: any) => a.is_primary) || selectedClientAddresses[0];
            return {
              clientId: client.id,
              clientName: client.name,
              phone: client.phone,
              email: client.email,
              address: selectedAddr?.address,
              addressId: selectedAddr?.id,
            };
          })() : undefined}
        />
      )}

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
              fetchSelectedClientAddresses(selectedClientId);
            }
            showToast({ message: 'Client updated', type: 'success' });
          }}
        />
      )}
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '95%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  title: { fontSize: 20, fontWeight: 'bold' },
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
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  addButtonText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  itemCard: { borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  itemHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemNumber: { fontSize: 14, fontWeight: '600' },
  optionalBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
  optionalText: { fontSize: 11, fontWeight: '600' },
  itemActions: { flexDirection: 'row', gap: 8 },
  iconButton: { padding: 4 },
  itemControls: { marginBottom: 12 },
  jobTypeSelector: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 12 },
  jobTypeSelectorButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  jobTypeSelectorText: { flex: 1, fontSize: 14, fontWeight: '600' },
  jobTypeButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, borderWidth: 1, alignSelf: 'flex-start' },
  jobTypeButtonText: { fontSize: 13, fontWeight: '600' },
  descriptionInput: { marginBottom: 12, fontSize: 15 },
  itemInputRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  itemInputField: { flex: 1 },
  inputLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  itemInput: { borderRadius: 8, padding: 12, fontSize: 16, borderWidth: 1 },
  tallyFullRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, flexWrap: 'nowrap' as const },
  tallyStackedControls: { flexDirection: 'column' as const, alignItems: 'flex-start' as const, gap: 6 },
  tallyStepperRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  tallyQuickAddRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  tallyBtn: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, alignItems: 'center' as const, justifyContent: 'center' as const, flexShrink: 0 },
  tallyTotal: { width: 45, height: 36, borderRadius: 8, borderWidth: 1, alignItems: 'center' as const, justifyContent: 'center' as const, flexShrink: 0 },
  tallyTotalText: { fontSize: 16, fontWeight: '700' as const },
  tallyAddInput: { minWidth: 44, borderRadius: 8, paddingHorizontal: 8, fontSize: 14, borderWidth: 1, height: 36 },
  tallyAddBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 4, paddingHorizontal: 10, height: 36, borderRadius: 8, flexShrink: 0 },
  tallyAddBtnText: { fontSize: 12, fontWeight: '600' as const, color: '#fff' },
  expandButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingTop: 12, marginTop: 8, borderTopWidth: 1 },
  expandButtonText: { fontSize: 13, fontWeight: '600' },
  expandedSection: { paddingTop: 12, marginTop: 12, borderTopWidth: 1 },
  discountRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginBottom: 12 },
  discountField: { flex: 1 },
  orText: { fontSize: 12, fontWeight: '600', paddingBottom: 12 },
  optionalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  optionalHint: { fontSize: 11, marginTop: 2 },
  itemTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, marginTop: 8, borderTopWidth: 1 },
  itemTotalLabel: { fontSize: 14, fontWeight: '600' },
  itemTotalValue: { fontSize: 18, fontWeight: '700' },
  totalsSection: { borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  totalLabel: { fontSize: 14 },
  totalValue: { fontSize: 14, fontWeight: '500' },
  discountSection: { paddingVertical: 12, marginVertical: 8, borderTopWidth: 1, borderBottomWidth: 1 },
  discountToggle: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  discountToggleButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 10, borderRadius: 8, borderWidth: 1 },
  discountToggleText: { fontSize: 14, fontWeight: '600' },
  taxRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  taxInputRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  taxInput: { width: 80, borderRadius: 6, padding: 8, fontSize: 14, borderWidth: 1, textAlign: 'right' },
  taxQuickBtn: { width: 30, height: 30, borderRadius: 6, alignItems: 'center' as const, justifyContent: 'center' as const },
  grandTotalRow: { borderTopWidth: 2, paddingTop: 12, marginTop: 8, marginBottom: 0 },
  grandTotalLabel: { fontSize: 18, fontWeight: '700' },
  grandTotalValue: { fontSize: 22, fontWeight: '700' },
  floatingTotalBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1 },
  floatingTotalLabel: { fontSize: 16, fontWeight: '700' },
  floatingTotalValue: { fontSize: 20, fontWeight: '700' },
  footer: { flexDirection: 'row', gap: 12, padding: 20, borderTopWidth: 1 },
  cancelButton: { padding: 16, borderRadius: 8, borderWidth: 1, alignItems: 'center' },
  cancelButtonText: { fontSize: 16, fontWeight: '600' },
  saveButton: { flex: 1, padding: 16, borderRadius: 8, alignItems: 'center' },
  saveButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  previewButton: { padding: 16, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  sendButton: { padding: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  buttonDisabled: { opacity: 0.6 },
  errorContainer: { padding: 12, marginHorizontal: 20, marginTop: 12, borderRadius: 8 },
  errorText: { fontSize: 14, textAlign: 'center' },
  sendOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  sendModal: { borderRadius: 16, padding: 24, width: '100%', maxWidth: 400 },
  sendTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 4 },
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
  photoAttachSection: { borderWidth: 1, borderRadius: 12, marginTop: 8, overflow: 'hidden' },
  photoAttachHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  photoAttachLabel: { flex: 1, fontSize: 15, fontWeight: '500' },
  photoAttachScroll: { paddingHorizontal: 12, paddingBottom: 12 },
  photoThumb: { width: 72, height: 72, borderRadius: 8, overflow: 'hidden', marginRight: 8, borderWidth: 2, borderColor: 'transparent' },
  photoThumbImg: { width: '100%', height: '100%' },
  photoThumbCheck: { position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  addClientItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  newClientForm: { marginTop: 12, padding: 16, borderRadius: 12, borderWidth: 1 },
  newClientTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  newClientButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  newClientCancel: { flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, alignItems: 'center' },
  newClientCancelText: { fontSize: 14, fontWeight: '600' },
  newClientSave: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
  newClientSaveText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  addressChipsRow: { flexDirection: 'row', marginBottom: 8 },
  addressChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1B4D6E30',
    backgroundColor: 'transparent',
    marginRight: 8,
  },
  addressChipText: { fontSize: 13, fontWeight: '600', color: '#1B4D6E' },
  selectedAddressText: { fontSize: 12, marginTop: 4, lineHeight: 18 },
  unitPickerList: { maxHeight: 150, borderRadius: 8, borderWidth: 1, marginTop: 8 },
  unitPickerItem: { padding: 12, borderBottomWidth: 1 },
  signatureSection: { borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1 },
  signatureHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  signatureHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  signatureTitle: { fontSize: 16, fontWeight: '600' },
  signatureInfo: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 12, padding: 12, borderRadius: 8 },
  signatureInfoText: { fontSize: 13, flex: 1, lineHeight: 18 },
  gradientPrimary: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, padding: 12 },
  gradientAddButton: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, paddingHorizontal: 12, paddingVertical: 8 },
  gradientTallyAddBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 4, paddingHorizontal: 10, height: 36, borderRadius: 8 },
  gradientTaxQuickBtn: { width: 30, height: 30, borderRadius: 6, alignItems: 'center' as const, justifyContent: 'center' as const },
  gradientSaveButton: { flex: 1, padding: 16, alignItems: 'center' as const, justifyContent: 'center' as const },
  gradientSendButton: { padding: 16, alignItems: 'center' as const, justifyContent: 'center' as const },
});

const fabStyles = StyleSheet.create({
  footerWrapper: {
    position: 'relative',
  },
  fabArea: {
    position: 'absolute',
    bottom: 76,
    right: 20,
    alignItems: 'flex-end',
    zIndex: 100,
  },
  fabBackdrop: {
    position: 'absolute',
    top: -2000,
    left: -2000,
    right: -2000,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.25)',
    zIndex: 90,
  },
  fabActionRow: {
    position: 'absolute',
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fabLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
  fabActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  fabActionBtnGradient: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabMain: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  fabMainGradient: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phonePickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  phonePickerSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32 },
  phonePickerTitle: { fontSize: 16, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  phonePickerOption: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 10 },
  phonePickerOptionLabel: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  phonePickerOptionPhone: { fontSize: 13 },
  phonePickerCancel: { padding: 14, borderRadius: 12, borderWidth: 1, alignItems: 'center', marginTop: 4 },
  phonePickerCancelText: { fontSize: 15, fontWeight: '600' },
});
