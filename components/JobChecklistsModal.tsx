import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Animated,
  Image,
} from 'react-native';
import { X, Plus, Trash2, SquareCheck as CheckSquare, Square, FileText, ChevronDown, ChevronUp, CreditCard as Edit3, Save, Undo2, Camera, Images } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useUserRole } from '@/hooks/useUserRole';

interface ItemPhoto {
  id: string;
  photo_id: string;
  photo_url: string;
  annotated_url?: string;
  caption?: string;
}

interface ChecklistItem {
  id: string;
  checklist_id: string;
  description: string;
  notes: string;
  is_completed: boolean;
  completed_by?: string;
  completed_at?: string;
  created_by?: string;
  display_order: number;
  photos?: ItemPhoto[];
}

interface Checklist {
  id: string;
  job_id: string;
  title: string;
  description: string;
  created_by: string;
  created_at: string;
  items: ChecklistItem[];
  progress: {
    total: number;
    completed: number;
    percentage: number;
  };
}

interface JobChecklistsModalProps {
  visible: boolean;
  jobId: string | null;
  jobTitle: string;
  onClose: () => void;
}

export default function JobChecklistsModal({
  visible,
  jobId,
  jobTitle,
  onClose,
}: JobChecklistsModalProps) {
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [expandedChecklist, setExpandedChecklist] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showNewChecklistForm, setShowNewChecklistForm] = useState(false);
  const [newChecklistTitle, setNewChecklistTitle] = useState('');
  const [newChecklistDescription, setNewChecklistDescription] = useState('');
  const [savingChecklist, setSavingChecklist] = useState(false);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [itemNotes, setItemNotes] = useState<{ [key: string]: string }>({});
  const [pendingDeletions, setPendingDeletions] = useState<Map<string, { item: ChecklistItem; timer: NodeJS.Timeout }>>(new Map());
  const [showUndoToast, setShowUndoToast] = useState(false);
  const undoToastAnim = useRef(new Animated.Value(0)).current;
  const { user } = useAuth();
  const { showToast } = useToast();
  const { colors } = useTheme();
  const { role, isBasicUser } = useUserRole();

  useEffect(() => {
    if (visible && jobId) {
      fetchChecklists();
    }
  }, [visible, jobId]);

  const fetchChecklists = async () => {
    if (!jobId) return;

    setLoading(true);
    try {
      const timestamp = Date.now();
      const { data: checklistsData, error: checklistsError } = await supabase
        .from('job_checklists')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: true })
        .limit(100);

      if (checklistsError) throw checklistsError;

      const checklistsWithItems = await Promise.all(
        (checklistsData || []).map(async (checklist) => {
          const { data: itemsData, error: itemsError } = await supabase
            .from('job_checklist_items')
            .select('*')
            .eq('checklist_id', checklist.id)
            .order('display_order', { ascending: true });

          if (itemsError) throw itemsError;

          const rawItems = itemsData || [];

          const itemsWithPhotos = await Promise.all(
            rawItems.map(async (item: any) => {
              const { data: photoLinks } = await supabase
                .from('checklist_item_photos')
                .select('id, photo_id, client_photos(photo_url, annotated_url, caption)')
                .eq('checklist_item_id', item.id)
                .limit(10);
              const photos: ItemPhoto[] = (photoLinks || []).map((pl: any) => ({
                id: pl.id,
                photo_id: pl.photo_id,
                photo_url: pl.client_photos?.photo_url || '',
                annotated_url: pl.client_photos?.annotated_url,
                caption: pl.client_photos?.caption,
              }));
              return { ...item, photos };
            })
          );

          const completed = itemsWithPhotos.filter((item) => item.is_completed).length;
          const total = itemsWithPhotos.length;

          return {
            ...checklist,
            items: itemsWithPhotos,
            progress: {
              total,
              completed,
              percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
            },
          };
        })
      );

      setChecklists(checklistsWithItems);
    } catch (error: any) {
      showToast({ message: error.message || 'Failed to load checklists', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateChecklist = async () => {
    if (!jobId || !newChecklistTitle.trim()) return;

    setSavingChecklist(true);
    try {
      const { data, error } = await supabase
        .from('job_checklists')
        .insert({
          job_id: jobId,
          title: newChecklistTitle.trim(),
          description: newChecklistDescription.trim(),
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      showToast({ message: 'Checklist created', type: 'success' });
      setNewChecklistTitle('');
      setNewChecklistDescription('');
      setShowNewChecklistForm(false);
      fetchChecklists();
    } catch (error: any) {
      showToast({ message: error.message || 'Failed to create checklist', type: 'error' });
    } finally {
      setSavingChecklist(false);
    }
  };

  const handleDeleteChecklist = async (checklistId: string) => {
    try {
      const { error } = await supabase
        .from('job_checklists')
        .delete()
        .eq('id', checklistId);

      if (error) throw error;

      showToast({ message: 'Checklist deleted', type: 'success' });
      fetchChecklists();
    } catch (error: any) {
      showToast({ message: error.message || 'Failed to delete checklist', type: 'error' });
    }
  };

  const handleSaveAsTemplate = async (checklistId: string) => {
    try {
      const checklist = checklists.find((c) => c.id === checklistId);
      if (!checklist) return;

      const { data: template, error: templateError } = await supabase
        .from('checklist_templates')
        .insert({
          title: checklist.title,
          name: checklist.title,
          description: checklist.description,
          created_by: user?.id,
          is_shared: true,
        })
        .select()
        .single();

      if (templateError) throw templateError;

      if (checklist.items.length > 0) {
        const templateItems = checklist.items.map((item) => ({
          template_id: template.id,
          description: item.description,
          label: item.description,
          notes: item.notes || '',
          display_order: item.display_order,
          sort_order: item.display_order,
        }));

        const { error: itemsError } = await supabase
          .from('checklist_template_items')
          .insert(templateItems);

        if (itemsError) throw itemsError;
      }

      showToast({ message: 'Checklist saved as template', type: 'success' });
    } catch (error: any) {
      showToast({ message: error.message || 'Failed to save template', type: 'error' });
    }
  };

  const handleAddItem = async (checklistId: string, description: string) => {
    if (!description.trim()) return;

    try {
      const checklist = checklists.find((c) => c.id === checklistId);
      const nextOrder = checklist ? checklist.items.length : 0;

      const { error } = await supabase
        .from('job_checklist_items')
        .insert({
          checklist_id: checklistId,
          description: description.trim(),
          display_order: nextOrder,
          created_by: user?.id,
        });

      if (error) throw error;

      fetchChecklists();
    } catch (error: any) {
      showToast({ message: error.message || 'Failed to add item', type: 'error' });
    }
  };

  const handleToggleItem = async (itemId: string, isCompleted: boolean) => {
    try {
      const { error } = await supabase
        .from('job_checklist_items')
        .update({
          is_completed: !isCompleted,
          completed_by: !isCompleted ? user?.id : null,
          completed_at: !isCompleted ? new Date().toISOString() : null,
        })
        .eq('id', itemId);

      if (error) throw error;

      fetchChecklists();
    } catch (error: any) {
      showToast({ message: error.message || 'Failed to update item', type: 'error' });
    }
  };

  const handleSaveItemNotes = async (itemId: string, notes: string) => {
    try {
      const { error } = await supabase
        .from('job_checklist_items')
        .update({ notes: notes.trim() })
        .eq('id', itemId);

      if (error) throw error;

      setEditingItem(null);
      fetchChecklists();
      showToast({ message: 'Notes saved', type: 'success' });
    } catch (error: any) {
      showToast({ message: error.message || 'Failed to save notes', type: 'error' });
    }
  };

  const handleRemovePhotoFromItem = async (linkId: string) => {
    try {
      const { error } = await supabase
        .from('checklist_item_photos')
        .delete()
        .eq('id', linkId);
      if (error) throw error;
      fetchChecklists();
    } catch (error: any) {
      showToast({ message: error.message || 'Failed to remove photo', type: 'error' });
    }
  };

  const handleDeleteItem = (itemId: string) => {
    const item = checklists
      .flatMap(c => c.items)
      .find(i => i.id === itemId);

    if (!item) return;

    const timer = setTimeout(async () => {
      try {
        const { error } = await supabase
          .from('job_checklist_items')
          .delete()
          .eq('id', itemId);

        if (error) throw error;

        setPendingDeletions(prev => {
          const newMap = new Map(prev);
          newMap.delete(itemId);
          return newMap;
        });

        if (pendingDeletions.size === 1) {
          hideUndoToast();
        }

        fetchChecklists();
      } catch (error: any) {
        showToast({ message: error.message || 'Failed to delete item', type: 'error' });
      }
    }, 5000);

    setPendingDeletions(prev => new Map(prev).set(itemId, { item, timer }));
    showUndoToastMessage();
  };

  const handleUndoDelete = (itemId?: string) => {
    if (itemId) {
      const deletion = pendingDeletions.get(itemId);
      if (deletion) {
        clearTimeout(deletion.timer);
        setPendingDeletions(prev => {
          const newMap = new Map(prev);
          newMap.delete(itemId);
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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      key={`job-checklist-modal-${jobId}-${visible ? 'open' : 'closed'}`}
    >
      <View style={styles.container}>
        <View style={[styles.modal, { backgroundColor: colors.surface }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View>
              <Text style={[styles.title, { color: colors.text }]}>Job Checklists</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{jobTitle}</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                Loading checklists...
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.content}>
              {!isBasicUser && (
                <>
                  {!showNewChecklistForm ? (
                    <TouchableOpacity
                      style={[styles.addButton, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}
                      onPress={() => setShowNewChecklistForm(true)}
                    >
                      <Plus size={20} color={colors.primary} />
                      <Text style={[styles.addButtonText, { color: colors.primary }]}>
                        Create New Checklist
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={[styles.newChecklistForm, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                      <Text style={[styles.formTitle, { color: colors.text }]}>New Checklist</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                        value={newChecklistTitle}
                        onChangeText={setNewChecklistTitle}
                        placeholder="Checklist title *"
                        placeholderTextColor={colors.textSecondary}
                      />
                      <TextInput
                        style={[styles.input, styles.textArea, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                        value={newChecklistDescription}
                        onChangeText={setNewChecklistDescription}
                        placeholder="Description (optional)"
                        placeholderTextColor={colors.textSecondary}
                        multiline
                        numberOfLines={2}
                      />
                      <View style={styles.formActions}>
                        <TouchableOpacity
                          style={[styles.cancelButton, { borderColor: colors.border }]}
                          onPress={() => {
                            setShowNewChecklistForm(false);
                            setNewChecklistTitle('');
                            setNewChecklistDescription('');
                          }}
                          disabled={savingChecklist}
                        >
                          <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>
                            Cancel
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.saveButton, { overflow: 'hidden' }]}
                          onPress={handleCreateChecklist}
                          disabled={savingChecklist || !newChecklistTitle.trim()}
                        >
                          <LinearGradient
                            colors={['#1B4D6E', '#245d82']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={StyleSheet.absoluteFill}
                          />
                          {savingChecklist ? (
                            <ActivityIndicator color="#fff" />
                          ) : (
                            <Text style={styles.saveButtonText}>Create</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </>
              )}

              {checklists.length === 0 ? (
                <View style={styles.emptyState}>
                  <FileText size={48} color={colors.textSecondary} />
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    No checklists yet
                  </Text>
                  {!isBasicUser && (
                    <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>
                      Create a checklist to track progress on this job
                    </Text>
                  )}
                </View>
              ) : (
                checklists.map((checklist) => (
                  <ChecklistCard
                    key={checklist.id}
                    checklist={checklist}
                    isExpanded={expandedChecklist === checklist.id}
                    onToggleExpand={() =>
                      setExpandedChecklist(expandedChecklist === checklist.id ? null : checklist.id)
                    }
                    onAddItem={handleAddItem}
                    onToggleItem={handleToggleItem}
                    onDeleteItem={handleDeleteItem}
                    onDeleteChecklist={handleDeleteChecklist}
                    onSaveAsTemplate={handleSaveAsTemplate}
                    onSaveItemNotes={handleSaveItemNotes}
                    onRemovePhotoFromItem={handleRemovePhotoFromItem}
                    editingItem={editingItem}
                    setEditingItem={setEditingItem}
                    itemNotes={itemNotes}
                    setItemNotes={setItemNotes}
                    colors={colors}
                    isBasicUser={isBasicUser}
                    pendingDeletions={pendingDeletions}
                  />
                ))
              )}
            </ScrollView>
          )}

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
                  onPress={() => handleUndoDelete()}
                >
                  <LinearGradient
                    colors={['#1B4D6E', '#245d82']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <Undo2 size={16} color="#fff" />
                  <Text style={styles.undoButtonText}>Undo</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}
        </View>
      </View>
    </Modal>
  );
}

interface ChecklistCardProps {
  checklist: Checklist;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onAddItem: (checklistId: string, description: string) => void;
  onToggleItem: (itemId: string, isCompleted: boolean) => void;
  onDeleteItem: (itemId: string) => void;
  onDeleteChecklist: (checklistId: string) => void;
  onSaveAsTemplate: (checklistId: string) => void;
  onSaveItemNotes: (itemId: string, notes: string) => void;
  onRemovePhotoFromItem: (linkId: string) => void;
  editingItem: string | null;
  setEditingItem: (id: string | null) => void;
  itemNotes: { [key: string]: string };
  setItemNotes: (notes: { [key: string]: string }) => void;
  colors: any;
  isBasicUser: boolean;
  pendingDeletions: Map<string, { item: ChecklistItem; timer: NodeJS.Timeout }>;
}

function ChecklistCard({
  checklist,
  isExpanded,
  onToggleExpand,
  onAddItem,
  onToggleItem,
  onDeleteItem,
  onDeleteChecklist,
  onSaveAsTemplate,
  onSaveItemNotes,
  onRemovePhotoFromItem,
  editingItem,
  setEditingItem,
  itemNotes,
  setItemNotes,
  colors,
  isBasicUser,
  pendingDeletions,
}: ChecklistCardProps) {
  const [newItemText, setNewItemText] = useState('');

  const handleAddItem = () => {
    if (newItemText.trim()) {
      onAddItem(checklist.id, newItemText);
      setNewItemText('');
    }
  };

  return (
    <View style={[styles.checklistCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
      <TouchableOpacity style={styles.checklistHeader} onPress={onToggleExpand}>
        <View style={styles.checklistHeaderLeft}>
          <View>
            <Text style={[styles.checklistTitle, { color: colors.text }]}>{checklist.title}</Text>
            {checklist.description && (
              <Text style={[styles.checklistDescription, { color: colors.textSecondary }]}>
                {checklist.description}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.checklistHeaderRight}>
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: checklist.progress.percentage === 100 ? colors.success : colors.primary,
                    width: `${checklist.progress.percentage}%`,
                  },
                ]}
              />
            </View>
            <Text style={[styles.progressText, { color: colors.textSecondary }]}>
              {checklist.progress.completed}/{checklist.progress.total}
            </Text>
          </View>
          {isExpanded ? (
            <ChevronUp size={20} color={colors.textSecondary} />
          ) : (
            <ChevronDown size={20} color={colors.textSecondary} />
          )}
        </View>
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.checklistContent}>
          {checklist.items.map((item, index) => {
            const isPendingDeletion = pendingDeletions.has(item.id);
            return (
              <View
                key={item.id}
                style={[
                  styles.itemRow,
                  { borderTopColor: colors.border },
                  isPendingDeletion && { opacity: 0.5 },
                ]}
              >
                <TouchableOpacity
                  style={styles.itemCheckbox}
                  onPress={() => onToggleItem(item.id, item.is_completed)}
                  disabled={isPendingDeletion}
                >
                  {item.is_completed ? (
                    <CheckSquare size={24} color={colors.success} />
                  ) : (
                    <Square size={24} color={colors.textSecondary} />
                  )}
                </TouchableOpacity>

              <View style={styles.itemContent}>
                <Text
                  style={[
                    styles.itemDescription,
                    { color: colors.text },
                    item.is_completed && styles.itemCompleted,
                  ]}
                >
                  {item.description}
                </Text>

                {editingItem === item.id ? (
                  <View style={styles.notesEdit}>
                    <TextInput
                      style={[
                        styles.notesInput,
                        {
                          backgroundColor: colors.inputBackground,
                          borderColor: colors.border,
                          color: colors.text,
                        },
                      ]}
                      value={itemNotes[item.id] ?? item.notes}
                      onChangeText={(text) =>
                        setItemNotes({ ...itemNotes, [item.id]: text })
                      }
                      placeholder="Add notes..."
                      placeholderTextColor={colors.textSecondary}
                      multiline
                    />
                    <View style={styles.notesActions}>
                      <TouchableOpacity
                        onPress={() => {
                          setEditingItem(null);
                          setItemNotes({ ...itemNotes, [item.id]: item.notes });
                        }}
                      >
                        <Text style={[styles.notesCancelText, { color: colors.textSecondary }]}>
                          Cancel
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => onSaveItemNotes(item.id, itemNotes[item.id] ?? item.notes)}
                      >
                        <Text style={[styles.notesSaveText, { color: colors.primary }]}>Save</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : item.notes ? (
                  <TouchableOpacity
                    style={[styles.notesDisplay, { backgroundColor: colors.primaryLight }]}
                    onPress={() => {
                      setEditingItem(item.id);
                      setItemNotes({ ...itemNotes, [item.id]: item.notes });
                    }}
                  >
                    <Text style={[styles.notesText, { color: colors.text }]}>{item.notes}</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.addNotesButton}
                    onPress={() => {
                      setEditingItem(item.id);
                      setItemNotes({ ...itemNotes, [item.id]: '' });
                    }}
                  >
                    <Edit3 size={14} color={colors.textSecondary} />
                    <Text style={[styles.addNotesText, { color: colors.textSecondary }]}>
                      Add notes
                    </Text>
                  </TouchableOpacity>
                )}

                {item.photos && item.photos.length > 0 && (
                  <View style={styles.itemPhotosRow}>
                    {item.photos.map((photo) => (
                      <View key={photo.id} style={styles.itemPhotoWrapper}>
                        <Image
                          source={{ uri: photo.annotated_url || photo.photo_url }}
                          style={styles.itemPhotoThumb}
                          resizeMode="cover"
                        />
                        {!isBasicUser && (
                          <TouchableOpacity
                            style={styles.removePhotoBtn}
                            onPress={() => onRemovePhotoFromItem(photo.id)}
                          >
                            <X size={10} color="#fff" />
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {!isBasicUser && (
                <TouchableOpacity
                  style={styles.deleteItemButton}
                  onPress={() => onDeleteItem(item.id)}
                  disabled={isPendingDeletion}
                >
                  <Trash2 size={18} color={colors.error} />
                </TouchableOpacity>
              )}
              </View>
            );
          })}

          <View style={[styles.addItemRow, { borderTopColor: colors.border }]}>
            <TextInput
              style={[
                styles.addItemInput,
                {
                  backgroundColor: colors.inputBackground,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              value={newItemText}
              onChangeText={setNewItemText}
              placeholder="Add a new item..."
              placeholderTextColor={colors.textSecondary}
              onSubmitEditing={handleAddItem}
            />
            <TouchableOpacity
              style={[
                styles.addItemButton,
                { overflow: 'hidden' },
                !newItemText.trim() && styles.addItemButtonDisabled,
              ]}
              onPress={handleAddItem}
              disabled={!newItemText.trim()}
            >
              <LinearGradient
                colors={['#1B4D6E', '#245d82']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Plus size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {!isBasicUser && (
            <View style={styles.checklistActions}>
              <TouchableOpacity
                style={[styles.saveTemplateButton, { borderColor: colors.primary, backgroundColor: colors.primaryLight }]}
                onPress={() => onSaveAsTemplate(checklist.id)}
              >
                <Save size={16} color={colors.primary} />
                <Text style={[styles.saveTemplateText, { color: colors.primary }]}>
                  Save as Template
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteChecklistButton, { borderColor: colors.error }]}
                onPress={() => onDeleteChecklist(checklist.id)}
              >
                <Trash2 size={16} color={colors.error} />
                <Text style={[styles.deleteChecklistText, { color: colors.error }]}>
                  Delete Checklist
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '95%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  content: {
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    marginBottom: 16,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  newChecklistForm: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  input: {
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  textArea: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptyHint: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  checklistCard: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
  },
  checklistHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  checklistHeaderLeft: {
    flex: 1,
  },
  checklistHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checklistTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  checklistDescription: {
    fontSize: 14,
    marginTop: 4,
  },
  progressContainer: {
    alignItems: 'flex-end',
    gap: 4,
  },
  progressBar: {
    width: 80,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
  },
  checklistContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  itemRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderTopWidth: 1,
    gap: 12,
  },
  itemCheckbox: {
    paddingTop: 2,
  },
  itemContent: {
    flex: 1,
  },
  itemDescription: {
    fontSize: 16,
    lineHeight: 22,
  },
  itemCompleted: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  notesDisplay: {
    marginTop: 8,
    padding: 10,
    borderRadius: 6,
  },
  notesText: {
    fontSize: 14,
    lineHeight: 18,
  },
  notesEdit: {
    marginTop: 8,
  },
  notesInput: {
    borderRadius: 6,
    padding: 10,
    fontSize: 14,
    borderWidth: 1,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  notesActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    marginTop: 8,
  },
  notesCancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  notesSaveText: {
    fontSize: 14,
    fontWeight: '600',
  },
  addNotesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  addNotesText: {
    fontSize: 13,
  },
  deleteItemButton: {
    padding: 4,
  },
  addItemRow: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    marginTop: 4,
  },
  addItemInput: {
    flex: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
  },
  addItemButton: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addItemButtonDisabled: {
    opacity: 0.5,
  },
  deleteChecklistButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
  },
  deleteChecklistText: {
    fontSize: 14,
    fontWeight: '600',
  },
  checklistActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  saveTemplateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
  },
  saveTemplateText: {
    fontSize: 14,
    fontWeight: '600',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  undoButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  itemPhotosRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  itemPhotoWrapper: {
    position: 'relative',
    width: 56,
    height: 56,
    borderRadius: 6,
    overflow: 'hidden',
  },
  itemPhotoThumb: {
    width: '100%',
    height: '100%',
  },
  removePhotoBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(200,0,0,0.8)',
    borderRadius: 8,
    padding: 2,
  },
});
