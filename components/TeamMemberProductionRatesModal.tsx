import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { X, Save, TrendingUp, ChevronDown, ChevronRight, Plus, Check } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/lib/supabase';
import { PANE_STYLE_LABELS, type PaneStyle } from '@/lib/productionRateService';

interface TeamMemberProductionRatesModalProps {
  visible: boolean;
  onClose: () => void;
  memberId: string;
  memberName: string;
}

interface UnitRate {
  unitType: string;
  customUnitLabel?: string;
  displayLabel: string;
  unitsPerHour: string;
  isPaneType: boolean;
  paneStyleRates: Record<PaneStyle, string>;
  expanded: boolean;
}

interface SuggestedUnit {
  unitType: string;
  customUnitLabel?: string;
  displayLabel: string;
  isCustom: boolean;
}

const UNIT_DISPLAY_MAP: Record<string, string> = {
  sqft: 'Sq Ft',
  linear_ft: 'Linear Ft',
  mirrors: 'Mirrors',
  windows: 'Pane Windows',
  pane: 'Pane Windows',
  each: 'Each',
  item: 'Per Item',
  day: 'Per Day',
  mile: 'Per Mile',
  custom: 'Custom',
};

const STANDARD_SUGGESTIONS: SuggestedUnit[] = [
  { unitType: 'sqft', displayLabel: 'Sq Ft', isCustom: false },
  { unitType: 'linear_ft', displayLabel: 'Linear Ft', isCustom: false },
  { unitType: 'pane', displayLabel: 'Pane Windows', isCustom: false },
  { unitType: 'item', displayLabel: 'Per Item', isCustom: false },
  { unitType: 'day', displayLabel: 'Per Day', isCustom: false },
  { unitType: 'mile', displayLabel: 'Per Mile', isCustom: false },
];

const PANE_UNIT_TYPES = new Set(['windows', 'pane']);
const PANE_STYLES: PaneStyle[] = ['standard', 'french', 'storm'];

const noOutline = Platform.OS === 'web' ? ({ outlineWidth: 0 } as any) : {};

