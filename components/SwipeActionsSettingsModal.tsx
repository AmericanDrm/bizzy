import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { X, Check, ChevronDown, ChevronUp, Phone, Calendar, Receipt, MessageSquare, Trash2, Download, Send, Bell } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import {
  useLayout,
  ClientSwipeActionId,
  InvoiceSwipeActionId,
  AVAILABLE_CLIENT_SWIPE_ACTIONS,
  AVAILABLE_INVOICE_RIGHT_SWIPE_ACTIONS,
  AVAILABLE_INVOICE_LEFT_SWIPE_ACTIONS,
  DEFAULT_SWIPE_ACTIONS_CLIENTS,
  DEFAULT_SWIPE_ACTIONS_INVOICES,
} from '@/contexts/LayoutContext';

const ACTION_ICONS: Record<string, React.ReactNode> = {
  call: <Phone size={16} color="#fff" />,
  schedule: <Calendar size={16} color="#fff" />,
  invoice: <Receipt size={16} color="#fff" />,
  message: <MessageSquare size={16} color="#fff" />,
  delete: <Trash2 size={16} color="#fff" />,
  mark_paid: <Check size={16} color="#fff" />,
  pdf: <Download size={16} color="#fff" />,
  send: <Send size={16} color="#fff" />,
  remind: <Bell size={16} color="#fff" />,
};

const MAX_RIGHT_ACTIONS = 3;
const MAX_LEFT_ACTIONS = 1;

interface SwipeActionsSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  context?: 'clients' | 'invoices';
}

type SectionKey = 'clients' | 'invoices';

