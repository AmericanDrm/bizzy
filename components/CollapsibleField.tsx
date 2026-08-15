import React, { useEffect } from 'react';
import { TouchableOpacity, StyleSheet, View, Alert } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';
import { SPACING, TYPOGRAPHY, ANIMATION } from '@/constants/designSystem';

interface CollapsibleFieldProps {
  label: string;
  fieldId: string;
  activeFieldId: string | null;
  onToggle: (fieldId: string) => void;
  onOpen?: () => void;
  displayValue?: string;
  children: React.ReactNode;
  required?: boolean;
  startExpanded?: boolean;
  hasError?: boolean;
  rightAction?: React.ReactNode;
}

export default function CollapsibleField({
  label,
  fieldId,
  activeFieldId,
  onToggle,
  onOpen,
  displayValue,
  children,
  required,
  startExpanded,
  hasError,
  rightAction,
}: CollapsibleFieldProps) {
  const { colors } = useTheme();
  const isExpanded = activeFieldId === fieldId;
  const progress = useSharedValue(startExpanded || isExpanded ? 1 : 0);
  const prevExpandedRef = React.useRef(isExpanded);

  useEffect(() => {
    if (isExpanded && !prevExpandedRef.current && onOpen) {
      onOpen();
    }
    prevExpandedRef.current = isExpanded;
    progress.value = withTiming(isExpanded ? 1 : 0, {
      duration: ANIMATION.medium,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    });
  }, [isExpanded]);

  const headerStyle = useAnimatedStyle(() => ({
    justifyContent: interpolate(progress.value, [0, 1], [0.5, 0]) === 0.5
      ? 'center' as const
      : 'flex-start' as const,
  }));

  const labelStyle = useAnimatedStyle(() => ({
    fontSize: interpolate(progress.value, [0, 1], [15, TYPOGRAPHY.label.fontSize]),
    textAlign: progress.value < 0.5 ? 'center' as const : 'left' as const,
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.3, 1], [0, 0, 1]),
    maxHeight: interpolate(progress.value, [0, 1], [0, 2000]),
    overflow: 'hidden' as const,
  }));

  const displayText = displayValue || label;
  const showLabel = required ? `${label} *` : label;

  return (
    <View style={[styles.container, hasError && { borderColor: colors.error, borderWidth: 1.5, borderRadius: 10 }]}>
      <TouchableOpacity
        style={[
          styles.header,
          {
            backgroundColor: isExpanded ? colors.inputBackground : 'transparent',
            borderRadius: 10,
            paddingVertical: isExpanded ? SPACING.sm : SPACING.md,
            paddingHorizontal: SPACING.lg,
          },
        ]}
        onPress={() => onToggle(fieldId)}
        activeOpacity={0.7}
      >
        <Animated.View style={[styles.headerContent, headerStyle]}>
          <Animated.Text
            style={[
              labelStyle,
              {
                color: isExpanded
                  ? colors.textSecondary
                  : displayValue
                  ? colors.text
                  : colors.textSecondary,
                fontWeight: isExpanded ? '600' : displayValue ? '500' : '400',
              },
            ]}
            numberOfLines={1}
          >
            {isExpanded ? showLabel : (displayValue || showLabel)}
          </Animated.Text>
        </Animated.View>
        {!isExpanded && displayValue && rightAction ? (
          <View style={styles.rightActionContainer}>{rightAction}</View>
        ) : null}

      </TouchableOpacity>

      <Animated.View style={contentStyle}>
        <View style={styles.content}>
          {children}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  rightActionContainer: {
    marginRight: 8,
  },
});
