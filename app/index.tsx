import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';

export default function Index() {
  const { user, loading: authLoading } = useAuth();
  const { loading: orgLoading, noOrganization } = useOrganization();

  if (authLoading || (user && orgLoading)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (user) {
    if (noOrganization) {
      return <Redirect href="/join-org" />;
    }
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/landing" />;
}
