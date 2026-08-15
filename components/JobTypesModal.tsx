import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Plus, Trash2, CreditCard as Edit2, Check, Info, Settings, ChevronLeft, ChevronDown, ChevronRight, Tag, FolderOpen, Grid3x3, Eye, EyeOff, DollarSign, ShieldCheck, Briefcase } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import CollapsibleField from './CollapsibleField';
import { useCollapsibleForm } from '@/hooks/useCollapsibleForm';
import { isWindowRelatedJob } from '@/lib/productionRateService';

type Screen = 'list' | 'form' | 'pane-pricing' | 'categories' | 'category-form' | 'pane-types' | 'pane-type-form' | 'global-pane-pricing';

interface JobType {
  id: string;
  name: string;
  description: string;
  hourly_rate: number;
  is_active: boolean;
  unit_of_measure: string;
  custom_unit_label: string;
  is_flat_rate: boolean;
  units_per_hour: number | null;
  category_id?: string | null;
  scope_options?: 'both' | 'exterior_only' | 'interior_only' | null;
  exterior_pct_standard?: number | null;
  exterior_pct_french?: number | null;
  exterior_split_percent_standard?: number | null;
  exterior_split_percent_french?: number | null;
  exterior_split_percent_storm?: number | null;
  exterior_split_percent_skylights?: number | null;
  interior_split_percent_standard?: number | null;
  interior_split_percent_french?: number | null;
  interior_split_percent_storm?: number | null;
  interior_split_percent_skylights?: number | null;
  price_per_pane_standard?: number | null;
  price_per_pane_french?: number | null;
  price_per_pane_storm?: number | null;
  price_per_pane_skylights?: number | null;
  pane_rates?: Record<string, number> | null;
}

interface JobTypeCategory {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  service_type?: string | null;
}

const SERVICE_TYPE_OPTIONS = [
  { value: '', label: 'General (no special UI)' },
  { value: 'window_cleaning', label: 'Window Cleaning' },
  { value: 'gutter_cleaning', label: 'Gutter Cleaning' },
  { value: 'soft_washing', label: 'Soft Washing' },
  { value: 'pressure_washing', label: 'Pressure Washing' },
  { value: 'christmas_lights', label: 'Christmas Lights' },
];

interface PaneType {
  id: string;
  name: string;
  key: string;
  description: string;
  sort_order: number;
  is_active: boolean;
}

interface PanePricingState {
  exteriorPct: string;
  interiorPct: string;
  pricePerPane: string;
}

interface JobTypesModalProps {
  visible: boolean;
  onClose: () => void;
}

type PaneTypeLabel = string;

const CATEGORY_COLORS = [
  '#1B4D6E', '#2E7D52', '#B45309', '#B91C1C',
  '#6B21A8', '#0369A1', '#0F766E', '#92400E',
];

