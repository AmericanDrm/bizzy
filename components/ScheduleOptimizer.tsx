import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Zap, Lock, LockOpen, ChevronLeft, ChevronRight, TriangleAlert as AlertTriangle, Check, ArrowRight } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/lib/supabase';
import JobLock from '@/components/JobLock';

type ViewScope = 'day' | 'week' | 'month';

interface ScheduleEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  location: string | null;
  is_locked: boolean;
  client?: { name: string } | null;
}

interface BusinessHours {
  [key: string]: { start: string | null; end: string | null };
}

const toDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const parseHHMM = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

const minutesBetween = (start: string, end: string) => {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return Math.max(0, Math.round((e - s) / 60000));
};

const formatTime = (iso: string) => {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
};

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const getDayHours = (hours: BusinessHours, dateStr: string): { startMin: number; endMin: number } | null => {
  const d = new Date(dateStr + 'T12:00:00');
  const key = DAY_KEYS[d.getDay()];
  const h = hours[key];
  if (!h || !h.start || !h.end) return null;
  return { startMin: parseHHMM(h.start.slice(0, 5)), endMin: parseHHMM(h.end.slice(0, 5)) };
};

export default function ScheduleOptimizer() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();

  const [viewScope, setViewScope] = useState<ViewScope>('week');
  const [anchorDate, setAnchorDate] = useState(new Date());
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [draft, setDraft] = useState<ScheduleEvent[]>([]);
  const [businessHours, setBusinessHours] = useState<BusinessHours>({});
  const [loading, setLoading] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [optimized, setOptimized] = useState(false);
  const [showBefore, setShowBefore] = useState(true);
  const [overtimeDays, setOvertimeDays] = useState<string[]>([]);

  useEffect(() => {
    if (currentOrganization?.id) {
      loadBusinessHours();
    }
  }, [currentOrganization?.id]);

  useEffect(() => {
    loadEvents();
  }, [viewScope, anchorDate, currentOrganization?.id]);

  const getWindowDates = (): { start: Date; end: Date } => {
    const d = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate());
    if (viewScope === 'day') {
      return { start: d, end: d };
    } else if (viewScope === 'week') {
      const start = new Date(d);
      start.setDate(d.getDate() - d.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return { start, end };
    } else {
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      return { start, end };
    }
  };

  const loadBusinessHours = async () => {
    if (!currentOrganization?.id || !user) return;
    const { data: orgData } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!orgData?.organization_id) return;

    const { data } = await supabase
      .from('business_settings')
      .select('hours_mon_start,hours_mon_end,hours_tue_start,hours_tue_end,hours_wed_start,hours_wed_end,hours_thu_start,hours_thu_end,hours_fri_start,hours_fri_end,hours_sat_start,hours_sat_end,hours_sun_start,hours_sun_end')
      .eq('organization_id', orgData.organization_id)
      .maybeSingle();

    if (data) {
      setBusinessHours({
        mon: { start: data.hours_mon_start, end: data.hours_mon_end },
        tue: { start: data.hours_tue_start, end: data.hours_tue_end },
        wed: { start: data.hours_wed_start, end: data.hours_wed_end },
        thu: { start: data.hours_thu_start, end: data.hours_thu_end },
        fri: { start: data.hours_fri_start, end: data.hours_fri_end },
        sat: { start: data.hours_sat_start, end: data.hours_sat_end },
        sun: { start: data.hours_sun_start, end: data.hours_sun_end },
      });
    }
  };

  const loadEvents = async () => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    setOptimized(false);
    setDraft([]);

    try {
      const { start, end } = getWindowDates();
      const endOfDay = new Date(end);
      endOfDay.setHours(23, 59, 59, 999);

      const { data } = await supabase
        .from('schedule_events')
        .select('id, title, start_time, end_time, location, is_locked, client:clients(name)')
        .eq('organization_id', currentOrganization.id)
        .gte('start_time', start.toISOString())
        .lte('start_time', endOfDay.toISOString())
        .order('start_time');

      const evs = (data || []) as ScheduleEvent[];
      setEvents(evs);
      setDraft([...evs]);
    } catch (err) {
      console.error('ScheduleOptimizer load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleLock = async (eventId: string, currentLocked: boolean) => {
    const newLocked = !currentLocked;
    const updater = (list: ScheduleEvent[]) =>
      list.map((e) => (e.id === eventId ? { ...e, is_locked: newLocked } : e));
    setEvents(updater);
    setDraft(updater);

    await supabase
      .from('schedule_events')
      .update({ is_locked: newLocked })
      .eq('id', eventId);
  };

  const runOptimizer = () => {
    setOptimizing(true);
    setTimeout(() => {
      const byDay: Record<string, ScheduleEvent[]> = {};
      for (const ev of draft) {
        const day = ev.start_time.slice(0, 10);
        if (!byDay[day]) byDay[day] = [];
        byDay[day].push(ev);
      }

      const newDraft: ScheduleEvent[] = [];
      const overtimeDaysFound: string[] = [];

      for (const [day, dayEvents] of Object.entries(byDay)) {
        const anchors = dayEvents
          .filter((e) => e.is_locked)
          .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

        const flexible = dayEvents
          .filter((e) => !e.is_locked)
          .sort((a, b) => minutesBetween(b.start_time, b.end_time) - minutesBetween(a.start_time, a.end_time));

        const placed: ScheduleEvent[] = [...anchors];

        const dayHours = getDayHours(businessHours, day);
        const dayStart = dayHours?.startMin ?? 8 * 60;
        const dayEnd = dayHours?.endMin ?? 17 * 60;

        const getOccupied = (): { start: number; end: number }[] =>
          placed.map((e) => {
            const s = new Date(e.start_time);
            return {
              start: s.getHours() * 60 + s.getMinutes(),
              end: s.getHours() * 60 + s.getMinutes() + minutesBetween(e.start_time, e.end_time),
            };
          }).sort((a, b) => a.start - b.start);

        for (const flex of flexible) {
          const dur = minutesBetween(flex.start_time, flex.end_time);
          const occupied = getOccupied();

          const gaps: { start: number; end: number }[] = [];
          let cursor = dayStart;

          for (const occ of occupied) {
            if (occ.start - cursor >= dur) {
              gaps.push({ start: cursor, end: occ.start });
            }
            cursor = Math.max(cursor, occ.end);
          }
          if (dayEnd - cursor >= dur) {
            gaps.push({ start: cursor, end: dayEnd });
          }

          if (gaps.length > 0) {
            const gap = gaps[0];
            const [year, month, dayNum] = day.split('-').map(Number);
            const newStart = new Date(year, month - 1, dayNum, Math.floor(gap.start / 60), gap.start % 60);
            const newEnd = new Date(newStart.getTime() + dur * 60000);
            placed.push({ ...flex, start_time: newStart.toISOString(), end_time: newEnd.toISOString() });
          } else {
            placed.push(flex);
          }
        }

        const totalMinutes = placed.reduce(
          (sum, e) => sum + minutesBetween(e.start_time, e.end_time),
          0
        );
        const availableMinutes = (dayHours?.endMin ?? 17 * 60) - (dayHours?.startMin ?? 8 * 60);

        if (totalMinutes > availableMinutes) {
          overtimeDaysFound.push(day);
        }

        newDraft.push(...placed);
      }

      setDraft(newDraft);
      setOvertimeDays(overtimeDaysFound);
      setOptimized(true);
      setShowBefore(false);
      setOptimizing(false);
    }, 800);
  };

  const publishOptimized = async () => {
    if (!currentOrganization?.id) return;
    setPublishing(true);
    try {
      for (const ev of draft) {
        const original = events.find((e) => e.id === ev.id);
        if (!original) continue;
        if (
          original.start_time !== ev.start_time ||
          original.end_time !== ev.end_time ||
          original.is_locked !== ev.is_locked
        ) {
          await supabase
            .from('schedule_events')
            .update({
              start_time: ev.start_time,
              end_time: ev.end_time,
              is_locked: true,
            })
            .eq('id', ev.id);
        }
      }
      await loadEvents();
      Alert.alert('Published', 'Optimized schedule has been published and all jobs are now locked.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to publish');
    } finally {
      setPublishing(false);
    }
  };

  const navigate = (dir: 1 | -1) => {
    const d = new Date(anchorDate);
    if (viewScope === 'day') d.setDate(d.getDate() + dir);
    else if (viewScope === 'week') d.setDate(d.getDate() + 7 * dir);
    else d.setMonth(d.getMonth() + dir);
    setAnchorDate(d);
  };

  const getWindowLabel = () => {
    const { start, end } = getWindowDates();
    if (viewScope === 'day') {
      return start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    } else if (viewScope === 'week') {
      const s = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const e = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `${s} – ${e}`;
    } else {
      return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
  };

  const groupByDay = (list: ScheduleEvent[]) => {
    const byDay: Record<string, ScheduleEvent[]> = {};
    for (const ev of list) {
      const day = ev.start_time.slice(0, 10);
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(ev);
    }
    return byDay;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const sourceList = showBefore ? events : draft;
  const grouped = groupByDay(sourceList);

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { padding: 20, paddingBottom: 0 },
    title: { fontSize: 20, fontWeight: '700', color: colors.text },
    subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 3 },
    scopeBar: {
      flexDirection: 'row',
      marginHorizontal: 20,
      marginTop: 16,
      backgroundColor: colors.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 3,
    },
    scopeBtn: { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center' },
    scopeBtnActive: { backgroundColor: colors.primary },
    scopeBtnText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
    scopeBtnTextActive: { color: '#fff' },
    navRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    navBtn: { padding: 6 },
    navLabel: { flex: 1, textAlign: 'center', fontSize: 14, fontWeight: '600', color: colors.text },
    toggleRow: {
      flexDirection: 'row',
      marginHorizontal: 20,
      marginBottom: 12,
      gap: 8,
    },
    toggleBtn: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      alignItems: 'center',
    },
    toggleBtnActive: { backgroundColor: colors.primary + '15', borderColor: colors.primary },
    toggleBtnInactive: { backgroundColor: colors.surface, borderColor: colors.border },
    toggleBtnText: { fontSize: 13, fontWeight: '600' },
    overtimeWarning: {
      marginHorizontal: 20,
      marginBottom: 12,
      backgroundColor: '#f59e0b22',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: '#f59e0b',
      padding: 12,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    overtimeText: { flex: 1, fontSize: 13, color: '#92400e', lineHeight: 18 },
    dayGroup: { marginHorizontal: 20, marginBottom: 16 },
    dayHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    dayLabel: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
    overtimeBadge: {
      backgroundColor: '#ef444422',
      borderRadius: 6,
      paddingVertical: 2,
      paddingHorizontal: 8,
    },
    overtimeBadgeText: { fontSize: 11, color: '#ef4444', fontWeight: '600' },
    eventCard: {
      backgroundColor: colors.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      marginBottom: 6,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    eventInfo: { flex: 1 },
    eventTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
    eventTime: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    eventLocation: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
    lockedBg: { borderColor: '#ef444430', backgroundColor: '#ef444408' },
    actionBar: {
      padding: 20,
      paddingTop: 8,
      gap: 10,
    },
    runBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    runBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
    publishBtn: {
      backgroundColor: '#22c55e',
      borderRadius: 12,
      paddingVertical: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    publishBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
    emptyState: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 30 },
    emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 6, marginTop: 12 },
    emptySubtext: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  });

  return (
    <View style={s.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <Text style={s.title}>Schedule Optimizer</Text>
          <Text style={s.subtitle}>Re-sequence flexible jobs around locked Anchors</Text>
        </View>

        <View style={s.scopeBar}>
          {(['day', 'week', 'month'] as ViewScope[]).map((scope) => (
            <TouchableOpacity
              key={scope}
              style={[s.scopeBtn, viewScope === scope && s.scopeBtnActive]}
              onPress={() => setViewScope(scope)}
            >
              <Text style={[s.scopeBtnText, viewScope === scope && s.scopeBtnTextActive]}>
                {scope.charAt(0).toUpperCase() + scope.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.navRow}>
          <TouchableOpacity style={s.navBtn} onPress={() => navigate(-1)}>
            <ChevronLeft size={20} color={colors.primary} />
          </TouchableOpacity>
          <Text style={s.navLabel}>{getWindowLabel()}</Text>
          <TouchableOpacity style={s.navBtn} onPress={() => navigate(1)}>
            <ChevronRight size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {optimized && (
          <View style={s.toggleRow}>
            <TouchableOpacity
              style={[s.toggleBtn, showBefore ? s.toggleBtnActive : s.toggleBtnInactive]}
              onPress={() => setShowBefore(true)}
            >
              <Text style={[s.toggleBtnText, { color: showBefore ? colors.primary : colors.textSecondary }]}>
                Before
              </Text>
            </TouchableOpacity>
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <ArrowRight size={16} color={colors.textSecondary} />
            </View>
            <TouchableOpacity
              style={[s.toggleBtn, !showBefore ? s.toggleBtnActive : s.toggleBtnInactive]}
              onPress={() => setShowBefore(false)}
            >
              <Text style={[s.toggleBtnText, { color: !showBefore ? colors.primary : colors.textSecondary }]}>
                After
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {overtimeDays.length > 0 && !showBefore && (
          <View style={s.overtimeWarning}>
            <AlertTriangle size={16} color="#f59e0b" />
            <Text style={s.overtimeText}>
              {`Overtime warning: ${overtimeDays.map(formatDate).join(', ')} may exceed business hours. Consider adding crew or rescheduling some jobs.`}
            </Text>
          </View>
        )}

        {loading ? (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : Object.keys(grouped).length === 0 ? (
          <View style={s.emptyState}>
            <Zap size={36} color={colors.primary + '80'} />
            <Text style={s.emptyTitle}>No events this period</Text>
            <Text style={s.emptySubtext}>No scheduled jobs were found for the selected window.</Text>
          </View>
        ) : (
          Object.entries(grouped)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([day, dayEvents]) => (
              <View key={day} style={s.dayGroup}>
                <View style={s.dayHeader}>
                  <Text style={s.dayLabel}>{formatDate(day)}</Text>
                  {overtimeDays.includes(day) && (
                    <View style={s.overtimeBadge}>
                      <Text style={s.overtimeBadgeText}>Overtime</Text>
                    </View>
                  )}
                </View>
                {[...dayEvents].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()).map((ev) => (
                    <View key={ev.id} style={[s.eventCard, ev.is_locked && s.lockedBg]}>
                      <JobLock
                        isLocked={ev.is_locked}
                        onToggle={() => toggleLock(ev.id, ev.is_locked)}
                        size={15}
                      />
                      <View style={s.eventInfo}>
                        <Text style={s.eventTitle} numberOfLines={1}>{ev.title}</Text>
                        <Text style={s.eventTime}>
                          {`${formatTime(ev.start_time)} \u2013 ${formatTime(ev.end_time)} \u00B7 ${minutesBetween(ev.start_time, ev.end_time)} min`}
                        </Text>
                        {ev.location && (
                          <Text style={s.eventLocation} numberOfLines={1}>{ev.location}</Text>
                        )}
                      </View>
                    </View>
                  ))}
              </View>
            ))
        )}
      </ScrollView>

      {!loading && events.length > 0 && (
        <View style={s.actionBar}>
          {!optimized ? (
            <TouchableOpacity style={s.runBtn} onPress={runOptimizer} disabled={optimizing}>
              {optimizing
                ? <ActivityIndicator color="#fff" size="small" />
                : <Zap size={18} color="#fff" />
              }
              <Text style={s.runBtnText}>{optimizing ? 'Optimizing...' : 'Run Optimizer'}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={s.publishBtn} onPress={publishOptimized} disabled={publishing}>
              {publishing
                ? <ActivityIndicator color="#fff" size="small" />
                : <Check size={18} color="#fff" />
              }
              <Text style={s.publishBtnText}>
                {publishing ? 'Publishing...' : 'Publish Optimized Schedule'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}
