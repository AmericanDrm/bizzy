import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ChevronRight,
  Settings,
  Users,
  Receipt,
  DollarSign,
  Bell,
} from 'lucide-react-native';

const CAMERA_ICON_LIGHT = require('@/assets/images/QuickCameraLightModeIcon.png');
const CAMERA_ICON_DARK = require('@/assets/images/QuickCameraDarkModeIcon.png');
import ClientModal from '@/components/ClientModal';
import InvoiceModal from '@/components/InvoiceModal';
import ScheduleModal from '@/components/ScheduleModal';
import CallerIdHandler from '@/components/CallerIdHandler';
import FinanceModal from '@/components/FinanceModal';
import WorkflowFab from '@/components/WorkflowFab';
import WorkflowRescheduleModal from '@/components/WorkflowRescheduleModal';
import { supabase } from '@/lib/supabase';
import { orgSupabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useLayout } from '@/contexts/LayoutContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useWalkthrough } from '@/contexts/WalkthroughContext';
import { useTabNavigation } from '@/contexts/TabNavigationContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useResponsive } from '@/hooks/useResponsive';
import { CacheService } from '@/lib/cacheService';
import { AnimatedTabContent } from '@/components/AnimatedTabContent';
import { getSlideDirection, getDynamicTabOrder } from '@/utils/tabAnimations';
import WalkthroughWelcomeModal from '@/components/WalkthroughWelcomeModal';
import GettingStartedChecklist from '@/components/GettingStartedChecklist';
import { getUserWalkthroughStatus } from '@/lib/analyticsService';
import { useUserRole } from '@/hooks/useUserRole';
import getDynamicStyles from '@/styles/indexStyles';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuickActionHandler } from '@/hooks/useQuickActionHandler';
import { DashboardSkeleton } from '@/components/SkeletonLoader';
import * as Haptics from 'expo-haptics';

interface DashboardStats {
  totalClients: number;
  upcomingEvents: number;
  hoursThisWeek: number;
  jobsThisYear: number;
}

interface UserProfile {
  display_name: string | null;
}

interface UpcomingEvent {
  id: string;
  title: string;
  date: string;
  start_time: string;
  client_name?: string;
  status?: string;
}

interface ClientPrefill {
  name: string;
  phone: string;
  address: string;
  language: string;
}

const EMPTY_STATS: DashboardStats = { totalClients: 0, upcomingEvents: 0, hoursThisWeek: 0, jobsThisYear: 0 };
const EMPTY_PREFILL: ClientPrefill = { name: '', phone: '', address: '', language: '' };

const JOB_DOT_COLORS = ['#3a9ad9', '#3dba6f', '#f0a030', '#e05c5c', '#9b6fd4', '#38c4c4'];
const DASHBOARD_CACHE_TTL = 300;

const getJobColor = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return JOB_DOT_COLORS[Math.abs(hash) % JOB_DOT_COLORS.length];
};

const getGreeting = (t: (key: string) => string) => {
  const hour = new Date().getHours();
  if (hour < 12) return t('home_good_morning');
  if (hour < 17) return t('home_good_afternoon');
  return t('home_good_evening');
};