function PanePricingRow({
  label,
  state,
  onChange,
  baseRate,
  colors,
}: {
  label: PaneTypeLabel;
  state: PanePricingState;
  onChange: (update: Partial<PanePricingState>) => void;
  baseRate: number;
  colors: any;
}) {
  const effectivePrice = state.pricePerPane !== '' ? parseFloat(state.pricePerPane) || 0 : baseRate;
  const extPct = state.exteriorPct !== '' ? parseFloat(state.exteriorPct) || 0 : 60;
  const intPct = state.interiorPct !== '' ? parseFloat(state.interiorPct) || 0 : (100 - extPct);
  const extPrice = effectivePrice * (extPct / 100);
  const intPrice = effectivePrice * (intPct / 100);

  const handleExteriorChange = (v: string) => {
    const cleaned = v.replace(/[^0-9]/g, '');
    if (cleaned === '') { onChange({ exteriorPct: '' }); return; }
    const num = Math.min(100, parseInt(cleaned) || 0);
    onChange({ exteriorPct: String(num) });
  };

  const handleInteriorChange = (v: string) => {
    const cleaned = v.replace(/[^0-9]/g, '');
    if (cleaned === '') { onChange({ interiorPct: '' }); return; }
    const num = Math.min(100, parseInt(cleaned) || 0);
    onChange({ interiorPct: String(num) });
  };

  return (
    <View style={pricingStyles.rowContainer}>
      <Text style={[pricingStyles.rowLabel, { color: colors.text }]}>{label} Panes</Text>

      <View style={pricingStyles.fieldsRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[pricingStyles.fieldLabel, { color: colors.textSecondary }]}>Price / Pane</Text>
          <View style={[pricingStyles.inputWrap, { backgroundColor: colors.inputBackground }]}>
            <Text style={[pricingStyles.prefix, { color: colors.textSecondary }]}>$</Text>
            <TextInput
              style={[pricingStyles.fieldInput, { color: colors.text }]}
              placeholder={baseRate > 0 ? baseRate.toFixed(2) : '0.00'}
              placeholderTextColor={colors.textSecondary}
              value={state.pricePerPane}
              onChangeText={v => onChange({ pricePerPane: v.replace(/[^0-9.]/g, '') })}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[pricingStyles.fieldLabel, { color: colors.textSecondary }]}>Exterior %</Text>
          <View style={[pricingStyles.inputWrap, { backgroundColor: colors.inputBackground }]}>
            <TextInput
              style={[pricingStyles.fieldInput, { color: colors.text }]}
              placeholder="60"
              placeholderTextColor={colors.textSecondary}
              value={state.exteriorPct}
              onChangeText={handleExteriorChange}
              keyboardType="number-pad"
              maxLength={3}
            />
            <Text style={[pricingStyles.suffix, { color: colors.textSecondary }]}>%</Text>
          </View>
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[pricingStyles.fieldLabel, { color: colors.textSecondary }]}>Interior %</Text>
          <View style={[pricingStyles.inputWrap, { backgroundColor: colors.inputBackground }]}>
            <TextInput
              style={[pricingStyles.fieldInput, { color: colors.text }]}
              placeholder="40"
              placeholderTextColor={colors.textSecondary}
              value={state.interiorPct}
              onChangeText={handleInteriorChange}
              keyboardType="number-pad"
              maxLength={3}
            />
            <Text style={[pricingStyles.suffix, { color: colors.textSecondary }]}>%</Text>
          </View>
        </View>
      </View>

      {effectivePrice > 0 && (
        <View style={pricingStyles.previewRow}>
          <View style={[pricingStyles.previewChip, { backgroundColor: colors.primaryLight }]}>
            <Text style={[pricingStyles.previewChipLabel, { color: colors.primary }]}>Exterior</Text>
            <Text style={[pricingStyles.previewChipValue, { color: colors.primary }]}>${extPrice.toFixed(2)}/pane</Text>
          </View>
          <View style={[pricingStyles.previewChip, { backgroundColor: colors.inputBackground }]}>
            <Text style={[pricingStyles.previewChipLabel, { color: colors.textSecondary }]}>Interior</Text>
            <Text style={[pricingStyles.previewChipValue, { color: colors.text }]}>${intPrice.toFixed(2)}/pane</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const pricingStyles = StyleSheet.create({
  rowContainer: { marginBottom: 20 },
  rowLabel: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
  fieldsRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 0, borderRadius: 10, paddingHorizontal: 10 },
  prefix: { fontSize: 14, marginRight: 2 },
  suffix: { fontSize: 14, marginLeft: 2 },
  fieldInput: { flex: 1, minWidth: 0, fontSize: 15, paddingVertical: 10 },
  previewRow: { flexDirection: 'row', gap: 8 },
  previewChip: { flex: 1, borderRadius: 8, padding: 10 },
  previewChipLabel: { fontSize: 11, fontWeight: '600', marginBottom: 2 },
  previewChipValue: { fontSize: 14, fontWeight: '700' },
});

export default function JobTypesModal({ visible, onClose }: JobTypesModalProps) {
  const [screen, setScreen] = useState<Screen>('list');
  const [jobTypes, setJobTypes] = useState<JobType[]>([]);
  const [categories, setCategories] = useState<JobTypeCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isFlatRate, setIsFlatRate] = useState(false);
  const [unitOfMeasure, setUnitOfMeasure] = useState('hour');
  const [customUnitLabel, setCustomUnitLabel] = useState('');
  const [showUnitPicker, setShowUnitPicker] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [scopeOptions, setScopeOptions] = useState<'both' | 'exterior_only' | null>('both');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPaneSettings, setShowPaneSettings] = useState(false);

  const [categoryName, setCategoryName] = useState('');
  const [categoryColor, setCategoryColor] = useState(CATEGORY_COLORS[0]);
  const [categoryServiceType, setCategoryServiceType] = useState('');
  const [showServiceTypePicker, setShowServiceTypePicker] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [savingCategory, setSavingCategory] = useState(false);
  const [categoryError, setCategoryError] = useState('');

  const [standardPricing, setStandardPricing] = useState<PanePricingState>({ exteriorPct: '', interiorPct: '', pricePerPane: '' });
  const [frenchPricing, setFrenchPricing] = useState<PanePricingState>({ exteriorPct: '', interiorPct: '', pricePerPane: '' });
  const [stormPricing, setStormPricing] = useState<PanePricingState>({ exteriorPct: '', interiorPct: '', pricePerPane: '' });
  const [skylightsPricing, setSkylightsPricing] = useState<PanePricingState>({ exteriorPct: '', interiorPct: '', pricePerPane: '' });
  const [dynamicPanePricing, setDynamicPanePricing] = useState<Record<string, PanePricingState>>({});

  const [paneTypes, setPaneTypes] = useState<PaneType[]>([]);
  const [ptName, setPtName] = useState('');
  const [ptDescription, setPtDescription] = useState('');
  const [ptIsActive, setPtIsActive] = useState(true);
  const [editingPaneTypeId, setEditingPaneTypeId] = useState<string | null>(null);
  const [savingPaneType, setSavingPaneType] = useState(false);
  const [paneTypeError, setPaneTypeError] = useState('');
  const [paneTypesReturnTo, setPaneTypesReturnTo] = useState<Screen>('list');
  const [pricingJobTypeId, setPricingJobTypeId] = useState<string | null>(null);
  const [savingPricing, setSavingPricing] = useState(false);

  const [globalStandardPricing, setGlobalStandardPricing] = useState<PanePricingState>({ exteriorPct: '', interiorPct: '', pricePerPane: '' });
  const [globalFrenchPricing, setGlobalFrenchPricing] = useState<PanePricingState>({ exteriorPct: '', interiorPct: '', pricePerPane: '' });
  const [globalStormPricing, setGlobalStormPricing] = useState<PanePricingState>({ exteriorPct: '', interiorPct: '', pricePerPane: '' });
  const [globalSkylightsPricing, setGlobalSkylightsPricing] = useState<PanePricingState>({ exteriorPct: '', interiorPct: '', pricePerPane: '' });
  const [globalDynamicPanePricing, setGlobalDynamicPanePricing] = useState<Record<string, PanePricingState>>({});
  const [savingGlobalPricing, setSavingGlobalPricing] = useState(false);
  const [globalPricingId, setGlobalPricingId] = useState<string | null>(null);

  const { colors } = useTheme();
  const { showToast } = useToast();
  const { isAdminOrManager } = useUserRole();
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const { activeFieldId, toggleField } = useCollapsibleForm();

  const unitOptions = [
    { value: 'hour', label: 'Hour', suffix: '/hr' },
    { value: 'sqft', label: 'Square Foot', suffix: '/sqft' },
    { value: 'linear_ft', label: 'Linear Foot', suffix: '/ft' },
    { value: 'pane', label: 'Pane', suffix: '/pane' },
    { value: 'item', label: 'Per Item', suffix: '/item' },
    { value: 'day', label: 'Per Day', suffix: '/day' },
    { value: 'mile', label: 'Per Mile', suffix: '/mile' },
    { value: 'custom', label: 'Custom', suffix: '' },
  ];

  useEffect(() => {
    if (visible) {
      fetchData();
    }
  }, [visible]);

  const fetchData = async () => {
    setLoading(true);
    const [jobTypesRes, categoriesRes, paneTypesRes, globalPricingRes] = await Promise.all([
      supabase.from('job_types').select('*').eq('organization_id', currentOrganization?.id).order('name'),
      supabase.from('job_type_categories').select('*').eq('organization_id', currentOrganization?.id).order('sort_order').order('name'),
      supabase.from('pane_types').select('*').eq('organization_id', currentOrganization?.id).order('sort_order').order('name'),
      supabase.from('organization_pane_pricing').select('*').eq('organization_id', currentOrganization?.id).maybeSingle(),
    ]);
    if (!jobTypesRes.error) setJobTypes(jobTypesRes.data || []);
    if (!categoriesRes.error) setCategories(categoriesRes.data || []);
    if (!paneTypesRes.error) setPaneTypes(paneTypesRes.data || []);
    if (!globalPricingRes.error && globalPricingRes.data) {
      setGlobalPricingId(globalPricingRes.data.id);
      loadGlobalPricingState(globalPricingRes.data);
    }
    setLoading(false);
  };

  const loadGlobalPricingState = (data: any) => {
    setGlobalStandardPricing({
      pricePerPane: priceToStr(data.price_per_pane_standard),
      exteriorPct: pctToStr(data.exterior_split_percent_standard),
      interiorPct: pctToStr(data.interior_split_percent_standard),
    });
    setGlobalFrenchPricing({
      pricePerPane: priceToStr(data.price_per_pane_french),
      exteriorPct: pctToStr(data.exterior_split_percent_french),
      interiorPct: pctToStr(data.interior_split_percent_french),
    });
    setGlobalStormPricing({
      pricePerPane: priceToStr(data.price_per_pane_storm),
      exteriorPct: pctToStr(data.exterior_split_percent_storm),
      interiorPct: pctToStr(data.interior_split_percent_storm),
    });
    setGlobalSkylightsPricing({
      pricePerPane: priceToStr(data.price_per_pane_skylights),
      exteriorPct: pctToStr(data.exterior_split_percent_skylights),
      interiorPct: pctToStr(data.interior_split_percent_skylights),
    });
    const rates = data.dynamic_pane_rates || {};
    const dynState: Record<string, PanePricingState> = {};
    const legacyKeys = ['standard', 'french', 'storm', 'skylights'];    Object.keys(rates).forEach(k => {
      const base = k.replace(/_price$/, '').replace(/_exterior_pct$/, '').replace(/_interior_pct$/, '');
      if (!legacyKeys.includes(base) && !dynState[base]) {
        dynState[base] = {
          pricePerPane: priceToStr(rates[`${base}_price`] ?? rates[base] ?? null),
          exteriorPct: pctToStr(rates[`${base}_exterior_pct`] ?? null),
          interiorPct: pctToStr(rates[`${base}_interior_pct`] ?? null),
        };
      }
    });
    setGlobalDynamicPanePricing(dynState);
  };

  const pctToStr = (v: number | null | undefined) => (v != null ? String(v) : '');
  const priceToStr = (v: number | null | undefined) => (v != null ? String(v) : '');
  const parsePct = (v: string): number | null => {
    if (v.trim() === '') return null;
    const n = parseInt(v);
    return isNaN(n) ? null : Math.min(100, Math.max(0, n));
  };
  const parsePrice = (v: string): number | null => {
    if (v.trim() === '') return null;
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
  };

  const resetForm = () => {
    setName(''); setDescription(''); setHourlyRate('');
    setIsActive(true); setIsFlatRate(false);
    setUnitOfMeasure('hour'); setCustomUnitLabel('');
    setSelectedCategoryId(null); setShowCategoryPicker(false);
    setScopeOptions('both');
    setError(''); setEditingId(null); setShowUnitPicker(false);
    setShowPaneSettings(false);
    setStandardPricing({ exteriorPct: '', interiorPct: '', pricePerPane: '' });
    setFrenchPricing({ exteriorPct: '', interiorPct: '', pricePerPane: '' });
    setStormPricing({ exteriorPct: '', interiorPct: '', pricePerPane: '' });
    setSkylightsPricing({ exteriorPct: '', interiorPct: '', pricePerPane: '' });
    setDynamicPanePricing({});
  };

  const resetCategoryForm = () => {
    setCategoryName('');
    setCategoryColor(CATEGORY_COLORS[0]);
    setCategoryServiceType('');
    setShowServiceTypePicker(false);
    setEditingCategoryId(null);
    setCategoryError('');
  };

  const resetPaneTypeForm = () => {
    setPtName('');
    setPtDescription('');
    setPtIsActive(true);
    setEditingPaneTypeId(null);
    setPaneTypeError('');
  };

  const handleClose = () => {
    resetForm();
    resetCategoryForm();
    resetPaneTypeForm();
    setScreen('list');
    onClose();
  };

  const handleEdit = (jobType: JobType) => {
    setEditingId(jobType.id);
    setName(jobType.name);
    setDescription(jobType.description);
    setHourlyRate(jobType.hourly_rate.toString());
    setIsActive(jobType.is_active);
    setIsFlatRate(jobType.is_flat_rate || false);
    setUnitOfMeasure(jobType.unit_of_measure || 'hour');
    setCustomUnitLabel(jobType.custom_unit_label || '');
    setSelectedCategoryId(jobType.category_id || null);
    const loaded = jobType.scope_options;
    setScopeOptions(loaded === 'exterior_only' ? 'exterior_only' : loaded === 'both' ? 'both' : null);

    const stdExt = pctToStr(jobType.exterior_split_percent_standard ?? jobType.exterior_pct_standard);
    const stdInt = pctToStr((jobType as any).interior_split_percent_standard);
    setStandardPricing({ exteriorPct: stdExt, interiorPct: stdInt !== '' ? stdInt : (stdExt !== '' ? String(100 - parseInt(stdExt)) : ''), pricePerPane: priceToStr(jobType.price_per_pane_standard) });
    const frExt = pctToStr(jobType.exterior_split_percent_french ?? jobType.exterior_pct_french);
    const frInt = pctToStr((jobType as any).interior_split_percent_french);
    setFrenchPricing({ exteriorPct: frExt, interiorPct: frInt !== '' ? frInt : (frExt !== '' ? String(100 - parseInt(frExt)) : ''), pricePerPane: priceToStr(jobType.price_per_pane_french) });
    const stExt = pctToStr(jobType.exterior_split_percent_storm);
    const stInt = pctToStr((jobType as any).interior_split_percent_storm);
    setStormPricing({ exteriorPct: stExt, interiorPct: stInt !== '' ? stInt : (stExt !== '' ? String(100 - parseInt(stExt)) : ''), pricePerPane: priceToStr(jobType.price_per_pane_storm) });
    const skExt = pctToStr((jobType as any).exterior_split_percent_skylights ?? null);
    const skInt = pctToStr((jobType as any).interior_split_percent_skylights ?? null);
    setSkylightsPricing({ exteriorPct: skExt, interiorPct: skInt !== '' ? skInt : (skExt !== '' ? String(100 - parseInt(skExt)) : ''), pricePerPane: priceToStr(jobType.price_per_pane_skylights) });

    const rates = jobType.pane_rates || {};
    const editDynamicState: Record<string, PanePricingState> = {};
    const legacyKeys = ['standard', 'french', 'storm', 'skylights'];    paneTypes.filter(pt => pt.is_active && !legacyKeys.includes(pt.key)).forEach(pt => {
      const priceVal = rates[`${pt.key}_price`] ?? rates[pt.key] ?? null;
      const extVal = rates[`${pt.key}_exterior_pct`] ?? null;
      const intVal = rates[`${pt.key}_interior_pct`] ?? null;
      editDynamicState[pt.key] = {
        pricePerPane: priceToStr(priceVal),
        exteriorPct: pctToStr(extVal),
        interiorPct: pctToStr(intVal),
      };
    });
    setDynamicPanePricing(editDynamicState);

    setScreen('form');
  };

  const handleAddNew = () => {
    resetForm();
    setStandardPricing({ ...globalStandardPricing });
    setFrenchPricing({ ...globalFrenchPricing });
    setStormPricing({ ...globalStormPricing });
    setSkylightsPricing({ ...globalSkylightsPricing });
    const dynCopy: Record<string, PanePricingState> = {};
    Object.entries(globalDynamicPanePricing).forEach(([k, v]) => {
      dynCopy[k] = { ...v };
    });
    setDynamicPanePricing(dynCopy);
    setScreen('form');
  };

  const handleSave = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    if (unitOfMeasure === 'custom' && !customUnitLabel.trim()) { setError('Please enter a custom unit label'); return; }
    if (!currentOrganization?.id) { setError('Organization not found'); return; }

    setSaving(true); setError('');
    try {
      const finalUnit = isFlatRate ? 'flat_rate' : unitOfMeasure;
      const isWindowType = !isFlatRate && (unitOfMeasure === 'pane' || isWindowRelatedJob({ unit_of_measure: finalUnit, name: name.trim() }));
      const hasPanePricing = isWindowType;

      const formDynamicRates: Record<string, number> = {};
      if (hasPanePricing) {
        Object.entries(dynamicPanePricing).forEach(([key, state]) => {
          const price = parsePrice(state.pricePerPane);
          const ext = parsePct(state.exteriorPct);
          const int = parsePct(state.interiorPct);
          if (price != null) formDynamicRates[`${key}_price`] = price;
          if (ext != null) formDynamicRates[`${key}_exterior_pct`] = ext;
          if (int != null) formDynamicRates[`${key}_interior_pct`] = int;
        });
      }

      const data: any = {
        name: name.trim(), description: description.trim(),
        hourly_rate: Number(hourlyRate) || 0, is_active: isActive,
        is_flat_rate: isFlatRate, unit_of_measure: finalUnit,
        custom_unit_label: unitOfMeasure === 'custom' ? customUnitLabel.trim() : '',
        category_id: selectedCategoryId || null,
        scope_options: hasPanePricing ? (scopeOptions ?? 'both') : null,
        updated_at: new Date().toISOString(),
        exterior_split_percent_standard: hasPanePricing ? parsePct(standardPricing.exteriorPct) : null,
        exterior_split_percent_french: hasPanePricing ? parsePct(frenchPricing.exteriorPct) : null,
        exterior_split_percent_storm: hasPanePricing ? parsePct(stormPricing.exteriorPct) : null,
        exterior_split_percent_skylights: hasPanePricing ? parsePct(skylightsPricing.exteriorPct) : null,
        interior_split_percent_standard: hasPanePricing ? parsePct(standardPricing.interiorPct) : null,
        interior_split_percent_french: hasPanePricing ? parsePct(frenchPricing.interiorPct) : null,
        interior_split_percent_storm: hasPanePricing ? parsePct(stormPricing.interiorPct) : null,
        interior_split_percent_skylights: hasPanePricing ? parsePct(skylightsPricing.interiorPct) : null,
        price_per_pane_standard: hasPanePricing ? parsePrice(standardPricing.pricePerPane) : null,
        price_per_pane_french: hasPanePricing ? parsePrice(frenchPricing.pricePerPane) : null,
        price_per_pane_storm: hasPanePricing ? parsePrice(stormPricing.pricePerPane) : null,
        price_per_pane_skylights: hasPanePricing ? parsePrice(skylightsPricing.pricePerPane) : null,
        exterior_pct_standard: hasPanePricing ? parsePct(standardPricing.exteriorPct) : null,
        exterior_pct_french: hasPanePricing ? parsePct(frenchPricing.exteriorPct) : null,
        pane_rates: hasPanePricing && Object.keys(formDynamicRates).length > 0 ? formDynamicRates : null,
      };

      if (editingId) {
        const { error } = await supabase.from('job_types').update(data).eq('id', editingId).eq('organization_id', currentOrganization.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('job_types').insert({ ...data, organization_id: currentOrganization.id });
        if (error) throw error;
      }

      showToast({ message: 'Job type saved', type: 'success' });
      resetForm();
      setScreen('list');
      fetchData();
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!currentOrganization?.id) return;
    try {
      const { error } = await supabase.from('job_types').delete().eq('id', id).eq('organization_id', currentOrganization.id);
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete');
    }
  };

  const handleToggleActive = async (jobType: JobType) => {
    try {
      const { error } = await supabase.from('job_types').update({ is_active: !jobType.is_active, updated_at: new Date().toISOString() }).eq('id', jobType.id).eq('organization_id', currentOrganization.id);
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to update');
    }
  };

  const handleSaveCategory = async () => {
    if (!categoryName.trim()) { setCategoryError('Name is required'); return; }
    if (!currentOrganization?.id) { setCategoryError('Organization not found'); return; }

    setSavingCategory(true); setCategoryError('');
    try {
      const serviceTypeVal = categoryServiceType || null;
      if (editingCategoryId) {
        const { error } = await supabase.from('job_type_categories')
          .update({ name: categoryName.trim(), color: categoryColor, service_type: serviceTypeVal })
          .eq('id', editingCategoryId)
          .eq('organization_id', currentOrganization.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('job_type_categories').insert({
          name: categoryName.trim(),
          color: categoryColor,
          service_type: serviceTypeVal,
          organization_id: currentOrganization.id,
          sort_order: categories.length,
        });
        if (error) throw error;
      }
      showToast({ message: 'Category saved', type: 'success' });
      resetCategoryForm();
      setScreen('categories');
      fetchData();
    } catch (err: any) {
      setCategoryError(err.message || 'An error occurred');
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!currentOrganization?.id) return;
    try {
      const { error } = await supabase.from('job_type_categories').delete().eq('id', id).eq('organization_id', currentOrganization.id);
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      setCategoryError(err.message || 'Failed to delete');
    }
  };

  const handleEditCategory = (cat: JobTypeCategory) => {
    setEditingCategoryId(cat.id);
    setCategoryName(cat.name);
    setCategoryColor(cat.color || CATEGORY_COLORS[0]);
    setCategoryServiceType(cat.service_type || '');
    setCategoryError('');
    setScreen('category-form');
  };

  const slugify = (s: string) =>
    s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

  const handleSavePaneType = async () => {
    if (!ptName.trim()) { setPaneTypeError('Name is required'); return; }
    if (!currentOrganization?.id) { setPaneTypeError('Organization not found'); return; }
    setSavingPaneType(true); setPaneTypeError('');
    try {
      const key = editingPaneTypeId
        ? paneTypes.find(p => p.id === editingPaneTypeId)?.key ?? slugify(ptName)
        : slugify(ptName);
      if (editingPaneTypeId) {
        const { error } = await supabase.from('pane_types')
          .update({ name: ptName.trim(), description: ptDescription.trim(), is_active: ptIsActive, updated_at: new Date().toISOString() })
          .eq('id', editingPaneTypeId)
          .eq('organization_id', currentOrganization.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('pane_types').insert({
          organization_id: currentOrganization.id,
          name: ptName.trim(),
          key,
          description: ptDescription.trim(),
          is_active: ptIsActive,
          sort_order: paneTypes.length,
        });
        if (error) throw error;
      }
      showToast({ message: 'Pane type saved', type: 'success' });
      resetPaneTypeForm();
      setScreen('pane-types');
      fetchData();
    } catch (err: any) {
      setPaneTypeError(err.message || 'An error occurred');
    } finally {
      setSavingPaneType(false);
    }
  };

  const handleDeletePaneType = async (id: string) => {
    if (!currentOrganization?.id) return;
    try {
      const { error } = await supabase.from('pane_types').delete().eq('id', id).eq('organization_id', currentOrganization.id);
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      setPaneTypeError(err.message || 'Failed to delete');
    }
  };

  const handleTogglePaneType = async (pt: PaneType) => {
    const newActive = !pt.is_active;
    setPaneTypes(prev => prev.map(p => p.id === pt.id ? { ...p, is_active: newActive } : p));
    try {
      const { error } = await supabase.from('pane_types')
        .update({ is_active: newActive, updated_at: new Date().toISOString() })
        .eq('id', pt.id)
        .eq('organization_id', currentOrganization.id);
      if (error) throw error;
    } catch (err: any) {
      setPaneTypes(prev => prev.map(p => p.id === pt.id ? { ...p, is_active: !newActive } : p));
      setPaneTypeError(err.message || 'Failed to update');
    }
  };

  const handleEditPaneType = (pt: PaneType) => {
    setEditingPaneTypeId(pt.id);
    setPtName(pt.name);
    setPtDescription(pt.description);
    setPtIsActive(pt.is_active);
    setPaneTypeError('');
    setScreen('pane-type-form');
  };

  const getUnitDisplay = (jt: JobType) => {
    if (jt.is_flat_rate) return '/job';
    if (jt.unit_of_measure === 'custom') return `/${jt.custom_unit_label || 'unit'}`;
    return unitOptions.find(u => u.value === jt.unit_of_measure)?.suffix || '/hr';
  };

  const getRateLabel = () => {
    if (isFlatRate) return 'Flat Rate Amount';
    if (unitOfMeasure === 'custom') return `Rate per ${customUnitLabel || 'Unit'}`;
    return `Rate per ${unitOptions.find(u => u.value === unitOfMeasure)?.label || 'Hour'}`;
  };

  const getSelectedUnitLabel = () => {
    if (unitOfMeasure === 'custom') return customUnitLabel || 'Custom';
    return unitOptions.find(u => u.value === unitOfMeasure)?.label || 'Hour';
  };

  const baseRate = parseFloat(hourlyRate) || 0;

  const hasPaneConfig = (jt: JobType) =>
    jt.unit_of_measure === 'pane' && !jt.is_flat_rate &&
    (jt.exterior_split_percent_standard != null || jt.exterior_split_percent_french != null || jt.exterior_split_percent_storm != null);

  const getCategoryForJobType = (jt: JobType) =>
    categories.find(c => c.id === jt.category_id);

  const getHeaderTitle = () => {
    if (screen === 'global-pane-pricing') return 'Global Pane Pricing';
    if (screen === 'pane-pricing') {
      const jt = jobTypes.find(j => j.id === pricingJobTypeId);
      return jt ? `${jt.name} — Pane Pricing` : 'Pane Pricing';
    }
    if (screen === 'form') return editingId ? 'Edit Job Type' : 'Add Job Type';
    if (screen === 'categories') return 'Categories';
    if (screen === 'category-form') return editingCategoryId ? 'Edit Category' : 'Add Category';
    if (screen === 'pane-types') return 'Pane Types';
    if (screen === 'pane-type-form') return editingPaneTypeId ? 'Edit Pane Type' : 'Add Pane Type';
    return 'Job Types';
  };

  const openPanePricingForJobType = (jt: JobType) => {
    setPricingJobTypeId(jt.id);
    const stdExt = pctToStr(jt.exterior_split_percent_standard ?? jt.exterior_pct_standard);
    const stdInt = pctToStr((jt as any).interior_split_percent_standard);
    setStandardPricing({ exteriorPct: stdExt, interiorPct: stdInt !== '' ? stdInt : (stdExt !== '' ? String(100 - parseInt(stdExt)) : ''), pricePerPane: priceToStr(jt.price_per_pane_standard) });
    const frExt = pctToStr(jt.exterior_split_percent_french ?? jt.exterior_pct_french);
    const frInt = pctToStr((jt as any).interior_split_percent_french);
    setFrenchPricing({ exteriorPct: frExt, interiorPct: frInt !== '' ? frInt : (frExt !== '' ? String(100 - parseInt(frExt)) : ''), pricePerPane: priceToStr(jt.price_per_pane_french) });
    const stExt = pctToStr(jt.exterior_split_percent_storm);
    const stInt = pctToStr((jt as any).interior_split_percent_storm);
    setStormPricing({ exteriorPct: stExt, interiorPct: stInt !== '' ? stInt : (stExt !== '' ? String(100 - parseInt(stExt)) : ''), pricePerPane: priceToStr(jt.price_per_pane_storm) });
    const skExt = pctToStr(jt.exterior_split_percent_skylights ?? null);
    const skInt = pctToStr(jt.interior_split_percent_skylights ?? null);
    setSkylightsPricing({ exteriorPct: skExt, interiorPct: skInt !== '' ? skInt : (skExt !== '' ? String(100 - parseInt(skExt)) : ''), pricePerPane: priceToStr(jt.price_per_pane_skylights) });

    const rates = jt.pane_rates || {};
    const dynamicState: Record<string, PanePricingState> = {};
    const legacyKeys = ['standard', 'french', 'storm', 'skylights'];    paneTypes.filter(pt => pt.is_active && !legacyKeys.includes(pt.key)).forEach(pt => {
      const priceVal = rates[`${pt.key}_price`] ?? rates[pt.key] ?? null;
      const extVal = rates[`${pt.key}_exterior_pct`] ?? null;
      const intVal = rates[`${pt.key}_interior_pct`] ?? null;
      dynamicState[pt.key] = {
        pricePerPane: priceToStr(priceVal),
        exteriorPct: pctToStr(extVal),
        interiorPct: pctToStr(intVal),
      };
    });
    setDynamicPanePricing(dynamicState);

    setHourlyRate(String(jt.hourly_rate));
    setScreen('pane-pricing');
  };

  const handleSavePanePricing = async () => {
    if (!pricingJobTypeId || !currentOrganization?.id) return;
    setSavingPricing(true);
    try {
      const pricingJobType = jobTypes.find(j => j.id === pricingJobTypeId);
      const existingRates = pricingJobType?.pane_rates || {};
      const updatedRates: Record<string, number> = { ...existingRates };

      Object.entries(dynamicPanePricing).forEach(([key, state]) => {
        const price = parsePrice(state.pricePerPane);
        const ext = parsePct(state.exteriorPct);
        const int = parsePct(state.interiorPct);
        if (price != null) updatedRates[`${key}_price`] = price;
        else { delete updatedRates[`${key}_price`]; delete updatedRates[key]; }
        if (ext != null) updatedRates[`${key}_exterior_pct`] = ext;
        else delete updatedRates[`${key}_exterior_pct`];
        if (int != null) updatedRates[`${key}_interior_pct`] = int;
        else delete updatedRates[`${key}_interior_pct`];
      });

      const { error } = await supabase.from('job_types').update({
        exterior_split_percent_standard: parsePct(standardPricing.exteriorPct),
        exterior_split_percent_french: parsePct(frenchPricing.exteriorPct),
        exterior_split_percent_storm: parsePct(stormPricing.exteriorPct),
        exterior_split_percent_skylights: parsePct(skylightsPricing.exteriorPct),
        interior_split_percent_standard: parsePct(standardPricing.interiorPct),
        interior_split_percent_french: parsePct(frenchPricing.interiorPct),
        interior_split_percent_storm: parsePct(stormPricing.interiorPct),
        interior_split_percent_skylights: parsePct(skylightsPricing.interiorPct),
        price_per_pane_standard: parsePrice(standardPricing.pricePerPane),
        price_per_pane_french: parsePrice(frenchPricing.pricePerPane),
        price_per_pane_storm: parsePrice(stormPricing.pricePerPane),
        price_per_pane_skylights: parsePrice(skylightsPricing.pricePerPane),
        exterior_pct_standard: parsePct(standardPricing.exteriorPct),
        exterior_pct_french: parsePct(frenchPricing.exteriorPct),
        pane_rates: Object.keys(updatedRates).length > 0 ? updatedRates : null,
        updated_at: new Date().toISOString(),
      }).eq('id', pricingJobTypeId).eq('organization_id', currentOrganization.id);
      if (error) throw error;
      showToast({ message: 'Pane pricing saved', type: 'success' });
      setPricingJobTypeId(null);
      setScreen('list');
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to save pane pricing');
    } finally {
      setSavingPricing(false);
    }
  };

  const handleSaveGlobalPanePricing = async () => {
    if (!currentOrganization?.id) return;
    setSavingGlobalPricing(true);
    try {
      const dynamicRates: Record<string, number> = {};
      Object.entries(globalDynamicPanePricing).forEach(([key, state]) => {
        const price = parsePrice(state.pricePerPane);
        const ext = parsePct(state.exteriorPct);
        const int = parsePct(state.interiorPct);
        if (price != null) dynamicRates[`${key}_price`] = price;
        if (ext != null) dynamicRates[`${key}_exterior_pct`] = ext;
        if (int != null) dynamicRates[`${key}_interior_pct`] = int;
      });

      const globalData = {
        organization_id: currentOrganization.id,
        price_per_pane_standard: parsePrice(globalStandardPricing.pricePerPane),
        price_per_pane_french: parsePrice(globalFrenchPricing.pricePerPane),
        price_per_pane_storm: parsePrice(globalStormPricing.pricePerPane),
        price_per_pane_skylights: parsePrice(globalSkylightsPricing.pricePerPane),
        exterior_split_percent_standard: parsePct(globalStandardPricing.exteriorPct),
        exterior_split_percent_french: parsePct(globalFrenchPricing.exteriorPct),
        exterior_split_percent_storm: parsePct(globalStormPricing.exteriorPct),
        exterior_split_percent_skylights: parsePct(globalSkylightsPricing.exteriorPct),
        interior_split_percent_standard: parsePct(globalStandardPricing.interiorPct),
        interior_split_percent_french: parsePct(globalFrenchPricing.interiorPct),
        interior_split_percent_storm: parsePct(globalStormPricing.interiorPct),
        interior_split_percent_skylights: parsePct(globalSkylightsPricing.interiorPct),
        dynamic_pane_rates: Object.keys(dynamicRates).length > 0 ? dynamicRates : null,
        updated_at: new Date().toISOString(),
      };

      if (globalPricingId) {
        const { error } = await supabase.from('organization_pane_pricing')
          .update(globalData)
          .eq('id', globalPricingId)
          .eq('organization_id', currentOrganization.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('organization_pane_pricing')
          .insert(globalData)
          .select('id')
          .maybeSingle();
        if (error) throw error;
        if (data) setGlobalPricingId(data.id);
      }

      const paneJobTypes = jobTypes.filter(jt =>
        (jt.unit_of_measure === 'pane' && !jt.is_flat_rate) || isWindowRelatedJob(jt)
      );

      if (paneJobTypes.length > 0) {
        const jobUpdateData: any = {
          price_per_pane_standard: parsePrice(globalStandardPricing.pricePerPane),
          price_per_pane_french: parsePrice(globalFrenchPricing.pricePerPane),
          price_per_pane_storm: parsePrice(globalStormPricing.pricePerPane),
          price_per_pane_skylights: parsePrice(globalSkylightsPricing.pricePerPane),
          exterior_split_percent_standard: parsePct(globalStandardPricing.exteriorPct),
          exterior_split_percent_french: parsePct(globalFrenchPricing.exteriorPct),
          exterior_split_percent_storm: parsePct(globalStormPricing.exteriorPct),
          exterior_split_percent_skylights: parsePct(globalSkylightsPricing.exteriorPct),
          interior_split_percent_standard: parsePct(globalStandardPricing.interiorPct),
          interior_split_percent_french: parsePct(globalFrenchPricing.interiorPct),
          interior_split_percent_storm: parsePct(globalStormPricing.interiorPct),
          interior_split_percent_skylights: parsePct(globalSkylightsPricing.interiorPct),
          exterior_pct_standard: parsePct(globalStandardPricing.exteriorPct),
          exterior_pct_french: parsePct(globalFrenchPricing.exteriorPct),
          pane_rates: Object.keys(dynamicRates).length > 0 ? dynamicRates : null,
          updated_at: new Date().toISOString(),
        };

        const updatePromises = paneJobTypes.map(jt =>
          supabase.from('job_types')
            .update(jobUpdateData)
            .eq('id', jt.id)
            .eq('organization_id', currentOrganization.id)
        );
        await Promise.all(updatePromises);
      }

      showToast({ message: `Pane pricing saved${paneJobTypes.length > 0 ? ` and applied to ${paneJobTypes.length} job type${paneJobTypes.length !== 1 ? 's' : ''}` : ''}`, type: 'success' });
      setScreen('list');
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to save global pane pricing');
    } finally {
      setSavingGlobalPricing(false);
    }
  };

  const openGlobalPanePricing = () => {
    setScreen('global-pane-pricing');
  };

  const handleHeaderBack = () => {
    if (screen === 'global-pane-pricing') { setScreen('list'); return; }
    if (screen === 'pane-pricing') { setPricingJobTypeId(null); setScreen('list'); return; }
    if (screen === 'form') { resetForm(); setScreen('list'); return; }
    if (screen === 'category-form') { resetCategoryForm(); setScreen('categories'); return; }
    if (screen === 'categories') { setScreen('list'); return; }
    if (screen === 'pane-types') { setScreen(paneTypesReturnTo); return; }
    if (screen === 'pane-type-form') { resetPaneTypeForm(); setScreen('pane-types'); return; }
    handleClose();
  };

  const groupedByCategory = () => {
    const uncategorized = jobTypes.filter(jt => !jt.category_id);
    const byCat = categories.map(cat => ({
      category: cat,
      items: jobTypes.filter(jt => jt.category_id === cat.id),
    })).filter(g => g.items.length > 0);
    return { byCat, uncategorized };
  };

  const renderPanePriceSummary = (jt: JobType) => {
    const hasPanePricing = (jt.unit_of_measure === 'pane' && !jt.is_flat_rate) || isWindowRelatedJob(jt);
    if (!hasPanePricing) return null;
    const hasPriceData = jt.price_per_pane_standard != null || jt.price_per_pane_french != null || jt.price_per_pane_storm != null || (jt.pane_rates && Object.keys(jt.pane_rates).length > 0);
    if (!hasPriceData && jt.unit_of_measure !== 'pane') return null;

    const legacyPriceMap: Record<string, { price: number; ext: number }> = {
      standard: { price: jt.price_per_pane_standard ?? 0, ext: jt.exterior_split_percent_standard ?? 100 },
      french: { price: jt.price_per_pane_french ?? 0, ext: jt.exterior_split_percent_french ?? 100 },
      storm: { price: jt.price_per_pane_storm ?? 0, ext: jt.exterior_split_percent_storm ?? 100 },
    };
    const rates = jt.pane_rates || {};
    const summaryPaneTypes = paneTypes.filter(pt => pt.is_active);
    const summaryTypes = summaryPaneTypes.length > 0 ? summaryPaneTypes : [
      { key: 'standard', name: 'Std' }, { key: 'french', name: 'Fr' }, { key: 'storm', name: 'Storm' },
    ];

    return (
      <View style={styles.panePriceSummary}>
        {summaryTypes.slice(0, 4).map(pt => {
          const legacy = legacyPriceMap[pt.key];
          const price = legacy ? legacy.price : (rates[`${pt.key}_price`] ?? rates[pt.key] ?? 0);
          const ext = legacy ? legacy.ext : (rates[`${pt.key}_exterior_pct`] ?? 100);
          const shortName = pt.name.length > 6 ? pt.name.slice(0, 5) + '.' : pt.name;
          return (
            <View key={pt.key} style={[styles.panePriceChip, { backgroundColor: colors.primaryLight }]}>
              <Text style={[styles.panePriceChipLabel, { color: colors.primary }]}>{shortName}</Text>
              <Text style={[styles.panePriceChipValue, { color: colors.primary }]}>${price.toFixed(2)}</Text>
              <Text style={[styles.panePriceChipSplit, { color: colors.primary }]}>{ext}/{100 - ext}</Text>
            </View>
          );
        })}
        {summaryTypes.length > 4 && (
          <View style={[styles.panePriceChip, { backgroundColor: colors.primaryLight }]}>
            <Text style={[styles.panePriceChipLabel, { color: colors.primary }]}>+{summaryTypes.length - 4}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderJobTypeCard = (jt: JobType) => {
    const cat = getCategoryForJobType(jt);
    const isPaneType = (jt.unit_of_measure === 'pane' && !jt.is_flat_rate) || isWindowRelatedJob(jt);
    return (
      <View key={jt.id} style={[styles.jobTypeCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }, !jt.is_active && styles.inactiveCard]}>
        <View style={styles.jobTypeCardTop}>
          <View style={styles.jobTypeInfo}>
            <View style={styles.jobTypeNameRow}>
              <Text style={[styles.jobTypeName, { color: jt.is_active ? colors.text : colors.textSecondary }]}>{jt.name}</Text>
              {cat && (
                <View style={[styles.catBadge, { backgroundColor: cat.color + '22' }]}>
                  <View style={[styles.catDot, { backgroundColor: cat.color }]} />
                  <Text style={[styles.catBadgeText, { color: cat.color }]}>{cat.name}</Text>
                </View>
              )}
            </View>
            {jt.description ? <Text style={[styles.jobTypeDescription, { color: colors.textSecondary }]}>{jt.description}</Text> : null}
            <Text style={[styles.jobTypeRate, { color: colors.primary }]}>${jt.hourly_rate.toFixed(2)}{getUnitDisplay(jt)}</Text>
          </View>
          {isAdminOrManager && (
            <View style={styles.jobTypeActions}>
              <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.inputBackground }]} onPress={() => handleToggleActive(jt)}>
                <Check size={16} color={jt.is_active ? colors.success : colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.inputBackground }]} onPress={() => handleEdit(jt)}>
                <Edit2 size={16} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.inputBackground }]} onPress={() => handleDelete(jt.id)}>
                <Trash2 size={16} color={colors.error} />
              </TouchableOpacity>
            </View>
          )}
        </View>
        {isPaneType && (
          <>
            {renderPanePriceSummary(jt)}
            {isAdminOrManager && (
              <TouchableOpacity
                style={[styles.panePricingButton, { backgroundColor: colors.primaryLight, borderColor: colors.primary + '30' }]}
                onPress={() => openPanePricingForJobType(jt)}
              >
                <Settings size={14} color={colors.primary} />
                <Text style={[styles.panePricingButtonText, { color: colors.primary }]}>Edit Pane Pricing</Text>
                <ChevronRight size={14} color={colors.primary} />
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.modal, { backgroundColor: colors.surface }]}>

          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerLeft}>
              {screen !== 'list' && (
                <TouchableOpacity onPress={handleHeaderBack} style={styles.backBtn}>
                  <ChevronLeft size={22} color={colors.primary} />
                </TouchableOpacity>
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.title, { color: colors.text }]}>{getHeaderTitle()}</Text>
                {isAdminOrManager && screen === 'list' && (
                  <View style={styles.adminBadge}>
                    <ShieldCheck size={11} color="#1B4D6E" />
                    <Text style={styles.adminBadgeText}>Admin Management</Text>
                  </View>
                )}
              </View>
            </View>
            <View style={styles.headerRight}>
              {screen === 'list' && isAdminOrManager && (
                <>
                  <TouchableOpacity onPress={openGlobalPanePricing} style={[styles.headerIconBtn, { backgroundColor: colors.inputBackground }]}>
                    <DollarSign size={18} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setPaneTypesReturnTo('list'); setScreen('pane-types'); }} style={[styles.headerIconBtn, { backgroundColor: colors.inputBackground }]}>
                    <Grid3x3 size={18} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setScreen('categories')} style={[styles.headerIconBtn, { backgroundColor: colors.inputBackground }]}>
                    <Tag size={18} color={colors.primary} />
                  </TouchableOpacity>
                </>
              )}
              {screen === 'categories' && isAdminOrManager && (
                <TouchableOpacity onPress={() => { resetCategoryForm(); setScreen('category-form'); }} style={[styles.headerIconBtn, { backgroundColor: colors.inputBackground }]}>
                  <Plus size={18} color={colors.primary} />
                </TouchableOpacity>
              )}
              {screen === 'pane-types' && isAdminOrManager && (
                <TouchableOpacity onPress={() => { resetPaneTypeForm(); setScreen('pane-type-form'); }} style={[styles.headerIconBtn, { backgroundColor: colors.inputBackground }]}>
                  <Plus size={18} color={colors.primary} />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={handleClose}>
                <X size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {error ? (
            <View style={[styles.errorContainer, { backgroundColor: colors.errorBackground }]}>
              <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
            </View>
          ) : null}

          {/* ── LIST SCREEN ── */}
          {screen === 'list' && (
            <>
              {!isAdminOrManager && (
                <View style={[styles.readOnlyBanner, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                  <ShieldCheck size={15} color={colors.textSecondary} />
                  <Text style={[styles.readOnlyBannerText, { color: colors.textSecondary }]}>
                    View only — contact your admin to make changes
                  </Text>
                </View>
              )}
              <ScrollView style={styles.content}>
                {loading ? (
                  <ActivityIndicator color={colors.primary} style={styles.loader} />
                ) : (() => {
                  const { byCat, uncategorized } = groupedByCategory();
                  return (
                    <>
                      {byCat.map(({ category, items }) => (
                        <View key={category.id} style={styles.categorySection}>
                          <View style={styles.categorySectionHeader}>
                            <View style={[styles.categorySectionDot, { backgroundColor: category.color }]} />
                            <Text style={[styles.categorySectionTitle, { color: colors.text }]}>{category.name}</Text>
                            <Text style={[styles.categorySectionCount, { color: colors.textSecondary }]}>{items.length}</Text>
                          </View>
                          {items.map(jt => renderJobTypeCard(jt))}
                        </View>
                      ))}
                      {uncategorized.length > 0 && (
                        <View style={styles.categorySection}>
                          {byCat.length > 0 && (
                            <View style={styles.categorySectionHeader}>
                              <View style={[styles.categorySectionDot, { backgroundColor: colors.textSecondary }]} />
                              <Text style={[styles.categorySectionTitle, { color: colors.textSecondary }]}>Uncategorized</Text>
                              <Text style={[styles.categorySectionCount, { color: colors.textSecondary }]}>{uncategorized.length}</Text>
                            </View>
                          )}
                          {uncategorized.map(jt => renderJobTypeCard(jt))}
                        </View>
                      )}
                      {jobTypes.length === 0 && (
                        <View style={styles.emptyContainer}>
                          <View style={[styles.emptyIconWrap, { backgroundColor: colors.primaryLight }]}>
                            <Briefcase size={32} color={colors.primary} />
                          </View>
                          <Text style={[styles.emptyText, { color: colors.text }]}>
                            {isAdminOrManager ? 'No services added yet' : 'No services configured'}
                          </Text>
                          <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                            {isAdminOrManager
                              ? 'Add your first service type to start creating invoices, scheduling jobs, and tracking time by service.'
                              : 'Your organization admin has not added any services yet.'}
                          </Text>
                        </View>
                      )}
                    </>
                  );
                })()}
              </ScrollView>
              {isAdminOrManager && (
                <View style={[styles.footer, { borderTopColor: colors.border }]}>
                  <TouchableOpacity style={[styles.addButton, { overflow: 'hidden' }]} onPress={handleAddNew}>
                    <LinearGradient colors={['#1B4D6E', '#245d82']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.addButtonGradient}>
                      <Plus size={20} color="#fff" />
                      <Text style={styles.addButtonText}>Add Job Type</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}

          {/* ── CATEGORIES SCREEN ── */}
          {screen === 'categories' && (
            <>
              {categoryError ? (
                <View style={[styles.errorContainer, { backgroundColor: colors.errorBackground }]}>
                  <Text style={[styles.errorText, { color: colors.error }]}>{categoryError}</Text>
                </View>
              ) : null}
              <ScrollView style={styles.content}>
                <View style={[styles.infoBox, { backgroundColor: colors.primaryLight }]}>
                  <Info size={14} color={colors.primary} />
                  <Text style={[styles.infoBoxText, { color: colors.primary }]}>
                    Categories group your job types so you can filter clients by service type. Assign a category to each job type when creating or editing it.
                  </Text>
                </View>
                {loading ? (
                  <ActivityIndicator color={colors.primary} style={styles.loader} />
                ) : (
                  <>
                    {categories.map(cat => {
                      const count = jobTypes.filter(jt => jt.category_id === cat.id).length;
                      return (
                        <View key={cat.id} style={[styles.categoryCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                          <View style={[styles.categoryColorBar, { backgroundColor: cat.color }]} />
                          <View style={styles.categoryCardInfo}>
                            <Text style={[styles.categoryCardName, { color: colors.text }]}>{cat.name}</Text>
                            <Text style={[styles.categoryCardCount, { color: colors.textSecondary }]}>
                              {count} job type{count !== 1 ? 's' : ''}
                              {cat.service_type && cat.service_type !== 'general' ? ` · ${SERVICE_TYPE_OPTIONS.find(o => o.value === cat.service_type)?.label || cat.service_type}` : ''}
                            </Text>
                          </View>
                          {isAdminOrManager && (
                            <View style={styles.jobTypeActions}>
                              <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.inputBackground }]} onPress={() => handleEditCategory(cat)}>
                                <Edit2 size={16} color={colors.primary} />
                              </TouchableOpacity>
                              <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.inputBackground }]} onPress={() => handleDeleteCategory(cat.id)}>
                                <Trash2 size={16} color={colors.error} />
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      );
                    })}
                    {categories.length === 0 && (
                      <View style={styles.emptyContainer}>
                        <FolderOpen size={40} color={colors.textSecondary} style={{ marginBottom: 12 }} />
                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No categories yet</Text>
                        <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>Add categories like "Window Cleaning" or "Gutter Cleaning" to organize job types</Text>
                      </View>
                    )}
                  </>
                )}
              </ScrollView>
              {isAdminOrManager && (
                <View style={[styles.footer, { borderTopColor: colors.border }]}>
                  <TouchableOpacity style={[styles.addButton, { overflow: 'hidden' }]} onPress={() => { resetCategoryForm(); setScreen('category-form'); }}>
                    <LinearGradient colors={['#1B4D6E', '#245d82']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.addButtonGradient}>
                      <Plus size={20} color="#fff" />
                      <Text style={styles.addButtonText}>Add Category</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}

          {/* ── CATEGORY FORM SCREEN ── */}
          {screen === 'category-form' && (
            <>
              {categoryError ? (
                <View style={[styles.errorContainer, { backgroundColor: colors.errorBackground }]}>
                  <Text style={[styles.errorText, { color: colors.error }]}>{categoryError}</Text>
                </View>
              ) : null}
              <ScrollView style={styles.content}>
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.text }]}>Category Name *</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                    value={categoryName}
                    onChangeText={setCategoryName}
                    placeholder="e.g., Window Cleaning"
                    placeholderTextColor={colors.textSecondary}
                    editable={!savingCategory}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.text }]}>Color</Text>
                  <View style={styles.colorGrid}>
                    {CATEGORY_COLORS.map(c => (
                      <TouchableOpacity
                        key={c}
                        style={[styles.colorSwatch, { backgroundColor: c }, categoryColor === c && styles.colorSwatchSelected]}
                        onPress={() => setCategoryColor(c)}
                      >
                        {categoryColor === c && <Check size={14} color="#fff" />}
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <View style={[styles.categoryPreview, { backgroundColor: categoryColor + '15', borderColor: categoryColor + '40' }]}>
                  <View style={[styles.categoryPreviewDot, { backgroundColor: categoryColor }]} />
                  <Text style={[styles.categoryPreviewText, { color: categoryColor }]}>{categoryName || 'Category Preview'}</Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.text }]}>Service Type</Text>
                  <Text style={[styles.helperText, { color: colors.textSecondary }]}>
                    Sets the specialized UI used when estimating or invoicing jobs in this category.
                  </Text>
                  <TouchableOpacity
                    style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                    onPress={() => setShowServiceTypePicker(v => !v)}
                    disabled={savingCategory}
                  >
                    <Text style={{ color: categoryServiceType ? colors.text : colors.textSecondary, fontSize: 15 }}>
                      {SERVICE_TYPE_OPTIONS.find(o => o.value === categoryServiceType)?.label || 'General (no special UI)'}
                    </Text>
                    <ChevronDown size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                  {showServiceTypePicker && (
                    <View style={[styles.pickerDropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      {SERVICE_TYPE_OPTIONS.map(opt => (
                        <TouchableOpacity
                          key={opt.value}
                          style={[styles.pickerDropdownItem, { borderBottomColor: colors.border }]}
                          onPress={() => { setCategoryServiceType(opt.value); setShowServiceTypePicker(false); }}
                        >
                          <Text style={{ color: colors.text, fontSize: 15 }}>{opt.label}</Text>
                          {categoryServiceType === opt.value && <Check size={16} color={colors.primary} />}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              </ScrollView>
              <View style={[styles.footer, { borderTopColor: colors.border }]}>
                <View style={styles.formButtons}>
                  <TouchableOpacity style={[styles.cancelFormButton, { borderColor: colors.border }]} onPress={() => { resetCategoryForm(); setScreen('categories'); }} disabled={savingCategory}>
                    <Text style={[styles.cancelFormButtonText, { color: colors.textSecondary }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.saveFormButton, { overflow: 'hidden' }, savingCategory && styles.buttonDisabled]} onPress={handleSaveCategory} disabled={savingCategory}>
                    <LinearGradient colors={['#1B4D6E', '#245d82']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.saveFormButtonGradient}>
                      {savingCategory ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveFormButtonText}>Save</Text>}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}

          {/* ── FORM SCREEN ── */}
          {screen === 'form' && (
            <>
              <ScrollView style={styles.content}>
                <CollapsibleField
                  label="Name"
                  fieldId="name"
                  activeFieldId={activeFieldId}
                  onToggle={toggleField}
                  displayValue={name || undefined}
                  required
                  startExpanded={!editingId}
                >
                  <TextInput style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]} value={name} onChangeText={setName} placeholder="e.g., Residential Windows" placeholderTextColor={colors.textSecondary} editable={!saving} />
                </CollapsibleField>

                <CollapsibleField
                  label="Category"
                  fieldId="category"
                  activeFieldId={activeFieldId}
                  onToggle={toggleField}
                  displayValue={selectedCategoryId ? (categories.find(c => c.id === selectedCategoryId)?.name || undefined) : undefined}
                >
                  <TouchableOpacity
                    style={[styles.picker, { backgroundColor: colors.inputBackground }]}
                    onPress={() => setShowCategoryPicker(!showCategoryPicker)}
                    disabled={saving}
                  >
                    {selectedCategoryId ? (() => {
                      const cat = categories.find(c => c.id === selectedCategoryId);
                      return cat ? (
                        <View style={styles.selectedCategoryDisplay}>
                          <View style={[styles.catDot, { backgroundColor: cat.color }]} />
                          <Text style={[styles.pickerText, { color: colors.text }]}>{cat.name}</Text>
                        </View>
                      ) : <Text style={[styles.pickerText, { color: colors.textSecondary }]}>Select category</Text>;
                    })() : (
                      <Text style={[styles.pickerText, { color: colors.textSecondary }]}>No category</Text>
                    )}
                    <ChevronDown size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                  {showCategoryPicker && (
                    <View style={[styles.dropdownList, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                      <TouchableOpacity
                        style={[styles.dropdownItem, { borderBottomColor: colors.border }]}
                        onPress={() => { setSelectedCategoryId(null); setShowCategoryPicker(false); toggleField('category'); }}
                      >
                        <Text style={[styles.dropdownItemText, { color: colors.textSecondary }]}>No category</Text>
                        {!selectedCategoryId && <Check size={16} color={colors.primary} />}
                      </TouchableOpacity>
                      {categories.map(cat => (
                        <TouchableOpacity
                          key={cat.id}
                          style={[styles.dropdownItem, { borderBottomColor: colors.border }]}
                          onPress={() => { setSelectedCategoryId(cat.id); setShowCategoryPicker(false); toggleField('category'); }}
                        >
                          <View style={styles.selectedCategoryDisplay}>
                            <View style={[styles.catDot, { backgroundColor: cat.color }]} />
                            <Text style={[styles.dropdownItemText, { color: colors.text }]}>{cat.name}</Text>
                          </View>
                          {selectedCategoryId === cat.id && <Check size={16} color={colors.primary} />}
                        </TouchableOpacity>
                      ))}
                      {categories.length === 0 && (
                        <View style={{ padding: 12 }}>
                          <Text style={[styles.dropdownItemText, { color: colors.textSecondary }]}>No categories yet — create them via the tag icon</Text>
                        </View>
                      )}
                    </View>
                  )}
                </CollapsibleField>

                <CollapsibleField
                  label="Service Description"
                  fieldId="description"
                  activeFieldId={activeFieldId}
                  onToggle={toggleField}
                  displayValue={description ? (description.length > 40 ? description.substring(0, 40) + '...' : description) : undefined}
                >
                  <TextInput style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]} value={description} onChangeText={setDescription} placeholder="Describe what this service includes..." placeholderTextColor={colors.textSecondary} editable={!saving} multiline numberOfLines={3} />
                </CollapsibleField>

                <CollapsibleField
                  label="Flat Rate"
                  fieldId="flatRate"
                  activeFieldId={activeFieldId}
                  onToggle={toggleField}
                  displayValue={isFlatRate ? 'Yes' : 'No'}
                >
                  <View style={styles.switchRow}>
                    <View>
                      <Text style={[styles.label, { color: colors.text, marginBottom: 0 }]}>Flat Rate</Text>
                      <Text style={[styles.helperText, { color: colors.textSecondary }]}>Set as fixed price per job</Text>
                    </View>
                    <Switch value={isFlatRate} onValueChange={v => { setIsFlatRate(v); setUnitOfMeasure(v ? 'flat_rate' : 'hour'); }} trackColor={{ false: colors.border, true: colors.primary }} disabled={saving} />
                  </View>
                </CollapsibleField>

                {!isFlatRate && (
                  <CollapsibleField
                    label="Unit of Measure"
                    fieldId="unit"
                    activeFieldId={activeFieldId}
                    onToggle={toggleField}
                    displayValue={getSelectedUnitLabel()}
                  >
                    <TouchableOpacity style={[styles.picker, { backgroundColor: colors.inputBackground }]} onPress={() => setShowUnitPicker(!showUnitPicker)} disabled={saving}>
                      <Text style={[styles.pickerText, { color: colors.text }]}>{getSelectedUnitLabel()}</Text>
                      <ChevronDown size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                    {showUnitPicker && (
                      <View style={[styles.dropdownList, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                        {unitOptions.map(opt => (
                          <TouchableOpacity key={opt.value} style={[styles.dropdownItem, { borderBottomColor: colors.border }]} onPress={() => { setUnitOfMeasure(opt.value); if (opt.value !== 'custom') setCustomUnitLabel(''); setShowUnitPicker(false); toggleField('unit'); }}>
                            <Text style={[styles.dropdownItemText, { color: colors.text }]}>{opt.label}</Text>
                            {unitOfMeasure === opt.value && <Check size={16} color={colors.primary} />}
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                    {unitOfMeasure === 'custom' && (
                      <View style={[styles.inputGroup, { marginTop: 8 }]}>
                        <Text style={[styles.label, { color: colors.text }]}>Custom Unit Label *</Text>
                        <TextInput style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]} value={customUnitLabel} onChangeText={setCustomUnitLabel} placeholder="e.g., Yard, Window" placeholderTextColor={colors.textSecondary} editable={!saving} />
                      </View>
                    )}
                  </CollapsibleField>
                )}

                <CollapsibleField
                  label="Rate"
                  fieldId="rate"
                  activeFieldId={activeFieldId}
                  onToggle={toggleField}
                  displayValue={hourlyRate ? `$${parseFloat(hourlyRate).toFixed(2)}` : undefined}
                >
                  <Text style={[styles.label, { color: colors.text }]}>{getRateLabel()}</Text>
                  <View style={[styles.inputRow, { backgroundColor: colors.inputBackground }]}>
                    <Text style={[styles.inputPrefix, { color: colors.textSecondary }]}>$</Text>
                    <TextInput style={[styles.inputInner, { color: colors.text }]} value={hourlyRate} onChangeText={setHourlyRate} placeholder="0.00" keyboardType="decimal-pad" placeholderTextColor={colors.textSecondary} editable={!saving} />
                  </View>
                </CollapsibleField>

                <CollapsibleField
                  label="Active"
                  fieldId="active"
                  activeFieldId={activeFieldId}
                  onToggle={toggleField}
                  displayValue={isActive ? 'Yes' : 'No'}
                >
                  <View style={styles.switchRow}>
                    <Text style={[styles.label, { color: colors.text, marginBottom: 0 }]}>Active</Text>
                    <Switch value={isActive} onValueChange={setIsActive} trackColor={{ false: colors.border, true: colors.primary }} disabled={saving} />
                  </View>
                </CollapsibleField>

                {!isFlatRate && (unitOfMeasure === 'pane' || isWindowRelatedJob({ unit_of_measure: unitOfMeasure, name })) && (
                  <CollapsibleField
                    label="Service Scope"
                    fieldId="scopeOptions"
                    activeFieldId={activeFieldId}
                    onToggle={toggleField}
                    displayValue={(scopeOptions ?? 'both') === 'exterior_only' ? 'Exterior Only' : 'Full Service'}
                  >
                    <Text style={[styles.helperText, { color: colors.textSecondary, marginBottom: 10 }]}>
                      Choose whether this window cleaning service includes interior cleaning or exterior only.
                    </Text>
                    {([
                      { value: 'both' as const, label: 'Full Service', sub: 'Includes both interior and exterior window cleaning' },
                      { value: 'exterior_only' as const, label: 'Exterior Only', sub: 'Exterior windows only — no interior cleaning' },
                    ]).map(opt => {
                      const active = (scopeOptions ?? 'both') === opt.value;
                      return (
                        <TouchableOpacity
                          key={opt.value}
                          onPress={() => setScopeOptions(opt.value)}
                          disabled={saving}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            padding: 12,
                            borderRadius: 10,
                            marginBottom: 8,
                            borderWidth: 1.5,
                            borderColor: active ? colors.primary : colors.border,
                            backgroundColor: active ? colors.primaryLight : colors.inputBackground,
                          }}
                        >
                          <View style={{
                            width: 20, height: 20, borderRadius: 10, borderWidth: 2,
                            borderColor: active ? colors.primary : colors.border,
                            backgroundColor: active ? colors.primary : 'transparent',
                            marginRight: 12, alignItems: 'center', justifyContent: 'center',
                          }}>
                            {active && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' }} />}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 14, fontWeight: '600', color: active ? colors.primary : colors.text }}>{opt.label}</Text>
                            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 1 }}>{opt.sub}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </CollapsibleField>
                )}

                {(unitOfMeasure === 'pane' || isWindowRelatedJob({ unit_of_measure: isFlatRate ? 'flat_rate' : unitOfMeasure, name })) && !isFlatRate && (() => {
                  const legacyKeys = ['standard', 'french', 'storm', 'skylights'];                  const formActivePaneTypes = paneTypes.filter(pt => pt.is_active);
                  const formDisplayPaneTypes = formActivePaneTypes.length > 0
                    ? formActivePaneTypes
                    : [
                        { id: '_std', name: 'Standard', key: 'standard', is_active: true, description: '', sort_order: 0 },
                        { id: '_fr', name: 'French', key: 'french', is_active: true, description: '', sort_order: 1 },
                        { id: '_st', name: 'Storm', key: 'storm', is_active: true, description: '', sort_order: 2 },
                      ];
                  return (
                    <View style={[styles.paneSettingsContainer, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                      <TouchableOpacity
                        style={[styles.paneSettingsHeader, { borderBottomColor: showPaneSettings ? colors.border : 'transparent' }]}
                        onPress={() => setShowPaneSettings(!showPaneSettings)}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Settings size={16} color={colors.primary} />
                          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>Pane Pricing Settings</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          {!showPaneSettings && (
                            <Text style={{ fontSize: 12, color: colors.textSecondary }}>Configure splits & prices</Text>
                          )}
                          {showPaneSettings
                            ? <ChevronDown size={18} color={colors.textSecondary} />
                            : <ChevronRight size={18} color={colors.textSecondary} />
                          }
                        </View>
                      </TouchableOpacity>

                      {showPaneSettings && (
                        <View style={{ padding: 14 }}>
                          <View style={[styles.infoBox, { backgroundColor: colors.primaryLight, marginBottom: 12 }]}>
                            <Info size={14} color={colors.primary} />
                            <Text style={[styles.infoBoxText, { color: colors.primary }]}>
                              Set price and exterior/interior split per pane type. Leaving split blank defaults to 100% exterior.
                            </Text>
                          </View>

                          {formDisplayPaneTypes.map((pt, idx) => {
                            const isLegacy = legacyKeys.includes(pt.key);
                            if (isLegacy) {
                              const legacyMap: Record<string, { state: PanePricingState; setter: React.Dispatch<React.SetStateAction<PanePricingState>> }> = {
                                standard: { state: standardPricing, setter: setStandardPricing },
                                french: { state: frenchPricing, setter: setFrenchPricing },
                                storm: { state: stormPricing, setter: setStormPricing },
                                skylights: { state: skylightsPricing, setter: setSkylightsPricing },
                              };
                              const mapping = legacyMap[pt.key];
                              if (!mapping) return null;
                              return (
                                <View key={pt.id}>
                                  {idx > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                                  <PanePricingRow label={pt.name} state={mapping.state} onChange={(u) => mapping.setter(p => ({ ...p, ...u }))} baseRate={baseRate} colors={colors} />
                                </View>
                              );
                            }
                            const dynState = dynamicPanePricing[pt.key] || { exteriorPct: '', interiorPct: '', pricePerPane: '' };
                            return (
                              <View key={pt.id}>
                                {idx > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                                <PanePricingRow
                                  label={pt.name}
                                  state={dynState}
                                  onChange={u => setDynamicPanePricing(prev => ({ ...prev, [pt.key]: { ...prev[pt.key] || { exteriorPct: '', interiorPct: '', pricePerPane: '' }, ...u } }))}
                                  baseRate={baseRate}
                                  colors={colors}
                                />
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  );
                })()}
              </ScrollView>

              <View style={[styles.footer, { borderTopColor: colors.border }]}>
                <View style={styles.formButtons}>
                  <TouchableOpacity style={[styles.cancelFormButton, { borderColor: colors.border }]} onPress={() => { resetForm(); setScreen('list'); }} disabled={saving}>
                    <Text style={[styles.cancelFormButtonText, { color: colors.textSecondary }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.saveFormButton, { overflow: 'hidden' }, saving && styles.buttonDisabled]} onPress={handleSave} disabled={saving}>
                    <LinearGradient colors={['#1B4D6E', '#245d82']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.saveFormButtonGradient}>
                      {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveFormButtonText}>Save</Text>}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}

          {/* ── PANE TYPES SCREEN ── */}
          {screen === 'pane-types' && (
            <>
              {paneTypeError ? (
                <View style={[styles.errorContainer, { backgroundColor: colors.errorBackground }]}>
                  <Text style={[styles.errorText, { color: colors.error }]}>{paneTypeError}</Text>
                </View>
              ) : null}
              <ScrollView style={styles.content}>
                <View style={[styles.infoBox, { backgroundColor: colors.primaryLight }]}>
                  <Info size={14} color={colors.primary} />
                  <Text style={[styles.infoBoxText, { color: colors.primary }]}>
                    Pane types are used for per-pane pricing, production rates, and client pane counts. Use the eye icon to control which pane types appear on the pricing page. Hidden types won't show in pane pricing settings.
                  </Text>
                </View>
                {loading ? (
                  <ActivityIndicator color={colors.primary} style={styles.loader} />
                ) : (
                  <>
                    {paneTypes.map(pt => (
                      <View key={pt.id} style={[styles.jobTypeCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }, !pt.is_active && styles.inactiveCard]}>
                        <View style={styles.jobTypeInfo}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={[styles.jobTypeName, { color: pt.is_active ? colors.text : colors.textSecondary }]}>{pt.name}</Text>
                            {pt.is_active ? (
                              <View style={{ backgroundColor: colors.success + '18', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                <Text style={{ fontSize: 10, fontWeight: '600', color: colors.success }}>Visible</Text>
                              </View>
                            ) : (
                              <View style={{ backgroundColor: colors.textSecondary + '18', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                <Text style={{ fontSize: 10, fontWeight: '600', color: colors.textSecondary }}>Hidden</Text>
                              </View>
                            )}
                          </View>
                          {pt.description ? <Text style={[styles.jobTypeDescription, { color: colors.textSecondary }]}>{pt.description}</Text> : null}
                          <Text style={[{ fontSize: 11, color: colors.textSecondary, marginTop: 4, fontFamily: 'monospace' }]}>key: {pt.key}</Text>
                        </View>
                        {isAdminOrManager && (
                          <View style={styles.jobTypeActions}>
                            <TouchableOpacity
                              style={[styles.actionButton, { backgroundColor: pt.is_active ? colors.success + '20' : colors.inputBackground, minWidth: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center' }]}
                              onPress={() => handleTogglePaneType(pt)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              {pt.is_active ? <Eye size={18} color={colors.success} /> : <EyeOff size={18} color={colors.textSecondary} />}
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.inputBackground }]} onPress={() => handleEditPaneType(pt)}>
                              <Edit2 size={16} color={colors.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.inputBackground }]} onPress={() => handleDeletePaneType(pt.id)}>
                              <Trash2 size={16} color={colors.error} />
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    ))}
                    {paneTypes.length === 0 && (
                      <View style={styles.emptyContainer}>
                        <Grid3x3 size={40} color={colors.textSecondary} style={{ marginBottom: 12 }} />
                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No pane types yet</Text>
                        <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>Add pane types like "Standard", "French", or "Skylights" to track counts per client</Text>
                      </View>
                    )}
                  </>
                )}
              </ScrollView>
              {isAdminOrManager && (
                <View style={[styles.footer, { borderTopColor: colors.border }]}>
                  <TouchableOpacity style={[styles.addButton, { overflow: 'hidden' }]} onPress={() => { resetPaneTypeForm(); setScreen('pane-type-form'); }}>
                    <LinearGradient colors={['#1B4D6E', '#245d82']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.addButtonGradient}>
                      <Plus size={20} color="#fff" />
                      <Text style={styles.addButtonText}>Add Pane Type</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}

          {/* ── PANE TYPE FORM SCREEN ── */}
          {screen === 'pane-type-form' && (
            <>
              {paneTypeError ? (
                <View style={[styles.errorContainer, { backgroundColor: colors.errorBackground }]}>
                  <Text style={[styles.errorText, { color: colors.error }]}>{paneTypeError}</Text>
                </View>
              ) : null}
              <ScrollView style={styles.content}>
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.text }]}>Name *</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                    value={ptName}
                    onChangeText={setPtName}
                    placeholder="e.g., Skylights"
                    placeholderTextColor={colors.textSecondary}
                    editable={!savingPaneType}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.text }]}>Description</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                    value={ptDescription}
                    onChangeText={setPtDescription}
                    placeholder="Optional hint shown on client card"
                    placeholderTextColor={colors.textSecondary}
                    editable={!savingPaneType}
                  />
                </View>
                <View style={styles.switchRow}>
                  <Text style={[styles.label, { color: colors.text, marginBottom: 0 }]}>Active</Text>
                  <Switch value={ptIsActive} onValueChange={setPtIsActive} trackColor={{ false: colors.border, true: colors.primary }} disabled={savingPaneType} />
                </View>
                {!editingPaneTypeId && ptName.trim() !== '' && (
                  <View style={[styles.infoBox, { backgroundColor: colors.inputBackground }]}>
                    <Info size={14} color={colors.textSecondary} />
                    <Text style={[styles.infoBoxText, { color: colors.textSecondary }]}>
                      This will be saved with the key "{slugify(ptName)}"
                    </Text>
                  </View>
                )}
              </ScrollView>
              <View style={[styles.footer, { borderTopColor: colors.border }]}>
                <View style={styles.formButtons}>
                  <TouchableOpacity style={[styles.cancelFormButton, { borderColor: colors.border }]} onPress={() => { resetPaneTypeForm(); setScreen('pane-types'); }} disabled={savingPaneType}>
                    <Text style={[styles.cancelFormButtonText, { color: colors.textSecondary }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.saveFormButton, { overflow: 'hidden' }, savingPaneType && styles.buttonDisabled]} onPress={handleSavePaneType} disabled={savingPaneType}>
                    <LinearGradient colors={['#1B4D6E', '#245d82']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.saveFormButtonGradient}>
                      {savingPaneType ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveFormButtonText}>Save</Text>}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}

          {/* ── GLOBAL PANE PRICING SCREEN ── */}
          {screen === 'global-pane-pricing' && (() => {
            const legacyKeys = ['standard', 'french', 'storm', 'skylights'];            const gLegacyStateMap: Record<string, { state: PanePricingState; setter: React.Dispatch<React.SetStateAction<PanePricingState>> }> = {
              standard: { state: globalStandardPricing, setter: setGlobalStandardPricing },
              french: { state: globalFrenchPricing, setter: setGlobalFrenchPricing },
              storm: { state: globalStormPricing, setter: setGlobalStormPricing },
              skylights: { state: globalSkylightsPricing, setter: setGlobalSkylightsPricing },
            };
            const activePaneTypes = paneTypes.filter(pt => pt.is_active);
            const displayPaneTypes = activePaneTypes.length > 0
              ? activePaneTypes
              : [
                  { id: '_std', name: 'Standard', key: 'standard', is_active: true, description: '', sort_order: 0 },
                  { id: '_fr', name: 'French', key: 'french', is_active: true, description: '', sort_order: 1 },
                  { id: '_st', name: 'Storm', key: 'storm', is_active: true, description: '', sort_order: 2 },
                ];
            const paneJobCount = jobTypes.filter(jt =>
              (jt.unit_of_measure === 'pane' && !jt.is_flat_rate) || isWindowRelatedJob(jt)
            ).length;

            return (
              <>
                <ScrollView style={styles.content}>
                  <View style={[styles.infoBox, { backgroundColor: colors.primaryLight }]}>
                    <Info size={14} color={colors.primary} />
                    <Text style={[styles.infoBoxText, { color: colors.primary }]}>
                      Set your pane prices once here and they will automatically apply to all {paneJobCount > 0 ? paneJobCount : ''} pane-based job type{paneJobCount !== 1 ? 's' : ''}. No need to configure each job type individually.
                    </Text>
                  </View>

                  {displayPaneTypes.map(pt => {
                    const isLegacy = legacyKeys.includes(pt.key);
                    if (isLegacy) {
                      const mapping = gLegacyStateMap[pt.key];
                      if (!mapping) return null;
                      return (
                        <View key={pt.id}>
                          <PanePricingRow label={pt.name} state={mapping.state} onChange={u => mapping.setter(p => ({ ...p, ...u }))} baseRate={0} colors={colors} />
                          <View style={[styles.divider, { backgroundColor: colors.border }]} />
                        </View>
                      );
                    }
                    const dynState = globalDynamicPanePricing[pt.key] || { exteriorPct: '', interiorPct: '', pricePerPane: '' };
                    return (
                      <View key={pt.id}>
                        <PanePricingRow
                          label={pt.name}
                          state={dynState}
                          onChange={u => setGlobalDynamicPanePricing(prev => ({ ...prev, [pt.key]: { ...prev[pt.key] || { exteriorPct: '', interiorPct: '', pricePerPane: '' }, ...u } }))}
                          baseRate={0}
                          colors={colors}
                        />
                        <View style={[styles.divider, { backgroundColor: colors.border }]} />
                      </View>
                    );
                  })}

                  <TouchableOpacity
                    style={[styles.managePaneTypesButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                    onPress={() => { setPaneTypesReturnTo('global-pane-pricing'); setScreen('pane-types'); }}
                  >
                    <Grid3x3 size={18} color={colors.primary} />
                    <Text style={[styles.managePaneTypesText, { color: colors.primary }]}>Manage Pane Types</Text>
                    <ChevronRight size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                </ScrollView>

                <View style={[styles.footer, { borderTopColor: colors.border }]}>
                  <View style={styles.formButtons}>
                    <TouchableOpacity style={[styles.cancelFormButton, { borderColor: colors.border }]} onPress={() => setScreen('list')} disabled={savingGlobalPricing}>
                      <Text style={[styles.cancelFormButtonText, { color: colors.textSecondary }]}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.saveFormButton, { overflow: 'hidden' }, savingGlobalPricing && styles.buttonDisabled]} onPress={handleSaveGlobalPanePricing} disabled={savingGlobalPricing}>
                      <LinearGradient colors={['#1B4D6E', '#245d82']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.saveFormButtonGradient}>
                        {savingGlobalPricing ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveFormButtonText}>Save & Apply to All</Text>}
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            );
          })()}

          {/* ── PANE PRICING SCREEN ── */}
          {screen === 'pane-pricing' && (() => {
            const pricingJobType = jobTypes.find(j => j.id === pricingJobTypeId);
            const pricingBaseRate = pricingJobType ? pricingJobType.hourly_rate : 0;
            const legacyKeys = ['standard', 'french', 'storm', 'skylights'];            const legacyStateMap: Record<string, { state: PanePricingState; setter: React.Dispatch<React.SetStateAction<PanePricingState>> }> = {
              standard: { state: standardPricing, setter: setStandardPricing },
              french: { state: frenchPricing, setter: setFrenchPricing },
              storm: { state: stormPricing, setter: setStormPricing },
              skylights: { state: skylightsPricing, setter: setSkylightsPricing },
            };
            const activePaneTypes = paneTypes.filter(pt => pt.is_active);
            const displayPaneTypes = activePaneTypes.length > 0
              ? activePaneTypes
              : [
                  { id: '_std', name: 'Standard', key: 'standard', is_active: true, description: '', sort_order: 0 },
                  { id: '_fr', name: 'French', key: 'french', is_active: true, description: '', sort_order: 1 },
                  { id: '_st', name: 'Storm', key: 'storm', is_active: true, description: '', sort_order: 2 },
                ];

            return (
              <>
                <ScrollView style={styles.content}>
                  <View style={[styles.infoBox, { backgroundColor: colors.primaryLight }]}>
                    <Info size={14} color={colors.primary} />
                    <Text style={[styles.infoBoxText, { color: colors.primary }]}>
                      Configure the price per pane and the exterior/interior percentage split for each pane type below. Use "Manage Pane Types" to show or hide pane types on this page.
                    </Text>
                  </View>

                  {displayPaneTypes.map(pt => {
                    const isLegacy = legacyKeys.includes(pt.key);
                    if (isLegacy) {
                      const mapping = legacyStateMap[pt.key];
                      if (!mapping) return null;
                      return (
                        <View key={pt.id}>
                          <PanePricingRow label={pt.name} state={mapping.state} onChange={u => mapping.setter(p => ({ ...p, ...u }))} baseRate={pricingBaseRate} colors={colors} />
                          <View style={[styles.divider, { backgroundColor: colors.border }]} />
                        </View>
                      );
                    }
                    const dynState = dynamicPanePricing[pt.key] || { exteriorPct: '', interiorPct: '', pricePerPane: '' };
                    return (
                      <View key={pt.id}>
                        <PanePricingRow
                          label={pt.name}
                          state={dynState}
                          onChange={u => setDynamicPanePricing(prev => ({ ...prev, [pt.key]: { ...prev[pt.key] || { exteriorPct: '', interiorPct: '', pricePerPane: '' }, ...u } }))}
                          baseRate={pricingBaseRate}
                          colors={colors}
                        />
                        <View style={[styles.divider, { backgroundColor: colors.border }]} />
                      </View>
                    );
                  })}

                  <TouchableOpacity
                    style={[styles.managePaneTypesButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                    onPress={() => { setPaneTypesReturnTo('pane-pricing'); setScreen('pane-types'); }}
                  >
                    <Grid3x3 size={18} color={colors.primary} />
                    <Text style={[styles.managePaneTypesText, { color: colors.primary }]}>Manage Pane Types</Text>
                    <ChevronRight size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                </ScrollView>

                <View style={[styles.footer, { borderTopColor: colors.border }]}>
                  <View style={styles.formButtons}>
                    <TouchableOpacity style={[styles.cancelFormButton, { borderColor: colors.border }]} onPress={() => { setPricingJobTypeId(null); setScreen('list'); }} disabled={savingPricing}>
                      <Text style={[styles.cancelFormButtonText, { color: colors.textSecondary }]}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.saveFormButton, { overflow: 'hidden' }, savingPricing && styles.buttonDisabled]} onPress={handleSavePanePricing} disabled={savingPricing}>
                      <LinearGradient colors={['#1B4D6E', '#245d82']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.saveFormButtonGradient}>
                        {savingPricing ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveFormButtonText}>Save</Text>}
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            );
          })()}

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  modal: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '92%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIconBtn: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  backBtn: { padding: 2, marginRight: 2 },
  title: { fontSize: 20, fontWeight: 'bold' },
  adminBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  adminBadgeText: { fontSize: 11, fontWeight: '600', color: '#1B4D6E' },
  readOnlyBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, marginHorizontal: 20, marginTop: 12, borderRadius: 8, borderWidth: 1 },
  readOnlyBannerText: { fontSize: 13, flex: 1 },
  content: { padding: 20 },
  errorContainer: { padding: 12, marginHorizontal: 20, marginTop: 12, borderRadius: 8 },
  errorText: { fontSize: 14, textAlign: 'center' },
  infoContainer: { padding: 12, marginHorizontal: 20, marginTop: 12, borderRadius: 8 },
  infoText: { fontSize: 14, textAlign: 'center' },
  inputGroup: { marginBottom: 14 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: { borderRadius: 10, padding: 12, fontSize: 16, borderWidth: 0 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, paddingHorizontal: 12, borderWidth: 0 },
  inputPrefix: { fontSize: 16, marginRight: 4 },
  inputInner: { flex: 1, fontSize: 16, paddingVertical: 12 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  helperText: { fontSize: 12, marginTop: 2 },
  pickerDropdown: { borderRadius: 10, borderWidth: 1, marginTop: 4, overflow: 'hidden' },
  pickerDropdownItem: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, padding: 12, borderBottomWidth: 1 },
  picker: { borderRadius: 10, padding: 12, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pickerText: { fontSize: 16 },
  dropdownList: { borderRadius: 10, borderWidth: 1, marginTop: 4, overflow: 'hidden' },
  dropdownItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 1 },
  dropdownItemText: { fontSize: 16 },
  formButtons: { flexDirection: 'row', gap: 12 },
  cancelFormButton: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  cancelFormButtonText: { fontSize: 15, fontWeight: '600' },
  saveFormButton: { flex: 1, borderRadius: 10, overflow: 'hidden' },
  saveFormButtonGradient: { padding: 14, alignItems: 'center' },
  saveFormButtonText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  buttonDisabled: { opacity: 0.6 },
  loader: { marginTop: 40 },
  jobTypeCard: { borderRadius: 12, paddingTop: 16, paddingHorizontal: 16, paddingBottom: 12, marginBottom: 10, borderWidth: 1 },
  jobTypeCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  inactiveCard: { opacity: 0.6 },
  jobTypeInfo: { flex: 1 },
  jobTypeNameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 2 },
  jobTypeName: { fontSize: 16, fontWeight: '600' },
  jobTypeDescription: { fontSize: 14, marginTop: 2 },
  jobTypeRate: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  paneChips: { flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  paneChip: { fontSize: 11 },
  panePriceSummary: { flexDirection: 'row', gap: 6, marginTop: 10, flexWrap: 'wrap' },
  panePriceChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  panePriceChipLabel: { fontSize: 11, fontWeight: '700' },
  panePriceChipValue: { fontSize: 12, fontWeight: '600' },
  panePriceChipSplit: { fontSize: 10, opacity: 0.7 },
  panePricingButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  panePricingButtonText: { fontSize: 13, fontWeight: '600' },
  jobTypeActions: { flexDirection: 'row', gap: 8, marginLeft: 8 },
  actionButton: { padding: 8, borderRadius: 8 },
  emptyContainer: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 24, paddingBottom: 20 },
  emptyIconWrap: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyText: { fontSize: 17, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  emptySubtext: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
  footer: { padding: 20, borderTopWidth: 1 },
  addButton: { borderRadius: 12, overflow: 'hidden' },
  addButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, gap: 8 },
  addButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  infoBox: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: 10, marginBottom: 20, alignItems: 'flex-start' },
  infoBoxText: { flex: 1, fontSize: 13, lineHeight: 18 },
  baseRateBadge: { borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  baseRateBadgeLabel: { fontSize: 13 },
  baseRateBadgeValue: { fontSize: 15, fontWeight: '700' },
  divider: { height: 1, marginBottom: 20 },
  categorySection: { marginBottom: 8 },
  categorySectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  categorySectionDot: { width: 10, height: 10, borderRadius: 5 },
  categorySectionTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 },
  categorySectionCount: { fontSize: 12 },
  catBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  catDot: { width: 6, height: 6, borderRadius: 3 },
  catBadgeText: { fontSize: 11, fontWeight: '600' },
  categoryCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, marginBottom: 10, borderWidth: 1, overflow: 'hidden' },
  categoryColorBar: { width: 5, alignSelf: 'stretch' },
  categoryCardInfo: { flex: 1, padding: 14 },
  categoryCardName: { fontSize: 16, fontWeight: '600' },
  categoryCardCount: { fontSize: 13, marginTop: 2 },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorSwatch: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  colorSwatchSelected: { borderWidth: 3, borderColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.3, shadowRadius: 2, elevation: 3 },
  categoryPreview: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderRadius: 12, borderWidth: 1, marginTop: 8 },
  categoryPreviewDot: { width: 10, height: 10, borderRadius: 5 },
  categoryPreviewText: { fontSize: 15, fontWeight: '600' },
  selectedCategoryDisplay: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  managePaneTypesButton: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 12, borderWidth: 1, marginTop: 10 },
  managePaneTypesText: { flex: 1, fontSize: 15, fontWeight: '600' },
  paneSettingsContainer: { borderWidth: 1, borderRadius: 12, marginBottom: 16, overflow: 'hidden' },
  paneSettingsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1 },
});
