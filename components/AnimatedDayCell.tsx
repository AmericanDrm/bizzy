import React, { useEffect, useCallback } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

interface AnimatedDayCellProps {
  date: Date | null;
  isDropTarget: boolean;
  onPress: () => void;
  onLayout?: (dateStr: string, layout: { x: number; y: number; width: number; height: number }) => void;
  style: any[];
  children: React.ReactNode;
  eventCount?: number;
  isDragActive?: boolean;
}

export default function AnimatedDayCell({
  date,
  isDropTarget,
  onPress,
  onLayout,
  style,
  children,
  eventCount,
  isDragActive,
}: AnimatedDayCellProps) {
  const cellScale = useSharedValue(1);

  useEffect(() => {
    if (isDropTarget) {
      cellScale.value = withSpring(1.06, { damping: 10, stiffness: 180 });
    } else {
      cellScale.value = withSpring(1, { damping: 15 });
    }
  }, [isDropTarget]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cellScale.value }],
    zIndex: isDropTarget ? 10 : 1,
  }));

  const handleLayout = useCallback(() => {
    if (!date || !onLayout) return;
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    viewRef.current?.measureInWindow((x: number, y: number, width: number, height: number) => {
      if (width > 0 && height > 0) {
        onLayout(dateStr, { x, y, width, height });
      }
    });
  }, [date, onLayout]);

  const viewRef = React.useRef<View>(null);

  return (
    <Pressable
      onPress={onPress}
      disabled={!date}
      style={{ flex: 1 }}
    >
      <View ref={viewRef} onLayout={handleLayout} collapsable={false} style={{ flex: 1 }}>
        <Animated.View style={[...style, animStyle]}>
          {children}
        </Animated.View>
      </View>
    </Pressable>
  );
}