export default function HomeScreen() {
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [welcomeModalVisible, setWelcomeModalVisible] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [clientModalVisible, setClientModalVisible] = useState(false);
  const [clientPrefill, setClientPrefill] = useState<ClientPrefill>(EMPTY_PREFILL);
  const [invoiceModalVisible, setInvoiceModalVisible] = useState(false);
  const [expenseModalVisible, setExpenseModalVisible] = useState(false);
  const [rescheduleModalVisible, setRescheduleModalVisible] = useState(false);
  const [rescheduleEvent, setRescheduleEvent] = useState<{ id: string; title: string; start_time: string } | null>(null);
  const [callerScheduleVisible, setCallerScheduleVisible] = useState(false);
  const [callerSchedulePrefill, setCallerSchedulePrefill] = useState<{ clientId: string; clientName: string; phone: string; address: string } | null>(null);
  const [callerInvoiceClientId, setCallerInvoiceClientId] = useState<string | null>(null);

  const { user, signOut } = useAuth();
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const { isAdmin } = useUserRole();
  const { isWeb, isDesktop } = useResponsive();
  const dynamicStyles = getDynamicStyles(colors, isDark, isWeb && isDesktop);
  const { visibleCards, dominantHand } = useLayout();
  const { startWalkthrough } = useWalkthrough();
  const { currentOrganization } = useOrganization();
  const router = useRouter();
  const { currentTab, previousTab } = useTabNavigation();
  const { openSettings } = useSettings();

  const closeClientModal = useCallback(() => {
    setClientModalVisible(false);
    setClientPrefill(EMPTY_PREFILL);
  }, []);

  const handleCallerSchedule = useCallback((clientId: string, clientName: string, phone: string, address: string) => {
    setCallerSchedulePrefill({ clientId, clientName, phone, address });
    setCallerScheduleVisible(true);
  }, []);

  const handleCallerEstimate = useCallback((_clientId: string, _clientName: string) => {
    router.push('/(tabs)/invoices' as any);
  }, [router]);

  const handleCallerInvoice = useCallback((clientId: string, _clientName: string) => {
    setCallerInvoiceClientId(clientId);
    setInvoiceModalVisible(true);
  }, []);

  const handleCallerCreateClient = useCallback((phone: string) => {
    setClientPrefill({ name: '', phone, address: '', language: '' });
    setClientModalVisible(true);
  }, []);

  const handleQuickAction = useQuickActionHandler({
    onAddClient: (name, phone, address, language) => {
      setClientPrefill({ name: name || '', phone: phone || '', address: address || '', language: language || '' });
      setClientModalVisible(true);
    },
    onInvoiceClient: () => setInvoiceModalVisible(true),
    onAddExpense: () => setExpenseModalVisible(true),
    onRescheduleJob: (event) => {
      setRescheduleEvent(event);
      setRescheduleModalVisible(true);
    },
    onCreateEstimate: () => router.push('/(tabs)/invoices' as any),
    onSendInvoice: () => router.push('/(tabs)/invoices' as any),
    onSendEstimate: () => router.push('/(tabs)/invoices' as any),
  });

  const fetchUpcomingEvents = useCallback(async (orgId: string) => {
    const now = new Date();
    const endOfTomorrow = new Date(now);
    endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);
    endOfTomorrow.setHours(23, 59, 59, 999);
    const { data, count } = await orgSupabase
      .from('schedule_events')
      .select('id, title, start_time, status, clients(name)', { count: 'exact' })
      .eq('organization_id', orgId)
      .gte('start_time', now.toISOString())
      .lte('start_time', endOfTomorrow.toISOString())
      .order('start_time', { ascending: true })
      .limit(10);

    const events = (data || []).map((event: any) => {
      const startDate = new Date(event.start_time);
      return {
        id: event.id,
        title: event.title,
        date: startDate.toISOString().split('T')[0],
        start_time: startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        client_name: event.clients?.name,
        status: event.status,
      };
    });

    setUpcomingEvents(events);
    return { count: count || 0, events };
  }, []);

  const fetchWeeklyHours = useCallback(async (orgId: string) => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const { data } = await orgSupabase
      .from('time_entries')
      .select('clock_in, clock_out')
      .eq('organization_id', orgId)
      .gte('clock_in', startOfWeek.toISOString())
      .not('clock_out', 'is', null);

    const totalMinutes = (data || []).reduce((sum: number, entry: any) => {
      if (entry.clock_in && entry.clock_out) {
        const start = new Date(entry.clock_in).getTime();
        const end = new Date(entry.clock_out).getTime();
        return sum + (end - start) / (1000 * 60);
      }
      return sum;
    }, 0);
    return Math.round((totalMinutes / 60) * 10) / 10;
  }, []);

  const fetchDashboardData = useCallback(async (forceRefresh = false) => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    try {
      const orgId = currentOrganization.id;
      const cacheKey = `dashboard_stats_${orgId}`;

      if (!forceRefresh) {
        const cached = await CacheService.get<{ stats: DashboardStats; events: UpcomingEvent[] }>(cacheKey);
        if (cached) {
          setStats(cached.stats);
          setUpcomingEvents(cached.events);
          setLoading(false);
          return;
        }
      }

      const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString();
      const [clientsRes, eventsResult, timeRes, jobsRes] = await Promise.all([
        orgSupabase.from('clients').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
        fetchUpcomingEvents(orgId),
        fetchWeeklyHours(orgId),
        orgSupabase.from('schedule_events').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).gte('start_time', yearStart),
      ]);

      const newStats = {
        totalClients: clientsRes.count || 0,
        upcomingEvents: eventsResult.count,
        hoursThisWeek: timeRes,
        jobsThisYear: jobsRes.count || 0,
      };

      setStats(newStats);
      await CacheService.set(cacheKey, { stats: newStats, events: eventsResult.events }, DASHBOARD_CACHE_TTL);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id, fetchUpcomingEvents, fetchWeeklyHours]);

  const fetchUserProfile = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .maybeSingle();
      if (data) setUserProfile(data);
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  }, [user?.id]);

  const checkChecklistDismissed = useCallback(async () => {
    if (!currentOrganization?.id) return;
    try {
      const key = `checklist_dismissed_${currentOrganization.id}`;
      const val = await AsyncStorage.getItem(key);
      setShowChecklist(val !== 'true');
    } catch {
      setShowChecklist(true);
    }
  }, [currentOrganization?.id]);

  const checkWalkthroughStatus = useCallback(async () => {
    try {
      const status = await getUserWalkthroughStatus();
      if (!status.hasSeenPrompt && !status.completedAt) {
        setTimeout(() => setWelcomeModalVisible(true), 2000);
      }
    } catch (error) {
      console.error('Error checking walkthrough status:', error);
    }
  }, []);

  const handleDismissChecklist = useCallback(async () => {
    setShowChecklist(false);
    if (!currentOrganization?.id) return;
    try {
      await AsyncStorage.setItem(`checklist_dismissed_${currentOrganization.id}`, 'true');
    } catch {}
  }, [currentOrganization?.id]);

  useEffect(() => {
    const initializeHome = async () => {
      try {
        const promises: Promise<any>[] = [fetchUserProfile(), checkWalkthroughStatus()];
        if (currentOrganization?.id) {
          promises.push(fetchDashboardData(), checkChecklistDismissed());
        }
        await Promise.all(promises.map(p => p.catch(err => console.error('Init error:', err))));
      } catch (error) {
        console.error('Error initializing home screen:', error);
      }
    };

    initializeHome();
  }, [currentOrganization?.id]);

  const toggleFab = useCallback(() => setFabOpen(v => !v), []);
  const closeFab = useCallback(() => setFabOpen(false), []);

  const FAB_ACTIONS = useMemo(() => [
    { id: 'client', label: 'Add Client', icon: Users, color: '#1B4D6E', onPress: () => { closeFab(); setClientModalVisible(true); } },
    { id: 'invoice', label: 'New Invoice', icon: Receipt, color: '#059669', onPress: () => { closeFab(); setInvoiceModalVisible(true); } },
    { id: 'expense', label: 'Log Expense', icon: DollarSign, color: '#d97706', onPress: () => { closeFab(); setExpenseModalVisible(true); } },
  ], [closeFab]);

  const greeting = useMemo(() => getGreeting(t), [t]);

  const dynamicOrder = useMemo(() => getDynamicTabOrder(visibleCards), [visibleCards]);
  const slideDirection = useMemo(() => getSlideDirection(previousTab, currentTab, dynamicOrder), [previousTab, currentTab, dynamicOrder]);

  const STAT_CARDS = useMemo(() => [
    { label: "Today's Jobs", value: stats.upcomingEvents, color: colors.primary },
    { label: 'Total Clients', value: stats.totalClients, color: '#3dba6f' },
    { label: 'Jobs This Year', value: stats.jobsThisYear, color: '#f0a030' },
    { label: 'Hours This Week', value: stats.hoursThisWeek, color: '#38c4c4' },
  ], [stats, colors.primary]);

  return (
    <AnimatedTabContent
      activeTab={currentTab}
      tabKey="index"
      direction={slideDirection}
    >
      <View style={dynamicStyles.container}>
        <View style={dynamicStyles.header}>
          <View>
            <Text style={dynamicStyles.greeting}>{greeting}</Text>
            <Text style={dynamicStyles.welcomeText}>
              {userProfile?.display_name || t('home_welcome')}
            </Text>
          </View>
          {!(isWeb && isDesktop) && (
            <TouchableOpacity
              onPress={() => openSettings()}
              style={dynamicStyles.iconButton}
            >
              <Settings size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          style={dynamicStyles.content}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          {showChecklist && currentOrganization?.id && (
            <GettingStartedChecklist onDismiss={handleDismissChecklist} />
          )}

          {loading ? (
            <DashboardSkeleton />
          ) : (
            <>
              <View style={dynamicStyles.statsGrid}>
                {STAT_CARDS.map((card) => (
                  <View key={card.label} style={dynamicStyles.statCard}>
                    <Text style={[dynamicStyles.statValue, { color: card.color }]}>
                      {card.value}
                    </Text>
                    <Text style={dynamicStyles.statLabel}>{card.label}</Text>
                  </View>
                ))}
              </View>

              <View style={dynamicStyles.sectionHeader}>
                <Text style={dynamicStyles.sectionTitle}>Today's Jobs</Text>
                <TouchableOpacity
                  style={dynamicStyles.seeAllButton}
                  onPress={() => router.push('/(tabs)/schedule' as any)}
                >
                  <Text style={dynamicStyles.seeAllText}>See all</Text>
                  <ChevronRight size={14} color={colors.primary} />
                </TouchableOpacity>
              </View>

              {upcomingEvents.length === 0 ? (
                <View style={dynamicStyles.emptyState}>
                  <Text style={dynamicStyles.emptyStateText}>No jobs scheduled today</Text>
                </View>
              ) : (
                upcomingEvents.map((event) => (
                  <TouchableOpacity
                    key={event.id}
                    style={dynamicStyles.jobCard}
                    onPress={() => router.push('/(tabs)/schedule' as any)}
                    activeOpacity={0.7}
                  >
                    <View style={[dynamicStyles.jobDot, { backgroundColor: getJobColor(event.id) }]} />
                    <View style={dynamicStyles.jobDetails}>
                      <Text style={dynamicStyles.jobTitle}>{event.title}</Text>
                      {event.client_name && (
                        <Text style={dynamicStyles.jobMeta}>{event.client_name}</Text>
                      )}
                    </View>
                    <Text style={dynamicStyles.jobTime}>{event.start_time}</Text>
                  </TouchableOpacity>
                ))
              )}
            </>
          )}

          <TouchableOpacity
            style={dynamicStyles.cameraCard}
            onPress={() => {
              if (Platform.OS !== 'web') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              router.push('/(tabs)/camera');
            }}
          >
            <View style={dynamicStyles.cameraIconContainer}>
              <Image
                source={isDark ? CAMERA_ICON_DARK : CAMERA_ICON_LIGHT}
                style={{ width: 32, height: 32 }}
                resizeMode="contain"
              />
            </View>
            <View style={dynamicStyles.cameraCardContent}>
              <Text style={dynamicStyles.cameraCardTitle}>
                {Platform.OS === 'web' ? t('home_upload_photo') : t('home_quick_camera')}
              </Text>
              <Text style={dynamicStyles.cameraCardSubtitle}>
                {Platform.OS === 'web' ? t('home_upload_subtitle') : t('home_camera_subtitle')}
              </Text>
            </View>
            <ChevronRight size={24} color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>

        <WalkthroughWelcomeModal
          visible={welcomeModalVisible}
          onClose={() => setWelcomeModalVisible(false)}
        />

        <WorkflowFab
          actions={FAB_ACTIONS}
          isOpen={fabOpen}
          onToggle={toggleFab}
          onClose={closeFab}
          visible={!(isWeb && isDesktop)}
          onQuickAction={handleQuickAction}
          dominantHand={dominantHand}
        />

        <ClientModal
          visible={clientModalVisible}
          client={null}
          onClose={closeClientModal}
          onSave={closeClientModal}
          prefillName={clientPrefill.name || undefined}
          prefillPhone={clientPrefill.phone || undefined}
          prefillAddress={clientPrefill.address || undefined}
          prefillLanguage={clientPrefill.language || undefined}
        />
        <InvoiceModal
          visible={invoiceModalVisible}
          invoice={null}
          onClose={() => { setInvoiceModalVisible(false); setCallerInvoiceClientId(null); }}
          onSave={() => { setInvoiceModalVisible(false); setCallerInvoiceClientId(null); }}
          prefill={callerInvoiceClientId ? { clientId: callerInvoiceClientId, items: [] } : undefined}
        />
        <FinanceModal
          visible={expenseModalVisible}
          type="expense"
          item={null}
          onClose={() => setExpenseModalVisible(false)}
          onSave={() => setExpenseModalVisible(false)}
        />
        <WorkflowRescheduleModal
          visible={rescheduleModalVisible}
          eventTitle={rescheduleEvent?.title || ''}
          currentDate={rescheduleEvent?.start_time || new Date().toISOString()}
          onConfirm={async (newDate) => {
            if (rescheduleEvent) {
              try {
                const oldStart = new Date(rescheduleEvent.start_time);
                const newStart = new Date(newDate);
                newStart.setHours(oldStart.getHours(), oldStart.getMinutes(), 0, 0);
                await supabase
                  .from('schedule_events')
                  .update({ start_time: newStart.toISOString() })
                  .eq('id', rescheduleEvent.id);
              } catch {}
            }
            setRescheduleModalVisible(false);
            setRescheduleEvent(null);
          }}
          onCancel={() => {
            setRescheduleModalVisible(false);
            setRescheduleEvent(null);
          }}
        />

        <ScheduleModal
          visible={callerScheduleVisible}
          onClose={() => { setCallerScheduleVisible(false); setCallerSchedulePrefill(null); }}
          onSave={() => { setCallerScheduleVisible(false); setCallerSchedulePrefill(null); }}
          prefillFromClient={callerSchedulePrefill ? {
            clientId: callerSchedulePrefill.clientId,
            clientName: callerSchedulePrefill.clientName,
            phone: callerSchedulePrefill.phone,
            address: callerSchedulePrefill.address,
          } : null}
        />

        <CallerIdHandler
          onScheduleClient={handleCallerSchedule}
          onEstimateClient={handleCallerEstimate}
          onInvoiceClient={handleCallerInvoice}
          onCreateClient={handleCallerCreateClient}
        />
      </View>
    </AnimatedTabContent>
  );
}
