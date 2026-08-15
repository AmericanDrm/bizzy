import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { X, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface WorkflowRescheduleModalProps {
  visible: boolean;
  eventTitle: string;
  currentDate: string;
  onConfirm: (newDate: string) => void;
  onCancel: () => void;
}

export default function WorkflowRescheduleModal({
  visible,
  eventTitle,
  currentDate,
  onConfirm,
  onCancel,
}: WorkflowRescheduleModalProps) {
  const { colors, isDark } = useTheme();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const calendarDays = useMemo(() => {
    const { year, month } = viewMonth;
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    return days;
  }, [viewMonth]);

  const monthLabel = new Date(viewMonth.year, viewMonth.month).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const prevMonth = () => {
    setViewMonth((prev) => {
      const m = prev.month - 1;
      return m < 0 ? { year: prev.year - 1, month: 11 } : { year: prev.year, month: m };
    });
  };

  const nextMonth = () => {
    setViewMonth((prev) => {
      const m = prev.month + 1;
      return m > 11 ? { year: prev.year + 1, month: 0 } : { year: prev.year, month: m };
    });
  };

  const handleDayPress = (day: number) => {
    const d = new Date(viewMonth.year, viewMonth.month, day);
    if (d < today) return;
    setSelectedDate(d.toISOString());
  };

  const handleConfirm = () => {
    if (selectedDate) {
      onConfirm(selectedDate);
      setSelectedDate(null);
    }
  };

  const ds = getDynamicStyles(colors, isDark);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={ds.overlay}>
        <View style={ds.modal}>
          <View style={ds.header}>
            <View>
              <Text style={ds.title}>Reschedule Job</Text>
              <Text style={ds.subtitle} numberOfLines={1}>{eventTitle}</Text>
            </View>
            <TouchableOpacity onPress={onCancel} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={ds.monthNav}>
            <TouchableOpacity onPress={prevMonth}>
              <ChevronLeft size={20} color={colors.text} />
            </TouchableOpacity>
            <Text style={ds.monthLabel}>{monthLabel}</Text>
            <TouchableOpacity onPress={nextMonth}>
              <ChevronRight size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={ds.weekRow}>
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
              <Text key={d} style={ds.weekDay}>{d}</Text>
            ))}
          </View>

          <View style={ds.daysGrid}>
            {calendarDays.map((day, i) => {
              if (day === null) return <View key={`e-${i}`} style={ds.dayCell} />;
              const d = new Date(viewMonth.year, viewMonth.month, day);
              const isPast = d < today;
              const isSelected = selectedDate && new Date(selectedDate).toDateString() === d.toDateString();
              const isToday = d.toDateString() === today.toDateString();
              return (
                <TouchableOpacity
                  key={`d-${day}`}
                  style={[ds.dayCell, isSelected && ds.dayCellSelected, isToday && !isSelected && ds.dayCellToday]}
                  onPress={() => handleDayPress(day)}
                  disabled={isPast}
                >
                  <Text style={[ds.dayText, isPast && ds.dayTextPast, isSelected && ds.dayTextSelected, isToday && !isSelected && ds.dayTextToday]}>
                    {day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={ds.footer}>
            <TouchableOpacity style={ds.cancelBtn} onPress={onCancel}>
              <Text style={ds.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[ds.confirmBtn, !selectedDate && ds.confirmBtnDisabled]}
              onPress={handleConfirm}
              disabled={!selectedDate}
            >
              <Text style={ds.confirmText}>Reschedule</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const getDynamicStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    modal: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
      ...Platform.select({
        web: { boxShadow: '0 8px 30px rgba(0,0,0,0.2)' },
        default: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 10 },
      }) as any,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 20,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    subtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
      maxWidth: 240,
    },
    monthNav: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    monthLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    weekRow: {
      flexDirection: 'row',
      marginBottom: 4,
    },
    weekDay: {
      flex: 1,
      textAlign: 'center',
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
      paddingVertical: 4,
    },
    daysGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    dayCell: {
      width: '14.285%' as any,
      aspectRatio: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    dayCellSelected: {
      backgroundColor: colors.primary,
      borderRadius: 20,
    },
    dayCellToday: {
      borderWidth: 1.5,
      borderColor: colors.primary,
      borderRadius: 20,
    },
    dayText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
    },
    dayTextPast: {
      color: colors.textSecondary,
      opacity: 0.4,
    },
    dayTextSelected: {
      color: '#fff',
      fontWeight: '700',
    },
    dayTextToday: {
      color: colors.primary,
      fontWeight: '700',
    },
    footer: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 20,
    },
    cancelBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6',
    },
    cancelText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    confirmBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: 'center',
      backgroundColor: colors.primary,
    },
    confirmBtnDisabled: {
      opacity: 0.5,
    },
    confirmText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#fff',
    },
  });
