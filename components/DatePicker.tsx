import React, { useState, useEffect, useRef } from 'react';
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
import { useTheme } from '@/contexts/ThemeContext';

interface DatePickerProps {
  visible: boolean;
  value: string;
  onConfirm: (date: string) => void;
  onCancel: () => void;
  title?: string;
  initialMode?: 'scroll' | 'type';
}

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);

const getDaysInMonth = (month: number, year: number) => {
  return new Date(year, month, 0).getDate();
};

const triggerHaptic = () => {
  if (Platform.OS !== 'web') {
    Haptics.selectionAsync();
  }
};

export default function DatePicker({ visible, value, onConfirm, onCancel, title = 'Select Date', initialMode = 'scroll' }: DatePickerProps) {
  const { colors, isDark } = useTheme();
  const s = makeStyles(colors, isDark);

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(1);
  const [selectedDay, setSelectedDay] = useState(1);
  const [mode, setMode] = useState<'scroll' | 'type'>('scroll');
  const [typedDate, setTypedDate] = useState('');
  const monthScrollRef = useRef<ScrollView>(null);
  const dayScrollRef = useRef<ScrollView>(null);
  const yearScrollRef = useRef<ScrollView>(null);

  const prevMonthRef = useRef(selectedMonth);
  const prevDayRef = useRef(selectedDay);
  const prevYearRef = useRef(selectedYear);

  const daysInMonth = getDaysInMonth(selectedMonth, selectedYear);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  useEffect(() => {
    if (visible && value) {
      setMode(initialMode);
      const parts = value.split('-').map(Number);
      if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
        const [y, m, d] = parts;
        setSelectedYear(y);
        setSelectedMonth(m);
        setSelectedDay(Math.min(d, getDaysInMonth(m, y)));
        setTypedDate(value);
        prevMonthRef.current = m;
        prevDayRef.current = Math.min(d, getDaysInMonth(m, y));
        prevYearRef.current = y;

        setTimeout(() => {
          const yearIdx = YEARS.indexOf(y);
          if (yearIdx >= 0) {
            yearScrollRef.current?.scrollTo({ y: yearIdx * ITEM_HEIGHT, animated: false });
          }
          monthScrollRef.current?.scrollTo({ y: (m - 1) * ITEM_HEIGHT, animated: false });
          dayScrollRef.current?.scrollTo({ y: (Math.min(d, getDaysInMonth(m, y)) - 1) * ITEM_HEIGHT, animated: false });
        }, 100);
      }
    }
  }, [visible, value]);

  useEffect(() => {
    if (selectedDay > daysInMonth) {
      setSelectedDay(daysInMonth);
    }
  }, [selectedMonth, selectedYear, daysInMonth]);

  const handleConfirm = () => {
    if (mode === 'type') {
      const parts = typedDate.split('-').map(Number);
      if (parts.length === 3 && parts[0] > 1900 && parts[1] >= 1 && parts[1] <= 12 && parts[2] >= 1 && parts[2] <= 31) {
        const [y, m, d] = parts;
        const maxDay = getDaysInMonth(m, y);
        onConfirm(`${y}-${String(m).padStart(2, '0')}-${String(Math.min(d, maxDay)).padStart(2, '0')}`);
        return;
      }
    }
    const dateString = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
    onConfirm(dateString);
  };

  const handleScroll = (event: any, type: 'month' | 'day' | 'year') => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const index = Math.round(offsetY / ITEM_HEIGHT);

    if (type === 'month') {
      const newMonth = index + 1;
      if (newMonth >= 1 && newMonth <= 12 && newMonth !== prevMonthRef.current) {
        setSelectedMonth(newMonth);
        prevMonthRef.current = newMonth;
        triggerHaptic();
      }
    } else if (type === 'day') {
      const newDay = index + 1;
      if (newDay >= 1 && newDay <= daysInMonth && newDay !== prevDayRef.current) {
        setSelectedDay(newDay);
        prevDayRef.current = newDay;
        triggerHaptic();
      }
    } else if (type === 'year') {
      const newYear = YEARS[index];
      if (newYear && newYear !== prevYearRef.current) {
        setSelectedYear(newYear);
        prevYearRef.current = newYear;
        triggerHaptic();
      }
    }
  };

  const renderColumn = (
    items: (number | string)[],
    selectedValue: number | string,
    scrollRef: React.RefObject<ScrollView | null>,
    type: 'month' | 'day' | 'year',
    formatter?: (val: number | string) => string
  ) => (
    <View style={s.column}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onScroll={(e) => handleScroll(e, type)}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => handleScroll(e, type)}
        contentContainerStyle={s.scrollContent}
      >
        <View style={{ height: ITEM_HEIGHT * 2 }} />
        {items.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={s.item}
            onPress={() => {
              if (type === 'month') {
                setSelectedMonth(item as number);
                prevMonthRef.current = item as number;
              } else if (type === 'day') {
                setSelectedDay(item as number);
                prevDayRef.current = item as number;
              } else if (type === 'year') {
                setSelectedYear(item as number);
                prevYearRef.current = item as number;
              }
              triggerHaptic();
              scrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: true });
            }}
          >
            <Text style={[s.itemText, item === selectedValue && s.selectedItemText]}>
              {formatter ? formatter(item) : item}
            </Text>
          </TouchableOpacity>
        ))}
        <View style={{ height: ITEM_HEIGHT * 2 }} />
      </ScrollView>
    </View>
  );

  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onCancel}>
      <View style={s.overlay}>
        <View style={s.container} data-date-picker-mode>
          <View style={s.header}>
            <TouchableOpacity onPress={onCancel}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={s.title}>{title}</Text>
            <TouchableOpacity onPress={handleConfirm}>
              <Text style={s.confirmText}>Done</Text>
            </TouchableOpacity>
          </View>

          <View style={s.modeToggle}>
            <TouchableOpacity
              style={[s.modeButton, mode === 'scroll' && s.modeButtonActive]}
              onPress={() => setMode('scroll')}
            >
              <Text style={[s.modeButtonText, mode === 'scroll' && s.modeButtonTextActive]}>Scroll</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.modeButton, mode === 'type' && s.modeButtonActive]}
              onPress={() => setMode('type')}
            >
              <Text style={[s.modeButtonText, mode === 'type' && s.modeButtonTextActive]}>Type</Text>
            </TouchableOpacity>
          </View>

          {mode === 'scroll' ? (
            <View style={s.pickerContainer}>
              <View style={s.selectionIndicator} />
              <View style={s.columns}>
                {renderColumn(
                  Array.from({ length: 12 }, (_, i) => i + 1),
                  selectedMonth,
                  monthScrollRef,
                  'month',
                  (val) => MONTHS[(val as number) - 1]
                )}
                {renderColumn(days, selectedDay, dayScrollRef, 'day', (val) => String(val).padStart(2, '0'))}
                {renderColumn(YEARS, selectedYear, yearScrollRef, 'year')}
              </View>
            </View>
          ) : (
            <View style={s.typeContainer}>
              <Text style={s.typeLabel}>Enter date (YYYY-MM-DD)</Text>
              <TextInput
                style={s.typeInput}
                value={typedDate}
                onChangeText={setTypedDate}
                placeholder="2025-01-15"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numbers-and-punctuation"
                autoFocus
              />
              <Text style={s.typeHint}>
                {typedDate && /^\d{4}-\d{2}-\d{2}$/.test(typedDate)
                  ? (() => {
                      const d = new Date(typedDate + 'T00:00:00');
                      return isNaN(d.getTime()) ? 'Invalid date' : d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                    })()
                  : 'Format: YYYY-MM-DD'}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    container: {
      backgroundColor: colors.surface,
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
      borderBottomColor: colors.border,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    cancelText: {
      fontSize: 16,
      color: colors.textSecondary,
    },
    confirmText: {
      fontSize: 16,
      color: colors.primary,
      fontWeight: '600',
    },
    modeToggle: {
      flexDirection: 'row',
      marginHorizontal: 20,
      marginTop: 12,
      backgroundColor: colors.inputBackground,
      borderRadius: 8,
      padding: 3,
    },
    modeButton: {
      flex: 1,
      paddingVertical: 8,
      alignItems: 'center',
      borderRadius: 6,
    },
    modeButtonActive: {
      backgroundColor: colors.surface,
      shadowColor: isDark ? '#000' : '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0.3 : 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    modeButtonText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    modeButtonTextActive: {
      color: colors.text,
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
      backgroundColor: colors.primary + '14',
      borderRadius: 10,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.primary,
      zIndex: 1,
      pointerEvents: 'none',
    },
    columns: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      paddingHorizontal: 12,
    },
    column: {
      flex: 1,
      height: '100%',
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
      color: colors.textSecondary,
    },
    selectedItemText: {
      fontSize: 22,
      fontWeight: '600',
      color: colors.text,
    },
    typeContainer: {
      padding: 20,
      alignItems: 'center',
      minHeight: ITEM_HEIGHT * VISIBLE_ITEMS,
      justifyContent: 'center',
    },
    typeLabel: {
      fontSize: 15,
      color: colors.textSecondary,
      marginBottom: 12,
    },
    typeInput: {
      width: '100%',
      maxWidth: 300,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 20,
      textAlign: 'center',
      color: colors.text,
      backgroundColor: colors.inputBackground,
    },
    typeHint: {
      fontSize: 14,
      color: colors.primary,
      marginTop: 12,
    },
  });
}
