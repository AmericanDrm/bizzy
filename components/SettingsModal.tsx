import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Switch,
  TextInput,
  Platform,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Sun, Moon, Smartphone, Users, Calendar, Download, MessageSquare, User, Mail, Phone, Building2, ChevronRight, ChevronDown, Save, KeyRound, LayoutGrid, MapPin, Hop as Home, Circle as HelpCircle, CirclePlay as PlayCircle, Sparkles, FingerprintPattern as Fingerprint, FileText, Lock, Send, LogOut, Globe, HardDriveDownload, Coffee, Plus, Trash2, Bell, Briefcase, Copy, CircleCheck as CheckCircle, Link, Star, CreditCard, Wrench, Tag, RefreshCw, PhoneIncoming, Wallet, Banknote, Receipt, ShieldCheck } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useLayout } from '@/contexts/LayoutContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { BiometricAuth } from '@/lib/biometricAuth';
import {
  getContacts,
  importContactsAsClients,
  fetchGoogleCalendarEvents,
  importCalendarEventsAsSchedule,
  fetchGoogleContacts,
} from '@/lib/imports';
import { jobHistoryService, CrewEfficiencyRule } from '@/lib/jobHistoryService';
import { exportAllData } from '@/lib/dataExportService';
import { STATE_OPTIONS, getTaxRateForState } from '@/lib/taxRates';
import { useOrganization } from '@/contexts/OrganizationContext';
import TeamMemberProductionRatesModal from './TeamMemberProductionRatesModal';
import EquipmentEditModal from './EquipmentEditModal';
import {
  loadSyncSettings,
  saveSyncSettings,
  getDeviceCalendars,
  createBizzyCalendar,
  performFullSync,
  CalendarSyncSettings,
  DeviceCalendar,
  requestCalendarPermissions,
} from '@/lib/calendarSyncService';
import {
  loadCallerIdSettings,
  saveCallerIdSettings,
  getPlatformCapabilities,
} from '@/lib/callerIdService';
import { buildPhoneIndex, getPhoneIndexStats } from '@/lib/phoneIndexService';

const COUNTRY_OPTIONS = [
  { code: 'US', name: 'United States', dialCode: '1' },
  { code: 'CA', name: 'Canada', dialCode: '1' },
  { code: 'GB', name: 'United Kingdom', dialCode: '44' },
  { code: 'AU', name: 'Australia', dialCode: '61' },
  { code: 'NZ', name: 'New Zealand', dialCode: '64' },
  { code: 'DE', name: 'Germany', dialCode: '49' },
  { code: 'FR', name: 'France', dialCode: '33' },
  { code: 'MX', name: 'Mexico', dialCode: '52' },
  { code: 'JP', name: 'Japan', dialCode: '81' },
  { code: 'IN', name: 'India', dialCode: '91' },
  { code: 'BR', name: 'Brazil', dialCode: '55' },
];

interface Profile {
  id: string;
  email: string;
  display_name: string;
  phone: string;
  company_name: string;
}

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenMessageTemplates: () => void;
  onOpenEmailTemplates: () => void;
  onOpenLayoutCustomization: () => void;
  onOpenFAQ: () => void;
  onOpenWalkthrough: () => void;
  onOpenLegal?: () => void;
  onOpenWhatsNew?: () => void;
  onOpenEmailSettings?: () => void;
  onOpenSmsSetup?: () => void;
  onOpenClientPortal?: () => void;
  onOpenJobTypes?: () => void;
  onOpenDocumentTemplates?: () => void;
}

