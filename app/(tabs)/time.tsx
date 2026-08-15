import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Platform,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Clock, Play, Square, Pencil, Trash2, ChevronDown, ChevronUp, Users, User, X, Check, MapPin, Hop as Home, Truck, Camera, LogOut, History, Coffee, ChartBar as BarChart3, Radio, Map, Menu, Bell, ListFilter as Filter, Calendar, TrendingUp, Timer, Save, CircleUser as UserCircle, Package, Search, Plus, Receipt, Navigation, FileText } from 'lucide-react-native';
import SwipeableRow from '@/components/SwipeableRow';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTabNavigation } from '@/contexts/TabNavigationContext';
import { AnimatedTabContent } from '@/components/AnimatedTabContent';
import { getSlideDirection, getDynamicTabOrder } from '@/utils/tabAnimations';
import DateRangeFilter from '@/components/DateRangeFilter';
import JobDepartureModal from '@/components/JobDepartureModal';
import ClientSelectionModal from '@/components/ClientSelectionModal';
import SessionHistoryModal from '@/components/SessionHistoryModal';
import ProductivityReportModal from '@/components/ProductivityReportModal';
import LiveCrewTracker from '@/components/LiveCrewTracker';
import CrewLocationMap from '@/components/CrewLocationMap';
import { LocationService, Coordinates, LocationStatus, ClientWithDistance } from '@/lib/locationService';
import { BackgroundLocationService } from '@/lib/backgroundLocationService';
import { AutoClockOutPrompt } from '@/components/AutoClockOutPrompt';
import { DetectedLocationsModal } from '@/components/DetectedLocationsModal';
import ClientModal from '@/components/ClientModal';
import ScheduleModal from '@/components/ScheduleModal';
import getDynamicStyles from '@/styles/timeStyles';
import { SPACING, CARD } from '@/constants/designSystem';
import Svg, { Rect, Text as SvgText, G } from 'react-native-svg';
import { useLayout } from '@/contexts/LayoutContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { upsertLiveLocation, deactivateLiveLocation } from '@/lib/liveLocationService';
import { useLocationAudit } from '@/hooks/useLocationAudit';
import LocationContextModal, { LocationContextPrompt } from '@/components/LocationContextModal';
import LocationContextChips, { LocationContext } from '@/components/LocationContextChips';
import StationaryStopPrompt, { StationaryStopData } from '@/components/StationaryStopPrompt';
import TimeClockBreakdown from '@/components/TimeClockBreakdown';
import { generatePayrollSummaryPDF, TimeEntryForPdf } from '@/lib/timePdfService';
import EmployeeHoursDetailModal from '@/components/EmployeeHoursDetailModal';
import { getAndClearNotificationIntent } from '@/components/PushNotificationHandler';
import { PushNotificationService } from '@/lib/pushNotificationService';
import EquipmentChecklistModal from '@/components/EquipmentChecklistModal';
import AddTimeEntryModal from '@/components/AddTimeEntryModal';
import WorkflowFab from '@/components/WorkflowFab';
import type { FabAction } from '@/components/WorkflowFab';
import { useQuickActionHandler } from '@/hooks/useQuickActionHandler';
import { useTimerPrefill } from '@/contexts/TimerPrefillContext';
import InvoiceModal from '@/components/InvoiceModal';
import PulsingIndicator from '@/components/PulsingIndicator';
import BlurHeader from '@/components/BlurHeader';
import { HapticPatterns } from '@/lib/haptics';

interface TimeEntry {
  id: string;
  clock_in: string;
  clock_out: string | null;
  notes: string | null;
  user_id: string;
  created_at: string;
  user_name?: string;
  user_email?: string;
  is_clocked_in?: boolean;
  location_tracking_enabled?: boolean;
  travel_flag?: boolean;
  stopped_minutes?: number;
  photos?: { id: string; photo_url: string }[];
  breaks?: { id: string; started_at: string; ended_at?: string; notes?: string }[];
  schedule_info?: { id: string; name: string; start_time: string; end_time: string } | null;
}

interface Client {
  id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  user_id?: string;
}

interface ProductivitySession {
  id: string;
  user_id: string;
  time_entry_id: string | null;
  client_id: string | null;
  session_type: string;
  start_time: string;
  end_time: string | null;
  departure_reason: string | null;
  on_break?: boolean;
  client?: Client;
}

interface Profile {
  id: string;
  email: string;
  display_name: string;
  hourly_rate?: number | null;
}

type ViewMode = 'entries' | 'weekly' | 'monthly' | 'team';

interface TimeEdit {
  hour: string;
  minute: string;
  period: 'AM' | 'PM';
}

interface PeriodReport {
  period: string;
  totalHours: number;
  totalMinutes: number;
  entries: number;
  displayDate: string;
}

