import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Plus, Check, Trash2, X, FileText, SquareCheck as CheckSquare, Square, Users, Megaphone, ListChecks, Package, MoveHorizontal as MoreHorizontal, ChevronRight, Copy, Calendar, User, Share2, Briefcase, ShoppingCart } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase, fetchFunction } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import { useTabNavigation } from '@/contexts/TabNavigationContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { AnimatedTabContent } from '@/components/AnimatedTabContent';
import { getSlideDirection, getDynamicTabOrder } from '@/utils/tabAnimations';
import getDynamicStyles from '@/styles/notesStyles';
import { useLayout, AVAILABLE_NOTES_TABS } from '@/contexts/LayoutContext';
import Constants from 'expo-constants';
import ChecklistModal from '@/components/ChecklistModal';
import SuppliesModal from '@/components/SuppliesModal';
import SuppliesNeededModal from '@/components/SuppliesNeededModal';
import NotesTabsCustomizationModal from '@/components/NotesTabsCustomizationModal';
import JobModal from '@/components/JobModal';
import AnimatedFabButton from '@/components/AnimatedFabButton';

interface Note {
  id: string;
  user_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

interface Todo {
  id: string;
  user_id: string;
  text: string;
  completed: boolean;
  created_at: string;
  updated_at: string;
  client_id?: string;
  is_shared_with_org?: boolean;
  client?: {
    id: string;
    name: string;
  };
}

interface TeamNote {
  id: string;
  organization_id: string;
  author_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

interface ChecklistTemplate {
  id: string;
  title: string;
  description?: string;
  created_by: string;
  created_at: string;
  is_shared: boolean;
  item_count: number;
}

interface SupplyTemplate {
  id: string;
  title: string;
  description?: string;
  created_by: string;
  created_at: string;
  is_shared: boolean;
  item_count: number;
}

type TabKey = 'notes' | 'todos' | 'team' | 'checklists' | 'supplies' | 'more';

export default function NotesScreen() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [teamNotes, setTeamNotes] = useState<TeamNote[]>([]);
  const [checklists, setChecklists] = useState<ChecklistTemplate[]>([]);
  const [supplies, setSupplies] = useState<SupplyTemplate[]>([]);
  const completedCount = todos.filter(t => t.completed).length;
  const [loading, setLoading] = useState(true);
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [teamNoteModalVisible, setTeamNoteModalVisible] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [teamNoteTitle, setTeamNoteTitle] = useState('');
  const [teamNoteContent, setTeamNoteContent] = useState('');
  const [sendingTeamNote, setSendingTeamNote] = useState(false);
  const [newTodoText, setNewTodoText] = useState('');
  const [newTodoClientId, setNewTodoClientId] = useState<string>('');
  const [newTodoShared, setNewTodoShared] = useState(false);
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [jobModalVisible, setJobModalVisible] = useState(false);
  const [todoToConvert, setTodoToConvert] = useState<Todo | null>(null);
  const [todoDetailVisible, setTodoDetailVisible] = useState(false);
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);
  const [todoDetailClientId, setTodoDetailClientId] = useState<string>('');
  const [todoDetailClientSearch, setTodoDetailClientSearch] = useState('');
  const [savingTodoClient, setSavingTodoClient] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('notes');
  const [previousTab, setPreviousTab] = useState<TabKey | null>(null);
  const [checklistModalVisible, setChecklistModalVisible] = useState(false);
  const [selectedChecklistId, setSelectedChecklistId] = useState<string | null>(null);
  const [suppliesModalVisible, setSuppliesModalVisible] = useState(false);
  const [suppliesNeededModalVisible, setSuppliesNeededModalVisible] = useState(false);
  const [suppliesSubTab, setSuppliesSubTab] = useState<'lists' | 'needed'>('lists');
  const [showMoreDropdown, setShowMoreDropdown] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const { session, user } = useAuth();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const { currentTab: globalCurrentTab, previousTab: globalPreviousTab } = useTabNavigation();
  const { visibleTabs, notesTabs, visibleNotesTabs } = useLayout();
  const { currentOrganization, organizationMember } = useOrganization();
  const dynamicOrder = getDynamicTabOrder(visibleTabs);
  const slideDirection = getSlideDirection(globalPreviousTab, globalCurrentTab, dynamicOrder);
  const dynamicStyles = getDynamicStyles(colors);

  const isAdminOrOwner = organizationMember?.role === 'owner' || organizationMember?.role === 'admin';

  const pendingNoteDeleteRef = useRef<{
    note: Note;
    timeoutId: NodeJS.Timeout;
  } | null>(null);

  const pendingTodoDeleteRef = useRef<{
    todo: Todo;
    timeoutId: NodeJS.Timeout;
  } | null>(null);

  useEffect(() => {
    fetchData();
  }, [currentOrganization?.id]);

