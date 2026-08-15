import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Platform,
  Linking,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { X, ChevronLeft, ChevronRight, Plus, Phone, MessageSquare, Mail, Clock, DollarSign, CircleCheck as CheckCircle } from 'lucide-react-native';
import { useUserRole } from '@/hooks/useUserRole';

interface ScheduleEvent {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  location?: string;
  client_id?: string | null;
  client?: { name: string } | null;
  amount?: number;
  payment_status?: string;
  status?: string;
}

interface ClientContact {
  phone?: string | null;
  email?: string | null;
}

interface DayEventCardProps {
  visible: boolean;
  date: Date | null;
  events: ScheduleEvent[];
  cellOrigin: { x: number; y: number; width: number; height: number } | null;
  colors: any;
  formatTime: (d: string) => string;
  onClose: () => void;
  onEventPress: (event: ScheduleEvent) => void;
  onAddEvent: (date: Date) => void;
  onNavigateDay: (date: Date) => void;
  getEventColor: (id: string) => string;
  getClientContact: (clientId: string | null | undefined) => ClientContact;
}

const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;

const CARD_W = Math.min(SCREEN_W * 0.88, 400);
const CARD_H = Math.min(SCREEN_H * 0.60, 480);

function formatDayHeader(date: Date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function isToday(date: Date) {
  const now = new Date();
  return (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
}

export default function DayEventCard({
  visible,
  date,
  events,
  cellOrigin,
  colors,
  formatTime,
  onClose,
  onEventPress,
  onAddEvent,
  onNavigateDay,
  getEventColor,
  getClientContact,
}: DayEventCardProps) {
  const { isAdminOrManager } = useUserRole();
  const scale = useSharedValue(0.2);
  const opacity = useSharedValue(0);
  const backdropOpacity = useSharedValue(0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const contentSlideX = useSharedValue(0);
  const contentOpacity = useSharedValue(1);

  const isAnimatingOut = useRef(false);

  const targetX = (SCREEN_W - CARD_W) / 2;
  const targetY = (SCREEN_H - CARD_H) / 2;

  const getOriginOffset = useCallback(() => {
    if (!cellOrigin) return { x: 0, y: 0 };
    const cellCenterX = cellOrigin.x + cellOrigin.width / 2;
    const cellCenterY = cellOrigin.y + cellOrigin.height / 2;
    const cardCenterX = targetX + CARD_W / 2;
    const cardCenterY = targetY + CARD_H / 2;
    return {
      x: cellCenterX - cardCenterX,
      y: cellCenterY - cardCenterY,
    };
  }, [cellOrigin, targetX, targetY]);

  useEffect(() => {
    if (visible) {
      isAnimatingOut.current = false;
      const offset = getOriginOffset();
      translateX.value = offset.x;
      translateY.value = offset.y;
      scale.value = 0.15;
      opacity.value = 0;
      backdropOpacity.value = 0;
      contentOpacity.value = 1;
      contentSlideX.value = 0;

      backdropOpacity.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.quad) });
      scale.value = withSpring(1, { damping: 18, stiffness: 280, mass: 0.8 });
      opacity.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.quad) });
      translateX.value = withSpring(0, { damping: 18, stiffness: 280 });
      translateY.value = withSpring(0, { damping: 18, stiffness: 280 });
    } else {
      if (isAnimatingOut.current) return;
      isAnimatingOut.current = true;
      backdropOpacity.value = withTiming(0, { duration: 180 });
      scale.value = withTiming(0.1, { duration: 180, easing: Easing.in(Easing.quad) });
      opacity.value = withTiming(0, { duration: 180, easing: Easing.in(Easing.quad) });
      const offset = getOriginOffset();
      translateX.value = withTiming(offset.x * 0.5, { duration: 180 });
      translateY.value = withTiming(offset.y * 0.5, { duration: 180 });
    }
  }, [visible]);

  const animateContentSlide = (direction: 'left' | 'right', cb: () => void) => {
    const outX = direction === 'left' ? -60 : 60;
    const inX = direction === 'left' ? 60 : -60;
    contentOpacity.value = withTiming(0, { duration: 120, easing: Easing.out(Easing.quad) });
    contentSlideX.value = withTiming(outX, { duration: 120, easing: Easing.out(Easing.quad) }, () => {
      runOnJS(cb)();
      contentSlideX.value = inX;
      contentOpacity.value = 0;
      contentSlideX.value = withTiming(0, { duration: 160, easing: Easing.out(Easing.cubic) });
      contentOpacity.value = withTiming(1, { duration: 160, easing: Easing.out(Easing.cubic) });
    });
  };

  const handlePrevDay = useCallback(() => {
    if (!date) return;
    const prev = new Date(date);
    prev.setDate(prev.getDate() - 1);
    animateContentSlide('right', () => onNavigateDay(prev));
  }, [date, onNavigateDay]);

  const handleNextDay = useCallback(() => {
    if (!date) return;
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    animateContentSlide('left', () => onNavigateDay(next));
  }, [date, onNavigateDay]);

  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-25, 25])
    .failOffsetY([-30, 30])
    .onEnd((e) => {
      if (e.translationX > 60) {
        runOnJS(handlePrevDay)();
      } else if (e.translationX < -60) {
        runOnJS(handleNextDay)();
      }
    });

  const cardAnimStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const backdropAnimStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const contentAnimStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateX: contentSlideX.value }],
  }));

  const handleCallPhone = (phone: string) => {
    Linking.openURL(`tel:${phone}`).catch(() => {});
  };

  const handleSendSms = (phone: string) => {
    Linking.openURL(`sms:${phone}`).catch(() => {});
  };

  const handleSendEmail = (email: string) => {
    Linking.openURL(`mailto:${email}`).catch(() => {});
  };

  const today = date ? isToday(date) : false;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'box-none' : 'none'}>
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.backdrop, backdropAnimStyle]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.card,
          {
            top: targetY,
            left: targetX,
            width: CARD_W,
            height: CARD_H,
            backgroundColor: colors.surface,
            shadowColor: '#000',
          },
          cardAnimStyle,
        ]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <View style={[styles.cardHeader, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={handlePrevDay} style={styles.navBtn} activeOpacity={0.7}>
            <ChevronLeft size={20} color={colors.primary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerDate, { color: colors.text }]} numberOfLines={1}>
              {date ? formatDayHeader(date) : ''}
            </Text>
            {today && (
              <View style={[styles.todayBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.todayBadgeText}>Today</Text>
              </View>
            )}
          </View>
          <TouchableOpacity onPress={handleNextDay} style={styles.navBtn} activeOpacity={0.7}>
            <ChevronRight size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.inputBackground }]} activeOpacity={0.7}>
            <X size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <GestureDetector gesture={swipeGesture}>
          <Animated.View style={[styles.contentWrapper, contentAnimStyle]}>
            {events.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No jobs scheduled</Text>
                <TouchableOpacity
                  style={[styles.addBtn, { backgroundColor: colors.primary }]}
                  onPress={() => date && onAddEvent(date)}
                  activeOpacity={0.85}
                >
                  <Plus size={16} color="#fff" />
                  <Text style={styles.addBtnText}>Add Job</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <ScrollView
                  style={styles.eventList}
                  contentContainerStyle={styles.eventListContent}
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                >
                  {events.map((event) => {
                    const color = getEventColor(event.id);
                    const contact = getClientContact(event.client_id);
                    const isPaid = event.payment_status === 'paid';
                    const isCompleted = event.status === 'completed';

                    return (
                      <TouchableOpacity
                        key={event.id}
                        style={[styles.eventRow, { borderLeftColor: color }]}
                        onPress={() => onEventPress(event)}
                        activeOpacity={0.75}
                      >
                        <View style={styles.eventMain}>
                          <View style={styles.eventTitleRow}>
                            <Text style={[styles.eventTitle, { color: colors.text }]} numberOfLines={1}>
                              {event.title}
                            </Text>
                            {isCompleted && <CheckCircle size={13} color="#059669" />}
                          </View>
                          {event.client?.name && (
                            <Text style={[styles.eventClient, { color: colors.textSecondary }]} numberOfLines={1}>
                              {event.client.name}
                            </Text>
                          )}
                          <View style={styles.eventMeta}>
                            <Clock size={11} color={colors.textSecondary} />
                            <Text style={[styles.eventTime, { color: colors.textSecondary }]}>
                              {formatTime(event.start_time)} – {formatTime(event.end_time)}
                            </Text>
                            {isAdminOrManager && event.amount != null && event.amount > 0 && (
                              <>
                                <DollarSign size={11} color={isPaid ? '#059669' : colors.textSecondary} />
                                <Text style={[styles.eventAmount, { color: isPaid ? '#059669' : colors.textSecondary }]}>
                                  {event.amount.toFixed(0)}
                                  {isPaid ? ' paid' : ''}
                                </Text>
                              </>
                            )}
                          </View>
                        </View>
                        <View style={styles.contactActions}>
                          {contact.phone && (
                            <TouchableOpacity
                              style={[styles.contactBtn, { backgroundColor: colors.inputBackground }]}
                              onPress={() => handleCallPhone(contact.phone!)}
                              activeOpacity={0.7}
                            >
                              <Phone size={14} color={colors.primary} />
                            </TouchableOpacity>
                          )}
                          {contact.phone && (
                            <TouchableOpacity
                              style={[styles.contactBtn, { backgroundColor: colors.inputBackground }]}
                              onPress={() => handleSendSms(contact.phone!)}
                              activeOpacity={0.7}
                            >
                              <MessageSquare size={14} color={colors.primary} />
                            </TouchableOpacity>
                          )}
                          {contact.email && (
                            <TouchableOpacity
                              style={[styles.contactBtn, { backgroundColor: colors.inputBackground }]}
                              onPress={() => handleSendEmail(contact.email!)}
                              activeOpacity={0.7}
                            >
                              <Mail size={14} color={colors.primary} />
                            </TouchableOpacity>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
                  <TouchableOpacity
                    style={[styles.addBtnSmall, { backgroundColor: colors.primary }]}
                    onPress={() => date && onAddEvent(date)}
                    activeOpacity={0.85}
                  >
                    <Plus size={15} color="#fff" />
                    <Text style={styles.addBtnText}>Add Job</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Animated.View>
        </GestureDetector>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  card: {
    position: 'absolute',
    borderRadius: 20,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  navBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  headerDate: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  todayBadge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  todayBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  contentWrapper: {
    flex: 1,
  },
  eventList: {
    flex: 1,
  },
  eventListContent: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 6,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 3,
    borderRadius: 10,
    paddingLeft: 10,
    paddingRight: 8,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.03)',
    gap: 8,
  },
  eventMain: {
    flex: 1,
    gap: 2,
  },
  eventTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  eventClient: {
    fontSize: 12,
    fontWeight: '500',
  },
  eventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  eventTime: {
    fontSize: 11,
    fontWeight: '500',
    marginRight: 4,
  },
  eventAmount: {
    fontSize: 11,
    fontWeight: '600',
  },
  contactActions: {
    flexDirection: 'row',
    gap: 6,
  },
  contactBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingBottom: 20,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '500',
  },
  cardFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'flex-end',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
  },
  addBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 12,
  },
  addBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
