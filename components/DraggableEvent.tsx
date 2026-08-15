import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Clock, Repeat, Check, GripVertical, CircleCheck as CheckCircle, CalendarClock } from 'lucide-react-native';
import AddressLink from '@/components/AddressLink';

interface DraggableEventProps {
  event: any;
  colors: any;
  onTap: () => void;
  onLongPress: () => void;
  onDragStart?: (event: any, absoluteX: number, absoluteY: number) => void;
  onDragMove?: (absoluteX: number, absoluteY: number) => void;
  onDragEnd?: (absoluteX: number, absoluteY: number) => void;
  onDragCancel?: () => void;
  formatTime: (time: string) => string;
  formatRecurrence: (event: any) => string | null;
  onMarkAsPaid?: (event: any) => void;
  onCompleteJob?: (event: any) => void;
  onReschedule?: (event: any) => void;
  showCompleteButton?: boolean;
  isDimmed?: boolean;
}

export default function DraggableEvent({
  event,
  colors,
  onTap,
  onLongPress,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
  formatTime,
  formatRecurrence,
  onCompleteJob,
  onReschedule,
  showCompleteButton,
  isDimmed,
}: DraggableEventProps) {
  const cardOpacity = useSharedValue(1);
  const cardScale = useSharedValue(1);
  const isDragActive = useSharedValue(false);

  const cardAnimStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ scale: cardScale.value }],
  }));

  const longPressGesture = Gesture.LongPress()
    .minDuration(500)
    .onStart((e) => {
      isDragActive.value = true;
      cardScale.value = withSpring(0.95, { damping: 15, stiffness: 200 });
      cardOpacity.value = withTiming(0.4, { duration: 150 });
      if (onDragStart) {
        runOnJS(onDragStart)(event, e.absoluteX, e.absoluteY);
      }
    });

  const panGesture = Gesture.Pan()
    .minDistance(0)
    .onUpdate((e) => {
      if (isDragActive.value && onDragMove) {
        runOnJS(onDragMove)(e.absoluteX, e.absoluteY);
      }
    })
    .onEnd((e) => {
      if (isDragActive.value && onDragEnd) {
        runOnJS(onDragEnd)(e.absoluteX, e.absoluteY);
      }
      isDragActive.value = false;
      cardScale.value = withSpring(1, { damping: 15 });
      cardOpacity.value = withTiming(1, { duration: 200 });
    })
    .onFinalize(() => {
      if (isDragActive.value) {
        isDragActive.value = false;
        cardScale.value = withSpring(1, { damping: 15 });
        cardOpacity.value = withTiming(1, { duration: 200 });
        if (onDragCancel) {
          runOnJS(onDragCancel)();
        }
      }
    });

  const composedGesture = Gesture.Simultaneous(longPressGesture, panGesture);

  const statusColor = event.status === 'completed'
    ? '#3dba6f'
    : event.status === 'in_progress'
    ? colors.primary
    : colors.textSecondary;

  const statusLabel = event.status === 'completed'
    ? 'Completed'
    : event.status === 'in_progress'
    ? 'In Progress'
    : 'Upcoming';

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View
        style={[
          styles.eventCard,
          { backgroundColor: colors.inputBackground },
          isDimmed && styles.dimmed,
          cardAnimStyle,
        ]}
      >
        <View style={[styles.stripe, { backgroundColor: statusColor }]} />
        <TouchableOpacity
          onPress={onTap}
          activeOpacity={0.85}
          style={styles.cardContent}
        >
          <View style={styles.eventCardHeader}>
            <Text style={[styles.timeText, { color: colors.textSecondary }]}>
              {formatTime(event.start_time)}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
              <Text style={[styles.statusBadgeText, { color: statusColor }]}>
                {event.payment_status === 'paid' ? 'Paid' : statusLabel}
              </Text>
            </View>
          </View>

          <Text style={[styles.eventTitle, { color: colors.text }]} numberOfLines={1}>
            {event.title}
          </Text>

          {event.client && (
            <Text style={[styles.clientName, { color: colors.textSecondary }]} numberOfLines={1}>
              {event.client.name}
            </Text>
          )}

          {event.description && !event.client ? (
            <Text style={[styles.eventDescription, { color: colors.textSecondary }]} numberOfLines={1}>
              {event.description}
            </Text>
          ) : null}

          {event.location && (
            <View style={styles.locationContainer}>
              <AddressLink
                address={event.location}
                textStyle={[styles.locationText, { color: colors.textSecondary }]}
                numberOfLines={1}
              />
            </View>
          )}

          {event.amount != null && event.amount > 0 && (
            <Text style={[styles.amountText, { color: colors.text }]}>
              ${event.amount.toFixed(2)}
            </Text>
          )}

          {showCompleteButton && event.status !== 'completed' && event.client_id && (
            <View style={styles.actionButtonRow}>
              {onCompleteJob && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.completeButton]}
                  onPress={(e) => {
                    e.stopPropagation();
                    onCompleteJob(event);
                  }}
                  activeOpacity={0.7}
                >
                  <CheckCircle size={13} color="#fff" />
                  <Text style={styles.actionButtonText}>Complete</Text>
                </TouchableOpacity>
              )}
              {onReschedule && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.rescheduleButton]}
                  onPress={(e) => {
                    e.stopPropagation();
                    onReschedule(event);
                  }}
                  activeOpacity={0.7}
                >
                  <CalendarClock size={13} color="#fff" />
                  <Text style={styles.actionButtonText}>Reschedule</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onLongPress}
          style={[styles.dragHandle, { backgroundColor: 'transparent' }]}
          activeOpacity={0.6}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <GripVertical size={14} color={colors.border} />
        </TouchableOpacity>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  eventCard: {
    borderRadius: 8,
    marginBottom: 8,
    flexDirection: 'row',
    overflow: 'hidden',
    alignItems: 'stretch',
  },
  dimmed: {
    opacity: 0.4,
  },
  stripe: {
    width: 3,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
  },
  dragHandle: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: {
    flex: 1,
    padding: 10,
    paddingLeft: 8,
  },
  eventCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  eventTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  recurrenceText: {
    fontSize: 11,
    marginBottom: 3,
  },
  eventDescription: {
    fontSize: 11,
    marginBottom: 3,
  },
  clientName: {
    fontSize: 11,
    marginBottom: 2,
  },
  locationContainer: {
    marginBottom: 3,
  },
  locationText: {
    fontSize: 11,
  },
  amountText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },
  actionButtonRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 6,
    borderRadius: 6,
  },
  completeButton: {
    backgroundColor: '#2D8B57',
  },
  rescheduleButton: {
    backgroundColor: '#1B4D6E',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
});
