import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Modal,
  KeyboardAvoidingView,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { X, TrendingDown, TrendingUp, Check, ChevronDown } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
import { useSmartDefaults } from '@/hooks/useSmartDefaults';
import { SPACING } from '@/constants/designSystem';

export type QuickEntryMode = 'expense' | 'income';

interface QuickEntryBottomSheetProps {
  visible: boolean;
  initialMode?: QuickEntryMode;
  onClose: () => void;
  onSaved?: () => void;
}

const FALLBACK_EXPENSE_CATEGORIES = [
  'Materials', 'Equipment', 'Travel', 'Marketing',
  'Office Supplies', 'Software', 'Insurance', 'Utilities', 'Rent', 'Other',
];

const FALLBACK_INCOME_CATEGORIES = [
  'Service Payment', 'Product Sale', 'Consulting', 'Commission', 'Other',
];

const SPRING = { damping: 28, stiffness: 340 };

export default function QuickEntryBottomSheet({
  visible,
  initialMode = 'expense',
  onClose,
  onSaved,
}: QuickEntryBottomSheetProps) {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const { showToast } = useToast();
  const { save: saveDefault, loadMany } = useSmartDefaults();

  const [mode, setMode] = useState<QuickEntryMode>(initialMode);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [showCategories, setShowCategories] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dynamicExpenseCategories, setDynamicExpenseCategories] = useState<string[]>([]);
  const [dynamicIncomeCategories, setDynamicIncomeCategories] = useState<string[]>([]);

  const translateY = useSharedValue(600);
  const opacity = useSharedValue(0);
  const amountRef = useRef<TextInput>(null);

  const categories = useMemo(() => {
    if (mode === 'expense') {
      return dynamicExpenseCategories.length > 0 ? dynamicExpenseCategories : FALLBACK_EXPENSE_CATEGORIES;
    }
    return dynamicIncomeCategories.length > 0 ? dynamicIncomeCategories : FALLBACK_INCOME_CATEGORIES;
  }, [mode, dynamicExpenseCategories, dynamicIncomeCategories]);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 200 });
      translateY.value = withSpring(0, SPRING);
      loadDefaults();
      fetchCategories();
      setTimeout(() => amountRef.current?.focus(), 350);
    } else {
      opacity.value = withTiming(0, { duration: 180 });
      translateY.value = withSpring(600, SPRING);
    }
  }, [visible]);

  useEffect(() => {
    if (visible) loadDefaults();
  }, [mode, visible]);

  const fetchCategories = useCallback(async () => {
    if (!currentOrganization?.id) return;
    try {
      const { data: expData } = await supabase
        .from('finance_categories')
        .select('name')
        .eq('organization_id', currentOrganization.id)
        .eq('type', 'expense')
        .eq('is_visible', true)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });
      if (expData && expData.length > 0) setDynamicExpenseCategories(expData.map(c => c.name));

      const { data: incData } = await supabase
        .from('finance_categories')
        .select('name')
        .eq('organization_id', currentOrganization.id)
        .eq('type', 'income')
        .eq('is_visible', true)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });
      if (incData && incData.length > 0) setDynamicIncomeCategories(incData.map(c => c.name));
    } catch {
      // keep fallbacks
    }
  }, [currentOrganization?.id]);

  const loadDefaults = async () => {
    const key = mode === 'expense' ? 'lastExpenseCategory' : 'lastIncomeCategory';
    const defaults = await loadMany([key]);
    const saved = defaults[key];
    if (saved && !category) setCategory(saved);
  };

  const handleDismiss = useCallback(() => {
    setAmount('');
    setDescription('');
    setCategory('');
    setShowCategories(false);
    onClose();
  }, [onClose]);

  const handleSave = async () => {
    const parsed = parseFloat(amount.replace(',', '.'));
    if (!parsed || parsed <= 0) {
      showToast({ message: 'Enter a valid amount', type: 'error', duration: 2000 });
      return;
    }
    if (!currentOrganization?.id || !user?.id) return;

    setSaving(true);
    try {
      const table = mode === 'expense' ? 'expenses' : 'income';
      const finalCategory = category || (mode === 'expense' ? 'Other' : 'Service Payment');
      const payload: any = {
        amount: parsed,
        description: description.trim() || finalCategory,
        category: finalCategory,
        date: new Date().toISOString().split('T')[0],
        organization_id: currentOrganization.id,
        user_id: user.id,
      };

      const { error } = await supabase.from(table).insert(payload);
      if (error) throw error;

      const catKey = mode === 'expense' ? 'lastExpenseCategory' : 'lastIncomeCategory';
      await saveDefault(catKey, finalCategory);
      await saveDefault('lastFinanceTab', mode);

      showToast({
        message: `${mode === 'expense' ? 'Expense' : 'Income'} logged — $${parsed.toFixed(2)}`,
        type: 'success',
        duration: 2500,
      });
      setAmount('');
      setDescription('');
      onSaved?.();
      handleDismiss();
    } catch (err: any) {
      showToast({ message: err?.message || 'Failed to save', type: 'error', duration: 3000 });
    } finally {
      setSaving(false);
    }
  };

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (!visible && translateY.value === 600) return null;

  const accentColor = mode === 'expense' ? '#dc2626' : '#16a34a';
  const surfaceBg = isDark ? colors.surface : '#ffffff';
  const inputBg = isDark ? 'rgba(255,255,255,0.07)' : '#f4f6f9';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleDismiss} />
        </Animated.View>

        <Animated.View style={[styles.sheet, { backgroundColor: surfaceBg }, sheetStyle]}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={styles.modeSwitcher}>
              <TouchableOpacity
                style={[styles.modeTab, mode === 'expense' && { borderBottomColor: '#dc2626', borderBottomWidth: 2 }]}
                onPress={() => { setMode('expense'); setCategory(''); }}
                activeOpacity={0.7}
              >
                <TrendingDown size={15} color={mode === 'expense' ? '#dc2626' : colors.textSecondary} />
                <Text style={[styles.modeTabText, { color: mode === 'expense' ? '#dc2626' : colors.textSecondary }]}>
                  Expense
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeTab, mode === 'income' && { borderBottomColor: '#16a34a', borderBottomWidth: 2 }]}
                onPress={() => { setMode('income'); setCategory(''); }}
                activeOpacity={0.7}
              >
                <TrendingUp size={15} color={mode === 'income' ? '#16a34a' : colors.textSecondary} />
                <Text style={[styles.modeTabText, { color: mode === 'income' ? '#16a34a' : colors.textSecondary }]}>
                  Income
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={handleDismiss} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            <View style={[styles.amountRow, { borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb' }]}>
              <Text style={[styles.currencySymbol, { color: accentColor }]}>$</Text>
              <TextInput
                ref={amountRef}
                style={[styles.amountInput, { color: colors.text }]}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.2)' : '#c0c8d4'}
                keyboardType="decimal-pad"
                returnKeyType="next"
                selectionColor={accentColor}
              />
            </View>

            <TouchableOpacity
              style={[styles.categoryPicker, { backgroundColor: inputBg }]}
              onPress={() => setShowCategories(!showCategories)}
              activeOpacity={0.75}
            >
              <Text style={[styles.categoryLabel, { color: category ? colors.text : colors.textSecondary }]}>
                {category || 'Select category'}
              </Text>
              <ChevronDown
                size={16}
                color={colors.textSecondary}
                style={{ transform: [{ rotate: showCategories ? '180deg' : '0deg' }] }}
              />
            </TouchableOpacity>

            {showCategories && (
              <ScrollView
                style={[styles.categoryList, { backgroundColor: inputBg }]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {categories.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryItem,
                      category === cat && { backgroundColor: accentColor + '18' },
                    ]}
                    onPress={() => { setCategory(cat); setShowCategories(false); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.categoryItemText, { color: category === cat ? accentColor : colors.text }]}>
                      {cat}
                    </Text>
                    {category === cat && <Check size={14} color={accentColor} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <TextInput
              style={[styles.descInput, { backgroundColor: inputBg, color: colors.text }]}
              value={description}
              onChangeText={setDescription}
              placeholder="Description (optional)"
              placeholderTextColor={colors.textSecondary}
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: accentColor, opacity: saving ? 0.7 : 1 }]}
              onPress={handleSave}
              activeOpacity={0.85}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Check size={18} color="#fff" />
                  <Text style={styles.saveBtnText}>
                    Log {mode === 'expense' ? 'Expense' : 'Income'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    ...Platform.select({
      web: { boxShadow: '0 -8px 32px rgba(0,0,0,0.18)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 20,
      },
    }),
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.18)',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
  },
  modeSwitcher: {
    flexDirection: 'row',
    gap: SPACING.xl,
  },
  modeTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  modeTabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  body: {
    paddingHorizontal: SPACING.xl,
    gap: SPACING.md,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingBottom: 12,
    marginBottom: 4,
  },
  currencySymbol: {
    fontSize: 32,
    fontWeight: '700',
    marginRight: 6,
    lineHeight: 42,
  },
  amountInput: {
    flex: 1,
    fontSize: 42,
    fontWeight: '700',
    letterSpacing: -1,
    padding: 0,
  },
  categoryPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 12,
  },
  categoryLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  categoryList: {
    borderRadius: 12,
    maxHeight: 180,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 8,
  },
  categoryItemText: {
    fontSize: 14,
    fontWeight: '500',
  },
  descInput: {
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 12,
    fontSize: 15,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 14,
    marginTop: 4,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