export default function TimeTrackingScreen() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('entries');
  const [expandedReports, setExpandedReports] = useState<Set<string>>(new Set());
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesText, setNotesText] = useState('');
  const [editingTime, setEditingTime] = useState<string | null>(null);
  const [editClockIn, setEditClockIn] = useState<TimeEdit>({ hour: '12', minute: '00', period: 'AM' });
  const [editClockOut, setEditClockOut] = useState<TimeEdit | null>(null);
  const [editDate, setEditDate] = useState<string>('');
  const [teamView, setTeamView] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [weekStartDay, setWeekStartDay] = useState(0);
  const [weekFilter, setWeekFilter] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<Coordinates | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus & { speed?: number; stoppedMinutes?: number }>({ type: 'unknown' });
  const [clients, setClients] = useState<Client[]>([]);
  const [homeBase, setHomeBase] = useState<Coordinates | null>(null);
  const [geofenceRadius, setGeofenceRadius] = useState(100);
  const [showDepartureModal, setShowDepartureModal] = useState(false);
  const [showClientSelection, setShowClientSelection] = useState(false);
  const [showSessionHistory, setShowSessionHistory] = useState(false);
  const [showProductivityReport, setShowProductivityReport] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState<string | undefined>(undefined);
  const [nearbyClients, setNearbyClients] = useState<ClientWithDistance[]>([]);
  const [currentSession, setCurrentSession] = useState<ProductivitySession | null>(null);
  const [pendingPhoto, setPendingPhoto] = useState<{ uri: string; location: Coordinates } | null>(null);
  const [showAutoClockOutPrompt, setShowAutoClockOutPrompt] = useState(false);
  const [autoClockOutMinutes, setAutoClockOutMinutes] = useState(0);
  const [clockOutPromptId, setClockOutPromptId] = useState<string | null>(null);
  const [showDetectedLocations, setShowDetectedLocations] = useState(false);
  const [detectedLocationCount, setDetectedLocationCount] = useState(0);
  const [showClientModal, setShowClientModal] = useState(false);
  const [clientPrefillName, setClientPrefillName] = useState('');
  const [clientPrefillPhone, setClientPrefillPhone] = useState('');
  const [clientPrefillAddress, setClientPrefillAddress] = useState('');
  const [clientPrefillLanguage, setClientPrefillLanguage] = useState('');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showEquipmentChecklist, setShowEquipmentChecklist] = useState(false);
  const [locationForNewClient, setLocationForNewClient] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationForSchedule, setLocationForSchedule] = useState<{ latitude: number; longitude: number } | null>(null);
  const [liveCrewVisible, setLiveCrewVisible] = useState(false);
  const [crewMapVisible, setCrewMapVisible] = useState(false);
  const [moreMenuVisible, setMoreMenuVisible] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkDeleteMode, setBulkDeleteMode] = useState<'all' | 'year' | 'user'>('all');
  const [bulkDeleteYear, setBulkDeleteYear] = useState(new Date().getFullYear() - 1);
  const [bulkDeleteUserId, setBulkDeleteUserId] = useState('');
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [locationContextPrompt, setLocationContextPrompt] = useState<LocationContextPrompt | null>(null);
  const [currentLocationContext, setCurrentLocationContext] = useState<LocationContext>('unknown');
  const [stationaryStopData, setStationaryStopData] = useState<StationaryStopData | null>(null);
  const stationaryStopShownRef = useRef<Set<string>>(new Set());
  const [scheduleEvents, setScheduleEvents] = useState<any[]>([]);
  const [showBreakTypeModal, setShowBreakTypeModal] = useState(false);
  const [breakPolicies, setBreakPolicies] = useState<{ id: string; name: string; duration_minutes: number; notify_on_expiry: boolean; color: string }[]>([]);
  const [hourlyRate, setHourlyRate] = useState<number | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [mainTab, setMainTab] = useState<'my_hours' | 'team'>('my_hours');
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [memberPickerSearch, setMemberPickerSearch] = useState('');
  const [selectedEmployeeDetail, setSelectedEmployeeDetail] = useState<{ userId: string; name: string; email?: string } | null>(null);
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [teamDatePreset, setTeamDatePreset] = useState<'this_week' | 'last_week' | 'this_month' | 'custom'>('this_week');
  const [jobTimerRunning, setJobTimerRunning] = useState(false);
  const [jobTimerStartedAt, setJobTimerStartedAt] = useState(0);
  const [jobTimerElapsed, setJobTimerElapsed] = useState(0);
  const [jobTimerJobName, setJobTimerJobName] = useState('');
  const [selectedTimerJobId, setSelectedTimerJobId] = useState('');
  const [selectedTimerClientId, setSelectedTimerClientId] = useState<string | null>(null);
  const [showTimerJobPicker, setShowTimerJobPicker] = useState(false);
  const [timerPickerMode, setTimerPickerMode] = useState<'schedule' | 'client'>('schedule');
  const [savingTimerSession, setSavingTimerSession] = useState(false);
  const [jobTimerSaved, setJobTimerSaved] = useState(false);
  const [jobTimerActualStart, setJobTimerActualStart] = useState<Date | null>(null);
  const [selectedTimerAddressId, setSelectedTimerAddressId] = useState<string | null>(null);
  const [timerClientAddresses, setTimerClientAddresses] = useState<{ id: string; label: string; address_line1: string; city: string; clientId: string; clientName: string; latitude: number | null; longitude: number | null; distance: number | null }[]>([]);
  const [showTimerAddressPicker, setShowTimerAddressPicker] = useState(false);
  const [showEquipmentPrompt, setShowEquipmentPrompt] = useState(false);
  const [showDirectionsPrompt, setShowDirectionsPrompt] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [showAddEntryModal, setShowAddEntryModal] = useState(false);
  const [timerAddressSearch, setTimerAddressSearch] = useState('');
  const [timerClientSearchQuery, setTimerClientSearchQuery] = useState('');
  const [allTimerAddresses, setAllTimerAddresses] = useState<{ id: string; label: string; address_line1: string; city: string; clientId: string; clientName: string; latitude: number | null; longitude: number | null; distance: number | null }[]>([]);
  const [jobCategories, setJobCategories] = useState<{ id: string; name: string; color?: string; scope_options?: string | null }[]>([]);
  const [selectedTimerServiceScope, setSelectedTimerServiceScope] = useState<'full_service' | 'exterior_only'>('full_service');
  const [selectedTimerCategoryId, setSelectedTimerCategoryId] = useState<string | null>(null);
  const [showTimerJobTypePicker, setShowTimerJobTypePicker] = useState(false);
  const [showInvoicePrompt, setShowInvoicePrompt] = useState(false);
  const [timerInvoiceModalVisible, setTimerInvoiceModalVisible] = useState(false);
  const [timerInvoicePrefill, setTimerInvoicePrefill] = useState<{ clientId: string; items: any[]; notes?: string } | null>(null);
  const [timerNearestClient, setTimerNearestClient] = useState<{ id: string; name: string; distanceKm: number } | null>(null);
  const jobTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const breakTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const { isAdminOrManager, isOwner, isAdmin } = useUserRole();
  const isAdminOrOwner = isOwner || isAdmin;
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const { consumeTimerPrefill } = useTimerPrefill();
  const pendingDeleteRef = useRef<{ entry: TimeEntry; timeoutId: ReturnType<typeof setTimeout> } | null>(null);
  const locationSubscription = useRef<any>(null);
  const lastLocationRef = useRef<Coordinates & { _ts?: number } | null>(null);
  const stationaryStartRef = useRef<number | null>(null);
  const travelSessionIdRef = useRef<string | null>(null);
  const travelStartLocationRef = useRef<Coordinates | null>(null);
  const isMountedRef = useRef(true);
  const { visibleTabs, dominantHand } = useLayout();
  const dynamicOrder = getDynamicTabOrder(visibleTabs);
  const { currentTab: globalCurrentTab, previousTab: globalPreviousTab } = useTabNavigation();
  const dynamicStyles = getDynamicStyles(colors, isDark);
  const slideDirection = getSlideDirection(globalPreviousTab, globalCurrentTab, dynamicOrder);
  const handleQuickAction = useQuickActionHandler({
    onScheduleClient: () => setShowScheduleModal(true),
    onAddClient: (name, phone, address, language) => {
      setClientPrefillName(name || '');
      setClientPrefillPhone(phone || '');
      setClientPrefillAddress(address || '');
      setClientPrefillLanguage(language || '');
      setShowClientModal(true);
    },
  });
  const locationAudit = useLocationAudit({
    speedThresholdMph: 1,
    durationThresholdMinutes: 5,
    radiusMeters: 50,
  });

  // thresholds
  const TRAVEL_SPEED_MPS = 3; // ~6.7 mph
  const STOPPED_THRESHOLD_MIN = 5;
  const STOPPED_THRESHOLD_LONG_MIN = 10;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (jobTimerRunning) {
      jobTimerRef.current = setInterval(() => {
        setJobTimerElapsed(Date.now() - jobTimerStartedAt);
      }, 1000);
    }
    return () => {
      if (jobTimerRef.current) clearInterval(jobTimerRef.current);
    };
  }, [jobTimerRunning, jobTimerStartedAt]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const checkIntent = async () => {
      const intent = await getAndClearNotificationIntent();
      if (!intent) return;
      if (intent.type === 'clock_in') {
        if (!activeEntry) {
          setTimeout(() => handleClockIn(), 400);
        }
      } else if (intent.type === 'clock_out') {
        if (activeEntry) {
          setShowAutoClockOutPrompt(true);
        }
      } else if (intent.type === 'equipment_checklist_prompt') {
        setTimeout(() => setShowEquipmentPrompt(true), 500);
      }
    };
    checkIntent();
  }, []);

  useEffect(() => {
    if (isAdminOrManager) {
      fetchProfiles();
    }
  }, [isAdminOrManager]);

  useEffect(() => {
    if (isAdminOrManager && (selectedEmployeeId || viewMode === 'team' || mainTab === 'team')) {
      if (!teamView) setTeamView(true);
    }
  }, [isAdminOrManager, selectedEmployeeId, viewMode, mainTab]);

  useEffect(() => {
    fetchEntries();
    fetchClients();
    fetchHomeBase();
    fetchScheduleEvents();
    fetchAllTimerAddresses();
    fetchJobTypes();
    fetchWeekStartDay();
    fetchBreakPolicies();
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [teamView, profiles, user?.id, currentOrganization?.id, viewingUserId]);

  useEffect(() => {
    computeTimerNearestClient(currentLocation);
  }, [allTimerAddresses, clients]);

  useEffect(() => {
    if (allTimerAddresses.length === 0) return;
    const prefill = consumeTimerPrefill();
    if (!prefill) return;
    setSelectedTimerClientId(prefill.clientId);
    setTimerPickerMode('client');
    const clientAddrs = allTimerAddresses.filter(a => a.clientId === prefill.clientId);
    setTimerClientAddresses(clientAddrs);
    if (clientAddrs.length === 1) {
      setSelectedTimerAddressId(clientAddrs[0].id);
    } else if (clientAddrs.length > 1) {
      const nearest = clientAddrs.reduce((best: typeof clientAddrs[0] | null, a) => {
        if (a.distance != null && (best == null || (best.distance != null && a.distance < best.distance))) return a;
        return best;
      }, null);
      setSelectedTimerAddressId(nearest?.id || clientAddrs[0].id);
    }
  }, [allTimerAddresses]);

  useEffect(() => {
    return () => {
      if (locationSubscription.current) {
        try {
          if (typeof locationSubscription.current.remove === 'function') {
            locationSubscription.current.remove();
          }
        } catch (e) {}
        locationSubscription.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!user?.id || !homeBase) return;

    if (!activeEntry) {
      BackgroundLocationService.startGeofenceWatcher(user.id, homeBase, geofenceRadius).catch(() => {});
    } else {
      BackgroundLocationService.stopGeofenceWatcher().catch(() => {});
    }

    return () => {
      if (!activeEntry) {
        BackgroundLocationService.stopGeofenceWatcher().catch(() => {});
      }
    };
  }, [user?.id, homeBase, geofenceRadius, activeEntry?.id]);

  useEffect(() => {
    if (!user?.id || !activeEntry) return;

    const subscription = supabase
      .channel('clock_out_prompts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'clock_out_prompts',
          filter: `user_id=eq.${user.id}`,
        },
        (payload: any) => {
          if (!isMountedRef.current) return;
          if (payload.new && payload.new.time_entry_id === activeEntry?.id) {
            setAutoClockOutMinutes(payload.new.minutes_away);
            setClockOutPromptId(payload.new.id);
            setShowAutoClockOutPrompt(true);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id, activeEntry?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const fetchDetectedLocationsCount = async () => {
      try {
        const { count, error } = await supabase
          .from('detected_locations')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('dismissed', false)
          .is('associated_client_id', null);

        if (error) throw error;
        if (isMountedRef.current) {
          setDetectedLocationCount(count || 0);
        }
      } catch (error) {
        console.error('Error fetching detected locations count:', error);
      }
    };

    fetchDetectedLocationsCount();

    const subscription = supabase
      .channel('detected_locations_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'detected_locations',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          if (isMountedRef.current) {
            fetchDetectedLocationsCount();
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id]);

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase.from('profiles').select('id, email, display_name');
      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error('Error fetching profiles:', error);
    }
  };

  const fetchClients = async () => {
    try {
      let query = supabase.from('clients').select('id, name, address, latitude, longitude, user_id');
      if (currentOrganization?.id) {
        query = query.eq('organization_id', currentOrganization.id);
      } else {
        query = query.eq('user_id', user?.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  const fetchHomeBase = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('home_base_latitude, home_base_longitude, geofence_radius, hourly_rate')
        .eq('id', user?.id)
        .maybeSingle();
      if (error) throw error;
      if (data?.home_base_latitude && data?.home_base_longitude) {
        setHomeBase({
          latitude: parseFloat(data.home_base_latitude),
          longitude: parseFloat(data.home_base_longitude),
        });
        setGeofenceRadius(data.geofence_radius || 100);
      }
      setHourlyRate(data?.hourly_rate ?? null);
    } catch (error) {
      console.error('Error fetching home base:', error);
    }
  };

  const fetchCurrentSession = async () => {
    try {
      const { data, error } = await supabase
        .from('productivity_sessions')
        .select('*, client:clients(*)')
        .eq('user_id', user?.id)
        .is('end_time', null)
        .maybeSingle();
      if (error) throw error;
      setCurrentSession(data);
    } catch (error) {
      console.error('Error fetching current session:', error);
    }
  };

  const fetchScheduleEvents = async () => {
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      const { data, error } = await supabase
        .from('schedule_events')
        .select('id, title, start_time, end_time, location, latitude, longitude, client_address_id, client:clients(id, name)')
        .gte('start_time', todayStart.toISOString())
        .lte('start_time', todayEnd.toISOString())
        .eq('user_id', user?.id);
      if (error) throw error;
      setScheduleEvents(data || []);
    } catch (error) {
      console.error('Error fetching schedule events:', error);
    }
  };

  const getFirstJobWithAddress = () => {
    const now = new Date();
    return scheduleEvents
      .filter(e => e.location || (e.latitude && e.longitude))
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
      .find(e => new Date(e.start_time) >= new Date(now.setHours(0, 0, 0, 0)));
  };

  const openDirectionsToJob = (event: any) => {
    const { Linking } = require('react-native');
    const address = event.location || '';
    const lat = event.latitude;
    const lon = event.longitude;
    let url: string;
    if (lat && lon) {
      url = Platform.OS === 'ios'
        ? `maps://?daddr=${lat},${lon}&dirflg=d`
        : `google.navigation:q=${lat},${lon}`;
    } else {
      const encoded = encodeURIComponent(address);
      url = Platform.OS === 'ios'
        ? `maps://?daddr=${encoded}&dirflg=d`
        : `geo:0,0?q=${encoded}`;
    }
    Linking.openURL(url).catch(() => {
      const fallback = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(lat && lon ? `${lat},${lon}` : address)}`;
      Linking.openURL(fallback);
    });
  };

  const getDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const fetchAllTimerAddresses = async () => {
    try {
      const { data } = await supabase
        .from('client_addresses')
        .select('id, label, address, city, latitude, longitude, is_primary, client_id, clients(id, name)')
        .order('is_primary', { ascending: false });

      let userLat: number | null = null;
      let userLon: number | null = null;
      if (currentLocation) {
        userLat = currentLocation.latitude;
        userLon = currentLocation.longitude;
      }

      const addresses = (data || []).map((a: any) => {
        let dist: number | null = null;
        if (userLat != null && userLon != null && a.latitude && a.longitude) {
          dist = getDistanceKm(userLat, userLon, a.latitude, a.longitude);
        }
        return {
          id: a.id,
          label: a.label || '',
          address_line1: a.address || '',
          city: a.city || '',
          clientId: a.clients?.id || a.client_id,
          clientName: a.clients?.name || '',
          latitude: a.latitude,
          longitude: a.longitude,
          distance: dist,
        };
      });

      addresses.sort((a: any, b: any) => {
        if (a.distance != null && b.distance != null) return a.distance - b.distance;
        if (a.distance != null) return -1;
        if (b.distance != null) return 1;
        return a.clientName.localeCompare(b.clientName);
      });

      setAllTimerAddresses(addresses);
      setTimerClientAddresses(addresses);
      if (currentLocation) computeTimerNearestClient(currentLocation);
    } catch {
      setAllTimerAddresses([]);
      setTimerClientAddresses([]);
    }
  };

  const fetchTimerClientAddresses = async (clientId: string) => {
    const filtered = allTimerAddresses.filter(a => a.clientId === clientId);
    setTimerClientAddresses(filtered);
    if (filtered.length === 1) {
      setSelectedTimerAddressId(filtered[0].id);
    } else {
      setSelectedTimerAddressId(null);
    }
  };

  const fetchJobTypes = async () => {
    try {
      let query = supabase.from('job_type_categories').select('id, name, color, scope_options').order('name');
      if (currentOrganization?.id) query = query.eq('organization_id', currentOrganization.id);
      const { data } = await query;
      setJobCategories(data || []);
    } catch {
      setJobCategories([]);
    }
  };

  const computeTimerNearestClient = (loc: Coordinates | null) => {
    if (!loc) { setTimerNearestClient(null); return; }
    const clientAddressMap: Record<string, typeof allTimerAddresses> = {};
    allTimerAddresses.forEach(a => {
      if (!clientAddressMap[a.clientId]) clientAddressMap[a.clientId] = [];
      clientAddressMap[a.clientId].push(a);
    });
    let best: { id: string; name: string; distanceKm: number } | null = null;
    clients.forEach(c => {
      const addrs = clientAddressMap[c.id] || [];
      let minDist: number | null = null;
      addrs.forEach(a => {
        if (a.distance != null && (minDist == null || a.distance < minDist)) minDist = a.distance;
      });
      if (minDist == null && c.latitude && c.longitude) {
        minDist = getDistanceKm(loc.latitude, loc.longitude, c.latitude, c.longitude);
      }
      if (minDist != null && (best == null || minDist < best.distanceKm)) {
        best = { id: c.id, name: c.name, distanceKm: minDist };
      }
    });
    setTimerNearestClient(best && best.distanceKm < 2 ? best : null);
  };


  const stopLocationTracking = async () => {
    if (locationSubscription.current) {
      try {
        if (typeof locationSubscription.current.remove === 'function') {
          locationSubscription.current.remove();
        }
      } catch (e) {}
      locationSubscription.current = null;
    }

    if (Platform.OS !== 'web') {
      await BackgroundLocationService.stopBackgroundTracking();
    }
  };

  const updateLocationStatus = (location: Coordinates) => {
    const status = LocationService.determineLocationStatus(location, homeBase, clients, geofenceRadius);
    setLocationStatus((prev) => ({ ...prev, ...status }));
    if (status.type === 'job_site' && currentSession && currentSession.client_id !== (status as any).clientId) {
      setShowDepartureModal(true);
    }
  };

  const handleStopDetected = async (location: Coordinates, durationMinutes: number, speedMph: number) => {
    try {
      const stopKey = `${Math.round(location.latitude * 10000)}_${Math.round(location.longitude * 10000)}_${new Date().toISOString().split('T')[0]}`;
      if (stationaryStopShownRef.current.has(stopKey)) return;

      const nearbyScheduledJobs = scheduleEvents.filter(event => {
        if (!event.latitude || !event.longitude) return false;
        const distance = LocationService.getDistanceBetween(
          { latitude: event.latitude, longitude: event.longitude },
          location
        );
        return distance <= 150;
      });

      const stoppedSince = new Date(Date.now() - durationMinutes * 60000);

      if (nearbyScheduledJobs.length > 0) {
        const nearestJob = nearbyScheduledJobs[0];
        const distance = LocationService.getDistanceBetween(
          { latitude: nearestJob.latitude, longitude: nearestJob.longitude },
          location
        );

        const stop = await locationAudit.recordStop(
          location.latitude,
          location.longitude,
          durationMinutes,
          'near_job',
          speedMph,
          nearestJob.client?.id,
          nearestJob.id,
          nearestJob.location,
          activeEntry?.id
        );

        if (stop) {
          stationaryStopShownRef.current.add(stopKey);
          setStationaryStopData({
            latitude: location.latitude,
            longitude: location.longitude,
            stoppedSince,
            stoppedMinutes: durationMinutes,
            nearbyScheduledJob: {
              id: nearestJob.id,
              clientName: nearestJob.client?.name || nearestJob.title || '',
              clientId: nearestJob.client?.id,
              distance,
              scheduledStartTime: nearestJob.start_time,
            },
          });
        }
      } else {
        const nearbyUnscheduledClients = clients.filter(client => {
          if (!client.latitude || !client.longitude) return false;
          const d = LocationService.getDistanceBetween(
            { latitude: client.latitude, longitude: client.longitude },
            location
          );
          return d <= 150;
        });

        if (nearbyUnscheduledClients.length > 0) {
          const nearestClient = nearbyUnscheduledClients[0];
          const distance = LocationService.getDistanceBetween(
            { latitude: nearestClient.latitude!, longitude: nearestClient.longitude! },
            location
          );

          const stop = await locationAudit.recordStop(
            location.latitude,
            location.longitude,
            durationMinutes,
            'near_job',
            speedMph,
            nearestClient.id,
            undefined,
            undefined,
            activeEntry?.id
          );

          if (stop) {
            stationaryStopShownRef.current.add(stopKey);
            setStationaryStopData({
              latitude: location.latitude,
              longitude: location.longitude,
              stoppedSince,
              stoppedMinutes: durationMinutes,
              nearbyClient: {
                id: nearestClient.id,
                name: nearestClient.name,
                distance,
              },
            });
          }
        } else {
          const stop = await locationAudit.recordStop(
            location.latitude,
            location.longitude,
            durationMinutes,
            'unknown_location',
            speedMph,
            undefined,
            undefined,
            undefined,
            activeEntry?.id
          );

          if (stop) {
            stationaryStopShownRef.current.add(stopKey);
            setStationaryStopData({
              latitude: location.latitude,
              longitude: location.longitude,
              stoppedSince,
              stoppedMinutes: durationMinutes,
            });
          }
        }
      }
    } catch (error) {
      console.error('Error handling stop detection:', error);
    }
  };

  const trackLocationChange = async (location: Coordinates) => {
    try {
      const now = Date.now();
      const last = lastLocationRef.current;
      let speed = (location as any).speed ?? null;

      if (!speed && last && last._ts) {
        const distMeters = LocationService.getDistanceBetween(last, location);
        const dt = (now - last._ts) / 1000;
        speed = dt > 0 ? distMeters / dt : 0;
      }

      (location as any)._ts = now;
      lastLocationRef.current = location;

      const speedMph = speed !== null ? speed * 2.23694 : 0;

      const { isStopped, durationMinutes } = locationAudit.detectStop(
        location.latitude,
        location.longitude,
        speedMph
      );

      if (speed !== null && speed > TRAVEL_SPEED_MPS) {
        stationaryStartRef.current = null;
        setLocationStatus((s) => ({ ...s, type: 'traveling', speed }));
        setCurrentLocationContext('traveling');

        if (!travelSessionIdRef.current && activeEntry?.id && user?.id) {
          travelStartLocationRef.current = location;
          try {
            const { data: travelSession } = await supabase
              .from('productivity_sessions')
              .insert({
                user_id: user.id,
                time_entry_id: activeEntry.id,
                session_type: 'traveling',
                start_time: new Date().toISOString(),
                entry_latitude: location.latitude,
                entry_longitude: location.longitude,
              })
              .select('id')
              .single();
            if (travelSession) travelSessionIdRef.current = travelSession.id;
          } catch {}
        }
      } else {
        if (travelSessionIdRef.current) {
          try {
            await supabase
              .from('productivity_sessions')
              .update({
                end_time: new Date().toISOString(),
                exit_latitude: location.latitude,
                exit_longitude: location.longitude,
              })
              .eq('id', travelSessionIdRef.current);
          } catch {}
          travelSessionIdRef.current = null;
          travelStartLocationRef.current = null;
        }
        if (!stationaryStartRef.current) stationaryStartRef.current = now;
        const stoppedMs = now - (stationaryStartRef.current || now);
        const stoppedMin = Math.floor(stoppedMs / 60000);

        if (isStopped && stoppedMin >= STOPPED_THRESHOLD_MIN) {
          setLocationStatus((s) => ({ ...s, type: 'stopped', stoppedMinutes: stoppedMin }));

          await handleStopDetected(location, durationMinutes, speedMph);
        } else if (stoppedMin >= STOPPED_THRESHOLD_MIN) {
          setLocationStatus((s) => ({ ...s, type: 'stopped', stoppedMinutes: stoppedMin }));
        } else {
          setLocationStatus((s) => ({ ...s, type: s?.type === 'job_site' ? 'job_site' : 'idle', stoppedMinutes: stoppedMin }));
        }
      }

      await supabase.from('location_tracking').insert({
        user_id: user?.id,
        latitude: location.latitude,
        longitude: location.longitude,
        speed: speed ?? null,
        status: (locationStatus && (locationStatus as any).type) || 'unknown',
        timestamp: new Date().toISOString(),
      });

      if (user?.id && currentOrganization?.id) {
        upsertLiveLocation({
          userId: user.id,
          organizationId: currentOrganization.id,
          latitude: location.latitude,
          longitude: location.longitude,
          speed: speed ?? 0,
          status: (locationStatus && (locationStatus as any).type) || 'unknown',
          timeEntryId: activeEntry?.id ?? null,
          clientName: (locationStatus as any)?.clientName ?? null,
        }).catch(() => {});
      }
    } catch (error) {
      console.error('Error tracking location:', error);
    }
  };

  const fetchWeekStartDay = async () => {
    if (!user?.id) return;
    try {
      const { data: orgData } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!orgData?.organization_id) return;
      const { data } = await supabase
        .from('business_settings')
        .select('week_start_day')
        .eq('organization_id', orgData.organization_id)
        .maybeSingle();
      if (data && data.week_start_day != null) {
        setWeekStartDay(data.week_start_day);
      }
    } catch (_) {}
  };

  const fetchEntries = async () => {
    try {
      setLoading(true);
      let query = supabase.from('time_entries').select('*').order('clock_in', { ascending: false });
      if (!teamView) {
        if (viewingUserId && isAdminOrOwner && viewingUserId !== user?.id) {
          // Fetch both current user (for activeEntry/clock-in) and viewed member
          query = query.in('user_id', [user?.id, viewingUserId].filter(Boolean) as string[]);
        } else {
          query = query.eq('user_id', user?.id);
        }
      }
      const { data, error } = await query;
      if (error) throw error;

      // attach profiles and related data (photos, breaks, schedule) if available
      const entriesWithProfiles = (data || []).map((entry: any) => {
        const profile = profiles.find((p) => p.id === entry.user_id);
        return {
          ...entry,
          user_name: profile?.display_name || profile?.email?.split('@')[0] || 'Unknown',
          user_email: profile?.email || '',
        } as TimeEntry;
      });

      // optionally fetch photos and breaks for entries in batch
      const entryIds = entriesWithProfiles.map((e) => e.id);
      if (entryIds.length > 0) {
        const { data: photos } = await supabase.from('client_photos').select('*').in('time_entry_id', entryIds);
        const { data: breaks } = await supabase.from('time_entry_breaks').select('*').in('time_entry_id', entryIds);
        // attach
        entriesWithProfiles.forEach((e) => {
          e.photos = (photos || []).filter((p: any) => p.time_entry_id === e.id).map((p: any) => ({ id: p.id, photo_url: p.photo_url }));
          e.breaks = (breaks || []).filter((b: any) => b.time_entry_id === e.id).map((b: any) => ({ id: b.id, started_at: b.started_at, ended_at: b.ended_at, notes: b.notes }));
        });
      }

      setEntries(entriesWithProfiles);
      const active = entriesWithProfiles.find((entry) => !entry.clock_out && entry.user_id === user?.id);
      setActiveEntry(active || null);
    } catch (error: any) {
      showToast({ message: error?.message || 'Failed to load time entries', type: 'error', duration: 5000 });
    } finally {
      setLoading(false);
    }
  };

  const fetchBreakPolicies = async () => {
    if (!currentOrganization?.id) return;
    try {
      const { data } = await supabase
        .from('break_policies')
        .select('id, name, duration_minutes, notify_on_expiry, color')
        .eq('organization_id', currentOrganization.id)
        .order('sort_order', { ascending: true });
      setBreakPolicies(data || []);
    } catch (err) {
      console.error('fetchBreakPolicies error:', err);
    }
  };

  const handleClockIn = async () => {
    HapticPatterns.clockIn();
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const hasPermission = await LocationService.requestPermissions();
      if (!hasPermission) {
        showToast({ message: 'Location permission denied', type: 'error', duration: 4000 });
        return;
      }

      const location = await LocationService.getCurrentLocation();
      if (location) {
        setCurrentLocation(location);
        updateLocationStatus(location);
        computeTimerNearestClient(location);
      }

      const clockInClientId =
        selectedTimerClientId ||
        (locationStatus.type === 'job_site' ? (locationStatus as any).clientId : null) ||
        null;
      const clockInPayload: any = {
        user_id: userData.user.id,
        clock_in: new Date().toISOString(),
        is_clocked_in: true,
        location_tracking_enabled: true,
      };
      if (clockInClientId) clockInPayload.client_id = clockInClientId;
      if (selectedTimerAddressId) clockInPayload.client_address_id = selectedTimerAddressId;
      const { data: newEntry, error } = await supabase
        .from('time_entries')
        .insert(clockInPayload)
        .select()
        .single();
      if (error) throw error;

      setActiveEntry(newEntry);

      if (Platform.OS !== 'web') {
        const started = await BackgroundLocationService.startBackgroundTracking(
          userData.user.id,
          newEntry.id,
          homeBase,
          clients,
          currentOrganization?.id,
          geofenceRadius,
          scheduleEvents
            .filter(e => e.latitude && e.longitude)
            .map(e => ({
              id: e.id,
              clientName: e.client?.name || e.title || '',
              latitude: Number(e.latitude),
              longitude: Number(e.longitude),
              startTime: e.start_time,
              clientId: e.client?.id,
              clientAddressId: e.client_address_id,
            }))
        );

        if (!started) {
          showToast({
            message: 'Background tracking unavailable, using foreground only',
            type: 'warning',
            duration: 3000,
          });
        }
      }

      const subscription = await LocationService.startLocationTracking(
        (newLocation) => {
          setCurrentLocation(newLocation);
          updateLocationStatus(newLocation);
          trackLocationChange(newLocation);
          computeTimerNearestClient(newLocation);
        },
        () => {
          setShowAutoClockOutPrompt(true);
        },
        homeBase,
        clients,
        30000
      );
      locationSubscription.current = subscription;

      if (location && locationStatus.type === 'job_site' && (locationStatus as any).clientId) {
        const detectedClientId = (locationStatus as any).clientId;
        await supabase.from('productivity_sessions').insert({
          user_id: userData.user.id,
          time_entry_id: newEntry.id,
          client_id: detectedClientId,
          session_type: 'job_site',
          start_time: new Date().toISOString(),
          entry_latitude: location.latitude,
          entry_longitude: location.longitude,
        });
        if (!newEntry.client_id && detectedClientId) {
          await supabase
            .from('time_entries')
            .update({ client_id: detectedClientId })
            .eq('id', newEntry.id);
        }
        await fetchCurrentSession();
      }

      showToast({ message: 'Clocked in - Location tracking started', type: 'success', duration: 2000 });
      await fetchEntries();

      if (Platform.OS !== 'web') {
        const workDate = new Date().toISOString().split('T')[0];
        await PushNotificationService.triggerEquipmentChecklistPrompt(workDate);
      } else {
        setTimeout(() => setShowEquipmentPrompt(true), 800);
      }
    } catch (error: any) {
      showToast({ message: error?.message || 'Failed to clock in', type: 'error', duration: 4000 });
    }
  };

  const handleClockOut = async (entry?: TimeEntry, override: boolean = false) => {
    HapticPatterns.clockOut();
    const targetEntry = override ? entry : activeEntry;
    if (!targetEntry) return;
    const canOverride = isAdminOrManager;
    if (!override && currentSession) {
      setShowDepartureModal(true);
      return;
    }
    if (override && !canOverride) {
      showToast({ message: "You don't have permission to clock out other users", type: 'error', duration: 4000 });
      return;
    }
    await finalizeClockOutInternal(targetEntry, override);
  };

  const finalizeClockOutInternal = async (
    targetEntry: TimeEntry,
    override = false,
    departureReason?: string,
    notes?: string
  ) => {
    if (!targetEntry) return;
    try {
      stopLocationTracking();
      deactivateLiveLocation(targetEntry.user_id).catch(() => {});
      stationaryStopShownRef.current.clear();
      setStationaryStopData(null);

      const updates: any = {
        clock_out: new Date().toISOString(),
        is_clocked_in: false,
        location_tracking_enabled: false,
        notes: notes ?? targetEntry.notes,
      };

      // compute summary flags from recent location_tracking rows (optional)
      try {
        const { data: locRows } = await supabase
          .from('location_tracking')
          .select('speed, timestamp')
          .eq('user_id', targetEntry.user_id)
          .gte('timestamp', targetEntry.clock_in)
          .lte('timestamp', new Date().toISOString());
        if (locRows && locRows.length > 0) {
          const travelPoints = locRows.filter((r: any) => r.speed && r.speed > TRAVEL_SPEED_MPS).length;
          const stoppedPoints = locRows.filter((r: any) => !r.speed || r.speed <= TRAVEL_SPEED_MPS).length;
          const stoppedMinutes = Math.round((stoppedPoints * 0.5)); // heuristic if sampling ~30s
          updates.travel_flag = travelPoints > 0;
          updates.stopped_minutes = stoppedMinutes;
        }
      } catch (e) {
        // non-fatal
      }

      const { data: updatedRows, error: timeError } = await supabase
        .from('time_entries')
        .update(updates)
        .eq('id', targetEntry.id)
        .eq('user_id', override ? targetEntry.user_id : user?.id)
        .select('id');

      if (timeError) throw timeError;
      if (!updatedRows || updatedRows.length === 0) {
        throw new Error('Clock-out failed: entry not found or permission denied');
      }

      await supabase
        .from('productivity_sessions')
        .update({
          end_time: new Date().toISOString(),
          departure_reason: departureReason ?? null,
          exit_latitude: currentLocation?.latitude ?? null,
          exit_longitude: currentLocation?.longitude ?? null,
        })
        .eq('time_entry_id', targetEntry.id);

      if (!override) {
        setCurrentSession(null);
        setLocationStatus({ type: 'unknown' });
      }

      showToast({ message: 'Clocked out', type: 'success', duration: 2000 });
      await fetchEntries();
    } catch (error: any) {
      showToast({ message: error?.message || 'Failed to clock out', type: 'error', duration: 4000 });
    }
  };

  const handleDepartureConfirm = (reason: string, notes?: string) => {
    setShowDepartureModal(false);
    if (activeEntry) finalizeClockOutInternal(activeEntry, false, reason, notes);
  };

  const handleQuickPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        showToast({ message: 'Camera permission required', type: 'error', duration: 3000 });
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, exif: true });
      if (!result.canceled && result.assets && result.assets[0]) {
        const photo = result.assets[0];
        const photoLocation = currentLocation;
        if (!photoLocation) {
          showToast({ message: 'Location not available', type: 'error', duration: 3000 });
          return;
        }
        const nearby = LocationService.findNearbyClients(photoLocation, clients, geofenceRadius);
        if (nearby.length === 0) {
          showToast({ message: 'No clients nearby', type: 'warning', duration: 3000 });
          return;
        }
        if (nearby.length === 1) {
          await savePhotoToClient(photo.uri, nearby[0].id, photoLocation, true, nearby[0].distance);
        } else {
          setPendingPhoto({ uri: photo.uri, location: photoLocation });
          setNearbyClients(nearby);
          setShowClientSelection(true);
        }
      }
    } catch (error: any) {
      showToast({ message: error?.message || 'Failed to capture photo', type: 'error', duration: 4000 });
    }
  };

  const handleClientSelect = async (clientId: string) => {
    if (pendingPhoto) {
      const client = nearbyClients.find((c) => c.id === clientId);
      await savePhotoToClient(pendingPhoto.uri, clientId, pendingPhoto.location, false, (client as any)?.distance);
      setPendingPhoto(null);
      setNearbyClients([]);
    }
    setShowClientSelection(false);
  };

  const handleStartWorkAtJob = async (scheduleId: string) => {
    try {
      const event = scheduleEvents.find(e => e.id === scheduleId);
      if (!event || !locationContextPrompt) return;

      if (!activeEntry) {
        await handleClockIn();
      }

      if (event.client?.id) {
        await supabase.from('productivity_sessions').insert({
          user_id: user?.id,
          time_entry_id: activeEntry?.id,
          client_id: event.client.id,
          session_type: 'job_site',
          start_time: new Date().toISOString(),
          entry_latitude: locationContextPrompt.latitude,
          entry_longitude: locationContextPrompt.longitude,
        });

        setCurrentLocationContext('on_site');
        setLocationStatus((s) => ({ ...s, type: 'job_site', clientName: event.client.name }));
      }

      const stopId = locationContextPrompt ?
        locationAudit.generateStopId(locationContextPrompt.latitude, locationContextPrompt.longitude, new Date()) :
        '';

      if (stopId) {
        const stops = await locationAudit.getRecentStops(1);
        const matchingStop = stops.find(s => s.stopId === stopId);
        if (matchingStop) {
          await locationAudit.updateStopResponse(matchingStop.id, 'start_work');
        }
      }

      showToast({ message: `Started work at ${event.client?.name || event.name}`, type: 'success', duration: 2000 });
      setLocationContextPrompt(null);
    } catch (error) {
      console.error('Error starting work:', error);
      showToast({ message: 'Failed to start work', type: 'error', duration: 3000 });
    }
  };

  const handleSetLocationContext = async (context: 'on_break' | 'getting_supplies' | 'stuck') => {
    try {
      const contextMap: Record<string, LocationContext> = {
        on_break: 'on_break',
        getting_supplies: 'getting_supplies',
        stuck: 'stuck',
      };

      setCurrentLocationContext(contextMap[context]);

      if (locationContextPrompt) {
        const stopId = locationAudit.generateStopId(
          locationContextPrompt.latitude,
          locationContextPrompt.longitude,
          new Date()
        );

        const stops = await locationAudit.getRecentStops(1);
        const matchingStop = stops.find(s => s.stopId === stopId);
        if (matchingStop) {
          await locationAudit.updateStopResponse(matchingStop.id, context);
        }
      }

      showToast({ message: 'Context updated', type: 'success', duration: 2000 });
      setLocationContextPrompt(null);
    } catch (error) {
      console.error('Error setting context:', error);
      showToast({ message: 'Failed to update context', type: 'error', duration: 3000 });
    }
  };

  const handleAddJobSite = async (address: string, latitude: number, longitude: number) => {
    try {
      setLocationForNewClient({ latitude, longitude });
      setShowClientModal(true);
      setLocationContextPrompt(null);
    } catch (error) {
      console.error('Error adding job site:', error);
      showToast({ message: 'Failed to add job site', type: 'error', duration: 3000 });
    }
  };

  const handleStationaryJobTimer = async (backdateMinutes: number, clientId?: string, scheduleEventId?: string) => {
    try {
      if (!stationaryStopData) return;

      const actualStart = new Date(stationaryStopData.stoppedSince.getTime() - backdateMinutes * 60000);

      if (!activeEntry) {
        await handleClockIn();
      }

      if (clientId) {
        await supabase.from('productivity_sessions').insert({
          user_id: user?.id,
          time_entry_id: activeEntry?.id,
          client_id: clientId,
          session_type: 'job_site',
          start_time: actualStart.toISOString(),
          entry_latitude: stationaryStopData.latitude,
          entry_longitude: stationaryStopData.longitude,
        });
        const clientName = stationaryStopData.nearbyScheduledJob?.clientName || stationaryStopData.nearbyClient?.name || '';
        setCurrentLocationContext('on_site');
        setLocationStatus(s => ({ ...s, type: 'job_site', clientName }));
      }

      const nearestAddr = allTimerAddresses.find(a =>
        clientId && a.clientId === clientId &&
        a.latitude != null && a.longitude != null &&
        LocationService.getDistanceBetween(
          { latitude: a.latitude!, longitude: a.longitude! },
          { latitude: stationaryStopData.latitude, longitude: stationaryStopData.longitude }
        ) <= 200
      );

      setJobTimerActualStart(actualStart);
      setJobTimerStartedAt(actualStart.getTime());
      setJobTimerElapsed(Date.now() - actualStart.getTime());
      setJobTimerRunning(true);
      if (clientId) {
        setSelectedTimerClientId(clientId);
        const clientAddrs = allTimerAddresses.filter(a => a.clientId === clientId);
        setTimerClientAddresses(clientAddrs);
        if (nearestAddr) setSelectedTimerAddressId(nearestAddr.id);
      }

      if (scheduleEventId) {
        const event = scheduleEvents.find(e => e.id === scheduleEventId);
        if (event) {
          const stopId = locationAudit.generateStopId(
            stationaryStopData.latitude,
            stationaryStopData.longitude,
            new Date()
          );
          const stops = await locationAudit.getRecentStops(2);
          const matchingStop = stops.find(s => s.stopId === stopId);
          if (matchingStop) {
            await locationAudit.updateStopResponse(matchingStop.id, 'start_work');
          }
        }
      }

      const clientName = stationaryStopData.nearbyScheduledJob?.clientName || stationaryStopData.nearbyClient?.name || '';
      const backdateLabel = backdateMinutes > 0 ? ` (backdated ${backdateMinutes} min)` : '';
      showToast({ message: `Job timer started${clientName ? ` for ${clientName}` : ''}${backdateLabel}`, type: 'success', duration: 3000 });
      setStationaryStopData(null);
    } catch (error) {
      console.error('Error starting job timer from stationary stop:', error);
      showToast({ message: 'Failed to start job timer', type: 'error', duration: 3000 });
    }
  };

  const handleStationaryContext = async (context: 'on_break' | 'getting_supplies' | 'stuck_in_traffic') => {
    try {
      if (stationaryStopData) {
        const stopId = locationAudit.generateStopId(
          stationaryStopData.latitude,
          stationaryStopData.longitude,
          new Date()
        );
        const stops = await locationAudit.getRecentStops(2);
        const matchingStop = stops.find(s => s.stopId === stopId);
        if (matchingStop) {
          await locationAudit.updateStopResponse(matchingStop.id, context);
        }
      }
      const contextMap: Record<string, LocationContext> = {
        on_break: 'on_break',
        getting_supplies: 'getting_supplies',
        stuck_in_traffic: 'stuck',
      };
      setCurrentLocationContext(contextMap[context]);
      showToast({ message: 'Context updated', type: 'success', duration: 2000 });
      setStationaryStopData(null);
    } catch (error) {
      console.error('Error setting stationary context:', error);
      showToast({ message: 'Failed to update context', type: 'error', duration: 3000 });
    }
  };

  const savePhotoToClient = async (
    photoUri: string,
    clientId: string,
    location: Coordinates,
    autoAssociated: boolean,
    distance?: number
  ) => {
    try {
      const fileName = `${user?.id}/${clientId}/${Date.now()}.jpg`;
      const response = await fetch(photoUri);
      const blob = await response.blob();
      const { error: uploadError } = await supabase.storage.from('client-photos').upload(fileName, blob, { contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('client-photos').getPublicUrl(fileName);
      const { error: dbError } = await supabase.from('client_photos').insert({
        user_id: user?.id,
        client_id: clientId,
        photo_url: urlData.publicUrl,
        latitude: location.latitude,
        longitude: location.longitude,
        captured_at: new Date().toISOString(),
        productivity_session_id: currentSession?.id,
        auto_associated: autoAssociated,
        distance_from_client: distance,
      });
      if (dbError) throw dbError;
      showToast({ message: `Photo saved${autoAssociated ? ' (auto-assigned)' : ''}`, type: 'success', duration: 2000 });
    } catch (error: any) {
      showToast({ message: error?.message || 'Failed to save photo', type: 'error', duration: 4000 });
    }
  };

  const handleDeleteEntry = (id: string) => {
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;
    if (pendingDeleteRef.current) {
      clearTimeout(pendingDeleteRef.current.timeoutId);
      executeEntryDelete(pendingDeleteRef.current.entry);
    }
    setEntries((prev) => prev.filter((e) => e.id !== id));
    const timeoutId = setTimeout(() => {
      executeEntryDelete(entry);
      pendingDeleteRef.current = null;
    }, 5000);
    pendingDeleteRef.current = { entry, timeoutId };
    showToast({
      message: 'Time entry deleted',
      type: 'info',
      duration: 5000,
      action: {
        label: 'Undo',
        onPress: () => {
          if (pendingDeleteRef.current?.entry.id === id) {
            clearTimeout(pendingDeleteRef.current.timeoutId);
            pendingDeleteRef.current = null;
            setEntries((prev) => [entry, ...prev].sort((a, b) => new Date(b.clock_in).getTime() - new Date(a.clock_in).getTime()));
            showToast({ message: 'Time entry restored', type: 'success', duration: 2000 });
          }
        },
      },
    });
  };

  const executeEntryDelete = async (entry: TimeEntry) => {
    HapticPatterns.delete();
    try {
      const { error } = await supabase.from('time_entries').delete().eq('id', entry.id);
      if (error) throw error;
    } catch (error: any) {
      HapticPatterns.error();
      showToast({ message: error?.message || 'Failed to delete time entry', type: 'error', duration: 4000 });
      fetchEntries();
    }
  };

  const handleUpdateNotes = async (id: string, notes: string) => {
    try {
      const { error } = await supabase.from('time_entries').update({ notes }).eq('id', id);
      if (error) throw error;
      setEditingNotes(null);
      setNotesText('');
      showToast({ message: 'Notes saved', type: 'success', duration: 2000 });
      await fetchEntries();
    } catch (error: any) {
      showToast({ message: error?.message || 'Failed to update notes', type: 'error', duration: 4000 });
    }
  };

  const handleAutoClockOut = async () => {
    try {
      if (clockOutPromptId) {
        await supabase
          .from('clock_out_prompts')
          .update({
            responded_at: new Date().toISOString(),
            action_taken: 'clocked_out',
          })
          .eq('id', clockOutPromptId);
      }

      await handleClockOut();
      setShowAutoClockOutPrompt(false);
      setClockOutPromptId(null);
    } catch (error: any) {
      showToast({
        message: error?.message || 'Failed to clock out',
        type: 'error',
        duration: 4000,
      });
    }
  };

  const handleDismissAutoClockOut = async () => {
    try {
      if (clockOutPromptId) {
        await supabase
          .from('clock_out_prompts')
          .update({
            responded_at: new Date().toISOString(),
            action_taken: 'dismissed',
          })
          .eq('id', clockOutPromptId);
      }

      setShowAutoClockOutPrompt(false);
      setClockOutPromptId(null);
    } catch (error: any) {
      console.error('Error dismissing prompt:', error);
    }
  };

  const handleCreateClientFromLocation = (latitude: number, longitude: number) => {
    setLocationForNewClient({ latitude, longitude });
    setShowClientModal(true);
  };

  const handleCreateScheduledJobFromLocation = (latitude: number, longitude: number) => {
    setLocationForSchedule({ latitude, longitude });
    setShowScheduleModal(true);
  };

  const handleClientModalSave = async () => {
    setShowClientModal(false);
    setLocationForNewClient(null);
    setClientPrefillName('');
    setClientPrefillPhone('');
    await Promise.all([fetchClients(), fetchAllTimerAddresses()]);
  };

  const handleScheduleModalSave = async () => {
    setShowScheduleModal(false);
    setLocationForSchedule(null);
  };

  const parseTimeToEdit = (dateString: string): TimeEdit => {
    const date = new Date(dateString);
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const period: 'AM' | 'PM' = hours >= 12 ? 'PM' : 'AM';
    if (hours === 0) hours = 12;
    else if (hours > 12) hours -= 12;
    return { hour: hours.toString(), minute: minutes.toString().padStart(2, '0'), period };
  };

  const timeEditToDate = (timeEdit: TimeEdit, baseDate: string): Date => {
    const date = new Date(baseDate);
    let hours = parseInt(timeEdit.hour, 10);
    if (timeEdit.period === 'PM' && hours !== 12) hours += 12;
    if (timeEdit.period === 'AM' && hours === 12) hours = 0;
    date.setHours(hours, parseInt(timeEdit.minute, 10), 0, 0);
    return date;
  };

  const startEditingTime = (entry: TimeEntry) => {
    setEditingTime(entry.id);
    setEditClockIn(parseTimeToEdit(entry.clock_in));
    setEditClockOut(entry.clock_out ? parseTimeToEdit(entry.clock_out) : null);
    setEditDate(entry.clock_in);
    setEditingNotes(null);
  };

  const handleUpdateTime = async (id: string) => {
    try {
      const newClockIn = timeEditToDate(editClockIn, editDate).toISOString();
      const newClockOut = editClockOut ? timeEditToDate(editClockOut, editDate).toISOString() : null;
      if (newClockOut && new Date(newClockOut) <= new Date(newClockIn)) {
        showToast({ message: 'Clock out time must be after clock in time', type: 'error', duration: 4000 });
        return;
      }
      const { error } = await supabase.from('time_entries').update({ clock_in: newClockIn, clock_out: newClockOut }).eq('id', id);
      if (error) throw error;
      setEditingTime(null);
      showToast({ message: 'Time entry updated', type: 'success', duration: 2000 });
      await fetchEntries();
    } catch (error: any) {
      showToast({ message: error?.message || 'Failed to update time entry', type: 'error', duration: 4000 });
    }
  };

  const formatDuration = (start: string, end: string | null) => {
    const startTime = new Date(start);
    const endTime = end ? new Date(end) : currentTime;
    const diff = endTime.getTime() - startTime.getTime();
    const hours = diff / (1000 * 60 * 60);
    return `${hours.toFixed(2)} hrs`;
  };

  const formatTime = (dateString: string) => new Date(dateString).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const calculateTotalHours = (entries: TimeEntry[]) => {
    let totalMs = 0;
    entries.forEach((entry) => {
      if (entry.clock_out) {
        const start = new Date(entry.clock_in).getTime();
        const end = new Date(entry.clock_out).getTime();
        totalMs += end - start;
      }
    });
    const hours = Math.floor(totalMs / (1000 * 60 * 60));
    const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));
    return { hours, minutes };
  };

  const formatDecimalHours = (hours: number, minutes: number) => (hours + minutes / 60).toFixed(2);

  const getThisWeekRange = (): { weekStart: Date; weekEnd: Date } => {
    const now = new Date();
    const day = now.getDay();
    const diff = (day - weekStartDay + 7) % 7;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - diff);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    return { weekStart, weekEnd };
  };

  const getTeamDateRange = (): { start: Date; end: Date } => {
    const { weekStart, weekEnd } = getThisWeekRange();
    if (teamDatePreset === 'this_week') return { start: weekStart, end: weekEnd };
    if (teamDatePreset === 'last_week') {
      const s = new Date(weekStart);
      s.setDate(s.getDate() - 7);
      const e = new Date(weekEnd);
      e.setDate(e.getDate() - 7);
      return { start: s, end: e };
    }
    if (teamDatePreset === 'this_month') {
      const now = new Date();
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      s.setHours(0, 0, 0, 0);
      const e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      e.setHours(23, 59, 59, 999);
      return { start: s, end: e };
    }
    return { start: startDate || weekStart, end: endDate || weekEnd };
  };

  const effectiveUserId = viewingUserId || user?.id;
  const viewingProfile = viewingUserId ? profiles.find(p => p.id === viewingUserId) : null;
  const viewingName = viewingProfile?.display_name || viewingProfile?.email?.split('@')[0] || 'Unknown';

  const filteredEntries = entries.filter((entry) => {
    if (mainTab === 'my_hours') {
      if (entry.user_id !== effectiveUserId) return false;
    } else if (selectedEmployeeId && isAdminOrManager) {
      if (entry.user_id !== selectedEmployeeId) return false;
    }
    if (weekFilter) {
      const { weekStart, weekEnd } = getThisWeekRange();
      const entryDate = new Date(entry.clock_in);
      if (entryDate < weekStart || entryDate > weekEnd) return false;
    } else if (startDate || endDate) {
      const entryDate = new Date(entry.clock_in);
      if (startDate && entryDate < startDate) return false;
      if (endDate && entryDate > endDate) return false;
    }
    return true;
  });

  const analyticsTotalMs = filteredEntries.reduce((sum, e) => {
    const start = new Date(e.clock_in).getTime();
    const end = e.clock_out ? new Date(e.clock_out).getTime() : Date.now();
    return sum + (end - start);
  }, 0);
  const analyticsHours = analyticsTotalMs / 3600000;
  const analyticsDaysWorked = new Set(filteredEntries.map(e => new Date(e.clock_in).toLocaleDateString('en-CA'))).size;
  const analyticsAvgPerDay = analyticsDaysWorked > 0 ? analyticsHours / analyticsDaysWorked : 0;

  // Compute per-week overtime for a set of entries (respects payroll week boundaries)
  const calcOvertimeForEntries = (ents: TimeEntry[]): number => {
    // Group by payroll week, sum hours per user per week, OT = max(0, weekHours - 40)
    const weekBuckets: { [weekKey: string]: number } = {};
    ents.filter(e => e.clock_out).forEach(e => {
      const d = new Date(e.clock_in);
      const diff = (d.getDay() - weekStartDay + 7) % 7;
      const ws = new Date(d);
      ws.setDate(d.getDate() - diff);
      ws.setHours(0, 0, 0, 0);
      const key = ws.toISOString();
      const hrs = (new Date(e.clock_out!).getTime() - new Date(e.clock_in).getTime()) / 3600000;
      weekBuckets[key] = (weekBuckets[key] || 0) + hrs;
    });
    return Object.values(weekBuckets).reduce((s, h) => s + Math.max(0, h - 40), 0);
  };

  const { weekStart: myWeekStart, weekEnd: myWeekEnd } = getThisWeekRange();
  const myWeekEntries = entries.filter(e => {
    if (e.user_id !== effectiveUserId) return false;
    const d = new Date(e.clock_in);
    return d >= myWeekStart && d <= myWeekEnd;
  });
  const myWeekHours = myWeekEntries.filter(e => e.clock_out).reduce((s, e) => s + (new Date(e.clock_out!).getTime() - new Date(e.clock_in).getTime()) / 3600000, 0);
  const myWeekOvertime = Math.max(0, myWeekHours - 40);
  const myWeekEntryCount = myWeekEntries.length;
  const myWeekDaysWorked = new Set(myWeekEntries.filter(e => e.clock_out).map(e => new Date(e.clock_in).toLocaleDateString('en-CA'))).size;
  const myWeekAvg = myWeekDaysWorked > 0 ? myWeekHours / myWeekDaysWorked : 0;

  const teamRange = getTeamDateRange();
  const teamEntries = entries.filter(e => {
    const d = new Date(e.clock_in);
    return d >= teamRange.start && d <= teamRange.end;
  });
  const teamTotalHours = teamEntries.filter(e => e.clock_out).reduce((s, e) => s + (new Date(e.clock_out!).getTime() - new Date(e.clock_in).getTime()) / 3600000, 0);
  const teamActiveEmployees = new Set(teamEntries.map(e => e.user_id)).size;
  const teamOvertimeHours = (() => {
    // Per user, per payroll week — OT = max(0, weekHours - 40)
    const byUserWeek: { [key: string]: number } = {};
    teamEntries.filter(e => e.clock_out).forEach(e => {
      const d = new Date(e.clock_in);
      const diff = (d.getDay() - weekStartDay + 7) % 7;
      const ws = new Date(d);
      ws.setDate(d.getDate() - diff);
      ws.setHours(0, 0, 0, 0);
      const key = `${e.user_id}::${ws.toISOString()}`;
      const hrs = (new Date(e.clock_out!).getTime() - new Date(e.clock_in).getTime()) / 3600000;
      byUserWeek[key] = (byUserWeek[key] || 0) + hrs;
    });
    return Object.values(byUserWeek).reduce((s, h) => s + Math.max(0, h - 40), 0);
  })();

  const teamEmployeeData = (() => {
    const byUser: { [uid: string]: { name: string; email: string; hours: number; entries: number; isActive: boolean } } = {};
    teamEntries.forEach(e => {
      if (!byUser[e.user_id]) {
        const prof = profiles.find(p => p.id === e.user_id);
        byUser[e.user_id] = {
          name: e.user_id === user?.id ? 'You' : (e.user_name || prof?.display_name || prof?.email?.split('@')[0] || 'Unknown'),
          email: e.user_email || prof?.email || '',
          hours: 0,
          entries: 0,
          isActive: false,
        };
      }
      if (e.clock_out) {
        byUser[e.user_id].hours += (new Date(e.clock_out).getTime() - new Date(e.clock_in).getTime()) / 3600000;
      } else {
        byUser[e.user_id].isActive = true;
      }
      byUser[e.user_id].entries += 1;
    });
    return Object.entries(byUser).sort(([, a], [, b]) => b.hours - a.hours);
  })();

  const getWeeklyBreakdownByEmployee = () => {
    if (!isAdminOrManager || profiles.length === 0) return [];
    const weeks: { weekStart: Date; weekEnd: Date; label: string; employees: { [userId: string]: { name: string; hours: number; entries: number } } }[] = [];
    const allDates = filteredEntries.filter(e => e.clock_out).map(e => new Date(e.clock_in));
    if (allDates.length === 0) return [];
    const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
    let ws = new Date(minDate);
    const diff = (ws.getDay() - weekStartDay + 7) % 7;
    ws.setDate(ws.getDate() - diff);
    ws.setHours(0, 0, 0, 0);
    while (ws <= maxDate) {
      const we = new Date(ws);
      we.setDate(we.getDate() + 6);
      we.setHours(23, 59, 59, 999);
      const label = `${ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${we.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      const employees: { [userId: string]: { name: string; hours: number; entries: number } } = {};
      filteredEntries.forEach(entry => {
        if (!entry.clock_out) return;
        const d = new Date(entry.clock_in);
        if (d >= ws && d <= we) {
          if (!employees[entry.user_id]) {
            const profile = profiles.find(p => p.id === entry.user_id);
            employees[entry.user_id] = {
              name: entry.user_id === user?.id ? 'You' : (profile?.display_name || entry.user_name || 'Unknown'),
              hours: 0,
              entries: 0,
            };
          }
          employees[entry.user_id].hours += (new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / 3600000;
          employees[entry.user_id].entries += 1;
        }
      });
      if (Object.keys(employees).length > 0) {
        weeks.push({ weekStart: new Date(ws), weekEnd: we, label, employees });
      }
      ws = new Date(we);
      ws.setDate(ws.getDate() + 1);
      ws.setHours(0, 0, 0, 0);
    }
    return weeks.reverse();
  };

  const generateWeeklyReports = (): PeriodReport[] => {
    const weeklyData: { [key: string]: { entries: TimeEntry[]; startDate: Date } } = {};
    filteredEntries.forEach((entry) => {
      if (!entry.clock_out) return;
      const date = new Date(entry.clock_in);
      const dayDiff = (date.getDay() - weekStartDay + 7) % 7;
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - dayDiff);
      weekStart.setHours(0, 0, 0, 0);
      const weekKey = weekStart.toISOString().split('T')[0];
      if (!weeklyData[weekKey]) weeklyData[weekKey] = { entries: [], startDate: weekStart };
      weeklyData[weekKey].entries.push(entry);
    });
    return Object.entries(weeklyData)
      .map(([period, data]) => {
        const { hours, minutes } = calculateTotalHours(data.entries);
        const weekEnd = new Date(data.startDate);
        weekEnd.setDate(weekEnd.getDate() + 6);
        return {
          period,
          totalHours: hours,
          totalMinutes: minutes,
          entries: data.entries.length,
          displayDate: `${data.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        };
      })
      .sort((a, b) => b.period.localeCompare(a.period));
  };

  const generateMonthlyReports = (): PeriodReport[] => {
    const monthlyData: { [key: string]: TimeEntry[] } = {};
    filteredEntries.forEach((entry) => {
      if (!entry.clock_out) return;
      const date = new Date(entry.clock_in);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyData[monthKey]) monthlyData[monthKey] = [];
      monthlyData[monthKey].push(entry);
    });
    return Object.entries(monthlyData)
      .map(([period, entries]) => {
        const { hours, minutes } = calculateTotalHours(entries);
        const [year, month] = period.split('-');
        const date = new Date(Number(year), Number(month) - 1);
        return {
          period,
          totalHours: hours,
          totalMinutes: minutes,
          entries: entries.length,
          displayDate: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        };
      })
      .sort((a, b) => b.period.localeCompare(a.period));
  };

  const toggleReportExpansion = (period: string) => {
    setExpandedReports((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(period)) newSet.delete(period);
      else newSet.add(period);
      return newSet;
    });
  };

  const getEntriesForPeriod = (period: string, mode: 'weekly' | 'monthly'): TimeEntry[] => {
    if (mode === 'weekly') {
      const weekStart = new Date(period);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      return entries.filter((entry) => {
        if (!entry.clock_out) return false;
        const entryDate = new Date(entry.clock_in);
        return entryDate >= weekStart && entryDate < weekEnd;
      });
    } else {
      const [year, month] = period.split('-');
      return entries.filter((entry) => {
        if (!entry.clock_out) return false;
        const entryDate = new Date(entry.clock_in);
        return entryDate.getFullYear() === Number(year) && entryDate.getMonth() === Number(month) - 1;
      });
    }
  };

  const toggleWeekExpansion = (weekKey: string) => {
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(weekKey)) next.delete(weekKey);
      else next.add(weekKey);
      return next;
    });
  };

  interface EntriesWeekSection {
    weekKey: string;
    displayDate: string;
    totalHours: number;
    totalMinutes: number;
    dayGroups: { dateKey: string; dayEntries: TimeEntry[] }[];
  }

  const generateEntriesWeekSections = (sourceEntries: TimeEntry[]): EntriesWeekSection[] => {
    const weekData: { [weekKey: string]: { startDate: Date; days: { [dateKey: string]: TimeEntry[] } } } = {};
    sourceEntries.forEach((entry) => {
      const date = new Date(entry.clock_in);
      const dayDiff = (date.getDay() - weekStartDay + 7) % 7;
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - dayDiff);
      weekStart.setHours(0, 0, 0, 0);
      const weekKey = weekStart.toISOString().split('T')[0];
      if (!weekData[weekKey]) weekData[weekKey] = { startDate: weekStart, days: {} };
      const dateKey = date.toLocaleDateString('en-CA');
      if (!weekData[weekKey].days[dateKey]) weekData[weekKey].days[dateKey] = [];
      weekData[weekKey].days[dateKey].push(entry);
    });
    return Object.entries(weekData)
      .map(([weekKey, data]) => {
        const allEntries = Object.values(data.days).flat();
        const { hours, minutes } = calculateTotalHours(allEntries);
        const weekEnd = new Date(data.startDate);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const dayGroups = Object.entries(data.days)
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([dateKey, dayEntries]) => ({ dateKey, dayEntries }));
        return {
          weekKey,
          displayDate: `${data.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
          totalHours: hours,
          totalMinutes: minutes,
          dayGroups,
        };
      })
      .sort((a, b) => b.weekKey.localeCompare(a.weekKey));
  };

  const renderTimeInput = (value: TimeEdit, onChange: (val: TimeEdit) => void, label: string) => (
    <View style={dynamicStyles.timeEditRow}>
      <Text style={dynamicStyles.timeEditLabel}>{label}</Text>
      <View style={dynamicStyles.timeInputRow}>
        <TextInput
          style={dynamicStyles.timeInput}
          value={value.hour}
          onChangeText={(text) => {
            const num = text.replace(/[^0-9]/g, '');
            if (num === '' || (parseInt(num, 10) >= 1 && parseInt(num, 10) <= 12)) onChange({ ...value, hour: num });
          }}
          keyboardType="number-pad"
          maxLength={2}
          selectTextOnFocus
        />
        <Text style={dynamicStyles.timeColon}>:</Text>
        <TextInput
          style={dynamicStyles.timeInput}
          value={value.minute}
          onChangeText={(text) => {
            const num = text.replace(/[^0-9]/g, '').slice(0, 2);
            if (num === '' || parseInt(num, 10) <= 59) onChange({ ...value, minute: num });
          }}
          onBlur={() => {
            if (value.minute.length === 1) onChange({ ...value, minute: value.minute.padStart(2, '0') });
          }}
          keyboardType="number-pad"
          maxLength={2}
          selectTextOnFocus
        />
        <View style={dynamicStyles.periodToggle}>
          <TouchableOpacity style={[dynamicStyles.periodButton, value.period === 'AM' && dynamicStyles.periodButtonActive]} onPress={() => onChange({ ...value, period: 'AM' })}>
            <Text style={[dynamicStyles.periodButtonText, value.period === 'AM' && dynamicStyles.periodButtonTextActive]}>AM</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[dynamicStyles.periodButton, value.period === 'PM' && dynamicStyles.periodButtonActive]} onPress={() => onChange({ ...value, period: 'PM' })}>
            <Text style={[dynamicStyles.periodButtonText, value.period === 'PM' && dynamicStyles.periodButtonTextActive]}>PM</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const getEntryStatuses = (entry: TimeEntry) => {
    const statuses = [];

    if (entry.location_tracking_enabled) {
      if (entry.travel_flag) {
        statuses.push({ type: 'traveling', label: 'Traveling', icon: Truck });
      }
    }

    if (entry.breaks && entry.breaks.length > 0) {
      const activeBreak = entry.breaks.find((b: any) => !b.ended_at);
      if (activeBreak) {
        statuses.push({ type: 'break', label: 'On Break', icon: Coffee });
      }
    }

    if (entry.stopped_minutes && entry.stopped_minutes > STOPPED_THRESHOLD_MIN) {
      statuses.push({ type: 'stopped', label: `Stopped ${entry.stopped_minutes}m`, icon: MapPin });
    }

    return statuses;
  };

  const renderBreakSummary = (entry: TimeEntry) => {
    if (!entry.breaks || entry.breaks.length === 0) return null;

    const completedBreaks = entry.breaks.filter((b: any) => b.ended_at);
    const activeBreak = entry.breaks.find((b: any) => !b.ended_at);

    let totalBreakMs = 0;
    completedBreaks.forEach((b: any) => {
      const start = new Date(b.started_at).getTime();
      const end = new Date(b.ended_at).getTime();
      totalBreakMs += end - start;
    });
    const totalBreakMin = Math.round(totalBreakMs / 60000);

    return (
      <View style={[dynamicStyles.statusBadge, dynamicStyles.statusBadgeBreak, { marginRight: 0 }]}>
        <Coffee size={13} color="#db2777" />
        <Text style={[dynamicStyles.statusBadgeText, dynamicStyles.statusBadgeTextBreak]}>
          {activeBreak ? 'On Break' : `${entry.breaks.length} break${entry.breaks.length > 1 ? 's' : ''}${totalBreakMin > 0 ? ` · ${totalBreakMin}m` : ''}`}
        </Text>
      </View>
    );
  };

  const renderEntry = (entry: TimeEntry) => {
    const isActive = entry.id === activeEntry?.id && entry.user_id === user?.id;
    const isEditingThisEntry = editingNotes === entry.id;
    const isEditingThisTime = editingTime === entry.id;
    const isOwnEntry = entry.user_id === user?.id;

    const cardContent = (
      <View style={dynamicStyles.entryCardInner}>
        <View style={dynamicStyles.entryHeader}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={dynamicStyles.entryDate}>{formatDate(entry.clock_in)}</Text>
              {isActive && (
                <View style={[dynamicStyles.statusBadge, { backgroundColor: colors.primary, borderColor: colors.primary, paddingVertical: 3, paddingHorizontal: 8, gap: 5 }]}>
                  <PulsingIndicator color="#ffffff" size={8} active={true} />
                  <Text style={[dynamicStyles.statusBadgeText, { color: '#ffffff', fontSize: 10 }]}>ACTIVE</Text>
                </View>
              )}
            </View>
            {teamView && (
              <View style={[dynamicStyles.userBadge, isOwnEntry && dynamicStyles.userBadgeOwn, { marginTop: 4, alignSelf: 'flex-start' }]}>
                <Text style={[dynamicStyles.userBadgeText, isOwnEntry && dynamicStyles.userBadgeTextOwn]}>
                  {isOwnEntry ? 'You' : entry.user_name}
                </Text>
              </View>
            )}
          </View>

          {!isActive && isAdminOrManager && (
            <View style={dynamicStyles.entryActions}>
              <TouchableOpacity
                onPress={() => startEditingTime(entry)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onStartShouldSetResponder={() => true}
              >
                <Pencil size={17} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleDeleteEntry(entry.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onStartShouldSetResponder={() => true}
              >
                <Trash2 size={17} color="#1B4D6E" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {!isEditingThisTime && (
          <TouchableOpacity
            style={dynamicStyles.entryCompactRow}
            onPress={(e) => { e.stopPropagation?.(); if (!isActive && isAdminOrManager) startEditingTime(entry); }}
            activeOpacity={isAdminOrManager && !isActive ? 0.6 : 1}
          >
            <Text style={[dynamicStyles.entryTimeCompact, isAdminOrManager && !isActive && { color: colors.primary }]}>
              {formatTime(entry.clock_in)} — {entry.clock_out ? formatTime(entry.clock_out) : 'Now'}
            </Text>
            <Text style={dynamicStyles.entryDurationCompact}>
              {formatDuration(entry.clock_in, entry.clock_out)}
            </Text>
          </TouchableOpacity>
        )}

        {isEditingThisTime && (
          <View
            style={dynamicStyles.timeEditContainer}
            onStartShouldSetResponder={() => true}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            {renderTimeInput(editClockIn, setEditClockIn, 'Clock In')}
            {editClockOut && renderTimeInput(editClockOut, setEditClockOut, 'Clock Out')}
            <View style={dynamicStyles.timeEditActions}>
              <TouchableOpacity
                style={[dynamicStyles.timeEditButton, dynamicStyles.timeEditSaveButton]}
                onPress={() => handleUpdateTime(entry.id)}
              >
                <Check size={18} color="#fff" />
                <Text style={dynamicStyles.timeEditButtonText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[dynamicStyles.timeEditButton, dynamicStyles.timeEditCancelButton]}
                onPress={() => setEditingTime(null)}
              >
                <X size={18} color="#fff" />
                <Text style={dynamicStyles.timeEditButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {entry.notes && !isEditingThisEntry && !isEditingThisTime && (
          <View style={dynamicStyles.notesContainer}>
            <Text style={dynamicStyles.notesLabel}>Notes</Text>
            <Text style={dynamicStyles.notesText}>{entry.notes}</Text>
          </View>
        )}

        {isEditingThisEntry && (
          <>
            <TextInput
              style={dynamicStyles.notesInput}
              value={notesText}
              onChangeText={setNotesText}
              placeholder="Add notes..."
              placeholderTextColor={colors.textSecondary}
              multiline
            />
            <View style={dynamicStyles.notesActions}>
              <TouchableOpacity
                style={[dynamicStyles.notesButton, dynamicStyles.notesSaveButton]}
                onPress={() => handleUpdateNotes(entry.id, notesText)}
              >
                <Text style={dynamicStyles.notesButtonText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[dynamicStyles.notesButton, dynamicStyles.notesCancelButton]}
                onPress={() => {
                  setEditingNotes(null);
                  setNotesText('');
                }}
              >
                <Text style={dynamicStyles.notesButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {!isEditingThisTime && !isEditingThisEntry && (
          <View style={dynamicStyles.entryFooterRow}>
            <View style={dynamicStyles.entryFooterBadges}>
              {entry.travel_flag && isActive && (
                <LocationContextChips
                  context={currentLocationContext}
                  stoppedMinutes={locationStatus.stoppedMinutes}
                />
              )}
              {entry.travel_flag && !isActive && (
                <View style={[dynamicStyles.statusBadge, dynamicStyles.statusBadgeTraveling]}>
                  <Truck size={13} color="#d97706" />
                  <Text style={[dynamicStyles.statusBadgeText, dynamicStyles.statusBadgeTextTraveling]}>Traveled</Text>
                </View>
              )}
              {renderBreakSummary(entry)}
            </View>
            <Text style={dynamicStyles.entryTapHint}>Tap for details</Text>
          </View>
        )}
      </View>
    );

    const canEdit = !isActive && isAdminOrManager;
    const swipeActions = canEdit
      ? [
          {
            label: 'Delete',
            icon: <Trash2 size={18} color="#fff" />,
            color: '#dc2626',
            onPress: () => handleDeleteEntry(entry.id),
          },
          {
            label: 'Edit',
            icon: <Pencil size={18} color="#fff" />,
            color: '#1B4D6E',
            onPress: () => startEditingTime(entry),
          },
        ]
      : [];

    return (
      <SwipeableRow key={entry.id} rightActions={swipeActions} enabled={canEdit}>
        <TouchableOpacity
          style={dynamicStyles.entryCardTouchable}
          activeOpacity={0.75}
          onPress={() => {
            if (editingTime === entry.id || editingNotes === entry.id) return;
            setSelectedEntryId(entry.id);
            setShowProductivityReport(true);
          }}
        >
          {cardContent}
        </TouchableOpacity>
      </SwipeableRow>
    );
  };

  const renderDayGroup = (dateKey: string, dayEntries: TimeEntry[]) => {
    const firstEntry = dayEntries[0];
    const dayLabel = formatDate(firstEntry.clock_in);
    const totalMs = dayEntries.reduce((sum, e) => {
      const start = new Date(e.clock_in).getTime();
      const end = e.clock_out ? new Date(e.clock_out).getTime() : Date.now();
      return sum + (end - start);
    }, 0);
    const totalHrs = Math.floor(totalMs / 3600000);
    const totalMins = Math.floor((totalMs % 3600000) / 60000);
    const totalLabel = totalHrs > 0 ? `${totalHrs}h ${totalMins}m` : `${totalMins}m`;

    return (
      <View
        key={dateKey}
        style={{
          backgroundColor: colors.cardBackground,
          borderRadius: 12,
          marginHorizontal: SPACING.lg,
          marginBottom: SPACING.sm,
          borderWidth: 1,
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : CARD.borderColor,
          overflow: 'hidden' as const,
          ...Platform.select({
            web: { boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
            default: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
          }),
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{dayLabel}</Text>
          <Text style={{ fontSize: 16, fontWeight: '800', color: colors.primary, letterSpacing: -0.3 }}>
            {totalLabel}
          </Text>
        </View>

        <View style={{ paddingHorizontal: 14, paddingTop: 2, paddingBottom: 6 }}>
          <View style={{ flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 2 }}>
            <Text style={{ fontSize: 10, fontWeight: '600', color: colors.textSecondary, width: '30%', textTransform: 'uppercase', letterSpacing: 0.5 }}>In</Text>
            <Text style={{ fontSize: 10, fontWeight: '600', color: colors.textSecondary, width: '30%', textTransform: 'uppercase', letterSpacing: 0.5 }}>Out</Text>
            <Text style={{ fontSize: 10, fontWeight: '600', color: colors.textSecondary, flex: 1, textAlign: 'right', textTransform: 'uppercase', letterSpacing: 0.5 }}>Duration</Text>
          </View>

          {dayEntries.map((entry, index) => {
            const isActive = entry.id === activeEntry?.id && entry.user_id === user?.id;
            const isEditingThisEntry = editingNotes === entry.id;
            const isEditingThisTime = editingTime === entry.id;
            const isOwnEntry = entry.user_id === user?.id;

            const hasBadges = entry.travel_flag || (entry.breaks && entry.breaks.length > 0);

            return (
              <TouchableOpacity
                key={entry.id}
                activeOpacity={0.75}
                onPress={() => { setSelectedEntryId(entry.id); setShowProductivityReport(true); }}
                style={{
                  borderTopWidth: 1,
                  borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                  paddingTop: 8,
                  paddingBottom: hasBadges && !isEditingThisTime && !isEditingThisEntry ? 3 : 8,
                  paddingHorizontal: 2,
                }}
              >
                {teamView && (
                  <View style={[dynamicStyles.userBadge, isOwnEntry && dynamicStyles.userBadgeOwn, { marginBottom: 4, alignSelf: 'flex-start' }]}>
                    <Text style={[dynamicStyles.userBadgeText, isOwnEntry && dynamicStyles.userBadgeTextOwn]}>
                      {isOwnEntry ? 'You' : entry.user_name}
                    </Text>
                  </View>
                )}

                {!isEditingThisTime && (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity
                      style={{ width: '30%', flexDirection: 'row', alignItems: 'center', gap: 4 }}
                      onPress={(e) => { e.stopPropagation?.(); if (!isActive && isAdminOrManager) startEditingTime(entry); }}
                      activeOpacity={isAdminOrManager && !isActive ? 0.6 : 1}
                    >
                      {isActive && (
                        <View style={[dynamicStyles.statusBadge, { backgroundColor: colors.primary, borderColor: colors.primary, paddingVertical: 1, paddingHorizontal: 5 }]}>
                          <Play size={8} color="#fff" />
                          <Text style={{ color: '#fff', fontSize: 8, fontWeight: '700' }}>NOW</Text>
                        </View>
                      )}
                      <Text style={{ fontSize: 13, fontWeight: '600', color: isAdminOrManager && !isActive ? colors.primary : colors.text }}>
                        {formatTime(entry.clock_in)}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ width: '30%' }}
                      onPress={(e) => { e.stopPropagation?.(); if (!isActive && isAdminOrManager && entry.clock_out) startEditingTime(entry); }}
                      activeOpacity={isAdminOrManager && !isActive && !!entry.clock_out ? 0.6 : 1}
                    >
                      <Text style={{ fontSize: 13, color: isAdminOrManager && !isActive && entry.clock_out ? colors.primary : entry.clock_out ? colors.text : colors.textSecondary, fontWeight: '600' }}>
                        {entry.clock_out ? formatTime(entry.clock_out) : '—'}
                      </Text>
                    </TouchableOpacity>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary }}>
                        {formatDuration(entry.clock_in, entry.clock_out)}
                      </Text>
                      {!isActive && isAdminOrManager && (
                        <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); handleDeleteEntry(entry.id); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Trash2 size={13} color="#1B4D6E" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}

                {isEditingThisTime && (
                  <View
                    style={dynamicStyles.timeEditContainer}
                    onStartShouldSetResponder={() => true}
                    onTouchEnd={(e) => e.stopPropagation()}
                  >
                    {renderTimeInput(editClockIn, setEditClockIn, 'Clock In')}
                    {editClockOut && renderTimeInput(editClockOut, setEditClockOut, 'Clock Out')}
                    <View style={dynamicStyles.timeEditActions}>
                      <TouchableOpacity style={[dynamicStyles.timeEditButton, dynamicStyles.timeEditSaveButton]} onPress={() => handleUpdateTime(entry.id)}>
                        <Check size={18} color="#fff" /><Text style={dynamicStyles.timeEditButtonText}>Save</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[dynamicStyles.timeEditButton, dynamicStyles.timeEditCancelButton]} onPress={() => setEditingTime(null)}>
                        <X size={18} color="#fff" /><Text style={dynamicStyles.timeEditButtonText}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {entry.notes && !isEditingThisEntry && !isEditingThisTime && (
                  <View style={[dynamicStyles.notesContainer, { marginTop: 5 }]}>
                    <Text style={dynamicStyles.notesText} numberOfLines={2}>{entry.notes}</Text>
                  </View>
                )}

                {isEditingThisEntry && (
                  <>
                    <TextInput style={dynamicStyles.notesInput} value={notesText} onChangeText={setNotesText} placeholder="Add notes..." placeholderTextColor={colors.textSecondary} multiline />
                    <View style={dynamicStyles.notesActions}>
                      <TouchableOpacity style={[dynamicStyles.notesButton, dynamicStyles.notesSaveButton]} onPress={() => handleUpdateNotes(entry.id, notesText)}>
                        <Text style={dynamicStyles.notesButtonText}>Save</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[dynamicStyles.notesButton, dynamicStyles.notesCancelButton]} onPress={() => { setEditingNotes(null); setNotesText(''); }}>
                        <Text style={dynamicStyles.notesButtonText}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}

                {!isEditingThisTime && !isEditingThisEntry && hasBadges && (
                  <View style={[dynamicStyles.entryFooterBadges, { marginTop: 4, paddingBottom: 2 }]}>
                    {entry.travel_flag && !isActive && (
                      <View style={[dynamicStyles.statusBadge, dynamicStyles.statusBadgeTraveling]}>
                        <Truck size={11} color="#d97706" />
                        <Text style={[dynamicStyles.statusBadgeText, dynamicStyles.statusBadgeTextTraveling, { fontSize: 11 }]}>Travel</Text>
                      </View>
                    )}
                    {renderBreakSummary(entry)}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  const getEntriesByUser = (periodEntries: TimeEntry[]) => {
    const byUser: { [userId: string]: { name: string; entries: TimeEntry[]; hours: number; minutes: number } } = {};
    periodEntries.forEach((entry) => {
      if (!byUser[entry.user_id]) {
        const isOwn = entry.user_id === user?.id;
        byUser[entry.user_id] = { name: isOwn ? 'You' : (entry.user_name || 'Unknown'), entries: [], hours: 0, minutes: 0 };
      }
      byUser[entry.user_id].entries.push(entry);
    });
    Object.values(byUser).forEach((userData) => {
      const { hours, minutes } = calculateTotalHours(userData.entries);
      userData.hours = hours;
      userData.minutes = minutes;
    });
    return Object.entries(byUser).sort((a, b) => {
      if (a[0] === user?.id) return -1;
      if (b[0] === user?.id) return 1;
      return a[1].name.localeCompare(b[1].name);
    });
  };

  const renderBarChart = (periodEntries: TimeEntry[], mode: 'weekly' | 'monthly', period: string) => {
    const CHART_W = 320;
    const CHART_H = 90;
    const BAR_RADIUS = 4;
    const LABEL_H = 18;
    const MAX_BAR_H = CHART_H - LABEL_H - 4;

    if (mode === 'weekly') {
      const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayHours = Array(7).fill(0);
      periodEntries.forEach((entry) => {
        if (!entry.clock_out) return;
        const dow = new Date(entry.clock_in).getDay();
        const mins = (new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / 60000;
        dayHours[dow] += mins / 60;
      });
      const maxH = Math.max(...dayHours, 0.1);
      const barW = Math.floor((CHART_W - 16) / 7) - 4;
      const gap = Math.floor((CHART_W - 16) / 7);

      return (
        <View style={{ alignItems: 'center', marginTop: 12, marginBottom: 4 }}>
          <Svg width={CHART_W} height={CHART_H}>
            {dayHours.map((h, i) => {
              const barH = Math.max(h > 0 ? 4 : 0, (h / maxH) * MAX_BAR_H);
              const x = 8 + i * gap + (gap - barW) / 2;
              const y = CHART_H - LABEL_H - barH - 2;
              const isToday = new Date().getDay() === i;
              const fill = h > 0 ? (isToday ? colors.primary : colors.primary + 'bb') : (isDark ? '#2a3540' : '#e8f0f5');
              return (
                <G key={i}>
                  <Rect x={x} y={y} width={barW} height={Math.max(barH, 2)} rx={BAR_RADIUS} ry={BAR_RADIUS} fill={fill} />
                      {h > 0 && (
                    <SvgText x={x + barW / 2} y={y - 3} textAnchor="middle" fontSize="9" fill={isDark ? '#9ab' : colors.primary} fontWeight="600">
                      {`${h.toFixed(2)}h`}
                    </SvgText>
                  )}
                  <SvgText x={x + barW / 2} y={CHART_H - 3} textAnchor="middle" fontSize="10" fill={isToday ? '#1B4D6E' : (isDark ? '#8a9aa8' : '#888')} fontWeight={isToday ? '700' : '400'}>
                    {DAY_LABELS[i]}
                  </SvgText>
                </G>
              );
            })}
          </Svg>
        </View>
      );
    } else {
      const weekBuckets: { label: string; hours: number }[] = [];
      const [year, month] = period.split('-').map(Number);
      const firstDay = new Date(year, month - 1, 1);
      const lastDay = new Date(year, month, 0);
      let weekStart = new Date(firstDay);
      let wIdx = 1;
      while (weekStart <= lastDay) {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const label = `W${wIdx}`;
        let total = 0;
        periodEntries.forEach((entry) => {
          if (!entry.clock_out) return;
          const d = new Date(entry.clock_in);
          if (d >= weekStart && d <= weekEnd) {
            total += (new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / 3600000;
          }
        });
        weekBuckets.push({ label, hours: total });
        weekStart = new Date(weekEnd);
        weekStart.setDate(weekStart.getDate() + 1);
        wIdx++;
      }

      const maxH = Math.max(...weekBuckets.map((w) => w.hours), 0.1);
      const barW = Math.floor((CHART_W - 16) / weekBuckets.length) - 6;
      const gap = Math.floor((CHART_W - 16) / weekBuckets.length);

      return (
        <View style={{ alignItems: 'center', marginTop: 12, marginBottom: 4 }}>
          <Svg width={CHART_W} height={CHART_H}>
            {weekBuckets.map((bucket, i) => {
              const barH = Math.max(bucket.hours > 0 ? 4 : 0, (bucket.hours / maxH) * MAX_BAR_H);
              const x = 8 + i * gap + (gap - barW) / 2;
              const y = CHART_H - LABEL_H - barH - 2;
              const fill = bucket.hours > 0 ? colors.primary + 'bb' : (isDark ? '#2a3540' : '#e8f0f5');
              return (
                <G key={i}>
                  <Rect x={x} y={y} width={barW} height={Math.max(barH, 2)} rx={BAR_RADIUS} ry={BAR_RADIUS} fill={fill} />
                  {bucket.hours > 0 && (
                    <SvgText x={x + barW / 2} y={y - 3} textAnchor="middle" fontSize="9" fill={isDark ? '#9ab' : colors.primary} fontWeight="600">
                      {bucket.hours.toFixed(2)}h
                    </SvgText>
                  )}
                  <SvgText x={x + barW / 2} y={CHART_H - 3} textAnchor="middle" fontSize="10" fill={isDark ? '#8a9aa8' : '#888'}>
                    {bucket.label}
                  </SvgText>
                </G>
              );
            })}
          </Svg>
        </View>
      );
    }
  };

  const renderReport = (report: PeriodReport, mode: 'weekly' | 'monthly') => {
    const isExpanded = expandedReports.has(report.period);
    const periodEntries = getEntriesForPeriod(report.period, mode);
    const entriesByUser = teamView ? getEntriesByUser(periodEntries) : null;
    const decimalHours = parseFloat(formatDecimalHours(report.totalHours, report.totalMinutes));
    const estPay = hourlyRate ? hourlyRate * decimalHours : null;

    return (
      <View key={report.period} style={[dynamicStyles.reportCard, { marginHorizontal: SPACING.lg, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.08)' : CARD.borderColor }]}>
        <TouchableOpacity style={dynamicStyles.reportHeader} onPress={() => toggleReportExpansion(report.period)}>
          <View style={{ flex: 1 }}>
            <Text style={dynamicStyles.reportPeriod}>{report.displayDate}</Text>
            {estPay !== null && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '500' }}>Est. Pay</Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#059669' }}>${estPay.toFixed(2)}</Text>
              </View>
            )}
          </View>
          {isExpanded ? <ChevronUp size={20} color={colors.textSecondary} /> : <ChevronDown size={20} color={colors.textSecondary} />}
        </TouchableOpacity>

        <View style={dynamicStyles.reportStats}>
          <View style={dynamicStyles.reportStat}>
            <Text style={dynamicStyles.reportStatLabel}>Total Hours</Text>
            <Text style={dynamicStyles.reportStatValue}>{decimalHours} hrs</Text>
          </View>
          <View style={dynamicStyles.reportStat}>
            <Text style={dynamicStyles.reportStatLabel}>Entries</Text>
            <Text style={dynamicStyles.reportStatValue}>{report.entries}</Text>
          </View>
        </View>

        {renderBarChart(periodEntries, mode, report.period)}

        {isExpanded && teamView && entriesByUser && entriesByUser.length > 0 && (
          <View style={dynamicStyles.reportEntries}>
            <Text style={dynamicStyles.reportEntriesTitle}>By Team Member</Text>
            {entriesByUser.map(([userId, userData]) => (
              <View key={userId} style={dynamicStyles.userBreakdownRow}>
                <View style={dynamicStyles.userBreakdownInfo}>
                  <Text style={dynamicStyles.userBreakdownName}>{userData.name}</Text>
                  <Text style={dynamicStyles.userBreakdownEntries}>{userData.entries.length} entries</Text>
                </View>
                <Text style={dynamicStyles.userBreakdownHours}>{formatDecimalHours(userData.hours, userData.minutes)} hrs</Text>
              </View>
            ))}
          </View>
        )}

        {isExpanded && !teamView && periodEntries.length > 0 && (
          <View style={dynamicStyles.reportEntries}>
            <Text style={dynamicStyles.reportEntriesTitle}>Time Entries</Text>
            {periodEntries.map((entry) => (
              <TouchableOpacity key={entry.id} style={dynamicStyles.reportEntryRow} onPress={() => { setShowSessionHistory(true); }}>
                <View style={{ flex: 1 }}>
                  <Text style={dynamicStyles.reportEntryDate}>{formatDate(entry.clock_in)}</Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                    {formatTime(entry.clock_in)} — {entry.clock_out ? formatTime(entry.clock_out) : 'Ongoing'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={dynamicStyles.reportEntryDuration}>{formatDuration(entry.clock_in, entry.clock_out)}</Text>
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    {entry.travel_flag && (
                      <View style={[dynamicStyles.statusBadge, dynamicStyles.statusBadgeTraveling, { paddingVertical: 1, paddingHorizontal: 6 }]}>
                        <Truck size={10} color="#d97706" />
                        <Text style={[dynamicStyles.statusBadgeText, dynamicStyles.statusBadgeTextTraveling, { fontSize: 10 }]}>Travel</Text>
                      </View>
                    )}
                    {entry.stopped_minutes && entry.stopped_minutes > 0 ? (
                      <View style={[dynamicStyles.statusBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', borderColor: 'transparent', paddingVertical: 1, paddingHorizontal: 6 }]}>
                        <Text style={[dynamicStyles.statusBadgeText, { color: colors.textSecondary, fontSize: 10 }]}>Stopped {entry.stopped_minutes}m</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  const completedEntries = filteredEntries.filter((e) => e.clock_out);
  const weeklyReports = generateWeeklyReports();
  const monthlyReports = generateMonthlyReports();

  const handleBulkDelete = async () => {
    if (!user?.id) return;
    setBulkDeleting(true);
    try {
      let query = supabase.from('time_entries').delete();
      if (!isAdminOrManager) {
        query = query.eq('user_id', user.id);
      }
      if (bulkDeleteMode === 'year') {
        const startOfYear = new Date(bulkDeleteYear, 0, 1).toISOString();
        const endOfYear = new Date(bulkDeleteYear + 1, 0, 1).toISOString();
        query = query.gte('clock_in', startOfYear).lt('clock_in', endOfYear);
      } else if (bulkDeleteMode === 'user' && bulkDeleteUserId) {
        query = query.eq('user_id', bulkDeleteUserId);
      }
      const { error } = await query;
      if (error) throw error;
      showToast({ message: 'Entries deleted successfully', type: 'success', duration: 3000 });
      setShowBulkDeleteModal(false);
      await fetchEntries();
    } catch (err: any) {
      showToast({ message: err.message || 'Failed to delete entries', type: 'error', duration: 4000 });
    } finally {
      setBulkDeleting(false);
    }
  };

  const scheduleBreakNotification = (policy: { name: string; duration_minutes: number; notify_on_expiry: boolean }) => {
    if (!policy.notify_on_expiry || policy.duration_minutes <= 0) return;
    if (breakTimerRef.current) clearTimeout(breakTimerRef.current);
    breakTimerRef.current = setTimeout(async () => {
      if (Platform.OS !== 'web') {
        try {
          const { PushNotificationService } = await import('@/lib/pushNotificationService');
          await PushNotificationService.sendLocalNotification(
            `${policy.name} Over`,
            `Your ${policy.duration_minutes}-minute ${policy.name.toLowerCase()} is up. Ready to get back to it?`,
            'breaks',
            { type: 'break_expiry' }
          );
        } catch (err) {
          console.error('break notification error:', err);
        }
      }
    }, policy.duration_minutes * 60 * 1000);
  };

  const startBreakWithPolicy = async (policyId: string | null) => {
    setShowBreakTypeModal(false);
    if (!activeEntry) return;
    const policy = policyId ? breakPolicies.find((p) => p.id === policyId) : null;
    const { error } = await supabase.from('time_entry_breaks').insert({
      time_entry_id: activeEntry.id,
      user_id: user?.id,
      organization_id: currentOrganization?.id,
      started_at: new Date().toISOString(),
      break_type_id: policyId || null,
    });
    if (error) {
      showToast({ message: 'Failed to start break', type: 'error', duration: 3000 });
      return;
    }
    const label = policy ? policy.name : 'Break';
    showToast({ message: `${label} started`, type: 'info', duration: 2000 });
    if (policy) scheduleBreakNotification(policy);
    await fetchEntries();
  };

  const handleBreakAction = async () => {
    const activeBreak = activeEntry?.breaks?.find((b: any) => !b.ended_at);
    if (activeBreak) {
      if (breakTimerRef.current) {
        clearTimeout(breakTimerRef.current);
        breakTimerRef.current = null;
      }
      const { error } = await supabase
        .from('time_entry_breaks')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', activeBreak.id);
      if (error) {
        showToast({ message: 'Failed to end break', type: 'error', duration: 3000 });
        return;
      }
      showToast({ message: 'Break ended', type: 'success', duration: 2000 });
      await fetchEntries();
    } else if (activeEntry) {
      if (breakPolicies.length > 0) {
        setShowBreakTypeModal(true);
      } else {
        await startBreakWithPolicy(null);
      }
    } else {
      showToast({ message: 'No active clock-in to break', type: 'warning', duration: 2000 });
    }
  };

  const activeBreak = activeEntry?.breaks?.find((b: any) => !b.ended_at);

  return (
    <AnimatedTabContent activeTab={globalCurrentTab} tabKey="time" direction={slideDirection}>
      <View style={dynamicStyles.container}>
        <BlurHeader style={dynamicStyles.header}>
          <View style={dynamicStyles.headerTopRow}>
            <Text style={dynamicStyles.title}>{t('time_title')}</Text>
            <View style={dynamicStyles.headerActions}>
              <TouchableOpacity
                style={dynamicStyles.historyButton}
                onPress={() => setMoreMenuVisible(true)}
                activeOpacity={0.7}
              >
                <Menu size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
          {activeEntry && (
            <View style={dynamicStyles.activeStatusBar}>
              <View style={dynamicStyles.activeStatusLeft}>
                <PulsingIndicator color="#ffffff" size={12} active={true} />
                <View>
                  <Text style={dynamicStyles.activeStatusText}>
                    {locationStatus.type === 'job_site'
                      ? `At ${(locationStatus as any).clientName || 'Job Site'}`
                      : locationStatus.type === 'home_base'
                      ? 'At Home Base'
                      : activeBreak
                      ? 'On Break'
                      : 'Working'}
                  </Text>
                  {(locationStatus.type === 'traveling' || locationStatus.type === 'stopped' || currentLocationContext !== 'unknown') && (
                    <LocationContextChips
                      context={currentLocationContext}
                      clientName={(locationStatus as any).clientName}
                      stoppedMinutes={locationStatus.stoppedMinutes}
                    />
                  )}
                </View>
              </View>
              <Text style={dynamicStyles.activeTimerLarge}>
                {formatDuration(activeEntry.clock_in, null)}
              </Text>
            </View>
          )}
        </BlurHeader>

        <ScrollView
          contentContainerStyle={dynamicStyles.scrollContent}
        >
          {detectedLocationCount > 0 && (
            <TouchableOpacity
              style={dynamicStyles.detectedLocationBanner}
              onPress={() => setShowDetectedLocations(true)}
              activeOpacity={0.8}
            >
              <MapPin size={18} color={colors.primary} />
              <Text style={dynamicStyles.detectedLocationBannerText}>
                {detectedLocationCount} potential job site{detectedLocationCount > 1 ? 's' : ''} detected
              </Text>
              <ChevronDown size={16} color={colors.primary} style={{ transform: [{ rotate: '-90deg' }] }} />
            </TouchableOpacity>
          )}

          {isAdminOrManager && (
            <View style={timeTabStyles.mainTabBar}>
              <TouchableOpacity
                style={[timeTabStyles.mainTabBtn, mainTab === 'my_hours' && timeTabStyles.mainTabBtnActive]}
                onPress={() => setMainTab('my_hours')}
                activeOpacity={0.8}
              >
                <User size={14} color={mainTab === 'my_hours' ? '#1B4D6E' : colors.textSecondary} />
                <Text style={[timeTabStyles.mainTabBtnText, { color: mainTab === 'my_hours' ? '#1B4D6E' : colors.textSecondary }, mainTab === 'my_hours' && timeTabStyles.mainTabBtnTextActive]}>My Hours</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[timeTabStyles.mainTabBtn, mainTab === 'team' && timeTabStyles.mainTabBtnActive]}
                onPress={() => { setMainTab('team'); setShowMemberPicker(false); }}
                activeOpacity={0.8}
              >
                <Users size={14} color={mainTab === 'team' ? '#1B4D6E' : colors.textSecondary} />
                <Text style={[timeTabStyles.mainTabBtnText, { color: mainTab === 'team' ? '#1B4D6E' : colors.textSecondary }, mainTab === 'team' && timeTabStyles.mainTabBtnTextActive]}>Team</Text>
              </TouchableOpacity>
            </View>
          )}

          {mainTab === 'my_hours' && (
            <>
              {/* Member selector — admin/owner only */}
              {isAdminOrOwner && profiles.length > 0 && (
                <View style={{ paddingHorizontal: SPACING.lg, paddingTop: SPACING.md }}>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.cardBackground, borderRadius: 10, borderWidth: 1, borderColor: viewingUserId ? colors.primary : colors.border, paddingHorizontal: 12, paddingVertical: 9, gap: 8 }}
                    onPress={() => { setShowMemberPicker(true); setMemberPickerSearch(''); }}
                    activeOpacity={0.7}
                  >
                    <User size={14} color={viewingUserId ? colors.primary : colors.textSecondary} />
                    <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: viewingUserId ? colors.primary : colors.textSecondary }}>
                      {viewingUserId ? viewingName : 'Viewing: My Hours'}
                    </Text>
                    {viewingUserId ? (
                      <TouchableOpacity
                        onPress={(e) => { e.stopPropagation(); setViewingUserId(null); }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <X size={14} color={colors.primary} />
                      </TouchableOpacity>
                    ) : (
                      <ChevronDown size={14} color={colors.textSecondary} />
                    )}
                  </TouchableOpacity>
                  {showMemberPicker && (
                    <View style={{ backgroundColor: colors.cardBackground, borderRadius: 10, borderWidth: 1, borderColor: colors.border, marginTop: 4, overflow: 'hidden', maxHeight: 240, ...Platform.select({ web: { boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }, default: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8 } }) }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 6 }}>
                        <Search size={13} color={colors.textSecondary} />
                        <TextInput
                          style={{ flex: 1, fontSize: 13, color: colors.text, borderWidth: 0, backgroundColor: 'transparent', ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) } as any}
                          placeholder="Search members..."
                          placeholderTextColor={colors.textSecondary}
                          value={memberPickerSearch}
                          onChangeText={setMemberPickerSearch}
                          autoFocus
                        />
                        {memberPickerSearch.length > 0 && (
                          <TouchableOpacity onPress={() => setMemberPickerSearch('')}>
                            <X size={13} color={colors.textSecondary} />
                          </TouchableOpacity>
                        )}
                      </View>
                      <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                        {/* "My Hours" option */}
                        {(!memberPickerSearch || 'my hours'.includes(memberPickerSearch.toLowerCase())) && (
                          <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: !viewingUserId ? colors.primary + '15' : 'transparent', gap: 8 }}
                            onPress={() => { setViewingUserId(null); setShowMemberPicker(false); }}
                          >
                            <User size={14} color={!viewingUserId ? colors.primary : colors.textSecondary} />
                            <Text style={{ fontSize: 13, color: !viewingUserId ? colors.primary : colors.text, fontWeight: !viewingUserId ? '700' : '400' }}>My Hours</Text>
                            {!viewingUserId && <Check size={14} color={colors.primary} style={{ marginLeft: 'auto' as any }} />}
                          </TouchableOpacity>
                        )}
                        {profiles
                          .filter(p => p.id !== user?.id)
                          .filter(p => {
                            if (!memberPickerSearch) return true;
                            const q = memberPickerSearch.toLowerCase();
                            return (p.display_name || '').toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q);
                          })
                          .map(p => {
                            const name = p.display_name || p.email?.split('@')[0] || 'Unknown';
                            const isSelected = viewingUserId === p.id;
                            return (
                              <TouchableOpacity
                                key={p.id}
                                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: isSelected ? colors.primary + '15' : 'transparent', gap: 8 }}
                                onPress={() => { setViewingUserId(p.id); setShowMemberPicker(false); }}
                              >
                                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary + '20', alignItems: 'center', justifyContent: 'center' }}>
                                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary }}>{name.charAt(0).toUpperCase()}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={{ fontSize: 13, color: isSelected ? colors.primary : colors.text, fontWeight: isSelected ? '700' : '400' }}>{name}</Text>
                                  {p.email && <Text style={{ fontSize: 11, color: colors.textSecondary }}>{p.email}</Text>}
                                </View>
                                {isSelected && <Check size={14} color={colors.primary} />}
                              </TouchableOpacity>
                            );
                          })}
                      </ScrollView>
                    </View>
                  )}
                </View>
              )}

              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, backgroundColor: colors.cardBackground, borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 8, gap: 8 }}>
                  <Clock size={14} color={colors.primary} />
                  <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary }}>This Week</Text>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: colors.primary }}>{myWeekHours.toFixed(2)}h</Text>
                  {myWeekOvertime > 0 && (
                    <View style={{ backgroundColor: '#f59e0b20', borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: '#f59e0b' }}>+{myWeekOvertime.toFixed(2)}h OT</Text>
                    </View>
                  )}
                  <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden' }}>
                    <View style={{ height: '100%', borderRadius: 2, width: `${Math.min(100, (myWeekHours / 40) * 100)}%` as any, backgroundColor: myWeekHours >= 40 ? '#f59e0b' : colors.primary }} />
                  </View>
                  <Text style={{ fontSize: 10, color: colors.textSecondary }}>{Math.min(100, Math.round((myWeekHours / 40) * 100))}%</Text>
                </View>
              </View>

              <View style={{ marginHorizontal: SPACING.lg, marginTop: SPACING.sm, backgroundColor: colors.cardBackground, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14, ...Platform.select({ web: { boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }, default: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 } }) }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <Timer size={16} color={colors.primary} />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Job Timer</Text>
                </View>

                {!jobTimerRunning && jobTimerElapsed === 0 ? (
                  <>
                    {timerNearestClient && !selectedTimerClientId && (
                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#10b981' + '15', borderRadius: 10, borderWidth: 1, borderColor: '#10b981' + '40', paddingHorizontal: 12, paddingVertical: 9, marginBottom: 8 }}
                        onPress={() => {
                          setTimerPickerMode('client');
                          setSelectedTimerClientId(timerNearestClient.id);
                          setSelectedTimerJobId('');
                          setSelectedTimerAddressId(null);
                          fetchTimerClientAddresses(timerNearestClient.id);
                        }}
                        activeOpacity={0.8}
                      >
                        <MapPin size={14} color="#10b981" />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: '#10b981' }}>Nearby: {timerNearestClient.name}</Text>
                          <Text style={{ fontSize: 11, color: '#10b981', opacity: 0.8 }}>
                            {timerNearestClient.distanceKm < 1
                              ? `${Math.round(timerNearestClient.distanceKm * 1000)}m away — tap to select`
                              : `${timerNearestClient.distanceKm.toFixed(1)}km away — tap to select`}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    )}

                    <View style={{ flexDirection: 'row', marginBottom: 8, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
                      <TouchableOpacity
                        style={{ flex: 1, paddingVertical: 8, alignItems: 'center', backgroundColor: timerPickerMode === 'schedule' ? colors.primary + '18' : colors.surface }}
                        onPress={() => { setTimerPickerMode('schedule'); setShowTimerJobPicker(false); setTimerClientSearchQuery(''); }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '600', color: timerPickerMode === 'schedule' ? colors.primary : colors.textSecondary }}>Today's Jobs</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{ flex: 1, paddingVertical: 8, alignItems: 'center', backgroundColor: timerPickerMode === 'client' ? colors.primary + '18' : colors.surface, borderLeftWidth: 1, borderLeftColor: colors.border }}
                        onPress={() => { setTimerPickerMode('client'); setShowTimerJobPicker(false); setTimerClientSearchQuery(''); }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '600', color: timerPickerMode === 'client' ? colors.primary : colors.textSecondary }}>By Client</Text>
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10 }}
                      onPress={() => { setShowTimerJobPicker(!showTimerJobPicker); if (showTimerJobPicker) setTimerClientSearchQuery(''); }}
                      activeOpacity={0.7}
                    >
                      {timerPickerMode === 'client' ? <UserCircle size={16} color={colors.primary} style={{ marginRight: 6 }} /> : null}
                      <Text style={{ flex: 1, fontSize: 14, color: colors.text }}>
                        {timerPickerMode === 'schedule'
                          ? (() => {
                              const opts = scheduleEvents.length > 0
                                ? scheduleEvents.map((ev: any) => ({ id: ev.id, name: ev.client?.name || ev.title }))
                                : [{ id: 'general', name: 'General Work' }];
                              const sel = opts.find((o: any) => o.id === selectedTimerJobId);
                              return sel?.name || opts[0]?.name || 'Select Job';
                            })()
                          : (() => {
                              const sel = clients.find((c) => c.id === selectedTimerClientId);
                              return sel?.name || 'Select Client';
                            })()
                        }
                      </Text>
                      {showTimerJobPicker ? <ChevronUp size={16} color={colors.textSecondary} /> : <ChevronDown size={16} color={colors.textSecondary} />}
                    </TouchableOpacity>

                    {showTimerJobPicker && timerPickerMode === 'schedule' && (
                      <View style={{ backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.border, marginBottom: 10, overflow: 'hidden', maxHeight: 180 }}>
                        <ScrollView nestedScrollEnabled>
                          {(scheduleEvents.length > 0
                            ? scheduleEvents.map((ev: any) => ({ id: ev.id, name: ev.client?.name || ev.title, clientId: ev.client?.id || null }))
                            : [{ id: 'general', name: 'General Work', clientId: null }]
                          ).map((job: any) => (
                            <TouchableOpacity
                              key={job.id}
                              style={{ paddingHorizontal: 12, paddingVertical: 10, backgroundColor: selectedTimerJobId === job.id ? colors.primary + '15' : 'transparent' }}
                              onPress={() => { setSelectedTimerJobId(job.id); setSelectedTimerClientId(job.clientId); setSelectedTimerAddressId(null); setShowTimerJobPicker(false); if (job.clientId) fetchTimerClientAddresses(job.clientId); }}
                            >
                              <Text style={{ fontSize: 14, color: selectedTimerJobId === job.id ? colors.primary : colors.text, fontWeight: selectedTimerJobId === job.id ? '600' : '400' }}>{job.name}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}

                    {showTimerJobPicker && timerPickerMode === 'client' && (
                      <View style={{ backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.border, marginBottom: 10, overflow: 'hidden', maxHeight: 280 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                          <Search size={15} color={colors.textSecondary} />
                          <TextInput
                            style={{ flex: 1, fontSize: 14, color: colors.text, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 0, backgroundColor: 'transparent', ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) } as any}
                            placeholder="Search clients..."
                            placeholderTextColor={colors.textSecondary}
                            value={timerClientSearchQuery}
                            onChangeText={setTimerClientSearchQuery}
                            autoFocus
                          />
                          {timerClientSearchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setTimerClientSearchQuery('')} style={{ padding: 2 }}>
                              <X size={15} color={colors.textSecondary} />
                            </TouchableOpacity>
                          )}
                        </View>
                        <ScrollView nestedScrollEnabled>
                          {(() => {
                            const query = timerClientSearchQuery.toLowerCase().trim();
                            const clientAddressMap: Record<string, typeof allTimerAddresses> = {};
                            allTimerAddresses.forEach(addr => {
                              if (!clientAddressMap[addr.clientId]) clientAddressMap[addr.clientId] = [];
                              clientAddressMap[addr.clientId].push(addr);
                            });
                            const filtered = clients.filter(c =>
                              !query ||
                              c.name.toLowerCase().includes(query) ||
                              c.address?.toLowerCase().includes(query) ||
                              (clientAddressMap[c.id] || []).some(a =>
                                a.label?.toLowerCase().includes(query) ||
                                a.address_line1?.toLowerCase().includes(query) ||
                                a.city?.toLowerCase().includes(query)
                              )
                            );
                            if (filtered.length === 0) {
                              return (
                                <View>
                                  <Text style={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 6, fontSize: 13, color: colors.textSecondary, textAlign: 'center' }}>No clients found</Text>
                                  <TouchableOpacity
                                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 10, marginBottom: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.primary + '12', borderRadius: 8, borderWidth: 1, borderColor: colors.primary + '30' }}
                                    onPress={() => {
                                      setShowTimerJobPicker(false);
                                      setTimerClientSearchQuery('');
                                      if (currentLocation) setLocationForNewClient({ latitude: currentLocation.latitude, longitude: currentLocation.longitude });
                                      setShowClientModal(true);
                                    }}
                                  >
                                    <Plus size={14} color={colors.primary} />
                                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary }}>Create New Client</Text>
                                    {currentLocation && <Text style={{ fontSize: 11, color: colors.primary, opacity: 0.7, marginLeft: 4 }}>(address pre-filled)</Text>}
                                  </TouchableOpacity>
                                </View>
                              );
                            }
                            return filtered.map((client) => {
                              const addresses = clientAddressMap[client.id] || [];
                              const isSelected = selectedTimerClientId === client.id;
                              return (
                                <View key={client.id}>
                                  <TouchableOpacity
                                    style={{ paddingHorizontal: 12, paddingVertical: 10, backgroundColor: isSelected ? colors.primary + '15' : 'transparent' }}
                                    onPress={() => { setSelectedTimerClientId(client.id); setSelectedTimerJobId(''); setSelectedTimerAddressId(null); setShowTimerJobPicker(false); setTimerClientSearchQuery(''); fetchTimerClientAddresses(client.id); }}
                                  >
                                    <Text style={{ fontSize: 14, color: isSelected ? colors.primary : colors.text, fontWeight: isSelected ? '600' : '400' }}>{client.name}</Text>
                                    {addresses.length <= 1 && client.address ? (
                                      <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }} numberOfLines={1}>{client.address}</Text>
                                    ) : null}
                                  </TouchableOpacity>
                                  {addresses.length > 1 && addresses.map((addr) => (
                                    <TouchableOpacity
                                      key={addr.id}
                                      style={{ paddingLeft: 28, paddingRight: 12, paddingVertical: 7, backgroundColor: selectedTimerAddressId === addr.id && isSelected ? colors.primary + '10' : 'transparent', flexDirection: 'row', alignItems: 'center', gap: 6 }}
                                      onPress={() => { setSelectedTimerClientId(client.id); setSelectedTimerJobId(''); setSelectedTimerAddressId(addr.id); setShowTimerJobPicker(false); setTimerClientSearchQuery(''); setTimerClientAddresses(addresses); }}
                                    >
                                      <MapPin size={12} color={selectedTimerAddressId === addr.id && isSelected ? colors.primary : colors.textSecondary} />
                                      <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 12, color: selectedTimerAddressId === addr.id && isSelected ? colors.primary : colors.text, fontWeight: selectedTimerAddressId === addr.id && isSelected ? '600' : '400' }} numberOfLines={1}>
                                          {addr.label || addr.address_line1 || addr.city || 'Address'}
                                        </Text>
                                        {addr.address_line1 && addr.label ? (
                                          <Text style={{ fontSize: 10, color: colors.textSecondary, marginTop: 1 }} numberOfLines={1}>{[addr.address_line1, addr.city].filter(Boolean).join(', ')}</Text>
                                        ) : null}
                                      </View>
                                    </TouchableOpacity>
                                  ))}
                                </View>
                              );
                            });
                          })()}
                          <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, margin: 8, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: colors.primary + '10', borderRadius: 8, borderWidth: 1, borderColor: colors.primary + '25' }}
                            onPress={() => {
                              setShowTimerJobPicker(false);
                              setTimerClientSearchQuery('');
                              if (currentLocation) setLocationForNewClient({ latitude: currentLocation.latitude, longitude: currentLocation.longitude });
                              setShowClientModal(true);
                            }}
                          >
                            <Plus size={13} color={colors.primary} />
                            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary }}>New Client</Text>
                            {currentLocation && <Text style={{ fontSize: 11, color: colors.primary, opacity: 0.7 }}>(address pre-filled)</Text>}
                          </TouchableOpacity>
                        </ScrollView>
                      </View>
                    )}

                    {timerClientAddresses.length > 0 && (
                      <>
                        <TouchableOpacity
                          style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: selectedTimerAddressId ? colors.primary : colors.border, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10 }}
                          onPress={() => setShowTimerAddressPicker(!showTimerAddressPicker)}
                          activeOpacity={0.7}
                        >
                          <MapPin size={16} color={selectedTimerAddressId ? colors.primary : colors.textSecondary} style={{ marginRight: 6 }} />
                          <Text style={{ flex: 1, fontSize: 14, color: selectedTimerAddressId ? colors.text : colors.textSecondary }}>
                            {selectedTimerAddressId
                              ? (() => { const a = timerClientAddresses.find(a => a.id === selectedTimerAddressId); return a ? `${a.clientName ? a.clientName + ' - ' : ''}${a.label || a.address_line1 || a.city || 'Address'}` : 'Select Address'; })()
                              : 'Select Address'}
                          </Text>
                          {showTimerAddressPicker ? <ChevronUp size={16} color={colors.textSecondary} /> : <ChevronDown size={16} color={colors.textSecondary} />}
                        </TouchableOpacity>
                        {showTimerAddressPicker && (
                          <View style={{ backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.border, marginBottom: 10, overflow: 'hidden', maxHeight: 180 }}>
                            <ScrollView nestedScrollEnabled>
                              {timerClientAddresses.map((addr) => (
                                <TouchableOpacity
                                  key={addr.id}
                                  style={{ paddingHorizontal: 12, paddingVertical: 10, backgroundColor: selectedTimerAddressId === addr.id ? colors.primary + '15' : 'transparent' }}
                                  onPress={() => { setSelectedTimerAddressId(addr.id); setShowTimerAddressPicker(false); }}
                                >
                                  <Text style={{ fontSize: 14, color: selectedTimerAddressId === addr.id ? colors.primary : colors.text, fontWeight: selectedTimerAddressId === addr.id ? '600' : '400' }}>{addr.label || addr.address_line1 || 'Address'}</Text>
                                  <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>{[addr.clientName, addr.address_line1, addr.city].filter(Boolean).join(' - ')}</Text>
                                </TouchableOpacity>
                              ))}
                            </ScrollView>
                          </View>
                        )}
                      </>
                    )}

                    {jobCategories.length > 0 && (() => {
                      const selectedCat = jobCategories.find(c => c.id === selectedTimerCategoryId);
                      const catScopeOptions = selectedCat?.scope_options;
                      return (
                        <View style={{ marginBottom: 10 }}>
                          <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: selectedTimerCategoryId ? colors.primary : colors.border, paddingHorizontal: 12, paddingVertical: 10 }}
                            onPress={() => setShowTimerJobTypePicker(v => !v)}
                            activeOpacity={0.7}
                          >
                            <Package size={15} color={selectedTimerCategoryId ? colors.primary : colors.textSecondary} style={{ marginRight: 8 }} />
                            <Text style={{ flex: 1, fontSize: 14, color: selectedTimerCategoryId ? colors.text : colors.textSecondary }}>
                              {selectedTimerCategoryId ? selectedCat?.name || 'Category' : 'Job Category (optional)'}
                            </Text>
                            {selectedTimerCategoryId && (
                              <TouchableOpacity onPress={(e) => { e.stopPropagation(); setSelectedTimerCategoryId(null); setSelectedTimerServiceScope('full_service'); setShowTimerJobTypePicker(false); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                <X size={14} color={colors.textSecondary} />
                              </TouchableOpacity>
                            )}
                            {!selectedTimerCategoryId && (showTimerJobTypePicker ? <ChevronUp size={15} color={colors.textSecondary} /> : <ChevronDown size={15} color={colors.textSecondary} />)}
                          </TouchableOpacity>
                          {showTimerJobTypePicker && (
                            <View style={{ backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.border, marginTop: 4, overflow: 'hidden', maxHeight: 200 }}>
                              <ScrollView nestedScrollEnabled>
                                {jobCategories.map(cat => (
                                  <TouchableOpacity
                                    key={cat.id}
                                    style={{ paddingHorizontal: 12, paddingVertical: 10, backgroundColor: selectedTimerCategoryId === cat.id ? colors.primary + '15' : 'transparent', borderBottomWidth: 1, borderBottomColor: colors.border + '40', flexDirection: 'row', alignItems: 'center', gap: 8 }}
                                    onPress={() => {
                                      setSelectedTimerCategoryId(cat.id);
                                      setShowTimerJobTypePicker(false);
                                      if (cat.scope_options === 'exterior_only') {
                                        setSelectedTimerServiceScope('exterior_only');
                                      } else {
                                        setSelectedTimerServiceScope('full_service');
                                      }
                                    }}
                                  >
                                    {cat.color && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: cat.color }} />}
                                    <Text style={{ fontSize: 14, color: selectedTimerCategoryId === cat.id ? colors.primary : colors.text, fontWeight: selectedTimerCategoryId === cat.id ? '600' : '400' }}>{cat.name}</Text>
                                    {(cat.scope_options === 'both' || cat.scope_options === 'exterior_only') && (
                                      <View style={{ marginLeft: 'auto' as any, backgroundColor: '#0ea5e920', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 }}>
                                        <Text style={{ fontSize: 10, color: '#0ea5e9', fontWeight: '600' }}>
                                          {cat.scope_options === 'exterior_only' ? 'Ext Only' : 'Full/Ext'}
                                        </Text>
                                      </View>
                                    )}
                                  </TouchableOpacity>
                                ))}
                              </ScrollView>
                            </View>
                          )}
                          {/* Scope selector — shown when selected category supports both full and exterior */}
                          {selectedTimerCategoryId && catScopeOptions === 'both' && (
                            <View style={{ marginTop: 8, flexDirection: 'row', gap: 8 }}>
                              <TouchableOpacity
                                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 8, borderWidth: 1.5, borderColor: selectedTimerServiceScope === 'full_service' ? colors.primary : colors.border, backgroundColor: selectedTimerServiceScope === 'full_service' ? colors.primary + '12' : colors.surface }}
                                onPress={() => setSelectedTimerServiceScope('full_service')}
                                activeOpacity={0.7}
                              >
                                {selectedTimerServiceScope === 'full_service' && <Check size={13} color={colors.primary} />}
                                <Text style={{ fontSize: 13, fontWeight: '600', color: selectedTimerServiceScope === 'full_service' ? colors.primary : colors.textSecondary }}>Full Service</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 8, borderWidth: 1.5, borderColor: selectedTimerServiceScope === 'exterior_only' ? colors.primary : colors.border, backgroundColor: selectedTimerServiceScope === 'exterior_only' ? colors.primary + '12' : colors.surface }}
                                onPress={() => setSelectedTimerServiceScope('exterior_only')}
                                activeOpacity={0.7}
                              >
                                {selectedTimerServiceScope === 'exterior_only' && <Check size={13} color={colors.primary} />}
                                <Text style={{ fontSize: 13, fontWeight: '600', color: selectedTimerServiceScope === 'exterior_only' ? colors.primary : colors.textSecondary }}>Exterior Only</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                          {/* Fixed exterior-only badge when category only supports exterior */}
                          {selectedTimerCategoryId && catScopeOptions === 'exterior_only' && (
                            <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#f59e0b15', borderWidth: 1, borderColor: '#f59e0b40' }}>
                              <Text style={{ fontSize: 12, fontWeight: '600', color: '#b45309' }}>Exterior Only</Text>
                              <Text style={{ fontSize: 11, color: '#b45309', opacity: 0.8 }}>— set by job category</Text>
                            </View>
                          )}
                        </View>
                      );
                    })()}

                    <TouchableOpacity
                      style={{ borderRadius: 14, overflow: 'hidden' }}
                      onPress={() => {
                        let clientName = '';
                        let clientId: string | null = null;
                        if (timerPickerMode === 'schedule') {
                          const opts = scheduleEvents.length > 0
                            ? scheduleEvents.map((ev: any) => ({ id: ev.id, name: ev.client?.name || ev.title, clientId: ev.client?.id || null }))
                            : [{ id: 'general', name: 'General Work', clientId: null }];
                          const sel = opts.find((o: any) => o.id === selectedTimerJobId) || opts[0];
                          clientName = sel?.name || 'Job';
                          clientId = sel?.clientId || null;
                        } else {
                          const sel = clients.find((c) => c.id === selectedTimerClientId);
                          clientName = sel?.name || '';
                          clientId = sel?.id || null;
                        }
                        const categoryName = selectedTimerCategoryId ? jobCategories.find(c => c.id === selectedTimerCategoryId)?.name : null;
                        const name = [clientName, categoryName].filter(Boolean).join(' - ') || 'Job';
                        setJobTimerJobName(name);
                        setSelectedTimerClientId(clientId);
                        setJobTimerStartedAt(Date.now());
                        setJobTimerElapsed(0);
                        setJobTimerRunning(true);
                        setJobTimerSaved(false);
                        setJobTimerActualStart(new Date());
                      }}
                      activeOpacity={0.8}
                    >
                      <LinearGradient colors={['#1e6b3f', '#3ab56e']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 16 }}>
                        <Play size={18} color="#fff" />
                        <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>Start Timer</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </>
                ) : (
                  <View style={{ alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 13, color: colors.text, fontWeight: '600', textAlign: 'center' }} numberOfLines={2}>{jobTimerJobName}</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                      {selectedTimerClientId && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary + '12', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                          <UserCircle size={12} color={colors.primary} />
                          <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '500' }}>
                            {clients.find(c => c.id === selectedTimerClientId)?.name || 'Client'}
                          </Text>
                        </View>
                      )}
                      {selectedTimerCategoryId && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f59e0b' + '18', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                          <Package size={11} color="#f59e0b" />
                          <Text style={{ fontSize: 11, color: '#b45309', fontWeight: '500' }}>
                            {jobCategories.find(c => c.id === selectedTimerCategoryId)?.name || 'Category'}
                          </Text>
                        </View>
                      )}
                      {selectedTimerCategoryId && (() => {
                        const cat = jobCategories.find(c => c.id === selectedTimerCategoryId);
                        if (!cat?.scope_options) return null;
                        return (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#0ea5e918', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                            <Text style={{ fontSize: 11, color: '#0369a1', fontWeight: '600' }}>
                              {selectedTimerServiceScope === 'exterior_only' ? 'Exterior Only' : 'Full Service'}
                            </Text>
                          </View>
                        );
                      })()}
                    </View>
                    <Text style={{ fontSize: 36, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'], letterSpacing: 1 }}>
                      {(() => {
                        const ms = jobTimerRunning ? Date.now() - jobTimerStartedAt : jobTimerElapsed;
                        const totalSec = Math.floor(ms / 1000);
                        const h = Math.floor(totalSec / 3600);
                        const m = Math.floor((totalSec % 3600) / 60);
                        const sec = totalSec % 60;
                        const pad = (n: number) => n.toString().padStart(2, '0');
                        return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
                      })()}
                    </Text>

                    {!jobTimerRunning && !jobTimerSaved && (
                      <View style={{ width: '100%', marginTop: 4, marginBottom: 2 }}>
                        <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, marginBottom: 4, textAlign: 'center' }}>
                          {selectedTimerAddressId ? 'Assigned Address' : 'Assign to Address'}
                        </Text>

                        {selectedTimerAddressId ? (
                          <View style={{ width: '100%', gap: 6 }}>
                            {(() => {
                              const selected = allTimerAddresses.find(a => a.id === selectedTimerAddressId);
                              if (!selected) return null;
                              return (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primary + '12', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.primary + '30', overflow: 'hidden' }}>
                                  <MapPin size={14} color={colors.primary} style={{ flexShrink: 0 }} />
                                  <View style={{ flex: 1, minWidth: 0 }}>
                                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary }} numberOfLines={1}>{selected.clientName}</Text>
                                    <Text style={{ fontSize: 11, color: colors.primary, opacity: 0.8 }} numberOfLines={1}>
                                      {selected.label ? `${selected.label} - ` : ''}{selected.address_line1}{selected.city ? `, ${selected.city}` : ''}
                                    </Text>
                                  </View>
                                  <TouchableOpacity
                                    onPress={() => { setSelectedTimerAddressId(null); setSelectedTimerClientId(null); setTimerAddressSearch(''); }}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    style={{ flexShrink: 0 }}
                                  >
                                    <X size={16} color={colors.primary} />
                                  </TouchableOpacity>
                                </View>
                              );
                            })()}
                          </View>
                        ) : (
                          <>
                            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10, marginBottom: 6 }}>
                              <Search size={14} color={colors.textSecondary} />
                              <TextInput
                                style={{ flex: 1, paddingVertical: 8, paddingHorizontal: 8, fontSize: 13, color: colors.text, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) } as any}
                                placeholder="Search clients..."
                                placeholderTextColor={colors.textSecondary}
                                value={timerAddressSearch}
                                onChangeText={setTimerAddressSearch}
                              />
                              {timerAddressSearch.length > 0 && (
                                <TouchableOpacity onPress={() => setTimerAddressSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                  <X size={14} color={colors.textSecondary} />
                                </TouchableOpacity>
                              )}
                            </View>
                            <View style={{ backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', maxHeight: 260 }}>
                              <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                                {(() => {
                                  const query = timerAddressSearch.toLowerCase().trim();
                                  const clientAddressMap: Record<string, typeof allTimerAddresses> = {};
                                  allTimerAddresses.forEach(addr => {
                                    if (!clientAddressMap[addr.clientId]) clientAddressMap[addr.clientId] = [];
                                    clientAddressMap[addr.clientId].push(addr);
                                  });

                                  const clientsWithDist = clients.map(c => {
                                    const addrs = clientAddressMap[c.id] || [];
                                    let minDist: number | null = null;
                                    addrs.forEach(a => {
                                      if (a.distance != null && (minDist == null || a.distance < minDist)) minDist = a.distance;
                                    });
                                    if (minDist == null && c.latitude && c.longitude && currentLocation) {
                                      minDist = getDistanceKm(currentLocation.latitude, currentLocation.longitude, c.latitude, c.longitude);
                                    }
                                    return { ...c, addresses: addrs, minDistance: minDist };
                                  });

                                  const filtered = clientsWithDist.filter(c => {
                                    if (!query) return true;
                                    return c.name.toLowerCase().includes(query) ||
                                      c.address?.toLowerCase().includes(query) ||
                                      c.addresses.some(a =>
                                        a.label?.toLowerCase().includes(query) ||
                                        a.address_line1?.toLowerCase().includes(query) ||
                                        a.city?.toLowerCase().includes(query)
                                      );
                                  });

                                  filtered.sort((a, b) => {
                                    if (a.minDistance != null && b.minDistance != null) return a.minDistance - b.minDistance;
                                    if (a.minDistance != null) return -1;
                                    if (b.minDistance != null) return 1;
                                    return a.name.localeCompare(b.name);
                                  });

                                  if (filtered.length === 0) {
                                    return <Text style={{ padding: 12, fontSize: 13, color: colors.textSecondary, textAlign: 'center' }}>No clients found</Text>;
                                  }

                                  return filtered.map((client) => {
                                    const distText = client.minDistance != null
                                      ? client.minDistance < 1
                                        ? `${Math.round(client.minDistance * 1000)}m`
                                        : `${client.minDistance.toFixed(1)}km`
                                      : null;
                                    const isNearby = client.minDistance != null && client.minDistance < 0.5;

                                    return (
                                      <View key={client.id}>
                                        <TouchableOpacity
                                          style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: client.addresses.length > 1 ? 0 : 1, borderBottomColor: colors.border + '60', gap: 10 }}
                                          onPress={() => {
                                            setSelectedTimerClientId(client.id);
                                            setTimerAddressSearch('');
                                            if (client.addresses.length === 1) {
                                              setSelectedTimerAddressId(client.addresses[0].id);
                                              setTimerClientAddresses(client.addresses);
                                            } else if (client.addresses.length === 0) {
                                              setSelectedTimerAddressId(null);
                                              setTimerClientAddresses([]);
                                            } else {
                                              const nearest = client.addresses.reduce((best, a) => {
                                                if (a.distance != null && (best == null || (best.distance != null && a.distance < best.distance))) return a;
                                                return best;
                                              }, null as typeof client.addresses[0] | null);
                                              setSelectedTimerAddressId(nearest?.id || client.addresses[0].id);
                                              setTimerClientAddresses(client.addresses);
                                            }
                                          }}
                                        >
                                          <MapPin size={14} color={isNearby ? '#10b981' : colors.textSecondary} />
                                          <View style={{ flex: 1 }}>
                                            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{client.name}</Text>
                                            {client.addresses.length <= 1 && client.address ? (
                                              <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }} numberOfLines={1}>{client.address}</Text>
                                            ) : null}
                                          </View>
                                          {distText && (
                                            <View style={{ backgroundColor: isNearby ? '#10b981' + '18' : colors.card, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                                              <Text style={{ fontSize: 10, fontWeight: '600', color: isNearby ? '#10b981' : colors.textSecondary }}>{distText}</Text>
                                            </View>
                                          )}
                                        </TouchableOpacity>
                                        {client.addresses.length > 1 && client.addresses
                                          .slice()
                                          .sort((a, b) => {
                                            if (a.distance != null && b.distance != null) return a.distance - b.distance;
                                            if (a.distance != null) return -1;
                                            if (b.distance != null) return 1;
                                            return 0;
                                          })
                                          .map((addr) => {
                                            const addrDistText = addr.distance != null
                                              ? addr.distance < 1 ? `${Math.round(addr.distance * 1000)}m` : `${addr.distance.toFixed(1)}km`
                                              : null;
                                            const addrNearby = addr.distance != null && addr.distance < 0.5;
                                            return (
                                              <TouchableOpacity
                                                key={addr.id}
                                                style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 32, paddingRight: 12, paddingVertical: 7, borderBottomWidth: 0, gap: 8 }}
                                                onPress={() => {
                                                  setSelectedTimerClientId(client.id);
                                                  setSelectedTimerAddressId(addr.id);
                                                  setTimerClientAddresses(client.addresses);
                                                  setTimerAddressSearch('');
                                                }}
                                              >
                                                <MapPin size={11} color={addrNearby ? '#10b981' : colors.textSecondary} />
                                                <View style={{ flex: 1 }}>
                                                  <Text style={{ fontSize: 12, color: colors.text }} numberOfLines={1}>
                                                    {addr.label || addr.address_line1 || addr.city || 'Address'}
                                                  </Text>
                                                  {addr.address_line1 && addr.label ? (
                                                    <Text style={{ fontSize: 10, color: colors.textSecondary, marginTop: 1 }} numberOfLines={1}>{[addr.address_line1, addr.city].filter(Boolean).join(', ')}</Text>
                                                  ) : null}
                                                </View>
                                                {addrDistText && (
                                                  <View style={{ backgroundColor: addrNearby ? '#10b981' + '18' : colors.card, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 5 }}>
                                                    <Text style={{ fontSize: 9, fontWeight: '600', color: addrNearby ? '#10b981' : colors.textSecondary }}>{addrDistText}</Text>
                                                  </View>
                                                )}
                                              </TouchableOpacity>
                                            );
                                          })}
                                        {client.addresses.length > 1 && (
                                          <View style={{ height: 1, backgroundColor: colors.border + '60', marginLeft: 12, marginRight: 12 }} />
                                        )}
                                      </View>
                                    );
                                  });
                                })()}
                              </ScrollView>
                            </View>
                          </>
                        )}
                      </View>
                    )}

                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
                      {jobTimerRunning ? (
                        <TouchableOpacity
                          style={{ borderRadius: 14, overflow: 'hidden' }}
                          onPress={() => { setJobTimerElapsed(Date.now() - jobTimerStartedAt); setJobTimerRunning(false); }}
                          activeOpacity={0.8}
                        >
                          <LinearGradient colors={['#991b1b', '#ef4444']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 24 }}>
                            <Square size={14} color="#fff" fill="#fff" />
                            <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>Stop</Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      ) : (
                        <>
                          <TouchableOpacity
                            style={{ borderRadius: 14, overflow: 'hidden' }}
                            onPress={() => { setJobTimerStartedAt(Date.now() - jobTimerElapsed); setJobTimerRunning(true); }}
                            activeOpacity={0.8}
                          >
                            <LinearGradient colors={['#1e6b3f', '#3ab56e']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 20 }}>
                              <Play size={14} color="#fff" />
                              <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>Resume</Text>
                            </LinearGradient>
                          </TouchableOpacity>
                          {selectedTimerClientId && !jobTimerSaved && (
                            <TouchableOpacity
                              style={{ borderRadius: 14, overflow: 'hidden', opacity: savingTimerSession ? 0.7 : 1 }}
                              onPress={async () => {
                                if (!user?.id || !currentOrganization?.id || !selectedTimerClientId || !jobTimerActualStart) return;
                                setSavingTimerSession(true);
                                try {
                                  const durationMs = jobTimerElapsed;
                                  const endTime = new Date(jobTimerActualStart.getTime() + durationMs);
                                  const insertPayload: any = {
                                    user_id: user.id,
                                    client_id: selectedTimerClientId,
                                    organization_id: currentOrganization.id,
                                    title: jobTimerJobName,
                                    start_time: jobTimerActualStart.toISOString(),
                                    end_time: endTime.toISOString(),
                                    payment_status: 'unpaid',
                                  };
                                  if (selectedTimerAddressId) {
                                    insertPayload.client_address_id = selectedTimerAddressId;
                                  }
                                  const { data: newEvent, error } = await supabase
                                    .from('schedule_events')
                                    .insert(insertPayload)
                                    .select('id')
                                    .maybeSingle();
                                  if (error) throw error;

                                  // If a category with scope options was selected, add a line item with scope
                                  const selectedCat = jobCategories.find(c => c.id === selectedTimerCategoryId);
                                  if (newEvent?.id && selectedCat?.scope_options && selectedTimerCategoryId) {
                                    const scope = selectedCat.scope_options === 'exterior_only'
                                      ? 'exterior_only'
                                      : selectedTimerServiceScope;
                                    await supabase.from('schedule_event_line_items').insert({
                                      schedule_event_id: newEvent.id,
                                      organization_id: currentOrganization.id,
                                      description: selectedCat.name,
                                      service_scope: scope,
                                      quantity: 1,
                                      unit_price: 0,
                                      total: 0,
                                    });
                                  }
                                  setJobTimerSaved(true);
                                  setShowInvoicePrompt(true);
                                  showToast({ message: 'Saved to client service history', type: 'success', duration: 3000 });
                                } catch (e: any) {
                                  showToast({ message: e.message || 'Failed to save', type: 'error', duration: 4000 });
                                } finally {
                                  setSavingTimerSession(false);
                                }
                              }}
                              activeOpacity={0.8}
                              disabled={savingTimerSession}
                            >
                              <LinearGradient colors={['#163e59', '#2d7ec4']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 20 }}>
                                {savingTimerSession ? (
                                  <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                  <Save size={14} color="#fff" />
                                )}
                                <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>Save to Client</Text>
                              </LinearGradient>
                            </TouchableOpacity>
                          )}
                          {jobTimerSaved && !showInvoicePrompt && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 16 }}>
                              <Check size={14} color="#10b981" />
                              <Text style={{ fontSize: 13, fontWeight: '600', color: '#10b981' }}>Saved</Text>
                            </View>
                          )}
                          {jobTimerSaved && showInvoicePrompt && (
                            <View style={{ backgroundColor: colors.primary + '10', borderRadius: 12, borderWidth: 1, borderColor: colors.primary + '25', padding: 12, gap: 8 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Check size={13} color="#10b981" />
                                <Text style={{ fontSize: 12, fontWeight: '600', color: '#10b981', flex: 1 }}>Job saved!</Text>
                              </View>
                              <Text style={{ fontSize: 12, color: colors.textSecondary }}>Create an invoice for this job?</Text>
                              <View style={{ flexDirection: 'row', gap: 8 }}>
                                <TouchableOpacity
                                  style={{ flex: 1, borderRadius: 8, overflow: 'hidden' }}
                                  onPress={() => {
                                    const clientName = clients.find(c => c.id === selectedTimerClientId)?.name || '';
                                    const categoryName = selectedTimerCategoryId ? jobCategories.find(c => c.id === selectedTimerCategoryId)?.name : null;
                                    const jobLabel = categoryName || jobTimerJobName || 'Service';
                                    setTimerInvoicePrefill({
                                      clientId: selectedTimerClientId!,
                                      items: [{ description: jobLabel, quantity: 1, unit_price: 0 }],
                                      notes: '',
                                    });
                                    setShowInvoicePrompt(false);
                                    setTimerInvoiceModalVisible(true);
                                  }}
                                  activeOpacity={0.8}
                                >
                                  <LinearGradient colors={['#163e59', '#2d7ec4']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 }}>
                                    <Receipt size={13} color="#fff" />
                                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#fff' }}>Create Invoice</Text>
                                  </LinearGradient>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}
                                  onPress={() => setShowInvoicePrompt(false)}
                                  activeOpacity={0.7}
                                >
                                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>Not now</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          )}
                          <TouchableOpacity
                            style={{ alignItems: 'center', justifyContent: 'center', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20, borderWidth: 1, borderColor: colors.border }}
                            onPress={() => { setJobTimerRunning(false); setJobTimerElapsed(0); setJobTimerJobName(''); setJobTimerSaved(false); setJobTimerActualStart(null); setSelectedTimerAddressId(null); setSelectedTimerClientId(null); setTimerClientAddresses([]); setTimerAddressSearch(''); setSelectedTimerCategoryId(null); setShowTimerJobTypePicker(false); setShowInvoicePrompt(false); }}
                            activeOpacity={0.8}
                          >
                            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>Reset</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </View>
                )}
              </View>

              {activeEntry ? (
                <View style={[timeTabStyles.statusCard, { backgroundColor: '#dcfce7', borderColor: '#86efac', marginHorizontal: SPACING.lg, marginTop: SPACING.md }]}>
                  <View style={[timeTabStyles.statusDot, { backgroundColor: '#16a34a' }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[timeTabStyles.statusTitle, { color: '#166534' }]}>
                      Clocked In Since {new Date(activeEntry.clock_in).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                    </Text>
                    {activeBreak && <Text style={[timeTabStyles.statusSub, { color: '#15803d' }]}>On Break</Text>}
                    {!activeBreak && locationStatus.type === 'job_site' && (
                      <Text style={[timeTabStyles.statusSub, { color: '#15803d' }]}>At {(locationStatus as any).clientName || 'Job Site'}</Text>
                    )}
                  </View>
                  <Text style={[timeTabStyles.statusTimer, { color: '#166534' }]}>{formatDuration(activeEntry.clock_in, null)}</Text>
                </View>
              ) : (
                <View style={[timeTabStyles.statusCard, { backgroundColor: colors.cardBackground, borderColor: colors.border, marginHorizontal: SPACING.lg, marginTop: SPACING.md }]}>
                  <View style={[timeTabStyles.statusDot, { backgroundColor: colors.border }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[timeTabStyles.statusTitle, { color: colors.text }]}>You&apos;re Clocked Out</Text>
                    {(() => {
                      const myEntries = entries.filter(e => e.user_id === user?.id && e.clock_out);
                      if (myEntries.length === 0) return null;
                      const last = myEntries.sort((a, b) => new Date(b.clock_in).getTime() - new Date(a.clock_in).getTime())[0];
                      return <Text style={[timeTabStyles.statusSub, { color: colors.textSecondary }]}>
                        Last: {new Date(last.clock_in).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {formatDuration(last.clock_in, last.clock_out)}
                      </Text>;
                    })()}
                  </View>
                </View>
              )}

              {myWeekEntries.filter(e => e.clock_out).length > 0 && (
                <View style={[timeTabStyles.chartSection, { backgroundColor: colors.cardBackground, borderColor: colors.border, marginHorizontal: SPACING.lg, marginTop: SPACING.md }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <BarChart3 size={14} color={colors.primary} />
                    <Text style={[timeTabStyles.sectionTitle, { color: colors.text }]}>This Week</Text>
                  </View>
                  {(() => {
                    const DAY_NAMES = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
                    const days: { label: string; date: Date }[] = [];
                    for (let i = 0; i < 7; i++) {
                      const d = new Date(myWeekStart);
                      d.setDate(myWeekStart.getDate() + i);
                      days.push({ label: DAY_NAMES[d.getDay()], date: d });
                    }
                    const dayH = days.map(({ date }) => {
                      const key = date.toLocaleDateString('en-CA');
                      return myWeekEntries.filter(e => e.clock_out && new Date(e.clock_in).toLocaleDateString('en-CA') === key)
                        .reduce((s, e) => s + (new Date(e.clock_out!).getTime() - new Date(e.clock_in).getTime()) / 3600000, 0);
                    });
                    const maxH = Math.max(...dayH, 0.1);
                    const todayKey = new Date().toLocaleDateString('en-CA');
                    return (
                      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', height: 72 }}>
                        {days.map((day, i) => {
                          const h = dayH[i];
                          const barH = Math.max(h > 0 ? 6 : 2, (h / maxH) * 52);
                          const isToday = day.date.toLocaleDateString('en-CA') === todayKey;
                          const hasEntries = h > 0;
                          return (
                            <TouchableOpacity
                              key={i}
                              style={{ alignItems: 'center', flex: 1, gap: 3 }}
                              onPress={() => hasEntries && setSelectedDayKey(day.date.toLocaleDateString('en-CA'))}
                              activeOpacity={hasEntries ? 0.7 : 1}
                            >
                              {h > 0 && <Text style={{ fontSize: 8, fontWeight: '700', color: colors.primary }}>{`${h.toFixed(2)}h`}</Text>}
                              <View style={{ width: 12, height: barH, borderRadius: 5, backgroundColor: h > 0 ? (isToday ? colors.primary : colors.primary + 'bb') : (isDark ? '#2a3540' : '#e8f0f5') }} />
                              <Text style={{ fontSize: 10, fontWeight: isToday ? '700' : '400', color: isToday ? colors.primary : colors.textSecondary }}>{day.label}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    );
                  })()}
                </View>
              )}

              <View style={{ marginTop: SPACING.md }}>
                <View style={[timeTabStyles.viewModeRow, { borderBottomColor: colors.border }]}>
                  {(['all', 'week', 'weekly', 'monthly'] as const).map((m) => {
                    const labels: Record<string, string> = { all: 'All', week: 'This Week', weekly: 'Weekly', monthly: 'Monthly' };
                    const isActive = m === 'week' ? weekFilter : m === 'all' ? (viewMode === 'entries' && !weekFilter) : viewMode === m;
                    return (
                      <TouchableOpacity
                        key={m}
                        style={[timeTabStyles.viewModeBtn, isActive && { borderBottomColor: colors.primary }]}
                        onPress={() => {
                          if (m === 'week') { setViewMode('entries'); setWeekFilter(true); }
                          else if (m === 'all') { setViewMode('entries'); setWeekFilter(false); }
                          else { setViewMode(m as ViewMode); setWeekFilter(false); }
                          setSelectedDayKey(null);
                        }}
                      >
                        <Text style={[timeTabStyles.viewModeBtnText, { color: isActive ? colors.primary : colors.textSecondary, fontWeight: isActive ? '700' : '500' }]}>{labels[m]}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {selectedDayKey && viewMode === 'entries' && (() => {
                  const dayEntries = entries.filter(e => e.user_id === user?.id && new Date(e.clock_in).toLocaleDateString('en-CA') === selectedDayKey);
                  if (dayEntries.length === 0) return null;
                  return renderDayGroup(selectedDayKey, dayEntries);
                })()}

                {!selectedDayKey && viewMode === 'entries' && weekFilter && (() => {
                  const myEntries = filteredEntries.filter(e => !teamView || e.user_id === user?.id);
                  const grouped: { [dateKey: string]: TimeEntry[] } = {};
                  myEntries.forEach((entry) => {
                    const dateKey = new Date(entry.clock_in).toLocaleDateString('en-CA');
                    if (!grouped[dateKey]) grouped[dateKey] = [];
                    grouped[dateKey].push(entry);
                  });
                  return Object.entries(grouped)
                    .sort(([a], [b]) => b.localeCompare(a))
                    .map(([dateKey, dayEntries]) => renderDayGroup(dateKey, dayEntries));
                })()}

                {!selectedDayKey && viewMode === 'entries' && !weekFilter && (() => {
                  const myEntries = filteredEntries.filter(e => !teamView || e.user_id === user?.id);
                  const weekSections = generateEntriesWeekSections(myEntries);
                  if (weekSections.length === 0) return null;
                  return weekSections.map((section) => {
                    const isExpanded = expandedWeeks.has(section.weekKey);
                    const decimalHours = parseFloat(formatDecimalHours(section.totalHours, section.totalMinutes));
                    const totalLabel = section.totalHours > 0
                      ? `${section.totalHours}h ${section.totalMinutes}m`
                      : `${section.totalMinutes}m`;
                    return (
                      <View key={section.weekKey} style={{ marginBottom: SPACING.sm }}>
                        <TouchableOpacity
                          activeOpacity={0.75}
                          onPress={() => toggleWeekExpansion(section.weekKey)}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginHorizontal: SPACING.lg,
                            paddingHorizontal: 14,
                            paddingVertical: 11,
                            backgroundColor: colors.cardBackground,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: isDark ? 'rgba(255,255,255,0.1)' : CARD.borderColor,
                            ...Platform.select({
                              web: { boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
                              default: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
                            }),
                          }}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{section.displayDate}</Text>
                            <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                              {section.dayGroups.length} {section.dayGroups.length === 1 ? 'day' : 'days'} · {section.dayGroups.reduce((s, d) => s + d.dayEntries.length, 0)} entries
                            </Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={{ fontSize: 17, fontWeight: '800', color: colors.primary, letterSpacing: -0.3 }}>{totalLabel}</Text>
                            {isExpanded
                              ? <ChevronUp size={18} color={colors.textSecondary} />
                              : <ChevronDown size={18} color={colors.textSecondary} />}
                          </View>
                        </TouchableOpacity>
                        {isExpanded && (
                          <View style={{ marginTop: SPACING.xs }}>
                            {section.dayGroups.map(({ dateKey, dayEntries }) => renderDayGroup(dateKey, dayEntries))}
                          </View>
                        )}
                      </View>
                    );
                  });
                })()}
                {viewMode === 'weekly' && weeklyReports.map((r) => renderReport(r, 'weekly'))}
                {viewMode === 'monthly' && monthlyReports.map((r) => renderReport(r, 'monthly'))}
              </View>
            </>
          )}

          {mainTab === 'team' && isAdminOrManager && (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingVertical: SPACING.md }}>
                <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: SPACING.lg }}>
                  {(['this_week', 'last_week', 'this_month'] as const).map((preset) => {
                    const labels = { this_week: 'This Week', last_week: 'Last Week', this_month: 'This Month' };
                    return (
                      <TouchableOpacity
                        key={preset}
                        style={[timeTabStyles.presetChip, teamDatePreset === preset && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                        onPress={() => setTeamDatePreset(preset)}
                        activeOpacity={0.8}
                      >
                        <Text style={[timeTabStyles.presetChipText, { color: teamDatePreset === preset ? '#fff' : colors.textSecondary }]}>{labels[preset]}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              <View style={[timeTabStyles.teamSummaryGrid, { paddingHorizontal: SPACING.lg }]}>
                <View style={[timeTabStyles.teamSummaryCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                  <Text style={[timeTabStyles.teamSummaryLabel, { color: colors.textSecondary }]}>Total Hours</Text>
                  <Text style={[timeTabStyles.teamSummaryValue, { color: colors.primary }]}>{teamTotalHours.toFixed(2)}h</Text>
                </View>
                <View style={[timeTabStyles.teamSummaryCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                  <Text style={[timeTabStyles.teamSummaryLabel, { color: colors.textSecondary }]}>Overtime</Text>
                  <Text style={[timeTabStyles.teamSummaryValue, { color: teamOvertimeHours > 0 ? '#f59e0b' : colors.textSecondary }]}>
                    {teamOvertimeHours > 0 ? `+${teamOvertimeHours.toFixed(2)}h` : '0h'}
                  </Text>
                </View>
                <View style={[timeTabStyles.teamSummaryCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                  <Text style={[timeTabStyles.teamSummaryLabel, { color: colors.textSecondary }]}>Sessions</Text>
                  <Text style={[timeTabStyles.teamSummaryValue, { color: colors.text }]}>{teamEntries.length}</Text>
                </View>
                <View style={[timeTabStyles.teamSummaryCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                  <Text style={[timeTabStyles.teamSummaryLabel, { color: colors.textSecondary }]}>Active</Text>
                  <Text style={[timeTabStyles.teamSummaryValue, { color: colors.text }]}>{teamActiveEmployees}</Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: SPACING.lg, marginTop: SPACING.sm }}>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1B4D6E', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 }}
                  onPress={() => {
                    const pdfEntries: TimeEntryForPdf[] = teamEntries.map(e => ({
                      id: e.id,
                      clock_in: e.clock_in,
                      clock_out: e.clock_out,
                      notes: e.notes,
                      user_id: e.user_id,
                      user_name: e.user_name,
                      user_email: e.user_email,
                      breaks: e.breaks,
                    }));
                    generatePayrollSummaryPDF(pdfEntries, teamRange.start, teamRange.end, currentOrganization?.name);
                  }}
                  activeOpacity={0.8}
                >
                  <FileText size={15} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Payroll PDF</Text>
                </TouchableOpacity>
              </View>

              <View style={{ marginTop: SPACING.md }}>
                <Text style={[timeTabStyles.sectionHeader, { color: colors.textSecondary, paddingHorizontal: SPACING.lg }]}>
                  EMPLOYEES · {teamEmployeeData.length}
                </Text>
                {teamEmployeeData.map(([userId, emp]) => {
                  const maxH = Math.max(...teamEmployeeData.map(([, e]) => e.hours), 0.1);
                  const pct = (emp.hours / maxH) * 100;
                  const overtimeH = calcOvertimeForEntries(teamEntries.filter(e => e.user_id === userId));
                  const activeTeamEntry = emp.isActive ? teamEntries.find(e => e.user_id === userId && !e.clock_out) : undefined;
                  const clockedInDuration = activeTeamEntry
                    ? (() => {
                        const mins = Math.floor((Date.now() - new Date(activeTeamEntry.clock_in).getTime()) / 60000);
                        const h = Math.floor(mins / 60);
                        const m = mins % 60;
                        return h > 0 ? `${h}h ${m}m` : `${m}m`;
                      })()
                    : null;
                  return (
                    <View
                      key={userId}
                      style={[timeTabStyles.employeeRow, { borderBottomColor: colors.border }]}
                    >
                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 0 }}
                        onPress={() => setSelectedEmployeeDetail({ userId, name: emp.name, email: emp.email })}
                        activeOpacity={0.7}
                      >
                        <View style={[timeTabStyles.empAvatar, { backgroundColor: emp.isActive ? '#16a34a20' : colors.primary + '20' }]}>
                          <User size={16} color={emp.isActive ? '#16a34a' : colors.primary} />
                        </View>
                        <View style={{ flex: 1, gap: 4 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={[timeTabStyles.empName, { color: colors.text }]}>{emp.name}</Text>
                            <Text style={[timeTabStyles.empHours, { color: colors.primary }]}>{emp.hours.toFixed(2)}h</Text>
                          </View>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={[timeTabStyles.empMeta, { color: colors.textSecondary }]}>
                              {emp.entries} entr{emp.entries === 1 ? 'y' : 'ies'}
                              {overtimeH > 0 && ` · +${overtimeH.toFixed(2)}h OT`}
                            </Text>
                            {emp.isActive && (
                              <View style={timeTabStyles.activeBadge}>
                                <View style={timeTabStyles.activeDot} />
                                <Text style={timeTabStyles.activeBadgeText}>{clockedInDuration ?? 'Active'}</Text>
                              </View>
                            )}
                          </View>
                          <View style={[timeTabStyles.empBar, { backgroundColor: colors.border }]}>
                            <View style={[timeTabStyles.empBarFill, { width: `${pct}%` as any, backgroundColor: emp.isActive ? '#16a34a' : colors.primary }]} />
                          </View>
                        </View>
                        <ChevronDown size={14} color={colors.textSecondary} style={{ transform: [{ rotate: '-90deg' }], marginLeft: 8 }} />
                      </TouchableOpacity>
                      {emp.isActive && activeTeamEntry && (
                        <TouchableOpacity
                          style={{ backgroundColor: '#dc2626', borderRadius: 7, paddingHorizontal: 10, paddingVertical: 6, marginLeft: 8 }}
                          onPress={() => handleClockOut(activeTeamEntry, true)}
                          activeOpacity={0.7}
                        >
                          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>Clock Out</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
                {teamEmployeeData.length === 0 && (
                  <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                    <Users size={32} color={colors.textSecondary} />
                    <Text style={{ color: colors.textSecondary, marginTop: 10, fontSize: 14 }}>No entries for this period</Text>
                  </View>
                )}
              </View>
            </>
          )}
        </ScrollView>

        <View style={dynamicStyles.bottomActionBar}>
          <View style={dynamicStyles.bottomActionInner}>
            {activeEntry ? (
              <>
                <TouchableOpacity
                  style={dynamicStyles.clockOutButton}
                  onPress={() => handleClockOut(undefined, false)}
                  activeOpacity={0.85}
                >
                  <LinearGradient colors={['#163e59', '#2d7ec4']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 18 }}>
                    <Square size={20} color="#ffffff" />
                    <Text style={dynamicStyles.clockButtonLabel}>Clock Out</Text>
                  </LinearGradient>
                </TouchableOpacity>
                {activeBreak ? (
                  <TouchableOpacity
                    style={[dynamicStyles.breakActionButton, { backgroundColor: '#d1fae5', borderColor: '#10b981' }]}
                    onPress={handleBreakAction}
                    activeOpacity={0.85}
                  >
                    <Coffee size={20} color="#047857" />
                    <Text style={[dynamicStyles.breakActionButtonText, { color: '#047857' }]}>End Break</Text>
                  </TouchableOpacity>
                ) : breakPolicies.length >= 2 ? (
                  <View style={[dynamicStyles.breakActionButton, { flexDirection: 'row', padding: 0, overflow: 'hidden', backgroundColor: 'transparent', borderColor: '#38bdf8' }]}>
                    <TouchableOpacity
                      style={{ flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, backgroundColor: '#e0f2fe', borderRightWidth: 1, borderRightColor: '#bae6fd', gap: 2 }}
                      onPress={() => startBreakWithPolicy(breakPolicies[0].id)}
                      activeOpacity={0.85}
                    >
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: breakPolicies[0].color, marginBottom: 2 }} />
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#0284c7' }} numberOfLines={1}>{breakPolicies[0].name}</Text>
                      <Text style={{ fontSize: 10, color: '#0369a1' }}>{breakPolicies[0].duration_minutes}m</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, backgroundColor: '#f0f9ff', gap: 2 }}
                      onPress={() => startBreakWithPolicy(breakPolicies[1].id)}
                      activeOpacity={0.85}
                    >
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: breakPolicies[1].color, marginBottom: 2 }} />
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#0284c7' }} numberOfLines={1}>{breakPolicies[1].name}</Text>
                      <Text style={{ fontSize: 10, color: '#0369a1' }}>{breakPolicies[1].duration_minutes}m</Text>
                    </TouchableOpacity>
                  </View>
                ) : breakPolicies.length === 1 ? (
                  <TouchableOpacity
                    style={[dynamicStyles.breakActionButton, { backgroundColor: '#e0f2fe', borderColor: '#38bdf8' }]}
                    onPress={() => startBreakWithPolicy(breakPolicies[0].id)}
                    activeOpacity={0.85}
                  >
                    <Coffee size={20} color="#0284c7" />
                    <Text style={[dynamicStyles.breakActionButtonText, { color: '#0284c7' }]}>{breakPolicies[0].name}</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[dynamicStyles.breakActionButton, { backgroundColor: '#e0f2fe', borderColor: '#38bdf8' }]}
                    onPress={handleBreakAction}
                    activeOpacity={0.85}
                  >
                    <Coffee size={20} color="#0284c7" />
                    <Text style={[dynamicStyles.breakActionButtonText, { color: '#0284c7' }]}>Break</Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <TouchableOpacity
                style={dynamicStyles.clockInButton}
                onPress={handleClockIn}
                activeOpacity={0.85}
              >
                <LinearGradient colors={['#1e6b3f', '#3ab56e']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 18 }}>
                  <Play size={22} color="#ffffff" />
                  <Text style={dynamicStyles.clockButtonLabel}>Clock In</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <JobDepartureModal
          visible={showDepartureModal}
          clientName={currentSession?.client?.name || (locationStatus as any).clientName || 'Unknown'}
          onDismiss={() => setShowDepartureModal(false)}
          onConfirm={handleDepartureConfirm}
        />

        <ClientSelectionModal
          visible={showClientSelection}
          nearbyClients={nearbyClients}
          onDismiss={() => {
            setShowClientSelection(false);
            setPendingPhoto(null);
            setNearbyClients([]);
          }}
          onSelect={handleClientSelect}
        />

        <SessionHistoryModal
          visible={showSessionHistory}
          onClose={() => setShowSessionHistory(false)}
        />

        <Modal
          visible={showBreakTypeModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowBreakTypeModal(false)}
        >
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
            activeOpacity={1}
            onPress={() => setShowBreakTypeModal(false)}
          >
            <TouchableOpacity activeOpacity={1}>
              <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <Coffee size={20} color={colors.primary} />
                  <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>Start a Break</Text>
                </View>
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 20 }}>
                  Select a break type. You will be notified when time is up.
                </Text>

                {breakPolicies.map((policy) => (
                  <TouchableOpacity
                    key={policy.id}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 12, marginBottom: 10, backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.border }}
                    onPress={() => startBreakWithPolicy(policy.id)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: policy.color }} />
                      <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>{policy.name}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 13, color: colors.textSecondary }}>{policy.duration_minutes} min</Text>
                      {policy.notify_on_expiry && <Bell size={13} color={colors.primary} />}
                    </View>
                  </TouchableOpacity>
                ))}

                <TouchableOpacity
                  style={{ padding: 14, borderRadius: 12, backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.border, alignItems: 'center', marginTop: 4 }}
                  onPress={() => startBreakWithPolicy(null)}
                >
                  <Text style={{ fontSize: 14, color: colors.textSecondary }}>Start Untracked Break</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        <ProductivityReportModal
          visible={showProductivityReport}
          onClose={() => {
            setShowProductivityReport(false);
            setSelectedEntryId(undefined);
          }}
          timeEntryId={selectedEntryId}
        />

        <Modal
          visible={moreMenuVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setMoreMenuVisible(false)}
        >
          <TouchableOpacity
            style={{
              flex: 1,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              justifyContent: 'flex-start',
              alignItems: 'flex-end',
              paddingTop: 60,
              paddingRight: 16,
            }}
            activeOpacity={1}
            onPress={() => setMoreMenuVisible(false)}
          >
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: 12,
                padding: 8,
                minWidth: 200,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 3.84,
                elevation: 5,
              }}
            >
              {isAdminOrManager && (
                <>
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: 12,
                      gap: 12,
                    }}
                    onPress={() => {
                      setMoreMenuVisible(false);
                      setLiveCrewVisible(true);
                    }}
                  >
                    <Radio size={20} color={colors.text} />
                    <Text style={{ color: colors.text, fontSize: 16 }}>Live Crew Tracker</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: 12,
                      gap: 12,
                    }}
                    onPress={() => {
                      setMoreMenuVisible(false);
                      setCrewMapVisible(true);
                    }}
                  >
                    <Map size={20} color={colors.text} />
                    <Text style={{ color: colors.text, fontSize: 16 }}>Crew Location Map</Text>
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 12,
                  gap: 12,
                }}
                onPress={() => {
                  setMoreMenuVisible(false);
                  setShowSessionHistory(true);
                }}
              >
                <Clock size={20} color={colors.text} />
                <Text style={{ color: colors.text, fontSize: 16 }}>Session History</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 12,
                  gap: 12,
                }}
                onPress={() => {
                  setMoreMenuVisible(false);
                  setShowProductivityReport(true);
                }}
              >
                <BarChart3 size={20} color={colors.text} />
                <Text style={{ color: colors.text, fontSize: 16 }}>Productivity Report</Text>
              </TouchableOpacity>
              {isAdminOrManager && (
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 }}
                  onPress={() => { setMoreMenuVisible(false); setShowBulkDeleteModal(true); }}
                >
                  <Trash2 size={20} color="#dc2626" />
                  <Text style={{ color: '#dc2626', fontSize: 16 }}>Clear Entries</Text>
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        </Modal>

        <Modal visible={showBulkDeleteModal} transparent animationType="slide" onRequestClose={() => setShowBulkDeleteModal(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 4 }}>Clear Time Entries</Text>
              <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 20 }}>Choose which entries to delete. This action cannot be undone.</Text>

              {(['all', 'year', 'user'] as const).map((mode) => (
                <TouchableOpacity
                  key={mode}
                  onPress={() => setBulkDeleteMode(mode)}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 12 }}
                >
                  <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: bulkDeleteMode === mode ? colors.primary : colors.border, alignItems: 'center', justifyContent: 'center' }}>
                    {bulkDeleteMode === mode && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary }} />}
                  </View>
                  <Text style={{ color: colors.text, fontSize: 15 }}>
                    {mode === 'all' ? 'All entries (mine only)' : mode === 'year' ? `Entries from a specific year` : 'Entries by a specific user'}
                  </Text>
                </TouchableOpacity>
              ))}

              {bulkDeleteMode === 'year' && (
                <View style={{ marginTop: 16 }}>
                  <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 8 }}>Select year to delete:</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {[new Date().getFullYear() - 2, new Date().getFullYear() - 1, new Date().getFullYear()].map((yr) => (
                      <TouchableOpacity key={yr} onPress={() => setBulkDeleteYear(yr)}
                        style={{ paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1.5, borderColor: bulkDeleteYear === yr ? colors.primary : colors.border, backgroundColor: bulkDeleteYear === yr ? colors.primary + '15' : colors.inputBackground }}>
                        <Text style={{ color: bulkDeleteYear === yr ? colors.primary : colors.textSecondary, fontWeight: bulkDeleteYear === yr ? '700' : '400' }}>{yr}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {bulkDeleteMode === 'user' && isAdminOrManager && (
                <View style={{ marginTop: 16 }}>
                  <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 8 }}>Select team member:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {profiles.map((p) => (
                        <TouchableOpacity key={p.id} onPress={() => setBulkDeleteUserId(p.id)}
                          style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1.5, borderColor: bulkDeleteUserId === p.id ? colors.primary : colors.border, backgroundColor: bulkDeleteUserId === p.id ? colors.primary + '15' : colors.inputBackground }}>
                          <Text style={{ color: bulkDeleteUserId === p.id ? colors.primary : colors.textSecondary, fontWeight: bulkDeleteUserId === p.id ? '700' : '400' }}>
                            {p.display_name || p.email?.split('@')[0] || 'Unknown'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              )}

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
                <TouchableOpacity onPress={() => setShowBulkDeleteModal(false)} style={{ flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}>
                  <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleBulkDelete}
                  disabled={bulkDeleting || (bulkDeleteMode === 'user' && !bulkDeleteUserId)}
                  style={{ flex: 1, borderRadius: 12, overflow: 'hidden', opacity: (bulkDeleting || (bulkDeleteMode === 'user' && !bulkDeleteUserId)) ? 0.5 : 1 }}
                >
                  <LinearGradient colors={['#dc2626', '#b91c1c']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingVertical: 14, alignItems: 'center' }}>
                    {bulkDeleting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Delete</Text>}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <AutoClockOutPrompt
          visible={showAutoClockOutPrompt}
          onClockOut={handleAutoClockOut}
          onDismiss={handleDismissAutoClockOut}
          minutesAway={autoClockOutMinutes}
        />

        <DetectedLocationsModal
          visible={showDetectedLocations}
          onClose={() => setShowDetectedLocations(false)}
          onCreateClient={handleCreateClientFromLocation}
          onCreateScheduledJob={handleCreateScheduledJobFromLocation}
          userId={user?.id || ''}
        />

        <ClientModal
          visible={showClientModal}
          client={null}
          onClose={() => {
            setShowClientModal(false);
            setLocationForNewClient(null);
            setClientPrefillName('');
            setClientPrefillPhone('');
            setClientPrefillAddress('');
            setClientPrefillLanguage('');
          }}
          onSave={handleClientModalSave}
          initialLatitude={locationForNewClient?.latitude}
          initialLongitude={locationForNewClient?.longitude}
          prefillName={clientPrefillName || undefined}
          prefillPhone={clientPrefillPhone || undefined}
          prefillAddress={clientPrefillAddress || undefined}
          prefillLanguage={clientPrefillLanguage || undefined}
        />

        <ScheduleModal
          visible={showScheduleModal}
          event={null}
          onClose={() => {
            setShowScheduleModal(false);
            setLocationForSchedule(null);
          }}
          onSave={handleScheduleModalSave}
          initialLatitude={locationForSchedule?.latitude}
          initialLongitude={locationForSchedule?.longitude}
        />

        <LiveCrewTracker
          visible={liveCrewVisible}
          onClose={() => setLiveCrewVisible(false)}
        />

        <CrewLocationMap
          visible={crewMapVisible}
          onClose={() => setCrewMapVisible(false)}
        />

        <LocationContextModal
          visible={!!locationContextPrompt}
          prompt={locationContextPrompt}
          onDismiss={() => setLocationContextPrompt(null)}
          onStartWork={handleStartWorkAtJob}
          onSetContext={handleSetLocationContext}
          onAddJobSite={handleAddJobSite}
        />

        <StationaryStopPrompt
          visible={!!stationaryStopData}
          data={stationaryStopData}
          onDismiss={() => setStationaryStopData(null)}
          onStartJobTimer={handleStationaryJobTimer}
          onSetContext={handleStationaryContext}
          onAddAsJobSite={stationaryStopData ? () => {
            setLocationForNewClient({ latitude: stationaryStopData.latitude, longitude: stationaryStopData.longitude });
            setStationaryStopData(null);
            setShowClientModal(true);
          } : undefined}
        />

        <EquipmentChecklistModal
          visible={showEquipmentChecklist}
          onClose={() => {
            setShowEquipmentChecklist(false);
            if (getFirstJobWithAddress()) setTimeout(() => setShowDirectionsPrompt(true), 400);
          }}
        />

        <Modal visible={showEquipmentPrompt} transparent animationType="fade" onRequestClose={() => setShowEquipmentPrompt(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
            <View style={{ backgroundColor: colors.cardBackground, borderRadius: 20, padding: 28, width: '100%', maxWidth: 360, alignItems: 'center', ...Platform.select({ web: { boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }, default: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 32 } }) }}>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#059669' + '18', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                <Package size={28} color="#059669" />
              </View>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 8, textAlign: 'center' }}>Equipment Needed Today?</Text>
              <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 24 }}>Would you like to review the equipment needed for today's jobs?</Text>
              <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
                <TouchableOpacity
                  style={{ flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}
                  onPress={() => {
                    setShowEquipmentPrompt(false);
                    if (getFirstJobWithAddress()) setTimeout(() => setShowDirectionsPrompt(true), 400);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textSecondary }}>No</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#059669', alignItems: 'center' }}
                  onPress={() => { setShowEquipmentPrompt(false); setShowEquipmentChecklist(true); }}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>Yes</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {(() => {
          const directionsJob = getFirstJobWithAddress();
          return (
            <Modal visible={showDirectionsPrompt} transparent animationType="fade" onRequestClose={() => setShowDirectionsPrompt(false)}>
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
                <View style={{ backgroundColor: colors.cardBackground, borderRadius: 20, padding: 28, width: '100%', maxWidth: 360, alignItems: 'center', ...Platform.select({ web: { boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }, default: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 32 } }) }}>
                  <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary + '18', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                    <Navigation size={28} color={colors.primary} />
                  </View>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 8, textAlign: 'center' }}>Get Directions?</Text>
                  {directionsJob && (
                    <>
                      <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 4 }}>
                        {directionsJob.client?.name || directionsJob.title}
                      </Text>
                      <Text style={{ fontSize: 13, color: colors.textTertiary, textAlign: 'center', lineHeight: 18, marginBottom: 24 }}>
                        {directionsJob.location || `${directionsJob.latitude}, ${directionsJob.longitude}`}
                      </Text>
                    </>
                  )}
                  {!directionsJob && (
                    <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 24 }}>
                      Open directions to your first job today?
                    </Text>
                  )}
                  <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
                    <TouchableOpacity
                      style={{ flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}
                      onPress={() => setShowDirectionsPrompt(false)}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textSecondary }}>No</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' }}
                      onPress={() => {
                        setShowDirectionsPrompt(false);
                        if (directionsJob) openDirectionsToJob(directionsJob);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>Yes</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
          );
        })()}

        {selectedEmployeeDetail && (
          <EmployeeHoursDetailModal
            visible={!!selectedEmployeeDetail}
            onClose={() => setSelectedEmployeeDetail(null)}
            employeeName={selectedEmployeeDetail.name}
            employeeEmail={selectedEmployeeDetail.email}
            entries={entries.filter(e => e.user_id === selectedEmployeeDetail.userId)}
            colors={colors}
            weekStartDay={weekStartDay}
            organizationName={currentOrganization?.name}
            isAdminOrManager={isAdminOrManager}
            startDate={teamRange.start}
            endDate={teamRange.end}
            targetUserId={selectedEmployeeDetail.userId}
            organizationId={currentOrganization?.id}
            onEntriesChanged={() => fetchEntries()}
          />
        )}
        <InvoiceModal
          visible={timerInvoiceModalVisible}
          invoice={null}
          prefill={timerInvoicePrefill}
          onClose={() => { setTimerInvoiceModalVisible(false); setTimerInvoicePrefill(null); }}
          onSave={() => { setTimerInvoiceModalVisible(false); setTimerInvoicePrefill(null); showToast({ message: 'Invoice created', type: 'success', duration: 2500 }); }}
        />

      <WorkflowFab
        actions={[{ id: 'addEntry', label: 'Add Entry', icon: Plus, color: '#1B4D6E', onPress: () => { setFabOpen(false); setShowAddEntryModal(true); } }]}
        isOpen={fabOpen}
        onToggle={() => setFabOpen(o => !o)}
        onClose={() => setFabOpen(false)}
        onQuickAction={handleQuickAction}
        dominantHand={dominantHand}
      />

      <AddTimeEntryModal
        visible={showAddEntryModal}
        onClose={() => setShowAddEntryModal(false)}
        onSaved={() => { fetchEntries(); showToast({ message: 'Time entry added', type: 'success', duration: 2500 }); }}
      />
      </View>
    </AnimatedTabContent>
  );
}

