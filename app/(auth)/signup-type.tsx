import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight, Leaf, Wind, Droplets, Zap, Sparkles, Wrench, MoreHorizontal } from 'lucide-react-native';
import { useOnboarding } from '@/lib/onboarding/store';
import { useTheme } from '@/contexts/ThemeContext';
import { SPACING, TYPOGRAPHY } from '@/constants/designSystem';
import Logo from '@/components/Logo';

const BUSINESS_TYPES = [
  { key: 'lawn_care', label: 'Lawn Care', Icon: Leaf, color: '#2D8B57' },
  { key: 'hvac', label: 'HVAC', Icon: Wind, color: '#0891b2' },
  { key: 'plumbing', label: 'Plumbing', Icon: Droplets, color: '#1B4D6E' },
  { key: 'electrical', label: 'Electrical', Icon: Zap, color: '#d4850a' },
  { key: 'cleaning', label: 'Cleaning', Icon: Sparkles, color: '#7c3aed' },
  { key: 'handyman', label: 'Handyman', Icon: Wrench, color: '#374151' },
  { key: 'other', label: 'Other', Icon: MoreHorizontal, color: '#6B7280' },
];

export default function SignupTypeScreen() {
  const { data, setBusinessType } = useOnboarding();
  const { colors } = useTheme();
  const router = useRouter();

  const handleSelect = (key: string) => {
    setBusinessType(key);
    router.push('/(auth)/signup-team');
  };

  const s = makeStyles(colors);

  return (
    <View style={s.container}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <Logo size="small" showLightning={false} />
        <View style={{ width: 38 }} />
      </View>

      <View style={s.progress}>
        <View style={[s.progressBar, { backgroundColor: colors.border }]}>
          <View style={[s.progressFill, { backgroundColor: colors.primary, width: '33%' }]} />
        </View>
        <Text style={[s.progressText, { color: colors.textSecondary }]}>Step 1 of 3</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <Text style={[s.title, { color: colors.text }]}>What type of business do you run?</Text>
          <Text style={[s.subtitle, { color: colors.textSecondary }]}>
            We'll tailor Bizzy to fit your trade.
          </Text>
        </View>

        <View style={s.grid}>
          {BUSINESS_TYPES.map(({ key, label, Icon, color }) => {
            const selected = data.businessType === key;
            return (
              <TouchableOpacity
                key={key}
                style={[
                  s.tile,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  selected && { borderColor: colors.primary, backgroundColor: colors.primaryLight },
                ]}
                onPress={() => handleSelect(key)}
                activeOpacity={0.8}
              >
                <View style={[s.iconWrap, { backgroundColor: color + '18' }]}>
                  <Icon size={26} color={selected ? colors.primary : color} />
                </View>
                <Text
                  style={[
                    s.tileLabel,
                    { color: selected ? colors.primary : colors.text },
                  ]}
                >
                  {label}
                </Text>
                {selected && (
                  <View style={[s.selectedDot, { backgroundColor: colors.primary }]} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.xl,
      paddingTop: SPACING.xxl,
      paddingBottom: SPACING.md,
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
    progress: {
      paddingHorizontal: SPACING.xl,
      marginBottom: SPACING.lg,
    },
    progressBar: {
      height: 4,
      borderRadius: 2,
      overflow: 'hidden',
      marginBottom: 6,
    },
    progressFill: {
      height: 4,
      borderRadius: 2,
    },
    progressText: { ...TYPOGRAPHY.caption },
    scroll: {
      paddingHorizontal: SPACING.xl,
      paddingBottom: SPACING.xxl,
    },
    header: { marginBottom: SPACING.xl },
    title: { ...TYPOGRAPHY.screenTitle, marginBottom: SPACING.sm },
    subtitle: { ...TYPOGRAPHY.body },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.md,
    },
    tile: {
      width: '47%',
      borderRadius: 16,
      borderWidth: 1.5,
      padding: SPACING.lg,
      alignItems: 'center',
      position: 'relative',
      minHeight: 110,
      justifyContent: 'center',
    },
    iconWrap: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.sm,
    },
    tileLabel: {
      ...TYPOGRAPHY.bodyMedium,
      fontWeight: '600',
    },
    selectedDot: {
      position: 'absolute',
      top: 10,
      right: 10,
      width: 8,
      height: 8,
      borderRadius: 4,
    },
  });
}
