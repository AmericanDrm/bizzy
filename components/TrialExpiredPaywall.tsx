import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  Modal,
  Platform,
} from 'react-native';
import { Check, Zap, ArrowRight, X, ExternalLink } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { SPACING, TYPOGRAPHY } from '@/constants/designSystem';
import Logo from '@/components/Logo';

const PLANS = [
  {
    slug: 'lite',
    name: 'Bizzy Lite',
    monthlyPrice: '$12',
    annualPrice: '$10',
    annualBilled: '$120/year',
    users: '1 user',
    clients: 'Up to 50 clients',
    highlight: false,
    color: '#374151',
    features: ['Scheduling & calendar', 'Invoicing', 'Client management', 'Job notes & photos'],
    comingSoon: [],
    monthlyUrl: 'https://buy.stripe.com/7sY5kC9to2Kr1702HXg7e02',
    annualUrl: 'https://buy.stripe.com/6oU8wO8pk0Cj3f8dmBg7e06',
  },
  {
    slug: 'basic',
    name: 'Bizzy Basic',
    monthlyPrice: '$35',
    annualPrice: '$28',
    annualBilled: '$336/year',
    users: 'Up to 3 users',
    clients: 'Up to 125 clients',
    highlight: false,
    color: '#0891b2',
    features: ['Everything in Lite', 'Time clock', 'Recurring jobs', 'Estimates w/ approvals', 'Receipt scanning', 'Message templates', 'Camera + notes + checklists', 'Finances'],
    comingSoon: [],
    monthlyUrl: 'https://buy.stripe.com/14A4gybBw3Ovg1U6Ydg7e03',
    annualUrl: 'https://buy.stripe.com/dRm8wO4945WD6rkcixg7e07',
  },
  {
    slug: 'pro',
    name: 'Bizzy Pro',
    monthlyPrice: '$95',
    annualPrice: '$76',
    annualBilled: '$912/year',
    users: 'Up to 5 users',
    clients: 'Unlimited clients',
    highlight: true,
    color: '#1B4D6E',
    features: ['Everything in Basic', 'Live crew GPS', 'Route optimization', 'Advanced analytics', 'Mileage + vehicle tracking', 'Job checklists + work orders', 'Broadcast messaging', 'Custom branding', 'SMS + email messaging', 'Priority support', 'High-Availability Guarantee (99.9% uptime)'],
    comingSoon: ['Client portal', 'Automations'],
    monthlyUrl: 'https://buy.stripe.com/dRm3cubBw0CjbLE82hg7e04',
    annualUrl: 'https://buy.stripe.com/aFa4gyeNI4SzbLE5U9g7e08',
  },
  {
    slug: 'corp',
    name: 'Bizzy Corp',
    monthlyPrice: '$180',
    annualPrice: '$144',
    annualBilled: '$1,728/year',
    users: 'Unlimited users',
    clients: 'Unlimited clients',
    highlight: false,
    color: '#2D8B57',
    features: ['Everything in Pro', 'Multi-location management', 'White-label portal', 'Custom roles & permissions', 'Data export', 'Dedicated account manager', 'Priority 24/7 support'],
    comingSoon: [],
    monthlyUrl: 'https://buy.stripe.com/3cIfZgbBwacT3f8fuJg7e05',
    annualUrl: 'https://buy.stripe.com/fZu14mgVQ1GneXQ1DTg7e09',
  },
];

interface Props {
  visible: boolean;
  onDismiss?: () => void;
  allowDismiss?: boolean;
}

const PLAN_GRADIENT_MAP: Record<string, [string, string]> = {
  '#374151': ['#374151', '#4b5563'],
  '#0891b2': ['#0891b2', '#0e7490'],
  '#1B4D6E': ['#1B4D6E', '#245d82'],
  '#2D8B57': ['#2D8B57', '#34a065'],
};

const EXTRA_SEAT_URL = 'https://buy.stripe.com/cNi7sK9to5WD5ng6Ydg7e01';

