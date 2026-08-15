import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { MailX, CircleCheck as CheckCircle, CircleAlert as AlertCircle } from 'lucide-react-native';

const SUPABASE_URL = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

type PageState = 'loading' | 'confirm' | 'success' | 'already' | 'error';

export default function UnsubscribePage() {
  const params = useLocalSearchParams<{ org: string; email: string }>();
  const org = params.org || '';
  const email = params.email || '';

  const [state, setState] = useState<PageState>('loading');
  const [businessName, setBusinessName] = useState('this business');
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!org || !email) {
      setErrorMsg('Invalid unsubscribe link. The required parameters are missing.');
      setState('error');
      return;
    }

    checkStatus();
  }, [org, email]);

  async function checkStatus() {
    try {
      const apiUrl = `${SUPABASE_URL}/functions/v1/email-unsubscribe?org=${encodeURIComponent(org)}&email=${encodeURIComponent(email)}`;
      const res = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json();

      if (data.success) {
        setBusinessName(data.businessName || 'this business');
        if (data.alreadyUnsubscribed) {
          setState('already');
        } else {
          setState('confirm');
        }
      } else {
        setErrorMsg('Unable to verify your unsubscribe status. Please try again later.');
        setState('error');
      }
    } catch {
      setErrorMsg('Unable to connect to the server. Please try again later.');
      setState('error');
    }
  }

  async function handleUnsubscribe() {
    setSubmitting(true);

    try {
      const apiUrl = `${SUPABASE_URL}/functions/v1/email-unsubscribe`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ org, email }),
      });

      const data = await res.json();

      if (data.success) {
        setState('success');
      } else {
        setErrorMsg('Something went wrong. Please try again.');
        setState('error');
      }
    } catch {
      setErrorMsg('Unable to connect to the server. Please try again later.');
      setState('error');
    } finally {
      setSubmitting(false);
    }
  }

  if (state === 'loading') {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <ActivityIndicator size="large" color="#1a3c5e" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {state === 'confirm' && (
          <>
            <View style={styles.iconWrap}>
              <MailX size={40} color="#64748b" strokeWidth={1.5} />
            </View>
            <Text style={styles.heading}>Unsubscribe</Text>
            <Text style={styles.body}>
              You are about to unsubscribe{'\n'}
              <Text style={styles.emailText}>{decodeURIComponent(email)}</Text>
              {'\n'}from emails sent by{' '}
              <Text style={styles.boldText}>{businessName}</Text>.
            </Text>
            <Text style={styles.note}>
              You will no longer receive estimates, invoices, or other communications from this business via email.
            </Text>
            <TouchableOpacity
              style={[styles.button, submitting && styles.buttonDisabled]}
              onPress={handleUnsubscribe}
              disabled={submitting}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#1B4D6E', '#245d82'] as [string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.buttonGradient}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.buttonText}>Confirm Unsubscribe</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
            <Text style={styles.disclaimer}>
              Changed your mind? Simply close this page and no action will be taken.
            </Text>
          </>
        )}

        {state === 'success' && (
          <>
            <View style={[styles.iconWrap, styles.iconSuccess]}>
              <CheckCircle size={40} color="#059669" strokeWidth={1.5} />
            </View>
            <Text style={styles.heading}>You've Been Unsubscribed</Text>
            <Text style={styles.body}>
              <Text style={styles.emailText}>{decodeURIComponent(email)}</Text>
              {' '}has been unsubscribed from emails sent by{' '}
              <Text style={styles.boldText}>{businessName}</Text>.
            </Text>
            <Text style={styles.note}>
              This may take a few minutes to take effect. If you receive another email in the meantime, it was likely already in the sending queue.
            </Text>
          </>
        )}

        {state === 'already' && (
          <>
            <View style={[styles.iconWrap, styles.iconSuccess]}>
              <CheckCircle size={40} color="#059669" strokeWidth={1.5} />
            </View>
            <Text style={styles.heading}>Already Unsubscribed</Text>
            <Text style={styles.body}>
              <Text style={styles.emailText}>{decodeURIComponent(email)}</Text>
              {' '}is already unsubscribed from emails sent by{' '}
              <Text style={styles.boldText}>{businessName}</Text>.
            </Text>
            <Text style={styles.note}>
              No further action is needed.
            </Text>
          </>
        )}

        {state === 'error' && (
          <>
            <View style={[styles.iconWrap, styles.iconError]}>
              <AlertCircle size={40} color="#dc2626" strokeWidth={1.5} />
            </View>
            <Text style={styles.heading}>Something Went Wrong</Text>
            <Text style={styles.body}>{errorMsg}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => { setState('loading'); checkStatus(); }}
              activeOpacity={0.8}
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <Text style={styles.footer}>Powered by Bizzy</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 40,
    maxWidth: 480,
    width: '100%',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 4px 24px rgba(0, 0, 0, 0.08)',
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 24,
      elevation: 4,
    }),
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  iconSuccess: {
    backgroundColor: '#ecfdf5',
  },
  iconError: {
    backgroundColor: '#fef2f2',
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 16,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    color: '#64748b',
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 12,
  },
  emailText: {
    fontWeight: '600',
    color: '#1e293b',
  },
  boldText: {
    fontWeight: '600',
    color: '#1e293b',
  },
  note: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 28,
  },
  button: {
    borderRadius: 10,
    marginBottom: 16,
    minWidth: 200,
    overflow: 'hidden' as const,
  },
  buttonGradient: {
    paddingVertical: 14,
    paddingHorizontal: 36,
    alignItems: 'center' as const,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  disclaimer: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  retryButtonText: {
    color: '#1e293b',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#64748b',
  },
  footer: {
    marginTop: 24,
    fontSize: 12,
    color: '#94a3b8',
  },
});
