import React, { useEffect, useRef } from 'react';
import { Text, TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from 'react-native-reanimated';

const AnimatedText = Animated.createAnimatedComponent(Text);

interface AnimatedNumberProps {
  value: number;
  formatter?: (n: number) => string;
  style?: TextStyle | TextStyle[];
  duration?: number;
}

export default function AnimatedNumber({
  value,
  formatter,
  style,
  duration = 600,
}: AnimatedNumberProps) {
  const animatedValue = useSharedValue(value);
  const prevValue = useRef(value);

  useEffect(() => {
    if (prevValue.current !== value) {
      animatedValue.value = withTiming(value, {
        duration,
        easing: Easing.out(Easing.cubic),
      });
      prevValue.current = value;
    }
  }, [value, duration]);

  const animatedProps = useAnimatedProps(() => {
    const current = animatedValue.value;
    const formatted = formatter ? formatter(current) : String(Math.round(current));
    return { text: formatted } as any;
  });

  return (
    <AnimatedText
      style={style}
      animatedProps={animatedProps}
      defaultValue={formatter ? formatter(value) : String(Math.round(value))}
    />
  );
}
