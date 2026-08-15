import React, { useRef, ReactNode, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
  PanResponder,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { HapticPatterns } from '@/lib/haptics';

export interface SwipeAction {
  label: string;
  icon: ReactNode;
  color: string;
  textColor?: string;
  onPress: () => void;
  width?: number;
}

interface SwipeableRowProps {
  children: ReactNode;
  rightActions?: SwipeAction[];
  leftActions?: SwipeAction[];
  enabled?: boolean;
}

const ACTION_WIDTH = 80;
const SWIPE_THRESHOLD = 40;
const VELOCITY_THRESHOLD = 0.3;

function WebSwipeableRow({
  children,
  rightActions = [],
  leftActions = [],
}: SwipeableRowProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const currentX = useRef(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const isTracking = useRef(false);
  const isScrolling = useRef<boolean | null>(null);
  const [open, setOpen] = useState<'left' | 'right' | null>(null);

  const rightTotal = rightActions.length * ACTION_WIDTH;
  const leftTotal = leftActions.length * ACTION_WIDTH;

  const snapTo = useCallback((value: number, velocity = 0) => {
    currentX.current = value;
    Animated.spring(translateX, {
      toValue: value,
      useNativeDriver: true,
      velocity,
      tension: 120,
      friction: 14,
    }).start();
  }, [translateX]);

  const close = useCallback(() => {
    setOpen(null);
    snapTo(0);
  }, [snapTo]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (isScrolling.current === true) return false;
        const { dx, dy } = gestureState;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        if (absDx < 4 && absDy < 4) return false;
        if (isScrolling.current === null) {
          isScrolling.current = absDy > absDx;
          if (isScrolling.current) return false;
        }
        return absDx > absDy && absDx > 4;
      },
      onPanResponderGrant: (_, gestureState) => {
        isTracking.current = true;
        startX.current = currentX.current;
      },
      onPanResponderMove: (_, gestureState) => {
        const raw = startX.current + gestureState.dx;
        let clamped = raw;
        if (raw < -rightTotal) clamped = -rightTotal - Math.sqrt(Math.abs(raw + rightTotal)) * 2;
        if (raw > leftTotal) clamped = leftTotal + Math.sqrt(Math.abs(raw - leftTotal)) * 2;
        if (rightActions.length === 0 && raw < 0) clamped = 0;
        if (leftActions.length === 0 && raw > 0) clamped = 0;
        translateX.setValue(clamped);
        currentX.current = clamped;
      },
      onPanResponderRelease: (_, gestureState) => {
        isTracking.current = false;
        isScrolling.current = null;
        const { dx, vx } = gestureState;
        const totalDx = startX.current + dx;

        if (rightActions.length > 0 && totalDx < 0) {
          if (Math.abs(totalDx) > SWIPE_THRESHOLD || vx < -VELOCITY_THRESHOLD) {
            setOpen('right');
            snapTo(-rightTotal, vx);
          } else {
            close();
          }
        } else if (leftActions.length > 0 && totalDx > 0) {
          if (totalDx > SWIPE_THRESHOLD || vx > VELOCITY_THRESHOLD) {
            setOpen('left');
            snapTo(leftTotal, vx);
          } else {
            close();
          }
        } else {
          close();
        }
      },
      onPanResponderTerminate: () => {
        isTracking.current = false;
        isScrolling.current = null;
        close();
      },
    })
  ).current;

  const rightActionsVisible = translateX.interpolate({
    inputRange: [-rightTotal, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const leftActionsVisible = translateX.interpolate({
    inputRange: [0, leftTotal],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.container}>
      {rightActions.length > 0 && (
        <Animated.View
          style={[styles.actionsRight, { width: rightTotal, opacity: rightActionsVisible }]}
        >
          {rightActions.map((action, index) => {
            const btnTranslate = translateX.interpolate({
              inputRange: [-rightTotal, 0],
              outputRange: [0, (rightActions.length - index) * ACTION_WIDTH],
              extrapolate: 'clamp',
            });
            return (
              <Animated.View
                key={index}
                style={[
                  styles.actionBtnWrapper,
                  { width: ACTION_WIDTH, transform: [{ translateX: btnTranslate }] },
                ]}
              >
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: action.color }]}
                  onPress={() => { close(); action.onPress(); }}
                  activeOpacity={0.85}
                >
                  {action.icon}
                  <Text style={[styles.actionLabel, { color: action.textColor ?? '#fff' }]}>
                    {action.label}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </Animated.View>
      )}

      {leftActions.length > 0 && (
        <Animated.View
          style={[styles.actionsLeft, { width: leftTotal, opacity: leftActionsVisible }]}
        >
          {leftActions.map((action, index) => {
            const btnTranslate = translateX.interpolate({
              inputRange: [0, leftTotal],
              outputRange: [-(index + 1) * ACTION_WIDTH, 0],
              extrapolate: 'clamp',
            });
            return (
              <Animated.View
                key={index}
                style={[
                  styles.actionBtnWrapper,
                  { width: ACTION_WIDTH, transform: [{ translateX: btnTranslate }] },
                ]}
              >
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: action.color }]}
                  onPress={() => { close(); action.onPress(); }}
                  activeOpacity={0.85}
                >
                  {action.icon}
                  <Text style={[styles.actionLabel, { color: action.textColor ?? '#fff' }]}>
                    {action.label}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </Animated.View>
      )}

      <Animated.View
        style={[styles.rowContent, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        {open !== null && (
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={close}
            activeOpacity={1}
          />
        )}
        {children}
      </Animated.View>
    </View>
  );
}

export default function SwipeableRow({
  children,
  rightActions = [],
  leftActions = [],
  enabled = true,
}: SwipeableRowProps) {
  if (!enabled || (rightActions.length === 0 && leftActions.length === 0)) {
    return <>{children}</>;
  }

  if (Platform.OS === 'web') {
    return (
      <WebSwipeableRow
        rightActions={rightActions}
        leftActions={leftActions}
        enabled={enabled}
      >
        {children}
      </WebSwipeableRow>
    );
  }

  return <NativeSwipeableRow rightActions={rightActions} leftActions={leftActions} enabled={enabled}>{children}</NativeSwipeableRow>;
}

function NativeSwipeableRow({
  children,
  rightActions = [],
  leftActions = [],
}: SwipeableRowProps) {
  const swipeableRef = useRef<Swipeable>(null);
  const close = () => swipeableRef.current?.close();

  const renderRightActions = (progress: Animated.AnimatedInterpolation<number>) => {
    const totalWidth = rightActions.length * ACTION_WIDTH;
    return (
      <View style={{ width: totalWidth, flexDirection: 'row' }}>
        {rightActions.map((action, index) => {
          const trans = progress.interpolate({
            inputRange: [0, 1],
            outputRange: [totalWidth - index * ACTION_WIDTH, 0],
            extrapolate: 'clamp',
          });
          return (
            <Animated.View key={index} style={{ width: ACTION_WIDTH, transform: [{ translateX: trans }] }}>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: action.color }]}
                onPress={() => { close(); action.onPress(); }}
                activeOpacity={0.85}
              >
                {action.icon}
                <Text style={[styles.actionLabel, { color: action.textColor ?? '#fff' }]}>
                  {action.label}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
    );
  };

  const renderLeftActions = (progress: Animated.AnimatedInterpolation<number>) => {
    const totalWidth = leftActions.length * ACTION_WIDTH;
    return (
      <View style={{ width: totalWidth, flexDirection: 'row' }}>
        {leftActions.map((action, index) => {
          const trans = progress.interpolate({
            inputRange: [0, 1],
            outputRange: [-totalWidth + index * ACTION_WIDTH, 0],
            extrapolate: 'clamp',
          });
          return (
            <Animated.View key={index} style={{ width: ACTION_WIDTH, transform: [{ translateX: trans }] }}>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: action.color }]}
                onPress={() => { close(); action.onPress(); }}
                activeOpacity={0.85}
              >
                {action.icon}
                <Text style={[styles.actionLabel, { color: action.textColor ?? '#fff' }]}>
                  {action.label}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      friction={2}
      rightThreshold={40}
      leftThreshold={40}
      renderRightActions={rightActions.length > 0 ? renderRightActions : undefined}
      renderLeftActions={leftActions.length > 0 ? renderLeftActions : undefined}
      onSwipeableWillOpen={() => HapticPatterns.swipeAction()}
      overshootRight={false}
      overshootLeft={false}
    >
      {children}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  rowContent: {
    backgroundColor: 'transparent',
  },
  actionsRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  actionsLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  actionBtnWrapper: {
    overflow: 'hidden',
  },
  actionBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
