import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Platform, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { MapPin, Hop as Home, Coffee, Truck, Clock, ExternalLink, Navigation } from 'lucide-react-native';

const STATUS_LABELS: Record<string, string> = {
  home: 'Home Base',
  job_site: 'Job Site',
  break: 'Break',
  traveling: 'Traveling',
};

const STATUS_COLORS: Record<string, string> = {
  home: '#4b8ef1',
  job_site: '#22c55e',
  break: '#f59e0b',
  traveling: '#8b5cf6',
};

const STATUS_ICONS: Record<string, any> = {
  home: Home,
  job_site: MapPin,
  break: Coffee,
  traveling: Truck,
};

interface LocationLog {
  id: string;
  detected_at: string;
  latitude: number;
  longitude: number;
  address: string | null;
  context_type: string;
  stop_duration_minutes: number | null;
  user_response: string | null;
}

interface Segment {
  id: string;
  session_type: string;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
  entry_latitude: number | null;
  entry_longitude: number | null;
  exit_latitude: number | null;
  exit_longitude: number | null;
  notes: string | null;
}

export default function TimeEntryBreakdownScreen() {
  const { id } = useLocalSearchParams();
  const { colors } = useTheme();
  const { user } = useAuth();

  const [entry, setEntry] = useState<any>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [locationLogs, setLocationLogs] = useState<LocationLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id && user?.id) {
      loadData();
    }
  }, [id, user?.id]);

  const loadData = async () => {
    if (!user?.id) return;
    setLoading(true);

    const [{ data: entryData }, { data: sessionData }, { data: logsData }] = await Promise.all([
      supabase
        .from('time_entries')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('productivity_sessions')
        .select('*')
        .eq('time_entry_id', id)
        .eq('user_id', user.id)
        .order('start_time', { ascending: true }),
      supabase
        .from('location_audit_logs')
        .select('id, detected_at, latitude, longitude, address, context_type, stop_duration_minutes, user_response')
        .eq('time_entry_id', id)
        .eq('user_id', user.id)
        .order('detected_at', { ascending: true }),
    ]);

    setEntry(entryData);
    setSegments(sessionData || []);
    setLocationLogs(logsData || []);
    setLoading(false);
  };

  const formatTime = (ts: string) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const formatDate = (ts: string) =>
    new Date(ts).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  const formatDuration = (start: string, end: string | null) => {
    if (!end) return 'In progress';
    const ms = new Date(end).getTime() - new Date(start).getTime();
    const hours = ms / 3_600_000;
    return `${hours.toFixed(2)}h`;
  };

  const openMaps = (lat: number, lng: number, label?: string | null) => {
    const query = label ? encodeURIComponent(label) : `${lat},${lng}`;
    let url: string;
    if (Platform.OS === 'ios') {
      url = `maps://maps.apple.com/?q=${query}&ll=${lat},${lng}`;
    } else if (Platform.OS === 'android') {
      url = `geo:${lat},${lng}?q=${query}`;
    } else {
      url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    }
    Linking.openURL(url);
  };

  const getLogsForSegment = (segment: Segment): LocationLog[] => {
    const start = new Date(segment.start_time).getTime();
    const end = segment.end_time ? new Date(segment.end_time).getTime() : Date.now();
    return locationLogs.filter(log => {
      const t = new Date(log.detected_at).getTime();
      return t >= start && t <= end;
    });
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!entry) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textSecondary }}>Time entry not found</Text>
      </View>
    );
  }

  const totalDuration = formatDuration(entry.clock_in, entry.clock_out);
  const firstLog = locationLogs[0];
  const lastLog = locationLogs[locationLogs.length - 1];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.headerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>
          {formatDate(entry.clock_in)}
        </Text>
        <Text style={[styles.title, { color: colors.text }]}>Shift Breakdown</Text>

        <View style={styles.timeRow}>
          <View style={styles.timeBlock}>
            <Text style={[styles.timeLabel, { color: colors.textSecondary }]}>Clock In</Text>
            <Text style={[styles.timeValue, { color: colors.text }]}>{formatTime(entry.clock_in)}</Text>
            {firstLog?.address ? (
              <TouchableOpacity
                style={styles.locationRow}
                onPress={() => firstLog.latitude && openMaps(firstLog.latitude, firstLog.longitude, firstLog.address)}
                activeOpacity={0.7}
              >
                <MapPin size={11} color={colors.primary} />
                <Text style={[styles.locationAddress, { color: colors.primary }]} numberOfLines={2}>
                  {firstLog.address}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={[styles.timeDivider, { backgroundColor: colors.border }]} />

          <View style={styles.timeBlock}>
            <Text style={[styles.timeLabel, { color: colors.textSecondary }]}>
              {entry.clock_out ? 'Clock Out' : 'In Progress'}
            </Text>
            <Text style={[styles.timeValue, { color: colors.text }]}>
              {entry.clock_out ? formatTime(entry.clock_out) : '—'}
            </Text>
            {entry.clock_out && lastLog?.address && lastLog.id !== firstLog?.id ? (
              <TouchableOpacity
                style={styles.locationRow}
                onPress={() => lastLog.latitude && openMaps(lastLog.latitude, lastLog.longitude, lastLog.address)}
                activeOpacity={0.7}
              >
                <MapPin size={11} color={colors.primary} />
                <Text style={[styles.locationAddress, { color: colors.primary }]} numberOfLines={2}>
                  {lastLog.address}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={[styles.durationBlock, { backgroundColor: colors.primaryLight || colors.background }]}>
            <Clock size={14} color={colors.primary} />
            <Text style={[styles.totalDuration, { color: colors.primary }]}>{totalDuration}</Text>
          </View>
        </View>
      </View>

      {segments.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Activity</Text>
          {segments.map((seg, index) => {
            const Icon = STATUS_ICONS[seg.session_type] || MapPin;
            const accentColor = STATUS_COLORS[seg.session_type] || colors.primary;
            const segLogs = getLogsForSegment(seg);
            const hasCoords = seg.entry_latitude != null && seg.entry_longitude != null;
            const firstSegLog = segLogs.find(l => l.address);

            return (
              <View key={seg.id} style={styles.segmentWrapper}>
                {index > 0 && (
                  <View style={[styles.connector, { backgroundColor: colors.border }]} />
                )}
                <View style={[styles.segment, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[styles.segmentAccent, { backgroundColor: accentColor }]} />
                  <View style={styles.segmentBody}>
                    <View style={styles.segmentTopRow}>
                      <View style={[styles.iconCircle, { backgroundColor: accentColor + '20' }]}>
                        <Icon size={16} color={accentColor} />
                      </View>
                      <View style={styles.segmentMeta}>
                        <Text style={[styles.segmentType, { color: colors.text }]}>
                          {STATUS_LABELS[seg.session_type] || seg.session_type}
                        </Text>
                        <Text style={[styles.segmentTime, { color: colors.textSecondary }]}>
                          {formatTime(seg.start_time)}
                          {seg.end_time ? ` → ${formatTime(seg.end_time)}` : ' → now'}
                        </Text>
                      </View>
                      <View style={[styles.durationPill, { backgroundColor: accentColor + '18' }]}>
                        <Text style={[styles.durationPillText, { color: accentColor }]}>
                          {formatDuration(seg.start_time, seg.end_time)}
                        </Text>
                      </View>
                    </View>

                    {(firstSegLog?.address || hasCoords) && (
                      <TouchableOpacity
                        style={[styles.segmentLocation, { borderTopColor: colors.border }]}
                        onPress={() => {
                          const lat = firstSegLog?.latitude ?? seg.entry_latitude;
                          const lng = firstSegLog?.longitude ?? seg.entry_longitude;
                          if (lat != null && lng != null) openMaps(lat, lng, firstSegLog?.address);
                        }}
                        activeOpacity={0.7}
                      >
                        <Navigation size={12} color={colors.textSecondary} />
                        <Text style={[styles.segmentLocationText, { color: colors.textSecondary }]} numberOfLines={1}>
                          {firstSegLog?.address || `${seg.entry_latitude?.toFixed(5)}, ${seg.entry_longitude?.toFixed(5)}`}
                        </Text>
                        <ExternalLink size={11} color={colors.textSecondary} />
                      </TouchableOpacity>
                    )}

                    {seg.notes ? (
                      <Text style={[styles.segmentNotes, { color: colors.textSecondary, borderTopColor: colors.border }]}>
                        {seg.notes}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {locationLogs.filter(l => l.address).length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Location History</Text>
          <View style={[styles.locationCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {locationLogs.filter(l => l.address).map((log, index, arr) => (
              <View key={log.id}>
                {index > 0 && <View style={[styles.locationDivider, { backgroundColor: colors.border }]} />}
                <TouchableOpacity
                  style={styles.locationLogRow}
                  onPress={() => openMaps(log.latitude, log.longitude, log.address)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.locationDot, { borderColor: colors.primary }]}>
                    {index === 0 && <View style={[styles.locationDotFill, { backgroundColor: colors.primary }]} />}
                  </View>
                  <View style={styles.locationLogInfo}>
                    <Text style={[styles.locationLogAddress, { color: colors.text }]} numberOfLines={2}>
                      {log.address}
                    </Text>
                    <View style={styles.locationLogMeta}>
                      <Text style={[styles.locationLogTime, { color: colors.textSecondary }]}>
                        {formatTime(log.detected_at)}
                      </Text>
                      {log.stop_duration_minutes != null && log.stop_duration_minutes > 0 && (
                        <Text style={[styles.locationLogDuration, { color: colors.textSecondary }]}>
                          · {log.stop_duration_minutes}m stop
                        </Text>
                      )}
                    </View>
                  </View>
                  <ExternalLink size={14} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      )}

      {segments.length === 0 && locationLogs.length === 0 && (
        <View style={styles.emptyState}>
          <MapPin size={36} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No activity or location data recorded for this shift
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },
  dateLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  timeBlock: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  timeValue: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
  },
  locationAddress: {
    fontSize: 11,
    flex: 1,
    lineHeight: 15,
    fontWeight: '500',
  },
  timeDivider: {
    width: 1,
    height: '100%',
    minHeight: 48,
    marginTop: 18,
  },
  durationBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginTop: 18,
  },
  totalDuration: {
    fontSize: 14,
    fontWeight: '700',
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  segmentWrapper: {
    position: 'relative',
  },
  connector: {
    width: 2,
    height: 8,
    marginLeft: 22,
    marginVertical: -2,
    zIndex: 0,
  },
  segment: {
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 4,
  },
  segmentAccent: {
    width: 4,
  },
  segmentBody: {
    flex: 1,
    padding: 12,
  },
  segmentTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentMeta: {
    flex: 1,
  },
  segmentType: {
    fontSize: 14,
    fontWeight: '700',
  },
  segmentTime: {
    fontSize: 12,
    marginTop: 1,
  },
  durationPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  durationPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  segmentLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  segmentLocationText: {
    flex: 1,
    fontSize: 12,
  },
  segmentNotes: {
    fontSize: 12,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    fontStyle: 'italic',
  },
  locationCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  locationLogRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  locationDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 40,
  },
  locationDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationDotFill: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  locationLogInfo: {
    flex: 1,
  },
  locationLogAddress: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  locationLogMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  locationLogTime: {
    fontSize: 12,
  },
  locationLogDuration: {
    fontSize: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 14,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 22,
  },
});
