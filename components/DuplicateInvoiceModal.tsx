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
  Platform,
} from 'react-native';
import { X, Copy, CalendarDays } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import DatePicker from './DatePicker';

interface SourceInvoice {
  id: string;
  client_id: string;
  client?: { name: string };
  invoice_number: string;
  tax_rate: number;
  notes: string;
  memo?: string;
  payment_terms?: string;
  subtotal: number;
  tax_amount: number;
  total: number;
}

interface DuplicateInvoiceModalProps {
  visible: boolean;
  sourceInvoice: SourceInvoice | null;
  onClose: () => void;
  onCreated: () => void;
}

const calculateDueDate = (issueDate: string, terms: string): string => {
  if (!issueDate || terms === 'custom') return issueDate;
  const date = new Date(issueDate);
  switch (terms) {
    case 'due_on_receipt':
      return issueDate;
    case 'net_15':
      date.setDate(date.getDate() + 15);
      break;
    case 'net_30':
      date.setDate(date.getDate() + 30);
      break;
    case 'net_60':
      date.setDate(date.getDate() + 60);
      break;
    case 'net_90':
      date.setDate(date.getDate() + 90);
      break;
    default:
      date.setDate(date.getDate() + 30);
  }
  return date.toISOString().split('T')[0];
};

export default function DuplicateInvoiceModal({ visible, sourceInvoice, onClose, onCreated }: DuplicateInvoiceModalProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { colors } = useTheme();
  const { currentOrganization } = useOrganization();

  const today = new Date().toISOString().split('T')[0];

  const [issueDate, setIssueDate] = useState(today);
  const [dueDate, setDueDate] = useState('');
  const [memo, setMemo] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [showIssueDatePicker, setShowIssueDatePicker] = useState(false);
  const [showDueDatePicker, setShowDueDatePicker] = useState(false);

  useEffect(() => {
    if (visible && sourceInvoice) {
      const newToday = new Date().toISOString().split('T')[0];
      setIssueDate(newToday);
      setDueDate(calculateDueDate(newToday, sourceInvoice.payment_terms || 'net_30'));
      setMemo('');
      setNotes(sourceInvoice.notes || '');
      setSaving(false);
    }
  }, [visible, sourceInvoice]);

  const handleCreate = async () => {
    if (!sourceInvoice || !user || !currentOrganization) return;
    setSaving(true);
    try {
      const { data: items } = await supabase
        .from('invoice_items')
        .select('description, quantity, unit_price, total, job_type_id, service_scope, pane_details')
        .eq('invoice_id', sourceInvoice.id)
        .order('created_at');

      const { data: numData } = await supabase.rpc('generate_invoice_number');
      const invoiceNumber = numData || `INV-${Date.now()}`;

      const subtotal = (items || []).reduce((sum: number, i: any) => sum + Number(i.total), 0);
      const taxAmount = subtotal * (Number(sourceInvoice.tax_rate) / 100);
      const total = subtotal + taxAmount;

      const { data: newInvoice, error } = await supabase
        .from('invoices')
        .insert({
          user_id: user.id,
          organization_id: currentOrganization.id,
          client_id: sourceInvoice.client_id,
          invoice_number: invoiceNumber,
          status: 'draft',
          payment_status: 'draft',
          issue_date: issueDate,
          due_date: dueDate,
          subtotal,
          tax_rate: sourceInvoice.tax_rate,
          tax_amount: taxAmount,
          total,
          notes: notes.trim(),
          memo: memo.trim() || null,
          payment_terms: sourceInvoice.payment_terms || 'net_30',
        })
        .select('id')
        .single();

      if (error) throw error;

      if (items && items.length > 0) {
        const { error: itemsError } = await supabase
          .from('invoice_items')
          .insert(
            items.map((i: any, idx: number) => ({
              invoice_id: newInvoice.id,
              organization_id: currentOrganization.id,
              description: i.description,
              quantity: i.quantity,
              unit_price: i.unit_price,
              total: i.total,
              job_type_id: i.job_type_id || null,
              service_scope: i.service_scope || null,
              pane_details: i.pane_details || null,
            }))
          );
        if (itemsError) throw itemsError;
      }

      showToast({ message: `Invoice ${invoiceNumber} created`, type: 'success', duration: 2500 });
      onCreated();
    } catch (err: any) {
      showToast({ message: err?.message || 'Failed to duplicate invoice', type: 'error', duration: 4000 });
    } finally {
      setSaving(false);
    }
  };

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: Platform.OS === 'ios' ? 34 : 24,
      maxHeight: '85%',
    },
    handle: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginTop: 10,
      marginBottom: 4,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    title: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.3,
    },
    subtitle: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 1,
    },
    body: {
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 8,
    },
    label: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 6,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    dateRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 18,
    },
    dateField: {
      flex: 1,
    },
    dateTouchable: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 11,
    },
    dateText: {
      fontSize: 14,
      color: colors.text,
      fontWeight: '500',
    },
    textArea: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.text,
      minHeight: 44,
      marginBottom: 18,
      textAlignVertical: 'top',
    },
    sourceNote: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.primary + '10',
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 9,
      marginBottom: 20,
    },
    sourceNoteText: {
      fontSize: 13,
      color: colors.primary,
      fontWeight: '500',
      flex: 1,
    },
    footer: {
      paddingHorizontal: 20,
      paddingTop: 4,
    },
    createBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    createBtnText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '700',
    },
  });

  if (!sourceInvoice) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.sheet} activeOpacity={1} onPress={() => {}}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Copy size={18} color={colors.primary} />
              <View>
                <Text style={styles.title}>Duplicate Invoice</Text>
                <Text style={styles.subtitle}>
                  {sourceInvoice.client?.name || 'Client'} · #{sourceInvoice.invoice_number}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
            <View style={styles.sourceNote}>
              <Copy size={14} color={colors.primary} />
              <Text style={styles.sourceNoteText}>
                All line items copied · dates updated to today · status reset to draft
              </Text>
            </View>

            <View style={styles.dateRow}>
              <View style={styles.dateField}>
                <Text style={styles.label}>Issue Date</Text>
                <TouchableOpacity style={styles.dateTouchable} onPress={() => setShowIssueDatePicker(true)}>
                  <CalendarDays size={15} color={colors.primary} />
                  <Text style={styles.dateText}>{issueDate}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.dateField}>
                <Text style={styles.label}>Due Date</Text>
                <TouchableOpacity style={styles.dateTouchable} onPress={() => setShowDueDatePicker(true)}>
                  <CalendarDays size={15} color={colors.textSecondary} />
                  <Text style={styles.dateText}>{dueDate}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.label}>Memo (optional)</Text>
            <TextInput
              style={styles.textArea}
              value={memo}
              onChangeText={setMemo}
              placeholder="Reference number, project name..."
              placeholderTextColor={colors.textSecondary}
              multiline
            />

            <Text style={styles.label}>Notes (optional)</Text>
            <TextInput
              style={[styles.textArea, { minHeight: 70 }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Payment instructions, thank you message..."
              placeholderTextColor={colors.textSecondary}
              multiline
            />
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.createBtn} onPress={handleCreate} disabled={saving}>
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Copy size={17} color="#fff" />
                  <Text style={styles.createBtnText}>Create Invoice</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>

      <DatePicker
        visible={showIssueDatePicker}
        value={issueDate}
        onConfirm={(d) => {
          setIssueDate(d);
          setDueDate(calculateDueDate(d, sourceInvoice?.payment_terms || 'net_30'));
          setShowIssueDatePicker(false);
        }}
        onCancel={() => setShowIssueDatePicker(false)}
        title="Issue Date"
      />
      <DatePicker
        visible={showDueDatePicker}
        value={dueDate}
        onConfirm={(d) => { setDueDate(d); setShowDueDatePicker(false); }}
        onCancel={() => setShowDueDatePicker(false)}
        title="Due Date"
      />
    </Modal>
  );
}