  useEffect(() => {
    if (visibleNotesTabs.length > 0 && !visibleNotesTabs.some(t => t.id === activeTab)) {
      const firstVisibleTab = visibleNotesTabs[0];
      setActiveTab(firstVisibleTab.id as TabKey);
    }
  }, [visibleNotesTabs]);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchNotes(), fetchTodos(), fetchTeamNotes(), fetchChecklists(), fetchSupplies(), fetchClients()]);
    setLoading(false);
  };

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .order('name', { ascending: true });

      if (error) throw error;
      setClients(data || []);
    } catch (error: any) {
      console.error('Error fetching clients:', error);
    }
  };

  const fetchNotes = async () => {
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setNotes(data || []);
    } catch (error: any) {
      showToast({
        message: error?.message || 'Failed to load notes',
        type: 'error',
        duration: 5000,
      });
    }
  };

  const fetchTodos = async () => {
    try {
      const { data, error } = await supabase
        .from('todos')
        .select(`
          *,
          client:clients(id, name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTodos(data || []);
    } catch (error: any) {
      showToast({
        message: error?.message || 'Failed to load tasks',
        type: 'error',
        duration: 5000,
      });
    }
  };

  const fetchTeamNotes = async () => {
    if (!currentOrganization?.id) return;
    try {
      const { data, error } = await supabase
        .from('team_notes')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTeamNotes(data || []);
    } catch (error: any) {
      showToast({
        message: error?.message || 'Failed to load team notes',
        type: 'error',
        duration: 5000,
      });
    }
  };

  const fetchChecklists = async () => {
    if (!currentOrganization?.id) return;
    try {
      const { data, error } = await supabase
        .from('checklist_templates')
        .select(`
          id,
          title,
          description,
          created_by,
          created_at,
          is_shared,
          checklist_template_items!template_id (id)
        `)
        .eq('organization_id', currentOrganization.id)
        .eq('is_shared', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const formatted: ChecklistTemplate[] = (data || []).map((item: any) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        created_by: item.created_by,
        created_at: item.created_at,
        is_shared: item.is_shared,
        item_count: item.checklist_template_items?.length || 0,
      }));
      setChecklists(formatted);
    } catch (error: any) {
      showToast({
        message: error?.message || 'Failed to load checklists',
        type: 'error',
        duration: 5000,
      });
    }
  };

  const fetchSupplies = async () => {
    if (!currentOrganization?.id) return;
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
          supply_template_items (id)
        `)
        .eq('organization_id', currentOrganization.id)
        .eq('is_shared', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const formatted: SupplyTemplate[] = (data || []).map((item: any) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        created_by: item.created_by,
        created_at: item.created_at,
        is_shared: item.is_shared,
        item_count: item.supply_template_items?.length || 0,
      }));
      setSupplies(formatted);
    } catch (error: any) {
      showToast({
        message: error?.message || 'Failed to load supplies',
        type: 'error',
        duration: 5000,
      });
    }
  };

  const handleSaveNote = async () => {
    if (!noteTitle.trim() && !noteContent.trim()) return;

    try {
      if (selectedNote) {
        const { error } = await supabase
          .from('notes')
          .update({ title: noteTitle, content: noteContent })
          .eq('id', selectedNote.id)
          .eq('user_id', user!.id);

        if (error) throw error;
        showToast({ message: 'Note saved', type: 'success', duration: 2000 });
      } else {
        const { error } = await supabase.from('notes').insert({
          user_id: session?.user!.id,
          title: noteTitle,
          content: noteContent,
        });

        if (error) throw error;
        showToast({ message: 'Note created', type: 'success', duration: 2000 });
      }

      setNoteModalVisible(false);
      setSelectedNote(null);
      setNoteTitle('');
      setNoteContent('');
      fetchNotes();
    } catch (error: any) {
      showToast({
        message: error?.message || 'Failed to save note',
        type: 'error',
        duration: 4000,
      });
    }
  };

  const handleEditNote = (note: Note) => {
    setSelectedNote(note);
    setNoteTitle(note.title);
    setNoteContent(note.content);
    setNoteModalVisible(true);
  };

  const handleDeleteNote = (note: Note) => {
    if (pendingNoteDeleteRef.current) {
      clearTimeout(pendingNoteDeleteRef.current.timeoutId);
      executeNoteDelete(pendingNoteDeleteRef.current.note);
    }

    setNotes((prev) => prev.filter((n) => n.id !== note.id));

    const timeoutId = setTimeout(() => {
      executeNoteDelete(note);
      pendingNoteDeleteRef.current = null;
    }, 5000);

    pendingNoteDeleteRef.current = { note, timeoutId };

    showToast({
      message: 'Note deleted',
      type: 'info',
      duration: 5000,
      action: {
        label: 'Undo',
        onPress: () => {
          if (pendingNoteDeleteRef.current?.note.id === note.id) {
            clearTimeout(pendingNoteDeleteRef.current.timeoutId);
            pendingNoteDeleteRef.current = null;
            setNotes((prev) => [note, ...prev]);
            showToast({ message: 'Note restored', type: 'success', duration: 2000 });
          }
        },
      },
    });
  };

  const executeNoteDelete = async (note: Note) => {
    try {
      const { error } = await supabase.from('notes').delete().eq('id', note.id).eq('user_id', user!.id);
      if (error) throw error;
    } catch (error: any) {
      showToast({
        message: error?.message || 'Failed to delete note',
        type: 'error',
        duration: 4000,
      });
      fetchNotes();
    }
  };

  const handleAddTodo = async () => {
    if (!newTodoText.trim()) return;

    try {
      const todoData: any = {
        user_id: session?.user!.id,
        text: newTodoText.trim(),
        completed: false,
        is_shared_with_org: newTodoShared,
      };

      if (newTodoClientId) {
        todoData.client_id = newTodoClientId;
      }

      if (newTodoShared && currentOrganization?.id) {
        todoData.organization_id = currentOrganization.id;
      }

      const { error } = await supabase.from('todos').insert(todoData);

      if (error) throw error;
      setNewTodoText('');
      setNewTodoClientId('');
      setNewTodoShared(false);
      fetchTodos();
    } catch (error: any) {
      showToast({
        message: error?.message || 'Failed to add task',
        type: 'error',
        duration: 4000,
      });
    }
  };

  const handleToggleTodo = async (todo: Todo) => {
    setTodos((prev) =>
      prev.map((t) => (t.id === todo.id ? { ...t, completed: !t.completed } : t))
    );

    try {
      const { error } = await supabase
        .from('todos')
        .update({ completed: !todo.completed })
        .eq('id', todo.id)
        .eq('user_id', user!.id);

      if (error) throw error;
    } catch (error: any) {
      setTodos((prev) =>
        prev.map((t) => (t.id === todo.id ? { ...t, completed: todo.completed } : t))
      );
      showToast({
        message: error?.message || 'Failed to update task',
        type: 'error',
        duration: 4000,
      });
    }
  };

  const handleDeleteTodo = (todo: Todo) => {
    if (pendingTodoDeleteRef.current) {
      clearTimeout(pendingTodoDeleteRef.current.timeoutId);
      executeTodoDelete(pendingTodoDeleteRef.current.todo);
    }

    const originalIndex = todos.findIndex((t) => t.id === todo.id);
    setTodos((prev) => prev.filter((t) => t.id !== todo.id));

    const timeoutId = setTimeout(() => {
      executeTodoDelete(todo);
      pendingTodoDeleteRef.current = null;
    }, 5000);

    pendingTodoDeleteRef.current = { todo, timeoutId };

    showToast({
      message: 'Task deleted',
      type: 'info',
      duration: 5000,
      action: {
        label: 'Undo',
        onPress: () => {
          if (pendingTodoDeleteRef.current?.todo.id === todo.id) {
            clearTimeout(pendingTodoDeleteRef.current.timeoutId);
            pendingTodoDeleteRef.current = null;
            setTodos((prev) => {
              const newTodos = [...prev];
              newTodos.splice(originalIndex, 0, todo);
              return newTodos;
            });
            showToast({ message: 'Task restored', type: 'success', duration: 2000 });
          }
        },
      },
    });
  };

  const handleConvertTodoToJob = (todo: Todo) => {
    setTodoToConvert(todo);
    setJobModalVisible(true);
  };

  const handleJobModalClose = () => {
    setJobModalVisible(false);
    setTodoToConvert(null);
  };

  const handleJobSaved = () => {
    setJobModalVisible(false);
    setTodoToConvert(null);
    showToast({
      message: 'Job created successfully',
      type: 'success',
      duration: 3000,
    });
  };

  const handleOpenTodoDetail = (todo: Todo) => {
    setSelectedTodo(todo);
    setTodoDetailClientId(todo.client_id || '');
    setTodoDetailClientSearch('');
    setTodoDetailVisible(true);
  };

  const handleCloseTodoDetail = () => {
    setTodoDetailVisible(false);
    setSelectedTodo(null);
    setTodoDetailClientId('');
    setTodoDetailClientSearch('');
  };

  const handleSaveTodoClient = async () => {
    if (!selectedTodo) return;
    setSavingTodoClient(true);
    try {
      const { error } = await supabase
        .from('todos')
        .update({ client_id: todoDetailClientId || null })
        .eq('id', selectedTodo.id)
        .eq('user_id', user!.id);

      if (error) throw error;

      setTodos((prev) =>
        prev.map((t) => {
          if (t.id !== selectedTodo.id) return t;
          const assignedClient = clients.find((c) => c.id === todoDetailClientId);
          return {
            ...t,
            client_id: todoDetailClientId || undefined,
            client: assignedClient ? { id: assignedClient.id, name: assignedClient.name } : undefined,
          };
        })
      );

      showToast({
        message: todoDetailClientId ? 'Client assigned' : 'Client removed',
        type: 'success',
        duration: 2000,
      });
      handleCloseTodoDetail();
    } catch (error: any) {
      showToast({
        message: error?.message || 'Failed to update task',
        type: 'error',
        duration: 4000,
      });
    } finally {
      setSavingTodoClient(false);
    }
  };

  const executeTodoDelete = async (todo: Todo) => {
    try {
      if (!user?.id) {
        showToast({ message: 'Please sign in to delete tasks', type: 'warning', duration: 3000 });
        return;
      }

      const { error } = await supabase
        .from('todos')
        .delete()
        .eq('id', todo.id)
        .eq('user_id', user?.id);

      if (error) throw error;
    } catch (error: any) {
      showToast({
        message: error?.message || 'Failed to delete task',
        type: 'error',
        duration: 4000,
      });
      fetchTodos();
    }
  };

  const handleSendTeamNote = async () => {
    if (!teamNoteTitle.trim() || !currentOrganization?.id || !user?.id) return;

    setSendingTeamNote(true);
    try {
      const { data: insertedNote, error } = await supabase
        .from('team_notes')
        .insert({
          organization_id: currentOrganization.id,
          author_id: user.id,
          title: teamNoteTitle.trim(),
          content: teamNoteContent.trim(),
        })
        .select()
        .maybeSingle();

      if (error) throw error;

      setTeamNoteModalVisible(false);
      setTeamNoteTitle('');
      setTeamNoteContent('');
      fetchTeamNotes();
      showToast({ message: 'Team note sent', type: 'success', duration: 2000 });

      if (insertedNote) {
        sendTeamNoteNotification(insertedNote as TeamNote);
      }
    } catch (error: any) {
      showToast({
        message: error?.message || 'Failed to send team note',
        type: 'error',
        duration: 4000,
      });
    } finally {
      setSendingTeamNote(false);
    }
  };

  const sendTeamNoteNotification = async (teamNote: TeamNote) => {
    try {
      await fetchFunction('send-team-note-notification', {
        body: {
          organizationId: teamNote.organization_id,
          authorId: teamNote.author_id,
          title: `Team Note: ${teamNote.title}`,
          body: teamNote.content || teamNote.title,
          teamNoteId: teamNote.id,
        },
      });
    } catch {
      // best-effort delivery
    }
  };

  const handleDeleteTeamNote = async (teamNote: TeamNote) => {
    try {
      const { error } = await supabase
        .from('team_notes')
        .delete()
        .eq('id', teamNote.id);

      if (error) throw error;
      setTeamNotes((prev) => prev.filter((n) => n.id !== teamNote.id));
      showToast({ message: 'Team note deleted', type: 'success', duration: 2000 });
    } catch (error: any) {
      showToast({
        message: error?.message || 'Failed to delete team note',
        type: 'error',
        duration: 4000,
      });
    }
  };

  const handleDeleteChecklist = async (checklistId: string, checklistTitle: string) => {
    if (!user) return;

    const confirmed = await new Promise<boolean>((resolve) => {
      if (Platform.OS === 'web') {
        resolve(window.confirm(`Are you sure you want to delete "${checklistTitle}"?`));
      } else {
        const { Alert } = require('react-native');
        Alert.alert(
          'Delete Checklist',
          `Are you sure you want to delete "${checklistTitle}"?`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
          ]
        );
      }
    });

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('checklist_templates')
        .delete()
        .eq('id', checklistId);

      if (error) throw error;

      showToast({ message: 'Checklist deleted', type: 'success', duration: 2000 });
      fetchChecklists();
    } catch (error: any) {
      showToast({ message: error.message || 'Failed to delete checklist', type: 'error', duration: 4000 });
    }
  };

  const handleDuplicateChecklist = async (checklistId: string) => {
    if (!user || !currentOrganization) return;

    try {
      const { data: template, error: fetchError } = await supabase
        .from('checklist_templates')
        .select(`
          title,
          description,
          checklist_template_items (
            label,
            description,
            notes,
            display_order
          )
        `)
        .eq('id', checklistId)
        .single();

      if (fetchError) throw fetchError;

      const { data: newTemplate, error: insertError } = await supabase
        .from('checklist_templates')
        .insert({
          organization_id: currentOrganization.id,
          title: `${template.title} (Copy)`,
          description: template.description || '',
          created_by: user.id,
          is_shared: true,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      if (template.checklist_template_items && template.checklist_template_items.length > 0) {
        const itemsToInsert = template.checklist_template_items.map((item: any) => ({
          template_id: newTemplate.id,
          organization_id: currentOrganization.id,
          label: item.label,
          description: item.description,
          notes: item.notes || '',
          display_order: item.display_order,
        }));

        const { error: itemsError } = await supabase
          .from('checklist_template_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      showToast({ message: 'Checklist duplicated', type: 'success', duration: 2000 });
      fetchChecklists();
    } catch (error: any) {
      showToast({ message: error.message || 'Failed to duplicate', type: 'error', duration: 4000 });
    }
  };

  const handleDeleteSupply = async (supplyId: string, supplyTitle: string) => {
    if (!user) return;

    const confirmed = await new Promise<boolean>((resolve) => {
      if (Platform.OS === 'web') {
        resolve(window.confirm(`Are you sure you want to delete "${supplyTitle}"?`));
      } else {
        const { Alert } = require('react-native');
        Alert.alert(
          'Delete Supply List',
          `Are you sure you want to delete "${supplyTitle}"?`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
          ]
        );
      }
    });

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('supply_templates')
        .delete()
        .eq('id', supplyId);

      if (error) throw error;

      showToast({ message: 'Supply list deleted', type: 'success', duration: 2000 });
      fetchSupplies();
    } catch (error: any) {
      showToast({ message: error.message || 'Failed to delete supply list', type: 'error', duration: 4000 });
    }
  };

  const handleDuplicateSupply = async (supplyId: string) => {
    if (!user || !currentOrganization) return;

    try {
      const { data: template, error: fetchError } = await supabase
        .from('supply_templates')
        .select(`
          title,
          description,
          supply_template_items (
            name,
            quantity,
            unit,
            price,
            notes,
            display_order
          )
        `)
        .eq('id', supplyId)
        .single();

      if (fetchError) throw fetchError;

      const { data: newTemplate, error: insertError } = await supabase
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

      if (insertError) throw insertError;

      if (template.supply_template_items && template.supply_template_items.length > 0) {
        const itemsToInsert = template.supply_template_items.map((item: any) => ({
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

      showToast({ message: 'Supply list duplicated', type: 'success', duration: 2000 });
      fetchSupplies();
    } catch (error: any) {
      showToast({ message: error.message || 'Failed to duplicate', type: 'error', duration: 4000 });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getSubtitle = () => {
    if (activeTab === 'notes') return `${notes.length} notes`;
    if (activeTab === 'todos') return `${completedCount}/${todos.length} completed`;
    if (activeTab === 'team') return `${teamNotes.length} team notes`;
    if (activeTab === 'checklists') return `${checklists.length} checklists`;
    if (activeTab === 'supplies') return `${supplies.length} supply lists`;
    if (activeTab === 'more') return 'More options';
    return '';
  };

  const hiddenTabs = notesTabs.filter(t => !t.visible);
  const hasHiddenTabs = hiddenTabs.length > 0;

  const getTabIcon = (id: string, isActive: boolean) => {
    const color = isActive ? colors.primary : colors.textSecondary;
    const size = 18;

    switch (id) {
      case 'notes':
        return <FileText size={size} color={color} />;
      case 'todos':
        return <CheckSquare size={size} color={color} />;
      case 'team':
        return <Users size={size} color={color} />;
      case 'checklists':
        return <ListChecks size={size} color={color} />;
      case 'supplies':
        return <Package size={size} color={color} />;
      default:
        return null;
    }
  };

  const getTabLabel = (id: string) => {
    const config = AVAILABLE_NOTES_TABS.find(t => t.id === id);
    return config?.label || id;
  };

  const handleTabPress = (tabId: TabKey) => {
    setPreviousTab(activeTab);
    setActiveTab(tabId);
    setShowMoreDropdown(false);
  };

  const handleMorePress = () => {
    if (hasHiddenTabs) {
      setShowMoreDropdown(!showMoreDropdown);
    }
  };

  return (
    <View style={dynamicStyles.container}>
      <View style={dynamicStyles.header}>
        <Text style={dynamicStyles.headerTitle}>{t('notes_title')}</Text>
        <View style={dynamicStyles.headerLeft}>
          <Text style={dynamicStyles.headerSubtitle}>{getSubtitle()}</Text>
        </View>
      </View>

      <View style={dynamicStyles.tabContainer}>
        {visibleNotesTabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[dynamicStyles.tab, activeTab === tab.id && dynamicStyles.activeTab]}
            onPress={() => handleTabPress(tab.id as TabKey)}
          >
            {getTabIcon(tab.id, activeTab === tab.id)}
            <Text style={[dynamicStyles.tabText, activeTab === tab.id && dynamicStyles.activeTabText]}>
              {getTabLabel(tab.id)}
            </Text>
          </TouchableOpacity>
        ))}

        {hasHiddenTabs && (
          <View style={{ position: 'relative', zIndex: 2000, elevation: 10 }}>
            <TouchableOpacity
              style={[dynamicStyles.tab, (showMoreDropdown || hiddenTabs.some(t => t.id === activeTab)) && dynamicStyles.activeTab]}
              onPress={handleMorePress}
            >
              <MoreHorizontal size={18} color={(showMoreDropdown || hiddenTabs.some(t => t.id === activeTab)) ? colors.primary : colors.textSecondary} />
              <Text style={[dynamicStyles.tabText, (showMoreDropdown || hiddenTabs.some(t => t.id === activeTab)) && dynamicStyles.activeTabText]}>
                More
              </Text>
            </TouchableOpacity>

            {showMoreDropdown && (
              <View style={dynamicStyles.dropdown}>
                {hiddenTabs.map((tab) => (
                  <TouchableOpacity
                    key={tab.id}
                    style={dynamicStyles.dropdownItem}
                    onPress={() => handleTabPress(tab.id as TabKey)}
                  >
                    {getTabIcon(tab.id, false)}
                    <Text style={dynamicStyles.dropdownItemText}>{getTabLabel(tab.id)}</Text>
                    <ChevronRight size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                ))}
                <View style={dynamicStyles.dropdownDivider} />
                <TouchableOpacity
                  style={dynamicStyles.dropdownItem}
                  onPress={() => {
                    setShowMoreDropdown(false);
                    setSettingsModalVisible(true);
                  }}
                >
                  <Text style={dynamicStyles.dropdownItemText}>Customize Tabs</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>

      <AnimatedTabContent activeTab={activeTab} tabKey="notes" direction={slideDirection}>
        <ScrollView
          style={dynamicStyles.content}
        >
          <View style={dynamicStyles.section}>
            {notes.length === 0 ? (
              <View style={dynamicStyles.emptyContainer}>
                <FileText size={48} color={colors.textSecondary} />
                <Text style={dynamicStyles.emptyText}>No notes yet</Text>
                <Text style={dynamicStyles.emptySubtext}>
                  Tap the + button to create your first note
                </Text>
              </View>
            ) : (
              notes.map((note) => (
                <TouchableOpacity
                  key={note.id}
                  style={dynamicStyles.noteCard}
                  onPress={() => handleEditNote(note)}
                  activeOpacity={0.7}
                >
                  <View style={dynamicStyles.noteHeader}>
                    <Text style={dynamicStyles.noteTitle} numberOfLines={1}>
                      {note.title || 'Untitled'}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleDeleteNote(note)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Trash2 size={18} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                  {note.content ? (
                    <Text style={dynamicStyles.noteContent} numberOfLines={3}>
                      {note.content}
                    </Text>
                  ) : null}
                  <Text style={dynamicStyles.noteDate}>{formatDate(note.updated_at)}</Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        </ScrollView>
      </AnimatedTabContent>

      <AnimatedTabContent activeTab={activeTab} tabKey="todos" direction={slideDirection}>
        <ScrollView
          style={dynamicStyles.content}
        >
          <View style={dynamicStyles.section}>
            <View style={dynamicStyles.todoInputContainer}>
              <View style={{ flex: 1 }}>
                <TextInput
                  style={dynamicStyles.todoInput}
                  placeholder="Add a new task..."
                  placeholderTextColor={colors.textSecondary}
                  value={newTodoText}
                  onChangeText={setNewTodoText}
                  onSubmitEditing={handleAddTodo}
                  returnKeyType="done"
                />
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, paddingHorizontal: 4 }}>
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                      backgroundColor: newTodoClientId ? colors.primary : colors.inputBackground,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: newTodoClientId ? colors.primary : colors.border,
                    }}
                    onPress={() => setShowClientPicker(!showClientPicker)}
                  >
                    <User size={14} color={newTodoClientId ? '#fff' : colors.textSecondary} />
                    <Text style={{ color: newTodoClientId ? '#fff' : colors.textSecondary, fontSize: 12, fontWeight: '500' }}>
                      {newTodoClientId ? clients.find(c => c.id === newTodoClientId)?.name : 'Client'}
                    </Text>
                  </TouchableOpacity>
                  {currentOrganization && (
                    <TouchableOpacity
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        backgroundColor: newTodoShared ? colors.primary : colors.inputBackground,
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: newTodoShared ? colors.primary : colors.border,
                      }}
                      onPress={() => setNewTodoShared(!newTodoShared)}
                    >
                      <Share2 size={14} color={newTodoShared ? '#fff' : colors.textSecondary} />
                      <Text style={{ color: newTodoShared ? '#fff' : colors.textSecondary, fontSize: 12, fontWeight: '500' }}>
                        {newTodoShared ? 'Shared' : 'Private'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
              <TouchableOpacity
                style={[
                  dynamicStyles.addTodoButton,
                  !newTodoText.trim() && dynamicStyles.addTodoButtonDisabled,
                ]}
                onPress={handleAddTodo}
                disabled={!newTodoText.trim()}
              >
                <Plus size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            {showClientPicker && (
              <View style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                maxHeight: 200,
                marginBottom: 16,
              }}>
                <ScrollView>
                  <TouchableOpacity
                    style={{
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                    }}
                    onPress={() => {
                      setNewTodoClientId('');
                      setShowClientPicker(false);
                    }}
                  >
                    <Text style={{ color: colors.textSecondary, fontSize: 15 }}>None</Text>
                  </TouchableOpacity>
                  {clients.map((client) => (
                    <TouchableOpacity
                      key={client.id}
                      style={{
                        paddingVertical: 12,
                        paddingHorizontal: 16,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border,
                        backgroundColor: newTodoClientId === client.id ? colors.inputBackground : 'transparent',
                      }}
                      onPress={() => {
                        setNewTodoClientId(client.id);
                        setShowClientPicker(false);
                      }}
                    >
                      <Text style={{ color: colors.text, fontSize: 15 }}>{client.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {todos.length === 0 ? (
              <View style={dynamicStyles.emptyContainer}>
                <CheckSquare size={48} color={colors.textSecondary} />
                <Text style={dynamicStyles.emptyText}>No tasks yet</Text>
                <Text style={dynamicStyles.emptySubtext}>Add a task above to get started</Text>
              </View>
            ) : (
              todos.map((todo) => (
                <View key={todo.id} style={dynamicStyles.todoItem}>
                  <TouchableOpacity style={dynamicStyles.todoCheckbox} onPress={() => handleToggleTodo(todo)}>
                    {todo.completed ? (
                      <CheckSquare size={24} color={colors.success} />
                    ) : (
                      <Square size={24} color={colors.textSecondary} />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity style={{ flex: 1 }} onPress={() => handleOpenTodoDetail(todo)} activeOpacity={0.7}>
                    <Text style={[dynamicStyles.todoText, todo.completed && dynamicStyles.todoTextCompleted]}>
                      {todo.text}
                    </Text>
                    {todo.client ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        <User size={10} color={colors.primary} />
                        <Text style={{ color: colors.primary, fontSize: 12 }}>{todo.client.name}</Text>
                      </View>
                    ) : (
                      <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 1 }}>Tap to assign client</Text>
                    )}
                    {todo.is_shared_with_org && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        <Share2 size={10} color={colors.textSecondary} />
                        <Text style={{ color: colors.textSecondary, fontSize: 10 }}>Shared with team</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleConvertTodoToJob(todo)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={{ marginRight: 8 }}
                  >
                    <Briefcase size={18} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteTodo(todo)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Trash2 size={18} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </AnimatedTabContent>

      <AnimatedTabContent activeTab={activeTab} tabKey="team" direction={slideDirection}>
        <ScrollView
          style={dynamicStyles.content}
        >
          <View style={dynamicStyles.section}>
            {teamNotes.length === 0 ? (
              <View style={dynamicStyles.emptyContainer}>
                <Megaphone size={48} color={colors.textSecondary} />
                <Text style={dynamicStyles.emptyText}>No team notes yet</Text>
                <Text style={dynamicStyles.emptySubtext}>
                  {isAdminOrOwner
                    ? 'Tap the + button to send a note to your team'
                    : 'Team announcements from managers will appear here'}
                </Text>
              </View>
            ) : (
              teamNotes.map((teamNote) => (
                <View key={teamNote.id} style={dynamicStyles.teamNoteCard}>
                  <View style={dynamicStyles.teamNoteBadge}>
                    <Megaphone size={12} color="#1B4D6E" />
                    <Text style={dynamicStyles.teamNoteBadgeText}>Team Announcement</Text>
                  </View>
                  <View style={dynamicStyles.noteHeader}>
                    <Text style={dynamicStyles.noteTitle} numberOfLines={2}>
                      {teamNote.title}
                    </Text>
                    {isAdminOrOwner && (
                      <TouchableOpacity
                        onPress={() => handleDeleteTeamNote(teamNote)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Trash2 size={18} color={colors.error} />
                      </TouchableOpacity>
                    )}
                  </View>
                  {teamNote.content ? (
                    <Text style={dynamicStyles.noteContent}>{teamNote.content}</Text>
                  ) : null}
                  <Text style={dynamicStyles.noteDate}>{formatDate(teamNote.created_at)}</Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </AnimatedTabContent>

      <AnimatedTabContent activeTab={activeTab} tabKey="checklists" direction={slideDirection}>
        <ScrollView
          style={dynamicStyles.content}
        >
          <View style={dynamicStyles.section}>
            {checklists.length === 0 ? (
              <View style={dynamicStyles.emptyContainer}>
                <ListChecks size={48} color={colors.textSecondary} />
                <Text style={dynamicStyles.emptyText}>No checklists yet</Text>
                <Text style={dynamicStyles.emptySubtext}>
                  Create reusable checklists to keep your jobs organized
                </Text>
              </View>
            ) : (
              checklists.map((checklist) => (
                <TouchableOpacity
                  key={checklist.id}
                  style={dynamicStyles.noteCard}
                  onPress={() => {
                    setSelectedChecklistId(checklist.id);
                    setChecklistModalVisible(true);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={dynamicStyles.noteHeader}>
                    <Text style={dynamicStyles.noteTitle} numberOfLines={1}>
                      {checklist.title}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        backgroundColor: colors.primary + '15',
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 6,
                      }}>
                        <CheckSquare size={14} color={colors.primary} />
                        <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>
                          {checklist.item_count}
                        </Text>
                      </View>
                    </View>
                  </View>
                  {checklist.description ? (
                    <Text style={dynamicStyles.noteContent} numberOfLines={2}>
                      {checklist.description}
                    </Text>
                  ) : null}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                    <Text style={dynamicStyles.noteDate}>{formatDate(checklist.created_at)}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          setSelectedChecklistId(checklist.id);
                          setChecklistModalVisible(true);
                        }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Calendar size={18} color={colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          handleDuplicateChecklist(checklist.id);
                        }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Copy size={18} color={colors.textSecondary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          handleDeleteChecklist(checklist.id, checklist.title);
                        }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Trash2 size={18} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        </ScrollView>
      </AnimatedTabContent>

      <AnimatedTabContent activeTab={activeTab} tabKey="supplies" direction={slideDirection}>
        <View style={{ flex: 1 }}>
          <View style={{
            flexDirection: 'row',
            marginHorizontal: 16,
            marginTop: 12,
            marginBottom: 4,
            backgroundColor: colors.inputBackground,
            borderRadius: 12,
            padding: 4,
          }}>
            <TouchableOpacity
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 10,
                alignItems: 'center',
                backgroundColor: suppliesSubTab === 'lists' ? colors.primary : 'transparent',
              }}
              onPress={() => setSuppliesSubTab('lists')}
            >
              <Text style={{
                fontSize: 14,
                fontWeight: '600',
                color: suppliesSubTab === 'lists' ? '#fff' : colors.textSecondary,
              }}>
                Supplies Lists
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 10,
                alignItems: 'center',
                backgroundColor: suppliesSubTab === 'needed' ? colors.primary : 'transparent',
              }}
              onPress={() => setSuppliesSubTab('needed')}
            >
              <Text style={{
                fontSize: 14,
                fontWeight: '600',
                color: suppliesSubTab === 'needed' ? '#fff' : colors.textSecondary,
              }}>
                Supplies Needed
              </Text>
            </TouchableOpacity>
          </View>

          {suppliesSubTab === 'lists' && (
            <ScrollView
              style={dynamicStyles.content}
                >
              <View style={dynamicStyles.section}>
                {supplies.length === 0 ? (
                  <View style={dynamicStyles.emptyContainer}>
                    <Package size={48} color={colors.textSecondary} />
                    <Text style={dynamicStyles.emptyText}>No supply lists yet</Text>
                    <Text style={dynamicStyles.emptySubtext}>
                      Create reusable supply lists to track materials for your jobs
                    </Text>
                  </View>
                ) : (
                  supplies.map((supply) => (
                    <TouchableOpacity
                      key={supply.id}
                      style={dynamicStyles.noteCard}
                      onPress={() => setSuppliesModalVisible(true)}
                      activeOpacity={0.7}
                    >
                      <View style={dynamicStyles.noteHeader}>
                        <Text style={dynamicStyles.noteTitle} numberOfLines={1}>
                          {supply.title}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                            backgroundColor: colors.primary + '15',
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 6,
                          }}>
                            <Package size={14} color={colors.primary} />
                            <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>
                              {supply.item_count}
                            </Text>
                          </View>
                        </View>
                      </View>
                      {supply.description ? (
                        <Text style={dynamicStyles.noteContent} numberOfLines={2}>
                          {supply.description}
                        </Text>
                      ) : null}
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                        <Text style={dynamicStyles.noteDate}>{formatDate(supply.created_at)}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation();
                              setSuppliesModalVisible(true);
                            }}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          >
                            <Calendar size={18} color={colors.primary} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation();
                              handleDuplicateSupply(supply.id);
                            }}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          >
                            <Copy size={18} color={colors.textSecondary} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation();
                              handleDeleteSupply(supply.id, supply.title);
                            }}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          >
                            <Trash2 size={18} color={colors.error} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            </ScrollView>
          )}

          {suppliesSubTab === 'needed' && (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
              <ShoppingCart size={56} color={colors.textSecondary} strokeWidth={1.5} />
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginTop: 16, marginBottom: 8 }}>
                Supplies Needed
              </Text>
              <Text style={{ fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 24 }}>
                Track what you need to buy with checkboxes, prices, and running totals. Tap below to open your shopping lists.
              </Text>
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  borderRadius: 14,
                  overflow: 'hidden',
                }}
                onPress={() => setSuppliesNeededModalVisible(true)}
              >
                <LinearGradient colors={['#1B4D6E', '#245d82']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 24, paddingVertical: 14 }}>
                  <ShoppingCart size={20} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Open Shopping Lists</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </AnimatedTabContent>

      {activeTab === 'notes' && (
        <AnimatedFabButton
          style={dynamicStyles.fab}
          onPress={() => {
            setSelectedNote(null);
            setNoteTitle('');
            setNoteContent('');
            setNoteModalVisible(true);
          }}
          isOpen={noteModalVisible}
          size={56}
          iconSize={24}
        />
      )}

      {activeTab === 'team' && isAdminOrOwner && (
        <AnimatedFabButton
          style={dynamicStyles.fab}
          onPress={() => {
            setTeamNoteTitle('');
            setTeamNoteContent('');
            setTeamNoteModalVisible(true);
          }}
          isOpen={teamNoteModalVisible}
          size={56}
          iconSize={24}
        />
      )}

      {activeTab === 'checklists' && (
        <AnimatedFabButton
          style={dynamicStyles.fab}
          onPress={() => setChecklistModalVisible(true)}
          isOpen={checklistModalVisible}
          size={56}
          iconSize={24}
        />
      )}

      {activeTab === 'supplies' && suppliesSubTab === 'lists' && (
        <AnimatedFabButton
          style={dynamicStyles.fab}
          onPress={() => setSuppliesModalVisible(true)}
          isOpen={suppliesModalVisible}
          size={56}
          iconSize={24}
        />
      )}

      {activeTab === 'supplies' && suppliesSubTab === 'needed' && (
        <AnimatedFabButton
          style={dynamicStyles.fab}
          onPress={() => setSuppliesNeededModalVisible(true)}
          isOpen={suppliesNeededModalVisible}
          size={56}
          iconSize={24}
        />
      )}

      <Modal
        visible={noteModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setNoteModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={dynamicStyles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={dynamicStyles.modalHeader}>
            <TouchableOpacity onPress={() => setNoteModalVisible(false)}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={dynamicStyles.modalTitle}>
              {selectedNote ? 'Edit Note' : 'New Note'}
            </Text>
            <TouchableOpacity onPress={handleSaveNote}>
              <Check size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <TextInput
            style={dynamicStyles.noteTitleInput}
            placeholder="Title"
            placeholderTextColor={colors.textSecondary}
            value={noteTitle}
            onChangeText={setNoteTitle}
          />

          <TextInput
            style={dynamicStyles.noteContentInput}
            placeholder="Start typing..."
            placeholderTextColor={colors.textSecondary}
            value={noteContent}
            onChangeText={setNoteContent}
            multiline
            textAlignVertical="top"
          />
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={teamNoteModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setTeamNoteModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={dynamicStyles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={dynamicStyles.modalHeader}>
            <TouchableOpacity onPress={() => !sendingTeamNote && setTeamNoteModalVisible(false)}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={dynamicStyles.modalTitle}>Send Team Note</Text>
            <TouchableOpacity onPress={handleSendTeamNote} disabled={sendingTeamNote || !teamNoteTitle.trim()}>
              {sendingTeamNote ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Check size={24} color={teamNoteTitle.trim() ? colors.primary : colors.textSecondary} />
              )}
            </TouchableOpacity>
          </View>

          <View style={dynamicStyles.sendingIndicator}>
            <Megaphone size={18} color={colors.primary} />
            <Text style={dynamicStyles.sendingText}>
              Clocked-in team members will be notified
            </Text>
          </View>

          <TextInput
            style={dynamicStyles.noteTitleInput}
            placeholder="Title"
            placeholderTextColor={colors.textSecondary}
            value={teamNoteTitle}
            onChangeText={setTeamNoteTitle}
          />

          <TextInput
            style={dynamicStyles.noteContentInput}
            placeholder="Write your team note..."
            placeholderTextColor={colors.textSecondary}
            value={teamNoteContent}
            onChangeText={setTeamNoteContent}
            multiline
            textAlignVertical="top"
          />
        </KeyboardAvoidingView>
      </Modal>

      <ChecklistModal
        visible={checklistModalVisible}
        selectedChecklistId={selectedChecklistId}
        onClose={() => {
          setChecklistModalVisible(false);
          setSelectedChecklistId(null);
          fetchChecklists();
        }}
      />

      <SuppliesModal
        visible={suppliesModalVisible}
        onClose={() => {
          setSuppliesModalVisible(false);
          fetchSupplies();
        }}
      />

      <SuppliesNeededModal
        visible={suppliesNeededModalVisible}
        onClose={() => setSuppliesNeededModalVisible(false)}
      />

      <NotesTabsCustomizationModal
        visible={settingsModalVisible}
        onClose={() => setSettingsModalVisible(false)}
      />

      <Modal
        visible={todoDetailVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseTodoDetail}
      >
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: colors.background }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={[dynamicStyles.modalHeader, { paddingTop: Platform.OS === 'ios' ? 56 : 20 }]}>
            <TouchableOpacity onPress={handleCloseTodoDetail}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={dynamicStyles.modalTitle}>Assign Client</Text>
            <TouchableOpacity onPress={handleSaveTodoClient} disabled={savingTodoClient}>
              {savingTodoClient ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Check size={24} color={colors.primary} />
              )}
            </TouchableOpacity>
          </View>

          <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 16, color: colors.text, fontWeight: '500' }} numberOfLines={3}>
              {selectedTodo?.text}
            </Text>
          </View>

          {todoDetailClientId ? (
            <View style={{ paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <User size={16} color={colors.primary} />
                <Text style={{ fontSize: 15, color: colors.primary, fontWeight: '500' }}>
                  {clients.find((c) => c.id === todoDetailClientId)?.name || 'Unknown client'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setTodoDetailClientId('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={18} color={colors.error} />
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.inputBackground, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 }}>
              <User size={16} color={colors.textSecondary} />
              <TextInput
                style={{ flex: 1, fontSize: 15, color: colors.text, borderWidth: 0, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}) }}
                placeholder="Search clients..."
                placeholderTextColor={colors.textSecondary}
                value={todoDetailClientSearch}
                onChangeText={setTodoDetailClientSearch}
                autoCapitalize="none"
              />
              {todoDetailClientSearch.length > 0 && (
                <TouchableOpacity onPress={() => setTodoDetailClientSearch('')}>
                  <X size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
            {clients
              .filter((c) => !todoDetailClientSearch || c.name.toLowerCase().includes(todoDetailClientSearch.toLowerCase()))
              .map((client) => (
                <TouchableOpacity
                  key={client.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingHorizontal: 20,
                    paddingVertical: 14,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                    backgroundColor: todoDetailClientId === client.id ? colors.inputBackground : 'transparent',
                  }}
                  onPress={() => setTodoDetailClientId(todoDetailClientId === client.id ? '' : client.id)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary + '18', alignItems: 'center', justifyContent: 'center' }}>
                      <User size={16} color={colors.primary} />
                    </View>
                    <Text style={{ fontSize: 15, color: colors.text }}>{client.name}</Text>
                  </View>
                  {todoDetailClientId === client.id && (
                    <Check size={18} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            {clients.filter((c) => !todoDetailClientSearch || c.name.toLowerCase().includes(todoDetailClientSearch.toLowerCase())).length === 0 && (
              <View style={{ alignItems: 'center', paddingTop: 40, paddingBottom: 20 }}>
                <User size={36} color={colors.textSecondary} />
                <Text style={{ color: colors.textSecondary, fontSize: 15, marginTop: 12 }}>No clients found</Text>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <JobModal
        visible={jobModalVisible}
        job={null}
        onClose={handleJobModalClose}
        onSave={handleJobSaved}
        preFilledData={todoToConvert ? {
          title: todoToConvert.text,
          client_id: todoToConvert.client_id || '',
        } : undefined}
      />
    </View>
  );
}
