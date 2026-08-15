import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, User, Users } from 'lucide-react-native';
import { useOnboarding } from '@/lib/onboarding/store';
import { useTheme } from '@/contexts/ThemeContext';
import { SPACING, TYPOGRAPHY } from '@/constants/designSystem';
import Logo from '@/components/Logo';

const TEAM_SIZES = [
  { key: 'just_me', label: 'Just me', desc: 'Solo operator', Icon: User },
  { key: '2_5', label: '2–5', desc: 'Small team', Icon: Users },
  { key: '6_10', label: '6–10', desc: 'Growing crew', Icon: Users },
  { key: '10_plus', label: '10+', desc: 'Large operation', Icon: Users },
];

export default function SignupTeamScreen() {
  const { data, setTeamSize } = useOnboarding();
  const { colors } = useTheme();
  const router = useRouter();

  const handleSelect = (key: string) => {
    setTeamSize(key);
    router.push('/(auth)/signup-goal');
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
          <View style={[s.progressFill, { backgroundColor: colors.primary, width: '66%' }]} />
        </View>
        <Text style={[s.progressText, { color: colors.textSecondary }]}>Step 2 of 3</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <Text style={[s.title, { color: colors.text }]}>How big is your team?</Text>
          <Text style={[s.subtitle, { color: colors.textSecondary }]}>
            This helps us set up the right features for you.
          </Text>
        </View>

        <View style={s.list}>
          {TEAM_SIZES.map(({ key, label, desc, Icon }) => {
            const selected = data.teamSize === key;
            return (
              <TouchableOpacity
                key={key}
                style={[
                  s.card,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  selected && { borderColor: colors.primary, backgroundColor: colors.primaryLight },
                ]}
                onPress={() => handleSelect(key)}
                activeOpacity={0.8}
              >
                <View style={[s.iconWrap, { backgroundColor: selected ? colors.primary + '20' : colors.inputBackground }]}>
                  <Icon size={22} color={selected ? colors.primary : colors.textSecondary} />
                </View>
                <View style={s.cardText}>
                  <Text style={[s.cardLabel, { color: selected ? colors.primary : colors.text }]}>
                    {label}
                  </Text>
                  <Text style={[s.cardDesc, { color: colors.textSecondary }]}>{desc}</Text>
                </View>
                <View style={[
                  s.radio,
                  { borderColor: selected ? colors.primary : colors.border },
                ]}>
                  {selected && <View style={[s.radioDot, { backgroundColor: colors.primary }]} />}
                </View>
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
    list: { gap: SPACING.md },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 16,
      borderWidth: 1.5,
      padding: SPACING.lg,
      gap: SPACING.md,
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardText: { flex: 1 },
    cardLabel: {
      ...TYPOGRAPHY.headingMedium,
      marginBottom: 2,
    },
    cardDesc: { ...TYPOGRAPHY.caption },
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
  });
}
