import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import {
  X,
  Wrench,
  Briefcase,
  Check,
  Trash2,
  Save,
  CalendarClock,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';

interface JobType {
  id: string;
  name: string;
  category_id: string | null;
}

interface JobTypeCategory {
  id: string;
  name: string;
  color: string;
}

interface EquipmentEditModalProps {
  visible: boolean;
  onClose: () => void;
  equipmentId: string | null;
  equipmentName?: string;
  equipmentCategory?: string;
  onSaved?: () => void;
}

export default function EquipmentEditModal({
  visible,
  onClose,
  equipmentId,
  equipmentName: initialName,
  equipmentCategory: initialCategory,
  onSaved,
}: EquipmentEditModalProps) {
  const { colors } = useTheme();
  const { currentOrganization } = useOrganization();
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [yearStarted, setYearStarted] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [jobTypes, setJobTypes] = useState<JobType[]>([]);
  const [jobTypeCategories, setJobTypeCategories] = useState<JobTypeCategory[]>([]);
  const [assignedJobTypeIds, setAssignedJobTypeIds] = useState<Set<string>>(new Set());

  const JOB_TYPE_DEFAULT_COLOR = '#3b82f6';

  const loadData = useCallback(async () => {
    if (!currentOrganization || !equipmentId) return;
    setLoading(true);
    try {
      const [equipResult, jobTypesResult, categoriesResult, assignmentsResult] = await Promise.all([
        supabase
          .from('equipment_inventory')
          .select('name, category, notes, year_started_in_service')
          .eq('id', equipmentId)
          .maybeSingle(),
        supabase
          .from('job_types')
          .select('id, name, category_id')
          .eq('organization_id', currentOrganization.id)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('job_type_categories')
          .select('id, name, color')
          .eq('organization_id', currentOrganization.id)
          .order('sort_order'),
        supabase
          .from('equipment_job_type_assignments')
          .select('job_type_id')
          .eq('equipment_id', equipmentId),
      ]);

      if (equipResult.data) {
        setName(equipResult.data.name || '');
        setCategory(equipResult.data.category || '');
        setNotes(equipResult.data.notes || '');
        setYearStarted(equipResult.data.year_started_in_service?.toString() || '');
      }

      setJobTypes(jobTypesResult.data || []);
      setJobTypeCategories(categoriesResult.data || []);
      setAssignedJobTypeIds(new Set((assignmentsResult.data || []).map((a: any) => a.job_type_id)));
    } catch (err: any) {
      showToast({ message: 'Failed to load equipment details', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [currentOrganization, equipmentId, showToast]);

  useEffect(() => {
    if (visible && equipmentId) {
      loadData();
    } else if (visible && !equipmentId) {
      setName(initialName || '');
      setCategory(initialCategory || '');
      setNotes('');
      setYearStarted('');
      setAssignedJobTypeIds(new Set());
      loadJobTypes();
    }
  }, [visible, equipmentId, loadData, initialName, initialCategory]);

  const loadJobTypes = async () => {
    if (!currentOrganization) return;
    const [jt, cats] = await Promise.all([
      supabase
        .from('job_types')
        .select('id, name, category_id')
        .eq('organization_id', currentOrganization.id)
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('job_type_categories')
        .select('id, name, color')
        .eq('organization_id', currentOrganization.id)
        .order('sort_order'),
    ]);
    setJobTypes(jt.data || []);
    setJobTypeCategories(cats.data || []);
  };

  const getCategoryColor = (categoryId: string | null) => {
    if (!categoryId) return JOB_TYPE_DEFAULT_COLOR;
    const cat = jobTypeCategories.find(c => c.id === categoryId);
    return cat?.color || JOB_TYPE_DEFAULT_COLOR;
  };

  const handleSave = async () => {
    if (!currentOrganization || !name.trim()) {
      showToast({ message: 'Equipment name is required', type: 'error' });
      return;
    }
    setSaving(true);
    try {
      let itemId = equipmentId;
      const yearVal = yearStarted.trim() ? parseInt(yearStarted.trim(), 10) : null;

      if (equipmentId) {
        const { error } = await supabase
          .from('equipment_inventory')
          .update({
            name: name.trim(),
            category: category.trim() || null,
            notes: notes.trim() || null,
            year_started_in_service: yearVal,
            updated_at: new Date().toISOString(),
          })
          .eq('id', equipmentId);
        if (error) throw error;
      } else {
        const { data: userData } = await supabase.auth.getUser();
        const { data: newItem, error } = await supabase
          .from('equipment_inventory')
          .insert({
            organization_id: currentOrganization.id,
            name: name.trim(),
            category: category.trim() || null,
            notes: notes.trim() || null,
            year_started_in_service: yearVal,
            created_by: userData.user?.id,
          })
          .select('id')
          .single();
        if (error) throw error;
        itemId = newItem.id;
      }

      if (itemId) {
        await supabase
          .from('equipment_job_type_assignments')
          .delete()
          .eq('equipment_id', itemId);

        if (assignedJobTypeIds.size > 0) {
          const assignments = Array.from(assignedJobTypeIds).map(jtId => ({
            equipment_id: itemId!,
            job_type_id: jtId,
            organization_id: currentOrganization.id,
          }));
          await supabase.from('equipment_job_type_assignments').insert(assignments);
        }
      }

      showToast({ message: equipmentId ? 'Equipment updated' : 'Equipment added', type: 'success' });
      onSaved?.();
      onClose();
    } catch (err: any) {
      showToast({ message: err.message || 'Failed to save', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const toggleJobType = (jtId: string) => {
    setAssignedJobTypeIds(prev => {
      const next = new Set(prev);
      if (next.has(jtId)) next.delete(jtId);
      else next.add(jtId);
      return next;
    });
  };

  const handleDelete = async () => {
    if (!equipmentId) return;
    setSaving(true);
    try {
      await supabase.from('equipment_inventory').update({ is_active: false }).eq('id', equipmentId);
      showToast({ message: 'Equipment removed', type: 'success' });
      onSaved?.();
      onClose();
    } catch (err: any) {
      showToast({ message: 'Failed to remove equipment', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const groupedJobTypes = jobTypeCategories.map(cat => ({
    ...cat,
    types: jobTypes.filter(jt => jt.category_id === cat.id),
  }));
  const uncategorized = jobTypes.filter(jt => !jt.category_id);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerLeft}>
              <Wrench size={20} color={colors.primary} />
              <Text style={[styles.headerTitle, { color: colors.text }]}>
                {equipmentId ? 'Edit Equipment' : 'Add Equipment'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.card }]}>
              <X size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Name</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                  value={name}
                  onChangeText={setName}
                  placeholder="Equipment name"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Category</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                  value={category}
                  onChangeText={setCategory}
                  placeholder="e.g. Ladders, Hand Tools, Safety"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              <View style={styles.fieldGroup}>
                <View style={styles.yearRow}>
                  <CalendarClock size={14} color={colors.textSecondary} />
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginBottom: 0 }]}>Year Started in Service</Text>
                </View>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                  value={yearStarted}
                  onChangeText={(text) => {
                    const cleaned = text.replace(/[^0-9]/g, '').slice(0, 4);
                    setYearStarted(cleaned);
                  }}
                  placeholder={`e.g. ${new Date().getFullYear()}`}
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="number-pad"
                  maxLength={4}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Maintenance Notes</Text>
                <TextInput
                  style={[styles.input, styles.textArea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Oil changes, blade replacements, tune-ups, repairs..."
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  numberOfLines={4}
                />
                <Text style={[styles.notesHint, { color: colors.textSecondary }]}>
                  Track maintenance history like oil changes, filter replacements, and repairs.
                </Text>
              </View>

              <View style={styles.fieldGroup}>
                <View style={styles.tagHeader}>
                  <Briefcase size={14} color={colors.textSecondary} />
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginBottom: 0 }]}>Job Types</Text>
                </View>
                <Text style={[styles.tagHint, { color: colors.textSecondary }]}>
                  Link this equipment to the job types it's used for. Manage job types in the Job Types module.
                </Text>

                {jobTypes.length === 0 ? (
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    No job types created yet. Add job types in the Job Types module.
                  </Text>
                ) : (
                  <View style={styles.jobTypesList}>
                    {groupedJobTypes.map(group => {
                      if (group.types.length === 0) return null;
                      return (
                        <View key={group.id} style={styles.jobTypeGroup}>
                          <View style={styles.groupLabelRow}>
                            <View style={[styles.groupDot, { backgroundColor: group.color }]} />
                            <Text style={[styles.groupLabel, { color: colors.textSecondary }]}>{group.name}</Text>
                          </View>
                          <View style={styles.tagGrid}>
                            {group.types.map(jt => {
                              const isAssigned = assignedJobTypeIds.has(jt.id);
                              const chipColor = group.color;
                              return (
                                <TouchableOpacity
                                  key={jt.id}
                                  style={[
                                    styles.tagChip,
                                    {
                                      backgroundColor: isAssigned ? chipColor : chipColor + '15',
                                      borderColor: isAssigned ? chipColor : chipColor + '40',
                                    },
                                  ]}
                                  onPress={() => toggleJobType(jt.id)}
                                >
                                  {isAssigned && <Check size={12} color="#fff" />}
                                  <Text style={[styles.tagChipText, { color: isAssigned ? '#fff' : chipColor }]}>
                                    {jt.name}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </View>
                      );
                    })}
                    {uncategorized.length > 0 && (
                      <View style={styles.jobTypeGroup}>
                        {groupedJobTypes.some(g => g.types.length > 0) && (
                          <Text style={[styles.groupLabel, { color: colors.textSecondary }]}>Other</Text>
                        )}
                        <View style={styles.tagGrid}>
                          {uncategorized.map(jt => {
                            const isAssigned = assignedJobTypeIds.has(jt.id);
                            return (
                              <TouchableOpacity
                                key={jt.id}
                                style={[
                                  styles.tagChip,
                                  {
                                    backgroundColor: isAssigned ? JOB_TYPE_DEFAULT_COLOR : JOB_TYPE_DEFAULT_COLOR + '15',
                                    borderColor: isAssigned ? JOB_TYPE_DEFAULT_COLOR : JOB_TYPE_DEFAULT_COLOR + '40',
                                  },
                                ]}
                                onPress={() => toggleJobType(jt.id)}
                              >
                                {isAssigned && <Check size={12} color="#fff" />}
                                <Text style={[styles.tagChipText, { color: isAssigned ? '#fff' : JOB_TYPE_DEFAULT_COLOR }]}>
                                  {jt.name}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    )}
                  </View>
                )}
              </View>

              {equipmentId && (
                <TouchableOpacity style={styles.deleteRow} onPress={handleDelete}>
                  <Trash2 size={16} color="#ef4444" />
                  <Text style={styles.deleteText}>Remove Equipment</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          )}

          <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.card }]}>
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving || !name.trim()}
            >
              <LinearGradient
                colors={['#1B4D6E', '#245d82']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradientFill}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Save size={18} color="#fff" />
                    <Text style={styles.saveBtnText}>{equipmentId ? 'Save Changes' : 'Add Equipment'}</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '85%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 20,
    gap: 20,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  notesHint: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  tagHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  tagHint: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  jobTypesList: {
    gap: 12,
  },
  jobTypeGroup: {
    gap: 6,
  },
  groupLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  groupDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  groupLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  tagGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  tagChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  deleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    marginTop: 8,
  },
  deleteText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    borderTopWidth: 1,
  },
  saveBtn: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  gradientFill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    width: '100%',
  },
});
