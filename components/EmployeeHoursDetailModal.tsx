import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Platform,
  TextInput,
  Alert,
} from 'react-native';
import { X, Clock, Coffee, FileText, ChevronLeft, Pencil, Check, Lock, Clock as Unlock, TriangleAlert as AlertTriangle, Trash2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface TimeEntry {
  id: string;
  clock_in: string;
  clock_out: string | null;
  notes: string | null;
  user_id: string;
  user_name?: string;
  user_email?: string;
  breaks?: { id: string; started_at: string; ended_at?: string; notes?: string }[];
}

interface WeekLock {
  id: string;
  week_start: string;
  locked_by: string;
  locked_at: string;
  notes: string;
}

interface TimeEdit {
  hour: string;
  minute: string;
  period: 'AM' | 'PM';
}

interface EmployeeHoursDetailModalProps {
  visible: boolean;
  onClose: () => void;
  employeeName: string;
  employeeEmail?: string;
  entries: TimeEntry[];
  colors: any;
  weekStartDay: number;
  organizationName?: string;
  onEditEntry?: (entry: TimeEntry) => void;
  isAdminOrManager: boolean;
  startDate: Date | null;
  endDate: Date | null;
  targetUserId?: string;
  organizationId?: string;
  onEntriesChanged?: () => void;
}

function calcHours(clockIn: string, clockOut: string | null): number {
  if (!clockOut) return 0;
  return (new Date(clockOut).getTime() - new Date(clockIn).getTime()) / 3_600_000;
}

function formatHM(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function parseToEdit(d: string): TimeEdit {
  const date = new Date(d);
  let h = date.getHours();
  const period: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return { hour: h.toString(), minute: date.getMinutes().toString().padStart(2, '0'), period };
}

function editToDate(t: TimeEdit, baseDate: string): Date {
  const d = new Date(baseDate);
  let h = parseInt(t.hour, 10);
  if (t.period === 'PM' && h !== 12) h += 12;
  if (t.period === 'AM' && h === 12) h = 0;
  d.setHours(h, parseInt(t.minute, 10), 0, 0);
  return d;
}

function getWeekStartStr(date: Date, weekStartDay: number): string {
  const d = new Date(date);
  const diff = (d.getDay() - weekStartDay + 7) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d.toLocaleDateString('en-CA');
}

export default function EmployeeHoursDetailModal({
  visible,
  onClose,
  employeeName,
  employeeEmail,
  entries,
  colors,
  weekStartDay,
  organizationName,
  isAdminOrManager,
  startDate,
  endDate,
  targetUserId,
  organizationId,
  onEntriesChanged,
}: EmployeeHoursDetailModalProps) {
  const { user } = useAuth();
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editClockIn, setEditClockIn] = useState<TimeEdit>({ hour: '9', minute: '00', period: 'AM' });
  const [editClockOut, setEditClockOut] = useState<TimeEdit | null>(null);
  const [editDate, setEditDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [weekLocks, setWeekLocks] = useState<WeekLock[]>([]);
  const [lockingWeek, setLockingWeek] = useState<string | null>(null);
  const [lockNote, setLockNote] = useState('');
  const [addingForDate, setAddingForDate] = useState<string | null>(null);
  const [addClockIn, setAddClockIn] = useState<TimeEdit>({ hour: '8', minute: '00', period: 'AM' });
  const [addClockOut, setAddClockOut] = useState<TimeEdit>({ hour: '5', minute: '00', period: 'PM' });
  const [addSaving, setAddSaving] = useState(false);
  const [addingForWeek, setAddingForWeek] = useState<string | null>(null);
  const [weekAddDate, setWeekAddDate] = useState('');
  const [weekAddClockIn, setWeekAddClockIn] = useState<TimeEdit>({ hour: '8', minute: '00', period: 'AM' });
  const [weekAddClockOut, setWeekAddClockOut] = useState<TimeEdit>({ hour: '5', minute: '00', period: 'PM' });
  const [weekAddSaving, setWeekAddSaving] = useState(false);

  const completedEntries = useMemo(() => entries.filter(e => e.clock_out), [entries]);
  const totalHours = useMemo(() => completedEntries.reduce((s, e) => s + calcHours(e.clock_in, e.clock_out), 0), [completedEntries]);
  const overtimeHours = useMemo(() => Math.max(0, totalHours - 40), [totalHours]);

  useEffect(() => {
    if (visible && organizationId && targetUserId) {
      fetchWeekLocks();
    }
  }, [visible, organizationId, targetUserId]);

  const fetchWeekLocks = async () => {
    if (!organizationId || !targetUserId) return;
    const { data } = await supabase
      .from('time_entry_week_locks')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('user_id', targetUserId);
    if (data) setWeekLocks(data);
  };

  const isWeekLocked = (weekStartStr: string): boolean => {
    return weekLocks.some(l => l.week_start === weekStartStr);
  };

  const handleLockWeek = async (weekStartStr: string) => {
    if (!organizationId || !targetUserId || !user) return;
    setLockingWeek(weekStartStr);
  };

  const confirmLockWeek = async (weekStartStr: string) => {
    if (!organizationId || !targetUserId || !user) return;
    try {
      await supabase.from('time_entry_week_locks').insert({
        organization_id: organizationId,
        user_id: targetUserId,
        week_start: weekStartStr,
        locked_by: user.id,
        notes: lockNote.trim(),
      });
      setLockNote('');
      setLockingWeek(null);
      await fetchWeekLocks();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to lock week');
    }
  };

  const handleUnlockWeek = async (weekStartStr: string) => {
    if (!organizationId || !targetUserId) return;
    const lock = weekLocks.find(l => l.week_start === weekStartStr);
    if (!lock) return;
    await supabase.from('time_entry_week_locks').delete().eq('id', lock.id);
    await fetchWeekLocks();
  };

  const weeklyBreakdown = useMemo(() => {
    if (completedEntries.length === 0) return [];
    const weeks: { label: string; weekStartStr: string; days: { [dateKey: string]: { entries: TimeEntry[]; hours: number } }; totalHours: number }[] = [];
    const allDates = completedEntries.map(e => new Date(e.clock_in));
    const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
    let ws = new Date(minDate);
    const d0 = (ws.getDay() - weekStartDay + 7) % 7;
    ws.setDate(ws.getDate() - d0);
    ws.setHours(0, 0, 0, 0);
    while (ws <= maxDate) {
      const we = new Date(ws);
      we.setDate(we.getDate() + 6);
      we.setHours(23, 59, 59, 999);
      const label = `${ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${we.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      const weekStartStr = ws.toLocaleDateString('en-CA');
      const days: { [dateKey: string]: { entries: TimeEntry[]; hours: number } } = {};
      let weekHours = 0;
      completedEntries.forEach(entry => {
        const d = new Date(entry.clock_in);
        if (d >= ws && d <= we) {
          const key = d.toLocaleDateString('en-CA');
          if (!days[key]) days[key] = { entries: [], hours: 0 };
          const h = calcHours(entry.clock_in, entry.clock_out);
          days[key].entries.push(entry);
          days[key].hours += h;
          weekHours += h;
        }
      });
      if (Object.keys(days).length > 0) {
        weeks.push({ label, weekStartStr, days, totalHours: weekHours });
      }
      ws = new Date(we);
      ws.setDate(ws.getDate() + 1);
      ws.setHours(0, 0, 0, 0);
    }
    return weeks.reverse();
  }, [completedEntries, weekStartDay]);

  const dailyBarData = useMemo(() => {
    const byDay: { [key: string]: number } = {};
    completedEntries.forEach(e => {
      const key = new Date(e.clock_in).toLocaleDateString('en-CA');
      byDay[key] = (byDay[key] || 0) + calcHours(e.clock_in, e.clock_out);
    });
    const sorted = Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)).slice(-14);
    const maxH = Math.max(...sorted.map(([, h]) => h), 0.1);
    return { days: sorted, maxH };
  }, [completedEntries]);

  const handleExportPdf = () => {
    if (Platform.OS !== 'web') {
      Alert.alert('PDF Export', 'PDF export is only available on web.');
      return;
    }

    const dateRangeText = startDate || endDate
      ? `${startDate ? startDate.toLocaleDateString() : 'Beginning'} – ${endDate ? endDate.toLocaleDateString() : 'Present'}`
      : 'All Time';

    const sortedEntries = [...completedEntries].sort(
      (a, b) => new Date(b.clock_in).getTime() - new Date(a.clock_in).getTime()
    );

    const byMonth: { [key: string]: TimeEntry[] } = {};
    sortedEntries.forEach(e => {
      const key = e.clock_in.slice(0, 7);
      if (!byMonth[key]) byMonth[key] = [];
      byMonth[key].push(e);
    });

    const escape = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const monthRows = Object.keys(byMonth).sort((a, b) => b.localeCompare(a)).map(mk => {
      const mes = byMonth[mk];
      const mh = mes.reduce((s, e) => s + calcHours(e.clock_in, e.clock_out), 0);
      const [yr, mo] = mk.split('-');
      const mLabel = new Date(Number(yr), Number(mo) - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const rows = mes.map(e => {
        const h = calcHours(e.clock_in, e.clock_out);
        const bc = e.breaks?.filter(b => b.ended_at)?.length || 0;
        const dateStr = new Date(e.clock_in).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        return `<tr>
          <td>${escape(dateStr)}</td>
          <td>${escape(fmtTime(e.clock_in))}</td>
          <td>${e.clock_out ? escape(fmtTime(e.clock_out)) : '<span style="color:#f59e0b;font-weight:600">Active</span>'}</td>
          <td style="text-align:right;font-weight:700;color:#1B4D6E">${e.clock_out ? formatHM(h) : '—'}</td>
          <td style="text-align:center;color:#666">${bc > 0 ? bc : '—'}</td>
          <td style="color:#666;font-size:11px">${escape(e.notes || '')}</td>
        </tr>`;
      }).join('');
      return `<div class="month-group">
        <div class="month-header"><span>${escape(mLabel)}</span><span style="font-weight:700;color:#1B4D6E">${formatHM(mh)}</span></div>
        <table><thead><tr><th>Date</th><th>Clock In</th><th>Clock Out</th><th style="text-align:right">Duration</th><th style="text-align:center">Breaks</th><th>Notes</th></tr></thead><tbody>${rows}</tbody></table>
      </div>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Time Report</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:13px;color:#222;background:#fff;padding:40px;line-height:1.5}
.header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:24px;border-bottom:3px solid #1B4D6E;margin-bottom:28px}
.title{font-size:26px;font-weight:800;color:#1B4D6E}
.meta{font-size:12px;color:#666;margin-top:4px}
.emp-header{background:linear-gradient(135deg,#1B4D6E,#2C7A7B);color:white;padding:20px 24px;border-radius:10px;margin-bottom:16px}
.emp-name{font-size:20px;font-weight:800}
.emp-email{font-size:12px;opacity:.8;margin-top:2px}
.emp-stats{display:flex;gap:10px;margin-top:10px}
.stat-chip{background:rgba(255,255,255,.2);padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600}
.total-chip{background:rgba(255,255,255,.35)}
.month-group{margin-bottom:20px}
.month-header{display:flex;justify-content:space-between;align-items:center;background:#f1f5f9;padding:8px 12px;border-radius:6px;font-size:13px;font-weight:700;color:#444;margin-bottom:6px}
table{width:100%;border-collapse:collapse;margin-top:8px}
th{background:#f8fafc;padding:9px 10px;text-align:left;font-size:11px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid #e2e8f0}
td{padding:9px 10px;border-bottom:1px solid #f1f5f9;font-size:12px}
footer{margin-top:40px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:11px;color:#aaa;text-align:center}
@media print{body{padding:20px;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="header">
  <div><div class="title">Time Clock Report${organizationName ? ` — ${escape(organizationName)}` : ''}</div><div class="meta">Generated: ${new Date().toLocaleString()}</div></div>
  <div style="text-align:right;font-size:13px;font-weight:600;color:#444">Period: ${escape(dateRangeText)}</div>
</div>
<div class="emp-header">
  <div class="emp-name">${escape(employeeName)}</div>
  ${employeeEmail ? `<div class="emp-email">${escape(employeeEmail)}</div>` : ''}
  <div class="emp-stats">
    <div class="stat-chip">${completedEntries.length} sessions</div>
    <div class="stat-chip total-chip">${formatHM(totalHours)} total</div>
    ${overtimeHours > 0 ? `<div class="stat-chip" style="background:rgba(245,158,11,.3)">+${formatHM(overtimeHours)} OT</div>` : ''}
  </div>
</div>
${monthRows}
<footer>Confidential Time Clock Report &bull; ${new Date().toLocaleDateString()}</footer>
</body></html>`;

    if (Platform.OS === 'web') {
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } else {
      Alert.alert('Export', 'PDF export is available on web. Use Sharing on mobile to export this report.');
    }
  };

  const startEditing = (entry: TimeEntry) => {
    setEditingEntryId(entry.id);
    setEditClockIn(parseToEdit(entry.clock_in));
    setEditClockOut(entry.clock_out ? parseToEdit(entry.clock_out) : null);
    setEditDate(entry.clock_in);
  };

  const cancelEditing = () => {
    setEditingEntryId(null);
  };

  const handleSaveEdit = async (entryId: string, entryUserId: string) => {
    if (!user) return;
    setSaving(true);
    try {
      const newClockIn = editToDate(editClockIn, editDate).toISOString();
      const newClockOut = editClockOut ? editToDate(editClockOut, editDate).toISOString() : null;
      if (newClockOut && new Date(newClockOut) <= new Date(newClockIn)) {
        Alert.alert('Invalid Time', 'Clock out must be after clock in.');
        return;
      }
      const { error } = await supabase
        .from('time_entries')
        .update({ clock_in: newClockIn, clock_out: newClockOut })
        .eq('id', entryId);
      if (error) throw error;
      setEditingEntryId(null);
      onEntriesChanged?.();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update entry');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    Alert.alert(
      'Delete Entry',
      'Are you sure you want to delete this time entry? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.from('time_entries').delete().eq('id', entryId);
              if (error) throw error;
              onEntriesChanged?.();
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to delete entry');
            }
          },
        },
      ]
    );
  };

  const startAddingEntry = (dateKey: string) => {
    setAddingForDate(dateKey);
    setAddClockIn({ hour: '8', minute: '00', period: 'AM' });
    setAddClockOut({ hour: '5', minute: '00', period: 'PM' });
    setEditingEntryId(null);
  };

  const cancelAddingEntry = () => {
    setAddingForDate(null);
  };

  const handleAddEntry = async (dateKey: string) => {
    if (!targetUserId || !organizationId) return;
    setAddSaving(true);
    try {
      const newClockIn = editToDate(addClockIn, dateKey + 'T12:00:00').toISOString();
      const newClockOut = editToDate(addClockOut, dateKey + 'T12:00:00').toISOString();
      if (new Date(newClockOut) <= new Date(newClockIn)) {
        Alert.alert('Invalid Time', 'Clock out must be after clock in.');
        return;
      }
      const { error } = await supabase.from('time_entries').insert({
        user_id: targetUserId,
        organization_id: organizationId,
        clock_in: newClockIn,
        clock_out: newClockOut,
      });
      if (error) throw error;
      setAddingForDate(null);
      onEntriesChanged?.();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to add entry');
    } finally {
      setAddSaving(false);
    }
  };

  const startWeekAdd = (weekStartStr: string) => {
    const ws = new Date(weekStartStr + 'T12:00:00');
    const today = new Date();
    const we = new Date(ws);
    we.setDate(we.getDate() + 6);
    const defaultDay = today >= ws && today <= we ? today.toLocaleDateString('en-CA') : weekStartStr;
    setAddingForWeek(weekStartStr);
    setWeekAddDate(defaultDay);
    setWeekAddClockIn({ hour: '8', minute: '00', period: 'AM' });
    setWeekAddClockOut({ hour: '5', minute: '00', period: 'PM' });
    setAddingForDate(null);
    setEditingEntryId(null);
  };

  const cancelWeekAdd = () => {
    setAddingForWeek(null);
    setWeekAddDate('');
  };

  const handleWeekAddEntry = async (weekStartStr: string) => {
    if (!targetUserId || !organizationId || !weekAddDate) return;
    setWeekAddSaving(true);
    try {
      const newClockIn = editToDate(weekAddClockIn, weekAddDate + 'T12:00:00').toISOString();
      const newClockOut = editToDate(weekAddClockOut, weekAddDate + 'T12:00:00').toISOString();
      if (new Date(newClockOut) <= new Date(newClockIn)) {
        Alert.alert('Invalid Time', 'Clock out must be after clock in.');
        return;
      }
      const { error } = await supabase.from('time_entries').insert({
        user_id: targetUserId,
        organization_id: organizationId,
        clock_in: newClockIn,
        clock_out: newClockOut,
      });
      if (error) throw error;
      setAddingForWeek(null);
      setWeekAddDate('');
      onEntriesChanged?.();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to add entry');
    } finally {
      setWeekAddSaving(false);
    }
  };

  const getWeekDays = (weekStartStr: string): string[] => {
    const days: string[] = [];
    const ws = new Date(weekStartStr + 'T12:00:00');
    for (let i = 0; i < 7; i++) {
      const d = new Date(ws);
      d.setDate(d.getDate() + i);
      days.push(d.toLocaleDateString('en-CA'));
    }
    return days;
  };

  const renderTimeEditField = (label: string, value: TimeEdit, onChange: (v: TimeEdit) => void) => (
    <View style={styles.timeFieldRow}>
      <Text style={[styles.timeFieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      <View style={styles.timeFieldInputs}>
        <TextInput
          style={[styles.timeInput, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
          value={value.hour}
          onChangeText={v => onChange({ ...value, hour: v.replace(/\D/g, '').slice(0, 2) })}
          keyboardType="numeric"
          maxLength={2}
          selectTextOnFocus
        />
        <Text style={[styles.timeColon, { color: colors.text }]}>:</Text>
        <TextInput
          style={[styles.timeInput, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
          value={value.minute}
          onChangeText={v => onChange({ ...value, minute: v.replace(/\D/g, '').slice(0, 2) })}
          keyboardType="numeric"
          maxLength={2}
          selectTextOnFocus
        />
        <View style={[styles.periodToggle, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
          {(['AM', 'PM'] as const).map(p => (
            <TouchableOpacity
              key={p}
              onPress={() => onChange({ ...value, period: p })}
              style={[styles.periodBtn, value.period === p && { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.periodBtnText, { color: value.period === p ? '#fff' : colors.textSecondary }]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn} activeOpacity={0.7}>
            <ChevronLeft size={22} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerName, { color: colors.text }]} numberOfLines={1}>{employeeName}</Text>
            {employeeEmail ? <Text style={[styles.headerEmail, { color: colors.textSecondary }]} numberOfLines={1}>{employeeEmail}</Text> : null}
          </View>
          <TouchableOpacity onPress={handleExportPdf} style={[styles.pdfBtn, { overflow: 'hidden' }]} activeOpacity={0.8}>
            <LinearGradient colors={['#1B4D6E', '#245d82']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.pdfBtnGradient}>
              <FileText size={14} color="#fff" />
              <Text style={styles.pdfBtnText}>PDF</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={styles.summaryRow}>
            <View style={[styles.kpiCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
              <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Total Hours</Text>
              <Text style={[styles.kpiValue, { color: colors.primary }]}>{totalHours.toFixed(2)}h</Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
              <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Sessions</Text>
              <Text style={[styles.kpiValue, { color: colors.text }]}>{completedEntries.length}</Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
              <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Overtime</Text>
              <Text style={[styles.kpiValue, { color: overtimeHours > 0 ? '#f59e0b' : colors.textSecondary }]}>
                {overtimeHours > 0 ? `+${overtimeHours.toFixed(2)}h` : '0h'}
              </Text>
            </View>
          </View>

          {dailyBarData.days.length > 0 && (
            <View style={[styles.chartCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Daily Hours (Last 14 Days)</Text>
              <View style={styles.barChart}>
                {dailyBarData.days.map(([dateKey, h]) => {
                  const barH = Math.max(h > 0 ? 8 : 2, (h / dailyBarData.maxH) * 72);
                  const dt = new Date(dateKey + 'T12:00:00');
                  const label = dt.toLocaleDateString('en-US', { weekday: 'narrow' });
                  const todayKey = new Date().toLocaleDateString('en-CA');
                  const isTodayBar = dateKey === todayKey;
                  return (
                    <View key={dateKey} style={styles.barItem}>
                      {h > 0 && <Text style={[styles.barVal, { color: colors.primary }]}>{h.toFixed(2)}h</Text>}
                      <View style={[styles.bar, { height: barH, backgroundColor: isTodayBar ? colors.primary : colors.primary + 'aa' }]} />
                      <Text style={[styles.barLabel, { color: isTodayBar ? colors.primary : colors.textSecondary, fontWeight: isTodayBar ? '700' : '400' }]}>{label}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {weeklyBreakdown.map((week, wi) => {
            const locked = isWeekLocked(week.weekStartStr);
            return (
              <View key={wi} style={[styles.weekSection, { backgroundColor: colors.cardBackground, borderColor: locked ? '#10b981' : colors.border }]}>
                <View style={[styles.weekHeader, { borderBottomColor: colors.border, backgroundColor: locked ? '#f0fdf4' : 'transparent' }]}>
                  <View style={styles.weekHeaderLeft}>
                    {locked && <Lock size={14} color="#10b981" />}
                    <Text style={[styles.weekLabel, { color: locked ? '#047857' : colors.text }]}>{week.label}</Text>
                    {locked && (
                      <View style={styles.lockedBadge}>
                        <Text style={styles.lockedBadgeText}>Approved</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.weekHeaderRight}>
                    <Text style={[styles.weekTotal, { color: colors.primary }]}>{formatHM(week.totalHours)}</Text>
                    {isAdminOrManager && !locked && (
                      <TouchableOpacity
                        onPress={() => addingForWeek === week.weekStartStr ? cancelWeekAdd() : startWeekAdd(week.weekStartStr)}
                        style={[styles.lockBtn, { borderColor: colors.primary, backgroundColor: addingForWeek === week.weekStartStr ? colors.primary + '18' : colors.inputBackground }]}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.lockBtnText, { color: colors.primary, fontSize: 16, lineHeight: 16, marginTop: -1 }]}>
                          {addingForWeek === week.weekStartStr ? '×' : '+'}
                        </Text>
                        <Text style={[styles.lockBtnText, { color: colors.primary }]}>
                          {addingForWeek === week.weekStartStr ? 'Cancel' : 'Add Entry'}
                        </Text>
                      </TouchableOpacity>
                    )}
                    {isAdminOrManager && (
                      <TouchableOpacity
                        onPress={() => locked ? handleUnlockWeek(week.weekStartStr) : handleLockWeek(week.weekStartStr)}
                        style={[styles.lockBtn, { borderColor: locked ? '#10b981' : colors.border, backgroundColor: locked ? '#dcfce7' : colors.inputBackground }]}
                        activeOpacity={0.7}
                      >
                        {locked
                          ? <Unlock size={13} color="#047857" />
                          : <Lock size={13} color={colors.textSecondary} />
                        }
                        <Text style={[styles.lockBtnText, { color: locked ? '#047857' : colors.textSecondary }]}>
                          {locked ? 'Unlock' : 'Lock'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {lockingWeek === week.weekStartStr && (
                  <View style={[styles.lockConfirmBox, { backgroundColor: colors.inputBackground, borderTopColor: colors.border }]}>
                    <View style={styles.lockConfirmHeader}>
                      <AlertTriangle size={16} color="#f59e0b" />
                      <Text style={[styles.lockConfirmTitle, { color: colors.text }]}>Lock this week for payroll?</Text>
                    </View>
                    <Text style={[styles.lockConfirmSub, { color: colors.textSecondary }]}>
                      This will mark the week as approved. You can unlock it later if needed.
                    </Text>
                    <TextInput
                      style={[styles.lockNoteInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                      placeholder="Optional note (e.g. Payroll approved)"
                      placeholderTextColor={colors.textSecondary}
                      value={lockNote}
                      onChangeText={setLockNote}
                    />
                    <View style={styles.lockConfirmActions}>
                      <TouchableOpacity
                        onPress={() => { setLockingWeek(null); setLockNote(''); }}
                        style={[styles.lockConfirmBtn, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                      >
                        <Text style={[styles.lockConfirmBtnText, { color: colors.textSecondary }]}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => confirmLockWeek(week.weekStartStr)}
                        style={[styles.lockConfirmBtn, { borderColor: '#10b981', overflow: 'hidden', padding: 0, paddingVertical: 0 }]}
                      >
                        <LinearGradient colors={['#2D8B57', '#34a065']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.lockConfirmBtnGradient}>
                          <Lock size={13} color="#fff" />
                          <Text style={[styles.lockConfirmBtnText, { color: '#fff' }]}>Confirm Lock</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {addingForWeek === week.weekStartStr && (
                  <View style={[styles.inlineEdit, { backgroundColor: colors.inputBackground, borderColor: colors.primary, borderWidth: 1.5, margin: 12, marginTop: 0, borderRadius: 10 }]}>
                    <Text style={[styles.lockConfirmTitle, { color: colors.text, marginBottom: 10, fontSize: 13 }]}>Add Entry — Select Day</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {getWeekDays(week.weekStartStr).map(dayKey => {
                          const dt = new Date(dayKey + 'T12:00:00');
                          const dayLabel = dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                          const isSelected = weekAddDate === dayKey;
                          return (
                            <TouchableOpacity
                              key={dayKey}
                              onPress={() => setWeekAddDate(dayKey)}
                              style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 18, borderWidth: 1.5, borderColor: isSelected ? colors.primary : colors.border, backgroundColor: isSelected ? colors.primary : 'transparent' }}
                            >
                              <Text style={{ fontSize: 12, fontWeight: '600', color: isSelected ? '#fff' : colors.textSecondary }}>{dayLabel}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </ScrollView>
                    {renderTimeEditField('Clock In', weekAddClockIn, setWeekAddClockIn)}
                    {renderTimeEditField('Clock Out', weekAddClockOut, setWeekAddClockOut)}
                    <View style={styles.editActions}>
                      <TouchableOpacity
                        onPress={cancelWeekAdd}
                        style={[styles.editActionBtn, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                      >
                        <X size={15} color={colors.textSecondary} />
                        <Text style={[styles.editActionText, { color: colors.textSecondary }]}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleWeekAddEntry(week.weekStartStr)}
                        style={[styles.editActionBtn, { borderColor: colors.primary, overflow: 'hidden', padding: 0, paddingVertical: 0 }]}
                        disabled={weekAddSaving || !weekAddDate}
                      >
                        <LinearGradient colors={['#1B4D6E', '#245d82']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.editActionBtnGradient}>
                          <Check size={15} color="#fff" />
                          <Text style={[styles.editActionText, { color: '#fff' }]}>{weekAddSaving ? 'Saving...' : 'Add Entry'}</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {Object.entries(week.days).sort(([a], [b]) => b.localeCompare(a)).map(([dateKey, dayData]) => {
                  const dt = new Date(dateKey + 'T12:00:00');
                  const dateLabel = dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                  return (
                    <View key={dateKey} style={[styles.dayBlock, { borderBottomColor: colors.border }]}>
                      <View style={styles.dayHeader}>
                        <Text style={[styles.dayLabel, { color: colors.text }]}>{dateLabel}</Text>
                        <Text style={[styles.dayHours, { color: colors.primary }]}>{formatHM(dayData.hours)}</Text>
                      </View>
                      {isAdminOrManager && !locked && (
                        addingForDate === dateKey ? (
                          <View style={[styles.inlineEdit, { backgroundColor: colors.inputBackground, borderColor: colors.border, marginBottom: 8 }]}>
                            {renderTimeEditField('Clock In', addClockIn, setAddClockIn)}
                            {renderTimeEditField('Clock Out', addClockOut, setAddClockOut)}
                            <View style={styles.editActions}>
                              <TouchableOpacity
                                onPress={cancelAddingEntry}
                                style={[styles.editActionBtn, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                              >
                                <X size={15} color={colors.textSecondary} />
                                <Text style={[styles.editActionText, { color: colors.textSecondary }]}>Cancel</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => handleAddEntry(dateKey)}
                                style={[styles.editActionBtn, { borderColor: colors.primary, overflow: 'hidden', padding: 0, paddingVertical: 0 }]}
                                disabled={addSaving}
                              >
                                <LinearGradient colors={['#1B4D6E', '#245d82']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.editActionBtnGradient}>
                                  <Check size={15} color="#fff" />
                                  <Text style={[styles.editActionText, { color: '#fff' }]}>{addSaving ? 'Saving...' : 'Add'}</Text>
                                </LinearGradient>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ) : (
                          <TouchableOpacity
                            onPress={() => startAddingEntry(dateKey)}
                            style={[styles.addEntryBtn, { borderColor: colors.border }]}
                          >
                            <Text style={[styles.addEntryBtnText, { color: colors.primary }]}>+ Add Entry</Text>
                          </TouchableOpacity>
                        )
                      )}
                      {dayData.entries.sort((a, b) => new Date(b.clock_in).getTime() - new Date(a.clock_in).getTime()).map((entry) => {
                        const h = calcHours(entry.clock_in, entry.clock_out);
                        const breaks = entry.breaks?.filter(b => b.ended_at) || [];
                        const isEditing = editingEntryId === entry.id;
                        const canEdit = isAdminOrManager && !locked;

                        return (
                          <View key={entry.id} style={styles.entryBlock}>
                            {!isEditing && (
                              <View style={styles.entryRow}>
                                <View style={styles.entryTimes}>
                                  <View style={[styles.timeChip, { backgroundColor: '#dcfce7' }]}>
                                    <Text style={[styles.timeChipText, { color: '#166534' }]}>{fmtTime(entry.clock_in)}</Text>
                                  </View>
                                  <Text style={[styles.arrow, { color: colors.textSecondary }]}>→</Text>
                                  {entry.clock_out ? (
                                    <View style={[styles.timeChip, { backgroundColor: '#fee2e2' }]}>
                                      <Text style={[styles.timeChipText, { color: '#991b1b' }]}>{fmtTime(entry.clock_out)}</Text>
                                    </View>
                                  ) : (
                                    <View style={[styles.timeChip, { backgroundColor: '#fef3c7' }]}>
                                      <Text style={[styles.timeChipText, { color: '#92400e' }]}>Active</Text>
                                    </View>
                                  )}
                                  {breaks.length > 0 && (
                                    <View style={[styles.breakChip, { backgroundColor: colors.inputBackground }]}>
                                      <Coffee size={10} color={colors.textSecondary} />
                                      <Text style={[styles.breakText, { color: colors.textSecondary }]}>{breaks.length}x</Text>
                                    </View>
                                  )}
                                </View>
                                <View style={styles.entryRight}>
                                  <Text style={[styles.entryHours, { color: colors.text }]}>{formatHM(h)}</Text>
                                  {canEdit && (
                                    <View style={styles.entryBtnGroup}>
                                      <TouchableOpacity
                                        onPress={() => startEditing(entry)}
                                        style={[styles.editBtn, { borderColor: colors.border }]}
                                      >
                                        <Pencil size={11} color={colors.primary} />
                                        <Text style={[styles.editBtnText, { color: colors.primary }]}>Edit</Text>
                                      </TouchableOpacity>
                                      <TouchableOpacity
                                        onPress={() => handleDeleteEntry(entry.id)}
                                        style={[styles.editBtn, { borderColor: '#fca5a5' }]}
                                      >
                                        <Trash2 size={11} color="#dc2626" />
                                        <Text style={[styles.editBtnText, { color: '#dc2626' }]}>Delete</Text>
                                      </TouchableOpacity>
                                    </View>
                                  )}
                                  {locked && isAdminOrManager && (
                                    <View style={[styles.lockedEntryTag, { backgroundColor: '#dcfce7' }]}>
                                      <Lock size={10} color="#047857" />
                                    </View>
                                  )}
                                </View>
                              </View>
                            )}

                            {isEditing && (
                              <View style={[styles.inlineEdit, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                                {renderTimeEditField('Clock In', editClockIn, setEditClockIn)}
                                {editClockOut && renderTimeEditField('Clock Out', editClockOut, setEditClockOut)}
                                <View style={styles.editActions}>
                                  <TouchableOpacity
                                    onPress={cancelEditing}
                                    style={[styles.editActionBtn, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                                  >
                                    <X size={15} color={colors.textSecondary} />
                                    <Text style={[styles.editActionText, { color: colors.textSecondary }]}>Cancel</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    onPress={() => handleSaveEdit(entry.id, entry.user_id)}
                                    style={[styles.editActionBtn, { borderColor: colors.primary, overflow: 'hidden', padding: 0, paddingVertical: 0 }]}
                                    disabled={saving}
                                  >
                                    <LinearGradient colors={['#1B4D6E', '#245d82']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.editActionBtnGradient}>
                                      <Check size={15} color="#fff" />
                                      <Text style={[styles.editActionText, { color: '#fff' }]}>{saving ? 'Saving...' : 'Save'}</Text>
                                    </LinearGradient>
                                  </TouchableOpacity>
                                </View>
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  );
                })}
              </View>
            );
          })}

          {weeklyBreakdown.length === 0 && (
            <View style={styles.empty}>
              <Clock size={32} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No completed entries</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerCenter: { flex: 1 },
  headerName: { fontSize: 17, fontWeight: '700' },
  headerEmail: { fontSize: 12, marginTop: 1 },
  pdfBtn: {
    borderRadius: 20,
  },
  pdfBtnGradient: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  pdfBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  summaryRow: { flexDirection: 'row', gap: 10, padding: 16 },
  kpiCard: {
    flex: 1, borderRadius: 12, padding: 14, borderWidth: 1, alignItems: 'center',
    ...Platform.select({ web: { boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }, default: {} }),
  },
  kpiLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6, textAlign: 'center' },
  kpiValue: { fontSize: 20, fontWeight: '800' },
  chartCard: {
    marginHorizontal: 16, marginBottom: 12, borderRadius: 14, padding: 16, borderWidth: 1,
    ...Platform.select({ web: { boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }, default: {} }),
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', marginBottom: 12 },
  barChart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', height: 96 },
  barItem: { alignItems: 'center', flex: 1, gap: 3 },
  barVal: { fontSize: 8, fontWeight: '700' },
  bar: { width: 8, borderRadius: 4, minHeight: 2 },
  barLabel: { fontSize: 9 },
  weekSection: {
    marginHorizontal: 16, marginBottom: 12, borderRadius: 14, borderWidth: 1.5, overflow: 'hidden',
    ...Platform.select({ web: { boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }, default: {} }),
  },
  weekHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1,
  },
  weekHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  weekHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  weekLabel: { fontSize: 13, fontWeight: '700' },
  weekTotal: { fontSize: 15, fontWeight: '800' },
  lockedBadge: { backgroundColor: '#dcfce7', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  lockedBadgeText: { fontSize: 10, fontWeight: '700', color: '#047857' },
  lockBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12, borderWidth: 1,
  },
  lockBtnText: { fontSize: 11, fontWeight: '600' },
  lockConfirmBox: {
    padding: 14, borderTopWidth: 1, gap: 10,
  },
  lockConfirmHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lockConfirmTitle: { fontSize: 13, fontWeight: '700' },
  lockConfirmSub: { fontSize: 12, lineHeight: 17 },
  lockNoteInput: {
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
    fontSize: 13,
  },
  lockConfirmActions: { flexDirection: 'row', gap: 8 },
  lockConfirmBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 9, borderRadius: 10, borderWidth: 1,
  },
  lockConfirmBtnGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 9,
  },
  lockConfirmBtnText: { fontSize: 13, fontWeight: '600' },
  dayBlock: { borderBottomWidth: StyleSheet.hairlineWidth },
  dayHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4,
  },
  dayLabel: { fontSize: 12, fontWeight: '600' },
  dayHours: { fontSize: 12, fontWeight: '700' },
  entryBlock: { paddingHorizontal: 14, paddingBottom: 8 },
  entryRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
  },
  entryTimes: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, flexWrap: 'wrap' },
  timeChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  timeChipText: { fontSize: 12, fontWeight: '600' },
  arrow: { fontSize: 11 },
  breakChip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  breakText: { fontSize: 10, fontWeight: '600' },
  entryRight: { alignItems: 'flex-end', gap: 4, flexShrink: 0 },
  entryHours: { fontSize: 14, fontWeight: '800' },
  addEntryBtn: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 6, paddingVertical: 6, alignItems: 'center', marginBottom: 8 },
  addEntryBtnText: { fontSize: 12, fontWeight: '600' },
  entryBtnGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  editBtnText: { fontSize: 11, fontWeight: '600' },
  lockedEntryTag: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  inlineEdit: {
    marginTop: 8, borderRadius: 10, borderWidth: 1, padding: 12, gap: 10,
  },
  timeFieldRow: { gap: 4 },
  timeFieldLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  timeFieldInputs: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timeInput: {
    width: 44, paddingVertical: 6, paddingHorizontal: 8,
    borderRadius: 7, borderWidth: 1, fontSize: 15, fontWeight: '600',
    textAlign: 'center',
  },
  timeColon: { fontSize: 18, fontWeight: '700' },
  periodToggle: { flexDirection: 'row', borderRadius: 7, borderWidth: 1, overflow: 'hidden' },
  periodBtn: { paddingVertical: 6, paddingHorizontal: 10 },
  periodBtnText: { fontSize: 12, fontWeight: '700' },
  editActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  editActionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 9, borderRadius: 10, borderWidth: 1,
  },
  editActionBtnGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 9,
  },
  editActionText: { fontSize: 13, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyText: { fontSize: 14 },
});
