import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import Logo from '@/components/Logo';

export default function JoinOrgScreen() {
  const { code: codeParam } = useLocalSearchParams<{ code: string }>();
  const [code, setCode] = useState(() => {
    if (typeof codeParam === 'string' && codeParam.length === 6) {
      return codeParam.split('');
    }
    return ['', '', '', '', '', ''];
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { colors } = useTheme();

  useEffect(() => {
    if (typeof codeParam === 'string' && codeParam.length === 6) {
      setCode(codeParam.split(''));
    }
  }, [codeParam]);
  const { refreshOrganizations } = useOrganization();
  const { signOut } = useAuth();
  const router = useRouter();
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const handleCodeChange = (value: string, index: number) => {
    const digit = value.replace(/[^0-9]/g, '').slice(-1);
    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleJoin = async () => {
    const fullCode = code.join('');
    if (fullCode.length !== 6) {
      setError('Please enter the full 6-digit organization code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let joinResult = null;
      let rpcError = null;

      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) await new Promise(resolve => setTimeout(resolve, 600));
        const result = await supabase.rpc('join_organization_by_code', { p_join_code: fullCode });
        joinResult = result.data;
        rpcError = result.error;
        if (!rpcError && joinResult?.success) break;
      }

      if (rpcError) {
        setError('Failed to join organization: ' + rpcError.message);
        setLoading(false);
        return;
      }

      if (!joinResult?.success) {
        setError(joinResult?.error || 'Invalid organization code. Please check with your manager.');
        setLoading(false);
        return;
      }

      await refreshOrganizations();
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/login');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.logoContainer}>
          <Logo size="large" showLightning={false} />
        </View>

        <Text style={[styles.title, { color: colors.text }]}>Join Your Organization</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Your account isn't linked to an organization yet. Enter the 6-digit code from your manager to get started.
        </Text>

        <View style={styles.codeRow}>
          {code.map((digit, i) => (
            <TextInput
              key={i}
              ref={r => { inputRefs.current[i] = r; }}
              style={[
                styles.codeBox,
                {
                  backgroundColor: colors.inputBackground,
                  borderColor: digit ? colors.primary : colors.border,
                  color: colors.text,
                },
              ]}
              value={digit}
              onChangeText={v => handleCodeChange(v, i)}
              onKeyPress={e => handleKeyPress(e, i)}
              keyboardType="number-pad"
              maxLength={1}
              textAlign="center"
              selectTextOnFocus
            />
          ))}
        </View>

        {error ? (
          <Text style={[styles.error, { color: colors.error }]}>{error}</Text>
        ) : null}

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }, loading && { opacity: 0.7 }]}
          onPress={handleJoin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Join Organization</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={[styles.signOutText, { color: colors.textSecondary }]}>Sign out and use a different account</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  logoContainer: {
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    maxWidth: 320,
  },
  codeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  codeBox: {
    width: 48,
    height: 56,
    borderRadius: 10,
    borderWidth: 1.5,
    fontSize: 22,
    fontWeight: '700',
  },
  error: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
    maxWidth: 300,
  },
  button: {
    width: '100%',
    maxWidth: 320,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  signOutButton: {
    paddingVertical: 12,
  },
  signOutText: {
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
