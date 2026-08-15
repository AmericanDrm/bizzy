import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  Animated,
  StyleSheet,
  ViewStyle,
  Dimensions,
  Platform,
  Image,
} from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import FabQuickActionPanel from './FabQuickActionPanel';
import type { ParsedAction } from '@/lib/quickActionParser';

export interface FabAction {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;
  onPress: () => void;
}

interface WorkflowFabProps {
  actions: FabAction[];
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  backgroundColor?: string;
  style?: ViewStyle;
  visible?: boolean;
  onQuickAction?: (action: ParsedAction) => void;
  showQuickAction?: boolean;
  dominantHand?: 'right' | 'left';
}

export default function WorkflowFab({
  actions,
  isOpen,
  onToggle,
  onClose,
  backgroundColor = '#1B4D6E',
  style,
  visible = true,
  onQuickAction,
  showQuickAction = true,
  dominantHand = 'right',
}: WorkflowFabProps) {
  const fabAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const panelAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(fabAnim, {
      toValue: isOpen ? 1 : 0,
      useNativeDriver: true,
      friction: 6,
      tension: 80,
    }).start();
    Animated.spring(scaleAnim, {
      toValue: isOpen ? 1.12 : 1,
      useNativeDriver: true,
      friction: 6,
      tension: 80,
    }).start();
    Animated.spring(panelAnim, {
      toValue: isOpen ? 1 : 0,
      useNativeDriver: true,
      friction: 8,
      tension: 60,
    }).start();
  }, [isOpen]);

  if (!visible) return null;

  const panelOpacity = panelAnim.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0, 0, 1],
  });
  const panelScale = panelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1],
  });
  const panelTranslateY = panelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0],
  });

  return (
    <>
      {isOpen && (
        <Pressable style={styles.backdrop} onPress={onClose} />
      )}

      {isOpen && showQuickAction && (
        <Animated.View
          style={[
            styles.panelContainer,
            dominantHand === 'left' ? { left: 12, right: undefined } : { right: 12 },
            {
              bottom: 90 + (actions.length * 60),
              opacity: panelOpacity,
              transform: [{ scale: panelScale }, { translateY: panelTranslateY }],
            },
          ]}
        >
          <FabQuickActionPanel
            onAction={(action) => {
              onClose();
              onQuickAction?.(action);
            }}
            onClose={onClose}
          />
        </Animated.View>
      )}

      <View
        style={[
          styles.fabContainer,
          dominantHand === 'left'
            ? { left: 20, right: undefined, alignItems: 'flex-start' }
            : { right: 20, alignItems: 'flex-end' },
          style,
        ]}
        pointerEvents="box-none"
      >
        {actions.map((action, i) => {
          const IconComp = action.icon;
          const translateY = fabAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -(60 * (i + 1))],
          });
          const opacity = fabAnim.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [0, 0, 1],
          });
          return (
            <Animated.View
              key={action.id}
              style={[
                styles.fabActionRow,
                dominantHand === 'left'
                  ? { left: 0, right: undefined, flexDirection: 'row-reverse' }
                  : { right: 0 },
                { transform: [{ translateY }], opacity },
              ]}
              pointerEvents={isOpen ? 'auto' : 'none'}
            >
              <Text style={styles.fabLabel}>{action.label}</Text>
              <TouchableOpacity
                style={[styles.fabActionBtn, { backgroundColor: action.color }]}
                onPress={action.onPress}
                accessibilityLabel={action.label}
                accessibilityRole="button"
              >
                <IconComp size={20} color="#fff" />
              </TouchableOpacity>
            </Animated.View>
          );
        })}
        <TouchableOpacity
          style={[styles.fab, { backgroundColor }]}
          onPress={onToggle}
          activeOpacity={0.8}
          accessibilityLabel={isOpen ? 'Close menu' : 'Open Bizzy assistant'}
          accessibilityRole="button"
        >
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <Image source={require('@/assets/images/Isolated_Bizzy_Bolt.png')} style={{ width: 32, height: 32, tintColor: '#FFFFFF' }} resizeMode="contain" />
          </Animated.View>
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
    zIndex: 90,
  },
  panelContainer: {
    position: 'absolute',
    right: 12,
    zIndex: 95,
    width: Platform.OS === 'web' ? 340 : Math.min(Dimensions.get('window').width * 0.85, 330),
  },
  fabContainer: {
    position: 'absolute',
    bottom: 24,
    zIndex: 100,
  },
  fabActionRow: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  fabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    overflow: 'hidden',
  },
  fabActionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
});
