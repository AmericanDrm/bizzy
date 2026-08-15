import React, { useEffect } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { Lock, LockOpen } from 'lucide-react-native';

interface JobLockProps {
  isLocked: boolean;
  onToggle: () => void;
  visible?: boolean;
  size?: number;
}

export default function JobLock({ isLocked, onToggle, visible = true, size = 18 }: JobLockProps) {
  const progress = useSharedValue(isLocked ? 1 : 0);
  const scale = useSharedValue(1);

  useEffect(() => {
    progress.value = withTiming(isLocked ? 1 : 0, { duration: 250 });
  }, [isLocked]);

  const containerStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      ['#22c55e22', '#ef444422']
    ),
    borderColor: interpolateColor(
      progress.value,
      [0, 1],
      ['#22c55e', '#ef4444']
    ),
    transform: [{ scale: scale.value }],
  }));

  if (!visible) return null;

  const handlePress = () => {
    scale.value = withSpring(0.85, { damping: 6, stiffness: 300 }, () => {
      scale.value = withSpring(1, { damping: 8, stiffness: 250 });
    });
    onToggle();
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
      <Animated.View style={[styles.container, containerStyle, { width: size + 12, height: size + 12, borderRadius: (size + 12) / 2 }]}>
        {isLocked
          ? <Lock size={size} color="#ef4444" strokeWidth={2.5} />
          : <LockOpen size={size} color="#22c55e" strokeWidth={2.5} />
        }
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
});
