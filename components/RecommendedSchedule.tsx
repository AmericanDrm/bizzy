import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import ClickableContact from '@/components/ClickableContact';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { MapPin, Clock, DollarSign, ChevronDown, Users, Search, Calendar, X, Users as Users2, Navigation, Building2, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle2, Plus } from 'lucide-react-native';
import TeamDispatchModal from '@/components/TeamDispatchModal';
import ScheduleModal from '@/components/ScheduleModal';
import { RouteLocation } from '@/lib/routeOptimizationService';
import { openInMaps, getDefaultMapApp } from '@/lib/mapsIntegrationService';

interface ScheduleEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  amount?: number;
  client_id?: string;
  clients?: {
    name: string;
    client_type?: string;
  };
}

interface Client {
  id: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  email?: string;
  typical_job_duration?: number;
  client_type?: string;
  commercial_service_window_start?: string | null;
  commercial_service_window_end?: string | null;
}

interface NearbyClient extends Client {
  distance: number;
  hasScheduledJobs?: boolean;
  lastJobDate?: string;
  serviceWindowStart?: string | null;
  serviceWindowEnd?: string | null;
  withinServiceWindow?: boolean | null;
  windowCheckDate?: string | null;
}

interface JobCluster {
  date: string;
  jobs: ScheduleEvent[];
  totalRevenue: number;
  centerLat: number;
  centerLng: number;
  averageDistance: number;
  hasCommercialJobs: boolean;
}

interface CommercialDueItem {
  addressId: string;
  clientId: string;
  clientName: string;
  addressLabel: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  targetWeek: number | null;
  preferredDay: string | null;
  serviceWindowStart: string | null;
  serviceWindowEnd: string | null;
  overdueScore: number;
  typical_job_duration?: number | null;
  priceOverride?: number | null;
}

type TabType = 'clusters' | 'nearby' | 'commercial';

const WEEK_LABELS: Record<number, string> = {
  1: '1st week',
  2: '2nd week',
  3: '3rd week',
  4: '4th week',
};

const DAY_ORDER: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};

