import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useTheme } from '@/contexts/ThemeContext';

export default function InviteScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { user, loading: authLoading } = useAuth();
  const { loading: orgLoading, noOrganization } = useOrganization();
  const { colors } = useTheme();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    if (user && orgLoading) return;

    const safeCode = typeof code === 'string' ? code : '';

    if (!user) {
      // Not logged in — go to signup with code pre-filled
      router.replace(`/(auth)/signup-business?code=${safeCode}` as any);
    } else if (noOrganization) {
      // Logged in but no org — go to join-org with code pre-filled
      router.replace(`/join-org?code=${safeCode}` as any);
    } else {
      // Already in an org — just go home
      router.replace('/(tabs)');
    }
  }, [authLoading, orgLoading, user, noOrganization, code]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}
