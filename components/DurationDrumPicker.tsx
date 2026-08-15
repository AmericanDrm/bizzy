import React, { useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;

const triggerHaptic = () => {
  if (Platform.OS !== 'web') {
    Haptics.selectionAsync();
  }
};

interface DurationDrumPickerProps {
  value: number | null;
  onChange: (minutes: number | null) => void;
}

function parseDuration(minutes: number | null): { mode: 'hours' | 'days'; number: number; mins: number } {
  if (minutes === null || minutes === 0) return { mode: 'hours', number: 0, mins: 0 };
  const totalMins = minutes;
  const days = Math.floor(totalMins / (60 * 24));
  if (days >= 1 && totalMins % (60 * 24) === 0) {
    return { mode: 'days', number: days, mins: 0 };
  }
  const hrs = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return { mode: 'hours', number: hrs, mins: m };
}

export default function DurationDrumPicker({ value, onChange }: DurationDrumPickerProps) {
  const { colors, isDark } = useTheme();
  const parsed = parseDuration(value);

  const hourItems = Array.from({ length: 13 }, (_, i) => i);
  const minuteItems = [0, 15, 30, 45];
  const modeItems: ('Hours' | 'Days')[] = ['Hours', 'Days'];
  const dayItems = Array.from({ length: 30 }, (_, i) => i + 1);

  const isHourMode = parsed.mode === 'hours';
  const selectedHour = isHourMode ? parsed.number : 0;
  const selectedMin = isHourMode ? parsed.mins : 0;
  const selectedDay = !isHourMode ? parsed.number : 1;
  const selectedModeIndex = isHourMode ? 0 : 1;

  const leftScrollRef = useRef<ScrollView>(null);
  const minScrollRef = useRef<ScrollView>(null);
  const modeScrollRef = useRef<ScrollView>(null);

  const prevLeftRef = useRef(isHourMode ? selectedHour : selectedDay);
  const prevMinRef = useRef(selectedMin);
  const prevModeRef = useRef(selectedModeIndex);

  const leftItems = isHourMode ? hourItems : dayItems;
  const leftSelected = isHourMode ? selectedHour : selectedDay;

  const buildMinutes = useCallback((mode: 'hours' | 'days', leftVal: number, minVal: number): number | null => {
    if (mode === 'days') return leftVal * 60 * 24;
    if (leftVal === 0 && minVal === 0) return null;
    return leftVal * 60 + minVal;
  }, []);

  useEffect(() => {
    const li = isHourMode ? hourItems.indexOf(selectedHour) : dayItems.indexOf(selectedDay);
    const mi = minuteItems.indexOf(selectedMin);
    setTimeout(() => {
      leftScrollRef.current?.scrollTo({ y: Math.max(0, li) * ITEM_HEIGHT, animated: false });
      minScrollRef.current?.scrollTo({ y: Math.max(0, mi) * ITEM_HEIGHT, animated: false });
      modeScrollRef.current?.scrollTo({ y: selectedModeIndex * ITEM_HEIGHT, animated: false });
    }, 80);
  }, []);

  const snapScroll = useCallback((ref: React.RefObject<ScrollView | null>, index: number) => {
    ref.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: true });
  }, []);

  const handleLeftScroll = useCallback((e: any) => {
    const idx = Math.max(0, Math.min(Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT), leftItems.length - 1));
    const newVal = leftItems[idx];
    if (newVal !== undefined && newVal !== prevLeftRef.current) {
      prevLeftRef.current = newVal;
      triggerHaptic();
      if (isHourMode) {
        onChange(buildMinutes('hours', newVal, selectedMin));
      } else {
        onChange(buildMinutes('days', newVal, 0));
      }
    }
    snapScroll(leftScrollRef, idx);
  }, [leftItems, isHourMode, selectedMin, buildMinutes, onChange, snapScroll]);

  const handleLeftScrollLive = useCallback((e: any) => {
    const idx = Math.max(0, Math.min(Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT), leftItems.length - 1));
    const newVal = leftItems[idx];
    if (newVal !== undefined && newVal !== prevLeftRef.current) {
      prevLeftRef.current = newVal;
      triggerHaptic();
      if (isHourMode) {
        onChange(buildMinutes('hours', newVal, selectedMin));
      } else {
        onChange(buildMinutes('days', newVal, 0));
      }
    }
  }, [leftItems, isHourMode, selectedMin, buildMinutes, onChange]);

  const handleMinScroll = useCallback((e: any) => {
    const idx = Math.max(0, Math.min(Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT), minuteItems.length - 1));
    const newMin = minuteItems[idx];
    if (newMin !== undefined && newMin !== prevMinRef.current) {
      prevMinRef.current = newMin;
      triggerHaptic();
      onChange(buildMinutes('hours', selectedHour, newMin));
    }
    snapScroll(minScrollRef, idx);
  }, [selectedHour, minuteItems, buildMinutes, onChange, snapScroll]);

  const handleMinScrollLive = useCallback((e: any) => {
    const idx = Math.max(0, Math.min(Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT), minuteItems.length - 1));
    const newMin = minuteItems[idx];
    if (newMin !== undefined && newMin !== prevMinRef.current) {
      prevMinRef.current = newMin;
      triggerHaptic();
      onChange(buildMinutes('hours', selectedHour, newMin));
    }
  }, [selectedHour, minuteItems, buildMinutes, onChange]);

  const handleModeScroll = useCallback((e: any) => {
    const idx = Math.max(0, Math.min(Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT), modeItems.length - 1));
    if (idx !== prevModeRef.current) {
      prevModeRef.current = idx;
      triggerHaptic();
      const newMode = modeItems[idx] === 'Days' ? 'days' : 'hours';
      if (newMode === 'days') {
        const day = selectedDay;
        prevLeftRef.current = day;
        onChange(buildMinutes('days', day, 0));
        const li = dayItems.indexOf(day);
        setTimeout(() => leftScrollRef.current?.scrollTo({ y: Math.max(0, li) * ITEM_HEIGHT, animated: false }), 50);
      } else {
        const hr = selectedHour;
        prevLeftRef.current = hr;
        onChange(buildMinutes('hours', hr, selectedMin));
        const li = hourItems.indexOf(hr);
        setTimeout(() => leftScrollRef.current?.scrollTo({ y: Math.max(0, li) * ITEM_HEIGHT, animated: false }), 50);
      }
    }
    snapScroll(modeScrollRef, idx);
  }, [modeItems, selectedDay, selectedHour, selectedMin, dayItems, hourItems, buildMinutes, onChange, snapScroll]);

  const handleModeScrollLive = useCallback((e: any) => {
    const idx = Math.max(0, Math.min(Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT), modeItems.length - 1));
    if (idx !== prevModeRef.current) {
      prevModeRef.current = idx;
      triggerHaptic();
    }
  }, [modeItems]);

  const displayValue = (): string => {
    if (value === null) return 'Not set';
    if (!isHourMode) return `${selectedDay} day${selectedDay !== 1 ? 's' : ''}`;
    if (selectedHour === 0 && selectedMin === 0) return 'Not set';
    const parts: string[] = [];
    if (selectedHour > 0) parts.push(`${selectedHour}h`);
    if (selectedMin > 0) parts.push(`${selectedMin}m`);
    return parts.join(' ');
  };

  const styles = getStyles(colors, isDark);

  return (
    <View style={styles.wrapper}>
      <View style={styles.pickerContainer}>
        <View style={styles.selectionIndicator} pointerEvents="none" />

        <View style={styles.columns}>
          <View style={[styles.column, styles.leftColumn]}>
            <ScrollView
              ref={leftScrollRef}
              showsVerticalScrollIndicator={false}
              snapToInterval={ITEM_HEIGHT}
              decelerationRate="fast"
              onScroll={handleLeftScrollLive}
              scrollEventThrottle={16}
              onMomentumScrollEnd={handleLeftScroll}
              onScrollEndDrag={handleLeftScroll}
            >
              <View style={{ height: ITEM_HEIGHT * 2 }} />
              {leftItems.map((item, idx) => {
                const isSelected = item === leftSelected;
                return (
                  <TouchableOpacity
                    key={idx}
                    style={styles.item}
                    onPress={() => {
                      prevLeftRef.current = item;
                      if (isHourMode) {
                        onChange(buildMinutes('hours', item, selectedMin));
                      } else {
                        onChange(buildMinutes('days', item, 0));
                      }
                      triggerHaptic();
                      leftScrollRef.current?.scrollTo({ y: idx * ITEM_HEIGHT, animated: true });
                    }}
                  >
                    <Text style={[styles.itemText, isSelected && styles.selectedItemText]}>
                      {item}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              <View style={{ height: ITEM_HEIGHT * 2 }} />
            </ScrollView>
          </View>

          {isHourMode && (
            <>
              <Text style={styles.colonSep}>:</Text>
              <View style={[styles.column, styles.minColumn]}>
                <ScrollView
                  ref={minScrollRef}
                  showsVerticalScrollIndicator={false}
                  snapToInterval={ITEM_HEIGHT}
                  decelerationRate="fast"
                  onScroll={handleMinScrollLive}
                  scrollEventThrottle={16}
                  onMomentumScrollEnd={handleMinScroll}
                  onScrollEndDrag={handleMinScroll}
                >
                  <View style={{ height: ITEM_HEIGHT * 2 }} />
                  {minuteItems.map((m, idx) => {
                    const isSelected = m === selectedMin;
                    return (
                      <TouchableOpacity
                        key={idx}
                        style={styles.item}
                        onPress={() => {
                          prevMinRef.current = m;
                          onChange(buildMinutes('hours', selectedHour, m));
                          triggerHaptic();
                          minScrollRef.current?.scrollTo({ y: idx * ITEM_HEIGHT, animated: true });
                        }}
                      >
                        <Text style={[styles.itemText, isSelected && styles.selectedItemText]}>
                          {String(m).padStart(2, '0')}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  <View style={{ height: ITEM_HEIGHT * 2 }} />
                </ScrollView>
              </View>
            </>
          )}

          <View style={[styles.column, styles.modeColumn]}>
            <ScrollView
              ref={modeScrollRef}
              showsVerticalScrollIndicator={false}
              snapToInterval={ITEM_HEIGHT}
              decelerationRate="fast"
              onScroll={handleModeScrollLive}
              scrollEventThrottle={16}
              onMomentumScrollEnd={handleModeScroll}
              onScrollEndDrag={handleModeScroll}
            >
              <View style={{ height: ITEM_HEIGHT * 2 }} />
              {modeItems.map((label, idx) => {
                const isSelected = idx === selectedModeIndex;
                return (
                  <TouchableOpacity
                    key={idx}
                    style={styles.item}
                    onPress={() => {
                      prevModeRef.current = idx;
                      const newMode = label === 'Days' ? 'days' : 'hours';
                      if (newMode === 'days') {
                        const day = selectedDay;
                        prevLeftRef.current = day;
                        onChange(buildMinutes('days', day, 0));
                        const li = dayItems.indexOf(day);
                        setTimeout(() => leftScrollRef.current?.scrollTo({ y: Math.max(0, li) * ITEM_HEIGHT, animated: false }), 50);
                      } else {
                        const hr = selectedHour;
                        prevLeftRef.current = hr;
                        onChange(buildMinutes('hours', hr, selectedMin));
                        const li = hourItems.indexOf(hr);
                        setTimeout(() => leftScrollRef.current?.scrollTo({ y: Math.max(0, li) * ITEM_HEIGHT, animated: false }), 50);
                      }
                      triggerHaptic();
                      modeScrollRef.current?.scrollTo({ y: idx * ITEM_HEIGHT, animated: true });
                    }}
                  >
                    <Text style={[styles.modeText, isSelected && styles.selectedModeText]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              <View style={{ height: ITEM_HEIGHT * 2 }} />
            </ScrollView>
          </View>
        </View>
      </View>

      <View style={styles.previewRow}>
        <Text style={styles.previewLabel}>Selected:</Text>
        <Text style={styles.previewValue}>{displayValue()}</Text>
        {value !== null && (
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={() => {
              onChange(null);
              leftScrollRef.current?.scrollTo({ y: 0, animated: true });
              minScrollRef.current?.scrollTo({ y: 0, animated: true });
              modeScrollRef.current?.scrollTo({ y: 0, animated: true });
            }}
          >
            <Text style={styles.clearBtnText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  wrapper: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: isDark ? colors.cardBackground : '#f8fafc',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.12)' : '#e2e8f0',
  },
  pickerContainer: {
    height: ITEM_HEIGHT * VISIBLE_ITEMS,
    position: 'relative',
  },
  selectionIndicator: {
    position: 'absolute',
    top: ITEM_HEIGHT * 2,
    left: 8,
    right: 8,
    height: ITEM_HEIGHT,
    backgroundColor: isDark ? 'rgba(58, 154, 217, 0.12)' : 'rgba(27, 77, 110, 0.08)',
    borderRadius: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.primary,
    zIndex: 1,
  },
  columns: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
    paddingHorizontal: 12,
  },
  column: {
    height: '100%',
  },
  leftColumn: {
    flex: 2,
  },
  minColumn: {
    flex: 2,
  },
  modeColumn: {
    flex: 2,
  },
  colonSep: {
    fontSize: 22,
    fontWeight: 'bold',
    color: isDark ? colors.textSecondary : '#555',
    marginHorizontal: 4,
    marginBottom: 2,
  },
  item: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemText: {
    fontSize: 18,
    color: isDark ? 'rgba(255,255,255,0.3)' : '#aaa',
  },
  selectedItemText: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primary,
  },
  modeText: {
    fontSize: 14,
    color: isDark ? 'rgba(255,255,255,0.3)' : '#aaa',
    fontWeight: '500',
  },
  selectedModeText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
    backgroundColor: isDark ? colors.surface : '#fff',
    gap: 6,
  },
  previewLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  previewValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    flex: 1,
  },
  clearBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#fee2e2',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(239,68,68,0.4)' : '#fca5a5',
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ef4444',
  },
});
