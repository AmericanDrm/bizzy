import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Modal,
  TextInput,
  Platform,
  AppState,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSequence, runOnJS, Easing } from 'react-native-reanimated';
import { useResponsive } from '@/hooks/useResponsive';
import { Plus, ChevronLeft, ChevronRight, Clock, Repeat, DollarSign, Check, Download, Move, X, Search, Receipt, ClipboardList, Users, RefreshCw } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import ScheduleModal from '@/components/ScheduleModal';
import DayEventCard from '@/components/DayEventCard';
import WorkflowFab from '@/components/WorkflowFab';
import type { FabAction } from '@/components/WorkflowFab';
import InvoiceModal from '@/components/InvoiceModal';
import EstimateModal from '@/components/EstimateModal';
import ClientModal from '@/components/ClientModal';
import CalendarImportModal from '@/components/CalendarImportModal';
import DraggableEvent from '@/components/DraggableEvent';
import AnimatedDayCell from '@/components/AnimatedDayCell';
import DayTimeGrid from '@/components/DayTimeGrid';
import DragDropDayPanel from '@/components/DragDropDayPanel';
import WorkOrdersList from '@/components/WorkOrdersList';
import WorkOrderArrivalPrompt from '@/components/WorkOrderArrivalPrompt';
import SmartScheduler from '@/components/SmartScheduler';
import ScheduleOptimizer from '@/components/ScheduleOptimizer';
import ClickableContact from '@/components/ClickableContact';
import TimePicker from '@/components/TimePicker';
import { AnimatedTabContent } from '@/components/AnimatedTabContent';
import { getSlideDirection, getDynamicTabOrder } from '@/utils/tabAnimations';
import { useLayout } from '@/contexts/LayoutContext';
import { useTabNavigation } from '@/contexts/TabNavigationContext';
import getDynamicStyles from '@/styles/scheduleStyles';
import { useOrganization } from '@/contexts/OrganizationContext';
import CommercialJobsPanel from '@/components/CommercialJobsPanel';
import WeekTimeGrid from '@/components/WeekTimeGrid';
import JobNotificationPrompt from '@/components/JobNotificationPrompt';
import JobCompletionModal from '@/components/JobCompletionModal';
import DragGhost from '@/components/DragGhost';
import { calculateHaversineDistance, estimateDrivingTime } from '@/lib/routeOptimizationService';
import { deleteEventFromDevice, loadSyncSettings, performFullSync } from '@/lib/calendarSyncService';
import { useQuickActionHandler } from '@/hooks/useQuickActionHandler';
import { getAndClearNotificationIntent } from '@/components/PushNotificationHandler';

interface ScheduleEvent {
  id: string;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  location: string;
  client_id: string | null;
  client?: {
    name: string;
  } | null;
  is_recurring?: boolean;
  recurrence_type?: string;
  recurrence_interval?: number;
  recurrence_days_of_week?: number[];
  recurrence_day_of_month?: number;
  recurrence_week_of_month?: string;
  recurrence_end_date?: string;
  status?: string;
  completed_at?: string;
  invoice_id?: string;
  payment_status?: string;
  payment_method?: string;
  paid_date?: string;
  amount?: number;
  amount_paid?: number;
  line_items?: any[];
  job_type_id?: string;
  service_scope?: string;
  assigned_to?: string | null;
  external_calendar_event_id?: string | null;
  _multiDayPosition?: 'start' | 'middle' | 'end' | 'only';
  _multiDayTotal?: number;
  _multiDayIndex?: number;
}

const toDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const isMultiDayEvent = (event: ScheduleEvent) => {
  const startStr = toDateStr(new Date(event.start_time));
  const endStr = toDateStr(new Date(event.end_time));
  return startStr !== endStr;
};

