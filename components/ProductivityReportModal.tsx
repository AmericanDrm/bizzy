import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, G } from 'react-native-svg';
import {
  X,
  Clock,
  Coffee,
  ShoppingCart,
  Briefcase,
  Truck,
  ChevronDown,
  ChevronUp,
  Play,
  Square,
  MapPin,
  Timer,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';

interface ProductivityReportModalProps {
  visible: boolean;
  onClose: () => void;
  timeEntryId?: string;
}

interface SliceData {
  label: string;
  value: number;
  color: string;
}

interface JobEntry {
  id: string;
  clientName: string;
  sessionType: string;
  startTime: string;
  endTime: string | null;
  durationHours: number;
}

interface ClockStatus {
  isClockedIn: boolean;
  clockInTime: string | null;
  lastClockOut: string | null;
  lastDuration: number;
  activeEntryId: string | null;
}

interface ManualTimer {
  jobName: string;
  startedAt: number;
  elapsed: number;
  running: boolean;
}

const COLORS = {
  clocked: '#3b82f6',
  break: '#10b981',
  supplies: '#f59e0b',
  travel: '#8b5cf6',
};

const ACTIVITY_META = [
  { label: 'At Job Site', color: COLORS.clocked, Icon: Briefcase, type: 'job_site' },
  { label: 'Traveling', color: COLORS.travel, Icon: Truck, type: 'traveling' },
  { label: 'Break', color: COLORS.break, Icon: Coffee, type: 'break' },
  { label: 'Getting Supplies', color: COLORS.supplies, Icon: ShoppingCart, type: 'getting_supplies' },
];

function formatDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatTimerDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}

function PieChart({ slices, size = 150 }: { slices: SliceData[]; size?: number }) {
  const total = slices.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return (
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={size / 2 - 4} fill="#334155" />
      </Svg>
    );
  }

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 6;
  const innerR = r * 0.55;

  let startAngle = -Math.PI / 2;
  const paths: { d: string; color: string }[] = [];

  slices.forEach((slice) => {
    const pct = slice.value / total;
    const angle = pct * 2 * Math.PI;
    const endAngle = startAngle + angle;

    if (pct >= 0.999) {
      paths.push({
        d: [
          `M ${cx + r} ${cy}`,
          `A ${r} ${r} 0 1 1 ${cx - r} ${cy}`,
          `A ${r} ${r} 0 1 1 ${cx + r} ${cy}`,
          `M ${cx + innerR} ${cy}`,
          `A ${innerR} ${innerR} 0 1 0 ${cx - innerR} ${cy}`,
          `A ${innerR} ${innerR} 0 1 0 ${cx + innerR} ${cy}`,
        ].join(' '),
        color: slice.color,
      });
    } else {
      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);
      const ix1 = cx + innerR * Math.cos(endAngle);
      const iy1 = cy + innerR * Math.sin(endAngle);
      const ix2 = cx + innerR * Math.cos(startAngle);
      const iy2 = cy + innerR * Math.sin(startAngle);
      const largeArc = angle > Math.PI ? 1 : 0;

      paths.push({
        d: [
          `M ${x1} ${y1}`,
          `A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`,
          `L ${ix1} ${iy1}`,
          `A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix2} ${iy2}`,
          'Z',
        ].join(' '),
        color: slice.color,
      });
    }
    startAngle = endAngle;
  });

  return (
    <Svg width={size} height={size}>
      <G>
        {paths.map((p, i) => (
          <Path key={i} d={p.d} fill={p.color} />
        ))}
      </G>
    </Svg>
  );
}

