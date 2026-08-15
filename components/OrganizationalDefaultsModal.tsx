import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { X, GripVertical, Eye, EyeOff, Hop as Home, Users, Calendar, Briefcase, Clock, Receipt, FileText, DollarSign, Save, Settings } from 'lucide-react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/lib/supabase';
import {
  AVAILABLE_CARDS,
  AVAILABLE_TABS,
  AVAILABLE_QUICK_ACTIONS,
  AVAILABLE_NOTES_TABS,
  LayoutItem,
} from '@/contexts/LayoutContext';

const ICONS: Record<string, any> = {
  Home,
  Users,
  Calendar,
  Briefcase,
  Clock,
  Receipt,
  FileText,
  DollarSign,
  Settings,
};

interface OrganizationalDefaultsModalProps {
  visible: boolean;
  onClose: () => void;
}

type TabType = 'cards' | 'tabs' | 'quickActions' | 'notesTabs';

const DEFAULT_CARDS: LayoutItem[] = [
  { id: 'clients', visible: true },
  { id: 'schedule', visible: true },
  { id: 'time', visible: true },
  { id: 'invoices', visible: true },
];

const DEFAULT_TABS: LayoutItem[] = [
  { id: 'index', visible: true },
  { id: 'clients', visible: false },
  { id: 'schedule', visible: true },
  { id: 'time', visible: false },
  { id: 'invoices', visible: true },
  { id: 'notes', visible: true },
  { id: 'finances', visible: true },
];

const DEFAULT_QUICK_ACTIONS: LayoutItem[] = [
  { id: 'clients', visible: true },
  { id: 'schedule', visible: true },
  { id: 'time', visible: true },
  { id: 'invoices', visible: true },
  { id: 'finances', visible: true },
];

const DEFAULT_NOTES_TABS: LayoutItem[] = [
  { id: 'notes', visible: true },
  { id: 'todos', visible: true },
  { id: 'team', visible: false },
  { id: 'checklists', visible: false },
  { id: 'supplies', visible: false },
];

