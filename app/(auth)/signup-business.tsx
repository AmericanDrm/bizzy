import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight, Building2, User, Mail, Phone, Lock, Eye, EyeOff } from 'lucide-react-native';
import { useOnboarding } from '@/lib/onboarding/store';
import { useTheme } from '@/contexts/ThemeContext';
import { SPACING, TYPOGRAPHY } from '@/constants/designSystem';
import Logo from '@/components/Logo';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function getPasswordStrength(pw: string): { level: 0 | 1 | 2 | 3; label: string; color: string } {
  if (pw.length === 0) return { level: 0, label: '', color: 'transparent' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[0-9]/.test(pw)) score++;
  if (score === 0 || pw.length < 8) return { level: 1, label: 'Weak', color: '#e05252' };
  if (score === 1) return { level: 2, label: 'Fair', color: '#f0a030' };
  return { level: 3, label: 'Strong', color: '#3dba6f' };
}

export default function SignupBusinessScreen() {
  const { data, setBusinessName, setFirstName, setLastName, setEmail, setPhone, setPassword } = useOnboarding();
  const { colors } = useTheme();
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();

  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!data.businessName.trim()) e.businessName = 'Business name is required';
    if (!data.firstName.trim()) e.firstName = 'First name is required';
    if (!data.lastName.trim()) e.lastName = 'Last name is required';
    if (!EMAIL_REGEX.test(data.email)) e.email = 'Enter a valid email address';
    if (data.password.length < 8) e.password = 'Password must be at least 8 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const isValid =
    data.businessName.trim().length > 0 &&
    data.firstName.trim().length > 0 &&
    data.lastName.trim().length > 0 &&
    EMAIL_REGEX.test(data.email) &&
    data.password.length >= 8;

  const handleContinue = () => {
    if (!validate()) return;
    const target = typeof code === 'string' && code.length === 6
      ? `/(auth)/signup-role?code=${code}`
      : '/(auth)/signup-role';
    router.push(target as any);
  };

  const s = makeStyles(colors);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={s.flex}
    >
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={s.logoRow}>
          <Logo size="medium" showLightning={false} />
        </View>

        <View style={s.header}>
          <Text style={[s.title, { color: colors.text }]}>Let's set up your business</Text>
          <Text style={[s.subtitle, { color: colors.textSecondary }]}>
            Takes less than 30 seconds. Start your free 14-day trial.
          </Text>
        </View>

        <View style={s.form}>
          <Field
            label="Business Name"
            icon={<Building2 size={18} color={colors.textSecondary} />}
            colors={colors}
          >
            <TextInput
              style={[s.input, { color: colors.text, backgroundColor: colors.inputBackground }]}
              placeholder="e.g. Smith's Lawn Care"
              placeholderTextColor={colors.textSecondary}
              value={data.businessName}
              onChangeText={setBusinessName}
              autoCapitalize="words"
              returnKeyType="next"
            />
            {errors.businessName ? <Text style={s.fieldError}>{errors.businessName}</Text> : null}
          </Field>

          <View style={s.row}>
            <View style={s.halfField}>
              <Field
                label="First Name"
                icon={<User size={18} color={colors.textSecondary} />}
                colors={colors}
              >
                <TextInput
                  style={[s.input, { color: colors.text, backgroundColor: colors.inputBackground }]}
                  placeholder="First"
                  placeholderTextColor={colors.textSecondary}
                  value={data.firstName}
                  onChangeText={setFirstName}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
                {errors.firstName ? <Text style={s.fieldError}>{errors.firstName}</Text> : null}
              </Field>
            </View>
            <View style={s.halfField}>
              <Field label="Last Name" colors={colors}>
                <TextInput
                  style={[s.input, { color: colors.text, backgroundColor: colors.inputBackground }]}
                  placeholder="Last"
                  placeholderTextColor={colors.textSecondary}
                  value={data.lastName}
                  onChangeText={setLastName}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
                {errors.lastName ? <Text style={s.fieldError}>{errors.lastName}</Text> : null}
              </Field>
            </View>
          </View>

          <Field
            label="Email"
            icon={<Mail size={18} color={colors.textSecondary} />}
            colors={colors}
          >
            <TextInput
              style={[s.input, { color: colors.text, backgroundColor: colors.inputBackground }]}
              placeholder="you@example.com"
              placeholderTextColor={colors.textSecondary}
              value={data.email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="next"
            />
            {errors.email ? <Text style={s.fieldError}>{errors.email}</Text> : null}
          </Field>

          <Field
            label="Phone (optional)"
            icon={<Phone size={18} color={colors.textSecondary} />}
            colors={colors}
          >
            <TextInput
              style={[s.input, { color: colors.text, backgroundColor: colors.inputBackground }]}
              placeholder="(555) 000-0000"
              placeholderTextColor={colors.textSecondary}
              value={data.phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              returnKeyType="next"
            />
          </Field>

          <Field
            label="Password"
            icon={<Lock size={18} color={colors.textSecondary} />}
            colors={colors}
          >
            <View style={s.passwordRow}>
              <TextInput
                style={[s.input, s.passwordInput, { color: colors.text, backgroundColor: colors.inputBackground }]}
                placeholder="At least 8 characters"
                placeholderTextColor={colors.textSecondary}
                value={data.password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={handleContinue}
              />
              <TouchableOpacity
                style={s.eyeBtn}
                onPress={() => setShowPassword(v => !v)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {showPassword
                  ? <EyeOff size={18} color={colors.textSecondary} />
                  : <Eye size={18} color={colors.textSecondary} />
                }
              </TouchableOpacity>
            </View>
            {data.password.length > 0 && (() => {
              const strength = getPasswordStrength(data.password);
              return (
                <View style={{ marginTop: 8, gap: 4 }}>
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    {([1, 2, 3] as const).map(lvl => (
                      <View
                        key={lvl}
                        style={{
                          flex: 1,
                          height: 3,
                          borderRadius: 2,
                          backgroundColor: strength.level >= lvl ? strength.color : colors.border,
                        }}
                      />
                    ))}
                  </View>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: strength.color }}>
                    {strength.label} password
                  </Text>
                </View>
              );
            })()}
            {errors.password ? <Text style={s.fieldError}>{errors.password}</Text> : null}
          </Field>
        </View>

        <TouchableOpacity
          style={[
            s.continueBtn,
            !isValid && s.btnDisabled,
          ]}
          onPress={handleContinue}
          disabled={!isValid}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['#1B4D6E', '#245d82']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.continueBtnGradient}
          >
            <Text style={s.continueBtnText}>Continue</Text>
            <ArrowRight size={20} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace('/login')} style={s.signInLink}>
          <Text style={[s.signInText, { color: colors.textSecondary }]}>
            Already have an account?{' '}
            <Text style={{ color: colors.primary, fontWeight: '600' }}>Sign in</Text>
          </Text>
        </TouchableOpacity>

        <Text style={[s.terms, { color: colors.textSecondary }]}>
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  icon,
  colors,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  colors: any;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginBottom: SPACING.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        {icon ? <View style={{ marginRight: 6 }}>{icon}</View> : null}
        <Text style={{ ...TYPOGRAPHY.label, color: colors.textSecondary }}>{label}</Text>
      </View>
      {children}
    </View>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    scroll: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xxl, paddingTop: SPACING.xl },
    logoRow: { alignItems: 'center', marginBottom: SPACING.xl },
    header: { marginBottom: SPACING.xl },
    title: { ...TYPOGRAPHY.screenTitle, marginBottom: SPACING.sm },
    subtitle: { ...TYPOGRAPHY.body },
    form: { marginBottom: SPACING.xl },
    row: { flexDirection: 'row', gap: SPACING.md },
    halfField: { flex: 1 },
    input: {
      borderRadius: 12,
      paddingHorizontal: SPACING.lg,
      paddingVertical: 14,
      fontSize: 15,
      borderWidth: 1,
      borderColor: colors.border,
    },
    passwordRow: { position: 'relative' },
    passwordInput: { paddingRight: 48 },
    eyeBtn: {
      position: 'absolute',
      right: 14,
      top: 14,
    },
    fieldError: {
      ...TYPOGRAPHY.caption,
      color: '#e53e3e',
      marginTop: 4,
    },
    continueBtn: {
      borderRadius: 14,
      overflow: 'hidden' as const,
      marginBottom: SPACING.lg,
    },
    continueBtnGradient: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      paddingVertical: 16,
      gap: SPACING.sm,
    },
    btnDisabled: { opacity: 0.45 },
    continueBtnText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    signInLink: { alignItems: 'center', marginBottom: SPACING.lg },
    signInText: { ...TYPOGRAPHY.body },
    terms: {
      ...TYPOGRAPHY.caption,
      textAlign: 'center',
      lineHeight: 18,
    },
  });
}
