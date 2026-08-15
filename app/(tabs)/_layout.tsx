import { Tabs, Redirect, useRouter, useSegments } from 'expo-router';
import { View, Image, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { Camera } from 'lucide-react-native';
import HRTabIcon from '@/components/HRTabIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { useLayout } from '@/contexts/LayoutContext';
import { useRef, useEffect, useState, memo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { TabNavigationProvider } from '@/contexts/TabNavigationContext';
import { SettingsProvider, useSettings } from '@/contexts/SettingsContext';
import { LanguageProvider, useLanguage } from '@/contexts/LanguageContext';
import { useResponsive } from '@/hooks/useResponsive';
import EditableTabBar from '@/components/EditableTabBar';
import WebSidebarStandalone from '@/components/WebSidebarStandalone';
import GlobalSettingsManager from '@/components/GlobalSettingsManager';
import TrialExpiredPaywall from '@/components/TrialExpiredPaywall';
import QuickActionHandler from '@/components/QuickActionHandler';

export const TAB_IMAGES = {
  home: require('@/assets/images/hometab.png'),
  clients: require('@/assets/images/clientstab.png'),
  schedule: require('@/assets/images/schedulingtab.png'),
  time: require('@/assets/images/timeclocktab.png'),
  notes: require('@/assets/images/notestab.png'),
  finances: require('@/assets/images/financestab.png'),
  invoices: require('@/assets/images/Invoicestab.png'),
  routes: require('@/assets/images/RoutesTab.png'),
};

export const TAB_IMAGES_LIGHT = {
  home: require('@/assets/images/HomeLightModeTab.png'),
  clients: require('@/assets/images/ClientsLightModeTab.png'),
  schedule: require('@/assets/images/ScheduleLightModeTab.png'),
  time: require('@/assets/images/TimeClockLightModeTab.png'),
  notes: require('@/assets/images/NotesLightModeTab.png'),
  finances: require('@/assets/images/FinancesLightModeTab.png'),
  invoices: require('@/assets/images/InvoiceLightModeTab.png'),
  routes: require('@/assets/images/RoutesLightModeTab.png'),
  camera: require('@/assets/images/QuickCameraLightModeIcon.png'),
  hr: require('@/assets/images/HRLightModeTab.png'),
};

export const TAB_IMAGES_DARK = {
  home: require('@/assets/images/HomeDarkModeTab.png'),
  clients: require('@/assets/images/ClientsDarkModeTab.png'),
  finances: require('@/assets/images/FinancesDarkModeTab.png'),
  invoices: require('@/assets/images/InvoicesDarkModeTab.png'),
  schedule: require('@/assets/images/ScheduleDarkModeTab.png'),
  time: require('@/assets/images/TimeclockDarkModeTab.png'),
  notes: require('@/assets/images/NotesDarkModeTab.png'),
  routes: require('@/assets/images/RoutesDarkModeTab.png'),
  camera: require('@/assets/images/QuickCameraDarkModeIcon.png'),
  hr: require('@/assets/images/HRDarkModeTab.png'),
};

const TAB_CONFIG = {
  index:    { titleKey: 'tab_home',      imageKey: 'home' },
  clients:  { titleKey: 'tab_clients',   imageKey: 'clients' },
  schedule: { titleKey: 'tab_schedule',  imageKey: 'schedule' },
  time:     { titleKey: 'tab_time',      imageKey: 'time' },
  invoices: { titleKey: 'tab_invoices',  imageKey: 'invoices' },
  notes:    { titleKey: 'tab_notes',     imageKey: 'notes' },
  finances: { titleKey: 'tab_finances',  imageKey: 'finances' },
  routes:   { titleKey: 'tab_routes',    imageKey: 'routes' },
  camera:   { titleKey: 'tab_camera',    imageKey: 'camera' },
  hr:       { titleKey: 'tab_hr',        imageKey: 'hr' },
};

const TAB_IMAGE_SIZE = 32;

const TabIcon = memo(function TabIcon({ imageKey, focused, colors, isDark }: {
  imageKey?: string;
  focused: boolean;
  colors: any;
  isDark: boolean;
}) {
  if (imageKey) {
    let imageSource: any;

    if (isDark && TAB_IMAGES_DARK[imageKey]) {
      imageSource = TAB_IMAGES_DARK[imageKey];
    } else if (!isDark && TAB_IMAGES_LIGHT[imageKey]) {
      imageSource = TAB_IMAGES_LIGHT[imageKey];
    } else {
      imageSource = TAB_IMAGES[imageKey];
    }

    if (imageSource) {
      const darkWebStyle = isDark && Platform.OS === 'web'
        ? { mixBlendMode: 'lighten' as any }
        : undefined;

      return (
        <View style={styles.tabImageContainer}>
          <Image
            source={imageSource}
            resizeMode="contain"
            style={[
              styles.tabImage,
              { opacity: focused ? 1 : 0.55 },
              darkWebStyle,
            ]}
          />
        </View>
      );
    }

    if (imageKey === 'camera') {
      return (
        <Camera
          size={TAB_IMAGE_SIZE}
          color={focused ? colors.primary : colors.textSecondary}
          style={{ opacity: focused ? 1 : 0.55 }}
        />
      );
    }

    if (imageKey === 'hr') {
      return (
        <HRTabIcon
          color={focused ? colors.primary : colors.textSecondary}
          size={TAB_IMAGE_SIZE}
        />
      );
    }
  }
  return null;
});

function TabLayoutInner() {
  const { loading: layoutLoading, defaultTab } = useLayout();
  const { user, loading: authLoading } = useAuth();
  const { loading: orgLoading, employeeInvoicesHidden, isAdminOrOwner, isAdminOrManager } = useOrganization();
  const { subscription, loading: subLoading } = useSubscription();
  const { isWeb, isDesktop } = useResponsive();
  const { colors, isDark } = useTheme();
  const { openSettings } = useSettings();
  const { t } = useLanguage();
  const router = useRouter();
  const segments = useSegments();
  const hasRedirected = useRef(false);
  const rawInsets = useSafeAreaInsets();
  const insets = Platform.OS === 'android'
    ? {
        ...rawInsets,
        top: Math.max(rawInsets.top, Constants.statusBarHeight ?? 0),
        bottom: Math.max(rawInsets.bottom, 16),
      }
    : rawInsets;

  const trialExpired =
    !subLoading &&
    subscription !== null &&
    subscription.status === 'trialing' &&
    subscription.trial_days_remaining <= 0;

  const subscriptionCanceled =
    !subLoading &&
    subscription !== null &&
    (subscription.status === 'canceled' || subscription.status === 'past_due');

  const useWebSidebar = isWeb && isDesktop;
  const invoicesBlocked = employeeInvoicesHidden && !isAdminOrOwner;
  const hrBlocked = !isAdminOrManager;

  useEffect(() => {
    if (authLoading || layoutLoading || orgLoading) return;
    if (!user) return;
    if (hasRedirected.current) return;
    if (!defaultTab || defaultTab === 'index') return;

    const currentSegment = segments[segments.length - 1] || '';
    if (currentSegment === '' || currentSegment === 'index' || currentSegment === '(tabs)') {
      hasRedirected.current = true;
      router.replace(`/(tabs)/${defaultTab}` as any);
    }
  }, [authLoading, layoutLoading, orgLoading, user, defaultTab, segments]);

  if (authLoading || layoutLoading || orgLoading) {
    return (
      <View style={[styles.rootContainer, styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  const showPaywall = trialExpired || subscriptionCanceled;

  const getTabOptions = (tabId: string) => {
    const config = TAB_CONFIG[tabId];
    const title = config?.titleKey ? t(config.titleKey) : tabId;

    return {
      title,
      tabBarIcon: ({ focused }: { focused: boolean }) => (
        <TabIcon
          imageKey={config?.imageKey}
          focused={focused}
          colors={colors}
          isDark={isDark}
        />
      ),
    };
  };

  const currentRoute = segments[segments.length - 1] || 'index';

  if (useWebSidebar) {
    return (
      <View style={[styles.webContainer, { backgroundColor: colors.background }]}>
        <WebSidebarStandalone
          currentRoute={currentRoute}
          onNavigate={(route) => router.push(`/(tabs)/${route === 'index' ? '' : route}` as any)}
          onOpenSettings={openSettings}
        />
        <View style={styles.webContent}>
          <Tabs
            tabBar={() => null}
            screenOptions={{
              headerShown: false,
              animation: 'shift',
              sceneStyle: { flex: 1 },
            }}
          >
            <Tabs.Screen name="index" options={getTabOptions('index')} />
            <Tabs.Screen name="clients" options={getTabOptions('clients')} />
            <Tabs.Screen name="schedule" options={getTabOptions('schedule')} />
            <Tabs.Screen name="time" options={getTabOptions('time')} />
            <Tabs.Screen name="invoices" options={{ ...getTabOptions('invoices'), href: invoicesBlocked ? null : undefined }} />
            <Tabs.Screen name="notes" options={getTabOptions('notes')} />
            <Tabs.Screen name="finances" options={getTabOptions('finances')} />
            <Tabs.Screen name="routes" options={getTabOptions('routes')} />
            <Tabs.Screen name="camera" options={getTabOptions('camera')} />
            <Tabs.Screen name="hr" options={{ ...getTabOptions('hr'), href: hrBlocked ? null : undefined }} />
          </Tabs>
        </View>
        <TrialExpiredPaywall visible={showPaywall} allowDismiss={false} />
      </View>
    );
  }

  return (
    <View style={[styles.rootContainer, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <Tabs
        tabBar={(props) => <EditableTabBar {...props} bottomInset={insets.bottom} />}
        screenOptions={{
          headerShown: false,
          animation: 'shift',
          sceneStyle: { flex: 1 },
        }}
      >
        <Tabs.Screen name="index" options={getTabOptions('index')} />
        <Tabs.Screen name="clients" options={getTabOptions('clients')} />
        <Tabs.Screen name="schedule" options={getTabOptions('schedule')} />
        <Tabs.Screen name="time" options={getTabOptions('time')} />
        <Tabs.Screen name="invoices" options={{ ...getTabOptions('invoices'), href: invoicesBlocked ? null : undefined }} />
        <Tabs.Screen name="notes" options={getTabOptions('notes')} />
        <Tabs.Screen name="finances" options={getTabOptions('finances')} />
        <Tabs.Screen name="routes" options={getTabOptions('routes')} />
        <Tabs.Screen name="camera" options={getTabOptions('camera')} />
        <Tabs.Screen name="hr" options={{ ...getTabOptions('hr'), href: hrBlocked ? null : undefined }} />
      </Tabs>
      <TrialExpiredPaywall visible={showPaywall} allowDismiss={false} />
    </View>
  );
}

export default function TabLayout() {
  return (
    <LanguageProvider>
      <TabNavigationProvider>
        <SettingsProvider>
          <TabLayoutInner />
          <GlobalSettingsManager />
          <QuickActionHandler />
        </SettingsProvider>
      </TabNavigationProvider>
    </LanguageProvider>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  webContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  webContent: {
    flex: 1,
  },
  tabImageContainer: {
    width: TAB_IMAGE_SIZE,
    height: TAB_IMAGE_SIZE,
    borderRadius: TAB_IMAGE_SIZE / 2,
    overflow: 'hidden',
  },
  tabImage: {
    width: TAB_IMAGE_SIZE,
    height: TAB_IMAGE_SIZE,
  },
});
