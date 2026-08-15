import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View, ViewStyle, TextStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';

interface GradientButtonProps {
  title?: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'success' | 'danger' | 'warning';
  style?: ViewStyle;
  gradientStyle?: ViewStyle;
  textStyle?: TextStyle;
  children?: React.ReactNode;
  icon?: React.ReactNode;
  iconOnly?: boolean;
}

export default function GradientButton({
  title,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
  style,
  gradientStyle,
  textStyle,
  children,
  icon,
  iconOnly = false,
}: GradientButtonProps) {
  const { colors, isDark } = useTheme();

  const getGradientColors = (): [string, string] => {
    if (disabled) {
      return isDark ? ['#253342', '#1c2a36'] : ['#b0bec5', '#90a4ae'];
    }

    switch (variant) {
      case 'success':
        return isDark ? ['#2e9e5e', '#25b76e'] : ['#2D8B57', '#34a065'];
      case 'danger':
        return isDark ? ['#d14545', '#c0392b'] : ['#dc2626', '#b91c1c'];
      case 'warning':
        return isDark ? ['#e6a020', '#d4850a'] : ['#d4850a', '#c27608'];
      default:
        return isDark ? ['#3a9ad9', '#2e7dba'] : ['#1B4D6E', '#245d82'];
    }
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.container, style]}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={getGradientColors()}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.gradient, iconOnly && styles.iconOnlyGradient, gradientStyle]}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : children ? (
          children
        ) : (
          <View style={styles.contentRow}>
            {icon && <View style={styles.iconWrapper}>{icon}</View>}
            {title && (
              <Text style={[styles.text, disabled && styles.disabledText, textStyle]}>
                {title}
              </Text>
            )}
          </View>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  gradient: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconOnlyGradient: {
    paddingHorizontal: 16,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledText: {
    opacity: 0.6,
  },
});
