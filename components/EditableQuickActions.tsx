import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Pressable, Platform, ImageSourcePropType } from 'react-native';
import { Eye, EyeOff, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  runOnJS,
  cancelAnimation,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import { useLayout } from '@/contexts/LayoutContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRouter } from 'expo-router';

interface QuickActionProps {
  id: string;
  icon?: any;
  imageSource?: ImageSourcePropType;
  label: string;
  route: string;
}

interface EditableQuickActionsProps {
  actions: QuickActionProps[];
}

const GAP = 10;
const COLUMNS = 3;
const ACTION_HEIGHT = 76;

export default function EditableQuickActions({ actions }: EditableQuickActionsProps) {
  const { colors, isDark } = useTheme();
  const { quickActions, toggleQuickActionVisibility, reorderQuickActions, savePreferences, visibleQuickActions } = useLayout();
  const { t } = useLanguage();
  const router = useRouter();
  const [editMode, setEditMode] = useState(false);
  const [dragTargetIndex, setDragTargetIndex] = useState<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  const handleLongPress = () => {
    setEditMode(true);
  };

  const handleDone = async () => {
    await savePreferences();
    setEditMode(false);
    setDragTargetIndex(null);
    setDraggingIndex(null);
  };

  const handleReorder = (fromIndex: number, toIndex: number) => {
    if (fromIndex !== toIndex) {
      reorderQuickActions(fromIndex, toIndex);
    }
  };

  const handleToggleVisibility = (id: string) => {
    toggleQuickActionVisibility(id);
  };

  const dynamicStyles = getDynamicStyles(colors, isDark);

  const DraggableAction = ({ action, index, isVisible }: { action: QuickActionProps; index: number; isVisible: boolean }) => {
    const actionData = quickActions.find(a => a.id === action.id);
    const isActionVisible = actionData?.visible ?? false;
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const isDragging = useSharedValue(false);
    const rotation = useSharedValue(0);
    const pressScale = useSharedValue(1);

    const pressAnimatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: pressScale.value }],
    }));

    const handlePressIn = () => {
      pressScale.value = withSpring(0.94, { damping: 15, stiffness: 350 });
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    };

    const handlePressOut = () => {
      pressScale.value = withSpring(1, { damping: 15, stiffness: 350 });
    };

    useEffect(() => {
      if (editMode) {
        rotation.value = withRepeat(
          withSequence(
            withTiming(-2, { duration: 80 }),
            withTiming(2, { duration: 80 }),
            withTiming(-2, { duration: 80 }),
            withTiming(0, { duration: 80 })
          ),
          -1,
          false
        );
      } else {
        cancelAnimation(rotation);
        rotation.value = withTiming(0, { duration: 100 });
      }
    }, [editMode]);

    const calculateTargetIndex = (transX: number, transY: number) => {
      const col = index % COLUMNS;
      const row = Math.floor(index / COLUMNS);
      const itemWidth = 100;

      const colOffset = Math.round(transX / itemWidth);
      const rowOffset = Math.round(transY / (ACTION_HEIGHT + GAP));

      const newCol = col + colOffset;
      const newRow = row + rowOffset;

      const maxRow = Math.ceil(quickActions.length / COLUMNS) - 1;
      const clampedCol = Math.max(0, Math.min(COLUMNS - 1, newCol));
      const clampedRow = Math.max(0, Math.min(maxRow, newRow));

      const newIndex = clampedRow * COLUMNS + clampedCol;
      return Math.max(0, Math.min(quickActions.length - 1, newIndex));
    };

    const panGesture = Gesture.Pan()
      .onStart(() => {
        isDragging.value = true;
        runOnJS(setDraggingIndex)(index);
      })
      .onUpdate((event) => {
        translateX.value = event.translationX;
        translateY.value = event.translationY;
        const targetIdx = calculateTargetIndex(event.translationX, event.translationY);
        runOnJS(setDragTargetIndex)(targetIdx);
      })
      .onEnd(() => {
        const finalIndex = calculateTargetIndex(translateX.value, translateY.value);
        if (finalIndex !== index) {
          runOnJS(handleReorder)(index, finalIndex);
        }
        runOnJS(setDragTargetIndex)(null);
        runOnJS(setDraggingIndex)(null);
        isDragging.value = false;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      })
      .onFinalize(() => {
        runOnJS(setDragTargetIndex)(null);
        runOnJS(setDraggingIndex)(null);
        isDragging.value = false;
      });

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: withSpring(isDragging.value ? 1.1 : 1) },
        { rotate: `${isDragging.value ? 0 : rotation.value}deg` },
      ],
      zIndex: isDragging.value ? 1000 : 1,
      opacity: withSpring(isDragging.value ? 0.9 : 1),
      shadowOpacity: isDragging.value ? 0.2 : 0.04,
    }));

    const isDropTarget = dragTargetIndex === index && draggingIndex !== null && draggingIndex !== index;

    if (editMode) {
      const canToggle = isActionVisible || visibleQuickActions.length < 6;
      const canMoveLeft = index > 0;
      const canMoveRight = index < quickActions.length - 1;

      const moveLeft = () => {
        if (canMoveLeft) {
          handleReorder(index, index - 1);
        }
      };

      const moveRight = () => {
        if (canMoveRight) {
          handleReorder(index, index + 1);
        }
      };

      const actionContent = (
        <>
          <TouchableOpacity
            style={[
              dynamicStyles.visibilityButton,
              isActionVisible && dynamicStyles.visibilityButtonActive,
              !canToggle && !isActionVisible && dynamicStyles.visibilityButtonDisabled,
            ]}
            onPress={() => handleToggleVisibility(action.id)}
            disabled={!canToggle && !isActionVisible}
          >
            {isActionVisible ? (
              <Eye size={14} color={colors.primary} />
            ) : (
              <EyeOff size={14} color={canToggle ? colors.textSecondary : colors.border} />
            )}
          </TouchableOpacity>

          <View style={dynamicStyles.actionContent}>
            {action.imageSource ? (
              <Image source={action.imageSource} resizeMode="contain" style={[dynamicStyles.actionIconImage, isDark && Platform.OS === 'web' && { mixBlendMode: 'lighten' as any }]} />
            ) : action.icon ? (
              <action.icon size={20} color={colors.primary} />
            ) : null}
            <Text style={dynamicStyles.actionButtonText}>{action.label}</Text>
            <View style={dynamicStyles.reorderButtons}>
              <TouchableOpacity
                style={[dynamicStyles.reorderButton, !canMoveLeft && dynamicStyles.reorderButtonDisabled]}
                onPress={moveLeft}
                disabled={!canMoveLeft}
              >
                <ChevronLeft size={14} color={canMoveLeft ? colors.primary : colors.border} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[dynamicStyles.reorderButton, !canMoveRight && dynamicStyles.reorderButtonDisabled]}
                onPress={moveRight}
                disabled={!canMoveRight}
              >
                <ChevronRight size={14} color={canMoveRight ? colors.primary : colors.border} />
              </TouchableOpacity>
            </View>
          </View>
        </>
      );

      if (Platform.OS === 'web') {
        return (
          <View style={dynamicStyles.actionWrapper}>
            <View
              style={[
                dynamicStyles.actionButton,
                !isActionVisible && dynamicStyles.actionButtonHidden,
              ]}
            >
              {actionContent}
            </View>
          </View>
        );
      }

      return (
        <View style={dynamicStyles.actionWrapper}>
          {isDropTarget && (
            <View style={dynamicStyles.dropPlaceholder} />
          )}
          <GestureDetector gesture={panGesture}>
            <Animated.View
              style={[
                dynamicStyles.actionButton,
                !isActionVisible && dynamicStyles.actionButtonHidden,
                animatedStyle,
              ]}
            >
              {actionContent}
            </Animated.View>
          </GestureDetector>
        </View>
      );
    }

    if (!isVisible) return null;

    const visibleCount = visibleQuickActions.length;
    const visibleIndex = visibleQuickActions.findIndex(a => a.id === action.id);

    const getLayoutStyle = () => {
      if (visibleCount === 1) {
        return { wrapper: dynamicStyles.actionWrapperFull, horizontal: true };
      }
      if (visibleCount === 2) {
        return { wrapper: dynamicStyles.actionWrapperFull, horizontal: true };
      }
      if (visibleCount === 4 && visibleIndex === 3) {
        return { wrapper: dynamicStyles.actionWrapperFull, horizontal: true };
      }
      if (visibleCount === 5 && visibleIndex >= 3) {
        return { wrapper: dynamicStyles.actionWrapperHalf, horizontal: true };
      }
      return { wrapper: dynamicStyles.actionWrapper, horizontal: false };
    };

    const layout = getLayoutStyle();

    return (
      <View style={layout.wrapper}>
        <Animated.View style={pressAnimatedStyle}>
          <Pressable
            style={[dynamicStyles.actionButton, layout.horizontal && dynamicStyles.actionButtonHorizontal]}
            onPress={() => router.navigate(action.route as any)}
            onLongPress={handleLongPress}
            delayLongPress={500}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
          >
            {action.imageSource ? (
              <Image source={action.imageSource} resizeMode="contain" style={[dynamicStyles.actionIconImage, isDark && Platform.OS === 'web' && { mixBlendMode: 'lighten' as any }]} />
            ) : action.icon ? (
              <action.icon size={20} color={colors.primary} />
            ) : null}
            <Text style={dynamicStyles.actionButtonText}>{action.label}</Text>
          </Pressable>
        </Animated.View>
      </View>
    );
  };

  return (
    <View>
      <View style={dynamicStyles.header}>
        <Text style={dynamicStyles.sectionTitle}>{t('home_quick_actions')}</Text>
      </View>
      {editMode && (
        <View style={dynamicStyles.editBanner}>
          <Text style={dynamicStyles.editBannerText}>
            {t('edit_reorder_arrows')}
          </Text>
          <TouchableOpacity style={dynamicStyles.doneButton} onPress={handleDone}>
            <Text style={dynamicStyles.doneButtonText}>{t('done')}</Text>
          </TouchableOpacity>
        </View>
      )}
      <View style={dynamicStyles.actionButtonsGrid}>
        {quickActions.map((actionPref, index) => {
          const action = actions.find(a => a.id === actionPref.id);
          if (!action) return null;
          return <DraggableAction key={action.id} action={action} index={index} isVisible={actionPref.visible} />;
        })}
      </View>
      {editMode && (
        <Text style={dynamicStyles.editHint}>
          {t('edit_actions_visible').replace('{n}', String(visibleQuickActions.length))}
        </Text>
      )}
    </View>
  );
}

const getDynamicStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    header: {
      marginBottom: 14,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      letterSpacing: -0.2,
    },
    actionButtonsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: GAP,
    },
    actionWrapper: {
      position: 'relative',
      flexGrow: 1,
      flexBasis: '30%',
      maxWidth: '32.5%',
    },
    actionWrapperFull: {
      position: 'relative',
      flexGrow: 1,
      flexBasis: '100%',
      maxWidth: '100%',
    },
    actionWrapperHalf: {
      position: 'relative',
      flexGrow: 1,
      flexBasis: '48%',
      maxWidth: '49%',
    },
    actionButton: {
      width: '100%',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      padding: 14,
      gap: 8,
      minHeight: ACTION_HEIGHT,
      shadowColor: isDark ? '#ffffff' : '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0.15 : 0.04,
      shadowRadius: 4,
      elevation: 2,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.2)' : '#D1D5DB',
    },
    actionButtonHorizontal: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 12,
    },
    actionButtonHidden: {
      opacity: 0.5,
      borderWidth: 2,
      borderColor: colors.border,
      borderStyle: 'dashed',
    },
    actionButtonText: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.text,
      textAlign: 'center',
      letterSpacing: 0.1,
    },
    editBanner: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.primary,
      padding: 12,
      borderRadius: 10,
      marginBottom: 14,
    },
    editBannerText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#fff',
      flex: 1,
    },
    doneButton: {
      backgroundColor: '#fff',
      paddingHorizontal: 16,
      paddingVertical: 6,
      borderRadius: 6,
    },
    doneButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
    },
    visibilityButton: {
      position: 'absolute',
      top: 6,
      right: 6,
      padding: 5,
      borderRadius: 5,
      backgroundColor: colors.inputBackground,
      zIndex: 10,
    },
    visibilityButtonActive: {
      backgroundColor: colors.primaryLight,
    },
    visibilityButtonDisabled: {
      opacity: 0.5,
    },
    actionIconImage: {
      width: 44,
      height: 44,
      backgroundColor: 'transparent',
    },
    actionContent: {
      alignItems: 'center',
      gap: 6,
    },
    reorderButtons: {
      flexDirection: 'row',
      gap: 4,
      marginTop: 2,
    },
    reorderButton: {
      padding: 4,
      borderRadius: 4,
      backgroundColor: colors.inputBackground,
    },
    reorderButtonDisabled: {
      opacity: 0.4,
    },
    editHint: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 14,
    },
    dropPlaceholder: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: ACTION_HEIGHT,
      backgroundColor: colors.primary + '25',
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.primary,
      borderStyle: 'dashed',
      zIndex: 0,
    },
  });
