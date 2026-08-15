import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Image,
  Linking,
  Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Plus, Minus, Trash2, Image as ImageIcon, Images, Clock, Mail, MailX, MessageSquare, MapPin, DollarSign, ChevronDown, ChevronUp, Tag, Ruler, CalendarPlus, Check, ExternalLink, KeySquare, ToggleLeft, ToggleRight, TriangleAlert as AlertTriangle, Star, Globe, Users, Package, SquareCheck as CheckSquare, Square, Wrench, Play, Receipt, Phone, MessageCircle, FileText, Copy, Zap, Send, BellRing, Navigation } from 'lucide-react-native';
import CollapsibleField from './CollapsibleField';
import { useCollapsibleForm } from '@/hooks/useCollapsibleForm';
import AddPropertyQualityModal, { PropertyQualityDraft, UnitType } from '@/components/AddPropertyQualityModal';
import * as ImagePicker from 'expo-image-picker';
import { supabase, invokeFunction } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import ClientPhotosGalleryModal from '@/components/ClientPhotosGalleryModal';
import ClientServiceHistory from '@/components/ClientServiceHistory';
import EquipmentEditModal from '@/components/EquipmentEditModal';
import { useToast } from '@/contexts/ToastContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useTheme } from '@/contexts/ThemeContext';
import { formatPhoneNumber, formatCurrency, normalizePhoneForComparison, roundPrice, PriceRoundingSettings, makePhoneCall, sendSMS, sendEmail } from '@/lib/utilities';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import MapPinDropModal from '@/components/MapPinDropModal';
import DurationDrumPicker from '@/components/DurationDrumPicker';
import TimePicker from '@/components/TimePicker';
import ClientQuickSendModal from '@/components/ClientQuickSendModal';
import {
  AddressData,
  savePreviousAddress,
  geocodeAddress as mapboxGeocode,
  buildFullAddress,
  emptyAddressData,
  addToOfflineQueue,
} from '@/lib/addressService';
import { useRegisterModal } from '@/contexts/ModalStackContext';
import PaneCountStepper from '@/components/shared/PaneCountStepper';

interface JobTypeCategory {
  id: string;
  name: string;
  color: string;
}

interface UnitBasedJobType {
  id: string;
  name: string;
  unit_of_measure: string;
  custom_unit_label: string;
  units_per_hour: number | null;
  exterior_pct_standard?: number | null;
  exterior_pct_french?: number | null;
  price_per_pane_standard?: number | null;
  price_per_pane_french?: number | null;
  price_per_pane_storm?: number | null;
  exterior_split_percent_standard?: number | null;
  exterior_split_percent_french?: number | null;
  exterior_split_percent_storm?: number | null;
  category_id?: string | null;
}

export interface ClientPaneTypePrice {
  id?: string;
  job_type_id: string;
  pane_type_key: string;
  price_mode: 'per_pane' | 'flat_rate';
  price_per_pane: number | null;
  flat_rate_amount: number | null;
  address_id?: string | null;
}

export interface PaneDetails {
  standard_exterior: number;
  standard_interior: number;
  standard_divisional: number;
  french_exterior: number;
  french_interior: number;
  french_divisional: number;
  storm_exterior: number;
  storm_interior: number;
}

export const EMPTY_PANE_DETAILS: PaneDetails = {
  standard_exterior: 0,
  standard_interior: 0,
  standard_divisional: 0,
  french_exterior: 0,
  french_interior: 0,
  french_divisional: 0,
  storm_exterior: 0,
  storm_interior: 0,
};

export function sumPaneDetails(d: PaneDetails): number {
  return (
    d.standard_exterior + d.standard_interior + d.standard_divisional +
    d.french_exterior + d.french_interior + d.french_divisional +
    d.storm_exterior + d.storm_interior
  );
}

export function getPaneCountFromDetails(details: any, key: string): number {
  if (details[key] !== undefined) return Number(details[key]) || 0;
  if (key === 'standard') return (Number(details.standard_exterior) || 0) + (Number(details.standard_interior) || 0) + (Number(details.standard_divisional) || 0);
  if (key === 'french') return (Number(details.french_exterior) || 0) + (Number(details.french_interior) || 0) + (Number(details.french_divisional) || 0);
  if (key === 'storm') return (Number(details.storm_exterior) || 0) + (Number(details.storm_interior) || 0);
  return 0;
}

interface UnitQuantityEntry {
  job_type_id: string;
  quantity: string;
  pane_details?: PaneDetails;
  address_id?: string | null;
  price_override?: number | null;
  price_override_enabled?: boolean;
}

export interface PropertyQuality {
  id?: string;
  label: string;
  unit_type: UnitType;
  custom_unit_label: string;
  quantity: number;
  tally: number;
  address_id?: string | null;
  sort_order?: number;
  isNew?: boolean;
}

interface ClientPhoto {
  id: string;
  photo_url: string;
  caption: string;
}

interface ServiceWindow {
  id?: string;
  window_start: string;
  window_end: string;
  days_of_week: string[];
  label: string;
  sort_order: number;
  isNew?: boolean;
}

interface ClientAddress {
  id?: string;
  label: string;
  address: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  latitude?: number | null;
  longitude?: number | null;
  is_primary: boolean;
  isNew?: boolean;
  normalized: boolean;
  typical_job_duration?: number | null;
  access_code_type?: string | null;
  access_code?: string | null;
  price_override?: number | null;
  price_override_enabled?: boolean;
  service_window_start?: string | null;
  service_window_end?: string | null;
  target_week_of_month?: number | null;
  preferred_day?: string | null;
  use_client_service_window?: boolean;
  service_frequency?: string | null;
  custom_frequency_days?: number | null;
  last_serviced_date?: string | null;
  address_type?: string | null;
  service_scope?: 'full_service' | 'exterior_only' | null;
}

const ACCESS_CODE_TYPES = [
  { key: 'garage', label: 'Garage' },
  { key: 'gate', label: 'Gate' },
  { key: 'door', label: 'Door' },
  { key: 'custom', label: 'Custom' },
];

const LABEL_PRESETS = ['Home', 'Business', 'Office', 'Warehouse', 'Other'];

function getNextLabel(addresses: ClientAddress[], prefix: string): string {
  const existing = addresses.filter(a => a.label.startsWith(prefix));
  return `${prefix} ${existing.length + 1}`;
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
  account_balance?: number;
  client_type?: string | null;
  commercial_service_window_start?: string | null;
  commercial_service_window_end?: string | null;
  google_review_url?: string | null;
  secondary_contact_name?: string | null;
  secondary_contact_phone?: string | null;
  secondary_contact_email?: string | null;
  price_override?: number | null;
  price_override_enabled?: boolean;
  review_follow_up_sent_at?: string | null;
}

interface ScheduleJobPrefill {
  clientId: string;
  clientName: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  email?: string;
  typicalJobDuration?: number;
  priceOverride?: number;
  priceOverrideEnabled?: boolean;
  accessCode?: string;
  accessCodeType?: string;
  addressId?: string;
}

interface ClientModalProps {
  visible: boolean;
  client: Client | null;
  onClose: () => void;
  onSave: () => void;
  onScheduleJob?: (prefill: ScheduleJobPrefill) => void;
  onStartTimer?: (clientId: string, clientName: string) => void;
  onCreateInvoice?: (clientId: string, clientName: string) => void;
  onCreateEstimate?: (clientId: string, clientName: string) => void;
  onDuplicateLastInvoice?: (clientId: string) => void;
  onSendStatement?: (clientId: string, clientName: string, clientEmail: string, clientPhone: string) => void;
  initialLatitude?: number;
  initialLongitude?: number;
  prefillPhone?: string;
  prefillName?: string;
  prefillAddress?: string;
  prefillLanguage?: string;
  quickMode?: boolean;
  initialMode?: 'chooser' | 'quick' | 'full';
}

interface PaneTallyRowProps {
  pt: { key: string; name: string; description?: string };
  ptIdx: number;
  exteriorCount: number;
  loading: boolean;
  index: number;
  unitTallyInputs: Record<string, string>;
  setUnitTallyInputs: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  paneDirectInput: string | undefined;
  setPaneDirectInput: (key: string, value: string | undefined) => void;
  paneTallyInput: string;
  setPaneTallyInput: (key: string, value: string) => void;
  setExteriorCount: (key: string, value: number) => void;
  styles: any;
  paneTypePrice: ClientPaneTypePrice | undefined;
  defaultPricePerPane: number | null;
  exteriorSplitPercent: number | null;
  onPanePriceChange: (key: string, update: Partial<ClientPaneTypePrice>) => void;
  colors: any;
}

