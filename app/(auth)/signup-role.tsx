import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, ArrowRight, Shield, Users } from 'lucide-react-native';
import { useOnboarding } from '@/lib/onboarding/store';
import { useTheme } from '@/contexts/ThemeContext';
import { SPACING, TYPOGRAPHY } from '@/constants/designSystem';
import Logo from '@/components/Logo';

export default function SignupRoleScreen() {
  const { data, setRole, setJoinCode } = useOnboarding();
  const { colors } = useTheme();
  const router = useRouter();
  const { code: codeParam } = useLocalSearchParams<{ code: string }>();

  const prefillCode = typeof codeParam === 'string' && codeParam.length === 6 ? codeParam : '';

  const [selected, setSelected] = useState<'owner' | 'employee' | ''>(
    prefillCode ? 'employee' : ((data.role as 'owner' | 'employee' | '') || '')
  );
  const [joinCodeDigits, setJoinCodeDigits] = useState<string[]>(
    prefillCode ? prefillCode.split('') :
    data.joinCode ? data.joinCode.split('') : ['', '', '', '', '', '']
  );

  useEffect(() => {
    if (prefillCode) {
      setSelected('employee');
      setJoinCodeDigits(prefillCode.split(''));
    }
  }, [prefillCode]);
  const [joinCodeError, setJoinCodeError] = useState('');
  const codeRefs = useRef<(TextInput | null)[]>([]);

  const fullCode = joinCodeDigits.join('');

  const handleDigitChange = (value: string, index: number) => {
    const digit = value.replace(/[^0-9]/g, '').slice(-1);
    const next = [...joinCodeDigits];
    next[index] = digit;
    setJoinCodeDigits(next);
    setJoinCodeError('');
    if (digit && index < 5) {
      codeRefs.current[index + 1]?.focus();
    }
  };

  const handleDigitKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !joinCodeDigits[index] && index > 0) {
      codeRefs.current[index - 1]?.focus();
      const next = [...joinCodeDigits];
      next[index - 1] = '';
      setJoinCodeDigits(next);
    }
  };

  const handleContinue = () => {
    if (!selected) return;

    if (selected === 'employee') {
      if (fullCode.length !== 6) {
        setJoinCodeError('Please enter the full 6-digit code');
        return;
      }
      setRole('employee');
      setJoinCode(fullCode);
      router.push('/(auth)/signup-complete');
    } else {
      setRole('owner');
      router.push('/(auth)/signup-type');
    }
  };

  const s = makeStyles(colors);
  const canContinue =
    selected === 'owner' ||
    (selected === 'employee' && fullCode.length === 6);

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
        <View style={s.topBar}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={s.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ArrowLeft size={22} color={colors.text} />
          </TouchableOpacity>
          <Logo size="small" showLightning={false} />
          <View style={{ width: 38 }} />
        </View>

        <View style={s.header}>
          <Text style={[s.title, { color: colors.text }]}>What's your role?</Text>
          <Text style={[s.subtitle, { color: colors.textSecondary }]}>
            Are you setting up a new business, or joining an existing team?
          </Text>
        </View>

        <View style={s.cards}>
          <TouchableOpacity
            style={[
              s.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
              selected === 'owner' && { borderColor: colors.primary, backgroundColor: colors.primaryLight },
            ]}
            onPress={() => { setSelected('owner'); setJoinCodeError(''); }}
            activeOpacity={0.8}
          >
            <View style={[s.iconWrap, { backgroundColor: selected === 'owner' ? colors.primary + '20' : colors.inputBackground }]}>
              <Shield size={24} color={selected === 'owner' ? colors.primary : colors.textSecondary} />
            </View>
            <View style={s.cardBody}>
              <Text style={[s.cardTitle, { color: selected === 'owner' ? colors.primary : colors.text }]}>
                I'm an Owner / Admin
              </Text>
              <Text style={[s.cardDesc, { color: colors.textSecondary }]}>
                Set up a new business and invite your team
              </Text>
            </View>
            <View style={[s.radio, { borderColor: selected === 'owner' ? colors.primary : colors.border }]}>
              {selected === 'owner' && <View style={[s.radioDot, { backgroundColor: colors.primary }]} />}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              s.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
              selected === 'employee' && { borderColor: '#0891b2', backgroundColor: '#0891b210' },
            ]}
            onPress={() => setSelected('employee')}
            activeOpacity={0.8}
          >
            <View style={[s.iconWrap, { backgroundColor: selected === 'employee' ? '#0891b220' : colors.inputBackground }]}>
              <Users size={24} color={selected === 'employee' ? '#0891b2' : colors.textSecondary} />
            </View>
            <View style={s.cardBody}>
              <Text style={[s.cardTitle, { color: selected === 'employee' ? '#0891b2' : colors.text }]}>
                I'm an Employee
              </Text>
              <Text style={[s.cardDesc, { color: colors.textSecondary }]}>
                Join an existing team with an organization code
              </Text>
            </View>
            <View style={[s.radio, { borderColor: selected === 'employee' ? '#0891b2' : colors.border }]}>
              {selected === 'employee' && <View style={[s.radioDot, { backgroundColor: '#0891b2' }]} />}
            </View>
          </TouchableOpacity>
        </View>

        {selected === 'employee' && (
          <View style={s.codeSection}>
            <Text style={[s.codeLabel, { color: colors.text }]}>Organization Code</Text>
            <Text style={[s.codeHint, { color: colors.textSecondary }]}>
              Ask your admin for the 6-digit code
            </Text>
            <View style={s.codeRow}>
              {joinCodeDigits.map((digit, i) => (
                <TextInput
                  key={i}
                  ref={ref => { codeRefs.current[i] = ref; }}
                  style={[
                    s.codeInput,
                    { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text },
                    digit ? { borderColor: '#0891b2' } : null,
                  ]}
                  value={digit}
                  onChangeText={v => handleDigitChange(v, i)}
                  onKeyPress={e => handleDigitKeyPress(e, i)}
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                  textAlign="center"
                />
              ))}
            </View>
            {joinCodeError ? (
              <Text style={s.codeError}>{joinCodeError}</Text>
            ) : null}
          </View>
        )}

        <TouchableOpacity
          style={[s.continueBtn, !canContinue && s.btnDisabled]}
          onPress={handleContinue}
          disabled={!canContinue}
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    scroll: {
      paddingHorizontal: SPACING.xl,
      paddingBottom: SPACING.xxl,
      paddingTop: SPACING.xl,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: SPACING.xl,
    },
    backBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    header: { marginBottom: SPACING.xl },
    title: { ...TYPOGRAPHY.screenTitle, marginBottom: SPACING.sm },
    subtitle: { ...TYPOGRAPHY.body, lineHeight: 22 },
    cards: { gap: SPACING.md, marginBottom: SPACING.xl },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 16,
      borderWidth: 1.5,
      padding: SPACING.lg,
      gap: SPACING.md,
    },
    iconWrap: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardBody: { flex: 1 },
    cardTitle: {
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 2,
    },
    cardDesc: {
      fontSize: 13,
      lineHeight: 18,
    },
    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    codeSection: {
      marginBottom: SPACING.xl,
    },
    codeLabel: {
      fontSize: 15,
      fontWeight: '600',
      marginBottom: 4,
    },
    codeHint: {
      fontSize: 13,
      marginBottom: SPACING.md,
    },
    codeRow: {
      flexDirection: 'row',
      gap: SPACING.sm,
    },
    codeInput: {
      flex: 1,
      aspectRatio: 1,
      borderRadius: 12,
      borderWidth: 1.5,
      fontSize: 22,
      fontWeight: '700',
      textAlign: 'center',
      maxWidth: 52,
    },
    codeError: {
      color: '#e53e3e',
      fontSize: 13,
      marginTop: SPACING.sm,
    },
    continueBtn: {
      borderRadius: 14,
      overflow: 'hidden',
    },
    continueBtnGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      gap: SPACING.sm,
    },
    btnDisabled: { opacity: 0.45 },
    continueBtnText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
  });
}
