import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { X, GripVertical, Eye, EyeOff, Hop as Home, Users, Calendar, Briefcase, Clock, Receipt, FileText, DollarSign, Save } from 'lucide-react-native';
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
import {
  useLayout,
  AVAILABLE_CARDS,
  AVAILABLE_TABS,
  LayoutItem,
} from '@/contexts/LayoutContext';
import { Check } from 'lucide-react-native';

const ICONS: Record<string, any> = {
  Home,
  Users,
  Calendar,
  Briefcase,
  Clock,
  Receipt,
  FileText,
  DollarSign,
};

interface LayoutCustomizationModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function LayoutCustomizationModal({
  visible,
  onClose,
}: LayoutCustomizationModalProps) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const {
    homeCards,
    tabs,
    defaultTab,
    setDefaultTab,
    toggleCardVisibility,
    toggleTabVisibility,
    reorderCards,
    reorderTabs,
    savePreferences,
    visibleCards,
    visibleTabs,
  } = useLayout();

  const [activeTab, setActiveTab] = useState<'cards' | 'tabs' | 'startup'>('cards');
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  const shakeAnimation = useSharedValue(0);
  const scrollViewRef = useRef<ScrollView>(null);

  // Exit edit mode when tab changes or modal closes
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

  const activateEditMode = () => {
    setEditMode(true);
    // Start shake animation
    shakeAnimation.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 50 }),
        withTiming(-1, { duration: 100 }),
        withTiming(1, { duration: 100 }),
        withTiming(0, { duration: 50 })
      ),
      -1, // infinite repeat
      false
    );
  };

  const deactivateEditMode = () => {
    setEditMode(false);
    setDraggingIndex(null);
    shakeAnimation.value = withTiming(0, { duration: 200 });
  };

  const handleSave = async () => {
    setSaving(true);
    deactivateEditMode();
    try {
      await savePreferences();
      showToast({ message: 'Layout preferences saved', type: 'success' });
      onClose();
    } catch (error) {
      Alert.alert('Error', 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const handleDragMove = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const reorderFn = activeTab === 'cards' ? reorderCards : reorderTabs;
    reorderFn(fromIndex, toIndex);
  };

  const getCardConfig = (id: string) => AVAILABLE_CARDS.find(c => c.id === id);
  const getTabConfig = (id: string) => AVAILABLE_TABS.find(t => t.id === id);

  const dynamicStyles = getDynamicStyles(colors);

  // Draggable Item Component
  const DraggableItem = ({
    item,
    index,
    totalItems,
    config,
    canToggle,
    isRequired,
    onToggle,
  }: {
    item: LayoutItem;
    index: number;
    totalItems: number;
    config: any;
    canToggle: boolean;
    isRequired?: boolean;
    onToggle: () => void;
  }) => {
    const translateY = useSharedValue(0);
    const scale = useSharedValue(1);
    const itemHeight = 64; // approximate height of each item

    const IconComponent = ICONS[config.icon];

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

        // Calculate target index based on drag position
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
      const shake = editMode && draggingIndex !== index
        ? shakeAnimation.value * 2
        : 0;

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
            <GripVertical size={20} color={isRequired ? colors.border : colors.textSecondary} />
          </View>

          <View style={dynamicStyles.itemContent}>
            <View style={[dynamicStyles.iconBox, { backgroundColor: colors.primary + '15' }]}>
              {IconComponent && <IconComponent size={18} color={colors.primary} />}
            </View>
            <Text style={dynamicStyles.itemLabel}>{config.label}</Text>
            {isRequired && <Text style={dynamicStyles.requiredBadge}>Required</Text>}
          </View>

          <View style={dynamicStyles.itemActions}>
            <TouchableOpacity
              style={[
                dynamicStyles.visibilityButton,
                item.visible && dynamicStyles.visibilityButtonActive,
                !canToggle && !item.visible && dynamicStyles.visibilityButtonDisabled,
              ]}
              onPress={onToggle}
              disabled={!canToggle && !item.visible}
            >
              {item.visible ? (
                <Eye size={18} color={isRequired ? colors.border : colors.primary} />
              ) : (
                <EyeOff size={18} color={canToggle ? colors.textSecondary : colors.border} />
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </GestureDetector>
    );
  };

  const renderCardItem = (item: LayoutItem, index: number) => {
    const config = getCardConfig(item.id);
    if (!config) return null;

    const canToggle = item.visible || visibleCards.length < 6;

    return (
      <DraggableItem
        key={item.id}
        item={item}
        index={index}
        totalItems={homeCards.length}
        config={config}
        canToggle={canToggle}
        onToggle={() => toggleCardVisibility(item.id)}
      />
    );
  };

  const renderTabItem = (item: LayoutItem, index: number) => {
    const config = getTabConfig(item.id);
    if (!config) return null;

    const isHome = item.id === 'index';
    const canToggle = (item.visible || visibleTabs.length < 6) && !isHome;

    return (
      <DraggableItem
        key={item.id}
        item={item}
        index={index}
        totalItems={tabs.length}
        config={config}
        canToggle={canToggle}
        isRequired={isHome}
        onToggle={() => toggleTabVisibility(item.id)}
      />
    );
  };

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
            <Text style={dynamicStyles.title}>Customize Layout</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color={colors.textSecondary} />
            </TouchableOpacity>
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
                Tabs
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[dynamicStyles.tab, activeTab === 'startup' && dynamicStyles.tabActive]}
              onPress={() => setActiveTab('startup')}
            >
              <Text style={[dynamicStyles.tabText, activeTab === 'startup' && dynamicStyles.tabTextActive]}>
                Startup
              </Text>
            </TouchableOpacity>
          </View>

          {activeTab !== 'startup' && (
            <View style={dynamicStyles.limitInfo}>
              <Text style={dynamicStyles.limitText}>
                {activeTab === 'cards'
                  ? `${visibleCards.length}/6 cards visible`
                  : `${visibleTabs.length}/6 tabs visible`}
              </Text>
              {editMode && (
                <TouchableOpacity
                  style={dynamicStyles.doneButton}
                  onPress={deactivateEditMode}
                >
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
          )}

          <ScrollView ref={scrollViewRef} style={dynamicStyles.content} scrollEnabled={!editMode}>
            {activeTab === 'cards' ? (
              <>
                <Text style={dynamicStyles.sectionHint}>
                  {editMode
                    ? 'Drag items to reorder. Tap Done when finished.'
                    : 'Long press any card to reorder. Toggle visibility with the eye icon.'}
                </Text>
                {homeCards.map((item, index) => renderCardItem(item, index))}
              </>
            ) : activeTab === 'tabs' ? (
              <>
                <Text style={dynamicStyles.sectionHint}>
                  {editMode
                    ? 'Drag items to reorder. Tap Done when finished.'
                    : 'Long press any tab to reorder. Toggle visibility with the eye icon. Home tab is always visible.'}
                </Text>
                {tabs.map((item, index) => renderTabItem(item, index))}
              </>
            ) : (
              <>
                <Text style={dynamicStyles.sectionHint}>
                  Choose which screen opens when you launch the app.
                </Text>
                {[
                  { id: null, label: 'Home (default)' },
                  ...AVAILABLE_TABS.filter(t => t.id !== 'index').map(t => ({ id: t.id, label: t.label })),
                ].map(option => {
                  const isSelected = (defaultTab ?? null) === option.id;
                  return (
                    <TouchableOpacity
                      key={option.id ?? '__home__'}
                      style={[dynamicStyles.startupOption, isSelected && dynamicStyles.startupOptionActive]}
                      onPress={() => setDefaultTab(option.id)}
                      activeOpacity={0.7}
                    >
                      <View style={dynamicStyles.startupOptionContent}>
                        <Text style={[dynamicStyles.startupOptionLabel, isSelected && dynamicStyles.startupOptionLabelActive]}>
                          {option.label}
                        </Text>
                        {option.id === null && (
                          <Text style={dynamicStyles.startupOptionSub}>Opens the dashboard</Text>
                        )}
                      </View>
                      {isSelected && <Check size={18} color={colors.primary} />}
                    </TouchableOpacity>
                  );
                })}
              </>
            )}
          </ScrollView>

          <View style={dynamicStyles.footer}>
            <TouchableOpacity
              style={dynamicStyles.saveButton}
              onPress={handleSave}
              disabled={saving}
            >
              <LinearGradient
                colors={['#1B4D6E', '#245d82']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={dynamicStyles.saveButtonGradient}
              >
                <Save size={18} color="#fff" />
                <Text style={dynamicStyles.saveButtonText}>
                  {saving ? 'Saving...' : 'Save Changes'}
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
    tabBar: {
      flexDirection: 'row',
      paddingHorizontal: 20,
      paddingTop: 16,
      gap: 8,
    },
    tab: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
      borderRadius: 8,
      backgroundColor: colors.inputBackground,
    },
    tabActive: {
      backgroundColor: colors.primary,
    },
    tabText: {
      fontSize: 14,
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
      borderRadius: 6,
      overflow: 'hidden',
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
      maxHeight: 400,
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
    startupOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      padding: 14,
      marginBottom: 8,
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    startupOptionActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '10',
    },
    startupOptionContent: {
      flex: 1,
    },
    startupOptionLabel: {
      fontSize: 15,
      fontWeight: '500',
      color: colors.text,
    },
    startupOptionLabelActive: {
      color: colors.primary,
      fontWeight: '700',
    },
    startupOptionSub: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    footer: {
      padding: 20,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    saveButton: {
      borderRadius: 10,
      overflow: 'hidden',
    },
    saveButtonGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#fff',
    },
  });
