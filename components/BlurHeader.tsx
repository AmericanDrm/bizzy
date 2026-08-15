import React from 'react';
import { View, StyleSheet, Platform, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '@/contexts/ThemeContext';

interface BlurHeaderProps {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: number;
}

export default function BlurHeader({ children, style, intensity = 60 }: BlurHeaderProps) {
  const { isDark } = useTheme();

  if (Platform.OS === 'web') {
    return (
      <View
        style={[
          styles.webHeader,
          {
            backgroundColor: isDark ? 'rgba(18,25,33,0.9)' : 'rgba(255,255,255,0.9)',
            borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
          },
          style,
        ]}
      >
        {children}
      </View>
    );
  }

  return (
    <BlurView intensity={intensity} tint={isDark ? 'dark' : 'light'} style={[styles.blurView, style]}>
      <View
        style={[
          styles.overlay,
          {
            backgroundColor: isDark ? 'rgba(18,25,33,0.5)' : 'rgba(255,255,255,0.5)',
            borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
            borderBottomWidth: StyleSheet.hairlineWidth,
          },
        ]}
      >
        {children}
      </View>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  blurView: {
    overflow: 'hidden',
  },
  overlay: {
    flex: 1,
  },
  webHeader: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  } as any,
});