export default function SwipeActionsSettingsModal({
  visible,
  onClose,
  context,
}: SwipeActionsSettingsModalProps) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const {
    swipeActionsClients,
    swipeActionsInvoices,
    setSwipeActionsClients,
    setSwipeActionsInvoices,
  } = useLayout();

  const [activeSection, setActiveSection] = useState<SectionKey>(context || 'clients');
  const [saving, setSaving] = useState(false);

  const [clientRight, setClientRight] = useState<ClientSwipeActionId[]>([...DEFAULT_SWIPE_ACTIONS_CLIENTS.right]);
  const [invoiceRight, setInvoiceRight] = useState<InvoiceSwipeActionId[]>([...DEFAULT_SWIPE_ACTIONS_INVOICES.right]);
  const [invoiceLeft, setInvoiceLeft] = useState<InvoiceSwipeActionId[]>([...DEFAULT_SWIPE_ACTIONS_INVOICES.left]);

  useEffect(() => {
    if (visible) {
      setClientRight(swipeActionsClients.right || DEFAULT_SWIPE_ACTIONS_CLIENTS.right);
      setInvoiceRight(swipeActionsInvoices.right || DEFAULT_SWIPE_ACTIONS_INVOICES.right);
      setInvoiceLeft(swipeActionsInvoices.left || DEFAULT_SWIPE_ACTIONS_INVOICES.left);
      if (context) setActiveSection(context);
    }
  }, [visible, swipeActionsClients, swipeActionsInvoices, context]);

  const toggleClientAction = (id: ClientSwipeActionId) => {
    setClientRight(prev => {
      if (prev.includes(id)) {
        return prev.filter(a => a !== id);
      }
      if (prev.length >= MAX_RIGHT_ACTIONS) {
        showToast({ message: `Max ${MAX_RIGHT_ACTIONS} actions allowed`, type: 'warning' });
        return prev;
      }
      return [...prev, id];
    });
  };

  const toggleInvoiceRight = (id: InvoiceSwipeActionId) => {
    setInvoiceRight(prev => {
      if (prev.includes(id)) {
        return prev.filter(a => a !== id);
      }
      if (prev.length >= MAX_RIGHT_ACTIONS) {
        showToast({ message: `Max ${MAX_RIGHT_ACTIONS} actions allowed`, type: 'warning' });
        return prev;
      }
      return [...prev, id];
    });
  };

  const toggleInvoiceLeft = (id: InvoiceSwipeActionId) => {
    setInvoiceLeft(prev => {
      if (prev.includes(id)) {
        return prev.filter(a => a !== id);
      }
      if (prev.length >= MAX_LEFT_ACTIONS) {
        showToast({ message: `Max ${MAX_LEFT_ACTIONS} action allowed`, type: 'warning' });
        return prev;
      }
      return [...prev, id];
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setSwipeActionsClients({ right: clientRight });
      await setSwipeActionsInvoices({ right: invoiceRight, left: invoiceLeft });
      showToast({ message: 'Swipe actions saved', type: 'success' });
      onClose();
    } catch {
      showToast({ message: 'Failed to save', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setClientRight([...DEFAULT_SWIPE_ACTIONS_CLIENTS.right]);
    setInvoiceRight([...DEFAULT_SWIPE_ACTIONS_INVOICES.right]);
    setInvoiceLeft([...DEFAULT_SWIPE_ACTIONS_INVOICES.left]);
    showToast({ message: 'Reset to defaults', type: 'info' });
  };

  const styles = makeStyles(colors);

  const renderActionChip = (
    id: string,
    label: string,
    color: string,
    selected: boolean,
    onToggle: () => void
  ) => (
    <TouchableOpacity
      key={id}
      style={[styles.chip, selected && { borderColor: color, backgroundColor: color + '18' }]}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <View style={[styles.chipIcon, { backgroundColor: selected ? color : colors.surface }]}>
        {ACTION_ICONS[id]}
      </View>
      <Text style={[styles.chipLabel, selected && { color: color, fontWeight: '600' }]}>
        {label}
      </Text>
      {selected && (
        <View style={[styles.chipCheck, { backgroundColor: color }]}>
          <Check size={10} color="#fff" />
        </View>
      )}
    </TouchableOpacity>
  );

  const renderSlotPreview = (actions: { id: string; label: string; color: string }[], selected: string[], dir: 'left' | 'right') => (
    <View style={[styles.previewRow, dir === 'left' && styles.previewRowLeft]}>
      {selected.length === 0 ? (
        <View style={styles.previewEmpty}>
          <Text style={styles.previewEmptyText}>No action</Text>
        </View>
      ) : (
        selected.map(id => {
          const def = actions.find(a => a.id === id);
          if (!def) return null;
          return (
            <View key={id} style={[styles.previewBtn, { backgroundColor: def.color }]}>
              {ACTION_ICONS[id]}
              <Text style={styles.previewBtnLabel}>{def.label}</Text>
            </View>
          );
        })
      )}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Swipe Actions</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.segmentRow}>
            {(['clients', 'invoices'] as SectionKey[]).map(s => (
              <TouchableOpacity
                key={s}
                style={[styles.segmentBtn, activeSection === s && styles.segmentBtnActive]}
                onPress={() => setActiveSection(s)}
                activeOpacity={0.7}
              >
                <Text style={[styles.segmentLabel, activeSection === s && styles.segmentLabelActive]}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {activeSection === 'clients' && (
              <View>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Swipe Right Actions</Text>
                  <Text style={styles.sectionHint}>Up to {MAX_RIGHT_ACTIONS} actions</Text>
                </View>
                <View style={styles.chipGrid}>
                  {AVAILABLE_CLIENT_SWIPE_ACTIONS.map(a =>
                    renderActionChip(a.id, a.label, a.color, clientRight.includes(a.id as ClientSwipeActionId), () => toggleClientAction(a.id as ClientSwipeActionId))
                  )}
                </View>

                <Text style={styles.previewLabel}>Preview</Text>
                <View style={styles.previewCard}>
                  <View style={styles.previewMock}>
                    <Text style={styles.previewMockText}>Client Name</Text>
                  </View>
                  {renderSlotPreview(AVAILABLE_CLIENT_SWIPE_ACTIONS, clientRight, 'right')}
                </View>
              </View>
            )}

            {activeSection === 'invoices' && (
              <View>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Swipe Right Actions</Text>
                  <Text style={styles.sectionHint}>Up to {MAX_RIGHT_ACTIONS} actions</Text>
                </View>
                <View style={styles.chipGrid}>
                  {AVAILABLE_INVOICE_RIGHT_SWIPE_ACTIONS.map(a =>
                    renderActionChip(a.id, a.label, a.color, invoiceRight.includes(a.id as InvoiceSwipeActionId), () => toggleInvoiceRight(a.id as InvoiceSwipeActionId))
                  )}
                </View>

                <View style={[styles.sectionHeader, { marginTop: 20 }]}>
                  <Text style={styles.sectionTitle}>Swipe Left Action</Text>
                  <Text style={styles.sectionHint}>Up to {MAX_LEFT_ACTIONS} action</Text>
                </View>
                <View style={styles.chipGrid}>
                  {AVAILABLE_INVOICE_LEFT_SWIPE_ACTIONS.map(a =>
                    renderActionChip(a.id, a.label, a.color, invoiceLeft.includes(a.id as InvoiceSwipeActionId), () => toggleInvoiceLeft(a.id as InvoiceSwipeActionId))
                  )}
                </View>

                <Text style={styles.previewLabel}>Preview</Text>
                <View style={styles.previewCard}>
                  {renderSlotPreview(AVAILABLE_INVOICE_LEFT_SWIPE_ACTIONS, invoiceLeft, 'left')}
                  <View style={styles.previewMock}>
                    <Text style={styles.previewMockText}>Invoice #001</Text>
                  </View>
                  {renderSlotPreview(AVAILABLE_INVOICE_RIGHT_SWIPE_ACTIONS, invoiceRight, 'right')}
                </View>
              </View>
            )}

            <View style={{ height: 32 }} />
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.resetBtn} onPress={handleReset} activeOpacity={0.7}>
              <Text style={styles.resetLabel}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              <Text style={styles.saveLabel}>{saving ? 'Saving...' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  closeBtn: {
    padding: 4,
  },
  segmentRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginVertical: 14,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  segmentBtnActive: {
    backgroundColor: colors.background,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  segmentLabelActive: {
    color: colors.text,
    fontWeight: '600',
  },
  body: {
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  sectionHint: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipIcon: {
    width: 26,
    height: 26,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  chipCheck: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 20,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  previewCard: {
    flexDirection: 'row',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    height: 60,
  },
  previewMock: {
    flex: 1,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  previewMockText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  previewRow: {
    flexDirection: 'row',
  },
  previewRowLeft: {
    flexDirection: 'row-reverse',
  },
  previewBtn: {
    width: 70,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  previewBtnLabel: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  previewEmpty: {
    width: 70,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  previewEmptyText: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  resetBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  resetLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  saveBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#1B4D6E',
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
