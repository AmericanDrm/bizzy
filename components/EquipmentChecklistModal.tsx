import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { X, Package, SquareCheck as CheckSquare, Square, Calendar, ChevronRight } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { useOrganization } from '../contexts/OrganizationContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { LinearGradient } from 'expo-linear-gradient';

interface JobSupplyItem {
  id: string;
  supply_name: string;
  quantity?: number | null;
  unit?: string | null;
  notes?: string | null;
  is_acquired: boolean;
  job_id: string;
  job_title: string;
  job_start_time: string;
  client_name?: string;
}

interface EquipmentChecklistItem {
  id?: string;
  supply_item_id: string;
  supply_name: string;
  quantity?: number | null;
  unit?: string | null;
  is_checked: boolean;
  job_id: string;
  job_title: string;
  job_start_time: string;
  client_name?: string;
}

interface EquipmentChecklistModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function EquipmentChecklistModal({ visible, onClose }: EquipmentChecklistModalProps) {
  const { colors } = useTheme();
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<EquipmentChecklistItem[]>([]);
  const [todayJobCount, setTodayJobCount] = useState(0);
  const [saving, setSaving] = useState<string | null>(null);
  const [deduplicatedItems, setDeduplicatedItems] = useState<{ name: string; sources: string[]; is_checked: boolean; checklistId?: string }[]>([]);
  const [savingDedup, setSavingDedup] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'overview' | 'by_job'>('overview');

  const today = new Date().toISOString().split('T')[0];

