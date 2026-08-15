import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const supabaseUrl =
  Constants.expoConfig?.extra?.supabaseUrl ||
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  '';
const supabaseAnonKey =
  Constants.expoConfig?.extra?.supabaseAnonKey ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  '';

export const portalSupabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    storageKey: 'portal_auth_session',
    detectSessionInUrl: true,
  },
});

export const PORTAL_API_URL = `${supabaseUrl}/functions/v1/portal-public-api`;
export const SUPABASE_ANON_KEY = supabaseAnonKey;

export async function portalGet(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${PORTAL_API_URL}?${qs}`, {
    headers: { apikey: supabaseAnonKey },
  });
  return res.json();
}

export async function portalPost(body: Record<string, unknown>) {
  const res = await fetch(PORTAL_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: supabaseAnonKey },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function portalPostAuth(body: Record<string, unknown>, token: string) {
  const res = await fetch(PORTAL_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  return res.json();
}
