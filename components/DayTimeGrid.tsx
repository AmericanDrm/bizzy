import React, { useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Move } from 'lucide-react-native';

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

function formatEventTime(iso: string) {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h < 12 ? 'AM' : 'PM';
  const hh = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hh}${m > 0 ? `:${String(m).padStart(2, '0')}` : ':00'} ${ampm}`;
}

interface ScheduleEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  client?: { name: string } | null;
  location?: string | null;
  payment_status?: string | null;
  amount?: number | null;
  is_recurring?: boolean;
  description?: string | null;
  status?: string | null;
  service_scope?: string | null;
}

interface DayTimeGridProps {
  date: Date;
  events: ScheduleEvent[];
  colors: any;
  onEventTap: (event: ScheduleEvent) => void;
  onEventLongPress?: (event: ScheduleEvent) => void;
  draggingEvent?: ScheduleEvent | null;
  isDragMode?: boolean;
  onTimeSlotSelect?: (hours: number, minutes: number) => void;
  isDropTarget?: boolean;
  formatTime: (iso: string) => string;
  scrollRef?: React.RefObject<ScrollView> | React.MutableRefObject<any>;
}

function getStatusConfig(event: ScheduleEvent, colors: any) {
  if (event.payment_status === 'paid') {
    return { label: 'PAID', color: '#22C55E', bg: 'rgba(34,197,94,0.15)' };
  }
  switch (event.status) {
    case 'completed':
      return { label: 'COMPLETED', color: '#22C55E', bg: 'rgba(34,197,94,0.15)' };
    case 'in_progress':
      return { label: 'IN PROGRESS', color: colors.primary || '#3B82F6', bg: (colors.primary || '#3B82F6') + '22' };
    default:
      return { label: 'UPCOMING', color: colors.textSecondary || '#9CA3AF', bg: 'rgba(156,163,175,0.12)' };
  }
}

function getSubtitle(event: ScheduleEvent) {
  if (event.service_scope) return event.service_scope;
  if (event.description) return event.description;
  if (event.location) return event.location;
  return null;
}

export default function DayTimeGrid({
  date,
  events,
  colors,
  onEventTap,
  onEventLongPress,
  isDragMode,
  isDropTarget,
  formatTime,
  scrollRef: externalScrollRef,
}: DayTimeGridProps) {
  const internalScrollRef = useRef<ScrollView>(null);
  const scrollRef = externalScrollRef || internalScrollRef;

  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const isToday = now.toISOString().split('T')[0] === date.toISOString().split('T')[0];

  const dateLabel = date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background || colors.surface }]}>
      {isDragMode && isDropTarget && (
        <View style={[styles.dropBanner, { backgroundColor: colors.primary + '22', borderColor: colors.primary }]}>
          <Move size={14} color={colors.primary} />
          <Text style={[styles.dropBannerText, { color: colors.primary }]}>Drop here to reschedule</Text>
        </View>
      )}

      <View style={[styles.dateLabelRow, { borderBottomColor: colors.border }]}>
        <Text style={[styles.dateLabelText, { color: colors.textSecondary }]}>
          {dateLabel}
        </Text>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          sortedEvents.length === 0 && styles.scrollContentEmpty,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {sortedEvents.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No jobs scheduled</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Tap + to add a job for this day
            </Text>
          </View>
        ) : (
          sortedEvents.map((event, index) => {
            const eventMinutes =
              new Date(event.start_time).getHours() * 60 +
              new Date(event.start_time).getMinutes();
            const showNowLine =
              isToday &&
              index === 0 &&
              nowMinutes < eventMinutes;
            const showNowLineBetween =
              isToday &&
              index > 0 &&
              (() => {
                const prevMinutes =
                  new Date(sortedEvents[index - 1].start_time).getHours() * 60 +
                  new Date(sortedEvents[index - 1].start_time).getMinutes();
                return nowMinutes >= prevMinutes && nowMinutes < eventMinutes;
              })();

            const accentColor = getEventColor(event.id);
            const status = getStatusConfig(event, colors);
            const subtitle = getSubtitle(event);

            return (
              <React.Fragment key={event.id}>
                {(showNowLine || showNowLineBetween) && (
                  <View style={styles.nowLineRow}>
                    <View style={[styles.nowDot, { backgroundColor: colors.error || '#EF4444' }]} />
                    <View style={[styles.nowLineBar, { backgroundColor: colors.error || '#EF4444' }]} />
                    <Text style={[styles.nowLabel, { color: colors.error || '#EF4444' }]}>Now</Text>
                  </View>
                )}
                <TouchableOpacity
                  style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => !isDragMode && onEventTap(event)}
                  onLongPress={() => onEventLongPress?.(event)}
                  delayLongPress={400}
                  activeOpacity={0.75}
                >
                  <View style={[styles.accentBar, { backgroundColor: accentColor }]} />
                  <View style={styles.cardBody}>
                    <View style={styles.cardTopRow}>
                      <Text style={[styles.timeText, { color: colors.textSecondary }]}>
                        {formatEventTime(event.start_time)}
                      </Text>
                      <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                        <Text style={[styles.statusText, { color: status.color }]}>
                          {status.label}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.titleText, { color: colors.text }]} numberOfLines={1}>
                      {event.title}
                    </Text>
                    {subtitle ? (
                      <Text style={[styles.subtitleText, { color: colors.textSecondary }]} numberOfLines={1}>
                        {subtitle}
                      </Text>
                    ) : event.client?.name ? (
                      <Text style={[styles.subtitleText, { color: colors.textSecondary }]} numberOfLines={1}>
                        {event.client.name}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              </React.Fragment>
            );
          })
        )}

        {isToday && sortedEvents.length > 0 && (() => {
          const lastEvent = sortedEvents[sortedEvents.length - 1];
          const lastMinutes =
            new Date(lastEvent.start_time).getHours() * 60 +
            new Date(lastEvent.start_time).getMinutes();
          if (nowMinutes >= lastMinutes) {
            return (
              <View style={styles.nowLineRow}>
                <View style={[styles.nowDot, { backgroundColor: colors.error || '#EF4444' }]} />
                <View style={[styles.nowLineBar, { backgroundColor: colors.error || '#EF4444' }]} />
                <Text style={[styles.nowLabel, { color: colors.error || '#EF4444' }]}>Now</Text>
              </View>
            );
          }
          return null;
        })()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  dropBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  dropBannerText: {
    fontSize: 13,
    fontWeight: '600',
  },
  dateLabelRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dateLabelText: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 80,
    gap: 10,
  },
  scrollContentEmpty: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 60,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
  },
  nowLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginVertical: 2,
  },
  nowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  nowLineBar: {
    flex: 1,
    height: 1.5,
    opacity: 0.8,
  },
  nowLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  card: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    minHeight: 78,
  },
  accentBar: {
    width: 4,
    alignSelf: 'stretch',
  },
  cardBody: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 3,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  timeText: {
    fontSize: 13,
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  titleText: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  subtitleText: {
    fontSize: 13,
    lineHeight: 17,
  },
});
