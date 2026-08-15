import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || Constants.expoConfig?.extra?.supabaseUrl || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || Constants.expoConfig?.extra?.supabaseAnonKey || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});

async function getFreshAccessToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
    if (expiresAt - Date.now() > 60_000) {
      return session.access_token;
    }
  }
  const { data: { session: refreshed }, error } = await supabase.auth.refreshSession();
  if (error || !refreshed) {
    throw new Error('Session expired. Please sign in again.');
  }
  return refreshed.access_token;
}

export async function invokeFunction(
  name: string,
  body: Record<string, unknown>
): Promise<{ data: any; error: { message: string } | null }> {
  const attempt = async (token: string) => {
    const url = `${supabaseUrl}/functions/v1/${name}`;
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'apikey': supabaseAnonKey,
      },
      body: JSON.stringify(body),
    });
  };

  let token = await getFreshAccessToken();
  let response = await attempt(token);

  if (response.status === 401) {
    const { data: { session: refreshed } } = await supabase.auth.refreshSession();
    if (refreshed) {
      response = await attempt(refreshed.access_token);
    } else {
      return { data: null, error: { message: 'Session expired. Please sign in again.' } };
    }
  }

  const data = await response.json();

  if (!response.ok) {
    return { data, error: { message: data?.error || `Request failed (${response.status})` } };
  }

  return { data, error: null };
}

export async function fetchFunction(path: string, options: { method?: string; body?: unknown } = {}) {
  const token = await getFreshAccessToken();
  const url = `${supabaseUrl}/functions/v1/${path}`;
  const response = await fetch(url, {
    method: options.method || 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'apikey': supabaseAnonKey,
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
  return response.json();
}
