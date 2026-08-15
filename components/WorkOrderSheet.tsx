import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import AddressLink from '@/components/AddressLink';
import { X, FileText, Phone, MapPin, Clock, Users, DollarSign, Briefcase, StickyNote, Calendar, Settings2, CircleCheck as CheckCircle2, Trash2, Download, Package, SquareCheck as CheckSquare, Square } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { generateSingleWorkOrderPDF } from '@/lib/workOrderPdfService';

interface WorkOrder {
  id: string;
  client_name: string;
  client_phone: string;
  job_type: string;
  scope: string;
  notes: string;
  status: string;
  scheduled_date: string;
  scheduled_time: string;
  location: string;
  address: string;
  crew_size: number;
  amount: number;
  visible_fields: string[];
  custom_fields: Record<string, string>;
  schedule_event_id: string | null;
}

interface WorkOrderSheetProps {
  visible: boolean;
  workOrder: WorkOrder | null;
  onClose: () => void;
  onEditFields?: (workOrder: WorkOrder) => void;
  onMarkDone?: (workOrder: WorkOrder, createInvoice: boolean) => void;
  onDelete?: (workOrder: WorkOrder) => void;
}

const FIELD_CONFIG: Record<string, { label: string; icon: any; format?: (val: any) => string }> = {
  client_name: { label: 'Client', icon: Briefcase },
  client_phone: { label: 'Phone', icon: Phone },
  job_type: { label: 'Job Type', icon: FileText },
  scope: { label: 'Scope of Work', icon: FileText },
  notes: { label: 'Notes', icon: StickyNote },
  scheduled_date: {
    label: 'Date',
    icon: Calendar,
    format: (val: string) => {
      if (!val) return '';
      const d = new Date(val + 'T00:00:00');
      return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    },
  },
  scheduled_time: { label: 'Time', icon: Clock },
  location: { label: 'Location', icon: MapPin },
  address: { label: 'Address', icon: MapPin },
  crew_size: {
    label: 'Crew Size',
    icon: Users,
    format: (val: number) => `${val} ${val === 1 ? 'person' : 'people'}`,
  },
  amount: {
    label: 'Amount',
    icon: DollarSign,
    format: (val: number) => `$${(val || 0).toFixed(2)}`,
  },
};

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: '#FFF3E0', text: '#E65100', label: 'Pending' },
  in_progress: { bg: '#E3F2FD', text: '#1565C0', label: 'In Progress' },
  completed: { bg: '#E8F5E9', text: '#2E7D32', label: 'Completed' },
};

type ConfirmMode = 'none' | 'complete' | 'delete';

interface SupplyItem {
  id: string;
  supply_name: string;
  quantity: number | null;
  unit: string | null;
  is_acquired: boolean;
}

