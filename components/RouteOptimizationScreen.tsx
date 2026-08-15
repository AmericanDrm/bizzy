import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Platform,
} from 'react-native';
import { Route, MapPin, Plus, Navigation, Calendar, Save, Play, Trash2, Users as Users2, Building2, Hop as Home, HardHat, Zap, Tag, Check, LocateFixed, Flag, X, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/lib/supabase';
import {
  RouteLocation,
  RouteEndpoint,
  optimizeRoute,
  OptimizedRoute,
} from '@/lib/routeOptimizationService';
import { openInMaps, getDefaultMapApp } from '@/lib/mapsIntegrationService';
import { geocodeAddress } from '@/lib/addressService';
import { LocationService } from '@/lib/locationService';
import { resolvePerStopServiceWindows } from '@/lib/calendarAnalysisService';
import { useRouteQueue } from '@/contexts/RouteQueueContext';
import { LinearGradient } from 'expo-linear-gradient';
import LocationSelectionModal from './LocationSelectionModal';
import RouteMapPreview from './RouteMapPreview';
import ScheduleSuggestionModal from './ScheduleSuggestionModal';
import TeamDispatchModal from './TeamDispatchModal';

interface CommercialStop {
  addressId: string;
  clientAddressId: string;
  clientId: string;
  label: string;
  address: string;
  clientName: string;
}

export default function RouteOptimizationScreen() {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const { currentOrganization } = useOrganization();
  const { consumePendingLocations } = useRouteQueue();
  const [selectedLocations, setSelectedLocations] = useState<RouteLocation[]>([]);
  const [optimizedRoute, setOptimizedRoute] = useState<OptimizedRoute | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showTeamDispatchModal, setShowTeamDispatchModal] = useState(false);
  const [routeName, setRouteName] = useState('');
  const [savedRoutes, setSavedRoutes] = useState<any[]>([]);
  const [loadingSavedRoutes, setLoadingSavedRoutes] = useState(false);
  const [isCommercialRoute, setIsCommercialRoute] = useState(false);
  const [isBuildingCommercial, setIsBuildingCommercial] = useState(false);
  const [startLocation, setStartLocation] = useState<RouteEndpoint>({ label: 'Current Location', address: '', latitude: 0, longitude: 0, isCurrentLocation: true });
  const [endLocation, setEndLocation] = useState<RouteEndpoint | null>(null);
  const [startAddressInput, setStartAddressInput] = useState('');
  const [endAddressInput, setEndAddressInput] = useState('');
  const [isGeocodingStart, setIsGeocodingStart] = useState(false);
  const [isGeocodingEnd, setIsGeocodingEnd] = useState(false);
  const [showEndLocation, setShowEndLocation] = useState(false);
  const [showRouteSettings, setShowRouteSettings] = useState(false);

  useEffect(() => {
    loadSavedRoutes();
    loadHomeBase();
  }, [currentOrganization]);

  useEffect(() => {
    const queued = consumePendingLocations();
    if (queued.length > 0) {
      setSelectedLocations((prev) => {
        const existingIds = new Set(prev.map((l) => l.id));
        return [...prev, ...queued.filter((l) => !existingIds.has(l.id))];
      });
      const hasCommercial = queued.some((l) => l.clientType === 'commercial');
      if (hasCommercial) setIsCommercialRoute(true);
      showToast({
        message: `Added ${queued.length} stop${queued.length !== 1 ? 's' : ''} from commercial panel`,
        type: 'success',
        duration: 3000,
      });
    }
  }, []);

  useEffect(() => {
    if (startLocation.isCurrentLocation && startLocation.latitude === 0) {
      if (Platform.OS === 'web') {
        navigator.geolocation?.getCurrentPosition(
          (pos) => {
            setStartLocation(prev => ({ ...prev, latitude: pos.coords.latitude, longitude: pos.coords.longitude }));
          },
          () => {}
        );
      } else {
        LocationService.getCurrentLocation().then((coords) => {
          if (coords) {
            setStartLocation(prev => ({ ...prev, latitude: coords.latitude, longitude: coords.longitude }));
          }
        });
      }
    }
  }, []);

  const loadHomeBase = async () => {
    if (!currentOrganization) return;
    try {
      const { data: biz } = await supabase
        .from('business_settings')
        .select('business_address, business_name')
        .eq('organization_id', currentOrganization.id)
        .maybeSingle();
      if (biz?.business_address) {
        const geo = await geocodeAddress(biz.business_address);
        if (geo) {
          setStartLocation({
            label: `Home Base${biz.business_name ? ` (${biz.business_name})` : ''}`,
            address: biz.business_address,
            latitude: geo.latitude,
            longitude: geo.longitude,
            isCurrentLocation: false,
          });
          setStartAddressInput(biz.business_address);
        }
      }
    } catch {
    }
  };

  const resolveAddressInput = async (input: string): Promise<{ label: string; address: string; latitude: number; longitude: number } | null> => {
    const trimmed = input.trim();
    const lower = trimmed.toLowerCase();

    const homeAliases = ['home', 'home base', 'base', 'office', 'shop', 'headquarters', 'hq'];
    if (homeAliases.includes(lower) && currentOrganization) {
      const { data: biz } = await supabase
        .from('business_settings')
        .select('business_address, business_name')
        .eq('organization_id', currentOrganization.id)
        .maybeSingle();
      if (biz?.business_address) {
        const geo = await geocodeAddress(biz.business_address);
        if (geo) {
          return { label: `Home Base (${biz.business_name || biz.business_address})`, address: biz.business_address, latitude: geo.latitude, longitude: geo.longitude };
        }
      }
      showToast({ message: 'No business address set. Add one in Settings.', type: 'error', duration: 4000 });
      return null;
    }

    if (currentOrganization) {
      const { data: clients } = await supabase
        .from('clients')
        .select('id, name')
        .eq('organization_id', currentOrganization.id)
        .ilike('name', `%${trimmed}%`)
        .limit(5);

      if (clients && clients.length > 0) {
        const clientIds = clients.map((c: any) => c.id);
        const { data: addresses } = await supabase
          .from('client_addresses')
          .select('id, address, latitude, longitude, client_id, is_primary')
          .eq('organization_id', currentOrganization.id)
          .in('client_id', clientIds)
          .not('latitude', 'is', null)
          .order('is_primary', { ascending: false })
          .limit(1);

        if (addresses && addresses.length > 0) {
          const addr = addresses[0];
          const clientName = clients.find((c: any) => c.id === addr.client_id)?.name || trimmed;
          return {
            label: clientName,
            address: addr.address,
            latitude: parseFloat(addr.latitude),
            longitude: parseFloat(addr.longitude),
          };
        }
      }
    }

    const geo = await geocodeAddress(trimmed);
    if (geo) {
      return { label: trimmed, address: trimmed, latitude: geo.latitude, longitude: geo.longitude };
    }

    return null;
  };

  const handleSetStartAddress = async () => {
    if (!startAddressInput.trim()) return;
    setIsGeocodingStart(true);
    try {
      const result = await resolveAddressInput(startAddressInput);
      if (result) {
        setStartLocation({ label: result.label, address: result.address, latitude: result.latitude, longitude: result.longitude, isCurrentLocation: false });
        setOptimizedRoute(null);
      } else {
        showToast({ message: 'Could not find that address. Try "home", a client name, or a full address.', type: 'error', duration: 4000 });
      }
    } finally {
      setIsGeocodingStart(false);
    }
  };

  const handleSetEndAddress = async () => {
    if (!endAddressInput.trim()) return;
    setIsGeocodingEnd(true);
    try {
      const result = await resolveAddressInput(endAddressInput);
      if (result) {
        setEndLocation({ label: result.label, address: result.address, latitude: result.latitude, longitude: result.longitude, isCurrentLocation: false });
        setOptimizedRoute(null);
      } else {
        showToast({ message: 'Could not find that address. Try "home", a client name, or a full address.', type: 'error', duration: 4000 });
      }
    } finally {
      setIsGeocodingEnd(false);
    }
  };

  const handleSetEndToHomeBase = async () => {
    if (!currentOrganization) return;
    setIsGeocodingEnd(true);
    try {
      const { data: biz } = await supabase
        .from('business_settings')
        .select('business_address, business_name')
        .eq('organization_id', currentOrganization.id)
        .maybeSingle();
      if (biz?.business_address) {
        const geo = await geocodeAddress(biz.business_address);
        if (geo) {
          setEndLocation({ label: `Home Base`, address: biz.business_address, latitude: geo.latitude, longitude: geo.longitude, isCurrentLocation: false });
          setEndAddressInput(biz.business_address);
          setOptimizedRoute(null);
          setShowEndLocation(true);
          return;
        }
      }
      showToast({ message: 'No business address found. Add one in Settings.', type: 'error', duration: 4000 });
    } finally {
      setIsGeocodingEnd(false);
    }
  };

  const handleResetToCurrentLocation = () => {
    setStartAddressInput('');
    setStartLocation({ label: 'Current Location', address: '', latitude: 0, longitude: 0, isCurrentLocation: true });
    setOptimizedRoute(null);
    if (Platform.OS === 'web') {
      navigator.geolocation?.getCurrentPosition(
        (pos) => {
          setStartLocation(prev => ({ ...prev, latitude: pos.coords.latitude, longitude: pos.coords.longitude }));
        },
        () => {}
      );
    } else {
      LocationService.getCurrentLocation().then((coords) => {
        if (coords) {
          setStartLocation(prev => ({ ...prev, latitude: coords.latitude, longitude: coords.longitude }));
        }
      });
    }
  };

  const loadSavedRoutes = async () => {
    if (!currentOrganization) return;
    try {
      setLoadingSavedRoutes(true);
      const { data, error } = await supabase
        .from('route_templates')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setSavedRoutes(data || []);
    } catch (error: any) {
      console.error('Error loading routes:', error);
    } finally {
      setLoadingSavedRoutes(false);
    }
  };

  const handleAddLocations = useCallback((locations: RouteLocation[]) => {
    setSelectedLocations((prev) => {
      const existingIds = new Set(prev.map((l) => l.id));
      const newLocations = locations.filter((l) => !existingIds.has(l.id));
      return [...prev, ...newLocations];
    });
    setShowLocationModal(false);
    setOptimizedRoute(null);
  }, []);

  const handleRemoveLocation = (id: string) => {
    setSelectedLocations((prev) => prev.filter((l) => l.id !== id));
    if (optimizedRoute) setOptimizedRoute(null);
  };

  const handleBuildCommercialRoute = async () => {
    if (!currentOrganization) return;
    setIsBuildingCommercial(true);

    try {
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      const weekStartStr = weekStart.toISOString().split('T')[0];
      const weekEndStr = weekEnd.toISOString().split('T')[0];

      const [clientsRes, addressesRes, eventsRes] = await Promise.all([
        supabase
          .from('clients')
          .select('id, name')
          .eq('organization_id', currentOrganization.id)
          .eq('client_type', 'commercial'),
        supabase
          .from('client_addresses')
          .select('id, label, address, latitude, longitude, client_id')
          .eq('organization_id', currentOrganization.id)
          .not('latitude', 'is', null)
          .not('longitude', 'is', null),
        supabase
          .from('schedule_events')
          .select('client_id, location')
          .eq('organization_id', currentOrganization.id)
          .gte('start_time', weekStartStr + 'T00:00:00')
          .lte('start_time', weekEndStr + 'T23:59:59'),
      ]);

      if (clientsRes.error || addressesRes.error || eventsRes.error) {
        throw new Error('Failed to fetch commercial data');
      }

      const commercialClientIds = new Set((clientsRes.data || []).map((c: any) => c.id));
      const clientMap = new Map((clientsRes.data || []).map((c: any) => [c.id, c.name]));

      const scheduledKeys = new Set(
        (eventsRes.data || []).map((e: any) => `${e.client_id}:${(e.location || '').toLowerCase().trim()}`)
      );

      const unscheduledAddresses = (addressesRes.data || []).filter((a: any) => {
        if (!commercialClientIds.has(a.client_id)) return false;
        const key = `${a.client_id}:${(a.address || '').toLowerCase().trim()}`;
        return !scheduledKeys.has(key);
      });

      if (unscheduledAddresses.length === 0) {
        showToast({ message: 'All commercial stops for this week are already scheduled!', type: 'success', duration: 3500 });
        return;
      }

      const newLocations: RouteLocation[] = unscheduledAddresses.map((a: any) => ({
        id: `ca_${a.id}`,
        label: `${clientMap.get(a.client_id) || 'Unknown'} — ${a.label || 'Address'}`,
        address: a.address,
        latitude: parseFloat(a.latitude),
        longitude: parseFloat(a.longitude),
        clientId: a.client_id,
        clientAddressId: a.id,
        durationAtStop: 30,
        clientType: 'commercial' as const,
      }));

      setSelectedLocations((prev) => {
        const existingIds = new Set(prev.map((l) => l.id));
        return [...prev, ...newLocations.filter((l) => !existingIds.has(l.id))];
      });
      setOptimizedRoute(null);
      setIsCommercialRoute(true);

      showToast({
        message: `Added ${newLocations.length} unscheduled commercial stop${newLocations.length !== 1 ? 's' : ''} for this week`,
        type: 'success',
        duration: 3500,
      });
    } catch (err: any) {
      showToast({ message: err?.message || 'Failed to build commercial route', type: 'error', duration: 4000 });
    } finally {
      setIsBuildingCommercial(false);
    }
  };

  const handleOptimizeRoute = async () => {
    if (selectedLocations.length < 2) {
      showToast({ message: 'Please add at least 2 locations to optimize a route', type: 'error', duration: 3000 });
      return;
    }

    try {
      setIsOptimizing(true);
      const hasValidStart = startLocation.latitude !== 0 && startLocation.longitude !== 0;

      let locationsWithWindows = [...selectedLocations];
      if (currentOrganization) {
        const routeStopRefs = selectedLocations
          .filter(l => l.clientId || l.clientAddressId)
          .map(l => ({ clientId: l.clientId, clientAddressId: l.clientAddressId }));

        if (routeStopRefs.length > 0) {
          const windowMap = await resolvePerStopServiceWindows(currentOrganization.id, routeStopRefs);
          locationsWithWindows = selectedLocations.map(loc => {
            const key = loc.clientAddressId || loc.clientId || '';
            const sw = windowMap.get(key);
            return sw ? { ...loc, serviceWindow: sw } : loc;
          });
        }
      }

      const result = optimizeRoute(locationsWithWindows, {
        startTime: '09:00 AM',
        averageSpeedMph: 35,
        includeReturnToStart: false,
        startLocation: hasValidStart ? startLocation : undefined,
        endLocation: endLocation || undefined,
      });

      setOptimizedRoute(result);

      if (currentOrganization) {
        await supabase.from('route_optimization_runs').insert({
          organization_id: currentOrganization.id,
          user_id: (await supabase.auth.getUser()).data.user?.id,
          location_count: selectedLocations.length,
          optimization_method: 'nearest_neighbor_2opt',
          total_distance: result.totalDistance,
          total_duration: result.totalDuration,
        });
      }

      const fixedCount = result.stops.filter(s => s.serviceWindow).length;
      showToast({
        message: fixedCount > 0
          ? `Route optimized: ${result.totalDistance.toFixed(1)} mi, ${fixedCount} fixed window${fixedCount > 1 ? 's' : ''} detected`
          : `Route optimized: ${result.totalDistance.toFixed(1)} miles, ${Math.floor(result.totalDuration / 60)}h ${result.totalDuration % 60}m`,
        type: 'success',
        duration: 4000,
      });
    } catch (error: any) {
      showToast({ message: error.message || 'Failed to optimize route', type: 'error', duration: 4000 });
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleOpenInMaps = async () => {
    if (!optimizedRoute || optimizedRoute.stops.length === 0) {
      showToast({ message: 'Please optimize the route first', type: 'error', duration: 3000 });
      return;
    }
    await openInMaps(
      optimizedRoute.stops,
      getDefaultMapApp(),
      startLocation,
      endLocation || undefined
    );
  };

  const handleSaveRoute = async () => {
    if (!optimizedRoute || !currentOrganization) return;

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const name = routeName.trim() || `Route ${new Date().toLocaleDateString()}`;

      const { data: template, error: templateError } = await supabase
        .from('route_templates')
        .insert({
          organization_id: currentOrganization.id,
          name,
          total_distance: optimizedRoute.totalDistance,
          total_duration: optimizedRoute.totalDuration,
          status: 'draft',
          created_by: userData.user.id,
          is_commercial: isCommercialRoute,
        })
        .select()
        .single();

      if (templateError) throw templateError;

      const stops = optimizedRoute.stops.map((stop, index) => ({
        route_template_id: template.id,
        stop_order: index + 1,
        client_id: stop.clientId || null,
        client_address_id: stop.clientAddressId || null,
        label: stop.label,
        address: stop.address,
        latitude: stop.latitude,
        longitude: stop.longitude,
        estimated_arrival: optimizedRoute.estimatedTimes[index],
        duration_at_stop: stop.durationAtStop || 30,
        notes: stop.notes,
      }));

      const { error: stopsError } = await supabase.from('route_stops').insert(stops);
      if (stopsError) throw stopsError;

      showToast({ message: 'Route saved successfully', type: 'success', duration: 3000 });
      loadSavedRoutes();
      setRouteName('');
    } catch (error: any) {
      showToast({ message: error.message || 'Failed to save route', type: 'error', duration: 4000 });
    }
  };

  const handleDeleteRoute = async (routeId: string) => {
    try {
      await supabase.from('route_stops').delete().eq('route_template_id', routeId);
      const { error } = await supabase.from('route_templates').delete().eq('id', routeId);
      if (error) throw error;
      setSavedRoutes((prev) => prev.filter((r) => r.id !== routeId));
      showToast({ message: 'Route deleted', type: 'success', duration: 2000 });
    } catch (err) {
      showToast({ message: 'Failed to delete route', type: 'error', duration: 3000 });
    }
  };

  const handleLoadRoute = async (routeId: string) => {
    try {
      const { data: stops, error } = await supabase
        .from('route_stops')
        .select('*')
        .eq('route_template_id', routeId)
        .order('stop_order', { ascending: true });

      if (error) throw error;

      const locations: RouteLocation[] = stops.map((stop) => ({
        id: stop.id,
        label: stop.label,
        address: stop.address,
        latitude: parseFloat(stop.latitude),
        longitude: parseFloat(stop.longitude),
        clientId: stop.client_id,
        clientAddressId: stop.client_address_id,
        durationAtStop: stop.duration_at_stop,
        notes: stop.notes,
      }));

      const template = savedRoutes.find((r) => r.id === routeId);
      setSelectedLocations(locations);
      setOptimizedRoute(null);
      setIsCommercialRoute(template?.is_commercial ?? false);

      showToast({ message: 'Route loaded successfully', type: 'success', duration: 2000 });
    } catch (error: any) {
      showToast({ message: error.message || 'Failed to load route', type: 'error', duration: 4000 });
    }
  };

  const getClientTypeIcon = (clientType?: string) => {
    if (clientType === 'commercial') return <Building2 size={12} color="#1B4D6E" />;
    if (clientType === 'contractor') return <HardHat size={12} color="#92400e" />;
    return <Home size={12} color={colors.textSecondary} />;
  };

  const getClientTypePillStyle = (clientType?: string) => {
    if (clientType === 'commercial') return { backgroundColor: 'rgba(27,77,110,0.1)', color: '#1B4D6E' };
    if (clientType === 'contractor') return { backgroundColor: 'rgba(146,64,14,0.1)', color: '#92400e' };
    return { backgroundColor: colors.primaryLight, color: colors.textSecondary };
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.topButtons}>
          <TouchableOpacity
            style={[styles.teamDispatchButton, { overflow: 'hidden' }]}
            onPress={() => setShowTeamDispatchModal(true)}
          >
            <LinearGradient
              colors={['#1B4D6E', '#245d82']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Users2 size={18} color="#fff" />
            <Text style={styles.teamDispatchButtonText}>Team Dispatch</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.commercialRouteButton, isBuildingCommercial && styles.buttonDisabled]}
            onPress={handleBuildCommercialRoute}
            disabled={isBuildingCommercial}
          >
            {isBuildingCommercial ? (
              <ActivityIndicator size="small" color="#1B4D6E" />
            ) : (
              <Building2 size={18} color="#1B4D6E" />
            )}
            <Text style={styles.commercialRouteButtonText}>
              {isBuildingCommercial ? 'Loading...' : 'Commercial Route'}
            </Text>
            <View style={styles.zapBadge}>
              <Zap size={10} color="#1B4D6E" />
            </View>
          </TouchableOpacity>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => setShowRouteSettings(!showRouteSettings)}
            activeOpacity={0.7}
          >
            <View style={styles.sectionTitle}>
              <Navigation size={20} color={colors.primary} />
              <Text style={[styles.sectionTitleText, { color: colors.text }]}>Route Start & End</Text>
            </View>
            {showRouteSettings ? <ChevronUp size={18} color={colors.textSecondary} /> : <ChevronDown size={18} color={colors.textSecondary} />}
          </TouchableOpacity>

          {!showRouteSettings && (
            <View style={styles.endpointSummary}>
              <View style={styles.endpointSummaryRow}>
                <LocateFixed size={12} color="#059669" />
                <Text style={[styles.endpointSummaryText, { color: colors.text }]} numberOfLines={1}>
                  {startLocation.isCurrentLocation ? 'Current Location' : startLocation.label}
                </Text>
              </View>
              {showEndLocation && endLocation && (
                <View style={styles.endpointSummaryRow}>
                  <Flag size={12} color="#dc2626" />
                  <Text style={[styles.endpointSummaryText, { color: colors.text }]} numberOfLines={1}>
                    {endLocation.label}
                  </Text>
                </View>
              )}
              {!showEndLocation && (
                <View style={styles.endpointSummaryRow}>
                  <Flag size={12} color={colors.textSecondary} />
                  <Text style={[styles.endpointSummaryText, { color: colors.textSecondary }]}>No end destination</Text>
                </View>
              )}
            </View>
          )}

          {showRouteSettings && (
            <View style={styles.endpointFields}>
              <View style={styles.endpointRow}>
                <View style={[styles.endpointDot, { backgroundColor: '#059669' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.endpointLabel, { color: colors.textSecondary }]}>Start From</Text>
                  {startLocation.isCurrentLocation ? (
                    <View style={styles.currentLocationRow}>
                      <LocateFixed size={14} color="#059669" />
                      <Text style={[styles.currentLocationText, { color: colors.text }]}>Current Location</Text>
                      <TouchableOpacity
                        style={[styles.endpointChip, { borderColor: colors.border }]}
                        onPress={() => {
                          setStartLocation({ label: '', address: '', latitude: 0, longitude: 0, isCurrentLocation: false });
                        }}
                      >
                        <Text style={[styles.endpointChipText, { color: colors.primary }]}>Use address instead</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.endpointInputRow}>
                      <TextInput
                        style={[styles.endpointInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                        value={startAddressInput}
                        onChangeText={setStartAddressInput}
                        placeholder="Enter start address"
                        placeholderTextColor={colors.textSecondary}
                        onSubmitEditing={handleSetStartAddress}
                        returnKeyType="done"
                      />
                      {isGeocodingStart ? (
                        <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 8 }} />
                      ) : (
                        <TouchableOpacity onPress={handleSetStartAddress} style={styles.endpointGoBtn}>
                          <Check size={16} color={colors.primary} />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity onPress={handleResetToCurrentLocation} style={styles.endpointGoBtn}>
                        <LocateFixed size={16} color="#059669" />
                      </TouchableOpacity>
                    </View>
                  )}
                  {!startLocation.isCurrentLocation && startLocation.latitude !== 0 && (
                    <Text style={[styles.endpointConfirmed, { color: '#059669' }]}>{startLocation.label}</Text>
                  )}
                </View>
              </View>

              <View style={[styles.endpointConnector, { borderLeftColor: colors.border }]} />

              <View style={styles.endpointRow}>
                <View style={[styles.endpointDot, { backgroundColor: '#dc2626' }]} />
                <View style={{ flex: 1 }}>
                  <View style={styles.endpointLabelRow}>
                    <Text style={[styles.endpointLabel, { color: colors.textSecondary }]}>End At</Text>
                    {!showEndLocation && (
                      <TouchableOpacity
                        style={[styles.endpointChip, { borderColor: colors.border }]}
                        onPress={() => setShowEndLocation(true)}
                      >
                        <Plus size={12} color={colors.primary} />
                        <Text style={[styles.endpointChipText, { color: colors.primary }]}>Add end destination</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {showEndLocation ? (
                    <>
                      <View style={styles.endpointInputRow}>
                        <TextInput
                          style={[styles.endpointInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                          value={endAddressInput}
                          onChangeText={setEndAddressInput}
                          placeholder="home, client name, or address..."
                          placeholderTextColor={colors.textSecondary}
                          onSubmitEditing={handleSetEndAddress}
                          returnKeyType="done"
                        />
                        {isGeocodingEnd ? (
                          <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 8 }} />
                        ) : (
                          <TouchableOpacity onPress={handleSetEndAddress} style={styles.endpointGoBtn}>
                            <Check size={16} color={colors.primary} />
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          onPress={() => { setShowEndLocation(false); setEndLocation(null); setEndAddressInput(''); setOptimizedRoute(null); }}
                          style={styles.endpointGoBtn}
                        >
                          <X size={16} color="#dc2626" />
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity
                        style={[styles.homeBaseChip, { borderColor: colors.border, backgroundColor: colors.background }]}
                        onPress={handleSetEndToHomeBase}
                        disabled={isGeocodingEnd}
                      >
                        <Home size={12} color={colors.primary} />
                        <Text style={[styles.homeBaseChipText, { color: colors.primary }]}>Use Home Base</Text>
                      </TouchableOpacity>
                      {endLocation && endLocation.latitude !== 0 && (
                        <Text style={[styles.endpointConfirmed, { color: '#dc2626' }]}>{endLocation.label}</Text>
                      )}
                    </>
                  ) : (
                    <>
                      <Text style={[styles.endpointHint, { color: colors.textSecondary }]}>Route ends at last stop</Text>
                      <TouchableOpacity
                        style={[styles.homeBaseChip, { borderColor: colors.border, backgroundColor: colors.background }]}
                        onPress={handleSetEndToHomeBase}
                        disabled={isGeocodingEnd}
                      >
                        {isGeocodingEnd ? <ActivityIndicator size="small" color={colors.primary} /> : <Home size={12} color={colors.primary} />}
                        <Text style={[styles.homeBaseChipText, { color: colors.primary }]}>End at Home Base</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            </View>
          )}
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitle}>
              <MapPin size={20} color={colors.primary} />
              <Text style={[styles.sectionTitleText, { color: colors.text }]}>Selected Locations</Text>
              <View style={[styles.badge, { backgroundColor: colors.primaryLight }]}>
                <Text style={[styles.badgeText, { color: colors.primary }]}>{selectedLocations.length}</Text>
              </View>
              {isCommercialRoute && selectedLocations.length > 0 && (
                <View style={styles.commercialRouteBadge}>
                  <Building2 size={10} color="#1B4D6E" />
                  <Text style={styles.commercialRouteBadgeText}>Commercial</Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              style={[styles.addButton, { overflow: 'hidden' }]}
              onPress={() => setShowLocationModal(true)}
            >
              <LinearGradient
                colors={['#1B4D6E', '#245d82']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Plus size={16} color="#fff" />
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          </View>

          {selectedLocations.length === 0 ? (
            <View style={styles.emptyState}>
              <MapPin size={40} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No locations selected
              </Text>
              <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                Add clients or use Commercial Route to auto-load unscheduled stops
              </Text>
            </View>
          ) : (
            <View style={styles.locationsList}>
              {selectedLocations.map((location, index) => {
                const pillStyle = getClientTypePillStyle(location.clientType);
                return (
                  <View
                    key={location.id}
                    style={[styles.locationItem, { borderBottomColor: colors.border }]}
                  >
                    <View style={styles.locationContent}>
                      <View style={[styles.locationNumber, { backgroundColor: location.clientType === 'commercial' ? 'rgba(27,77,110,0.12)' : colors.primaryLight }]}>
                        <Text style={[styles.locationNumberText, { color: location.clientType === 'commercial' ? '#1B4D6E' : colors.primary }]}>
                          {index + 1}
                        </Text>
                      </View>
                      <View style={styles.locationInfo}>
                        <View style={styles.locationLabelRow}>
                          <Text style={[styles.locationLabel, { color: colors.text }]} numberOfLines={1}>
                            {location.label}
                          </Text>
                          {location.clientType && (
                            <View style={[styles.clientTypePill, { backgroundColor: pillStyle.backgroundColor }]}>
                              {getClientTypeIcon(location.clientType)}
                              <Text style={[styles.clientTypePillText, { color: pillStyle.color }]}>
                                {location.clientType === 'commercial' ? 'Comm' : location.clientType === 'contractor' ? 'Contr' : 'Res'}
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={[styles.locationAddress, { color: colors.textSecondary }]} numberOfLines={1}>
                          {location.address}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => handleRemoveLocation(location.id)} style={styles.removeButton}>
                      <Trash2 size={16} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {selectedLocations.length >= 2 && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[
                styles.optimizeButton,
                { overflow: 'hidden' },
                isOptimizing && styles.optimizeButtonDisabled,
              ]}
              onPress={handleOptimizeRoute}
              disabled={isOptimizing}
            >
              <LinearGradient
                colors={['#1B4D6E', '#245d82']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              {isOptimizing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Route size={20} color="#fff" />
              )}
              <Text style={styles.optimizeButtonText}>
                {isOptimizing ? 'Optimizing...' : 'Optimize Route'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {optimizedRoute && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitle}>
                <Check size={20} color="#10b981" />
                <Text style={[styles.sectionTitleText, { color: colors.text }]}>Optimized Route</Text>
              </View>
            </View>

            <View style={styles.routeEndpointBanner}>
              <View style={styles.routeEndpointItem}>
                <LocateFixed size={12} color="#059669" />
                <Text style={[styles.routeEndpointText, { color: colors.text }]} numberOfLines={1}>
                  {startLocation.isCurrentLocation ? 'Current Location' : startLocation.label}
                </Text>
              </View>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>→</Text>
              <Text style={[styles.routeEndpointText, { color: colors.textSecondary, fontStyle: 'italic' }]} numberOfLines={1}>
                {optimizedRoute.stops.length} stops
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>→</Text>
              <View style={styles.routeEndpointItem}>
                <Flag size={12} color="#dc2626" />
                <Text style={[styles.routeEndpointText, { color: colors.text }]} numberOfLines={1}>
                  {endLocation ? endLocation.label : optimizedRoute.stops[optimizedRoute.stops.length - 1]?.label || 'Last stop'}
                </Text>
              </View>
            </View>

            <View style={styles.routeStats}>
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Distance</Text>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {optimizedRoute.totalDistance.toFixed(1)} mi
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Duration</Text>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {Math.floor(optimizedRoute.totalDuration / 60)}h {optimizedRoute.totalDuration % 60}m
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Stops</Text>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {optimizedRoute.stops.length}
                </Text>
              </View>
            </View>

            <RouteMapPreview locations={optimizedRoute.stops} />

            <View style={[styles.saveRow, { borderTopColor: colors.border }]}>
              <TextInput
                style={[styles.routeNameInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBackground }]}
                value={routeName}
                onChangeText={setRouteName}
                placeholder="Route name (optional)"
                placeholderTextColor={colors.textSecondary}
              />
              <TouchableOpacity
                style={[styles.commercialTagToggle, isCommercialRoute && styles.commercialTagToggleActive]}
                onPress={() => setIsCommercialRoute(!isCommercialRoute)}
              >
                <Tag size={14} color={isCommercialRoute ? '#1B4D6E' : colors.textSecondary} />
                <Text style={[styles.commercialTagToggleText, { color: isCommercialRoute ? '#1B4D6E' : colors.textSecondary }]}>
                  {isCommercialRoute ? 'Commercial' : 'Tag Commercial'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.routeActions}>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.primaryLight, flex: 1 }]}
                onPress={handleOpenInMaps}
              >
                <Navigation size={18} color={colors.primary} />
                <Text style={[styles.actionBtnText, { color: colors.primary }]}>Open in Maps</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.primaryLight, flex: 1 }]}
                onPress={() => setShowScheduleModal(true)}
              >
                <Calendar size={18} color={colors.primary} />
                <Text style={[styles.actionBtnText, { color: colors.primary }]}>Schedule</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.primaryLight }]}
                onPress={handleSaveRoute}
              >
                <Save size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {savedRoutes.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitleText, { color: colors.text, marginBottom: 4 }]}>
              Saved Routes
            </Text>

            {savedRoutes.some((r) => r.is_commercial) && (
              <View style={styles.savedRoutesFilterRow}>
                <View style={styles.commercialSavedBadge}>
                  <Building2 size={10} color="#1B4D6E" />
                  <Text style={styles.commercialSavedBadgeText}>Commercial templates marked below</Text>
                </View>
              </View>
            )}

            {savedRoutes.map((route) => (
              <View
                key={route.id}
                style={[
                  styles.savedRouteItem,
                  { borderBottomColor: colors.border },
                  route.is_commercial && styles.savedRouteItemCommercial,
                ]}
              >
                <TouchableOpacity style={styles.savedRouteInfo} onPress={() => handleLoadRoute(route.id)}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.savedRouteTitleRow}>
                      <Text style={[styles.savedRouteName, { color: colors.text }]}>{route.name}</Text>
                      {route.is_commercial && (
                        <View style={styles.commercialTemplateBadge}>
                          <Building2 size={9} color="#1B4D6E" />
                          <Text style={styles.commercialTemplateBadgeText}>Comm</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.savedRouteStats, { color: colors.textSecondary }]}>
                      {route.total_distance?.toFixed(1) || 0} mi · {Math.floor((route.total_duration || 0) / 60)}h{' '}
                      {(route.total_duration || 0) % 60}m
                    </Text>
                  </View>
                  <Play size={16} color={colors.primary} style={{ marginRight: 12 }} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.deleteRouteButton, { backgroundColor: '#fee2e2' }]}
                  onPress={() => handleDeleteRoute(route.id)}
                >
                  <Trash2 size={16} color="#dc2626" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <LocationSelectionModal
        visible={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        onSelectLocations={handleAddLocations}
      />

      {optimizedRoute && (
        <ScheduleSuggestionModal
          visible={showScheduleModal}
          onClose={() => setShowScheduleModal(false)}
          route={optimizedRoute}
          routeName={routeName}
        />
      )}

      <TeamDispatchModal
        visible={showTeamDispatchModal}
        onClose={() => setShowTeamDispatchModal(false)}
        locations={selectedLocations}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  topButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  teamDispatchButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 12,
  },
  teamDispatchButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  commercialRouteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(27,77,110,0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(27,77,110,0.25)',
    position: 'relative',
  },
  commercialRouteButtonText: {
    color: '#1B4D6E',
    fontSize: 14,
    fontWeight: '700',
  },
  zapBadge: {
    position: 'absolute',
    top: 6,
    right: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  section: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  sectionTitleText: {
    fontSize: 18,
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  commercialRouteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(27,77,110,0.1)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
  },
  commercialRouteBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1B4D6E',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 260,
  },
  locationsList: {
    gap: 0,
  },
  locationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  locationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  locationNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationNumberText: {
    fontSize: 14,
    fontWeight: '700',
  },
  locationInfo: {
    flex: 1,
    gap: 2,
  },
  locationLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  locationLabel: {
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
  },
  clientTypePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  clientTypePillText: {
    fontSize: 10,
    fontWeight: '600',
  },
  locationAddress: {
    fontSize: 13,
  },
  removeButton: {
    padding: 8,
  },
  actionButtons: {
    gap: 12,
  },
  optimizeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
  },
  optimizeButtonDisabled: {
    opacity: 0.6,
  },
  optimizeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  routeStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 4,
  },
  statItem: {
    alignItems: 'center',
    gap: 4,
  },
  statLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  saveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  routeNameInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  commercialTagToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(27,77,110,0.2)',
    backgroundColor: 'transparent',
  },
  commercialTagToggleActive: {
    backgroundColor: 'rgba(27,77,110,0.1)',
    borderColor: '#1B4D6E',
  },
  commercialTagToggleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  routeActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 12,
    borderRadius: 8,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  savedRoutesFilterRow: {
    marginBottom: 4,
  },
  commercialSavedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  commercialSavedBadgeText: {
    fontSize: 11,
    color: '#1B4D6E',
    fontWeight: '500',
  },
  savedRouteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  savedRouteItemCommercial: {
    borderLeftWidth: 3,
    borderLeftColor: '#1B4D6E',
    paddingLeft: 8,
  },
  savedRouteInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  savedRouteTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  savedRouteName: {
    fontSize: 15,
    fontWeight: '600',
  },
  commercialTemplateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(27,77,110,0.1)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
  },
  commercialTemplateBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#1B4D6E',
  },
  savedRouteStats: {
    fontSize: 13,
  },
  deleteRouteButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endpointSummary: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },
  endpointSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  endpointSummaryText: {
    fontSize: 13,
    fontWeight: '500',
    maxWidth: 160,
  },
  endpointFields: {
    gap: 0,
  },
  endpointRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  endpointDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
  },
  endpointLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  endpointLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  currentLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  currentLocationText: {
    fontSize: 14,
    fontWeight: '600',
  },
  endpointChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  endpointChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  endpointInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  endpointInput: {
    flex: 1,
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  endpointGoBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  endpointConfirmed: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  endpointConnector: {
    borderLeftWidth: 2,
    borderStyle: 'dashed',
    height: 16,
    marginLeft: 5,
  },
  endpointHint: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  homeBaseChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 4,
  },
  homeBaseChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  routeEndpointBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 8,
    flexWrap: 'wrap',
  },
  routeEndpointItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '40%',
  },
  routeEndpointText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
