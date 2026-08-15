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
import { useTheme } from '@/contexts/ThemeContext';
import { useLayout } from '@/contexts/LayoutContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRouter } from 'expo-router';
import AnimatedNumber from '@/components/AnimatedNumber';
import { HapticPatterns } from '@/lib/haptics';
import { getElevation } from '@/constants/designSystem';

interface StatCardProps {
  id: string;
  icon?: any;
  imageSource?: ImageSourcePropType;
  label: string;
  value: number | string;
  route: string;
}

interface EditableStatsGridProps {
  cards: StatCardProps[];
}

const CARD_HEIGHT = 120;
const GAP = 10;

export default function EditableStatsGrid({ cards }: EditableStatsGridProps) {
  const { colors, isDark } = useTheme();
  const { homeCards, toggleCardVisibility, reorderCards, savePreferences, visibleCards } = useLayout();
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
      reorderCards(fromIndex, toIndex);
    }
  };

  const handleToggleVisibility = (id: string) => {
    toggleCardVisibility(id);
  };

  const dynamicStyles = getDynamicStyles(colors, isDark);

  const DraggableCard = ({ card, index, isVisible }: { card: StatCardProps; index: number; isVisible: boolean }) => {
    const cardData = homeCards.find(c => c.id === card.id);
    const isCardVisible = cardData?.visible ?? false;
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
      HapticPatterns.selection();
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
      const col = index % 3;
      const row = Math.floor(index / 3);
      const cardWidth = 100;

      const colOffset = Math.round(transX / cardWidth);
      const rowOffset = Math.round(transY / (CARD_HEIGHT + GAP));

      const newCol = col + colOffset;
      const newRow = row + rowOffset;

      const maxRow = Math.ceil(homeCards.length / 3) - 1;
      const clampedCol = Math.max(0, Math.min(2, newCol));
      const clampedRow = Math.max(0, Math.min(maxRow, newRow));

      const newIndex = clampedRow * 3 + clampedCol;
      return Math.max(0, Math.min(homeCards.length - 1, newIndex));
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
      const canToggle = isCardVisible || visibleCards.length < 6;
      const canMoveLeft = index > 0;
      const canMoveRight = index < homeCards.length - 1;

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

      const cardContent = (
        <>
          <TouchableOpacity
            style={[
              dynamicStyles.visibilityButton,
              isCardVisible && dynamicStyles.visibilityButtonActive,
              !canToggle && !isCardVisible && dynamicStyles.visibilityButtonDisabled,
            ]}
            onPress={() => handleToggleVisibility(card.id)}
            disabled={!canToggle && !isCardVisible}
          >
            {isCardVisible ? (
              <Eye size={14} color={colors.primary} />
            ) : (
              <EyeOff size={14} color={canToggle ? colors.textSecondary : colors.border} />
            )}
          </TouchableOpacity>

          {card.imageSource ? (
            <Image source={card.imageSource} resizeMode="contain" style={[dynamicStyles.statIconImage, isDark && Platform.OS === 'web' && { mixBlendMode: 'lighten' as any }]} />
          ) : (
            <View style={[dynamicStyles.statIconContainer, { backgroundColor: colors.primary + '15' }]}>
              {card.icon ? <card.icon size={18} color={colors.primary} /> : null}
            </View>
          )}
          {typeof card.value === 'number' ? (
            <AnimatedNumber value={card.value} style={dynamicStyles.statValue} />
          ) : (
            <Text style={dynamicStyles.statValue}>{card.value}</Text>
          )}
          <Text style={dynamicStyles.statLabel}>{card.label}</Text>
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
        </>
      );

      if (Platform.OS === 'web') {
        return (
          <View style={dynamicStyles.cardWrapper}>
            <View
              style={[
                dynamicStyles.statCard,
                !isCardVisible && dynamicStyles.statCardHidden,
              ]}
            >
              {cardContent}
            </View>
          </View>
        );
      }

      return (
        <View style={dynamicStyles.cardWrapper}>
          {isDropTarget && (
            <View style={dynamicStyles.dropPlaceholder} />
          )}
          <GestureDetector gesture={panGesture}>
            <Animated.View
              style={[
                dynamicStyles.statCard,
                !isCardVisible && dynamicStyles.statCardHidden,
                animatedStyle,
              ]}
            >
              {cardContent}
            </Animated.View>
          </GestureDetector>
        </View>
      );
    }

    if (!isVisible) return null;

    return (
      <View style={dynamicStyles.cardWrapper}>
        <Animated.View style={pressAnimatedStyle}>
          <Pressable
            style={dynamicStyles.statCard}
            onPress={() => router.navigate(card.route as any)}
            onLongPress={handleLongPress}
            delayLongPress={500}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
          >
            {card.imageSource ? (
              <Image source={card.imageSource} resizeMode="contain" style={[dynamicStyles.statIconImage, isDark && Platform.OS === 'web' && { mixBlendMode: 'lighten' as any }]} />
            ) : (
              <View style={[dynamicStyles.statIconContainer, { backgroundColor: colors.primary + '15' }]}>
                {card.icon ? <card.icon size={18} color={colors.primary} /> : null}
              </View>
            )}
            {typeof card.value === 'number' ? (
              <AnimatedNumber value={card.value} style={dynamicStyles.statValue} />
            ) : (
              <Text style={dynamicStyles.statValue}>{card.value}</Text>
            )}
            <Text style={dynamicStyles.statLabel}>{card.label}</Text>
          </Pressable>
        </Animated.View>
      </View>
    );
  };

  return (
    <View>
      {editMode && (
        <View style={dynamicStyles.editBanner}>
          <Text style={dynamicStyles.editBannerText}>
            {Platform.OS === 'web'
              ? t('edit_reorder_arrows')
              : t('edit_reorder_drag')
            }
          </Text>
          <TouchableOpacity style={dynamicStyles.doneButton} onPress={handleDone}>
            <Text style={dynamicStyles.doneButtonText}>{t('done')}</Text>
          </TouchableOpacity>
        </View>
      )}
      <View style={dynamicStyles.statsGrid}>
        {homeCards.map((cardPref, index) => {
          const card = cards.find(c => c.id === cardPref.id);
          if (!card) return null;
          return <DraggableCard key={card.id} card={card} index={index} isVisible={cardPref.visible} />;
        })}
      </View>
      {editMode && (
        <Text style={dynamicStyles.editHint}>
          {t('edit_cards_visible').replace('{n}', String(visibleCards.length))}
        </Text>
      )}
    </View>
  );
}

const getDynamicStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: GAP,
      marginBottom: 12,
    },
    cardWrapper: {
      position: 'relative',
      flexBasis: '47%',
      flexGrow: 1,
      maxWidth: '50%',
    },
    statCard: {
      width: '100%',
      backgroundColor: colors.inputBackground,
      borderRadius: 8,
      padding: 12,
      alignItems: 'flex-start',
    },
    dropPlaceholder: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: CARD_HEIGHT,
      backgroundColor: colors.primary + '25',
      borderRadius: 8,
      borderWidth: 2,
      borderColor: colors.primary,
      borderStyle: 'dashed',
      zIndex: 0,
    },
    statCardHidden: {
      opacity: 0.5,
      borderWidth: 2,
      borderColor: colors.border,
      borderStyle: 'dashed',
    },
    statIconContainer: {
      width: 28,
      height: 28,
      borderRadius: 6,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 6,
    },
    statIconContainerImage: {
      width: 32,
      height: 32,
      borderRadius: 0,
      overflow: 'hidden',
      backgroundColor: 'transparent',
    },
    statIconImage: {
      width: 32,
      height: 32,
      marginBottom: 4,
      backgroundColor: 'transparent',
      opacity: 0.5,
    },
    statValue: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.primary,
      letterSpacing: -0.5,
    },
    statLabel: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 3,
      letterSpacing: 0.1,
    },
    editBanner: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.primary,
      padding: 12,
      borderRadius: 10,
      marginBottom: 16,
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
    reorderButtons: {
      flexDirection: 'row',
      gap: 4,
      marginTop: 4,
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
      marginTop: -8,
      marginBottom: 16,
    },
  });
