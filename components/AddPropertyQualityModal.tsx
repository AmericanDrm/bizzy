import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X, ChevronDown, Check } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

export type UnitType = 'linear_ft' | 'sqft' | 'pane' | 'item' | 'custom';

export interface PropertyQualityDraft {
  label: string;
  unit_type: UnitType;
  custom_unit_label: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onAdd: (draft: PropertyQualityDraft) => void;
}

const UNIT_OPTIONS: { value: UnitType; label: string; description: string }[] = [
  { value: 'linear_ft', label: 'Linear Feet', description: 'e.g., gutters, fence lines, edges' },
  { value: 'sqft', label: 'Square Feet', description: 'e.g., driveways, decks, lawns' },
  { value: 'pane', label: 'Pane Count', description: 'e.g., windows, glass panels' },
  { value: 'item', label: 'Item Count', description: 'e.g., screens, vents, fixtures' },
  { value: 'custom', label: 'Custom Unit', description: 'Define your own measurement label' },
];

const QUICK_PRESETS: { label: string; unit_type: UnitType }[] = [
  { label: 'Gutter Cleaning', unit_type: 'linear_ft' },
  { label: 'Screen Cleaning', unit_type: 'item' },
  { label: 'Solar Panels', unit_type: 'item' },
  { label: 'Roof Edge', unit_type: 'linear_ft' },
  { label: 'Driveway', unit_type: 'sqft' },
  { label: 'Deck / Patio', unit_type: 'sqft' },
  { label: 'Fence Line', unit_type: 'linear_ft' },
  { label: 'Skylights', unit_type: 'pane' },
];

export default function AddPropertyQualityModal({ visible, onClose, onAdd }: Props) {
  const [label, setLabel] = useState('');
  const [unitType, setUnitType] = useState<UnitType>('linear_ft');
  const [customUnitLabel, setCustomUnitLabel] = useState('');
  const [showUnitPicker, setShowUnitPicker] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setLabel('');
    setUnitType('linear_ft');
    setCustomUnitLabel('');
    setShowUnitPicker(false);
    setError('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handlePreset = (preset: { label: string; unit_type: UnitType }) => {
    setLabel(preset.label);
    setUnitType(preset.unit_type);
    setError('');
  };

  const handleAdd = () => {
    if (!label.trim()) {
      setError('A label is required (e.g., "Gutter Cleaning").');
      return;
    }
    if (unitType === 'custom' && !customUnitLabel.trim()) {
      setError('Please enter a custom unit label.');
      return;
    }
    onAdd({ label: label.trim(), unit_type: unitType, custom_unit_label: customUnitLabel.trim() });
    reset();
  };

  const selectedUnit = UNIT_OPTIONS.find(u => u.value === unitType)!;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Add Measurement Category</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={22} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionLabel}>Quick-Add Presets</Text>
            <View style={styles.presetsGrid}>
              {QUICK_PRESETS.map(preset => (
                <TouchableOpacity
                  key={preset.label}
                  style={[styles.presetChip, label === preset.label && unitType === preset.unit_type && styles.presetChipActive]}
                  onPress={() => handlePreset(preset)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.presetChipText, label === preset.label && unitType === preset.unit_type && styles.presetChipTextActive]}>
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.divider} />

            <Text style={styles.sectionLabel}>Custom Category</Text>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Label</Text>
              <TextInput
                style={styles.input}
                value={label}
                onChangeText={v => { setLabel(v); setError(''); }}
                placeholder="e.g., Gutter Cleaning, Fence Line…"
                placeholderTextColor="#b0b8c4"
                autoCapitalize="words"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Unit Type</Text>
              <TouchableOpacity style={styles.unitSelector} onPress={() => setShowUnitPicker(p => !p)} activeOpacity={0.8}>
                <View style={styles.unitSelectorLeft}>
                  <Text style={styles.unitSelectorLabel}>{selectedUnit.label}</Text>
                  <Text style={styles.unitSelectorDesc}>{selectedUnit.description}</Text>
                </View>
                <ChevronDown size={18} color="#64748b" style={{ transform: [{ rotate: showUnitPicker ? '180deg' : '0deg' }] }} />
              </TouchableOpacity>

              {showUnitPicker && (
                <View style={styles.unitDropdown}>
                  {UNIT_OPTIONS.map(opt => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.unitOption, unitType === opt.value && styles.unitOptionActive]}
                      onPress={() => { setUnitType(opt.value); setShowUnitPicker(false); setError(''); }}
                      activeOpacity={0.8}
                    >
                      <View style={styles.unitOptionText}>
                        <Text style={[styles.unitOptionLabel, unitType === opt.value && styles.unitOptionLabelActive]}>{opt.label}</Text>
                        <Text style={styles.unitOptionDesc}>{opt.description}</Text>
                      </View>
                      {unitType === opt.value && <Check size={16} color="#1B4D6E" />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {unitType === 'custom' && (
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Custom Unit Label</Text>
                <TextInput
                  style={styles.input}
                  value={customUnitLabel}
                  onChangeText={v => { setCustomUnitLabel(v); setError(''); }}
                  placeholder="e.g., bags, gallons, panels…"
                  placeholderTextColor="#b0b8c4"
                  autoCapitalize="none"
                />
              </View>
            )}

            {!!error && <Text style={styles.error}>{error}</Text>}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleClose} activeOpacity={0.8}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.addBtn, { overflow: 'hidden' }]} onPress={handleAdd} activeOpacity={0.85}>
              <LinearGradient
                colors={['#1B4D6E', '#245d82']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.addBtnGradient}
              >
                <Text style={styles.addBtnText}>Add Category</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  presetChip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  presetChipActive: {
    borderColor: '#1B4D6E',
    backgroundColor: '#e8f0f8',
  },
  presetChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#475569',
  },
  presetChipTextActive: {
    color: '#1B4D6E',
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 18,
  },
  field: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  unitSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#f8fafc',
  },
  unitSelectorLeft: {
    flex: 1,
  },
  unitSelectorLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  unitSelectorDesc: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 1,
  },
  unitDropdown: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  unitOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  unitOptionActive: {
    backgroundColor: '#f0f7ff',
  },
  unitOptionText: {
    flex: 1,
  },
  unitOptionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#334155',
  },
  unitOptionLabelActive: {
    color: '#1B4D6E',
    fontWeight: '700',
  },
  unitOptionDesc: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 1,
  },
  error: {
    fontSize: 13,
    color: '#dc2626',
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748b',
  },
  addBtn: {
    flex: 2,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnGradient: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
