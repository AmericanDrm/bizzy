import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';

interface TimePickerProps {
  visible: boolean;
  value: string;
  onConfirm: (time: string) => void;
  onCancel: () => void;
  initialMode?: 'scroll' | 'type';
}

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;

const HOUR_COUNT = 24;
const MINUTE_COUNT = 60;
const REPEAT_COUNT = 21;
const HOUR_CENTER_SET = Math.floor(REPEAT_COUNT / 2);
const MINUTE_CENTER_SET = Math.floor(REPEAT_COUNT / 2);

const repeatedHours: number[] = [];
for (let r = 0; r < REPEAT_COUNT; r++) {
  for (let i = 0; i < HOUR_COUNT; i++) {
    repeatedHours.push(i);
  }
}

const repeatedMinutes: number[] = [];
for (let r = 0; r < REPEAT_COUNT; r++) {
  for (let i = 0; i < MINUTE_COUNT; i++) {
    repeatedMinutes.push(i);
  }
}

const triggerHaptic = () => {
  if (Platform.OS !== 'web') {
    Haptics.selectionAsync();
  }
};

const getPeriodForHour = (hour: number): string => {
  return hour >= 12 ? 'PM' : 'AM';
};

const format12Hour = (hour24: number): string => {
  const h = hour24 % 12;
  return h === 0 ? '12' : h.toString();
};

const formatHourLabel = (hour: number): string => {
  const h12 = hour % 12;
  const display = h12 === 0 ? '12' : h12.toString();
  const period = getPeriodForHour(hour);
  return `${display} ${period}`;
};

