import { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import Constants from 'expo-constants';

const SUPABASE_URL =
  Constants.expoConfig?.extra?.supabaseUrl ||
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  '';

export default function PaymentRedirect() {
  const { code } = useLocalSearchParams<{ code: string }>();

  useEffect(() => {
    if (!code || !SUPABASE_URL) return;

    const redirectUrl = `${SUPABASE_URL}/functions/v1/payment-page?code=${code}`;

    if (typeof window !== 'undefined') {
      window.location.replace(redirectUrl);
    }
  }, [code]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#1a3c5e" />
      <Text style={styles.text}>Opening invoice...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  text: {
    fontSize: 16,
    color: '#515154',
  },
});