const getMultiDayDates = (event: ScheduleEvent): { dateStr: string; position: 'start' | 'middle' | 'end'; dayIndex: number; totalDays: number }[] => {
  const start = new Date(event.start_time);
  const end = new Date(event.end_time);
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());

  const results: { dateStr: string; position: 'start' | 'middle' | 'end'; dayIndex: number; totalDays: number }[] = [];
  const current = new Date(startDay);
  let dayIndex = 0;
  const totalDays = Math.round((endDay.getTime() - startDay.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  while (current <= endDay) {
    const ds = toDateStr(current);
    let position: 'start' | 'middle' | 'end' = 'middle';
    if (current.getTime() === startDay.getTime()) position = 'start';
    if (current.getTime() === endDay.getTime()) position = 'end';
    results.push({ dateStr: ds, position, dayIndex, totalDays });
    current.setDate(current.getDate() + 1);
    dayIndex++;
  }
  return results;
};

const PAYMENT_METHODS = [
  { label: 'Cash', value: 'cash' },
  { label: 'Check', value: 'check' },
  { label: 'Card', value: 'card' },
  { label: 'Bank Transfer', value: 'bank_transfer' },
  { label: 'Other', value: 'other' },
];

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const getRecurringDatesInMonth = (event: ScheduleEvent, year: number, month: number): Date[] => {
  if (!event.is_recurring || !event.recurrence_type || event.recurrence_type === 'none') {
    return [];
  }

  const eventStart = new Date(event.start_time);
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  const dates: Date[] = [];

  if (event.recurrence_end_date) {
    const endDate = new Date(event.recurrence_end_date);
    if (endDate < monthStart) return [];
  }

  if (eventStart > monthEnd) return [];

  const interval = event.recurrence_interval || 1;

  switch (event.recurrence_type) {
    case 'daily': {
      let current = new Date(eventStart);
      while (current <= monthEnd) {
        if (current >= monthStart && current.toISOString().split('T')[0] !== eventStart.toISOString().split('T')[0]) {
          if (!event.recurrence_end_date || current <= new Date(event.recurrence_end_date)) {
            dates.push(new Date(current));
          }
        }
        current.setDate(current.getDate() + interval);
      }
      break;
    }
    case 'weekly': {
      let current = new Date(eventStart);
      while (current <= monthEnd) {
        if (current >= monthStart && current.toISOString().split('T')[0] !== eventStart.toISOString().split('T')[0]) {
          if (!event.recurrence_end_date || current <= new Date(event.recurrence_end_date)) {
            dates.push(new Date(current));
          }
        }
        current.setDate(current.getDate() + 7 * interval);
      }
      break;
    }
    case 'biweekly': {
      let current = new Date(eventStart);
      while (current <= monthEnd) {
        if (current >= monthStart && current.toISOString().split('T')[0] !== eventStart.toISOString().split('T')[0]) {
          if (!event.recurrence_end_date || current <= new Date(event.recurrence_end_date)) {
            dates.push(new Date(current));
          }
        }
        current.setDate(current.getDate() + 14);
      }
      break;
    }
    case 'monthly': {
      const dayOfMonth = event.recurrence_day_of_month || eventStart.getDate();
      let currentMonth = eventStart.getMonth();
      let currentYear = eventStart.getFullYear();

      while (currentYear < year || (currentYear === year && currentMonth <= month)) {
        if (currentYear > eventStart.getFullYear() || currentMonth > eventStart.getMonth()) {
          const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
          const actualDay = Math.min(dayOfMonth, daysInMonth);
          const date = new Date(currentYear, currentMonth, actualDay);

          if (date >= monthStart && date <= monthEnd) {
            if (!event.recurrence_end_date || date <= new Date(event.recurrence_end_date)) {
              dates.push(date);
            }
          }
        }
        currentMonth += interval;
        if (currentMonth > 11) {
          currentMonth = currentMonth - 12;
          currentYear++;
        }
      }
      break;
    }
    case 'custom': {
      if (event.recurrence_week_of_month && event.recurrence_days_of_week?.length) {
        const weekMap: Record<string, number> = { first: 0, second: 1, third: 2, fourth: 3, last: -1 };
        const weekIndex = weekMap[event.recurrence_week_of_month];

        for (const dayOfWeek of event.recurrence_days_of_week) {
          let targetDate: Date;

          if (weekIndex === -1) {
            const lastDay = new Date(year, month + 1, 0);
            const diff = (lastDay.getDay() - dayOfWeek + 7) % 7;
            targetDate = new Date(year, month, lastDay.getDate() - diff);
          } else {
            const firstOfMonth = new Date(year, month, 1);
            const firstDayOfWeek = firstOfMonth.getDay();
            let dayOffset = (dayOfWeek - firstDayOfWeek + 7) % 7;
            targetDate = new Date(year, month, 1 + dayOffset + weekIndex * 7);
          }

          if (targetDate >= monthStart && targetDate <= monthEnd && targetDate > eventStart) {
            if (!event.recurrence_end_date || targetDate <= new Date(event.recurrence_end_date)) {
              dates.push(targetDate);
            }
          }
        }
      }
      break;
    }
  }

  return dates;
};

export default function ScheduleScreen() {
  const [activeTab, setActiveTab] = useState<'calendar' | 'workorders' | 'optimizer' | 'smart'>('calendar');
  const [previousTab, setPreviousTab] = useState<'calendar' | 'workorders' | 'optimizer' | 'smart' | null>(null);
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [commercialRefreshKey, setCommercialRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedViewDate, setSelectedViewDate] = useState<Date | null>(null);
  const [lastTap, setLastTap] = useState<{ date: string; time: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [selectedPaymentEvent, setSelectedPaymentEvent] = useState<ScheduleEvent | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [completionModalVisible, setCompletionModalVisible] = useState(false);
  const [completionEvent, setCompletionEvent] = useState<ScheduleEvent | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggingEvent, setDraggingEvent] = useState<ScheduleEvent | null>(null);
  const [dropTargetDate, setDropTargetDate] = useState<Date | null>(null);
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [newEventTime, setNewEventTime] = useState({ hours: 9, minutes: 0 });
  const [hoveredDateStr, setHoveredDateStr] = useState<string | null>(null);
  const [isPanDragging, setIsPanDragging] = useState(false);
  const cellLayoutsRef = useRef<Map<string, { x: number; y: number; width: number; height: number }>>(new Map());
  const monthScrollRef = useRef<ScrollView>(null);
  const dragGhostX = useSharedValue(0);
  const dragGhostY = useSharedValue(0);
  const [dragGhostVisible, setDragGhostVisible] = useState(false);
  const [travelBufferMinutes, setTravelBufferMinutes] = useState(0);
  const [fabOpen, setFabOpen] = useState(false);
  const [contextEvent, setContextEvent] = useState<ScheduleEvent | null>(null);
  const [invoiceModalVisible, setInvoiceModalVisible] = useState(false);
  const [invoicePrefill, setInvoicePrefill] = useState<{ clientId: string; items: any[]; notes?: string; scheduleEventId?: string } | null>(null);
  const [estimateModalVisible, setEstimateModalVisible] = useState(false);
  const [estimatePrefill, setEstimatePrefill] = useState<{ clientId: string } | null>(null);
  const [clientModalVisible, setClientModalVisible] = useState(false);
  const [clientForEdit, setClientForEdit] = useState<any>(null);
  const [quickSchedulePrefill, setQuickSchedulePrefill] = useState<any>(null);
  const [isCalendarCollapsed, setIsCalendarCollapsed] = useState(false);
  const [userLatitude, setUserLatitude] = useState<number | null>(null);
  const [userLongitude, setUserLongitude] = useState<number | null>(null);
  const [upcomingFilter, setUpcomingFilter] = useState<'day' | 'week' | 'month'>('month');
  const [notificationPromptVisible, setNotificationPromptVisible] = useState(false);
  const [notificationPromptEvent, setNotificationPromptEvent] = useState<ScheduleEvent | null>(null);
  const notifiedEventsRef = useRef<Set<string>>(new Set());
  const [dayCardVisible, setDayCardVisible] = useState(false);
  const [dayCardDate, setDayCardDate] = useState<Date | null>(null);
  const [dayCardOrigin, setDayCardOrigin] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const clientContactCacheRef = useRef<Map<string, { phone?: string | null; email?: string | null }>>(new Map());

  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const dynamicStyles = getDynamicStyles(colors);
  const { isWeb, isDesktop } = useResponsive();
  const isWebDesktop = isWeb && isDesktop;

  const { previousTab: globalPreviousTab, currentTab: globalCurrentTab } = useTabNavigation();
  const { visibleTabs, dominantHand } = useLayout();
  const dynamicOrder = getDynamicTabOrder(visibleTabs);
  const slideDirection = getSlideDirection(globalPreviousTab, globalCurrentTab, dynamicOrder);

  const { showToast } = useToast();
  const { isAdminOrManager } = useUserRole();
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();

  const pendingDeleteRef = useRef<{ event: ScheduleEvent; timeoutId: ReturnType<typeof setTimeout> } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncEnabled, setSyncEnabled] = useState(false);
  const lastSyncRef = useRef<number>(0);

  const calendarHeight = useSharedValue(1);

  const calendarAnimHeight = useAnimatedStyle(() => ({
    opacity: calendarHeight.value,
    transform: [{ scaleY: calendarHeight.value }],
    transformOrigin: 'top',
  }));

  const collapseMonthCalendar = useCallback(() => {
    setIsCalendarCollapsed(true);
    if (!selectedViewDate) setSelectedViewDate(new Date());
    calendarHeight.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) });
    setTimeout(() => {
      monthScrollRef.current?.scrollTo({ y: 0, animated: true });
    }, 50);
  }, [selectedViewDate]);

  const expandMonthCalendar = useCallback(() => {
    setIsCalendarCollapsed(false);
    calendarHeight.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) });
  }, []);

  const filteredEvents = React.useMemo(() => {
    if (!searchQuery.trim()) return events;
    const query = searchQuery.toLowerCase();
    return events.filter(
      (event) =>
        event.title.toLowerCase().includes(query) ||
        event.description?.toLowerCase().includes(query) ||
        event.location?.toLowerCase().includes(query) ||
        event.client?.name?.toLowerCase().includes(query)
    );
  }, [events, searchQuery]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    getAndClearNotificationIntent().then((intent) => {
      if (intent?.type === 'departure_reminder' && intent.scheduleEventId) {
        const scheduleEventId = intent.scheduleEventId;
        const findAndPrompt = async () => {
          const { data } = await supabase
            .from('schedule_events')
            .select('*, client:clients(name)')
            .eq('id', scheduleEventId)
            .maybeSingle();
          if (data) {
            setNotificationPromptEvent(data as ScheduleEvent);
            setNotificationPromptVisible(true);
          }
        };
        findAndPrompt();
      }
    });
  }, []);

  useEffect(() => {
    fetchEvents();
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          setUserLatitude(position.coords.latitude);
          setUserLongitude(position.coords.longitude);
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 60000, timeout: 10000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    loadSyncSettings(user.id).then((s) => {
      if (s?.sync_enabled) setSyncEnabled(true);
    });
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || Platform.OS === 'web') return;

    const triggerSync = async () => {
      const now = Date.now();
      if (now - lastSyncRef.current < 60000) return;
      lastSyncRef.current = now;
      setIsSyncing(true);
      try {
        const result = await performFullSync(user.id);
        if (result && (result.outbound > 0 || result.inbound.added > 0 || result.inbound.updated > 0 || result.inbound.deleted > 0)) {
          fetchEvents();
        }
      } finally {
        setIsSyncing(false);
      }
    };

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') triggerSync();
    });

    triggerSync();

    return () => subscription.remove();
  }, [user?.id]);

  const fetchEvents = async () => {
    if (!currentOrganization) {
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('schedule_events')
        .select(`
          *,
          client:clients(name),
          assignments:schedule_event_team_members(
            member_id,
            member:organization_members(
              user_id,
              profiles(display_name, email)
            )
          )
        `)
        .eq('organization_id', currentOrganization.id)
        .order('start_time', { ascending: true });

      if (error) throw error;
      setEvents(data || []);
      setCommercialRefreshKey(k => k + 1);
    } catch (error: any) {
      showToast({
        message: error?.message || 'Failed to load events',
        type: 'error',
        duration: 8000,
        action: { label: 'Retry', onPress: () => fetchEvents() },
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddEvent = (date?: Date) => {
    setSelectedEvent(null);
    setSelectedDate(date || null);
    setModalVisible(true);
  };

  const handleDateTap = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    const origin = cellLayoutsRef.current.get(dateStr) || null;
    setDayCardDate(date);
    setDayCardOrigin(origin);
    setDayCardVisible(true);
    setSelectedViewDate(date);
  };

  const handleCloseDayCard = () => {
    setDayCardVisible(false);
  };

  const handleDayCardNavigate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    const origin = cellLayoutsRef.current.get(dateStr) || null;
    setDayCardDate(date);
    setDayCardOrigin(origin);
    setSelectedViewDate(date);
    const monthYear = `${date.getFullYear()}-${date.getMonth()}`;
    const curMonthYear = `${currentDate.getFullYear()}-${currentDate.getMonth()}`;
    if (monthYear !== curMonthYear) {
      setCurrentDate(new Date(date.getFullYear(), date.getMonth(), 1));
    }
  };

  const getClientContact = useCallback(async (clientId: string | null | undefined): Promise<{ phone?: string | null; email?: string | null }> => {
    if (!clientId) return {};
    if (clientContactCacheRef.current.has(clientId)) {
      return clientContactCacheRef.current.get(clientId)!;
    }
    try {
      const { data } = await supabase
        .from('clients')
        .select('phone, email')
        .eq('id', clientId)
        .maybeSingle();
      const contact = { phone: data?.phone || null, email: data?.email || null };
      clientContactCacheRef.current.set(clientId, contact);
      return contact;
    } catch {
      return {};
    }
  }, []);

  const [clientContacts, setClientContacts] = useState<Map<string, { phone?: string | null; email?: string | null }>>(new Map());

  const getClientContactSync = useCallback((clientId: string | null | undefined) => {
    if (!clientId) return {};
    return clientContacts.get(clientId) || {};
  }, [clientContacts]);

  useEffect(() => {
    if (!dayCardVisible || !dayCardDate) return;
    const dateStr = dayCardDate.toISOString().split('T')[0];
    const dayEvents = getEventsForDate(dayCardDate);
    const clientIds = [...new Set(dayEvents.map(e => e.client_id).filter(Boolean))] as string[];
    const missing = clientIds.filter(id => !clientContacts.has(id));
    if (missing.length === 0) return;
    Promise.all(missing.map(id => getClientContact(id).then(c => ({ id, c })))).then(results => {
      setClientContacts(prev => {
        const next = new Map(prev);
        results.forEach(({ id, c }) => next.set(id, c));
        return next;
      });
    });
  }, [dayCardVisible, dayCardDate, events]);

  const handleEditEvent = (event: ScheduleEvent) => {
    const eventDate = new Date(event.start_time);
    const today = new Date();
    const isTodayEvent =
      eventDate.getDate() === today.getDate() &&
      eventDate.getMonth() === today.getMonth() &&
      eventDate.getFullYear() === today.getFullYear();

    if (isTodayEvent && event.client_id && !notifiedEventsRef.current.has(event.id)) {
      setNotificationPromptEvent(event);
      setNotificationPromptVisible(true);
      return;
    }

    setSelectedEvent(event);
    setContextEvent(event);
    setSelectedDate(null);
    setModalVisible(true);
  };

  const handleNotificationPromptDone = () => {
    setNotificationPromptVisible(false);
    if (notificationPromptEvent) {
      notifiedEventsRef.current.add(notificationPromptEvent.id);
      setSelectedEvent(notificationPromptEvent);
      setContextEvent(notificationPromptEvent);
      setSelectedDate(null);
      setModalVisible(true);
    }
    setNotificationPromptEvent(null);
  };

  const handleNotificationPromptClose = () => {
    setNotificationPromptVisible(false);
    setNotificationPromptEvent(null);
  };

  const closeFab = useCallback(() => setFabOpen(false), []);
  const toggleFab = useCallback(() => setFabOpen(prev => !prev), []);

  const handleQuickAction = useQuickActionHandler({
    onScheduleClient: (prefill, date) => {
      if (date) setSelectedDate(date);
      setQuickSchedulePrefill(prefill || null);
      setSelectedEvent(null);
      setModalVisible(true);
    },
    onEventsChanged: () => fetchEvents(),
  });

  const handleContextEditClient = useCallback(async () => {
    closeFab();
    if (contextEvent?.client_id) {
      const { data } = await supabase
        .from('clients')
        .select('id, name, email, phone, address, notes')
        .eq('id', contextEvent.client_id)
        .maybeSingle();
      if (data) {
        setClientForEdit(data);
        setClientModalVisible(true);
      }
    }
  }, [contextEvent]);

  const handleContextInvoice = useCallback(() => {
    closeFab();
    if (contextEvent?.client_id) {
      setInvoicePrefill({
        clientId: contextEvent.client_id,
        scheduleEventId: contextEvent.id,
        items: contextEvent.amount ? [{
          description: contextEvent.title || 'Service',
          quantity: 1,
          unit_price: contextEvent.amount,
          discount_amount: 0,
          discount_percentage: 0,
          total: contextEvent.amount,
          display_order: 0,
        }] : [],
      });
      setInvoiceModalVisible(true);
    }
  }, [contextEvent]);

  const handleContextEstimate = useCallback(() => {
    closeFab();
    if (contextEvent?.client_id) {
      setEstimatePrefill({ clientId: contextEvent.client_id });
      setEstimateModalVisible(true);
    }
  }, [contextEvent]);

  const fabActions = React.useMemo((): FabAction[] => {
    if (contextEvent && contextEvent.client_id) {
      return [
        { id: 'editClient', label: 'Edit Client', icon: Users, color: '#1B4D6E', onPress: handleContextEditClient },
        { id: 'invoice', label: 'New Invoice', icon: Receipt, color: '#059669', onPress: handleContextInvoice },
        { id: 'estimate', label: 'New Estimate', icon: ClipboardList, color: '#2563eb', onPress: handleContextEstimate },
      ];
    }
    return [
      { id: 'addEvent', label: 'New Event', icon: Plus, color: '#1B4D6E', onPress: () => { closeFab(); handleAddEvent(); } },
    ];
  }, [contextEvent, handleContextEditClient, handleContextInvoice, handleContextEstimate]);

  const handleDeleteEvent = (event: ScheduleEvent) => {
    if (pendingDeleteRef.current) {
      clearTimeout(pendingDeleteRef.current.timeoutId);
      executeDelete(pendingDeleteRef.current.event);
    }

    setEvents((prev) => prev.filter((e) => e.id !== event.id));

    const timeoutId = setTimeout(() => {
      executeDelete(event);
      pendingDeleteRef.current = null;
    }, 5000);

    pendingDeleteRef.current = { event, timeoutId };

    showToast({
      message: `"${event.title}" deleted`,
      type: 'info',
      duration: 5000,
      action: {
        label: 'Undo',
        onPress: () => {
          if (pendingDeleteRef.current?.event.id === event.id) {
            clearTimeout(pendingDeleteRef.current.timeoutId);
            pendingDeleteRef.current = null;
            setEvents((prev) => [...prev, event].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()));
            showToast({ message: 'Event restored', type: 'success', duration: 2000 });
          }
        },
      },
    });
  };

  const executeDelete = async (event: ScheduleEvent) => {
    try {
      await deleteEventFromDevice(event.external_calendar_event_id);
      const { error } = await supabase.from('schedule_events').delete().eq('id', getBaseEventId(event.id)).eq('user_id', user!.id);
      if (error) throw error;
    } catch (error: any) {
      showToast({
        message: error?.message || 'Failed to delete event',
        type: 'error',
        duration: 4000,
      });
      fetchEvents();
    }
  };

  const handleMarkAsPaid = (event: ScheduleEvent) => {
    setSelectedPaymentEvent(event);
    setPaymentAmount(event.amount?.toString() || '');
    setPaymentModalVisible(true);
  };

  const handleConfirmPayment = async (paymentMethod: string) => {
    if (!selectedPaymentEvent) return;

    const paidDate = new Date().toISOString().split('T')[0];
    const amountPaid = paymentAmount ? parseFloat(paymentAmount) : (selectedPaymentEvent.amount || 0);

    const datePattern = /-\d{4}-\d{2}-\d{2}$/;
    const realEventId = datePattern.test(selectedPaymentEvent.id)
      ? selectedPaymentEvent.id.replace(datePattern, '')
      : selectedPaymentEvent.id;

    try {
      const { error } = await supabase
        .from('schedule_events')
        .update({
          payment_status: 'paid',
          payment_method: paymentMethod,
          paid_date: paidDate,
          amount: amountPaid || selectedPaymentEvent.amount || null,
          amount_paid: amountPaid || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', realEventId)
        .eq('user_id', user!.id);

      if (error) throw error;

      if (amountPaid > 0 && user?.id) {
        const { data: existingIncome } = await supabase
          .from('income')
          .select('id')
          .eq('schedule_event_id', realEventId)
          .maybeSingle();

        if (!existingIncome) {
          const clientName = selectedPaymentEvent.client?.name || '';
          const incomeRecord: any = {
            user_id: user!.id,
            schedule_event_id: realEventId,
            client_id: selectedPaymentEvent.client_id,
            amount: amountPaid,
            description: clientName ? `${selectedPaymentEvent.title} - ${clientName}` : selectedPaymentEvent.title,
            date: paidDate,
            category: 'Job Payment',
          };
          if (selectedPaymentEvent.invoice_id) {
            incomeRecord.invoice_id = selectedPaymentEvent.invoice_id;
          }
          const { error: incomeError } = await supabase.from('income').insert(incomeRecord);

          if (incomeError) {
            console.error('Failed to create income record:', incomeError);
            showToast({
              message: 'Marked as paid but failed to add to income',
              type: 'warning',
              duration: 3000,
            });
          } else {
            showToast({ message: 'Marked as paid and added to income', type: 'success', duration: 2000 });
          }
        } else {
          showToast({ message: 'Marked as paid', type: 'success', duration: 2000 });
        }
      } else {
        showToast({ message: 'Marked as paid', type: 'success', duration: 2000 });
      }

      fetchEvents();
    } catch (error: any) {
      showToast({
        message: error?.message || 'Failed to update payment status',
        type: 'error',
        duration: 4000,
      });
    } finally {
      setPaymentModalVisible(false);
      setSelectedPaymentEvent(null);
      setPaymentAmount('');
    }
  };

  const handleCompleteJob = useCallback((event: ScheduleEvent) => {
    setCompletionEvent(event);
    setCompletionModalVisible(true);
  }, []);

  const isEventCompletable = useCallback((event: ScheduleEvent) => {
    if (!event.client_id) return false;
    if (event.status === 'completed') return false;
    const eventDate = new Date(event.start_time).toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];
    return eventDate <= today;
  }, []);

  const handleCellLayout = useCallback((dateStr: string, layout: { x: number; y: number; width: number; height: number }) => {
    cellLayoutsRef.current.set(dateStr, layout);
  }, []);

  const hitTestCells = useCallback((absX: number, absY: number): string | null => {
    for (const [dateStr, layout] of cellLayoutsRef.current.entries()) {
      if (
        absX >= layout.x &&
        absX <= layout.x + layout.width &&
        absY >= layout.y &&
        absY <= layout.y + layout.height
      ) {
        return dateStr;
      }
    }
    return null;
  }, []);

  const geocodeLocation = useCallback((location: string | null | undefined): { lat: number; lng: number } | null => {
    if (!location) return null;
    return null;
  }, []);

  const calculateTravelBuffer = useCallback((targetDate: Date, dragEvent: ScheduleEvent): number => {
    const dayEvents = getEventsForDate(targetDate);
    const baseId = getBaseEventId(dragEvent.id);
    const otherEvents = dayEvents
      .filter((e) => getBaseEventId(e.id) !== baseId)
      .sort((a, b) => new Date(a.end_time).getTime() - new Date(b.end_time).getTime());

    if (otherEvents.length === 0) return 0;

    const lastEvent = otherEvents[otherEvents.length - 1];
    const lastLoc = geocodeLocation(lastEvent.location);
    const dragLoc = geocodeLocation(dragEvent.location);

    if (lastLoc && dragLoc) {
      const dist = calculateHaversineDistance(lastLoc.lat, lastLoc.lng, dragLoc.lat, dragLoc.lng);
      return estimateDrivingTime(dist);
    }

    return 15;
  }, [events]);

  const handleDragStart = (event: ScheduleEvent) => {
    setIsDragging(true);
    setDraggingEvent(event);
    setDropTargetDate(null);
    setHoveredDateStr(null);
  };

  const handleCancelDrag = () => {
    setIsDragging(false);
    setIsPanDragging(false);
    setDraggingEvent(null);
    setDropTargetDate(null);
    setHoveredDateStr(null);
    setDragGhostVisible(false);
  };

  const handlePanDragStart = useCallback((event: ScheduleEvent, absoluteX: number, absoluteY: number) => {
    setIsDragging(true);
    setIsPanDragging(true);
    setDraggingEvent(event);
    setDropTargetDate(null);
    setDragGhostVisible(true);
    dragGhostX.value = absoluteX;
    dragGhostY.value = absoluteY;
    const hitDate = hitTestCells(absoluteX, absoluteY);
    setHoveredDateStr(hitDate);
  }, [hitTestCells]);

  const handlePanDragMove = useCallback((absoluteX: number, absoluteY: number) => {
    dragGhostX.value = absoluteX;
    dragGhostY.value = absoluteY;
    const hitDate = hitTestCells(absoluteX, absoluteY);
    setHoveredDateStr(hitDate);
  }, [hitTestCells]);

  const handlePanDragEnd = useCallback((absoluteX: number, absoluteY: number) => {
    const hitDate = hitTestCells(absoluteX, absoluteY);
    setDragGhostVisible(false);
    setIsPanDragging(false);
    setHoveredDateStr(null);

    if (hitDate && draggingEvent) {
      const parts = hitDate.split('-');
      const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      handleDropOnDate(date);
    } else {
      setIsDragging(false);
      setDraggingEvent(null);
    }
  }, [hitTestCells, draggingEvent]);

  const handlePanDragCancel = useCallback(() => {
    setDragGhostVisible(false);
    setIsPanDragging(false);
    setHoveredDateStr(null);
    setIsDragging(false);
    setDraggingEvent(null);
  }, []);

  const getBaseEventId = (id: string): string => {
    const datePattern = /-\d{4}-\d{2}-\d{2}$/;
    return datePattern.test(id) ? id.replace(datePattern, '') : id;
  };

  const findEarliestOpenSlot = (date: Date, durationMs: number, dragEventId: string, travelBuffer: number = 0): { hours: number; minutes: number } => {
    const dayEvents = getEventsForDate(date);
    const baseId = getBaseEventId(dragEventId);
    const otherEvents = dayEvents.filter((e) => getBaseEventId(e.id) !== baseId);

    const durationMins = Math.ceil(durationMs / 60000);
    const sorted = otherEvents
      .map((e) => ({
        start: new Date(e.start_time).getHours() * 60 + new Date(e.start_time).getMinutes(),
        end: new Date(e.end_time).getHours() * 60 + new Date(e.end_time).getMinutes(),
      }))
      .sort((a, b) => a.start - b.start);

    const dayStart = 6 * 60;
    const dayEnd = 21 * 60;

    if (sorted.length === 0) {
      return { hours: Math.floor(dayStart / 60), minutes: dayStart % 60 };
    }

    let candidate = dayStart;
    for (const evt of sorted) {
      if (candidate + durationMins <= evt.start) {
        const snapped = Math.ceil(candidate / 15) * 15;
        return { hours: Math.floor(snapped / 60), minutes: snapped % 60 };
      }
      candidate = Math.max(candidate, evt.end + travelBuffer);
    }

    if (candidate + durationMins <= dayEnd) {
      const snapped = Math.ceil(candidate / 15) * 15;
      return { hours: Math.floor(snapped / 60), minutes: snapped % 60 };
    }

    return { hours: 6, minutes: 0 };
  };

  const handleDropOnDate = (date: Date) => {
    if (!draggingEvent) return;

    setDropTargetDate(date);

    const origStart = new Date(draggingEvent.start_time);
    const origEnd = new Date(draggingEvent.end_time);
    const duration = origEnd.getTime() - origStart.getTime();
    const buffer = calculateTravelBuffer(date, draggingEvent);
    setTravelBufferMinutes(buffer);
    const slot = findEarliestOpenSlot(date, duration, draggingEvent.id, buffer);
    setNewEventTime(slot);

    setTimePickerVisible(true);
    setIsDragging(false);
    setIsPanDragging(false);
    setDragGhostVisible(false);
    setHoveredDateStr(null);
  };

  const handleTimeConfirm = async (overrideHours?: number, overrideMinutes?: number) => {
    if (!draggingEvent || !dropTargetDate) return;

    const hours = overrideHours !== undefined ? overrideHours : newEventTime.hours;
    const minutes = overrideMinutes !== undefined ? overrideMinutes : newEventTime.minutes;

    try {
      const baseEventId = getBaseEventId(draggingEvent.id);
      const newDate = new Date(dropTargetDate);
      newDate.setHours(hours, minutes, 0, 0);

      const existingStart = new Date(draggingEvent.start_time);
      const existingEnd = new Date(draggingEvent.end_time);
      const duration = existingEnd.getTime() - existingStart.getTime();

      const newEnd = new Date(newDate.getTime() + duration);

      const { error } = await supabase
        .from('schedule_events')
        .update({
          start_time: newDate.toISOString(),
          end_time: newEnd.toISOString(),
        })
        .eq('id', baseEventId)
        .eq('user_id', user!.id);

      if (error) throw error;

      showToast({
        message: 'Event rescheduled successfully',
        type: 'success',
        duration: 2000,
      });

      fetchEvents();
    } catch (error: any) {
      showToast({
        message: error?.message || 'Failed to reschedule event',
        type: 'error',
        duration: 4000,
      });
    } finally {
      setTimePickerVisible(false);
      setDraggingEvent(null);
      setDropTargetDate(null);
    }
  };

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const goToPreviousDay = useCallback(() => {
    if (selectedViewDate) {
      const prev = new Date(selectedViewDate);
      prev.setDate(prev.getDate() - 1);
      setSelectedViewDate(prev);
    }
  }, [selectedViewDate]);

  const goToNextDay = useCallback(() => {
    if (selectedViewDate) {
      const next = new Date(selectedViewDate);
      next.setDate(next.getDate() + 1);
      setSelectedViewDate(next);
    }
  }, [selectedViewDate]);

  const calendarSwipeX = useSharedValue(0);
  const monthSlideX = useSharedValue(0);
  const monthOpacity = useSharedValue(1);

  const animateMonthTransition = (direction: 'left' | 'right', cb: () => void) => {
    const outX = direction === 'left' ? -40 : 40;
    const inX = direction === 'left' ? 40 : -40;
    monthOpacity.value = withTiming(0, { duration: 130, easing: Easing.out(Easing.quad) });
    monthSlideX.value = withTiming(outX, { duration: 130, easing: Easing.out(Easing.quad) }, () => {
      runOnJS(cb)();
      monthSlideX.value = inX;
      monthOpacity.value = 0;
      monthSlideX.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.cubic) });
      monthOpacity.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) });
    });
  };

  const goToPreviousMonthAnimated = () => {
    animateMonthTransition('right', goToPreviousMonth);
  };

  const goToNextMonthAnimated = () => {
    animateMonthTransition('left', goToNextMonth);
  };

  const calendarSwipeGesture = Gesture.Pan()
    .activeOffsetX([-25, 25])
    .failOffsetY([-30, 30])
    .onUpdate((e) => {
      if (Platform.OS === 'web') return;
      calendarSwipeX.value = e.translationX * 0.3;
    })
    .onEnd((e) => {
      if (Platform.OS !== 'web') {
        calendarSwipeX.value = withTiming(0, { duration: 150 });
      }
      if (e.translationX > 60) {
        runOnJS(goToPreviousMonthAnimated)();
      } else if (e.translationX < -60) {
        runOnJS(goToNextMonthAnimated)();
      }
    });

  const calendarAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: calendarSwipeX.value + monthSlideX.value }],
    opacity: monthOpacity.value,
  }));

  const monthCollapseSwipe = Gesture.Pan()
    .activeOffsetY([-15, 15])
    .failOffsetX([-20, 20])
    .onEnd((e) => {
      if (e.translationY < -40) {
        runOnJS(collapseMonthCalendar)();
      }
    });

  const collapsedStripSwipe = Gesture.Pan()
    .activeOffsetY([-15, 15])
    .failOffsetX([-20, 20])
    .onEnd((e) => {
      if (e.translationY > 40) {
        runOnJS(expandMonthCalendar)();
      }
    });

  const goToPrevWeekCollapsed = useCallback(() => {
    const anchor = selectedViewDate || new Date();
    const prev = new Date(anchor);
    prev.setDate(anchor.getDate() - 7);
    setSelectedViewDate(prev);
  }, [selectedViewDate]);

  const goToNextWeekCollapsed = useCallback(() => {
    const anchor = selectedViewDate || new Date();
    const next = new Date(anchor);
    next.setDate(anchor.getDate() + 7);
    setSelectedViewDate(next);
  }, [selectedViewDate]);

  const collapsedWeekSwipeGesture = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-10, 10])
    .onEnd((e) => {
      if (e.translationX > 60) {
        runOnJS(goToPrevWeekCollapsed)();
      } else if (e.translationX < -60) {
        runOnJS(goToNextWeekCollapsed)();
      }
    });

  const daySwipeX = useSharedValue(0);

  const daySwipeGesture = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-5, 5])
    .onUpdate((e) => {
      daySwipeX.value = e.translationX * 0.3;
    })
    .onEnd((e) => {
      daySwipeX.value = withTiming(0, { duration: 150 });
      if (e.translationX > 60) {
        runOnJS(goToPreviousDay)();
      } else if (e.translationX < -60) {
        runOnJS(goToNextDay)();
      }
    });

  const dayAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: daySwipeX.value }],
  }));

  const getEventColor = (eventId: string) => {
    let hash = 0;
    for (let i = 0; i < eventId.length; i++) {
      hash = eventId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return EVENT_COLORS[Math.abs(hash) % EVENT_COLORS.length];
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];

    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    const remainder = days.length % 7;
    if (remainder > 0) {
      for (let i = 0; i < 7 - remainder; i++) {
        days.push(null);
      }
    }

    return days;
  };

  const getEventsForDate = (date: Date | null) => {
    if (!date) return [];
    const dateStr = toDateStr(date);

    const result: ScheduleEvent[] = [];

    events.forEach((event) => {
      if (isMultiDayEvent(event)) {
        const spans = getMultiDayDates(event);
        const match = spans.find(s => s.dateStr === dateStr);
        if (match) {
          result.push({
            ...event,
            _multiDayPosition: match.position,
            _multiDayTotal: match.totalDays,
            _multiDayIndex: match.dayIndex,
          });
        }
      } else {
        const eventDate = toDateStr(new Date(event.start_time));
        if (eventDate === dateStr) {
          result.push(event);
        }
      }

      if (event.is_recurring) {
        const recurringDates = getRecurringDatesInMonth(event, date.getFullYear(), date.getMonth());
        const matchingDate = recurringDates.find(
          (d) => toDateStr(d) === dateStr
        );
        if (matchingDate) {
          const eventStartTime = new Date(event.start_time);
          const eventEndTime = new Date(event.end_time);
          const duration = eventEndTime.getTime() - eventStartTime.getTime();

          const instanceStart = new Date(matchingDate);
          instanceStart.setHours(eventStartTime.getHours(), eventStartTime.getMinutes(), 0, 0);

          const instanceEnd = new Date(instanceStart.getTime() + duration);

          result.push({
            ...event,
            id: `${event.id}-${dateStr}`,
            start_time: instanceStart.toISOString(),
            end_time: instanceEnd.toISOString(),
          });
        }
      }
    });

    return result;
  };

  const isToday = (date: Date | null) => {
    if (!date) return false;
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatRecurrence = (event: ScheduleEvent) => {
    if (!event.is_recurring || !event.recurrence_type || event.recurrence_type === 'none') {
      return null;
    }

    let text = '';
    switch (event.recurrence_type) {
      case 'daily':
        text = event.recurrence_interval === 1 ? 'Daily' : `Every ${event.recurrence_interval} days`;
        break;
      case 'weekly':
        text = event.recurrence_interval === 1 ? 'Weekly' : `Every ${event.recurrence_interval} weeks`;
        break;
      case 'biweekly':
        text = 'Every 2 weeks';
        break;
      case 'monthly':
        text = event.recurrence_interval === 1 ? 'Monthly' : `Every ${event.recurrence_interval} months`;
        if (event.recurrence_day_of_month) {
          text += ` on the ${event.recurrence_day_of_month}${getOrdinalSuffix(event.recurrence_day_of_month)}`;
        }
        break;
      case 'custom':
        if (event.recurrence_week_of_month && event.recurrence_days_of_week?.length) {
          const weekLabel = event.recurrence_week_of_month.charAt(0).toUpperCase() + event.recurrence_week_of_month.slice(1);
          const dayNames = event.recurrence_days_of_week.map((d) => DAYS_OF_WEEK[d]).join(', ');
          text = `${weekLabel} ${dayNames} of the month`;
        } else {
          text = 'Custom';
        }
        break;
      default:
        text = 'Recurring';
    }

    if (event.recurrence_end_date) {
      const endDate = new Date(event.recurrence_end_date);
      text += ` until ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }

    return text;
  };

  const getOrdinalSuffix = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  };

  const monthName = currentDate.toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const days = getDaysInMonth(currentDate);

  const allEventsForMonth = React.useMemo(() => {
    const result: Map<string, ScheduleEvent[]> = new Map();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);

    const addToMap = (dateStr: string, ev: ScheduleEvent) => {
      if (!result.has(dateStr)) result.set(dateStr, []);
      result.get(dateStr)!.push(ev);
    };

    events.forEach((event) => {
      if (isMultiDayEvent(event)) {
        const spans = getMultiDayDates(event);
        spans.forEach(({ dateStr, position, dayIndex, totalDays }) => {
          const d = new Date(dateStr + 'T00:00:00');
          if (d.getMonth() === month && d.getFullYear() === year) {
            addToMap(dateStr, {
              ...event,
              _multiDayPosition: position,
              _multiDayTotal: totalDays,
              _multiDayIndex: dayIndex,
            });
          }
        });
      } else {
        const eventDate = new Date(event.start_time);
        const eventDateStr = toDateStr(eventDate);
        if (eventDate.getMonth() === month && eventDate.getFullYear() === year) {
          addToMap(eventDateStr, event);
        }
      }

      if (event.is_recurring) {
        const recurringDates = getRecurringDatesInMonth(event, year, month);
        recurringDates.forEach((date) => {
          const dateStr = toDateStr(date);
          const eventStartTime = new Date(event.start_time);
          const eventEndTime = new Date(event.end_time);
          const duration = eventEndTime.getTime() - eventStartTime.getTime();

          const instanceStart = new Date(date);
          instanceStart.setHours(eventStartTime.getHours(), eventStartTime.getMinutes(), 0, 0);
          const instanceEnd = new Date(instanceStart.getTime() + duration);

          addToMap(dateStr, {
            ...event,
            id: `${event.id}-${dateStr}`,
            start_time: instanceStart.toISOString(),
            end_time: instanceEnd.toISOString(),
          });
        });
      }
    });

    return result;
  }, [events, currentDate]);

  const getEventsForDateFromMap = (date: Date | null) => {
    if (!date) return [];
    const dateStr = date.toISOString().split('T')[0];
    return allEventsForMonth.get(dateStr) || [];
  };

  const getFilteredUpcomingEvents = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

    return filteredEvents.filter((event) => {
      const eventDate = new Date(event.start_time);
      const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
      return eventDay >= monthStart && eventDay <= monthEnd;
    });
  };

  const selectedDayStats = React.useMemo(() => {
    const dayEvents = getEventsForDate(selectedViewDate || new Date());
    const jobCount = dayEvents.length;
    const revenue = dayEvents.reduce((sum, ev) => sum + (ev.amount || 0), 0);
    return { jobCount, revenue };
  }, [selectedViewDate, events]);

  const getCollapsedWeekDays = (): (Date | null)[] => {
    const anchor = selectedViewDate || new Date();
    const dow = anchor.getDay();
    const weekStart = new Date(anchor);
    weekStart.setDate(anchor.getDate() - dow);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    });
  };

  const expandToMonthView = useCallback(() => {
    setIsCalendarCollapsed(false);
    setUpcomingFilter('month');
    calendarHeight.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) });
  }, []);

  const renderCollapsedStrip = (inDayWeekView = false) => {
    const weekDays = getCollapsedWeekDays();
    const expandAction = inDayWeekView ? expandToMonthView : expandMonthCalendar;
    const expandSwipe = Gesture.Pan()
      .activeOffsetY([-15, 15])
      .failOffsetX([-20, 20])
      .onEnd((e) => {
        if (e.translationY > 40) {
          runOnJS(expandAction)();
        }
      });
    const combinedGesture = Gesture.Simultaneous(expandSwipe, collapsedWeekSwipeGesture);
    return (
      <GestureDetector gesture={combinedGesture}>
        <View style={[localStyles.collapsedStrip, inDayWeekView && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
          <View style={localStyles.collapsedDayNames}>
            {DAYS_OF_WEEK.map((d) => (
              <View key={d} style={localStyles.collapsedDayNameCell}>
                <Text style={[localStyles.collapsedDayNameText, { color: colors.textSecondary }]}>{d}</Text>
              </View>
            ))}
          </View>
          <View style={localStyles.collapsedDayRow}>
            {weekDays.map((date, i) => {
              if (!date) return <View key={i} style={localStyles.collapsedDayCell} />;
              const dateStr = date.toISOString().split('T')[0];
              const hasEvents = (allEventsForMonth.get(dateStr) || []).length > 0 || getEventsForDate(date).length > 0;
              const today = isToday(date);
              const isSelected = selectedViewDate && selectedViewDate.toISOString().split('T')[0] === dateStr;
              return (
                <TouchableOpacity
                  key={i}
                  style={localStyles.collapsedDayCell}
                  onPress={() => {
                    setSelectedViewDate(date);
                    if (inDayWeekView && upcomingFilter === 'week') {
                      setUpcomingFilter('day');
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[
                    localStyles.collapsedDayNumber,
                    today && { backgroundColor: colors.primary },
                    isSelected && !today && { backgroundColor: colors.warning },
                  ]}>
                    <Text style={[
                      localStyles.collapsedDayNumberText,
                      { color: today || isSelected ? '#fff' : colors.text },
                    ]}>
                      {date.getDate()}
                    </Text>
                  </View>
                  {hasEvents && (
                    <View style={[localStyles.collapsedEventDot, { backgroundColor: today ? '#fff' : colors.primary }]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity style={localStyles.collapsedHandle} onPress={expandAction} activeOpacity={0.7}>
            <View style={[localStyles.collapsedHandlePill, { backgroundColor: colors.border }]} />
          </TouchableOpacity>
        </View>
      </GestureDetector>
    );
  };

  return (
    <AnimatedTabContent
      activeTab={globalCurrentTab}
      tabKey="schedule"
      direction={slideDirection}
    >
      <View style={dynamicStyles.container}>
        <WorkOrderArrivalPrompt latitude={userLatitude} longitude={userLongitude} />

        <View style={[dynamicStyles.header, localStyles.compactHeader]}>
          <View style={localStyles.compactHeaderRow}>
            <Text style={dynamicStyles.headerTitle}>Schedule</Text>
            <View style={localStyles.headerActions}>
              {syncEnabled && (
                <View style={{ opacity: isSyncing ? 1 : 0.5 }}>
                  {isSyncing ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <RefreshCw size={14} color={colors.primary} />
                  )}
                </View>
              )}
              {activeTab === 'calendar' && (
                searchExpanded ? (
                  <View style={localStyles.inlineSearch}>
                    <TextInput
                      style={[localStyles.inlineSearchInput, { color: colors.text }]}
                      placeholder="Search..."
                      placeholderTextColor={colors.textSecondary}
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      autoFocus
                      onBlur={() => { if (!searchQuery) setSearchExpanded(false); }}
                    />
                    <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchExpanded(false); }}>
                      <X size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[dynamicStyles.iconButton, { width: 28, height: 28 }]}
                    onPress={() => setSearchExpanded(true)}
                  >
                    <Search size={14} color={colors.primary} />
                  </TouchableOpacity>
                )
              )}
              <TouchableOpacity style={localStyles.compactTodayBtn} onPress={goToToday}>
                <Text style={[localStyles.compactTodayBtnText, { color: '#fff' }]}>{new Date().getDate()}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {activeTab === 'calendar' && upcomingFilter === 'month' && (
            <View style={localStyles.monthTitleRow}>
              {isAdminOrManager && (
                <View style={[localStyles.dayStatBadge, { borderColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.1)' }]}>
                  <DollarSign size={11} color={colors.primary} />
                  <Text style={[localStyles.dayStatValue, { color: colors.text }]}>
                    {selectedDayStats.revenue >= 1000
                      ? `$${(selectedDayStats.revenue / 1000).toFixed(1)}k`
                      : `$${selectedDayStats.revenue.toFixed(0)}`}
                  </Text>
                </View>
              )}
              <TouchableOpacity onPress={goToPreviousMonthAnimated} style={{ padding: 8 }}>
                <ChevronLeft size={20} color={colors.textSecondary} />
              </TouchableOpacity>
              <View style={{ alignItems: 'center' }}>
                <Text style={[localStyles.monthTitleText, { color: colors.text }]}>
                  {currentDate.toLocaleString('en-US', { month: 'long' })}
                </Text>
                <Text style={[localStyles.monthYearText, { color: colors.textSecondary }]}>
                  {currentDate.getFullYear()}
                </Text>
              </View>
              <TouchableOpacity onPress={goToNextMonthAnimated} style={{ padding: 8 }}>
                <ChevronRight size={20} color={colors.textSecondary} />
              </TouchableOpacity>
              {isAdminOrManager && (
                <View style={[localStyles.dayStatBadge, { borderColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.1)' }]}>
                  <ClipboardList size={11} color={colors.primary} />
                  <Text style={[localStyles.dayStatValue, { color: colors.text }]}>
                    {selectedDayStats.jobCount}
                  </Text>
                  <Text style={[localStyles.dayStatLabel, { color: colors.textSecondary }]}>
                    {selectedDayStats.jobCount === 1 ? 'job' : 'jobs'}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        <View style={[localStyles.viewTabBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          {([
            { key: 'calendar', label: 'Calendar', adminOnly: false },
            { key: 'workorders', label: 'Work Orders', adminOnly: false },
            { key: 'optimizer', label: 'Optimizer', adminOnly: true },
            { key: 'smart', label: 'Smart Sched', adminOnly: true },
          ] as { key: 'calendar' | 'workorders' | 'optimizer' | 'smart'; label: string; adminOnly: boolean }[])
            .filter((tab) => !tab.adminOnly || isAdminOrManager)
            .map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[localStyles.viewTabItem, activeTab === tab.key && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
                onPress={() => {
                  setPreviousTab(activeTab);
                  setActiveTab(tab.key);
                }}
                activeOpacity={0.7}
              >
                <Text style={[localStyles.viewTabText, { color: activeTab === tab.key ? colors.primary : colors.textSecondary }]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
        </View>

        {activeTab === 'calendar' && (
          <View style={[localStyles.calViewModeBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            {([
              { key: 'month', label: 'Month' },
              { key: 'week', label: 'Week' },
              { key: 'day', label: 'Day' },
            ] as const).map((mode) => {
              const isActive = upcomingFilter === mode.key;
              return (
                <TouchableOpacity
                  key={mode.key}
                  style={[localStyles.calViewModeBtn, isActive && { backgroundColor: colors.primary }]}
                  onPress={() => {
                    if (mode.key === 'month') {
                      expandToMonthView();
                    } else {
                      setUpcomingFilter(mode.key);
                      if (mode.key === 'day' && !selectedViewDate) {
                        setSelectedViewDate(new Date());
                      }
                      collapseMonthCalendar();
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[localStyles.calViewModeBtnText, { color: isActive ? '#fff' : colors.textSecondary }]}>
                    {mode.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <AnimatedTabContent activeTab={activeTab} tabKey="optimizer" direction={slideDirection}>
          <ScheduleOptimizer />
        </AnimatedTabContent>

        <AnimatedTabContent activeTab={activeTab} tabKey="smart" direction={slideDirection}>
          <SmartScheduler />
        </AnimatedTabContent>

        <AnimatedTabContent activeTab={activeTab} tabKey="workorders" direction={slideDirection}>
          <WorkOrdersList />
        </AnimatedTabContent>

        <AnimatedTabContent activeTab={activeTab} tabKey="calendar" direction={slideDirection}>
          <View style={{ flex: 1 }}>
            {upcomingFilter !== 'month' ? (
              <View style={{ flex: 1 }}>
                {renderCollapsedStrip(true)}
                {upcomingFilter === 'day' ? (
                  <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingBottom: 80 }}
                    showsVerticalScrollIndicator={false}
                  >
                    <View style={localStyles.expandedViewSection}>
                      <View style={[dynamicStyles.sectionHeader, { paddingHorizontal: 16, paddingTop: 12 }]}>
                        <TouchableOpacity onPress={goToPreviousDay} style={{ padding: 4 }}>
                          <ChevronLeft size={20} color={colors.primary} />
                        </TouchableOpacity>
                        <Text style={[dynamicStyles.upcomingTitle, { flex: 1, textAlign: 'center' }]}>
                          {(selectedViewDate || new Date()).toLocaleDateString('en-US', {
                            weekday: 'short', month: 'long', day: 'numeric',
                          })}
                        </Text>
                        <TouchableOpacity onPress={goToNextDay} style={{ padding: 4 }}>
                          <ChevronRight size={20} color={colors.primary} />
                        </TouchableOpacity>
                      </View>
                      <GestureDetector gesture={daySwipeGesture}>
                        <Animated.View style={[localStyles.timeGridWrapper, dayAnimatedStyle]}>
                          <DayTimeGrid
                            date={selectedViewDate || new Date()}
                            events={getEventsForDate(selectedViewDate || new Date())}
                            colors={colors}
                            onEventTap={handleEditEvent}
                            onEventLongPress={handleDragStart}
                            formatTime={formatTime}
                          />
                        </Animated.View>
                      </GestureDetector>
                    </View>
                    {isAdminOrManager && (
                      <CommercialJobsPanel
                        currentDate={currentDate}
                        onRefreshNeeded={fetchEvents}
                        refreshKey={commercialRefreshKey}
                      />
                    )}
                  </ScrollView>
                ) : (
                <ScrollView
                  style={{ flex: 1 }}
                  contentContainerStyle={{ paddingBottom: 80 }}
                  showsVerticalScrollIndicator={false}
                >
                {upcomingFilter === 'week' && (() => {
                  const anchor = selectedViewDate || new Date();
                  const dow = anchor.getDay();
                  const weekStart = new Date(anchor);
                  weekStart.setDate(anchor.getDate() - dow);
                  const weekEnd = new Date(weekStart);
                  weekEnd.setDate(weekStart.getDate() + 6);
                  const goToPrevWeek = () => {
                    const prev = new Date(weekStart);
                    prev.setDate(prev.getDate() - 7);
                    setSelectedViewDate(prev);
                  };
                  const goToNextWeek = () => {
                    const next = new Date(weekStart);
                    next.setDate(next.getDate() + 7);
                    setSelectedViewDate(next);
                  };
                  const weekSwipeGesture = Gesture.Pan()
                    .activeOffsetX([-20, 20])
                    .failOffsetY([-10, 10])
                    .onEnd((e) => {
                      if (e.translationX > 60) {
                        runOnJS(goToPrevWeek)();
                      } else if (e.translationX < -60) {
                        runOnJS(goToNextWeek)();
                      }
                    });
                  const weekLabel = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
                  const weekEvents = events.filter((e) => {
                    const d = new Date(e.start_time);
                    return d >= weekStart && d <= weekEnd;
                  });
                  return (
                    <View style={localStyles.expandedViewSection}>
                      <View style={[dynamicStyles.sectionHeader, { paddingHorizontal: 16, paddingTop: 12 }]}>
                        <TouchableOpacity onPress={goToPrevWeek} style={{ padding: 4 }}>
                          <ChevronLeft size={20} color={colors.primary} />
                        </TouchableOpacity>
                        <Text style={[dynamicStyles.upcomingTitle, { flex: 1, textAlign: 'center', fontSize: 14 }]}>
                          {weekLabel}
                        </Text>
                        <TouchableOpacity onPress={goToNextWeek} style={{ padding: 4 }}>
                          <ChevronRight size={20} color={colors.primary} />
                        </TouchableOpacity>
                      </View>
                      <GestureDetector gesture={weekSwipeGesture}>
                        <View style={localStyles.timeGridWrapper}>
                          <WeekTimeGrid
                            weekStart={weekStart}
                            events={weekEvents}
                            colors={colors}
                            onEventTap={handleEditEvent}
                            onDayTap={(date) => {
                              setSelectedViewDate(date);
                              setUpcomingFilter('day');
                            }}
                            selectedDate={selectedViewDate}
                          />
                        </View>
                      </GestureDetector>
                    </View>
                  );
                })()}
                </ScrollView>
                )}
              </View>
            ) : (
              <ScrollView
                ref={monthScrollRef}
                style={Platform.OS === 'web' ? { flex: 1, height: '100%', overflow: 'auto' } as any : { flex: 1 }}
                contentContainerStyle={{ paddingBottom: 100, flexGrow: 1 }}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled={true}
                scrollEventThrottle={16}
                onScroll={(e) => {
                  if (Platform.OS !== 'web' && !isCalendarCollapsed) {
                    const y = e.nativeEvent.contentOffset.y;
                    if (y > 280) {
                      collapseMonthCalendar();
                    }
                  }
                }}
              >
                {isCalendarCollapsed ? (
                  renderCollapsedStrip()
                ) : Platform.OS === 'web' ? (
                  <Animated.View style={[localStyles.fullCalendarWrapper, calendarAnimatedStyle]}>
                      <View style={dynamicStyles.weekDays}>
                        {DAYS_OF_WEEK.map((day) => (
                          <View key={day} style={dynamicStyles.weekDay}>
                            <Text style={dynamicStyles.weekDayText}>{day}</Text>
                          </View>
                        ))}
                      </View>
                      <View style={dynamicStyles.daysGrid}>
                        {Array.from({ length: Math.ceil(days.length / 7) }).map((_, weekIndex) => (
                          <View key={weekIndex} style={dynamicStyles.weekRow}>
                            {days.slice(weekIndex * 7, weekIndex * 7 + 7).map((date, dayIndex) => {
                              const index = weekIndex * 7 + dayIndex;
                              const dayEvents = getEventsForDateFromMap(date);
                              const today = isToday(date);
                              const isSelectedDay =
                                selectedViewDate &&
                                date &&
                                selectedViewDate.toISOString().split('T')[0] === date.toISOString().split('T')[0];
                              const dateStr = date ? toDateStr(date) : null;
                              const isHovered = isPanDragging && dateStr === hoveredDateStr;
                              return (
                                <AnimatedDayCell
                                  key={index}
                                  date={date}
                                  isDropTarget={isHovered}
                                  onPress={() => {
                                    if (isDragging && !isPanDragging && date) {
                                      handleDropOnDate(date);
                                    } else if (!isDragging && date) {
                                      handleDateTap(date);
                                    }
                                  }}
                                  onLayout={handleCellLayout}
                                  eventCount={dayEvents.length}
                                  isDragActive={isDragging}
                                  style={[
                                    dynamicStyles.dayCell,
                                    localStyles.flexDayCell,
                                    !date && dynamicStyles.emptyCel,
                                    today && dynamicStyles.todayCell,
                                    isSelectedDay && dynamicStyles.selectedCell,
                                    isDragging && date && !isHovered && dynamicStyles.dropZone,
                                    isHovered && dynamicStyles.dropZoneActive,
                                  ]}
                                >
                                  {date && (
                                    <>
                                      <View
                                        style={[
                                          dynamicStyles.dayNumber,
                                          today && dynamicStyles.todayNumber,
                                          isSelectedDay && dynamicStyles.selectedNumber,
                                        ]}
                                      >
                                        <Text
                                          style={[
                                            dynamicStyles.dayText,
                                            today && dynamicStyles.todayText,
                                            isSelectedDay && dynamicStyles.selectedText,
                                          ]}
                                        >
                                          {date.getDate()}
                                        </Text>
                                      </View>
                                      <View style={{ width: '100%', gap: 2, marginTop: 2 }}>
                                        {(() => {
                                          const multiDayEvts = dayEvents.filter(e => e._multiDayPosition);
                                          const singleDayEvts = dayEvents.filter(e => !e._multiDayPosition);
                                          const maxSlots = isWebDesktop ? 3 : 2;
                                          const multiDaySlots = multiDayEvts.slice(0, maxSlots);
                                          const remainingSlots = Math.max(0, maxSlots - multiDaySlots.length);
                                          const singleDaySlots = singleDayEvts.slice(0, remainingSlots);
                                          const totalShown = multiDaySlots.length + singleDaySlots.length;
                                          const totalEvents = dayEvents.length;

                                          return (
                                            <>
                                              {multiDaySlots.map((event) => {
                                                const evColor = getEventColor(event.id);
                                                const pos = event._multiDayPosition!;
                                                return (
                                                  <TouchableOpacity
                                                    key={`md-${event.id}-${event._multiDayIndex}`}
                                                    style={[
                                                      localStyles.multiDayBar,
                                                      { backgroundColor: evColor + '20' },
                                                      pos === 'start' && localStyles.multiDayBarStart,
                                                      pos === 'end' && localStyles.multiDayBarEnd,
                                                      pos === 'middle' && localStyles.multiDayBarMiddle,
                                                    ]}
                                                    onPress={(e) => {
                                                      e.stopPropagation();
                                                      if (!isDragging) handleEditEvent(event);
                                                    }}
                                                    onLongPress={(e) => {
                                                      e.stopPropagation();
                                                      handleDragStart(event);
                                                    }}
                                                    delayLongPress={500}
                                                    activeOpacity={0.8}
                                                  >
                                                    {pos === 'start' ? (
                                                      <Text style={[localStyles.multiDayBarText, { color: evColor }]} numberOfLines={1}>
                                                        {event.title}
                                                      </Text>
                                                    ) : (
                                                      <Text style={[localStyles.multiDayBarText, { color: evColor, opacity: 0.6 }]} numberOfLines={1}>
                                                        {pos === 'end' ? `${event._multiDayTotal}d` : ''}
                                                      </Text>
                                                    )}
                                                  </TouchableOpacity>
                                                );
                                              })}
                                              {singleDaySlots.map((event) => (
                                                <TouchableOpacity
                                                  key={event.id}
                                                  style={[
                                                    localStyles.eventBar,
                                                    { borderLeftColor: getEventColor(event.id) },
                                                  ]}
                                                  onPress={(e) => {
                                                    e.stopPropagation();
                                                    if (!isDragging) handleEditEvent(event);
                                                  }}
                                                  onLongPress={(e) => {
                                                    e.stopPropagation();
                                                    handleDragStart(event);
                                                  }}
                                                  delayLongPress={500}
                                                  activeOpacity={0.8}
                                                >
                                                  <Text style={[localStyles.eventBarText, { color: getEventColor(event.id) }]} numberOfLines={1}>
                                                    {event.title}
                                                  </Text>
                                                </TouchableOpacity>
                                              ))}
                                              {totalEvents > totalShown && (
                                                <Text style={localStyles.moreChipsText}>+{totalEvents - totalShown}</Text>
                                              )}
                                            </>
                                          );
                                        })()}
                                      </View>
                                    </>
                                  )}
                                </AnimatedDayCell>
                              );
                            })}
                          </View>
                        ))}
                      </View>
                    </Animated.View>
                ) : (
                  <GestureDetector gesture={calendarSwipeGesture}>
                    <Animated.View style={[localStyles.fullCalendarWrapper, calendarAnimatedStyle]}>
                      <View style={dynamicStyles.weekDays}>
                        {DAYS_OF_WEEK.map((day) => (
                          <View key={day} style={dynamicStyles.weekDay}>
                            <Text style={dynamicStyles.weekDayText}>{day}</Text>
                          </View>
                        ))}
                      </View>
                      <View style={dynamicStyles.daysGrid}>
                        {Array.from({ length: Math.ceil(days.length / 7) }).map((_, weekIndex) => (
                          <View key={weekIndex} style={dynamicStyles.weekRow}>
                            {days.slice(weekIndex * 7, weekIndex * 7 + 7).map((date, dayIndex) => {
                              const index = weekIndex * 7 + dayIndex;
                              const dayEvents = getEventsForDateFromMap(date);
                              const today = isToday(date);
                              const isSelectedDay =
                                selectedViewDate &&
                                date &&
                                selectedViewDate.toISOString().split('T')[0] === date.toISOString().split('T')[0];
                              const dateStr = date ? toDateStr(date) : null;
                              const isHovered = isPanDragging && dateStr === hoveredDateStr;
                              return (
                                <AnimatedDayCell
                                  key={index}
                                  date={date}
                                  isDropTarget={isHovered}
                                  onPress={() => {
                                    if (isDragging && !isPanDragging && date) {
                                      handleDropOnDate(date);
                                    } else if (!isDragging && date) {
                                      handleDateTap(date);
                                    }
                                  }}
                                  onLayout={handleCellLayout}
                                  eventCount={dayEvents.length}
                                  isDragActive={isDragging}
                                  style={[
                                    dynamicStyles.dayCell,
                                    localStyles.flexDayCell,
                                    !date && dynamicStyles.emptyCel,
                                    isToday(date) && dynamicStyles.todayCell,
                                    isSelectedDay && dynamicStyles.selectedCell,
                                    isHovered && dynamicStyles.dropZoneActive,
                                  ]}
                                  colors={colors}
                                >
                                  {date && (
                                    <>
                                      <View style={dynamicStyles.dayNumber}>
                                        <Text
                                          style={[
                                            dynamicStyles.dayNumberText,
                                            { color: isToday(date) ? '#fff' : colors.text },
                                          ]}
                                        >
                                          {date.getDate()}
                                        </Text>
                                      </View>
                                      {(() => {
                                        const evts = dayEvents;
                                        const maxShow = 2;
                                        const shown = evts.slice(0, maxShow);
                                        const extra = evts.length - maxShow;
                                        return (
                                          <>
                                            {shown.map((ev) => {
                                              const isMultiDay = !!ev.end_time && (() => {
                                                const s = new Date(ev.start_time);
                                                const e = new Date(ev.end_time);
                                                return e.getTime() - s.getTime() > 20 * 60 * 60 * 1000;
                                              })();
                                              const barColor = ev.status === 'completed'
                                                ? colors.success
                                                : ev.payment_status === 'paid'
                                                  ? colors.warning
                                                  : colors.primary;
                                              if (isMultiDay) {
                                                return (
                                                  <View key={ev.id} style={[localStyles.multiDayBar, { backgroundColor: barColor + '22', borderLeftColor: barColor }]}>
                                                    <Text style={[localStyles.multiDayBarText, { color: barColor }]} numberOfLines={1}>
                                                      {ev.client?.name || ev.title}
                                                    </Text>
                                                  </View>
                                                );
                                              }
                                              return (
                                                <View key={ev.id} style={[localStyles.eventBar, { borderLeftColor: barColor }]}>
                                                  <Text style={[localStyles.eventBarText, { color: barColor }]} numberOfLines={1}>
                                                    {ev.client?.name || ev.title}
                                                  </Text>
                                                </View>
                                              );
                                            })}
                                            {extra > 0 && (
                                              <Text style={[localStyles.extraEventsText, { color: colors.textSecondary }]}>
                                                +{extra}
                                              </Text>
                                            )}
                                          </>
                                        );
                                      })()}
                                    </>
                                  )}
                                </AnimatedDayCell>
                              );
                            })}
                          </View>
                        ))}
                      </View>
                    </Animated.View>
                  </GestureDetector>
                )}

                {!isCalendarCollapsed && (
                  <TouchableOpacity
                    style={localStyles.calendarCollapsePillContainer}
                    onPress={collapseMonthCalendar}
                    activeOpacity={0.7}
                    accessibilityLabel="Collapse calendar"
                    accessibilityRole="button"
                  >
                    <View style={[localStyles.calendarCollapsePill, { backgroundColor: colors.border }]} />
                    {Platform.OS === 'web' && (
                      <Text style={[localStyles.calendarCollapsePillHint, { color: colors.textSecondary }]}>
                        Tap to collapse
                      </Text>
                    )}
                  </TouchableOpacity>
                )}

                <View style={[localStyles.selectedDaySection, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopColor: colors.border }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                    <Text style={[localStyles.selectedDayNumber, { color: colors.text }]}>
                      {(selectedViewDate || new Date()).getDate()}
                    </Text>
                    <Text style={[localStyles.selectedDayWeekday, { color: colors.textSecondary }]}>
                      {(selectedViewDate || new Date()).toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}
                    </Text>
                  </View>
                </View>

                {(() => {
                  const dayEvts = getEventsForDate(selectedViewDate || new Date());
                  if (dayEvts.length === 0) {
                    return (
                      <View style={localStyles.selectedDayEmpty}>
                        <Text style={[localStyles.selectedDayEmptyText, { color: colors.textSecondary }]}>
                          No events for this day
                        </Text>
                      </View>
                    );
                  }
                  return (
                    <View style={localStyles.selectedDayEvents}>
                      {dayEvts.map((event) => (
                        <DraggableEvent
                          key={event.id}
                          event={event}
                          colors={colors}
                          onTap={() => { if (!isDragging) handleEditEvent(event); }}
                          onLongPress={() => handleDragStart(event)}
                          onDragStart={handlePanDragStart}
                          onDragMove={handlePanDragMove}
                          onDragEnd={handlePanDragEnd}
                          onDragCancel={handlePanDragCancel}
                          formatTime={formatTime}
                          formatRecurrence={formatRecurrence}
                          onCompleteJob={handleCompleteJob}
                          onReschedule={(ev) => handleEditEvent(ev)}
                          showCompleteButton={isEventCompletable(event)}
                          isDimmed={isDragging && draggingEvent?.id === event.id}
                        />
                      ))}
                    </View>
                  );
                })()}

                {isAdminOrManager && (
                  <CommercialJobsPanel
                    currentDate={currentDate}
                    onRefreshNeeded={fetchEvents}
                    refreshKey={commercialRefreshKey}
                  />
                )}
              </ScrollView>
            )}
          </View>
        </AnimatedTabContent>


        {activeTab === 'calendar' && (
          <View
            style={[localStyles.simpleFabContainer, dominantHand === 'left' ? { left: 20, right: undefined } : { right: 20 }, dynamicStyles.fab]}
            pointerEvents="box-none"
          >
            <TouchableOpacity
              style={localStyles.simpleFab}
              onPress={() => handleAddEvent()}
              activeOpacity={0.8}
              accessibilityLabel="New Event"
              accessibilityRole="button"
            >
              <Image source={require('@/assets/images/Isolated_Bizzy_Bolt.png')} style={{ width: 32, height: 32, tintColor: '#FFFFFF' }} resizeMode="contain" />
            </TouchableOpacity>
          </View>
        )}

        <ScheduleModal
          visible={modalVisible}
          event={selectedEvent}
          preselectedDate={selectedDate}
          prefillFromClient={!selectedEvent ? quickSchedulePrefill : null}
          onClose={() => {
            setModalVisible(false);
            setSelectedEvent(null);
            setContextEvent(null);
            setSelectedDate(null);
            setQuickSchedulePrefill(null);
            closeFab();
          }}
          onSave={() => {
            setModalVisible(false);
            setSelectedEvent(null);
            setContextEvent(null);
            setSelectedDate(null);
            setQuickSchedulePrefill(null);
            closeFab();
            fetchEvents();
          }}
          onDelete={(event) => {
            setModalVisible(false);
            setSelectedEvent(null);
            setContextEvent(null);
            setSelectedDate(null);
            setQuickSchedulePrefill(null);
            closeFab();
            handleDeleteEvent(event);
          }}
        />

        <InvoiceModal
          visible={invoiceModalVisible}
          invoice={null}
          prefill={invoicePrefill}
          onClose={() => { setInvoiceModalVisible(false); setInvoicePrefill(null); }}
          onSave={() => { setInvoiceModalVisible(false); setInvoicePrefill(null); fetchEvents(); }}
        />

        <EstimateModal
          visible={estimateModalVisible}
          estimate={null}
          prefill={estimatePrefill}
          onClose={() => { setEstimateModalVisible(false); setEstimatePrefill(null); }}
          onSave={() => { setEstimateModalVisible(false); setEstimatePrefill(null); }}
        />

        <ClientModal
          visible={clientModalVisible}
          client={clientForEdit}
          onClose={() => { setClientModalVisible(false); setClientForEdit(null); }}
          onSave={() => { setClientModalVisible(false); setClientForEdit(null); fetchEvents(); }}
        />

        <CalendarImportModal
          visible={importModalVisible}
          onClose={() => setImportModalVisible(false)}
          onSuccess={() => {
            fetchEvents();
            showToast({
              message: 'Calendar events imported successfully',
              type: 'success',
              duration: 3000,
            });
          }}
        />

        <JobNotificationPrompt
          visible={notificationPromptVisible}
          event={notificationPromptEvent}
          userLatitude={userLatitude}
          userLongitude={userLongitude}
          onClose={handleNotificationPromptClose}
          onSkip={handleNotificationPromptDone}
        />

        <Modal
          visible={paymentModalVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => {
            setPaymentModalVisible(false);
            setSelectedPaymentEvent(null);
          }}
        >
          <View style={dynamicStyles.paymentModalOverlay}>
            <View style={dynamicStyles.paymentModalContent}>
              <Text style={dynamicStyles.paymentModalTitle}>Mark as Paid</Text>
              <View style={dynamicStyles.amountInputContainer}>
                <Text style={dynamicStyles.amountInputLabel}>Amount</Text>
                <View style={dynamicStyles.amountInputRow}>
                  <Text style={dynamicStyles.currencySymbol}>$</Text>
                  <TextInput
                    style={dynamicStyles.amountInput}
                    value={paymentAmount}
                    onChangeText={setPaymentAmount}
                    placeholder="0.00"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
              <Text style={dynamicStyles.paymentMethodLabel}>Payment Method</Text>
              <View style={dynamicStyles.paymentMethodList}>
                {PAYMENT_METHODS.map((method) => (
                  <TouchableOpacity
                    key={method.value}
                    style={dynamicStyles.paymentMethodOption}
                    onPress={() => handleConfirmPayment(method.value)}
                  >
                    <Text style={dynamicStyles.paymentMethodOptionText}>{method.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={dynamicStyles.paymentModalCancel}
                onPress={() => {
                  setPaymentModalVisible(false);
                  setSelectedPaymentEvent(null);
                  setPaymentAmount('');
                }}
              >
                <Text style={dynamicStyles.paymentModalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <JobCompletionModal
          visible={completionModalVisible}
          event={completionEvent}
          onClose={() => {
            setCompletionModalVisible(false);
            setCompletionEvent(null);
          }}
          onComplete={() => {
            fetchEvents();
          }}
        />

        <DragDropDayPanel
          visible={timePickerVisible}
          draggingEvent={draggingEvent}
          targetDate={dropTargetDate}
          existingEvents={dropTargetDate ? getEventsForDate(dropTargetDate) : []}
          initialTime={newEventTime}
          colors={colors}
          formatTime={formatTime}
          travelBufferMinutes={travelBufferMinutes}
          onConfirm={(hours, minutes) => handleTimeConfirm(hours, minutes)}
          onCancel={() => {
            setTimePickerVisible(false);
            setDraggingEvent(null);
            setDropTargetDate(null);
            setIsDragging(false);
            setTravelBufferMinutes(0);
          }}
        />

        {isDragging && !isPanDragging && (
          <View
            style={{
              position: 'absolute',
              top: 10,
              left: 0,
              right: 0,
              alignItems: 'center',
              zIndex: 1000,
            }}
          >
            <View
              style={{
                backgroundColor: colors.primary,
                paddingLeft: 20,
                paddingRight: 8,
                paddingVertical: 10,
                borderRadius: 24,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
                elevation: 5,
              }}
            >
              <Move size={16} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>
                Tap a date to reschedule
              </Text>
              <TouchableOpacity
                onPress={handleCancelDrag}
                style={{
                  backgroundColor: 'rgba(255,255,255,0.25)',
                  borderRadius: 14,
                  padding: 6,
                  marginLeft: 4,
                }}
              >
                <X size={14} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {isPanDragging && (
          <View
            style={{
              position: 'absolute',
              top: 10,
              left: 0,
              right: 0,
              alignItems: 'center',
              zIndex: 1000,
            }}
            pointerEvents="none"
          >
            <View
              style={{
                backgroundColor: colors.primary,
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 20,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
                elevation: 5,
              }}
            >
              <Move size={14} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>
                {hoveredDateStr ? 'Release to drop' : 'Drag to a date'}
              </Text>
            </View>
          </View>
        )}

        <DragGhost
          visible={dragGhostVisible}
          title={draggingEvent?.title || ''}
          time={draggingEvent ? formatTime(draggingEvent.start_time) : ''}
          translateX={dragGhostX}
          translateY={dragGhostY}
          colors={colors}
        />

        <DayEventCard
          visible={dayCardVisible}
          date={dayCardDate}
          events={dayCardDate ? getEventsForDate(dayCardDate) : []}
          cellOrigin={dayCardOrigin}
          colors={colors}
          formatTime={formatTime}
          onClose={handleCloseDayCard}
          onEventPress={(event) => {
            handleCloseDayCard();
            handleEditEvent(event);
          }}
          onAddEvent={(date) => {
            handleCloseDayCard();
            handleAddEvent(date);
          }}
          onNavigateDay={handleDayCardNavigate}
          getEventColor={getEventColor}
          getClientContact={getClientContactSync}
        />
      </View>
    </AnimatedTabContent>
  );
}

const EVENT_COLORS = [
  '#1B4D6E',
  '#2E7D52',
  '#C05621',
  '#6B46C1',
  '#B7791F',
  '#2C7A7B',
  '#C53030',
  '#2B6CB0',
];

const localStyles = StyleSheet.create({
  compactHeader: {
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 16,
  },
  compactHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  compactTabsInlineSmall: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 6,
    padding: 1,
  },
  compactTabSmall: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
  },
  compactTabSmallActive: {
    backgroundColor: '#1B4D6E',
  },
  compactTabSmallText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6B7280',
  },
  compactTabSmallTextActive: {
    color: '#fff',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  viewTabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  viewTabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  viewTabText: {
    fontSize: 12,
    fontWeight: '600',
  },
  calViewModeBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  calViewModeBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
  },
  calViewModeBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  monthTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
    paddingBottom: 4,
    gap: 4,
  },
  monthTitleText: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.5,
    textAlign: 'center',
    minWidth: 120,
  },
  dayStatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  } as any,
  dayStatValue: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  } as any,
  dayStatLabel: {
    fontSize: 10,
    fontWeight: '500',
  } as any,
  monthYearText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
    textAlign: 'center',
    marginTop: -2,
  },
  inlineSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 6,
    maxWidth: 130,
  },
  inlineSearchInput: {
    flex: 1,
    fontSize: 12,
    padding: 0,
    margin: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  } as any,
  compactMonthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingHorizontal: 0,
    gap: 6,
  },
  compactTodayBtn: {
    width: 26,
    height: 26,
    backgroundColor: '#1B4D6E',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactTodayBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  selectedDaySection: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  selectedDayLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  selectedDayNumber: {
    fontSize: 34,
    fontWeight: '300',
    lineHeight: 38,
  },
  selectedDayWeekday: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  selectedDayEmpty: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  selectedDayEmptyText: {
    fontSize: 13,
  },
  selectedDayEvents: {
    paddingHorizontal: 16,
    paddingTop: 6,
    gap: 0,
  },
  fullCalendarWrapper: {
    backgroundColor: 'transparent',
    paddingHorizontal: 4,
    paddingTop: 4,
  },
  flexDayCell: {
    minHeight: Platform.OS === 'web' ? 100 : 88,
  },
  collapsedStrip: {
    paddingHorizontal: 4,
    paddingTop: 6,
    paddingBottom: 0,
  },
  collapsedDayNames: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  collapsedDayNameCell: {
    flex: 1,
    alignItems: 'center',
  },
  collapsedDayNameText: {
    fontSize: 10,
    fontWeight: '600',
  },
  collapsedDayRow: {
    flexDirection: 'row',
  },
  collapsedDayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
    gap: 3,
  },
  collapsedDayNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapsedDayNumberText: {
    fontSize: 13,
    fontWeight: '600',
  },
  collapsedEventDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  collapsedHandle: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  collapsedHandlePill: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  calendarCollapsePillContainer: {
    alignItems: 'center',
    paddingVertical: Platform.OS === 'web' ? 14 : 8,
    paddingHorizontal: 40,
  },
  calendarCollapsePill: {
    width: Platform.OS === 'web' ? 60 : 40,
    height: Platform.OS === 'web' ? 6 : 4,
    borderRadius: 3,
  },
  calendarCollapsePillHint: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: '500',
    opacity: 0.7,
  },
  expandedViewSection: {
    backgroundColor: 'transparent',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  timeGridWrapper: {
    height: Platform.OS === 'web' ? 520 : 420,
  },
  eventBar: {
    borderLeftWidth: 3,
    borderLeftColor: '#1B4D6E',
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
    width: '100%',
  },
  eventBarText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1B4D6E',
  },
  multiDayBar: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    width: '100%',
    minHeight: 16,
  } as any,
  multiDayBarStart: {
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
    marginRight: -4,
    paddingRight: 0,
  } as any,
  multiDayBarEnd: {
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
    marginLeft: -4,
    paddingLeft: 4,
  } as any,
  multiDayBarMiddle: {
    borderRadius: 0,
    marginLeft: -4,
    marginRight: -4,
    paddingLeft: 4,
  } as any,
  multiDayBarText: {
    fontSize: 9,
    fontWeight: '700',
  },
  eventChip: {
    borderRadius: 3,
    paddingHorizontal: 3,
    paddingVertical: 1,
    width: '100%',
  },
  eventChipCompact: {
    paddingVertical: 1,
    paddingHorizontal: 3,
  },
  eventChipTextCompact: {
    fontSize: 9,
    color: '#fff',
    fontWeight: '600',
  },
  moreChipsText: {
    fontSize: 9,
    color: '#6B7280',
    fontWeight: '600',
    paddingLeft: 3,
    marginTop: 1,
  },
  simpleFabContainer: {
    position: 'absolute',
    bottom: 24,
    zIndex: 100,
  },
  simpleFab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1B4D6E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
});
