import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, FileText, UserPlus, CalendarPlus, Receipt, Clock, ScanLine, Compass } from 'lucide-react-native';
import { useOnboarding } from '@/lib/onboarding/store';
import { useTheme } from '@/contexts/ThemeContext';
import { SPACING, TYPOGRAPHY } from '@/constants/designSystem';
import Logo from '@/components/Logo';

const GOALS = [
  { key: 'estimate', label: 'Create an estimate', Icon: FileText, color: '#0891b2' },
  { key: 'client', label: 'Add a client', Icon: UserPlus, color: '#2D8B57' },
  { key: 'schedule', label: 'Schedule a job', Icon: CalendarPlus, color: '#1B4D6E' },
  { key: 'invoice', label: 'Send an invoice', Icon: Receipt, color: '#d4850a' },
  { key: 'time', label: 'Track time', Icon: Clock, color: '#7c3aed' },
  { key: 'receipt', label: 'Scan a receipt', Icon: ScanLine, color: '#374151' },
  { key: 'explore', label: 'Explore the app', Icon: Compass, color: '#6B7280' },
];

export default function SignupGoalScreen() {
  const { data, setPrimaryGoal } = useOnboarding();
  const { colors } = useTheme();
  const router = useRouter();

  const handleSelect = (key: string) => {
    setPrimaryGoal(key);
    router.push('/(auth)/signup-complete');
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
          <View style={[s.progressFill, { backgroundColor: colors.primary, width: '100%' }]} />
        </View>
        <Text style={[s.progressText, { color: colors.textSecondary }]}>Step 3 of 3</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <Text style={[s.title, { color: colors.text }]}>What do you want to do first?</Text>
          <Text style={[s.subtitle, { color: colors.textSecondary }]}>
            We'll take you straight there after setup.
          </Text>
        </View>

        <View style={s.grid}>
          {GOALS.map(({ key, label, Icon, color }) => {
            const selected = data.primaryGoal === key;
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
                  <Icon size={24} color={selected ? colors.primary : color} />
                </View>
                <Text
                  style={[
                    s.tileLabel,
                    { color: selected ? colors.primary : colors.text },
                  ]}
                  numberOfLines={2}
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
      minHeight: 100,
      justifyContent: 'center',
    },
    iconWrap: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.sm,
    },
    tileLabel: {
      ...TYPOGRAPHY.label,
      fontWeight: '600',
      textAlign: 'center',
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
