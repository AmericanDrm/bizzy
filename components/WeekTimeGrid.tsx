import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

const HOUR_HEIGHT = 56;
const START_HOUR = 6;
const END_HOUR = 21;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
const TIME_LABEL_WIDTH = 44;

const EVENT_COLORS = [
  '#1B6E8E',
  '#2E7D52',
  '#C05621',
  '#7B341E',
  '#B7791F',
  '#2C7A7B',
  '#C53030',
  '#2B6CB0',
  '#4A6741',
  '#276749',
];

function getEventColor(eventId: string) {
  const baseId = eventId.replace(/-\d{4}-\d{2}-\d{2}$/, '');
  let hash = 0;
  for (let i = 0; i < baseId.length; i++) {
    hash = baseId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return EVENT_COLORS[Math.abs(hash) % EVENT_COLORS.length];
}

function formatHour(h: number) {
  if (h === 0) return '12a';
  if (h === 12) return '12p';
  return h < 12 ? `${h}a` : `${h - 12}p`;
}

function timeToMinutes(iso: string) {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

function minutesToY(minutes: number) {
  const clamped = Math.max(START_HOUR * 60, Math.min(END_HOUR * 60, minutes));
  return ((clamped - START_HOUR * 60) / 60) * HOUR_HEIGHT;
}

function minutesToHeight(startMin: number, endMin: number) {
  return (Math.max(30, endMin - startMin) / 60) * HOUR_HEIGHT;
}

function formatTimeShort(iso: string) {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h < 12 ? 'a' : 'p';
  const hh = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hh}${m > 0 ? `:${String(m).padStart(2, '0')}` : ''}${ampm}`;
}

interface ScheduleEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  client?: { name: string } | null;
  payment_status?: string | null;
  amount?: number | null;
  is_recurring?: boolean;
  status?: string | null;
}

interface WeekTimeGridProps {
  weekStart: Date;
  events: ScheduleEvent[];
  colors: any;
  onEventTap: (event: ScheduleEvent) => void;
  onDayTap: (date: Date) => void;
  selectedDate?: Date | null;
}

function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function getEventsForDay(events: ScheduleEvent[], date: Date): ScheduleEvent[] {
  const dateStr = date.toISOString().split('T')[0];
  return events.filter((e) => {
    const eDate = new Date(e.start_time).toISOString().split('T')[0];
    return eDate === dateStr;
  });
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function WeekTimeGrid({
  weekStart,
  events,
  colors,
  onEventTap,
  onDayTap,
  selectedDate,
}: WeekTimeGridProps) {
  const days = getWeekDays(weekStart);
  const today = new Date().toISOString().split('T')[0];
  const totalHeight = HOURS.length * HOUR_HEIGHT;
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const isCurrentWeek = days.some((d) => d.toISOString().split('T')[0] === today);

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <View style={[styles.headerRow, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <View style={{ width: TIME_LABEL_WIDTH }} />
        {days.map((day, i) => {
          const dateStr = day.toISOString().split('T')[0];
          const isToday = dateStr === today;
          const isSel = selectedDate && selectedDate.toISOString().split('T')[0] === dateStr;
          return (
            <TouchableOpacity
              key={i}
              style={styles.dayHeaderCell}
              onPress={() => onDayTap(day)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.dayHeaderLabel,
                { color: isToday ? colors.primary : colors.textSecondary },
              ]}>
                {DAY_LABELS[day.getDay()]}
              </Text>
              <View style={[
                styles.dayHeaderNumber,
                isToday && { backgroundColor: colors.primary },
                isSel && !isToday && { backgroundColor: (colors.primary || '#3B82F6') + '30' },
              ]}>
                <Text style={[
                  styles.dayHeaderNumberText,
                  { color: isToday ? '#fff' : isSel ? colors.primary : colors.text },
                ]}>
                  {day.getDate()}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.grid, { height: totalHeight }]}>
          <View style={styles.timeColumn}>
            {HOURS.map((hour) => (
              <View
                key={hour}
                style={[styles.hourLabelRow, { top: (hour - START_HOUR) * HOUR_HEIGHT }]}
              >
                <Text style={[styles.hourLabel, { color: colors.textSecondary }]}>
                  {formatHour(hour)}
                </Text>
              </View>
            ))}
          </View>

          {days.map((day, dayIndex) => {
            const dateStr = day.toISOString().split('T')[0];
            const isToday = dateStr === today;
            const dayEvents = getEventsForDay(events, day);

            return (
              <View
                key={dayIndex}
                style={[
                  styles.dayColumn,
                  isToday && { backgroundColor: (colors.primary || '#3B82F6') + '08' },
                ]}
              >
                {HOURS.map((hour) => (
                  <View
                    key={hour}
                    style={[
                      styles.hourCell,
                      { top: (hour - START_HOUR) * HOUR_HEIGHT },
                    ]}
                  />
                ))}

                {isCurrentWeek && isToday && nowMinutes >= START_HOUR * 60 && nowMinutes <= END_HOUR * 60 && (
                  <View
                    style={[
                      styles.nowLine,
                      { top: minutesToY(nowMinutes), backgroundColor: colors.error || '#EF4444' },
                    ]}
                  >
                    <View style={[styles.nowDot, { backgroundColor: colors.error || '#EF4444' }]} />
                  </View>
                )}

                {dayEvents.map((event) => {
                  const startMin = timeToMinutes(event.start_time);
                  const endMin = timeToMinutes(event.end_time);
                  const y = minutesToY(startMin);
                  const h = minutesToHeight(startMin, endMin);
                  const color = getEventColor(event.id);

                  return (
                    <TouchableOpacity
                      key={event.id}
                      style={[
                        styles.eventBlock,
                        {
                          top: y,
                          height: Math.max(h, 22),
                          backgroundColor: color + '28',
                          borderLeftColor: color,
                        },
                      ]}
                      onPress={() => onEventTap(event)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.eventTitle, { color: color }]} numberOfLines={h > 40 ? 2 : 1}>
                        {event.title}
                      </Text>
                      {h > 34 && (
                        <Text style={[styles.eventTime, { color: color + 'BB' }]} numberOfLines={1}>
                          {formatTimeShort(event.start_time)}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 10,
    paddingTop: 6,
  },
  dayHeaderCell: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
  },
  dayHeaderLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dayHeaderNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayHeaderNumberText: {
    fontSize: 13,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  grid: {
    flexDirection: 'row',
    position: 'relative',
  },
  timeColumn: {
    width: TIME_LABEL_WIDTH,
    position: 'relative',
  },
  hourLabelRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: HOUR_HEIGHT,
    alignItems: 'flex-end',
    paddingRight: 6,
    paddingTop: 2,
  },
  hourLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
  dayColumn: {
    flex: 1,
    position: 'relative',
  },
  hourCell: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: HOUR_HEIGHT,
  },
  nowLine: {
    position: 'absolute',
    left: -4,
    right: 0,
    height: 2,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  nowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: -4,
    position: 'absolute',
    left: 0,
    top: -3,
  },
  eventBlock: {
    position: 'absolute',
    left: 2,
    right: 2,
    borderRadius: 4,
    borderLeftWidth: 3,
    paddingHorizontal: 4,
    paddingVertical: 2,
    overflow: 'hidden',
    zIndex: 5,
  },
  eventTitle: {
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 13,
  },
  eventTime: {
    fontSize: 9,
    marginTop: 1,
  },
});
