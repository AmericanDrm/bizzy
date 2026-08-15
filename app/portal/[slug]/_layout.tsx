import { Stack } from 'expo-router';
import { PortalAuthProvider } from '@/contexts/PortalAuthContext';

export default function PortalLayout() {
  return (
    <PortalAuthProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </PortalAuthProvider>
  );
}
