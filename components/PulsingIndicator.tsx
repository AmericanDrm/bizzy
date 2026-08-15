import React, { useEffect } from 'react';
import { View, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';

interface PulsingIndicatorProps {
  color: string;
  size?: number;
  style?: ViewStyle;
  active?: boolean;
}

export default function PulsingIndicator({
  color,
  size = 10,
  style,
  active = true,
}: PulsingIndicatorProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.7);

  useEffect(() => {
    if (!active) {
      scale.value = withTiming(1, { duration: 200 });
      opacity.value = withTiming(0.7, { duration: 200 });
      return;
    }
    scale.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 0 }),
        withDelay(300, withTiming(1.8, { duration: 700, easing: Easing.out(Easing.ease) }))
      ),
      -1,
      false
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 0 }),
        withDelay(300, withTiming(0, { duration: 700, easing: Easing.out(Easing.ease) }))
      ),
      -1,
      false
    );
  }, [active]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View
      style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}
    >
      <Animated.View
        style={[
          { position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color },
          ringStyle,
        ]}
      />
      <View
        style={{ width: size * 0.65, height: size * 0.65, borderRadius: (size * 0.65) / 2, backgroundColor: color }}
      />
    </View>
  );
}
