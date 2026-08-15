import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useRouter } from 'expo-router';
import Logo from '@/components/Logo';
import CollapsibleField from '@/components/CollapsibleField';
import { useCollapsibleForm } from '@/hooks/useCollapsibleForm';
import getDynamicStyles from '@/styles/loginStyles';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const { signIn, signInWithGoogle, user } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const { activeFieldId, toggleField } = useCollapsibleForm('email');

  useEffect(() => {
    if (user) {
      router.replace('/(tabs)');
    }
  }, [user]);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error } = await signIn(email, password);

      if (error) {
        console.error('Login error:', error);
        const msg = error.message?.toLowerCase() || '';
        if (msg.includes('invalid login') || msg.includes('invalid credentials') || msg.includes('email not confirmed')) {
          setError('Incorrect email or password. Please try again.');
        } else if (msg.includes('too many requests') || msg.includes('rate limit')) {
          setError('Too many attempts. Please wait a moment and try again.');
        } else {
          setError('Unable to sign in. Please check your credentials.');
        }
        setLoading(false);
      }
    } catch (e) {
      console.error('Login exception:', e);
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Enter your email address above, then tap "Forgot password?"');
      return;
    }
    setResetLoading(true);
    setError('');
    try {
      const { supabase } = await import('@/lib/supabase');
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: 'bizzy://reset-password',
      });
      setResetSent(true);
    } catch {
      setError('Could not send reset email. Please try again.');
    }
    setResetLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError('');

    const { error } = await signInWithGoogle();

    if (error) {
      setError(error.message);
    }
    setGoogleLoading(false);
  };

  const isLoading = loading || googleLoading;
  const dynamicStyles = getDynamicStyles(colors);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={dynamicStyles.container}
    >
      <ScrollView
        contentContainerStyle={dynamicStyles.scrollContent}
        bounces={false}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={dynamicStyles.logoSection}>
          <Logo size={320} showLightning={false} />
        </View>

        <View style={dynamicStyles.formSection}>
          <Text style={dynamicStyles.subtitle}>Sign in to your account</Text>

          {error ? (
            <View style={dynamicStyles.errorContainer}>
              <Text style={dynamicStyles.errorText}>{error}</Text>
            </View>
          ) : null}

          {resetSent ? (
            <View style={[dynamicStyles.errorContainer, { backgroundColor: 'rgba(61,186,111,0.12)' }]}>
              <Text style={[dynamicStyles.errorText, { color: '#3dba6f' }]}>
                Password reset email sent! Check your inbox.
              </Text>
            </View>
          ) : null}

          <View style={dynamicStyles.form}>
            <TouchableOpacity
              style={[dynamicStyles.googleButton, isLoading && dynamicStyles.buttonDisabled]}
              onPress={handleGoogleSignIn}
              disabled={isLoading}
            >
              {googleLoading ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <>
                  <View style={dynamicStyles.googleIconContainer}>
                    <Text style={dynamicStyles.googleIcon}>G</Text>
                  </View>
                  <Text style={dynamicStyles.googleButtonText}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={dynamicStyles.divider}>
              <View style={dynamicStyles.dividerLine} />
              <Text style={dynamicStyles.dividerText}>or</Text>
              <View style={dynamicStyles.dividerLine} />
            </View>

            <CollapsibleField
              label="Email"
              fieldId="email"
              activeFieldId={activeFieldId}
              onToggle={toggleField}
              displayValue={email || undefined}
              startExpanded
            >
              <TextInput
                style={dynamicStyles.input}
                placeholder="Email"
                placeholderTextColor={colors.textSecondary}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!isLoading}
              />
            </CollapsibleField>

            <CollapsibleField
              label="Password"
              fieldId="password"
              activeFieldId={activeFieldId}
              onToggle={toggleField}
              displayValue={password ? '********' : undefined}
              startExpanded
            >
              <TextInput
                style={dynamicStyles.input}
                placeholder="Password"
                placeholderTextColor={colors.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                editable={!isLoading}
              />
            </CollapsibleField>

            <TouchableOpacity
              style={dynamicStyles.forgotPasswordRow}
              onPress={handleForgotPassword}
              disabled={resetLoading || isLoading}
            >
              <Text style={dynamicStyles.forgotPasswordText}>
                {resetLoading ? 'Sending…' : 'Forgot password?'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[dynamicStyles.button, isLoading && dynamicStyles.buttonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              <LinearGradient
                colors={['#2D8B57', '#34a065']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={dynamicStyles.buttonGradient}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={dynamicStyles.buttonText}>Sign In</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/(auth)/signup-business')}
              disabled={isLoading}
            >
              <Text style={dynamicStyles.linkText}>
                Don't have an account? Sign Up
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}