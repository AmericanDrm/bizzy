import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOrganization } from './OrganizationContext';

export type PlanSlug = 'lite' | 'basic' | 'pro' | 'corp';

export interface PlanFeatures {
  scheduling: boolean;
  invoicing: boolean;
  job_notes_photos: boolean;
  expense_tracking: boolean;
  time_clock: boolean;
  recurring_jobs: boolean;
  estimates: boolean;
  receipt_scanning: boolean;
  sms: boolean;
  messaging: boolean;
  client_portal: boolean;
  gps_tracking: boolean;
  route_optimization: boolean;
  analytics: boolean;
  mileage_tracking: boolean;
  work_orders: boolean;
  broadcast_messaging: boolean;
  custom_branding: boolean;
  ai_assist: boolean;
  camera: boolean;
  notes_checklists: boolean;
  client_management: boolean;
  finances: boolean;
  productivity_reports: boolean;
  multi_location: boolean;
  white_label: boolean;
  automations: boolean;
}

export interface OrgSubscription {
  plan_id: string;
  plan_slug: PlanSlug;
  plan_name: string;
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused';
  included_users: number;
  extra_users: number;
  total_allowed_users: number;
  max_clients: number | null;
  monthly_price: number;
  extra_user_price: number;
  features: PlanFeatures;
  trial_ends_at: string | null;
  current_period_end: string | null;
  is_trial: boolean;
  trial_days_remaining: number;
}

interface SubscriptionContextType {
  subscription: OrgSubscription | null;
  loading: boolean;
  refreshSubscription: () => Promise<void>;
  hasFeature: (key: keyof PlanFeatures) => boolean;
  canAddUser: (currentUserCount: number) => boolean;
  isAtClientLimit: (currentClientCount: number) => boolean;
  getUpgradeReason: (key: keyof PlanFeatures) => string;
  nextTierName: string | null;
  isTrialing: boolean;
  trialDaysRemaining: number;
}

const TIER_ORDER: PlanSlug[] = ['lite', 'basic', 'pro', 'corp'];

const TIER_UPGRADE_MESSAGES: Record<string, string> = {
  expense_tracking: 'Expense tracking is available on Bizzy Basic and above.',
  time_clock: 'Time clock features are available on Bizzy Basic and above.',
  recurring_jobs: 'Recurring jobs are available on Bizzy Basic and above.',
  estimates: 'Estimates are available on Bizzy Basic and above.',
  receipt_scanning: 'Receipt scanning is available on Bizzy Basic and above.',
  camera: 'Camera and photo features are available on Bizzy Basic and above.',
  notes_checklists: 'Notes and checklists are available on Bizzy Basic and above.',
  finances: 'Finance tracking is available on Bizzy Basic and above.',
  sms: 'SMS messaging is available on Bizzy Pro and above.',
  messaging: 'Client messaging is available on Bizzy Pro and above.',
  client_portal: 'The client portal is available on Bizzy Pro and above.',
  gps_tracking: 'Live GPS crew tracking is available on Bizzy Pro and above.',
  route_optimization: 'Route optimization is available on Bizzy Pro and above.',
  analytics: 'Advanced analytics are available on Bizzy Pro and above.',
  mileage_tracking: 'Mileage tracking is available on Bizzy Pro and above.',
  work_orders: 'Work orders are available on Bizzy Pro and above.',
  broadcast_messaging: 'Broadcast messaging is available on Bizzy Pro and above.',
  custom_branding: 'Custom branding is available on Bizzy Pro and above.',
  ai_assist: 'AI Assist is available on Bizzy Pro and above.',
  productivity_reports: 'Productivity reports are available on Bizzy Pro and above.',
  automations: 'Automations are available on Bizzy Pro and above.',
  multi_location: 'Multi-location management is available on Bizzy Corp.',
  white_label: 'White-label options are available on Bizzy Corp.',
};

const DEFAULT_FEATURES: PlanFeatures = {
  scheduling: true,
  invoicing: true,
  job_notes_photos: true,
  expense_tracking: false,
  time_clock: false,
  recurring_jobs: false,
  estimates: false,
  receipt_scanning: false,
  sms: false,
  messaging: false,
  client_portal: false,
  gps_tracking: false,
  route_optimization: false,
  analytics: false,
  mileage_tracking: false,
  work_orders: false,
  broadcast_messaging: false,
  custom_branding: false,
  ai_assist: false,
  camera: false,
  notes_checklists: false,
  client_management: true,
  finances: false,
  productivity_reports: false,
  multi_location: false,
  white_label: false,
  automations: false,
};

