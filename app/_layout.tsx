import { useEffect } from 'react';
import { Platform, View, BackHandler } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { LayoutProvider } from '@/contexts/LayoutContext';
import { WalkthroughProvider } from '@/contexts/WalkthroughContext';
import { OrganizationProvider } from '@/contexts/OrganizationContext';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
import { RouteQueueProvider } from '@/contexts/RouteQueueContext';
import { TimerPrefillProvider } from '@/contexts/TimerPrefillContext';
import { WorkflowProvider } from '@/contexts/WorkflowContext';
import { QuickActionProvider } from '@/contexts/QuickActionContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import AppWalkthrough from '@/components/AppWalkthrough';
import PushNotificationHandler from '@/components/PushNotificationHandler';
import { useDepartureReminders } from '@/hooks/useDepartureReminders';
import { ModalStackProvider, useModalStack } from '@/contexts/ModalStackContext';

function DepartureReminderRunner() {
  useDepartureReminders();
  return null;
}

function BackButtonHandler() {
  const { closeTopModal, hasOpenModal } = useModalStack();

  useEffect(() => {
    if (Platform.OS === 'android') {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (hasOpenModal()) {
          closeTopModal();
          return true;
        }
        return false;
      });
      return () => sub.remove();
    }
  }, [closeTopModal, hasOpenModal]);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handler = (e: PopStateEvent) => {
        if (hasOpenModal()) {
          e.preventDefault();
          window.history.pushState(null, '', window.location.href);
          closeTopModal();
        }
      };
      window.addEventListener('popstate', handler);
      return () => window.removeEventListener('popstate', handler);
    }
  }, [closeTopModal, hasOpenModal]);

  return null;
}

function AppContent() {
  const { isDark, colors } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <BackButtonHandler />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="landing" />
        <Stack.Screen name="splash" />
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="unsubscribe" />
        <Stack.Screen name="join-org" />
        <Stack.Screen name="invite" />
        <Stack.Screen name="approve" />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AppWalkthrough />
      <PushNotificationHandler />
      <DepartureReminderRunner />
    </View>
  );
}

export default function RootLayout() {
  useFrameworkReady();

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const isBoltPreview = window.location.hostname.includes('bolt');
      const isLocalhost =
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';
      const isSecure = window.location.protocol === 'https:';

      if (!isBoltPreview && !isSecure && !isLocalhost) {
        window.location.href =
          'https://' +
          window.location.hostname +
          window.location.pathname;
      }

      const style = document.createElement('style');
      style.textContent = `
        * {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        *::-webkit-scrollbar {
          display: none;
          width: 0;
          height: 0;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  return (
    <SafeAreaProvider>
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <ModalStackProvider>
          <ThemeProvider>
            <ToastProvider>
              <AuthProvider>
                <OrganizationProvider>
                  <SubscriptionProvider>
                  <RouteQueueProvider>
                    <TimerPrefillProvider>
                    <WalkthroughProvider>
                      <LayoutProvider>
                        <WorkflowProvider>
                          <QuickActionProvider>
                            <AppContent />
                          </QuickActionProvider>
                        </WorkflowProvider>
                      </LayoutProvider>
                    </WalkthroughProvider>
                    </TimerPrefillProvider>
                  </RouteQueueProvider>
                  </SubscriptionProvider>
                </OrganizationProvider>
              </AuthProvider>
            </ToastProvider>
          </ThemeProvider>
        </ModalStackProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}