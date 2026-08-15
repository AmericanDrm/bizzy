import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import {
  History,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  X,
  Clock,
  DollarSign,
  Wrench,
  Calendar,
  Pencil,
  Check,
  MapPin,
  Plus,
  Trash2,
  FileText,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/utilities';

interface ServiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  job_type_name?: string;
  service_scope?: string;
  pane_details?: any;
  source_table?: 'invoice_items' | 'schedule_event_line_items';
}

interface ServiceRecord {
  id: string;
  date: string;
  services: string[];
  time_start: string | null;
  time_end: string | null;
  duration_minutes: number | null;
  line_items: ServiceLineItem[];
  total: number;
  source: 'invoice' | 'schedule' | 'time_entry' | 'productivity_session';
  invoice_number?: string;
  status?: string;
  payment_status?: string;
  amount?: number;
  location?: string;
  time_kind?: 'manual' | 'automatic';
}

interface JobType {
  id: string;
  name: string;
}

interface ClientServiceHistoryProps {
  clientId: string;
  organizationId: string;
}

function formatDuration(minutes: number | null): string {
  if (!minutes || minutes <= 0) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function formatTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatDateStr(str: string): string {
  const d = new Date(str);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function scopeLabel(scope: string | undefined): string {
  if (scope === 'exterior_only') return 'Ext';
  if (scope === 'interior_only') return 'Int';
  return '';
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export default function ClientServiceHistory({ clientId, organizationId }: ClientServiceHistoryProps) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const styles = getStyles(colors);

  const [records, setRecords] = useState<ServiceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<ServiceRecord | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [saving, setSaving] = useState(false);

  const [showAddForm, setShowAddForm] = useState(false);
  const [jobTypes, setJobTypes] = useState<JobType[]>([]);
  const [addDescription, setAddDescription] = useState('');
  const [addDate, setAddDate] = useState(todayISO());
  const [addQuantity, setAddQuantity] = useState('');
  const [addUnitPrice, setAddUnitPrice] = useState('');
  const [addDuration, setAddDuration] = useState('');
  const [addJobTypeId, setAddJobTypeId] = useState<string | null>(null);
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState('');

  const [editingRecord, setEditingRecord] = useState<string | null>(null);
  const [editRecordDate, setEditRecordDate] = useState('');
  const [editingScopeItemId, setEditingScopeItemId] = useState<string | null>(null);
  const [savingScope, setSavingScope] = useState(false);

  const fetchHistory = useCallback(async () => {
    if (!clientId || !organizationId) return;
    setLoading(true);
    try {
      const [invoicesRes, scheduleRes, timeEntriesRes, productivitySessionsRes] = await Promise.all([
        supabase
          .from('invoices')
          .select(`
            id,
            invoice_number,
            issue_date,
            total,
            status,
            invoice_items (
              id,
              description,
              quantity,
              unit_price,
              total,
              job_types ( name )
            )
          `)
          .eq('client_id', clientId)
          .eq('organization_id', organizationId)
          .in('status', ['paid', 'sent', 'overdue'])
          .order('issue_date', { ascending: false })
          .limit(20),

        supabase
          .from('schedule_events')
          .select(`
            id,
            title,
            start_time,
            end_time,
            amount,
            payment_status,
            location,
            address,
            job_types ( name ),
            schedule_event_line_items (
              id,
              description,
              quantity,
              unit_price,
              total,
              service_scope,
              pane_details,
              job_types ( name )
            )
          `)
          .eq('client_id', clientId)
          .eq('organization_id', organizationId)
          .not('end_time', 'is', null)
          .lt('end_time', new Date().toISOString())
          .order('start_time', { ascending: false })
          .limit(30),

        supabase
          .from('time_entries')
          .select('id, clock_in, clock_out, notes')
          .eq('client_id', clientId)
          .not('clock_out', 'is', null)
          .order('clock_in', { ascending: false })
          .limit(50),

        supabase
          .from('productivity_sessions')
          .select('id, start_time, end_time, session_type, departure_reason')
          .eq('client_id', clientId)
          .not('end_time', 'is', null)
          .order('start_time', { ascending: false })
          .limit(50),
      ]);

      const invoiceRecords: ServiceRecord[] = (invoicesRes.data || []).map((inv: any) => {
        const items: ServiceLineItem[] = (inv.invoice_items || []).map((item: any) => ({
          id: item.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.total,
          job_type_name: item.job_types?.name,
          source_table: 'invoice_items' as const,
        }));
        const services = [...new Set(items.map(i => i.job_type_name || i.description).filter(Boolean))];
        return {
          id: inv.id,
          date: inv.issue_date,
          services: services.length > 0 ? services : ['Invoice'],
          time_start: null,
          time_end: null,
          duration_minutes: null,
          line_items: items,
          total: inv.total || 0,
          source: 'invoice' as const,
          invoice_number: inv.invoice_number,
          status: inv.status,
        };
      });

      const scheduleRecords: ServiceRecord[] = (scheduleRes.data || []).map((evt: any) => {
        const lineItems: ServiceLineItem[] = (evt.schedule_event_line_items || []).map((li: any) => ({
          id: li.id,
          description: li.description || li.job_types?.name || 'Service',
          quantity: li.quantity,
          unit_price: li.unit_price,
          total: li.total,
          job_type_name: li.job_types?.name,
          service_scope: li.service_scope,
          pane_details: li.pane_details,
          source_table: 'schedule_event_line_items' as const,
        }));

        let services: string[] = [];
        if (lineItems.length > 0) {
          services = [...new Set(lineItems.map(li => li.job_type_name || li.description).filter(Boolean))];
        } else if (evt.job_types?.name) {
          services = [evt.job_types.name];
        } else if (evt.title) {
          services = [evt.title];
        } else {
          services = ['Service'];
        }

        const start = evt.start_time ? new Date(evt.start_time) : null;
        const end = evt.end_time ? new Date(evt.end_time) : null;
        const durationMinutes = start && end ? Math.round((end.getTime() - start.getTime()) / 60000) : null;
        const lineItemTotal = lineItems.reduce((sum, li) => sum + (li.total || 0), 0);
        const totalAmount = lineItemTotal > 0 ? lineItemTotal : (evt.amount || 0);

        return {
          id: evt.id,
          date: evt.start_time ? evt.start_time.split('T')[0] : '',
          services,
          time_start: evt.start_time,
          time_end: evt.end_time,
          duration_minutes: durationMinutes,
          line_items: lineItems,
          total: totalAmount,
          source: 'schedule' as const,
          payment_status: evt.payment_status,
          amount: evt.amount,
          location: evt.address || evt.location,
        };
      });

      const timeEntryRecords: ServiceRecord[] = (timeEntriesRes.data || []).map((te: any) => {
        const start = te.clock_in ? new Date(te.clock_in) : null;
        const end = te.clock_out ? new Date(te.clock_out) : null;
        const durationMinutes = start && end ? Math.round((end.getTime() - start.getTime()) / 60000) : null;
        return {
          id: `te_${te.id}`,
          date: te.clock_in ? te.clock_in.split('T')[0] : '',
          services: ['Time on site'],
          time_start: te.clock_in,
          time_end: te.clock_out,
          duration_minutes: durationMinutes,
          line_items: [],
          total: 0,
          source: 'time_entry' as const,
          time_kind: 'manual' as const,
        };
      });

      const productivityRecords: ServiceRecord[] = (productivitySessionsRes.data || []).map((ps: any) => {
        const start = ps.start_time ? new Date(ps.start_time) : null;
        const end = ps.end_time ? new Date(ps.end_time) : null;
        const durationMinutes = start && end ? Math.round((end.getTime() - start.getTime()) / 60000) : null;
        return {
          id: `ps_${ps.id}`,
          date: ps.start_time ? ps.start_time.split('T')[0] : '',
          services: ['Auto-tracked on site'],
          time_start: ps.start_time,
          time_end: ps.end_time,
          duration_minutes: durationMinutes,
          line_items: [],
          total: 0,
          source: 'productivity_session' as const,
          time_kind: 'automatic' as const,
        };
      });

      const merged = [...invoiceRecords, ...scheduleRecords, ...timeEntryRecords, ...productivityRecords]
        .filter(r => r.date)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setRecords(merged);
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }, [clientId, organizationId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const fetchJobTypes = useCallback(async () => {
    if (!organizationId) return;
    const { data } = await supabase
      .from('job_types')
      .select('id, name')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('name');
    setJobTypes(data || []);
  }, [organizationId]);

  useEffect(() => {
    if (showAddForm && jobTypes.length === 0) {
      fetchJobTypes();
    }
  }, [showAddForm, jobTypes.length, fetchJobTypes]);

  const handleSavePrice = useCallback(async (item: ServiceLineItem) => {
    if (!editPrice || item.source_table !== 'schedule_event_line_items') return;
    setSaving(true);
    try {
      const newPrice = parseFloat(editPrice);
      if (isNaN(newPrice) || newPrice < 0) return;
      const newTotal = item.quantity > 0 ? item.quantity * newPrice : newPrice;
      await supabase
        .from('schedule_event_line_items')
        .update({ unit_price: newPrice, total: newTotal })
        .eq('id', item.id);

      setRecords(prev => prev.map(r => ({
        ...r,
        line_items: r.line_items.map(li => {
          if (li.id !== item.id) return li;
          return { ...li, unit_price: newPrice, total: newTotal };
        }),
        total: r.line_items.reduce((sum, li) => {
          if (li.id === item.id) return sum + newTotal;
          return sum + (li.total || 0);
        }, 0),
      })));

      if (selectedRecord) {
        setSelectedRecord(prev => {
          if (!prev) return prev;
          const updatedItems = prev.line_items.map(li => {
            if (li.id !== item.id) return li;
            return { ...li, unit_price: newPrice, total: newTotal };
          });
          return {
            ...prev,
            line_items: updatedItems,
            total: updatedItems.reduce((sum, li) => sum + (li.total || 0), 0),
          };
        });
      }
    } catch {
      // silent
    } finally {
      setSaving(false);
      setEditingItemId(null);
      setEditPrice('');
    }
  }, [editPrice, selectedRecord]);

  const handleSaveScope = useCallback(async (item: LineItem, newScope: 'full_service' | 'exterior_only') => {
    if (item.source_table !== 'schedule_event_line_items') return;
    setSavingScope(true);
    try {
      await supabase
        .from('schedule_event_line_items')
        .update({ service_scope: newScope })
        .eq('id', item.id);

      const updateItems = (li: LineItem) =>
        li.id === item.id ? { ...li, service_scope: newScope } : li;

      setRecords(prev => prev.map(r => ({ ...r, line_items: r.line_items.map(updateItems) })));
      setSelectedRecord(prev => prev ? { ...prev, line_items: prev.line_items.map(updateItems) } : prev);
    } catch {
      // silent
    } finally {
      setSavingScope(false);
      setEditingScopeItemId(null);
    }
  }, []);

  const handleAddServiceRecord = useCallback(async () => {
    if (!addDescription.trim()) {
      setAddError('Description is required');
      return;
    }
    setAddSaving(true);
    setAddError('');
    try {
      const qty = parseFloat(addQuantity) || 1;
      const price = parseFloat(addUnitPrice) || 0;
      const total = qty * price;
      const durationMins = parseInt(addDuration) || 60;

      const startTime = new Date(`${addDate}T09:00:00`);
      const endTime = new Date(startTime.getTime() + durationMins * 60000);

      const { data: eventData, error: eventError } = await supabase
        .from('schedule_events')
        .insert({
          user_id: user?.id,
          client_id: clientId,
          organization_id: organizationId,
          title: addDescription.trim(),
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          amount: total,
          payment_status: 'paid',
          ...(addJobTypeId ? { job_type_id: addJobTypeId } : {}),
        })
        .select('id')
        .maybeSingle();

      if (eventError || !eventData) {
        setAddError('Failed to save service record');
        return;
      }

      await supabase
        .from('schedule_event_line_items')
        .insert({
          schedule_event_id: eventData.id,
          organization_id: organizationId,
          description: addDescription.trim(),
          quantity: qty,
          unit_price: price,
          total,
          ...(addJobTypeId ? { job_type_id: addJobTypeId } : {}),
        });

      resetAddForm();
      fetchHistory();
    } catch {
      setAddError('Something went wrong');
    } finally {
      setAddSaving(false);
    }
  }, [addDescription, addDate, addQuantity, addUnitPrice, addDuration, addJobTypeId, clientId, organizationId, user, fetchHistory]);

  const handleDeleteRecord = useCallback(async (record: ServiceRecord) => {
    if (record.source !== 'schedule') return;
    setSaving(true);
    try {
      await supabase
        .from('schedule_event_line_items')
        .delete()
        .eq('schedule_event_id', record.id);
      await supabase
        .from('schedule_events')
        .delete()
        .eq('id', record.id);

      setRecords(prev => prev.filter(r => !(r.id === record.id && r.source === 'schedule')));
      setSelectedRecord(null);
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  }, []);

  const handleUpdateDate = useCallback(async (record: ServiceRecord) => {
    if (!editRecordDate || record.source !== 'schedule') return;
    setSaving(true);
    try {
      const oldStart = record.time_start ? new Date(record.time_start) : new Date(`${record.date}T09:00:00`);
      const oldEnd = record.time_end ? new Date(record.time_end) : new Date(`${record.date}T10:00:00`);
      const diff = oldEnd.getTime() - oldStart.getTime();

      const newStart = new Date(`${editRecordDate}T${oldStart.toTimeString().slice(0, 8)}`);
      const newEnd = new Date(newStart.getTime() + diff);

      await supabase
        .from('schedule_events')
        .update({
          start_time: newStart.toISOString(),
          end_time: newEnd.toISOString(),
        })
        .eq('id', record.id);

      setRecords(prev => prev.map(r => {
        if (r.id !== record.id || r.source !== 'schedule') return r;
        return {
          ...r,
          date: editRecordDate,
          time_start: newStart.toISOString(),
          time_end: newEnd.toISOString(),
        };
      }));

      if (selectedRecord?.id === record.id) {
        setSelectedRecord(prev => prev ? {
          ...prev,
          date: editRecordDate,
          time_start: newStart.toISOString(),
          time_end: newEnd.toISOString(),
        } : prev);
      }
    } catch {
      // silent
    } finally {
      setSaving(false);
      setEditingRecord(null);
      setEditRecordDate('');
    }
  }, [editRecordDate, selectedRecord]);

  const resetAddForm = () => {
    setShowAddForm(false);
    setAddDescription('');
    setAddDate(todayISO());
    setAddQuantity('');
    setAddUnitPrice('');
    setAddDuration('');
    setAddJobTypeId(null);
    setAddError('');
  };

  const displayed = showAll ? records : records.slice(0, 5);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(prev => !prev)}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <History size={16} color={colors.primary} />
          <Text style={styles.headerTitle}>Service History</Text>
          {records.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{records.length}</Text>
            </View>
          )}
        </View>
        <View style={styles.headerRight}>
          {loading && <ActivityIndicator size="small" color={colors.primary} />}
          {expanded ? <ChevronUp size={18} color={colors.textSecondary} /> : <ChevronDown size={18} color={colors.textSecondary} />}
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.body}>
          {records.length === 0 && !loading && (
            <View style={styles.emptyState}>
              <FileText size={28} color={colors.textSecondary + '80'} />
              <Text style={styles.emptyTitle}>No service history yet</Text>
              <Text style={styles.emptySubtitle}>Add a record to track past services for this client</Text>
            </View>
          )}

          {displayed.map(record => (
            <TouchableOpacity
              key={`${record.source}-${record.id}`}
              style={styles.recordRow}
              onPress={() => {
                setEditingItemId(null);
                setEditingRecord(null);
                setSelectedRecord(record);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.recordLeft}>
                <Text style={styles.recordDate}>{formatDateStr(record.date)}</Text>
                <Text style={styles.recordServices} numberOfLines={1}>
                  {record.services.join(' + ')}
                </Text>
                {record.duration_minutes != null && record.duration_minutes > 0 && (
                  <View style={styles.recordMeta}>
                    <Clock size={11} color={colors.textSecondary} />
                    <Text style={styles.recordMetaText}>{formatDuration(record.duration_minutes)}</Text>
                  </View>
                )}
              </View>
              <View style={styles.recordRight}>
                {record.source === 'time_entry' || record.source === 'productivity_session' ? (
                  <Text style={[styles.recordTotal, { fontSize: 11, fontWeight: '600', color: record.time_kind === 'automatic' ? '#10b981' : colors.primary }]}>
                    {record.time_kind === 'automatic' ? 'AUTO' : 'MANUAL'}
                  </Text>
                ) : (
                  <Text style={styles.recordTotal}>{formatCurrency(record.total)}</Text>
                )}
                <ChevronRight size={14} color={colors.textSecondary} />
              </View>
            </TouchableOpacity>
          ))}

          {records.length > 5 && (
            <TouchableOpacity
              style={styles.viewMoreBtn}
              onPress={() => setShowAll(prev => !prev)}
              activeOpacity={0.7}
            >
              <Text style={styles.viewMoreText}>
                {showAll ? 'Show less' : `View ${records.length - 5} more`}
              </Text>
            </TouchableOpacity>
          )}

          {!showAddForm ? (
            <TouchableOpacity
              style={styles.addRecordBtn}
              onPress={() => setShowAddForm(true)}
              activeOpacity={0.7}
            >
              <Plus size={14} color={colors.primary} />
              <Text style={styles.addRecordBtnText}>Add Service Record</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.addForm}>
              <View style={styles.addFormHeader}>
                <Text style={styles.addFormTitle}>New Service Record</Text>
                <TouchableOpacity onPress={resetAddForm}>
                  <X size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {addError ? <Text style={styles.addFormError}>{addError}</Text> : null}

              <Text style={styles.addFormLabel}>Service / Description</Text>
              <TextInput
                style={styles.addFormInput}
                value={addDescription}
                onChangeText={setAddDescription}
                placeholder="e.g. Window Cleaning"
                placeholderTextColor={colors.textSecondary + '80'}
              />

              {jobTypes.length > 0 && (
                <>
                  <Text style={styles.addFormLabel}>Job Type (optional)</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.jobTypeScroll}>
                    <TouchableOpacity
                      style={[styles.jobTypeChip, !addJobTypeId && styles.jobTypeChipActive]}
                      onPress={() => setAddJobTypeId(null)}
                    >
                      <Text style={[styles.jobTypeChipText, !addJobTypeId && styles.jobTypeChipTextActive]}>None</Text>
                    </TouchableOpacity>
                    {jobTypes.map(jt => (
                      <TouchableOpacity
                        key={jt.id}
                        style={[styles.jobTypeChip, addJobTypeId === jt.id && styles.jobTypeChipActive]}
                        onPress={() => {
                          setAddJobTypeId(jt.id);
                          if (!addDescription.trim()) setAddDescription(jt.name);
                        }}
                      >
                        <Text style={[styles.jobTypeChipText, addJobTypeId === jt.id && styles.jobTypeChipTextActive]}>{jt.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}

              <Text style={styles.addFormLabel}>Date</Text>
              <TextInput
                style={styles.addFormInput}
                value={addDate}
                onChangeText={setAddDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textSecondary + '80'}
              />

              <View style={styles.addFormRow}>
                <View style={styles.addFormCol}>
                  <Text style={styles.addFormLabel}>Quantity / Panes</Text>
                  <TextInput
                    style={styles.addFormInput}
                    value={addQuantity}
                    onChangeText={setAddQuantity}
                    placeholder="1"
                    placeholderTextColor={colors.textSecondary + '80'}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.addFormCol}>
                  <Text style={styles.addFormLabel}>Price per Unit</Text>
                  <TextInput
                    style={styles.addFormInput}
                    value={addUnitPrice}
                    onChangeText={setAddUnitPrice}
                    placeholder="$0.00"
                    placeholderTextColor={colors.textSecondary + '80'}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <Text style={styles.addFormLabel}>Duration (minutes)</Text>
              <TextInput
                style={styles.addFormInput}
                value={addDuration}
                onChangeText={setAddDuration}
                placeholder="60"
                placeholderTextColor={colors.textSecondary + '80'}
                keyboardType="number-pad"
              />

              {(parseFloat(addQuantity) > 0 && parseFloat(addUnitPrice) > 0) && (
                <View style={styles.addFormTotalRow}>
                  <Text style={styles.addFormTotalLabel}>Total</Text>
                  <Text style={styles.addFormTotalValue}>
                    {formatCurrency((parseFloat(addQuantity) || 0) * (parseFloat(addUnitPrice) || 0))}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.addFormSaveBtn, addSaving && styles.addFormSaveBtnDisabled]}
                onPress={handleAddServiceRecord}
                disabled={addSaving}
                activeOpacity={0.7}
              >
                {addSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.addFormSaveBtnText}>Save Record</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      <Modal
        visible={!!selectedRecord}
        animationType="slide"
        transparent
        onRequestClose={() => { setSelectedRecord(null); setEditingItemId(null); setEditingRecord(null); }}
      >
        <View style={styles.detailOverlay}>
          <View style={styles.detailSheet}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle}>
                {selectedRecord ? formatDateStr(selectedRecord.date) : ''}
              </Text>
              <View style={styles.detailHeaderActions}>
                {selectedRecord?.source === 'schedule' && (
                  <TouchableOpacity
                    onPress={() => {
                      if (selectedRecord) handleDeleteRecord(selectedRecord);
                    }}
                    style={styles.detailDeleteBtn}
                  >
                    <Trash2 size={18} color="#dc2626" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => { setSelectedRecord(null); setEditingItemId(null); setEditingRecord(null); }}>
                  <X size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            {selectedRecord && (
              <ScrollView style={styles.detailScroll} showsVerticalScrollIndicator={false}>
                <View style={styles.detailMetaRow}>
                  <View style={styles.detailMetaItem}>
                    <Calendar size={14} color={colors.textSecondary} />
                    {editingRecord === selectedRecord.id ? (
                      <View style={styles.editDateRow}>
                        <TextInput
                          style={styles.editDateInput}
                          value={editRecordDate}
                          onChangeText={setEditRecordDate}
                          placeholder="YYYY-MM-DD"
                          placeholderTextColor={colors.textSecondary + '80'}
                          autoFocus
                        />
                        <TouchableOpacity
                          onPress={() => handleUpdateDate(selectedRecord)}
                          style={styles.editSaveBtn}
                          disabled={saving}
                        >
                          <Check size={14} color={colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => { setEditingRecord(null); setEditRecordDate(''); }}>
                          <X size={14} color={colors.textSecondary} />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.editableMetaRow}
                        onPress={() => {
                          if (selectedRecord.source === 'schedule') {
                            setEditingRecord(selectedRecord.id);
                            setEditRecordDate(selectedRecord.date);
                          }
                        }}
                        disabled={selectedRecord.source !== 'schedule'}
                        activeOpacity={selectedRecord.source === 'schedule' ? 0.6 : 1}
                      >
                        <Text style={styles.detailMetaText}>{formatDateStr(selectedRecord.date)}</Text>
                        {selectedRecord.source === 'schedule' && <Pencil size={10} color={colors.textSecondary} style={{ marginLeft: 4 }} />}
                      </TouchableOpacity>
                    )}
                  </View>
                  {selectedRecord.time_start && (
                    <View style={styles.detailMetaItem}>
                      <Clock size={14} color={colors.textSecondary} />
                      <Text style={styles.detailMetaText}>
                        {formatTime(selectedRecord.time_start)}
                        {selectedRecord.time_end ? ` - ${formatTime(selectedRecord.time_end)}` : ''}
                        {selectedRecord.duration_minutes && selectedRecord.duration_minutes > 0 ? ` (${formatDuration(selectedRecord.duration_minutes)})` : ''}
                      </Text>
                    </View>
                  )}
                  {selectedRecord.location && (
                    <View style={styles.detailMetaItem}>
                      <MapPin size={14} color={colors.textSecondary} />
                      <Text style={styles.detailMetaText} numberOfLines={1}>{selectedRecord.location}</Text>
                    </View>
                  )}
                  {selectedRecord.invoice_number && (
                    <View style={styles.detailMetaItem}>
                      <DollarSign size={14} color={colors.textSecondary} />
                      <Text style={styles.detailMetaText}>Invoice #{selectedRecord.invoice_number}</Text>
                    </View>
                  )}
                  {selectedRecord.payment_status && (
                    <View style={styles.detailMetaItem}>
                      <DollarSign size={14} color={
                        selectedRecord.payment_status === 'paid' ? '#16a34a' :
                        selectedRecord.payment_status === 'partial' ? '#d97706' : colors.textSecondary
                      } />
                      <Text style={[
                        styles.detailMetaText,
                        selectedRecord.payment_status === 'paid' && { color: '#16a34a' },
                        selectedRecord.payment_status === 'partial' && { color: '#d97706' },
                      ]}>
                        {selectedRecord.payment_status === 'paid' ? 'Paid' :
                         selectedRecord.payment_status === 'partial' ? 'Partially Paid' : 'Unpaid'}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.detailServicesSection}>
                  <View style={styles.detailSectionHeader}>
                    <Wrench size={14} color={colors.primary} />
                    <Text style={styles.detailSectionTitle}>Services</Text>
                  </View>
                  {selectedRecord.services.map((svc, i) => (
                    <Text key={i} style={styles.detailServiceName}>{svc}</Text>
                  ))}
                </View>

                {selectedRecord.line_items.length > 0 && (
                  <View style={styles.detailLineItems}>
                    <View style={styles.detailSectionHeader}>
                      <DollarSign size={14} color={colors.primary} />
                      <Text style={styles.detailSectionTitle}>Breakdown</Text>
                    </View>

                    <View style={styles.lineItemHeaderRow}>
                      <Text style={[styles.lineItemHeaderCell, { flex: 1 }]}>Service</Text>
                      <Text style={[styles.lineItemHeaderCell, { width: 50, textAlign: 'center' }]}>Qty</Text>
                      <Text style={[styles.lineItemHeaderCell, { width: 70, textAlign: 'right' }]}>Rate</Text>
                      <Text style={[styles.lineItemHeaderCell, { width: 70, textAlign: 'right' }]}>Total</Text>
                    </View>

                    {selectedRecord.line_items.map(item => {
                      const isEditing = editingItemId === item.id;
                      const canEdit = item.source_table === 'schedule_event_line_items';

                      return (
                        <View key={item.id} style={styles.lineItemDataRow}>
                          <View style={{ flex: 1, paddingRight: 4 }}>
                            <Text style={styles.lineItemDesc} numberOfLines={2}>
                              {item.job_type_name || item.description}
                            </Text>
                            {/* Scope badge / inline editor for schedule_event_line_items */}
                            {canEdit && editingScopeItemId === item.id ? (
                              <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                                <TouchableOpacity
                                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1.5, borderColor: (item.service_scope || 'full_service') === 'full_service' ? colors.primary : colors.border, backgroundColor: (item.service_scope || 'full_service') === 'full_service' ? colors.primary + '12' : 'transparent' }}
                                  onPress={() => handleSaveScope(item, 'full_service')}
                                  disabled={savingScope}
                                >
                                  {savingScope ? <ActivityIndicator size="small" color={colors.primary} /> : null}
                                  <Text style={{ fontSize: 11, fontWeight: '600', color: (item.service_scope || 'full_service') === 'full_service' ? colors.primary : colors.textSecondary }}>Full</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1.5, borderColor: item.service_scope === 'exterior_only' ? colors.primary : colors.border, backgroundColor: item.service_scope === 'exterior_only' ? colors.primary + '12' : 'transparent' }}
                                  onPress={() => handleSaveScope(item, 'exterior_only')}
                                  disabled={savingScope}
                                >
                                  <Text style={{ fontSize: 11, fontWeight: '600', color: item.service_scope === 'exterior_only' ? colors.primary : colors.textSecondary }}>Ext Only</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setEditingScopeItemId(null)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                                  <X size={12} color={colors.textSecondary} />
                                </TouchableOpacity>
                              </View>
                            ) : (
                              <TouchableOpacity
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3, alignSelf: 'flex-start' }}
                                onPress={() => canEdit ? setEditingScopeItemId(item.id) : undefined}
                                activeOpacity={canEdit ? 0.6 : 1}
                              >
                                <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: item.service_scope === 'exterior_only' ? '#f59e0b18' : colors.primary + '12' }}>
                                  <Text style={{ fontSize: 10, fontWeight: '600', color: item.service_scope === 'exterior_only' ? '#b45309' : colors.primary }}>
                                    {item.service_scope === 'exterior_only' ? 'Exterior Only' : item.service_scope === 'interior_only' ? 'Interior Only' : 'Full Service'}
                                  </Text>
                                </View>
                                {canEdit && <Pencil size={9} color={colors.textSecondary} />}
                              </TouchableOpacity>
                            )}
                          </View>
                          <Text style={[styles.lineItemCell, { width: 50, textAlign: 'center' }]}>
                            {item.quantity > 0 ? item.quantity : '-'}
                          </Text>
                          <View style={{ width: 70, alignItems: 'flex-end' }}>
                            {isEditing ? (
                              <View style={styles.editPriceRow}>
                                <TextInput
                                  style={styles.editPriceInput}
                                  value={editPrice}
                                  onChangeText={setEditPrice}
                                  keyboardType="decimal-pad"
                                  autoFocus
                                  selectTextOnFocus
                                  onSubmitEditing={() => handleSavePrice(item)}
                                />
                                <TouchableOpacity
                                  onPress={() => handleSavePrice(item)}
                                  style={styles.editSaveBtn}
                                  disabled={saving}
                                >
                                  {saving ? (
                                    <ActivityIndicator size="small" color={colors.primary} />
                                  ) : (
                                    <Check size={14} color={colors.primary} />
                                  )}
                                </TouchableOpacity>
                              </View>
                            ) : (
                              <TouchableOpacity
                                style={styles.editablePrice}
                                onPress={() => {
                                  if (!canEdit) return;
                                  setEditingItemId(item.id);
                                  setEditPrice(item.unit_price > 0 ? item.unit_price.toString() : '');
                                }}
                                disabled={!canEdit}
                                activeOpacity={canEdit ? 0.6 : 1}
                              >
                                <Text style={styles.lineItemCell}>
                                  {item.unit_price > 0 ? formatCurrency(item.unit_price) : '-'}
                                </Text>
                                {canEdit && <Pencil size={10} color={colors.textSecondary} style={{ marginLeft: 2 }} />}
                              </TouchableOpacity>
                            )}
                          </View>
                          <Text style={[styles.lineItemCell, styles.lineItemTotalCell, { width: 70, textAlign: 'right' }]}>
                            {formatCurrency(item.total)}
                          </Text>
                        </View>
                      );
                    })}

                    <View style={styles.totalRow}>
                      <Text style={styles.totalLabel}>Total</Text>
                      <Text style={styles.totalAmount}>{formatCurrency(selectedRecord.total)}</Text>
                    </View>
                  </View>
                )}

                {selectedRecord.line_items.length === 0 && selectedRecord.total > 0 && (
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total</Text>
                    <Text style={styles.totalAmount}>{formatCurrency(selectedRecord.total)}</Text>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function getStyles(colors: any) {
  return StyleSheet.create({
    container: {
      marginBottom: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    headerTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    countBadge: {
      backgroundColor: colors.primary + '20',
      borderRadius: 10,
      paddingHorizontal: 7,
      paddingVertical: 2,
    },
    countText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
    },
    body: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: 24,
      paddingHorizontal: 20,
      gap: 6,
    },
    emptyTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      marginTop: 4,
    },
    emptySubtitle: {
      fontSize: 12,
      color: colors.textSecondary + 'AA',
      textAlign: 'center',
    },
    recordRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderBottomWidth: 1,
      borderBottomColor: colors.border + '60',
    },
    recordLeft: {
      flex: 1,
      marginRight: 12,
    },
    recordDate: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    recordServices: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    recordMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 3,
    },
    recordMetaText: {
      fontSize: 11,
      color: colors.textSecondary,
    },
    recordRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    recordTotal: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
    },
    viewMoreBtn: {
      paddingVertical: 10,
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: colors.border + '40',
    },
    viewMoreText: {
      fontSize: 13,
      color: colors.primary,
      fontWeight: '600',
    },
    addRecordBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 12,
    },
    addRecordBtnText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
    },
    addForm: {
      padding: 14,
      borderTopWidth: 1,
      borderTopColor: colors.border + '60',
      backgroundColor: colors.background,
    },
    addFormHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    addFormTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    addFormError: {
      fontSize: 12,
      color: '#dc2626',
      marginBottom: 8,
    },
    addFormLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 4,
      marginTop: 10,
    },
    addFormInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: Platform.OS === 'web' ? 8 : 6,
      fontSize: 14,
      color: colors.text,
      backgroundColor: colors.surface,
    },
    addFormRow: {
      flexDirection: 'row',
      gap: 10,
    },
    addFormCol: {
      flex: 1,
    },
    jobTypeScroll: {
      maxHeight: 38,
      marginBottom: 2,
    },
    jobTypeChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: 6,
      backgroundColor: colors.surface,
    },
    jobTypeChipActive: {
      backgroundColor: colors.primary + '15',
      borderColor: colors.primary,
    },
    jobTypeChipText: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    jobTypeChipTextActive: {
      color: colors.primary,
      fontWeight: '600',
    },
    addFormTotalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border + '60',
    },
    addFormTotalLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    addFormTotalValue: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.primary,
    },
    addFormSaveBtn: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingVertical: 10,
      alignItems: 'center',
      marginTop: 14,
    },
    addFormSaveBtnDisabled: {
      opacity: 0.6,
    },
    addFormSaveBtnText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#fff',
    },
    detailOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    detailSheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '80%',
      paddingBottom: 32,
    },
    detailHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    detailHeaderActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    detailDeleteBtn: {
      padding: 4,
    },
    detailTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    detailScroll: {
      paddingHorizontal: 20,
      paddingTop: 16,
    },
    detailMetaRow: {
      gap: 8,
      marginBottom: 20,
    },
    detailMetaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    detailMetaText: {
      fontSize: 13,
      color: colors.textSecondary,
      flex: 1,
    },
    editableMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    editDateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flex: 1,
    },
    editDateInput: {
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: Platform.OS === 'web' ? 4 : 2,
      fontSize: 13,
      color: colors.text,
      flex: 1,
      backgroundColor: colors.surface,
    },
    detailServicesSection: {
      marginBottom: 20,
    },
    detailSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 8,
    },
    detailSectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    detailServiceName: {
      fontSize: 14,
      color: colors.text,
      paddingVertical: 2,
    },
    detailLineItems: {
      marginBottom: 20,
    },
    lineItemHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingBottom: 6,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      marginBottom: 2,
    },
    lineItemHeaderCell: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    lineItemDataRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border + '40',
    },
    lineItemDesc: {
      fontSize: 13,
      color: colors.text,
    },
    lineItemCell: {
      fontSize: 13,
      color: colors.text,
    },
    lineItemTotalCell: {
      fontWeight: '600',
    },
    editablePrice: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
    },
    editPriceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    editPriceInput: {
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: Platform.OS === 'web' ? 4 : 2,
      fontSize: 13,
      color: colors.text,
      width: 52,
      textAlign: 'right',
      backgroundColor: colors.surface,
    },
    editSaveBtn: {
      padding: 4,
    },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 12,
      marginTop: 4,
    },
    totalLabel: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    totalAmount: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.primary,
    },
  });
}
