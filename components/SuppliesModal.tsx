import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { X, Plus, Trash2, Package, Save, ChevronLeft, MoveVertical as MoreVertical, Calendar, CreditCard as Edit3, Copy, GripVertical, DollarSign } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { useOrganization } from '../contexts/OrganizationContext';
import { useUserRole } from '../hooks/useUserRole';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { LinearGradient } from 'expo-linear-gradient';
import { useRegisterModal } from '../contexts/ModalStackContext';

interface TemplateItem {
  id?: string;
  name: string;
  quantity?: number;
  unit?: string;
  price?: number;
  notes?: string;
  display_order: number;
}

interface SupplyTemplate {
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

interface SuppliesModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function SuppliesModal({ visible, onClose }: SuppliesModalProps) {
  useRegisterModal('supplies-modal', visible, onClose);
  const { colors } = useTheme();
  const { currentOrganization } = useOrganization();
  const { role } = useUserRole();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [templates, setTemplates] = useState<SupplyTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedTemplate, setSelectedTemplate] = useState<SupplyTemplate | null>(null);
  const [showActionMenu, setShowActionMenu] = useState<string | null>(null);

  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templateItems, setTemplateItems] = useState<TemplateItem[]>([]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');

  const [upcomingJobs, setUpcomingJobs] = useState<ScheduleEvent[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const canEdit = role === 'owner' || role === 'manager' || role === 'admin';

  const loadTemplates = useCallback(async () => {
    if (!currentOrganization) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('supply_templates')
        .select(`
          id,
          title,
          description,
          created_by,
          created_at,
          is_shared,
          supply_template_items (
            id,
            name,
            quantity,
            unit,
            price,
            notes,
            display_order
          )
        `)
        .eq('organization_id', currentOrganization.id)
        .eq('is_shared', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedTemplates: SupplyTemplate[] = (data || []).map((template: any) => ({
        id: template.id,
        title: template.title,
        description: template.description,
        created_by: template.created_by,
        created_at: template.created_at,
        is_shared: template.is_shared,
        items: (template.supply_template_items || [])
          .sort((a: any, b: any) => a.display_order - b.display_order)
          .map((item: any) => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            price: item.price,
            notes: item.notes,
            display_order: item.display_order,
          })),
      }));

      setTemplates(formattedTemplates);
    } catch (error: any) {
      showToast({ message: error.message || 'Failed to load supply lists', type: 'error' });
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
      loadTemplates();
      setViewMode('list');
      setSelectedTemplate(null);
      setShowActionMenu(null);
    }
  }, [visible, loadTemplates]);

  const resetForm = () => {
    setTemplateName('');
    setTemplateDescription('');
    setTemplateItems([]);
    setNewItemName('');
    setNewItemQuantity('');
    setNewItemUnit('');
    setNewItemPrice('');
    setSelectedTemplate(null);
  };

  const handleAddItem = () => {
    if (!newItemName.trim()) return;

    setTemplateItems([
      ...templateItems,
      {
        name: newItemName.trim(),
        quantity: newItemQuantity ? parseFloat(newItemQuantity) : undefined,
        unit: newItemUnit.trim() || undefined,
        price: newItemPrice ? parseFloat(newItemPrice) : undefined,
        display_order: templateItems.length,
      },
    ]);
    setNewItemName('');
    setNewItemQuantity('');
    setNewItemUnit('');
    setNewItemPrice('');
  };

  const handleRemoveItem = (index: number) => {
    const updated = templateItems.filter((_, i) => i !== index);
    setTemplateItems(updated.map((item, idx) => ({ ...item, display_order: idx })));
  };

  const handleSaveTemplate = async () => {
    if (!currentOrganization || !user || !templateName.trim()) {
      showToast({ message: 'Please enter a list name', type: 'error' });
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
          .from('supply_templates')
          .update({
            title: templateName.trim(),
            description: templateDescription.trim() || '',
          })
          .eq('id', selectedTemplate.id);

        if (updateError) throw updateError;

        const { error: deleteItemsError } = await supabase
          .from('supply_template_items')
          .delete()
          .eq('template_id', selectedTemplate.id);

        if (deleteItemsError) throw deleteItemsError;

        const itemsToInsert = templateItems.map((item) => ({
          template_id: selectedTemplate.id,
          organization_id: currentOrganization.id,
          name: item.name,
          quantity: item.quantity || null,
          unit: item.unit || null,
          price: item.price || null,
          notes: item.notes || '',
          display_order: item.display_order,
        }));

        const { error: itemsError } = await supabase
          .from('supply_template_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;

        showToast({ message: 'Supply list updated successfully', type: 'success' });
      } else {
        const { data: template, error: templateError } = await supabase
          .from('supply_templates')
          .insert({
            organization_id: currentOrganization.id,
            title: templateName.trim(),
            description: templateDescription.trim() || '',
            created_by: user.id,
            is_shared: true,
          })
          .select()
          .single();

        if (templateError) throw templateError;

        const itemsToInsert = templateItems.map((item) => ({
          template_id: template.id,
          organization_id: currentOrganization.id,
          name: item.name,
          quantity: item.quantity || null,
          unit: item.unit || null,
          price: item.price || null,
          notes: item.notes || '',
          display_order: item.display_order,
        }));

        const { error: itemsError } = await supabase
          .from('supply_template_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;

        showToast({ message: 'Supply list saved successfully', type: 'success' });
      }

      resetForm();
      await loadTemplates();
      setViewMode('list');
    } catch (error: any) {
      showToast({ message: error.message || 'Failed to save supply list', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async (template: SupplyTemplate) => {
    if (!canEdit) {
      showToast({ message: 'Only owners, admins, and managers can delete supply lists', type: 'error' });
      return;
    }

    Alert.alert('Delete Supply List', `Are you sure you want to delete "${template.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase
              .from('supply_templates')
              .delete()
              .eq('id', template.id);

            if (error) throw error;

            showToast({ message: 'Supply list deleted', type: 'success' });
            await loadTemplates();
          } catch (error: any) {
            showToast({ message: error.message || 'Failed to delete', type: 'error' });
          }
        },
      },
    ]);
    setShowActionMenu(null);
  };

  const handleEditTemplate = (template: SupplyTemplate) => {
    setSelectedTemplate(template);
    setTemplateName(template.title);
    setTemplateDescription(template.description || '');
    setTemplateItems(template.items);
    setViewMode('edit');
    setShowActionMenu(null);
  };

  const handleSendToJob = (template: SupplyTemplate) => {
    setSelectedTemplate(template);
    loadUpcomingJobs();
    setViewMode('sendToJob');
    setShowActionMenu(null);
  };

  const handleAttachToJob = async (job: ScheduleEvent) => {
    if (!selectedTemplate || !currentOrganization || !user) return;

    setSaving(true);
    try {
      if (selectedTemplate.items.length > 0) {
        const suppliesToInsert = selectedTemplate.items.map((item) => ({
          job_id: job.id,
          organization_id: currentOrganization.id,
          supply_name: item.name,
          quantity: item.quantity || null,
          unit: item.unit || null,
          price: item.price || null,
          notes: item.notes || '',
          is_acquired: false,
          created_by: user.id,
        }));

        const { error: suppliesError } = await supabase
          .from('job_supplies')
          .insert(suppliesToInsert);

        if (suppliesError) throw suppliesError;
      }

      showToast({ message: `Supplies added to "${job.title}"`, type: 'success' });
      setViewMode('list');
      setSelectedTemplate(null);
    } catch (error: any) {
      showToast({ message: error.message || 'Failed to add supplies', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicateTemplate = async (template: SupplyTemplate) => {
    if (!currentOrganization || !user) return;

    setSaving(true);
    try {
      const { data: newTemplate, error: templateError } = await supabase
        .from('supply_templates')
        .insert({
          organization_id: currentOrganization.id,
          title: `${template.title} (Copy)`,
          description: template.description || '',
          created_by: user.id,
          is_shared: true,
        })
        .select()
        .single();

      if (templateError) throw templateError;

      if (template.items.length > 0) {
        const itemsToInsert = template.items.map((item) => ({
          template_id: newTemplate.id,
          organization_id: currentOrganization.id,
          name: item.name,
          quantity: item.quantity || null,
          unit: item.unit || null,
          price: item.price || null,
          notes: item.notes || '',
          display_order: item.display_order,
        }));

        const { error: itemsError } = await supabase
          .from('supply_template_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      showToast({ message: 'Supply list duplicated', type: 'success' });
      await loadTemplates();
    } catch (error: any) {
      showToast({ message: error.message || 'Failed to duplicate', type: 'error' });
    } finally {
      setSaving(false);
      setShowActionMenu(null);
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
          style={styles.createButton}
          onPress={() => {
            resetForm();
            setViewMode('create');
          }}
        >
          <LinearGradient
            colors={['#1B4D6E', '#245d82']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientFill}
          >
            <Plus size={20} color="#fff" />
            <Text style={styles.createButtonText}>Create New Supply List</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading supply lists...
          </Text>
        </View>
      ) : templates.length === 0 ? (
        <View style={styles.emptyState}>
          <Package size={64} color={colors.textSecondary} strokeWidth={1.5} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No supply lists yet</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Create reusable supply lists to track materials for your jobs
          </Text>
          {canEdit && (
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => {
                resetForm();
                setViewMode('create');
              }}
            >
              <LinearGradient
                colors={['#1B4D6E', '#245d82']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradientFill}
              >
                <Plus size={20} color="#fff" />
                <Text style={styles.emptyButtonText}>Create Your First Supply List</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <ScrollView style={styles.templateList} showsVerticalScrollIndicator={false}>
          {templates.map((template) => (
            <TouchableOpacity
              key={template.id}
              style={[styles.templateCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
              onPress={() => handleEditTemplate(template)}
              activeOpacity={0.7}
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
                  <TouchableOpacity
                    style={[styles.menuButton, { backgroundColor: colors.inputBackground }]}
                    onPress={(e) => {
                      e.stopPropagation();
                      setShowActionMenu(showActionMenu === template.id ? null : template.id);
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <MoreVertical size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <View style={styles.templateCardFooter}>
                  <View style={[styles.itemCountBadge, { backgroundColor: colors.primary + '15' }]}>
                    <Package size={14} color={colors.primary} />
                    <Text style={[styles.itemCountText, { color: colors.primary }]}>
                      {template.items.length} {template.items.length === 1 ? 'item' : 'items'}
                    </Text>
                  </View>
                </View>

                {showActionMenu === template.id && (
                  <View style={[styles.actionMenu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <TouchableOpacity
                      style={styles.actionMenuItem}
                      onPress={() => handleSendToJob(template)}
                    >
                      <Calendar size={18} color={colors.primary} />
                      <Text style={[styles.actionMenuText, { color: colors.text }]}>Send to Job</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionMenuItem}
                      onPress={() => handleEditTemplate(template)}
                    >
                      <Edit3 size={18} color={colors.text} />
                      <Text style={[styles.actionMenuText, { color: colors.text }]}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionMenuItem}
                      onPress={() => handleDuplicateTemplate(template)}
                    >
                      <Copy size={18} color={colors.text} />
                      <Text style={[styles.actionMenuText, { color: colors.text }]}>Duplicate</Text>
                    </TouchableOpacity>
                    <View style={[styles.actionMenuDivider, { backgroundColor: colors.border }]} />
                    <TouchableOpacity
                      style={styles.actionMenuItem}
                      onPress={() => handleDeleteTemplate(template)}
                    >
                      <Trash2 size={18} color={colors.error} />
                      <Text style={[styles.actionMenuText, { color: colors.error }]}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </>
  );

  const renderFormView = () => (
    <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}>
      <View style={styles.formSection}>
        <Text style={[styles.formLabel, { color: colors.text }]}>List Name *</Text>
        <TextInput
          style={[styles.formInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
          placeholder="e.g., Lawn Care Supplies"
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
          placeholder="Add a description for this supply list"
          placeholderTextColor={colors.textSecondary}
          value={templateDescription}
          onChangeText={setTemplateDescription}
          multiline
        />
      </View>

      <View style={styles.formSection}>
        <Text style={[styles.formLabel, { color: colors.text }]}>
          Supply Items ({templateItems.length})
        </Text>

        {templateItems.length > 0 && (
          <View style={[styles.itemsList, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
            {templateItems.map((item, index) => (
              <View
                key={index}
                style={[styles.itemRow, index > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
              >
                <GripVertical size={18} color={colors.textSecondary} />
                <View style={styles.itemRowContent}>
                  <Text style={[styles.itemRowLabel, { color: colors.text }]}>{item.name}</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
                    {(item.quantity || item.unit) && (
                      <Text style={[styles.itemRowMeta, { color: colors.textSecondary }]}>
                        {item.quantity} {item.unit}
                      </Text>
                    )}
                    {item.price && (
                      <Text style={[styles.itemRowMeta, { color: colors.primary, fontWeight: '600' }]}>
                        ${item.price.toFixed(2)}
                      </Text>
                    )}
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.itemRowDelete}
                  onPress={() => handleRemoveItem(index)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Trash2 size={16} color={colors.error} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <View style={styles.addItemContainer}>
          <TextInput
            style={[
              styles.addItemInput,
              { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text },
            ]}
            placeholder="Item name"
            placeholderTextColor={colors.textSecondary}
            value={newItemName}
            onChangeText={setNewItemName}
          />
        </View>
        <View style={styles.addItemRow}>
          <TextInput
            style={[
              styles.addItemSmall,
              { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text },
            ]}
            placeholder="Qty"
            placeholderTextColor={colors.textSecondary}
            value={newItemQuantity}
            onChangeText={setNewItemQuantity}
            keyboardType="numeric"
          />
          <TextInput
            style={[
              styles.addItemUnit,
              { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text },
            ]}
            placeholder="Unit"
            placeholderTextColor={colors.textSecondary}
            value={newItemUnit}
            onChangeText={setNewItemUnit}
          />
          <View style={[
            styles.addItemPriceContainer,
            { backgroundColor: colors.inputBackground, borderColor: colors.border },
          ]}>
            <DollarSign size={16} color={colors.textSecondary} />
            <TextInput
              style={[styles.addItemPriceInput, { color: colors.text }]}
              placeholder="Price"
              placeholderTextColor={colors.textSecondary}
              value={newItemPrice}
              onChangeText={setNewItemPrice}
              keyboardType="decimal-pad"
            />
          </View>
          <TouchableOpacity
            style={styles.addItemButton}
            onPress={handleAddItem}
            disabled={!newItemName.trim()}
          >
            <LinearGradient
              colors={['#1B4D6E', '#245d82']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gradientFillCenter}
            >
              <Plus size={20} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        style={[
          styles.saveButton,
          (!templateName.trim() || templateItems.length === 0) && styles.saveButtonDisabled,
        ]}
        onPress={handleSaveTemplate}
        disabled={saving || !templateName.trim() || templateItems.length === 0}
      >
        <LinearGradient
          colors={['#1B4D6E', '#245d82']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientFill}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Save size={20} color="#fff" />
              <Text style={styles.saveButtonText}>
                {viewMode === 'edit' ? 'Update Supply List' : 'Save Supply List'}
              </Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderSendToJobView = () => (
    <View style={styles.jobSelectContainer}>
      <Text style={[styles.jobSelectTitle, { color: colors.text }]}>
        Select a job to add these supplies to:
      </Text>

      {selectedTemplate && (
        <View style={[styles.selectedTemplatePreview, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
          <Package size={20} color={colors.primary} />
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
        return 'Create Supply List';
      case 'edit':
        return 'Edit Supply List';
      case 'sendToJob':
        return 'Send to Job';
      default:
        return 'Materials & Supplies';
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={styles.modalOverlay}
        onPress={() => {
          if (showActionMenu) {
            setShowActionMenu(null);
          }
        }}
      >
        <Pressable style={[styles.modalContent, { backgroundColor: colors.surface }]} onPress={() => setShowActionMenu(null)}>
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
            <Text style={[styles.headerTitle, { color: colors.text }]}>{getHeaderTitle()}</Text>
            <TouchableOpacity style={[styles.closeButton, { backgroundColor: colors.inputBackground }]} onPress={onClose}>
              <X size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.contentContainer}>
            {viewMode === 'list' && renderListView()}
            {(viewMode === 'create' || viewMode === 'edit') && renderFormView()}
            {viewMode === 'sendToJob' && renderSendToJobView()}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
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
    overflow: 'hidden',
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
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
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
    borderRadius: 12,
    overflow: 'hidden',
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
    overflow: 'visible',
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
  menuButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateCardFooter: {
    marginTop: 12,
    flexDirection: 'row',
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
  actionMenu: {
    position: 'absolute',
    top: 48,
    right: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 8,
    minWidth: 160,
    zIndex: 100,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      },
      default: {
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
    }),
  },
  actionMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  actionMenuText: {
    fontSize: 15,
    fontWeight: '500',
  },
  actionMenuDivider: {
    height: 1,
    marginVertical: 4,
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
    overflow: 'hidden',
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
  itemRowMeta: {
    fontSize: 13,
    marginTop: 2,
  },
  itemRowDelete: {
    padding: 4,
  },
  addItemContainer: {
    marginBottom: 8,
  },
  addItemInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  addItemRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  addItemSmall: {
    width: 60,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 12,
    fontSize: 15,
  },
  addItemMedium: {
    flex: 1,
    minWidth: 60,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  addItemUnit: {
    width: 70,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 12,
    fontSize: 15,
  },
  addItemPriceContainer: {
    flex: 1,
    minWidth: 80,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    gap: 4,
  },
  addItemPriceInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
  },
  addItemButton: {
    width: 48,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  saveButton: {
    borderRadius: 12,
    marginTop: 10,
    marginBottom: 20,
    overflow: 'hidden',
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
  gradientFill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    width: '100%',
  },
  gradientFillCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
});
