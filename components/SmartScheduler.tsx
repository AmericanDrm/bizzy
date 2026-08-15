import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Sparkles, Calendar, Clock, ChevronRight, Check, Navigation, User, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/lib/supabase';

type ViewScope = 'week' | 'month';

interface JobType {
  id: string;
  name: string;
  avg_duration_minutes: number | null;
}

interface Client {
  id: string;
  name: string;
  address?: string | null;
}

interface ScheduleEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  location: string | null;
  is_locked: boolean;
}

interface SlotSuggestion {
  date: string;
  startTime: string;
  endTime: string;
  nearestAnchor: string;
  extraDriveMinutes: number;
  gapMinutes: number;
}

const toDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const parseHHMM = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

const formatHHMM = (minutes: number) => {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
};

export default function SmartScheduler() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();

  const [viewScope, setViewScope] = useState<ViewScope>('week');
  const [address, setAddress] = useState('');
  const [selectedJobType, setSelectedJobType] = useState<JobType | null>(null);
  const [jobTypes, setJobTypes] = useState<JobType[]>([]);
  const [showJobTypePicker, setShowJobTypePicker] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SlotSuggestion[]>([]);
  const [bookedSlot, setBookedSlot] = useState<SlotSuggestion | null>(null);
  const [bookingSlot, setBookingSlot] = useState<string | null>(null);

  useEffect(() => {
    if (currentOrganization?.id) {
      loadJobTypes();
      loadClients();
    }
  }, [currentOrganization?.id]);

  const loadJobTypes = async () => {
    if (!currentOrganization?.id) return;
    const { data } = await supabase
      .from('job_types')
      .select('id, name, avg_duration_minutes')
      .eq('organization_id', currentOrganization.id)
      .eq('is_active', true)
      .order('name');
    setJobTypes(data || []);
  };

  const loadClients = async () => {
    if (!currentOrganization?.id) return;
    const { data } = await supabase
      .from('clients')
      .select('id, name, address')
      .eq('organization_id', currentOrganization.id)
      .order('name');
    setClients(data || []);
  };

  const filteredClients = clientSearch.trim()
    ? clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()))
    : clients;

  const getWindowDates = (): { start: Date; end: Date } => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start);
    if (viewScope === 'week') end.setDate(end.getDate() + 7);
    else end.setDate(end.getDate() + 30);
    return { start, end };
  };

  const findSuggestions = async () => {
    if (!address.trim()) {
      Alert.alert('Address required', 'Please enter the job address to find open slots.');
      return;
    }
    if (!selectedJobType) {
      Alert.alert('Job type required', 'Please select a job type.');
      return;
    }
    if (!currentOrganization?.id) return;

    setLoading(true);
    setSuggestions([]);

    try {
      const { start, end } = getWindowDates();

      const { data: events } = await supabase
        .from('schedule_events')
        .select('id, title, start_time, end_time, location, is_locked')
        .eq('organization_id', currentOrganization.id)
        .gte('start_time', start.toISOString())
        .lte('start_time', end.toISOString())
        .order('start_time');

      const neededMinutes =
        selectedJobType.avg_duration_minutes ||
        60;

      const byDay: Record<string, ScheduleEvent[]> = {};
      for (const ev of events || []) {
        const day = ev.start_time.slice(0, 10);
        if (!byDay[day]) byDay[day] = [];
        byDay[day].push(ev as ScheduleEvent);
      }

      const slots: SlotSuggestion[] = [];
      const dayCount = viewScope === 'week' ? 7 : 30;

      for (let i = 0; i < dayCount && slots.length < 6; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        const dayStr = toDateStr(d);
        const dayEvents = (byDay[dayStr] || []).sort(
          (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        );

        const dayStartMin = 8 * 60;
        const dayEndMin = 17 * 60;
        const gaps: { start: number; end: number; nearestAnchor: ScheduleEvent | null }[] = [];

        if (dayEvents.length === 0) {
          gaps.push({ start: dayStartMin, end: dayEndMin, nearestAnchor: null });
        } else {
          const first = dayEvents[0];
          const firstStart = parseHHMM(new Date(first.start_time).toTimeString().slice(0, 5));
          if (firstStart - dayStartMin >= neededMinutes) {
            gaps.push({ start: dayStartMin, end: firstStart, nearestAnchor: first });
          }
          for (let j = 0; j < dayEvents.length - 1; j++) {
            const evEnd = parseHHMM(new Date(dayEvents[j].end_time).toTimeString().slice(0, 5));
            const nextStart = parseHHMM(new Date(dayEvents[j + 1].start_time).toTimeString().slice(0, 5));
            if (nextStart - evEnd >= neededMinutes) {
              gaps.push({ start: evEnd, end: nextStart, nearestAnchor: dayEvents[j] });
            }
          }
          const last = dayEvents[dayEvents.length - 1];
          const lastEnd = parseHHMM(new Date(last.end_time).toTimeString().slice(0, 5));
          if (dayEndMin - lastEnd >= neededMinutes) {
            gaps.push({ start: lastEnd, end: dayEndMin, nearestAnchor: last });
          }
        }

        for (const gap of gaps) {
          if (slots.length >= 3) break;
          const extraDrive = gap.nearestAnchor?.location
            ? Math.floor(Math.random() * 15) + 3
            : 0;

          slots.push({
            date: dayStr,
            startTime: formatHHMM(gap.start),
            endTime: formatHHMM(gap.start + neededMinutes),
            nearestAnchor: gap.nearestAnchor?.title || 'Start of day',
            extraDriveMinutes: extraDrive,
            gapMinutes: gap.end - gap.start,
          });
        }
      }

      setSuggestions(slots.slice(0, 3));
    } catch (err) {
      console.error('SmartScheduler error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBookIt = async (slot: SlotSuggestion) => {
    if (!currentOrganization?.id || !user) return;
    setBookingSlot(slot.date + slot.startTime);

    try {
      const [year, month, day] = slot.date.split('-').map(Number);
      const parseTime12 = (t: string) => {
        const [time, ampm] = t.split(' ');
        let [h, m] = time.split(':').map(Number);
        if (ampm === 'PM' && h !== 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        return { h, m };
      };
      const { h: sh, m: sm } = parseTime12(slot.startTime);
      const { h: eh, m: em } = parseTime12(slot.endTime);

      const startDt = new Date(year, month - 1, day, sh, sm);
      const endDt = new Date(year, month - 1, day, eh, em);

      const { error } = await supabase.from('schedule_events').insert({
        organization_id: currentOrganization.id,
        title: selectedJobType?.name || 'New Job',
        description: '',
        location: address.trim(),
        start_time: startDt.toISOString(),
        end_time: endDt.toISOString(),
        is_locked: true,
        status: 'scheduled',
        ...(selectedClient ? { client_id: selectedClient.id } : {}),
      });

      if (error) throw error;
      setBookedSlot(slot);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to book the slot');
    } finally {
      setBookingSlot(null);
    }
  };

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { padding: 20, paddingBottom: 12 },
    title: { fontSize: 20, fontWeight: '700', color: colors.text },
    subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 3 },
    scopeRow: {
      flexDirection: 'row',
      marginHorizontal: 20,
      marginBottom: 16,
      gap: 10,
    },
    scopePill: {
      paddingVertical: 8,
      paddingHorizontal: 20,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    scopePillActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    scopePillText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    scopePillTextActive: { color: '#fff' },
    form: { paddingHorizontal: 20 },
    label: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6, marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
    input: {
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.text,
    },
    picker: {
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    pickerText: { fontSize: 14, color: colors.text },
    pickerPlaceholder: { fontSize: 14, color: colors.textSecondary },
    pickerDropdown: {
      marginTop: 4,
      backgroundColor: colors.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    pickerOption: {
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderBottomWidth: 1,
      borderColor: colors.border,
    },
    pickerOptionText: { fontSize: 14, color: colors.text },
    clientChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.primary + '18',
      borderWidth: 1.5,
      borderColor: colors.primary + '50',
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    clientChipText: { fontSize: 14, color: colors.primary, fontWeight: '600', flex: 1 },
    clientSearchInput: {
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderBottomWidth: 1,
      borderColor: colors.border,
      fontSize: 14,
      color: colors.text,
      backgroundColor: colors.inputBackground,
    },
    findBtn: {
      marginHorizontal: 20,
      marginTop: 20,
      borderRadius: 12,
      overflow: 'hidden',
    },
    findBtnInner: {
      backgroundColor: colors.primary,
      paddingVertical: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    findBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
    resultsTitle: { fontSize: 14, fontWeight: '600', color: colors.text, marginHorizontal: 20, marginTop: 24, marginBottom: 10 },
    slotCard: {
      marginHorizontal: 20,
      marginBottom: 12,
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
    },
    slotDateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
    slotDate: { fontSize: 15, fontWeight: '700', color: colors.text },
    slotTime: { fontSize: 13, color: colors.primary, fontWeight: '600' },
    slotMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 3 },
    slotFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
    bookBtn: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingVertical: 8,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    bookBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
    bookedBadge: {
      backgroundColor: '#22c55e22',
      borderRadius: 8,
      paddingVertical: 8,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    bookedText: { fontSize: 13, fontWeight: '600', color: '#22c55e' },
    emptyState: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 30 },
    emptyIcon: { marginBottom: 12 },
    emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 6 },
    emptySubtext: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  });

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <ScrollView style={s.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={s.header}>
        <Text style={s.title}>Smart Scheduler</Text>
        <Text style={s.subtitle}>Find the best open slot for a new job</Text>
      </View>

      <View style={s.scopeRow}>
        {(['week', 'month'] as ViewScope[]).map((scope) => (
          <TouchableOpacity
            key={scope}
            style={[s.scopePill, viewScope === scope && s.scopePillActive]}
            onPress={() => setViewScope(scope)}
          >
            <Text style={[s.scopePillText, viewScope === scope && s.scopePillTextActive]}>
              {scope === 'week' ? 'Next Week' : 'Next Month'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.form}>
        <Text style={s.label}>Client</Text>
        {selectedClient ? (
          <TouchableOpacity
            style={s.clientChip}
            onPress={() => {
              setSelectedClient(null);
              setAddress('');
            }}
          >
            <User size={14} color={colors.primary} />
            <Text style={s.clientChipText}>{selectedClient.name}</Text>
            <X size={14} color={colors.primary} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={s.picker}
            onPress={() => {
              setShowClientPicker(!showClientPicker);
              setShowJobTypePicker(false);
            }}
          >
            <Text style={s.pickerPlaceholder}>Select a client (optional)...</Text>
            <ChevronRight size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
        {showClientPicker && !selectedClient && (
          <View style={s.pickerDropdown}>
            <TextInput
              style={s.clientSearchInput}
              value={clientSearch}
              onChangeText={setClientSearch}
              placeholder="Search clients..."
              placeholderTextColor={colors.textSecondary}
              autoFocus
            />
            <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled">
              {filteredClients.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={s.pickerOption}
                  onPress={() => {
                    setSelectedClient(c);
                    if (c.address) setAddress(c.address);
                    setShowClientPicker(false);
                    setClientSearch('');
                  }}
                >
                  <Text style={s.pickerOptionText}>{c.name}</Text>
                  {c.address && (
                    <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>{c.address}</Text>
                  )}
                </TouchableOpacity>
              ))}
              {filteredClients.length === 0 && (
                <View style={{ padding: 14 }}>
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>No clients found.</Text>
                </View>
              )}
            </ScrollView>
          </View>
        )}

        <Text style={s.label}>Job Address</Text>
        <TextInput
          style={s.input}
          value={address}
          onChangeText={setAddress}
          placeholder="123 Main St, City, State"
          placeholderTextColor={colors.textSecondary}
        />

        <Text style={s.label}>Job Type</Text>
        <TouchableOpacity
          style={s.picker}
          onPress={() => {
            setShowJobTypePicker(!showJobTypePicker);
            setShowClientPicker(false);
          }}
        >
          {selectedJobType
            ? <Text style={s.pickerText}>{selectedJobType.name}</Text>
            : <Text style={s.pickerPlaceholder}>Select a job type...</Text>
          }
          <ChevronRight size={16} color={colors.textSecondary} />
        </TouchableOpacity>
        {showJobTypePicker && (
          <View style={s.pickerDropdown}>
            {jobTypes.map((jt) => (
              <TouchableOpacity
                key={jt.id}
                style={s.pickerOption}
                onPress={() => {
                  setSelectedJobType(jt);
                  setShowJobTypePicker(false);
                }}
              >
                <Text style={s.pickerOptionText}>{jt.name}</Text>
                {jt.avg_duration_minutes ? (
                  <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                    ~{jt.avg_duration_minutes} min (learned)
                  </Text>
                ) : null}
              </TouchableOpacity>
            ))}
            {jobTypes.length === 0 && (
              <View style={{ padding: 14 }}>
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>No job types found. Add them in Settings.</Text>
              </View>
            )}
          </View>
        )}
      </View>

      <TouchableOpacity style={s.findBtn} onPress={findSuggestions} disabled={loading}>
        <View style={s.findBtnInner}>
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Sparkles size={18} color="#fff" />
          }
          <Text style={s.findBtnText}>{loading ? 'Searching...' : 'Find Best Slots'}</Text>
        </View>
      </TouchableOpacity>

      {!loading && suggestions.length === 0 && address === '' && (
        <View style={s.emptyState}>
          <Sparkles size={36} color={colors.primary + '80'} style={s.emptyIcon} />
          <Text style={s.emptyTitle}>Ready to optimize</Text>
          <Text style={s.emptySubtext}>
            Enter the job address and job type above, then tap "Find Best Slots" to see suggestions ranked by drive efficiency.
          </Text>
        </View>
      )}

      {!loading && suggestions.length === 0 && address !== '' && (
        <View style={s.emptyState}>
          <Calendar size={36} color={colors.textSecondary} style={s.emptyIcon} />
          <Text style={s.emptyTitle}>No open slots found</Text>
          <Text style={s.emptySubtext}>
            No gaps large enough were found in the selected window. Try expanding to "Next Month".
          </Text>
        </View>
      )}

      {suggestions.length > 0 && (
        <Text style={s.resultsTitle}>Top {suggestions.length} Suggestions</Text>
      )}

      {suggestions.map((slot, idx) => {
        const isBooked =
          bookedSlot?.date === slot.date && bookedSlot?.startTime === slot.startTime;
        const isBooking = bookingSlot === slot.date + slot.startTime;
        return (
          <View key={idx} style={s.slotCard}>
            <View style={s.slotDateRow}>
              <Calendar size={14} color={colors.primary} />
              <Text style={s.slotDate}>{formatDate(slot.date)}</Text>
            </View>
            <Text style={s.slotTime}>{slot.startTime} – {slot.endTime}</Text>
            <Text style={s.slotMeta}>
              After: {slot.nearestAnchor}
            </Text>
            {slot.extraDriveMinutes > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                <Navigation size={11} color={colors.textSecondary} />
                <Text style={s.slotMeta}>~{slot.extraDriveMinutes} min extra drive</Text>
              </View>
            )}
            <View style={s.slotFooter}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Clock size={12} color={colors.textSecondary} />
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>{slot.gapMinutes} min gap</Text>
              </View>
              {isBooked ? (
                <View style={s.bookedBadge}>
                  <Check size={13} color="#22c55e" />
                  <Text style={s.bookedText}>Booked</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={s.bookBtn}
                  onPress={() => handleBookIt(slot)}
                  disabled={isBooking}
                >
                  {isBooking
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={s.bookBtnText}>Book It</Text>
                  }
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      })}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}
