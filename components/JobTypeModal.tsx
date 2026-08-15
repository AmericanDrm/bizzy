import React, { useState, useEffect } from 'react';
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
  Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, ChevronDown, Info, Settings, ChevronRight, Check, Plus } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useUserRole } from '@/hooks/useUserRole';
import AIAssistButton from './AIAssistButton';

const CATEGORY_COLORS = [
  '#1B4D6E', '#2E7D52', '#B45309', '#B91C1C',
  '#6B21A8', '#0369A1', '#0F766E', '#92400E',
];

interface JobTypeCategory {
  id: string;
  name: string;
  color: string;
  sort_order: number;
}

interface JobTypeModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
}

interface PanePricingState {
  exteriorPct: string;
  interiorPct: string;
  pricePerPane: string;
}

type PaneTypeLabel = 'Standard' | 'French' | 'Storm' | 'Skylights';

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
  const effectivePrice = state.pricePerPane !== '' ? parseFloat(state.pricePerPane) || 0 : 0;
  const extPct = state.exteriorPct !== '' ? parseFloat(state.exteriorPct) || 0 : 60;
  const intPct = state.interiorPct !== '' ? parseFloat(state.interiorPct) || 0 : (100 - extPct);
  const extPrice = effectivePrice * (extPct / 100);
  const intPrice = effectivePrice * (intPct / 100);

  const handleExteriorChange = (v: string) => {
    const cleaned = v.replace(/[^0-9]/g, '');
    const num = Math.min(100, parseInt(cleaned) || 0);
    onChange({ exteriorPct: cleaned === '' ? '' : String(num) });
  };

  const handleInteriorChange = (v: string) => {
    const cleaned = v.replace(/[^0-9]/g, '');
    const num = Math.min(100, parseInt(cleaned) || 0);
    onChange({ interiorPct: cleaned === '' ? '' : String(num) });
  };

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 10 }}>{label} Panes</Text>

      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 4 }}>Price / Pane</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.inputBackground, borderRadius: 10, paddingHorizontal: 10 }}>
            <Text style={{ fontSize: 14, color: colors.textSecondary }}>$</Text>
            <TextInput
              style={{ flex: 1, minWidth: 0, fontSize: 15, color: colors.text, paddingVertical: 10, paddingLeft: 4 }}
              placeholder={baseRate > 0 ? baseRate.toFixed(2) : '0.00'}
              placeholderTextColor={colors.textSecondary}
              value={state.pricePerPane}
              onChangeText={v => onChange({ pricePerPane: v.replace(/[^0-9.]/g, '') })}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 4 }}>Exterior %</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.inputBackground, borderRadius: 10, paddingHorizontal: 10 }}>
            <TextInput
              style={{ flex: 1, minWidth: 0, fontSize: 15, color: colors.text, paddingVertical: 10 }}
              placeholder="60"
              placeholderTextColor={colors.textSecondary}
              value={state.exteriorPct}
              onChangeText={handleExteriorChange}
              keyboardType="number-pad"
              maxLength={3}
            />
            <Text style={{ fontSize: 14, color: colors.textSecondary }}>%</Text>
          </View>
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 4 }}>Interior %</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.inputBackground, borderRadius: 10, paddingHorizontal: 10 }}>
            <TextInput
              style={{ flex: 1, minWidth: 0, fontSize: 15, color: colors.text, paddingVertical: 10 }}
              placeholder="40"
              placeholderTextColor={colors.textSecondary}
              value={state.interiorPct}
              onChangeText={handleInteriorChange}
              keyboardType="number-pad"
              maxLength={3}
            />
            <Text style={{ fontSize: 14, color: colors.textSecondary }}>%</Text>
          </View>
        </View>
      </View>

      {effectivePrice > 0 && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1, backgroundColor: colors.primaryLight, borderRadius: 8, padding: 8 }}>
            <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '600' }}>Exterior</Text>
            <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '700' }}>${extPrice.toFixed(2)}/pane</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: colors.inputBackground, borderRadius: 8, padding: 8 }}>
            <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '600' }}>Interior</Text>
            <Text style={{ fontSize: 13, color: colors.text, fontWeight: '700' }}>${intPrice.toFixed(2)}/pane</Text>
          </View>
        </View>
      )}
    </View>
  );
}

