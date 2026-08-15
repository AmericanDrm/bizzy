import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { X, Plus, Trash2, Eye, EyeOff, GripVertical } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';

export interface FinanceCategory {
  id: string;
  name: string;
  type: 'expense' | 'income';
  is_visible: boolean;
  is_default: boolean;
  sort_order: number;
}

interface FinanceCategoriesModalProps {
  visible: boolean;
  initialTab?: 'expense' | 'income';
  onClose: () => void;
  onChanged?: () => void;
}

export default function FinanceCategoriesModal({
  visible,
  initialTab = 'expense',
  onClose,
  onChanged,
}: FinanceCategoriesModalProps) {
  const { colors, isDark } = useTheme();
  const { currentOrganization } = useOrganization();
  const { showToast } = useToast();

  const [activeType, setActiveType] = useState<'expense' | 'income'>(initialTab);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState('');
  const [addingNew, setAddingNew] = useState(false);

  useEffect(() => {
    if (visible) {
      setActiveType(initialTab);
      fetchCategories();
    }
  }, [visible, initialTab]);

  const fetchCategories = useCallback(async () => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('finance_categories')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (err: any) {
      showToast({ message: 'Failed to load categories', type: 'error', duration: 3000 });
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id]);

  const visibleForType = categories.filter(c => c.type === activeType);

  const handleToggleVisibility = async (cat: FinanceCategory) => {
    if (cat.is_default && cat.is_visible) {
      const visibleDefaults = visibleForType.filter(c => c.is_default && c.is_visible);
      if (visibleDefaults.length <= 1) {
        showToast({ message: 'At least one category must remain visible', type: 'error', duration: 3000 });
        return;
      }
    }
    const updated = !cat.is_visible;
    setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, is_visible: updated } : c));
    try {
      const { error } = await supabase
        .from('finance_categories')
        .update({ is_visible: updated })
        .eq('id', cat.id);
      if (error) throw error;
      onChanged?.();
    } catch {
      setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, is_visible: !updated } : c));
      showToast({ message: 'Failed to update category', type: 'error', duration: 3000 });
    }
  };

  const handleDelete = async (cat: FinanceCategory) => {
    if (cat.is_default) {
      showToast({ message: 'Default categories cannot be deleted', type: 'error', duration: 3000 });
      return;
    }

    const doDelete = async () => {
      setCategories(prev => prev.filter(c => c.id !== cat.id));
      try {
        const { error } = await supabase
          .from('finance_categories')
          .delete()
          .eq('id', cat.id);
        if (error) throw error;
        onChanged?.();
      } catch {
        fetchCategories();
        showToast({ message: 'Failed to delete category', type: 'error', duration: 3000 });
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Delete "${cat.name}"? Existing transactions will keep this category label.`)) {
        doDelete();
      }
    } else {
      Alert.alert(
        'Delete Category',
        `Delete "${cat.name}"? Existing transactions will keep this category label.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: doDelete },
        ]
      );
    }
  };

  const handleAddCategory = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (!currentOrganization?.id) return;

    const duplicate = categories.find(
      c => c.type === activeType && c.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (duplicate) {
      showToast({ message: 'A category with that name already exists', type: 'error', duration: 3000 });
      return;
    }

    setSaving(true);
    const maxOrder = visibleForType.reduce((m, c) => Math.max(m, c.sort_order), -1);
    try {
      const { data, error } = await supabase
        .from('finance_categories')
        .insert({
          organization_id: currentOrganization.id,
          name: trimmed,
          type: activeType,
          is_visible: true,
          is_default: false,
          sort_order: maxOrder + 1,
        })
        .select()
        .single();

      if (error) throw error;
      setCategories(prev => [...prev, data]);
      setNewName('');
      setAddingNew(false);
      onChanged?.();
      showToast({ message: `Category "${trimmed}" added`, type: 'success', duration: 2500 });
    } catch (err: any) {
      showToast({ message: err?.message || 'Failed to add category', type: 'error', duration: 3000 });
    } finally {
      setSaving(false);
    }
  };

  const surfaceBg = isDark ? colors.surface : '#ffffff';
  const inputBg = isDark ? 'rgba(255,255,255,0.07)' : '#f4f6f9';
  const borderColor = isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: surfaceBg }]}>
          <View style={[styles.header, { borderBottomColor: borderColor }]}>
            <Text style={[styles.title, { color: colors.text }]}>Manage Categories</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={[styles.typeRow, { borderBottomColor: borderColor }]}>
            {(['expense', 'income'] as const).map(t => (
              <TouchableOpacity
                key={t}
                style={[
                  styles.typeTab,
                  activeType === t && {
                    borderBottomColor: t === 'expense' ? '#dc2626' : '#16a34a',
                    borderBottomWidth: 2,
                  },
                ]}
                onPress={() => { setActiveType(t); setAddingNew(false); setNewName(''); }}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.typeTabText,
                  {
                    color: activeType === t
                      ? (t === 'expense' ? '#dc2626' : '#16a34a')
                      : colors.textSecondary,
                    fontWeight: activeType === t ? '700' : '500',
                  },
                ]}>
                  {t === 'expense' ? 'Expenses' : 'Income'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <ScrollView
              style={styles.list}
              contentContainerStyle={{ paddingBottom: 20 }}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
                Toggle visibility to show or hide categories in the entry form.
                Custom categories can be deleted; defaults can only be hidden.
              </Text>

              {visibleForType.map(cat => (
                <View
                  key={cat.id}
                  style={[styles.categoryRow, { borderColor, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#fafafa' }]}
                >
                  <GripVertical size={16} color={colors.textSecondary} style={{ opacity: 0.4 }} />
                  <View style={styles.categoryInfo}>
                    <Text style={[styles.categoryName, { color: cat.is_visible ? colors.text : colors.textSecondary }]}>
                      {cat.name}
                    </Text>
                    {cat.is_default && (
                      <Text style={[styles.defaultBadge, { color: colors.textSecondary }]}>default</Text>
                    )}
                  </View>
                  <View style={styles.categoryActions}>
                    <TouchableOpacity
                      onPress={() => handleToggleVisibility(cat)}
                      style={styles.iconBtn}
                      activeOpacity={0.7}
                    >
                      {cat.is_visible
                        ? <Eye size={18} color={activeType === 'expense' ? '#dc2626' : '#16a34a'} />
                        : <EyeOff size={18} color={colors.textSecondary} />
                      }
                    </TouchableOpacity>
                    {!cat.is_default && (
                      <TouchableOpacity
                        onPress={() => handleDelete(cat)}
                        style={styles.iconBtn}
                        activeOpacity={0.7}
                      >
                        <Trash2 size={18} color='#dc2626' />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}

              {addingNew ? (
                <View style={[styles.addRow, { borderColor, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f0f9ff' }]}>
                  <TextInput
                    style={[styles.addInput, { backgroundColor: inputBg, color: colors.text, borderColor }]}
                    value={newName}
                    onChangeText={setNewName}
                    placeholder="Category name"
                    placeholderTextColor={colors.textSecondary}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={handleAddCategory}
                    maxLength={40}
                  />
                  <View style={styles.addRowActions}>
                    <TouchableOpacity
                      style={[styles.addConfirmBtn, { backgroundColor: activeType === 'expense' ? '#dc2626' : '#16a34a', opacity: saving ? 0.7 : 1 }]}
                      onPress={handleAddCategory}
                      disabled={saving || !newName.trim()}
                      activeOpacity={0.8}
                    >
                      {saving ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.addConfirmText}>Add</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.addCancelBtn, { borderColor }]}
                      onPress={() => { setAddingNew(false); setNewName(''); }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.addCancelText, { color: colors.textSecondary }]}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.addNewBtn, { borderColor: activeType === 'expense' ? '#dc2626' : '#16a34a' }]}
                  onPress={() => setAddingNew(true)}
                  activeOpacity={0.7}
                >
                  <Plus size={16} color={activeType === 'expense' ? '#dc2626' : '#16a34a'} />
                  <Text style={[styles.addNewText, { color: activeType === 'expense' ? '#dc2626' : '#16a34a' }]}>
                    Add Custom Category
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modal: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    minHeight: 400,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  typeRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: 20,
  },
  typeTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  typeTabText: {
    fontSize: 14,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  list: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  sectionHint: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 14,
    marginTop: 2,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  categoryInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryName: {
    fontSize: 15,
    fontWeight: '500',
  },
  defaultBadge: {
    fontSize: 11,
    fontWeight: '400',
    fontStyle: 'italic',
  },
  categoryActions: {
    flexDirection: 'row',
    gap: 4,
  },
  iconBtn: {
    padding: 6,
    borderRadius: 6,
  },
  addRow: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  addInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  addRowActions: {
    flexDirection: 'row',
    gap: 8,
  },
  addConfirmBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addConfirmText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  addCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  addCancelText: {
    fontWeight: '600',
    fontSize: 15,
  },
  addNewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    marginTop: 4,
  },
  addNewText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