const timeTabStyles = StyleSheet.create({
  mainTabBar: {
    flexDirection: 'row',
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 10,
    padding: 3,
    gap: 3,
  },
  mainTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  mainTabBtnActive: {
    backgroundColor: '#fff',
    ...Platform.select({
      web: { boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } as any,
      default: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
    }),
  },
  mainTabBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  mainTabBtnTextActive: {
    fontWeight: '700' as const,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 10,
  },
  kpiCard: {
    flex: 1.4,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    gap: 4,
    ...Platform.select({ web: { boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }, default: {} }),
  },
  kpiCardSmall: {
    flex: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Platform.select({ web: { boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }, default: {} }),
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  kpiLabelSm: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  kpiValueSm: {
    fontSize: 16,
    fontWeight: '800',
  },
  kpiSub: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  statusCard: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...Platform.select({ web: { boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }, default: {} }),
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  statusSub: {
    fontSize: 12,
    marginTop: 2,
  },
  statusTimer: {
    fontSize: 16,
    fontWeight: '800',
  },
  chartSection: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    ...Platform.select({ web: { boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }, default: {} }),
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  viewModeRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    marginHorizontal: SPACING.lg,
    marginBottom: 4,
  },
  viewModeBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  viewModeBtnText: {
    fontSize: 12,
  },
  presetChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
  },
  presetChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  teamSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  teamSummaryCard: {
    flex: 1,
    minWidth: '40%',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    alignItems: 'center',
    ...Platform.select({ web: { boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }, default: {} }),
  },
  teamSummaryLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
    textAlign: 'center',
  },
  teamSummaryValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  sectionHeader: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: SPACING.md,
  },
  employeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  empAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  empName: {
    fontSize: 14,
    fontWeight: '700',
  },
  empHours: {
    fontSize: 16,
    fontWeight: '800',
  },
  empMeta: {
    fontSize: 11,
  },
  empBar: {
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  empBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16a34a',
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
  },
});