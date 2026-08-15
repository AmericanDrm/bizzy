import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Modal,
} from 'react-native';
import { Building2, MapPin, Calendar, CircleCheck as CheckCircle2, CircleAlert as AlertCircle, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, PartyPopper, CalendarPlus, Repeat, Clock, X } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';

interface CommercialAddress {
  id: string;
  label: string;
  address: string;
  client_id: string;
  target_week_of_month: number | null;
  preferred_day: string | null;
  service_window_start: string | null;
  service_window_end: string | null;
  use_client_service_window: boolean;
  typical_job_duration: number | null;
  service_frequency: string | null;
  custom_frequency_days: number | null;
  last_serviced_date: string | null;
  latitude: number | null;
  longitude: number | null;
  address_type: string | null;
}

interface CommercialClient {
  id: string;
  name: string;
  commercial_service_window_start: string | null;
  commercial_service_window_end: string | null;
}

interface ServiceWindowInfo {
  window_start: string;
  window_end: string;
  days_of_week: string[];
}

interface CommercialJob {
  addressId: string;
  addressLabel: string;
  address: string;
  clientId: string;
  clientName: string;
  targetWeek: number | null;
  preferredDay: string | null;
  serviceFrequency: string | null;
  serviceWindows: ServiceWindowInfo[];
  scheduled: boolean;
  eventDate?: string;
  typicalDuration: number | null;
  latitude: number | null;
  longitude: number | null;
}

interface CommercialJobsPanelProps {
  currentDate: Date;
  onRefreshNeeded?: () => void;
  refreshKey?: number;
}

interface ExistingEvent {
  start_time: string;
  end_time: string;
}

const WEEK_LABELS: Record<number, string> = {
  1: '1st week',
  2: '2nd week',
  3: '3rd week',
  4: '4th week',
};

const FREQUENCY_LABELS: Record<string, string> = {
  'weekly': 'Weekly',
  'bi-weekly': 'Bi-Weekly',
  'monthly': 'Monthly',
  'quarterly': 'Quarterly',
  'bi-annually': 'Bi-Annual',
  'annually': 'Annual',
  'custom': 'Custom',
};

const DAY_ABBREV: Record<string, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
  friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
};

const DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const DEFAULT_WORK_START = 8;
const DEFAULT_WORK_END = 17;
const DEFAULT_DURATION_MINUTES = 60;

