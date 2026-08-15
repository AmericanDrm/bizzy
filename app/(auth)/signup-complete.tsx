import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Platform,
  Linking,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { CircleCheck as CheckCircle, Smartphone, Copy, Users } from 'lucide-react-native';
import { Clipboard } from 'react-native';
import { useOnboarding } from '@/lib/onboarding/store';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/lib/supabase';
import { SPACING, TYPOGRAPHY } from '@/constants/designSystem';
import Logo from '@/components/Logo';

const GOAL_ROUTES: Record<string, string> = {
  estimate: '/(tabs)/invoices',
  client: '/(tabs)/clients',
  schedule: '/(tabs)/schedule',
  invoice: '/(tabs)/invoices',
  time: '/(tabs)/time',
  receipt: '/(tabs)/finances',
  explore: '/(tabs)/index',
};

const GOAL_CTA_TEXT: Record<string, string> = {
  estimate: 'Create My First Estimate',
  client: 'Add My First Client',
  schedule: 'View My Schedule',
  invoice: 'Create My First Invoice',
  time: 'Open Time Clock',
  receipt: 'Track My Finances',
  explore: 'Explore Bizzy',
};

const APP_STORE_URL = 'https://apps.apple.com/app/bizzy/id000000000';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.bizzy.app';

type Stage = 'creating' | 'done' | 'error';

const STEPS = [
  'Creating your account…',
  'Setting up your workspace…',
  'Applying your preferences…',
  'Almost ready…',
];

