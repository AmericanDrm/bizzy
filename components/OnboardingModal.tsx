import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CircleCheck as CheckCircle, Copy, Building2, Users, ChevronRight, Sparkles, Calendar, FileText, Clock } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface OnboardingModalProps {
  visible: boolean;
  orgName: string;
  joinCode: string;
  onFinish: () => void;
}

type Step = 'welcome' | 'join_code' | 'features' | 'done';

const FEATURE_ITEMS = [
  { icon: Calendar, label: 'Schedule jobs & clients', color: '#1B4D6E' },
  { icon: FileText, label: 'Create & send invoices', color: '#059669' },
  { icon: Clock, label: 'Track time & payroll', color: '#d97706' },
  { icon: Users, label: 'Manage your team', color: '#0891b2' },
];

export default function OnboardingModal({ visible, orgName, joinCode, onFinish }: OnboardingModalProps) {
  const [step, setStep] = useState<Step>('welcome');
  const [codeCopied, setCodeCopied] = useState(false);
  const { colors, isDark } = useTheme();

  const handleCopyCode = async () => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(joinCode);
        setCodeCopied(true);
        setTimeout(() => setCodeCopied(false), 2500);
      } catch {}
    }
  };

  const handleNext = () => {
    if (step === 'welcome') setStep('join_code');
    else if (step === 'join_code') setStep('features');
    else if (step === 'features') setStep('done');
    else onFinish();
  };

  const stepIndex = { welcome: 0, join_code: 1, features: 2, done: 3 }[step];
  const totalSteps = 4;

  const s = styles(colors, isDark);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.progressRow}>
            {Array.from({ length: totalSteps }).map((_, i) => (
              <View
                key={i}
                style={[s.progressDot, i <= stepIndex && s.progressDotActive]}
              />
            ))}
          </View>

          {step === 'welcome' && (
            <View style={s.stepContent}>
              <View style={s.iconCircle}>
                <Sparkles size={36} color="#fff" />
              </View>
              <Text style={s.heading}>Welcome to Bizzy!</Text>
              <Text style={s.subheading}>Your business is set up and ready to go.</Text>
              <View style={s.orgNameBadge}>
                <Building2 size={16} color={colors.primary} />
                <Text style={s.orgNameText}>{orgName}</Text>
              </View>
              <Text style={s.body}>
                In the next few steps we'll give you everything you need to hit the ground running.
              </Text>
            </View>
          )}

          {step === 'join_code' && (
            <View style={s.stepContent}>
              <View style={[s.iconCircle, { backgroundColor: '#0891b2' }]}>
                <Users size={36} color="#fff" />
              </View>
              <Text style={s.heading}>Invite Your Team</Text>
              <Text style={s.body}>
                Share this 6-digit code with your employees so they can join your organization. You can find it again later in Settings.
              </Text>
              <View style={s.codeBox}>
                <Text style={s.codeText}>{joinCode}</Text>
                <TouchableOpacity style={s.copyBtn} onPress={handleCopyCode}>
                  {codeCopied
                    ? <CheckCircle size={20} color="#16a34a" />
                    : <Copy size={20} color={colors.primary} />
                  }
                </TouchableOpacity>
              </View>
              {codeCopied && <Text style={s.copiedNote}>Copied to clipboard!</Text>}
              <Text style={s.hint}>Employees choose "I'm an Employee" during sign-up and enter this code.</Text>
            </View>
          )}

          {step === 'features' && (
            <View style={s.stepContent}>
              <View style={[s.iconCircle, { backgroundColor: '#059669' }]}>
                <CheckCircle size={36} color="#fff" />
              </View>
              <Text style={s.heading}>What You Can Do</Text>
              <Text style={s.body}>Here's a quick look at what's waiting for you inside Bizzy:</Text>
              <View style={s.featureList}>
                {FEATURE_ITEMS.map(({ icon: Icon, label, color }) => (
                  <View key={label} style={s.featureItem}>
                    <View style={[s.featureIcon, { backgroundColor: color + '18' }]}>
                      <Icon size={20} color={color} />
                    </View>
                    <Text style={s.featureLabel}>{label}</Text>
                  </View>
                ))}
              </View>
              <Text style={s.hint}>A "Getting Started" checklist on your dashboard will guide you through setup.</Text>
            </View>
          )}

          {step === 'done' && (
            <View style={s.stepContent}>
              <View style={[s.iconCircle, { backgroundColor: '#d97706' }]}>
                <Sparkles size={36} color="#fff" />
              </View>
              <Text style={s.heading}>You're All Set!</Text>
              <Text style={s.body}>
                Your workspace is ready. Head to your dashboard to start adding clients, scheduling jobs, and more.
              </Text>
              <View style={s.tipBox}>
                <Text style={s.tipTitle}>Pro Tip</Text>
                <Text style={s.tipBody}>Check the Getting Started checklist on your home screen for step-by-step setup guidance.</Text>
              </View>
            </View>
          )}

          <TouchableOpacity style={s.nextBtn} onPress={handleNext}>
            <LinearGradient
              colors={['#1B4D6E', '#245d82']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.nextBtnGradient}
            >
              <Text style={s.nextBtnText}>
                {step === 'done' ? 'Go to Dashboard' : 'Continue'}
              </Text>
              <ChevronRight size={18} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = (colors: any, isDark: boolean) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sheet: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 20,
    paddingHorizontal: 28,
    paddingBottom: Platform.OS === 'ios' ? 44 : 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 28,
  },
  progressDot: {
    width: 28,
    height: 4,
    borderRadius: 2,
    backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : '#e2e8f0',
  },
  progressDotActive: {
    backgroundColor: colors.primary,
  },
  stepContent: {
    alignItems: 'center',
    gap: 14,
    marginBottom: 28,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  heading: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  subheading: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },
  orgNameBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : colors.primary + '12',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  orgNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9',
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 16,
    borderWidth: 2,
    borderColor: colors.primary + '30',
  },
  codeText: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 8,
    flex: 1,
    textAlign: 'center',
  },
  copyBtn: {
    padding: 4,
  },
  copiedNote: {
    fontSize: 13,
    fontWeight: '600',
    color: '#16a34a',
  },
  hint: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    fontStyle: 'italic',
  },
  featureList: {
    width: '100%',
    gap: 10,
    marginTop: 4,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 2,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  tipBox: {
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#fefce8',
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#d97706',
    width: '100%',
  },
  tipTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#d97706',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tipBody: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  nextBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  nextBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  nextBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