function formatTime12(time24: string): string {
  if (!time24) return '';
  const [hours, minutes] = time24.split(':').map(Number);
  let h = hours % 12;
  if (h === 0) h = 12;
  return `${h}:${(minutes || 0).toString().padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;
}

function formatWindowCompact(sw: ServiceWindowInfo): string {
  const time = `${formatTime12(sw.window_start)}-${formatTime12(sw.window_end)}`;
  if (sw.days_of_week.length === 0 || sw.days_of_week.length === 7) return time;
  const days = sw.days_of_week.map(d => DAY_ABBREV[d] || d.slice(0, 3)).join(', ');
  return `${days}: ${time}`;
}

function isAddressDueThisMonth(
  frequency: string | null,
  customDays: number | null,
  lastServiced: string | null,
  monthStart: Date,
  monthEnd: Date,
): boolean {
  if (!frequency) return true;
  if (!lastServiced) return true;

  const lastDate = new Date(lastServiced + 'T12:00:00');
  if (isNaN(lastDate.getTime())) return true;

  let nextDueDate: Date;

  switch (frequency) {
    case 'weekly':
      nextDueDate = new Date(lastDate);
      nextDueDate.setDate(nextDueDate.getDate() + 7);
      break;
    case 'bi-weekly':
      nextDueDate = new Date(lastDate);
      nextDueDate.setDate(nextDueDate.getDate() + 14);
      break;
    case 'monthly':
      nextDueDate = new Date(lastDate);
      nextDueDate.setMonth(nextDueDate.getMonth() + 1);
      break;
    case 'quarterly':
      nextDueDate = new Date(lastDate);
      nextDueDate.setMonth(nextDueDate.getMonth() + 3);
      break;
    case 'bi-annually':
      nextDueDate = new Date(lastDate);
      nextDueDate.setMonth(nextDueDate.getMonth() + 6);
      break;
    case 'annually':
      nextDueDate = new Date(lastDate);
      nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
      break;
    case 'custom':
      nextDueDate = new Date(lastDate);
      nextDueDate.setDate(nextDueDate.getDate() + (customDays || 30));
      break;
    default:
      return true;
  }

  return nextDueDate <= monthEnd;
}

function getDaysInMonth(year: number, month: number): (Date | null)[] {
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
}

function findBestTimeSlot(
  existingEvents: ExistingEvent[],
  targetDate: Date,
  durationMinutes: number,
  serviceWindows: ServiceWindowInfo[],
): { start: Date; end: Date } {
  const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][targetDate.getDay()];

  let workStartHour = DEFAULT_WORK_START;
  let workStartMin = 0;
  let workEndHour = DEFAULT_WORK_END;
  let workEndMin = 0;

  const applicableWindow = serviceWindows.find(sw => {
    if (sw.days_of_week.length === 0) return true;
    return sw.days_of_week.includes(dayName);
  });

  if (applicableWindow) {
    const [sh, sm] = applicableWindow.window_start.split(':').map(Number);
    const [eh, em] = applicableWindow.window_end.split(':').map(Number);
    if (!isNaN(sh)) workStartHour = sh;
    if (!isNaN(sm)) workStartMin = sm;
    if (!isNaN(eh)) workEndHour = eh;
    if (!isNaN(em)) workEndMin = em;
  }

  const dayStart = new Date(targetDate);
  dayStart.setHours(workStartHour, workStartMin, 0, 0);
  const dayEnd = new Date(targetDate);
  dayEnd.setHours(workEndHour, workEndMin, 0, 0);

  const sorted = existingEvents
    .map(ev => ({
      start: new Date(ev.start_time),
      end: new Date(ev.end_time),
    }))
    .filter(ev => {
      const evDay = ev.start.toDateString();
      return evDay === targetDate.toDateString();
    })
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const durationMs = durationMinutes * 60 * 1000;

  if (sorted.length === 0) {
    return {
      start: new Date(dayStart),
      end: new Date(dayStart.getTime() + durationMs),
    };
  }

  const firstEventStart = sorted[0].start.getTime();
  if (firstEventStart - dayStart.getTime() >= durationMs) {
    return {
      start: new Date(dayStart),
      end: new Date(dayStart.getTime() + durationMs),
    };
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const gapStart = sorted[i].end.getTime();
    const gapEnd = sorted[i + 1].start.getTime();
    if (gapEnd - gapStart >= durationMs) {
      return {
        start: new Date(gapStart),
        end: new Date(gapStart + durationMs),
      };
    }
  }

  const lastEventEnd = sorted[sorted.length - 1].end.getTime();
  if (dayEnd.getTime() - lastEventEnd >= durationMs) {
    return {
      start: new Date(lastEventEnd),
      end: new Date(lastEventEnd + durationMs),
    };
  }

  return {
    start: new Date(lastEventEnd),
    end: new Date(lastEventEnd + durationMs),
  };
}

export default function CommercialJobsPanel({ currentDate, onRefreshNeeded, refreshKey }: CommercialJobsPanelProps) {
  const [jobs, setJobs] = useState<CommercialJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [schedulingJob, setSchedulingJob] = useState<CommercialJob | null>(null);
  const [pickerMonth, setPickerMonth] = useState<Date>(currentDate);
  const [addingToSchedule, setAddingToSchedule] = useState(false);
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const { colors } = useTheme();
  const { showToast } = useToast();

  const monthStart = useMemo(() => {
    const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    return d.toISOString().split('T')[0];
  }, [currentDate]);

  const monthEnd = useMemo(() => {
    const d = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    return d.toISOString().split('T')[0];
  }, [currentDate]);

  const monthLabel = useMemo(() => {
    return currentDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  }, [currentDate]);

  const fetchCommercialJobs = useCallback(async () => {
    if (!currentOrganization?.id) return;
    setLoading(true);

    try {
      const [clientsRes, allClientsRes, addressesRes, eventsRes, windowsRes] = await Promise.all([
        supabase
          .from('clients')
          .select('id, name, commercial_service_window_start, commercial_service_window_end')
          .eq('organization_id', currentOrganization.id)
          .eq('client_type', 'commercial'),
        supabase
          .from('clients')
          .select('id, name, client_type, commercial_service_window_start, commercial_service_window_end')
          .eq('organization_id', currentOrganization.id),
        supabase
          .from('client_addresses')
          .select('id, label, address, client_id, target_week_of_month, preferred_day, service_window_start, service_window_end, use_client_service_window, typical_job_duration, service_frequency, custom_frequency_days, last_serviced_date, latitude, longitude, address_type')
          .eq('organization_id', currentOrganization.id),
        supabase
          .from('schedule_events')
          .select('id, client_id, client_address_id, location, start_time, is_recurring')
          .eq('organization_id', currentOrganization.id)
          .gte('start_time', monthStart + 'T00:00:00')
          .lte('start_time', monthEnd + 'T23:59:59'),
        supabase
          .from('client_address_service_windows')
          .select('client_address_id, window_start, window_end, days_of_week')
          .eq('organization_id', currentOrganization.id)
          .order('sort_order', { ascending: true }),
      ]);

      if (clientsRes.error || addressesRes.error || eventsRes.error) {
        setLoading(false);
        return;
      }

      const commercialClients: CommercialClient[] = clientsRes.data || [];
      const commercialClientIds = new Set(commercialClients.map(c => c.id));
      const allClientsMap = new Map((allClientsRes.data || []).map((c: any) => [c.id, c]));

      const hasCommercialScheduling = (a: any) =>
        !!(a.service_frequency || a.target_week_of_month || a.preferred_day);

      const allAddresses: CommercialAddress[] = (addressesRes.data || []).filter(
        (a: any) =>
          commercialClientIds.has(a.client_id) ||
          (a.address_type === 'commercial' && hasCommercialScheduling(a))
      );
      const events = eventsRes.data || [];

      const windowsByAddr = new Map<string, ServiceWindowInfo[]>();
      for (const w of (windowsRes.data || [])) {
        const list = windowsByAddr.get(w.client_address_id) || [];
        list.push({ window_start: w.window_start, window_end: w.window_end, days_of_week: w.days_of_week || [] });
        windowsByAddr.set(w.client_address_id, list);
      }

      const eventsByAddressId = new Map<string, string>();
      const eventsByClientId = new Map<string, { locations: Set<string>; dates: string[]; count: number }>();
      for (const ev of events) {
        if (!ev.client_id) continue;
        if (!eventsByClientId.has(ev.client_id)) {
          eventsByClientId.set(ev.client_id, { locations: new Set(), dates: [], count: 0 });
        }
        const entry = eventsByClientId.get(ev.client_id)!;
        const loc = (ev.location || '').toLowerCase().trim();
        if (loc) entry.locations.add(loc);
        const dateStr = ev.start_time?.split('T')[0] || '';
        entry.dates.push(dateStr);
        entry.count++;
        if (ev.client_address_id) {
          eventsByAddressId.set(ev.client_address_id, dateStr);
        }
      }

      const addressCountByClient = new Map<string, number>();
      for (const addr of allAddresses) {
        addressCountByClient.set(addr.client_id, (addressCountByClient.get(addr.client_id) || 0) + 1);
      }

      const mStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const mEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      const result: CommercialJob[] = [];
      for (const addr of allAddresses) {
        const client = commercialClients.find(c => c.id === addr.client_id) ||
          (allClientsMap.get(addr.client_id) as CommercialClient | undefined);
        if (!client) continue;

        if (!isAddressDueThisMonth(
          addr.service_frequency,
          addr.custom_frequency_days,
          addr.last_serviced_date,
          mStart,
          mEnd,
        )) continue;

        const addrLoc = (addr.address || '').toLowerCase().trim();
        const clientEntry = eventsByClientId.get(addr.client_id);

        const matchedByAddressId = eventsByAddressId.has(addr.id);

        let matchedByLocation = false;
        if (!matchedByAddressId && clientEntry) {
          for (const evLoc of clientEntry.locations) {
            if (evLoc === addrLoc || addrLoc.startsWith(evLoc) || evLoc.startsWith(addrLoc)) {
              matchedByLocation = true;
              break;
            }
          }
        }

        const clientAddrCount = addressCountByClient.get(addr.client_id) || 1;
        const matchedByClientOnly = !matchedByAddressId && !matchedByLocation &&
          clientAddrCount === 1 && !!clientEntry && clientEntry.count > 0;

        const isScheduled = matchedByAddressId || matchedByLocation || matchedByClientOnly;
        let eventDate: string | undefined;
        if (matchedByAddressId) {
          eventDate = eventsByAddressId.get(addr.id);
        } else if (clientEntry && clientEntry.dates.length > 0) {
          eventDate = clientEntry.dates[0];
        }

        result.push({
          addressId: addr.id,
          addressLabel: addr.label,
          address: addr.address,
          clientId: addr.client_id,
          clientName: client.name,
          targetWeek: addr.target_week_of_month,
          preferredDay: addr.preferred_day,
          serviceFrequency: addr.service_frequency,
          serviceWindows: windowsByAddr.get(addr.id) || [],
          scheduled: isScheduled,
          eventDate,
          typicalDuration: addr.typical_job_duration,
          latitude: addr.latitude,
          longitude: addr.longitude,
        });
      }

      setJobs(result);
    } catch (err) {
      console.error('CommercialJobsPanel fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id, monthStart, monthEnd, currentDate, refreshKey]);

  useEffect(() => {
    fetchCommercialJobs();
  }, [fetchCommercialJobs]);

  const handleAddToSchedule = useCallback((job: CommercialJob) => {
    setSchedulingJob(job);
    setPickerMonth(currentDate);
  }, [currentDate]);

  const handleDaySelected = useCallback(async (day: Date) => {
    if (!schedulingJob || !user?.id || !currentOrganization?.id) return;
    setAddingToSchedule(true);

    try {
      const dayStart = new Date(day);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);

      const { data: dayEvents } = await supabase
        .from('schedule_events')
        .select('start_time, end_time')
        .eq('organization_id', currentOrganization.id)
        .gte('start_time', dayStart.toISOString())
        .lte('start_time', dayEnd.toISOString());

      const duration = schedulingJob.typicalDuration || DEFAULT_DURATION_MINUTES;
      const slot = findBestTimeSlot(
        dayEvents || [],
        day,
        duration,
        schedulingJob.serviceWindows,
      );

      const { error } = await supabase
        .from('schedule_events')
        .insert({
          user_id: user.id,
          organization_id: currentOrganization.id,
          title: `${schedulingJob.clientName} — ${schedulingJob.addressLabel || 'Service'}`,
          start_time: slot.start.toISOString(),
          end_time: slot.end.toISOString(),
          location: schedulingJob.address,
          client_id: schedulingJob.clientId,
          client_address_id: schedulingJob.addressId,
          latitude: schedulingJob.latitude,
          longitude: schedulingJob.longitude,
          is_recurring: true,
          payment_status: 'unpaid',
        });

      if (error) throw error;

      showToast({
        message: `Scheduled ${schedulingJob.clientName} on ${day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at ${slot.start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`,
        type: 'success',
      });

      setSchedulingJob(null);
      fetchCommercialJobs();
      onRefreshNeeded?.();
    } catch (err: any) {
      showToast({
        message: err.message || 'Failed to schedule',
        type: 'error',
      });
    } finally {
      setAddingToSchedule(false);
    }
  }, [schedulingJob, user?.id, currentOrganization?.id, fetchCommercialJobs, onRefreshNeeded, showToast]);

  const scheduledJobs = useMemo(() => jobs.filter(j => j.scheduled), [jobs]);
  const unscheduledJobs = useMemo(() => jobs.filter(j => !j.scheduled), [jobs]);
  const allScheduled = jobs.length > 0 && unscheduledJobs.length === 0;

  const pickerDays = useMemo(() => {
    return getDaysInMonth(pickerMonth.getFullYear(), pickerMonth.getMonth());
  }, [pickerMonth]);

  const pickerMonthLabel = useMemo(() => {
    return pickerMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  }, [pickerMonth]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  if (loading) {
    return (
      <View style={[panelStyles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (jobs.length === 0) return null;

  return (
    <View style={[panelStyles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <TouchableOpacity
        style={panelStyles.header}
        onPress={() => setCollapsed(!collapsed)}
        activeOpacity={0.7}
      >
        <View style={panelStyles.headerLeft}>
          <Building2 size={16} color="#1B4D6E" />
          <Text style={panelStyles.headerTitle}>Commercial Jobs</Text>
          <View style={panelStyles.headerBadge}>
            <Text style={panelStyles.headerBadgeText}>{jobs.length}</Text>
          </View>
          {allScheduled && (
            <View style={panelStyles.allDoneBadge}>
              <CheckCircle2 size={12} color="#15803d" />
            </View>
          )}
        </View>
        <View style={panelStyles.headerRight}>
          <Text style={panelStyles.monthLabel}>{monthLabel}</Text>
          {collapsed
            ? <ChevronDown size={18} color="#6B7280" />
            : <ChevronUp size={18} color="#6B7280" />
          }
        </View>
      </TouchableOpacity>

      {!collapsed && (
        <>
          {allScheduled ? (
            <View style={panelStyles.successContainer}>
              <PartyPopper size={28} color="#15803d" />
              <Text style={panelStyles.successTitle}>Great Job!</Text>
              <Text style={panelStyles.successText}>
                Every commercial client is scheduled for {monthLabel}.
              </Text>
            </View>
          ) : (
            <View style={panelStyles.columnsRow}>
              <View style={panelStyles.column}>
                <View style={[panelStyles.columnHeader, { backgroundColor: 'rgba(220,252,231,0.6)' }]}>
                  <CheckCircle2 size={13} color="#15803d" />
                  <Text style={[panelStyles.columnHeaderText, { color: '#15803d' }]}>
                    Scheduled ({scheduledJobs.length})
                  </Text>
                </View>
                <ScrollView style={panelStyles.columnScroll} nestedScrollEnabled>
                  {scheduledJobs.length === 0 ? (
                    <Text style={panelStyles.emptyColumnText}>None scheduled yet</Text>
                  ) : (
                    scheduledJobs.map(job => (
                      <View
                        key={job.addressId}
                        style={[panelStyles.jobCard, { borderLeftColor: '#16a34a' }]}
                      >
                        <Text style={panelStyles.jobClientName} numberOfLines={1}>{job.clientName}</Text>
                        <View style={panelStyles.jobAddressRow}>
                          <MapPin size={10} color="#6B7280" />
                          <Text style={panelStyles.jobAddressText} numberOfLines={1}>
                            {job.addressLabel ? `${job.addressLabel}: ` : ''}{job.address}
                          </Text>
                        </View>
                        <View style={panelStyles.jobMetaRow}>
                          {job.serviceFrequency && (
                            <View style={[panelStyles.jobMetaPill, { backgroundColor: 'rgba(21,128,61,0.08)' }]}>
                              <Repeat size={8} color="#15803d" />
                              <Text style={[panelStyles.jobMetaPillText, { color: '#15803d' }]}>
                                {FREQUENCY_LABELS[job.serviceFrequency] || job.serviceFrequency}
                              </Text>
                            </View>
                          )}
                          {job.eventDate && (
                            <Text style={panelStyles.jobDateText}>
                              {new Date(job.eventDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </Text>
                          )}
                        </View>
                        {job.serviceWindows.length > 0 && (
                          <View style={panelStyles.windowsContainer}>
                            {job.serviceWindows.map((sw, swIdx) => (
                              <View key={swIdx} style={panelStyles.windowPill}>
                                <Clock size={8} color="#6B7280" />
                                <Text style={panelStyles.windowPillText}>{formatWindowCompact(sw)}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    ))
                  )}
                </ScrollView>
              </View>

              <View style={panelStyles.column}>
                <View style={[panelStyles.columnHeader, { backgroundColor: 'rgba(254,226,226,0.6)' }]}>
                  <AlertCircle size={13} color="#dc2626" />
                  <Text style={[panelStyles.columnHeaderText, { color: '#dc2626' }]}>
                    Unscheduled ({unscheduledJobs.length})
                  </Text>
                </View>
                <ScrollView style={panelStyles.columnScroll} nestedScrollEnabled>
                  {unscheduledJobs.length === 0 ? (
                    <Text style={panelStyles.emptyColumnText}>All scheduled</Text>
                  ) : (
                    unscheduledJobs.map(job => (
                      <View
                        key={job.addressId}
                        style={[panelStyles.jobCard, { borderLeftColor: '#dc2626' }]}
                      >
                        <Text style={panelStyles.jobClientName} numberOfLines={1}>{job.clientName}</Text>
                        <View style={panelStyles.jobAddressRow}>
                          <MapPin size={10} color="#6B7280" />
                          <Text style={panelStyles.jobAddressText} numberOfLines={1}>
                            {job.addressLabel ? `${job.addressLabel}: ` : ''}{job.address}
                          </Text>
                        </View>
                        <View style={panelStyles.jobMetaRow}>
                          {job.serviceFrequency && (
                            <View style={[panelStyles.jobMetaPill, { backgroundColor: 'rgba(27,77,110,0.08)' }]}>
                              <Repeat size={8} color="#1B4D6E" />
                              <Text style={[panelStyles.jobMetaPillText, { color: '#1B4D6E' }]}>
                                {FREQUENCY_LABELS[job.serviceFrequency] || job.serviceFrequency}
                              </Text>
                            </View>
                          )}
                          {job.targetWeek && (
                            <View style={panelStyles.jobMetaPill}>
                              <Calendar size={9} color="#dc2626" />
                              <Text style={[panelStyles.jobMetaPillText, { color: '#dc2626' }]}>
                                {WEEK_LABELS[job.targetWeek]}
                              </Text>
                            </View>
                          )}
                          {job.preferredDay && (
                            <View style={panelStyles.jobMetaPill}>
                              <Text style={[panelStyles.jobMetaPillText, { color: '#dc2626' }]}>
                                {job.preferredDay.charAt(0).toUpperCase() + job.preferredDay.slice(1, 3)}
                              </Text>
                            </View>
                          )}
                        </View>
                        {job.serviceWindows.length > 0 && (
                          <View style={panelStyles.windowsContainer}>
                            {job.serviceWindows.map((sw, swIdx) => (
                              <View key={swIdx} style={panelStyles.windowPill}>
                                <Clock size={8} color="#6B7280" />
                                <Text style={panelStyles.windowPillText}>{formatWindowCompact(sw)}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                        <TouchableOpacity
                          style={panelStyles.addToScheduleButton}
                          onPress={() => handleAddToSchedule(job)}
                          activeOpacity={0.7}
                        >
                          <CalendarPlus size={10} color="#1B4D6E" />
                          <Text style={panelStyles.addToScheduleText}>Add to Schedule</Text>
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </ScrollView>
              </View>
            </View>
          )}
        </>
      )}

      <Modal
        visible={!!schedulingJob}
        transparent
        animationType="fade"
        onRequestClose={() => setSchedulingJob(null)}
      >
        <TouchableOpacity
          style={pickerStyles.overlay}
          activeOpacity={1}
          onPress={() => setSchedulingJob(null)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={[pickerStyles.modal, { backgroundColor: colors.surface }]}
          >
            <View style={pickerStyles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[pickerStyles.modalTitle, { color: colors.text }]}>
                  Schedule Job
                </Text>
                {schedulingJob && (
                  <Text style={[pickerStyles.modalSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                    {schedulingJob.clientName} — {schedulingJob.addressLabel || schedulingJob.address}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                onPress={() => setSchedulingJob(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[pickerStyles.instruction, { color: colors.textSecondary }]}>
              Tap a day to auto-schedule at the best available time
            </Text>

            <View style={pickerStyles.monthNav}>
              <TouchableOpacity
                onPress={() => setPickerMonth(new Date(pickerMonth.getFullYear(), pickerMonth.getMonth() - 1, 1))}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <ChevronLeft size={18} color={colors.text} />
              </TouchableOpacity>
              <Text style={[pickerStyles.monthNavText, { color: colors.text }]}>
                {pickerMonthLabel}
              </Text>
              <TouchableOpacity
                onPress={() => setPickerMonth(new Date(pickerMonth.getFullYear(), pickerMonth.getMonth() + 1, 1))}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <ChevronRight size={18} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={pickerStyles.dayHeaderRow}>
              {DAY_HEADERS.map(d => (
                <View key={d} style={pickerStyles.dayHeaderCell}>
                  <Text style={[pickerStyles.dayHeaderText, { color: colors.textSecondary }]}>{d}</Text>
                </View>
              ))}
            </View>

            <View>
              {Array.from({ length: Math.ceil(pickerDays.length / 7) }).map((_, weekIdx) => (
                <View key={weekIdx} style={pickerStyles.weekRow}>
                  {pickerDays.slice(weekIdx * 7, weekIdx * 7 + 7).map((day, dayIdx) => {
                    const isPast = day ? day < today : false;
                    const isToday = day ? day.toDateString() === today.toDateString() : false;

                    return (
                      <TouchableOpacity
                        key={dayIdx}
                        style={[
                          pickerStyles.dayCell,
                          isToday && pickerStyles.todayCell,
                          isPast && pickerStyles.pastDay,
                        ]}
                        disabled={!day || isPast || addingToSchedule}
                        onPress={() => day && handleDaySelected(day)}
                        activeOpacity={0.6}
                      >
                        {day && (
                          <Text style={[
                            pickerStyles.dayText,
                            { color: colors.text },
                            isToday && pickerStyles.todayText,
                            isPast && { color: colors.textSecondary, opacity: 0.4 },
                          ]}>
                            {day.getDate()}
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>

            {addingToSchedule && (
              <View style={pickerStyles.loadingOverlay}>
                <ActivityIndicator size="small" color="#1B4D6E" />
                <Text style={[pickerStyles.loadingText, { color: colors.textSecondary }]}>
                  Finding best time slot...
                </Text>
              </View>
            )}

            {schedulingJob && (
              <View style={[pickerStyles.jobInfoRow, { borderTopColor: colors.border }]}>
                {schedulingJob.typicalDuration && (
                  <View style={pickerStyles.infoPill}>
                    <Clock size={10} color="#1B4D6E" />
                    <Text style={pickerStyles.infoPillText}>{schedulingJob.typicalDuration}min</Text>
                  </View>
                )}
                {schedulingJob.serviceWindows.length > 0 && (
                  <View style={pickerStyles.infoPill}>
                    <Clock size={10} color="#1B4D6E" />
                    <Text style={pickerStyles.infoPillText}>{formatWindowCompact(schedulingJob.serviceWindows[0])}</Text>
                  </View>
                )}
                {schedulingJob.preferredDay && (
                  <View style={pickerStyles.infoPill}>
                    <Calendar size={10} color="#1B4D6E" />
                    <Text style={pickerStyles.infoPillText}>
                      Pref: {schedulingJob.preferredDay.charAt(0).toUpperCase() + schedulingJob.preferredDay.slice(1)}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const panelStyles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1B4D6E',
  },
  headerBadge: {
    backgroundColor: 'rgba(27,77,110,0.12)',
    minWidth: 20,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  headerBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1B4D6E',
  },
  allDoneBadge: {
    marginLeft: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  monthLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    gap: 6,
  },
  successTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#15803d',
    marginTop: 4,
  },
  successText: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },
  columnsRow: {
    flexDirection: 'row',
    gap: 1,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  column: {
    flex: 1,
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  columnHeaderText: {
    fontSize: 11,
    fontWeight: '700',
  },
  columnScroll: {
    maxHeight: 200,
    paddingHorizontal: 6,
    paddingTop: 4,
    paddingBottom: 8,
  },
  emptyColumnText: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 12,
    fontStyle: 'italic',
  },
  jobCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 8,
    marginBottom: 4,
    borderLeftWidth: 3,
    ...Platform.select({
      web: { boxShadow: '0 1px 2px rgba(0,0,0,0.04)' } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 2,
        elevation: 1,
      },
    }),
  },
  jobClientName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  jobAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  jobAddressText: {
    fontSize: 10,
    color: '#6B7280',
    flex: 1,
  },
  jobDateText: {
    fontSize: 10,
    color: '#15803d',
    fontWeight: '500',
    marginTop: 2,
  },
  jobMetaRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
  jobMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(220,38,38,0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  jobMetaPillText: {
    fontSize: 9,
    fontWeight: '600',
  },
  windowsContainer: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 3,
    marginTop: 3,
  },
  windowPill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 3,
    backgroundColor: 'rgba(107,114,128,0.08)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
  },
  windowPillText: {
    fontSize: 8,
    color: '#6B7280',
    fontWeight: '500' as const,
  },
  addToScheduleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(27,77,110,0.1)',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(27,77,110,0.2)',
  },
  addToScheduleText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#1B4D6E',
  },
});

const pickerStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 380,
    ...Platform.select({
      web: { boxShadow: '0 20px 60px rgba(0,0,0,0.3)' } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 10,
      },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  instruction: {
    fontSize: 12,
    marginBottom: 14,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  monthNavText: {
    fontSize: 15,
    fontWeight: '600',
  },
  dayHeaderRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  dayHeaderCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  dayHeaderText: {
    fontSize: 11,
    fontWeight: '600',
  },
  weekRow: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  todayCell: {
    backgroundColor: 'rgba(27,77,110,0.1)',
  },
  pastDay: {
    opacity: 0.4,
  },
  dayText: {
    fontSize: 14,
    fontWeight: '500',
  },
  todayText: {
    fontWeight: '700',
    color: '#1B4D6E',
  },
  loadingOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  loadingText: {
    fontSize: 12,
  },
  jobInfoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingTop: 12,
    marginTop: 12,
    borderTopWidth: 1,
  },
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(27,77,110,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  infoPillText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1B4D6E',
  },
});
