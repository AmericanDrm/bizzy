import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { X, ChevronUp, ChevronDown, Move, TriangleAlert as AlertTriangle, Clock, Car } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import DayTimeGrid from './DayTimeGrid';

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
}

interface DragDropDayPanelProps {
  visible: boolean;
  draggingEvent: ScheduleEvent | null;
  targetDate: Date | null;
  existingEvents: ScheduleEvent[];
  initialTime: { hours: number; minutes: number };
  colors: any;
  onConfirm: (hours: number, minutes: number) => void;
  onCancel: () => void;
  formatTime: (iso: string) => string;
  travelBufferMinutes?: number;
}

const START_HOUR = 6;
const HOUR_HEIGHT = 64;

function getBaseEventId(id: string): string {
  const datePattern = /-\d{4}-\d{2}-\d{2}$/;
  return datePattern.test(id) ? id.replace(datePattern, '') : id;
}

function timeToMinutes(iso: string) {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

function formatTimeDisplay(hours: number, minutes: number) {
  const ampm = hours < 12 ? 'AM' : 'PM';
  const h = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${h}:${String(minutes).padStart(2, '0')} ${ampm}`;
}

function detectConflicts(
  draggingEvent: ScheduleEvent,
  targetDate: Date,
  hours: number,
  minutes: number,
  existingEvents: ScheduleEvent[]
): ScheduleEvent[] {
  const origStart = new Date(draggingEvent.start_time);
  const origEnd = new Date(draggingEvent.end_time);
  const duration = origEnd.getTime() - origStart.getTime();

  const newStart = new Date(targetDate);
  newStart.setHours(hours, minutes, 0, 0);
  const newEnd = new Date(newStart.getTime() + duration);

  const newStartMin = newStart.getHours() * 60 + newStart.getMinutes();
  const newEndMin = newEnd.getHours() * 60 + newEnd.getMinutes();

  const dragBaseId = getBaseEventId(draggingEvent.id);

  return existingEvents.filter((e) => {
    if (getBaseEventId(e.id) === dragBaseId) return false;
    const eStart = timeToMinutes(e.start_time);
    const eEnd = timeToMinutes(e.end_time);
    return newStartMin < eEnd && newEndMin > eStart;
  });
}

function getPreviewEndTime(
  draggingEvent: ScheduleEvent,
  hours: number,
  minutes: number
): string {
  const origStart = new Date(draggingEvent.start_time);
  const origEnd = new Date(draggingEvent.end_time);
  const duration = origEnd.getTime() - origStart.getTime();
  const durationHours = Math.floor(duration / 3600000);
  const durationMins = Math.floor((duration % 3600000) / 60000);
  const endH = hours + durationHours + Math.floor((minutes + durationMins) / 60);
  const endM = (minutes + durationMins) % 60;
  return formatTimeDisplay(endH % 24, endM);
}

function getDurationDisplay(draggingEvent: ScheduleEvent): string {
  const origStart = new Date(draggingEvent.start_time);
  const origEnd = new Date(draggingEvent.end_time);
  const durationMs = origEnd.getTime() - origStart.getTime();
  const hrs = Math.floor(durationMs / 3600000);
  const mins = Math.floor((durationMs % 3600000) / 60000);
  if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
  if (hrs > 0) return `${hrs}h`;
  return `${mins}m`;
}

export default function DragDropDayPanel({
  visible,
  draggingEvent,
  targetDate,
  existingEvents,
  initialTime,
  colors,
  onConfirm,
  onCancel,
  formatTime,
  travelBufferMinutes = 0,
}: DragDropDayPanelProps) {
  const [selectedHours, setSelectedHours] = useState(initialTime.hours);
  const [selectedMinutes, setSelectedMinutes] = useState(initialTime.minutes);
  const gridScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    setSelectedHours(initialTime.hours);
    setSelectedMinutes(initialTime.minutes);
  }, [initialTime.hours, initialTime.minutes, visible]);

  useEffect(() => {
    if (visible && gridScrollRef.current) {
      const scrollHours = initialTime.hours;
      const targetY = Math.max(0, (scrollHours - START_HOUR) * HOUR_HEIGHT - 40);
      setTimeout(() => {
        gridScrollRef.current?.scrollTo({ y: targetY, animated: true });
      }, 150);
    }
  }, [visible, initialTime.hours]);

  const handleTimeSlotSelect = (hours: number, minutes: number) => {
    setSelectedHours(hours);
    setSelectedMinutes(minutes);
  };

  const adjustTime = (deltaMins: number) => {
    const total = selectedHours * 60 + selectedMinutes + deltaMins;
    const clamped = Math.max(6 * 60, Math.min(20 * 60 + 45, total));
    const snapped = Math.round(clamped / 15) * 15;
    setSelectedHours(Math.floor(snapped / 60));
    setSelectedMinutes(snapped % 60);
  };

  if (!draggingEvent || !targetDate) return null;

  const dragBaseId = getBaseEventId(draggingEvent.id);

  const conflicts = detectConflicts(
    draggingEvent,
    targetDate,
    selectedHours,
    selectedMinutes,
    existingEvents
  );
  const endTimeDisplay = getPreviewEndTime(draggingEvent, selectedHours, selectedMinutes);
  const durationDisplay = getDurationDisplay(draggingEvent);
  const hasConflicts = conflicts.length > 0;

  const eventsForGrid = existingEvents.filter(
    (e) => {
      if (getBaseEventId(e.id) === dragBaseId) return false;
      return (
        new Date(e.start_time).toISOString().split('T')[0] ===
        targetDate.toISOString().split('T')[0]
      );
    }
  );

  const origStart = new Date(draggingEvent.start_time);
  const origEnd = new Date(draggingEvent.end_time);
  const duration = origEnd.getTime() - origStart.getTime();
  const newStart = new Date(targetDate);
  newStart.setHours(selectedHours, selectedMinutes, 0, 0);
  const newEnd = new Date(newStart.getTime() + duration);

  const previewEvent: ScheduleEvent = {
    ...draggingEvent,
    id: '__preview__',
    start_time: newStart.toISOString(),
    end_time: newEnd.toISOString(),
  };

  const gridEvents = [...eventsForGrid, previewEvent];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={[styles.panel, { backgroundColor: colors.surface }]}>
          <View style={[styles.panelHandle, { backgroundColor: colors.border }]} />

          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerLeft}>
              <View style={[styles.movingChip, { backgroundColor: colors.primary + '20' }]}>
                <Move size={13} color={colors.primary} />
                <Text style={[styles.movingChipText, { color: colors.primary }]} numberOfLines={1}>
                  {draggingEvent.title}
                </Text>
              </View>
              <View style={[styles.durationChip, { backgroundColor: colors.border + '60' }]}>
                <Text style={[styles.durationChipText, { color: colors.textSecondary }]}>{durationDisplay}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={[styles.timeSelectorRow, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
            <View style={styles.timeAdjust}>
              <TouchableOpacity
                style={[styles.timeAdjustBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => adjustTime(-15)}
              >
                <ChevronUp size={16} color={colors.text} />
              </TouchableOpacity>
              <View style={[styles.timeDisplay, { backgroundColor: colors.primary }]}>
                <Clock size={14} color="#fff" />
                <Text style={styles.timeDisplayText}>
                  {formatTimeDisplay(selectedHours, selectedMinutes)}
                </Text>
                <Text style={styles.timeDisplayEnd}>{'\u2192'} {endTimeDisplay}</Text>
              </View>
              <TouchableOpacity
                style={[styles.timeAdjustBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => adjustTime(15)}
              >
                <ChevronDown size={16} color={colors.text} />
              </TouchableOpacity>
            </View>

            {hasConflicts && (
              <View style={[styles.conflictWarning, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}>
                <AlertTriangle size={13} color="#B45309" />
                <Text style={styles.conflictWarningText}>
                  {conflicts.length === 1
                    ? `Overlaps: ${conflicts[0].title}`
                    : `Overlaps ${conflicts.length} jobs`}
                </Text>
              </View>
            )}

            {travelBufferMinutes > 0 && !hasConflicts && eventsForGrid.length > 1 && (
              <View style={[styles.travelBuffer, { backgroundColor: '#EFF6FF', borderColor: '#3B82F6' }]}>
                <Car size={13} color="#2563EB" />
                <Text style={styles.travelBufferText}>
                  ~{travelBufferMinutes} min travel time included
                </Text>
              </View>
            )}
          </View>

          <View style={styles.gridContainer}>
            <DayTimeGrid
              date={targetDate}
              events={gridEvents}
              colors={colors}
              onEventTap={() => {}}
              isDragMode={true}
              isDropTarget={false}
              onTimeSlotSelect={handleTimeSlotSelect}
              draggingEvent={null}
              formatTime={formatTime}
              scrollRef={gridScrollRef}
            />
          </View>

          <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
            <TouchableOpacity
              style={[styles.cancelBtn, { borderColor: colors.border }]}
              onPress={onCancel}
            >
              <Text style={[styles.cancelBtnText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.confirmBtn,
                { overflow: 'hidden' },
              ]}
              onPress={() => onConfirm(selectedHours, selectedMinutes)}
            >
              <LinearGradient
                colors={hasConflicts ? ['#d4850a', '#c27608'] : ['#1B4D6E', '#245d82']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ ...StyleSheet.absoluteFillObject }}
              />
              <Text style={styles.confirmBtnText}>
                {hasConflicts ? 'Schedule Anyway' : 'Confirm Move'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  panel: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '85%',
    overflow: 'hidden',
  },
  panelHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 8,
  },
  movingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    maxWidth: '70%',
  },
  movingChipText: {
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  durationChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  durationChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  timeSelectorRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  timeAdjust: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timeAdjustBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeDisplay: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  timeDisplayText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  timeDisplayEnd: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  conflictWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  conflictWarningText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B45309',
    flex: 1,
  },
  travelBuffer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  travelBufferText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
    flex: 1,
  },
  gridContainer: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});