export default function TrialExpiredPaywall({ visible, onDismiss, allowDismiss = false }: Props) {
  const { colors } = useTheme();
  const { subscription } = useSubscription();
  const [selectedPlan, setSelectedPlan] = useState('pro');
  const [isAnnual, setIsAnnual] = useState(false);

  const s = makeStyles(colors);

  const currentPlanIndex = PLANS.findIndex(p => p.slug === subscription?.plan_slug);
  const availablePlans = currentPlanIndex >= 0 ? PLANS.slice(currentPlanIndex) : PLANS;

  const handleUpgrade = (url: string) => {
    Linking.openURL(url);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={allowDismiss ? onDismiss : undefined}
    >
      <View style={[s.container, { backgroundColor: colors.background }]}>
        <View style={s.topBar}>
          <Logo size="small" showLightning={false} />
          {allowDismiss && onDismiss ? (
            <TouchableOpacity onPress={onDismiss} style={s.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 32 }} />
          )}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
          <View style={s.hero}>
            <View style={[s.heroIcon, { backgroundColor: colors.primary + '18' }]}>
              <Zap size={36} color={colors.primary} />
            </View>
            <Text style={[s.heroTitle, { color: colors.text }]}>Your free trial has ended</Text>
            <Text style={[s.heroSubtitle, { color: colors.textSecondary }]}>
              Choose a plan to keep using Bizzy. All plans include a 14-day free trial — pick what fits your business size.
            </Text>
          </View>

          <View style={s.billingToggle}>
            <Text style={[s.billingLabel, { color: colors.text, opacity: isAnnual ? 0.5 : 1 }]}>Monthly</Text>
            <TouchableOpacity
              style={[s.toggleTrack, { backgroundColor: isAnnual ? colors.primary : colors.border }]}
              onPress={() => setIsAnnual(!isAnnual)}
              activeOpacity={0.8}
            >
              <View style={[s.toggleKnob, isAnnual && s.toggleKnobActive]} />
            </TouchableOpacity>
            <Text style={[s.billingLabel, { color: colors.text, opacity: isAnnual ? 1 : 0.5 }]}>Annual</Text>
            <View style={[s.saveBadge, { backgroundColor: '#059669' }]}>
              <Text style={s.saveBadgeText}>Save 20%</Text>
            </View>
          </View>

          {availablePlans.map((plan) => {
            const isSelected = selectedPlan === plan.slug;
            return (
              <TouchableOpacity
                key={plan.slug}
                style={[
                  s.planCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  isSelected && { borderColor: plan.color, borderWidth: 2 },
                  plan.highlight && !isSelected && { borderColor: plan.color + '60' },
                ]}
                onPress={() => setSelectedPlan(plan.slug)}
                activeOpacity={0.85}
              >
                {plan.highlight && (
                  <View style={[s.popularBadge, { backgroundColor: plan.color }]}>
                    <Text style={s.popularText}>Most Popular</Text>
                  </View>
                )}

                <View style={s.planHeader}>
                  <View style={s.planTitleRow}>
                    <Text style={[s.planName, { color: colors.text }]}>{plan.name}</Text>
                    {isSelected && (
                      <View style={[s.selectedCheck, { backgroundColor: plan.color }]}>
                        <Check size={12} color="#fff" />
                      </View>
                    )}
                  </View>
                  <View style={s.planPriceRow}>
                    <Text style={[s.planPrice, { color: plan.color }]}>{isAnnual ? plan.annualPrice : plan.monthlyPrice}</Text>
                    <Text style={[s.planPricePer, { color: colors.textSecondary }]}>/mo</Text>
                  </View>
                  {isAnnual && (
                    <Text style={[s.annualNote, { color: '#059669' }]}>Billed {plan.annualBilled}</Text>
                  )}
                  <Text style={[s.planMeta, { color: colors.textSecondary }]}>
                    {plan.users} · {plan.clients}
                  </Text>
                </View>

                {isSelected && (
                  <View style={s.featureList}>
                    {plan.features.map((f) => (
                      <View key={f} style={s.featureRow}>
                        <Check size={14} color={plan.color} />
                        <Text style={[s.featureText, { color: colors.textSecondary }]}>{f}</Text>
                      </View>
                    ))}
                    {plan.comingSoon.map((f) => (
                      <View key={f} style={s.featureRow}>
                        <Check size={14} color={colors.textSecondary} />
                        <Text style={[s.featureText, { color: colors.textSecondary }]}>{f}</Text>
                        <View style={[s.comingSoonBadge, { backgroundColor: plan.color + '22', borderColor: plan.color + '55' }]}>
                          <Text style={[s.comingSoonText, { color: plan.color }]}>Soon</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {isSelected && (
                  <TouchableOpacity
                    style={[s.upgradeBtn, { overflow: 'hidden' }]}
                    onPress={() => handleUpgrade(isAnnual ? plan.annualUrl : plan.monthlyUrl)}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={PLAN_GRADIENT_MAP[plan.color] || ['#1B4D6E', '#245d82']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <Text style={s.upgradeBtnText}>Start Free Trial — {plan.name}</Text>
                    <ExternalLink size={16} color="#fff" />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity onPress={() => handleUpgrade(EXTRA_SEAT_URL)} activeOpacity={0.7}>
            <Text style={[s.note, { color: colors.textSecondary }]}>
              Need extra team members? <Text style={{ color: colors.primary, textDecorationLine: 'underline' }}>Add seats at $22/seat/month</Text> on any plan. Cancel anytime. No long-term contract required.
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    container: { flex: 1 },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.xl,
      paddingTop: Platform.OS === 'ios' ? SPACING.xl : SPACING.xxl,
      paddingBottom: SPACING.md,
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    scroll: {
      paddingHorizontal: SPACING.xl,
      paddingBottom: SPACING.xxl,
    },
    hero: {
      alignItems: 'center',
      paddingVertical: SPACING.xl,
      gap: SPACING.md,
      marginBottom: SPACING.lg,
    },
    heroIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroTitle: {
      ...TYPOGRAPHY.screenTitle,
      textAlign: 'center',
    },
    heroSubtitle: {
      ...TYPOGRAPHY.body,
      textAlign: 'center',
      lineHeight: 22,
      maxWidth: 320,
    },
    planCard: {
      borderRadius: 16,
      borderWidth: 1.5,
      padding: SPACING.lg,
      marginBottom: SPACING.md,
      overflow: 'hidden',
      position: 'relative',
    },
    popularBadge: {
      position: 'absolute',
      top: 0,
      right: 0,
      paddingHorizontal: SPACING.md,
      paddingVertical: 4,
      borderBottomLeftRadius: 10,
    },
    popularText: {
      color: '#fff',
      fontSize: 11,
      fontWeight: '700',
    },
    billingToggle: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      gap: SPACING.sm,
      marginBottom: SPACING.xl,
    },
    billingLabel: {
      fontSize: 14,
      fontWeight: '600' as const,
    },
    toggleTrack: {
      width: 48,
      height: 28,
      borderRadius: 14,
      padding: 3,
      justifyContent: 'center' as const,
    },
    toggleKnob: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: '#fff',
    },
    toggleKnobActive: {
      alignSelf: 'flex-end' as const,
    },
    saveBadge: {
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    saveBadgeText: {
      color: '#fff',
      fontSize: 11,
      fontWeight: '700' as const,
    },
    annualNote: {
      fontSize: 12,
      fontWeight: '600' as const,
      marginTop: 2,
    },
    planHeader: { marginBottom: SPACING.sm },
    planTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      marginBottom: 4,
    },
    planName: { ...TYPOGRAPHY.heading },
    selectedCheck: {
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    planPriceRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 4,
    },
    planPrice: {
      fontSize: 28,
      fontWeight: '700',
    },
    planPricePer: { ...TYPOGRAPHY.body },
    planMeta: {
      ...TYPOGRAPHY.caption,
      marginTop: 4,
    },
    featureList: {
      gap: SPACING.sm,
      paddingTop: SPACING.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      marginTop: SPACING.sm,
      marginBottom: SPACING.md,
    },
    featureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
    },
    featureText: { ...TYPOGRAPHY.body, flex: 1 },
    comingSoonBadge: {
      borderRadius: 4,
      borderWidth: 1,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    comingSoonText: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
    upgradeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
      borderRadius: 12,
      paddingVertical: 14,
    },
    upgradeBtnText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '600',
    },
    note: {
      ...TYPOGRAPHY.caption,
      textAlign: 'center',
      marginTop: SPACING.md,
      lineHeight: 18,
    },
  });
}
