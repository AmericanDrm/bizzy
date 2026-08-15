import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import { X, Mail, MessageSquare, Copy, Check, ChevronDown, TriangleAlert as AlertTriangle } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase, invokeFunction } from '@/lib/supabase';
import {
  fetchOutstandingInvoices,
  sortInvoices,
  getAmountDue,
  isOverdue,
  buildStatementPlainText,
  StatementInvoice,
  SortMode,
} from '@/lib/statementService';

interface ClientStatementModalProps {
  visible: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
}

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'oldest_first', label: 'Oldest to Newest' },
  { value: 'newest_first', label: 'Newest to Oldest' },
  { value: 'past_due_first', label: 'Past Due First' },
];

export default function ClientStatementModal({
  visible,
  onClose,
  clientId,
  clientName,
  clientEmail,
  clientPhone,
}: ClientStatementModalProps) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const { currentOrganization } = useOrganization();

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [invoices, setInvoices] = useState<StatementInvoice[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortMode, setSortMode] = useState<SortMode>('past_due_first');
  const [showSortPicker, setShowSortPicker] = useState(false);
  const [businessSettings, setBusinessSettings] = useState<any>(null);

  const styles = getStyles(colors);

  useEffect(() => {
    if (visible && clientId && currentOrganization?.id) {
      loadInvoices();
      loadBusinessSettings();
    }
    if (!visible) {
      setInvoices([]);
      setSelectedIds(new Set());
      setSortMode('past_due_first');
      setShowSortPicker(false);
    }
  }, [visible, clientId, currentOrganization?.id]);

  const loadInvoices = async () => {
    setLoading(true);
    const data = await fetchOutstandingInvoices(clientId, currentOrganization!.id);
    setInvoices(data);
    setSelectedIds(new Set(data.map(i => i.id)));
    setLoading(false);
  };

  const loadBusinessSettings = async () => {
    if (!currentOrganization?.id) return;
    const { data } = await supabase
      .from('business_settings')
      .select('*')
      .eq('organization_id', currentOrganization.id)
      .maybeSingle();
    if (data) setBusinessSettings(data);
  };

  const sortedInvoices = sortInvoices(invoices, sortMode);

  const toggleInvoice = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === invoices.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(invoices.map(i => i.id)));
    }
  };

  const selectedInvoices = sortedInvoices.filter(i => selectedIds.has(i.id));
  const totalDue = selectedInvoices.reduce((sum, inv) => sum + getAmountDue(inv), 0);

  const formatDate = (dateStr: string): string => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatCurrency = (amount: number): string => {
    return `$${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  };

  const getLabel = (inv: StatementInvoice): string => {
    if (inv.memo && inv.memo.trim()) return `${inv.memo.trim()}`;
    return `#${inv.invoice_number}`;
  };

  const handleCopy = useCallback(async () => {
    if (selectedInvoices.length === 0) {
      showToast({ message: 'Select at least one invoice', type: 'error' });
      return;
    }
    const businessName = currentOrganization?.name || 'Your Business';
    const text = buildStatementPlainText(selectedInvoices, clientName, businessName);
    if (Platform.OS === 'web' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text);
        showToast({ message: 'Statement copied to clipboard', type: 'success' });
      } catch {
        showToast({ message: 'Failed to copy', type: 'error' });
      }
    } else {
      showToast({ message: 'Copy not available on this platform', type: 'error' });
    }
  }, [selectedInvoices, clientName, currentOrganization]);

  const handleSendEmail = useCallback(async () => {
    if (selectedInvoices.length === 0) {
      showToast({ message: 'Select at least one invoice', type: 'error' });
      return;
    }
    if (!clientEmail) {
      showToast({ message: 'No email address on file for this client', type: 'error' });
      return;
    }

    const emailChannel = businessSettings?.email_send_channel || 'native';
    const businessName = businessSettings?.business_name || currentOrganization?.name || 'Your Business';

    if (emailChannel === 'native') {
      const text = buildStatementPlainText(selectedInvoices, clientName, businessName);
      const subject = encodeURIComponent(`Account Statement from ${businessName}`);
      const body = encodeURIComponent(text);
      const mailtoUrl = `mailto:${clientEmail}?subject=${subject}&body=${body}`;

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.href = mailtoUrl;
      } else {
        const canOpen = await Linking.canOpenURL(mailtoUrl);
        if (canOpen) {
          await Linking.openURL(mailtoUrl);
        } else {
          showToast({ message: 'Unable to open email app', type: 'error' });
        }
      }
    } else {
      setSending(true);
      try {
        const { data, error } = await invokeFunction('send-statement-email', {
          clientEmail,
          clientName,
          organizationId: currentOrganization!.id,
          invoiceIds: selectedInvoices.map(i => i.id),
          sortMode,
        });
        if (error) {
          showToast({ message: error.message || 'Failed to send statement', type: 'error' });
        } else if (data?.success === false) {
          showToast({ message: data.error || 'Failed to send statement', type: 'error' });
        } else {
          showToast({ message: 'Statement sent via email', type: 'success' });
          onClose();
        }
      } catch (e: any) {
        showToast({ message: e.message || 'Failed to send statement', type: 'error' });
      } finally {
        setSending(false);
      }
    }
  }, [selectedInvoices, clientEmail, clientName, currentOrganization, sortMode, businessSettings]);

  const handleSendSms = useCallback(async () => {
    if (selectedInvoices.length === 0) {
      showToast({ message: 'Select at least one invoice', type: 'error' });
      return;
    }
    if (!clientPhone) {
      showToast({ message: 'No phone number on file for this client', type: 'error' });
      return;
    }

    const smsChannel = businessSettings?.sms_send_channel || 'native';
    const businessName = businessSettings?.business_name || currentOrganization?.name || 'Your Business';
    const text = buildStatementPlainText(selectedInvoices, clientName, businessName);

    if (smsChannel === 'native') {
      const phoneNumber = clientPhone.replace(/\D/g, '');
      const smsUrl = Platform.OS === 'ios'
        ? `sms:${phoneNumber}&body=${encodeURIComponent(text)}`
        : `sms:${phoneNumber}?body=${encodeURIComponent(text)}`;

      const canOpen = await Linking.canOpenURL(smsUrl);
      if (canOpen) {
        await Linking.openURL(smsUrl);
      } else if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.href = smsUrl;
      } else {
        showToast({ message: 'Unable to open messaging app', type: 'error' });
      }
    } else {
      setSending(true);
      try {
        const { error } = await invokeFunction('send-sms', {
          organization_id: currentOrganization!.id,
          to: clientPhone,
          body: text,
        });
        if (error) {
          showToast({ message: error.message || 'Failed to send text', type: 'error' });
        } else {
          showToast({ message: 'Statement sent via text', type: 'success' });
          onClose();
        }
      } catch (e: any) {
        showToast({ message: e.message || 'Failed to send text', type: 'error' });
      } finally {
        setSending(false);
      }
    }
  }, [selectedInvoices, clientPhone, clientName, currentOrganization, businessSettings]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Send Statement</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>{clientName}</Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : invoices.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No outstanding invoices for this client.</Text>
            </View>
          ) : (
            <>
              <View style={styles.controlsRow}>
                <TouchableOpacity onPress={toggleAll} style={styles.selectAllBtn}>
                  <View style={[styles.checkbox, selectedIds.size === invoices.length && styles.checkboxActive]}>
                    {selectedIds.size === invoices.length && <Check size={12} color="#fff" />}
                  </View>
                  <Text style={styles.selectAllText}>
                    {selectedIds.size === invoices.length ? 'Deselect All' : 'Select All'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setShowSortPicker(!showSortPicker)}
                  style={styles.sortBtn}
                >
                  <Text style={styles.sortLabel}>
                    {SORT_OPTIONS.find(o => o.value === sortMode)?.label}
                  </Text>
                  <ChevronDown size={14} color={colors.primary} />
                </TouchableOpacity>
              </View>

              {showSortPicker && (
                <View style={styles.sortPicker}>
                  {SORT_OPTIONS.map(opt => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.sortOption, sortMode === opt.value && styles.sortOptionActive]}
                      onPress={() => { setSortMode(opt.value); setShowSortPicker(false); }}
                    >
                      <Text style={[styles.sortOptionText, sortMode === opt.value && styles.sortOptionTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
                {sortedInvoices.map(inv => {
                  const due = getAmountDue(inv);
                  const overdue = isOverdue(inv);
                  const selected = selectedIds.has(inv.id);
                  return (
                    <TouchableOpacity
                      key={inv.id}
                      style={[styles.invoiceRow, overdue && styles.invoiceRowOverdue]}
                      onPress={() => toggleInvoice(inv.id)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.checkbox, selected && styles.checkboxActive]}>
                        {selected && <Check size={12} color="#fff" />}
                      </View>
                      <View style={styles.invoiceInfo}>
                        <Text style={styles.invoiceLabel} numberOfLines={1}>
                          {getLabel(inv)}
                        </Text>
                        <Text style={[styles.invoiceDueDate, overdue && styles.overdueText]}>
                          {overdue && <AlertTriangle size={10} color="#dc2626" />}
                          {overdue ? ' Past Due - ' : 'Due: '}{formatDate(inv.due_date)}
                        </Text>
                      </View>
                      <Text style={[styles.invoiceAmount, overdue && styles.overdueText]}>
                        {formatCurrency(due)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>
                  {selectedInvoices.length} invoice{selectedInvoices.length !== 1 ? 's' : ''} selected
                </Text>
                <Text style={styles.summaryTotal}>
                  Total: {formatCurrency(totalDue)}
                </Text>
              </View>

              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.copyBtn]}
                  onPress={handleCopy}
                  disabled={sending}
                >
                  <Copy size={16} color={colors.textSecondary} />
                  <Text style={styles.copyBtnText}>Copy</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, styles.smsBtn, !clientPhone && styles.actionBtnDisabled]}
                  onPress={handleSendSms}
                  disabled={sending || !clientPhone}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <MessageSquare size={16} color="#fff" />
                      <Text style={styles.actionBtnText}>Text</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, styles.emailBtn, !clientEmail && styles.actionBtnDisabled]}
                  onPress={handleSendEmail}
                  disabled={sending || !clientEmail}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Mail size={16} color="#fff" />
                      <Text style={styles.actionBtnText}>Email</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '85%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  closeBtn: {
    padding: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  selectAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectAllText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.primary,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.inputBackground,
  },
  sortLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.primary,
  },
  sortPicker: {
    backgroundColor: colors.inputBackground,
    borderRadius: 10,
    marginBottom: 12,
    overflow: 'hidden',
  },
  sortOption: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sortOptionActive: {
    backgroundColor: colors.primaryLight,
  },
  sortOptionText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  sortOptionTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  list: {
    maxHeight: 300,
    marginBottom: 12,
  },
  invoiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: colors.inputBackground,
    gap: 10,
  },
  invoiceRowOverdue: {
    borderLeftWidth: 3,
    borderLeftColor: '#dc2626',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  invoiceInfo: {
    flex: 1,
  },
  invoiceLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  invoiceDueDate: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  overdueText: {
    color: '#dc2626',
  },
  invoiceAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  summaryTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
  },
  actionBtnDisabled: {
    opacity: 0.4,
  },
  copyBtn: {
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  copyBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  smsBtn: {
    backgroundColor: '#1B4D6E',
  },
  emailBtn: {
    backgroundColor: '#059669',
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
