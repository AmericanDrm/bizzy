import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { X, Repeat, ChevronDown, CalendarDays } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import DatePicker from './DatePicker';
import CollapsibleField from './CollapsibleField';
import { useCollapsibleForm } from '@/hooks/useCollapsibleForm';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useSmartDefaults } from '@/hooks/useSmartDefaults';
import { useRegisterModal } from '@/contexts/ModalStackContext';
import { useOrganization } from '@/contexts/OrganizationContext';

interface RecentJob {
  id: string;
  title: string;
  date: string;
  client_name: string;
}

interface FinanceItem {
  id: string;
  amount: number;
  description: string;
  date: string;
  category: string;
  type: 'income' | 'expense';
  is_recurring?: boolean;
  recurrence_type?: string;
  recurrence_interval?: number;
  recurrence_end_date?: string;
}

type RecurrenceType = 'weekly' | 'biweekly' | 'monthly' | 'yearly';

const RECURRENCE_OPTIONS: { label: string; value: RecurrenceType }[] = [
  { label: 'Weekly', value: 'weekly' },
  { label: 'Bi-weekly', value: 'biweekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Yearly', value: 'yearly' },
];

interface FinanceModalProps {
  visible: boolean;
  type: 'income' | 'expense';
  item: FinanceItem | null;
  onClose: () => void;
  onSave: () => void;
}

const FALLBACK_INCOME_CATEGORIES = [
  'Service Payment', 'Product Sale', 'Consulting', 'Commission', 'Other',
];

const FALLBACK_EXPENSE_CATEGORIES = [
  'Materials', 'Equipment', 'Travel', 'Marketing', 'Office Supplies',
  'Software', 'Insurance', 'Utilities', 'Rent', 'Other',
];

const PAYMENT_METHODS = [
  { label: 'Cash', value: 'cash' },
  { label: 'Credit Card', value: 'credit_card' },
  { label: 'Debit Card', value: 'debit_card' },
  { label: 'Check', value: 'check' },
  { label: 'Venmo', value: 'venmo' },
  { label: 'Cash App', value: 'cashapp' },
  { label: 'PayPal', value: 'paypal' },
  { label: 'Zelle', value: 'zelle' },
  { label: 'Bank Transfer', value: 'bank_transfer' },
  { label: 'Other', value: 'other' },
];