export default function SignupCompleteScreen() {
  const { data, reset } = useOnboarding();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { refreshOrganizations } = useOrganization();
  const router = useRouter();

  const [stage, setStage] = useState<Stage>('creating');
  const [errorMsg, setErrorMsg] = useState('');
  const [stepIndex, setStepIndex] = useState(0);
  const [pendingNavigate, setPendingNavigate] = useState(false);
  const [orgJoinCode, setOrgJoinCode] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    createAccount();
  }, []);

  useEffect(() => {
    if (stage !== 'creating') return;
    const interval = setInterval(() => {
      setStepIndex(i => (i < STEPS.length - 1 ? i + 1 : i));
    }, 900);
    return () => clearInterval(interval);
  }, [stage]);

  useEffect(() => {
    if (stage === 'done') {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 6 }),
      ]).start();
    }
  }, [stage]);

  const createAccount = async () => {
    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: data.email.trim(),
        password: data.password,
      });

      if (signUpError) {
        const msg = signUpError.message?.toLowerCase() || '';
        if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('duplicate')) {
          setErrorMsg('An account with this email already exists. Try signing in instead.');
        } else if (msg.includes('invalid email')) {
          setErrorMsg('Please enter a valid email address.');
        } else if (msg.includes('password') && msg.includes('weak')) {
          setErrorMsg('Password is too weak. Please use at least 8 characters.');
        } else {
          setErrorMsg('Unable to create your account. Please try again.');
        }
        setStage('error');
        return;
      }

      if (!authData?.user) {
        setErrorMsg('Failed to create account. Please try again.');
        setStage('error');
        return;
      }

      if (!authData.session) {
        // signUp may not return a session if email confirmation is pending.
        // Wait briefly for any async confirmation triggers, then sign in.
        await new Promise(resolve => setTimeout(resolve, 800));
        let signInError: any = null;
        for (let attempt = 0; attempt < 2; attempt++) {
          if (attempt > 0) await new Promise(resolve => setTimeout(resolve, 1000));
          const result = await supabase.auth.signInWithPassword({
            email: data.email.trim(),
            password: data.password,
          });
          signInError = result.error;
          if (!signInError) break;
        }
        if (signInError) {
          setErrorMsg('Account created but we could not sign you in automatically. Please go to the sign-in page and log in with your credentials.');
          setStage('error');
          return;
        }
      }

      const userId = authData.user.id;
      const now = new Date().toISOString();
      const displayName = `${data.firstName.trim()} ${data.lastName.trim()}`.trim();

      await supabase
        .from('profiles')
        .update({
          display_name: displayName,
          terms_accepted_at: now,
          privacy_accepted_at: now,
          terms_privacy_version: '1.0',
        })
        .eq('id', userId);

      // Employee path: join an existing organization by code
      if (data.role === 'employee') {
        let joinResult: any = null;
        let rpcError: any = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          if (attempt > 0) await new Promise(resolve => setTimeout(resolve, 600));
          const result = await supabase.rpc('join_organization_by_code', {
            p_join_code: data.joinCode,
          });
          joinResult = result.data;
          rpcError = result.error;
          if (!rpcError && joinResult?.success) break;
        }
        if (rpcError) {
          setErrorMsg('Failed to join organization: ' + rpcError.message);
          setStage('error');
          return;
        }
        if (!joinResult?.success) {
          setErrorMsg(joinResult?.error || 'Invalid organization code. Please check with your admin.');
          setStage('error');
          return;
        }
        await refreshOrganizations();
        setStage('done');
        return;
      }

      // Owner path: create a new organization
      const orgSlug =
        data.businessName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') +
        '-' +
        userId.substring(0, 8);

      const { data: orgData, error: orgError } = await supabase.rpc(
        'create_organization_for_user',
        { p_name: data.businessName.trim(), p_slug: orgSlug }
      );

      if (orgError || !orgData) {
        setErrorMsg('We created your account but could not set up your workspace. Please sign in and try again.');
        setStage('error');
        return;
      }

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;

        if (supabaseUrl && token) {
          fetch(`${supabaseUrl}/functions/v1/provision-sms-number`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ organization_id: orgData.id, country: 'US' }),
          }).catch(() => {});
        }

        await supabase.rpc('schedule_org_lifecycle_emails', {
          p_org_id: orgData.id,
          p_owner_email: data.email.trim(),
          p_owner_name: displayName,
          p_org_name: data.businessName.trim(),
        });
      } catch {
      }

      // Fetch the join code for this org so the owner can share it with employees
      try {
        const { data: orgRow } = await supabase
          .from('organizations')
          .select('join_code')
          .eq('id', orgData.id)
          .maybeSingle();
        if (orgRow?.join_code) setOrgJoinCode(orgRow.join_code);
      } catch {}

      await refreshOrganizations();
      setStage('done');
    } catch (e: any) {
      setErrorMsg(e?.message || 'Something went wrong. Please try again.');
      setStage('error');
    }
  };

  // Wait for AuthContext user to be set before navigating to the tabs.
  // The auth guard in (tabs)/_layout redirects to /login when user is null.
  useEffect(() => {
    if (!pendingNavigate) return;
    if (user) {
      const route = GOAL_ROUTES[data.primaryGoal] || '/(tabs)/index';
      reset();
      router.replace(route as any);
      return;
    }
    // Fallback: if user state doesn't arrive within 3s, re-check session
    // and navigate anyway — the onAuthStateChange listener will catch up.
    const timeout = setTimeout(async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (sess?.session) {
        const route = GOAL_ROUTES[data.primaryGoal] || '/(tabs)/index';
        reset();
        router.replace(route as any);
      }
    }, 3000);
    return () => clearTimeout(timeout);
  }, [pendingNavigate, user]);

  const handleCopyCode = () => {
    Clipboard.setString(orgJoinCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleContinue = () => {
    if (user) {
      const route = GOAL_ROUTES[data.primaryGoal] || '/(tabs)/index';
      reset();
      router.replace(route as any);
    } else {
      setPendingNavigate(true);
    }
  };

  const s = makeStyles(colors);

  if (stage === 'creating') {
    return (
      <View style={[s.center, { backgroundColor: colors.background }]}>
        <Logo size="medium" showLightning={false} />
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: SPACING.xxl }} />
        <Text style={[s.stepText, { color: colors.textSecondary }]}>{STEPS[stepIndex]}</Text>
      </View>
    );
  }

  if (stage === 'error') {
    const isAlreadyExists = errorMsg.includes('already exists');
    return (
      <View style={[s.center, { backgroundColor: colors.background }]}>
        <Logo size="medium" showLightning={false} />
        <Text style={[s.errorTitle, { color: colors.text }]}>
          {isAlreadyExists ? 'Account Already Exists' : 'Something went wrong'}
        </Text>
        <Text style={[s.errorMsg, { color: colors.textSecondary }]}>{errorMsg}</Text>
        {isAlreadyExists ? (
          <TouchableOpacity
            style={s.primaryBtn}
            onPress={() => router.replace('/login')}
          >
            <LinearGradient
              colors={['#1B4D6E', '#245d82']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.primaryBtnGradient}
            >
              <Text style={s.primaryBtnText}>Sign In Instead</Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={s.primaryBtn}
            onPress={() => {
              setStage('creating');
              setStepIndex(0);
              createAccount();
            }}
          >
            <LinearGradient
              colors={['#1B4D6E', '#245d82']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.primaryBtnGradient}
            >
              <Text style={s.primaryBtnText}>Try Again</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => router.replace('/login')} style={{ marginTop: SPACING.md }}>
          <Text style={[s.linkText, { color: colors.primary }]}>Back to sign in</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={s.doneScroll}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }], alignItems: 'center' }}>
        <View style={[s.successIcon, { backgroundColor: colors.success + '18' }]}>
          <CheckCircle size={52} color={colors.success} />
        </View>
        <Text style={[s.doneTitle, { color: colors.text }]}>
          Welcome to Bizzy, {data.firstName || 'there'}!
        </Text>
        <Text style={[s.doneSubtitle, { color: colors.textSecondary }]}>
          {data.businessName
            ? `${data.businessName} is ready to go.`
            : 'Your account is ready to go.'}
          {'\n'}Your 14-day free trial starts now.
        </Text>
      </Animated.View>

      {orgJoinCode ? (
        <Animated.View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border, opacity: fadeAnim }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm }}>
            <Users size={20} color={colors.primary} />
            <Text style={[s.cardTitle, { color: colors.text }]}>Your Team Join Code</Text>
          </View>
          <Text style={[s.cardDesc, { color: colors.textSecondary }]}>
            Share this code with employees so they can join your organization.
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.md, backgroundColor: colors.inputBackground, borderRadius: 12, paddingHorizontal: SPACING.lg, paddingVertical: 14, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: 28, fontWeight: '700', letterSpacing: 6, color: colors.text }}>
              {orgJoinCode}
            </Text>
            <TouchableOpacity onPress={handleCopyCode} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Copy size={20} color={codeCopied ? colors.success : colors.textSecondary} />
            </TouchableOpacity>
          </View>
          {codeCopied && (
            <Text style={{ fontSize: 12, color: colors.success, marginTop: 6, fontWeight: '600' }}>Copied!</Text>
          )}
        </Animated.View>
      ) : null}

      <Animated.View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border, opacity: fadeAnim }]}>
        <Text style={[s.cardTitle, { color: colors.text }]}>Get the full experience on your phone</Text>
        <Text style={[s.cardDesc, { color: colors.textSecondary }]}>
          Download Bizzy on iOS or Android to manage jobs, track time, and message clients from the field.
        </Text>
        <View style={s.storeRow}>
          <TouchableOpacity
            style={[s.storeBtn, { backgroundColor: colors.text }]}
            onPress={() => Linking.openURL(APP_STORE_URL)}
            activeOpacity={0.85}
          >
            <Smartphone size={16} color={colors.background} />
            <Text style={[s.storeBtnText, { color: colors.background }]}>App Store</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.storeBtn, { backgroundColor: colors.text }]}
            onPress={() => Linking.openURL(PLAY_STORE_URL)}
            activeOpacity={0.85}
          >
            <Smartphone size={16} color={colors.background} />
            <Text style={[s.storeBtnText, { color: colors.background }]}>Google Play</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      <Animated.View style={{ opacity: fadeAnim, width: '100%' }}>
        <TouchableOpacity
          style={s.primaryBtn}
          onPress={handleContinue}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['#1B4D6E', '#245d82']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.primaryBtnGradient}
          >
            <Text style={s.primaryBtnText}>
              {GOAL_CTA_TEXT[data.primaryGoal] || 'Explore Bizzy'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </ScrollView>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: SPACING.xl,
      gap: SPACING.lg,
    },
    stepText: {
      ...TYPOGRAPHY.body,
      marginTop: SPACING.md,
      textAlign: 'center',
    },
    errorTitle: {
      ...TYPOGRAPHY.screenTitle,
      textAlign: 'center',
    },
    errorMsg: {
      ...TYPOGRAPHY.body,
      textAlign: 'center',
      maxWidth: 300,
    },
    doneScroll: {
      alignItems: 'center',
      paddingHorizontal: SPACING.xl,
      paddingTop: SPACING.xxl * 2,
      paddingBottom: SPACING.xxl,
      gap: SPACING.xl,
    },
    successIcon: {
      width: 96,
      height: 96,
      borderRadius: 48,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.lg,
    },
    doneTitle: {
      ...TYPOGRAPHY.screenTitle,
      textAlign: 'center',
      marginBottom: SPACING.sm,
    },
    doneSubtitle: {
      ...TYPOGRAPHY.body,
      textAlign: 'center',
      lineHeight: 22,
    },
    card: {
      borderRadius: 16,
      borderWidth: 1,
      padding: SPACING.xl,
      width: '100%',
      gap: SPACING.md,
    },
    cardTitle: { ...TYPOGRAPHY.heading },
    cardDesc: { ...TYPOGRAPHY.body, lineHeight: 21 },
    storeRow: {
      flexDirection: 'row',
      gap: SPACING.md,
      marginTop: SPACING.sm,
    },
    storeBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
      borderRadius: 12,
      paddingVertical: 12,
    },
    storeBtnText: {
      fontWeight: '600',
      fontSize: 14,
    },
    primaryBtn: {
      width: '100%',
      borderRadius: 14,
      overflow: 'hidden' as const,
    },
    primaryBtnGradient: {
      paddingVertical: 16,
      alignItems: 'center' as const,
    },
    primaryBtnText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    linkText: {
      ...TYPOGRAPHY.body,
      fontWeight: '600',
    },
  });
}
