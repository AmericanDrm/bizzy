import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { ChevronLeft, ChevronRight, X, Calendar, Clock } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useTheme } from '@/contexts/ThemeContext';

interface EventSummary {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  client?: { name: string } | null;
  payment_status?: string | null;
}

interface ScheduleCalendarPickerModalProps {
  visible: boolean;
  selectedDate: string;
  onConfirm: (date: string) => void;
  onCancel: () => void;
  title?: string;
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getEventDateKey(iso: string): string {
  return iso.split('T')[0];
}

export default function ScheduleCalendarPickerModal({
  visible,
  selectedDate,
  onConfirm,
  onCancel,
  title = 'Select Job Date',
}: ScheduleCalendarPickerModalProps) {
  const { currentOrganization } = useOrganization();
  const { colors, isDark } = useTheme();

  const today = new Date();
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  const parseInitial = () => {
    if (selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
      const [y, m, d] = selectedDate.split('-').map(Number);
      return { year: y, month: m - 1, day: d };
    }
    return { year: today.getFullYear(), month: today.getMonth(), day: today.getDate() };
  };

  const initial = parseInitial();
  const [viewYear, setViewYear] = useState(initial.year);
  const [viewMonth, setViewMonth] = useState(initial.month);
  const [pickedDateStr, setPickedDateStr] = useState(selectedDate || todayStr);
  const [dayEvents, setDayEvents] = useState<Record<string, EventSummary[]>>({});
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [selectedDayForPreview, setSelectedDayForPreview] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      const parsed = parseInitial();
      setViewYear(parsed.year);
      setViewMonth(parsed.month);
      setPickedDateStr(selectedDate || todayStr);
      setSelectedDayForPreview(null);
    }
  }, [visible, selectedDate]);

  const fetchMonthEvents = useCallback(async (year: number, month: number) => {
    if (!currentOrganization?.id) return;
    setLoadingEvents(true);
    try {
      const firstDay = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const lastDayNum = getDaysInMonth(year, month);
      const lastDay = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDayNum).padStart(2, '0')}`;

      const { data } = await supabase
        .from('schedule_events')
        .select('id, title, start_time, end_time, payment_status, client:clients(name)')
        .eq('organization_id', currentOrganization.id)
        .gte('start_time', `${firstDay}T00:00:00`)
        .lte('start_time', `${lastDay}T23:59:59`)
        .order('start_time', { ascending: true });

      const grouped: Record<string, EventSummary[]> = {};
      for (const ev of data || []) {
        const key = getEventDateKey(ev.start_time);
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(ev as EventSummary);
      }
      setDayEvents(grouped);
    } finally {
      setLoadingEvents(false);
    }
  }, [currentOrganization?.id]);

  useEffect(() => {
    if (visible) {
      fetchMonthEvents(viewYear, viewMonth);
    }
  }, [visible, viewYear, viewMonth, fetchMonthEvents]);

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
    setSelectedDayForPreview(null);
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
    setSelectedDayForPreview(null);
  };

  const handleDayPress = (dateStr: string) => {
    setPickedDateStr(dateStr);
    setSelectedDayForPreview(dateStr);
  };

  const handleConfirm = () => {
    onConfirm(pickedDateStr);
  };

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDayOfWeek = getFirstDayOfMonth(viewYear, viewMonth);
  const totalCells = Math.ceil((firstDayOfWeek + daysInMonth) / 7) * 7;

  const previewEvents = selectedDayForPreview ? (dayEvents[selectedDayForPreview] || []) : [];

  const s = makeStyles(colors, isDark);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onCancel}
    >
      <View style={s.overlay}>
        <View style={s.container}>
          <View style={s.header}>
            <TouchableOpacity onPress={onCancel} style={s.headerBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            <View style={s.headerCenter}>
              <Calendar size={16} color={colors.primary} />
              <Text style={s.headerTitle}>{title}</Text>
            </View>
            <TouchableOpacity onPress={handleConfirm} style={s.confirmBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <LinearGradient colors={['#1B4D6E', '#245d82']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.confirmBtnGradient}>
                <Text style={s.confirmText}>Select</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <View style={s.monthNav}>
            <TouchableOpacity onPress={prevMonth} style={s.navBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <ChevronLeft size={22} color={colors.text} />
            </TouchableOpacity>
            <Text style={s.monthTitle}>{MONTHS[viewMonth]} {viewYear}</Text>
            {loadingEvents ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 8 }} />
            ) : null}
            <TouchableOpacity onPress={nextMonth} style={s.navBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <ChevronRight size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={s.dayLabels}>
            {DAYS_OF_WEEK.map(d => (
              <Text key={d} style={s.dayLabel}>{d}</Text>
            ))}
          </View>

          <View style={s.grid}>
            {Array.from({ length: totalCells }).map((_, idx) => {
              const dayNum = idx - firstDayOfWeek + 1;
              const isInMonth = dayNum >= 1 && dayNum <= daysInMonth;
              const dateStr = isInMonth ? toDateStr(viewYear, viewMonth, dayNum) : '';
              const isToday = dateStr === todayStr;
              const isPicked = dateStr === pickedDateStr;
              const isPreview = dateStr === selectedDayForPreview;
              const eventsOnDay = dateStr ? (dayEvents[dateStr] || []) : [];
              const hasEvents = eventsOnDay.length > 0;
              const isBusy = eventsOnDay.length >= 3;

              return (
                <TouchableOpacity
                  key={idx}
                  style={[
                    s.dayCell,
                    !isInMonth && s.dayCellEmpty,
                    isToday && !isPicked && s.dayCellToday,
                    isPicked && s.dayCellPicked,
                    isPreview && !isPicked && s.dayCellPreview,
                  ]}
                  onPress={() => isInMonth && handleDayPress(dateStr)}
                  activeOpacity={isInMonth ? 0.7 : 1}
                  disabled={!isInMonth}
                >
                  {isInMonth && (
                    <>
                      <Text style={[
                        s.dayNum,
                        isToday && !isPicked && s.dayNumToday,
                        isPicked && s.dayNumPicked,
                      ]}>
                        {dayNum}
                      </Text>
                      {hasEvents && (
                        <View style={s.dotRow}>
                          {eventsOnDay.slice(0, 3).map((_, di) => (
                            <View
                              key={di}
                              style={[
                                s.dot,
                                isPicked && s.dotPicked,
                                isBusy && !isPicked && s.dotBusy,
                              ]}
                            />
                          ))}
                          {eventsOnDay.length > 3 && (
                            <Text style={[s.dotMore, isPicked && s.dotMorePicked]}>
                              +{eventsOnDay.length - 3}
                            </Text>
                          )}
                        </View>
                      )}
                    </>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {selectedDayForPreview && (
            <View style={s.previewSection}>
              <View style={s.previewHeader}>
                <Clock size={14} color={colors.textSecondary} />
                <Text style={s.previewTitle}>
                  {previewEvents.length === 0
                    ? 'No jobs scheduled'
                    : `${previewEvents.length} job${previewEvents.length > 1 ? 's' : ''} on this day`}
                </Text>
              </View>
              {previewEvents.length > 0 && (
                <ScrollView style={s.previewList} showsVerticalScrollIndicator={false}>
                  {previewEvents.map(ev => (
                    <View key={ev.id} style={s.previewItem}>
                      <View style={[s.previewDot, ev.payment_status === 'paid' && s.previewDotPaid]} />
                      <View style={s.previewItemContent}>
                        <Text style={s.previewItemTitle} numberOfLines={1}>{ev.title}</Text>
                        <Text style={s.previewItemTime}>
                          {formatTime(ev.start_time)} – {formatTime(ev.end_time)}
                          {ev.client?.name ? ` · ${ev.client.name}` : ''}
                        </Text>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          )}

          <View style={s.legend}>
            <View style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: colors.primary }]} />
              <Text style={s.legendText}>Scheduled jobs</Text>
            </View>
            <View style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: '#ef4444' }]} />
              <Text style={s.legendText}>3+ jobs (busy)</Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'flex-end',
    },
    container: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: 32,
      maxHeight: '92%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerBtn: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerCenter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
    },
    confirmBtn: {
      borderRadius: 8,
      overflow: 'hidden' as const,
    },
    confirmBtnGradient: {
      paddingHorizontal: 14,
      paddingVertical: 7,
    },
    confirmText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#fff',
    },
    monthNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    navBtn: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 18,
      backgroundColor: colors.inputBackground,
    },
    monthTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      flex: 1,
      textAlign: 'center',
    },
    dayLabels: {
      flexDirection: 'row',
      paddingHorizontal: 8,
      marginBottom: 4,
    },
    dayLabel: {
      flex: 1,
      textAlign: 'center',
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
      paddingVertical: 4,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: 8,
    },
    dayCell: {
      width: `${100 / 7}%`,
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 2,
      borderRadius: 8,
      marginBottom: 2,
    },
    dayCellEmpty: {
      opacity: 0,
    },
    dayCellToday: {
      borderWidth: 2,
      borderColor: colors.primary,
    },
    dayCellPicked: {
      backgroundColor: colors.primary,
    },
    dayCellPreview: {
      backgroundColor: colors.primaryLight,
    },
    dayNum: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
    },
    dayNumToday: {
      color: colors.primary,
      fontWeight: '700',
    },
    dayNumPicked: {
      color: '#fff',
      fontWeight: '700',
    },
    dotRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 2,
      gap: 2,
    },
    dot: {
      width: 5,
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.primary,
    },
    dotPicked: {
      backgroundColor: 'rgba(255,255,255,0.8)',
    },
    dotBusy: {
      backgroundColor: '#ef4444',
    },
    dotMore: {
      fontSize: 9,
      fontWeight: '700',
      color: colors.primary,
    },
    dotMorePicked: {
      color: 'rgba(255,255,255,0.85)',
    },
    previewSection: {
      marginHorizontal: 16,
      marginTop: 12,
      backgroundColor: colors.inputBackground,
      borderRadius: 12,
      padding: 12,
      maxHeight: 160,
    },
    previewHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 8,
    },
    previewTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    previewList: {
      maxHeight: 110,
    },
    previewItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      marginBottom: 8,
    },
    previewDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
      marginTop: 4,
    },
    previewDotPaid: {
      backgroundColor: '#10b981',
    },
    previewItemContent: {
      flex: 1,
    },
    previewItemTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    previewItemTime: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 1,
    },
    legend: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 20,
      paddingHorizontal: 16,
      paddingTop: 12,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    legendDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    legendText: {
      fontSize: 12,
      color: colors.textSecondary,
    },
  });
}
