import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';

function SkeletonBox({
  width,
  height,
  borderRadius = 8,
  style,
}: {
  width?: number | string;
  height: number;
  borderRadius?: number;
  style?: any;
}) {
  const { isDark } = useTheme();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
      -1,
      false
    );
  }, []);

  const baseColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
  const shimmerColor = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)';

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(progress.value, [0, 1], [-300, 300]),
      },
    ],
  }));

  return (
    <View
      style={[
        {
          width: width ?? '100%',
          height,
          borderRadius,
          backgroundColor: baseColor,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
        <LinearGradient
          colors={['transparent', shimmerColor, shimmerColor, 'transparent']}
          locations={[0, 0.3, 0.7, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

export function DashboardSkeleton() {
  const { colors, isDark } = useTheme();
  const cardBg = isDark ? colors.surface : colors.cardBackground;
  const borderColor = isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB';

  return (
    <View>
      <View style={styles.statsGrid}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.cardWrapper}>
            <View style={[styles.statCard, { backgroundColor: cardBg, borderColor }]}>
              <SkeletonBox height={44} width={44} borderRadius={8} />
              <SkeletonBox height={20} width="60%" borderRadius={4} style={{ marginTop: 8 }} />
              <SkeletonBox height={10} width="80%" borderRadius={4} style={{ marginTop: 6 }} />
            </View>
          </View>
        ))}
      </View>

      <View style={[styles.blockCard, { backgroundColor: cardBg, borderColor }]}>
        <SkeletonBox height={14} width="40%" borderRadius={4} />
        <SkeletonBox height={12} width="90%" borderRadius={4} style={{ marginTop: 12 }} />
        <SkeletonBox height={12} width="70%" borderRadius={4} style={{ marginTop: 8 }} />
      </View>

      <View style={[styles.blockCard, { backgroundColor: cardBg, borderColor, marginTop: 12 }]}>
        <SkeletonBox height={14} width="50%" borderRadius={4} />
        <SkeletonBox height={12} width="85%" borderRadius={4} style={{ marginTop: 12 }} />
        <SkeletonBox height={12} width="60%" borderRadius={4} style={{ marginTop: 8 }} />
      </View>

      <SkeletonBox
        height={14}
        width={120}
        borderRadius={4}
        style={{ marginTop: 24, marginBottom: 14 }}
      />
      <View style={styles.actionsGrid}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.actionWrapper}>
            <View style={[styles.actionCard, { backgroundColor: cardBg, borderColor }]}>
              <SkeletonBox height={44} width={44} borderRadius={8} />
              <SkeletonBox height={10} width="70%" borderRadius={4} style={{ marginTop: 8 }} />
            </View>
          </View>
        ))}
        {[3, 4].map((i) => (
          <View key={i} style={styles.actionWrapperHalf}>
            <View style={[styles.actionCard, { backgroundColor: cardBg, borderColor }]}>
              <SkeletonBox height={44} width={44} borderRadius={8} />
              <SkeletonBox height={10} width="70%" borderRadius={4} style={{ marginTop: 8 }} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  const { colors, isDark } = useTheme();
  const cardBg = isDark ? colors.surface : colors.cardBackground;
  const borderColor = isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB';

  return (
    <View style={{ gap: 10, paddingHorizontal: 16, paddingTop: 12 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={[styles.listCard, { backgroundColor: cardBg, borderColor }]}>
          <SkeletonBox height={40} width={40} borderRadius={20} />
          <View style={{ flex: 1, gap: 6 }}>
            <SkeletonBox height={14} width="65%" borderRadius={4} />
            <SkeletonBox height={11} width="45%" borderRadius={4} />
          </View>
          <SkeletonBox height={28} width={60} borderRadius={6} />
        </View>
      ))}
    </View>
  );
}

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  const { colors, isDark } = useTheme();
  const cardBg = isDark ? colors.surface : colors.cardBackground;
  const borderColor = isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB';

  const widths = ['80%', '65%', '50%', '70%', '45%'];

  return (
    <View style={[styles.blockCard, { backgroundColor: cardBg, borderColor }]}>
      <SkeletonBox height={16} width="40%" borderRadius={4} style={{ marginBottom: 12 }} />
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBox
          key={i}
          height={12}
          width={widths[i % widths.length]}
          borderRadius={4}
          style={{ marginTop: i > 0 ? 8 : 0 }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  cardWrapper: {
    flexBasis: '31%',
    flexGrow: 1,
    maxWidth: '32%',
  },
  statCard: {
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    minHeight: 120,
    justifyContent: 'center',
  },
  blockCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionWrapper: {
    flexGrow: 1,
    flexBasis: '30%',
    maxWidth: '32.5%',
  },
  actionWrapperHalf: {
    flexGrow: 1,
    flexBasis: '48%',
    maxWidth: '49%',
  },
  actionCard: {
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    minHeight: 76,
    justifyContent: 'center',
  },
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
});
