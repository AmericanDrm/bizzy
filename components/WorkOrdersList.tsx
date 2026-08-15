import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { FileText, Phone, MapPin, Clock, Users, ChevronRight, Calendar, CreditCard as Edit3, Trash2, Download, SquareCheck as CheckSquare, Square, Printer, TriangleAlert as AlertTriangle } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import AddressLink from '@/components/AddressLink';
import { useOrganization } from '@/contexts/OrganizationContext';
import WorkOrderSheet from './WorkOrderSheet';
import WorkOrderFieldsModal from './WorkOrderFieldsModal';
import { LinearGradient } from 'expo-linear-gradient';
import { generateBatchWorkOrderPDF } from '@/lib/workOrderPdfService';

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

export default function WorkOrdersList() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [fieldsModalVisible, setFieldsModalVisible] = useState(false);
  const [editingOrder, setEditingOrder] = useState<WorkOrder | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeletePastConfirm, setShowDeletePastConfirm] = useState(false);
  const [deletingPast, setDeletingPast] = useState(false);
  const [batchPdfLoading, setBatchPdfLoading] = useState(false);
  const { colors } = useTheme();
  const { showToast } = useToast();
  const { currentOrganization } = useOrganization();

  useEffect(() => {
    fetchWorkOrders();
  }, []);

  const fetchWorkOrders = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('work_orders')
        .select('*')
        .order('scheduled_date', { ascending: false });

      if (error) throw error;
      setWorkOrders(data || []);
    } catch (err: any) {
      showToast({ message: err.message || 'Failed to load work orders', type: 'error', duration: 4000 });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSheet = (order: WorkOrder) => {
    setSelectedOrder(order);
    setSheetVisible(true);
  };

  const handleEditFields = (order: WorkOrder) => {
    setSheetVisible(false);
    setEditingOrder(order);
    setFieldsModalVisible(true);
  };

  const handleFieldsSaved = () => {
    setFieldsModalVisible(false);
    setEditingOrder(null);
    fetchWorkOrders();
  };

  const handleStatusChange = async (order: WorkOrder, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('work_orders')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', order.id);

      if (error) throw error;
      fetchWorkOrders();
      showToast({ message: `Status updated to ${newStatus.replace('_', ' ')}`, type: 'success', duration: 2000 });
    } catch (err: any) {
      showToast({ message: err.message || 'Failed to update status', type: 'error', duration: 4000 });
    }
  };

  const handleMarkDone = async (order: WorkOrder, createInvoice: boolean) => {
    try {
      const { error } = await supabase
        .from('work_orders')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', order.id);

      if (error) throw error;

      setSheetVisible(false);
      setSelectedOrder(null);
      fetchWorkOrders();

      if (createInvoice) {
        showToast({ message: 'Work order marked as complete. Opening invoice creation...', type: 'success', duration: 3000 });
      } else {
        showToast({ message: 'Work order marked as complete', type: 'success', duration: 2000 });
      }
    } catch (err: any) {
      showToast({ message: err.message || 'Failed to mark as complete', type: 'error', duration: 4000 });
    }
  };

  const handleDelete = async (order: WorkOrder) => {
    try {
      const { error } = await supabase
        .from('work_orders')
        .delete()
        .eq('id', order.id);

      if (error) throw error;

      setSheetVisible(false);
      setSelectedOrder(null);
      fetchWorkOrders();
      showToast({ message: 'Work order deleted', type: 'success', duration: 2000 });
    } catch (err: any) {
      showToast({ message: err.message || 'Failed to delete work order', type: 'error', duration: 4000 });
    }
  };

  const handleDeletePastWorkOrders = async () => {
    setDeletingPast(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('work_orders')
        .delete()
        .lt('scheduled_date', today)
        .select('id');

      if (error) throw error;
      const count = data?.length || 0;
      setShowDeletePastConfirm(false);
      fetchWorkOrders();
      showToast({ message: `Deleted ${count} past work order${count !== 1 ? 's' : ''}`, type: 'success', duration: 3000 });
    } catch (err: any) {
      showToast({ message: err.message || 'Failed to delete past work orders', type: 'error', duration: 4000 });
    } finally {
      setDeletingPast(false);
    }
  };

  const toggleSelection = (id: string) => {
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

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredOrders.length && filteredOrders.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredOrders.map(o => o.id)));
    }
  };

  const handleBatchPDF = async () => {
    if (Platform.OS !== 'web' || selectedIds.size === 0) return;
    setBatchPdfLoading(true);
    try {
      const selected = filteredOrders.filter(o => selectedIds.has(o.id));
      await generateBatchWorkOrderPDF(selected, currentOrganization?.id || null);
      showToast({ message: 'PDF downloaded', type: 'success', duration: 2000 });
    } catch (err: any) {
      showToast({ message: err.message || 'Failed to generate PDF', type: 'error', duration: 4000 });
    } finally {
      setBatchPdfLoading(false);
    }
  };

  const filteredOrders = filter === 'all' ? workOrders : workOrders.filter((o) => o.status === filter);

  const pastCount = workOrders.filter(o => {
    const today = new Date().toISOString().split('T')[0];
    return o.scheduled_date && o.scheduled_date < today;
  }).length;

  const renderWorkOrder = useCallback(({ item }: { item: WorkOrder }) => {
    const isSelected = selectedIds.has(item.id);

    return (
      <View style={[styles.cardRow, { backgroundColor: colors.card, borderColor: isSelected ? colors.primary : colors.border }]}>
        <TouchableOpacity
          style={styles.checkboxArea}
          onPress={() => toggleSelection(item.id)}
          activeOpacity={0.6}
        >
          {isSelected ? (
            <CheckSquare size={22} color={colors.primary} />
          ) : (
            <Square size={22} color={colors.textSecondary} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cardContent}
          onPress={() => handleOpenSheet(item)}
          activeOpacity={0.7}
        >
          <View style={styles.clientRow}>
            <Text style={[styles.clientName, { color: colors.text }]} numberOfLines={1}>
              {item.client_name || 'No Client'}
            </Text>
            {item.client_phone ? (
              <View style={styles.phoneInline}>
                <Phone size={12} color={colors.textSecondary} />
                <Text style={[styles.phoneText, { color: colors.textSecondary }]}>{item.client_phone}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.detailsStrip}>
            {item.job_type ? (
              <View style={styles.stripItem}>
                <FileText size={12} color={colors.textSecondary} />
                <Text style={[styles.stripText, { color: colors.textSecondary }]} numberOfLines={1}>{item.job_type}</Text>
              </View>
            ) : null}

            {item.scheduled_date ? (
              <View style={styles.stripItem}>
                <Calendar size={12} color={colors.textSecondary} />
                <Text style={[styles.stripText, { color: colors.textSecondary }]}>
                  {new Date(item.scheduled_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  {item.scheduled_time ? ` ${item.scheduled_time}` : ''}
                </Text>
              </View>
            ) : null}

            {item.location ? (
              <View style={styles.stripItem}>
                <MapPin size={12} color={colors.textSecondary} />
                <AddressLink
                  address={item.location}
                  textStyle={[styles.stripText, { color: colors.primary }]}
                  numberOfLines={1}
                />
              </View>
            ) : null}

            {item.crew_size > 1 ? (
              <View style={styles.stripItem}>
                <Users size={12} color={colors.textSecondary} />
                <Text style={[styles.stripText, { color: colors.textSecondary }]}>{item.crew_size}</Text>
              </View>
            ) : null}

            {item.amount > 0 ? (
              <Text style={[styles.amountInline, { color: colors.primary }]}>${item.amount.toFixed(2)}</Text>
            ) : null}
          </View>
        </TouchableOpacity>

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primaryLight }]}
            onPress={() => handleEditFields(item)}
            activeOpacity={0.7}
          >
            <Edit3 size={14} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#fee2e2' }]}
            onPress={() => handleDelete(item)}
            activeOpacity={0.7}
          >
            <Trash2 size={14} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [colors, selectedIds, filteredOrders]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {showDeletePastConfirm && (
        <View style={styles.confirmOverlay}>
          <View style={[styles.confirmCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <AlertTriangle size={28} color="#ef4444" />
            <Text style={[styles.confirmTitle, { color: colors.text }]}>Delete Past Work Orders?</Text>
            <Text style={[styles.confirmSubtext, { color: colors.textSecondary }]}>
              This will permanently delete {pastCount} work order{pastCount !== 1 ? 's' : ''} scheduled before today.
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[styles.confirmCancelBtn, { borderColor: colors.border }]}
                onPress={() => setShowDeletePastConfirm(false)}
              >
                <Text style={[styles.confirmCancelText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmDeleteBtn, { overflow: 'hidden' }]}
                onPress={handleDeletePastWorkOrders}
                disabled={deletingPast}
              >
                <LinearGradient
                  colors={['#dc2626', '#b91c1c']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                {deletingPast ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmDeleteText}>Delete All Past</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      <View style={styles.toolbarRow}>
        <View style={styles.filterRow}>
          {(['all', 'pending', 'in_progress', 'completed'] as const).map((f) => (
            <TouchableOpacity
              key={f}
              style={[
                styles.filterChip,
                {
                  backgroundColor: filter === f ? colors.primary : colors.card,
                  borderColor: filter === f ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setFilter(f)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: filter === f ? '#fff' : colors.textSecondary },
                ]}
              >
                {f === 'all' ? 'All' : f === 'in_progress' ? 'Active' : f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.toolbarActions}>
          {filteredOrders.length > 0 && (
            <TouchableOpacity
              style={[styles.selectAllBtn, { borderColor: colors.border }]}
              onPress={toggleSelectAll}
              activeOpacity={0.7}
            >
              {selectedIds.size === filteredOrders.length && filteredOrders.length > 0 ? (
                <CheckSquare size={16} color={colors.primary} />
              ) : (
                <Square size={16} color={colors.textSecondary} />
              )}
              <Text style={[styles.selectAllText, { color: colors.textSecondary }]}>All</Text>
            </TouchableOpacity>
          )}
          {pastCount > 0 && (
            <TouchableOpacity
              style={[styles.deletePastBtn, { borderColor: '#fca5a5' }]}
              onPress={() => setShowDeletePastConfirm(true)}
              activeOpacity={0.7}
            >
              <Trash2 size={14} color="#ef4444" />
              <Text style={styles.deletePastText}>Past ({pastCount})</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => item.id}
        renderItem={renderWorkOrder}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchWorkOrders} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <FileText size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Work Orders</Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
              Work orders are created automatically when you schedule a job
            </Text>
          </View>
        }
      />

      {selectedIds.size > 0 && Platform.OS === 'web' && (
        <TouchableOpacity
          style={[styles.printFab, { overflow: 'hidden' }]}
          onPress={handleBatchPDF}
          activeOpacity={0.8}
          disabled={batchPdfLoading}
        >
          <LinearGradient
            colors={['#1B4D6E', '#245d82']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {batchPdfLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Printer size={20} color="#fff" />
          )}
          <Text style={styles.printFabText}>
            {batchPdfLoading ? 'Generating...' : `Print Selected (${selectedIds.size})`}
          </Text>
        </TouchableOpacity>
      )}

      <WorkOrderSheet
        visible={sheetVisible}
        workOrder={selectedOrder}
        onClose={() => {
          setSheetVisible(false);
          setSelectedOrder(null);
        }}
        onEditFields={handleEditFields}
        onMarkDone={handleMarkDone}
        onDelete={handleDelete}
      />

      {editingOrder && (
        <WorkOrderFieldsModal
          visible={fieldsModalVisible}
          workOrderId={editingOrder.id}
          currentFields={editingOrder.visible_fields || []}
          currentCustomFields={editingOrder.custom_fields || {}}
          onClose={() => {
            setFieldsModalVisible(false);
            setEditingOrder(null);
          }}
          onSave={handleFieldsSaved}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  toolbarRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 8,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  toolbarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  selectAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  selectAllText: {
    fontSize: 13,
    fontWeight: '600',
  },
  deletePastBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#fef2f2',
  },
  deletePastText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ef4444',
  },
  list: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 100,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    overflow: 'hidden',
  },
  checkboxArea: {
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    gap: 6,
  },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  clientName: {
    fontSize: 16,
    fontWeight: '700',
    flexShrink: 1,
  },
  phoneInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  phoneText: {
    fontSize: 13,
    fontWeight: '400',
  },
  detailsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  stripItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 160,
  },
  stripText: {
    fontSize: 12,
    fontWeight: '500',
  },
  amountInline: {
    fontSize: 13,
    fontWeight: '700',
  },
  cardActions: {
    flexDirection: 'column',
    gap: 6,
    paddingRight: 12,
    paddingVertical: 8,
  },
  actionBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    zIndex: 100,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  confirmCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    gap: 12,
    maxWidth: 400,
    width: '100%',
    alignItems: 'center',
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  confirmSubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    width: '100%',
  },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  confirmCancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  confirmDeleteBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmDeleteText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 20,
  },
  printFab: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  printFabText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
