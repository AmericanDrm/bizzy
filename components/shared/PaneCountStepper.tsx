import React, { useRef, useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Minus, Plus } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface PaneCountStepperProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  min?: number;
  max?: number;
  compact?: boolean;
}

export default function PaneCountStepper({
  value,
  onChange,
  disabled = false,
  min = 0,
  max = 9999,
  compact = false,
}: PaneCountStepperProps) {
  const { colors } = useTheme();
  const [inputText, setInputText] = useState(String(value));
  const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const minusScale = useRef(new Animated.Value(1)).current;
  const plusScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    setInputText(String(value));
  }, [value]);

  const stopHold = useCallback(() => {
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => () => stopHold(), [stopHold]);

  const clamp = (v: number) => Math.min(max, Math.max(min, v));

  const triggerHaptic = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const popAnimation = (scaleVal: Animated.Value) => {
    Animated.sequence([
      Animated.timing(scaleVal, { toValue: 0.8, duration: 70, useNativeDriver: false }),
      Animated.spring(scaleVal, { toValue: 1, friction: 3, tension: 40, useNativeDriver: false }),
    ]).start();
  };

  const step = (delta: number, scaleVal?: Animated.Value) => {
    if (disabled) return;
    triggerHaptic();
    if (scaleVal) popAnimation(scaleVal);
    const next = clamp(value + delta);
    onChange(next);
  };

  const startHold = (delta: number, scaleVal?: Animated.Value) => {
    if (disabled) return;
    let current = value;
    holdTimeoutRef.current = setTimeout(() => {
      holdIntervalRef.current = setInterval(() => {
        current = clamp(current + delta);
        triggerHaptic();
        if (scaleVal) popAnimation(scaleVal);
        onChange(current);
      }, 80);
    }, 350);
  };

  const handleChangeText = (text: string) => {
    setInputText(text);
  };

  const handleBlur = () => {
    const parsed = parseFloat(inputText);
    const next = isNaN(parsed) ? value : clamp(Math.floor(parsed));
    onChange(next);
    setInputText(String(next));
  };

  const canDecrement = !disabled && value > min;
  const btnSize = compact ? 32 : 36;
  const iconSize = compact ? 16 : 18;
  const inputWidth = compact ? 38 : 42;
  const inputHeight = compact ? 32 : 36;
  const fontSize = compact ? 13 : 14;

  const accentColor = colors.primary || '#0ea5e9';

  return (
    <View style={[styles.row, { gap: compact ? 3 : 4 }]}>
      <TouchableOpacity
        style={[
          styles.btn,
          {
            width: btnSize,
            height: btnSize,
            backgroundColor: canDecrement ? accentColor + '15' : colors.border + '40',
            borderColor: canDecrement ? accentColor + '40' : colors.border,
          },
        ]}
        onPress={() => step(-1, minusScale)}
        onLongPress={() => startHold(-1, minusScale)}
        onPressOut={stopHold}
        disabled={!canDecrement}
        activeOpacity={0.7}
      >
        <Animated.View style={{ transform: [{ scale: minusScale }], alignItems: 'center', justifyContent: 'center' }}>
          <Minus size={iconSize} color={canDecrement ? accentColor : colors.textSecondary} strokeWidth={2.5} />
        </Animated.View>
      </TouchableOpacity>

      <TextInput
        style={[
          styles.input,
          {
            width: inputWidth,
            height: inputHeight,
            fontSize,
            color: colors.text,
            backgroundColor: colors.inputBackground,
            borderColor: colors.border,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
        value={inputText}
        onChangeText={handleChangeText}
        onBlur={handleBlur}
        keyboardType="number-pad"
        editable={!disabled}
        selectTextOnFocus
        textAlign="center"
        maxLength={4}
      />

      <TouchableOpacity
        style={[
          styles.btn,
          {
            width: btnSize,
            height: btnSize,
            backgroundColor: disabled ? colors.border + '40' : accentColor + '15',
            borderColor: disabled ? colors.border : accentColor + '40',
          },
        ]}
        onPress={() => step(1, plusScale)}
        onLongPress={() => startHold(1, plusScale)}
        onPressOut={stopHold}
        disabled={disabled}
        activeOpacity={0.7}
      >
        <Animated.View style={{ transform: [{ scale: plusScale }], alignItems: 'center', justifyContent: 'center' }}>
          <Plus size={iconSize} color={disabled ? colors.textSecondary : accentColor} strokeWidth={2.5} />
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  btn: {
    borderRadius: 7,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  input: {
    borderRadius: 7,
    borderWidth: 1,
    textAlign: 'center',
    fontWeight: '600',
  },
});
