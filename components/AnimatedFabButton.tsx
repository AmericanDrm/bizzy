import React, { useRef, useEffect } from 'react';
import { TouchableOpacity, Animated, StyleSheet, ViewStyle, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';

interface AnimatedFabButtonProps {
  onPress: () => void;
  isOpen: boolean;
  backgroundColor?: string;
  size?: number;
  iconSize?: number;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

export default function AnimatedFabButton({
  onPress,
  isOpen,
  backgroundColor,
  size = 56,
  iconSize = 22,
  style,
  accessibilityLabel,
}: AnimatedFabButtonProps) {
  const { isDark } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: isOpen ? 1.12 : 1,
      useNativeDriver: true,
      friction: 6,
      tension: 80,
    }).start();
  }, [isOpen]);

  const borderRadius = size / 2;

  const gradientColors: [string, string] = backgroundColor
    ? [backgroundColor, backgroundColor]
    : isDark
      ? ['#3a9ad9', '#2e7dba']
      : ['#1B4D6E', '#245d82'];

  return (
    <TouchableOpacity
      style={[
        styles.fab,
        {
          width: size,
          height: size,
          borderRadius,
        },
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityLabel={accessibilityLabel ?? (isOpen ? 'Close' : 'Open Bizzy assistant')}
      accessibilityRole="button"
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.gradientInner,
          { width: size, height: size, borderRadius },
        ]}
      >
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <Image source={require('@/assets/images/Isolated_Bizzy_Bolt.png')} style={{ width: iconSize + 8, height: iconSize + 8, tintColor: '#FFFFFF' }} resizeMode="contain" />
        </Animated.View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  gradientInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