const FALLBACK_VALUE: SubscriptionContextType = {
  subscription: null,
  loading: true,
  refreshSubscription: async () => {},
  hasFeature: () => true,
  canAddUser: () => true,
  isAtClientLimit: () => false,
  getUpgradeReason: () => 'This feature requires a higher plan.',
  nextTierName: null,
  isTrialing: false,
  trialDaysRemaining: 0,
};

const SubscriptionContext = createContext<SubscriptionContextType>(FALLBACK_VALUE);

export function useSubscription() {
  return useContext(SubscriptionContext);
}

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { currentOrgId } = useOrganization();
  const [subscription, setSubscription] = useState<OrgSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSubscription = useCallback(async () => {
    if (!currentOrgId) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .rpc('get_org_subscription_info', { p_org_id: currentOrgId })
        .maybeSingle();

      if (error || !data) {
        setSubscription(null);
        setLoading(false);
        return;
      }

      const trialEndsAt = data.trial_ends_at ? new Date(data.trial_ends_at) : null;
      const now = new Date();
      const trialDaysRemaining = trialEndsAt
        ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        : 0;

      const slug = (data.plan_slug || data.plan_id || 'lite') as PlanSlug;

      setSubscription({
        plan_id: data.plan_id,
        plan_slug: slug,
        plan_name: data.plan_name,
        status: data.status as OrgSubscription['status'],
        included_users: data.included_users,
        extra_users: data.extra_users ?? 0,
        total_allowed_users: data.total_allowed_users ?? data.included_users,
        max_clients: data.max_clients ?? null,
        monthly_price: Number(data.monthly_price),
        extra_user_price: Number(data.extra_user_price),
        features: { ...DEFAULT_FEATURES, ...(data.features as PlanFeatures) },
        trial_ends_at: data.trial_ends_at,
        current_period_end: data.current_period_end,
        is_trial: data.status === 'trialing',
        trial_days_remaining: trialDaysRemaining,
      });
    } catch {
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  }, [currentOrgId]);

  useEffect(() => {
    loadSubscription();
  }, [loadSubscription]);

  const hasFeature = useCallback(
    (key: keyof PlanFeatures): boolean => {
      if (!subscription) return true;
      if (subscription.status === 'trialing') return true;
      return subscription.features[key] === true;
    },
    [subscription]
  );

  const canAddUser = useCallback(
    (currentUserCount: number): boolean => {
      if (!subscription) return true;
      if (subscription.status === 'trialing') return true;
      if (subscription.total_allowed_users >= 9999) return true;
      return currentUserCount < subscription.total_allowed_users;
    },
    [subscription]
  );

  const isAtClientLimit = useCallback(
    (currentClientCount: number): boolean => {
      if (!subscription) return false;
      if (subscription.status === 'trialing') return false;
      if (subscription.max_clients === null) return false;
      return currentClientCount >= subscription.max_clients;
    },
    [subscription]
  );

  const getUpgradeReason = useCallback(
    (key: keyof PlanFeatures): string => {
      return TIER_UPGRADE_MESSAGES[key] || 'This feature requires a higher plan.';
    },
    []
  );

  const nextTierName = useMemo(() => {
    if (!subscription) return null;
    const idx = TIER_ORDER.indexOf(subscription.plan_slug);
    if (idx === -1 || idx >= TIER_ORDER.length - 1) return null;
    const nextSlug = TIER_ORDER[idx + 1];
    const names: Record<PlanSlug, string> = {
      lite: 'Bizzy Lite',
      basic: 'Bizzy Basic',
      pro: 'Bizzy Pro',
      corp: 'Bizzy Corp',
    };
    return names[nextSlug];
  }, [subscription]);

  const isTrialing = useMemo(() => subscription?.is_trial === true, [subscription]);
  const trialDaysRemaining = useMemo(() => subscription?.trial_days_remaining ?? 0, [subscription]);

  const value = useMemo(
    () => ({
      subscription,
      loading,
      refreshSubscription: loadSubscription,
      hasFeature,
      canAddUser,
      isAtClientLimit,
      getUpgradeReason,
      nextTierName,
      isTrialing,
      trialDaysRemaining,
    }),
    [
      subscription,
      loading,
      loadSubscription,
      hasFeature,
      canAddUser,
      isAtClientLimit,
      getUpgradeReason,
      nextTierName,
      isTrialing,
      trialDaysRemaining,
    ]
  );

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}