  const loadEquipmentForToday = useCallback(async () => {
    if (!currentOrganization || !user) return;
    setLoading(true);
    try {
      const startOfDay = `${today}T00:00:00.000Z`;
      const endOfDay = `${today}T23:59:59.999Z`;

      const { data: events, error: eventsError } = await supabase
        .from('schedule_events')
        .select('id, title, start_time, client_id, client_address_id, clients(name)')
        .eq('organization_id', currentOrganization.id)
        .or(`assigned_to.eq.${user.id},user_id.eq.${user.id}`)
        .gte('start_time', startOfDay)
        .lte('start_time', endOfDay)
        .order('start_time', { ascending: true });

      if (eventsError) throw eventsError;

      const jobEvents = events || [];
      setTodayJobCount(jobEvents.length);

      if (jobEvents.length === 0) {
        setItems([]);
        setDeduplicatedItems([]);
        setLoading(false);
        return;
      }

      const eventIds = jobEvents.map((e: any) => e.id);
      const clientIds = [...new Set(jobEvents.map((e: any) => e.client_id).filter(Boolean))];
      const addressIds = [...new Set(jobEvents.map((e: any) => e.client_address_id).filter(Boolean))];

      const { data: supplies, error: suppliesError } = await supabase
        .from('job_supplies')
        .select('id, job_id, supply_name, quantity, unit, notes, is_acquired')
        .in('job_id', eventIds)
        .order('supply_name', { ascending: true });

      if (suppliesError) throw suppliesError;

      let addressEquipNames: string[] = [];
      if (addressIds.length > 0) {
        const { data: addrEquip } = await supabase
          .from('address_equipment')
          .select('equipment_inventory(name)')
          .in('address_id', addressIds);
        addressEquipNames = (addrEquip || []).map((ae: any) => ae.equipment_inventory?.name).filter(Boolean);
      }

      let clientEquipNames: string[] = [];
      if (clientIds.length > 0) {
        const { data: clientEquip } = await supabase
          .from('client_equipment')
          .select('equipment_inventory(name)')
          .in('client_id', clientIds);
        clientEquipNames = (clientEquip || []).map((ce: any) => ce.equipment_inventory?.name).filter(Boolean);
      }

      const { data: savedChecks } = await supabase
        .from('equipment_checklist_items')
        .select('id, schedule_event_id, equipment_name, is_checked')
        .eq('employee_id', user.id)
        .eq('work_date', today);

      const savedMap = new Map<string, { id: string; is_checked: boolean }>();
      const savedByNameMap = new Map<string, { id: string; is_checked: boolean }>();
      (savedChecks || []).forEach((c: any) => {
        const key = `${c.schedule_event_id}::${c.equipment_name}`;
        savedMap.set(key, { id: c.id, is_checked: c.is_checked });
        const nameKey = c.equipment_name?.toLowerCase();
        if (nameKey && !savedByNameMap.has(nameKey)) {
          savedByNameMap.set(nameKey, { id: c.id, is_checked: c.is_checked });
        }
      });

      const eventMap = new Map<string, any>();
      jobEvents.forEach((e: any) => eventMap.set(e.id, e));

      const checklistItems: EquipmentChecklistItem[] = (supplies || []).map((supply: any) => {
        const event = eventMap.get(supply.job_id);
        const key = `${supply.job_id}::${supply.supply_name}`;
        const saved = savedMap.get(key);
        return {
          id: saved?.id,
          supply_item_id: supply.id,
          supply_name: supply.supply_name,
          quantity: supply.quantity,
          unit: supply.unit,
          is_checked: saved?.is_checked ?? false,
          job_id: supply.job_id,
          job_title: event?.title || 'Job',
          job_start_time: event?.start_time || '',
          client_name: event?.clients?.name,
        };
      });

      setItems(checklistItems);

      const allNames = new Map<string, Set<string>>();
      (supplies || []).forEach((s: any) => {
        const nameLower = s.supply_name?.toLowerCase();
        if (!nameLower) return;
        if (!allNames.has(nameLower)) allNames.set(nameLower, new Set());
        const event = eventMap.get(s.job_id);
        allNames.get(nameLower)!.add(event?.clients?.name || event?.title || 'Job');
      });
      addressEquipNames.forEach((n) => {
        const nl = n.toLowerCase();
        if (!allNames.has(nl)) allNames.set(nl, new Set());
        allNames.get(nl)!.add('Address equipment');
      });
      clientEquipNames.forEach((n) => {
        const nl = n.toLowerCase();
        if (!allNames.has(nl)) allNames.set(nl, new Set());
        allNames.get(nl)!.add('Client equipment');
      });

      const deduped = Array.from(allNames.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([nameLower, sources]) => {
          const displayName = (supplies || []).find((s: any) => s.supply_name?.toLowerCase() === nameLower)?.supply_name
            || addressEquipNames.find((n: string) => n.toLowerCase() === nameLower)
            || clientEquipNames.find((n: string) => n.toLowerCase() === nameLower)
            || nameLower;
          const saved = savedByNameMap.get(nameLower);
          return { name: displayName, sources: Array.from(sources), is_checked: saved?.is_checked ?? false, checklistId: saved?.id };
        });
      setDeduplicatedItems(deduped);
    } catch (error: any) {
      showToast({ message: error.message || 'Failed to load equipment list', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [currentOrganization, user, today, showToast]);

  useEffect(() => {
    if (visible) {
      loadEquipmentForToday();
    }
  }, [visible, loadEquipmentForToday]);

  const handleToggleItem = async (index: number) => {
    const item = items[index];
    const newChecked = !item.is_checked;
    setSaving(`${item.job_id}::${item.supply_name}`);

    const updatedItems = [...items];
    updatedItems[index] = { ...item, is_checked: newChecked };
    setItems(updatedItems);

    try {
      if (item.id) {
        await supabase
          .from('equipment_checklist_items')
          .update({
            is_checked: newChecked,
            checked_at: newChecked ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id);
      } else {
        const { data: inserted } = await supabase
          .from('equipment_checklist_items')
          .insert({
            employee_id: user!.id,
            organization_id: currentOrganization!.id,
            schedule_event_id: item.job_id,
            equipment_name: item.supply_name,
            is_checked: newChecked,
            checked_at: newChecked ? new Date().toISOString() : null,
            work_date: today,
          })
          .select('id')
          .single();

        if (inserted) {
          updatedItems[index] = { ...updatedItems[index], id: inserted.id };
          setItems(updatedItems);
        }
      }
    } catch (error: any) {
      updatedItems[index] = { ...updatedItems[index], is_checked: !newChecked };
      setItems(updatedItems);
      showToast({ message: 'Failed to save check state', type: 'error' });
    } finally {
      setSaving(null);
    }
  };

  const handleToggleDedup = async (index: number) => {
    const item = deduplicatedItems[index];
    const newChecked = !item.is_checked;
    setSavingDedup(item.name);
    const updated = [...deduplicatedItems];
    updated[index] = { ...item, is_checked: newChecked };
    setDeduplicatedItems(updated);
    try {
      if (item.checklistId) {
        await supabase.from('equipment_checklist_items').update({ is_checked: newChecked, checked_at: newChecked ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq('id', item.checklistId);
      } else {
        const firstEventId = items[0]?.job_id || 'overview';
        const { data: inserted } = await supabase.from('equipment_checklist_items').insert({ employee_id: user!.id, organization_id: currentOrganization!.id, schedule_event_id: firstEventId, equipment_name: item.name, is_checked: newChecked, checked_at: newChecked ? new Date().toISOString() : null, work_date: today }).select('id').maybeSingle();
        if (inserted) { updated[index] = { ...updated[index], checklistId: inserted.id }; setDeduplicatedItems(updated); }
      }
    } catch {
      updated[index] = { ...updated[index], is_checked: !newChecked };
      setDeduplicatedItems(updated);
    } finally { setSavingDedup(null); }
  };

  const dedupChecked = deduplicatedItems.filter(i => i.is_checked).length;
  const dedupTotal = deduplicatedItems.length;
  const checkedCount = viewMode === 'overview' ? dedupChecked : items.filter(i => i.is_checked).length;
  const totalCount = viewMode === 'overview' ? dedupTotal : items.length;

  const groupedByJob = items.reduce<Record<string, EquipmentChecklistItem[]>>((acc, item) => {
    const key = item.job_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const formatTime = (isoString: string) => {
    if (!isoString) return '';
    try {
      return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const styles = getStyles(colors);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Package size={22} color={colors.primary} />
            <Text style={styles.headerTitle}>Equipment for Today</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {totalCount > 0 && (
          <View style={styles.progressBar}>
            <View style={styles.progressInfo}>
              <Text style={styles.progressText}>
                {checkedCount} of {totalCount} items loaded
              </Text>
              <Text style={[styles.progressText, { color: checkedCount === totalCount ? colors.success : colors.textSecondary }]}>
                {totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0}%
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: totalCount > 0 ? `${(checkedCount / totalCount) * 100}%` : '0%',
                    backgroundColor: checkedCount === totalCount ? colors.success : colors.primary,
                  },
                ]}
              />
            </View>
          </View>
        )}

        {!loading && todayJobCount > 0 && (items.length > 0 || deduplicatedItems.length > 0) && (
          <View style={{ flexDirection: 'row', marginHorizontal: 16, marginTop: 12, backgroundColor: colors.backgroundSecondary, borderRadius: 10, padding: 3, gap: 3 }}>
            <TouchableOpacity
              style={{ flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8, ...(viewMode === 'overview' ? { backgroundColor: colors.surface, ...Platform.select({ web: { boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }, default: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3 } }) } : {}) }}
              onPress={() => setViewMode('overview')}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: viewMode === 'overview' ? colors.primary : colors.textSecondary }}>All Equipment</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8, ...(viewMode === 'by_job' ? { backgroundColor: colors.surface, ...Platform.select({ web: { boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }, default: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3 } }) } : {}) }}
              onPress={() => setViewMode('by_job')}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: viewMode === 'by_job' ? colors.primary : colors.textSecondary }}>By Job</Text>
            </TouchableOpacity>
          </View>
        )}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading today's equipment...</Text>
          </View>
        ) : (
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {todayJobCount === 0 ? (
              <View style={styles.emptyState}>
                <Calendar size={48} color={colors.textTertiary} />
                <Text style={styles.emptyTitle}>No Jobs Scheduled Today</Text>
                <Text style={styles.emptySubtitle}>You have no assigned jobs for today.</Text>
              </View>
            ) : totalCount === 0 ? (
              <View style={styles.emptyState}>
                <Package size={48} color={colors.textTertiary} />
                <Text style={styles.emptyTitle}>No Equipment Lists</Text>
                <Text style={styles.emptySubtitle}>
                  You have {todayJobCount} job{todayJobCount !== 1 ? 's' : ''} today, but no supply lists have been added to them.
                </Text>
              </View>
            ) : viewMode === 'overview' ? (
              <View style={styles.jobSection}>
                <View style={styles.jobHeader}>
                  <View style={styles.jobHeaderLeft}>
                    <Text style={styles.jobTitle}>Equipment Needed Today</Text>
                    <Text style={styles.jobTime}>{todayJobCount} job{todayJobCount !== 1 ? 's' : ''} - {dedupTotal} unique item{dedupTotal !== 1 ? 's' : ''}</Text>
                  </View>
                  <View style={styles.jobBadge}>
                    <Text style={[styles.jobBadgeText, { color: dedupChecked === dedupTotal ? colors.success : colors.primary }]}>
                      {dedupChecked}/{dedupTotal}
                    </Text>
                  </View>
                </View>
                {deduplicatedItems.map((item, idx) => {
                  const isSaving = savingDedup === item.name;
                  return (
                    <TouchableOpacity
                      key={item.name}
                      style={[styles.itemRow, item.is_checked && styles.itemRowChecked]}
                      onPress={() => handleToggleDedup(idx)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.itemCheckbox}>
                        {isSaving ? (
                          <ActivityIndicator size="small" color={colors.primary} />
                        ) : item.is_checked ? (
                          <CheckSquare size={22} color={colors.success} />
                        ) : (
                          <Square size={22} color={colors.textSecondary} />
                        )}
                      </View>
                      <View style={styles.itemContent}>
                        <Text style={[styles.itemName, item.is_checked && styles.itemNameChecked]}>{item.name}</Text>
                        <Text style={styles.itemMeta}>{item.sources.join(', ')}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              Object.entries(groupedByJob).map(([jobId, jobItems]) => {
                const firstItem = jobItems[0];
                const jobCheckedCount = jobItems.filter(i => i.is_checked).length;
                return (
                  <View key={jobId} style={styles.jobSection}>
                    <View style={styles.jobHeader}>
                      <View style={styles.jobHeaderLeft}>
                        <Text style={styles.jobTitle} numberOfLines={1}>
                          {firstItem.client_name || firstItem.job_title}
                        </Text>
                        {firstItem.job_start_time ? (
                          <Text style={styles.jobTime}>{formatTime(firstItem.job_start_time)}</Text>
                        ) : null}
                      </View>
                      <View style={styles.jobBadge}>
                        <Text style={[styles.jobBadgeText, { color: jobCheckedCount === jobItems.length ? colors.success : colors.primary }]}>
                          {jobCheckedCount}/{jobItems.length}
                        </Text>
                      </View>
                    </View>

                    {jobItems.map((item, idx) => {
                      const globalIdx = items.findIndex(
                        i => i.job_id === jobId && i.supply_name === item.supply_name
                      );
                      const isSaving = saving === `${item.job_id}::${item.supply_name}`;
                      return (
                        <TouchableOpacity
                          key={`${item.job_id}-${item.supply_name}-${idx}`}
                          style={[styles.itemRow, item.is_checked && styles.itemRowChecked]}
                          onPress={() => handleToggleItem(globalIdx)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.itemCheckbox}>
                            {isSaving ? (
                              <ActivityIndicator size="small" color={colors.primary} />
                            ) : item.is_checked ? (
                              <CheckSquare size={22} color={colors.success} />
                            ) : (
                              <Square size={22} color={colors.textSecondary} />
                            )}
                          </View>
                          <View style={styles.itemContent}>
                            <Text style={[styles.itemName, item.is_checked && styles.itemNameChecked]}>
                              {item.supply_name}
                            </Text>
                            {(item.quantity || item.unit) ? (
                              <Text style={styles.itemMeta}>
                                {[item.quantity, item.unit].filter(Boolean).join(' ')}
                              </Text>
                            ) : null}
                          </View>
                          <ChevronRight size={16} color={colors.textTertiary} style={{ opacity: 0 }} />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              })
            )}
          </ScrollView>
        )}

        <View style={styles.footer}>
          <TouchableOpacity style={styles.doneButton} onPress={onClose} activeOpacity={0.8}>
            <LinearGradient
              colors={checkedCount === totalCount && totalCount > 0 ? ['#2D8B57', '#34a065'] : ['#1B4D6E', '#245d82']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gradientFill}
            >
              <Text style={styles.doneButtonText}>
                {checkedCount === totalCount && totalCount > 0 ? 'All Set - Done' : 'Done'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function getStyles(colors: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: Platform.OS === 'ios' ? 16 : 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    closeButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.backgroundSecondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    progressBar: {
      paddingHorizontal: 20,
      paddingVertical: 12,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    progressInfo: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    progressText: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    progressTrack: {
      height: 6,
      backgroundColor: colors.border,
      borderRadius: 3,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 3,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
    },
    loadingText: {
      fontSize: 15,
      color: colors.textSecondary,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 8,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 64,
      gap: 12,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    emptySubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      paddingHorizontal: 32,
      lineHeight: 20,
    },
    jobSection: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      marginBottom: 16,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    jobHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.backgroundSecondary,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    jobHeaderLeft: {
      flex: 1,
      gap: 2,
    },
    jobTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    jobTime: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    jobBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    jobBadgeText: {
      fontSize: 12,
      fontWeight: '700',
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 12,
    },
    itemRowChecked: {
      backgroundColor: colors.backgroundSecondary,
      opacity: 0.75,
    },
    itemCheckbox: {
      width: 24,
      alignItems: 'center',
    },
    itemContent: {
      flex: 1,
      gap: 2,
    },
    itemName: {
      fontSize: 15,
      color: colors.text,
      fontWeight: '500',
    },
    itemNameChecked: {
      textDecorationLine: 'line-through',
      color: colors.textSecondary,
    },
    itemMeta: {
      fontSize: 12,
      color: colors.textTertiary,
    },
    footer: {
      padding: 16,
      paddingBottom: Platform.OS === 'ios' ? 32 : 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
    },
    doneButton: {
      borderRadius: 12,
      alignItems: 'center',
      overflow: 'hidden',
    },
    doneButtonText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '700',
    },
    gradientFill: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      width: '100%',
    },
  });
}