export default function FinanceModal({
  visible,
  type,
  item,
  onClose,
  onSave,
}: FinanceModalProps) {
  useRegisterModal('finance-modal', visible, onClose);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('monthly');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [showJobDropdown, setShowJobDropdown] = useState(false);
  const [descriptionMode, setDescriptionMode] = useState<'job' | 'custom'>('job');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [showPaymentMethodPicker, setShowPaymentMethodPicker] = useState(false);
  const [dynamicCategories, setDynamicCategories] = useState<string[]>([]);
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [savingCustomCategory, setSavingCustomCategory] = useState(false);
  const [customCategoryError, setCustomCategoryError] = useState('');
  const { activeFieldId, toggleField } = useCollapsibleForm();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { save: saveDefault, load: loadDefault } = useSmartDefaults();
  const { currentOrganization } = useOrganization();

  const fetchDynamicCategories = useCallback(async (catType: 'income' | 'expense') => {
    if (!currentOrganization?.id) return;
    try {
      const { data } = await supabase
        .from('finance_categories')
        .select('name')
        .eq('organization_id', currentOrganization.id)
        .eq('type', catType)
        .eq('is_visible', true)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });
      if (data && data.length > 0) {
        setDynamicCategories(data.map(c => c.name));
      } else {
        setDynamicCategories(catType === 'income' ? FALLBACK_INCOME_CATEGORIES : FALLBACK_EXPENSE_CATEGORIES);
      }
    } catch {
      setDynamicCategories(catType === 'income' ? FALLBACK_INCOME_CATEGORIES : FALLBACK_EXPENSE_CATEGORIES);
    }
  }, [currentOrganization?.id]);

  const handleSaveCustomCategory = useCallback(async () => {
    const trimmed = customCategoryInput.trim();
    if (!trimmed) {
      setCustomCategoryError('Category name cannot be empty');
      return;
    }
    const allCats = dynamicCategories.length > 0
      ? dynamicCategories
      : (type === 'income' ? FALLBACK_INCOME_CATEGORIES : FALLBACK_EXPENSE_CATEGORIES);
    if (allCats.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      setCustomCategoryError('A category with that name already exists');
      return;
    }
    if (!currentOrganization?.id) return;
    setSavingCustomCategory(true);
    setCustomCategoryError('');
    try {
      // Determine next sort_order so the new custom category appears after defaults
      const { data: existing } = await supabase
        .from('finance_categories')
        .select('sort_order')
        .eq('organization_id', currentOrganization.id)
        .eq('type', type)
        .order('sort_order', { ascending: false })
        .limit(1);
      const maxOrder = existing && existing.length > 0 ? (existing[0].sort_order ?? 0) : 0;
      await supabase.from('finance_categories').insert({
        organization_id: currentOrganization.id,
        name: trimmed,
        type,
        is_visible: true,
        is_default: false,
        sort_order: maxOrder + 1,
      });
      // Refresh category list so the new entry is included
      await fetchDynamicCategories(type);
      setCategory(trimmed);
      if (fieldErrors.category) setFieldErrors(p => ({ ...p, category: '' }));
      setCustomCategoryInput('');
      toggleField('category');
      showToast({ message: `Category "${trimmed}" saved`, type: 'success' });
    } catch (e: any) {
      setCustomCategoryError(e.message || 'Failed to save category');
    } finally {
      setSavingCustomCategory(false);
    }
  }, [customCategoryInput, dynamicCategories, type, currentOrganization?.id, fetchDynamicCategories, fieldErrors.category, toggleField, showToast]);

  useEffect(() => {
    if (visible && type === 'income') {
      fetchRecentJobs();
    }
    if (visible) {
      fetchDynamicCategories(type);
    }
    if (item && item.type === type) {
      setAmount(item.amount.toString());
      setDescription(item.description);
      setDate(item.date);
      setCategory(item.category);
      setDescriptionMode('custom');
      if (type === 'expense') {
        setIsRecurring(item.is_recurring || false);
        setRecurrenceType((item.recurrence_type as RecurrenceType) || 'monthly');
        setRecurrenceEndDate(item.recurrence_end_date || '');
      }
    } else {
      resetForm();
    }
  }, [item, type, visible]);

  const fetchRecentJobs = async () => {
    try {
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
      const fiveDaysAgoStr = fiveDaysAgo.toISOString();

      const { data: events } = await supabase
        .from('schedule_events')
        .select('id, title, start_time, clients(name)')
        .eq('user_id', user!.id)
        .gte('start_time', fiveDaysAgoStr)
        .lte('start_time', new Date().toISOString())
        .order('start_time', { ascending: false });

      if (!events) return;

      const { data: existingIncome } = await supabase
        .from('income')
        .select('schedule_event_id')
        .eq('user_id', user!.id)
        .not('schedule_event_id', 'is', null);

      const usedJobIds = new Set(existingIncome?.map(i => i.schedule_event_id) || []);

      const availableJobs: RecentJob[] = events
        .filter(event => !usedJobIds.has(event.id))
        .map(event => ({
          id: event.id,
          title: event.title,
          date: new Date(event.start_time).toLocaleDateString(),
          client_name: (event.clients as any)?.name || 'Unknown Client',
        }));

      setRecentJobs(availableJobs);
    } catch (error) {
      console.error('Error fetching recent jobs:', error);
    }
  };

  const resetForm = async () => {
    setAmount('');
    setDescription('');
    setDate(new Date().toISOString().split('T')[0]);
    setError('');
    setIsRecurring(false);
    setRecurrenceType('monthly');
    setRecurrenceEndDate('');
    setSelectedJobId(null);
    setDescriptionMode('job');
    setShowJobDropdown(false);
    setPaymentMethod('');
    setShowPaymentMethodPicker(false);
    setFieldErrors({});
    setCustomCategoryInput('');
    setCustomCategoryError('');
    const catKey = type === 'income' ? 'lastIncomeCategory' : 'lastExpenseCategory';
    const saved = await loadDefault(catKey);
    const availableCats = dynamicCategories.length > 0
      ? dynamicCategories
      : (type === 'income' ? FALLBACK_INCOME_CATEGORIES : FALLBACK_EXPENSE_CATEGORIES);
    const fallback = availableCats[0] || '';
    setCategory(saved && availableCats.includes(saved) ? saved : fallback);
  };

  const handleJobSelect = (job: RecentJob) => {
    setSelectedJobId(job.id);
    setDescription(`${job.title} - ${job.client_name}`);
    setShowJobDropdown(false);
    setDescriptionMode('job');
  };

  const handleCustomDescription = () => {
    setSelectedJobId(null);
    setDescription('');
    setShowJobDropdown(false);
    setDescriptionMode('custom');
  };

  const handleSave = async () => {
    const newFieldErrors: Record<string, string> = {};
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) newFieldErrors.amount = 'Enter a valid amount greater than 0';
    if (!description.trim()) newFieldErrors.description = 'Description is required';
    if (!category) newFieldErrors.category = 'Select a category';
    if (Object.keys(newFieldErrors).length > 0) {
      setFieldErrors(newFieldErrors);
      return;
    }
    setFieldErrors({});

    setLoading(true);
    setError('');

    try {
      const table = type === 'income' ? 'income' : 'expenses';
      const data: any = {
        amount: Number(amount),
        description: description.trim(),
        date: date || new Date().toISOString().split('T')[0],
        category,
        updated_at: new Date().toISOString(),
      };

      let linkedInvoiceId: string | null = null;

      if (type === 'income') {
        if (selectedJobId) {
          data.schedule_event_id = selectedJobId;

          const { data: linkedInvoice } = await supabase
            .from('invoices')
            .select('id, total, payment_status')
            .eq('schedule_event_id', selectedJobId)
            .eq('user_id', user!.id)
            .maybeSingle();

          if (linkedInvoice) {
            linkedInvoiceId = linkedInvoice.id;
            data.invoice_id = linkedInvoice.id;

            if (linkedInvoice.payment_status === 'paid') {
              showToast({
                message: 'This invoice has already been marked as paid — income entry will still be saved',
                type: 'warning',
                duration: 5000,
              });
            }
          }
        }
        if (paymentMethod) {
          data.payment_method = paymentMethod;
        }
      }

      if (type === 'expense') {
        data.is_recurring = isRecurring;
        data.recurrence_type = isRecurring ? recurrenceType : null;
        data.recurrence_interval = isRecurring ? 1 : null;
        data.recurrence_end_date = isRecurring && recurrenceEndDate ? recurrenceEndDate : null;
        if (!item) {
          data.last_generated_date = date || new Date().toISOString().split('T')[0];
        }
      }

      if (item && item.id && item.type === type) {
        const { error } = await supabase
          .from(table)
          .update(data)
          .eq('id', item.id)
          .eq('user_id', user!.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from(table).insert({
          ...data,
          user_id: user?.id,
        });

        if (error) throw error;
      }

      if (type === 'income' && linkedInvoiceId) {
        const { data: unpaidInvoice } = await supabase
          .from('invoices')
          .select('id, total')
          .eq('id', linkedInvoiceId)
          .eq('user_id', user!.id)
          .neq('payment_status', 'paid')
          .maybeSingle();

        if (unpaidInvoice) {
          const paidDate = new Date().toISOString();
          await supabase
            .from('invoices')
            .update({
              payment_status: 'paid',
              amount_paid: unpaidInvoice.total,
              paid_date: paidDate,
              payment_method: paymentMethod || null,
              updated_at: paidDate,
            })
            .eq('id', unpaidInvoice.id)
            .eq('user_id', user!.id);
        }
      }

      showToast({ message: 'Transaction saved', type: 'success' });
      const catKey = type === 'income' ? 'lastIncomeCategory' : 'lastExpenseCategory';
      if (category) saveDefault(catKey, category);
      resetForm();
      onSave();
    } catch (error: any) {
      setError(error.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const categories = dynamicCategories.length > 0
    ? dynamicCategories
    : (type === 'income' ? FALLBACK_INCOME_CATEGORIES : FALLBACK_EXPENSE_CATEGORIES);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.header}>
              <Text style={styles.title}>
                {item && item.type === type
                  ? `Edit ${type === 'income' ? 'Income' : 'Expense'}`
                  : `Add ${type === 'income' ? 'Income' : 'Expense'}`}
              </Text>
              <TouchableOpacity onPress={onClose} disabled={loading}>
                <X size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <ScrollView style={styles.form} keyboardShouldPersistTaps="handled">
              <CollapsibleField
                label="Amount"
                fieldId="amount"
                activeFieldId={activeFieldId}
                onToggle={toggleField}
                displayValue={amount ? `$${amount}` : undefined}
                required
                hasError={!!fieldErrors.amount}
              >
                <View style={styles.amountInputContainer}>
                  <Text style={styles.currencySymbol}>$</Text>
                  <TextInput
                    style={styles.amountInput}
                    value={amount}
                    onChangeText={(v) => { setAmount(v); if (fieldErrors.amount) setFieldErrors(p => ({ ...p, amount: '' })); }}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    editable={!loading}
                  />
                </View>
                {fieldErrors.amount ? <Text style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{fieldErrors.amount}</Text> : null}
              </CollapsibleField>

              <CollapsibleField
                label="Description"
                fieldId="description"
                activeFieldId={activeFieldId}
                onToggle={toggleField}
                displayValue={description ? description.substring(0, 40) + (description.length > 40 ? '...' : '') : undefined}
                required
              >
                {type === 'income' && recentJobs.length > 0 && !item ? (
                  <View>
                    <TouchableOpacity
                      style={styles.dropdownButton}
                      onPress={() => setShowJobDropdown(!showJobDropdown)}
                      disabled={loading}
                    >
                      <Text style={styles.dropdownButtonText}>
                        {descriptionMode === 'custom' && description
                          ? description
                          : descriptionMode === 'job' && description
                          ? description
                          : 'Select recent job or enter custom'}
                      </Text>
                      <ChevronDown size={20} color="#666" />
                    </TouchableOpacity>

                    {showJobDropdown && (
                      <View style={styles.dropdownMenu}>
                        <ScrollView style={styles.dropdownScroll}>
                          {recentJobs.map((job) => (
                            <TouchableOpacity
                              key={job.id}
                              style={styles.dropdownItem}
                              onPress={() => handleJobSelect(job)}
                            >
                              <Text style={styles.dropdownItemTitle}>{job.title}</Text>
                              <Text style={styles.dropdownItemSubtitle}>
                                {job.client_name} - {job.date}
                              </Text>
                            </TouchableOpacity>
                          ))}
                          <TouchableOpacity
                            style={[styles.dropdownItem, styles.customOptionItem]}
                            onPress={handleCustomDescription}
                          >
                            <Text style={styles.customOptionText}>Custom Description</Text>
                          </TouchableOpacity>
                        </ScrollView>
                      </View>
                    )}

                    {descriptionMode === 'custom' && (
                      <TextInput
                        style={[styles.input, { marginTop: 8 }]}
                        value={description}
                        onChangeText={setDescription}
                        placeholder="e.g., Payment from Client A"
                        editable={!loading}
                      />
                    )}
                  </View>
                ) : (
                  <TextInput
                    style={styles.input}
                    value={description}
                    onChangeText={setDescription}
                    placeholder={
                      type === 'income'
                        ? 'e.g., Payment from Client A'
                        : 'e.g., Office supplies'
                    }
                    editable={!loading}
                  />
                )}
              </CollapsibleField>

              <CollapsibleField
                label="Date"
                fieldId="date"
                activeFieldId={activeFieldId}
                onToggle={(id) => {
                  toggleField(id);
                  if (activeFieldId !== 'date') {
                    setShowDatePicker(true);
                  }
                }}
                displayValue={date || undefined}
              >
                <TouchableOpacity
                  style={styles.picker}
                  onPress={() => !loading && setShowDatePicker(true)}
                >
                  <Text style={[styles.pickerText, !date && { color: '#999' }]}>
                    {date || 'Select Date'}
                  </Text>
                  <CalendarDays size={18} color="#666" />
                </TouchableOpacity>
              </CollapsibleField>

              <CollapsibleField
                label="Category"
                fieldId="category"
                activeFieldId={activeFieldId}
                onToggle={toggleField}
                displayValue={category || undefined}
                hasError={!!fieldErrors.category}
              >
                <View style={styles.categoryContainer}>
                  {categories.map((cat) => {
                    const isOther = cat === 'Other';
                    const isSelected = category === cat || (isOther && category !== '' && !categories.includes(category));
                    return (
                      <TouchableOpacity
                        key={cat}
                        style={[
                          styles.categoryChip,
                          isSelected && styles.categoryChipSelected,
                        ]}
                        onPress={() => {
                          if (isOther) {
                            // Select Other chip and reveal the custom input — don't close the field
                            setCategory('Other');
                            setCustomCategoryInput('');
                            setCustomCategoryError('');
                            if (fieldErrors.category) setFieldErrors(p => ({ ...p, category: '' }));
                          } else {
                            setCategory(cat);
                            setCustomCategoryInput('');
                            setCustomCategoryError('');
                            if (fieldErrors.category) setFieldErrors(p => ({ ...p, category: '' }));
                            toggleField('category');
                          }
                        }}
                        disabled={loading}
                      >
                        <Text
                          style={[
                            styles.categoryChipText,
                            isSelected && styles.categoryChipTextSelected,
                          ]}
                        >
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {/* Inline custom category input — shown when Other is selected */}
                {category === 'Other' && (
                  <View style={{ marginTop: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <TextInput
                        style={[
                          styles.input,
                          { flex: 1, fontSize: 14, paddingVertical: 10 },
                          customCategoryError ? { borderColor: '#dc2626' } : {},
                        ]}
                        value={customCategoryInput}
                        onChangeText={v => { setCustomCategoryInput(v); if (customCategoryError) setCustomCategoryError(''); }}
                        placeholder="Enter custom category name…"
                        placeholderTextColor="#999"
                        autoFocus
                        returnKeyType="done"
                        onSubmitEditing={handleSaveCustomCategory}
                        editable={!savingCustomCategory}
                      />
                      <TouchableOpacity
                        onPress={handleSaveCustomCategory}
                        disabled={savingCustomCategory || !customCategoryInput.trim()}
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          borderRadius: 8,
                          backgroundColor: customCategoryInput.trim() ? '#007AFF' : '#e0e0e0',
                        }}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '600', color: customCategoryInput.trim() ? '#fff' : '#999' }}>
                          {savingCustomCategory ? 'Saving…' : 'Save'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    {customCategoryError ? (
                      <Text style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{customCategoryError}</Text>
                    ) : (
                      <Text style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                        This category will be saved for future use
                      </Text>
                    )}
                  </View>
                )}
                {fieldErrors.category ? <Text style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{fieldErrors.category}</Text> : null}
              </CollapsibleField>

              {type === 'income' && (
                <CollapsibleField
                  label="Payment Method (Optional)"
                  fieldId="paymentMethod"
                  activeFieldId={activeFieldId}
                  onToggle={toggleField}
                  displayValue={PAYMENT_METHODS.find(m => m.value === paymentMethod)?.label}
                >
                  <View style={styles.categoryContainer}>
                    {PAYMENT_METHODS.map((method) => (
                      <TouchableOpacity
                        key={method.value}
                        style={[
                          styles.categoryChip,
                          paymentMethod === method.value && styles.categoryChipSelected,
                        ]}
                        onPress={() => { setPaymentMethod(method.value); toggleField('paymentMethod'); }}
                        disabled={loading}
                      >
                        <Text
                          style={[
                            styles.categoryChipText,
                            paymentMethod === method.value && styles.categoryChipTextSelected,
                          ]}
                        >
                          {method.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </CollapsibleField>
              )}

              {type === 'expense' && (
                <CollapsibleField
                  label="Recurring Expense"
                  fieldId="recurring"
                  activeFieldId={activeFieldId}
                  onToggle={toggleField}
                  displayValue={isRecurring ? `${RECURRENCE_OPTIONS.find(o => o.value === recurrenceType)?.label || 'Monthly'}${recurrenceEndDate ? `, ends ${recurrenceEndDate}` : ''}` : undefined}
                >
                  <TouchableOpacity
                    style={styles.recurringToggle}
                    onPress={() => setIsRecurring(!isRecurring)}
                    disabled={loading}
                  >
                    <View style={[styles.checkbox, isRecurring && styles.checkboxChecked]}>
                      {isRecurring && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Repeat size={18} color={isRecurring ? '#007AFF' : '#666'} />
                    <Text style={[styles.recurringToggleText, isRecurring && styles.recurringToggleTextActive]}>
                      Recurring Expense
                    </Text>
                  </TouchableOpacity>

                  {isRecurring && (
                    <View style={styles.recurringOptions}>
                      <View style={styles.inputGroup}>
                        <Text style={styles.subLabel}>Frequency</Text>
                        <View style={styles.recurrenceTypeRow}>
                          {RECURRENCE_OPTIONS.map((option) => (
                            <TouchableOpacity
                              key={option.value}
                              style={[
                                styles.recurrenceTypeButton,
                                recurrenceType === option.value && styles.recurrenceTypeButtonActive,
                              ]}
                              onPress={() => setRecurrenceType(option.value)}
                              disabled={loading}
                            >
                              <Text
                                style={[
                                  styles.recurrenceTypeButtonText,
                                  recurrenceType === option.value && styles.recurrenceTypeButtonTextActive,
                                ]}
                              >
                                {option.label}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>

                      <View style={styles.inputGroup}>
                        <Text style={styles.subLabel}>End Date (Optional)</Text>
                        <TouchableOpacity
                          style={styles.picker}
                          onPress={() => !loading && setShowEndDatePicker(true)}
                        >
                          <Text style={[styles.pickerText, !recurrenceEndDate && { color: '#999' }]}>
                            {recurrenceEndDate || 'No end date'}
                          </Text>
                          <CalendarDays size={18} color="#666" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </CollapsibleField>
              )}
            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onClose}
                disabled={loading}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
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
          </View>
        </View>
      </KeyboardAvoidingView>

      <DatePicker
        visible={showDatePicker}
        value={date || new Date().toISOString().split('T')[0]}
        onConfirm={(d) => {
          setDate(d);
          setShowDatePicker(false);
        }}
        onCancel={() => setShowDatePicker(false)}
        title="Select Date"
      />

      <DatePicker
        visible={showEndDatePicker}
        value={recurrenceEndDate || new Date().toISOString().split('T')[0]}
        onConfirm={(d) => {
          setRecurrenceEndDate(d);
          setShowEndDatePicker(false);
        }}
        onCancel={() => setShowEndDatePicker(false)}
        title="End Date"
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#fff',
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
    borderBottomColor: '#e0e0e0',
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
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  picker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  pickerText: {
    fontSize: 16,
    color: '#333',
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingLeft: 12,
  },
  currencySymbol: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    padding: 12,
    paddingLeft: 0,
    fontSize: 20,
    fontWeight: '600',
    outlineWidth: 0,
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  categoryChipSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  categoryChipText: {
    fontSize: 14,
    color: '#666',
  },
  categoryChipTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
  },
  saveButton: {
    flex: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonSolid: {
    backgroundColor: '#1B4D6E',
    paddingVertical: 14,
  },
  saveButtonGradient: {
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: '#fee',
    padding: 12,
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 8,
  },
  errorText: {
    color: '#c00',
    fontSize: 14,
    textAlign: 'center',
  },
  recurringSection: {
    marginTop: 8,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  recurringToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  recurringToggleText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  recurringToggleTextActive: {
    color: '#007AFF',
  },
  recurringOptions: {
    marginTop: 12,
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    gap: 16,
  },
  subLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  recurrenceTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  recurrenceTypeButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  recurrenceTypeButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  recurrenceTypeButtonText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  recurrenceTypeButtonTextActive: {
    color: '#fff',
  },
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  dropdownButtonText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  dropdownMenu: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownItemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  dropdownItemSubtitle: {
    fontSize: 13,
    color: '#666',
  },
  customOptionItem: {
    borderBottomWidth: 0,
    backgroundColor: '#f9f9f9',
  },
  customOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#007AFF',
  },
});