function PaneTallyRow({ pt, ptIdx, exteriorCount, loading, index, unitTallyInputs, setUnitTallyInputs, paneDirectInput, setPaneDirectInput, paneTallyInput, setPaneTallyInput, setExteriorCount, styles, paneTypePrice, defaultPricePerPane, exteriorSplitPercent, onPanePriceChange, colors }: PaneTallyRowProps) {
  const priceKey = `paneprice_${pt.key}_${index}`;
  const totalChargedKey = `totalcharged_${pt.key}_${index}`;

  const priceMode = paneTypePrice?.price_mode ?? 'per_pane';
  const priceRaw = unitTallyInputs[priceKey];
  const totalChargedRaw = unitTallyInputs[totalChargedKey];
  const storedPrice = priceMode === 'per_pane' || priceMode === ('from_total' as any) ? paneTypePrice?.price_per_pane : paneTypePrice?.flat_rate_amount;
  const displayPrice = priceRaw !== undefined ? priceRaw : (storedPrice != null ? String(storedPrice) : '');

  const extPct = exteriorSplitPercent ?? 60;
  const parsedPrice = parseFloat(displayPrice);

  const derivedPricePerPane: number | null = (() => {
    if (priceMode !== ('from_total' as any)) return null;
    const totalCharged = parseFloat(totalChargedRaw ?? '');
    const count = exteriorCount;
    if (!isNaN(totalCharged) && totalCharged > 0 && count > 0) {
      return Math.round((totalCharged / count) * 10000) / 10000;
    }
    return null;
  })();

  const effectivePrice = priceMode === ('from_total' as any) ? (derivedPricePerPane ?? parsedPrice) : parsedPrice;

  const fullServiceTotal = (priceMode === 'per_pane' || priceMode === ('from_total' as any)) && !isNaN(effectivePrice) && effectivePrice > 0
    ? exteriorCount * effectivePrice
    : null;
  const exteriorOnlyTotal = (priceMode === 'per_pane' || priceMode === ('from_total' as any)) && !isNaN(effectivePrice) && effectivePrice > 0
    ? exteriorCount * effectivePrice * (extPct / 100)
    : null;

  const PRICE_MODES: Array<{ mode: string; label: string }> = [
    { mode: 'per_pane', label: 'Per pane' },
    { mode: 'flat_rate', label: 'Flat Rate' },
    { mode: 'from_total', label: 'From total' },
  ];

  const cyclePriceMode = () => {
    const currentIdx = PRICE_MODES.findIndex(m => m.mode === priceMode);
    const nextMode = PRICE_MODES[(currentIdx + 1) % PRICE_MODES.length].mode;
    setUnitTallyInputs(prev => {
      const n = { ...prev };
      delete n[priceKey];
      delete n[totalChargedKey];
      return n;
    });
    onPanePriceChange(pt.key, { price_mode: nextMode as any });
  };

  const handlePriceBlur = () => {
    if (priceRaw !== undefined) {
      const parsed = priceRaw === '' ? null : parseFloat(priceRaw) || null;
      if (priceMode === 'per_pane') {
        onPanePriceChange(pt.key, { price_per_pane: parsed });
      } else {
        onPanePriceChange(pt.key, { flat_rate_amount: parsed });
      }
      setUnitTallyInputs(prev => { const n = { ...prev }; delete n[priceKey]; return n; });
    }
  };

  const handleTotalChargedBlur = () => {
    if (derivedPricePerPane != null) {
      onPanePriceChange(pt.key, { price_mode: 'per_pane', price_per_pane: derivedPricePerPane });
    }
    setUnitTallyInputs(prev => { const n = { ...prev }; delete n[totalChargedKey]; return n; });
  };

  const hasCounts = exteriorCount > 0;
  const rowKey = `${pt.key}_${index}`;

  return (
    <View
      style={[
        styles.propQualRow,
        ptIdx === 0 && styles.propQualRowFirst,
        hasCounts && styles.propQualRowFilled,
        { paddingVertical: 12, flexDirection: 'column', alignItems: 'stretch' },
      ]}
    >
      {/* Label row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <View>
          <Text style={styles.propQualRowTitle}>{pt.name}</Text>
          {pt.description ? <Text style={styles.propQualRowDesc}>{pt.description}</Text> : null}
        </View>
      </View>

      {/* Large counter row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <TextInput
          style={{ fontSize: 28, fontWeight: '700', color: '#1B4D6E', minWidth: 60, paddingVertical: 2, paddingHorizontal: 4, borderBottomWidth: 2, borderBottomColor: '#1B4D6E' }}
          value={paneDirectInput !== undefined ? paneDirectInput : String(exteriorCount)}
          onChangeText={v => {
            const cleaned = v.replace(/[^0-9]/g, '');
            setPaneDirectInput(rowKey, cleaned);
          }}
          onBlur={() => {
            if (paneDirectInput !== undefined) {
              const parsed = parseInt(paneDirectInput, 10);
              setExteriorCount(pt.key, isNaN(parsed) ? 0 : Math.max(0, parsed));
              setPaneDirectInput(rowKey, undefined);
            }
          }}
          keyboardType="number-pad"
          selectTextOnFocus
          editable={!loading}
        />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            style={styles.paneTallyBtn}
            onPress={() => setExteriorCount(pt.key, Math.max(0, exteriorCount - 1))}
            disabled={loading}
          >
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>−</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.paneTallyBtn}
            onPress={() => setExteriorCount(pt.key, exteriorCount + 1)}
            disabled={loading}
          >
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Add-by-amount tally row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
        <TextInput
          style={styles.paneTallyAmountInput}
          value={paneTallyInput}
          onChangeText={v => setPaneTallyInput(rowKey, v.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          placeholder="Add amount"
          placeholderTextColor="#b0b8c4"
          editable={!loading}
        />
        <TouchableOpacity
          style={[styles.paneTallyBtn, { backgroundColor: '#1B4D6E', borderColor: '#1B4D6E' }]}
          onPress={() => {
            const val = parseInt(paneTallyInput || '0', 10);
            if (val > 0) {
              setExteriorCount(pt.key, exteriorCount + val);
              setPaneTallyInput(rowKey, '');
            }
          }}
          disabled={loading}
        >
          <Plus size={16} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Price row — always visible so rate can be set before entering counts */}
      <View style={{ marginTop: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <TouchableOpacity onPress={cyclePriceMode} disabled={loading} style={styles.panePriceModeBtn}>
            <Text style={styles.panePriceModeLabel}>
              {PRICE_MODES.find(m => m.mode === priceMode)?.label ?? 'Per pane'}
            </Text>
          </TouchableOpacity>

          {priceMode === ('from_total' as any) ? (
            <View style={{ flex: 1, gap: 4 }}>
              <View style={[styles.panePriceInputWrap, { flex: 1 }]}>
                <Text style={styles.panePriceCurrency}>$</Text>
                <TextInput
                  style={[styles.panePriceField, totalChargedRaw ? styles.panePriceFieldActive : null, { flex: 1 }]}
                  value={totalChargedRaw ?? ''}
                  onChangeText={v => {
                    const cleaned = v.replace(/[^0-9.]/g, '');
                    setUnitTallyInputs(prev => ({ ...prev, [totalChargedKey]: cleaned }));
                  }}
                  onBlur={handleTotalChargedBlur}
                  placeholder="Total you charged"
                  placeholderTextColor="#b0b8c4"
                  keyboardType="decimal-pad"
                  editable={!loading}
                />
              </View>
              {derivedPricePerPane != null && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ fontSize: 11, color: '#64748b' }}>
                    = ${derivedPricePerPane.toFixed(4).replace(/\.?0+$/, '')} / pane
                  </Text>
                  <View style={{ paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, backgroundColor: 'rgba(27,77,110,0.1)' }}>
                    <Text style={{ fontSize: 9, fontWeight: '700', color: '#1B4D6E' }}>AUTO</Text>
                  </View>
                </View>
              )}
              {exteriorCount === 0 && (
                <Text style={{ fontSize: 10, color: '#f59e0b' }}>Set pane count above first</Text>
              )}
            </View>
          ) : (
            <View style={[styles.panePriceInputWrap, { flex: 1 }]}>
              <Text style={styles.panePriceCurrency}>$</Text>
              <TextInput
                style={[styles.panePriceField, displayPrice ? styles.panePriceFieldActive : null, { flex: 1 }]}
                value={displayPrice}
                onChangeText={v => {
                  const cleaned = v.replace(/[^0-9.]/g, '');
                  setUnitTallyInputs(prev => ({ ...prev, [priceKey]: cleaned }));
                }}
                onBlur={handlePriceBlur}
                placeholder={defaultPricePerPane != null ? String(defaultPricePerPane) : '0.00'}
                placeholderTextColor="#b0b8c4"
                keyboardType="decimal-pad"
                editable={!loading}
              />
            </View>
          )}

          {priceMode !== ('from_total' as any) && (
            storedPrice != null ? (
              <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(27,77,110,0.12)' }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#1B4D6E' }}>Custom</Text>
              </View>
            ) : defaultPricePerPane != null ? (
              <Text style={{ fontSize: 10, color: '#94a3b8' }}>Default</Text>
            ) : null
          )}
        </View>
        {fullServiceTotal != null && priceMode !== ('from_total' as any) && (
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 6 }}>
            <Text style={{ fontSize: 10, color: '#64748b' }}>Full: ${fullServiceTotal.toFixed(2)}</Text>
            {exteriorOnlyTotal != null && (
              <Text style={{ fontSize: 10, color: '#94a3b8' }}>Ext: ${exteriorOnlyTotal.toFixed(2)}</Text>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

export default function ClientModal({
  visible,
  client,
  onClose,
  onSave,
  onScheduleJob,
  onStartTimer,
  onCreateInvoice,
  onCreateEstimate,
  onDuplicateLastInvoice,
  onSendStatement,
  initialLatitude,
  initialLongitude,
  prefillPhone,
  prefillName,
  prefillAddress,
  prefillLanguage,
  quickMode = false,
  initialMode,
}: ClientModalProps) {
  const isDirtyRef = useRef(false);
  const initialSnapshotRef = useRef<string>('');
  useRegisterModal('client-modal', visible, onClose, () => isDirtyRef.current);
  const [name, setName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [businessCountry, setBusinessCountry] = useState('US');
  const [addresses, setAddresses] = useState<ClientAddress[]>([]);
  const [notes, setNotes] = useState('');
  const [clientType, setClientType] = useState<string | null>(null);
  const [commercialWindowStart, setCommercialWindowStart] = useState('');
  const [commercialWindowEnd, setCommercialWindowEnd] = useState('');
  const [typicalJobDuration, setTypicalJobDuration] = useState('60');
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [textNotifications, setTextNotifications] = useState(false);
  const [accountBalance, setAccountBalance] = useState('0');
  const [secondaryContactName, setSecondaryContactName] = useState('');
  const [secondaryContactPhone, setSecondaryContactPhone] = useState('');
  const [secondaryContactEmail, setSecondaryContactEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [quickSendVisible, setQuickSendVisible] = useState(false);
  const [clientFabOpen, setClientFabOpen] = useState(false);
  const [sendingDayOf, setSendingDayOf] = useState(false);
  const [sendingOnWay, setSendingOnWay] = useState(false);
  const [phonePickerVisible, setPhonePickerVisible] = useState(false);
  const [phonePickerOptions, setPhonePickerOptions] = useState<{ label: string; phone: string }[]>([]);
  const phonePickerResolveRef = useRef<((phone: string | null) => void) | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<ClientPhoto[]>([]);
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [newPhotoCaption, setNewPhotoCaption] = useState('');
  const [photosLoading, setPhotosLoading] = useState(false);
  const [showAddPhoto, setShowAddPhoto] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [showLabelPicker, setShowLabelPicker] = useState<number | null>(null);
  const [customLabelIndex, setCustomLabelIndex] = useState<number | null>(null);
  const [customLabelText, setCustomLabelText] = useState('');
  const [showMapPinDrop, setShowMapPinDrop] = useState(false);
  const [mapPinDropIndex, setMapPinDropIndex] = useState<number>(0);
  const [unitBasedJobTypes, setUnitBasedJobTypes] = useState<UnitBasedJobType[]>([]);
  const [categoryUsageCounts, setCategoryUsageCounts] = useState<Record<string, number>>({});
  const [jobTypeUsageCounts, setJobTypeUsageCounts] = useState<Record<string, number>>({});
  const [unitQuantities, setUnitQuantities] = useState<UnitQuantityEntry[]>([]);
  const [clientPaneTypePrices, setClientPaneTypePrices] = useState<ClientPaneTypePrice[]>([]);
  const [unitTallyInputs, setUnitTallyInputs] = useState<Record<string, string>>({});
  const [paneDirectInputs, setPaneDirectInputs] = useState<Record<string, string | undefined>>({});
  const [paneTallyInputs, setPaneTallyInputs] = useState<Record<string, string>>({});
  const [expandedPaneJobType, setExpandedPaneJobType] = useState<string | null>(null);
  const [addedPaneTypeKeys, setAddedPaneTypeKeys] = useState<Record<string, string[]>>({});
  const [propertyQualities, setPropertyQualities] = useState<PropertyQuality[]>([]);
  const [showAddQualityModal, setShowAddQualityModal] = useState(false);
  const [categories, setCategories] = useState<JobTypeCategory[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [orgPaneTypes, setOrgPaneTypes] = useState<{ id: string; name: string; key: string; description: string; sort_order: number }[]>([]);
  const [isUnsubscribed, setIsUnsubscribed] = useState(false);
  const [resubscribing, setResubscribing] = useState(false);
  const [orgGoogleReviewUrl, setOrgGoogleReviewUrl] = useState('');
  const [expandedAddrDetails, setExpandedAddrDetails] = useState<Set<number>>(new Set());
  const [duplicateWarning, setDuplicateWarning] = useState<{ matches: { id: string; name: string; matchedOn: string }[]; confirmed: boolean }>({ matches: [], confirmed: false });
  const duplicateConfirmedRef = React.useRef(false);
  const [equipmentInventory, setEquipmentInventory] = useState<{ id: string; name: string; category: string; category_id: string | null }[]>([]);
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<Set<string>>(new Set());
  const [showEquipmentPicker, setShowEquipmentPicker] = useState(false);
  const [addressEquipment, setAddressEquipment] = useState<Record<string, Set<string>>>({});
  const [expandedAddrEquipment, setExpandedAddrEquipment] = useState<Set<number>>(new Set());
  const [editingEquipmentId, setEditingEquipmentId] = useState<string | null>(null);
  const [showEquipmentEditModal, setShowEquipmentEditModal] = useState(false);
  const [priceOverrideInputs, setPriceOverrideInputs] = useState<Record<number, string>>({});
  const [clientPriceOverride, setClientPriceOverride] = useState('');
  const [clientPriceOverrideEnabled, setClientPriceOverrideEnabled] = useState(false);
  const [disableRounding, setDisableRounding] = useState(false);
  const [roundingSettings, setRoundingSettings] = useState<PriceRoundingSettings | null>(null);
  const [reviewFollowUpSentAt, setReviewFollowUpSentAt] = useState<string | null>(null);
  const [sendingReviewFollowUp, setSendingReviewFollowUp] = useState(false);
  const [activeTimePicker, setActiveTimePicker] = useState<{ type: 'clientStart' | 'clientEnd' | 'addrStart' | 'addrEnd' | 'windowStart' | 'windowEnd'; addrIndex?: number; windowIndex?: number } | null>(null);
  const [addressServiceWindows, setAddressServiceWindows] = useState<Record<number, ServiceWindow[]>>({});
  const { user } = useAuth();
  const { showToast } = useToast();
  const { currentOrganization } = useOrganization();
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const { activeFieldId, toggleField } = useCollapsibleForm();

  useEffect(() => {
    if (!visible || !client) return;
    if (!initialSnapshotRef.current) return;
    const current = JSON.stringify({
      name, email, phone, notes, clientType, commercialWindowStart, commercialWindowEnd,
      typicalJobDuration, accountBalance, secondaryContactName, secondaryContactPhone,
      secondaryContactEmail, clientPriceOverride, clientPriceOverrideEnabled, disableRounding,
      emailNotifications, textNotifications,
    });
    isDirtyRef.current = current !== initialSnapshotRef.current;
  }, [
    visible, client, name, email, phone, notes, clientType, commercialWindowStart,
    commercialWindowEnd, typicalJobDuration, accountBalance, secondaryContactName,
    secondaryContactPhone, secondaryContactEmail, clientPriceOverride,
    clientPriceOverrideEnabled, disableRounding, emailNotifications, textNotifications,
  ]);

  const handleDelete = async () => {
    if (!client) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', client.id)
        .eq('user_id', user!.id);
      if (error) throw error;
      showToast({ message: `${client.name} deleted`, type: 'info', duration: 3000 });
      isDirtyRef.current = false;
      resetForm();
      onSave();
    } catch (err: any) {
      showToast({ message: err?.message || 'Failed to delete client', type: 'error', duration: 4000 });
    } finally {
      setLoading(false);
    }
  };

  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [creationMode, setCreationMode] = useState<'chooser' | 'quick' | 'full'>('chooser');
  const [quickAddSuccess, setQuickAddSuccess] = useState<{ clientId: string; clientName: string } | null>(null);
  const [showMoreDetails, setShowMoreDetails] = useState(false);

  const resetForm = () => {
    setName('');
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setAddresses([]);
    setNotes('');
    setTypicalJobDuration('60');
    setAccountBalance('0');
    setEmailNotifications(false);
    setTextNotifications(false);
    setError('');
    setPhotos([]);
    setNewPhotoUrl('');
    setNewPhotoCaption('');
    setShowAddPhoto(false);
    setShowLabelPicker(null);
    setCustomLabelIndex(null);
    setCustomLabelText('');
    setUnitQuantities([]);
    setUnitTallyInputs({});
    setExpandedPaneJobType(null);
    setClientPaneTypePrices([]);
    setPropertyQualities([]);
    setShowAddQualityModal(false);
    setShowMapPinDrop(false);
    setClientType(null);
    setCommercialWindowStart('');
    setCommercialWindowEnd('');
    setSelectedCategoryIds([]);
    setShowCategoryPicker(false);
    setIsUnsubscribed(false);
    setResubscribing(false);
    setExpandedAddrDetails(new Set());
    setDeleteConfirm(false);
    setSecondaryContactName('');
    setSecondaryContactPhone('');
    setSecondaryContactEmail('');
    setFieldErrors({});
    setDuplicateWarning({ matches: [], confirmed: false });
    duplicateConfirmedRef.current = false;
    setSelectedEquipmentIds(new Set());
    setShowEquipmentPicker(false);
    setAddressEquipment({});
    setExpandedAddrEquipment(new Set());
    setPriceOverrideInputs({});
    setClientPriceOverride('');
    setClientPriceOverrideEnabled(false);
    setDisableRounding(false);
    setAddressServiceWindows({});
    setCreationMode('chooser');
    setQuickAddSuccess(null);
    setShowMoreDetails(false);
    setReviewFollowUpSentAt(null);
    setSendingReviewFollowUp(false);
  };

  useEffect(() => {
    if (visible && currentOrganization?.id) {
      supabase
        .from('business_settings')
        .select('google_review_url, price_rounding_enabled, price_rounding_target, price_rounding_custom_amount, business_country')
        .eq('organization_id', currentOrganization.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.google_review_url) setOrgGoogleReviewUrl(data.google_review_url);
          if (data) setRoundingSettings({ price_rounding_enabled: data.price_rounding_enabled ?? false, price_rounding_target: data.price_rounding_target ?? '1', price_rounding_custom_amount: data.price_rounding_custom_amount });
          if (data?.business_country) setBusinessCountry(data.business_country);
        });
    }
  }, [visible, currentOrganization?.id]);

  useEffect(() => {
    isDirtyRef.current = false;
    if (visible) {
      fetchUnitBasedJobTypes();
      fetchCategories();
      fetchOrgPaneTypes();
      fetchEquipmentInventory();
    }
    if (visible && client) {
      const applyClientData = (c: typeof client) => {
        const cAny = c as any;
        // Populate first/last from DB; fall back to splitting the legacy name field
        const storedFirst = cAny.first_name || '';
        const storedLast = cAny.last_name || '';
        let newFirstName = storedFirst;
        let newLastName = storedLast;
        if (!storedFirst && !storedLast && c.name) {
          const parts = c.name.trim().split(/\s+/);
          newFirstName = parts[0] || '';
          newLastName = parts.slice(1).join(' ');
        }
        const newName = [newFirstName, newLastName].filter(Boolean).join(' ') || c.name || '';
        const newEmail = c.email || '';
        const newPhone = c.phone || '';
        const newNotes = c.notes || '';
        const newClientType = c.client_type || null;
        const newCommercialWindowStart = c.commercial_service_window_start || '';
        const newCommercialWindowEnd = c.commercial_service_window_end || '';
        const newTypicalJobDuration = String(c.typical_job_duration || 60);
        const newAccountBalance = String(c.account_balance || 0);
        const newSecondaryContactName = c.secondary_contact_name || '';
        const newSecondaryContactPhone = c.secondary_contact_phone || '';
        const newSecondaryContactEmail = c.secondary_contact_email || '';
        const newClientPriceOverride = c.price_override != null ? String(c.price_override) : '';
        const newClientPriceOverrideEnabled = c.price_override_enabled ?? false;
        const newDisableRounding = (c as any).disable_rounding ?? false;
        const pref = c.notification_preference || 'none';
        const newEmailNotifications = pref === 'email' || pref === 'both';
        const newTextNotifications = pref === 'text' || pref === 'both';

        setName(newName);
        setFirstName(newFirstName);
        setLastName(newLastName);
        setEmail(newEmail);
        setPhone(newPhone);
        setNotes(newNotes);
        setClientType(newClientType);
        setCommercialWindowStart(newCommercialWindowStart);
        setCommercialWindowEnd(newCommercialWindowEnd);
        setTypicalJobDuration(newTypicalJobDuration);
        setAccountBalance(newAccountBalance);
        setSecondaryContactName(newSecondaryContactName);
        setSecondaryContactPhone(newSecondaryContactPhone);
        setSecondaryContactEmail(newSecondaryContactEmail);
        setClientPriceOverride(newClientPriceOverride);
        setClientPriceOverrideEnabled(newClientPriceOverrideEnabled);
        setDisableRounding(newDisableRounding);
        setEmailNotifications(newEmailNotifications);
        setTextNotifications(newTextNotifications);
        setReviewFollowUpSentAt((c as any).review_follow_up_sent_at || null);
        if (c.email) checkUnsubscribeStatus(c.email);

        initialSnapshotRef.current = JSON.stringify({
          name: newName, email: newEmail, phone: newPhone, notes: newNotes,
          clientType: newClientType, commercialWindowStart: newCommercialWindowStart,
          commercialWindowEnd: newCommercialWindowEnd, typicalJobDuration: newTypicalJobDuration,
          accountBalance: newAccountBalance, secondaryContactName: newSecondaryContactName,
          secondaryContactPhone: newSecondaryContactPhone, secondaryContactEmail: newSecondaryContactEmail,
          clientPriceOverride: newClientPriceOverride, clientPriceOverrideEnabled: newClientPriceOverrideEnabled,
          disableRounding: newDisableRounding, emailNotifications: newEmailNotifications,
          textNotifications: newTextNotifications,
        });
        isDirtyRef.current = false;
      };

      const needsFullFetch = client.notes === undefined || client.address === undefined;
      if (needsFullFetch) {
        supabase
          .from('clients')
          .select('*')
          .eq('id', client.id)
          .maybeSingle()
          .then(({ data }) => {
            if (data) {
              applyClientData(data);
            } else {
              applyClientData(client);
            }
          });
      } else {
        applyClientData(client);
      }

      fetchPhotos(client.id);
      fetchAddresses(client.id).then((addrs: any[]) => {
        if (addrs && addrs.length > 0) {
          fetchAddressEquipment(addrs);
          fetchServiceWindows(addrs);
        }
      });
      fetchUnitQuantities(client.id);
      fetchPropertyQualities(client.id);
      fetchClientCategories(client.id);
      fetchClientEquipment(client.id);
      fetchClientPaneTypePrices(client.id);
    } else if (visible && !client) {
      resetForm();
      if (initialMode) {
        setCreationMode(initialMode);
      }
      if (prefillName) {
        setName(prefillName);
        if (!initialMode) setCreationMode('quick');
      }
      if (prefillPhone) {
        setPhone(formatPhoneNumber(prefillPhone, businessCountry));
        if (!initialMode) setCreationMode('quick');
      }
      if (prefillAddress) {
        setAddresses([{
          label: 'Home 1',
          address: prefillAddress,
          street: '',
          city: '',
          state: '',
          postalCode: '',
          country: 'United States',
          latitude: undefined,
          longitude: undefined,
          is_primary: true,
          isNew: true,
          normalized: false,
        }]);
        if (!initialMode) setCreationMode('quick');
      } else if (initialLatitude !== undefined && initialLongitude !== undefined) {
        setAddresses([{
          label: 'Home 1',
          address: '',
          street: '',
          city: '',
          state: '',
          postalCode: '',
          country: 'United States',
          latitude: initialLatitude,
          longitude: initialLongitude,
          is_primary: true,
          isNew: true,
          normalized: false,
        }]);
      }
      if (prefillLanguage) {
        setNotes(`Language: ${prefillLanguage}`);
      }
    }
  }, [client, visible]);

  const fetchAddresses = async (clientId: string) => {
    const { data, error } = await supabase
      .from('client_addresses')
      .select('id, label, address, street, city, state, postal_code, country, latitude, longitude, is_primary, normalized, typical_job_duration, access_code_type, access_code, price_override, price_override_enabled, service_window_start, service_window_end, target_week_of_month, preferred_day, use_client_service_window, service_frequency, custom_frequency_days, last_serviced_date, address_type, service_scope')
      .eq('client_id', clientId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true });

    if (!error && data && data.length > 0) {
      const mapped = data.map((a: any) => ({
        id: a.id,
        label: a.label,
        address: a.address || '',
        street: a.street || a.address || '',
        city: a.city || '',
        state: a.state || '',
        postalCode: a.postal_code || '',
        country: a.country || 'United States',
        latitude: a.latitude,
        longitude: a.longitude,
        is_primary: a.is_primary,
        normalized: a.normalized || false,
        isNew: false,
        typical_job_duration: a.typical_job_duration ?? null,
        access_code_type: a.access_code_type ?? null,
        access_code: a.access_code ?? null,
        price_override: a.price_override ?? null,
        price_override_enabled: a.price_override_enabled ?? false,
        service_window_start: a.service_window_start ?? null,
        service_window_end: a.service_window_end ?? null,
        target_week_of_month: a.target_week_of_month ?? null,
        preferred_day: a.preferred_day ?? null,
        use_client_service_window: a.use_client_service_window ?? true,
        service_frequency: a.service_frequency ?? null,
        custom_frequency_days: a.custom_frequency_days ?? null,
        last_serviced_date: a.last_serviced_date ?? null,
        address_type: a.address_type ?? null,
        service_scope: (a.service_scope as 'full_service' | 'exterior_only' | null) ?? null,
      }));
      setAddresses(mapped);
      return mapped;
    } else if (client?.address) {
      const fallback = [{
        label: 'Home 1',
        address: client.address,
        street: client.address,
        city: '',
        state: '',
        postalCode: '',
        country: 'United States',
        is_primary: true,
        isNew: true,
        normalized: false,
      }];
      setAddresses(fallback);
      return fallback;
    } else {
      setAddresses([]);
      return [];
    }
  };

  const fetchServiceWindows = async (addrs: ClientAddress[]) => {
    const addrIds = addrs.map(a => a.id).filter(Boolean) as string[];
    if (addrIds.length === 0) return;
    const { data, error } = await supabase
      .from('client_address_service_windows')
      .select('id, client_address_id, window_start, window_end, days_of_week, label, sort_order')
      .in('client_address_id', addrIds)
      .order('sort_order', { ascending: true });
    if (error || !data) return;
    const windowsByAddr: Record<number, ServiceWindow[]> = {};
    for (const w of data) {
      const addrIndex = addrs.findIndex(a => a.id === w.client_address_id);
      if (addrIndex < 0) continue;
      if (!windowsByAddr[addrIndex]) windowsByAddr[addrIndex] = [];
      windowsByAddr[addrIndex].push({
        id: w.id,
        window_start: w.window_start,
        window_end: w.window_end,
        days_of_week: w.days_of_week || [],
        label: w.label || '',
        sort_order: w.sort_order || 0,
      });
    }
    setAddressServiceWindows(windowsByAddr);
  };

  const fetchPhotos = async (clientId: string) => {
    setPhotosLoading(true);
    const { data, error } = await supabase
      .from('client_photos')
      .select('id, photo_url, caption')
      .eq('client_id', clientId)
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setPhotos(data);
    }
    setPhotosLoading(false);
  };

  const fetchUnitBasedJobTypes = async () => {
    let query = supabase
      .from('job_types')
      .select('id, name, unit_of_measure, custom_unit_label, units_per_hour, category_id, exterior_pct_standard, exterior_pct_french, price_per_pane_standard, price_per_pane_french, price_per_pane_storm, exterior_split_percent_standard, exterior_split_percent_french, exterior_split_percent_storm')
      .eq('is_active', true)
      .neq('unit_of_measure', 'hour')
      .neq('unit_of_measure', 'flat_rate')
      .eq('is_flat_rate', false)
      .order('name');
    if (currentOrganization?.id) {
      query = query.eq('organization_id', currentOrganization.id);
    }
    const { data, error } = await query;
    if (error) console.error('[ClientModal] fetch unit job_types error:', error);
    setUnitBasedJobTypes(data || []);
    await fetchJobTypeUsageCounts();
  };

  const fetchJobTypeUsageCounts = async () => {
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
      console.error('[ClientModal] fetch usage counts error:', error);
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

  const fetchOrgPaneTypes = async () => {
    if (!currentOrganization?.id) return;
    const { data } = await supabase
      .from('pane_types')
      .select('id, name, key, description, sort_order')
      .eq('organization_id', currentOrganization.id)
      .eq('is_active', true)
      .order('sort_order')
      .order('name');
    setOrgPaneTypes(data || []);
  };

  const fetchEquipmentInventory = async () => {
    if (!currentOrganization?.id) return;
    const { data } = await supabase
      .from('equipment_inventory')
      .select('id, name, category, category_id')
      .eq('organization_id', currentOrganization.id)
      .eq('is_active', true)
      .order('name');
    setEquipmentInventory(
      (data || []).map((e: any) => ({
        id: e.id,
        name: e.name,
        category: e.category || '',
        category_id: e.category_id || null,
      }))
    );
  };

  const fetchClientEquipment = async (clientId: string) => {
    const { data } = await supabase
      .from('client_equipment')
      .select('equipment_id')
      .eq('client_id', clientId);
    if (data) {
      setSelectedEquipmentIds(new Set(data.map(d => d.equipment_id)));
    }
  };

  const saveClientEquipment = async (clientId: string) => {
    if (!currentOrganization?.id) return;
    await supabase.from('client_equipment').delete().eq('client_id', clientId);
    const rows = Array.from(selectedEquipmentIds).map(equipmentId => ({
      client_id: clientId,
      equipment_id: equipmentId,
      organization_id: currentOrganization.id,
    }));
    if (rows.length > 0) {
      await supabase.from('client_equipment').insert(rows);
    }
  };

  const fetchAddressEquipment = async (clientAddresses: { id?: string }[]) => {
    const addressIds = clientAddresses.map(a => a.id).filter(Boolean) as string[];
    if (addressIds.length === 0) return;
    const { data } = await supabase
      .from('address_equipment')
      .select('address_id, equipment_id')
      .in('address_id', addressIds);
    if (data) {
      const map: Record<string, Set<string>> = {};
      data.forEach(row => {
        if (!map[row.address_id]) map[row.address_id] = new Set();
        map[row.address_id].add(row.equipment_id);
      });
      setAddressEquipment(map);
    }
  };

  const saveAddressEquipment = async () => {
    if (!currentOrganization?.id) return;
    const addressIds = addresses.map(a => a.id).filter(Boolean) as string[];
    if (addressIds.length === 0) return;
    await supabase.from('address_equipment').delete().in('address_id', addressIds);
    const rows: { address_id: string; equipment_id: string; organization_id: string }[] = [];
    Object.entries(addressEquipment).forEach(([addrId, equipIds]) => {
      equipIds.forEach(eqId => {
        rows.push({ address_id: addrId, equipment_id: eqId, organization_id: currentOrganization!.id });
      });
    });
    if (rows.length > 0) {
      await supabase.from('address_equipment').insert(rows);
    }
  };

  const saveServiceWindows = async (clientId?: string) => {
    if (!currentOrganization?.id) return;
    const hasAnyWindows = Object.values(addressServiceWindows).some(w => w.length > 0);
    if (!hasAnyWindows && !client) return;

    let resolvedAddrs = addresses;
    if (clientId && addresses.every(a => !a.id || a.isNew)) {
      const { data } = await supabase
        .from('client_addresses')
        .select('id, address')
        .eq('client_id', clientId)
        .order('created_at', { ascending: true });
      if (data && data.length > 0) {
        resolvedAddrs = addresses.map((a, i) => ({ ...a, id: data[i]?.id || a.id }));
      }
    }

    const addrIds = resolvedAddrs.map(a => a.id).filter(Boolean) as string[];
    if (addrIds.length === 0) return;
    await supabase
      .from('client_address_service_windows')
      .delete()
      .in('client_address_id', addrIds);
    const rows: { client_address_id: string; organization_id: string; window_start: string; window_end: string; days_of_week: string[]; label: string; sort_order: number }[] = [];
    for (const [idxStr, windows] of Object.entries(addressServiceWindows)) {
      const addrIdx = Number(idxStr);
      const addrId = resolvedAddrs[addrIdx]?.id;
      if (!addrId) continue;
      for (const sw of windows) {
        if (!sw.window_start || !sw.window_end) continue;
        rows.push({
          client_address_id: addrId,
          organization_id: currentOrganization.id,
          window_start: sw.window_start,
          window_end: sw.window_end,
          days_of_week: sw.days_of_week,
          label: sw.label,
          sort_order: sw.sort_order,
        });
      }
    }
    if (rows.length > 0) {
      await supabase.from('client_address_service_windows').insert(rows);
    }
  };

  const toggleAddressEquipment = (addressId: string, equipmentId: string) => {
    setAddressEquipment(prev => {
      const current = new Set(prev[addressId] || []);
      if (current.has(equipmentId)) current.delete(equipmentId);
      else current.add(equipmentId);
      return { ...prev, [addressId]: current };
    });
  };

  const fetchUnitQuantities = async (clientId: string) => {
    const { data } = await supabase
      .from('client_unit_quantities')
      .select('job_type_id, quantity, pane_details, address_id, price_override, price_override_enabled')
      .eq('client_id', clientId);
    if (data) {
      setUnitQuantities(data.map(d => ({
        job_type_id: d.job_type_id,
        quantity: String(d.quantity),
        pane_details: d.pane_details || undefined,
        address_id: d.address_id || null,
        price_override: d.price_override ?? null,
        price_override_enabled: d.price_override_enabled ?? false,
      })));
    }
  };

  const fetchClientPaneTypePrices = async (clientId: string) => {
    const { data } = await supabase
      .from('client_pane_type_prices')
      .select('id, job_type_id, pane_type_key, price_mode, price_per_pane, flat_rate_amount, address_id')
      .eq('client_id', clientId);
    setClientPaneTypePrices((data || []).map((d: any) => ({
      id: d.id,
      job_type_id: d.job_type_id,
      pane_type_key: d.pane_type_key,
      price_mode: d.price_mode as 'per_pane' | 'flat_rate',
      price_per_pane: d.price_per_pane ?? null,
      flat_rate_amount: d.flat_rate_amount ?? null,
      address_id: d.address_id ?? null,
    })));
  };

  const saveClientPaneTypePrices = async (clientId: string) => {
    if (!currentOrganization?.id) return;
    for (const p of clientPaneTypePrices) {
      const record = {
        client_id: clientId,
        organization_id: currentOrganization.id,
        job_type_id: p.job_type_id,
        pane_type_key: p.pane_type_key,
        price_mode: p.price_mode,
        price_per_pane: p.price_per_pane ?? null,
        flat_rate_amount: p.flat_rate_amount ?? null,
        address_id: p.address_id ?? null,
        updated_at: new Date().toISOString(),
      };
      if (p.id) {
        await supabase.from('client_pane_type_prices').update(record).eq('id', p.id);
      } else {
        await supabase.from('client_pane_type_prices').upsert(record, {
          onConflict: 'organization_id,client_id,address_id,job_type_id,pane_type_key',
          ignoreDuplicates: false,
        });
      }
    }
  };

  const fetchPropertyQualities = async (clientId: string) => {
    const { data } = await supabase
      .from('client_property_qualities')
      .select('id, label, unit_type, custom_unit_label, quantity, tally, address_id, sort_order')
      .eq('client_id', clientId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    setPropertyQualities((data || []).map((d: any) => ({
      id: d.id,
      label: d.label,
      unit_type: d.unit_type as UnitType,
      custom_unit_label: d.custom_unit_label || '',
      quantity: Number(d.quantity) || 0,
      tally: Number(d.tally) || 0,
      address_id: d.address_id || null,
      sort_order: d.sort_order,
      isNew: false,
    })));
  };

  const savePropertyQualities = async (clientId: string) => {
    if (!currentOrganization?.id) return;
    for (const pq of propertyQualities) {
      if (pq.isNew) {
        await supabase.from('client_property_qualities').insert({
          client_id: clientId,
          organization_id: currentOrganization.id,
          label: pq.label,
          unit_type: pq.unit_type,
          custom_unit_label: pq.custom_unit_label || null,
          quantity: pq.quantity,
          tally: pq.tally,
          address_id: pq.address_id || null,
          sort_order: pq.sort_order ?? 0,
        });
      } else if (pq.id) {
        await supabase.from('client_property_qualities').update({
          quantity: pq.quantity,
          tally: pq.tally,
          updated_at: new Date().toISOString(),
        }).eq('id', pq.id);
      }
    }
  };

  const fetchCategories = async () => {
    if (!currentOrganization?.id) return;
    const { data } = await supabase
      .from('job_type_categories')
      .select('id, name, color')
      .eq('organization_id', currentOrganization.id)
      .order('name');
    setCategories(data || []);
  };

  const checkUnsubscribeStatus = async (clientEmail: string) => {
    if (!currentOrganization?.id || !clientEmail) {
      setIsUnsubscribed(false);
      return;
    }
    const { data } = await supabase
      .from('email_unsubscribes')
      .select('id')
      .eq('organization_id', currentOrganization.id)
      .ilike('email', clientEmail.toLowerCase().trim())
      .maybeSingle();
    setIsUnsubscribed(!!data);
  };

  const handleResubscribe = async () => {
    if (!currentOrganization?.id || !email) return;
    setResubscribing(true);
    const { error: delError } = await supabase
      .from('email_unsubscribes')
      .delete()
      .eq('organization_id', currentOrganization.id)
      .ilike('email', email.toLowerCase().trim());
    setResubscribing(false);
    if (!delError) {
      setIsUnsubscribed(false);
      showToast({ message: 'Client has been re-subscribed to emails', type: 'success', duration: 3000 });
    } else {
      showToast({ message: 'Failed to re-subscribe client', type: 'error', duration: 4000 });
    }
  };

  const fetchClientCategories = async (clientId: string) => {
    const { data } = await supabase
      .from('client_categories')
      .select('category_id')
      .eq('client_id', clientId);
    setSelectedCategoryIds(data?.map(r => r.category_id) || []);
  };

  const saveClientCategories = async (clientId: string) => {
    if (!currentOrganization?.id) return;
    await supabase.from('client_categories').delete().eq('client_id', clientId).eq('organization_id', currentOrganization.id);
    if (selectedCategoryIds.length > 0) {
      await supabase.from('client_categories').insert(
        selectedCategoryIds.map(catId => ({
          client_id: clientId,
          category_id: catId,
          organization_id: currentOrganization.id,
        }))
      );
    }
  };

  const toggleCategory = (catId: string) => {
    setSelectedCategoryIds(prev =>
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    );
  };

  const getUnitLabel = (jt: UnitBasedJobType): string => {
    if (jt.unit_of_measure === 'custom') return jt.custom_unit_label || 'units';
    const labels: Record<string, string> = {
      sqft: 'sq ft',
      linear_ft: 'linear ft',
      pane: 'panes',
      item: 'items',
      day: 'days',
      mile: 'miles',
    };
    return labels[jt.unit_of_measure] || jt.unit_of_measure;
  };

  const handleAddAddress = () => {
    const newLabel = getNextLabel(addresses, 'Home');
    setAddresses([...addresses, {
      label: newLabel,
      address: '',
      street: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'United States',
      is_primary: addresses.length === 0,
      isNew: true,
      normalized: false,
      address_type: clientType || null,
      service_scope: null,
    }]);
  };

  const handleRemoveAddress = (index: number) => {
    const updated = addresses.filter((_, i) => i !== index);
    if (updated.length > 0 && !updated.some(a => a.is_primary)) {
      updated[0].is_primary = true;
    }
    setAddresses(updated);
  };

  const handleUpdateAddress = (index: number, field: keyof ClientAddress, value: string | boolean) => {
    const updated = [...addresses];
    if (field === 'is_primary' && value === true) {
      updated.forEach(a => a.is_primary = false);
    }
    (updated[index] as any)[field] = value;
    setAddresses(updated);
  };

  const handleSelectLabel = (index: number, prefix: string) => {
    if (prefix === 'Custom') {
      setCustomLabelIndex(index);
      setCustomLabelText('');
      setShowLabelPicker(null);
      return;
    }
    const label = getNextLabel(addresses, prefix);
    handleUpdateAddress(index, 'label', label);
    setShowLabelPicker(null);
  };

  const handleSetCustomLabel = (index: number) => {
    if (customLabelText.trim()) {
      handleUpdateAddress(index, 'label', customLabelText.trim());
    }
    setCustomLabelIndex(null);
    setCustomLabelText('');
  };

  const handleAddPhoto = async () => {
    if (!newPhotoUrl.trim() || !client) return;

    setPhotosLoading(true);
    const { data, error } = await supabase
      .from('client_photos')
      .insert({
        user_id: user?.id,
        client_id: client.id,
        photo_url: newPhotoUrl.trim(),
        caption: newPhotoCaption.trim(),
      })
      .select('id, photo_url, caption')
      .single();

    if (!error && data) {
      setPhotos([data, ...photos]);
      setNewPhotoUrl('');
      setNewPhotoCaption('');
      setShowAddPhoto(false);
    }
    setPhotosLoading(false);
  };

  const pickImage = async () => {
    if (!client) return;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setError('Permission to access camera roll is required');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const imageUri = asset.base64
        ? `data:image/jpeg;base64,${asset.base64}`
        : asset.uri;

      setPhotosLoading(true);
      const { data, error } = await supabase
        .from('client_photos')
        .insert({
          user_id: user?.id,
          client_id: client.id,
          photo_url: imageUri,
          caption: '',
        })
        .select('id, photo_url, caption')
        .single();

      if (!error && data) {
        setPhotos([data, ...photos]);
      }
      setPhotosLoading(false);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    const { error } = await supabase
      .from('client_photos')
      .delete()
      .eq('id', photoId)
      .eq('user_id', user!.id);

    if (!error) {
      setPhotos(photos.filter(p => p.id !== photoId));
    }
  };

  const saveAddresses = async (clientId: string) => {
    const existingIds = addresses.filter(a => a.id && !a.isNew).map(a => a.id!);

    if (client) {
      const { data: currentAddresses } = await supabase
        .from('client_addresses')
        .select('id')
        .eq('client_id', clientId);

      if (currentAddresses) {
        const toDelete = currentAddresses.filter(ca => !existingIds.includes(ca.id));
        for (const addr of toDelete) {
          await supabase
            .from('client_addresses')
            .delete()
            .eq('id', addr.id);
        }
      }
    }

    for (const addr of addresses) {
      let latitude = addr.latitude || null;
      let longitude = addr.longitude || null;

      const builtAddr = buildFullAddress(addr.street, addr.city, addr.state, addr.postalCode, addr.country);
      const fullAddr = (builtAddr || addr.address || addr.street).trim();
      const hasAddress = fullAddr.length > 0;

      if (!hasAddress) continue;

      if (!latitude || !longitude) {
        const result = await mapboxGeocode(fullAddr);
        if (result) {
          latitude = result.latitude;
          longitude = result.longitude;
        } else {
          await addToOfflineQueue({
            fullAddress: fullAddr,
            latitude: null,
            longitude: null,
            clientId,
            createdAt: new Date().toISOString(),
          });
        }
      }

      const isNormalized = !!(latitude && longitude);

      if (addr.id && !addr.isNew) {
        const { error: updateErr } = await supabase
          .from('client_addresses')
          .update({
            label: addr.label,
            address: fullAddr,
            street: addr.street,
            city: addr.city,
            state: addr.state,
            postal_code: addr.postalCode,
            country: addr.country,
            latitude,
            longitude,
            is_primary: addr.is_primary,
            normalized: isNormalized,
            typical_job_duration: addr.typical_job_duration ?? null,
            access_code_type: addr.access_code_type ?? null,
            access_code: addr.access_code ?? null,
            price_override: addr.price_override ?? null,
            price_override_enabled: addr.price_override_enabled ?? false,
            service_window_start: addr.service_window_start ?? null,
            service_window_end: addr.service_window_end ?? null,
            target_week_of_month: addr.target_week_of_month ?? null,
            preferred_day: addr.preferred_day ?? null,
            use_client_service_window: addr.use_client_service_window ?? true,
            service_frequency: addr.service_frequency ?? null,
            custom_frequency_days: addr.custom_frequency_days ?? null,
            last_serviced_date: addr.last_serviced_date ?? null,
            address_type: addr.address_type ?? null,
            service_scope: addr.service_scope ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', addr.id);
        if (updateErr) console.error('client_addresses update error:', updateErr);
      } else {
        const { error: insertErr } = await supabase
          .from('client_addresses')
          .insert({
            client_id: clientId,
            user_id: user?.id,
            label: addr.label,
            address: fullAddr,
            street: addr.street,
            city: addr.city,
            state: addr.state,
            postal_code: addr.postalCode,
            country: addr.country,
            latitude,
            longitude,
            is_primary: addr.is_primary,
            normalized: isNormalized,
            typical_job_duration: addr.typical_job_duration ?? null,
            access_code_type: addr.access_code_type ?? null,
            access_code: addr.access_code ?? null,
            price_override: addr.price_override ?? null,
            price_override_enabled: addr.price_override_enabled ?? false,
            service_window_start: addr.service_window_start ?? null,
            service_window_end: addr.service_window_end ?? null,
            target_week_of_month: addr.target_week_of_month ?? null,
            preferred_day: addr.preferred_day ?? null,
            use_client_service_window: addr.use_client_service_window ?? true,
            service_frequency: addr.service_frequency ?? null,
            custom_frequency_days: addr.custom_frequency_days ?? null,
            last_serviced_date: addr.last_serviced_date ?? null,
            address_type: addr.address_type ?? null,
            service_scope: addr.service_scope ?? null,
          });
        if (insertErr) console.error('client_addresses insert error:', insertErr);
      }

      if (currentOrganization?.id) {
        await savePreviousAddress(currentOrganization.id, {
          street: addr.street,
          city: addr.city,
          state: addr.state,
          postalCode: addr.postalCode,
          country: addr.country,
          latitude,
          longitude,
          fullAddress: fullAddr,
          normalized: isNormalized,
        });
      }
    }
  };

  const saveUnitQuantities = async (clientId: string) => {
    if (!currentOrganization?.id) return;
    for (const entry of unitQuantities) {
      const qty = parseFloat(entry.quantity);
      const addressId = entry.address_id || null;

      if (!entry.quantity || isNaN(qty) || qty <= 0) {
        let delQuery = supabase
          .from('client_unit_quantities')
          .delete()
          .eq('client_id', clientId)
          .eq('job_type_id', entry.job_type_id);
        if (addressId) {
          delQuery = delQuery.eq('address_id', addressId);
        } else {
          delQuery = delQuery.is('address_id', null);
        }
        await delQuery;
        continue;
      }

      let selectQuery = supabase
        .from('client_unit_quantities')
        .select('id')
        .eq('client_id', clientId)
        .eq('job_type_id', entry.job_type_id);
      if (addressId) {
        selectQuery = selectQuery.eq('address_id', addressId);
      } else {
        selectQuery = selectQuery.is('address_id', null);
      }
      const { data: existing } = await selectQuery.maybeSingle();

      if (existing) {
        await supabase
          .from('client_unit_quantities')
          .update({
            quantity: qty,
            pane_details: entry.pane_details || null,
            price_override: entry.price_override_enabled && entry.price_override != null ? entry.price_override : null,
            price_override_enabled: entry.price_override_enabled ?? false,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('client_unit_quantities')
          .insert({
            client_id: clientId,
            job_type_id: entry.job_type_id,
            quantity: qty,
            pane_details: entry.pane_details || null,
            price_override: entry.price_override_enabled && entry.price_override != null ? entry.price_override : null,
            price_override_enabled: entry.price_override_enabled ?? false,
            organization_id: currentOrganization.id,
            address_id: addressId,
          });
      }
    }
  };

  const checkForDuplicates = async (): Promise<{ id: string; name: string; matchedOn: string }[]> => {
    if (!currentOrganization?.id) return [];
    const matches: { id: string; name: string; matchedOn: string }[] = [];
    const seen = new Set<string>();

    const { data: allClients } = await supabase
      .from('clients')
      .select('id, name, phone, address')
      .eq('organization_id', currentOrganization.id);

    if (!allClients) return [];

    const trimmedName = name.trim().toLowerCase();
    const normalizedPhone = normalizePhoneForComparison(phone.trim());
    const primaryAddr = addresses.find(a => a.is_primary) || addresses[0];
    const addrText = primaryAddr
      ? (buildFullAddress(primaryAddr.street, primaryAddr.city, primaryAddr.state, primaryAddr.postalCode, primaryAddr.country) || primaryAddr.address || '').trim().toLowerCase()
      : '';

    for (const c of allClients) {
      if (client && c.id === client.id) continue;

      const reasons: string[] = [];

      if (trimmedName && c.name && c.name.trim().toLowerCase() === trimmedName) {
        reasons.push('name');
      }

      if (normalizedPhone.length >= 7 && c.phone) {
        const existingPhone = normalizePhoneForComparison(c.phone);
        if (existingPhone.length >= 7 && existingPhone === normalizedPhone) {
          reasons.push('phone');
        }
      }

      if (addrText.length > 5 && c.address) {
        const existingAddr = c.address.trim().toLowerCase();
        if (existingAddr.length > 5 && existingAddr === addrText) {
          reasons.push('address');
        }
      }

      if (reasons.length > 0 && !seen.has(c.id)) {
        seen.add(c.id);
        matches.push({ id: c.id, name: c.name, matchedOn: reasons.join(', ') });
      }
    }

    return matches;
  };

  const formatTime12 = (time24: string) => {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':').map(Number);
    let h = hours % 12;
    if (h === 0) h = 12;
    return `${h}:${(minutes || 0).toString().padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;
  };

  const handleTimePickerConfirm = (time: string) => {
    if (!activeTimePicker) return;
    const { type, addrIndex, windowIndex } = activeTimePicker;
    if (type === 'clientStart') {
      setCommercialWindowStart(time);
    } else if (type === 'clientEnd') {
      setCommercialWindowEnd(time);
    } else if (type === 'addrStart' && addrIndex !== undefined) {
      const updated = [...addresses];
      updated[addrIndex] = { ...updated[addrIndex], service_window_start: time || null };
      setAddresses(updated);
    } else if (type === 'addrEnd' && addrIndex !== undefined) {
      const updated = [...addresses];
      updated[addrIndex] = { ...updated[addrIndex], service_window_end: time || null };
      setAddresses(updated);
    } else if (type === 'windowStart' && addrIndex !== undefined && windowIndex !== undefined) {
      setAddressServiceWindows(prev => {
        const windows = [...(prev[addrIndex] || [])];
        windows[windowIndex] = { ...windows[windowIndex], window_start: time };
        return { ...prev, [addrIndex]: windows };
      });
    } else if (type === 'windowEnd' && addrIndex !== undefined && windowIndex !== undefined) {
      setAddressServiceWindows(prev => {
        const windows = [...(prev[addrIndex] || [])];
        windows[windowIndex] = { ...windows[windowIndex], window_end: time };
        return { ...prev, [addrIndex]: windows };
      });
    }
    setActiveTimePicker(null);
  };

  const handleQuickSave = async () => {
    const newFieldErrors: Record<string, string> = {};
    const computedQuickName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ') || name.trim();
    if (!computedQuickName) newFieldErrors.name = 'First name is required';
    if (!phone.trim() && !email.trim()) newFieldErrors.phone = 'Phone or email required';
    if (Object.keys(newFieldErrors).length > 0) {
      setFieldErrors(newFieldErrors);
      return;
    }
    setFieldErrors({});

    if (!duplicateConfirmedRef.current && !duplicateWarning.confirmed) {
      const matches = await checkForDuplicates();
      if (matches.length > 0) {
        setDuplicateWarning({ matches, confirmed: false });
        return;
      }
    }

    setLoading(true);
    setError('');
    try {
      const primaryAddress = addresses.find(a => a.is_primary) || addresses[0];
      const addressText = primaryAddress
        ? (buildFullAddress(primaryAddress.street, primaryAddress.city, primaryAddress.state, primaryAddress.postalCode, primaryAddress.country) || primaryAddress.address || '')
        : '';

      let latitude: number | null = primaryAddress?.latitude || null;
      let longitude: number | null = primaryAddress?.longitude || null;

      if (addressText && (!latitude || !longitude)) {
        const result = await mapboxGeocode(addressText);
        if (result) {
          latitude = result.latitude;
          longitude = result.longitude;
        }
      }

      const { data: newClient, error: insertError } = await supabase.from('clients').insert({
        user_id: user?.id,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        address: addressText,
        notes: '',
        typical_job_duration: 60,
        notification_preference: 'none',
        account_balance: 0,
        latitude,
        longitude,
      }).select('id').maybeSingle();

      if (insertError) throw insertError;

      if (newClient && addressText) {
        await saveAddresses(newClient.id);
      }

      showToast({ message: `${name.trim()} added`, type: 'success' });
      isDirtyRef.current = false;
      setQuickAddSuccess({ clientId: newClient!.id, clientName: name.trim() });
      onSave();
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (loading) return;
    if (Object.keys(priceOverrideInputs).length > 0) {
      const updated = [...addresses];
      Object.entries(priceOverrideInputs).forEach(([idx, raw]) => {
        const i = Number(idx);
        if (updated[i]) {
          updated[i] = { ...updated[i], price_override: raw === '' ? null : parseFloat(raw) || null };
        }
      });
      setAddresses(updated);
      setPriceOverrideInputs({});
    }
    const newFieldErrors: Record<string, string> = {};
    const computedSaveName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ') || name.trim();
    if (!computedSaveName) newFieldErrors.name = 'First name is required';
    if (Object.keys(newFieldErrors).length > 0) {
      setFieldErrors(newFieldErrors);
      return;
    }
    setFieldErrors({});

    if (!duplicateConfirmedRef.current && !duplicateWarning.confirmed && !client) {
      const matches = await checkForDuplicates();
      if (matches.length > 0) {
        setDuplicateWarning({ matches, confirmed: false });
        return;
      }
    }

    setLoading(true);
    setError('');

    try {
      const duration = parseInt(typicalJobDuration) || 60;
      let notificationPref = 'none';
      if (emailNotifications && textNotifications) {
        notificationPref = 'both';
      } else if (emailNotifications) {
        notificationPref = 'email';
      } else if (textNotifications) {
        notificationPref = 'text';
      }

      const primaryAddress = addresses.find(a => a.is_primary) || addresses[0];
      const addressText = primaryAddress
        ? (buildFullAddress(primaryAddress.street, primaryAddress.city, primaryAddress.state, primaryAddress.postalCode, primaryAddress.country) || primaryAddress.address || '')
        : '';

      let latitude: number | null = primaryAddress?.latitude || null;
      let longitude: number | null = primaryAddress?.longitude || null;

      if (addressText && (!latitude || !longitude)) {
        const result = await mapboxGeocode(addressText);
        if (result) {
          latitude = result.latitude;
          longitude = result.longitude;
        }
      }

      const computedName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ') || name.trim();

      if (client) {
        const { error } = await supabase
          .from('clients')
          .update({
            name: computedName,
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            email: email.trim(),
            phone: phone.trim(),
            address: addressText,
            notes: notes.trim(),
            client_type: clientType,
            commercial_service_window_start: commercialWindowStart || null,
            commercial_service_window_end: commercialWindowEnd || null,
            typical_job_duration: duration,
            notification_preference: notificationPref,
            account_balance: Number(accountBalance) || 0,
            latitude,
            longitude,
            secondary_contact_name: secondaryContactName.trim() || null,
            secondary_contact_phone: secondaryContactPhone.trim() || null,
            secondary_contact_email: secondaryContactEmail.trim() || null,
            price_override: clientPriceOverrideEnabled && clientPriceOverride !== '' ? parseFloat(clientPriceOverride) || null : null,
            price_override_enabled: clientPriceOverrideEnabled,
            disable_rounding: disableRounding,
            updated_at: new Date().toISOString(),
          })
          .eq('id', client.id)
          .eq('user_id', user!.id);

        if (error) throw error;

        await saveAddresses(client.id);
        await saveUnitQuantities(client.id);
        await savePropertyQualities(client.id);
        await saveClientCategories(client.id);
        await saveClientEquipment(client.id);
        await saveAddressEquipment();
        await saveServiceWindows();
        await saveClientPaneTypePrices(client.id);
        showToast({ message: 'Client updated', type: 'success' });
      } else {
        const { data: newClient, error } = await supabase.from('clients').insert({
          user_id: user?.id,
          name: computedName,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          address: addressText,
          notes: notes.trim(),
          client_type: clientType,
          commercial_service_window_start: commercialWindowStart || null,
          commercial_service_window_end: commercialWindowEnd || null,
          typical_job_duration: duration,
          notification_preference: notificationPref,
          account_balance: Number(accountBalance) || 0,
          latitude,
          longitude,
          secondary_contact_name: secondaryContactName.trim() || null,
          secondary_contact_phone: secondaryContactPhone.trim() || null,
          secondary_contact_email: secondaryContactEmail.trim() || null,
          price_override: clientPriceOverrideEnabled && clientPriceOverride !== '' ? parseFloat(clientPriceOverride) || null : null,
          price_override_enabled: clientPriceOverrideEnabled,
          disable_rounding: disableRounding,
        }).select('id').maybeSingle();

        if (error) throw error;

        if (newClient) {
          await saveAddresses(newClient.id);
          await saveUnitQuantities(newClient.id);
          await savePropertyQualities(newClient.id);
          await saveClientCategories(newClient.id);
          await saveClientEquipment(newClient.id);
          await saveServiceWindows(newClient.id);
          await saveClientPaneTypePrices(newClient.id);
        }
        showToast({ message: 'Client added', type: 'success' });
      }

      isDirtyRef.current = false;
      initialSnapshotRef.current = '';
      resetForm();
      onSave();
    } catch (error: any) {
      setError(error.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (isDirtyRef.current) {
      if (Platform.OS === 'web') {
        const choice = window.confirm('You have unsaved changes. Save before leaving?');
        if (choice) {
          handleSave();
        } else {
          isDirtyRef.current = false;
          initialSnapshotRef.current = '';
          resetForm();
          onClose();
        }
      } else {
        Alert.alert(
          'Unsaved Changes',
          'You have unsaved changes to this client.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Discard',
              style: 'destructive',
              onPress: () => {
                isDirtyRef.current = false;
                initialSnapshotRef.current = '';
                resetForm();
                onClose();
              },
            },
            {
              text: 'Save',
              onPress: () => { handleSave(); },
            },
          ]
        );
      }
    } else {
      resetForm();
      onClose();
    }
  };

  const pickPhone = (primaryPhone: string): Promise<string | null> => {
    if (!secondaryContactPhone) return Promise.resolve(primaryPhone);
    return new Promise(resolve => {
      phonePickerResolveRef.current = resolve;
      setPhonePickerOptions([
        { label: `${name || 'Client'} (Primary)`, phone: primaryPhone },
        { label: secondaryContactName || 'Secondary Contact', phone: secondaryContactPhone },
      ]);
      setPhonePickerVisible(true);
    });
  };

  const sendReviewFollowUp = async () => {
    if (!client?.id) return;
    const reviewLink = orgGoogleReviewUrl;
    if (!reviewLink) return;

    const hasPhone = !!phone;
    const hasEmail = !!email;
    if (!hasPhone && !hasEmail) return;

    setSendingReviewFollowUp(true);
    try {
      const [smsTemplateRes, emailTemplateRes, settingsRes] = await Promise.all([
        supabase
          .from('message_templates')
          .select('message_text')
          .eq('organization_id', currentOrganization!.id)
          .eq('template_type', 'follow_up')
          .eq('delivery_method', 'sms')
          .maybeSingle(),
        supabase
          .from('message_templates')
          .select('email_subject, email_body, message_text')
          .eq('organization_id', currentOrganization!.id)
          .eq('template_type', 'follow_up')
          .eq('delivery_method', 'email')
          .maybeSingle(),
        supabase
          .from('business_settings')
          .select('business_name, sms_send_channel, email_send_channel')
          .eq('organization_id', currentOrganization!.id)
          .maybeSingle(),
      ]);

      const businessName = settingsRes.data?.business_name || '';
      const clientName = name || 'there';
      const smsChannel: string = settingsRes.data?.sms_send_channel || 'native';
      const emailChannel: string = settingsRes.data?.email_send_channel || 'native';

      const replaceVars = (text: string) =>
        text
          .replace(/\{client_name\}/g, clientName)
          .replace(/\{business_name\}/g, businessName)
          .replace(/\{review_link\}/g, reviewLink)
          .replace(/,?\s*from \{technician_name\}/gi, '')
          .replace(/\{technician_name\}/g, '');

      const defaultSmsBody = "Hi {client_name}, this is {business_name}. If you were happy with your service, would you mind leaving us a quick review? It really helps: {review_link}\nIf anything wasn't perfect, let us know\u2014we'd love to make it right.";
      const defaultEmailSubject = 'How did we do, {client_name}?';
      const defaultEmailBody = "Hi {client_name},\n\nThank you for choosing {business_name}! We hope you are happy with your recent service.\n\nIf you have a moment, we would really appreciate it if you left us a review — it makes a huge difference to our small business:\n{review_link}\n\nIf anything wasn't perfect, please let us know. We'd love the chance to make it right.\n\nThank you,\n{business_name}";

      const smsBody = replaceVars(smsTemplateRes.data?.message_text || defaultSmsBody);
      const emailSubject = replaceVars(emailTemplateRes.data?.email_subject || defaultEmailSubject);
      const emailBody = replaceVars(
        emailTemplateRes.data?.email_body || emailTemplateRes.data?.message_text || defaultEmailBody,
      );

      let sent = false;

      if (hasEmail && emailChannel === 'native') {
        await sendEmail(email, emailSubject, emailBody);
        sent = true;
      } else if (hasPhone) {
        const chosenPhone = await pickPhone(phone);
        if (!chosenPhone) return;
        if (smsChannel === 'native') {
          const phoneNumber = chosenPhone.replace(/\D/g, '');
          const smsUrl = Platform.OS === 'ios'
            ? `sms:${phoneNumber}&body=${encodeURIComponent(smsBody)}`
            : `sms:${phoneNumber}?body=${encodeURIComponent(smsBody)}`;
          await Linking.openURL(smsUrl);
          sent = true;
        } else {
          await invokeFunction('send-sms', {
            organization_id: currentOrganization!.id,
            to: chosenPhone,
            body: smsBody,
          });
          sent = true;
        }
      } else if (hasEmail && emailChannel !== 'native') {
        await sendEmail(email, emailSubject, emailBody);
        sent = true;
      }

      if (sent) {
        const now = new Date().toISOString();
        await supabase
          .from('clients')
          .update({ review_follow_up_sent_at: now })
          .eq('id', client.id);
        setReviewFollowUpSentAt(now);
        showToast({ message: 'Review request sent', type: 'success' });
        onSave();
      }
    } catch (err: any) {
      console.error('Review follow-up failed:', err);
      showToast({ message: 'Failed to send review request', type: 'error' });
    } finally {
      setSendingReviewFollowUp(false);
    }
  };

  const sendTemplatedSms = async (
    templateType: 'day_of' | 'on_way' | 'follow_up',
    setSending: (v: boolean) => void,
    successMsg: string,
  ) => {
    if (!phone || !currentOrganization?.id) return;
    setSending(true);
    try {
      const { data: templateData } = await supabase
        .from('message_templates')
        .select('message_text')
        .eq('organization_id', currentOrganization.id)
        .eq('template_type', templateType)
        .eq('delivery_method', 'sms')
        .maybeSingle();

      const defaultMessages: Record<string, string> = {
        day_of: `Hi ${name}, just a reminder that we have a service appointment scheduled for you today! We will be in touch shortly.`,
        on_way: `Hi ${name}, we are on our way to your location now! We will arrive shortly.`,
        follow_up: `Hi ${name}, thank you for your business! We hope everything looks great. We'd love to hear your feedback.`,
      };

      const body = (templateData?.message_text || defaultMessages[templateType] || '')
        .replace(/\{client_name\}/gi, name)
        .replace(/\{name\}/gi, name);

      if (!body) throw new Error('No message configured');

      const chosenPhone = await pickPhone(phone);
      if (!chosenPhone) return;

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`${supabaseUrl}/functions/v1/send-sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ organization_id: currentOrganization.id, to: chosenPhone, body }),
      });

      if (!response.ok) throw new Error('Send failed');
      setClientFabOpen(false);
      showToast({ message: successMsg, type: 'success' });
    } catch (err: any) {
      showToast({ message: err?.message || 'Failed to send message', type: 'error' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.header}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                <Text style={styles.title}>
                  {client ? 'Edit Client' : quickAddSuccess ? 'Client Added' : creationMode === 'quick' ? 'Quick Add Client' : creationMode === 'full' ? 'Add Full Client' : 'Add Client'}
                </Text>
                {client && reviewFollowUpSentAt && (
                  <View style={styles.reviewSentBadge}>
                    <Check size={11} color="#16a34a" strokeWidth={2.5} />
                  </View>
                )}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                {client && (
                  <TouchableOpacity
                    onPress={() => setDeleteConfirm(true)}
                    disabled={loading}
                    style={{ padding: 6, marginRight: 4 }}
                    activeOpacity={0.7}
                  >
                    <Trash2 size={20} color="#dc2626" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => { setDeleteConfirm(false); handleClose(); }} disabled={loading}>
                  <X size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {duplicateWarning.matches.length > 0 && !duplicateWarning.confirmed ? (
              <View style={styles.duplicateWarningContainer}>
                <View style={styles.duplicateWarningHeader}>
                  <AlertTriangle size={18} color="#92400e" />
                  <Text style={styles.duplicateWarningTitle}>Possible duplicate{duplicateWarning.matches.length > 1 ? 's' : ''} found</Text>
                </View>
                {duplicateWarning.matches.map((m) => (
                  <Text key={m.id} style={styles.duplicateWarningItem}>
                    "{m.name}" — matched by {m.matchedOn}
                  </Text>
                ))}
                <View style={styles.duplicateWarningActions}>
                  <TouchableOpacity
                    style={styles.duplicateWarningCancelBtn}
                    onPress={() => { duplicateConfirmedRef.current = false; setDuplicateWarning({ matches: [], confirmed: false }); }}
                  >
                    <Text style={styles.duplicateWarningCancelText}>Go Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.duplicateWarningSaveBtn}
                    onPress={() => {
                      duplicateConfirmedRef.current = true;
                      setDuplicateWarning(prev => ({ ...prev, confirmed: true }));
                      const isQuick = creationMode === 'quick';
                      if (isQuick) handleQuickSave(); else handleSave();
                    }}
                  >
                    <LinearGradient
                      colors={['#d4850a', '#c27608']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.duplicateWarningSaveBtnGradient}
                    >
                      <Text style={styles.duplicateWarningSaveText}>Save Anyway</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {!client && quickAddSuccess ? (
              <View style={{ padding: 24, alignItems: 'center' }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#2D8B57', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <Check size={28} color="#fff" />
                </View>
                <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 6, textAlign: 'center' }}>
                  {quickAddSuccess.clientName} added
                </Text>
                <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 24, lineHeight: 20 }}>
                  Want to add more details like secondary contacts, job duration, service categories, or equipment?
                </Text>
                <TouchableOpacity
                  style={{ width: '100%', borderRadius: 10, overflow: 'hidden' as any, marginBottom: 10 }}
                  onPress={async () => {
                    const cId = quickAddSuccess.clientId;
                    const cName = quickAddSuccess.clientName;
                    setQuickAddSuccess(null);
                    resetForm();
                    onClose();
                    setTimeout(() => {
                      const fakeClient = { id: cId, name: cName, email: '', phone: '', address: '', notes: '' } as Client;
                      onClose();
                    }, 100);
                  }}
                >
                  <LinearGradient
                    colors={['#1B4D6E', '#245d82']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ padding: 14, alignItems: 'center' }}
                  >
                    <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>Add More Details</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ width: '100%', padding: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}
                  onPress={() => { resetForm(); onClose(); }}
                >
                  <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textSecondary }}>Done</Text>
                </TouchableOpacity>
              </View>
            ) : !client && creationMode === 'chooser' ? (
              <View style={{ padding: 20 }}>
                <TouchableOpacity
                  style={{ backgroundColor: '#1B4D6E', borderRadius: 12, padding: 18, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 14 }}
                  onPress={() => setCreationMode('quick')}
                  activeOpacity={0.8}
                >
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                    <Plus size={22} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 2 }}>Quick Add</Text>
                    <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 18 }}>Name + phone or email. Done in 2 taps.</Text>
                  </View>
                  <ChevronDown size={18} color="rgba(255,255,255,0.5)" style={{ transform: [{ rotate: '-90deg' }] }} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 18, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 14 }}
                  onPress={() => setCreationMode('full')}
                  activeOpacity={0.8}
                >
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(27,77,110,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                    <Users size={22} color="#1B4D6E" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 2 }}>Add Full Client</Text>
                    <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 18 }}>All fields: contacts, addresses, equipment, notes, and more.</Text>
                  </View>
                  <ChevronDown size={18} color={colors.textSecondary} style={{ transform: [{ rotate: '-90deg' }] }} />
                </TouchableOpacity>
              </View>
            ) : !client && creationMode === 'quick' ? (
              <>
              <ScrollView style={styles.form} keyboardShouldPersistTaps="handled">
                <View style={{ marginBottom: 14 }}>
                  <Text style={[styles.label, { marginBottom: 6 }]}>Name *</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TextInput
                      style={[styles.input, { flex: 1, minWidth: 0 }, fieldErrors.name ? { borderColor: '#dc2626', borderWidth: 1.5 } : {}]}
                      value={firstName}
                      onChangeText={(v) => { isDirtyRef.current = true; setFirstName(v); setName([v, lastName].filter(Boolean).join(' ')); if (fieldErrors.name) setFieldErrors(p => ({ ...p, name: '' })); }}
                      placeholder="First name"
                      editable={!loading}
                      autoFocus
                    />
                    <TextInput
                      style={[styles.input, { flex: 1, minWidth: 0 }]}
                      value={lastName}
                      onChangeText={(v) => { isDirtyRef.current = true; setLastName(v); setName([firstName, v].filter(Boolean).join(' ')); }}
                      placeholder="Last name"
                      editable={!loading}
                    />
                  </View>
                  {fieldErrors.name ? <Text style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{fieldErrors.name}</Text> : null}
                </View>
                <View style={{ marginBottom: 14 }}>
                  <Text style={[styles.label, { marginBottom: 6 }]}>Phone {!email.trim() ? '*' : ''}</Text>
                  <TextInput
                    style={[styles.input, fieldErrors.phone ? { borderColor: '#dc2626', borderWidth: 1.5 } : {}]}
                    value={phone}
                    onChangeText={(v) => { setPhone(v); if (fieldErrors.phone) setFieldErrors(p => ({ ...p, phone: '' })); }}
                    onBlur={() => setPhone(formatPhoneNumber(phone, businessCountry))}
                    placeholder={businessCountry === 'US' || businessCountry === 'CA' ? '(555) 123-4567' : 'Phone number'}
                    keyboardType="phone-pad"
                    editable={!loading}
                  />
                  {fieldErrors.phone ? <Text style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{fieldErrors.phone}</Text> : null}
                </View>
                <View style={{ marginBottom: 14 }}>
                  <Text style={[styles.label, { marginBottom: 6 }]}>Email {!phone.trim() ? '*' : ''}</Text>
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={(v) => { setEmail(v); if (fieldErrors.phone) setFieldErrors(p => ({ ...p, phone: '' })); }}
                    placeholder="client@example.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    editable={!loading}
                  />
                </View>
                <View style={{ marginBottom: 14 }}>
                  <Text style={[styles.label, { marginBottom: 6 }]}>Address</Text>
                  <AddressAutocomplete
                    value={addresses[0] ? {
                      street: addresses[0].street,
                      city: addresses[0].city,
                      state: addresses[0].state,
                      postalCode: addresses[0].postalCode,
                      country: addresses[0].country,
                      latitude: addresses[0].latitude || null,
                      longitude: addresses[0].longitude || null,
                      fullAddress: addresses[0].address,
                      normalized: addresses[0].normalized,
                    } : emptyAddressData()}
                    onChange={(data: AddressData) => {
                      const addr: ClientAddress = {
                        label: 'Home 1',
                        address: data.fullAddress || buildFullAddress(data.street, data.city, data.state, data.postalCode, data.country),
                        street: data.street,
                        city: data.city,
                        state: data.state,
                        postalCode: data.postalCode,
                        country: data.country || 'United States',
                        latitude: data.latitude,
                        longitude: data.longitude,
                        is_primary: true,
                        isNew: true,
                        normalized: data.normalized,
                      };
                      setAddresses([addr]);
                    }}
                    organizationId={currentOrganization?.id || ''}
                  />
                </View>
              </ScrollView>
              <View style={styles.footer}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setCreationMode('chooser')}
                  disabled={loading}
                >
                  <Text style={styles.cancelButtonText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveButton, styles.saveButtonSolid, loading && styles.saveButtonDisabled]}
                  onPress={handleQuickSave}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
              </>
            ) : (
            <>
            <ScrollView style={styles.form} keyboardShouldPersistTaps="handled">
              {!client && (
                <View style={{ marginBottom: 16 }}>
                  <View style={{ marginBottom: 14 }}>
                    <Text style={[styles.label, { marginBottom: 6 }]}>Name *</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TextInput
                        style={[styles.input, { flex: 1, minWidth: 0 }, fieldErrors.name ? { borderColor: '#dc2626', borderWidth: 1.5 } : {}]}
                        value={firstName}
                        onChangeText={(v) => { isDirtyRef.current = true; setFirstName(v); setName([v, lastName].filter(Boolean).join(' ')); if (fieldErrors.name) setFieldErrors(p => ({ ...p, name: '' })); }}
                        placeholder="First name"
                        editable={!loading}
                        autoFocus
                      />
                      <TextInput
                        style={[styles.input, { flex: 1, minWidth: 0 }]}
                        value={lastName}
                        onChangeText={(v) => { isDirtyRef.current = true; setLastName(v); setName([firstName, v].filter(Boolean).join(' ')); }}
                        placeholder="Last name"
                        editable={!loading}
                      />
                    </View>
                    {fieldErrors.name ? <Text style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{fieldErrors.name}</Text> : null}
                  </View>
                  <View style={{ marginBottom: 14 }}>
                    <Text style={[styles.label, { marginBottom: 6 }]}>Phone</Text>
                    <TextInput
                      style={styles.input}
                      value={phone}
                      onChangeText={setPhone}
                      onBlur={() => setPhone(formatPhoneNumber(phone, businessCountry))}
                      placeholder={businessCountry === 'US' || businessCountry === 'CA' ? '(555) 123-4567' : 'Phone number'}
                      keyboardType="phone-pad"
                      editable={!loading}
                    />
                  </View>
                  <View style={{ marginBottom: 14 }}>
                    <Text style={[styles.label, { marginBottom: 6 }]}>Email</Text>
                    <TextInput
                      style={styles.input}
                      value={email}
                      onChangeText={setEmail}
                      placeholder="client@example.com"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      editable={!loading}
                    />
                  </View>
                  <View style={{ marginBottom: 14 }}>
                    <Text style={[styles.label, { marginBottom: 6 }]}>Address</Text>
                    <AddressAutocomplete
                      value={addresses[0] ? {
                        street: addresses[0].street,
                        city: addresses[0].city,
                        state: addresses[0].state,
                        postalCode: addresses[0].postalCode,
                        country: addresses[0].country,
                        latitude: addresses[0].latitude || null,
                        longitude: addresses[0].longitude || null,
                        fullAddress: addresses[0].address,
                        normalized: addresses[0].normalized,
                      } : emptyAddressData()}
                      onChange={(data: AddressData) => {
                        const addr: ClientAddress = {
                          label: 'Home 1',
                          address: data.fullAddress || buildFullAddress(data.street, data.city, data.state, data.postalCode, data.country),
                          street: data.street,
                          city: data.city,
                          state: data.state,
                          postalCode: data.postalCode,
                          country: data.country || 'United States',
                          latitude: data.latitude,
                          longitude: data.longitude,
                          is_primary: true,
                          isNew: true,
                          normalized: data.normalized,
                        };
                        setAddresses([addr]);
                      }}
                      organizationId={currentOrganization?.id || ''}
                    />
                    {addresses[0]?.street ? (() => {
                      const addr = addresses[0];
                      const index = 0;
                      const isExpanded = expandedAddrDetails.has(index);
                      return (
                        <View style={[styles.addrDetailsCollapsible, { marginTop: 8 }]}>
                          <TouchableOpacity
                            style={styles.addrDetailsToggle}
                            onPress={() => {
                              setExpandedAddrDetails(prev => {
                                const next = new Set(prev);
                                if (next.has(index)) { next.delete(index); } else { next.add(index); }
                                return next;
                              });
                            }}
                          >
                            <View style={styles.addrDetailsToggleLeft}>
                              <Text style={styles.addrDetailsToggleLabel}>Address Details</Text>
                              {!!(addr.access_code || addr.price_override_enabled || addr.typical_job_duration) && (
                                <View style={styles.addrDetailsActivePill}>
                                  <Text style={styles.addrDetailsActivePillText}>
                                    {[addr.access_code && 'Code', addr.price_override_enabled && 'Price', addr.typical_job_duration && 'Duration'].filter(Boolean).join(' · ')}
                                  </Text>
                                </View>
                              )}
                            </View>
                            <ChevronDown size={16} color={colors.textSecondary} style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }} />
                          </TouchableOpacity>
                          {isExpanded && (
                            <View style={styles.addrDetailsContent}>
                              <View style={styles.addrSubSection}>
                                <View style={styles.addrSubSectionHeader}>
                                  <KeySquare size={12} color={colors.textSecondary} />
                                  <Text style={styles.addrSubSectionLabel}>Access Code</Text>
                                </View>
                                <View style={styles.accessCodeTypeRow}>
                                  {ACCESS_CODE_TYPES.map(ct => (
                                    <TouchableOpacity
                                      key={ct.key}
                                      style={[styles.accessCodeTypeChip, addr.access_code_type === ct.key && styles.accessCodeTypeChipActive]}
                                      onPress={() => {
                                        const updated = [...addresses];
                                        updated[0] = { ...updated[0], access_code_type: addr.access_code_type === ct.key ? null : ct.key };
                                        setAddresses(updated);
                                      }}
                                    >
                                      <Text style={[styles.accessCodeTypeChipText, addr.access_code_type === ct.key && styles.accessCodeTypeChipTextActive]}>{ct.label}</Text>
                                    </TouchableOpacity>
                                  ))}
                                </View>
                                <TextInput
                                  style={styles.accessCodeInput}
                                  value={addr.access_code ?? ''}
                                  onChangeText={(v) => {
                                    const updated = [...addresses];
                                    updated[0] = { ...updated[0], access_code: v.slice(0, 10) };
                                    setAddresses(updated);
                                  }}
                                  placeholder="Enter code (max 10)"
                                  maxLength={10}
                                  autoCapitalize="none"
                                  editable={!loading}
                                />
                              </View>
                              <View style={styles.addrSubSection}>
                                <View style={styles.addrSubSectionHeader}>
                                  <DollarSign size={12} color={colors.textSecondary} />
                                  <Text style={styles.addrSubSectionLabel}>Flat Rate Price Override</Text>
                                </View>
                                <View style={styles.priceOverrideRow}>
                                  <TouchableOpacity
                                    style={styles.priceOverrideToggle}
                                    onPress={() => {
                                      const updated = [...addresses];
                                      updated[0] = { ...updated[0], price_override_enabled: !addr.price_override_enabled };
                                      setAddresses(updated);
                                    }}
                                    disabled={loading}
                                  >
                                    {addr.price_override_enabled
                                      ? <ToggleRight size={26} color="#1B4D6E" />
                                      : <ToggleLeft size={26} color="#bbb" />
                                    }
                                    <Text style={[styles.priceOverrideToggleLabel, addr.price_override_enabled && styles.priceOverrideToggleLabelActive]}>
                                      {addr.price_override_enabled ? 'Override active' : 'Use auto-calculation'}
                                    </Text>
                                  </TouchableOpacity>
                                </View>
                                {addr.price_override_enabled && (
                                  <View style={styles.priceOverrideInputRow}>
                                    <Text style={styles.priceOverrideCurrency}>$</Text>
                                    <TextInput
                                      style={styles.priceOverrideInput}
                                      value={priceOverrideInputs[0] !== undefined ? priceOverrideInputs[0] : (addr.price_override !== null && addr.price_override !== undefined ? String(addr.price_override) : '')}
                                      onChangeText={(v) => {
                                        const cleaned = v.replace(/[^0-9.]/g, '');
                                        setPriceOverrideInputs(prev => ({ ...prev, [0]: cleaned }));
                                      }}
                                      onBlur={() => {
                                        const raw = priceOverrideInputs[0];
                                        if (raw !== undefined) {
                                          const updated = [...addresses];
                                          const parsed = raw === '' ? null : parseFloat(raw) || null;
                                          const rounded = parsed != null ? roundPrice(parsed, roundingSettings) : null;
                                          updated[0] = { ...updated[0], price_override: rounded };
                                          setAddresses(updated);
                                          setPriceOverrideInputs(prev => { const n = { ...prev }; delete n[0]; return n; });
                                        }
                                      }}
                                      placeholder="0.00"
                                      keyboardType="decimal-pad"
                                      editable={!loading}
                                    />
                                    <Text style={styles.priceOverrideHint}>overrides auto total</Text>
                                  </View>
                                )}
                              </View>
                              <View style={styles.addrSubSection}>
                                <View style={styles.addrSubSectionHeader}>
                                  <Clock size={12} color={colors.textSecondary} />
                                  <Text style={styles.addrSubSectionLabel}>Custom Duration Override</Text>
                                </View>
                                <Text style={styles.addrSubSectionHint}>Overrides the default duration for this address</Text>
                                <DurationDrumPicker
                                  value={addr.typical_job_duration ?? null}
                                  onChange={(mins) => {
                                    const updated = [...addresses];
                                    updated[0] = { ...updated[0], typical_job_duration: mins };
                                    setAddresses(updated);
                                  }}
                                />
                              </View>
                              {(addr.address_type === 'commercial' || (!addr.address_type && clientType === 'commercial')) && (
                                <View style={styles.addrSubSection}>
                                  <View style={styles.addrSubSectionHeader}>
                                    <CalendarPlus size={12} color={colors.textSecondary} />
                                    <Text style={styles.addrSubSectionLabel}>Commercial Scheduling</Text>
                                  </View>
                                  <View style={{ marginBottom: 8 }}>
                                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text, marginBottom: 4 }}>Target Week of Month</Text>
                                    <View style={styles.accessCodeTypeRow}>
                                      {([{ val: 1, label: '1st' }, { val: 2, label: '2nd' }, { val: 3, label: '3rd' }, { val: 4, label: '4th' }] as const).map(w => (
                                        <TouchableOpacity
                                          key={w.val}
                                          style={[styles.accessCodeTypeChip, addr.target_week_of_month === w.val && styles.accessCodeTypeChipActive]}
                                          onPress={() => {
                                            const updated = [...addresses];
                                            updated[0] = { ...updated[0], target_week_of_month: addr.target_week_of_month === w.val ? null : w.val };
                                            setAddresses(updated);
                                          }}
                                        >
                                          <Text style={[styles.accessCodeTypeChipText, addr.target_week_of_month === w.val && styles.accessCodeTypeChipTextActive]}>{w.label}</Text>
                                        </TouchableOpacity>
                                      ))}
                                    </View>
                                  </View>
                                  <View style={{ marginBottom: 8 }}>
                                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text, marginBottom: 4 }}>Preferred Day</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                                      {(['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as const).map(day => (
                                        <TouchableOpacity
                                          key={day}
                                          style={[styles.accessCodeTypeChip, addr.preferred_day === day && styles.accessCodeTypeChipActive]}
                                          onPress={() => {
                                            const updated = [...addresses];
                                            updated[0] = { ...updated[0], preferred_day: addr.preferred_day === day ? null : day };
                                            setAddresses(updated);
                                          }}
                                        >
                                          <Text style={[styles.accessCodeTypeChipText, addr.preferred_day === day && styles.accessCodeTypeChipTextActive]}>{day.charAt(0).toUpperCase() + day.slice(1, 3)}</Text>
                                        </TouchableOpacity>
                                      ))}
                                    </ScrollView>
                                  </View>
                                  <View style={{ marginBottom: 8 }}>
                                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text, marginBottom: 4 }}>Service Frequency</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                                      {([{ val: 'weekly', label: 'Weekly' }, { val: 'bi-weekly', label: 'Bi-Weekly' }, { val: 'monthly', label: 'Monthly' }, { val: 'quarterly', label: 'Quarterly' }, { val: 'bi-annually', label: 'Bi-Annual' }, { val: 'annually', label: 'Annual' }, { val: 'custom', label: 'Custom' }] as const).map(freq => (
                                        <TouchableOpacity
                                          key={freq.val}
                                          style={[styles.accessCodeTypeChip, addr.service_frequency === freq.val && styles.accessCodeTypeChipActive]}
                                          onPress={() => {
                                            const updated = [...addresses];
                                            updated[0] = { ...updated[0], service_frequency: addr.service_frequency === freq.val ? null : freq.val, custom_frequency_days: freq.val !== 'custom' ? null : addr.custom_frequency_days };
                                            setAddresses(updated);
                                          }}
                                        >
                                          <Text style={[styles.accessCodeTypeChipText, addr.service_frequency === freq.val && styles.accessCodeTypeChipTextActive]}>{freq.label}</Text>
                                        </TouchableOpacity>
                                      ))}
                                    </ScrollView>
                                    {addr.service_frequency === 'custom' && (
                                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                                        <Text style={{ fontSize: 12, color: colors.textSecondary }}>Every</Text>
                                        <TextInput
                                          style={[styles.accessCodeInput, { width: 60, textAlign: 'center' }]}
                                          value={addr.custom_frequency_days ? String(addr.custom_frequency_days) : ''}
                                          onChangeText={(v) => {
                                            const num = parseInt(v.replace(/[^0-9]/g, ''), 10);
                                            const updated = [...addresses];
                                            updated[0] = { ...updated[0], custom_frequency_days: isNaN(num) ? null : num };
                                            setAddresses(updated);
                                          }}
                                          placeholder="30"
                                          keyboardType="number-pad"
                                          editable={!loading}
                                        />
                                        <Text style={{ fontSize: 12, color: colors.textSecondary }}>days</Text>
                                      </View>
                                    )}
                                  </View>
                                </View>
                              )}
                            </View>
                          )}
                        </View>
                      );
                    })() : null}
                  </View>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, marginTop: 4 }}
                    onPress={() => setShowMoreDetails(!showMoreDetails)}
                    activeOpacity={0.7}
                  >
                    <ChevronDown size={16} color="#1B4D6E" style={showMoreDetails ? { transform: [{ rotate: '180deg' }] } : undefined} />
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#1B4D6E' }}>
                      {showMoreDetails ? 'Hide Details' : 'More Details'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {(client || showMoreDetails) && (
              <>
              {client && (
              <>
              <CollapsibleField
                label="Name"
                fieldId="name"
                activeFieldId={activeFieldId}
                onToggle={toggleField}
                displayValue={name || undefined}
                required
                hasError={!!fieldErrors.name}
              >
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput
                    style={[styles.input, { flex: 1, minWidth: 0 }, fieldErrors.name ? { borderColor: '#dc2626', borderWidth: 1.5 } : {}]}
                    value={firstName}
                    onChangeText={(v) => { isDirtyRef.current = true; setFirstName(v); setName([v, lastName].filter(Boolean).join(' ')); if (fieldErrors.name) setFieldErrors(p => ({ ...p, name: '' })); }}
                    placeholder="First name"
                    editable={!loading}
                  />
                  <TextInput
                    style={[styles.input, { flex: 1, minWidth: 0 }]}
                    value={lastName}
                    onChangeText={(v) => { isDirtyRef.current = true; setLastName(v); setName([firstName, v].filter(Boolean).join(' ')); }}
                    placeholder="Last name"
                    editable={!loading}
                  />
                </View>
                {fieldErrors.name ? (
                  <Text style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{fieldErrors.name}</Text>
                ) : null}
              </CollapsibleField>

              <CollapsibleField
                label="Email"
                fieldId="email"
                activeFieldId={activeFieldId}
                onToggle={toggleField}
                displayValue={email || undefined}
                rightAction={email ? (
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation?.();
                      sendEmail(email);
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.7}
                  >
                    <Mail size={16} color="#1B4D6E" />
                  </TouchableOpacity>
                ) : undefined}
              >
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Email</Text>
                  <TouchableOpacity
                    style={[
                      styles.notifyToggle,
                      emailNotifications && styles.notifyToggleActive,
                    ]}
                    onPress={() => setEmailNotifications(!emailNotifications)}
                    disabled={loading}
                  >
                    <Mail size={14} color={emailNotifications ? '#fff' : '#666'} />
                    <Text
                      style={[
                        styles.notifyToggleText,
                        emailNotifications && styles.notifyToggleTextActive,
                      ]}
                    >
                      Notify
                    </Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="client@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!loading}
                />
                {isUnsubscribed && (
                  <View style={styles.unsubBanner}>
                    <MailX size={14} color="#dc2626" />
                    <Text style={styles.unsubBannerText}>
                      This client has unsubscribed from emails
                    </Text>
                    <TouchableOpacity
                      style={styles.resubButton}
                      onPress={handleResubscribe}
                      disabled={resubscribing}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.resubButtonText}>
                        {resubscribing ? 'Working...' : 'Re-subscribe'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </CollapsibleField>

              <CollapsibleField
                label="Phone"
                fieldId="phone"
                activeFieldId={activeFieldId}
                onToggle={toggleField}
                displayValue={formatPhoneNumber(phone, businessCountry) || undefined}
                rightAction={phone ? (
                  <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation?.();
                        makePhoneCall(phone);
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      activeOpacity={0.7}
                    >
                      <Phone size={16} color="#1B4D6E" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation?.();
                        Alert.alert(
                          formatPhoneNumber(phone, businessCountry),
                          undefined,
                          [
                            { text: 'Text (Native)', onPress: () => sendSMS(phone) },
                            { text: 'Text via Bizzy', onPress: () => setQuickSendVisible(true) },
                            { text: 'Cancel', style: 'cancel' },
                          ]
                        );
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      activeOpacity={0.7}
                    >
                      <MessageCircle size={16} color="#1B4D6E" />
                    </TouchableOpacity>
                  </View>
                ) : undefined}
              >
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Phone</Text>
                  <TouchableOpacity
                    style={[
                      styles.notifyToggle,
                      textNotifications && styles.notifyToggleActive,
                    ]}
                    onPress={() => setTextNotifications(!textNotifications)}
                    disabled={loading}
                  >
                    <MessageSquare size={14} color={textNotifications ? '#fff' : '#666'} />
                    <Text
                      style={[
                        styles.notifyToggleText,
                        textNotifications && styles.notifyToggleTextActive,
                      ]}
                    >
                      Notify
                    </Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  onBlur={() => setPhone(formatPhoneNumber(phone, businessCountry))}
                  placeholder="(555) 123-4567"
                  keyboardType="phone-pad"
                  editable={!loading}
                />
              </CollapsibleField>
              </>
              )}

              <CollapsibleField
                label="Secondary Contact"
                fieldId="secondaryContact"
                activeFieldId={activeFieldId}
                onToggle={toggleField}
                displayValue={secondaryContactName || undefined}
              >
                <View style={styles.secondaryContactCard}>
                  <TextInput
                    style={[styles.input, styles.secondaryInput]}
                    value={secondaryContactName}
                    onChangeText={setSecondaryContactName}
                    placeholder="Name (e.g. spouse, partner)"
                    placeholderTextColor={colors.textSecondary}
                    editable={!loading}
                  />
                  <TextInput
                    style={[styles.input, styles.secondaryInput]}
                    value={secondaryContactPhone}
                    onChangeText={setSecondaryContactPhone}
                    onBlur={() => setSecondaryContactPhone(formatPhoneNumber(secondaryContactPhone, businessCountry))}
                    placeholder="Phone number"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="phone-pad"
                    editable={!loading}
                  />
                  <TextInput
                    style={[styles.input, styles.secondaryInput]}
                    value={secondaryContactEmail}
                    onChangeText={setSecondaryContactEmail}
                    placeholder="Email (optional)"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    editable={!loading}
                  />
                </View>
              </CollapsibleField>

              <View style={styles.addressesSection}>
                <View style={styles.addressesSectionHeader}>
                  <View style={styles.labelWithIcon}>
                    <MapPin size={14} color="#1B4D6E" />
                    <Text style={styles.label}>Addresses</Text>
                  </View>
                </View>

                {addresses.length === 0 && (
                  <TouchableOpacity
                    style={styles.emptyAddressPrompt}
                    onPress={handleAddAddress}
                  >
                    <MapPin size={20} color={colors.textSecondary} />
                    <Text style={styles.emptyAddressText}>Tap to add an address</Text>
                  </TouchableOpacity>
                )}

                {addresses.map((addr, index) => {
                  const addrPaneEntry = unitBasedJobTypes
                    .filter(jt => jt.unit_of_measure === 'pane')
                    .map(jt => ({
                      jt,
                      entry: unitQuantities.find(q =>
                        q.job_type_id === jt.id &&
                        (addr.id ? q.address_id === addr.id : !q.address_id)
                      ),
                    }));
                  const hasPaneJobType = addrPaneEntry.length > 0;
                  const paneGroupEntry = hasPaneJobType
                    ? (addrPaneEntry[0].entry || null)
                    : null;
                  const rawPaneDetails: any = paneGroupEntry?.pane_details || {};
                  const paneJobTypeIds = addrPaneEntry.map(x => x.jt.id);

                  const getPaneCount = (key: string): number => {
                    if (rawPaneDetails[key] !== undefined) return Number(rawPaneDetails[key]) || 0;
                    if (key === 'standard') return (Number(rawPaneDetails.standard_exterior) || 0) + (Number(rawPaneDetails.standard_interior) || 0) + (Number(rawPaneDetails.standard_divisional) || 0);
                    if (key === 'french') return (Number(rawPaneDetails.french_exterior) || 0) + (Number(rawPaneDetails.french_interior) || 0) + (Number(rawPaneDetails.french_divisional) || 0);
                    if (key === 'storm') return (Number(rawPaneDetails.storm_exterior) || 0) + (Number(rawPaneDetails.storm_interior) || 0);
                    return 0;
                  };

                  const activePaneTypes = orgPaneTypes.length > 0
                    ? orgPaneTypes
                    : [
                        { key: 'standard', name: 'Standard', description: 'Single/double-hung windows', sort_order: 0, id: '' },
                        { key: 'french', name: 'French', description: 'Multi-lite divided windows & doors', sort_order: 1, id: '' },
                        { key: 'storm', name: 'Storm', description: 'Removable storm panels', sort_order: 2, id: '' },
                      ];

                  const getExteriorCount = (key: string): number => {
                    if (rawPaneDetails[`${key}_exterior`] !== undefined) return Number(rawPaneDetails[`${key}_exterior`]) || 0;
                    return getPaneCount(key);
                  };

                  const dynamicPaneTotal = activePaneTypes.reduce((sum, pt) => sum + getExteriorCount(pt.key), 0);
                  const paneGroupKey = `pane_addr_${index}`;
                  const isPaneExpanded = expandedPaneJobType === paneGroupKey;

                  const updatePaneField = (nextDetails: any) => {
                    const total = activePaneTypes.reduce((sum, pt) => sum + (Number(nextDetails[`${pt.key}_exterior`]) || 0), 0);
                    setUnitQuantities(prev => {
                      let next = [...prev];
                      paneJobTypeIds.forEach(jtId => {
                        const idx2 = next.findIndex(q =>
                          q.job_type_id === jtId &&
                          (addr.id ? q.address_id === addr.id : !q.address_id)
                        );
                        const newEntry: UnitQuantityEntry = {
                          job_type_id: jtId,
                          quantity: String(total),
                          pane_details: nextDetails as PaneDetails,
                          address_id: addr.id || null,
                        };
                        if (idx2 >= 0) next[idx2] = newEntry;
                        else next = [...next, newEntry];
                      });
                      return next;
                    });
                  };

                  const setExteriorCount = (key: string, val: number) => {
                    const clamped = Math.max(0, val);
                    const nextDetails: any = {
                      ...rawPaneDetails,
                      [`${key}_exterior`]: clamped,
                    };
                    updatePaneField(nextDetails);
                  };

                  return (
                    <View key={index} style={styles.addressCard}>
                      <View style={styles.addressCardHeader}>
                        <TouchableOpacity
                          style={styles.labelSelector}
                          onPress={() => setShowLabelPicker(showLabelPicker === index ? null : index)}
                        >
                          <Tag size={12} color="#1B4D6E" />
                          <Text style={styles.labelSelectorText}>{addr.label}</Text>
                          <ChevronDown size={14} color={colors.textSecondary} />
                        </TouchableOpacity>
                        <View style={styles.addressCardActions}>
                          {addresses.length > 1 && (
                            <TouchableOpacity
                              style={[
                                styles.primaryToggle,
                                addr.is_primary && styles.primaryToggleActive,
                              ]}
                              onPress={() => handleUpdateAddress(index, 'is_primary', true)}
                            >
                              <Text style={[
                                styles.primaryToggleText,
                                addr.is_primary && styles.primaryToggleTextActive,
                              ]}>
                                {addr.is_primary ? 'Primary' : 'Set Primary'}
                              </Text>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity
                            onPress={() => handleRemoveAddress(index)}
                            style={styles.removeAddressButton}
                          >
                            <Trash2 size={14} color="#1B4D6E" />
                          </TouchableOpacity>
                        </View>
                      </View>

                      {showLabelPicker === index && (
                        <View style={styles.labelPickerContainer}>
                          {LABEL_PRESETS.map(preset => (
                            <TouchableOpacity
                              key={preset}
                              style={styles.labelPresetButton}
                              onPress={() => handleSelectLabel(index, preset)}
                            >
                              <Text style={styles.labelPresetText}>{preset}</Text>
                            </TouchableOpacity>
                          ))}
                          <TouchableOpacity
                            style={[styles.labelPresetButton, styles.labelPresetCustom]}
                            onPress={() => handleSelectLabel(index, 'Custom')}
                          >
                            <Text style={[styles.labelPresetText, { color: '#1B4D6E' }]}>Custom...</Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      {customLabelIndex === index && (
                        <View style={styles.customLabelRow}>
                          <TextInput
                            style={[styles.input, { flex: 1 }]}
                            value={customLabelText}
                            onChangeText={setCustomLabelText}
                            placeholder="Enter custom label"
                            autoFocus
                          />
                          <TouchableOpacity
                            style={styles.customLabelSave}
                            onPress={() => handleSetCustomLabel(index)}
                          >
                            <LinearGradient
                              colors={['#1B4D6E', '#245d82']}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={styles.customLabelSaveGradient}
                            >
                              <Text style={styles.customLabelSaveText}>Set</Text>
                            </LinearGradient>
                          </TouchableOpacity>
                        </View>
                      )}

                      <View style={styles.addressTypeRow}>
                        {(['residential', 'commercial'] as const).map(aType => {
                          const effectiveType = addr.address_type || clientType || null;
                          const isSelected = effectiveType === aType;
                          const isInherited = !addr.address_type && clientType === aType;
                          return (
                            <TouchableOpacity
                              key={aType}
                              style={[
                                styles.addressTypeChip,
                                isSelected
                                  ? { backgroundColor: aType === 'commercial' ? '#1B4D6E' : '#059669', borderColor: aType === 'commercial' ? '#1B4D6E' : '#059669' }
                                  : { backgroundColor: '#f3f4f6', borderColor: '#d1d5db' },
                              ]}
                              onPress={() => {
                                const newType = addr.address_type === aType ? null : aType;
                                handleUpdateAddress(index, 'address_type', newType);
                              }}
                            >
                              {isSelected && <Check size={10} color="#fff" />}
                              <Text style={[styles.addressTypeChipText, { color: isSelected ? '#fff' : '#6b7280' }]}>
                                {aType.charAt(0).toUpperCase() + aType.slice(1)}
                              </Text>
                              {isInherited && <Text style={styles.addressTypeInherited}>(from client)</Text>}
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      {/* Service Scope selector — only relevant when address has pane job types */}
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                        {(['full_service', 'exterior_only'] as const).map(scope => {
                          const isSelected = addr.service_scope === scope;
                          const label = scope === 'full_service' ? 'Full Service' : 'Exterior Only';
                          return (
                            <TouchableOpacity
                              key={scope}
                              style={[
                                styles.addressTypeChip,
                                isSelected
                                  ? { backgroundColor: '#1B4D6E', borderColor: '#1B4D6E', flex: 1 }
                                  : { backgroundColor: '#f3f4f6', borderColor: '#d1d5db', flex: 1 },
                              ]}
                              onPress={() => {
                                const newScope = addr.service_scope === scope ? null : scope;
                                handleUpdateAddress(index, 'service_scope', newScope);
                              }}
                            >
                              {isSelected && <Check size={10} color="#fff" />}
                              <Text style={[styles.addressTypeChipText, { color: isSelected ? '#fff' : '#6b7280' }]}>
                                {label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      <AddressAutocomplete
                        value={{
                          street: addr.street,
                          city: addr.city,
                          state: addr.state,
                          postalCode: addr.postalCode,
                          country: addr.country,
                          latitude: addr.latitude || null,
                          longitude: addr.longitude || null,
                          fullAddress: addr.address,
                          normalized: addr.normalized,
                        }}
                        onChange={(data) => {
                          const updated = [...addresses];
                          updated[index] = {
                            ...updated[index],
                            street: data.street,
                            city: data.city,
                            state: data.state,
                            postalCode: data.postalCode,
                            country: data.country,
                            latitude: data.latitude,
                            longitude: data.longitude,
                            address: data.fullAddress || buildFullAddress(data.street, data.city, data.state, data.postalCode, data.country),
                            normalized: data.normalized,
                          };
                          setAddresses(updated);
                        }}
                        organizationId={currentOrganization?.id || ''}
                        showMapButton
                        onOpenMap={() => { setMapPinDropIndex(index); setShowMapPinDrop(true); }}
                      />

                      {(() => {
                        const isExpanded = expandedAddrDetails.has(index);
                        const addrEquipCount = addr.id ? (addressEquipment[addr.id]?.size || 0) : 0;
                        const hasAnySet = !!(addr.access_code || addr.price_override_enabled || addr.typical_job_duration || addr.target_week_of_month || addr.preferred_day || addrEquipCount > 0);
                        return (
                          <View style={styles.addrDetailsCollapsible}>
                            <TouchableOpacity
                              style={styles.addrDetailsToggle}
                              onPress={() => {
                                setExpandedAddrDetails(prev => {
                                  const next = new Set(prev);
                                  if (next.has(index)) { next.delete(index); } else { next.add(index); }
                                  return next;
                                });
                              }}
                            >
                              <View style={styles.addrDetailsToggleLeft}>
                                <Text style={styles.addrDetailsToggleLabel}>Address Details</Text>
                                {hasAnySet && (
                                  <View style={styles.addrDetailsActivePill}>
                                    <Text style={styles.addrDetailsActivePillText}>
                                      {[addr.access_code && 'Code', addr.price_override_enabled && 'Price', addr.typical_job_duration && 'Duration', addr.target_week_of_month && 'Schedule', addr.preferred_day && 'Day', addrEquipCount > 0 && `${addrEquipCount} equip`].filter(Boolean).join(' · ')}
                                    </Text>
                                  </View>
                                )}
                              </View>
                              <ChevronDown
                                size={16}
                                color={colors.textSecondary}
                                style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }}
                              />
                            </TouchableOpacity>

                            {isExpanded && (
                              <View style={styles.addrDetailsContent}>
                                <View style={styles.addrSubSection}>
                                  <View style={styles.addrSubSectionHeader}>
                                    <KeySquare size={12} color={colors.textSecondary} />
                                    <Text style={styles.addrSubSectionLabel}>Access Code</Text>
                                  </View>
                                  <View style={styles.accessCodeTypeRow}>
                                    {ACCESS_CODE_TYPES.map(ct => (
                                      <TouchableOpacity
                                        key={ct.key}
                                        style={[
                                          styles.accessCodeTypeChip,
                                          addr.access_code_type === ct.key && styles.accessCodeTypeChipActive,
                                        ]}
                                        onPress={() => {
                                          const updated = [...addresses];
                                          updated[index] = {
                                            ...updated[index],
                                            access_code_type: addr.access_code_type === ct.key ? null : ct.key,
                                          };
                                          setAddresses(updated);
                                        }}
                                      >
                                        <Text style={[
                                          styles.accessCodeTypeChipText,
                                          addr.access_code_type === ct.key && styles.accessCodeTypeChipTextActive,
                                        ]}>
                                          {ct.label}
                                        </Text>
                                      </TouchableOpacity>
                                    ))}
                                  </View>
                                  <TextInput
                                    style={styles.accessCodeInput}
                                    value={addr.access_code ?? ''}
                                    onChangeText={(v) => {
                                      const updated = [...addresses];
                                      updated[index] = { ...updated[index], access_code: v.slice(0, 10) };
                                      setAddresses(updated);
                                    }}
                                    placeholder="Enter code (max 10)"
                                    maxLength={10}
                                    autoCapitalize="none"
                                    editable={!loading}
                                  />
                                </View>

                                <View style={styles.addrSubSection}>
                                  <View style={styles.addrSubSectionHeader}>
                                    <DollarSign size={12} color={colors.textSecondary} />
                                    <Text style={styles.addrSubSectionLabel}>Flat Rate Price Override</Text>
                                  </View>
                                  <View style={styles.priceOverrideRow}>
                                    <TouchableOpacity
                                      style={styles.priceOverrideToggle}
                                      onPress={() => {
                                        const updated = [...addresses];
                                        updated[index] = { ...updated[index], price_override_enabled: !addr.price_override_enabled };
                                        setAddresses(updated);
                                      }}
                                      disabled={loading}
                                    >
                                      {addr.price_override_enabled
                                        ? <ToggleRight size={26} color="#1B4D6E" />
                                        : <ToggleLeft size={26} color="#bbb" />
                                      }
                                      <Text style={[
                                        styles.priceOverrideToggleLabel,
                                        addr.price_override_enabled && styles.priceOverrideToggleLabelActive,
                                      ]}>
                                        {addr.price_override_enabled ? 'Override active' : 'Use auto-calculation'}
                                      </Text>
                                    </TouchableOpacity>
                                  </View>
                                  {addr.price_override_enabled && (
                                    <View style={styles.priceOverrideInputRow}>
                                      <Text style={styles.priceOverrideCurrency}>$</Text>
                                      <TextInput
                                        style={styles.priceOverrideInput}
                                        value={priceOverrideInputs[index] !== undefined ? priceOverrideInputs[index] : (addr.price_override !== null && addr.price_override !== undefined ? String(addr.price_override) : '')}
                                        onChangeText={(v) => {
                                          const cleaned = v.replace(/[^0-9.]/g, '');
                                          setPriceOverrideInputs(prev => ({ ...prev, [index]: cleaned }));
                                        }}
                                        onBlur={() => {
                                          const raw = priceOverrideInputs[index];
                                          if (raw !== undefined) {
                                            const updated = [...addresses];
                                            const parsed = raw === '' ? null : parseFloat(raw) || null;
                                            const rounded = parsed != null ? roundPrice(parsed, roundingSettings) : null;
                                            updated[index] = { ...updated[index], price_override: rounded };
                                            setAddresses(updated);
                                            setPriceOverrideInputs(prev => { const n = { ...prev }; delete n[index]; return n; });
                                          }
                                        }}
                                        placeholder="0.00"
                                        keyboardType="decimal-pad"
                                        editable={!loading}
                                      />
                                      <Text style={styles.priceOverrideHint}>overrides auto total</Text>
                                    </View>
                                  )}
                                </View>

                                <View style={styles.addrSubSection}>
                                  <View style={styles.addrSubSectionHeader}>
                                    <Clock size={12} color={colors.textSecondary} />
                                    <Text style={styles.addrSubSectionLabel}>Custom Duration Override</Text>
                                  </View>
                                  <Text style={styles.addrSubSectionHint}>Overrides the client-level duration for this address specifically</Text>
                                  <DurationDrumPicker
                                    value={addr.typical_job_duration ?? null}
                                    onChange={(mins) => {
                                      const updated = [...addresses];
                                      updated[index] = { ...updated[index], typical_job_duration: mins };
                                      setAddresses(updated);
                                    }}
                                  />
                                </View>

                                {selectedEquipmentIds.size > 0 && addr.id && (
                                  <View style={styles.addrSubSection}>
                                    <View style={styles.addrSubSectionHeader}>
                                      <Wrench size={12} color={colors.textSecondary} />
                                      <Text style={styles.addrSubSectionLabel}>Equipment for this Address</Text>
                                    </View>
                                    <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 6 }}>
                                      {"Select which of this client's equipment is needed at this address."}
                                    </Text>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                      {equipmentInventory.filter(e => selectedEquipmentIds.has(e.id)).map(item => {
                                        const addrSet = addressEquipment[addr.id!] || new Set();
                                        const isAssigned = addrSet.has(item.id);
                                        return (
                                          <TouchableOpacity
                                            key={item.id}
                                            onPress={() => toggleAddressEquipment(addr.id!, item.id)}
                                            style={{
                                              flexDirection: 'row',
                                              alignItems: 'center',
                                              gap: 5,
                                              backgroundColor: isAssigned ? colors.primary : colors.primary + '10',
                                              borderRadius: 7,
                                              paddingHorizontal: 9,
                                              paddingVertical: 5,
                                              borderWidth: 1,
                                              borderColor: isAssigned ? colors.primary : colors.primary + '30',
                                            }}
                                          >
                                            <Wrench size={12} color={isAssigned ? '#fff' : colors.primary} />
                                            <Text style={{ fontSize: 12, color: isAssigned ? '#fff' : colors.primary, fontWeight: isAssigned ? '600' : '400' }}>{item.name}</Text>
                                            {isAssigned && <Check size={12} color="#fff" />}
                                          </TouchableOpacity>
                                        );
                                      })}
                                    </View>
                                  </View>
                                )}

                                {(addr.address_type === 'commercial' || (!addr.address_type && clientType === 'commercial')) && (
                                  <View style={styles.addrSubSection}>
                                    <View style={styles.addrSubSectionHeader}>
                                      <CalendarPlus size={12} color={colors.textSecondary} />
                                      <Text style={styles.addrSubSectionLabel}>Commercial Scheduling</Text>
                                    </View>

                                    <View style={{ marginBottom: 8 }}>
                                      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text, marginBottom: 4 }}>Target Week of Month</Text>
                                      <View style={styles.accessCodeTypeRow}>
                                        {([
                                          { val: 1, label: '1st' },
                                          { val: 2, label: '2nd' },
                                          { val: 3, label: '3rd' },
                                          { val: 4, label: '4th' },
                                        ] as const).map(w => (
                                          <TouchableOpacity
                                            key={w.val}
                                            style={[
                                              styles.accessCodeTypeChip,
                                              addr.target_week_of_month === w.val && styles.accessCodeTypeChipActive,
                                            ]}
                                            onPress={() => {
                                              const updated = [...addresses];
                                              updated[index] = {
                                                ...updated[index],
                                                target_week_of_month: addr.target_week_of_month === w.val ? null : w.val,
                                              };
                                              setAddresses(updated);
                                            }}
                                          >
                                            <Text style={[
                                              styles.accessCodeTypeChipText,
                                              addr.target_week_of_month === w.val && styles.accessCodeTypeChipTextActive,
                                            ]}>{w.label}</Text>
                                          </TouchableOpacity>
                                        ))}
                                      </View>
                                    </View>

                                    <View style={{ marginBottom: 8 }}>
                                      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text, marginBottom: 4 }}>Preferred Day</Text>
                                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                                        {(['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as const).map(day => (
                                          <TouchableOpacity
                                            key={day}
                                            style={[
                                              styles.accessCodeTypeChip,
                                              addr.preferred_day === day && styles.accessCodeTypeChipActive,
                                            ]}
                                            onPress={() => {
                                              const updated = [...addresses];
                                              updated[index] = {
                                                ...updated[index],
                                                preferred_day: addr.preferred_day === day ? null : day,
                                              };
                                              setAddresses(updated);
                                            }}
                                          >
                                            <Text style={[
                                              styles.accessCodeTypeChipText,
                                              addr.preferred_day === day && styles.accessCodeTypeChipTextActive,
                                            ]}>{day.charAt(0).toUpperCase() + day.slice(1, 3)}</Text>
                                          </TouchableOpacity>
                                        ))}
                                      </ScrollView>
                                    </View>

                                    <View style={{ marginBottom: 8 }}>
                                      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text, marginBottom: 4 }}>Service Frequency</Text>
                                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                                        {([
                                          { val: 'weekly', label: 'Weekly' },
                                          { val: 'bi-weekly', label: 'Bi-Weekly' },
                                          { val: 'monthly', label: 'Monthly' },
                                          { val: 'quarterly', label: 'Quarterly' },
                                          { val: 'bi-annually', label: 'Bi-Annual' },
                                          { val: 'annually', label: 'Annual' },
                                          { val: 'custom', label: 'Custom' },
                                        ] as const).map(freq => (
                                          <TouchableOpacity
                                            key={freq.val}
                                            style={[
                                              styles.accessCodeTypeChip,
                                              addr.service_frequency === freq.val && styles.accessCodeTypeChipActive,
                                            ]}
                                            onPress={() => {
                                              const updated = [...addresses];
                                              updated[index] = {
                                                ...updated[index],
                                                service_frequency: addr.service_frequency === freq.val ? null : freq.val,
                                                custom_frequency_days: freq.val !== 'custom' ? null : addr.custom_frequency_days,
                                              };
                                              setAddresses(updated);
                                            }}
                                          >
                                            <Text style={[
                                              styles.accessCodeTypeChipText,
                                              addr.service_frequency === freq.val && styles.accessCodeTypeChipTextActive,
                                            ]}>{freq.label}</Text>
                                          </TouchableOpacity>
                                        ))}
                                      </ScrollView>
                                      {addr.service_frequency === 'custom' && (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                                          <Text style={{ fontSize: 12, color: colors.textSecondary }}>Every</Text>
                                          <TextInput
                                            style={[styles.accessCodeInput, { width: 60, textAlign: 'center' }]}
                                            value={addr.custom_frequency_days ? String(addr.custom_frequency_days) : ''}
                                            onChangeText={(v) => {
                                              const num = parseInt(v.replace(/[^0-9]/g, ''), 10);
                                              const updated = [...addresses];
                                              updated[index] = { ...updated[index], custom_frequency_days: isNaN(num) ? null : num };
                                              setAddresses(updated);
                                            }}
                                            placeholder="30"
                                            keyboardType="number-pad"
                                            editable={!loading}
                                          />
                                          <Text style={{ fontSize: 12, color: colors.textSecondary }}>days</Text>
                                        </View>
                                      )}
                                    </View>

                                    <View style={{ marginBottom: 8 }}>
                                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text }}>Availability Windows</Text>
                                        <TouchableOpacity
                                          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(27,77,110,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}
                                          onPress={() => {
                                            setAddressServiceWindows(prev => {
                                              const existing = prev[index] || [];
                                              return {
                                                ...prev,
                                                [index]: [...existing, {
                                                  window_start: '',
                                                  window_end: '',
                                                  days_of_week: [],
                                                  label: '',
                                                  sort_order: existing.length,
                                                  isNew: true,
                                                }],
                                              };
                                            });
                                          }}
                                        >
                                          <Plus size={12} color="#1B4D6E" />
                                          <Text style={{ fontSize: 11, fontWeight: '600', color: '#1B4D6E' }}>Add Window</Text>
                                        </TouchableOpacity>
                                      </View>
                                      <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 8 }}>
                                        Add multiple time windows when this location has different available hours or day-specific availability.
                                      </Text>
                                      {(addressServiceWindows[index] || []).map((sw, wIdx) => (
                                        <View key={wIdx} style={{ backgroundColor: colors.background, borderRadius: 8, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: colors.border }}>
                                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                              <Clock size={12} color="#1B4D6E" />
                                              <Text style={{ fontSize: 11, fontWeight: '600', color: colors.text }}>Window {wIdx + 1}</Text>
                                            </View>
                                            <TouchableOpacity
                                              onPress={() => {
                                                setAddressServiceWindows(prev => {
                                                  const windows = [...(prev[index] || [])];
                                                  windows.splice(wIdx, 1);
                                                  return { ...prev, [index]: windows };
                                                });
                                              }}
                                            >
                                              <Trash2 size={14} color="#dc2626" />
                                            </TouchableOpacity>
                                          </View>
                                          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                                            <View style={{ flex: 1 }}>
                                              <Text style={{ fontSize: 10, color: colors.textSecondary, marginBottom: 3 }}>From</Text>
                                              <TouchableOpacity
                                                style={[styles.accessCodeInput, { justifyContent: 'center', paddingVertical: 8 }]}
                                                onPress={() => { if (!loading) setActiveTimePicker({ type: 'windowStart', addrIndex: index, windowIndex: wIdx }); }}
                                                disabled={loading}
                                              >
                                                <Text style={{ fontSize: 13, color: sw.window_start ? colors.text : colors.textSecondary }}>
                                                  {sw.window_start ? formatTime12(sw.window_start) : 'Start'}
                                                </Text>
                                              </TouchableOpacity>
                                            </View>
                                            <View style={{ flex: 1 }}>
                                              <Text style={{ fontSize: 10, color: colors.textSecondary, marginBottom: 3 }}>To</Text>
                                              <TouchableOpacity
                                                style={[styles.accessCodeInput, { justifyContent: 'center', paddingVertical: 8 }]}
                                                onPress={() => { if (!loading) setActiveTimePicker({ type: 'windowEnd', addrIndex: index, windowIndex: wIdx }); }}
                                                disabled={loading}
                                              >
                                                <Text style={{ fontSize: 13, color: sw.window_end ? colors.text : colors.textSecondary }}>
                                                  {sw.window_end ? formatTime12(sw.window_end) : 'End'}
                                                </Text>
                                              </TouchableOpacity>
                                            </View>
                                          </View>
                                          <Text style={{ fontSize: 10, color: colors.textSecondary, marginBottom: 4 }}>Days (leave empty for all days)</Text>
                                          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
                                            {(['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as const).map(day => {
                                              const isSelected = sw.days_of_week.includes(day);
                                              return (
                                                <TouchableOpacity
                                                  key={day}
                                                  style={[
                                                    styles.accessCodeTypeChip,
                                                    { paddingHorizontal: 8, paddingVertical: 4 },
                                                    isSelected && styles.accessCodeTypeChipActive,
                                                  ]}
                                                  onPress={() => {
                                                    setAddressServiceWindows(prev => {
                                                      const windows = [...(prev[index] || [])];
                                                      const current = windows[wIdx];
                                                      const days = isSelected
                                                        ? current.days_of_week.filter(d => d !== day)
                                                        : [...current.days_of_week, day];
                                                      windows[wIdx] = { ...current, days_of_week: days };
                                                      return { ...prev, [index]: windows };
                                                    });
                                                  }}
                                                >
                                                  <Text style={[
                                                    styles.accessCodeTypeChipText,
                                                    { fontSize: 10 },
                                                    isSelected && styles.accessCodeTypeChipTextActive,
                                                  ]}>{day.charAt(0).toUpperCase() + day.slice(1, 3)}</Text>
                                                </TouchableOpacity>
                                              );
                                            })}
                                          </ScrollView>
                                        </View>
                                      ))}
                                      {(!addressServiceWindows[index] || addressServiceWindows[index].length === 0) && (
                                        <Text style={{ fontSize: 11, color: colors.textSecondary, fontStyle: 'italic', textAlign: 'center', paddingVertical: 8 }}>
                                          No availability windows set -- available anytime
                                        </Text>
                                      )}
                                    </View>
                                  </View>
                                )}
                              </View>
                            )}
                          </View>
                        );
                      })()}

                      {(() => {
                        const hasAnyMeasurements = hasPaneJobType || unitBasedJobTypes.filter(jt => jt.unit_of_measure !== 'pane').length > 0 || true;
                        if (!hasAnyMeasurements) return null;

                        const propQualKey = `propqual_${index}`;
                        const isPropQualExpanded = expandedPaneJobType === propQualKey;

                        const unitLabelMap: Record<string, string> = {
                          sqft: 'sq ft',
                          linear_ft: 'linear ft',
                          item: 'items',
                          day: 'days',
                          mile: 'miles',
                        };
                        const nonPaneJobTypes = unitBasedJobTypes.filter(jt => jt.unit_of_measure !== 'pane');
                        const unitRows: Array<{ id: string; name: string; unit: string; unitLabel: string; category_id: string | null }> = nonPaneJobTypes
                          .slice()
                          .sort((a, b) => {
                            const ua = jobTypeUsageCounts[a.id] || 0;
                            const ub = jobTypeUsageCounts[b.id] || 0;
                            if (ub !== ua) return ub - ua;
                            return a.name.localeCompare(b.name);
                          })
                          .map(jt => ({
                            id: jt.id,
                            name: jt.name,
                            unit: jt.unit_of_measure,
                            unitLabel: jt.unit_of_measure === 'custom'
                              ? (jt.custom_unit_label || 'units')
                              : (unitLabelMap[jt.unit_of_measure] || jt.unit_of_measure),
                            category_id: jt.category_id || null,
                          }));
                        const sortedCategoriesForRows = categories
                          .filter(cat => unitRows.some(r => r.category_id === cat.id))
                          .slice()
                          .sort((a, b) => {
                            const ua = categoryUsageCounts[a.id] || 0;
                            const ub = categoryUsageCounts[b.id] || 0;
                            if (ub !== ua) return ub - ua;
                            return a.name.localeCompare(b.name);
                          });
                        const uncategorizedRows = unitRows.filter(r => !r.category_id || !categories.some(c => c.id === r.category_id));
                        const groupedUnitRows: Array<{ cat: { id: string; name: string; color: string } | null; rows: typeof unitRows }> = [
                          ...sortedCategoriesForRows.map(cat => ({
                            cat: { id: cat.id, name: cat.name, color: cat.color },
                            rows: unitRows.filter(r => r.category_id === cat.id),
                          })),
                          ...(uncategorizedRows.length > 0 ? [{ cat: null, rows: uncategorizedRows }] : []),
                        ];

                        const addrPropertyQualities = propertyQualities.filter(pq =>
                          addr.id ? pq.address_id === addr.id : !pq.address_id
                        );

                        const filledCount =
                          (hasPaneJobType && dynamicPaneTotal > 0 ? 1 : 0) +
                          unitRows.filter(row => {
                            const entry = unitQuantities.find(q =>
                              q.job_type_id === row.id &&
                              (addr.id ? q.address_id === addr.id : !q.address_id)
                            ) || unitQuantities.find(q => q.job_type_id === row.id && !q.address_id);
                            return Number(entry?.quantity) > 0;
                          }).length +
                          addrPropertyQualities.filter(pq => pq.quantity > 0 || pq.tally > 0).length;

                        const totalFields = (hasPaneJobType ? 1 : 0) + unitRows.length + addrPropertyQualities.length;

                        return (
                          <View style={styles.addrSubSection}>
                            <TouchableOpacity
                              style={styles.propQualHeader}
                              onPress={() => setExpandedPaneJobType(isPropQualExpanded ? null : propQualKey)}
                              disabled={loading}
                              activeOpacity={0.7}
                            >
                              <View style={styles.propQualHeaderLeft}>
                                <Ruler size={13} color="#1B4D6E" />
                                <Text style={styles.propQualHeaderLabel}>Property Qualities</Text>
                              </View>
                              <View style={styles.propQualHeaderRight}>
                                {hasPaneJobType && dynamicPaneTotal > 0 && !isPropQualExpanded && (
                                  <View style={[styles.propQualBadge, { backgroundColor: 'rgba(3,105,161,0.1)', borderWidth: 1, borderColor: 'rgba(3,105,161,0.25)' }]}>
                                    <Text style={[styles.propQualBadgeText, { color: '#0369a1' }]}>
                                      {dynamicPaneTotal} panes
                                    </Text>
                                  </View>
                                )}
                                {filledCount > 0 && (
                                  <View style={styles.propQualBadge}>
                                    <Text style={styles.propQualBadgeText}>{filledCount}/{totalFields} set</Text>
                                  </View>
                                )}
                                <ChevronDown
                                  size={15}
                                  color="#1B4D6E"
                                  style={{ transform: [{ rotate: isPropQualExpanded ? '180deg' : '0deg' }] }}
                                />
                              </View>
                            </TouchableOpacity>

                            {isPropQualExpanded && (
                              <View style={styles.propQualBody}>

                                {hasPaneJobType && (() => {
                                  const paneJobType = addrPaneEntry[0]?.jt;
                                  const paneJobTypeId = paneJobType?.id;
                                  const addedKeys = addedPaneTypeKeys[paneGroupKey] || [];
                                  const visibleTypes = activePaneTypes.filter(pt =>
                                    pt.key === 'standard' ||
                                    getExteriorCount(pt.key) > 0 ||
                                    addedKeys.includes(pt.key)
                                  );
                                  const hiddenTypes = activePaneTypes.filter(pt =>
                                    pt.key !== 'standard' &&
                                    getExteriorCount(pt.key) === 0 &&
                                    !addedKeys.includes(pt.key)
                                  );
                                  return (
                                    <>
                                      {visibleTypes.map((pt, ptIdx) => {
                                        const paneTypePrice = paneJobTypeId
                                          ? clientPaneTypePrices.find(p =>
                                              p.job_type_id === paneJobTypeId &&
                                              p.pane_type_key === pt.key &&
                                              (addr.id ? p.address_id === addr.id : !p.address_id)
                                            ) ?? clientPaneTypePrices.find(p =>
                                              p.job_type_id === paneJobTypeId &&
                                              p.pane_type_key === pt.key &&
                                              !p.address_id
                                            )
                                          : undefined;
                                        const defaultPriceKey = `price_per_pane_${pt.key}` as keyof typeof paneJobType;
                                        const defaultPricePerPane = paneJobType ? ((paneJobType as any)[defaultPriceKey] as number | null ?? null) : null;
                                        const extSplitKey = `exterior_split_percent_${pt.key}` as keyof typeof paneJobType;
                                        const exteriorSplitPercent = paneJobType ? ((paneJobType as any)[extSplitKey] as number | null ?? null) : null;
                                        const onPanePriceChange = (key: string, update: Partial<ClientPaneTypePrice>) => {
                                          if (!paneJobTypeId) return;
                                          setClientPaneTypePrices(prev => {
                                            const addrId = addr.id || null;
                                            const idx2 = prev.findIndex(p =>
                                              p.job_type_id === paneJobTypeId &&
                                              p.pane_type_key === key &&
                                              p.address_id === addrId
                                            );
                                            if (idx2 >= 0) {
                                              const next = [...prev];
                                              next[idx2] = { ...next[idx2], ...update };
                                              return next;
                                            }
                                            return [...prev, {
                                              job_type_id: paneJobTypeId,
                                              pane_type_key: key,
                                              price_mode: 'per_pane',
                                              price_per_pane: null,
                                              flat_rate_amount: null,
                                              address_id: addrId,
                                              ...update,
                                            }];
                                          });
                                        };
                                        return (
                                          <PaneTallyRow
                                            key={pt.key}
                                            pt={pt}
                                            ptIdx={ptIdx}
                                            exteriorCount={getExteriorCount(pt.key)}
                                            loading={loading}
                                            index={index}
                                            unitTallyInputs={unitTallyInputs}
                                            setUnitTallyInputs={setUnitTallyInputs}
                                            paneDirectInput={paneDirectInputs[`${pt.key}_${index}`]}
                                            setPaneDirectInput={(key, val) => setPaneDirectInputs(prev => ({ ...prev, [key]: val }))}
                                            paneTallyInput={paneTallyInputs[`${pt.key}_${index}`] ?? ''}
                                            setPaneTallyInput={(key, val) => setPaneTallyInputs(prev => ({ ...prev, [key]: val }))}
                                            setExteriorCount={setExteriorCount}
                                            styles={styles}
                                            paneTypePrice={paneTypePrice}
                                            defaultPricePerPane={defaultPricePerPane}
                                            exteriorSplitPercent={exteriorSplitPercent}
                                            onPanePriceChange={onPanePriceChange}
                                            colors={colors}
                                          />
                                        );
                                      })}
                                      {hiddenTypes.length > 0 && (
                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4, marginBottom: 2 }}>
                                          {hiddenTypes.map(pt => (
                                            <TouchableOpacity
                                              key={pt.key}
                                              onPress={() => setAddedPaneTypeKeys(prev => ({
                                                ...prev,
                                                [paneGroupKey]: [...(prev[paneGroupKey] || []), pt.key],
                                              }))}
                                              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(27,77,110,0.25)', backgroundColor: 'rgba(27,77,110,0.05)' }}
                                            >
                                              <Plus size={11} color="#1B4D6E" />
                                              <Text style={{ fontSize: 11, color: '#1B4D6E', fontWeight: '600' }}>{pt.name}</Text>
                                            </TouchableOpacity>
                                          ))}
                                        </View>
                                      )}
                                    </>
                                  );
                                })()}

                                {hasPaneJobType && dynamicPaneTotal > 0 && (
                                  <View style={styles.propQualPaneTotalRow}>
                                    <Text style={styles.propQualPaneTotalLabel}>Total panes</Text>
                                    <Text style={styles.propQualPaneTotalValue}>{dynamicPaneTotal}</Text>
                                  </View>
                                )}

                                {(() => {
                                  const orderedRows: typeof unitRows = [];
                                  groupedUnitRows.forEach(g => { orderedRows.push(...g.rows); });
                                  return orderedRows;
                                })().map((row, gIdx, orderedArr) => {
                                  const prevCatId = gIdx > 0 ? orderedArr[gIdx - 1].category_id : null;
                                  const showCatHeader = gIdx === 0 || row.category_id !== prevCatId;
                                  const rowCat = row.category_id ? categories.find(c => c.id === row.category_id) : null;
                                  const addrRowKey = `${row.id}_${index}`;
                                  const entry = unitQuantities.find(q =>
                                    q.job_type_id === row.id &&
                                    (addr.id ? q.address_id === addr.id : !q.address_id)
                                  ) || unitQuantities.find(q => q.job_type_id === row.id && !q.address_id);
                                  const currentQty = Number(entry?.quantity) || 0;
                                  const hasInlineAdd = row.unit === 'linear_ft' || row.unit === 'sqft';

                                  const setQty = (val: number) => {
                                    const qty = Math.max(0, val);
                                    setUnitQuantities(prev => {
                                      let next = [...prev];
                                      const idx2 = next.findIndex(q =>
                                        q.job_type_id === row.id &&
                                        (addr.id ? q.address_id === addr.id : !q.address_id)
                                      );
                                      const newEntry: UnitQuantityEntry = {
                                        job_type_id: row.id,
                                        quantity: String(qty),
                                        address_id: addr.id || null,
                                      };
                                      if (idx2 >= 0) next[idx2] = newEntry;
                                      else next = [...next, newEntry];
                                      return next;
                                    });
                                  };

                                  return (
                                    <View key={addrRowKey}>
                                    {showCatHeader && rowCat && (
                                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, marginTop: gIdx === 0 ? 6 : 12, marginBottom: 6, alignSelf: 'flex-start', borderRadius: 14, backgroundColor: rowCat.color + '22', borderWidth: 1, borderColor: rowCat.color + '66' }}>
                                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: rowCat.color }} />
                                        <Text style={{ fontSize: 11, fontWeight: '700', color: rowCat.color, letterSpacing: 0.4 }}>
                                          {rowCat.name.toUpperCase()}
                                        </Text>
                                      </View>
                                    )}
                                    {showCatHeader && !rowCat && gIdx > 0 && (
                                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, marginTop: 12, marginBottom: 6, alignSelf: 'flex-start', borderRadius: 14, backgroundColor: colors.border + '44', borderWidth: 1, borderColor: colors.border }}>
                                        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary, letterSpacing: 0.4 }}>OTHER</Text>
                                      </View>
                                    )}
                                    <View
                                      style={[
                                        styles.propQualRow,
                                        (hasPaneJobType || gIdx > 0) && !showCatHeader && styles.propQualRowDivider,
                                        currentQty > 0 && styles.propQualRowFilled,
                                        hasInlineAdd && styles.propQualRowWrap,
                                      ]}
                                    >
                                      <View style={[styles.propQualRowTop]}>
                                        <View style={styles.propQualRowLeft}>
                                          <Text style={styles.propQualRowTitle}>{row.name}</Text>
                                          <Text style={styles.propQualRowUnit}>{row.unitLabel}</Text>
                                        </View>
                                        <View style={styles.tallyStackedControls}>
                                          <View style={styles.tallyStepperRow}>
                                            <TouchableOpacity
                                              style={[styles.propQualStepBtn, styles.propQualStepBtnMinus, currentQty <= 0 && styles.propQualStepBtnDisabled]}
                                              onPress={() => {
                                                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                setQty(currentQty - 1);
                                              }}
                                              disabled={loading || currentQty <= 0}
                                              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                                            >
                                              <Minus size={16} color={currentQty <= 0 ? '#d1d5db' : '#ef4444'} />
                                            </TouchableOpacity>
                                            <TextInput
                                              style={styles.propQualNumInput}
                                              value={unitTallyInputs[addrRowKey] !== undefined ? unitTallyInputs[addrRowKey] : String(currentQty)}
                                              onChangeText={v => setUnitTallyInputs(prev => ({ ...prev, [addrRowKey]: v }))}
                                              onBlur={() => {
                                                const raw = unitTallyInputs[addrRowKey];
                                                if (raw !== undefined) {
                                                  const val = Number(raw);
                                                  setQty(isNaN(val) ? currentQty : val);
                                                  setUnitTallyInputs(prev => { const next = { ...prev }; delete next[addrRowKey]; return next; });
                                                }
                                              }}
                                              keyboardType="decimal-pad"
                                              editable={!loading}
                                              selectTextOnFocus
                                            />
                                            <TouchableOpacity
                                              style={[styles.propQualStepBtn, styles.propQualStepBtnPlus]}
                                              onPress={() => {
                                                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                setQty(currentQty + 1);
                                              }}
                                              disabled={loading}
                                              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                                            >
                                              <Plus size={16} color="#10b981" />
                                            </TouchableOpacity>
                                          </View>
                                          <View style={styles.tallyQuickAddRow}>
                                            <TextInput
                                              style={styles.tallyAddInput}
                                              value={unitTallyInputs[`add_${addrRowKey}`] || ''}
                                              onChangeText={v => setUnitTallyInputs(prev => ({ ...prev, [`add_${addrRowKey}`]: v }))}
                                              keyboardType="decimal-pad"
                                              editable={!loading}
                                              placeholder="Amt"
                                              placeholderTextColor="#b0b8c4"
                                            />
                                            <TouchableOpacity
                                              style={[styles.tallyAddBtn, { overflow: 'hidden', opacity: (loading || !unitTallyInputs[`add_${addrRowKey}`] || Number(unitTallyInputs[`add_${addrRowKey}`]) === 0) ? 0.5 : 1 }]}
                                              onPress={() => {
                                                if (loading) return;
                                                const raw = unitTallyInputs[`add_${addrRowKey}`];
                                                if (!raw) return;
                                                const addVal = Number(raw);
                                                if (!addVal || isNaN(addVal)) return;
                                                if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                                setQty(currentQty + addVal);
                                                setUnitTallyInputs(prev => ({ ...prev, [`add_${addrRowKey}`]: '' }));
                                              }}
                                            >
                                              <LinearGradient
                                                colors={['#1B4D6E', '#245d82']}
                                                start={{ x: 0, y: 0 }}
                                                end={{ x: 1, y: 1 }}
                                                style={styles.gradientTallyAdd}
                                              >
                                                <Plus size={13} color="#fff" />
                                                <Text style={styles.tallyAddBtnText}>Add</Text>
                                              </LinearGradient>
                                            </TouchableOpacity>
                                          </View>
                                        </View>
                                      </View>
                                      {(() => {
                                        const priceOverrideEnabled = entry?.price_override_enabled ?? false;
                                        const priceOverrideVal = entry?.price_override ?? null;
                                        const priceInputKey = `price_${addrRowKey}`;
                                        return (
                                          <View style={styles.serviceTypePriceRow}>
                                            <TouchableOpacity
                                              style={styles.serviceTypePriceToggle}
                                              onPress={() => {
                                                setUnitQuantities(prev => {
                                                  let next = [...prev];
                                                  const idx2 = next.findIndex(q =>
                                                    q.job_type_id === row.id &&
                                                    (addr.id ? q.address_id === addr.id : !q.address_id)
                                                  );
                                                  const toggled = !priceOverrideEnabled;
                                                  if (idx2 >= 0) {
                                                    next[idx2] = { ...next[idx2], price_override_enabled: toggled };
                                                  } else {
                                                    next = [...next, {
                                                      job_type_id: row.id,
                                                      quantity: String(currentQty),
                                                      address_id: addr.id || null,
                                                      price_override_enabled: toggled,
                                                      price_override: null,
                                                    }];
                                                  }
                                                  return next;
                                                });
                                              }}
                                              disabled={loading}
                                            >
                                              {priceOverrideEnabled
                                                ? <ToggleRight size={18} color="#1B4D6E" />
                                                : <ToggleLeft size={18} color="#9CA3AF" />}
                                              <Text style={[styles.serviceTypePriceLabel, priceOverrideEnabled && styles.serviceTypePriceLabelActive]}>
                                                {priceOverrideEnabled ? 'Price override' : 'Set price override'}
                                              </Text>
                                            </TouchableOpacity>
                                            {priceOverrideEnabled && (
                                              <View style={styles.serviceTypePriceInput}>
                                                <Text style={styles.priceOverrideCurrency}>$</Text>
                                                <TextInput
                                                  style={styles.serviceTypePriceField}
                                                  value={unitTallyInputs[priceInputKey] !== undefined
                                                    ? unitTallyInputs[priceInputKey]
                                                    : (priceOverrideVal != null ? String(priceOverrideVal) : '')}
                                                  onChangeText={v => {
                                                    const cleaned = v.replace(/[^0-9.]/g, '');
                                                    setUnitTallyInputs(prev => ({ ...prev, [priceInputKey]: cleaned }));
                                                  }}
                                                  onBlur={() => {
                                                    const raw = unitTallyInputs[priceInputKey];
                                                    if (raw !== undefined) {
                                                      const parsed = raw === '' ? null : parseFloat(raw) || null;
                                                      setUnitQuantities(prev => {
                                                        let next = [...prev];
                                                        const idx2 = next.findIndex(q =>
                                                          q.job_type_id === row.id &&
                                                          (addr.id ? q.address_id === addr.id : !q.address_id)
                                                        );
                                                        if (idx2 >= 0) {
                                                          next[idx2] = { ...next[idx2], price_override: parsed };
                                                        }
                                                        return next;
                                                      });
                                                      setUnitTallyInputs(prev => { const n = { ...prev }; delete n[priceInputKey]; return n; });
                                                    }
                                                  }}
                                                  placeholder="0.00"
                                                  keyboardType="decimal-pad"
                                                  editable={!loading}
                                                  selectTextOnFocus
                                                />
                                              </View>
                                            )}
                                          </View>
                                        );
                                      })()}
                                    </View>
                                    </View>
                                  );
                                })}

                                {propertyQualities
                                  .filter(pq => addr.id ? pq.address_id === addr.id : !pq.address_id)
                                  .map((pq, pqIdx) => {
                                    const pqKey = pq.id || `new_${pqIdx}_${index}`;
                                    const hasInlineAdd = pq.unit_type === 'linear_ft' || pq.unit_type === 'sqft';
                                    const unitDisplayLabel = pq.unit_type === 'custom'
                                      ? (pq.custom_unit_label || 'units')
                                      : ({ linear_ft: 'linear ft', sqft: 'sq ft', pane: 'panes', item: 'items', custom: 'units' } as Record<string, string>)[pq.unit_type] || pq.unit_type;

                                    const updatePq = (fields: Partial<PropertyQuality>) => {
                                      setPropertyQualities(prev => prev.map(p =>
                                        (p.id ? p.id === pq.id : p === pq) ? { ...p, ...fields } : p
                                      ));
                                    };

                                    const setQtyPq = (val: number) => updatePq({ quantity: Math.max(0, val) });
                                    const setTallyPq = (val: number) => updatePq({ tally: Math.max(0, val) });

                                    return (
                                      <View
                                        key={pqKey}
                                        style={[
                                          styles.propQualRow,
                                          styles.propQualRowDivider,
                                          (pq.quantity > 0 || pq.tally > 0) && styles.propQualRowFilled,
                                          hasInlineAdd && styles.propQualRowWrap,
                                        ]}
                                      >
                                        <View style={styles.propQualRowTop}>
                                        <View style={styles.propQualRowLeft}>
                                          <View style={styles.pqLabelRow}>
                                            <Text style={styles.propQualRowTitle}>{pq.label}</Text>
                                            <TouchableOpacity
                                              style={styles.pqDeleteBtn}
                                              onPress={() => {
                                                if (pq.id) {
                                                  supabase.from('client_property_qualities').delete().eq('id', pq.id);
                                                }
                                                setPropertyQualities(prev => prev.filter(p => p !== pq && p.id !== pq.id));
                                              }}
                                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                            >
                                              <Trash2 size={13} color="#ef4444" />
                                            </TouchableOpacity>
                                          </View>
                                          <Text style={styles.propQualRowUnit}>{unitDisplayLabel}</Text>
                                        </View>
                                        <View style={styles.pqDualStepper}>
                                          <View style={styles.pqStepperCol}>
                                            <Text style={styles.pqStepperColLabel}>Total</Text>
                                            <View style={styles.propQualRowRight}>
                                              <TouchableOpacity
                                                style={[styles.propQualStepBtn, styles.propQualStepBtnMinus, pq.quantity <= 0 && styles.propQualStepBtnDisabled]}
                                                onPress={() => {
                                                  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                  setQtyPq(pq.quantity - 1);
                                                }}
                                                disabled={loading || pq.quantity <= 0}
                                                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                                              >
                                                <Minus size={14} color={pq.quantity <= 0 ? '#d1d5db' : '#ef4444'} />
                                              </TouchableOpacity>
                                              <TextInput
                                                style={styles.pqSmallNumInput}
                                                value={unitTallyInputs[`pqtot_${pqKey}`] !== undefined ? unitTallyInputs[`pqtot_${pqKey}`] : String(pq.quantity)}
                                                onChangeText={v => setUnitTallyInputs(prev => ({ ...prev, [`pqtot_${pqKey}`]: v }))}
                                                onBlur={() => {
                                                  const raw = unitTallyInputs[`pqtot_${pqKey}`];
                                                  if (raw !== undefined) {
                                                    const val = Number(raw);
                                                    setQtyPq(isNaN(val) ? pq.quantity : val);
                                                    setUnitTallyInputs(prev => { const n = { ...prev }; delete n[`pqtot_${pqKey}`]; return n; });
                                                  }
                                                }}
                                                keyboardType="decimal-pad"
                                                editable={!loading}
                                                selectTextOnFocus
                                              />
                                              <TouchableOpacity
                                                style={[styles.propQualStepBtn, styles.propQualStepBtnPlus]}
                                                onPress={() => {
                                                  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                  setQtyPq(pq.quantity + 1);
                                                }}
                                                disabled={loading}
                                                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                                              >
                                                <Plus size={14} color="#10b981" />
                                              </TouchableOpacity>
                                            </View>
                                          </View>
                                          <View style={styles.pqStepperCol}>
                                            <Text style={styles.pqStepperColLabel}>Tally</Text>
                                            <View style={styles.propQualRowRight}>
                                              <TouchableOpacity
                                                style={[styles.propQualStepBtn, styles.propQualStepBtnMinus, pq.tally <= 0 && styles.propQualStepBtnDisabled]}
                                                onPress={() => {
                                                  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                  setTallyPq(pq.tally - 1);
                                                }}
                                                disabled={loading || pq.tally <= 0}
                                                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                                              >
                                                <Minus size={14} color={pq.tally <= 0 ? '#d1d5db' : '#ef4444'} />
                                              </TouchableOpacity>
                                              <TextInput
                                                style={styles.pqSmallNumInput}
                                                value={unitTallyInputs[`pqtal_${pqKey}`] !== undefined ? unitTallyInputs[`pqtal_${pqKey}`] : String(pq.tally)}
                                                onChangeText={v => setUnitTallyInputs(prev => ({ ...prev, [`pqtal_${pqKey}`]: v }))}
                                                onBlur={() => {
                                                  const raw = unitTallyInputs[`pqtal_${pqKey}`];
                                                  if (raw !== undefined) {
                                                    const val = Number(raw);
                                                    setTallyPq(isNaN(val) ? pq.tally : val);
                                                    setUnitTallyInputs(prev => { const n = { ...prev }; delete n[`pqtal_${pqKey}`]; return n; });
                                                  }
                                                }}
                                                keyboardType="decimal-pad"
                                                editable={!loading}
                                                selectTextOnFocus
                                              />
                                              <TouchableOpacity
                                                style={[styles.propQualStepBtn, styles.propQualStepBtnPlus]}
                                                onPress={() => {
                                                  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                  setTallyPq(pq.tally + 1);
                                                }}
                                                disabled={loading}
                                                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                                              >
                                                <Plus size={14} color="#10b981" />
                                              </TouchableOpacity>
                                            </View>
                                          </View>
                                        </View>
                                        </View>
                                        {hasInlineAdd && (
                                          <View style={styles.propQualInlineAddRow}>
                                            <TextInput
                                              style={styles.propQualInlineAddInput}
                                              value={unitTallyInputs[`pqadd_${pqKey}`] || ''}
                                              onChangeText={v => setUnitTallyInputs(prev => ({ ...prev, [`pqadd_${pqKey}`]: v }))}
                                              keyboardType="decimal-pad"
                                              editable={!loading}
                                              placeholder={`Add ${unitDisplayLabel}…`}
                                              placeholderTextColor="#b0b8c4"
                                            />
                                            <TouchableOpacity
                                              style={[
                                                styles.propQualInlineAddBtn,
                                                (!unitTallyInputs[`pqadd_${pqKey}`] || Number(unitTallyInputs[`pqadd_${pqKey}`]) === 0) && styles.propQualInlineAddBtnDisabled,
                                              ]}
                                              onPress={() => {
                                                if (loading) return;
                                                const raw = unitTallyInputs[`pqadd_${pqKey}`];
                                                if (!raw) return;
                                                const addVal = Number(raw);
                                                if (!addVal || isNaN(addVal)) return;
                                                if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                                setQtyPq(pq.quantity + addVal);
                                                setUnitTallyInputs(prev => ({ ...prev, [`pqadd_${pqKey}`]: '' }));
                                              }}
                                              disabled={loading || !unitTallyInputs[`pqadd_${pqKey}`] || Number(unitTallyInputs[`pqadd_${pqKey}`]) === 0}
                                            >
                                              <LinearGradient
                                                colors={['#1B4D6E', '#245d82']}
                                                start={{ x: 0, y: 0 }}
                                                end={{ x: 1, y: 1 }}
                                                style={styles.propQualInlineAddBtnGradient}
                                              >
                                                <Plus size={11} color="#fff" />
                                                <Text style={styles.propQualInlineAddBtnText}>Add</Text>
                                              </LinearGradient>
                                            </TouchableOpacity>
                                          </View>
                                        )}
                                      </View>
                                    );
                                  })
                                }

                                <TouchableOpacity
                                  style={styles.propQualAddCategoryBtn}
                                  onPress={() => setShowAddQualityModal(true)}
                                  activeOpacity={0.8}
                                  disabled={loading}
                                >
                                  <Plus size={14} color="#1B4D6E" />
                                  <Text style={styles.propQualAddCategoryBtnText}>Add New Category</Text>
                                </TouchableOpacity>

                                <View style={styles.propQualSyncNote}>
                                  <Text style={styles.propQualSyncNoteText}>
                                    Synced with estimates, invoices &amp; scheduled jobs
                                  </Text>
                                </View>
                              </View>
                            )}
                          </View>
                        );
                      })()}
                    </View>
                  );
                })}

                <TouchableOpacity
                  style={styles.addAddressInlineButton}
                  onPress={handleAddAddress}
                  disabled={loading}
                >
                  <Plus size={16} color="#1B4D6E" />
                  <Text style={styles.addAddressButtonText}>Add Address</Text>
                </TouchableOpacity>
              </View>

              <CollapsibleField
                label="Custom Job Duration"
                fieldId="customJobDuration"
                activeFieldId={activeFieldId}
                onToggle={toggleField}
                displayValue={parseInt(typicalJobDuration) && parseInt(typicalJobDuration) !== 60 ? `${Math.floor(parseInt(typicalJobDuration) / 60)}h ${parseInt(typicalJobDuration) % 60}m` : undefined}
              >
                <Text style={[styles.addressHint, { marginBottom: 8 }]}>Sets a fixed duration when no production rate data is available. Per-address overrides take priority.</Text>
                <DurationDrumPicker
                  value={parseInt(typicalJobDuration) || null}
                  onChange={(mins) => setTypicalJobDuration(mins === null ? '60' : String(mins))}
                />
              </CollapsibleField>

              <CollapsibleField
                label="Account Balance"
                fieldId="accountBalance"
                activeFieldId={activeFieldId}
                onToggle={toggleField}
                displayValue={parseFloat(accountBalance) ? `$${parseFloat(accountBalance).toFixed(2)}` : undefined}
              >
                <TextInput
                  style={styles.input}
                  value={accountBalance}
                  onChangeText={setAccountBalance}
                  placeholder="0.00"
                  keyboardType="numeric"
                  editable={!loading}
                />
                <Text style={styles.addressHint}>Track prepaid credits or account balance</Text>
              </CollapsibleField>

              <CollapsibleField
                label="Price Rounding"
                fieldId="disableRounding"
                activeFieldId={activeFieldId}
                onToggle={toggleField}
                displayValue={disableRounding ? 'Disabled' : undefined}
              >
                <Text style={[styles.addressHint, { marginBottom: 10 }]}>
                  When disabled, this client's invoices and estimates will always show exact totals, ignoring the organization's rounding setting.
                </Text>
                <View style={styles.priceOverrideRow}>
                  <TouchableOpacity
                    style={styles.priceOverrideToggle}
                    onPress={() => setDisableRounding(v => !v)}
                    disabled={loading}
                  >
                    {disableRounding
                      ? <ToggleRight size={28} color="#1B4D6E" />
                      : <ToggleLeft size={28} color="#9CA3AF" />}
                    <Text style={[
                      styles.priceOverrideToggleLabel,
                      disableRounding && styles.priceOverrideToggleLabelActive,
                    ]}>
                      {disableRounding ? 'Rounding disabled for this client' : 'Use organization rounding setting'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </CollapsibleField>

              <CollapsibleField
                label="Client Type"
                fieldId="clientType"
                activeFieldId={activeFieldId}
                onToggle={toggleField}
                displayValue={clientType ? clientType.charAt(0).toUpperCase() + clientType.slice(1) : undefined}
              >
                <View style={styles.categoryChipsRow}>
                  {(['residential', 'commercial', 'contractor'] as const).map(type => {
                    const isSelected = clientType === type;
                    const chipLabel = type.charAt(0).toUpperCase() + type.slice(1);
                    return (
                      <TouchableOpacity
                        key={type}
                        style={[styles.categoryChip, isSelected ? { backgroundColor: '#1B4D6E', borderColor: '#1B4D6E' } : { backgroundColor: '#1B4D6E15', borderColor: '#1B4D6E40' }]}
                        onPress={() => setClientType(isSelected ? null : type)}
                        disabled={loading}
                      >
                        {isSelected && <Check size={12} color="#fff" />}
                        <Text style={[styles.categoryChipText, { color: isSelected ? '#fff' : '#1B4D6E' }]}>{chipLabel}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {clientType === 'commercial' && (
                  <View style={[styles.inputGroup, { marginTop: 12 }]}>
                    <View style={styles.labelWithIcon}>
                      <Clock size={14} color="#1B4D6E" />
                      <Text style={styles.label}>Default Service Window (all addresses)</Text>
                    </View>
                    <Text style={styles.addressHint}>
                      Set operating hours that apply to all addresses for this client. Individual addresses can override.
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11, color: '#6B7280', marginBottom: 3 }}>Opens</Text>
                        <TouchableOpacity
                          style={[styles.input, { justifyContent: 'center', paddingVertical: 12 }]}
                          onPress={() => { if (!loading) setActiveTimePicker({ type: 'clientStart' }); }}
                          disabled={loading}
                        >
                          <Text style={{ fontSize: 14, color: commercialWindowStart ? colors.text : colors.textSecondary }}>
                            {commercialWindowStart ? formatTime12(commercialWindowStart) : 'Select time'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      <Text style={{ color: '#6B7280', marginTop: 14 }}>to</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11, color: '#6B7280', marginBottom: 3 }}>Closes</Text>
                        <TouchableOpacity
                          style={[styles.input, { justifyContent: 'center', paddingVertical: 12 }]}
                          onPress={() => { if (!loading) setActiveTimePicker({ type: 'clientEnd' }); }}
                          disabled={loading}
                        >
                          <Text style={{ fontSize: 14, color: commercialWindowEnd ? colors.text : colors.textSecondary }}>
                            {commercialWindowEnd ? formatTime12(commercialWindowEnd) : 'Select time'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                )}
              </CollapsibleField>

              {categories.length > 0 && (
                <CollapsibleField
                  label="Service Categories"
                  fieldId="serviceCategories"
                  activeFieldId={activeFieldId}
                  onToggle={toggleField}
                  displayValue={selectedCategoryIds.length > 0 ? categories.filter(c => selectedCategoryIds.includes(c.id)).map(c => c.name).join(', ') : undefined}
                >
                  <View style={styles.categoryChipsRow}>
                    {categories.map(cat => {
                      const selected = selectedCategoryIds.includes(cat.id);
                      return (
                        <TouchableOpacity
                          key={cat.id}
                          style={[
                            styles.categoryChip,
                            selected
                              ? { backgroundColor: cat.color, borderColor: cat.color }
                              : { backgroundColor: cat.color + '15', borderColor: cat.color + '40' },
                          ]}
                          onPress={() => toggleCategory(cat.id)}
                          disabled={loading}
                        >
                          {selected && <Check size={12} color="#fff" />}
                          <Text style={[
                            styles.categoryChipText,
                            { color: selected ? '#fff' : cat.color },
                          ]}>{cat.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </CollapsibleField>
              )}

              <CollapsibleField
                label="Notes"
                fieldId="notes"
                activeFieldId={activeFieldId}
                onToggle={toggleField}
                displayValue={notes ? (notes.length > 40 ? notes.substring(0, 40) + '...' : notes) : undefined}
              >
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Additional notes..."
                  multiline
                  numberOfLines={4}
                  editable={!loading}
                />
              </CollapsibleField>

              {(() => {
                const suggestedEquipment = equipmentInventory.filter(
                  e => e.category_id && selectedCategoryIds.includes(e.category_id)
                );
                const otherEquipment = equipmentInventory.filter(
                  e => !e.category_id || !selectedCategoryIds.includes(e.category_id)
                );
                const totalSelected = selectedEquipmentIds.size;
                return (
                  <CollapsibleField
                    label="Equipment Needed"
                    fieldId="equipment"
                    activeFieldId={activeFieldId}
                    onToggle={toggleField}
                    displayValue={totalSelected > 0 ? `${totalSelected} item${totalSelected !== 1 ? 's' : ''}` : undefined}
                  >
                    <View style={{ gap: 8 }}>
                      <TouchableOpacity
                        onPress={() => { setEditingEquipmentId(null); setShowEquipmentEditModal(true); }}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: colors.primary + '12', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: colors.primary + '30', marginBottom: 2 }}
                      >
                        <Plus size={13} color={colors.primary} />
                        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>New Equipment Type</Text>
                      </TouchableOpacity>
                      {equipmentInventory.length > 0 && (
                      <React.Fragment>
                      <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 18 }}>
                        {"Tap equipment to add it to this client's profile. Items from job type tags are suggested first."}
                      </Text>
                      {suggestedEquipment.length > 0 && (
                        <View>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                            {"From Job Type Tags"}
                          </Text>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                            {suggestedEquipment.map(item => {
                              const isSelected = selectedEquipmentIds.has(item.id);
                              return (
                                <TouchableOpacity
                                  key={item.id}
                                  onPress={() => {
                                    setSelectedEquipmentIds(prev => {
                                      const next = new Set(prev);
                                      if (next.has(item.id)) next.delete(item.id);
                                      else next.add(item.id);
                                      return next;
                                    });
                                  }}
                                  onLongPress={() => {
                                    setEditingEquipmentId(item.id);
                                    setShowEquipmentEditModal(true);
                                  }}
                                  style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 6,
                                    backgroundColor: isSelected ? colors.primary : colors.primary + '10',
                                    borderRadius: 8,
                                    paddingHorizontal: 10,
                                    paddingVertical: 6,
                                    borderWidth: 1,
                                    borderColor: isSelected ? colors.primary : colors.primary + '30',
                                  }}
                                >
                                  <Wrench size={13} color={isSelected ? '#fff' : colors.primary} />
                                  <Text style={{ fontSize: 13, color: isSelected ? '#fff' : colors.primary, fontWeight: '600' }}>{item.name}</Text>
                                  {isSelected && <Check size={13} color="#fff" />}
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </View>
                      )}
                      {otherEquipment.length > 0 && (
                        <View>
                          <TouchableOpacity
                            style={[styles.input, { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 }]}
                            onPress={() => setShowEquipmentPicker(!showEquipmentPicker)}
                            disabled={loading}
                          >
                            <Package size={18} color={colors.textSecondary} />
                            <Text style={{ flex: 1, fontSize: 14, color: colors.textSecondary }}>
                              {showEquipmentPicker ? 'Tap items below' : 'Add other equipment...'}
                            </Text>
                            <ChevronDown size={18} color={colors.textSecondary} style={{ transform: [{ rotate: showEquipmentPicker ? '180deg' : '0deg' }] }} />
                          </TouchableOpacity>
                          {showEquipmentPicker && (
                            <View style={{ backgroundColor: colors.inputBackground, borderRadius: 10, borderWidth: 1, borderColor: colors.border, maxHeight: 200, overflow: 'hidden', marginTop: 4 }}>
                              <ScrollView nestedScrollEnabled>
                                {otherEquipment.map(item => {
                                  const isSelected = selectedEquipmentIds.has(item.id);
                                  return (
                                    <TouchableOpacity
                                      key={item.id}
                                      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.border }}
                                      onPress={() => {
                                        setSelectedEquipmentIds(prev => {
                                          const next = new Set(prev);
                                          if (next.has(item.id)) next.delete(item.id);
                                          else next.add(item.id);
                                          return next;
                                        });
                                      }}
                                      onLongPress={() => {
                                        setEditingEquipmentId(item.id);
                                        setShowEquipmentEditModal(true);
                                      }}
                                    >
                                      {isSelected ? (
                                        <CheckSquare size={18} color={colors.primary} />
                                      ) : (
                                        <Square size={18} color={colors.textSecondary} />
                                      )}
                                      <Text style={{ flex: 1, fontSize: 14, color: colors.text, fontWeight: isSelected ? '600' : '400' }}>{item.name}</Text>
                                      <TouchableOpacity
                                        onPress={() => {
                                          setEditingEquipmentId(item.id);
                                          setShowEquipmentEditModal(true);
                                        }}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                      >
                                        <Wrench size={14} color={colors.textSecondary} />
                                      </TouchableOpacity>
                                    </TouchableOpacity>
                                  );
                                })}
                              </ScrollView>
                            </View>
                          )}
                        </View>
                      )}
                      </React.Fragment>
                      )}
                    </View>
                  </CollapsibleField>
                );
              })()}

              {client && orgGoogleReviewUrl ? (
                <TouchableOpacity
                  onPress={() => Linking.openURL(orgGoogleReviewUrl)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fef9c3', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#fde047' }}
                >
                  <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#facc15', alignItems: 'center', justifyContent: 'center' }}>
                    <Star size={20} color="#92400e" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#78350f' }}>Happy with your last service?</Text>
                    <Text style={{ fontSize: 13, color: '#92400e', marginTop: 2 }}>Let others know — leave us a Google review!</Text>
                  </View>
                  <Globe size={18} color="#92400e" />
                </TouchableOpacity>
              ) : null}

              {client && currentOrganization?.id && (
                <ClientServiceHistory
                  clientId={client.id}
                  organizationId={currentOrganization.id}
                />
              )}

              {client && (
                <View style={styles.photosSection}>
                  <View style={styles.photosSectionHeader}>
                    <Text style={styles.label}>Photos</Text>
                    <View style={styles.photoActions}>
                      <TouchableOpacity
                        style={styles.addPhotoButton}
                        onPress={() => setShowGallery(true)}
                      >
                        <ExternalLink size={18} color="#1B4D6E" />
                        <Text style={styles.addPhotoButtonText}>View & Send</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.pickImageButton}
                        onPress={pickImage}
                        disabled={photosLoading}
                      >
                        <Images size={18} color="#1B4D6E" />
                        <Text style={styles.addPhotoButtonText}>Camera Roll</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.addPhotoButton}
                        onPress={() => setShowAddPhoto(!showAddPhoto)}
                      >
                        <Plus size={18} color="#1B4D6E" />
                        <Text style={styles.addPhotoButtonText}>URL</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {showAddPhoto && (
                    <View style={styles.addPhotoForm}>
                      <TextInput
                        style={styles.input}
                        value={newPhotoUrl}
                        onChangeText={setNewPhotoUrl}
                        placeholder="Image URL"
                        autoCapitalize="none"
                      />
                      <TextInput
                        style={[styles.input, { marginTop: 8 }]}
                        value={newPhotoCaption}
                        onChangeText={setNewPhotoCaption}
                        placeholder="Caption (optional)"
                      />
                      <TouchableOpacity
                        style={styles.submitPhotoButton}
                        onPress={handleAddPhoto}
                        disabled={!newPhotoUrl.trim() || photosLoading}
                      >
                        <LinearGradient
                          colors={['#1B4D6E', '#245d82']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.submitPhotoButtonGradient}
                        >
                          <Text style={styles.submitPhotoButtonText}>Add</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  )}

                  {photosLoading ? (
                    <ActivityIndicator style={{ marginTop: 16 }} />
                  ) : photos.length === 0 ? (
                    <View style={styles.noPhotos}>
                      <ImageIcon size={32} color="#ccc" />
                      <Text style={styles.noPhotosText}>No photos yet</Text>
                    </View>
                  ) : (
                    <View style={styles.photosGrid}>
                      {photos.map((photo) => (
                        <View key={photo.id} style={styles.photoItem}>
                          <Image
                            source={{ uri: photo.photo_url }}
                            style={styles.photoImage}
                            resizeMode="cover"
                          />
                          <TouchableOpacity
                            style={styles.deletePhotoButton}
                            onPress={() => handleDeletePhoto(photo.id)}
                          >
                            <Trash2 size={14} color="#fff" />
                          </TouchableOpacity>
                          {photo.caption ? (
                            <Text style={styles.photoCaption} numberOfLines={1}>
                              {photo.caption}
                            </Text>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}
              </>
              )}
            </ScrollView>

            {client && (onScheduleJob || onStartTimer || onCreateInvoice || onCreateEstimate || onDuplicateLastInvoice) && (
              <View style={styles.fabContainer}>
                {/* Backdrop */}
                {clientFabOpen && (
                  <TouchableOpacity
                    style={styles.fabBackdrop}
                    activeOpacity={1}
                    onPress={() => setClientFabOpen(false)}
                  />
                )}

                {/* Expanded panel */}
                {clientFabOpen && (
                  <View style={[styles.fabPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    {/* Actions group */}
                    <Text style={[styles.fabGroupLabel, { color: colors.textSecondary }]}>ACTIONS</Text>
                    <View style={styles.fabGrid}>
                      {onStartTimer && (
                        <TouchableOpacity
                          style={[styles.fabGridBtn, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '30' }]}
                          onPress={() => { setClientFabOpen(false); onStartTimer(client.id, name); }}
                          activeOpacity={0.75}
                        >
                          <Play size={17} color={colors.primary} />
                          <Text style={[styles.fabGridBtnText, { color: colors.primary }]}>Start Timer</Text>
                        </TouchableOpacity>
                      )}
                      {onScheduleJob && (
                        <TouchableOpacity
                          style={[styles.fabGridBtn, { backgroundColor: '#2D8B5712', borderColor: '#2D8B5730' }]}
                          onPress={() => {
                            setClientFabOpen(false);
                            const primaryAddress = addresses.find(a => a.is_primary) || addresses[0];
                            onScheduleJob({
                              clientId: client.id,
                              clientName: name,
                              address: primaryAddress?.address || (primaryAddress ? [primaryAddress.street, primaryAddress.city, primaryAddress.state].filter(Boolean).join(', ') : undefined),
                              latitude: primaryAddress?.latitude ?? undefined,
                              longitude: primaryAddress?.longitude ?? undefined,
                              phone: phone || undefined,
                              email: email || undefined,
                              typicalJobDuration: primaryAddress?.typical_job_duration ?? (client.typical_job_duration || undefined),
                              priceOverride: primaryAddress?.price_override ?? undefined,
                              priceOverrideEnabled: primaryAddress?.price_override_enabled ?? false,
                              accessCode: primaryAddress?.access_code ?? undefined,
                              accessCodeType: primaryAddress?.access_code_type ?? undefined,
                              addressId: primaryAddress?.id,
                            });
                          }}
                          activeOpacity={0.75}
                        >
                          <CalendarPlus size={17} color="#2D8B57" />
                          <Text style={[styles.fabGridBtnText, { color: '#2D8B57' }]}>Schedule</Text>
                        </TouchableOpacity>
                      )}
                      {onCreateInvoice && (
                        <TouchableOpacity
                          style={[styles.fabGridBtn, { backgroundColor: '#b4530912', borderColor: '#b4530930' }]}
                          onPress={() => { setClientFabOpen(false); onCreateInvoice(client.id, name); }}
                          activeOpacity={0.75}
                        >
                          <Receipt size={17} color="#b45309" />
                          <Text style={[styles.fabGridBtnText, { color: '#b45309' }]}>Invoice</Text>
                        </TouchableOpacity>
                      )}
                      {onDuplicateLastInvoice && (
                        <TouchableOpacity
                          style={[styles.fabGridBtn, { backgroundColor: '#47556912', borderColor: '#47556930' }]}
                          onPress={() => { setClientFabOpen(false); onDuplicateLastInvoice(client.id); }}
                          activeOpacity={0.75}
                        >
                          <Copy size={17} color="#475569" />
                          <Text style={[styles.fabGridBtnText, { color: '#475569' }]}>Dup Invoice</Text>
                        </TouchableOpacity>
                      )}
                      {onCreateEstimate && (
                        <TouchableOpacity
                          style={[styles.fabGridBtn, { backgroundColor: '#0369a112', borderColor: '#0369a130' }]}
                          onPress={() => { setClientFabOpen(false); onCreateEstimate(client.id, name); }}
                          activeOpacity={0.75}
                        >
                          <FileText size={17} color="#0369a1" />
                          <Text style={[styles.fabGridBtnText, { color: '#0369a1' }]}>Estimate</Text>
                        </TouchableOpacity>
                      )}
                      {onSendStatement && (
                        <TouchableOpacity
                          style={[styles.fabGridBtn, { backgroundColor: '#1B4D6E12', borderColor: '#1B4D6E30' }]}
                          onPress={() => { setClientFabOpen(false); onSendStatement(client.id, name, email, phone); }}
                          activeOpacity={0.75}
                        >
                          <Send size={17} color="#1B4D6E" />
                          <Text style={[styles.fabGridBtnText, { color: '#1B4D6E' }]}>Statement</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Messages group — always show if phone exists */}
                    {phone && (
                      <>
                        <View style={[styles.fabDivider, { backgroundColor: colors.border }]} />
                        <Text style={[styles.fabGroupLabel, { color: colors.textSecondary }]}>MESSAGES</Text>
                        <View style={styles.fabGrid}>
                          <TouchableOpacity
                            style={[styles.fabGridBtn, { backgroundColor: '#0284c712', borderColor: '#0284c730' }]}
                            onPress={() => { setClientFabOpen(false); setQuickSendVisible(true); }}
                            activeOpacity={0.75}
                          >
                            <MessageSquare size={17} color="#0284c7" />
                            <Text style={[styles.fabGridBtnText, { color: '#0284c7' }]}>Quick Send</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.fabGridBtn, { backgroundColor: '#7c3aed12', borderColor: '#7c3aed30' }]}
                            onPress={() => sendTemplatedSms('day_of', setSendingDayOf, 'Day-of reminder sent')}
                            disabled={sendingDayOf}
                            activeOpacity={0.75}
                          >
                            {sendingDayOf
                              ? <ActivityIndicator size="small" color="#7c3aed" />
                              : <BellRing size={17} color="#7c3aed" />
                            }
                            <Text style={[styles.fabGridBtnText, { color: '#7c3aed' }]}>Day-Of</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.fabGridBtn, { backgroundColor: '#0f766e12', borderColor: '#0f766e30' }]}
                            onPress={() => sendTemplatedSms('on_way', setSendingOnWay, 'On the way message sent')}
                            disabled={sendingOnWay}
                            activeOpacity={0.75}
                          >
                            {sendingOnWay
                              ? <ActivityIndicator size="small" color="#0f766e" />
                              : <Navigation size={17} color="#0f766e" />
                            }
                            <Text style={[styles.fabGridBtnText, { color: '#0f766e' }]}>On My Way</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.fabGridBtn, { backgroundColor: '#dc262612', borderColor: '#dc262630' }]}
                            onPress={() => sendTemplatedSms('follow_up', setSendingReviewFollowUp, 'Follow-up sent')}
                            disabled={sendingReviewFollowUp}
                            activeOpacity={0.75}
                          >
                            {sendingReviewFollowUp
                              ? <ActivityIndicator size="small" color="#dc2626" />
                              : <Send size={17} color="#dc2626" />
                            }
                            <Text style={[styles.fabGridBtnText, { color: '#dc2626' }]}>Follow-Up</Text>
                          </TouchableOpacity>

                          {orgGoogleReviewUrl && (
                            <TouchableOpacity
                              style={[styles.fabGridBtn, { backgroundColor: '#16a34a12', borderColor: '#16a34a30' }]}
                              onPress={() => { sendReviewFollowUp(); setClientFabOpen(false); }}
                              disabled={sendingReviewFollowUp}
                              activeOpacity={0.75}
                            >
                              {sendingReviewFollowUp
                                ? <ActivityIndicator size="small" color="#16a34a" />
                                : reviewFollowUpSentAt
                                  ? <Check size={17} color="#16a34a" strokeWidth={2.5} />
                                  : <Star size={17} color="#16a34a" />
                              }
                              <Text style={[styles.fabGridBtnText, { color: '#16a34a' }]}>
                                {reviewFollowUpSentAt ? 'Resend Review' : 'Review Ask'}
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </>
                    )}
                  </View>
                )}

                {/* FAB toggle button */}
                <TouchableOpacity
                  style={[styles.fabToggle, { backgroundColor: clientFabOpen ? colors.surface : colors.primary, borderColor: clientFabOpen ? colors.border : colors.primary }]}
                  onPress={() => setClientFabOpen(v => !v)}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={clientFabOpen ? [colors.surface, colors.surface] : [colors.primary, colors.primary + 'cc']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.fabToggleGradient}
                  >
                    {clientFabOpen
                      ? <ChevronDown size={18} color={colors.textSecondary} />
                      : <Zap size={18} color="#fff" />
                    }
                    <Text style={[styles.fabToggleText, { color: clientFabOpen ? colors.textSecondary : '#fff' }]}>
                      {clientFabOpen ? 'Close' : 'Actions'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
            {deleteConfirm && client && (
              <View style={styles.deleteConfirmBox}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 4 }}>
                  <AlertTriangle size={16} color="#dc2626" />
                  <Text style={styles.deleteConfirmTitle}>Delete {client.name}?</Text>
                </View>
                <Text style={styles.deleteConfirmText}>
                  This will permanently remove the client and all their data. This cannot be undone.
                </Text>
                <View style={styles.deleteConfirmButtons}>
                  <TouchableOpacity
                    style={styles.deleteConfirmCancel}
                    onPress={() => setDeleteConfirm(false)}
                    disabled={loading}
                  >
                    <Text style={styles.deleteConfirmCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteConfirmConfirm}
                    onPress={handleDelete}
                    disabled={loading}
                  >
                    <LinearGradient
                      colors={['#dc2626', '#b91c1c']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.deleteConfirmConfirmGradient}
                    >
                      {loading ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.deleteConfirmConfirmText}>Delete</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setDeleteConfirm(false);
                  if (!client && creationMode === 'full') {
                    setCreationMode('chooser');
                    setShowMoreDetails(false);
                  } else {
                    onClose();
                  }
                }}
                disabled={loading}
              >
                <Text style={styles.cancelButtonText}>{!client && creationMode === 'full' ? 'Back' : 'Cancel'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, styles.saveButtonSolid, loading && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
            </>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>

      {client && (
        <ClientPhotosGalleryModal
          visible={showGallery}
          clientId={client.id}
          clientName={client.name || 'Client'}
          clientEmail={client.email || undefined}
          clientPhone={client.phone || undefined}
          onClose={() => {
            setShowGallery(false);
            fetchPhotos(client.id);
          }}
        />
      )}

      <MapPinDropModal
        visible={showMapPinDrop}
        onClose={() => setShowMapPinDrop(false)}
        onSelect={(data) => {
          const updated = [...addresses];
          if (updated[mapPinDropIndex]) {
            updated[mapPinDropIndex] = {
              ...updated[mapPinDropIndex],
              street: data.street || updated[mapPinDropIndex].street,
              city: data.city || updated[mapPinDropIndex].city,
              state: data.state || updated[mapPinDropIndex].state,
              postalCode: data.postalCode || updated[mapPinDropIndex].postalCode,
              country: data.country || updated[mapPinDropIndex].country,
              latitude: data.latitude,
              longitude: data.longitude,
              address: data.fullAddress || buildFullAddress(data.street, data.city, data.state, data.postalCode, data.country),
              normalized: data.normalized,
            };
            setAddresses(updated);
          }
        }}
      />

      <AddPropertyQualityModal
        visible={showAddQualityModal}
        onClose={() => setShowAddQualityModal(false)}
        onAdd={async (draft: PropertyQualityDraft) => {
          const activeAddr = addresses.find(a => a.is_primary) || addresses[0];
          const sortOrder = propertyQualities.length;
          const newPq: PropertyQuality = {
            label: draft.label,
            unit_type: draft.unit_type,
            custom_unit_label: draft.custom_unit_label,
            quantity: 0,
            tally: 0,
            address_id: activeAddr?.id || null,
            sort_order: sortOrder,
            isNew: true,
          };
          if (client?.id && currentOrganization?.id) {
            const { data: inserted } = await supabase
              .from('client_property_qualities')
              .insert({
                client_id: client.id,
                organization_id: currentOrganization.id,
                label: draft.label,
                unit_type: draft.unit_type,
                custom_unit_label: draft.custom_unit_label || null,
                quantity: 0,
                tally: 0,
                address_id: activeAddr?.id || null,
                sort_order: sortOrder,
              })
              .select('id')
              .maybeSingle();
            if (inserted?.id) {
              newPq.id = inserted.id;
              newPq.isNew = false;
            }
          }
          setPropertyQualities(prev => [...prev, newPq]);
          setShowAddQualityModal(false);
        }}
      />
      <EquipmentEditModal
        visible={showEquipmentEditModal}
        onClose={() => {
          setShowEquipmentEditModal(false);
          setEditingEquipmentId(null);
        }}
        equipmentId={editingEquipmentId}
        equipmentName={equipmentInventory.find(e => e.id === editingEquipmentId)?.name}
        equipmentCategory={equipmentInventory.find(e => e.id === editingEquipmentId)?.category}
        onSaved={() => {
          fetchEquipmentInventory();
          if (client?.id) fetchClientEquipment(client.id);
        }}
      />
      <TimePicker
        visible={!!activeTimePicker}
        value={
          activeTimePicker?.type === 'clientStart' ? commercialWindowStart :
          activeTimePicker?.type === 'clientEnd' ? commercialWindowEnd :
          activeTimePicker?.type === 'addrStart' && activeTimePicker.addrIndex !== undefined ? (addresses[activeTimePicker.addrIndex]?.service_window_start ?? '') :
          activeTimePicker?.type === 'addrEnd' && activeTimePicker.addrIndex !== undefined ? (addresses[activeTimePicker.addrIndex]?.service_window_end ?? '') :
          activeTimePicker?.type === 'windowStart' && activeTimePicker.addrIndex !== undefined && activeTimePicker.windowIndex !== undefined ? (addressServiceWindows[activeTimePicker.addrIndex]?.[activeTimePicker.windowIndex]?.window_start ?? '') :
          activeTimePicker?.type === 'windowEnd' && activeTimePicker.addrIndex !== undefined && activeTimePicker.windowIndex !== undefined ? (addressServiceWindows[activeTimePicker.addrIndex]?.[activeTimePicker.windowIndex]?.window_end ?? '') :
          ''
        }
        onConfirm={handleTimePickerConfirm}
        onCancel={() => setActiveTimePicker(null)}
      />
      <ClientQuickSendModal
        visible={quickSendVisible}
        onClose={() => setQuickSendVisible(false)}
        clientName={name}
        primaryPhone={phone}
        secondaryContactName={secondaryContactName || undefined}
        secondaryPhone={secondaryContactPhone || undefined}
      />

      {/* Phone picker sheet for secondary contact selection */}
      <Modal visible={phonePickerVisible} transparent animationType="fade">
        <TouchableOpacity
          style={pickerStyles.phonePickerOverlay}
          activeOpacity={1}
          onPress={() => {
            phonePickerResolveRef.current?.(null);
            phonePickerResolveRef.current = null;
            setPhonePickerVisible(false);
          }}
        >
          <View style={[pickerStyles.phonePickerSheet, { backgroundColor: colors.card }]}>
            <Text style={[pickerStyles.phonePickerTitle, { color: colors.text }]}>Send To</Text>
            {phonePickerOptions.map((opt) => (
              <TouchableOpacity
                key={opt.phone}
                style={[pickerStyles.phonePickerOption, { borderColor: colors.border }]}
                onPress={() => {
                  phonePickerResolveRef.current?.(opt.phone);
                  phonePickerResolveRef.current = null;
                  setPhonePickerVisible(false);
                }}
              >
                <Text style={[pickerStyles.phonePickerOptionLabel, { color: colors.text }]}>{opt.label}</Text>
                <Text style={[pickerStyles.phonePickerOptionPhone, { color: colors.textSecondary }]}>{opt.phone}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[pickerStyles.phonePickerCancel, { borderColor: colors.border }]}
              onPress={() => {
                phonePickerResolveRef.current?.(null);
                phonePickerResolveRef.current = null;
                setPhonePickerVisible(false);
              }}
            >
              <Text style={[pickerStyles.phonePickerCancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </Modal>
  );
}

function getStyles(colors: any) {
  return StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: colors.cardBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
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
    fontSize: 18,
    fontWeight: '700',
    color: '#1B4D6E',
  },
  form: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  labelWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
    lineHeight: 20,
  },
  notifyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  notifyToggleActive: {
    backgroundColor: '#1B4D6E',
    borderColor: '#1B4D6E',
  },
  notifyToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  notifyToggleTextActive: {
    color: '#fff',
  },
  unsubBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  unsubBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#dc2626',
    fontWeight: '500',
  },
  resubButton: {
    backgroundColor: colors.cardBackground,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resubButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
  },
  input: {
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  addressesSection: {
    marginBottom: 20,
  },
  addressesSectionHeader: {
    marginBottom: 12,
  },
  addAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(27, 77, 110, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(27, 77, 110, 0.2)',
  },
  addAddressButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1B4D6E',
  },
  addAddressInlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(27, 77, 110, 0.3)',
    backgroundColor: 'rgba(27, 77, 110, 0.04)',
    marginTop: 4,
    marginBottom: 4,
  },
  addrSubSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  addrSubSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  addrSubSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  addrSubSectionHint: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: -4,
    marginBottom: 8,
  },
  addrDetailsCollapsible: {
    marginTop: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  addrDetailsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface,
  },
  addrDetailsToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addrDetailsToggleLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  addrDetailsActivePill: {
    backgroundColor: 'rgba(27,77,110,0.15)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  addrDetailsActivePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1B4D6E',
  },
  addrDetailsContent: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    backgroundColor: colors.cardBackground,
  },
  accessCodeTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  accessCodeTypeChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  accessCodeTypeChipActive: {
    borderColor: '#1B4D6E',
    backgroundColor: 'rgba(27,77,110,0.12)',
  },
  accessCodeTypeChipText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  accessCodeTypeChipTextActive: {
    color: '#1B4D6E',
    fontWeight: '700',
  },
  accessCodeInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.inputBackground,
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  priceOverrideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  priceOverrideToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priceOverrideToggleLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  priceOverrideToggleLabelActive: {
    color: '#1B4D6E',
    fontWeight: '700',
  },
  priceOverrideInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  priceOverrideCurrency: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1B4D6E',
  },
  priceOverrideInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#1B4D6E',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    fontWeight: '700',
    color: '#1B4D6E',
    backgroundColor: 'rgba(27,77,110,0.08)',
  },
  priceOverrideHint: {
    fontSize: 11,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  serviceTypePriceRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  serviceTypePriceToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
  },
  serviceTypePriceLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  serviceTypePriceLabelActive: {
    color: '#1B4D6E',
  },
  serviceTypePriceInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  serviceTypePriceField: {
    borderWidth: 1.5,
    borderColor: '#1B4D6E',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 14,
    fontWeight: '700',
    color: '#1B4D6E',
    backgroundColor: 'rgba(27,77,110,0.08)',
    minWidth: 80,
    textAlign: 'right',
  },
  addrPaneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addrPaneTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  propQualHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  propQualHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  propQualHeaderLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1B4D6E',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  propQualHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  propQualBadge: {
    backgroundColor: 'rgba(27,77,110,0.12)',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  propQualBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1B4D6E',
  },
  propQualBody: {
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    backgroundColor: colors.cardBackground,
  },
  propQualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.cardBackground,
    minHeight: 64,
    flexWrap: 'wrap',
    gap: 8,
  },
  propQualRowWrap: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  propQualRowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flex: 1,
    minWidth: 0,
  },
  propQualRowFirst: {
  },
  propQualRowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  propQualRowFilled: {
    backgroundColor: colors.surface,
  },
  propQualRowLeft: {
    flex: 1,
    paddingRight: 12,
    justifyContent: 'flex-start',
    paddingTop: 2,
  },
  propQualRowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 1,
  },
  propQualRowDesc: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  propQualRowUnit: {
    fontSize: 11,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  propQualRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  tallyFullRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 0,
    flexWrap: 'nowrap',
  },
  tallyStackedControls: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 6,
    flexShrink: 1,
    minWidth: 0,
  },
  tallyStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Platform.OS === 'web' ? 4 : 5,
  },
  tallyCounterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tallyQuickAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Platform.OS === 'web' ? 4 : 6,
  },
  tallyStepBtnLarge: {
    width: 56,
    height: 56,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  tallyCountDisplay: {
    width: 72,
    height: 56,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 6,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    backgroundColor: colors.inputBackground,
  },
  tallyAddInput: {
    width: Platform.OS === 'web' ? 60 : 80,
    height: Platform.OS === 'web' ? 34 : 40,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: Platform.OS === 'web' ? 6 : 10,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.inputBackground,
    textAlign: 'center',
    flexShrink: 0,
  },
  paneTallyBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: colors.inputBackground,
    flexShrink: 0,
  },
  paneTallyAmountInput: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.inputBackground,
  },
  tallyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: Platform.OS === 'web' ? 34 : 40,
    borderRadius: 10,
    flexShrink: 0,
  },
  gradientTallyAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: Platform.OS === 'web' ? 8 : 12,
    height: Platform.OS === 'web' ? 34 : 40,
    borderRadius: 10,
  },
  tallyAddBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  propQualStepBtn: {
    width: Platform.OS === 'web' ? 36 : 44,
    height: Platform.OS === 'web' ? 36 : 44,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  propQualStepBtnMinus: {
    borderColor: '#fca5a5',
    backgroundColor: '#fef2f2',
  },
  propQualStepBtnPlusDark: {
    borderColor: '#6ee7b7',
    backgroundColor: '#022c22',
  },
  propQualStepBtnPlus: {
    borderColor: '#6ee7b7',
    backgroundColor: '#f0fdf4',
  },
  propQualStepBtnDisabled: {
    borderColor: colors.border,
    backgroundColor: colors.surface,
    opacity: 0.45,
  },
  propQualNumInput: {
    width: Platform.OS === 'web' ? 48 : 60,
    height: Platform.OS === 'web' ? 36 : 44,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 4,
    textAlign: 'center',
    fontSize: Platform.OS === 'web' ? 15 : 17,
    fontWeight: '700',
    color: colors.text,
    backgroundColor: colors.inputBackground,
  },
  panePriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  panePriceModeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(27,77,110,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(27,77,110,0.2)',
  },
  panePriceModeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1B4D6E',
  },
  panePriceInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 4,
    paddingVertical: 3,
  },
  panePriceCurrency: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  panePriceField: {
    width: 60,
    fontSize: 12,
    color: colors.text,
    padding: 0,
  },
  panePriceFieldActive: {
    color: '#1B4D6E',
    fontWeight: '600',
  },
  panePriceExtHint: {
    fontSize: 11,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  paneSplitBreakdownRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    flexWrap: 'wrap' as const,
  },
  paneSplitChip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: 'rgba(107,114,128,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(107,114,128,0.2)',
  },
  paneSplitChipFull: {
    backgroundColor: 'rgba(3,105,161,0.08)',
    borderColor: 'rgba(3,105,161,0.25)',
  },
  paneSplitChipCount: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  paneSplitChipLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  paneSplitTotal: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginLeft: 2,
  },
  propQualPaneTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(27,77,110,0.08)',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  propQualPaneTotalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  propQualPaneTotalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1B4D6E',
  },
  propQualInlineAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
  },
  propQualInlineAddInput: {
    height: 32,
    width: 88,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    fontSize: 13,
    color: colors.text,
    backgroundColor: colors.inputBackground,
  },
  propQualInlineAddBtn: {
    borderRadius: 8,
    overflow: 'hidden' as const,
    height: 32,
  },
  propQualInlineAddBtnGradient: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 3,
    paddingHorizontal: 10,
    height: 32,
  },
  propQualInlineAddBtnDisabled: {
    opacity: 0.5,
  },
  propQualInlineAddBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  propQualSyncNote: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  propQualSyncNoteText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  propQualAddCategoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  propQualAddCategoryBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1B4D6E',
  },
  pqLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pqDeleteBtn: {
    padding: 2,
  },
  pqDualStepper: {
    flexDirection: 'row',
    gap: Platform.OS === 'web' ? 6 : 8,
    flexShrink: 1,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  pqStepperCol: {
    alignItems: 'center',
    gap: 4,
  },
  pqStepperColLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  pqSmallNumInput: {
    width: Platform.OS === 'web' ? 40 : 48,
    height: Platform.OS === 'web' ? 34 : 38,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 4,
    textAlign: 'center',
    fontSize: Platform.OS === 'web' ? 13 : 15,
    fontWeight: '700',
    color: colors.text,
    backgroundColor: colors.inputBackground,
  },
  emptyAddressPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: 8,
  },
  emptyAddressText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  addressCard: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addressCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  addressTypeRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  addressTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  addressTypeChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  addressTypeInherited: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.7)',
    marginLeft: 2,
  },
  labelSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  labelSelectorText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1B4D6E',
  },
  addressCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryToggle: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: colors.inputBackground,
  },
  primaryToggleActive: {
    backgroundColor: '#2D8B57',
  },
  primaryToggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  primaryToggleTextActive: {
    color: '#fff',
  },
  removeAddressButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: colors.inputBackground,
  },
  labelPickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
    padding: 8,
    backgroundColor: colors.cardBackground,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  labelPresetButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.inputBackground,
  },
  labelPresetCustom: {
    backgroundColor: 'rgba(27, 77, 110, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(27, 77, 110, 0.2)',
  },
  labelPresetText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
  },
  customLabelRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  customLabelSave: {
    borderRadius: 8,
    overflow: 'hidden' as const,
  },
  customLabelSaveGradient: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  customLabelSaveText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  addressHint: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 6,
  },
  categoryChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  unitQuantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 8,
    flexWrap: 'wrap',
  },
  unitQuantityLabel: {
    flex: 1,
    minWidth: 80,
  },
  unitQuantityName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  unitQuantityUnit: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  unitQuantityInput: {
    width: 100,
    marginBottom: 0,
    textAlign: 'right',
  },
  unitTallyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 1,
  },
  unitTallyBtn: {
    width: 30,
    height: 30,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  unitTallyTotal: {
    width: 50,
    height: 30,
    borderRadius: 7,
    marginBottom: 0,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 0,
  },
  unitTallyAddInput: {
    width: 52,
    height: 30,
    borderRadius: 7,
    marginBottom: 0,
    fontSize: 13,
    flexShrink: 1,
  },
  unitTallyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 8,
    height: 30,
    borderRadius: 7,
    backgroundColor: '#3b82f6',
    flexShrink: 0,
  },
  unitTallyAddBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  paneAddressTabs: {
    flexDirection: 'row',
    marginBottom: 8,
    marginTop: 4,
  },
  paneAddressTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  paneAddressTabActive: {
    backgroundColor: '#1B4D6E',
    borderColor: '#1B4D6E',
  },
  paneAddressTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  paneAddressTabTextActive: {
    color: '#fff',
  },
  paneJobTypeCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    marginTop: 10,
    overflow: 'hidden',
    backgroundColor: colors.cardBackground,
  },
  paneJobTypeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.surface,
  },
  paneJobTypeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  paneJobTypeName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  paneTotalBadge: {
    backgroundColor: 'rgba(27,77,110,0.12)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  paneTotalBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1B4D6E',
  },
  paneDetailsBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 8,
  },
  paneSection: {
    marginTop: 8,
  },
  paneSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  paneSectionHint: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  paneFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  paneFieldLabel: {
    fontSize: 13,
    color: colors.text,
    flex: 1,
  },
  paneFieldControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  paneStepBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  paneFieldInput: {
    width: 52,
    height: 30,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 6,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    backgroundColor: colors.inputBackground,
  },
  paneDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  paneSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  paneSummaryLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  paneSummaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1B4D6E',
  },
  paneSplitRow: {
    backgroundColor: 'rgba(27,77,110,0.07)',
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
    marginBottom: 4,
  },
  paneSplitLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1B4D6E',
  },
  paneSplitHint: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  fabContainer: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    position: 'relative' as const,
    zIndex: 10,
  },
  fabBackdrop: {
    position: 'absolute' as const,
    top: -1000,
    left: -1000,
    right: -1000,
    bottom: -1000,
    zIndex: 9,
  },
  fabPanel: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 10,
  },
  fabGroupLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  fabGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
  },
  fabGridBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  fabGridBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  fabDivider: {
    height: 1,
    marginVertical: 12,
  },
  fabToggle: {
    borderRadius: 12,
    overflow: 'hidden' as const,
    borderWidth: 1,
  },
  fabToggleGradient: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  fabToggleText: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
  reviewSentBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#dcfce7',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  saveButton: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden' as const,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonSolid: {
    backgroundColor: '#1B4D6E',
    paddingVertical: 14,
  },
  saveButtonGradient: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  errorContainer: {
    backgroundColor: 'rgba(27,77,110,0.1)',
    padding: 12,
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 8,
  },
  errorText: {
    color: '#1B4D6E',
    fontSize: 14,
    textAlign: 'center',
  },
  duplicateWarningContainer: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#f59e0b',
    borderRadius: 8,
    padding: 14,
    marginHorizontal: 20,
    marginTop: 12,
  },
  duplicateWarningHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 8,
  },
  duplicateWarningTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#92400e',
  },
  duplicateWarningItem: {
    fontSize: 13,
    color: '#78350f',
    marginBottom: 4,
    paddingLeft: 26,
  },
  duplicateWarningActions: {
    flexDirection: 'row' as const,
    gap: 10,
    marginTop: 10,
    justifyContent: 'flex-end' as const,
  },
  duplicateWarningCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d97706',
  },
  duplicateWarningCancelText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#92400e',
  },
  duplicateWarningSaveBtn: {
    borderRadius: 6,
    overflow: 'hidden' as const,
  },
  duplicateWarningSaveBtnGradient: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  duplicateWarningSaveText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#fff',
  },
  photosSection: {
    marginBottom: 20,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  photosSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  photoActions: {
    flexDirection: 'row',
    gap: 16,
  },
  pickImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addPhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addPhotoButtonText: {
    color: '#1B4D6E',
    fontSize: 14,
    fontWeight: '600',
  },
  addPhotoForm: {
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  submitPhotoButton: {
    borderRadius: 6,
    overflow: 'hidden' as const,
    marginTop: 8,
  },
  submitPhotoButtonGradient: {
    padding: 10,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  submitPhotoButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  noPhotos: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: colors.surface,
    borderRadius: 8,
  },
  noPhotosText: {
    color: colors.textSecondary,
    marginTop: 8,
    fontSize: 14,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoItem: {
    width: '31%',
    aspectRatio: 1,
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: colors.border,
  },
  deletePhotoButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    padding: 4,
  },
  photoCaption: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    color: '#fff',
    fontSize: 10,
    padding: 4,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  geocodeStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  geocodeStatusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1B4D6E',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 13,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#dc2626',
    backgroundColor: 'rgba(220,38,38,0.06)',
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#dc2626',
  },
  deleteConfirmBox: {
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(220,38,38,0.08)',
    borderWidth: 1.5,
    borderColor: '#dc2626',
  },
  deleteConfirmTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#dc2626',
    marginBottom: 4,
    textAlign: 'center',
  },
  deleteConfirmText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 12,
  },
  deleteConfirmButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  deleteConfirmCancel: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  deleteConfirmCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  deleteConfirmConfirm: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden' as const,
  },
  deleteConfirmConfirmGradient: {
    padding: 10,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  deleteConfirmConfirmText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  secondaryContactCard: {
    gap: 8,
    marginTop: 4,
  },
  secondaryInput: {
    marginTop: 0,
  },
  });
}

const pickerStyles = StyleSheet.create({
  phonePickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  phonePickerSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32 },
  phonePickerTitle: { fontSize: 16, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  phonePickerOption: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 10 },
  phonePickerOptionLabel: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  phonePickerOptionPhone: { fontSize: 13 },
  phonePickerCancel: { padding: 14, borderRadius: 12, borderWidth: 1, alignItems: 'center', marginTop: 4 },
  phonePickerCancelText: { fontSize: 15, fontWeight: '600' },
});
