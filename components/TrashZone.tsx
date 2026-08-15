import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Trash2 } from 'lucide-react-native';

interface TrashZoneProps {
  visible: boolean;
  isHovered: boolean;
  eventTitle?: string;
}

export default function TrashZone({ visible, isHovered, eventTitle }: TrashZoneProps) {
  const scale = useSharedValue(0);
  const hoverScale = useSharedValue(1);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, { damping: 14, stiffness: 200 });
      opacity.value = withTiming(1, { duration: 200 });
    } else {
      scale.value = withTiming(0, { duration: 160 });
      opacity.value = withTiming(0, { duration: 160 });
    }
  }, [visible]);

  useEffect(() => {
    if (isHovered) {
      hoverScale.value = withSpring(1.35, { damping: 10, stiffness: 220 });
    } else {
      hoverScale.value = withSpring(1, { damping: 14, stiffness: 200 });
    }
  }, [isHovered]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const iconWrapStyle = useAnimatedStyle(() => ({
    transform: [{ scale: hoverScale.value }],
    backgroundColor: isHovered
      ? withTiming('#EF4444', { duration: 160 })
      : withTiming('rgba(239,68,68,0.12)', { duration: 200 }),
    borderColor: isHovered
      ? withTiming('#EF4444', { duration: 160 })
      : withTiming('rgba(239,68,68,0.4)', { duration: 200 }),
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <Animated.View style={[styles.iconWrap, iconWrapStyle]}>
        <Trash2 size={isHovered ? 30 : 24} color={isHovered ? '#fff' : '#EF4444'} />
      </Animated.View>
      <Text style={[styles.label, isHovered && styles.labelHovered]}>
        {isHovered ? (eventTitle ? `Delete "${eventTitle}"` : 'Release to delete') : 'Drag here to delete'}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EF4444',
    opacity: 0.7,
  },
  labelHovered: {
    opacity: 1,
    fontSize: 13,
  },
});
