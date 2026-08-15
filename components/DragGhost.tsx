import React from 'react';
import { StyleSheet, Text, View, Platform } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { Clock, Move } from 'lucide-react-native';

interface DragGhostProps {
  visible: boolean;
  title: string;
  time: string;
  translateX: Animated.SharedValue<number>;
  translateY: Animated.SharedValue<number>;
  colors: any;
}

export default function DragGhost({
  visible,
  title,
  time,
  translateX,
  translateY,
  colors,
}: DragGhostProps) {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value - 60 },
    ],
  }));

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: colors.primary,
          shadowColor: colors.primary,
        },
        animatedStyle,
      ]}
      pointerEvents="none"
    >
      <View style={[styles.accent, { backgroundColor: colors.primary }]}>
        <Move size={12} color="#fff" />
      </View>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.timeRow}>
          <Clock size={10} color={colors.textSecondary} />
          <Text style={[styles.time, { color: colors.textSecondary }]}>{time}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
    maxWidth: 200,
    minWidth: 120,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 9999,
    ...Platform.select({
      web: { pointerEvents: 'none' as any },
      default: {},
    }),
  },
  accent: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    alignSelf: 'stretch',
  },
  content: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 2,
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  time: {
    fontSize: 10,
    fontWeight: '500',
  },
});