export default function WorkOrderSheet({ visible, workOrder, onClose, onEditFields, onMarkDone, onDelete }: WorkOrderSheetProps) {
  const { colors } = useTheme();
  const { currentOrganization } = useOrganization();
  const [confirmMode, setConfirmMode] = useState<ConfirmMode>('none');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [supplies, setSupplies] = useState<SupplyItem[]>([]);
  const [suppliesLoading, setSuppliesLoading] = useState(false);

  useEffect(() => {
    if (visible && workOrder?.schedule_event_id) {
      setSuppliesLoading(true);
      supabase
        .from('job_supplies')
        .select('id, supply_name, quantity, unit, is_acquired')
        .eq('job_id', workOrder.schedule_event_id)
        .order('supply_name')
        .then(({ data }) => {
          setSupplies(data || []);
          setSuppliesLoading(false);
        });
    } else {
      setSupplies([]);
    }
  }, [visible, workOrder?.schedule_event_id]);

  const handleToggleSupply = async (supplyId: string, currentState: boolean) => {
    setSupplies(prev => prev.map(s => s.id === supplyId ? { ...s, is_acquired: !currentState } : s));
    await supabase
      .from('job_supplies')
      .update({ is_acquired: !currentState, updated_at: new Date().toISOString() })
      .eq('id', supplyId);
  };

  if (!workOrder) return null;

  const visibleFields = workOrder.visible_fields || Object.keys(FIELD_CONFIG);
  const statusInfo = STATUS_COLORS[workOrder.status] || STATUS_COLORS.pending;

  const getFieldValue = (field: string): string => {
    const raw = (workOrder as any)[field];
    const config = FIELD_CONFIG[field];
    if (!raw && raw !== 0) return '';
    if (config?.format) return config.format(raw);
    return String(raw);
  };

  const handleDownloadPDF = async () => {
    if (Platform.OS !== 'web') return;
    setPdfLoading(true);
    try {
      await generateSingleWorkOrderPDF(workOrder, currentOrganization?.id || null);
    } catch (err) {
      console.error('PDF error', err);
    } finally {
      setPdfLoading(false);
    }
  };

  const renderConfirmBanner = () => {
    if (confirmMode === 'complete') {
      return (
        <View style={styles.confirmBanner}>
          <Text style={styles.confirmTitle}>Mark as Complete?</Text>
          <Text style={styles.confirmSubtitle}>Would you like to create an invoice for this work order?</Text>
          <View style={styles.confirmButtons}>
            <TouchableOpacity style={styles.confirmCancel} onPress={() => setConfirmMode('none')}>
              <Text style={styles.confirmCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.confirmNo}
              onPress={() => { setConfirmMode('none'); onMarkDone?.(workOrder, false); }}
            >
              <Text style={styles.confirmNoText}>No Invoice</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmYes, { overflow: 'hidden' }]}
              onPress={() => { setConfirmMode('none'); onMarkDone?.(workOrder, true); }}
            >
              <LinearGradient
                colors={['#2D8B57', '#34a065']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Text style={styles.confirmYesText}>Create Invoice</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (confirmMode === 'delete') {
      return (
        <View style={[styles.confirmBanner, styles.confirmBannerDanger]}>
          <Text style={styles.confirmTitle}>Delete Work Order?</Text>
          <Text style={styles.confirmSubtitle}>This action cannot be undone.</Text>
          <View style={styles.confirmButtons}>
            <TouchableOpacity style={styles.confirmCancel} onPress={() => setConfirmMode('none')}>
              <Text style={styles.confirmCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmDelete, { overflow: 'hidden' }]}
              onPress={() => { setConfirmMode('none'); onDelete?.(workOrder); }}
            >
              <LinearGradient
                colors={['#dc2626', '#b91c1c']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Text style={styles.confirmYesText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return null;
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <View style={styles.headerLeft}>
            <FileText size={22} color={colors.primary} />
            <Text style={[styles.headerTitle, { color: colors.text }]}>Work Order</Text>
          </View>
          <View style={styles.headerRight}>
            {Platform.OS === 'web' && (
              <TouchableOpacity
                style={[styles.headerIconButton, { backgroundColor: colors.primaryLight }]}
                onPress={handleDownloadPDF}
                disabled={pdfLoading}
              >
                {pdfLoading
                  ? <ActivityIndicator size="small" color={colors.primary} />
                  : <Download size={18} color={colors.primary} />
                }
              </TouchableOpacity>
            )}
            {onEditFields && (
              <TouchableOpacity
                style={[styles.headerIconButton, { backgroundColor: colors.primaryLight }]}
                onPress={() => onEditFields(workOrder)}
              >
                <Settings2 size={18} color={colors.primary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.closeButton, { backgroundColor: colors.border }]} onPress={onClose}>
              <X size={20} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {renderConfirmBanner()}

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          <View style={[styles.statusBanner, { backgroundColor: statusInfo.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: statusInfo.text }]} />
            <Text style={[styles.statusText, { color: statusInfo.text }]}>{statusInfo.label}</Text>
          </View>

          <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>
                {workOrder.client_name || 'Untitled Work Order'}
              </Text>
              {workOrder.job_type ? (
                <View style={[styles.jobTypeBadge, { backgroundColor: colors.primaryLight }]}>
                  <Text style={[styles.jobTypeBadgeText, { color: colors.primary }]}>{workOrder.job_type}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.fieldsContainer}>
              {visibleFields.map((field) => {
                if (field === 'client_name') return null;
                const config = FIELD_CONFIG[field];
                if (!config) return null;
                const value = getFieldValue(field);
                if (!value) return null;

                const IconComponent = config.icon;
                const isLongField = field === 'scope' || field === 'notes';
                const isAddress = field === 'address' || field === 'location';

                return (
                  <View
                    key={field}
                    style={[
                      isLongField ? styles.fieldRowFull : styles.fieldRow,
                      { borderBottomColor: colors.border },
                    ]}
                  >
                    <View style={styles.fieldLabel}>
                      <IconComponent size={16} color={colors.textSecondary} />
                      <Text style={[styles.fieldLabelText, { color: colors.textSecondary }]}>{config.label}</Text>
                    </View>
                    {isAddress ? (
                      <AddressLink
                        address={String(value)}
                        textStyle={[
                          isLongField ? styles.fieldValueLong : styles.fieldValue,
                          { color: colors.primary },
                        ]}
                      />
                    ) : (
                      <Text
                        style={[
                          isLongField ? styles.fieldValueLong : styles.fieldValue,
                          { color: colors.text },
                        ]}
                      >
                        {value}
                      </Text>
                    )}
                  </View>
                );
              })}

              {Object.entries(workOrder.custom_fields || {}).map(([key, value]) => {
                if (!value) return null;
                return (
                  <View key={key} style={[styles.fieldRow, { borderBottomColor: colors.border }]}>
                    <View style={styles.fieldLabel}>
                      <FileText size={16} color={colors.textSecondary} />
                      <Text style={[styles.fieldLabelText, { color: colors.textSecondary }]}>{key}</Text>
                    </View>
                    <Text style={[styles.fieldValue, { color: colors.text }]}>{value}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {supplies.length > 0 && (
            <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 16 }]}>
              <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Package size={18} color={colors.primary} />
                  <Text style={[styles.sheetTitle, { color: colors.text }]}>Equipment / Supplies</Text>
                </View>
                <View style={{ backgroundColor: colors.primaryLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>
                    {supplies.filter(s => s.is_acquired).length}/{supplies.length}
                  </Text>
                </View>
              </View>
              {suppliesLoading ? (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : (
                supplies.map((supply) => (
                  <TouchableOpacity
                    key={supply.id}
                    style={[styles.fieldRow, { borderBottomColor: colors.border, gap: 12 }]}
                    onPress={() => handleToggleSupply(supply.id, supply.is_acquired)}
                    activeOpacity={0.7}
                  >
                    {supply.is_acquired ? (
                      <CheckSquare size={20} color="#16a34a" />
                    ) : (
                      <Square size={20} color={colors.textSecondary} />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={[
                        { fontSize: 14, fontWeight: '500', color: colors.text },
                        supply.is_acquired && { textDecorationLine: 'line-through', color: colors.textSecondary },
                      ]}>
                        {supply.supply_name}
                      </Text>
                      {(supply.quantity || supply.unit) ? (
                        <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 1 }}>
                          {[supply.quantity, supply.unit].filter(Boolean).join(' ')}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}

          <View style={styles.actionsContainer}>
            {workOrder.status !== 'completed' && onMarkDone && (
              <TouchableOpacity
                style={[styles.actionButton, { overflow: 'hidden' }]}
                onPress={() => setConfirmMode('complete')}
              >
                <LinearGradient
                  colors={['#1B4D6E', '#245d82']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <CheckCircle2 size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Mark as Complete</Text>
              </TouchableOpacity>
            )}
            {onDelete && (
              <TouchableOpacity
                style={[styles.actionButton, { overflow: 'hidden' }]}
                onPress={() => setConfirmMode('delete')}
              >
                <LinearGradient
                  colors={['#dc2626', '#b91c1c']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <Trash2 size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmBanner: {
    backgroundColor: '#f0fdf4',
    borderBottomWidth: 1,
    borderBottomColor: '#bbf7d0',
    padding: 16,
    gap: 8,
  },
  confirmBannerDanger: {
    backgroundColor: '#fef2f2',
    borderBottomColor: '#fecaca',
  },
  confirmTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  confirmSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  confirmCancel: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  confirmCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  confirmNo: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
  },
  confirmNoText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  confirmYes: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  confirmYesText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  confirmDelete: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 16,
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  sheet: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sheetHeader: {
    padding: 24,
    borderBottomWidth: 1,
    gap: 12,
  },
  sheetTitle: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 30,
  },
  jobTypeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  jobTypeBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  fieldsContainer: {
    padding: 8,
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fieldRowFull: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  fieldLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fieldLabelText: {
    fontSize: 13,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldValue: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
  },
  fieldValueLong: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
  },
  actionsContainer: {
    marginTop: 20,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 12,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