export default function ProductivityReportModal({
  visible,
  onClose,
  timeEntryId,
}: ProductivityReportModalProps) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const [loading, setLoading] = useState(false);
  const [clockStatus, setClockStatus] = useState<ClockStatus>({
    isClockedIn: false,
    clockInTime: null,
    lastClockOut: null,
    lastDuration: 0,
    activeEntryId: null,
  });
  const [currentJobName, setCurrentJobName] = useState<string | null>(null);
  const [currentSessionType, setCurrentSessionType] = useState<string | null>(null);
  const [slices, setSlices] = useState<SliceData[]>([]);
  const [totalHours, setTotalHours] = useState(0);
  const [dateLabel, setDateLabel] = useState('');
  const [clockLabel, setClockLabel] = useState('');
  const [jobEntries, setJobEntries] = useState<JobEntry[]>([]);
  const [jobsExpanded, setJobsExpanded] = useState(false);
  const [manualTimer, setManualTimer] = useState<ManualTimer>({
    jobName: '',
    startedAt: 0,
    elapsed: 0,
    running: false,
  });
  const [timerJobOptions, setTimerJobOptions] = useState<{ id: string; name: string }[]>([]);
  const [selectedTimerJob, setSelectedTimerJob] = useState<string>('');
  const [showJobPicker, setShowJobPicker] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (visible) {
      fetchAllData();
      tickRef.current = setInterval(() => setNow(Date.now()), 1000);
    }
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [visible, timeEntryId]);

  useEffect(() => {
    if (manualTimer.running) {
      timerRef.current = setInterval(() => {
        setManualTimer((prev) => ({
          ...prev,
          elapsed: Date.now() - prev.startedAt,
        }));
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [manualTimer.running]);

  const calcBreakHours = (breaks: any[], entryEnd: Date): number => {
    return breaks.reduce((sum: number, b: any) => {
      const end = b.ended_at ? new Date(b.ended_at) : entryEnd;
      return sum + (end.getTime() - new Date(b.started_at).getTime()) / 3600000;
    }, 0);
  };

  const calcSessionHours = (sessions: any[], type: string, entryEnd: Date): number => {
    return sessions
      .filter((s: any) => s.session_type === type)
      .reduce((sum: number, s: any) => {
        const e = s.end_time ? new Date(s.end_time) : entryEnd;
        return sum + (e.getTime() - new Date(s.start_time).getTime()) / 3600000;
      }, 0);
  };

  const buildSlices = (total: number, onBreak: number, onSupplies: number, onTravel: number): SliceData[] => {
    const atSite = Math.max(0, total - onBreak - onSupplies - onTravel);
    return [
      { label: 'At Job Site', value: atSite, color: COLORS.clocked },
      { label: 'Traveling', value: onTravel, color: COLORS.travel },
      { label: 'Break', value: onBreak, color: COLORS.break },
      { label: 'Getting Supplies', value: onSupplies, color: COLORS.supplies },
    ].filter((s) => s.value > 0.001);
  };

  const buildJobEntries = (sessions: any[], entryEnd: Date): JobEntry[] => {
    return sessions
      .filter((s: any) => s.session_type === 'job_site')
      .map((s: any) => {
        const end = s.end_time ? new Date(s.end_time) : entryEnd;
        const dur = (end.getTime() - new Date(s.start_time).getTime()) / 3600000;
        return {
          id: s.id,
          clientName: s.client?.name || s.schedule_event?.name || 'Job Site',
          sessionType: s.session_type,
          startTime: s.start_time,
          endTime: s.end_time,
          durationHours: dur,
        };
      })
      .sort((a: JobEntry, b: JobEntry) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  };

  const fetchAllData = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data: activeEntry } = await supabase
        .from('time_entries')
        .select('*')
        .eq('user_id', user.id)
        .is('clock_out', null)
        .maybeSingle();

      if (activeEntry) {
        setClockStatus({
          isClockedIn: true,
          clockInTime: activeEntry.clock_in,
          lastClockOut: null,
          lastDuration: 0,
          activeEntryId: activeEntry.id,
        });
      } else {
        const { data: lastEntry } = await supabase
          .from('time_entries')
          .select('clock_in, clock_out')
          .eq('user_id', user.id)
          .not('clock_out', 'is', null)
          .order('clock_out', { ascending: false })
          .limit(1)
          .maybeSingle();

        setClockStatus({
          isClockedIn: false,
          clockInTime: null,
          lastClockOut: lastEntry?.clock_out || null,
          lastDuration: lastEntry
            ? (new Date(lastEntry.clock_out).getTime() - new Date(lastEntry.clock_in).getTime()) / 3600000
            : 0,
          activeEntryId: null,
        });
      }

      const { data: currentSess } = await supabase
        .from('productivity_sessions')
        .select('*, client:clients(name)')
        .eq('user_id', user.id)
        .is('end_time', null)
        .maybeSingle();

      if (currentSess) {
        setCurrentJobName(currentSess.client?.name || null);
        setCurrentSessionType(currentSess.session_type);
      } else {
        setCurrentJobName(null);
        setCurrentSessionType(null);
      }

      const entryId = timeEntryId || activeEntry?.id;
      if (entryId) {
        await fetchEntryData(entryId);
      } else {
        await fetchTodayData();
      }

      const today = new Date().toISOString().split('T')[0];
      const { data: todayEvents } = await supabase
        .from('schedule_events')
        .select('id, name, client:clients(id, name)')
        .eq('date', today)
        .eq('user_id', user.id);

      const opts: { id: string; name: string }[] = [];
      (todayEvents || []).forEach((ev: any) => {
        opts.push({ id: ev.id, name: ev.client?.name || ev.name });
      });
      if (opts.length === 0) {
        opts.push({ id: 'general', name: 'General Work' });
      }
      setTimerJobOptions(opts);
      if (!selectedTimerJob && opts.length > 0) {
        setSelectedTimerJob(opts[0].id);
      }
    } catch (e) {
      console.error('Error fetching productivity data:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchEntryData = async (entryId: string) => {
    const { data: entry } = await supabase
      .from('time_entries')
      .select('*')
      .eq('id', entryId)
      .maybeSingle();

    if (!entry) {
      setSlices([]);
      setTotalHours(0);
      setJobEntries([]);
      return;
    }

    const entryEnd = entry.clock_out ? new Date(entry.clock_out) : new Date();
    const total = (entryEnd.getTime() - new Date(entry.clock_in).getTime()) / 3600000;

    const [breaksRes, sessionsRes] = await Promise.all([
      supabase.from('time_entry_breaks').select('started_at, ended_at').eq('time_entry_id', entryId),
      supabase
        .from('productivity_sessions')
        .select('id, session_type, start_time, end_time, client:clients(name)')
        .eq('time_entry_id', entryId),
    ]);

    const breaks = breaksRes.data || [];
    const sessions = sessionsRes.data || [];

    const breakHours = calcBreakHours(breaks, entryEnd);
    const suppliesHours = calcSessionHours(sessions, 'getting_supplies', entryEnd);
    const travelHours = calcSessionHours(sessions, 'traveling', entryEnd);

    setSlices(buildSlices(total, breakHours, suppliesHours, travelHours));
    setTotalHours(total);
    setJobEntries(buildJobEntries(sessions, entryEnd));

    const d = new Date(entry.clock_in);
    setDateLabel(d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }));
    const clockIn = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const clockOut = entry.clock_out
      ? new Date(entry.clock_out).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      : 'Ongoing';
    setClockLabel(`${clockIn} - ${clockOut}`);
  };

  const fetchTodayData = async () => {
    if (!user?.id) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const { data: todayEntries } = await supabase
      .from('time_entries')
      .select('*')
      .eq('user_id', user.id)
      .gte('clock_in', today.toISOString())
      .lt('clock_in', tomorrow.toISOString())
      .order('clock_in', { ascending: true });

    if (!todayEntries || todayEntries.length === 0) {
      setSlices([]);
      setTotalHours(0);
      setJobEntries([]);
      setDateLabel(today.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }));
      setClockLabel('');
      return;
    }

    let aggTotal = 0;
    let aggBreak = 0;
    let aggSupplies = 0;
    let aggTravel = 0;
    let allJobs: JobEntry[] = [];
    let firstClockIn = todayEntries[0].clock_in;
    let lastClockOut = todayEntries[todayEntries.length - 1].clock_out;

    for (const entry of todayEntries) {
      const entryEnd = entry.clock_out ? new Date(entry.clock_out) : new Date();
      const total = (entryEnd.getTime() - new Date(entry.clock_in).getTime()) / 3600000;
      aggTotal += total;

      const [breaksRes, sessionsRes] = await Promise.all([
        supabase.from('time_entry_breaks').select('started_at, ended_at').eq('time_entry_id', entry.id),
        supabase
          .from('productivity_sessions')
          .select('id, session_type, start_time, end_time, client:clients(name)')
          .eq('time_entry_id', entry.id),
      ]);

      const breaks = breaksRes.data || [];
      const sessions = sessionsRes.data || [];

      aggBreak += calcBreakHours(breaks, entryEnd);
      aggSupplies += calcSessionHours(sessions, 'getting_supplies', entryEnd);
      aggTravel += calcSessionHours(sessions, 'traveling', entryEnd);
      allJobs = [...allJobs, ...buildJobEntries(sessions, entryEnd)];
    }

    setSlices(buildSlices(aggTotal, aggBreak, aggSupplies, aggTravel));
    setTotalHours(aggTotal);
    setJobEntries(allJobs);

    const d = new Date(firstClockIn);
    setDateLabel(d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }));
    const ci = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const co = lastClockOut
      ? new Date(lastClockOut).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      : 'Ongoing';
    setClockLabel(`${ci} - ${co}`);
  };

  const startManualTimer = () => {
    const job = timerJobOptions.find((j) => j.id === selectedTimerJob);
    setManualTimer({
      jobName: job?.name || 'Job',
      startedAt: Date.now(),
      elapsed: 0,
      running: true,
    });
  };

  const stopManualTimer = () => {
    setManualTimer((prev) => ({ ...prev, running: false }));
  };

  const resetManualTimer = () => {
    setManualTimer({ jobName: '', startedAt: 0, elapsed: 0, running: false });
  };

  const clockedInDuration = useCallback(() => {
    if (!clockStatus.clockInTime) return '';
    const ms = now - new Date(clockStatus.clockInTime).getTime();
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${h}:${pad(m)}:${pad(s)}`;
  }, [clockStatus.clockInTime, now]);

  const getActivityLabel = (type: string) => {
    const meta = ACTIVITY_META.find((a) => a.type === type);
    return meta?.label || 'Working';
  };

  const getActivityColor = (type: string) => {
    const meta = ACTIVITY_META.find((a) => a.type === type);
    return meta?.color || COLORS.clocked;
  };

  const s = makeStyles(colors);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.modal}>
          <View style={s.header}>
            <Text style={s.title}>Productivity Report</Text>
            <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
              <X size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={s.content} showsVerticalScrollIndicator={false}>
            {loading ? (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : (
              <>
                <View style={s.statusCard}>
                  <View style={s.statusDot}>
                    <View style={[s.dot, { backgroundColor: clockStatus.isClockedIn ? '#10b981' : '#94a3b8' }]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.statusTitle}>
                      {clockStatus.isClockedIn ? "You're Clocked In" : "You're Clocked Out"}
                    </Text>
                    <Text style={s.statusSub}>
                      {clockStatus.isClockedIn
                        ? clockedInDuration()
                        : clockStatus.lastClockOut
                          ? `Last: ${new Date(clockStatus.lastClockOut).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${formatDuration(clockStatus.lastDuration)}`
                          : 'No recent entries'}
                    </Text>
                  </View>
                  {clockStatus.isClockedIn && (
                    <View style={[s.liveBadge, { backgroundColor: '#10b98120' }]}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' }} />
                      <Text style={{ fontSize: 11, color: '#10b981', fontWeight: '600' }}>LIVE</Text>
                    </View>
                  )}
                </View>

                {clockStatus.isClockedIn && currentSessionType && (
                  <View style={[s.currentJobCard, { borderLeftColor: getActivityColor(currentSessionType) }]}>
                    <MapPin size={16} color={getActivityColor(currentSessionType)} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, color: colors.textSecondary }}>Current Activity</Text>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                        {getActivityLabel(currentSessionType)}
                        {currentJobName ? ` - ${currentJobName}` : ''}
                      </Text>
                    </View>
                  </View>
                )}

                <View style={s.legend}>
                  {ACTIVITY_META.map(({ label, color, Icon }) => (
                    <View key={label} style={s.legendItem}>
                      <View style={[s.legendDot, { backgroundColor: color }]} />
                      <Icon size={11} color={color} />
                      <Text style={s.legendText}>{label}</Text>
                    </View>
                  ))}
                </View>

                {slices.length > 0 ? (
                  <View style={s.chartCard}>
                    <Text style={s.chartDate}>{dateLabel}</Text>
                    {clockLabel ? <Text style={s.chartTime}>{clockLabel}</Text> : null}

                    <View style={s.chartRow}>
                      <PieChart slices={slices} size={140} />
                      <View style={{ flex: 1, gap: 8 }}>
                        {slices.map((slice) => {
                          const total = slices.reduce((sum, x) => sum + x.value, 0);
                          const pct = total > 0 ? ((slice.value / total) * 100).toFixed(0) : '0';
                          return (
                            <View key={slice.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: slice.color }} />
                              <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 12, color: colors.textSecondary }}>{slice.label}</Text>
                                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>
                                  {formatDuration(slice.value)}{' '}
                                  <Text style={{ color: colors.textSecondary, fontWeight: '400' }}>({pct}%)</Text>
                                </Text>
                              </View>
                            </View>
                          );
                        })}
                        <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, marginTop: 2 }}>
                          <Text style={{ fontSize: 12, color: colors.textSecondary }}>Total</Text>
                          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.primary }}>
                            {formatDuration(totalHours)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                ) : (
                  <View style={s.emptyChart}>
                    <Clock size={36} color={colors.textSecondary} />
                    <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 8 }}>
                      No time data to display
                    </Text>
                  </View>
                )}

                {jobEntries.length > 0 && (
                  <View style={s.jobsSection}>
                    <TouchableOpacity
                      style={s.jobsHeader}
                      onPress={() => setJobsExpanded(!jobsExpanded)}
                      activeOpacity={0.7}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={s.jobsTitle}>Job Breakdown</Text>
                        <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                          {jobEntries.length} job{jobEntries.length !== 1 ? 's' : ''} tracked
                        </Text>
                      </View>
                      {jobsExpanded ? (
                        <ChevronUp size={20} color={colors.textSecondary} />
                      ) : (
                        <ChevronDown size={20} color={colors.textSecondary} />
                      )}
                    </TouchableOpacity>

                    {jobsExpanded && (
                      <View style={{ gap: 8, paddingTop: 8 }}>
                        {jobEntries.map((job) => (
                          <View key={job.id} style={s.jobRow}>
                            <View style={[s.jobDotLine, { backgroundColor: COLORS.clocked }]} />
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>
                                {job.clientName}
                              </Text>
                              <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                                {new Date(job.startTime).toLocaleTimeString('en-US', {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })}{' '}
                                -{' '}
                                {job.endTime
                                  ? new Date(job.endTime).toLocaleTimeString('en-US', {
                                      hour: 'numeric',
                                      minute: '2-digit',
                                    })
                                  : 'Now'}
                              </Text>
                            </View>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary }}>
                              {formatDuration(job.durationHours)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                )}

                <View style={s.timerSection}>
                  <View style={s.timerHeader}>
                    <Timer size={18} color={colors.primary} />
                    <Text style={s.timerTitle}>Manual Job Timer</Text>
                  </View>

                  {!manualTimer.running && manualTimer.elapsed === 0 ? (
                    <>
                      <TouchableOpacity
                        style={s.jobPickerBtn}
                        onPress={() => setShowJobPicker(!showJobPicker)}
                        activeOpacity={0.7}
                      >
                        <Text style={{ flex: 1, fontSize: 14, color: colors.text }}>
                          {timerJobOptions.find((j) => j.id === selectedTimerJob)?.name || 'Select Job'}
                        </Text>
                        {showJobPicker ? (
                          <ChevronUp size={16} color={colors.textSecondary} />
                        ) : (
                          <ChevronDown size={16} color={colors.textSecondary} />
                        )}
                      </TouchableOpacity>

                      {showJobPicker && (
                        <View style={s.jobPickerList}>
                          {timerJobOptions.map((job) => (
                            <TouchableOpacity
                              key={job.id}
                              style={[
                                s.jobPickerItem,
                                selectedTimerJob === job.id && { backgroundColor: colors.primary + '15' },
                              ]}
                              onPress={() => {
                                setSelectedTimerJob(job.id);
                                setShowJobPicker(false);
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 14,
                                  color: selectedTimerJob === job.id ? colors.primary : colors.text,
                                  fontWeight: selectedTimerJob === job.id ? '600' : '400',
                                }}
                              >
                                {job.name}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}

                      <TouchableOpacity style={[s.startBtn, { overflow: 'hidden' }]} onPress={startManualTimer} activeOpacity={0.8}>
                        <LinearGradient
                          colors={['#2D8B57', '#34a065']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={s.gradientFill}
                        >
                          <Play size={18} color="#fff" />
                          <Text style={s.startBtnText}>Start Timer</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <View style={s.timerActive}>
                      <Text style={s.timerJobLabel}>{manualTimer.jobName}</Text>
                      <Text style={s.timerDisplay}>
                        {formatTimerDuration(manualTimer.running ? Date.now() - manualTimer.startedAt : manualTimer.elapsed)}
                      </Text>
                      <View style={s.timerControls}>
                        {manualTimer.running ? (
                          <TouchableOpacity style={[s.stopBtn, { overflow: 'hidden' }]} onPress={stopManualTimer} activeOpacity={0.8}>
                            <LinearGradient
                              colors={['#dc2626', '#b91c1c']}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={s.gradientFill}
                            >
                              <Square size={16} color="#fff" fill="#fff" />
                              <Text style={s.stopBtnText}>Stop</Text>
                            </LinearGradient>
                          </TouchableOpacity>
                        ) : (
                          <View style={{ flexDirection: 'row', gap: 10 }}>
                            <TouchableOpacity
                              style={[s.startBtn, { overflow: 'hidden' }]}
                              onPress={() =>
                                setManualTimer((prev) => ({
                                  ...prev,
                                  startedAt: Date.now() - prev.elapsed,
                                  running: true,
                                }))
                              }
                              activeOpacity={0.8}
                            >
                              <LinearGradient
                                colors={['#2D8B57', '#34a065']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={s.gradientFill}
                              >
                                <Play size={16} color="#fff" />
                                <Text style={s.startBtnText}>Resume</Text>
                              </LinearGradient>
                            </TouchableOpacity>
                            <TouchableOpacity style={s.resetBtn} onPress={resetManualTimer} activeOpacity={0.8}>
                              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>Reset</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    </View>
                  )}
                </View>

                <View style={{ height: 40 }} />
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modal: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '92%',
      paddingBottom: 40,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: { fontSize: 20, fontWeight: '700', color: colors.text },
    content: { padding: 16 },
    statusCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      padding: 14,
      marginBottom: 12,
      gap: 12,
    },
    statusDot: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dot: { width: 14, height: 14, borderRadius: 7 },
    statusTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
    statusSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    liveBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    currentJobCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
      borderLeftWidth: 3,
    },
    legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { fontSize: 11, color: colors.textSecondary },
    chartCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
    },
    chartDate: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 2 },
    chartTime: { fontSize: 12, color: colors.textSecondary, marginBottom: 14 },
    chartRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
    emptyChart: {
      alignItems: 'center',
      paddingVertical: 32,
      backgroundColor: colors.cardBackground,
      borderRadius: 16,
      marginBottom: 12,
    },
    jobsSection: {
      backgroundColor: colors.cardBackground,
      borderRadius: 16,
      padding: 14,
      marginBottom: 12,
    },
    jobsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    jobsTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
    jobRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    jobDotLine: { width: 3, height: 32, borderRadius: 2 },
    timerSection: {
      backgroundColor: colors.cardBackground,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
    },
    timerHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    timerTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
    jobPickerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 10,
    },
    jobPickerList: {
      backgroundColor: colors.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 10,
      overflow: 'hidden',
    },
    jobPickerItem: { paddingHorizontal: 12, paddingVertical: 10 },
    startBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 50,
    },
    startBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
    stopBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 50,
    },
    stopBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
    gradientFill: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      paddingHorizontal: 28,
      borderRadius: 50,
    },
    resetBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    timerActive: { alignItems: 'center', gap: 8 },
    timerJobLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
    timerDisplay: {
      fontSize: 40,
      fontWeight: '700',
      color: colors.text,
      fontVariant: ['tabular-nums'],
      letterSpacing: 1,
    },
    timerControls: { marginTop: 8 },
  });
}
