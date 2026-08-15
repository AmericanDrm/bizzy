import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Image,
  Linking,
} from 'react-native';
import {
  ChevronRight,
  Navigation,
  Clock,
  CircleCheck as CheckCircle,
  CalendarClock,
  DollarSign,
  MapPin,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { orgSupabase } from '@/lib/supabaseClient';
import { supabase, invokeFunction } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useToast } from '@/contexts/ToastContext';
import WorkflowAlerts from './WorkflowAlerts';
import WorkflowRescheduleModal from './WorkflowRescheduleModal';
import JobCompletionModal from './JobCompletionModal';
import AddressLink from './AddressLink';
import ClockInInfoSheet from './ClockInInfoSheet';

interface WorkflowEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  status: string;
  payment_status: string;
  amount: number | null;
  client_id: string | null;
  client_name: string | null;
  client_phone: string | null;
  client_email: string | null;
  location: string | null;
  address: string | null;
  job_type_id: string | null;
  invoice_id: string | null;
  line_items: any[];
  service_scope: string | null;
  description: string | null;
  assigned_to: string | null;
}

interface TodaysWorkflowProps {
  onRefresh?: () => void;
  getTabImage: (key: string, isDark: boolean) => any;
}

export default function TodaysWorkflow({ onRefresh, getTabImage }: TodaysWorkflowProps) {
  const [events, setEvents] = useState<WorkflowEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rescheduleEvent, setRescheduleEvent] = useState<WorkflowEvent | null>(null);
  const [completionEvent, setCompletionEvent] = useState<WorkflowEvent | null>(null);
  const [activeTimeEntry, setActiveTimeEntry] = useState<{ id: string; eventTitle?: string } | null>(null);
  const [clockInSheetEvent, setClockInSheetEvent] = useState<WorkflowEvent | null>(null);
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const { currentOrganization } = useOrganization();
  const { showToast } = useToast();
  const router = useRouter();

  const fetchTodaysEvents = useCallback(async () => {
    if (!currentOrganization?.id) return;
    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(startOfDay);
      endOfDay.setDate(endOfDay.getDate() + 1);

      const { data, error } = await orgSupabase
        .from('schedule_events')
        .select(`
          id, title, start_time, end_time, status, payment_status, amount,
          client_id, location, address, job_type_id, invoice_id,
          service_scope, description, assigned_to,
          clients(name, phone, email)
        `)
        .eq('organization_id', currentOrganization.id)
        .gte('start_time', startOfDay.toISOString())
        .lt('start_time', endOfDay.toISOString())
        .order('start_time', { ascending: true });

      if (error) throw error;

      const { data: lineItemsData } = await orgSupabase
        .from('schedule_event_line_items')
        .select('*')
        .in('schedule_event_id', (data || []).map((e: any) => e.id));

      const lineItemsMap: Record<string, any[]> = {};
      (lineItemsData || []).forEach((li: any) => {
        if (!lineItemsMap[li.schedule_event_id]) lineItemsMap[li.schedule_event_id] = [];
        lineItemsMap[li.schedule_event_id].push(li);
      });

      const mapped: WorkflowEvent[] = (data || []).map((e: any) => ({
        id: e.id,
        title: e.title,
        start_time: e.start_time,
        end_time: e.end_time,
        status: e.status || 'scheduled',
        payment_status: e.payment_status || 'unpaid',
        amount: e.amount,
        client_id: e.client_id,
        client_name: e.clients?.name || null,
        client_phone: e.clients?.phone || null,
        client_email: e.clients?.email || null,
        location: e.location,
        address: e.address,
        job_type_id: e.job_type_id,
        invoice_id: e.invoice_id,
        line_items: lineItemsMap[e.id] || [],
        service_scope: e.service_scope,
        description: e.description,
        assigned_to: e.assigned_to,
      }));

      setEvents(mapped);
    } catch (err) {
      console.error('Error fetching workflow events:', err);
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id]);

  const fetchActiveTimeEntry = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data } = await supabase
        .from('time_entries')
        .select('id, notes')
        .eq('user_id', user.id)
        .eq('is_clocked_in', true)
        .maybeSingle();
      if (data) {
        setActiveTimeEntry({ id: data.id, eventTitle: data.notes || undefined });
      } else {
        setActiveTimeEntry(null);
      }
    } catch {}
  }, [user?.id]);

  useEffect(() => {
    fetchTodaysEvents();
    fetchActiveTimeEntry();
  }, [fetchTodaysEvents, fetchActiveTimeEntry]);

  const completedCount = events.filter(e => e.status === 'completed').length;
  const totalCount = events.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const todaysEarnings = events
    .filter(e => e.status === 'completed' && e.payment_status === 'paid' && e.amount)
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  const getSmsChannel = async (): Promise<'native' | 'twilio'> => {
    if (!currentOrganization?.id) return 'native';
    try {
      const { data } = await supabase
        .from('business_settings')
        .select('sms_send_channel')
        .eq('organization_id', currentOrganization.id)
        .maybeSingle();
      return (data?.sms_send_channel as 'native' | 'twilio') || 'native';
    } catch {
      return 'native';
    }
  };

  const handleOnMyWay = async (event: WorkflowEvent) => {
    if (!event.client_phone) {
      showToast('No phone number on file for this client', 'warning');
      return;
    }
    setActionLoading(`omw-${event.id}`);
    try {
      const startTime = new Date(event.start_time);
      const timeStr = startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      const message = `Hi ${event.client_name || 'there'}! Just letting you know I'm on my way for your ${timeStr} appointment. See you soon!`;

      const channel = await getSmsChannel();
      if (channel === 'native') {
        const phoneNumber = event.client_phone.replace(/\D/g, '');
        const smsUrl = Platform.OS === 'ios'
          ? `sms:${phoneNumber}&body=${encodeURIComponent(message)}`
          : `sms:${phoneNumber}?body=${encodeURIComponent(message)}`;
        await Linking.openURL(smsUrl);
        showToast(`SMS app opened for ${event.client_name || 'client'}`, 'success');
      } else {
        const { error } = await invokeFunction('send-sms', {
          to: event.client_phone,
          body: message,
          organizationId: currentOrganization?.id,
        });
        if (error) throw new Error(error.message);
        showToast(`Notified ${event.client_name || 'client'} you're on the way`, 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to send notification', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  const handleNotifyNextClient = async (behindEventId: string) => {
    const behindIndex = events.findIndex(e => e.id === behindEventId);
    const nextEvent = events.slice(behindIndex + 1).find(e => e.status !== 'completed' && e.client_phone);

    if (!nextEvent) {
      showToast('No upcoming client with a phone number to notify', 'warning');
      setDismissedAlerts(prev => new Set(prev).add(`behind-${behindEventId}`));
      return;
    }

    setActionLoading(`notify-${behindEventId}`);
    try {
      const startTime = new Date(nextEvent.start_time);
      const timeStr = startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      const message = `Hi ${nextEvent.client_name || 'there'}! We wanted to let you know we are running a bit behind schedule for your ${timeStr} appointment. We will be there as soon as possible — thank you for your patience!`;

      const channel = await getSmsChannel();
      if (channel === 'native') {
        const phoneNumber = nextEvent.client_phone!.replace(/\D/g, '');
        const smsUrl = Platform.OS === 'ios'
          ? `sms:${phoneNumber}&body=${encodeURIComponent(message)}`
          : `sms:${phoneNumber}?body=${encodeURIComponent(message)}`;
        await Linking.openURL(smsUrl);
        showToast(`SMS app opened for ${nextEvent.client_name || 'next client'}`, 'success');
      } else {
        const { error } = await invokeFunction('send-sms', {
          to: nextEvent.client_phone,
          body: message,
          organizationId: currentOrganization?.id,
        });
        if (error) throw new Error(error.message);
        showToast(`Notified ${nextEvent.client_name || 'next client'} about the delay`, 'success');
      }
      setDismissedAlerts(prev => new Set(prev).add(`behind-${behindEventId}`));
    } catch (err: any) {
      showToast(err.message || 'Failed to send notification', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDismissAlert = (alertId: string) => {
    setDismissedAlerts(prev => new Set(prev).add(alertId));
  };

  const handleClockIn = async (event: WorkflowEvent) => {
    setActionLoading(`clock-${event.id}`);
    try {
      const { error } = await orgSupabase
        .from('time_entries')
        .insert({
          user_id: user?.id,
          clock_in: new Date().toISOString(),
          is_clocked_in: true,
          notes: event.title,
          location_tracking_enabled: false,
        });
      if (error) throw error;
      setActiveTimeEntry({ id: 'new', eventTitle: event.title });
      showToast(`Clocked in for ${event.title}`, 'success');
      await fetchActiveTimeEntry();
      setClockInSheetEvent(event);
    } catch (err: any) {
      showToast(err.message || 'Failed to clock in', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleComplete = (event: WorkflowEvent) => {
    setCompletionEvent(event);
  };

  const handleReschedule = (event: WorkflowEvent) => {
    setRescheduleEvent(event);
  };

  const handleRescheduleConfirm = async (newDate: string) => {
    if (!rescheduleEvent) return;
    setActionLoading(`resched-${rescheduleEvent.id}`);
    try {
      const oldStart = new Date(rescheduleEvent.start_time);
      const oldEnd = new Date(rescheduleEvent.end_time);
      const duration = oldEnd.getTime() - oldStart.getTime();

      const newStart = new Date(newDate);
      newStart.setHours(oldStart.getHours(), oldStart.getMinutes(), 0, 0);
      const newEnd = new Date(newStart.getTime() + duration);

      const { error } = await orgSupabase
        .from('schedule_events')
        .update({
          start_time: newStart.toISOString(),
          end_time: newEnd.toISOString(),
        })
        .eq('id', rescheduleEvent.id);

      if (error) throw error;
      showToast('Job rescheduled', 'success');
      setRescheduleEvent(null);
      fetchTodaysEvents();
      onRefresh?.();
    } catch (err: any) {
      showToast(err.message || 'Failed to reschedule', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCompletionDone = () => {
    setCompletionEvent(null);
    fetchTodaysEvents();
    onRefresh?.();
  };

  const formatTime = (isoStr: string) => {
    const d = new Date(isoStr);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const getStatusColor = (status: string) => {
    if (status === 'completed') return colors.success;
    return colors.primary;
  };

  const isCurrentJob = (event: WorkflowEvent) => {
    const now = new Date();
    const start = new Date(event.start_time);
    const end = new Date(event.end_time);
    return event.status !== 'completed' && now >= start && now <= end;
  };

  const ds = getDynamicStyles(colors, isDark);

  if (loading) {
    return (
      <View style={ds.container}>
        <View style={ds.header}>
          <Text style={ds.title}>Today's Workflow</Text>
        </View>
        <View style={ds.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (events.length === 0) {
    return (
      <View style={ds.container}>
        <View style={ds.header}>
          <Text style={ds.title}>Today's Workflow</Text>
          <TouchableOpacity
            style={ds.seeAllBtn}
            onPress={() => router.push('/(tabs)/schedule')}
          >
            <Text style={ds.seeAllText}>Schedule</Text>
            <ChevronRight size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>
        <View style={ds.emptyState}>
          <Image
            source={getTabImage('schedule', isDark)}
            resizeMode="contain"
            style={[{ width: 44, height: 44 }, isDark && Platform.OS === 'web' && { mixBlendMode: 'lighten' as any }]}
          />
          <Text style={ds.emptyText}>No jobs scheduled for today</Text>
          <TouchableOpacity
            style={ds.emptyButton}
            onPress={() => router.push('/(tabs)/schedule')}
          >
            <Text style={ds.emptyButtonText}>Add a Job</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={ds.container}>
      <View style={ds.header}>
        <Text style={ds.title}>Today's Workflow</Text>
        <TouchableOpacity
          style={ds.seeAllBtn}
          onPress={() => router.push('/(tabs)/schedule')}
        >
          <Text style={ds.seeAllText}>See All</Text>
          <ChevronRight size={16} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={ds.progressSection}>
        <View style={ds.progressRow}>
          <Text style={ds.progressLabel}>
            {completedCount} of {totalCount} jobs done
          </Text>
          {todaysEarnings > 0 && (
            <View style={ds.earningsChip}>
              <DollarSign size={12} color={colors.success} />
              <Text style={ds.earningsText}>${todaysEarnings.toFixed(0)} earned</Text>
            </View>
          )}
        </View>
        <View style={ds.progressTrack}>
          <View style={[ds.progressFill, { width: `${progressPercent}%` as any }]} />
        </View>
      </View>

      <WorkflowAlerts
        events={events}
        activeTimeEntry={activeTimeEntry}
        onDismiss={handleDismissAlert}
        onNotifyNextClient={handleNotifyNextClient}
        dismissedAlerts={dismissedAlerts}
      />

      {events.map((event, index) => {
        const current = isCurrentJob(event);
        const completed = event.status === 'completed';
        const isPaid = event.payment_status === 'paid';

        return (
          <TouchableOpacity
            key={event.id}
            activeOpacity={0.85}
            onPress={() => router.push('/(tabs)/schedule')}
            style={[
              ds.jobCard,
              current && ds.jobCardCurrent,
              completed && ds.jobCardCompleted,
            ]}
          >
            <View style={ds.timeline}>
              <View style={[ds.timelineDot, { backgroundColor: completed ? colors.success : current ? colors.warning : colors.primary }]} />
              {index < events.length - 1 && <View style={ds.timelineLine} />}
            </View>

            <View style={ds.jobContent}>
              <View style={ds.jobHeader}>
                <View style={ds.jobHeaderLeft}>
                  <Text style={[ds.jobTime, completed && ds.jobTimeCompleted]}>
                    {formatTime(event.start_time)}
                  </Text>
                  {completed && (
                    <View style={ds.completedBadge}>
                      <CheckCircle size={10} color="#fff" />
                      <Text style={ds.completedBadgeText}>Done</Text>
                    </View>
                  )}
                  {isPaid && completed && (
                    <View style={ds.paidBadge}>
                      <DollarSign size={10} color="#fff" />
                      <Text style={ds.paidBadgeText}>Paid</Text>
                    </View>
                  )}
                  {current && (
                    <View style={ds.currentBadge}>
                      <Text style={ds.currentBadgeText}>Now</Text>
                    </View>
                  )}
                </View>
                {event.amount != null && (
                  <Text style={ds.jobAmount}>${event.amount.toFixed(0)}</Text>
                )}
              </View>

              <Text style={[ds.jobTitle, completed && ds.jobTitleCompleted]} numberOfLines={1}>
                {event.title}
              </Text>

              {(event.client_name || event.address) && (
                <View style={ds.jobMeta}>
                  {event.client_name && (
                    <Text style={ds.jobClient} numberOfLines={1}>{event.client_name}</Text>
                  )}
                  {event.address && (
                    <View style={ds.locationRow}>
                      <MapPin size={11} color={colors.textSecondary} />
                      <AddressLink
                        address={event.address}
                        textStyle={[ds.jobLocation, { color: colors.primary }]}
                        numberOfLines={1}
                      />
                    </View>
                  )}
                </View>
              )}

              {!completed && (
                <View style={ds.actionRow}>
                  <TouchableOpacity
                    style={[ds.actionBtn, ds.actionBtnOnMyWay]}
                    onPress={() => handleOnMyWay(event)}
                    disabled={actionLoading === `omw-${event.id}`}
                  >
                    {actionLoading === `omw-${event.id}` ? (
                      <ActivityIndicator size="small" color="#1B4D6E" />
                    ) : (
                      <>
                        <Navigation size={13} color="#1B4D6E" />
                        <Text style={ds.actionTextOnMyWay}>On My Way</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[ds.actionBtn, ds.actionBtnClock]}
                    onPress={() => handleClockIn(event)}
                    disabled={actionLoading === `clock-${event.id}` || !!activeTimeEntry}
                  >
                    {actionLoading === `clock-${event.id}` ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <>
                        <Clock size={13} color={colors.primary} />
                        <Text style={[ds.actionTextClock, { color: colors.primary }]}>Clock In</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[ds.actionBtn, ds.actionBtnComplete]}
                    onPress={() => handleComplete(event)}
                  >
                    <CheckCircle size={13} color="#fff" />
                    <Text style={ds.actionTextComplete}>Complete</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[ds.actionBtn, ds.actionBtnReschedule]}
                    onPress={() => handleReschedule(event)}
                    disabled={actionLoading === `resched-${event.id}`}
                  >
                    <CalendarClock size={13} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </TouchableOpacity>
        );
      })}

      <WorkflowRescheduleModal
        visible={!!rescheduleEvent}
        eventTitle={rescheduleEvent?.title || ''}
        currentDate={rescheduleEvent?.start_time || new Date().toISOString()}
        onConfirm={handleRescheduleConfirm}
        onCancel={() => setRescheduleEvent(null)}
      />

      <JobCompletionModal
        visible={!!completionEvent}
        event={completionEvent ? {
          id: completionEvent.id,
          title: completionEvent.title,
          description: completionEvent.description,
          start_time: completionEvent.start_time,
          end_time: completionEvent.end_time,
          location: completionEvent.location || undefined,
          client_id: completionEvent.client_id,
          client: completionEvent.client_name ? { name: completionEvent.client_name } : null,
          amount: completionEvent.amount || undefined,
          payment_status: completionEvent.payment_status,
          line_items: completionEvent.line_items,
          job_type_id: completionEvent.job_type_id || undefined,
          service_scope: completionEvent.service_scope || undefined,
          assigned_to: completionEvent.assigned_to || null,
        } : null}
        onClose={() => setCompletionEvent(null)}
        onComplete={handleCompletionDone}
      />

      <ClockInInfoSheet
        visible={!!clockInSheetEvent}
        firstEvent={clockInSheetEvent}
        allEvents={events}
        onClose={() => setClockInSheetEvent(null)}
      />
    </View>
  );
}

const getDynamicStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      marginBottom: 24,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      letterSpacing: -0.2,
    },
    seeAllBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    seeAllText: {
      fontSize: 14,
      color: colors.primary,
      fontWeight: '500',
    },
    loadingContainer: {
      padding: 24,
      alignItems: 'center',
      backgroundColor: colors.inputBackground,
      borderRadius: 8,
    },
    emptyState: {
      alignItems: 'center',
      padding: 24,
      backgroundColor: colors.inputBackground,
      borderRadius: 8,
    },
    emptyText: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 12,
    },
    emptyButton: {
      marginTop: 16,
      paddingHorizontal: 24,
      paddingVertical: 12,
      backgroundColor: colors.primary,
      borderRadius: 8,
    },
    emptyButtonText: {
      color: '#fff',
      fontWeight: '600',
      fontSize: 14,
    },
    progressSection: {
      backgroundColor: colors.inputBackground,
      borderRadius: 8,
      padding: 12,
      marginBottom: 8,
    },
    progressRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    progressLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    earningsChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: colors.successBackground,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 12,
    },
    earningsText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.success,
    },
    progressTrack: {
      height: 6,
      backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB',
      borderRadius: 3,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.success,
      borderRadius: 3,
    },
    jobCard: {
      flexDirection: 'row',
      marginBottom: 4,
    },
    jobCardCurrent: {},
    jobCardCompleted: {
      opacity: 0.7,
    },
    timeline: {
      width: 24,
      alignItems: 'center',
      paddingTop: 6,
    },
    timelineDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    timelineLine: {
      width: 2,
      flex: 1,
      backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB',
      marginTop: 4,
    },
    jobContent: {
      flex: 1,
      backgroundColor: colors.inputBackground,
      borderRadius: 8,
      padding: 10,
      marginBottom: 6,
    },
    jobHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    jobHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    jobTime: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    jobTimeCompleted: {
      textDecorationLine: 'line-through',
    },
    completedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: colors.success,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 8,
    },
    completedBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: '#fff',
    },
    paidBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      backgroundColor: '#1B4D6E',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 8,
    },
    paidBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: '#fff',
    },
    currentBadge: {
      backgroundColor: '#d97706',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
    },
    currentBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: '#fff',
    },
    jobAmount: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    jobTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    jobTitleCompleted: {
      textDecorationLine: 'line-through',
      color: colors.textSecondary,
    },
    jobMeta: {
      marginBottom: 10,
      gap: 2,
    },
    jobClient: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    locationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    jobLocation: {
      fontSize: 12,
      color: colors.textSecondary,
      flex: 1,
    },
    actionRow: {
      flexDirection: 'row',
      gap: 6,
      flexWrap: 'wrap',
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 8,
    },
    actionBtnOnMyWay: {
      backgroundColor: isDark ? 'rgba(27,77,110,0.2)' : '#EAF2F8',
    },
    actionBtnClock: {
      backgroundColor: isDark ? 'rgba(58,154,217,0.15)' : colors.primaryLight,
    },
    actionBtnComplete: {
      backgroundColor: colors.success,
    },
    actionBtnReschedule: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6',
    },
    actionTextOnMyWay: {
      fontSize: 12,
      fontWeight: '600',
      color: '#1B4D6E',
    },
    actionTextClock: {
      fontSize: 12,
      fontWeight: '600',
    },
    actionTextComplete: {
      fontSize: 12,
      fontWeight: '600',
      color: '#fff',
    },
  });
