import { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { Zap } from 'lucide-react-native';

interface LogoProps {
  size?: number | 'small' | 'large';
  showText?: boolean;
  showLightning?: boolean;
}

export default function Logo({ size = 120, showLightning = true }: LogoProps) {
  const dimension = size === 'large' ? 200 : size === 'small' ? 32 : size;
  const lightningOpacity = useSharedValue(0);
  const lightningTranslateY = useSharedValue(-50);

  useEffect(() => {
    if (showLightning) {
      lightningOpacity.value = withDelay(
        500,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 100, easing: Easing.out(Easing.ease) }),
            withTiming(0, { duration: 100 }),
            withTiming(1, { duration: 100 }),
            withTiming(0, { duration: 300 }),
            withTiming(0, { duration: 3000 })
          ),
          -1,
          false
        )
      );

      lightningTranslateY.value = withDelay(
        500,
        withRepeat(
          withSequence(
            withTiming(0, { duration: 200, easing: Easing.out(Easing.ease) }),
            withTiming(0, { duration: 400 }),
            withTiming(-50, { duration: 200 }),
            withTiming(-50, { duration: 2800 })
          ),
          -1,
          false
        )
      );
    }
  }, [showLightning]);

  const animatedLightningStyle = useAnimatedStyle(() => ({
    opacity: lightningOpacity.value,
    transform: [{ translateY: lightningTranslateY.value }],
  }));

  return (
    <View style={styles.container}>
      {showLightning && (
        <Animated.View style={[styles.lightningContainer, animatedLightningStyle]}>
          <Zap size={dimension * 0.3} color="#FFD700" fill="#FFD700" strokeWidth={2} />
        </Animated.View>
      )}
      <Image
        source={require('@/assets/images/logoandname.png')}
        style={[styles.logo, { width: dimension, height: dimension }]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    alignSelf: 'center',
  },
  lightningContainer: {
    position: 'absolute',
    top: -20,
    zIndex: 10,
  },
});
