import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { X, Calendar, Clock, TrendingUp, CircleCheck as CheckCircle2, Save, Zap, CalendarDays, ChevronLeft, ChevronRight, MapPin, Lock, TriangleAlert as AlertTriangle, Plus, Minus } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/lib/supabase';
import { OptimizedRoute } from '@/lib/routeOptimizationService';
import {
  analyzeScheduleForRoute,
  getNextAvailableSlots,
  getSmartScheduleSlots,
  RouteScheduleSuggestion,
  SmartScheduleSuggestion,
  RouteStopRef,
  formatScheduleSuggestion,
} from '@/lib/calendarAnalysisService';

type ScheduleMode = 'now' | 'day' | 'week';

interface ScheduleSuggestionModalProps {
  visible: boolean;
  onClose: () => void;
  route: OptimizedRoute;
  routeName: string;
}

export default function ScheduleSuggestionModal({
  visible,
  onClose,
  route,
  routeName,
}: ScheduleSuggestionModalProps) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const { currentOrganization } = useOrganization();
  const [suggestions, setSuggestions] = useState<SmartScheduleSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<SmartScheduleSuggestion | null>(null);
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('now');
  const [targetMonth, setTargetMonth] = useState(new Date().getMonth() + 1);
  const [targetYear, setTargetYear] = useState(new Date().getFullYear());
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + 1);
    return d;
  });
  const [jobName, setJobName] = useState('');
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [selectedTeamMember, setSelectedTeamMember] = useState<string>('');
  const [forceScheduleMode, setForceScheduleMode] = useState(false);
  const [forceDate, setForceDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [forceHour, setForceHour] = useState(9);
  const [forceMinute, setForceMinute] = useState(0);

  const routeStops: RouteStopRef[] = route.stops.map((s) => ({
    clientId: s.clientId || undefined,
    clientAddressId: s.clientAddressId || undefined,
  }));

  useEffect(() => {
    if (visible && currentOrganization) {
      loadTeamMembers();
      runAnalysis();
    }
  }, [visible, currentOrganization, scheduleMode, targetMonth, targetYear, selectedWeekStart, selectedTeamMember]);

  const loadTeamMembers = async () => {
    if (!currentOrganization) return;
    try {
      const { data, error } = await supabase
        .from('organization_members')
        .select('user_id, profiles!inner(id, full_name)')
        .eq('organization_id', currentOrganization.id);
      if (error) throw error;
      const members = (data || []).map((m: any) => ({
        id: m.user_id,
        name: m.profiles.full_name || 'Unknown',
      }));
      setTeamMembers(members);
    } catch (error) {
      console.error('Error loading team members:', error);
    }
  };

  const hasFixedWindows = route.stops.some(s => s.serviceWindow);

  const runAnalysis = async () => {
    if (!currentOrganization) return;
    try {
      setLoading(true);
      setSuggestions([]);
      setSelectedSuggestion(null);

      let results: SmartScheduleSuggestion[] = [];

      if (hasFixedWindows && scheduleMode === 'now') {
        results = await getSmartScheduleSlots(
          currentOrganization.id,
          {
            stops: route.stops.map(s => ({
              clientId: s.clientId,
              clientAddressId: s.clientAddressId,
              durationAtStop: s.durationAtStop,
              label: s.label,
              latitude: s.latitude,
              longitude: s.longitude,
              serviceWindow: s.serviceWindow,
            })),
            totalDuration: route.totalDuration,
            totalDistance: route.totalDistance,
          },
          14
        );
      } else if (scheduleMode === 'now') {
        const base = await getNextAvailableSlots(
          currentOrganization.id,
          route.totalDuration,
          14,
          routeStops
        );
        results = base.map(s => ({ ...s, isSegmented: false }));
      } else if (scheduleMode === 'week') {
        const weekEnd = new Date(selectedWeekStart);
        weekEnd.setDate(selectedWeekStart.getDate() + 6);

        const monthResults = await analyzeScheduleForRoute(currentOrganization.id, {
          month: selectedWeekStart.getMonth() + 1,
          year: selectedWeekStart.getFullYear(),
          routeDuration: route.totalDuration,
          preferredDaysOfWeek: [1, 2, 3, 4, 5],
          preferredTimeStart: '09:00 AM',
          preferredTimeEnd: '03:00 PM',
          teamMemberId: selectedTeamMember || undefined,
          minBufferMinutes: 30,
          routeStops,
        });

        const weekStartStr = selectedWeekStart.toISOString().split('T')[0];
        const weekEndStr = weekEnd.toISOString().split('T')[0];
        results = monthResults.filter((s) => s.date >= weekStartStr && s.date <= weekEndStr).map(s => ({ ...s, isSegmented: false }));

        if (results.length === 0) {
          const nextMonthStart = new Date(selectedWeekStart.getFullYear(), selectedWeekStart.getMonth() + 1, 1);
          if (weekEnd >= nextMonthStart) {
            const nextMonthResults = await analyzeScheduleForRoute(currentOrganization.id, {
              month: nextMonthStart.getMonth() + 1,
              year: nextMonthStart.getFullYear(),
              routeDuration: route.totalDuration,
              preferredDaysOfWeek: [1, 2, 3, 4, 5],
              preferredTimeStart: '09:00 AM',
              preferredTimeEnd: '03:00 PM',
              teamMemberId: selectedTeamMember || undefined,
              minBufferMinutes: 30,
              routeStops,
            });
            results = nextMonthResults.filter((s) => s.date >= weekStartStr && s.date <= weekEndStr).map(s => ({ ...s, isSegmented: false }));
          }
        }
      } else {
        const base = await analyzeScheduleForRoute(currentOrganization.id, {
          month: targetMonth,
          year: targetYear,
          routeDuration: route.totalDuration,
          preferredDaysOfWeek: [1, 2, 3, 4, 5],
          preferredTimeStart: '09:00 AM',
          preferredTimeEnd: '03:00 PM',
          teamMemberId: selectedTeamMember || undefined,
          minBufferMinutes: 30,
          routeStops,
        });
        results = base.map(s => ({ ...s, isSegmented: false }));
      }

      setSuggestions(results);
      if (results.length > 0) {
        setSelectedSuggestion(results[0]);
      }
    } catch (error) {
      console.error('Error analyzing schedule:', error);
      showToast({ message: 'Failed to analyze schedule', type: 'error', duration: 3000 });
    } finally {
      setLoading(false);
    }
  };

  const buildForcedSuggestion = (): SmartScheduleSuggestion => {
    const startMin = forceHour * 60 + forceMinute;
    const endMin = startMin + route.totalDuration;
    const pad = (n: number) => n.toString().padStart(2, '0');
    const toTime = (min: number) => {
      const h = Math.floor(min / 60) % 24;
      const m = min % 60;
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 === 0 ? 12 : h % 12;
      return `${h12}:${pad(m)} ${ampm}`;
    };
    return {
      date: forceDate,
      startTime: toTime(startMin),
      endTime: toTime(endMin),
      score: 0,
      reason: 'Manually scheduled',
      extraDriveTime: 0,
      totalRouteDuration: route.totalDuration,
      conflictCount: 0,
      withinClientHours: true,
      isSegmented: false,
    };
  };

  const handleScheduleRoute = async () => {
    const suggestion = forceScheduleMode ? buildForcedSuggestion() : selectedSuggestion;
    if (!suggestion || !currentOrganization) return;
    const selectedSuggestionToUse = suggestion;

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const name = jobName.trim() || routeName || `Route ${new Date().toLocaleDateString()}`;
      const firstStop = route.stops[0];
      const assignedTo = (selectedSuggestionToUse as any).teamMemberId || selectedTeamMember || null;

      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .insert({
          organization_id: currentOrganization.id,
          name,
          client_id: firstStop.clientId || null,
          location: firstStop.label,
          latitude: firstStop.latitude,
          longitude: firstStop.longitude,
          status: 'scheduled',
          notes: selectedSuggestionToUse.isSegmented
            ? `Segmented route: ${route.stops.length} stops across ${selectedSuggestionToUse.segmentBreakdown?.length || 1} segments`
            : `Multi-stop route: ${route.stops.length} locations, ${route.totalDistance.toFixed(1)} miles`,
        })
        .select()
        .single();

      if (jobError) throw jobError;

      if (selectedSuggestionToUse.isSegmented && selectedSuggestionToUse.segmentBreakdown) {
        const events = selectedSuggestionToUse.segmentBreakdown.map((seg, idx) => ({
          organization_id: currentOrganization.id,
          title: seg.isFixed ? `${name} - ${seg.label}` : `${name} - Part ${idx + 1}`,
          date: selectedSuggestionToUse.date,
          start_time: seg.startTime,
          end_time: seg.endTime,
          job_id: job.id,
          assigned_to: assignedTo,
          location: seg.isFixed ? seg.label : `${seg.stopCount} stop${seg.stopCount > 1 ? 's' : ''}`,
          latitude: firstStop.latitude,
          longitude: firstStop.longitude,
          notes: seg.isFixed ? `Fixed window: ${seg.startTime} - ${seg.endTime}` : `${seg.stopCount} flexible stop${seg.stopCount > 1 ? 's' : ''}`,
        }));

        const { error: eventError } = await supabase.from('schedule_events').insert(events);
        if (eventError) throw eventError;
      } else {
        const { error: eventError } = await supabase.from('schedule_events').insert({
          organization_id: currentOrganization.id,
          title: name,
          date: selectedSuggestionToUse.date,
          start_time: selectedSuggestionToUse.startTime,
          end_time: selectedSuggestionToUse.endTime,
          job_id: job.id,
          assigned_to: assignedTo,
          location: firstStop.label,
          latitude: firstStop.latitude,
          longitude: firstStop.longitude,
          notes: `Route with ${route.stops.length} stops`,
        });
        if (eventError) throw eventError;
      }

      const { data: template, error: templateError } = await supabase
        .from('route_templates')
        .insert({
          organization_id: currentOrganization.id,
          name,
          total_distance: route.totalDistance,
          total_duration: route.totalDuration,
          scheduled_date: selectedSuggestionToUse.date,
          scheduled_time: selectedSuggestionToUse.startTime,
          assigned_to: assignedTo,
          status: 'scheduled',
          created_by: userData.user.id,
        })
        .select()
        .single();

      if (templateError) throw templateError;

      const stops = route.stops.map((stop, index) => ({
        route_template_id: template.id,
        stop_order: index + 1,
        client_id: stop.clientId || null,
        client_address_id: stop.clientAddressId || null,
        label: stop.label,
        address: stop.address,
        latitude: stop.latitude,
        longitude: stop.longitude,
        estimated_arrival: route.estimatedTimes[index],
        duration_at_stop: stop.durationAtStop || 30,
        notes: stop.notes,
      }));

      const { error: stopsError } = await supabase.from('route_stops').insert(stops);
      if (stopsError) throw stopsError;

      showToast({ message: 'Route scheduled successfully', type: 'success', duration: 3000 });
      onClose();
    } catch (error: any) {
      showToast({ message: error.message || 'Failed to schedule route', type: 'error', duration: 4000 });
    }
  };

  const handleSaveAsTemplate = async () => {
    if (!currentOrganization) return;
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const name = jobName.trim() || routeName || `Route ${new Date().toLocaleDateString()}`;

      const { data: template, error: templateError } = await supabase
        .from('route_templates')
        .insert({
          organization_id: currentOrganization.id,
          name,
          total_distance: route.totalDistance,
          total_duration: route.totalDuration,
          status: 'draft',
          created_by: userData.user.id,
        })
        .select()
        .single();

      if (templateError) throw templateError;

      const stops = route.stops.map((stop, index) => ({
        route_template_id: template.id,
        stop_order: index + 1,
        client_id: stop.clientId || null,
        client_address_id: stop.clientAddressId || null,
        label: stop.label,
        address: stop.address,
        latitude: stop.latitude,
        longitude: stop.longitude,
        estimated_arrival: route.estimatedTimes[index],
        duration_at_stop: stop.durationAtStop || 30,
        notes: stop.notes,
      }));

      const { error: stopsError } = await supabase.from('route_stops').insert(stops);
      if (stopsError) throw stopsError;

      showToast({ message: 'Route template saved', type: 'success', duration: 3000 });
      onClose();
    } catch (error: any) {
      showToast({ message: error.message || 'Failed to save template', type: 'error', duration: 4000 });
    }
  };

  const formatWeekLabel = (weekStart: Date) => {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  };

  const shiftWeek = (delta: number) => {
    setSelectedWeekStart((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + delta * 7);
      return next;
    });
  };

  const shiftMonth = (delta: number) => {
    setTargetMonth((prev) => {
      let m = prev + delta;
      if (m > 12) { m = 1; setTargetYear((y) => y + 1); }
      else if (m < 1) { m = 12; setTargetYear((y) => y - 1); }
      return m;
    });
  };

  const monthLabel = new Date(targetYear, targetMonth - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <View style={styles.headerLeft}>
            <Calendar size={22} color={colors.primary} />
            <Text style={[styles.headerTitle, { color: colors.text }]}>Schedule Route</Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Route Details</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              placeholder="Route name (optional)"
              placeholderTextColor={colors.textSecondary}
              value={jobName}
              onChangeText={setJobName}
            />
            <View style={styles.routeStats}>
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Distance</Text>
                <Text style={[styles.statValue, { color: colors.text }]}>{route.totalDistance.toFixed(1)} mi</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Duration</Text>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {Math.floor(route.totalDuration / 60)}h {route.totalDuration % 60}m
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Stops</Text>
                <Text style={[styles.statValue, { color: colors.text }]}>{route.stops.length}</Text>
              </View>
            </View>
            {hasFixedWindows && (
              <View style={[styles.fixedWindowBanner, { backgroundColor: '#fef3c7', borderColor: '#f59e0b' }]}>
                <Lock size={14} color="#92400e" />
                <Text style={styles.fixedWindowBannerText}>
                  {route.stops.filter(s => s.serviceWindow).length} stop{route.stops.filter(s => s.serviceWindow).length > 1 ? 's have' : ' has a'} fixed service window{route.stops.filter(s => s.serviceWindow).length > 1 ? 's' : ''} — other stops will be scheduled around {route.stops.filter(s => s.serviceWindow).length > 1 ? 'them' : 'it'}
                </Text>
              </View>
            )}
          </View>

          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>When to Schedule</Text>
            <View style={styles.modeRow}>
              <TouchableOpacity
                style={[styles.modeBtn, scheduleMode === 'now' && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                onPress={() => setScheduleMode('now')}
              >
                <Zap size={15} color={scheduleMode === 'now' ? '#fff' : colors.textSecondary} />
                <Text style={[styles.modeBtnText, { color: scheduleMode === 'now' ? '#fff' : colors.textSecondary }]}>Next Available</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, scheduleMode === 'week' && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                onPress={() => setScheduleMode('week')}
              >
                <CalendarDays size={15} color={scheduleMode === 'week' ? '#fff' : colors.textSecondary} />
                <Text style={[styles.modeBtnText, { color: scheduleMode === 'week' ? '#fff' : colors.textSecondary }]}>Pick Week</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, scheduleMode === 'day' && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                onPress={() => setScheduleMode('day')}
              >
                <Calendar size={15} color={scheduleMode === 'day' ? '#fff' : colors.textSecondary} />
                <Text style={[styles.modeBtnText, { color: scheduleMode === 'day' ? '#fff' : colors.textSecondary }]}>Pick Month</Text>
              </TouchableOpacity>
            </View>

            {scheduleMode === 'week' && (
              <View style={styles.weekNavRow}>
                <TouchableOpacity style={[styles.navBtn, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={() => shiftWeek(-1)}>
                  <ChevronLeft size={18} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.navLabel, { color: colors.text }]}>{formatWeekLabel(selectedWeekStart)}</Text>
                <TouchableOpacity style={[styles.navBtn, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={() => shiftWeek(1)}>
                  <ChevronRight size={18} color={colors.text} />
                </TouchableOpacity>
              </View>
            )}

            {scheduleMode === 'day' && (
              <View style={styles.weekNavRow}>
                <TouchableOpacity style={[styles.navBtn, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={() => shiftMonth(-1)}>
                  <ChevronLeft size={18} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.navLabel, { color: colors.text }]}>{monthLabel}</Text>
                <TouchableOpacity style={[styles.navBtn, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={() => shiftMonth(1)}>
                  <ChevronRight size={18} color={colors.text} />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {teamMembers.length > 1 && (
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Assign To</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.memberRow}>
                  <TouchableOpacity
                    style={[styles.memberChip, !selectedTeamMember && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                    onPress={() => setSelectedTeamMember('')}
                  >
                    <Text style={[styles.memberChipText, { color: !selectedTeamMember ? '#fff' : colors.textSecondary }]}>Anyone</Text>
                  </TouchableOpacity>
                  {teamMembers.map((m) => (
                    <TouchableOpacity
                      key={m.id}
                      style={[styles.memberChip, selectedTeamMember === m.id && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                      onPress={() => setSelectedTeamMember(m.id)}
                    >
                      <Text style={[styles.memberChipText, { color: selectedTeamMember === m.id ? '#fff' : colors.textSecondary }]}>{m.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {scheduleMode === 'now' ? 'Next Available Slots' : 'Best Available Times'}
            </Text>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Finding best times...</Text>
              </View>
            ) : suggestions.length === 0 ? (
              <View style={styles.noSuggestionsContainer}>
                <Text style={[styles.noSuggestions, { color: colors.textSecondary }]}>
                  No available time slots found. Try a different week or month, or use Force Schedule below.
                </Text>
              </View>
            ) : (
              suggestions.slice(0, 5).map((suggestion, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.suggestionItem,
                    { backgroundColor: colors.background, borderColor: colors.border },
                    selectedSuggestion === suggestion && {
                      backgroundColor: colors.primaryLight,
                      borderColor: colors.primary,
                    },
                  ]}
                  onPress={() => setSelectedSuggestion(suggestion)}
                  activeOpacity={0.7}
                >
                  <View style={styles.suggestionHeader}>
                    <View style={[styles.scoreIndicator, { backgroundColor: colors.primary }]}>
                      <TrendingUp size={14} color="#fff" />
                      <Text style={styles.scoreText}>{suggestion.score}</Text>
                    </View>
                    <Text
                      style={[
                        styles.suggestionDate,
                        { color: selectedSuggestion === suggestion ? colors.primary : colors.text },
                      ]}
                    >
                      {formatScheduleSuggestion(suggestion)}
                    </Text>
                  </View>
                  <Text style={[styles.suggestionReason, { color: colors.textSecondary }]}>
                    {suggestion.reason}
                  </Text>

                  {suggestion.isSegmented && suggestion.segmentBreakdown && (
                    <View style={styles.segmentBreakdown}>
                      {suggestion.segmentBreakdown.map((seg, si) => (
                        <View key={si} style={styles.segmentRow}>
                          <View style={[styles.segmentDot, { backgroundColor: seg.isFixed ? '#f59e0b' : colors.primary }]}>
                            {seg.isFixed ? <Lock size={8} color="#fff" /> : <MapPin size={8} color="#fff" />}
                          </View>
                          <View style={styles.segmentInfo}>
                            <Text style={[styles.segmentTime, { color: colors.text }]}>
                              {seg.startTime} - {seg.endTime}
                            </Text>
                            <Text style={[styles.segmentLabel, { color: seg.isFixed ? '#f59e0b' : colors.textSecondary }]} numberOfLines={1}>
                              {seg.isFixed ? `${seg.label} (fixed window)` : seg.label}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                  {!suggestion.withinClientHours && (
                    <Text style={[styles.outsideHoursWarning, { color: '#f59e0b' }]}>
                      Outside client service hours
                    </Text>
                  )}
                  {suggestion.conflictCount > 0 && (
                    <Text style={[styles.conflictWarning, { color: '#ef4444' }]}>
                      {suggestion.conflictCount} scheduling conflict{suggestion.conflictCount > 1 ? 's' : ''}
                    </Text>
                  )}
                </TouchableOpacity>
              ))
            )}
          </View>

          <View style={[styles.section, { backgroundColor: colors.card, borderColor: forceScheduleMode ? colors.primary : colors.border }]}>
            <TouchableOpacity
              style={styles.forceScheduleHeader}
              onPress={() => setForceScheduleMode(!forceScheduleMode)}
              activeOpacity={0.7}
            >
              <View style={styles.forceScheduleHeaderLeft}>
                <AlertTriangle size={16} color={forceScheduleMode ? colors.primary : colors.textSecondary} />
                <Text style={[styles.forceScheduleTitle, { color: forceScheduleMode ? colors.primary : colors.text }]}>Force Schedule</Text>
              </View>
              <View style={[styles.forceScheduleToggle, { backgroundColor: forceScheduleMode ? colors.primary : colors.border }]}>
                <Text style={[styles.forceScheduleToggleText, { color: forceScheduleMode ? '#fff' : colors.textSecondary }]}>
                  {forceScheduleMode ? 'ON' : 'OFF'}
                </Text>
              </View>
            </TouchableOpacity>
            {forceScheduleMode && (
              <View style={styles.forceScheduleBody}>
                <Text style={[styles.forceScheduleNote, { color: colors.textSecondary }]}>
                  Manually pick a date and time — conflicts are not checked.
                </Text>
                <View style={styles.forceDateRow}>
                  <Text style={[styles.forceLabel, { color: colors.text }]}>Date</Text>
                  <TextInput
                    style={[styles.forceDateInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                    value={forceDate}
                    onChangeText={setForceDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
                <View style={styles.forceDateRow}>
                  <Text style={[styles.forceLabel, { color: colors.text }]}>Start Time</Text>
                  <View style={styles.forceTimePicker}>
                    <View style={styles.forceTimeUnit}>
                      <TouchableOpacity onPress={() => setForceHour(h => (h + 1) % 24)} style={styles.forceTimeBtn}>
                        <Plus size={14} color={colors.primary} />
                      </TouchableOpacity>
                      <Text style={[styles.forceTimeValue, { color: colors.text }]}>
                        {forceHour === 0 ? 12 : forceHour > 12 ? forceHour - 12 : forceHour}
                      </Text>
                      <TouchableOpacity onPress={() => setForceHour(h => (h - 1 + 24) % 24)} style={styles.forceTimeBtn}>
                        <Minus size={14} color={colors.primary} />
                      </TouchableOpacity>
                    </View>
                    <Text style={[styles.forceTimeColon, { color: colors.text }]}>:</Text>
                    <View style={styles.forceTimeUnit}>
                      <TouchableOpacity onPress={() => setForceMinute(m => (m + 15) % 60)} style={styles.forceTimeBtn}>
                        <Plus size={14} color={colors.primary} />
                      </TouchableOpacity>
                      <Text style={[styles.forceTimeValue, { color: colors.text }]}>
                        {forceMinute.toString().padStart(2, '0')}
                      </Text>
                      <TouchableOpacity onPress={() => setForceMinute(m => (m - 15 + 60) % 60)} style={styles.forceTimeBtn}>
                        <Minus size={14} color={colors.primary} />
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                      style={[styles.ampmBtn, { borderColor: colors.border, backgroundColor: forceHour < 12 ? colors.primary : colors.background }]}
                      onPress={() => setForceHour(h => h < 12 ? h + 12 : h - 12)}
                    >
                      <Text style={[styles.ampmText, { color: forceHour < 12 ? '#fff' : colors.textSecondary }]}>
                        {forceHour < 12 ? 'AM' : 'PM'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          </View>
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton, { backgroundColor: colors.border }]}
            onPress={handleSaveAsTemplate}
          >
            <Save size={18} color={colors.text} />
            <Text style={[styles.buttonText, { color: colors.text }]}>Save Template</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.button,
              styles.primaryButton,
              { overflow: 'hidden' },
              !selectedSuggestion && !forceScheduleMode && styles.buttonDisabled,
            ]}
            onPress={handleScheduleRoute}
            disabled={!selectedSuggestion && !forceScheduleMode}
          >
            <LinearGradient
              colors={['#1B4D6E', '#245d82']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gradientFill}
            >
              <CheckCircle2 size={18} color="#fff" />
              <Text style={styles.primaryButtonText}>Schedule Route</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  closeButton: { padding: 4 },
  content: { flex: 1 },
  contentContainer: { padding: 16, gap: 16 },
  section: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 15 },
  routeStats: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12 },
  statItem: { alignItems: 'center', gap: 4 },
  statLabel: { fontSize: 12, textTransform: 'uppercase', fontWeight: '600' },
  statValue: { fontSize: 16, fontWeight: '700' },
  modeRow: { flexDirection: 'row', gap: 8 },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
  },
  modeBtnText: { fontSize: 12, fontWeight: '600' },
  weekNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  navBtn: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  navLabel: { fontSize: 14, fontWeight: '600', flex: 1, textAlign: 'center' },
  memberRow: { flexDirection: 'row', gap: 8 },
  memberChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
  },
  memberChipText: { fontSize: 13, fontWeight: '600' },
  loadingContainer: { paddingVertical: 40, alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14 },
  noSuggestionsContainer: { paddingVertical: 8 },
  noSuggestions: { textAlign: 'center', paddingVertical: 12, fontSize: 14, lineHeight: 20 },
  forceScheduleHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  forceScheduleHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  forceScheduleTitle: { fontSize: 15, fontWeight: '700' },
  forceScheduleToggle: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  forceScheduleToggleText: { fontSize: 12, fontWeight: '700' },
  forceScheduleBody: { gap: 12, marginTop: 4 },
  forceScheduleNote: { fontSize: 12, lineHeight: 17 },
  forceDateRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  forceLabel: { fontSize: 13, fontWeight: '600', width: 70 },
  forceDateInput: { flex: 1, borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14 },
  forceTimePicker: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  forceTimeUnit: { alignItems: 'center', gap: 4 },
  forceTimeBtn: { padding: 6 },
  forceTimeValue: { fontSize: 18, fontWeight: '700', minWidth: 32, textAlign: 'center' },
  forceTimeColon: { fontSize: 20, fontWeight: '700' },
  ampmBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, marginLeft: 4 },
  ampmText: { fontSize: 12, fontWeight: '700' },
  suggestionItem: { padding: 12, borderRadius: 12, borderWidth: 2, gap: 6 },
  suggestionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  scoreIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  scoreText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  suggestionDate: { fontSize: 14, fontWeight: '600', flex: 1 },
  suggestionReason: { fontSize: 13 },
  outsideHoursWarning: { fontSize: 12, fontWeight: '500' },
  conflictWarning: { fontSize: 12, fontWeight: '500' },
  footer: { flexDirection: 'row', padding: 16, gap: 12, borderTopWidth: 1 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 12,
    flex: 1,
  },
  secondaryButton: {},
  primaryButton: {
    padding: 0,
  },
  gradientFill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
  },
  buttonText: { fontSize: 15, fontWeight: '600' },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  buttonDisabled: { opacity: 0.5 },
  fixedWindowBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  fixedWindowBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    color: '#92400e',
    lineHeight: 16,
  },
  segmentBreakdown: {
    gap: 6,
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  segmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  segmentDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentInfo: {
    flex: 1,
    gap: 1,
  },
  segmentTime: {
    fontSize: 12,
    fontWeight: '600',
  },
  segmentLabel: {
    fontSize: 11,
  },
});
