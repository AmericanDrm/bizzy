import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, ViewStyle, AccessibilityInfo, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface AnimatedTabContentProps {
  children: React.ReactNode;
  activeTab: string;
  tabKey: string;
  direction?: 'left' | 'right' | 'auto';
  duration?: number;
  style?: ViewStyle;
  enableAnimations?: boolean;
  enableHaptics?: boolean;
}

export function AnimatedTabContent({
  children,
  activeTab,
  tabKey,
  direction = 'auto',
  duration = 220,
  style,
  enableAnimations = true,
  enableHaptics = true,
}: AnimatedTabContentProps) {
  const isActive = activeTab === tabKey;
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);
  const previousActiveRef = useRef(isActive);
  const { colors } = useTheme();

  useEffect(() => {
    if (Platform.OS !== 'web') {
      AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
        setReduceMotionEnabled(enabled);
      });

      const subscription = AccessibilityInfo.addEventListener(
        'reduceMotionChanged',
        setReduceMotionEnabled
      );

      return () => {
        subscription?.remove();
      };
    }
  }, []);

  const triggerHaptic = () => {
    if (Platform.OS !== 'web' && enableHaptics) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  useEffect(() => {
    const wasActive = previousActiveRef.current;
    previousActiveRef.current = isActive;

    if (isActive && wasActive !== isActive) {
      runOnJS(triggerHaptic)();
    }
  }, [isActive]);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background },
        !isActive && styles.hidden,
        style
      ]}
      accessible={isActive}
      accessibilityLabel={`${tabKey} content`}
      pointerEvents={isActive ? 'auto' : 'none'}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
    alignItems: 'stretch',
  },
  hidden: {
    display: 'none',
  },
});
