import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Pressable,
  Platform,
  Animated,
} from 'react-native';
import { X, Plus, Trash2, SquareCheck as CheckSquare, Square, Save, ChevronLeft, Calendar, CreditCard as Edit3, Copy, ClipboardList, GripVertical, Undo2 } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { useOrganization } from '../contexts/OrganizationContext';
import { useUserRole } from '../hooks/useUserRole';
import { useAuth } from '../contexts/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { useToast } from '../contexts/ToastContext';
import { useRegisterModal } from '../contexts/ModalStackContext';

interface TemplateItem {
  id?: string;
  label: string;
  description: string;
  notes?: string;
  display_order: number;
}

interface ChecklistTemplate {
  id: string;
  title: string;
  description?: string;
  created_by: string;
  created_at: string;
  is_shared: boolean;
  items: TemplateItem[];
}

interface ScheduleEvent {
  id: string;
  title: string;
  start_time: string;
  client_id?: string;
  client_name?: string;
}

type ViewMode = 'list' | 'create' | 'edit' | 'sendToJob';

interface ChecklistModalProps {
  visible: boolean;
  onClose: () => void;
  selectedChecklistId?: string | null;
}

export default function ChecklistModal({ visible, onClose, selectedChecklistId }: ChecklistModalProps) {
  useRegisterModal('checklist-modal', visible, onClose);
  const { colors } = useTheme();
  const { currentOrganization } = useOrganization();
  const { role } = useUserRole();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [renderKey, setRenderKey] = useState(0);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedTemplate, setSelectedTemplate] = useState<ChecklistTemplate | null>(null);

  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templateItems, setTemplateItems] = useState<TemplateItem[]>([]);
  const [newItemLabel, setNewItemLabel] = useState('');

  const [upcomingJobs, setUpcomingJobs] = useState<ScheduleEvent[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingDeletions, setPendingDeletions] = useState<Map<number, { item: TemplateItem; timer: NodeJS.Timeout }>>(new Map());
  const [showUndoToast, setShowUndoToast] = useState(false);
  const undoToastAnim = useRef(new Animated.Value(0)).current;

  const canEdit = role === 'owner' || role === 'manager' || role === 'admin';

  const loadTemplates = useCallback(async () => {
    if (!currentOrganization) return;

    setLoading(true);
    try {
      const timestamp = Date.now();
      const { data, error } = await supabase
        .from('checklist_templates')
        .select(`
          id,
          title,
          description,
          created_by,
          created_at,
          is_shared,
          checklist_template_items!template_id (
            id,
            label,
            description,
            notes,
            display_order
          )
        `)
        .eq('organization_id', currentOrganization.id)
        .eq('is_shared', true)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      const formattedTemplates: ChecklistTemplate[] = (data || []).map((template: any) => ({
        id: template.id,
        title: template.title,
        description: template.description,
        created_by: template.created_by,
        created_at: template.created_at,
        is_shared: template.is_shared,
        items: (template.checklist_template_items || [])
          .sort((a: any, b: any) => a.display_order - b.display_order)
          .map((item: any) => ({
            id: item.id,
            label: item.label || item.description,
            description: item.description,
            notes: item.notes,
            display_order: item.display_order,
          })),
      }));

      setTemplates(formattedTemplates);
    } catch (error: any) {
      showToast({ message: error.message || 'Failed to load templates', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [currentOrganization, showToast]);

  const loadUpcomingJobs = useCallback(async () => {
    if (!currentOrganization) return;

    setLoadingJobs(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('schedule_events')
        .select(`
          id,
          title,
          start_time,
          client_id,
          clients (
            name
          )
        `)
        .eq('organization_id', currentOrganization.id)
        .gte('start_time', today.toISOString())
        .order('start_time', { ascending: true })
        .limit(50);

      if (error) throw error;

      const jobs: ScheduleEvent[] = (data || []).map((job: any) => ({
        id: job.id,
        title: job.title,
        start_time: job.start_time,
        client_id: job.client_id,
        client_name: job.clients?.name,
      }));

      setUpcomingJobs(jobs);
    } catch (error: any) {
      showToast({ message: error.message || 'Failed to load jobs', type: 'error' });
    } finally {
      setLoadingJobs(false);
    }
  }, [currentOrganization, showToast]);

  useEffect(() => {
    if (visible) {
      setRenderKey(Date.now());
      setViewMode('list');
      setSelectedTemplate(null);
      loadTemplates();
    }
  }, [visible, loadTemplates]);

  useEffect(() => {
    if (visible && selectedChecklistId && templates.length > 0) {
      const template = templates.find(t => t.id === selectedChecklistId);
      if (template) {
        handleEditTemplate(template);
      }
    } else if (visible && !selectedChecklistId) {
      setViewMode('list');
      setSelectedTemplate(null);
    }
  }, [visible, selectedChecklistId, templates]);

  const resetForm = () => {
    setTemplateName('');
    setTemplateDescription('');
    setTemplateItems([]);
    setNewItemLabel('');
    setSelectedTemplate(null);
  };

  const handleAddItem = () => {
    if (!newItemLabel.trim()) return;

    setTemplateItems([
      ...templateItems,
      {
        label: newItemLabel.trim(),
        description: newItemLabel.trim(),
        display_order: templateItems.length,
      },
    ]);
    setNewItemLabel('');
  };

  const handleRemoveItem = (index: number) => {
    const item = templateItems[index];

    const timer = setTimeout(() => {
      const updated = templateItems.filter((_, i) => i !== index);
      setTemplateItems(updated.map((item, idx) => ({ ...item, display_order: idx })));

      setPendingDeletions(prev => {
        const newMap = new Map(prev);
        newMap.delete(index);
        return newMap;
      });

      if (pendingDeletions.size === 1) {
        hideUndoToast();
      }
    }, 5000);

    setPendingDeletions(prev => new Map(prev).set(index, { item, timer }));
    showUndoToastMessage();
  };

  const handleUndoDelete = (itemIndex?: number) => {
    if (itemIndex !== undefined) {
      const deletion = pendingDeletions.get(itemIndex);
      if (deletion) {
        clearTimeout(deletion.timer);
        setPendingDeletions(prev => {
          const newMap = new Map(prev);
          newMap.delete(itemIndex);
          return newMap;
        });
      }
    } else {
      pendingDeletions.forEach((deletion) => {
        clearTimeout(deletion.timer);
      });
      setPendingDeletions(new Map());
    }

    if (pendingDeletions.size <= 1) {
      hideUndoToast();
    }
  };

  const showUndoToastMessage = () => {
    setShowUndoToast(true);
    Animated.spring(undoToastAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 65,
      friction: 8,
    }).start();
  };

  const hideUndoToast = () => {
    Animated.timing(undoToastAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setShowUndoToast(false);
    });
  };

  useEffect(() => {
    return () => {
      pendingDeletions.forEach((deletion) => {
        clearTimeout(deletion.timer);
      });
    };
  }, []);

  const handleSaveTemplate = async () => {
    if (!currentOrganization || !user || !templateName.trim()) {
      showToast({ message: 'Please enter a template name', type: 'error' });
      return;
    }

    if (templateItems.length === 0) {
      showToast({ message: 'Please add at least one item', type: 'error' });
      return;
    }

    setSaving(true);
    try {
      if (viewMode === 'edit' && selectedTemplate) {
        const { error: updateError } = await supabase
          .from('checklist_templates')
          .update({
            title: templateName.trim(),
            name: templateName.trim(),
            description: templateDescription.trim() || '',
          })
          .eq('id', selectedTemplate.id);

        if (updateError) throw updateError;

        const { error: deleteItemsError } = await supabase
          .from('checklist_template_items')
          .delete()
          .eq('template_id', selectedTemplate.id);

        if (deleteItemsError) throw deleteItemsError;

        const itemsToInsert = templateItems.map((item) => ({
          checklist_template_id: selectedTemplate.id,
          template_id: selectedTemplate.id,
          organization_id: currentOrganization.id,
          label: item.label,
          description: item.description,
          notes: item.notes || '',
          display_order: item.display_order,
          sort_order: item.display_order,
        }));

        const { error: itemsError } = await supabase
          .from('checklist_template_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;

        showToast({ message: 'Checklist updated successfully', type: 'success' });
      } else {
        const { data: template, error: templateError } = await supabase
          .from('checklist_templates')
          .insert({
            organization_id: currentOrganization.id,
            title: templateName.trim(),
            name: templateName.trim(),
            description: templateDescription.trim() || '',
            created_by: user.id,
            is_shared: true,
          })
          .select()
          .single();

        if (templateError) throw templateError;

        const itemsToInsert = templateItems.map((item) => ({
          checklist_template_id: template.id,
          template_id: template.id,
          organization_id: currentOrganization.id,
          label: item.label,
          description: item.description,
          notes: item.notes || '',
          display_order: item.display_order,
          sort_order: item.display_order,
        }));

        const { error: itemsError } = await supabase
          .from('checklist_template_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;

        showToast({ message: 'Checklist saved successfully', type: 'success' });
      }

      resetForm();
      await loadTemplates();
      setViewMode('list');
    } catch (error: any) {
      showToast({ message: error.message || 'Failed to save checklist', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async (template: ChecklistTemplate) => {
    if (!canEdit) {
      showToast({ message: 'Only owners, admins, and managers can delete templates', type: 'error' });
      return;
    }

    Alert.alert('Delete Checklist', `Are you sure you want to delete "${template.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase
              .from('checklist_templates')
              .delete()
              .eq('id', template.id);

            if (error) throw error;

            showToast({ message: 'Checklist deleted', type: 'success' });
            await loadTemplates();
          } catch (error: any) {
            showToast({ message: error.message || 'Failed to delete', type: 'error' });
          }
        },
      },
    ]);
  };

  const handleEditTemplate = (template: ChecklistTemplate) => {
    setSelectedTemplate(template);
    setTemplateName(template.title);
    setTemplateDescription(template.description || '');
    setTemplateItems(template.items);
    setViewMode('edit');
  };

  const handleSendToJob = (template: ChecklistTemplate) => {
    setSelectedTemplate(template);
    loadUpcomingJobs();
    setViewMode('sendToJob');
  };

  const handleAttachToJob = async (job: ScheduleEvent) => {
    if (!selectedTemplate || !currentOrganization || !user) return;

    setSaving(true);
    try {
      const { data: checklist, error: checklistError } = await supabase
        .from('job_checklists')
        .insert({
          job_id: job.id,
          organization_id: currentOrganization.id,
          title: selectedTemplate.title,
          description: selectedTemplate.description || '',
          created_by: user.id,
        })
        .select()
        .single();

      if (checklistError) throw checklistError;

      if (selectedTemplate.items.length > 0) {
        const itemsToInsert = selectedTemplate.items.map((item) => ({
          checklist_id: checklist.id,
          organization_id: currentOrganization.id,
          description: item.label,
          notes: item.notes || '',
          display_order: item.display_order,
          is_completed: false,
          created_by: user.id,
        }));

        const { error: itemsError } = await supabase
          .from('job_checklist_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      showToast({ message: `Checklist added to "${job.title}"`, type: 'success' });
      setViewMode('list');
      setSelectedTemplate(null);
    } catch (error: any) {
      showToast({ message: error.message || 'Failed to attach checklist', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicateTemplate = async (template: ChecklistTemplate) => {
    if (!currentOrganization || !user) return;

    setSaving(true);
    try {
      const { data: newTemplate, error: templateError } = await supabase
        .from('checklist_templates')
        .insert({
          organization_id: currentOrganization.id,
          title: `${template.title} (Copy)`,
          name: `${template.title} (Copy)`,
          description: template.description || '',
          created_by: user.id,
          is_shared: true,
        })
        .select()
        .single();

      if (templateError) throw templateError;

      if (template.items.length > 0) {
        const itemsToInsert = template.items.map((item) => ({
          checklist_template_id: newTemplate.id,
          template_id: newTemplate.id,
          organization_id: currentOrganization.id,
          label: item.label,
          description: item.description,
          notes: item.notes || '',
          display_order: item.display_order,
          sort_order: item.display_order,
        }));

        const { error: itemsError } = await supabase
          .from('checklist_template_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      showToast({ message: 'Checklist duplicated', type: 'success' });
      await loadTemplates();
    } catch (error: any) {
      showToast({ message: error.message || 'Failed to duplicate', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const formatJobDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return `Today at ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return `Tomorrow at ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    } else {
      return date.toLocaleDateString([], {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    }
  };

  const filteredJobs = upcomingJobs.filter(
    (job) =>
      job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.client_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderListView = () => (
    <>
      {canEdit && (
        <TouchableOpacity
          style={[styles.createButton, styles.createButtonSolid]}
          onPress={() => {
            resetForm();
            setViewMode('create');
          }}
        >
          <Plus size={20} color="#fff" />
          <Text style={styles.createButtonText}>Create New Checklist</Text>
        </TouchableOpacity>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading checklists...
          </Text>
        </View>
      ) : templates.length === 0 ? (
        <View style={styles.emptyState}>
          <ClipboardList size={64} color={colors.textSecondary} strokeWidth={1.5} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No checklists yet</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Create reusable checklists to keep your jobs organized
          </Text>
          {canEdit && (
            <TouchableOpacity
              style={[styles.emptyButton, styles.emptyButtonSolid]}
              onPress={() => {
                resetForm();
                setViewMode('create');
              }}
            >
              <Plus size={20} color="#fff" />
              <Text style={styles.emptyButtonText}>Create Your First Checklist</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <ScrollView key={`tpl-list-${renderKey}`} style={styles.templateList} showsVerticalScrollIndicator={false}>
          {templates.map((template) => (
            <View
              key={`${template.id}-${renderKey}`}
              style={[
                styles.templateCard,
                { backgroundColor: colors.cardBackground, borderColor: colors.border },
              ]}
            >
              <View style={styles.templateCardContent}>
                <View style={styles.templateCardHeader}>
                  <View style={styles.templateCardInfo}>
                    <Text style={[styles.templateCardTitle, { color: colors.text }]} numberOfLines={1}>
                      {template.title}
                    </Text>
                    {template.description && (
                      <Text
                        style={[styles.templateCardDescription, { color: colors.textSecondary }]}
                        numberOfLines={2}
                      >
                        {template.description}
                      </Text>
                    )}
                  </View>
                </View>

                <View style={styles.templateCardFooter}>
                  <View style={[styles.itemCountBadge, { backgroundColor: colors.primary + '15' }]}>
                    <CheckSquare size={14} color={colors.primary} />
                    <Text style={[styles.itemCountText, { color: colors.primary }]}>
                      {template.items.length} {template.items.length === 1 ? 'item' : 'items'}
                    </Text>
                  </View>

                  <View style={styles.cardActionButtons}>
                    <TouchableOpacity
                      accessibilityLabel="Edit"
                      {...(Platform.OS === 'web' ? { title: 'Edit' } : {})}
                      style={[styles.cardActionButton, { backgroundColor: colors.primary + '12' }]}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleEditTemplate(template);
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Edit3 size={16} color={colors.primary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      accessibilityLabel="Duplicate"
                      {...(Platform.OS === 'web' ? { title: 'Duplicate' } : {})}
                      style={[styles.cardActionButton, { backgroundColor: colors.inputBackground }]}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleDuplicateTemplate(template);
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Copy size={16} color={colors.text} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      accessibilityLabel="Send to Job"
                      {...(Platform.OS === 'web' ? { title: 'Send to Job' } : {})}
                      style={[styles.cardActionButton, { backgroundColor: colors.inputBackground }]}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleSendToJob(template);
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Calendar size={16} color={colors.text} />
                    </TouchableOpacity>

                    {canEdit && (
                      <TouchableOpacity
                        accessibilityLabel="Delete"
                        {...(Platform.OS === 'web' ? { title: 'Delete' } : {})}
                        style={[styles.cardActionButton, { backgroundColor: colors.error + '12' }]}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleDeleteTemplate(template);
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Trash2 size={16} color={colors.error} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </>
  );

  const renderFormView = () => (
    <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}>
      <View style={styles.formSection}>
        <Text style={[styles.formLabel, { color: colors.text }]}>Checklist Name *</Text>
        <TextInput
          style={[styles.formInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
          placeholder="e.g., Deep Clean Checklist"
          placeholderTextColor={colors.textSecondary}
          value={templateName}
          onChangeText={setTemplateName}
        />
      </View>

      <View style={styles.formSection}>
        <Text style={[styles.formLabel, { color: colors.text }]}>Description (optional)</Text>
        <TextInput
          style={[
            styles.formInput,
            styles.formInputMultiline,
            { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text },
          ]}
          placeholder="Add a description for this checklist"
          placeholderTextColor={colors.textSecondary}
          value={templateDescription}
          onChangeText={setTemplateDescription}
          multiline
        />
      </View>

      <View style={styles.formSection}>
        <Text style={[styles.formLabel, { color: colors.text }]}>
          Checklist Items ({templateItems.length})
        </Text>

        {templateItems.length > 0 && (
          <View style={[styles.itemsList, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
            {templateItems.map((item, index) => {
              const isPendingDeletion = pendingDeletions.has(index);
              return (
                <View
                  key={index}
                  style={[
                    styles.itemRow,
                    index > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
                    isPendingDeletion && { opacity: 0.5 },
                  ]}
                >
                  <GripVertical size={18} color={colors.textSecondary} />
                  <View style={styles.itemRowContent}>
                    <Text style={[styles.itemRowLabel, { color: colors.text }]}>{item.label}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.itemRowDelete}
                    onPress={() => handleRemoveItem(index)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    disabled={isPendingDeletion}
                  >
                    <Trash2 size={16} color={colors.error} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.addItemContainer}>
          <TextInput
            style={[
              styles.addItemInput,
              { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text },
            ]}
            placeholder="Add checklist item"
            placeholderTextColor={colors.textSecondary}
            value={newItemLabel}
            onChangeText={setNewItemLabel}
            onSubmitEditing={handleAddItem}
            returnKeyType="done"
          />
          <TouchableOpacity
            style={[styles.addItemButton, { overflow: 'hidden' }]}
            onPress={handleAddItem}
            disabled={!newItemLabel.trim()}
          >
            <LinearGradient
              colors={['#1B4D6E', '#245d82']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gradientFillCentered}
            >
              <Plus size={20} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        style={[
          styles.saveButton,
          styles.saveButtonSolid,
          (!templateName.trim() || templateItems.length === 0) && styles.saveButtonDisabled,
        ]}
        onPress={handleSaveTemplate}
        disabled={saving || !templateName.trim() || templateItems.length === 0}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Save size={20} color="#fff" />
            <Text style={styles.saveButtonText}>
              {viewMode === 'edit' ? 'Update Checklist' : 'Save Checklist'}
            </Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );

  const renderSendToJobView = () => (
    <View style={styles.jobSelectContainer}>
      <Text style={[styles.jobSelectTitle, { color: colors.text }]}>
        Select a job to add this checklist to:
      </Text>

      {selectedTemplate && (
        <View style={[styles.selectedTemplatePreview, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
          <ClipboardList size={20} color={colors.primary} />
          <Text style={[styles.selectedTemplateTitle, { color: colors.text }]} numberOfLines={1}>
            {selectedTemplate.title}
          </Text>
          <Text style={[styles.selectedTemplateCount, { color: colors.textSecondary }]}>
            {selectedTemplate.items.length} items
          </Text>
        </View>
      )}

      <TextInput
        style={[styles.searchInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
        placeholder="Search jobs..."
        placeholderTextColor={colors.textSecondary}
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      {loadingJobs ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading jobs...</Text>
        </View>
      ) : filteredJobs.length === 0 ? (
        <View style={styles.emptyJobsState}>
          <Calendar size={48} color={colors.textSecondary} />
          <Text style={[styles.emptyJobsText, { color: colors.textSecondary }]}>
            {searchQuery ? 'No jobs match your search' : 'No upcoming jobs found'}
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.jobList} showsVerticalScrollIndicator={false}>
          {filteredJobs.map((job) => (
            <TouchableOpacity
              key={job.id}
              style={[styles.jobCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
              onPress={() => handleAttachToJob(job)}
              disabled={saving}
            >
              <View style={styles.jobCardContent}>
                <Text style={[styles.jobCardTitle, { color: colors.text }]} numberOfLines={1}>
                  {job.title}
                </Text>
                {job.client_name && (
                  <Text style={[styles.jobCardClient, { color: colors.textSecondary }]} numberOfLines={1}>
                    {job.client_name}
                  </Text>
                )}
                <Text style={[styles.jobCardDate, { color: colors.primary }]}>
                  {formatJobDate(job.start_time)}
                </Text>
              </View>
              <Plus size={20} color={colors.primary} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );

  const getHeaderTitle = () => {
    switch (viewMode) {
      case 'create':
        return 'Create Checklist';
      case 'edit':
        return 'Edit Checklist';
      case 'sendToJob':
        return 'Send to Job';
      default:
        return 'Checklists';
    }
  };

return (
  <>
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      key={`checklist-modal-${renderKey}`}
    >
      {/* Overlay */}
      <Pressable
        style={styles.modalOverlay}
        onPress={onClose}
      >
        {/* Modal content */}
        <Pressable
          style={[styles.modalContent, { backgroundColor: colors.surface }]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            {viewMode !== 'list' ? (
              <TouchableOpacity
                style={[styles.backButton, { backgroundColor: colors.inputBackground }]}
                onPress={() => {
                  setViewMode('list');
                  resetForm();
                }}
              >
                <ChevronLeft size={20} color={colors.text} />
              </TouchableOpacity>
            ) : (
              <View style={styles.headerSpacer} />
            )}

            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {getHeaderTitle()}
            </Text>

            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: colors.inputBackground }]}
              onPress={onClose}
            >
              <X size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <View style={styles.contentContainer}>
            {viewMode === 'list' && renderListView()}
            {(viewMode === 'create' || viewMode === 'edit') && renderFormView()}
            {viewMode === 'sendToJob' && renderSendToJobView()}
          </View>

          {/* Undo toast */}
          {showUndoToast && (
            <Animated.View
              style={[
                styles.undoToast,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  transform: [
                    {
                      translateY: undoToastAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [100, 0],
                      }),
                    },
                  ],
                  opacity: undoToastAnim,
                },
              ]}
            >
              <View style={styles.undoToastContent}>
                <Text style={[styles.undoToastText, { color: colors.text }]}>
                  {pendingDeletions.size} item{pendingDeletions.size > 1 ? 's' : ''} deleted
                </Text>

                <TouchableOpacity
                  style={[styles.undoButton, { overflow: 'hidden' }]}
                  onPress={handleUndoDelete}
                >
                  <LinearGradient
                    colors={['#1B4D6E', '#245d82']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.gradientFillUndo}
                  >
                    <Undo2 size={16} color="#fff" />
                    <Text style={styles.undoButtonText}>Undo</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  </>
);
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    borderRadius: 20,
    width: '95%',
    maxWidth: 600,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 36,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  createButton: {
    borderRadius: 8,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  createButtonSolid: {
    backgroundColor: '#1B4D6E',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyButton: {
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  emptyButtonSolid: {
    backgroundColor: '#1B4D6E',
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  templateList: {
    flex: 1,
  },
  templateCard: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  templateCardContent: {
    padding: 16,
  },
  templateCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  templateCardInfo: {
    flex: 1,
    marginRight: 12,
  },
  templateCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  templateCardDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  templateCardFooter: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  itemCountText: {
    fontSize: 13,
    fontWeight: '600',
  },
  cardActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardActionButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formContainer: {
    flex: 1,
  },
  formSection: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  formInputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  itemsList: {
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 10,
  },
  itemRowContent: {
    flex: 1,
  },
  itemRowLabel: {
    fontSize: 15,
  },
  itemRowDelete: {
    padding: 4,
  },
  addItemContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  addItemInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  addItemButton: {
    width: 48,
    height: 48,
    borderRadius: 10,
  },
  saveButton: {
    borderRadius: 8,
    marginTop: 10,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveButtonSolid: {
    backgroundColor: '#1B4D6E',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  jobSelectContainer: {
    flex: 1,
  },
  jobSelectTitle: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 12,
  },
  selectedTemplatePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  selectedTemplateTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  selectedTemplateCount: {
    fontSize: 13,
  },
  searchInput: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 16,
    padding: 0,
    margin: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  } as any,
  jobList: {
    flex: 1,
  },
  jobCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 10,
  },
  jobCardContent: {
    flex: 1,
    marginRight: 12,
  },
  jobCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  jobCardClient: {
    fontSize: 14,
    marginBottom: 4,
  },
  jobCardDate: {
    fontSize: 13,
    fontWeight: '500',
  },
  emptyJobsState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyJobsText: {
    marginTop: 16,
    fontSize: 15,
    textAlign: 'center',
  },
  undoToast: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  undoToastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  undoToastText: {
    fontSize: 15,
    fontWeight: '500',
  },
  undoButton: {
    borderRadius: 8,
  },
  undoButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  gradientFill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  gradientFillSave: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  gradientFillUndo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  gradientFillCentered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