export default function TimePicker({ visible, value, onConfirm, onCancel, initialMode = 'scroll' }: TimePickerProps) {
  const [selectedHour, setSelectedHour] = useState(0);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const [mode, setMode] = useState<'scroll' | 'type'>(initialMode);
  const [typedTime, setTypedTime] = useState('');

  const hourScrollRef = useRef<ScrollView>(null);
  const minuteScrollRef = useRef<ScrollView>(null);

  const prevHourRef = useRef(selectedHour);
  const prevMinuteRef = useRef(selectedMinute);
  const isRecentering = useRef(false);

  useEffect(() => {
    if (visible) {
      setMode(initialMode);
    }
  }, [visible, initialMode]);

  const scrollHourTo = useCallback((hour: number, animated: boolean) => {
    const index = HOUR_CENTER_SET * HOUR_COUNT + hour;
    hourScrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated });
  }, []);

  const scrollMinuteTo = useCallback((minute: number, animated: boolean) => {
    const index = MINUTE_CENTER_SET * MINUTE_COUNT + minute;
    minuteScrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated });
  }, []);

  useEffect(() => {
    if (visible && value) {
      const [h, m] = value.split(':').map(Number);
      const hour = isNaN(h) ? 0 : Math.min(23, Math.max(0, h));
      const minute = isNaN(m) ? 0 : Math.min(59, Math.max(0, m));

      setSelectedHour(hour);
      setSelectedMinute(minute);
      prevHourRef.current = hour;
      prevMinuteRef.current = minute;

      const hr12 = hour % 12 || 12;
      const period = hour >= 12 ? 'PM' : 'AM';
      setTypedTime(`${hr12}:${String(minute).padStart(2, '0')} ${period}`);

      setTimeout(() => {
        scrollHourTo(hour, false);
        scrollMinuteTo(minute, false);
      }, 100);
    }
  }, [visible, value, scrollHourTo, scrollMinuteTo]);

  const recenterHour = useCallback((currentHourValue: number) => {
    isRecentering.current = true;
    scrollHourTo(currentHourValue, false);
    setTimeout(() => { isRecentering.current = false; }, 50);
  }, [scrollHourTo]);

  const recenterMinute = useCallback((currentMinuteValue: number) => {
    isRecentering.current = true;
    scrollMinuteTo(currentMinuteValue, false);
    setTimeout(() => { isRecentering.current = false; }, 50);
  }, [scrollMinuteTo]);

  const handleConfirm = () => {
    if (mode === 'type') {
      const parsed = parseTypedTime(typedTime);
      if (parsed) {
        onConfirm(parsed);
        return;
      }
    }
    const timeString = `${selectedHour.toString().padStart(2, '0')}:${selectedMinute.toString().padStart(2, '0')}`;
    onConfirm(timeString);
  };

  const parseTypedTime = (input: string): string | null => {
    const clean = input.trim().toUpperCase();
    const match = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
    if (!match) return null;

    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const period = match[3];

    if (m < 0 || m > 59) return null;

    if (period) {
      if (h < 1 || h > 12) return null;
      if (period === 'AM' && h === 12) h = 0;
      else if (period === 'PM' && h !== 12) h += 12;
    } else {
      if (h < 0 || h > 23) return null;
    }

    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const handleHourScrollEnd = useCallback((event: any) => {
    if (isRecentering.current) return;
    const offsetY = event.nativeEvent.contentOffset.y;
    const rawIndex = Math.max(0, Math.round(offsetY / ITEM_HEIGHT));
    const clampedIndex = Math.min(rawIndex, repeatedHours.length - 1);
    const hourValue = repeatedHours[clampedIndex];

    if (hourValue !== undefined) {
      if (hourValue !== prevHourRef.current) {
        setSelectedHour(hourValue);
        prevHourRef.current = hourValue;
        triggerHaptic();
      }
      const setNumber = Math.floor(clampedIndex / HOUR_COUNT);
      if (setNumber < HOUR_CENTER_SET - 2 || setNumber > HOUR_CENTER_SET + 2) {
        recenterHour(hourValue);
      } else {
        hourScrollRef.current?.scrollTo({ y: clampedIndex * ITEM_HEIGHT, animated: true });
      }
    }
  }, [recenterHour]);

  const handleMinuteScrollEnd = useCallback((event: any) => {
    if (isRecentering.current) return;
    const offsetY = event.nativeEvent.contentOffset.y;
    const rawIndex = Math.max(0, Math.round(offsetY / ITEM_HEIGHT));
    const clampedIndex = Math.min(rawIndex, repeatedMinutes.length - 1);
    const minuteValue = repeatedMinutes[clampedIndex];

    if (minuteValue !== undefined) {
      if (minuteValue !== prevMinuteRef.current) {
        setSelectedMinute(minuteValue);
        prevMinuteRef.current = minuteValue;
        triggerHaptic();
      }
      const setNumber = Math.floor(clampedIndex / MINUTE_COUNT);
      if (setNumber < MINUTE_CENTER_SET - 2 || setNumber > MINUTE_CENTER_SET + 2) {
        recenterMinute(minuteValue);
      } else {
        minuteScrollRef.current?.scrollTo({ y: clampedIndex * ITEM_HEIGHT, animated: true });
      }
    }
  }, [recenterMinute]);

  const handleHourScrollLive = useCallback((event: any) => {
    if (isRecentering.current) return;
    const offsetY = event.nativeEvent.contentOffset.y;
    const rawIndex = Math.max(0, Math.round(offsetY / ITEM_HEIGHT));
    const clampedIndex = Math.min(rawIndex, repeatedHours.length - 1);
    const hourValue = repeatedHours[clampedIndex];

    if (hourValue !== undefined && hourValue !== prevHourRef.current) {
      setSelectedHour(hourValue);
      prevHourRef.current = hourValue;
      triggerHaptic();
    }
  }, []);

  const handleMinuteScrollLive = useCallback((event: any) => {
    if (isRecentering.current) return;
    const offsetY = event.nativeEvent.contentOffset.y;
    const rawIndex = Math.max(0, Math.round(offsetY / ITEM_HEIGHT));
    const clampedIndex = Math.min(rawIndex, repeatedMinutes.length - 1);
    const minuteValue = repeatedMinutes[clampedIndex];

    if (minuteValue !== undefined && minuteValue !== prevMinuteRef.current) {
      setSelectedMinute(minuteValue);
      prevMinuteRef.current = minuteValue;
      triggerHaptic();
    }
  }, []);

  const formatPreview = () => {
    const period = getPeriodForHour(selectedHour);
    return `${format12Hour(selectedHour)}:${String(selectedMinute).padStart(2, '0')} ${period}`;
  };

  const renderHourColumn = () => (
    <View style={styles.column}>
      <ScrollView
        ref={hourScrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onScroll={handleHourScrollLive}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleHourScrollEnd}
        onScrollEndDrag={handleHourScrollEnd}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={{ height: ITEM_HEIGHT * 2 }} />
        {repeatedHours.map((hour, index) => (
          <TouchableOpacity
            key={index}
            style={styles.item}
            onPress={() => {
              setSelectedHour(hour);
              prevHourRef.current = hour;
              triggerHaptic();
              hourScrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: true });
            }}
          >
            <Text style={[styles.itemText, hour === selectedHour && styles.selectedItemText]}>
              {formatHourLabel(hour)}
            </Text>
          </TouchableOpacity>
        ))}
        <View style={{ height: ITEM_HEIGHT * 2 }} />
      </ScrollView>
    </View>
  );

  const renderMinuteColumn = () => (
    <View style={styles.column}>
      <ScrollView
        ref={minuteScrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onScroll={handleMinuteScrollLive}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleMinuteScrollEnd}
        onScrollEndDrag={handleMinuteScrollEnd}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={{ height: ITEM_HEIGHT * 2 }} />
        {repeatedMinutes.map((minute, index) => (
          <TouchableOpacity
            key={index}
            style={styles.item}
            onPress={() => {
              setSelectedMinute(minute);
              prevMinuteRef.current = minute;
              triggerHaptic();
              minuteScrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: true });
            }}
          >
            <Text style={[styles.itemText, minute === selectedMinute && styles.selectedItemText]}>
              {minute.toString().padStart(2, '0')}
            </Text>
          </TouchableOpacity>
        ))}
        <View style={{ height: ITEM_HEIGHT * 2 }} />
      </ScrollView>
    </View>
  );

  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onCancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.title}>Select Time</Text>
              {mode === 'scroll' && (
                <Text style={styles.previewText}>{formatPreview()}</Text>
              )}
            </View>
            <TouchableOpacity onPress={handleConfirm}>
              <Text style={styles.confirmText}>Done</Text>
            </TouchableOpacity>
          </View>

          {mode === 'scroll' ? (
            <View style={styles.pickerContainer}>
              <View style={styles.selectionIndicator} />
              <View style={styles.columns}>
                {renderHourColumn()}
                <Text style={styles.separator}>:</Text>
                {renderMinuteColumn()}
              </View>
            </View>
          ) : (
            <View style={styles.typeContainer}>
              <Text style={styles.typeLabel}>Enter time</Text>
              <TextInput
                style={styles.typeInput}
                value={typedTime}
                onChangeText={setTypedTime}
                placeholder="12:00 PM"
                placeholderTextColor="#999"
                autoFocus
              />
              <Text style={styles.typeHint}>
                {typedTime && parseTypedTime(typedTime)
                  ? (() => {
                      const t = parseTypedTime(typedTime)!;
                      const [h, m] = t.split(':').map(Number);
                      const hr = h % 12 || 12;
                      const per = h >= 12 ? 'PM' : 'AM';
                      return `${hr}:${String(m).padStart(2, '0')} ${per}`;
                    })()
                  : 'Format: 12:00 PM or 14:30'}
              </Text>
              <TouchableOpacity style={styles.switchToScrollBtn} onPress={() => setMode('scroll')}>
                <Text style={styles.switchToScrollText}>Use scroll picker</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerCenter: {
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  previewText: {
    fontSize: 13,
    color: '#007AFF',
    marginTop: 2,
  },
  cancelText: {
    fontSize: 16,
    color: '#666',
  },
  confirmText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  pickerContainer: {
    height: ITEM_HEIGHT * VISIBLE_ITEMS,
    position: 'relative',
    marginTop: 8,
  },
  selectionIndicator: {
    position: 'absolute',
    top: ITEM_HEIGHT * 2,
    left: 16,
    right: 16,
    height: ITEM_HEIGHT,
    backgroundColor: 'rgba(0, 122, 255, 0.08)',
    borderRadius: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#007AFF',
    zIndex: 1,
    pointerEvents: 'none',
  },
  columns: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    paddingHorizontal: 20,
  },
  column: {
    flex: 1,
    height: '100%',
  },
  separator: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginHorizontal: 8,
  },
  scrollContent: {
    paddingVertical: 0,
  },
  item: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemText: {
    fontSize: 18,
    color: '#999',
  },
  selectedItemText: {
    fontSize: 22,
    fontWeight: '600',
    color: '#333',
  },
  typeContainer: {
    padding: 20,
    alignItems: 'center',
    minHeight: ITEM_HEIGHT * VISIBLE_ITEMS,
    justifyContent: 'center',
  },
  typeLabel: {
    fontSize: 15,
    color: '#666',
    marginBottom: 12,
  },
  typeInput: {
    width: '100%',
    maxWidth: 300,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 20,
    textAlign: 'center',
    color: '#333',
    backgroundColor: '#f8f8f8',
  },
  typeHint: {
    fontSize: 14,
    color: '#007AFF',
    marginTop: 12,
  },
  switchToScrollBtn: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  switchToScrollText: {
    fontSize: 14,
    color: '#666',
    textDecorationLine: 'underline',
  },
});