export default function OrganizationalDefaultsModal({
  visible,
  onClose,
}: OrganizationalDefaultsModalProps) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const { currentOrganization, isAdminOrOwner } = useOrganization();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('cards');
  const [editMode, setEditMode] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  const [homeCards, setHomeCards] = useState<LayoutItem[]>(DEFAULT_CARDS);
  const [tabs, setTabs] = useState<LayoutItem[]>(DEFAULT_TABS);
  const [quickActions, setQuickActions] = useState<LayoutItem[]>(DEFAULT_QUICK_ACTIONS);
  const [notesTabs, setNotesTabs] = useState<LayoutItem[]>(DEFAULT_NOTES_TABS);

  const shakeAnimation = useSharedValue(0);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (visible && currentOrganization?.id) {
      loadDefaults();
    }
  }, [visible, currentOrganization?.id]);

  useEffect(() => {
    if (editMode) {
      deactivateEditMode();
    }
  }, [activeTab]);

  useEffect(() => {
    if (!visible && editMode) {
      deactivateEditMode();
    }
  }, [visible]);

  const loadDefaults = async () => {
    if (!currentOrganization?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('organization_defaults')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setHomeCards(data.default_home_cards || DEFAULT_CARDS);
        setTabs(data.default_tabs || DEFAULT_TABS);
        setQuickActions(data.default_quick_actions || DEFAULT_QUICK_ACTIONS);
        setNotesTabs(data.default_notes_tabs || DEFAULT_NOTES_TABS);
      } else {
        setHomeCards(DEFAULT_CARDS);
        setTabs(DEFAULT_TABS);
        setQuickActions(DEFAULT_QUICK_ACTIONS);
        setNotesTabs(DEFAULT_NOTES_TABS);
      }
    } catch (error) {
      console.error('Error loading organization defaults:', error);
      Alert.alert('Error', 'Failed to load organization defaults');
    } finally {
      setLoading(false);
    }
  };

  const activateEditMode = () => {
    setEditMode(true);
    shakeAnimation.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 50 }),
        withTiming(-1, { duration: 100 }),
        withTiming(1, { duration: 100 }),
        withTiming(0, { duration: 50 })
      ),
      -1,
      false
    );
  };

  const deactivateEditMode = () => {
    setEditMode(false);
    setDraggingIndex(null);
    shakeAnimation.value = withTiming(0, { duration: 200 });
  };

  const handleSave = async () => {
    if (!currentOrganization?.id) return;

    setSaving(true);
    deactivateEditMode();
    try {
      const { error } = await supabase
        .from('organization_defaults')
        .upsert({
          organization_id: currentOrganization.id,
          default_home_cards: homeCards,
          default_tabs: tabs,
          default_quick_actions: quickActions,
          default_notes_tabs: notesTabs,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'organization_id',
        });

      if (error) throw error;

      showToast({ message: 'Organization defaults saved', type: 'success' });
      onClose();
    } catch (error) {
      console.error('Error saving organization defaults:', error);
      Alert.alert('Error', 'Failed to save organization defaults');
    } finally {
      setSaving(false);
    }
  };

  const getCurrentList = () => {
    switch (activeTab) {
      case 'cards':
        return homeCards;
      case 'tabs':
        return tabs;
      case 'quickActions':
        return quickActions;
      case 'notesTabs':
        return notesTabs;
      default:
        return [];
    }
  };

  const setCurrentList = (newList: LayoutItem[]) => {
    switch (activeTab) {
      case 'cards':
        setHomeCards(newList);
        break;
      case 'tabs':
        setTabs(newList);
        break;
      case 'quickActions':
        setQuickActions(newList);
        break;
      case 'notesTabs':
        setNotesTabs(newList);
        break;
    }
  };

  const getCurrentConfig = () => {
    switch (activeTab) {
      case 'cards':
        return AVAILABLE_CARDS;
      case 'tabs':
        return AVAILABLE_TABS;
      case 'quickActions':
        return AVAILABLE_QUICK_ACTIONS;
      case 'notesTabs':
        return AVAILABLE_NOTES_TABS;
      default:
        return [];
    }
  };

  const handleDragMove = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const currentList = getCurrentList();
    const newList = [...currentList];
    const [removed] = newList.splice(fromIndex, 1);
    newList.splice(toIndex, 0, removed);
    setCurrentList(newList);
  };

  const toggleVisibility = (id: string) => {
    const currentList = getCurrentList();
    const visibleCount = currentList.filter(item => item.visible).length;
    const item = currentList.find(item => item.id === id);

    const maxVisible = activeTab === 'notesTabs' ? 2 : 6;

    if (activeTab === 'tabs' && id === 'index') return;

    if (item?.visible || visibleCount < maxVisible) {
      setCurrentList(
        currentList.map(item =>
          item.id === id ? { ...item, visible: !item.visible } : item
        )
      );
    }
  };

  const DraggableItem = ({
    item,
    index,
    config,
  }: {
    item: LayoutItem;
    index: number;
    config: any;
  }) => {
    const translateY = useSharedValue(0);
    const scale = useSharedValue(1);
    const itemHeight = 64;
    const currentList = getCurrentList();
    const totalItems = currentList.length;

    const IconComponent = ICONS[config.icon];
    const isHome = activeTab === 'tabs' && item.id === 'index';
    const visibleCount = currentList.filter(i => i.visible).length;
    const maxVisible = activeTab === 'notesTabs' ? 2 : 6;
    const canToggle = (item.visible || visibleCount < maxVisible) && !isHome;

    const longPressGesture = Gesture.LongPress()
      .minDuration(150)
      .onStart(() => {
        runOnJS(activateEditMode)();
      });

    const panGesture = Gesture.Pan()
      .enabled(editMode)
      .minDistance(0)
      .onStart(() => {
        runOnJS(setDraggingIndex)(index);
        scale.value = withSpring(1.05);
      })
      .onUpdate((event) => {
        translateY.value = event.translationY;
        const offset = Math.round(event.translationY / itemHeight);
        const targetIndex = Math.max(0, Math.min(index + offset, totalItems - 1));
        if (targetIndex !== index) {
          runOnJS(handleDragMove)(index, targetIndex);
        }
      })
      .onEnd(() => {
        translateY.value = withSpring(0);
        scale.value = withSpring(1);
        runOnJS(setDraggingIndex)(null);
      });

    const composedGesture = Gesture.Simultaneous(longPressGesture, panGesture);

    const animatedStyle = useAnimatedStyle(() => {
      const shake = editMode && draggingIndex !== index ? shakeAnimation.value * 2 : 0;
      return {
        transform: [
          { translateY: translateY.value },
          { translateX: shake },
          { scale: scale.value },
        ],
        zIndex: draggingIndex === index ? 1000 : 1,
        opacity: draggingIndex === index ? 0.9 : 1,
      };
    });

    return (
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={[dynamicStyles.listItem, animatedStyle]}>
          <View style={dynamicStyles.dragHandle}>
            <GripVertical size={20} color={isHome ? colors.border : colors.textSecondary} />
          </View>

          <View style={dynamicStyles.itemContent}>
            <View style={[dynamicStyles.iconBox, { backgroundColor: colors.primary + '15' }]}>
              {IconComponent && <IconComponent size={18} color={colors.primary} />}
            </View>
            <Text style={dynamicStyles.itemLabel}>{config.label}</Text>
            {isHome && <Text style={dynamicStyles.requiredBadge}>Required</Text>}
          </View>

          <View style={dynamicStyles.itemActions}>
            <TouchableOpacity
              style={[
                dynamicStyles.visibilityButton,
                item.visible && dynamicStyles.visibilityButtonActive,
                !canToggle && !item.visible && dynamicStyles.visibilityButtonDisabled,
              ]}
              onPress={() => toggleVisibility(item.id)}
              disabled={!canToggle && !item.visible}
            >
              {item.visible ? (
                <Eye size={18} color={isHome ? colors.border : colors.primary} />
              ) : (
                <EyeOff size={18} color={canToggle ? colors.textSecondary : colors.border} />
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </GestureDetector>
    );
  };

  const dynamicStyles = getDynamicStyles(colors);
  const currentList = getCurrentList();
  const currentConfig = getCurrentConfig();
  const visibleCount = currentList.filter(item => item.visible).length;
  const maxVisible = activeTab === 'notesTabs' ? 2 : 6;

  if (!isAdminOrOwner) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={dynamicStyles.overlay}>
        <View style={dynamicStyles.modal}>
          <View style={dynamicStyles.header}>
            <Text style={dynamicStyles.title}>Organization Defaults</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={dynamicStyles.description}>
            <Text style={dynamicStyles.descriptionText}>
              Set default layout preferences that will be automatically applied to new team members when they join your organization.
            </Text>
          </View>

          <View style={dynamicStyles.tabBar}>
            <TouchableOpacity
              style={[dynamicStyles.tab, activeTab === 'cards' && dynamicStyles.tabActive]}
              onPress={() => setActiveTab('cards')}
            >
              <Text style={[dynamicStyles.tabText, activeTab === 'cards' && dynamicStyles.tabTextActive]}>
                Home Cards
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[dynamicStyles.tab, activeTab === 'tabs' && dynamicStyles.tabActive]}
              onPress={() => setActiveTab('tabs')}
            >
              <Text style={[dynamicStyles.tabText, activeTab === 'tabs' && dynamicStyles.tabTextActive]}>
                Bottom Tabs
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[dynamicStyles.tab, activeTab === 'quickActions' && dynamicStyles.tabActive]}
              onPress={() => setActiveTab('quickActions')}
            >
              <Text style={[dynamicStyles.tabText, activeTab === 'quickActions' && dynamicStyles.tabTextActive]}>
                Quick Actions
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[dynamicStyles.tab, activeTab === 'notesTabs' && dynamicStyles.tabActive]}
              onPress={() => setActiveTab('notesTabs')}
            >
              <Text style={[dynamicStyles.tabText, activeTab === 'notesTabs' && dynamicStyles.tabTextActive]}>
                Notes Tabs
              </Text>
            </TouchableOpacity>
          </View>

          <View style={dynamicStyles.limitInfo}>
            <Text style={dynamicStyles.limitText}>
              {visibleCount}/{maxVisible} visible
            </Text>
            {editMode && (
              <TouchableOpacity style={dynamicStyles.doneButton} onPress={deactivateEditMode}>
                <LinearGradient
                  colors={['#1B4D6E', '#245d82']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={dynamicStyles.doneButtonGradient}
                >
                  <Text style={dynamicStyles.doneButtonText}>Done</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>

          {loading ? (
            <View style={dynamicStyles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <ScrollView ref={scrollViewRef} style={dynamicStyles.content} scrollEnabled={!editMode}>
              <Text style={dynamicStyles.sectionHint}>
                {editMode
                  ? 'Drag items to reorder. Tap Done when finished.'
                  : 'Long press any item to reorder. Toggle visibility with the eye icon.'}
              </Text>
              {currentList.map((item, index) => {
                const config = currentConfig.find(c => c.id === item.id);
                if (!config) return null;
                return <DraggableItem key={item.id} item={item} index={index} config={config} />;
              })}
            </ScrollView>
          )}

          <View style={dynamicStyles.footer}>
            <TouchableOpacity
              style={dynamicStyles.saveButton}
              onPress={handleSave}
              disabled={saving || loading}
            >
              <LinearGradient
                colors={['#1B4D6E', '#245d82']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={dynamicStyles.saveButtonGradient}
              >
                <Save size={18} color="#fff" />
                <Text style={dynamicStyles.saveButtonText}>
                  {saving ? 'Saving...' : 'Save Defaults'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const getDynamicStyles = (colors: any) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modal: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '90%',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
    },
    description: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 8,
    },
    descriptionText: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    tabBar: {
      flexDirection: 'row',
      paddingHorizontal: 20,
      paddingTop: 8,
      gap: 6,
    },
    tab: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: 8,
      backgroundColor: colors.inputBackground,
    },
    tabActive: {
      backgroundColor: colors.primary,
    },
    tabText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    tabTextActive: {
      color: '#fff',
    },
    limitInfo: {
      paddingHorizontal: 20,
      paddingTop: 12,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 12,
    },
    limitText: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    doneButton: {
      overflow: 'hidden' as const,
      borderRadius: 6,
    },
    doneButtonGradient: {
      paddingHorizontal: 16,
      paddingVertical: 6,
    },
    doneButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: '#fff',
    },
    content: {
      padding: 20,
      maxHeight: 320,
    },
    loadingContainer: {
      padding: 40,
      alignItems: 'center',
    },
    sectionHint: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 16,
      lineHeight: 18,
    },
    listItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
    },
    dragHandle: {
      padding: 4,
      marginRight: 8,
    },
    itemContent: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    iconBox: {
      width: 36,
      height: 36,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    itemLabel: {
      fontSize: 15,
      fontWeight: '500',
      color: colors.text,
    },
    requiredBadge: {
      fontSize: 11,
      color: colors.textSecondary,
      backgroundColor: colors.inputBackground,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
      marginLeft: 8,
    },
    itemActions: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    visibilityButton: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: colors.inputBackground,
      marginLeft: 4,
    },
    visibilityButtonActive: {
      backgroundColor: colors.primaryLight,
    },
    visibilityButtonDisabled: {
      opacity: 0.5,
    },
    footer: {
      padding: 20,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    saveButton: {
      overflow: 'hidden' as const,
      borderRadius: 10,
    },
    saveButtonGradient: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      gap: 8,
      paddingVertical: 14,
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#fff',
    },
  });