export default function JobTypeModal({ visible, onClose, onSave }: JobTypeModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [isFlatRate, setIsFlatRate] = useState(false);
  const [unitOfMeasure, setUnitOfMeasure] = useState('hour');
  const [customUnitLabel, setCustomUnitLabel] = useState('');
  const [showUnitPicker, setShowUnitPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPaneSettings, setShowPaneSettings] = useState(false);
  const [categories, setCategories] = useState<JobTypeCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showNewCategoryForm, setShowNewCategoryForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState(CATEGORY_COLORS[0]);
  const [savingCategory, setSavingCategory] = useState(false);

  const [standardPricing, setStandardPricing] = useState<PanePricingState>({ exteriorPct: '', interiorPct: '', pricePerPane: '' });
  const [frenchPricing, setFrenchPricing] = useState<PanePricingState>({ exteriorPct: '', interiorPct: '', pricePerPane: '' });
  const [stormPricing, setStormPricing] = useState<PanePricingState>({ exteriorPct: '', interiorPct: '', pricePerPane: '' });
  const [skylightsPricing, setSkylightsPricing] = useState<PanePricingState>({ exteriorPct: '', interiorPct: '', pricePerPane: '' });

  const { user } = useAuth();
  const { colors } = useTheme();
  const { currentOrganization } = useOrganization();
  const { isAdminOrManager } = useUserRole();

  useEffect(() => {
    if (visible && currentOrganization?.id) {
      supabase
        .from('job_type_categories')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('sort_order')
        .order('name')
        .then(({ data }) => setCategories(data || []));
    }
  }, [visible, currentOrganization?.id]);

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

  const resetForm = () => {
    setName('');
    setDescription('');
    setHourlyRate('');
    setIsFlatRate(false);
    setUnitOfMeasure('hour');
    setCustomUnitLabel('');
    setError('');
    setShowPaneSettings(false);
    setSelectedCategoryId(null);
    setShowCategoryPicker(false);
    setShowNewCategoryForm(false);
    setNewCategoryName('');
    setNewCategoryColor(CATEGORY_COLORS[0]);
    setSavingCategory(false);
    setStandardPricing({ exteriorPct: '', interiorPct: '', pricePerPane: '' });
    setFrenchPricing({ exteriorPct: '', interiorPct: '', pricePerPane: '' });
    setStormPricing({ exteriorPct: '', interiorPct: '', pricePerPane: '' });
    setSkylightsPricing({ exteriorPct: '', interiorPct: '', pricePerPane: '' });
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

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

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Job type name is required');
      return;
    }

    if (unitOfMeasure === 'custom' && !customUnitLabel.trim()) {
      setError('Custom unit label is required');
      return;
    }

    if (!currentOrganization?.id) {
      setError('Organization not found');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const isPaneType = unitOfMeasure === 'pane' && !isFlatRate;

      const insertData: any = {
        name: name.trim(),
        description: description.trim(),
        hourly_rate: parseFloat(hourlyRate) || 0,
        is_active: true,
        organization_id: currentOrganization.id,
        unit_of_measure: unitOfMeasure,
        custom_unit_label: unitOfMeasure === 'custom' ? customUnitLabel.trim() : null,
        is_flat_rate: isFlatRate,
        category_id: selectedCategoryId || null,
      };

      if (isPaneType) {
        insertData.exterior_split_percent_standard = parsePct(standardPricing.exteriorPct);
        insertData.exterior_split_percent_french = parsePct(frenchPricing.exteriorPct);
        insertData.exterior_split_percent_storm = parsePct(stormPricing.exteriorPct);
        insertData.interior_split_percent_standard = parsePct(standardPricing.interiorPct);
        insertData.interior_split_percent_french = parsePct(frenchPricing.interiorPct);
        insertData.interior_split_percent_storm = parsePct(stormPricing.interiorPct);
        insertData.price_per_pane_standard = parsePrice(standardPricing.pricePerPane);
        insertData.price_per_pane_french = parsePrice(frenchPricing.pricePerPane);
        insertData.price_per_pane_storm = parsePrice(stormPricing.pricePerPane);
        insertData.price_per_pane_skylights = parsePrice(skylightsPricing.pricePerPane);
        insertData.exterior_pct_standard = parsePct(standardPricing.exteriorPct);
        insertData.exterior_pct_french = parsePct(frenchPricing.exteriorPct);
      }

      const { error: insertError } = await supabase.from('job_types').insert(insertData);

      if (insertError) throw insertError;

      resetForm();
      onSave();
    } catch (err) {
      console.error('Error saving job type:', err);
      setError('Failed to save job type');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim() || !currentOrganization?.id) return;
    setSavingCategory(true);
    try {
      const maxOrder = categories.reduce((m, c) => Math.max(m, c.sort_order || 0), 0);
      const { data, error: catError } = await supabase
        .from('job_type_categories')
        .insert({
          name: newCategoryName.trim(),
          color: newCategoryColor,
          sort_order: maxOrder + 1,
          organization_id: currentOrganization.id,
        })
        .select()
        .single();
      if (catError) throw catError;
      const newCat: JobTypeCategory = { id: data.id, name: data.name, color: data.color, sort_order: data.sort_order };
      setCategories((prev) => [...prev, newCat]);
      setSelectedCategoryId(data.id);
      setShowNewCategoryForm(false);
      setShowCategoryPicker(false);
      setNewCategoryName('');
      setNewCategoryColor(CATEGORY_COLORS[0]);
    } catch (err) {
      console.error('Error creating category:', err);
    } finally {
      setSavingCategory(false);
    }
  };

  const getSelectedUnit = () => {
    const unit = unitOptions.find((u) => u.value === unitOfMeasure);
    if (unitOfMeasure === 'custom') return customUnitLabel || 'Custom';
    return unit?.label || 'Hour';
  };

  const isPaneTypeSelected = unitOfMeasure === 'pane' && !isFlatRate;
  const baseRate = parseFloat(hourlyRate) || 0;

  const dynamicStyles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    container: {
      width: '90%',
      maxWidth: 500,
      backgroundColor: colors.background,
      borderRadius: 20,
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
    scrollContent: {
      padding: 20,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 8,
      color: colors.text,
    },
    labelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    input: {
      backgroundColor: colors.inputBackground,
      borderWidth: 0,
      borderRadius: 10,
      padding: 12,
      fontSize: 16,
      marginBottom: 16,
      color: colors.text,
    },
    textArea: {
      height: 80,
      textAlignVertical: 'top',
    },
    picker: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 12,
      marginBottom: 16,
    },
    pickerText: {
      fontSize: 16,
      color: colors.text,
    },
    pickerList: {
      backgroundColor: colors.cardBackground,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 16,
      maxHeight: 320,
    },
    pickerItem: {
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    pickerItemText: {
      fontSize: 16,
      color: colors.text,
    },
    switchRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    switchLabel: {
      fontSize: 16,
      color: colors.text,
    },
    switchHint: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    errorText: {
      color: '#1B4D6E',
      fontSize: 14,
      marginBottom: 12,
    },
    buttonContainer: {
      flexDirection: 'row',
      gap: 12,
      padding: 20,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    button: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 10,
      alignItems: 'center',
    },
    cancelButton: {
      backgroundColor: colors.inputBackground,
    },
    saveButton: {
      overflow: 'hidden',
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    cancelButtonText: {
      color: colors.text,
    },
    saveButtonText: {
      color: '#fff',
    },
    paneSettingsContainer: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      marginBottom: 16,
      overflow: 'hidden',
      backgroundColor: colors.cardBackground,
    },
    paneSettingsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 14,
      borderBottomWidth: 1,
    },
  });

  return (
    <Modal visible={visible} transparent animationType="fade">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={dynamicStyles.overlay}>
          <View style={dynamicStyles.container}>
            <View style={dynamicStyles.header}>
              <Text style={dynamicStyles.title}>Add Job Type</Text>
              <TouchableOpacity onPress={handleClose} disabled={loading}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={dynamicStyles.scrollContent}>
              {error ? <Text style={dynamicStyles.errorText}>{error}</Text> : null}

              <Text style={dynamicStyles.label}>Job Type Name *</Text>
              <TextInput
                style={dynamicStyles.input}
                placeholder="e.g., Window Cleaning"
                placeholderTextColor={colors.textSecondary}
                value={name}
                onChangeText={setName}
                editable={!loading}
              />

              <Text style={dynamicStyles.label}>Service Category</Text>
              <TouchableOpacity
                style={dynamicStyles.picker}
                onPress={() => {
                  const opening = !showCategoryPicker;
                  setShowCategoryPicker(opening);
                  if (opening && categories.length === 0 && isAdminOrManager) {
                    setShowNewCategoryForm(true);
                  }
                }}
                disabled={loading}
              >
                {selectedCategoryId ? (() => {
                  const cat = categories.find(c => c.id === selectedCategoryId);
                  return cat ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: cat.color }} />
                      <Text style={dynamicStyles.pickerText}>{cat.name}</Text>
                    </View>
                  ) : <Text style={[dynamicStyles.pickerText, { color: colors.textSecondary }]}>Select category</Text>;
                })() : (
                  <Text style={[dynamicStyles.pickerText, { color: colors.textSecondary }]}>No category</Text>
                )}
                <ChevronDown size={18} color={colors.textSecondary} />
              </TouchableOpacity>
              {showCategoryPicker && (
                <ScrollView style={[dynamicStyles.pickerList, { marginTop: -8 }]}>
                  <TouchableOpacity
                    style={dynamicStyles.pickerItem}
                    onPress={() => { setSelectedCategoryId(null); setShowCategoryPicker(false); }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={[dynamicStyles.pickerItemText, { color: colors.textSecondary }]}>No category</Text>
                      {!selectedCategoryId && <Check size={16} color={colors.primary} />}
                    </View>
                  </TouchableOpacity>
                  {categories.map(cat => (
                    <TouchableOpacity
                      key={cat.id}
                      style={dynamicStyles.pickerItem}
                      onPress={() => { setSelectedCategoryId(cat.id); setShowCategoryPicker(false); }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: cat.color }} />
                          <Text style={dynamicStyles.pickerItemText}>{cat.name}</Text>
                        </View>
                        {selectedCategoryId === cat.id && <Check size={16} color={colors.primary} />}
                      </View>
                    </TouchableOpacity>
                  ))}
                  {categories.length === 0 && !showNewCategoryForm && !isAdminOrManager && (
                    <View style={{ padding: 14 }}>
                      <Text style={[dynamicStyles.pickerItemText, { color: colors.textSecondary, fontSize: 13 }]}>
                        No categories have been set up for your organization yet.
                      </Text>
                    </View>
                  )}
                  {categories.length === 0 && !showNewCategoryForm && isAdminOrManager && (
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}
                      onPress={() => setShowNewCategoryForm(true)}
                    >
                      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary + '18', alignItems: 'center', justifyContent: 'center' }}>
                        <Plus size={15} color={colors.primary} />
                      </View>
                      <View>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary }}>Create your first category</Text>
                        <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 1 }}>No categories yet — add one to get started</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                  {categories.length > 0 && isAdminOrManager && !showNewCategoryForm && (
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: colors.border }}
                      onPress={() => setShowNewCategoryForm(true)}
                    >
                      <Plus size={15} color={colors.primary} />
                      <Text style={{ fontSize: 14, color: colors.primary, fontWeight: '600' }}>Add new category</Text>
                    </TouchableOpacity>
                  )}
                  {isAdminOrManager && showNewCategoryForm && (
                    <View style={{ padding: 12, gap: 10 }}>
                      <TextInput
                        style={{
                          backgroundColor: colors.inputBackground,
                          borderRadius: 8,
                          paddingHorizontal: 12,
                          paddingVertical: 9,
                          fontSize: 15,
                          color: colors.text,
                        }}
                        placeholder="Category name"
                        placeholderTextColor={colors.textSecondary}
                        value={newCategoryName}
                        onChangeText={setNewCategoryName}
                        autoFocus
                      />
                      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                        {CATEGORY_COLORS.map((c) => (
                          <TouchableOpacity
                            key={c}
                            onPress={() => setNewCategoryColor(c)}
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: 13,
                              backgroundColor: c,
                              borderWidth: newCategoryColor === c ? 2.5 : 0,
                              borderColor: colors.text,
                            }}
                          />
                        ))}
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity
                          style={{
                            flex: 1,
                            paddingVertical: 9,
                            borderRadius: 8,
                            backgroundColor: colors.inputBackground,
                            alignItems: 'center',
                          }}
                          onPress={() => { setShowNewCategoryForm(false); setNewCategoryName(''); setNewCategoryColor(CATEGORY_COLORS[0]); }}
                        >
                          <Text style={{ fontSize: 14, color: colors.textSecondary }}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{
                            flex: 2,
                            paddingVertical: 9,
                            borderRadius: 8,
                            backgroundColor: newCategoryName.trim() ? colors.primary : colors.border,
                            alignItems: 'center',
                            flexDirection: 'row',
                            justifyContent: 'center',
                            gap: 6,
                          }}
                          onPress={handleCreateCategory}
                          disabled={savingCategory || !newCategoryName.trim()}
                        >
                          {savingCategory ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>Create & Select</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </ScrollView>
              )}

              <View style={dynamicStyles.labelRow}>
                <Text style={dynamicStyles.label}>Description</Text>
                <AIAssistButton
                  type="job_description"
                  jobTypeName={name || 'service'}
                  onGenerate={(text) => setDescription(text)}
                  disabled={loading || !name.trim()}
                  compact
                />
              </View>
              <TextInput
                style={[dynamicStyles.input, dynamicStyles.textArea]}
                placeholder="Brief description of this job type"
                placeholderTextColor={colors.textSecondary}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                editable={!loading}
              />

              <View style={dynamicStyles.switchRow}>
                <View>
                  <Text style={dynamicStyles.switchLabel}>Flat Rate</Text>
                  <Text style={dynamicStyles.switchHint}>Fixed price instead of per-unit</Text>
                </View>
                <Switch
                  value={isFlatRate}
                  onValueChange={setIsFlatRate}
                  disabled={loading}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor="#fff"
                />
              </View>

              <Text style={dynamicStyles.label}>Unit of Measure *</Text>
              <TouchableOpacity
                style={dynamicStyles.picker}
                onPress={() => setShowUnitPicker(!showUnitPicker)}
                disabled={loading}
              >
                <Text style={dynamicStyles.pickerText}>{getSelectedUnit()}</Text>
                <ChevronDown size={20} color={colors.textSecondary} />
              </TouchableOpacity>

              {showUnitPicker && (
                <ScrollView style={dynamicStyles.pickerList}>
                  {unitOptions.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={dynamicStyles.pickerItem}
                      onPress={() => {
                        setUnitOfMeasure(option.value);
                        setShowUnitPicker(false);
                      }}
                    >
                      <Text style={dynamicStyles.pickerItemText}>{option.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {unitOfMeasure === 'custom' && (
                <>
                  <Text style={dynamicStyles.label}>Custom Unit Label *</Text>
                  <TextInput
                    style={dynamicStyles.input}
                    placeholder="e.g., per building, per floor"
                    placeholderTextColor={colors.textSecondary}
                    value={customUnitLabel}
                    onChangeText={setCustomUnitLabel}
                    editable={!loading}
                  />
                </>
              )}

              <Text style={dynamicStyles.label}>
                {isFlatRate ? 'Flat Rate' : `Rate per ${getSelectedUnit()}`}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, marginBottom: 16 }}>
                <Text style={{ fontSize: 16, color: colors.textSecondary }}>$</Text>
                <TextInput
                  style={{ flex: 1, fontSize: 16, color: colors.text, paddingVertical: 12, paddingLeft: 4 }}
                  placeholder="0.00"
                  placeholderTextColor={colors.textSecondary}
                  value={hourlyRate}
                  onChangeText={setHourlyRate}
                  keyboardType="decimal-pad"
                  editable={!loading}
                />
              </View>

              {isPaneTypeSelected && (
                <View style={dynamicStyles.paneSettingsContainer}>
                  <TouchableOpacity
                    style={[dynamicStyles.paneSettingsHeader, { borderBottomColor: showPaneSettings ? colors.border : 'transparent' }]}
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
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 12, padding: 10, backgroundColor: colors.primaryLight, borderRadius: 8 }}>
                        <Info size={14} color={colors.primary} style={{ marginTop: 1 }} />
                        <Text style={{ flex: 1, fontSize: 12, color: colors.primary }}>
                          Set price and exterior/interior split per pane type. Interior % updates automatically. Leaving split blank defaults to 100% exterior.
                        </Text>
                      </View>

                      <PanePricingRow
                        label="Standard"
                        state={standardPricing}
                        onChange={(u) => setStandardPricing(p => ({ ...p, ...u }))}
                        baseRate={baseRate}
                        colors={colors}
                      />
                      <View style={{ height: 1, backgroundColor: colors.border, marginBottom: 16 }} />
                      <PanePricingRow
                        label="French"
                        state={frenchPricing}
                        onChange={(u) => setFrenchPricing(p => ({ ...p, ...u }))}
                        baseRate={baseRate}
                        colors={colors}
                      />
                      <View style={{ height: 1, backgroundColor: colors.border, marginBottom: 16 }} />
                      <PanePricingRow
                        label="Storm"
                        state={stormPricing}
                        onChange={(u) => setStormPricing(p => ({ ...p, ...u }))}
                        baseRate={baseRate}
                        colors={colors}
                      />
                      <View style={{ height: 1, backgroundColor: colors.border, marginBottom: 16 }} />
                      <PanePricingRow
                        label="Skylights"
                        state={skylightsPricing}
                        onChange={(u) => setSkylightsPricing(p => ({ ...p, ...u }))}
                        baseRate={baseRate}
                        colors={colors}
                      />
                    </View>
                  )}
                </View>
              )}
            </ScrollView>

            <View style={dynamicStyles.buttonContainer}>
              <TouchableOpacity
                style={[dynamicStyles.button, dynamicStyles.cancelButton]}
                onPress={handleClose}
                disabled={loading}
              >
                <Text style={[dynamicStyles.buttonText, dynamicStyles.cancelButtonText]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[dynamicStyles.button, dynamicStyles.saveButton]}
                onPress={handleSave}
                disabled={loading}
              >
                <LinearGradient
                  colors={['#1B4D6E', '#245d82']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' }}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={[dynamicStyles.buttonText, dynamicStyles.saveButtonText]}>
                      Save
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