export default function TeamMemberProductionRatesModal({
  visible,
  onClose,
  memberId,
  memberName,
}: TeamMemberProductionRatesModalProps) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const { currentOrganization } = useOrganization();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [unitRates, setUnitRates] = useState<UnitRate[]>([]);
  const [availableSuggestions, setAvailableSuggestions] = useState<SuggestedUnit[]>([]);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [newUnitLabel, setNewUnitLabel] = useState('');
  const [addingUnit, setAddingUnit] = useState(false);
  const [orgPaneStyles, setOrgPaneStyles] = useState<PaneStyle[]>(PANE_STYLES);
  const [orgPaneStyleLabels, setOrgPaneStyleLabels] = useState<Record<string, string>>(PANE_STYLE_LABELS);

  useEffect(() => {
    if (visible && currentOrganization?.id) {
      loadData();
    }
  }, [visible, currentOrganization?.id, memberId]);

  const loadData = async () => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    try {
      const [jobTypesRes, paneTypesRes] = await Promise.all([
        supabase
          .from('job_types')
          .select('unit_of_measure, custom_unit_label')
          .eq('organization_id', currentOrganization.id)
          .eq('is_active', true),
        supabase
          .from('pane_types')
          .select('key, name, is_active')
          .eq('organization_id', currentOrganization.id)
          .eq('is_active', true)
          .order('sort_order'),
      ]);

      if (jobTypesRes.error) throw jobTypesRes.error;
      const jobTypes = jobTypesRes.data;

      const activePaneTypes = paneTypesRes.data || [];
      const filteredPaneTypes = activePaneTypes;

      let activePaneStyles: PaneStyle[];
      let activePaneLabels: Record<string, string>;

      if (filteredPaneTypes.length > 0) {
        activePaneStyles = filteredPaneTypes.map(pt => pt.key as PaneStyle);
        activePaneLabels = {};
        filteredPaneTypes.forEach(pt => { activePaneLabels[pt.key] = pt.name; });
      } else {
        activePaneStyles = PANE_STYLES;
        activePaneLabels = { ...PANE_STYLE_LABELS };
      }

      setOrgPaneStyles(activePaneStyles);
      setOrgPaneStyleLabels(activePaneLabels);

      const uniqueUnits = new Map<string, { unitType: string; customUnitLabel?: string; displayLabel: string }>();
      jobTypes?.forEach((jt) => {
        const key = `${jt.unit_of_measure}|${jt.custom_unit_label || ''}`;
        if (!uniqueUnits.has(key)) {
          const displayLabel =
            jt.unit_of_measure === 'custom' && jt.custom_unit_label
              ? jt.custom_unit_label
              : UNIT_DISPLAY_MAP[jt.unit_of_measure] || jt.unit_of_measure;
          uniqueUnits.set(key, {
            unitType: jt.unit_of_measure,
            customUnitLabel: jt.custom_unit_label,
            displayLabel,
          });
        }
      });

      const { data: existingRates, error: ratesError } = await supabase
        .from('team_member_production_rates')
        .select('unit_type, custom_unit_label, pane_type, units_per_hour')
        .eq('member_id', memberId);

      if (ratesError) throw ratesError;

      const paneStyleMap = new Map<string, Map<string, number>>();
      const generalMap = new Map<string, number>();

      existingRates?.forEach((r: any) => {
        const key = `${r.unit_type}|${r.custom_unit_label || ''}`;
        if (r.pane_type && activePaneStyles.includes(r.pane_type as PaneStyle)) {
          if (!paneStyleMap.has(key)) paneStyleMap.set(key, new Map());
          paneStyleMap.get(key)!.set(r.pane_type, r.units_per_hour);
        } else if (!r.pane_type) {
          generalMap.set(key, r.units_per_hour);
        }
      });

      const rates: UnitRate[] = Array.from(uniqueUnits.values()).map((ut) => {
        const key = `${ut.unitType}|${ut.customUnitLabel || ''}`;
        const isPaneType = PANE_UNIT_TYPES.has(ut.unitType);
        const existingStyleRates = paneStyleMap.get(key) || new Map<string, number>();

        const paneStyleRates: Record<PaneStyle, string> = {
          standard: '',
          french: '',
          storm: '',
        };
        if (isPaneType) {
          activePaneStyles.forEach((style) => {
            const v = existingStyleRates.get(style);
            paneStyleRates[style] = v != null ? String(v) : '';
          });
        }

        const hasPaneRates = Object.values(paneStyleRates).some((v) => v !== '');
        const general = generalMap.get(key);

        return {
          unitType: ut.unitType,
          customUnitLabel: ut.customUnitLabel,
          displayLabel: ut.displayLabel,
          unitsPerHour: general != null ? String(general) : '',
          isPaneType,
          paneStyleRates,
          expanded: isPaneType && hasPaneRates,
        };
      });

      setUnitRates(rates);

      const activeKeys = new Set(rates.map((r) => `${r.unitType}|${r.customUnitLabel || ''}`));

      const orgCustomUnits: SuggestedUnit[] = Array.from(uniqueUnits.values())
        .filter((u) => u.unitType === 'custom' && u.customUnitLabel)
        .map((u) => ({
          unitType: u.unitType,
          customUnitLabel: u.customUnitLabel,
          displayLabel: u.displayLabel,
          isCustom: true,
        }));

      const allSuggestions = [...STANDARD_SUGGESTIONS, ...orgCustomUnits];
      setAvailableSuggestions(allSuggestions.filter((s) => {
        const key = `${s.unitType}|${s.customUnitLabel || ''}`;
        return !activeKeys.has(key);
      }));
    } catch (err) {
      console.error('Error loading production rates:', err);
      Alert.alert('Error', 'Failed to load production rates');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSuggestion = (suggestion: SuggestedUnit) => {
    const key = `${suggestion.unitType}|${suggestion.customUnitLabel || ''}`;
    setUnitRates((prev) => [
      ...prev,
      {
        unitType: suggestion.unitType,
        customUnitLabel: suggestion.customUnitLabel,
        displayLabel: suggestion.displayLabel,
        unitsPerHour: '',
        isPaneType: PANE_UNIT_TYPES.has(suggestion.unitType),
        paneStyleRates: { standard: '', french: '', storm: '' },
        expanded: false,
      },
    ]);
    setAvailableSuggestions((prev) => prev.filter((s) => `${s.unitType}|${s.customUnitLabel || ''}` !== key));
  };

  const handleAddCustomUnit = async () => {
    const label = newUnitLabel.trim();
    if (!label || !currentOrganization?.id) return;

    const key = `custom|${label}`;
    if (unitRates.some((r) => `${r.unitType}|${r.customUnitLabel || ''}` === key)) {
      showToast({ message: 'That unit already exists', type: 'error' });
      return;
    }

    setAddingUnit(true);
    try {
      const { error } = await supabase.from('job_types').insert({
        name: label,
        description: '',
        hourly_rate: 0,
        is_active: true,
        organization_id: currentOrganization.id,
        unit_of_measure: 'custom',
        custom_unit_label: label,
        is_flat_rate: false,
      });
      if (error) throw error;

      setUnitRates((prev) => [
        ...prev,
        {
          unitType: 'custom',
          customUnitLabel: label,
          displayLabel: label,
          unitsPerHour: '',
          isPaneType: false,
          paneStyleRates: { standard: '', french: '', storm: '' },
          expanded: false,
        },
      ]);
      setNewUnitLabel('');
      setShowCustomInput(false);
      showToast({ message: `"${label}" added as a measurement unit`, type: 'success' });
    } catch (err) {
      console.error('Error adding unit:', err);
      Alert.alert('Error', 'Failed to add measurement unit');
    } finally {
      setAddingUnit(false);
    }
  };

  const updateBlendedRate = (index: number, value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    setUnitRates((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], unitsPerHour: cleaned };
      return next;
    });
  };

  const updatePaneStyleRate = (index: number, style: PaneStyle, value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    setUnitRates((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        paneStyleRates: { ...next[index].paneStyleRates, [style]: cleaned },
      };
      return next;
    });
  };

  const toggleExpanded = (index: number) => {
    setUnitRates((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], expanded: !next[index].expanded };
      return next;
    });
  };

  const handleSave = async () => {
    if (!currentOrganization?.id) return;
    setSaving(true);
    try {
      const { error: deleteError } = await supabase
        .from('team_member_production_rates')
        .delete()
        .eq('member_id', memberId);

      if (deleteError) throw deleteError;

      const rowsToInsert: any[] = [];

      unitRates.forEach((rate) => {
        if (rate.isPaneType && rate.expanded) {
          orgPaneStyles.forEach((style) => {
            const val = parseFloat(rate.paneStyleRates[style] || '');
            if (!isNaN(val) && val > 0) {
              rowsToInsert.push({
                organization_id: currentOrganization.id,
                member_id: memberId,
                unit_type: rate.unitType,
                custom_unit_label: rate.customUnitLabel ?? null,
                pane_type: style,
                units_per_hour: val,
                updated_at: new Date().toISOString(),
              });
            }
          });
        } else {
          const val = parseFloat(rate.unitsPerHour);
          if (!isNaN(val) && val > 0) {
            rowsToInsert.push({
              organization_id: currentOrganization.id,
              member_id: memberId,
              unit_type: rate.unitType,
              custom_unit_label: rate.customUnitLabel ?? null,
              pane_type: null,
              units_per_hour: val,
              updated_at: new Date().toISOString(),
            });
          }
        }
      });

      if (rowsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('team_member_production_rates')
          .insert(rowsToInsert);
        if (insertError) throw insertError;
      }

      showToast({ message: `Production rates updated for ${memberName}`, type: 'success' });
      onClose();
    } catch (err) {
      console.error('Error saving production rates:', err);
      Alert.alert('Error', 'Failed to save production rates');
    } finally {
      setSaving(false);
    }
  };

  const s = getStyles(colors);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.modal}>
          <View style={s.header}>
            <View style={s.headerContent}>
              <Text style={s.title}>Production Rates</Text>
              <Text style={s.subtitle}>{memberName}</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={s.description}>
            <TrendingUp size={16} color={colors.primary} />
            <Text style={s.descriptionText}>
              Set how many units {memberName} completes per hour for each measurement type.
            </Text>
          </View>

          {loading ? (
            <View style={s.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <ScrollView style={s.content} showsVerticalScrollIndicator={false}>
              {unitRates.map((rate, index) => (
                <View
                  key={`${rate.unitType}-${rate.customUnitLabel || ''}`}
                  style={s.rateCard}
                >
                  <View style={s.rateHeader}>
                    <Text style={s.unitLabel}>{rate.displayLabel}</Text>
                    {rate.isPaneType && (
                      <TouchableOpacity
                        style={s.expandBtn}
                        onPress={() => toggleExpanded(index)}
                      >
                        <Text style={s.expandBtnText}>By style</Text>
                        {rate.expanded ? (
                          <ChevronDown size={14} color={colors.primary} />
                        ) : (
                          <ChevronRight size={14} color={colors.primary} />
                        )}
                      </TouchableOpacity>
                    )}
                  </View>

                  {rate.isPaneType && rate.expanded ? (
                    <View style={s.paneSection}>
                      {orgPaneStyles.map((style) => (
                        <View key={style} style={s.paneRow}>
                          <Text style={s.paneLabel}>{orgPaneStyleLabels[style] || PANE_STYLE_LABELS[style]}</Text>
                          <View style={s.paneInputWrap}>
                            <TextInput
                              style={[s.paneInput, noOutline]}
                              placeholder="0"
                              placeholderTextColor={colors.border}
                              keyboardType="decimal-pad"
                              value={rate.paneStyleRates[style]}
                              onChangeText={(v) => updatePaneStyleRate(index, style, v)}
                            />
                            <Text style={s.paneInputSuffix}>/hr</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View style={s.singleInputWrap}>
                      <TextInput
                        style={[s.singleInput, noOutline]}
                        placeholder="0"
                        placeholderTextColor={colors.textSecondary}
                        keyboardType="decimal-pad"
                        value={rate.unitsPerHour}
                        onChangeText={(v) => updateBlendedRate(index, v)}
                      />
                      <Text style={s.singleInputSuffix}>
                        {rate.isPaneType ? 'panes/hr' : 'units/hr'}
                      </Text>
                    </View>
                  )}
                </View>
              ))}

              {(availableSuggestions.length > 0 || true) && (
                <View style={s.addSection}>
                  <Text style={s.addSectionTitle}>Add Measurement Type</Text>

                  {availableSuggestions.length > 0 && (
                    <View style={s.chipsWrap}>
                      {availableSuggestions.map((s2) => {
                        const key = `${s2.unitType}|${s2.customUnitLabel || ''}`;
                        return (
                          <TouchableOpacity
                            key={key}
                            style={[s.chip, s2.isCustom && s.chipCustom]}
                            onPress={() => handleAddSuggestion(s2)}
                          >
                            <Plus size={12} color={colors.primary} />
                            <Text style={[s.chipText, s2.isCustom && s.chipTextCustom]}>
                              {s2.displayLabel}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}

                  {showCustomInput ? (
                    <View style={s.customInputRow}>
                      <TextInput
                        style={[s.customInput, noOutline]}
                        placeholder="e.g. Rooms, Gutters, Sections..."
                        placeholderTextColor={colors.textSecondary}
                        value={newUnitLabel}
                        onChangeText={setNewUnitLabel}
                        autoFocus
                      />
                      <TouchableOpacity
                        style={[s.customConfirmBtn, (!newUnitLabel.trim() || addingUnit) && s.customConfirmBtnDisabled]}
                        onPress={handleAddCustomUnit}
                        disabled={!newUnitLabel.trim() || addingUnit}
                      >
                        <LinearGradient colors={['#1B4D6E', '#245d82']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.customConfirmBtnGradient}>
                          {addingUnit ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Check size={16} color="#fff" />
                          )}
                        </LinearGradient>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={s.customCancelBtn}
                        onPress={() => { setShowCustomInput(false); setNewUnitLabel(''); }}
                      >
                        <X size={16} color={colors.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={s.createCustomBtn}
                      onPress={() => setShowCustomInput(true)}
                    >
                      <Plus size={14} color={colors.textSecondary} />
                      <Text style={s.createCustomText}>Create custom unit...</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </ScrollView>
          )}

          <View style={s.footer}>
            <TouchableOpacity
              style={[s.saveButton, (saving || loading) && s.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving || loading}
            >
              <LinearGradient colors={['#1B4D6E', '#245d82']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.saveButtonGradient}>
                <Save size={18} color="#fff" />
                <Text style={s.saveButtonText}>
                  {saving ? 'Saving...' : 'Save Production Rates'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const getStyles = (colors: any) =>
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
    headerContent: { flex: 1 },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
    },
    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 2,
    },
    description: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 8,
    },
    descriptionText: {
      flex: 1,
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    content: {
      padding: 16,
      maxHeight: 480,
    },
    loadingContainer: {
      padding: 40,
      alignItems: 'center',
    },
    rateCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    rateHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    unitLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      flex: 1,
      marginRight: 8,
    },
    expandBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: colors.inputBackground,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      flexShrink: 0,
    },
    expandBtnText: {
      fontSize: 12,
      color: colors.primary,
      fontWeight: '500',
    },
    singleInputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.inputBackground,
      borderRadius: 8,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    singleInput: {
      flex: 1,
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      paddingVertical: 10,
    },
    singleInputSuffix: {
      fontSize: 13,
      color: colors.textSecondary,
      marginLeft: 6,
      flexShrink: 0,
    },
    paneSection: {
      gap: 6,
    },
    paneRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    paneLabel: {
      fontSize: 14,
      color: colors.text,
      flex: 1,
    },
    paneInputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.inputBackground,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderWidth: 0,
      flexShrink: 0,
    },
    paneInput: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'right',
      minWidth: 40,
      maxWidth: 70,
    },
    paneInputSuffix: {
      fontSize: 12,
      color: colors.textSecondary,
      marginLeft: 3,
    },
    addSection: {
      marginTop: 4,
      marginBottom: 8,
    },
    addSectionTitle: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 10,
    },
    chipsWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 10,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    chipCustom: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '12',
    },
    chipText: {
      fontSize: 13,
      color: colors.text,
      fontWeight: '500',
    },
    chipTextCustom: {
      color: colors.primary,
    },
    createCustomBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 6,
    },
    createCustomText: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    customInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    customInput: {
      flex: 1,
      backgroundColor: colors.inputBackground,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 9,
      fontSize: 14,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
    },
    customConfirmBtn: {
      borderRadius: 8,
      overflow: 'hidden' as const,
    },
    customConfirmBtnGradient: {
      padding: 9,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    customConfirmBtnDisabled: {
      opacity: 0.4,
    },
    customCancelBtn: {
      backgroundColor: colors.inputBackground,
      borderRadius: 8,
      padding: 9,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    footer: {
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    saveButton: {
      borderRadius: 10,
      overflow: 'hidden' as const,
    },
    saveButtonGradient: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      gap: 8,
      paddingVertical: 14,
    },
    saveButtonDisabled: {
      opacity: 0.5,
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#fff',
    },
  });