export function RecommendedSchedule() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const { currentOrganization } = useOrganization();

  const [activeTab, setActiveTab] = useState<TabType>('clusters');
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [clusters, setClusters] = useState<JobCluster[]>([]);
  const [maxDistance, setMaxDistance] = useState('10');
  const [timeWindow, setTimeWindow] = useState('4');
  const [loading, setLoading] = useState(true);

  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [nearbyRadius, setNearbyRadius] = useState('15');
  const [dateRangeStart, setDateRangeStart] = useState('');
  const [dateRangeEnd, setDateRangeEnd] = useState('');
  const [nearbyClients, setNearbyClients] = useState<NearbyClient[]>([]);
  const [searchingNearby, setSearchingNearby] = useState(false);
  const [resultCount, setResultCount] = useState('5');
  const [teamDispatchVisible, setTeamDispatchVisible] = useState(false);

  const [commercialDueItems, setCommercialDueItems] = useState<CommercialDueItem[]>([]);
  const [loadingCommercial, setLoadingCommercial] = useState(false);
  const [commercialViewMode, setCommercialViewMode] = useState<'week' | 'month'>('week');
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [selectedCommercialItem, setSelectedCommercialItem] = useState<CommercialDueItem | null>(null);

  const dynamicStyles = getDynamicStyles(colors);

  useEffect(() => {
    if (user || currentOrganization) {
      loadEvents();
      loadClients();
    }
  }, [user, currentOrganization]);

  useEffect(() => {
    if (events.length > 0) {
      calculateClusters();
    } else {
      setClusters([]);
    }
  }, [events, maxDistance, timeWindow]);

  useEffect(() => {
    if (activeTab === 'commercial' && (user || currentOrganization)) {
      loadCommercialDueItems();
    }
  }, [activeTab, commercialViewMode, user, currentOrganization]);

  const loadClients = async () => {
    const orgId = currentOrganization?.id;
    const userId = user?.id;
    if (!orgId && !userId) return;

    try {
      let query = supabase
        .from('clients')
        .select('id, name, address, latitude, longitude, phone, email, typical_job_duration, client_type, commercial_service_window_start, commercial_service_window_end');

      if (orgId) {
        query = query.eq('organization_id', orgId);
      } else {
        query = query.eq('user_id', userId!);
      }

      const { data, error } = await query.order('name', { ascending: true });
      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  };

  const loadEvents = async () => {
    const orgId = currentOrganization?.id;
    const userId = user?.id;
    if (!orgId && !userId) return;

    try {
      let query = supabase
        .from('schedule_events')
        .select('*, clients(name, client_type)')
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true });

      if (orgId) {
        query = query.eq('organization_id', orgId);
      } else {
        query = query.eq('user_id', userId!);
      }

      const { data, error } = await query;
      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCommercialDueItems = useCallback(async () => {
    const orgId = currentOrganization?.id;
    const userId = user?.id;
    if (!orgId && !userId) return;

    setLoadingCommercial(true);
    try {
      const now = new Date();
      const currentWeekOfMonth = Math.ceil(now.getDate() / 7);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      let clientsQuery = supabase
        .from('clients')
        .select('id, name, commercial_service_window_start, commercial_service_window_end')
        .eq('client_type', 'commercial');
      if (orgId) {
        clientsQuery = clientsQuery.eq('organization_id', orgId);
      } else {
        clientsQuery = clientsQuery.eq('user_id', userId!);
      }

      let addressesQuery = supabase
        .from('client_addresses')
        .select('id, label, address, latitude, longitude, client_id, target_week_of_month, preferred_day, service_window_start, service_window_end, use_client_service_window, typical_job_duration, price_override')
        .not('address', 'is', null);
      if (orgId) {
        addressesQuery = addressesQuery.eq('organization_id', orgId);
      }

      const rangeStart = commercialViewMode === 'week' ? weekStart.toISOString() : monthStart.toISOString();
      const rangeEnd = commercialViewMode === 'week' ? weekEnd.toISOString() : monthEnd.toISOString();

      let eventsQuery = supabase
        .from('schedule_events')
        .select('client_id, location, start_time')
        .gte('start_time', rangeStart)
        .lte('start_time', rangeEnd);
      if (orgId) {
        eventsQuery = eventsQuery.eq('organization_id', orgId);
      } else {
        eventsQuery = eventsQuery.eq('user_id', userId!);
      }

      const [clientsRes, addressesRes, eventsRes] = await Promise.all([
        clientsQuery,
        addressesQuery,
        eventsQuery,
      ]);

      if (clientsRes.error || addressesRes.error || eventsRes.error) {
        throw new Error('Failed to load commercial data');
      }

      const commercialClientIds = new Set((clientsRes.data || []).map((c: any) => c.id));
      const clientMap = new Map((clientsRes.data || []).map((c: any) => [c.id, c]));

      const scheduledKeys = new Set(
        (eventsRes.data || []).map((e: any) =>
          `${e.client_id}:${(e.location || '').toLowerCase().trim()}`
        )
      );

      const items: CommercialDueItem[] = [];

      for (const addr of (addressesRes.data || [])) {
        if (!commercialClientIds.has(addr.client_id)) continue;

        const key = `${addr.client_id}:${(addr.address || '').toLowerCase().trim()}`;
        if (scheduledKeys.has(key)) continue;

        const client = clientMap.get(addr.client_id);

        let windowStart: string | null = null;
        let windowEnd: string | null = null;
        if (addr.use_client_service_window !== false && client) {
          windowStart = client.commercial_service_window_start || addr.service_window_start;
          windowEnd = client.commercial_service_window_end || addr.service_window_end;
        } else {
          windowStart = addr.service_window_start;
          windowEnd = addr.service_window_end;
        }

        let overdueScore = 0;
        if (commercialViewMode === 'week' && addr.target_week_of_month) {
          const diff = currentWeekOfMonth - addr.target_week_of_month;
          overdueScore = diff > 0 ? diff * 10 : 0;
        }

        if (addr.preferred_day) {
          const todayDow = now.getDay();
          const targetDow = DAY_ORDER[addr.preferred_day] ?? -1;
          if (targetDow >= 0 && todayDow > targetDow) {
            overdueScore += 3;
          }
        }

        items.push({
          addressId: addr.id,
          clientId: addr.client_id,
          clientName: client?.name || 'Unknown',
          addressLabel: addr.label || 'Address',
          address: addr.address,
          latitude: addr.latitude ? parseFloat(addr.latitude) : null,
          longitude: addr.longitude ? parseFloat(addr.longitude) : null,
          targetWeek: addr.target_week_of_month,
          preferredDay: addr.preferred_day,
          serviceWindowStart: windowStart,
          serviceWindowEnd: windowEnd,
          overdueScore,
          typical_job_duration: addr.typical_job_duration,
          priceOverride: addr.price_override,
        });
      }

      items.sort((a, b) => b.overdueScore - a.overdueScore || a.clientName.localeCompare(b.clientName));
      setCommercialDueItems(items);
    } catch (err) {
      console.error('Error loading commercial due items:', err);
      showToast({ message: 'Failed to load commercial due items', type: 'error', duration: 3000 });
    } finally {
      setLoadingCommercial(false);
    }
  }, [currentOrganization, user, commercialViewMode]);

  const calculateDistance = (
    lat1: number, lon1: number,
    lat2: number, lon2: number
  ): number => {
    const R = 3959;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const isWithinServiceWindow = (windowStart: string | null, windowEnd: string | null, anchorDateStr: string): boolean | null => {
    if (!windowStart || !windowEnd || !anchorDateStr) return null;
    try {
      const [startH, startM] = windowStart.split(':').map(Number);
      const [endH, endM] = windowEnd.split(':').map(Number);
      const startMins = startH * 60 + startM;
      const endMins = endH * 60 + endM;
      const anchorDate = new Date(anchorDateStr);
      const anchorMins = anchorDate.getHours() * 60 + anchorDate.getMinutes();
      if (anchorMins === 0) return null;
      return anchorMins >= startMins && anchorMins <= endMins;
    } catch {
      return null;
    }
  };

  const formatServiceWindow = (start: string | null, end: string | null): string => {
    if (!start || !end) return '';
    const fmt = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      const period = h >= 12 ? 'PM' : 'AM';
      const hour = h % 12 || 12;
      return `${hour}:${m.toString().padStart(2, '0')} ${period}`;
    };
    return `${fmt(start)} – ${fmt(end)}`;
  };

  const calculateClusters = () => {
    const maxDistanceNum = parseFloat(maxDistance) || 10;
    const timeWindowNum = parseFloat(timeWindow) || 4;

    const eventsWithLocation = events.filter((e) => e.latitude && e.longitude);

    const grouped: { [key: string]: ScheduleEvent[] } = {};
    eventsWithLocation.forEach((event) => {
      const date = event.start_time.split('T')[0];
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(event);
    });

    const newClusters: JobCluster[] = [];

    Object.entries(grouped).forEach(([date, dayEvents]) => {
      const sortedEvents = [...dayEvents].sort(
        (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      );

      const clustersForDay: ScheduleEvent[][] = [];
      const processed = new Set<string>();

      sortedEvents.forEach((event) => {
        if (processed.has(event.id)) return;

        const cluster: ScheduleEvent[] = [event];
        processed.add(event.id);

        sortedEvents.forEach((otherEvent) => {
          if (
            processed.has(otherEvent.id) ||
            !otherEvent.latitude || !otherEvent.longitude ||
            !event.latitude || !event.longitude
          ) return;

          const distance = calculateDistance(
            event.latitude, event.longitude,
            otherEvent.latitude, otherEvent.longitude
          );
          const timeDiff = Math.abs(
            new Date(event.start_time).getTime() - new Date(otherEvent.start_time).getTime()
          ) / (1000 * 60 * 60);

          if (distance <= maxDistanceNum && timeDiff <= timeWindowNum) {
            cluster.push(otherEvent);
            processed.add(otherEvent.id);
          }
        });

        if (cluster.length > 1) clustersForDay.push(cluster);
      });

      clustersForDay.forEach((cluster) => {
        const totalRevenue = cluster.reduce(
          (sum, job) => sum + (parseFloat(job.amount?.toString() || '0') || 0), 0
        );
        const centerLat = cluster.reduce((sum, job) => sum + (job.latitude || 0), 0) / cluster.length;
        const centerLng = cluster.reduce((sum, job) => sum + (job.longitude || 0), 0) / cluster.length;

        let totalDistance = 0;
        for (let i = 0; i < cluster.length; i++) {
          for (let j = i + 1; j < cluster.length; j++) {
            if (cluster[i].latitude && cluster[i].longitude && cluster[j].latitude && cluster[j].longitude) {
              totalDistance += calculateDistance(
                cluster[i].latitude!, cluster[i].longitude!,
                cluster[j].latitude!, cluster[j].longitude!
              );
            }
          }
        }
        const averageDistance = cluster.length > 1
          ? totalDistance / ((cluster.length * (cluster.length - 1)) / 2)
          : 0;

        const hasCommercialJobs = cluster.some((job) => job.clients?.client_type === 'commercial');

        newClusters.push({ date, jobs: cluster, totalRevenue, centerLat, centerLng, averageDistance, hasCommercialJobs });
      });
    });

    newClusters.sort((a, b) => b.jobs.length - a.jobs.length);
    setClusters(newClusters);
  };

  const findNearbyClients = async () => {
    if (!selectedClient) {
      showToast({ message: 'Please select a client first', type: 'error', duration: 3000 });
      return;
    }
    if (!selectedClient.latitude || !selectedClient.longitude) {
      showToast({
        message: 'Selected client has no location data. Add coordinates to the client first.',
        type: 'error',
        duration: 4000,
      });
      return;
    }

    setSearchingNearby(true);

    try {
      const radius = parseFloat(nearbyRadius) || 15;
      const count = parseInt(resultCount) || 5;
      const orgId = currentOrganization?.id;
      const userId = user?.id;

      const clientsWithLocation = clients.filter(
        (c) => c.id !== selectedClient.id && c.latitude && c.longitude
      );

      const nearby: NearbyClient[] = [];

      for (const client of clientsWithLocation) {
        const distance = calculateDistance(
          selectedClient.latitude, selectedClient.longitude,
          client.latitude!, client.longitude!
        );

        if (distance > radius) continue;

        let scheduleQuery = supabase
          .from('schedule_events')
          .select('start_time')
          .eq('client_id', client.id)
          .order('start_time', { ascending: false })
          .limit(1);
        if (orgId) scheduleQuery = scheduleQuery.eq('organization_id', orgId);
        else scheduleQuery = scheduleQuery.eq('user_id', userId!);

        const { data: scheduleData } = await scheduleQuery;

        let matchesDateRange = true;
        if (dateRangeStart && dateRangeEnd && scheduleData && scheduleData.length > 0) {
          const lastJob = new Date(scheduleData[0].start_time);
          const start = new Date(dateRangeStart);
          const end = new Date(dateRangeEnd);
          matchesDateRange = lastJob >= start && lastJob <= end;
        }

        if (!matchesDateRange) continue;

        let serviceWindowStart: string | null = null;
        let serviceWindowEnd: string | null = null;
        let withinServiceWindow: boolean | null = null;

        if (client.client_type === 'commercial') {
          serviceWindowStart = client.commercial_service_window_start || null;
          serviceWindowEnd = client.commercial_service_window_end || null;

          if (dateRangeStart && serviceWindowStart && serviceWindowEnd) {
            withinServiceWindow = isWithinServiceWindow(
              serviceWindowStart, serviceWindowEnd, dateRangeStart + 'T09:00:00'
            );
          }
        }

        nearby.push({
          ...client,
          distance,
          hasScheduledJobs: !!(scheduleData && scheduleData.length > 0),
          lastJobDate: scheduleData?.[0]?.start_time,
          serviceWindowStart,
          serviceWindowEnd,
          withinServiceWindow,
          windowCheckDate: dateRangeStart || null,
        });
      }

      nearby.sort((a, b) => a.distance - b.distance);
      setNearbyClients(nearby.slice(0, count));

      if (nearby.length === 0) {
        showToast({ message: 'No clients found within the specified radius', type: 'info', duration: 3000 });
      }
    } catch (error) {
      console.error('Error finding nearby clients:', error);
      showToast({ message: 'Failed to search for nearby clients', type: 'error', duration: 3000 });
    } finally {
      setSearchingNearby(false);
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const formatFullDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const convertEventsToLocations = (): RouteLocation[] => {
    const locations: RouteLocation[] = [];
    events.forEach((event) => {
      if (event.latitude && event.longitude) {
        locations.push({
          id: event.id,
          label: event.clients?.name || event.title,
          address: event.address || '',
          latitude: event.latitude,
          longitude: event.longitude,
          clientId: event.client_id || undefined,
          durationAtStop: (event as any).typical_job_duration || 30,
        });
      }
    });
    return locations;
  };

  const extractStreetAddress = (fullAddress: string): string => {
    if (!fullAddress) return '';
    const parts = fullAddress.split(',');
    return parts[0].trim();
  };

  const handleOpenClientAddress = async (client: NearbyClient) => {
    if (!client.latitude || !client.longitude) {
      showToast({ message: 'No location data available for this address', type: 'error', duration: 3000 });
      return;
    }
    const location: RouteLocation = {
      id: client.id,
      label: client.name,
      address: client.address,
      latitude: client.latitude,
      longitude: client.longitude,
    };
    await openInMaps([location], getDefaultMapApp());
  };

  const handleScheduleCommercialItem = (item: CommercialDueItem) => {
    setSelectedCommercialItem(item);
    setScheduleModalVisible(true);
  };

  const handleScheduleModalSave = () => {
    setScheduleModalVisible(false);
    setSelectedCommercialItem(null);
    loadEvents();
    loadCommercialDueItems();
    showToast({ message: 'Commercial job scheduled successfully', type: 'success', duration: 3000 });
  };

  if (loading) {
    return (
      <View style={dynamicStyles.container}>
        <Text style={dynamicStyles.loadingText}>Loading schedule...</Text>
      </View>
    );
  }

  const renderClustersTab = () => (
    <>
      <View style={dynamicStyles.filters}>
        <View style={dynamicStyles.filterRow}>
          <View style={dynamicStyles.filterItem}>
            <Text style={dynamicStyles.filterLabel}>Max Distance (miles)</Text>
            <TextInput
              style={dynamicStyles.filterInput}
              value={maxDistance}
              onChangeText={setMaxDistance}
              keyboardType="numeric"
              placeholder="10"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
          <View style={dynamicStyles.filterItem}>
            <Text style={dynamicStyles.filterLabel}>Time Window (hours)</Text>
            <TextInput
              style={dynamicStyles.filterInput}
              value={timeWindow}
              onChangeText={setTimeWindow}
              keyboardType="numeric"
              placeholder="4"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
        </View>
      </View>

      {clusters.length === 0 ? (
        <View style={dynamicStyles.emptyState}>
          <MapPin size={48} color={colors.textSecondary} />
          <Text style={dynamicStyles.emptyText}>No job clusters found</Text>
          <Text style={dynamicStyles.emptySubtext}>
            Try adjusting your distance or time window settings, or add
            locations to your scheduled jobs.
          </Text>
        </View>
      ) : (
        <View style={dynamicStyles.clusterList}>
          {clusters.map((cluster, index) => (
            <View key={index} style={[dynamicStyles.clusterCard, cluster.hasCommercialJobs && dynamicStyles.clusterCardCommercial]}>
              <View style={dynamicStyles.clusterHeader}>
                <Text style={dynamicStyles.clusterDate}>
                  {formatDate(cluster.date)}
                </Text>
                <View style={dynamicStyles.clusterStats}>
                  {cluster.hasCommercialJobs && (
                    <View style={dynamicStyles.commercialClusterBadge}>
                      <Building2 size={10} color="#1B4D6E" />
                      <Text style={dynamicStyles.commercialClusterBadgeText}>Comm</Text>
                    </View>
                  )}
                  <Text style={dynamicStyles.clusterJobCount}>
                    {cluster.jobs.length} jobs
                  </Text>
                  {cluster.totalRevenue > 0 && (
                    <View style={dynamicStyles.revenueTag}>
                      <DollarSign size={14} color={colors.success} />
                      <Text style={dynamicStyles.revenueText}>
                        {cluster.totalRevenue.toFixed(2)}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={dynamicStyles.distanceInfo}>
                <MapPin size={16} color={colors.textSecondary} />
                <Text style={dynamicStyles.distanceText}>
                  Average distance: {cluster.averageDistance.toFixed(1)} miles
                </Text>
              </View>

              <View style={dynamicStyles.jobsList}>
                {cluster.jobs.map((job) => {
                  const isCommercial = job.clients?.client_type === 'commercial';
                  return (
                    <View key={job.id} style={[dynamicStyles.jobItem, isCommercial && dynamicStyles.jobItemCommercial]}>
                      <View style={dynamicStyles.jobTimeContainer}>
                        <Clock size={14} color={colors.textSecondary} />
                        <Text style={dynamicStyles.jobTime}>{formatTime(job.start_time)}</Text>
                        {isCommercial && (
                          <View style={dynamicStyles.commercialJobDot}>
                            <Building2 size={9} color="#1B4D6E" />
                          </View>
                        )}
                      </View>
                      <Text style={dynamicStyles.jobTitle} numberOfLines={1}>{job.title}</Text>
                      {job.clients?.name && (
                        <Text style={dynamicStyles.jobClient} numberOfLines={1}>{job.clients.name}</Text>
                      )}
                      {job.address && (
                        <View style={dynamicStyles.jobAddressContainer}>
                          <MapPin size={12} color={colors.textSecondary} />
                          <Text style={dynamicStyles.jobAddress} numberOfLines={1}>{job.address}</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      )}
    </>
  );

  const renderNearbyTab = () => (
    <>
      <View style={dynamicStyles.nearbyFilters}>
        <Text style={dynamicStyles.sectionTitle}>Find Clients Near</Text>

        <TouchableOpacity
          style={dynamicStyles.clientSelector}
          onPress={() => setShowClientPicker(true)}
        >
          <Users size={20} color={colors.textSecondary} />
          <Text style={[dynamicStyles.clientSelectorText, !selectedClient && { color: colors.textSecondary }]}>
            {selectedClient ? selectedClient.name : 'Select a client...'}
          </Text>
          <ChevronDown size={20} color={colors.textSecondary} />
        </TouchableOpacity>

        {selectedClient && !selectedClient.latitude && (
          <Text style={dynamicStyles.warningText}>
            This client has no location data. Add coordinates to enable proximity search.
          </Text>
        )}

        <View style={dynamicStyles.filterRow}>
          <View style={dynamicStyles.filterItem}>
            <Text style={dynamicStyles.filterLabel}>Radius (miles)</Text>
            <TextInput
              style={dynamicStyles.filterInput}
              value={nearbyRadius}
              onChangeText={setNearbyRadius}
              keyboardType="numeric"
              placeholder="15"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
          <View style={dynamicStyles.filterItem}>
            <Text style={dynamicStyles.filterLabel}>Results</Text>
            <TextInput
              style={dynamicStyles.filterInput}
              value={resultCount}
              onChangeText={setResultCount}
              keyboardType="numeric"
              placeholder="5"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
        </View>

        <Text style={dynamicStyles.optionalLabel}>Date Range (Optional)</Text>
        <Text style={dynamicStyles.optionalSubtext}>
          Filter by clients with jobs scheduled in this period. Commercial clients show service window availability for this date.
        </Text>

        <View style={dynamicStyles.filterRow}>
          <View style={dynamicStyles.filterItem}>
            <Text style={dynamicStyles.filterLabel}>From</Text>
            <TextInput
              style={dynamicStyles.filterInput}
              value={dateRangeStart}
              onChangeText={setDateRangeStart}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
          <View style={dynamicStyles.filterItem}>
            <Text style={dynamicStyles.filterLabel}>To</Text>
            <TextInput
              style={dynamicStyles.filterInput}
              value={dateRangeEnd}
              onChangeText={setDateRangeEnd}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[dynamicStyles.searchButton, (!selectedClient || searchingNearby) && dynamicStyles.searchButtonDisabled]}
          onPress={findNearbyClients}
          disabled={!selectedClient || searchingNearby}
        >
          {searchingNearby ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Search size={18} color="#fff" />
              <Text style={dynamicStyles.searchButtonText}>Find Nearby Clients</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {nearbyClients.length > 0 && (
        <View style={dynamicStyles.nearbyResults}>
          <Text style={dynamicStyles.resultsTitle}>
            {nearbyClients.length} Client{nearbyClients.length !== 1 ? 's' : ''} Found Near {selectedClient?.name}
          </Text>
          <Text style={dynamicStyles.resultsSubtitle}>
            These clients are within {nearbyRadius} miles and could be scheduled together
          </Text>

          {nearbyClients.map((client) => (
            <View key={client.id} style={[dynamicStyles.nearbyClientCard, client.client_type === 'commercial' && dynamicStyles.nearbyClientCardCommercial]}>
              <View style={dynamicStyles.nearbyClientHeader}>
                <View style={dynamicStyles.nearbyClientNameRow}>
                  <Text style={dynamicStyles.nearbyClientName}>{client.name}</Text>
                  {client.client_type === 'commercial' && (
                    <View style={dynamicStyles.commercialClientBadge}>
                      <Building2 size={9} color="#1B4D6E" />
                      <Text style={dynamicStyles.commercialClientBadgeText}>Comm</Text>
                    </View>
                  )}
                </View>
                <View style={dynamicStyles.distanceBadge}>
                  <MapPin size={12} color={colors.primary} />
                  <Text style={dynamicStyles.distanceBadgeText}>{client.distance.toFixed(1)} mi</Text>
                </View>
              </View>

              {client.client_type === 'commercial' && client.serviceWindowStart && client.serviceWindowEnd && (
                <View style={[dynamicStyles.serviceWindowRow, client.withinServiceWindow === false && dynamicStyles.serviceWindowRowWarning]}>
                  {client.withinServiceWindow === false ? (
                    <AlertTriangle size={12} color="#dc2626" />
                  ) : client.withinServiceWindow === true ? (
                    <CheckCircle2 size={12} color="#10b981" />
                  ) : (
                    <Clock size={12} color={colors.textSecondary} />
                  )}
                  <Text style={[
                    dynamicStyles.serviceWindowText,
                    client.withinServiceWindow === false && { color: '#dc2626' },
                    client.withinServiceWindow === true && { color: '#10b981' },
                  ]}>
                    {client.withinServiceWindow === false
                      ? `Outside window (${formatServiceWindow(client.serviceWindowStart, client.serviceWindowEnd)})`
                      : client.withinServiceWindow === true
                      ? `Within window (${formatServiceWindow(client.serviceWindowStart, client.serviceWindowEnd)})`
                      : `Window: ${formatServiceWindow(client.serviceWindowStart, client.serviceWindowEnd)}`
                    }
                  </Text>
                </View>
              )}

              {client.address ? (
                <TouchableOpacity
                  style={dynamicStyles.addressContainer}
                  onPress={() => handleOpenClientAddress(client)}
                  activeOpacity={0.7}
                >
                  <Text style={dynamicStyles.nearbyClientAddress} numberOfLines={1}>
                    {extractStreetAddress(client.address)}
                  </Text>
                  <Navigation size={14} color={colors.primary} />
                </TouchableOpacity>
              ) : null}

              <View style={dynamicStyles.nearbyClientMeta}>
                {client.typical_job_duration ? (
                  <View style={dynamicStyles.metaItem}>
                    <Clock size={14} color={colors.textSecondary} />
                    <Text style={dynamicStyles.metaText}>~{client.typical_job_duration} min</Text>
                  </View>
                ) : null}
                {client.lastJobDate ? (
                  <View style={dynamicStyles.metaItem}>
                    <Calendar size={14} color={colors.textSecondary} />
                    <Text style={dynamicStyles.metaText}>Last: {formatFullDate(client.lastJobDate)}</Text>
                  </View>
                ) : null}
              </View>

              {client.phone || client.email ? (
                <View style={dynamicStyles.contactInfo}>
                  {client.phone ? (
                    <ClickableContact
                      type="phone"
                      value={client.phone}
                      iconSize={13}
                      showSmsButton={false}
                    />
                  ) : null}
                  {client.email ? (
                    <ClickableContact
                      type="email"
                      value={client.email}
                      iconSize={13}
                      showSmsButton={false}
                    />
                  ) : null}
                </View>
              ) : null}
            </View>
          ))}

          <View style={dynamicStyles.suggestionBox}>
            <Text style={dynamicStyles.suggestionTitle}>Scheduling Suggestion</Text>
            <Text style={dynamicStyles.suggestionText}>
              You could schedule these {nearbyClients.length} clients together with {selectedClient?.name} on the same day to minimize travel time. The total area spans approximately {Math.max(...nearbyClients.map(c => c.distance)).toFixed(1)} miles.
            </Text>
          </View>
        </View>
      )}

      {selectedClient && nearbyClients.length === 0 && !searchingNearby && (
        <View style={dynamicStyles.emptyState}>
          <Users size={48} color={colors.textSecondary} />
          <Text style={dynamicStyles.emptyText}>No results yet</Text>
          <Text style={dynamicStyles.emptySubtext}>
            Select a client and tap "Find Nearby Clients" to discover clients that could be scheduled together.
          </Text>
        </View>
      )}

      <Modal
        visible={showClientPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowClientPicker(false)}
      >
        <View style={dynamicStyles.modalOverlay}>
          <View style={dynamicStyles.modalContent}>
            <View style={dynamicStyles.modalHeader}>
              <Text style={dynamicStyles.modalTitle}>Select Client</Text>
              <TouchableOpacity onPress={() => setShowClientPicker(false)}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={clients}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[dynamicStyles.clientOption, selectedClient?.id === item.id && dynamicStyles.clientOptionSelected]}
                  onPress={() => {
                    setSelectedClient(item);
                    setShowClientPicker(false);
                    setNearbyClients([]);
                  }}
                >
                  <View style={dynamicStyles.clientOptionContent}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={dynamicStyles.clientOptionName}>{item.name}</Text>
                      {item.client_type === 'commercial' && (
                        <View style={dynamicStyles.commercialClientBadge}>
                          <Building2 size={9} color="#1B4D6E" />
                          <Text style={dynamicStyles.commercialClientBadgeText}>Comm</Text>
                        </View>
                      )}
                    </View>
                    {item.address ? (
                      <Text style={dynamicStyles.clientOptionAddress} numberOfLines={1}>{item.address}</Text>
                    ) : null}
                  </View>
                  {item.latitude && item.longitude ? (
                    <MapPin size={16} color={colors.success} />
                  ) : (
                    <Text style={dynamicStyles.noLocationText}>No location</Text>
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={dynamicStyles.emptyList}>
                  <Text style={dynamicStyles.emptyListText}>No clients found</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      <TeamDispatchModal
        visible={teamDispatchVisible}
        onClose={() => setTeamDispatchVisible(false)}
        locations={convertEventsToLocations()}
      />
    </>
  );

  const renderCommercialTab = () => (
    <View style={dynamicStyles.commercialSection}>
      <View style={dynamicStyles.commercialHeader}>
        <View style={dynamicStyles.commercialHeaderLeft}>
          <Building2 size={18} color="#1B4D6E" />
          <Text style={dynamicStyles.commercialTitle}>Commercial Due</Text>
          {commercialDueItems.length > 0 && (
            <View style={dynamicStyles.commercialCountBadge}>
              <Text style={dynamicStyles.commercialCountBadgeText}>{commercialDueItems.length}</Text>
            </View>
          )}
        </View>
        <View style={dynamicStyles.viewModeToggle}>
          <TouchableOpacity
            style={[dynamicStyles.viewModeBtn, commercialViewMode === 'week' && dynamicStyles.viewModeBtnActive]}
            onPress={() => setCommercialViewMode('week')}
          >
            <Text style={[dynamicStyles.viewModeBtnText, commercialViewMode === 'week' && dynamicStyles.viewModeBtnTextActive]}>
              This Week
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[dynamicStyles.viewModeBtn, commercialViewMode === 'month' && dynamicStyles.viewModeBtnActive]}
            onPress={() => setCommercialViewMode('month')}
          >
            <Text style={[dynamicStyles.viewModeBtnText, commercialViewMode === 'month' && dynamicStyles.viewModeBtnTextActive]}>
              This Month
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={dynamicStyles.commercialSubtitle}>
        {commercialViewMode === 'week'
          ? 'Commercial addresses in their target week with no scheduled event this week — sorted by how overdue they are.'
          : 'All unscheduled commercial addresses for this month.'}
      </Text>

      {loadingCommercial ? (
        <View style={dynamicStyles.commercialLoading}>
          <ActivityIndicator size="small" color="#1B4D6E" />
          <Text style={dynamicStyles.commercialLoadingText}>Loading commercial jobs...</Text>
        </View>
      ) : commercialDueItems.length === 0 ? (
        <View style={dynamicStyles.emptyState}>
          <CheckCircle2 size={48} color="#10b981" />
          <Text style={[dynamicStyles.emptyText, { color: '#10b981' }]}>All Caught Up!</Text>
          <Text style={dynamicStyles.emptySubtext}>
            No unscheduled commercial jobs for {commercialViewMode === 'week' ? 'this week' : 'this month'}.
          </Text>
        </View>
      ) : (
        <View style={dynamicStyles.commercialList}>
          {commercialDueItems.map((item) => (
            <View
              key={item.addressId}
              style={[
                dynamicStyles.commercialCard,
                item.overdueScore >= 10 && dynamicStyles.commercialCardOverdue,
              ]}
            >
              <View style={dynamicStyles.commercialCardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={dynamicStyles.commercialCardClient} numberOfLines={1}>
                    {item.clientName}
                  </Text>
                  <Text style={dynamicStyles.commercialCardAddress} numberOfLines={1}>
                    {item.addressLabel !== 'Address' ? `${item.addressLabel}: ` : ''}{item.address}
                  </Text>
                </View>
                {item.overdueScore >= 10 && (
                  <View style={dynamicStyles.overdueBadge}>
                    <AlertTriangle size={10} color="#dc2626" />
                    <Text style={dynamicStyles.overdueBadgeText}>Overdue</Text>
                  </View>
                )}
              </View>

              <View style={dynamicStyles.commercialCardMeta}>
                {item.targetWeek && (
                  <View style={dynamicStyles.commercialMetaPill}>
                    <Calendar size={9} color="#1B4D6E" />
                    <Text style={dynamicStyles.commercialMetaPillText}>{WEEK_LABELS[item.targetWeek]}</Text>
                  </View>
                )}
                {item.preferredDay && (
                  <View style={dynamicStyles.commercialMetaPill}>
                    <Text style={dynamicStyles.commercialMetaPillText}>
                      {item.preferredDay.charAt(0).toUpperCase() + item.preferredDay.slice(1)}
                    </Text>
                  </View>
                )}
                {item.serviceWindowStart && item.serviceWindowEnd && (
                  <View style={dynamicStyles.commercialMetaPill}>
                    <Clock size={9} color="#1B4D6E" />
                    <Text style={dynamicStyles.commercialMetaPillText}>
                      {formatServiceWindow(item.serviceWindowStart, item.serviceWindowEnd)}
                    </Text>
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={dynamicStyles.scheduleNowButton}
                onPress={() => handleScheduleCommercialItem(item)}
                activeOpacity={0.7}
              >
                <Plus size={13} color="#fff" />
                <Text style={dynamicStyles.scheduleNowButtonText}>Schedule Now</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <ScrollView style={dynamicStyles.container}>
      <View style={dynamicStyles.header}>
        <Text style={dynamicStyles.title}>Route Optimization</Text>
        <Text style={dynamicStyles.subtitle}>
          Find efficient job clusters to maximize your time
        </Text>
      </View>

      <View style={dynamicStyles.tabContainer}>
        <TouchableOpacity
          style={[dynamicStyles.tab, activeTab === 'clusters' && dynamicStyles.activeTab]}
          onPress={() => setActiveTab('clusters')}
        >
          <MapPin size={14} color={activeTab === 'clusters' ? '#fff' : colors.textSecondary} />
          <Text style={[dynamicStyles.tabText, activeTab === 'clusters' && dynamicStyles.activeTabText]}>
            Clusters
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[dynamicStyles.tab, activeTab === 'nearby' && dynamicStyles.activeTab]}
          onPress={() => setActiveTab('nearby')}
        >
          <Users size={14} color={activeTab === 'nearby' ? '#fff' : colors.textSecondary} />
          <Text style={[dynamicStyles.tabText, activeTab === 'nearby' && dynamicStyles.activeTabText]}>
            Find Nearby
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[dynamicStyles.tab, activeTab === 'commercial' && dynamicStyles.activeTab, activeTab === 'commercial' && dynamicStyles.commercialActiveTab]}
          onPress={() => setActiveTab('commercial')}
        >
          <Building2 size={14} color={activeTab === 'commercial' ? '#fff' : '#1B4D6E'} />
          <Text style={[dynamicStyles.tabText, activeTab === 'commercial' && dynamicStyles.activeTabText]}>
            Commercial Due
          </Text>
          {commercialDueItems.length > 0 && activeTab !== 'commercial' && (
            <View style={dynamicStyles.tabBadge}>
              <Text style={dynamicStyles.tabBadgeText}>{commercialDueItems.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={dynamicStyles.teamDispatchContainer}>
        <TouchableOpacity
          style={dynamicStyles.teamDispatchButton}
          onPress={() => setTeamDispatchVisible(true)}
        >
          <Users2 size={20} color="#fff" />
          <Text style={dynamicStyles.teamDispatchButtonText}>Team Dispatch</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'clusters' && renderClustersTab()}
      {activeTab === 'nearby' && renderNearbyTab()}
      {activeTab === 'commercial' && renderCommercialTab()}

      {selectedCommercialItem && (
        <ScheduleModal
          visible={scheduleModalVisible}
          event={null}
          preselectedDate={new Date()}
          onClose={() => {
            setScheduleModalVisible(false);
            setSelectedCommercialItem(null);
          }}
          onSave={handleScheduleModalSave}
          prefillFromClient={{
            clientId: selectedCommercialItem.clientId,
            clientName: selectedCommercialItem.clientName,
            address: selectedCommercialItem.address,
            latitude: selectedCommercialItem.latitude || undefined,
            longitude: selectedCommercialItem.longitude || undefined,
            typicalJobDuration: selectedCommercialItem.typical_job_duration || undefined,
            priceOverride: selectedCommercialItem.priceOverride || undefined,
            priceOverrideEnabled: !!(selectedCommercialItem.priceOverride),
            addressId: selectedCommercialItem.addressId,
            serviceWindowStart: selectedCommercialItem.serviceWindowStart || undefined,
            serviceWindowEnd: selectedCommercialItem.serviceWindowEnd || undefined,
          }}
        />
      )}
    </ScrollView>
  );
}

const getDynamicStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      padding: 20,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    tabContainer: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
      paddingBottom: 16,
      gap: 6,
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingVertical: 9,
      paddingHorizontal: 8,
      borderRadius: 8,
      backgroundColor: colors.inputBackground,
      position: 'relative',
    },
    activeTab: {
      backgroundColor: colors.primary,
    },
    commercialActiveTab: {
      backgroundColor: '#1B4D6E',
    },
    tabText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    activeTabText: {
      color: '#fff',
    },
    tabBadge: {
      position: 'absolute',
      top: -4,
      right: -4,
      backgroundColor: '#dc2626',
      borderRadius: 8,
      minWidth: 16,
      height: 16,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 3,
    },
    tabBadgeText: {
      fontSize: 9,
      fontWeight: '700',
      color: '#fff',
    },
    filters: {
      backgroundColor: colors.surface,
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    filterRow: {
      flexDirection: 'row',
      gap: 12,
    },
    filterItem: {
      flex: 1,
    },
    filterLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 6,
    },
    filterInput: {
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      color: colors.text,
    },
    loadingText: {
      textAlign: 'center',
      color: colors.textSecondary,
      fontSize: 16,
      marginTop: 40,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
      paddingHorizontal: 32,
    },
    emptyText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textSecondary,
      marginTop: 16,
      marginBottom: 8,
    },
    emptySubtext: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    clusterList: {
      padding: 16,
      gap: 16,
    },
    clusterCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      padding: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    clusterCardCommercial: {
      borderLeftWidth: 3,
      borderLeftColor: '#1B4D6E',
    },
    commercialClusterBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: 'rgba(27,77,110,0.1)',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 8,
    },
    commercialClusterBadgeText: {
      fontSize: 9,
      fontWeight: '700',
      color: '#1B4D6E',
    },
    clusterHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    clusterDate: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    clusterStats: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    clusterJobCount: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
    },
    revenueTag: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.success + '20',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      gap: 4,
    },
    revenueText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.success,
    },
    distanceInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    distanceText: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    jobsList: {
      gap: 12,
    },
    jobItem: {
      backgroundColor: colors.inputBackground,
      padding: 12,
      borderRadius: 8,
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
    },
    jobItemCommercial: {
      borderLeftColor: '#1B4D6E',
      backgroundColor: 'rgba(27,77,110,0.04)',
    },
    jobTimeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: 4,
    },
    jobTime: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    commercialJobDot: {
      marginLeft: 4,
    },
    jobTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    jobClient: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    jobAddressContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    jobAddress: {
      fontSize: 12,
      color: colors.textSecondary,
      flex: 1,
    },
    nearbyFilters: {
      backgroundColor: colors.surface,
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    clientSelector: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 12,
      gap: 10,
      marginBottom: 16,
    },
    clientSelectorText: {
      flex: 1,
      fontSize: 16,
      color: colors.text,
    },
    warningText: {
      fontSize: 12,
      color: colors.warning,
      marginBottom: 12,
      marginTop: -8,
    },
    optionalLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginTop: 16,
      marginBottom: 4,
    },
    optionalSubtext: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 12,
    },
    searchButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: 8,
      gap: 8,
      marginTop: 16,
    },
    searchButtonDisabled: {
      opacity: 0.5,
    },
    searchButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#fff',
    },
    nearbyResults: {
      padding: 16,
    },
    resultsTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    resultsSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 16,
    },
    nearbyClientCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    nearbyClientCardCommercial: {
      borderLeftWidth: 3,
      borderLeftColor: '#1B4D6E',
    },
    nearbyClientHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    nearbyClientNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flex: 1,
    },
    nearbyClientName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      flexShrink: 1,
    },
    commercialClientBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: 'rgba(27,77,110,0.1)',
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: 6,
    },
    commercialClientBadgeText: {
      fontSize: 9,
      fontWeight: '700',
      color: '#1B4D6E',
    },
    serviceWindowRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: 'rgba(27,77,110,0.06)',
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 7,
      marginBottom: 8,
    },
    serviceWindowRowWarning: {
      backgroundColor: 'rgba(220,38,38,0.06)',
    },
    serviceWindowText: {
      fontSize: 11,
      fontWeight: '500',
      color: '#1B4D6E',
    },
    distanceBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primaryLight,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      gap: 4,
    },
    distanceBadgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary,
    },
    addressContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 8,
    },
    nearbyClientAddress: {
      fontSize: 14,
      color: colors.textSecondary,
      flex: 1,
    },
    nearbyClientMeta: {
      flexDirection: 'row',
      gap: 16,
      marginBottom: 8,
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    metaText: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    contactInfo: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 8,
      marginTop: 4,
    },
    contactText: {
      fontSize: 13,
      color: colors.primary,
      marginBottom: 2,
    },
    suggestionBox: {
      backgroundColor: colors.primaryLight,
      borderRadius: 12,
      padding: 16,
      marginTop: 8,
    },
    suggestionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
      marginBottom: 8,
    },
    suggestionText: {
      fontSize: 14,
      color: colors.text,
      lineHeight: 20,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.cardBackground,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '70%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    clientOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    clientOptionSelected: {
      backgroundColor: colors.primaryLight,
    },
    clientOptionContent: {
      flex: 1,
    },
    clientOptionName: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.text,
    },
    clientOptionAddress: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    noLocationText: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    emptyList: {
      padding: 32,
      alignItems: 'center',
    },
    emptyListText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    teamDispatchContainer: {
      paddingHorizontal: 16,
      paddingBottom: 16,
      backgroundColor: colors.surface,
    },
    teamDispatchButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      paddingVertical: 12,
      borderRadius: 8,
    },
    teamDispatchButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#fff',
    },
    commercialSection: {
      padding: 16,
    },
    commercialHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    commercialHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    commercialTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: '#1B4D6E',
    },
    commercialCountBadge: {
      backgroundColor: '#dc2626',
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 5,
    },
    commercialCountBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#fff',
    },
    commercialSubtitle: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 16,
      lineHeight: 17,
    },
    viewModeToggle: {
      flexDirection: 'row',
      backgroundColor: colors.inputBackground,
      borderRadius: 8,
      padding: 2,
      gap: 2,
    },
    viewModeBtn: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 6,
    },
    viewModeBtnActive: {
      backgroundColor: '#1B4D6E',
    },
    viewModeBtnText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    viewModeBtnTextActive: {
      color: '#fff',
    },
    commercialLoading: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingVertical: 40,
    },
    commercialLoadingText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    commercialList: {
      gap: 12,
    },
    commercialCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      padding: 14,
      borderLeftWidth: 3,
      borderLeftColor: '#1B4D6E',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 2,
      elevation: 2,
    },
    commercialCardOverdue: {
      borderLeftColor: '#dc2626',
      backgroundColor: 'rgba(220,38,38,0.02)',
    },
    commercialCardHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      marginBottom: 8,
    },
    commercialCardClient: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 2,
    },
    commercialCardAddress: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    overdueBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: 'rgba(220,38,38,0.1)',
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 8,
    },
    overdueBadgeText: {
      fontSize: 9,
      fontWeight: '700',
      color: '#dc2626',
    },
    commercialCardMeta: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 5,
      marginBottom: 10,
    },
    commercialMetaPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: 'rgba(27,77,110,0.08)',
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 8,
    },
    commercialMetaPillText: {
      fontSize: 10,
      fontWeight: '600',
      color: '#1B4D6E',
    },
    scheduleNowButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      backgroundColor: '#1B4D6E',
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 8,
      alignSelf: 'flex-start',
    },
    scheduleNowButtonText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#fff',
    },
  });