export default function SettingsModal({
  visible,
  onClose,
  onOpenMessageTemplates,
  onOpenEmailTemplates,
  onOpenLayoutCustomization,
  onOpenFAQ,
  onOpenWalkthrough,
  onOpenLegal,
  onOpenWhatsNew,
  onOpenEmailSettings,
  onOpenSmsSetup,
  onOpenClientPortal,
  onOpenJobTypes,
  onOpenDocumentTemplates,
}: SettingsModalProps) {
  const { themeMode, setThemeMode, colors, isDark } = useTheme();
  const { dominantHand, setDominantHand } = useLayout();
  const { user, session, signOut } = useAuth();
  const { showToast } = useToast();
  const { isAdmin, isOwner, isManager } = useUserRole();
  const router = useRouter();
  const { currentOrganization } = useOrganization();
  const [importingContacts, setImportingContacts] = useState(false);
  const [importingCalendar, setImportingCalendar] = useState(false);
  const [importingGoogleContacts, setImportingGoogleContacts] = useState(false);
  const [exportingData, setExportingData] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [profileExpanded, setProfileExpanded] = useState(false);
  const [homeBaseExpanded, setHomeBaseExpanded] = useState(false);
  const [homeBaseAddress, setHomeBaseAddress] = useState('');
  const [geofenceRadius, setGeofenceRadius] = useState('100');
  const [savingHomeBase, setSavingHomeBase] = useState(false);
  const [productionRatesExpanded, setProductionRatesExpanded] = useState(false);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [loadingTeamMembers, setLoadingTeamMembers] = useState(false);
  const [selectedMember, setSelectedMember] = useState<{ id: string; name: string } | null>(null);
  const [productionRatesModalVisible, setProductionRatesModalVisible] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState('Biometric');
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [smsExpanded, setSmsExpanded] = useState(false);
  const [businessExpanded, setBusinessExpanded] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [businessState, setBusinessState] = useState('');
  const [businessCountry, setBusinessCountry] = useState('US');
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [defaultTaxRate, setDefaultTaxRate] = useState('0');
  const [autoApplyTax, setAutoApplyTax] = useState(true);
  const [smartAddressAutofill, setSmartAddressAutofill] = useState(true);
  const [employeeInvoicesHidden, setEmployeeInvoicesHidden] = useState(false);
  const [showStatePicker, setShowStatePicker] = useState(false);
  const [weekStartDay, setWeekStartDay] = useState(0);
  const [businessYearStart, setBusinessYearStart] = useState(1);
  const [loadingBusinessSettings, setLoadingBusinessSettings] = useState(false);
  const [savingBusinessSettings, setSavingBusinessSettings] = useState(false);
  const [googleReviewUrl, setGoogleReviewUrl] = useState('');
  const [notificationRecipient, setNotificationRecipient] = useState<'owner' | 'admins' | 'all'>('owner');
  const [copiedPortalLink, setCopiedPortalLink] = useState(false);
  const [stripePaymentLink, setStripePaymentLink] = useState('');
  const [ccProcessingFeePercent, setCcProcessingFeePercent] = useState('0');
  const [showCcFeeNotice, setShowCcFeeNotice] = useState(false);
  const [priceRoundingEnabled, setPriceRoundingEnabled] = useState(false);
  const [priceRoundingTarget, setPriceRoundingTarget] = useState('1');
  const [priceRoundingCustomAmount, setPriceRoundingCustomAmount] = useState('');
  const [venmoUsername, setVenmoUsername] = useState('');
  const [cashappUsername, setCashappUsername] = useState('');
  const [zelleEmail, setZelleEmail] = useState('');
  const [zellePhone, setZellePhone] = useState('');
  const [checkPayableTo, setCheckPayableTo] = useState('');
  const [checkMailingAddress, setCheckMailingAddress] = useState('');
  const [sendReceiptEmail, setSendReceiptEmail] = useState(true);
  const [includeGoogleReviewOnReceipt, setIncludeGoogleReviewOnReceipt] = useState(false);
  const [includeGoogleReviewOnInvoice, setIncludeGoogleReviewOnInvoice] = useState(false);

  const [dayHours, setDayHours] = useState<{
    mon: { start: string; end: string; open: boolean };
    tue: { start: string; end: string; open: boolean };
    wed: { start: string; end: string; open: boolean };
    thu: { start: string; end: string; open: boolean };
    fri: { start: string; end: string; open: boolean };
    sat: { start: string; end: string; open: boolean };
    sun: { start: string; end: string; open: boolean };
  }>({
    mon: { start: '08:00', end: '17:00', open: true },
    tue: { start: '08:00', end: '17:00', open: true },
    wed: { start: '08:00', end: '17:00', open: true },
    thu: { start: '08:00', end: '17:00', open: true },
    fri: { start: '08:00', end: '17:00', open: true },
    sat: { start: '08:00', end: '17:00', open: false },
    sun: { start: '08:00', end: '17:00', open: false },
  });
  const [savingDayHours, setSavingDayHours] = useState(false);

  const [appearanceExpanded, setAppearanceExpanded] = useState(false);
  const [businessHoursExpanded, setBusinessHoursExpanded] = useState(false);
  const [breakPoliciesExpanded, setBreakPoliciesExpanded] = useState(false);
  const [breakPolicies, setBreakPolicies] = useState<{ id?: string; name: string; duration_minutes: number; notify_on_expiry: boolean; color: string; sort_order: number; isNew?: boolean }[]>([]);
  const [savingBreakPolicies, setSavingBreakPolicies] = useState(false);

  const [equipmentExpanded, setEquipmentExpanded] = useState(false);
  const [equipmentItems, setEquipmentItems] = useState<{ id?: string; name: string; category: string; category_id: string | null; notes: string; is_active: boolean }[]>([]);
  const [loadingEquipment, setLoadingEquipment] = useState(false);
  const [savingEquipment, setSavingEquipment] = useState(false);
  const [newEquipmentName, setNewEquipmentName] = useState('');
  const [newEquipmentCategoryId, setNewEquipmentCategoryId] = useState<string | null>(null);
  const [showEquipmentCategoryPicker, setShowEquipmentCategoryPicker] = useState(false);
  const [jobTypeCategories, setJobTypeCategories] = useState<{ id: string; name: string; color: string }[]>([]);
  const [editingEquipmentId, setEditingEquipmentId] = useState<string | null>(null);
  const [showEquipmentEditModal, setShowEquipmentEditModal] = useState(false);

  const [serviceDescExpanded, setServiceDescExpanded] = useState(false);
  const [scopeDescFullService, setScopeDescFullService] = useState('');
  const [scopeDescExteriorOnly, setScopeDescExteriorOnly] = useState('');
  const [scopeDescInteriorOnly, setScopeDescInteriorOnly] = useState('');
  const [savingScopeDescs, setSavingScopeDescs] = useState(false);

  const [calendarSyncExpanded, setCalendarSyncExpanded] = useState(false);
  const [syncSettings, setSyncSettings] = useState<CalendarSyncSettings | null>(null);
  const [deviceCalendars, setDeviceCalendars] = useState<DeviceCalendar[]>([]);
  const [loadingSyncSettings, setLoadingSyncSettings] = useState(false);
  const [savingSyncSettings, setSavingSyncSettings] = useState(false);
  const [showCalendarPicker, setShowCalendarPicker] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [callerIdExpanded, setCallerIdExpanded] = useState(false);
  const [callerIdEnabled, setCallerIdEnabled] = useState(false);
  const [showPostCallCard, setShowPostCallCard] = useState(true);
  const [autoPrefillSchedule, setAutoPrefillSchedule] = useState(true);
  const [loadingCallerId, setLoadingCallerId] = useState(false);
  const [savingCallerId, setSavingCallerId] = useState(false);
  const [phoneIndexStats, setPhoneIndexStats] = useState<{ entryCount: number; clientCount: number; lastUpdated: string | null }>({ entryCount: 0, clientCount: 0, lastUpdated: null });
  const [rebuildingIndex, setRebuildingIndex] = useState(false);
  const callerIdCapabilities = getPlatformCapabilities();

  const [departureRemindersEnabled, setDepartureRemindersEnabled] = useState(true);
  const [departureBufferMinutes, setDepartureBufferMinutes] = useState(5);
  const [savingDeparturePrefs, setSavingDeparturePrefs] = useState(false);

  useEffect(() => {
    if (visible && user) {
      loadProfile();
      checkBiometricAvailability();
      if (isAdmin || isOwner || isManager) {
        loadBusinessSettings();
        loadBreakPolicies();
      }
    }
  }, [visible, user, isAdmin, isOwner, isManager]);

  useEffect(() => {
    if (productionRatesExpanded && currentOrganization?.id) {
      loadTeamMembers();
    }
  }, [productionRatesExpanded, currentOrganization?.id]);

  useEffect(() => {
    if (calendarSyncExpanded && user?.id) {
      setLoadingSyncSettings(true);
      loadSyncSettings(user.id).then((s) => {
        setSyncSettings(s);
        setLoadingSyncSettings(false);
      });
      if (Platform.OS !== 'web') {
        getDeviceCalendars().then(setDeviceCalendars);
      }
    }
  }, [calendarSyncExpanded, user?.id]);

  useEffect(() => {
    if (equipmentExpanded && currentOrganization?.id) {
      loadEquipmentInventory();
      loadJobTypeCategories();
    }
  }, [equipmentExpanded, currentOrganization?.id]);

  useEffect(() => {
    if (callerIdExpanded && user?.id && currentOrganization?.id) {
      setLoadingCallerId(true);
      loadCallerIdSettings(user.id, currentOrganization.id).then((s) => {
        setCallerIdEnabled(s.enabled);
        setShowPostCallCard(s.showPostCallCard);
        setAutoPrefillSchedule(s.autoPrefillSchedule);
        setLoadingCallerId(false);
      }).catch(() => setLoadingCallerId(false));
      setPhoneIndexStats(getPhoneIndexStats());
    }
  }, [callerIdExpanded, user?.id, currentOrganization?.id]);

  const checkBiometricAvailability = async () => {
    const available = await BiometricAuth.isAvailable();
    setBiometricAvailable(available);
    if (available) {
      const typeName = await BiometricAuth.getBiometricTypeName();
      setBiometricType(typeName);
      const enabled = await BiometricAuth.isEnabled();
      setBiometricEnabled(enabled);
    }
  };

  const handleBiometricToggle = async (value: boolean) => {
    if (value) {
      const success = await BiometricAuth.authenticate(`Enable ${biometricType}`);
      if (success) {
        await BiometricAuth.setEnabled(true);
        setBiometricEnabled(true);
      }
    } else {
      await BiometricAuth.setEnabled(false);
      setBiometricEnabled(false);
    }
  };

  const loadProfile = async () => {
    if (!user) return;
    setLoadingProfile(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setProfile(data);
        setDisplayName(data.display_name || '');
        setPhone(data.phone || '');
        setCompanyName(data.company_name || '');
        setHomeBaseAddress(data.home_base_address || '');
        setGeofenceRadius((data.geofence_radius || 100).toString());
        setDepartureRemindersEnabled(data.departure_reminders_enabled ?? true);
        setDepartureBufferMinutes(data.departure_buffer_minutes ?? 5);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoadingProfile(false);
    }
  };

  const portalUrl = currentOrganization?.slug
    ? `${typeof window !== 'undefined' ? window.location.origin : 'https://yourdomain.com'}/portal/${currentOrganization.slug}`
    : '';

  const handleCopyPortalLink = async () => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(portalUrl);
      setCopiedPortalLink(true);
      setTimeout(() => setCopiedPortalLink(false), 2000);
    }
  };

  const loadBusinessSettings = async () => {
    if (!user) return;
    setLoadingBusinessSettings(true);
    try {
      const { data: orgData } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!orgData?.organization_id) return;

      const { data, error } = await supabase
        .from('business_settings')
        .select('*')
        .eq('organization_id', orgData.organization_id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setBusinessName(data.business_name || '');
        setBusinessEmail(data.business_email || '');
        setBusinessPhone(data.business_phone || '');
        setBusinessAddress(data.business_address || '');
        setBusinessState(data.business_state || '');
        setBusinessCountry(data.business_country || 'US');
        setDefaultTaxRate((data.default_tax_rate ?? 0).toString());
        setAutoApplyTax(data.auto_apply_tax ?? true);
        setWeekStartDay(data.week_start_day ?? 0);
        setBusinessYearStart(data.business_year_start ?? 1);
        setGoogleReviewUrl(data.google_review_url || '');
        setNotificationRecipient(data.notification_recipient || 'owner');
        setStripePaymentLink(data.stripe_payment_link || '');
        setCcProcessingFeePercent((data.cc_processing_fee_percent ?? 0).toString());
        setShowCcFeeNotice(data.show_cc_fee_notice ?? false);
        setPriceRoundingEnabled(data.price_rounding_enabled ?? false);
        setPriceRoundingTarget(data.price_rounding_target || '1');
        setPriceRoundingCustomAmount(data.price_rounding_custom_amount != null ? String(data.price_rounding_custom_amount) : '');
        setScopeDescFullService(data.scope_description_full_service || '');
        setScopeDescExteriorOnly(data.scope_description_exterior_only || '');
        setScopeDescInteriorOnly(data.scope_description_interior_only || '');
        setVenmoUsername(data.venmo_username || '');
        setCashappUsername(data.cashapp_username || '');
        setZelleEmail(data.zelle_email || '');
        setZellePhone(data.zelle_phone || '');
        setCheckPayableTo(data.check_payable_to || '');
        setCheckMailingAddress(data.check_mailing_address || '');
        setSendReceiptEmail(data.send_receipt_email !== false);
        setIncludeGoogleReviewOnReceipt(data.include_google_review_on_receipt ?? false);
        setIncludeGoogleReviewOnInvoice(data.include_google_review_on_invoice ?? false);
        setEmployeeInvoicesHidden(data.employee_invoices_hidden ?? false);

        const toHHMM = (t: string | null) => (t ? t.slice(0, 5) : '08:00');
        setDayHours({
          mon: { start: toHHMM(data.hours_mon_start), end: toHHMM(data.hours_mon_end), open: data.hours_mon_start != null },
          tue: { start: toHHMM(data.hours_tue_start), end: toHHMM(data.hours_tue_end), open: data.hours_tue_start != null },
          wed: { start: toHHMM(data.hours_wed_start), end: toHHMM(data.hours_wed_end), open: data.hours_wed_start != null },
          thu: { start: toHHMM(data.hours_thu_start), end: toHHMM(data.hours_thu_end), open: data.hours_thu_start != null },
          fri: { start: toHHMM(data.hours_fri_start), end: toHHMM(data.hours_fri_end), open: data.hours_fri_start != null },
          sat: { start: toHHMM(data.hours_sat_start ?? '08:00'), end: toHHMM(data.hours_sat_end ?? '17:00'), open: data.hours_sat_start != null },
          sun: { start: toHHMM(data.hours_sun_start ?? '08:00'), end: toHHMM(data.hours_sun_end ?? '17:00'), open: data.hours_sun_start != null },
        });
      }

      const { data: orgDefaults } = await supabase
        .from('organization_defaults')
        .select('smart_address_autofill_enabled')
        .eq('organization_id', orgData.organization_id)
        .maybeSingle();

      if (orgDefaults) {
        setSmartAddressAutofill(orgDefaults.smart_address_autofill_enabled ?? true);
      }
    } catch (error) {
      console.error('Error loading business settings:', error);
    } finally {
      setLoadingBusinessSettings(false);
    }
  };

  const handleSaveBusinessSettings = async () => {
    if (!user) return;
    setSavingBusinessSettings(true);
    try {
      const { data: orgData } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!orgData?.organization_id) {
        throw new Error('Organization not found');
      }

      const { error } = await supabase
        .from('business_settings')
        .upsert({
          organization_id: orgData.organization_id,
          business_name: businessName.trim() || null,
          business_email: businessEmail.trim() || null,
          business_phone: businessPhone.trim() || null,
          business_address: businessAddress.trim() || null,
          business_state: businessState || null,
          business_country: businessCountry || 'US',
          default_tax_rate: Number(defaultTaxRate) || 0,
          auto_apply_tax: autoApplyTax,
          week_start_day: weekStartDay,
          business_year_start: businessYearStart,
          google_review_url: googleReviewUrl.trim() || null,
          notification_recipient: notificationRecipient,
          stripe_payment_link: stripePaymentLink.trim() || null,
          cc_processing_fee_percent: Number(ccProcessingFeePercent) || 0,
          show_cc_fee_notice: showCcFeeNotice,
          price_rounding_enabled: priceRoundingEnabled,
          price_rounding_target: priceRoundingTarget,
          price_rounding_custom_amount: priceRoundingTarget === 'custom' && priceRoundingCustomAmount ? Number(priceRoundingCustomAmount) : null,
          scope_description_full_service: scopeDescFullService.trim(),
          scope_description_exterior_only: scopeDescExteriorOnly.trim(),
          scope_description_interior_only: scopeDescInteriorOnly.trim(),
          venmo_username: venmoUsername.trim() || null,
          cashapp_username: cashappUsername.trim() || null,
          zelle_email: zelleEmail.trim() || null,
          zelle_phone: zellePhone.trim() || null,
          check_payable_to: checkPayableTo.trim() || null,
          check_mailing_address: checkMailingAddress.trim() || null,
          send_receipt_email: sendReceiptEmail,
          include_google_review_on_receipt: includeGoogleReviewOnReceipt,
          include_google_review_on_invoice: includeGoogleReviewOnInvoice,
          employee_invoices_hidden: employeeInvoicesHidden,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'organization_id'
        });

      if (error) throw error;

      await supabase
        .from('organization_defaults')
        .upsert({
          organization_id: orgData.organization_id,
          smart_address_autofill_enabled: smartAddressAutofill,
        }, {
          onConflict: 'organization_id'
        });

      showToast({ message: 'Business settings saved successfully', type: 'success' });
      setBusinessExpanded(false);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save business settings');
    } finally {
      setSavingBusinessSettings(false);
    }
  };

  const handleSaveDayHours = async () => {
    if (!user) return;
    setSavingDayHours(true);
    try {
      const { data: orgData } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!orgData?.organization_id) throw new Error('Organization not found');

      const toDb = (day: { start: string; end: string; open: boolean }) =>
        day.open ? day.start + ':00' : null;

      const { error } = await supabase
        .from('business_settings')
        .upsert({
          organization_id: orgData.organization_id,
          hours_mon_start: toDb(dayHours.mon),
          hours_mon_end: dayHours.mon.open ? dayHours.mon.end + ':00' : null,
          hours_tue_start: toDb(dayHours.tue),
          hours_tue_end: dayHours.tue.open ? dayHours.tue.end + ':00' : null,
          hours_wed_start: toDb(dayHours.wed),
          hours_wed_end: dayHours.wed.open ? dayHours.wed.end + ':00' : null,
          hours_thu_start: toDb(dayHours.thu),
          hours_thu_end: dayHours.thu.open ? dayHours.thu.end + ':00' : null,
          hours_fri_start: toDb(dayHours.fri),
          hours_fri_end: dayHours.fri.open ? dayHours.fri.end + ':00' : null,
          hours_sat_start: toDb(dayHours.sat),
          hours_sat_end: dayHours.sat.open ? dayHours.sat.end + ':00' : null,
          hours_sun_start: toDb(dayHours.sun),
          hours_sun_end: dayHours.sun.open ? dayHours.sun.end + ':00' : null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'organization_id' });
      if (error) throw error;
      showToast({ message: 'Business hours saved', type: 'success' });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save business hours');
    } finally {
      setSavingDayHours(false);
    }
  };

  const handleSaveScopeDescriptions = async () => {
    if (!user) return;
    setSavingScopeDescs(true);
    try {
      const { data: orgData } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!orgData?.organization_id) throw new Error('Organization not found');

      const { error } = await supabase
        .from('business_settings')
        .upsert({
          organization_id: orgData.organization_id,
          scope_description_full_service: scopeDescFullService.trim(),
          scope_description_exterior_only: scopeDescExteriorOnly.trim(),
          scope_description_interior_only: scopeDescInteriorOnly.trim(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'organization_id' });
      if (error) throw error;
      showToast({ message: 'Service descriptions saved', type: 'success' });
      setServiceDescExpanded(false);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save service descriptions');
    } finally {
      setSavingScopeDescs(false);
    }
  };

  const loadBreakPolicies = async () => {
    if (!currentOrganization?.id) return;
    try {
      const { data, error } = await supabase
        .from('break_policies')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      setBreakPolicies((data || []).map((p) => ({
        id: p.id,
        name: p.name,
        duration_minutes: p.duration_minutes,
        notify_on_expiry: p.notify_on_expiry,
        color: p.color,
        sort_order: p.sort_order,
      })));
    } catch (err) {
      console.error('Error loading break policies:', err);
    }
  };

  const handleSaveBreakPolicies = async () => {
    if (!currentOrganization?.id) return;
    setSavingBreakPolicies(true);
    try {
      const existing = breakPolicies.filter((p) => p.id && !p.isNew);
      const toCreate = breakPolicies.filter((p) => !p.id || p.isNew);

      for (const policy of existing) {
        await supabase
          .from('break_policies')
          .update({
            name: policy.name,
            duration_minutes: policy.duration_minutes,
            notify_on_expiry: policy.notify_on_expiry,
            color: policy.color,
            sort_order: policy.sort_order,
            updated_at: new Date().toISOString(),
          })
          .eq('id', policy.id);
      }

      if (toCreate.length > 0) {
        await supabase.from('break_policies').insert(
          toCreate.map((p, i) => ({
            organization_id: currentOrganization.id,
            name: p.name,
            duration_minutes: p.duration_minutes,
            notify_on_expiry: p.notify_on_expiry,
            color: p.color,
            sort_order: existing.length + i,
          }))
        );
      }

      showToast({ message: 'Break policies saved', type: 'success' });
      await loadBreakPolicies();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save break policies');
    } finally {
      setSavingBreakPolicies(false);
    }
  };

  const handleDeleteBreakPolicy = async (index: number) => {
    const policy = breakPolicies[index];
    if (policy.id && !policy.isNew) {
      try {
        await supabase.from('break_policies').delete().eq('id', policy.id);
      } catch (err: any) {
        Alert.alert('Error', err.message || 'Failed to delete break policy');
        return;
      }
    }
    setBreakPolicies((prev) => prev.filter((_, i) => i !== index));
  };

  const loadEquipmentInventory = async () => {
    if (!currentOrganization?.id) return;
    setLoadingEquipment(true);
    try {
      const { data, error } = await supabase
        .from('equipment_inventory')
        .select('id, name, category, category_id, notes, is_active')
        .eq('organization_id', currentOrganization.id)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      setEquipmentItems((data || []).map(e => ({
        id: e.id,
        name: e.name,
        category: e.category || '',
        category_id: e.category_id || null,
        notes: e.notes || '',
        is_active: e.is_active,
      })));
    } catch (err) {
      console.error('Error loading equipment:', err);
    } finally {
      setLoadingEquipment(false);
    }
  };

  const loadJobTypeCategories = async () => {
    if (!currentOrganization?.id) return;
    const { data } = await supabase
      .from('job_type_categories')
      .select('id, name, color')
      .eq('organization_id', currentOrganization.id)
      .order('sort_order')
      .order('name');
    setJobTypeCategories(data || []);
  };

  const handleAddEquipment = async () => {
    if (!newEquipmentName.trim() || !currentOrganization?.id) return;
    setSavingEquipment(true);
    try {
      const { error } = await supabase.from('equipment_inventory').insert({
        organization_id: currentOrganization.id,
        name: newEquipmentName.trim(),
        category_id: newEquipmentCategoryId || null,
        created_by: user?.id,
      });
      if (error) throw error;
      setNewEquipmentName('');
      setNewEquipmentCategoryId(null);
      setShowEquipmentCategoryPicker(false);
      showToast({ message: 'Equipment added', type: 'success' });
      await loadEquipmentInventory();
    } catch (err: any) {
      showToast({ message: err.message || 'Failed to add equipment', type: 'error' });
    } finally {
      setSavingEquipment(false);
    }
  };

  const handleDeleteEquipment = async (id: string) => {
    try {
      const { error } = await supabase
        .from('equipment_inventory')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      setEquipmentItems(prev => prev.filter(e => e.id !== id));
      showToast({ message: 'Equipment removed', type: 'info' });
    } catch (err: any) {
      showToast({ message: err.message || 'Failed to remove', type: 'error' });
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName.trim(),
          phone: phone.trim() || null,
          company_name: companyName.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;
      showToast({ message: 'Profile updated successfully', type: 'success' });
      setProfileExpanded(false);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const loadTeamMembers = async () => {
    if (!currentOrganization?.id) return;
    setLoadingTeamMembers(true);
    try {
      const { data: membersData, error: membersError } = await supabase
        .from('organization_members')
        .select('id, user_id, role')
        .eq('organization_id', currentOrganization.id);

      if (membersError) throw membersError;

      if (!membersData || membersData.length === 0) {
        setTeamMembers([]);
        return;
      }

      const userIds = membersData.map(m => m.user_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, display_name, email')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      const membersWithRates = await Promise.all(
        membersData.map(async (member) => {
          const profile = profilesData?.find(p => p.id === member.user_id);

          const { data: ratesData } = await supabase
            .from('team_member_production_rates')
            .select('id')
            .eq('member_id', member.id)
            .limit(1);

          return {
            id: member.id,
            name: profile?.display_name || profile?.email || 'Unknown',
            role: member.role,
            hasRates: (ratesData?.length || 0) > 0,
          };
        })
      );

      const roleOrder: Record<string, number> = { owner: 1, member: 2, admin: 3 };
      membersWithRates.sort((a, b) => {
        const orderA = roleOrder[a.role] || 999;
        const orderB = roleOrder[b.role] || 999;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      });

      setTeamMembers(membersWithRates);
    } catch (error) {
      console.error('Error loading team members:', error);
    } finally {
      setLoadingTeamMembers(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return;

    Alert.alert(
      'Reset Password',
      `Send password reset email to ${user.email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            setSendingReset(true);
            try {
              const { error } = await supabase.auth.resetPasswordForEmail(
                user.email!,
                {
                  redirectTo: window.location.origin + '/login',
                }
              );
              if (error) throw error;
              Alert.alert(
                'Email Sent',
                'Check your email for the password reset link'
              );
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to send reset email');
            } finally {
              setSendingReset(false);
            }
          },
        },
      ]
    );
  };

  const handleDepartureRemindersToggle = async (value: boolean) => {
    setDepartureRemindersEnabled(value);
    if (!user?.id) return;
    setSavingDeparturePrefs(true);
    try {
      await supabase
        .from('profiles')
        .update({ departure_reminders_enabled: value })
        .eq('id', user.id);
    } catch {} finally {
      setSavingDeparturePrefs(false);
    }
  };

  const handleDepartureBufferChange = async (minutes: number) => {
    setDepartureBufferMinutes(minutes);
    if (!user?.id) return;
    try {
      await supabase
        .from('profiles')
        .update({ departure_buffer_minutes: minutes })
        .eq('id', user.id);
    } catch {}
  };

  const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number } | null> => {
    if (!address.trim()) return null;

    try {
      const encoded = encodeURIComponent(address.trim());
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&limit=1`,
        {
          headers: {
            'User-Agent': 'BusinessToolbox/1.0',
          },
        }
      );

      if (!response.ok) return null;

      const data = await response.json();
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
        };
      }
      return null;
    } catch (error) {
      console.error('Geocoding error:', error);
      return null;
    }
  };

  const handleSaveHomeBase = async () => {
    if (!user) return;

    const radiusNum = parseInt(geofenceRadius, 10);
    if (isNaN(radiusNum) || radiusNum < 10 || radiusNum > 500) {
      Alert.alert('Invalid Radius', 'Geofence radius must be between 10 and 500 meters');
      return;
    }

    setSavingHomeBase(true);
    try {
      let latitude = null;
      let longitude = null;

      if (homeBaseAddress.trim()) {
        const coords = await geocodeAddress(homeBaseAddress);
        if (!coords) {
          Alert.alert('Geocoding Failed', 'Unable to find coordinates for this address');
          setSavingHomeBase(false);
          return;
        }
        latitude = coords.lat;
        longitude = coords.lng;
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          home_base_address: homeBaseAddress.trim() || null,
          home_base_latitude: latitude,
          home_base_longitude: longitude,
          geofence_radius: radiusNum,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;
      showToast({ message: 'Home base settings saved', type: 'success' });
      setHomeBaseExpanded(false);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save home base settings');
    } finally {
      setSavingHomeBase(false);
    }
  };

  const handleImportPhoneContacts = async () => {
    if (!user) return;

    setImportingContacts(true);
    try {
      const contacts = await getContacts();

      if (contacts.length === 0) {
        Alert.alert('No Contacts', 'No contacts found on your device');
        return;
      }

      Alert.alert(
        'Import Contacts',
        `Found ${contacts.length} contacts. Import them as clients?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Import',
            onPress: async () => {
              const result = await importContactsAsClients(contacts, user.id);
              Alert.alert(
                'Import Complete',
                `Successfully imported ${result.success} contacts.${result.failed > 0 ? ` ${result.failed} failed.` : ''}`
              );
            },
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to access contacts');
    } finally {
      setImportingContacts(false);
    }
  };

  const handleToggleCalendarSync = async (enabled: boolean) => {
    if (!user) return;
    if (enabled && Platform.OS === 'web') {
      Alert.alert('Not Available', 'Calendar sync is only available on mobile devices (iOS and Android).');
      return;
    }
    if (enabled) {
      const hasPermission = await requestCalendarPermissions();
      if (!hasPermission) {
        Alert.alert('Permission Required', 'Please grant calendar access to enable sync.');
        return;
      }
      const calendars = await getDeviceCalendars();
      setDeviceCalendars(calendars);
      if (!syncSettings?.device_calendar_id) {
        setShowCalendarPicker(true);
        return;
      }
    }
    const updated: CalendarSyncSettings = {
      ...syncSettings,
      user_id: user.id,
      organization_id: currentOrganization?.id || undefined,
      device_calendar_id: syncSettings?.device_calendar_id || '',
      calendar_name: syncSettings?.calendar_name || '',
      sync_enabled: enabled,
      sync_direction: syncSettings?.sync_direction || 'two_way',
    };
    setSavingSyncSettings(true);
    await saveSyncSettings(updated);
    const fresh = await loadSyncSettings(user.id);
    setSyncSettings(fresh);
    setSavingSyncSettings(false);
    showToast({ message: enabled ? 'Calendar sync enabled' : 'Calendar sync disabled', type: 'success' });
  };

  const handleSelectCalendar = async (calendar: DeviceCalendar) => {
    if (!user) return;
    setShowCalendarPicker(false);
    const updated: CalendarSyncSettings = {
      ...syncSettings,
      user_id: user.id,
      organization_id: currentOrganization?.id || undefined,
      device_calendar_id: calendar.id,
      calendar_name: calendar.title,
      sync_enabled: true,
      sync_direction: syncSettings?.sync_direction || 'two_way',
    };
    setSavingSyncSettings(true);
    await saveSyncSettings(updated);
    const fresh = await loadSyncSettings(user.id);
    setSyncSettings(fresh);
    setSavingSyncSettings(false);
    showToast({ message: `Syncing with "${calendar.title}"`, type: 'success' });
  };

  const handleCreateBizzyCalendar = async () => {
    if (!user) return;
    setShowCalendarPicker(false);
    setSavingSyncSettings(true);
    const calId = await createBizzyCalendar();
    if (!calId) {
      Alert.alert('Error', 'Could not create a Bizzy calendar on this device.');
      setSavingSyncSettings(false);
      return;
    }
    const updated: CalendarSyncSettings = {
      ...syncSettings,
      user_id: user.id,
      organization_id: currentOrganization?.id || undefined,
      device_calendar_id: calId,
      calendar_name: 'Bizzy',
      sync_enabled: true,
      sync_direction: syncSettings?.sync_direction || 'two_way',
    };
    await saveSyncSettings(updated);
    const fresh = await loadSyncSettings(user.id);
    setSyncSettings(fresh);
    setSavingSyncSettings(false);
    showToast({ message: 'Created "Bizzy" calendar and enabled sync', type: 'success' });
  };

  const handleChangeSyncDirection = async (direction: 'two_way' | 'app_to_calendar' | 'calendar_to_app') => {
    if (!user || !syncSettings) return;
    const updated = { ...syncSettings, sync_direction: direction };
    setSavingSyncSettings(true);
    await saveSyncSettings(updated);
    const fresh = await loadSyncSettings(user.id);
    setSyncSettings(fresh);
    setSavingSyncSettings(false);
  };

  const handleSyncNow = async () => {
    if (!user) return;
    setSyncing(true);
    try {
      const result = await performFullSync(user.id);
      if (result) {
        const parts: string[] = [];
        if (result.outbound > 0) parts.push(`${result.outbound} sent to calendar`);
        if (result.inbound.added > 0) parts.push(`${result.inbound.added} imported`);
        if (result.inbound.updated > 0) parts.push(`${result.inbound.updated} updated`);
        if (result.inbound.deleted > 0) parts.push(`${result.inbound.deleted} removed`);
        showToast({
          message: parts.length > 0 ? `Sync complete: ${parts.join(', ')}` : 'Everything is up to date',
          type: 'success',
        });
      } else {
        showToast({ message: 'Sync not enabled', type: 'info' });
      }
    } catch {
      showToast({ message: 'Sync failed', type: 'error' });
    } finally {
      setSyncing(false);
      const fresh = await loadSyncSettings(user!.id);
      setSyncSettings(fresh);
    }
  };

  const handleToggleCallerId = async (enabled: boolean) => {
    if (!user || !currentOrganization?.id) return;
    setCallerIdEnabled(enabled);
    setSavingCallerId(true);
    await saveCallerIdSettings(user.id, currentOrganization.id, {
      enabled,
      showPostCallCard,
      autoPrefillSchedule,
    });
    setSavingCallerId(false);
    if (enabled) {
      showToast({ message: 'Caller ID enabled', type: 'success' });
    }
  };

  const handleTogglePostCallCard = async (val: boolean) => {
    if (!user || !currentOrganization?.id) return;
    setShowPostCallCard(val);
    setSavingCallerId(true);
    await saveCallerIdSettings(user.id, currentOrganization.id, {
      enabled: callerIdEnabled,
      showPostCallCard: val,
      autoPrefillSchedule,
    });
    setSavingCallerId(false);
  };

  const handleToggleAutoPrefill = async (val: boolean) => {
    if (!user || !currentOrganization?.id) return;
    setAutoPrefillSchedule(val);
    setSavingCallerId(true);
    await saveCallerIdSettings(user.id, currentOrganization.id, {
      enabled: callerIdEnabled,
      showPostCallCard,
      autoPrefillSchedule: val,
    });
    setSavingCallerId(false);
  };

  const handleRebuildPhoneIndex = async () => {
    if (!currentOrganization?.id) return;
    setRebuildingIndex(true);
    await buildPhoneIndex(currentOrganization.id);
    setPhoneIndexStats(getPhoneIndexStats());
    setRebuildingIndex(false);
    showToast({ message: 'Phone index rebuilt', type: 'success' });
  };

  const handleImportGoogleCalendar = async () => {
    if (!user || !session) return;

    const accessToken = session.provider_token;
    if (!accessToken) {
      Alert.alert(
        'Google Sign-In Required',
        'Please sign in with Google to import calendar events.'
      );
      return;
    }

    setImportingCalendar(true);
    try {
      const events = await fetchGoogleCalendarEvents(accessToken);

      if (events.length === 0) {
        Alert.alert('No Events', 'No upcoming events found in your calendar');
        return;
      }

      Alert.alert(
        'Import Calendar Events',
        `Found ${events.length} events. Import them to your schedule?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Import',
            onPress: async () => {
              const result = await importCalendarEventsAsSchedule(events, user.id);
              Alert.alert(
                'Import Complete',
                `Successfully imported ${result.success} events.${result.failed > 0 ? ` ${result.failed} failed.` : ''}`
              );
            },
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to fetch calendar events');
    } finally {
      setImportingCalendar(false);
    }
  };

  const handleImportGoogleContacts = async () => {
    if (!user || !session) return;

    const accessToken = session.provider_token;
    if (!accessToken) {
      Alert.alert(
        'Google Sign-In Required',
        'Please sign in with Google to import Google contacts.'
      );
      return;
    }

    setImportingGoogleContacts(true);
    try {
      const contacts = await fetchGoogleContacts(accessToken);

      if (contacts.length === 0) {
        Alert.alert('No Contacts', 'No contacts found in your Google account');
        return;
      }

      Alert.alert(
        'Import Google Contacts',
        `Found ${contacts.length} contacts. Import them as clients?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Import',
            onPress: async () => {
              const result = await importContactsAsClients(contacts, user.id);
              Alert.alert(
                'Import Complete',
                `Successfully imported ${result.success} contacts.${result.failed > 0 ? ` ${result.failed} failed.` : ''}`
              );
            },
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to fetch Google contacts');
    } finally {
      setImportingGoogleContacts(false);
    }
  };

  const handleExportAllData = async () => {
    setExportingData(true);
    try {
      const result = await exportAllData();
      if (!result.success) {
        Alert.alert('Export Failed', result.error || 'Could not export data');
      } else {
        showToast({ message: 'Data exported successfully', type: 'success' });
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to export data');
    } finally {
      setExportingData(false);
    }
  };

  const dynamicStyles = getDynamicStyles(colors);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={dynamicStyles.overlay}>
        <View style={dynamicStyles.modal}>
          <View style={dynamicStyles.header}>
            <Text style={dynamicStyles.title}>Settings</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={dynamicStyles.content}>
            <View style={dynamicStyles.section}>
              <TouchableOpacity
                style={dynamicStyles.sectionHeader}
                onPress={() => setProfileExpanded(!profileExpanded)}
              >
                <View style={dynamicStyles.sectionTitleRow}>
                  <User size={18} color={colors.primary} />
                  <Text style={dynamicStyles.sectionTitle}>Profile</Text>
                </View>
                <ChevronRight
                  size={20}
                  color={colors.textSecondary}
                  style={{ transform: [{ rotate: profileExpanded ? '90deg' : '0deg' }] }}
                />
              </TouchableOpacity>

              {profileExpanded && (
                <View style={dynamicStyles.profileContent}>
                  {loadingProfile ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      <View style={dynamicStyles.inputGroup}>
                        <View style={dynamicStyles.inputLabel}>
                          <Mail size={16} color={colors.textSecondary} />
                          <Text style={dynamicStyles.inputLabelText}>Email</Text>
                        </View>
                        <View style={dynamicStyles.inputDisabled}>
                          <Text style={dynamicStyles.inputDisabledText}>
                            {user?.email || ''}
                          </Text>
                        </View>
                      </View>

                      <View style={dynamicStyles.inputGroup}>
                        <View style={dynamicStyles.inputLabel}>
                          <User size={16} color={colors.textSecondary} />
                          <Text style={dynamicStyles.inputLabelText}>Display Name</Text>
                        </View>
                        <TextInput
                          style={dynamicStyles.input}
                          value={displayName}
                          onChangeText={setDisplayName}
                          placeholder="Your name"
                          placeholderTextColor={colors.textSecondary}
                        />
                      </View>

                      <View style={dynamicStyles.inputGroup}>
                        <View style={dynamicStyles.inputLabel}>
                          <Phone size={16} color={colors.textSecondary} />
                          <Text style={dynamicStyles.inputLabelText}>Phone</Text>
                        </View>
                        <TextInput
                          style={dynamicStyles.input}
                          value={phone}
                          onChangeText={setPhone}
                          placeholder="Your phone number"
                          placeholderTextColor={colors.textSecondary}
                          keyboardType="phone-pad"
                        />
                      </View>

                      <View style={dynamicStyles.inputGroup}>
                        <View style={dynamicStyles.inputLabel}>
                          <Building2 size={16} color={colors.textSecondary} />
                          <Text style={dynamicStyles.inputLabelText}>Company Name</Text>
                        </View>
                        <TextInput
                          style={dynamicStyles.input}
                          value={companyName}
                          onChangeText={setCompanyName}
                          placeholder="Your company name"
                          placeholderTextColor={colors.textSecondary}
                        />
                      </View>

                      <TouchableOpacity
                        style={dynamicStyles.saveButton}
                        onPress={handleSaveProfile}
                        disabled={savingProfile}
                      >
                        <LinearGradient
                          colors={['#1B4D6E', '#245d82']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={dynamicStyles.saveButtonGradient}
                        >
                          {savingProfile ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <>
                              <Save size={18} color="#fff" />
                              <Text style={dynamicStyles.saveButtonText}>Save Profile</Text>
                            </>
                          )}
                        </LinearGradient>
                      </TouchableOpacity>

                      <View style={dynamicStyles.divider} />

                      <TouchableOpacity
                        style={dynamicStyles.resetPasswordButton}
                        onPress={handlePasswordReset}
                        disabled={sendingReset}
                      >
                        {sendingReset ? (
                          <ActivityIndicator size="small" color={colors.error} />
                        ) : (
                          <>
                            <KeyRound size={18} color={colors.error} />
                            <Text style={dynamicStyles.resetPasswordText}>
                              Reset Password
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              )}
            </View>

            {(isAdmin || isOwner || isManager) && (
              <View style={dynamicStyles.section}>
                <Text style={dynamicStyles.sectionTitleSimple}>Administration</Text>

                <TouchableOpacity
                  style={dynamicStyles.sectionHeader}
                  onPress={() => setBusinessExpanded(!businessExpanded)}
                >
                  <View style={dynamicStyles.sectionTitleRow}>
                    <Building2 size={18} color={colors.primary} />
                    <Text style={dynamicStyles.sectionTitle}>Business Settings</Text>
                  </View>
                  <ChevronRight
                    size={20}
                    color={colors.textSecondary}
                    style={{ transform: [{ rotate: businessExpanded ? '90deg' : '0deg' }] }}
                  />
                </TouchableOpacity>

                {businessExpanded && (
                  <View style={dynamicStyles.profileContent}>
                    {loadingBusinessSettings ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <>
                        <Text style={dynamicStyles.helperText}>
                          Configure your organization's business information. The business email will be used when sending invoices and estimates to clients.
                        </Text>

                        <View style={dynamicStyles.inputGroup}>
                          <View style={dynamicStyles.inputLabel}>
                            <Building2 size={16} color={colors.textSecondary} />
                            <Text style={dynamicStyles.inputLabelText}>Business Name</Text>
                          </View>
                          <TextInput
                            style={dynamicStyles.input}
                            value={businessName}
                            onChangeText={setBusinessName}
                            placeholder="Your Business Name"
                            placeholderTextColor={colors.textSecondary}
                          />
                        </View>

                        <View style={dynamicStyles.inputGroup}>
                          <View style={dynamicStyles.inputLabel}>
                            <Mail size={16} color={colors.textSecondary} />
                            <Text style={dynamicStyles.inputLabelText}>Business Email</Text>
                          </View>
                          <TextInput
                            style={dynamicStyles.input}
                            value={businessEmail}
                            onChangeText={setBusinessEmail}
                            placeholder="billing@yourcompany.com"
                            placeholderTextColor={colors.textSecondary}
                            keyboardType="email-address"
                            autoCapitalize="none"
                          />
                          <Text style={dynamicStyles.inputHint}>
                            Used as sender address for invoices and estimates
                          </Text>
                        </View>

                        <View style={dynamicStyles.inputGroup}>
                          <View style={dynamicStyles.inputLabel}>
                            <Phone size={16} color={colors.textSecondary} />
                            <Text style={dynamicStyles.inputLabelText}>Business Phone</Text>
                          </View>
                          <TextInput
                            style={dynamicStyles.input}
                            value={businessPhone}
                            onChangeText={setBusinessPhone}
                            placeholder="(555) 123-4567"
                            placeholderTextColor={colors.textSecondary}
                            keyboardType="phone-pad"
                          />
                        </View>

                        <View style={dynamicStyles.inputGroup}>
                          <View style={dynamicStyles.inputLabel}>
                            <MapPin size={16} color={colors.textSecondary} />
                            <Text style={dynamicStyles.inputLabelText}>Business Address</Text>
                          </View>
                          <TextInput
                            style={dynamicStyles.input}
                            value={businessAddress}
                            onChangeText={setBusinessAddress}
                            placeholder="123 Main St, City, State ZIP"
                            placeholderTextColor={colors.textSecondary}
                            multiline
                          />
                        </View>

                        <View style={dynamicStyles.inputGroup}>
                          <View style={dynamicStyles.inputLabel}>
                            <Globe size={16} color={colors.textSecondary} />
                            <Text style={dynamicStyles.inputLabelText}>Country</Text>
                          </View>
                          <TouchableOpacity
                            style={[dynamicStyles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                            onPress={() => setShowCountryPicker(!showCountryPicker)}
                          >
                            <Text style={{ color: businessCountry ? colors.text : colors.textSecondary, fontSize: 15 }}>
                              {COUNTRY_OPTIONS.find(c => c.code === businessCountry)?.name || businessCountry || 'Select country'}
                            </Text>
                            <ChevronRight size={16} color={colors.textSecondary} style={{ transform: [{ rotate: showCountryPicker ? '90deg' : '0deg' }] }} />
                          </TouchableOpacity>
                          {showCountryPicker && (
                            <ScrollView style={{ maxHeight: 200, borderWidth: 1, borderColor: colors.border, borderRadius: 8, marginTop: 8 }}>
                              {COUNTRY_OPTIONS.map(c => (
                                <TouchableOpacity
                                  key={c.code}
                                  style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: businessCountry === c.code ? colors.primaryLight : 'transparent' }}
                                  onPress={() => {
                                    setBusinessCountry(c.code);
                                    setShowCountryPicker(false);
                                  }}
                                >
                                  <Text style={{ color: businessCountry === c.code ? colors.primary : colors.text, fontSize: 14, fontWeight: businessCountry === c.code ? '600' : '400' }}>
                                    {c.name} (+{c.dialCode})
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </ScrollView>
                          )}
                        </View>

                        <View style={dynamicStyles.inputGroup}>
                          <View style={dynamicStyles.inputLabel}>
                            <MapPin size={16} color={colors.textSecondary} />
                            <Text style={dynamicStyles.inputLabelText}>State</Text>
                          </View>
                          <TouchableOpacity
                            style={[dynamicStyles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                            onPress={() => setShowStatePicker(!showStatePicker)}
                          >
                            <Text style={{ color: businessState ? colors.text : colors.textSecondary, fontSize: 15 }}>
                              {businessState ? STATE_OPTIONS.find(s => s.code === businessState)?.name || businessState : 'Select state for auto tax rate'}
                            </Text>
                            <ChevronRight size={16} color={colors.textSecondary} style={{ transform: [{ rotate: showStatePicker ? '90deg' : '0deg' }] }} />
                          </TouchableOpacity>
                          {showStatePicker && (
                            <ScrollView style={{ maxHeight: 200, borderWidth: 1, borderColor: colors.border, borderRadius: 8, marginTop: 8 }}>
                              <TouchableOpacity
                                style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}
                                onPress={() => {
                                  setBusinessState('');
                                  setDefaultTaxRate('0');
                                  setShowStatePicker(false);
                                }}
                              >
                                <Text style={{ color: colors.textSecondary, fontSize: 14 }}>None</Text>
                              </TouchableOpacity>
                              {STATE_OPTIONS.map(s => (
                                <TouchableOpacity
                                  key={s.code}
                                  style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: businessState === s.code ? colors.primaryLight : 'transparent' }}
                                  onPress={() => {
                                    setBusinessState(s.code);
                                    setDefaultTaxRate(getTaxRateForState(s.code).toString());
                                    setShowStatePicker(false);
                                  }}
                                >
                                  <Text style={{ color: businessState === s.code ? colors.primary : colors.text, fontSize: 14, fontWeight: businessState === s.code ? '600' : '400' }}>
                                    {s.name} ({s.code}) - {getTaxRateForState(s.code)}%
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </ScrollView>
                          )}
                        </View>

                        <View style={dynamicStyles.inputGroup}>
                          <View style={dynamicStyles.inputLabel}>
                            <FileText size={16} color={colors.textSecondary} />
                            <Text style={dynamicStyles.inputLabelText}>Default Tax Rate (%)</Text>
                          </View>
                          <TextInput
                            style={dynamicStyles.input}
                            value={defaultTaxRate}
                            onChangeText={setDefaultTaxRate}
                            placeholder="0"
                            placeholderTextColor={colors.textSecondary}
                            keyboardType="decimal-pad"
                          />
                        </View>

                        <View style={[dynamicStyles.switchRow, { marginBottom: 20 }]}>
                          <View style={{ flex: 1 }}>
                            <Text style={dynamicStyles.switchLabel}>Automatically apply tax to new estimates and invoices</Text>
                            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
                              When enabled, tax will be automatically applied based on your default tax rate. When disabled, you must manually add tax using the "+ Tax" button.
                            </Text>
                          </View>
                          <Switch
                            value={autoApplyTax}
                            onValueChange={setAutoApplyTax}
                            trackColor={{ false: colors.border, true: colors.primary + '80' }}
                            thumbColor={autoApplyTax ? colors.primary : colors.textSecondary}
                          />
                        </View>

                        <View style={dynamicStyles.inputGroup}>
                          <View style={dynamicStyles.inputLabel}>
                            <CreditCard size={16} color={colors.textSecondary} />
                            <Text style={dynamicStyles.inputLabelText}>CC Processing Fee (%)</Text>
                          </View>
                          <TextInput
                            style={dynamicStyles.input}
                            value={ccProcessingFeePercent}
                            onChangeText={setCcProcessingFeePercent}
                            placeholder="0"
                            placeholderTextColor={colors.textSecondary}
                            keyboardType="decimal-pad"
                          />
                          <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
                            Enter the percentage your payment processor charges (e.g. 2.9 for Stripe). When enabled on an invoice, this fee will be added so you receive the full invoiced amount after processing fees.
                          </Text>
                        </View>

                        {Number(ccProcessingFeePercent) > 0 && (
                          <View style={dynamicStyles.inputGroup}>
                            <View style={[dynamicStyles.switchRow, { marginBottom: 0, paddingVertical: 0 }]}>
                              <View style={{ flex: 1 }}>
                                <View style={dynamicStyles.inputLabel}>
                                  <CreditCard size={16} color={colors.textSecondary} />
                                  <Text style={dynamicStyles.inputLabelText}>Show CC Fee Notice to Clients</Text>
                                </View>
                                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
                                  When on, clients will see a prominent notice on invoices, emails, and texts that a card processing fee applies if paying by credit card. Turn off to treat the fee as a silent business expense.
                                </Text>
                              </View>
                              <Switch
                                value={showCcFeeNotice}
                                onValueChange={setShowCcFeeNotice}
                                trackColor={{ false: colors.border, true: colors.primary + '80' }}
                                thumbColor={showCcFeeNotice ? colors.primary : colors.textSecondary}
                              />
                            </View>
                          </View>
                        )}

                        <View style={dynamicStyles.inputGroup}>
                          <View style={[dynamicStyles.switchRow, { marginBottom: 0, paddingVertical: 0 }]}>
                            <View style={{ flex: 1 }}>
                              <View style={dynamicStyles.inputLabel}>
                                <Tag size={16} color={colors.textSecondary} />
                                <Text style={dynamicStyles.inputLabelText}>Round Prices</Text>
                              </View>
                              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
                                Automatically round totals on invoices, estimates, client profiles, and jobs to the nearest amount.
                              </Text>
                            </View>
                            <Switch
                              value={priceRoundingEnabled}
                              onValueChange={setPriceRoundingEnabled}
                              trackColor={{ false: colors.border, true: colors.primary + '80' }}
                              thumbColor={priceRoundingEnabled ? colors.primary : colors.textSecondary}
                            />
                          </View>
                          {priceRoundingEnabled && (
                            <View style={{ marginTop: 12, gap: 8 }}>
                              <Text style={{ fontSize: 13, color: colors.text, fontWeight: '500' }}>Round to nearest:</Text>
                              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                {[
                                  { label: '$1', value: '1' },
                                  { label: '$5', value: '5' },
                                  { label: '$10', value: '10' },
                                  { label: 'Custom', value: 'custom' },
                                ].map((opt) => (
                                  <TouchableOpacity
                                    key={opt.value}
                                    onPress={() => setPriceRoundingTarget(opt.value)}
                                    style={{
                                      paddingHorizontal: 16,
                                      paddingVertical: 8,
                                      borderRadius: 8,
                                      borderWidth: 1.5,
                                      borderColor: priceRoundingTarget === opt.value ? colors.primary : colors.border,
                                      backgroundColor: priceRoundingTarget === opt.value ? colors.primary + '15' : colors.surface,
                                    }}
                                  >
                                    <Text style={{ fontSize: 14, fontWeight: '600', color: priceRoundingTarget === opt.value ? colors.primary : colors.text }}>
                                      {opt.label}
                                    </Text>
                                  </TouchableOpacity>
                                ))}
                              </View>
                              {priceRoundingTarget === 'custom' && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                                  <Text style={{ fontSize: 14, color: colors.text }}>$</Text>
                                  <TextInput
                                    style={[dynamicStyles.input, { flex: 1 }]}
                                    value={priceRoundingCustomAmount}
                                    onChangeText={(v) => setPriceRoundingCustomAmount(v.replace(/[^0-9.]/g, ''))}
                                    placeholder="e.g. 25"
                                    placeholderTextColor={colors.textSecondary}
                                    keyboardType="decimal-pad"
                                  />
                                </View>
                              )}
                              <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: 12, borderWidth: 1, borderColor: colors.border, marginTop: 4 }}>
                                <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Preview:</Text>
                                <Text style={{ fontSize: 13, color: colors.text }}>
                                  $47.51 {'->'} ${(() => {
                                    const inc = priceRoundingTarget === 'custom' ? (Number(priceRoundingCustomAmount) || 1) : Number(priceRoundingTarget);
                                    return (Math.round(47.51 / inc) * inc).toFixed(2);
                                  })()}
                                  {'  |  '}
                                  $123.49 {'->'} ${(() => {
                                    const inc = priceRoundingTarget === 'custom' ? (Number(priceRoundingCustomAmount) || 1) : Number(priceRoundingTarget);
                                    return (Math.round(123.49 / inc) * inc).toFixed(2);
                                  })()}
                                </Text>
                              </View>
                            </View>
                          )}
                        </View>

                        <View style={[dynamicStyles.switchRow, { marginBottom: 20 }]}>
                          <View style={{ flex: 1 }}>
                            <Text style={dynamicStyles.switchLabel}>Smart Address Autofill for Estimates</Text>
                            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
                              When enabled, the app will detect your location when creating estimates and autofill the address if you're not near any existing client addresses.
                            </Text>
                          </View>
                          <Switch
                            value={smartAddressAutofill}
                            onValueChange={setSmartAddressAutofill}
                            trackColor={{ false: colors.border, true: colors.primary + '80' }}
                            thumbColor={smartAddressAutofill ? colors.primary : colors.textSecondary}
                          />
                        </View>

                        {isOwner && (
                          <View style={[dynamicStyles.switchRow, { marginBottom: 20 }]}>
                            <View style={{ flex: 1 }}>
                              <Text style={dynamicStyles.switchLabel}>Hide Invoices from Employees</Text>
                              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
                                When enabled, team members can't view or create invoices. Owners and admins are unaffected.
                              </Text>
                            </View>
                            <Switch
                              value={employeeInvoicesHidden}
                              onValueChange={setEmployeeInvoicesHidden}
                              trackColor={{ false: colors.border, true: colors.primary + '80' }}
                              thumbColor={employeeInvoicesHidden ? colors.primary : colors.textSecondary}
                            />
                          </View>
                        )}

                        {portalUrl ? (
                          <View style={dynamicStyles.inputGroup}>
                            <View style={dynamicStyles.inputLabel}>
                              <Globe size={16} color={colors.textSecondary} />
                              <Text style={dynamicStyles.inputLabelText}>Client Portal Link</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 10, gap: 8 }}>
                              <Text style={{ flex: 1, fontSize: 12, color: colors.textSecondary }} numberOfLines={1}>{portalUrl}</Text>
                              <TouchableOpacity onPress={handleCopyPortalLink} style={{ padding: 4 }}>
                                {copiedPortalLink ? <CheckCircle size={18} color={colors.success} /> : <Copy size={18} color={colors.primary} />}
                              </TouchableOpacity>
                            </View>
                            <Text style={dynamicStyles.inputHint}>
                              Embed this link on your website so clients can book services, view schedules, and send messages.
                            </Text>
                          </View>
                        ) : null}

                        <View style={dynamicStyles.inputGroup}>
                          <View style={dynamicStyles.inputLabel}>
                            <Star size={16} color={colors.textSecondary} />
                            <Text style={dynamicStyles.inputLabelText}>Google Review Link</Text>
                          </View>
                          <TextInput
                            style={dynamicStyles.input}
                            value={googleReviewUrl}
                            onChangeText={setGoogleReviewUrl}
                            placeholder="https://g.page/r/your-business/review"
                            placeholderTextColor={colors.textSecondary}
                            autoCapitalize="none"
                            keyboardType="url"
                          />
                          <Text style={dynamicStyles.inputHint}>
                            Shown on client profiles with a prompt to leave a review after great service.
                          </Text>
                        </View>

                        <View style={dynamicStyles.inputGroup}>
                          <View style={dynamicStyles.inputLabel}>
                            <CreditCard size={16} color={colors.textSecondary} />
                            <Text style={dynamicStyles.inputLabelText}>Stripe Payment Link</Text>
                          </View>
                          <TextInput
                            style={dynamicStyles.input}
                            value={stripePaymentLink}
                            onChangeText={setStripePaymentLink}
                            placeholder="https://buy.stripe.com/..."
                            placeholderTextColor={colors.textSecondary}
                            autoCapitalize="none"
                            keyboardType="url"
                          />
                          <Text style={dynamicStyles.inputHint}>
                            Add your Stripe payment link to include a "Pay Online" button in invoice emails sent to clients.
                          </Text>
                        </View>

                        <View style={{ marginTop: 16, marginBottom: 8, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <Receipt size={18} color={colors.primary} />
                            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>Receipts</Text>
                          </View>
                          <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 12 }}>
                            Receipts are only sent for card payments processed through Stripe.
                          </Text>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                          <View style={{ flex: 1, marginRight: 12 }}>
                            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>Send receipt after card payment</Text>
                            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>Email the client a receipt when an invoice is paid by card</Text>
                          </View>
                          <Switch
                            value={sendReceiptEmail}
                            onValueChange={setSendReceiptEmail}
                            trackColor={{ false: colors.border, true: colors.primary }}
                            thumbColor="#ffffff"
                          />
                        </View>

                        {googleReviewUrl ? (
                          <>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                              <View style={{ flex: 1, marginRight: 12 }}>
                                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>Google review on receipts</Text>
                                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>Include a review request at the bottom of receipt emails</Text>
                              </View>
                              <Switch
                                value={includeGoogleReviewOnReceipt}
                                onValueChange={setIncludeGoogleReviewOnReceipt}
                                trackColor={{ false: colors.border, true: colors.primary }}
                                thumbColor="#ffffff"
                              />
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, marginBottom: 8 }}>
                              <View style={{ flex: 1, marginRight: 12 }}>
                                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>Google review on invoice emails</Text>
                                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>Include a review request at the bottom of invoice emails</Text>
                              </View>
                              <Switch
                                value={includeGoogleReviewOnInvoice}
                                onValueChange={setIncludeGoogleReviewOnInvoice}
                                trackColor={{ false: colors.border, true: colors.primary }}
                                thumbColor="#ffffff"
                              />
                            </View>
                          </>
                        ) : (
                          <View style={{ paddingVertical: 10, marginBottom: 8 }}>
                            <Text style={{ fontSize: 12, color: colors.textSecondary, fontStyle: 'italic' }}>
                              Add a Google Review Link above to enable review prompts on receipts and invoice emails.
                            </Text>
                          </View>
                        )}

                        <View style={{ marginTop: 8, marginBottom: 8, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <Wallet size={18} color={colors.primary} />
                            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>Payment Methods</Text>
                          </View>
                          <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 12 }}>
                            Only configured methods will appear on invoice emails and PDFs. Non-card methods show the total without the CC processing fee.
                          </Text>
                        </View>

                        <View style={dynamicStyles.inputGroup}>
                          <View style={dynamicStyles.inputLabel}>
                            <Banknote size={16} color={colors.textSecondary} />
                            <Text style={dynamicStyles.inputLabelText}>Venmo Username</Text>
                          </View>
                          <TextInput
                            style={dynamicStyles.input}
                            value={venmoUsername}
                            onChangeText={setVenmoUsername}
                            placeholder="@YourBusiness"
                            placeholderTextColor={colors.textSecondary}
                            autoCapitalize="none"
                          />
                        </View>

                        <View style={dynamicStyles.inputGroup}>
                          <View style={dynamicStyles.inputLabel}>
                            <Banknote size={16} color={colors.textSecondary} />
                            <Text style={dynamicStyles.inputLabelText}>Cash App</Text>
                          </View>
                          <TextInput
                            style={dynamicStyles.input}
                            value={cashappUsername}
                            onChangeText={setCashappUsername}
                            placeholder="$YourBusiness"
                            placeholderTextColor={colors.textSecondary}
                            autoCapitalize="none"
                          />
                        </View>

                        <View style={dynamicStyles.inputGroup}>
                          <View style={dynamicStyles.inputLabel}>
                            <Mail size={16} color={colors.textSecondary} />
                            <Text style={dynamicStyles.inputLabelText}>Zelle Email</Text>
                          </View>
                          <TextInput
                            style={dynamicStyles.input}
                            value={zelleEmail}
                            onChangeText={setZelleEmail}
                            placeholder="payments@yourbusiness.com"
                            placeholderTextColor={colors.textSecondary}
                            autoCapitalize="none"
                            keyboardType="email-address"
                          />
                        </View>

                        <View style={dynamicStyles.inputGroup}>
                          <View style={dynamicStyles.inputLabel}>
                            <Phone size={16} color={colors.textSecondary} />
                            <Text style={dynamicStyles.inputLabelText}>Zelle Phone</Text>
                          </View>
                          <TextInput
                            style={dynamicStyles.input}
                            value={zellePhone}
                            onChangeText={setZellePhone}
                            placeholder="(555) 123-4567"
                            placeholderTextColor={colors.textSecondary}
                            keyboardType="phone-pad"
                          />
                        </View>

                        <View style={dynamicStyles.inputGroup}>
                          <View style={dynamicStyles.inputLabel}>
                            <FileText size={16} color={colors.textSecondary} />
                            <Text style={dynamicStyles.inputLabelText}>Check Payable To</Text>
                          </View>
                          <TextInput
                            style={dynamicStyles.input}
                            value={checkPayableTo}
                            onChangeText={setCheckPayableTo}
                            placeholder="Your Business Name"
                            placeholderTextColor={colors.textSecondary}
                          />
                        </View>

                        <View style={dynamicStyles.inputGroup}>
                          <View style={dynamicStyles.inputLabel}>
                            <MapPin size={16} color={colors.textSecondary} />
                            <Text style={dynamicStyles.inputLabelText}>Check Mailing Address</Text>
                          </View>
                          <TextInput
                            style={[dynamicStyles.input, { minHeight: 60, textAlignVertical: 'top' }]}
                            value={checkMailingAddress}
                            onChangeText={setCheckMailingAddress}
                            placeholder="123 Main St, Suite 100, City, ST 12345"
                            placeholderTextColor={colors.textSecondary}
                            multiline
                            numberOfLines={3}
                          />
                        </View>

                        <View style={dynamicStyles.inputGroup}>
                          <View style={dynamicStyles.inputLabel}>
                            <Bell size={16} color={colors.textSecondary} />
                            <Text style={dynamicStyles.inputLabelText}>Portal Notification Recipient</Text>
                          </View>
                          <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 10 }}>
                            Who receives notifications when a client sends a message or submits a work request.
                          </Text>
                          {(['owner', 'admins', 'all'] as const).map((option) => (
                            <TouchableOpacity
                              key={option}
                              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}
                              onPress={() => setNotificationRecipient(option)}
                            >
                              <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: notificationRecipient === option ? colors.primary : colors.border, alignItems: 'center', justifyContent: 'center' }}>
                                {notificationRecipient === option && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary }} />}
                              </View>
                              <View>
                                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, textTransform: 'capitalize' }}>
                                  {option === 'admins' ? 'Admins & Owner' : option === 'all' ? 'All Team Members' : 'Owner Only'}
                                </Text>
                                <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                                  {option === 'owner' ? 'Only the organization owner is notified' : option === 'admins' ? 'Owner and all admins are notified' : 'Every team member receives notifications'}
                                </Text>
                              </View>
                            </TouchableOpacity>
                          ))}
                        </View>

                        <TouchableOpacity
                          style={dynamicStyles.saveButton}
                          onPress={handleSaveBusinessSettings}
                          disabled={savingBusinessSettings}
                        >
                          <LinearGradient
                            colors={['#1B4D6E', '#245d82']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={dynamicStyles.saveButtonGradient}
                          >
                            {savingBusinessSettings ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <>
                                <Save size={18} color="#fff" />
                                <Text style={dynamicStyles.saveButtonText}>Save Business Settings</Text>
                              </>
                            )}
                          </LinearGradient>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                )}

                <TouchableOpacity
                  style={dynamicStyles.sectionHeader}
                  onPress={() => setServiceDescExpanded(!serviceDescExpanded)}
                >
                  <View style={dynamicStyles.sectionTitleRow}>
                    <FileText size={18} color={colors.primary} />
                    <Text style={dynamicStyles.sectionTitle}>Service Descriptions</Text>
                  </View>
                  <ChevronRight
                    size={20}
                    color={colors.textSecondary}
                    style={{ transform: [{ rotate: serviceDescExpanded ? '90deg' : '0deg' }] }}
                  />
                </TouchableOpacity>

                {serviceDescExpanded && (
                  <View style={dynamicStyles.profileContent}>
                    <Text style={[dynamicStyles.helperText, { marginBottom: 12 }]}>
                      Set default descriptions for each service scope. These will auto-fill when creating invoices and estimates.
                    </Text>

                    <View style={dynamicStyles.inputGroup}>
                      <Text style={dynamicStyles.inputLabel}>Full Service</Text>
                      <TextInput
                        style={[dynamicStyles.input, { minHeight: 60, textAlignVertical: 'top' }]}
                        value={scopeDescFullService}
                        onChangeText={setScopeDescFullService}
                        placeholder="e.g., Complete interior and exterior window cleaning"
                        placeholderTextColor={colors.textSecondary}
                        multiline
                      />
                    </View>

                    <View style={dynamicStyles.inputGroup}>
                      <Text style={dynamicStyles.inputLabel}>Exterior Only</Text>
                      <TextInput
                        style={[dynamicStyles.input, { minHeight: 60, textAlignVertical: 'top' }]}
                        value={scopeDescExteriorOnly}
                        onChangeText={setScopeDescExteriorOnly}
                        placeholder="e.g., Exterior window cleaning only"
                        placeholderTextColor={colors.textSecondary}
                        multiline
                      />
                    </View>

                    <View style={dynamicStyles.inputGroup}>
                      <Text style={dynamicStyles.inputLabel}>Interior Only</Text>
                      <TextInput
                        style={[dynamicStyles.input, { minHeight: 60, textAlignVertical: 'top' }]}
                        value={scopeDescInteriorOnly}
                        onChangeText={setScopeDescInteriorOnly}
                        placeholder="e.g., Interior window cleaning only"
                        placeholderTextColor={colors.textSecondary}
                        multiline
                      />
                    </View>

                    <TouchableOpacity
                      style={[dynamicStyles.saveButton, savingScopeDescs && { opacity: 0.6 }]}
                      onPress={handleSaveScopeDescriptions}
                      disabled={savingScopeDescs}
                    >
                      <LinearGradient
                        colors={['#1B4D6E', '#245d82']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={dynamicStyles.saveButtonGradient}
                      >
                        {savingScopeDescs ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Save size={16} color="#fff" style={{ marginRight: 6 }} />
                            <Text style={dynamicStyles.saveButtonText}>Save Service Descriptions</Text>
                          </>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                )}

                <TouchableOpacity
                  style={dynamicStyles.sectionHeader}
                  onPress={() => setBreakPoliciesExpanded(!breakPoliciesExpanded)}
                >
                  <View style={dynamicStyles.sectionTitleRow}>
                    <Coffee size={18} color={colors.primary} />
                    <Text style={dynamicStyles.sectionTitle}>Break Policies</Text>
                  </View>
                  <ChevronRight
                    size={20}
                    color={colors.textSecondary}
                    style={{ transform: [{ rotate: breakPoliciesExpanded ? '90deg' : '0deg' }] }}
                  />
                </TouchableOpacity>

                {breakPoliciesExpanded && (
                  <View style={dynamicStyles.profileContent}>
                    <Text style={[dynamicStyles.helperText, { marginBottom: 12 }]}>
                      Define break types and durations. When a team member starts a break, they can select the type — and receive a push notification when time is up.
                    </Text>

                    {breakPolicies.length === 0 && (
                      <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 8 }}>
                        No break policies yet. Add one below.
                      </Text>
                    )}

                    {breakPolicies.map((policy, index) => (
                      <View key={index} style={{ backgroundColor: colors.inputBackground, borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: colors.border }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: policy.color }} />
                            <TextInput
                              style={[dynamicStyles.input, { flex: 1, marginBottom: 0, height: 36, paddingVertical: 4 }]}
                              value={policy.name}
                              onChangeText={(v) => setBreakPolicies((prev) => prev.map((p, i) => i === index ? { ...p, name: v } : p))}
                              placeholder="Break name (e.g. Lunch)"
                              placeholderTextColor={colors.textSecondary}
                            />
                          </View>
                          <TouchableOpacity
                            onPress={() => handleDeleteBreakPolicy(index)}
                            style={{ marginLeft: 8, padding: 4 }}
                          >
                            <Trash2 size={16} color="#ef4444" />
                          </TouchableOpacity>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <Text style={{ color: colors.textSecondary, fontSize: 13, width: 90 }}>Duration (min)</Text>
                          <TextInput
                            style={[dynamicStyles.input, { flex: 1, marginBottom: 0, height: 36, paddingVertical: 4 }]}
                            value={String(policy.duration_minutes)}
                            onChangeText={(v) => setBreakPolicies((prev) => prev.map((p, i) => i === index ? { ...p, duration_minutes: parseInt(v) || 0 } : p))}
                            keyboardType="numeric"
                            placeholder="15"
                            placeholderTextColor={colors.textSecondary}
                          />
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Bell size={14} color={colors.textSecondary} />
                            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Notify when expired</Text>
                          </View>
                          <Switch
                            value={policy.notify_on_expiry}
                            onValueChange={(v) => setBreakPolicies((prev) => prev.map((p, i) => i === index ? { ...p, notify_on_expiry: v } : p))}
                            trackColor={{ false: colors.border, true: colors.primary + '80' }}
                            thumbColor={policy.notify_on_expiry ? colors.primary : colors.textSecondary}
                          />
                        </View>
                      </View>
                    ))}

                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, marginBottom: 12 }}
                      onPress={() => setBreakPolicies((prev) => [...prev, { name: '', duration_minutes: 15, notify_on_expiry: true, color: '#4A90A4', sort_order: prev.length, isNew: true }])}
                    >
                      <Plus size={16} color={colors.primary} />
                      <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>Add Break Type</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={dynamicStyles.saveButton}
                      onPress={handleSaveBreakPolicies}
                      disabled={savingBreakPolicies}
                    >
                      <LinearGradient
                        colors={['#1B4D6E', '#245d82']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={dynamicStyles.saveButtonGradient}
                      >
                        {savingBreakPolicies ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Save size={18} color="#fff" />
                            <Text style={dynamicStyles.saveButtonText}>Save Break Policies</Text>
                          </>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                )}

                <TouchableOpacity
                  style={dynamicStyles.sectionHeader}
                  onPress={() => setEquipmentExpanded(!equipmentExpanded)}
                >
                  <View style={dynamicStyles.sectionTitleRow}>
                    <Wrench size={18} color={colors.primary} />
                    <Text style={dynamicStyles.sectionTitle}>Tools & Equipment</Text>
                  </View>
                  <ChevronRight
                    size={20}
                    color={colors.textSecondary}
                    style={{ transform: [{ rotate: equipmentExpanded ? '90deg' : '0deg' }] }}
                  />
                </TouchableOpacity>

                {equipmentExpanded && (
                  <View style={dynamicStyles.profileContent}>
                    <Text style={dynamicStyles.helperText}>
                      {"Add tools and equipment your business uses. Link them to a job type tag so they auto-appear on client profiles that have that tag."}
                    </Text>

                    <View style={{ gap: 8, marginBottom: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: 8 }}>
                        <View style={{ flex: 1 }}>
                          <TextInput
                            style={dynamicStyles.input}
                            placeholder="Tool / equipment name"
                            placeholderTextColor={colors.textSecondary}
                            value={newEquipmentName}
                            onChangeText={setNewEquipmentName}
                          />
                        </View>
                        <TouchableOpacity
                          style={{
                            borderRadius: 8,
                            alignItems: 'center' as const,
                            justifyContent: 'center' as const,
                            overflow: 'hidden' as const,
                          }}
                          onPress={handleAddEquipment}
                          disabled={savingEquipment || !newEquipmentName.trim()}
                        >
                          <LinearGradient
                            colors={['#1B4D6E', '#245d82']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={{
                              alignItems: 'center' as const,
                              justifyContent: 'center' as const,
                              paddingHorizontal: 14,
                              paddingVertical: 14,
                            }}
                          >
                            {savingEquipment ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <Plus size={18} color="#fff" />
                            )}
                          </LinearGradient>
                        </TouchableOpacity>
                      </View>
                      {jobTypeCategories.length > 0 && (
                        <View>
                          <TouchableOpacity
                            style={[dynamicStyles.input, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}
                            onPress={() => setShowEquipmentCategoryPicker(!showEquipmentCategoryPicker)}
                          >
                            <Tag size={16} color={colors.textSecondary} />
                            <Text style={{ flex: 1, fontSize: 14, color: newEquipmentCategoryId ? colors.text : colors.textSecondary }}>
                              {newEquipmentCategoryId
                                ? jobTypeCategories.find(c => c.id === newEquipmentCategoryId)?.name || 'Select tag'
                                : 'Link to job type tag (optional)'}
                            </Text>
                            <ChevronRight size={16} color={colors.textSecondary} style={{ transform: [{ rotate: showEquipmentCategoryPicker ? '90deg' : '0deg' }] }} />
                          </TouchableOpacity>
                          {showEquipmentCategoryPicker && (
                            <View style={{ backgroundColor: colors.inputBackground, borderRadius: 8, borderWidth: 1, borderColor: colors.border, marginTop: 4, maxHeight: 180, overflow: 'hidden' }}>
                              <ScrollView nestedScrollEnabled>
                                <TouchableOpacity
                                  style={{ paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}
                                  onPress={() => { setNewEquipmentCategoryId(null); setShowEquipmentCategoryPicker(false); }}
                                >
                                  <Text style={{ fontSize: 14, color: colors.textSecondary }}>{"None (no tag)"}</Text>
                                </TouchableOpacity>
                                {jobTypeCategories.map(cat => (
                                  <TouchableOpacity
                                    key={cat.id}
                                    style={[
                                      { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
                                      newEquipmentCategoryId === cat.id && { backgroundColor: colors.primary + '10' },
                                    ]}
                                    onPress={() => { setNewEquipmentCategoryId(cat.id); setShowEquipmentCategoryPicker(false); }}
                                  >
                                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: cat.color }} />
                                    <Text style={{ fontSize: 14, color: colors.text, fontWeight: newEquipmentCategoryId === cat.id ? '600' : '400' }}>{cat.name}</Text>
                                  </TouchableOpacity>
                                ))}
                              </ScrollView>
                            </View>
                          )}
                        </View>
                      )}
                    </View>

                    {loadingEquipment ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : equipmentItems.length === 0 ? (
                      <Text style={dynamicStyles.emptyText}>
                        {"No equipment added yet. Add tools and equipment above."}
                      </Text>
                    ) : (
                      <View>
                        {equipmentItems.map((item) => {
                          const linkedCat = item.category_id ? jobTypeCategories.find(c => c.id === item.category_id) : null;
                          return (
                            <TouchableOpacity
                              key={item.id}
                              activeOpacity={0.7}
                              onPress={() => {
                                if (item.id) {
                                  setEditingEquipmentId(item.id);
                                  setShowEquipmentEditModal(true);
                                }
                              }}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                backgroundColor: colors.inputBackground,
                                borderRadius: 10,
                                paddingHorizontal: 14,
                                paddingVertical: 11,
                                marginBottom: 4,
                                borderWidth: 1,
                                borderColor: colors.border,
                              }}
                            >
                              <Wrench size={16} color={colors.textSecondary} />
                              <View style={{ flex: 1, marginLeft: 10 }}>
                                <Text style={{ fontSize: 14, fontWeight: '500', color: colors.text }}>
                                  {item.name}
                                </Text>
                                {linkedCat ? (
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: linkedCat.color }} />
                                    <Text style={{ fontSize: 11, color: colors.textSecondary }}>{linkedCat.name}</Text>
                                  </View>
                                ) : null}
                              </View>
                              <ChevronRight size={16} color={colors.textSecondary} />
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>
                )}

                <TouchableOpacity
                  style={dynamicStyles.sectionHeader}
                  onPress={() => setHomeBaseExpanded(!homeBaseExpanded)}
                >
                  <View style={dynamicStyles.sectionTitleRow}>
                    <Home size={18} color={colors.primary} />
                    <Text style={dynamicStyles.sectionTitle}>Home Base & Tracking</Text>
                  </View>
                  <ChevronRight
                    size={20}
                    color={colors.textSecondary}
                    style={{ transform: [{ rotate: homeBaseExpanded ? '90deg' : '0deg' }] }}
                  />
                </TouchableOpacity>

              {homeBaseExpanded && (
                <View style={dynamicStyles.profileContent}>
                  <Text style={dynamicStyles.helperText}>
                    Set your home base location for productivity tracking. The app will track when you arrive at and leave job sites.
                  </Text>

                  <View style={dynamicStyles.inputGroup}>
                    <View style={dynamicStyles.inputLabel}>
                      <MapPin size={16} color={colors.textSecondary} />
                      <Text style={dynamicStyles.inputLabelText}>Home Base Address</Text>
                    </View>
                    <TextInput
                      style={dynamicStyles.input}
                      value={homeBaseAddress}
                      onChangeText={setHomeBaseAddress}
                      placeholder="123 Main St, City, State"
                      placeholderTextColor={colors.textSecondary}
                      multiline
                    />
                    <Text style={dynamicStyles.inputHint}>
                      Your office or starting location
                    </Text>
                  </View>

                  <View style={dynamicStyles.inputGroup}>
                    <View style={dynamicStyles.inputLabel}>
                      <MapPin size={16} color={colors.textSecondary} />
                      <Text style={dynamicStyles.inputLabelText}>Geofence Radius (meters)</Text>
                    </View>
                    <TextInput
                      style={dynamicStyles.input}
                      value={geofenceRadius}
                      onChangeText={setGeofenceRadius}
                      placeholder="100"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="number-pad"
                    />
                    <Text style={dynamicStyles.inputHint}>
                      Detection range for job sites (10-500 meters)
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={dynamicStyles.saveButton}
                    onPress={handleSaveHomeBase}
                    disabled={savingHomeBase}
                  >
                    <LinearGradient
                      colors={['#1B4D6E', '#245d82']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={dynamicStyles.saveButtonGradient}
                    >
                      {savingHomeBase ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Save size={18} color="#fff" />
                          <Text style={dynamicStyles.saveButtonText}>Save Home Base</Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
                )}

                <TouchableOpacity
                  style={dynamicStyles.sectionHeader}
                  onPress={() => setProductionRatesExpanded(!productionRatesExpanded)}
                >
                  <View style={dynamicStyles.sectionTitleRow}>
                    <Users size={18} color={colors.primary} />
                    <Text style={dynamicStyles.sectionTitle}>Team Production Rates</Text>
                  </View>
                  <ChevronRight
                    size={20}
                    color={colors.textSecondary}
                    style={{ transform: [{ rotate: productionRatesExpanded ? '90deg' : '0deg' }] }}
                  />
                </TouchableOpacity>

                {productionRatesExpanded && (
                  <View style={dynamicStyles.profileContent}>
                    <Text style={dynamicStyles.helperText}>
                      Set production rates for each team member to automatically calculate job durations based on their individual efficiency with different unit types.
                    </Text>

                    {loadingTeamMembers ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : teamMembers.length === 0 ? (
                      <Text style={dynamicStyles.emptyText}>
                        No team members found. Add team members to set production rates.
                      </Text>
                    ) : (
                      <View style={dynamicStyles.teamMembersList}>
                        {teamMembers.map((member) => (
                          <TouchableOpacity
                            key={member.id}
                            style={dynamicStyles.teamMemberCard}
                            onPress={() => {
                              setSelectedMember({ id: member.id, name: member.name });
                              setProductionRatesModalVisible(true);
                            }}
                          >
                            <View style={dynamicStyles.teamMemberInfo}>
                              <Text style={dynamicStyles.teamMemberName}>{member.name}</Text>
                              <Text style={dynamicStyles.teamMemberRole}>
                                {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                              </Text>
                            </View>
                            <View style={dynamicStyles.teamMemberActions}>
                              {!member.hasRates && (
                                <View style={dynamicStyles.warningBadge}>
                                  <Text style={dynamicStyles.warningBadgeText}>No Rates</Text>
                                </View>
                              )}
                              <ChevronRight size={20} color={colors.textSecondary} />
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                )}

                <TouchableOpacity
                  style={dynamicStyles.collapsibleHeader}
                  onPress={() => setBusinessHoursExpanded(!businessHoursExpanded)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Calendar size={18} color={colors.primary} />
                    <View>
                      <Text style={dynamicStyles.collapsibleTitle}>Business Hours</Text>
                      <Text style={dynamicStyles.collapsibleSubtext}>
                        Week starts {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][weekStartDay]} · Year starts {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][businessYearStart - 1]}
                      </Text>
                    </View>
                  </View>
                  <ChevronDown
                    size={20}
                    color={colors.textSecondary}
                    style={{ transform: [{ rotate: businessHoursExpanded ? '180deg' : '0deg' }] }}
                  />
                </TouchableOpacity>

                {businessHoursExpanded && (
                  <View style={{ marginTop: 8, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 16 }}>
                    <Text style={{ fontSize: 13, fontWeight: '500', color: colors.textSecondary, marginBottom: 10 }}>
                      Week Starts On
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                        <TouchableOpacity
                          key={index}
                          onPress={() => setWeekStartDay(index)}
                          style={{
                            paddingVertical: 8,
                            paddingHorizontal: 14,
                            borderRadius: 8,
                            borderWidth: 1.5,
                            borderColor: weekStartDay === index ? colors.primary : colors.border,
                            backgroundColor: weekStartDay === index ? colors.primary + '15' : colors.inputBackground,
                          }}
                        >
                          <Text style={{
                            fontSize: 13,
                            fontWeight: weekStartDay === index ? '700' : '400',
                            color: weekStartDay === index ? colors.primary : colors.textSecondary,
                          }}>
                            {day}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 10, marginBottom: 18 }}>
                      This determines which day the "This Week" filter starts on in the Time Clock.
                    </Text>

                    <Text style={{ fontSize: 13, fontWeight: '500', color: colors.textSecondary, marginBottom: 10 }}>
                      Business Year Starts In
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((mon, index) => (
                        <TouchableOpacity
                          key={index + 1}
                          onPress={() => setBusinessYearStart(index + 1)}
                          style={{
                            paddingVertical: 8,
                            paddingHorizontal: 10,
                            borderRadius: 8,
                            borderWidth: 1.5,
                            borderColor: businessYearStart === index + 1 ? colors.primary : colors.border,
                            backgroundColor: businessYearStart === index + 1 ? colors.primary + '15' : colors.inputBackground,
                          }}
                        >
                          <Text style={{
                            fontSize: 13,
                            fontWeight: businessYearStart === index + 1 ? '700' : '400',
                            color: businessYearStart === index + 1 ? colors.primary : colors.textSecondary,
                          }}>
                            {mon}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 10 }}>
                      Used for the "Previous Business Year" bulk delete option in Time Clock.
                    </Text>
                    <TouchableOpacity
                      onPress={handleSaveBusinessSettings}
                      disabled={savingBusinessSettings}
                      style={{
                        marginTop: 14,
                        borderRadius: 8,
                        overflow: 'hidden' as const,
                      }}
                    >
                      <LinearGradient
                        colors={['#1B4D6E', '#245d82']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{
                          paddingVertical: 10,
                          alignItems: 'center' as const,
                        }}
                      >
                        {savingBusinessSettings
                          ? <ActivityIndicator size="small" color="#fff" />
                          : <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Save</Text>
                        }
                      </LinearGradient>
                    </TouchableOpacity>

                    <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 20 }} />

                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>
                        Daily Operating Hours
                      </Text>
                      <TouchableOpacity
                        onPress={() => {
                          const mon = dayHours.mon;
                          setDayHours((prev) => ({
                            ...prev,
                            tue: { ...mon },
                            wed: { ...mon },
                            thu: { ...mon },
                            fri: { ...mon },
                            sat: { ...mon },
                            sun: { ...mon },
                          }));
                        }}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                          paddingVertical: 6,
                          paddingHorizontal: 10,
                          borderRadius: 8,
                          backgroundColor: colors.primary + '15',
                          borderWidth: 1,
                          borderColor: colors.primary + '40',
                        }}
                      >
                        <Copy size={13} color={colors.primary} />
                        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>Copy Mon to All</Text>
                      </TouchableOpacity>
                    </View>

                    {(
                      [
                        { key: 'mon', label: 'Monday' },
                        { key: 'tue', label: 'Tuesday' },
                        { key: 'wed', label: 'Wednesday' },
                        { key: 'thu', label: 'Thursday' },
                        { key: 'fri', label: 'Friday' },
                        { key: 'sat', label: 'Saturday' },
                        { key: 'sun', label: 'Sunday' },
                      ] as { key: keyof typeof dayHours; label: string }[]
                    ).map(({ key, label }, idx, arr) => {
                      const dayData = dayHours[key];
                      return (
                        <View
                          key={key}
                          style={{
                            borderBottomWidth: idx < arr.length - 1 ? 1 : 0,
                            borderColor: colors.border,
                            paddingVertical: 10,
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <Switch
                                value={dayData.open}
                                onValueChange={(val) =>
                                  setDayHours((prev) => ({ ...prev, [key]: { ...prev[key], open: val } }))
                                }
                                trackColor={{ false: colors.border, true: colors.primary + '80' }}
                                thumbColor={dayData.open ? colors.primary : colors.textSecondary}
                              />
                              <Text style={{ fontSize: 14, fontWeight: '500', color: dayData.open ? colors.text : colors.textSecondary }}>
                                {label}
                              </Text>
                            </View>
                            {key !== 'mon' && (
                              <TouchableOpacity
                                onPress={() => {
                                  const mon = dayHours.mon;
                                  setDayHours((prev) => ({ ...prev, [key]: { ...mon } }));
                                }}
                                style={{ padding: 4 }}
                              >
                                <Copy size={14} color={colors.textSecondary} />
                              </TouchableOpacity>
                            )}
                          </View>
                          {dayData.open && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, paddingLeft: 48 }}>
                              <TextInput
                                style={{
                                  flex: 1,
                                  borderWidth: 1,
                                  borderColor: colors.border,
                                  borderRadius: 8,
                                  paddingVertical: 6,
                                  paddingHorizontal: 10,
                                  fontSize: 13,
                                  color: colors.text,
                                  backgroundColor: colors.inputBackground,
                                  textAlign: 'center',
                                }}
                                value={dayData.start}
                                onChangeText={(t) =>
                                  setDayHours((prev) => ({ ...prev, [key]: { ...prev[key], start: t } }))
                                }
                                placeholder="08:00"
                                placeholderTextColor={colors.textSecondary}
                                keyboardType="numbers-and-punctuation"
                              />
                              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>to</Text>
                              <TextInput
                                style={{
                                  flex: 1,
                                  borderWidth: 1,
                                  borderColor: colors.border,
                                  borderRadius: 8,
                                  paddingVertical: 6,
                                  paddingHorizontal: 10,
                                  fontSize: 13,
                                  color: colors.text,
                                  backgroundColor: colors.inputBackground,
                                  textAlign: 'center',
                                }}
                                value={dayData.end}
                                onChangeText={(t) =>
                                  setDayHours((prev) => ({ ...prev, [key]: { ...prev[key], end: t } }))
                                }
                                placeholder="17:00"
                                placeholderTextColor={colors.textSecondary}
                                keyboardType="numbers-and-punctuation"
                              />
                            </View>
                          )}
                          {!dayData.open && (
                            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4, paddingLeft: 48 }}>Closed</Text>
                          )}
                        </View>
                      );
                    })}

                    <TouchableOpacity
                      onPress={handleSaveDayHours}
                      disabled={savingDayHours}
                      style={{
                        marginTop: 14,
                        borderRadius: 8,
                        overflow: 'hidden' as const,
                      }}
                    >
                      <LinearGradient
                        colors={['#1B4D6E', '#245d82']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{
                          paddingVertical: 10,
                          alignItems: 'center' as const,
                        }}
                      >
                        {savingDayHours
                          ? <ActivityIndicator size="small" color="#fff" />
                          : <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Save Hours</Text>
                        }
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                )}

                {onOpenClientPortal && (
                  <TouchableOpacity
                    style={dynamicStyles.importButton}
                    onPress={() => {
                      onClose();
                      setTimeout(onOpenClientPortal!, 300);
                    }}
                  >
                    <Globe size={20} color={colors.primary} />
                    <View style={dynamicStyles.importTextContainer}>
                      <Text style={dynamicStyles.importButtonText}>Client Portal</Text>
                      <Text style={dynamicStyles.importButtonSubtext}>
                        Configure the client self-service hub
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}

                {onOpenJobTypes && (isAdmin || isOwner || isManager) && (
                  <TouchableOpacity
                    style={dynamicStyles.importButton}
                    onPress={() => {
                      onClose();
                      setTimeout(onOpenJobTypes!, 300);
                    }}
                  >
                    <Briefcase size={20} color={colors.primary} />
                    <View style={dynamicStyles.importTextContainer}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={dynamicStyles.importButtonText}>Job Types</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#EFF6FF', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 }}>
                          <ShieldCheck size={10} color="#1B4D6E" />
                          <Text style={{ fontSize: 10, fontWeight: '700', color: '#1B4D6E' }}>ADMIN</Text>
                        </View>
                      </View>
                      <Text style={dynamicStyles.importButtonSubtext}>
                        Manage services, categories, tags, and pane types
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}

                {onOpenDocumentTemplates && (
                  <TouchableOpacity
                    style={dynamicStyles.importButton}
                    onPress={() => {
                      onClose();
                      setTimeout(onOpenDocumentTemplates!, 300);
                    }}
                  >
                    <FileText size={20} color={colors.primary} />
                    <View style={dynamicStyles.importTextContainer}>
                      <Text style={dynamicStyles.importButtonText}>Document Templates</Text>
                      <Text style={dynamicStyles.importButtonSubtext}>
                        Customize invoice and estimate layouts
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <View style={dynamicStyles.section}>
              <TouchableOpacity
                style={dynamicStyles.collapsibleHeader}
                onPress={() => setAppearanceExpanded(!appearanceExpanded)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  {themeMode === 'light' ? <Sun size={18} color={colors.primary} /> : themeMode === 'dark' ? <Moon size={18} color={colors.primary} /> : <Smartphone size={18} color={colors.primary} />}
                  <View>
                    <Text style={dynamicStyles.collapsibleTitle}>Appearance</Text>
                    <Text style={dynamicStyles.collapsibleSubtext}>
                      {themeMode === 'light' ? 'Light Mode' : themeMode === 'dark' ? 'Dark Mode' : 'System Default'}
                    </Text>
                  </View>
                </View>
                <ChevronDown
                  size={20}
                  color={colors.textSecondary}
                  style={{ transform: [{ rotate: appearanceExpanded ? '180deg' : '0deg' }] }}
                />
              </TouchableOpacity>

              {appearanceExpanded && (
                <View style={{ marginTop: 8, gap: 4 }}>
                  <TouchableOpacity
                    style={[
                      dynamicStyles.optionButton,
                      themeMode === 'light' && dynamicStyles.optionButtonActive,
                    ]}
                    onPress={() => { setThemeMode('light'); setAppearanceExpanded(false); }}
                  >
                    <Sun size={20} color={themeMode === 'light' ? colors.primary : colors.textSecondary} />
                    <Text
                      style={[
                        dynamicStyles.optionText,
                        themeMode === 'light' && dynamicStyles.optionTextActive,
                      ]}
                    >
                      Light Mode
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      dynamicStyles.optionButton,
                      themeMode === 'dark' && dynamicStyles.optionButtonActive,
                    ]}
                    onPress={() => { setThemeMode('dark'); setAppearanceExpanded(false); }}
                  >
                    <Moon size={20} color={themeMode === 'dark' ? colors.primary : colors.textSecondary} />
                    <Text
                      style={[
                        dynamicStyles.optionText,
                        themeMode === 'dark' && dynamicStyles.optionTextActive,
                      ]}
                    >
                      Dark Mode
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      dynamicStyles.optionButton,
                      themeMode === 'system' && dynamicStyles.optionButtonActive,
                    ]}
                    onPress={() => { setThemeMode('system'); setAppearanceExpanded(false); }}
                  >
                    <Smartphone size={20} color={themeMode === 'system' ? colors.primary : colors.textSecondary} />
                    <Text
                      style={[
                        dynamicStyles.optionText,
                        themeMode === 'system' && dynamicStyles.optionTextActive,
                      ]}
                    >
                      System Default
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={{ marginTop: 12 }}>
                <Text style={[dynamicStyles.sectionTitleSimple, { marginBottom: 8, fontSize: 13 }]}>Dominant Hand</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    style={[
                      dynamicStyles.optionButton,
                      { flex: 1, flexDirection: 'column', gap: 4, paddingVertical: 12 },
                      dominantHand === 'right' && dynamicStyles.optionButtonActive,
                    ]}
                    onPress={() => setDominantHand('right')}
                  >
                    <Text style={{ fontSize: 22 }}>🤜</Text>
                    <Text style={[dynamicStyles.optionText, dominantHand === 'right' && dynamicStyles.optionTextActive]}>
                      Right Hand
                    </Text>
                    <Text style={{ fontSize: 10, color: colors.textSecondary, textAlign: 'center' }}>
                      FAB on right
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      dynamicStyles.optionButton,
                      { flex: 1, flexDirection: 'column', gap: 4, paddingVertical: 12 },
                      dominantHand === 'left' && dynamicStyles.optionButtonActive,
                    ]}
                    onPress={() => setDominantHand('left')}
                  >
                    <Text style={{ fontSize: 22 }}>🤛</Text>
                    <Text style={[dynamicStyles.optionText, dominantHand === 'left' && dynamicStyles.optionTextActive]}>
                      Left Hand
                    </Text>
                    <Text style={{ fontSize: 10, color: colors.textSecondary, textAlign: 'center' }}>
                      FAB on left
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={dynamicStyles.section}>
              <Text style={dynamicStyles.sectionTitleSimple}>Layout</Text>

              <TouchableOpacity
                style={dynamicStyles.importButton}
                onPress={() => {
                  onClose();
                  setTimeout(onOpenLayoutCustomization, 300);
                }}
              >
                <LayoutGrid size={20} color={colors.primary} />
                <View style={dynamicStyles.importTextContainer}>
                  <Text style={dynamicStyles.importButtonText}>
                    Customize Layout
                  </Text>
                  <Text style={dynamicStyles.importButtonSubtext}>
                    Reorder and hide home cards and tabs
                  </Text>
                </View>
                <ChevronRight size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={dynamicStyles.section}>
              <Text style={dynamicStyles.sectionTitleSimple}>Security</Text>

              {biometricAvailable && (
                <View style={dynamicStyles.switchRow}>
                  <View style={dynamicStyles.switchLabelContainer}>
                    <Fingerprint size={20} color={colors.primary} />
                    <View style={dynamicStyles.switchLabels}>
                      <Text style={dynamicStyles.switchLabel}>{biometricType} Login</Text>
                      <Text style={dynamicStyles.switchSubtext}>
                        Use {biometricType.toLowerCase()} to unlock the app
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={biometricEnabled}
                    onValueChange={handleBiometricToggle}
                    trackColor={{ false: colors.border, true: colors.primaryLight }}
                    thumbColor={biometricEnabled ? colors.primary : colors.textSecondary}
                  />
                </View>
              )}

              <TouchableOpacity
                style={dynamicStyles.importButton}
                onPress={() => handlePasswordReset()}
              >
                <Lock size={20} color={colors.primary} />
                <View style={dynamicStyles.importTextContainer}>
                  <Text style={dynamicStyles.importButtonText}>
                    Change Password
                  </Text>
                  <Text style={dynamicStyles.importButtonSubtext}>
                    Reset your account password
                  </Text>
                </View>
                <ChevronRight size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={dynamicStyles.section}>
              <Text style={dynamicStyles.sectionTitleSimple}>Communication</Text>

              {(isAdmin || isOwner) && onOpenSmsSetup && (
                <TouchableOpacity
                  style={dynamicStyles.importButton}
                  onPress={() => {
                    onClose();
                    setTimeout(onOpenSmsSetup, 300);
                  }}
                >
                  <Phone size={20} color={colors.primary} />
                  <View style={dynamicStyles.importTextContainer}>
                    <Text style={dynamicStyles.importButtonText}>
                      SMS Setup
                    </Text>
                    <Text style={dynamicStyles.importButtonSubtext}>
                      Configure your business SMS phone number
                    </Text>
                  </View>
                  <ChevronRight size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              )}

              {(isAdmin || isOwner) && onOpenEmailSettings && (
                <TouchableOpacity
                  style={dynamicStyles.importButton}
                  onPress={() => {
                    onClose();
                    setTimeout(onOpenEmailSettings, 300);
                  }}
                >
                  <Send size={20} color={colors.primary} />
                  <View style={dynamicStyles.importTextContainer}>
                    <Text style={dynamicStyles.importButtonText}>
                      Email Settings
                    </Text>
                    <Text style={dynamicStyles.importButtonSubtext}>
                      Configure email sending for invoices and estimates
                    </Text>
                  </View>
                  <ChevronRight size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              )}

              <View style={dynamicStyles.switchRow}>
                <View style={dynamicStyles.switchLabelContainer}>
                  <MessageSquare size={20} color={colors.primary} />
                  <View style={dynamicStyles.switchLabels}>
                    <Text style={dynamicStyles.switchLabel}>SMS Notifications</Text>
                    <Text style={dynamicStyles.switchSubtext}>
                      Send text messages to clients for reminders and updates
                    </Text>
                  </View>
                </View>
                <Switch
                  value={smsEnabled}
                  onValueChange={setSmsEnabled}
                  trackColor={{ false: colors.border, true: colors.primaryLight }}
                  thumbColor={smsEnabled ? colors.primary : colors.textSecondary}
                />
              </View>

              {Platform.OS !== 'web' && (
                <>
                  <View style={dynamicStyles.switchRow}>
                    <View style={dynamicStyles.switchLabelContainer}>
                      <Bell size={20} color={colors.primary} />
                      <View style={dynamicStyles.switchLabels}>
                        <Text style={dynamicStyles.switchLabel}>Departure Reminders</Text>
                        <Text style={dynamicStyles.switchSubtext}>
                          Get notified when it's time to leave for a job based on live traffic
                        </Text>
                      </View>
                    </View>
                    <Switch
                      value={departureRemindersEnabled}
                      onValueChange={handleDepartureRemindersToggle}
                      trackColor={{ false: colors.border, true: colors.primaryLight }}
                      thumbColor={departureRemindersEnabled ? colors.primary : colors.textSecondary}
                      disabled={savingDeparturePrefs}
                    />
                  </View>

                  {departureRemindersEnabled && (
                    <View style={[dynamicStyles.section, { marginTop: 0, paddingTop: 0, borderTopWidth: 0 }]}>
                      <Text style={[dynamicStyles.inputLabelText, { marginBottom: 8 }]}>
                        Extra buffer before calculated departure time
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {[0, 5, 10, 15].map((mins) => (
                          <TouchableOpacity
                            key={mins}
                            style={[
                              {
                                flex: 1,
                                paddingVertical: 9,
                                borderRadius: 8,
                                borderWidth: 1.5,
                                alignItems: 'center',
                                borderColor: departureBufferMinutes === mins ? colors.primary : colors.border,
                                backgroundColor: departureBufferMinutes === mins ? colors.primary + '12' : colors.surface,
                              },
                            ]}
                            onPress={() => handleDepartureBufferChange(mins)}
                          >
                            <Text
                              style={{
                                fontSize: 13,
                                fontWeight: '600',
                                color: departureBufferMinutes === mins ? colors.primary : colors.textSecondary,
                              }}
                            >
                              {mins === 0 ? 'None' : `+${mins} min`}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}
                </>
              )}
            </View>

            <View style={dynamicStyles.section}>
              <Text style={dynamicStyles.sectionTitleSimple}>Help & Support</Text>

              <TouchableOpacity
                style={dynamicStyles.importButton}
                onPress={() => {
                  onClose();
                  setTimeout(onOpenFAQ, 300);
                }}
              >
                <HelpCircle size={20} color={colors.primary} />
                <View style={dynamicStyles.importTextContainer}>
                  <Text style={dynamicStyles.importButtonText}>
                    FAQ & Help Center
                  </Text>
                  <Text style={dynamicStyles.importButtonSubtext}>
                    Search for answers and get help
                  </Text>
                </View>
                <ChevronRight size={18} color={colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={dynamicStyles.importButton}
                onPress={() => {
                  onClose();
                  setTimeout(onOpenWalkthrough, 300);
                }}
              >
                <PlayCircle size={20} color={colors.primary} />
                <View style={dynamicStyles.importTextContainer}>
                  <Text style={dynamicStyles.importButtonText}>
                    App Walkthrough
                  </Text>
                  <Text style={dynamicStyles.importButtonSubtext}>
                    Take a guided tour of the app features
                  </Text>
                </View>
                <ChevronRight size={18} color={colors.textSecondary} />
              </TouchableOpacity>

              {onOpenWhatsNew && (
                <TouchableOpacity
                  style={dynamicStyles.importButton}
                  onPress={() => {
                    onClose();
                    setTimeout(onOpenWhatsNew, 300);
                  }}
                >
                  <Sparkles size={20} color={colors.primary} />
                  <View style={dynamicStyles.importTextContainer}>
                    <Text style={dynamicStyles.importButtonText}>
                      What's New
                    </Text>
                    <Text style={dynamicStyles.importButtonSubtext}>
                      See recent features and updates
                    </Text>
                  </View>
                  <ChevronRight size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              )}

              {onOpenLegal && (
                <TouchableOpacity
                  style={dynamicStyles.importButton}
                  onPress={() => {
                    onClose();
                    setTimeout(onOpenLegal, 300);
                  }}
                >
                  <FileText size={20} color={colors.primary} />
                  <View style={dynamicStyles.importTextContainer}>
                    <Text style={dynamicStyles.importButtonText}>
                      Legal & Privacy
                    </Text>
                    <Text style={dynamicStyles.importButtonSubtext}>
                      Terms of Service and Privacy Policy
                    </Text>
                  </View>
                  <ChevronRight size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            <View style={dynamicStyles.section}>
              <Text style={dynamicStyles.sectionTitleSimple}>Import Data</Text>

              <TouchableOpacity
                style={dynamicStyles.importButton}
                onPress={handleImportPhoneContacts}
                disabled={importingContacts}
              >
                {importingContacts ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Users size={20} color={colors.primary} />
                )}
                <View style={dynamicStyles.importTextContainer}>
                  <Text style={dynamicStyles.importButtonText}>
                    Import Phone Contacts
                  </Text>
                  <Text style={dynamicStyles.importButtonSubtext}>
                    Add contacts from your device as clients
                  </Text>
                </View>
                <Download size={18} color={colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={dynamicStyles.importButton}
                onPress={handleImportGoogleContacts}
                disabled={importingGoogleContacts}
              >
                {importingGoogleContacts ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Users size={20} color={colors.primary} />
                )}
                <View style={dynamicStyles.importTextContainer}>
                  <Text style={dynamicStyles.importButtonText}>
                    Import Google Contacts
                  </Text>
                  <Text style={dynamicStyles.importButtonSubtext}>
                    Add contacts from Google as clients
                  </Text>
                </View>
                <Download size={18} color={colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={dynamicStyles.importButton}
                onPress={handleImportGoogleCalendar}
                disabled={importingCalendar}
              >
                {importingCalendar ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Calendar size={20} color={colors.primary} />
                )}
                <View style={dynamicStyles.importTextContainer}>
                  <Text style={dynamicStyles.importButtonText}>
                    Import Google Calendar
                  </Text>
                  <Text style={dynamicStyles.importButtonSubtext}>
                    Add events from Google Calendar to schedule
                  </Text>
                </View>
                <Download size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={dynamicStyles.section}>
              <TouchableOpacity
                style={dynamicStyles.sectionHeader}
                onPress={() => setCalendarSyncExpanded(!calendarSyncExpanded)}
              >
                <RefreshCw size={20} color={colors.primary} />
                <Text style={dynamicStyles.sectionTitle}>Calendar Sync</Text>
                <ChevronDown
                  size={20}
                  color={colors.textSecondary}
                  style={{ transform: [{ rotate: calendarSyncExpanded ? '180deg' : '0deg' }] }}
                />
              </TouchableOpacity>

              {calendarSyncExpanded && (
                <View style={{ gap: 12, paddingTop: 8 }}>
                  {loadingSyncSettings ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>Enable Calendar Sync</Text>
                          <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                            {Platform.OS === 'web'
                              ? 'Available on mobile devices only'
                              : 'Sync events with your device calendar'}
                          </Text>
                        </View>
                        <Switch
                          value={syncSettings?.sync_enabled ?? false}
                          onValueChange={handleToggleCalendarSync}
                          disabled={savingSyncSettings || Platform.OS === 'web'}
                          trackColor={{ false: colors.border, true: colors.primary + '60' }}
                          thumbColor={syncSettings?.sync_enabled ? colors.primary : '#f4f3f4'}
                        />
                      </View>

                      {syncSettings?.sync_enabled && (
                        <>
                          <View style={{ backgroundColor: colors.surface, borderRadius: 10, padding: 12, gap: 8 }}>
                            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                              Connected Calendar
                            </Text>
                            <TouchableOpacity
                              onPress={() => {
                                if (Platform.OS !== 'web') {
                                  getDeviceCalendars().then(setDeviceCalendars);
                                  setShowCalendarPicker(true);
                                }
                              }}
                              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                            >
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Calendar size={16} color={colors.primary} />
                                <Text style={{ fontSize: 14, color: colors.text, fontWeight: '500' }}>
                                  {syncSettings.calendar_name || 'Select a calendar'}
                                </Text>
                              </View>
                              <ChevronRight size={16} color={colors.textSecondary} />
                            </TouchableOpacity>
                          </View>

                          <View style={{ backgroundColor: colors.surface, borderRadius: 10, padding: 12, gap: 8 }}>
                            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                              Sync Direction
                            </Text>
                            {([
                              { value: 'two_way' as const, label: 'Two-way sync', desc: 'Changes sync both directions' },
                              { value: 'app_to_calendar' as const, label: 'App to Calendar', desc: 'Only push events to device' },
                              { value: 'calendar_to_app' as const, label: 'Calendar to App', desc: 'Only pull events from device' },
                            ]).map((opt) => (
                              <TouchableOpacity
                                key={opt.value}
                                onPress={() => handleChangeSyncDirection(opt.value)}
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}
                              >
                                <View style={{
                                  width: 20, height: 20, borderRadius: 10,
                                  borderWidth: 2,
                                  borderColor: syncSettings.sync_direction === opt.value ? colors.primary : colors.border,
                                  alignItems: 'center', justifyContent: 'center',
                                }}>
                                  {syncSettings.sync_direction === opt.value && (
                                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary }} />
                                  )}
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={{ fontSize: 14, color: colors.text, fontWeight: '500' }}>{opt.label}</Text>
                                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>{opt.desc}</Text>
                                </View>
                              </TouchableOpacity>
                            ))}
                          </View>

                          <TouchableOpacity
                            onPress={handleSyncNow}
                            disabled={syncing}
                            style={{
                              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                              paddingVertical: 12, borderRadius: 10,
                              backgroundColor: colors.primary + '15',
                            }}
                          >
                            {syncing ? (
                              <ActivityIndicator size="small" color={colors.primary} />
                            ) : (
                              <RefreshCw size={16} color={colors.primary} />
                            )}
                            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary }}>
                              {syncing ? 'Syncing...' : 'Sync Now'}
                            </Text>
                          </TouchableOpacity>

                          {syncSettings.last_synced_at && (
                            <Text style={{ fontSize: 12, color: colors.textSecondary, textAlign: 'center' }}>
                              Last synced: {new Date(syncSettings.last_synced_at).toLocaleString()}
                            </Text>
                          )}
                        </>
                      )}
                    </>
                  )}
                </View>
              )}
            </View>

            {showCalendarPicker && (
              <Modal transparent animationType="slide" visible={showCalendarPicker} onRequestClose={() => setShowCalendarPicker(false)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                  <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%', padding: 20 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>Choose Calendar</Text>
                      <TouchableOpacity onPress={() => setShowCalendarPicker(false)}>
                        <X size={24} color={colors.text} />
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      onPress={handleCreateBizzyCalendar}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 12,
                        padding: 14, borderRadius: 10, marginBottom: 8,
                        backgroundColor: colors.primary + '10',
                        borderWidth: 1, borderColor: colors.primary + '30',
                      }}
                    >
                      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#0ea5e9' }} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.primary }}>Create "Bizzy" Calendar</Text>
                        <Text style={{ fontSize: 12, color: colors.textSecondary }}>Dedicated calendar, keeps personal events separate</Text>
                      </View>
                      <Plus size={18} color={colors.primary} />
                    </TouchableOpacity>

                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8, marginBottom: 8 }}>
                      Or select an existing calendar
                    </Text>

                    <ScrollView style={{ maxHeight: 300 }}>
                      {deviceCalendars.map((cal) => (
                        <TouchableOpacity
                          key={cal.id}
                          onPress={() => handleSelectCalendar(cal)}
                          style={{
                            flexDirection: 'row', alignItems: 'center', gap: 12,
                            padding: 14, borderRadius: 10, marginBottom: 4,
                            backgroundColor: syncSettings?.device_calendar_id === cal.id ? colors.primary + '10' : 'transparent',
                          }}
                        >
                          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: cal.color }} />
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 14, fontWeight: '500', color: colors.text }}>{cal.title}</Text>
                            <Text style={{ fontSize: 12, color: colors.textSecondary }}>{cal.source}</Text>
                          </View>
                          {syncSettings?.device_calendar_id === cal.id && (
                            <CheckCircle size={18} color={colors.primary} />
                          )}
                        </TouchableOpacity>
                      ))}
                      {deviceCalendars.length === 0 && (
                        <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', paddingVertical: 20 }}>
                          No writable calendars found on this device
                        </Text>
                      )}
                    </ScrollView>
                  </View>
                </View>
              </Modal>
            )}

            <View style={dynamicStyles.section}>
              <TouchableOpacity
                style={dynamicStyles.sectionHeader}
                onPress={() => setCallerIdExpanded(!callerIdExpanded)}
              >
                <View style={dynamicStyles.sectionTitleRow}>
                  <PhoneIncoming size={20} color={colors.primary} />
                  <Text style={dynamicStyles.sectionTitle}>Caller ID</Text>
                </View>
                <ChevronDown
                  size={20}
                  color={colors.textSecondary}
                  style={{ transform: [{ rotate: callerIdExpanded ? '180deg' : '0deg' }] }}
                />
              </TouchableOpacity>

              {callerIdExpanded && (
                <View style={{ gap: 12, paddingTop: 8 }}>
                  {loadingCallerId ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View style={{ flex: 1, marginRight: 12 }}>
                            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>Enable Caller ID</Text>
                            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                              {Platform.OS === 'web'
                                ? 'Available on mobile devices only'
                                : 'Identify clients when they call'}
                            </Text>
                          </View>
                          <Switch
                            value={callerIdEnabled}
                            onValueChange={handleToggleCallerId}
                            disabled={savingCallerId || Platform.OS === 'web'}
                            trackColor={{ false: colors.border, true: colors.primary + '60' }}
                            thumbColor={callerIdEnabled ? colors.primary : '#f4f3f4'}
                          />
                        </View>
                      </View>

                      {callerIdEnabled && (
                        <>
                          <View style={{ backgroundColor: colors.primary + '08', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.primary + '20' }}>
                            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                              Platform Info
                            </Text>
                            <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 20 }}>
                              {callerIdCapabilities.setupInstructions}
                            </Text>
                            {callerIdCapabilities.requiresDevBuild && Platform.OS !== 'web' && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: colors.warning + '15', borderRadius: 8, padding: 8 }}>
                                <Bell size={14} color={colors.warning} />
                                <Text style={{ fontSize: 12, color: colors.warning, flex: 1 }}>
                                  Requires a development build (not Expo Go)
                                </Text>
                              </View>
                            )}
                          </View>

                          <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                              <View style={{ flex: 1, marginRight: 12 }}>
                                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>Post-Call Quick Actions</Text>
                                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                                  Show schedule/estimate/invoice options after a client call ends
                                </Text>
                              </View>
                              <Switch
                                value={showPostCallCard}
                                onValueChange={handleTogglePostCallCard}
                                disabled={savingCallerId}
                                trackColor={{ false: colors.border, true: colors.primary + '60' }}
                                thumbColor={showPostCallCard ? colors.primary : '#f4f3f4'}
                              />
                            </View>
                          </View>

                          <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                              <View style={{ flex: 1, marginRight: 12 }}>
                                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>Auto-fill Schedule Details</Text>
                                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                                  Pre-fill job type, price, and duration from the client's last visit
                                </Text>
                              </View>
                              <Switch
                                value={autoPrefillSchedule}
                                onValueChange={handleToggleAutoPrefill}
                                disabled={savingCallerId}
                                trackColor={{ false: colors.border, true: colors.primary + '60' }}
                                thumbColor={autoPrefillSchedule ? colors.primary : '#f4f3f4'}
                              />
                            </View>
                          </View>

                          <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border }}>
                            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                              Phone Index
                            </Text>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                              <Text style={{ fontSize: 14, color: colors.text }}>
                                {phoneIndexStats.clientCount} clients indexed ({phoneIndexStats.entryCount} phone numbers)
                              </Text>
                            </View>
                            {phoneIndexStats.lastUpdated && (
                              <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 10 }}>
                                Last updated: {new Date(phoneIndexStats.lastUpdated).toLocaleString()}
                              </Text>
                            )}
                            <TouchableOpacity
                              onPress={handleRebuildPhoneIndex}
                              disabled={rebuildingIndex}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8,
                                paddingVertical: 10,
                                borderRadius: 10,
                                backgroundColor: colors.primary + '10',
                                borderWidth: 1,
                                borderColor: colors.primary + '25',
                              }}
                            >
                              {rebuildingIndex ? (
                                <ActivityIndicator size="small" color={colors.primary} />
                              ) : (
                                <RefreshCw size={16} color={colors.primary} />
                              )}
                              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary }}>
                                {rebuildingIndex ? 'Rebuilding...' : 'Rebuild Index'}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </>
                      )}
                    </>
                  )}
                </View>
              )}
            </View>

            <View style={dynamicStyles.section}>
              <Text style={dynamicStyles.sectionTitleSimple}>Export Data</Text>

              <TouchableOpacity
                style={dynamicStyles.importButton}
                onPress={handleExportAllData}
                disabled={exportingData}
              >
                {exportingData ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <HardDriveDownload size={20} color={colors.primary} />
                )}
                <View style={dynamicStyles.importTextContainer}>
                  <Text style={dynamicStyles.importButtonText}>
                    Download All My Data
                  </Text>
                  <Text style={dynamicStyles.importButtonSubtext}>
                    Export all clients, jobs, invoices, finances, and more as a JSON backup
                  </Text>
                </View>
                <Download size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={dynamicStyles.section}>
              <Text style={dynamicStyles.sectionTitleSimple}>Messaging</Text>

              <TouchableOpacity
                style={dynamicStyles.importButton}
                onPress={() => {
                  onClose();
                  setTimeout(onOpenMessageTemplates, 300);
                }}
              >
                <MessageSquare size={20} color={colors.primary} />
                <View style={dynamicStyles.importTextContainer}>
                  <Text style={dynamicStyles.importButtonText}>
                    Message Templates
                  </Text>
                  <Text style={dynamicStyles.importButtonSubtext}>
                    Customize automatic message templates
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={dynamicStyles.importButton}
                onPress={() => {
                  onClose();
                  setTimeout(onOpenEmailTemplates, 300);
                }}
              >
                <Mail size={20} color={colors.primary} />
                <View style={dynamicStyles.importTextContainer}>
                  <Text style={dynamicStyles.importButtonText}>
                    Email Templates
                  </Text>
                  <Text style={dynamicStyles.importButtonSubtext}>
                    Customize invoice and estimate emails
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={dynamicStyles.section}>
              <TouchableOpacity
                style={dynamicStyles.importButton}
                onPress={async () => {
                  onClose();
                  await signOut();
                  router.replace('/login');
                }}
              >
                <LogOut size={20} color={colors.error} />
                <View style={dynamicStyles.importTextContainer}>
                  <Text style={dynamicStyles.importButtonText}>
                    Sign Out
                  </Text>
                  <Text style={dynamicStyles.importButtonSubtext}>
                    Log out of your account
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
      {selectedMember && (
        <TeamMemberProductionRatesModal
          visible={productionRatesModalVisible}
          onClose={() => {
            setProductionRatesModalVisible(false);
            setSelectedMember(null);
            loadTeamMembers();
          }}
          memberId={selectedMember.id}
          memberName={selectedMember.name}
        />
      )}
      <EquipmentEditModal
        visible={showEquipmentEditModal}
        onClose={() => {
          setShowEquipmentEditModal(false);
          setEditingEquipmentId(null);
        }}
        equipmentId={editingEquipmentId}
        onSaved={() => loadEquipmentInventory()}
      />
    </Modal>
  );
}

const getDynamicStyles = (colors: any) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modal: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '85%',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
    },
    content: {
      padding: 20,
    },
    section: {
      marginBottom: 28,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 8,
      marginBottom: 8,
    },
    sectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    sectionTitleSimple: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 12,
    },
    collapsibleHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    collapsibleTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    collapsibleSubtext: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    profileContent: {
      paddingTop: 8,
    },
    inputGroup: {
      marginBottom: 16,
    },
    inputLabel: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 6,
    },
    inputLabelText: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    input: {
      backgroundColor: colors.inputBackground,
      borderRadius: 8,
      paddingVertical: 12,
      paddingHorizontal: 14,
      fontSize: 16,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
    },
    inputDisabled: {
      backgroundColor: colors.inputBackground,
      borderRadius: 8,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: colors.border,
      opacity: 0.7,
    },
    inputDisabledText: {
      fontSize: 16,
      color: colors.textSecondary,
    },
    helperText: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
      marginBottom: 16,
    },
    inputHint: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 4,
      fontStyle: 'italic',
    },
    saveButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 8,
      marginTop: 8,
      overflow: 'hidden' as const,
    },
    saveButtonGradient: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      gap: 8,
      paddingVertical: 14,
      width: '100%' as unknown as number,
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#fff',
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 20,
    },
    resetPasswordButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.inputBackground,
      paddingVertical: 14,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.error,
    },
    resetPasswordText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.error,
    },
    optionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 10,
      marginBottom: 8,
      backgroundColor: colors.inputBackground,
    },
    optionButtonActive: {
      backgroundColor: colors.primaryLight,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    optionText: {
      fontSize: 16,
      color: colors.text,
    },
    optionTextActive: {
      color: colors.primary,
      fontWeight: '600',
    },
    importButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 10,
      marginBottom: 8,
      backgroundColor: colors.inputBackground,
    },
    importTextContainer: {
      flex: 1,
    },
    importButtonText: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.text,
    },
    importButtonSubtext: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    crewRulesContainer: {
      gap: 12,
      marginVertical: 16,
    },
    crewRuleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: colors.inputBackground,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    crewRuleInfo: {
      flex: 1,
    },
    crewRuleLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    crewRuleHint: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    crewRuleInput: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    multiplierInput: {
      width: 70,
      paddingVertical: 8,
      paddingHorizontal: 12,
      backgroundColor: colors.background,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
    },
    multiplierLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    efficiencyExample: {
      padding: 12,
      backgroundColor: colors.inputBackground,
      borderRadius: 8,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.primary,
      opacity: 0.9,
    },
    efficiencyExampleTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
      marginBottom: 4,
    },
    efficiencyExampleText: {
      fontSize: 13,
      color: colors.text,
      lineHeight: 18,
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 16,
      paddingHorizontal: 16,
      backgroundColor: colors.card,
      borderRadius: 12,
      marginBottom: 12,
    },
    switchLabelContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    switchLabels: {
      flex: 1,
    },
    switchLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    switchSubtext: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    teamMembersList: {
      gap: 8,
    },
    teamMemberCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    teamMemberInfo: {
      flex: 1,
    },
    teamMemberName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    teamMemberRole: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    teamMemberActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    warningBadge: {
      backgroundColor: colors.warningLight || '#FFF4E5',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 6,
    },
    warningBadgeText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.warning || '#D97706',
    },
    emptyText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      paddingVertical: 20,
    },
  });
