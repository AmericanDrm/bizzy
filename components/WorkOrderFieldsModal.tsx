import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Check, Plus, Trash2, GripVertical } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

const ALL_FIELDS = [
  { key: 'client_name', label: 'Client Name' },
  { key: 'client_phone', label: 'Phone Number' },
  { key: 'job_type', label: 'Job Type' },
  { key: 'scope', label: 'Scope of Work' },
  { key: 'notes', label: 'Notes' },
  { key: 'scheduled_date', label: 'Scheduled Date' },
  { key: 'scheduled_time', label: 'Scheduled Time' },
  { key: 'location', label: 'Location' },
  { key: 'address', label: 'Address' },
  { key: 'crew_size', label: 'Crew Size' },
  { key: 'amount', label: 'Amount' },
];

interface WorkOrderFieldsModalProps {
  visible: boolean;
  workOrderId: string;
  currentFields: string[];
  currentCustomFields: Record<string, string>;
  onClose: () => void;
  onSave: () => void;
}

export default function WorkOrderFieldsModal({
  visible,
  workOrderId,
  currentFields,
  currentCustomFields,
  onClose,
  onSave,
}: WorkOrderFieldsModalProps) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [selectedFields, setSelectedFields] = useState<string[]>(currentFields);
  const [customFields, setCustomFields] = useState<Record<string, string>>(currentCustomFields || {});
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldValue, setNewFieldValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      setSelectedFields(currentFields);
      setCustomFields(currentCustomFields || {});
      setError('');
    }
  }, [visible, currentFields, currentCustomFields]);

  const toggleField = (key: string) => {
    setSelectedFields((prev) =>
      prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]
    );
  };

  const addCustomField = () => {
    if (!newFieldName.trim()) return;
    setCustomFields((prev) => ({ ...prev, [newFieldName.trim()]: newFieldValue.trim() }));
    setNewFieldName('');
    setNewFieldValue('');
  };

  const removeCustomField = (key: string) => {
    setCustomFields((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleSave = async () => {
    setLoading(true);
    setError('');
    try {
      const { error: updateError } = await supabase
        .from('work_orders')
        .update({
          visible_fields: selectedFields,
          custom_fields: customFields,
          updated_at: new Date().toISOString(),
        })
        .eq('id', workOrderId)
        .eq('user_id', user?.id);

      if (updateError) throw updateError;
      onSave();
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.container, { backgroundColor: colors.card }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text }]}>Configure Fields</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
            {error ? (
              <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
            ) : null}

            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
              Standard Fields
            </Text>
            <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
              Toggle which fields appear on the work order sheet
            </Text>

            {ALL_FIELDS.map((field) => {
              const isSelected = selectedFields.includes(field.key);
              return (
                <TouchableOpacity
                  key={field.key}
                  style={[styles.fieldItem, { borderBottomColor: colors.border }]}
                  onPress={() => toggleField(field.key)}
                >
                  <Text style={[styles.fieldLabel, { color: colors.text }]}>{field.label}</Text>
                  <View
                    style={[
                      styles.checkbox,
                      {
                        backgroundColor: isSelected ? colors.primary : 'transparent',
                        borderColor: isSelected ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    {isSelected && <Check size={14} color="#fff" />}
                  </View>
                </TouchableOpacity>
              );
            })}

            <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: 24 }]}>
              Custom Fields
            </Text>

            {Object.entries(customFields).map(([key, value]) => (
              <View key={key} style={[styles.customFieldRow, { borderBottomColor: colors.border }]}>
                <View style={styles.customFieldInfo}>
                  <Text style={[styles.customFieldName, { color: colors.text }]}>{key}</Text>
                  <Text style={[styles.customFieldValue, { color: colors.textSecondary }]} numberOfLines={1}>
                    {value}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => removeCustomField(key)} style={styles.removeButton}>
                  <Trash2 size={16} color={colors.error} />
                </TouchableOpacity>
              </View>
            ))}

            <View style={[styles.addFieldRow, { borderColor: colors.border }]}>
              <TextInput
                style={[styles.addFieldInput, { color: colors.text, borderColor: colors.border }]}
                placeholder="Field name"
                placeholderTextColor={colors.textSecondary}
                value={newFieldName}
                onChangeText={setNewFieldName}
              />
              <TextInput
                style={[styles.addFieldInput, { color: colors.text, borderColor: colors.border, flex: 1.5 }]}
                placeholder="Value"
                placeholderTextColor={colors.textSecondary}
                value={newFieldValue}
                onChangeText={setNewFieldValue}
              />
              <TouchableOpacity
                style={[styles.addButton, { opacity: newFieldName.trim() ? 1 : 0.4 }]}
                onPress={addCustomField}
                disabled={!newFieldName.trim()}
              >
                <LinearGradient
                  colors={['#1B4D6E', '#245d82']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.addButtonGradient}
                >
                  <Plus size={18} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity style={[styles.cancelButton, { borderColor: colors.border }]} onPress={onClose}>
              <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, { opacity: loading ? 0.6 : 1 }]}
              onPress={handleSave}
              disabled={loading}
            >
              <LinearGradient
                colors={['#1B4D6E', '#245d82']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.saveButtonGradient}
              >
                <Text style={styles.saveText}>{loading ? 'Saving...' : 'Save'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  container: {
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
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: 20,
    paddingBottom: 20,
  },
  errorText: {
    fontSize: 14,
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  sectionHint: {
    fontSize: 13,
    marginBottom: 16,
  },
  fieldItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customFieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  customFieldInfo: {
    flex: 1,
    gap: 2,
  },
  customFieldName: {
    fontSize: 14,
    fontWeight: '600',
  },
  customFieldValue: {
    fontSize: 13,
  },
  removeButton: {
    padding: 8,
  },
  addFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  addFieldInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    overflow: 'hidden',
  },
  addButtonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  saveButtonGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});
