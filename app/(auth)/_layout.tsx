import React from 'react';
import { Stack } from 'expo-router';
import { OnboardingProvider } from '@/lib/onboarding/store';

export default function AuthLayout() {
  return (
    <OnboardingProvider>
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Stack.Screen name="signup-business" />
        <Stack.Screen name="signup-role" />
        <Stack.Screen name="signup-type" />
        <Stack.Screen name="signup-team" />
        <Stack.Screen name="signup-goal" />
        <Stack.Screen name="signup-complete" />
      </Stack>
    </OnboardingProvider>
  );
}
