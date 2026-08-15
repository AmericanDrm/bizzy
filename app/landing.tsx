import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  Pressable,
  Platform,
  useWindowDimensions,
  Animated,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronDown, Check, Zap, Star, ChevronLeft, ChevronRight, Route, Shield, Clock, Smartphone } from 'lucide-react-native';
import { useState, useRef, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { TAB_IMAGES_LIGHT, TAB_IMAGES_DARK } from '@/app/(tabs)/_layout';
import { DashboardScreen, ScheduleScreen, ClientsScreen, InvoicesScreen, FinancesScreen, TimeClockScreen } from '@/components/MockScreens';

const CAROUSEL_IMAGES = [
  { key: 'home', label: 'Dashboard' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'invoices', label: 'Invoices' },
  { key: 'clients', label: 'Clients' },
  { key: 'finances', label: 'Finances' },
  { key: 'time', label: 'Time Clock' },
];

const FEATURES = [
  { imageKey: 'schedule', title: 'Smart Scheduling', desc: 'Drag-and-drop calendar, recurring jobs, crew assignments, and automatic reminders keep your schedule running smoothly.' },
  { imageKey: 'invoices', title: 'Invoicing & Estimates', desc: 'Create professional invoices and estimates in seconds. Accept payments, track overdue accounts, and get paid faster.' },
  { imageKey: 'time', title: 'Time Tracking', desc: 'Simple clock in/out, GPS verification, break tracking, and detailed timesheets for accurate payroll.' },
  { imageKey: 'clients', title: 'Client Messaging', desc: 'Send appointment reminders, job updates, and follow-ups via SMS or email with customizable templates.' },
  { imageKey: 'finances', title: 'Financial Tracking', desc: 'Track income, expenses, and profit in real-time. Scan receipts, categorize transactions, and export for tax season.' },
  { imageKey: 'home', title: 'Team Management', desc: 'Add crew members, assign roles, track locations, and manage permissions all from one dashboard.' },
  { imageKey: 'routes', title: 'Route Optimization', desc: 'Automatically plan the most efficient routes for your crew. Save fuel, reduce drive time, and complete more jobs every day.' },
];

const WHY_BIZZY = [
  { imageKey: 'home', title: 'Mobile-First', desc: 'Designed for the field, and the office. Manage everything from your phone while on the job.' },
  { imageKey: 'schedule', title: 'Lightning Fast', desc: 'No loading screens, no lag. Bizzy is built for speed so you can work without waiting.' },
  { imageKey: 'notes', title: 'Dead Simple', desc: 'Intuitive interface that anyone can use. No training required - just download and go.' },
  { imageKey: 'finances', title: 'Affordable', desc: 'Enterprise features at small business prices. No hidden fees, no long-term contracts.' },
];

const TESTIMONIALS = [
  {
    name: 'Marcus T.',
    role: 'Window Cleaning Co.',
    rating: 5,
    text: 'I cut my admin work from 3+ hours a day to under 30 minutes. Bizzy handles scheduling, invoicing, and my whole crew — it\'s the only app I need.',
  },
  {
    name: 'Sarah K.',
    role: 'Landscaping Services',
    rating: 5,
    text: 'Clients approve estimates from their phones in minutes. No more back-and-forth calls just to confirm a job. I get paid faster and do less chasing.',
  },
  {
    name: 'James R.',
    role: 'Pressure Washing Pro',
    rating: 5,
    text: 'I replaced 4 different apps with Bizzy. Scheduling, invoicing, time tracking, and finances — one login, one app. My admin time dropped by over 70%.',
  },
  {
    name: 'Linda M.',
    role: 'Cleaning Business Owner',
    rating: 5,
    text: 'My clients love the portal. They see upcoming appointments, approve estimates, and even request jobs — all without calling me. It practically runs itself.',
  },
  {
    name: 'Derek P.',
    role: 'HVAC Contractor',
    rating: 5,
    text: 'Tax season used to take me two weeks of digging through receipts. Now I snap photos on-site, everything is categorized, and my accountant gets a clean export.',
  },
  {
    name: 'Angela W.',
    role: 'Pool Service Company',
    rating: 5,
    text: 'Route optimization alone saved my crew 45 minutes every single day. Over a month, that\'s real hours back — and we fit in 2-3 more jobs per route.',
  },
];

const STRIPE_BILLING_URL = 'https://billing.stripe.com/p/login/cNieVc350fxd170cixg7e00';

const PRICING = [
  {
    tier: 'Lite',
    slug: 'lite',
    price: 12,
    best: 'Best for solo operators just getting started',
    userLabel: '1 user included',
    clientLabel: 'Up to 50 clients',
    features: [
      '1 user included',
      'Up to 50 clients',
      'Scheduling & calendar',
      'Invoicing',
      'Job notes & photos',
      'Client management',
      'Email support',
    ],
    comingSoon: [],
    upgradeUrl: STRIPE_BILLING_URL,
    softGate: 'Need time clock, estimates, or finances? Bizzy Basic starts at $35/mo.',
  },
  {
    tier: 'Basic',
    slug: 'basic',
    price: 35,
    best: 'Best for small teams ready to look professional',
    userLabel: 'Up to 3 users',
    clientLabel: 'Up to 125 clients',
    features: [
      'Everything in Lite',
      'Up to 3 users (+$22/mo each after)',
      'Up to 125 clients',
      'Time clock',
      'Recurring jobs & events',
      'Estimates w/ online approvals',
      'Receipt scanning & OCR',
      'Message templates',
      'Camera + notes + checklists',
      'Finances & expense tracking',
      'Priority email support',
    ],
    comingSoon: [],
    upgradeUrl: STRIPE_BILLING_URL,
    softGate: 'Need GPS tracking, routes, messaging, or AI tools? Bizzy Pro starts at $95/mo.',
  },
  {
    tier: 'Pro',
    slug: 'pro',
    price: 95,
    best: 'Best for growing companies that need real operational tools',
    popular: true,
    userLabel: 'Up to 5 users',
    clientLabel: 'Unlimited clients',
    features: [
      'Everything in Basic',
      'Up to 5 users (+$22/mo each after)',
      'Unlimited clients',
      'Live crew GPS tracking',
      'Route optimization',
      'Advanced analytics & reporting',
      'Mileage & vehicle tracking',
      'Job checklists & work orders',
      'Broadcast messaging to all clients',
      'SMS + email client messaging',
      'Custom invoice & email branding',
      'AI-powered job assist',
      'Productivity reports',
      'High-Availability Guarantee (99.9% uptime)',
      'Priority support',
    ],
    comingSoon: ['Client portal', 'Automations'],
    upgradeUrl: STRIPE_BILLING_URL,
    softGate: 'Need unlimited team members or multi-location? Bizzy Corp has it all.',
  },
  {
    tier: 'Corp',
    slug: 'corp',
    price: 180,
    best: 'Best for large operations, franchises, and owners who want everything',
    userLabel: 'Unlimited users',
    clientLabel: 'Unlimited clients',
    features: [
      'Everything in Pro',
      'Unlimited users included',
      'Unlimited clients',
      'Multi-location management',
      'White-label client portal',
      'Custom user roles & permissions',
      'Advanced data export',
      'Dedicated account manager',
      'Priority 24/7 support',
    ],
    comingSoon: [],
    upgradeUrl: STRIPE_BILLING_URL,
  },
];

const FAQS = [
  { q: 'Is Bizzy free to use?', a: 'Bizzy offers a 14-day free trial on all plans — no credit card required. You get access to all features during your trial. After that, plans start at just $12/month for solo operators.' },
  { q: 'Can I cancel anytime?', a: 'Yes, absolutely. There are no long-term contracts or cancellation fees. Cancel anytime from your account settings and you\'ll retain access through the end of your billing period.' },
  { q: 'What happens after my trial ends?', a: 'We\'ll send you a reminder before your trial expires. You can choose any plan to continue — or cancel with no charge. We never auto-charge without your consent.' },
  { q: 'Does Bizzy work offline?', a: "Yes! Bizzy caches your data locally so you can access client info, schedules, and job details even without cell service. Changes sync automatically when you're back online." },
  { q: 'Can I use Bizzy with my team?', a: 'Absolutely. Bizzy supports multiple team members with role-based permissions. Assign jobs, track crew GPS locations, manage timesheets, and keep everyone on the same page from one dashboard.' },
  { q: 'How does invoicing and payment work?', a: 'Create and send professional invoices in seconds. Clients can approve estimates and view invoices online through their portal. You can include a payment link directly in the invoice for instant online payments.' },
  { q: 'Is my data secure?', a: 'Security is our top priority. Bizzy uses bank-level AES-256 encryption, SOC2-compliant cloud infrastructure, and row-level security policies to ensure your business data is always private and protected.' },
  { q: 'Do you offer support?', a: 'Yes. All plans include email support. Basic and above includes priority email support. Pro and Corp plans include priority access with faster response times. We typically respond within a few hours.' },
];

function TrustBar({ isDark }: { isDark: boolean }) {
  const items = [
    { icon: Shield, text: 'Bank-level security' },
    { icon: Clock, text: '14-day free trial' },
    { icon: Smartphone, text: 'iOS & Android' },
    { icon: Star, text: '4.9 avg rating' },
  ];
  return (
    <View style={[trustStyles.bar, { borderTopColor: isDark ? '#2a2a4a' : '#e2e8f0', borderBottomColor: isDark ? '#2a2a4a' : '#e2e8f0' }]}>
      {items.map((item, i) => {
        const Icon = item.icon;
        return (
          <View key={i} style={trustStyles.item}>
            <Icon size={14} color={isDark ? '#64748b' : '#94a3b8'} />
            <Text style={[trustStyles.text, { color: isDark ? '#64748b' : '#64748b' }]}>{item.text}</Text>
          </View>
        );
      })}
    </View>
  );
}

const trustStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 24,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  text: {
    fontSize: 13,
    fontWeight: '500',
  },
});

function StarRow({ count }: { count: number }) {
  return (
    <View style={styles.starRow}>
      {Array.from({ length: count }).map((_, i) => (
        <Star key={i} size={14} color="#f59e0b" fill="#f59e0b" />
      ))}
    </View>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [expanded, setExpanded] = useState(false);
  const { colors, isDark } = useTheme();

  return (
    <Pressable
      style={[styles.faqItem, { backgroundColor: isDark ? '#1a1a2e' : '#f8fafc', borderColor: isDark ? '#2a2a4a' : '#e2e8f0' }]}
      onPress={() => setExpanded(!expanded)}
    >
      <View style={styles.faqHeader}>
        <Text style={[styles.faqQuestion, { color: colors.text }]}>{question}</Text>
        <ChevronDown size={20} color={colors.textSecondary} style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }} />
      </View>
      {expanded && <Text style={[styles.faqAnswer, { color: colors.textSecondary }]}>{answer}</Text>}
    </Pressable>
  );
}

function HeroCarousel({ isDark }: { isDark: boolean }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const goTo = (index: number) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setActiveIndex(index);
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    });
  };

  useEffect(() => {
    const interval = setInterval(() => {
      goTo((activeIndex + 1) % CAROUSEL_IMAGES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [activeIndex]);

  const prev = () => goTo((activeIndex - 1 + CAROUSEL_IMAGES.length) % CAROUSEL_IMAGES.length);
  const next = () => goTo((activeIndex + 1) % CAROUSEL_IMAGES.length);

  const current = CAROUSEL_IMAGES[activeIndex];

  const MOCK_SCREENS: Record<string, React.ReactNode> = {
    home: <DashboardScreen />,
    schedule: <ScheduleScreen />,
    clients: <ClientsScreen />,
    invoices: <InvoicesScreen />,
    finances: <FinancesScreen />,
    time: <TimeClockScreen />,
  };

  return (
    <View style={styles.carousel}>
      <View style={[styles.phoneFrame, { backgroundColor: isDark ? '#0d0d1a' : '#1a1a2e' }]}>
        <Animated.View style={[styles.phoneScreenWrapper, { opacity: fadeAnim }]}>
          {MOCK_SCREENS[current.key]}
        </Animated.View>
      </View>
      <View style={styles.carouselControls}>
        <Pressable onPress={prev} style={[styles.carouselBtn, { backgroundColor: isDark ? '#1a1a2e' : '#f1f5f9', borderColor: isDark ? '#2a2a4a' : '#e2e8f0' }]}>
          <ChevronLeft size={18} color={isDark ? '#94a3b8' : '#64748b'} />
        </Pressable>
        <View style={styles.carouselDots}>
          {CAROUSEL_IMAGES.map((_, i) => (
            <Pressable key={i} onPress={() => goTo(i)}>
              <View style={[styles.dot, i === activeIndex && styles.dotActive, { backgroundColor: i === activeIndex ? '#0ea5e9' : (isDark ? '#3a3a5a' : '#cbd5e1') }]} />
            </Pressable>
          ))}
        </View>
        <Pressable onPress={next} style={[styles.carouselBtn, { backgroundColor: isDark ? '#1a1a2e' : '#f1f5f9', borderColor: isDark ? '#2a2a4a' : '#e2e8f0' }]}>
          <ChevronRight size={18} color={isDark ? '#94a3b8' : '#64748b'} />
        </Pressable>
      </View>
      <Text style={[styles.carouselLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>{current.label}</Text>
      <Text style={[styles.carouselDisclaimer, { color: isDark ? '#475569' : '#94a3b8' }]}>*Images are simulated, actual app function may be different.</Text>
    </View>
  );
}

function TestimonialCard({ testimonial, isDark, colors }: { testimonial: typeof TESTIMONIALS[0]; isDark: boolean; colors: any }) {
  return (
    <View style={[styles.testimonialCard, { backgroundColor: isDark ? '#1a1a2e' : '#fff', borderColor: isDark ? '#2a2a4a' : '#e2e8f0' }]}>
      <StarRow count={testimonial.rating} />
      <Text style={[styles.testimonialText, { color: colors.text }]}>"{testimonial.text}"</Text>
      <View style={styles.testimonialAuthor}>
        <View style={[styles.testimonialAvatar, { backgroundColor: '#0ea5e9' }]}>
          <Text style={styles.testimonialAvatarText}>{testimonial.name[0]}</Text>
        </View>
        <View>
          <Text style={[styles.testimonialName, { color: colors.text }]}>{testimonial.name}</Text>
          <Text style={[styles.testimonialRole, { color: colors.textSecondary }]}>{testimonial.role}</Text>
        </View>
      </View>
    </View>
  );
}

function FeatureCard({ feature, isDark, colors }: { feature: typeof FEATURES[0]; isDark: boolean; colors: any }) {
  const tabImages = isDark ? TAB_IMAGES_DARK : TAB_IMAGES_LIGHT;
  return (
    <View style={[styles.featureCard, { backgroundColor: isDark ? '#1a1a2e' : '#fff', borderColor: isDark ? '#2a2a4a' : '#e2e8f0' }]}>
      <View style={[styles.featureIcon, { backgroundColor: isDark ? 'rgba(14, 165, 233, 0.15)' : 'rgba(14, 165, 233, 0.08)' }]}>
        {feature.imageKey === 'routes' ? (
          <Route size={28} color="#0ea5e9" />
        ) : (
          <Image
            source={tabImages[feature.imageKey]}
            style={styles.featureIconImage}
            resizeMode="contain"
          />
        )}
      </View>
      <Text style={[styles.featureTitle, { color: colors.text }]}>{feature.title}</Text>
      <Text style={[styles.featureDesc, { color: colors.textSecondary }]}>{feature.desc}</Text>
    </View>
  );
}

function PricingCard({ plan, isDark, colors, isSelected, onSelect }: {
  plan: typeof PRICING[0];
  isDark: boolean;
  colors: any;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: isSelected ? 1.04 : 1,
      useNativeDriver: true,
      tension: 80,
      friction: 8,
    }).start();
  }, [isSelected]);

  const isPopular = !!plan.popular;

  return (
    <Pressable onPress={onSelect} style={styles.pricingCardWrapper}>
      <Animated.View
        style={[
          styles.pricingCard,
          isSelected && styles.pricingCardSelected,
          isPopular && !isSelected && styles.pricingCardPopular,
          {
            backgroundColor: isSelected
              ? (isDark ? '#0f2744' : '#f0f9ff')
              : (isDark ? '#1a1a2e' : '#fff'),
            borderColor: isSelected
              ? '#0ea5e9'
              : isPopular
              ? '#38bdf8'
              : (isDark ? '#2a2a4a' : '#e2e8f0'),
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {isPopular && (
          <View style={styles.popularBadge}>
            <Text style={styles.popularBadgeText}>Most Popular</Text>
          </View>
        )}

        <Text style={[styles.pricingTier, { color: isSelected ? '#0ea5e9' : colors.text }]}>{plan.tier}</Text>

        <View style={styles.pricingPriceRow}>
          <Text style={[styles.pricingCurrency, { color: isSelected ? '#0ea5e9' : colors.textSecondary }]}>$</Text>
          <Text style={[styles.pricingAmount, { color: isSelected ? '#0ea5e9' : colors.text }]}>{plan.price}</Text>
          <Text style={[styles.pricingPeriod, { color: colors.textSecondary }]}>/month</Text>
        </View>

        <Text style={[styles.pricingBest, { color: colors.textSecondary }]}>{plan.best}</Text>

        <View style={[styles.pricingDivider, { backgroundColor: isSelected ? 'rgba(14, 165, 233, 0.25)' : (isDark ? '#2a2a4a' : '#e2e8f0') }]} />

        <View style={styles.pricingFeatures}>
          {plan.features.map((f, j) => (
            <View key={j} style={styles.pricingFeature}>
              <View style={[styles.pricingCheckCircle, { backgroundColor: isSelected ? 'rgba(14, 165, 233, 0.15)' : (isDark ? 'rgba(34, 197, 94, 0.1)' : 'rgba(34, 197, 94, 0.08)') }]}>
                <Check size={12} color={isSelected ? '#0ea5e9' : '#22c55e'} strokeWidth={3} />
              </View>
              <Text style={[styles.pricingFeatureText, { color: colors.text }]}>{f}</Text>
            </View>
          ))}
          {plan.comingSoon.map((f, j) => (
            <View key={`cs-${j}`} style={styles.pricingFeature}>
              <View style={[styles.pricingCheckCircle, { backgroundColor: isDark ? 'rgba(148, 163, 184, 0.1)' : 'rgba(148, 163, 184, 0.08)' }]}>
                <Check size={12} color={isDark ? '#64748b' : '#94a3b8'} strokeWidth={3} />
              </View>
              <Text style={[styles.pricingFeatureText, { color: colors.textSecondary }]}>{f}</Text>
              <View style={[styles.comingSoonBadge, { backgroundColor: isDark ? 'rgba(14, 165, 233, 0.12)' : 'rgba(14, 165, 233, 0.08)', borderColor: 'rgba(14, 165, 233, 0.3)' }]}>
                <Text style={styles.comingSoonText}>Soon</Text>
              </View>
            </View>
          ))}
        </View>

        <Pressable onPress={() => Linking.openURL(plan.upgradeUrl || STRIPE_BILLING_URL)} style={styles.pricingCtaWrapper}>
          {isSelected || isPopular ? (
            <LinearGradient colors={['#0ea5e9', '#0284c7']} style={styles.pricingCtaPrimaryGradient}>
              <Text style={styles.pricingCtaPrimaryText}>Start Free Trial</Text>
            </LinearGradient>
          ) : (
            <View style={[styles.pricingCtaSecondary, { borderColor: isDark ? '#3a3a5a' : '#cbd5e1' }]}>
              <Text style={[styles.pricingCtaSecondaryText, { color: colors.text }]}>Start Free Trial</Text>
            </View>
          )}
        </Pressable>
      </Animated.View>
    </Pressable>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const isWide = width > 768;
  const [selectedPlan, setSelectedPlan] = useState<number>(2);

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} showsVerticalScrollIndicator={false}>
      <View style={[styles.header, { borderBottomColor: isDark ? '#2a2a4a' : '#e2e8f0' }]}>
        <View style={styles.headerContent}>
          <Image source={require('@/assets/images/logoandname.png')} style={styles.headerLogoImage} resizeMode="contain" />
          <View style={styles.headerButtons}>
            <Pressable onPress={() => router.push('/login')} style={styles.loginBtn}>
              <Text style={[styles.loginBtnText, { color: colors.text }]}>Log In</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/signup')} style={styles.signupBtn}>
              <LinearGradient colors={['#0ea5e9', '#0284c7']} style={styles.signupBtnGradient}>
                <Text style={styles.signupBtnText}>Sign Up</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.hero}>
        <View style={[styles.heroContent, isWide && styles.heroContentWide]}>
          <View style={[styles.heroText, isWide && styles.heroTextWide]}>
            <View style={[styles.badge, { backgroundColor: isDark ? 'rgba(14, 165, 233, 0.15)' : 'rgba(14, 165, 233, 0.1)' }]}>
              <Zap size={14} color="#0ea5e9" />
              <Text style={styles.badgeText}>14-Day Free Trial · No Credit Card Required</Text>
            </View>
            <Text style={[styles.heroTitle, { color: colors.text }]}>
              Stop Juggling Apps.{'\n'}
              <Text style={styles.heroTitleHighlight}>Run Your Business From Your Phone.</Text>
            </Text>
            <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
              Bizzy replaces your scheduling, invoicing, time tracking, crew management, and finances — all in one app built for field service pros.
            </Text>
            <View style={styles.heroCta}>
              <Pressable onPress={() => router.push('/(auth)/signup-business')} style={styles.ctaPrimary}>
                <LinearGradient colors={['#0ea5e9', '#0284c7']} style={styles.ctaPrimaryGradient}>
                  <Text style={styles.ctaPrimaryText}>Get Started Free</Text>
                </LinearGradient>
              </Pressable>
              <Pressable onPress={() => router.push('/login')} style={[styles.ctaSecondary, { borderColor: isDark ? '#3a3a5a' : '#cbd5e1' }]}>
                <Text style={[styles.ctaSecondaryText, { color: colors.text }]}>Sign In</Text>
              </Pressable>
            </View>
          </View>
          <HeroCarousel isDark={isDark} />
        </View>
      </View>

      <TrustBar isDark={isDark} />

      <View style={[styles.section, { backgroundColor: isDark ? '#0f0f1a' : '#f8fafc' }]}>
        <Text style={[styles.sectionLabel, { color: '#0ea5e9' }]}>Features</Text>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Everything You Need to Run Your Business</Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>From scheduling to payments, Bizzy handles it all.</Text>
        <View style={[styles.featuresGrid, isWide && styles.featuresGridWide]}>
          {FEATURES.map((feature, i) => (
            <FeatureCard key={i} feature={feature} isDark={isDark} colors={colors} />
          ))}
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: colors.background }]}>
        <Text style={[styles.sectionLabel, { color: '#0ea5e9' }]}>Why Bizzy?</Text>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Built for Real Field-Service Workflows</Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>No bloated features. No steep learning curve. Just the tools you need.</Text>
        <View style={[styles.whyGrid, isWide && styles.whyGridWide]}>
          {WHY_BIZZY.map((item, i) => (
            <View key={i} style={[styles.whyCard, { backgroundColor: isDark ? '#1a1a2e' : '#f8fafc', borderColor: isDark ? '#2a2a4a' : '#e2e8f0' }]}>
              <View style={[styles.whyIcon, { backgroundColor: isDark ? 'rgba(14, 165, 233, 0.15)' : 'rgba(14, 165, 233, 0.08)' }]}>
                <Image
                  source={isDark ? TAB_IMAGES_DARK[item.imageKey] : TAB_IMAGES_LIGHT[item.imageKey]}
                  style={styles.whyIconImage}
                  resizeMode="contain"
                />
              </View>
              <Text style={[styles.whyTitle, { color: colors.text }]}>{item.title}</Text>
              <Text style={[styles.whyDesc, { color: colors.textSecondary }]}>{item.desc}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: isDark ? '#0f0f1a' : '#f0f9ff' }]}>
        <Text style={[styles.sectionLabel, { color: '#0ea5e9' }]}>Testimonials</Text>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Trusted by Field Service Pros</Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>See what business owners are saying about Bizzy.</Text>
        <View style={[styles.testimonialsGrid, isWide && styles.testimonialsGridWide]}>
          {TESTIMONIALS.map((t, i) => (
            <TestimonialCard key={i} testimonial={t} isDark={isDark} colors={colors} />
          ))}
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: isDark ? '#0f0f1a' : '#f8fafc' }]}>
        <Text style={[styles.sectionLabel, { color: '#0ea5e9' }]}>Pricing</Text>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Simple, Transparent Pricing</Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>All plans include a 14-day free trial. Tap a plan to explore what's included.</Text>
        <View style={[styles.pricingContainer, isWide && styles.pricingContainerWide]}>
          {PRICING.map((plan, i) => (
            <PricingCard
              key={i}
              plan={plan}
              isDark={isDark}
              colors={colors}
              isSelected={selectedPlan === i}
              onSelect={() => setSelectedPlan(i)}
            />
          ))}
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: colors.background }]}>
        <Text style={[styles.sectionLabel, { color: '#0ea5e9' }]}>FAQ</Text>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Frequently Asked Questions</Text>
        <View style={styles.faqList}>
          {FAQS.map((faq, i) => (
            <FAQItem key={i} question={faq.q} answer={faq.a} />
          ))}
        </View>
      </View>

      <LinearGradient colors={isDark ? ['#0f0f1a', '#1a1a2e'] : ['#0ea5e9', '#0284c7']} style={styles.ctaSection}>
        <Text style={styles.ctaSectionTitle}>Get Bizzy and Simplify Your Business Today</Text>
        <Text style={styles.ctaSectionSubtitle}>Join professionals who run their businesses smarter with Bizzy.</Text>
        <View style={styles.ctaSectionButtons}>
          <Pressable onPress={() => router.push('/(auth)/signup-business')} style={styles.ctaSectionPrimary}>
            <Text style={styles.ctaSectionPrimaryText}>Get Started Free</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/login')} style={styles.ctaSectionSecondary}>
            <Text style={styles.ctaSectionSecondaryText}>Sign In</Text>
          </Pressable>
        </View>
      </LinearGradient>

      <View style={[styles.footer, { backgroundColor: isDark ? '#0a0a14' : '#111827', borderTopColor: isDark ? '#1a1a2e' : '#1f2937' }]}>
        <View style={styles.footerContent}>
          <View style={styles.footerBrand}>
            <Image source={require('@/assets/images/logoandname.png')} style={styles.footerLogoImage} resizeMode="contain" />
            <Text style={styles.footerDesc}>The all-in-one field service app that helps you schedule, invoice, track time, and manage your business.</Text>
          </View>
          <View style={styles.footerLinks}>
            <Pressable onPress={() => router.push('/terms')}><Text style={styles.footerLink}>Terms of Service</Text></Pressable>
            <Pressable onPress={() => router.push('/privacy')}><Text style={styles.footerLink}>Privacy Policy</Text></Pressable>
          </View>
        </View>
        <Text style={styles.footerCopyright}>2026 Bizzy. All rights reserved.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', maxWidth: 1200, marginHorizontal: 'auto', width: '100%' },
  headerLogoImage: { width: 120, height: 40 },
  headerButtons: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  loginBtn: { paddingHorizontal: 16, paddingVertical: 10 },
  loginBtnText: { fontSize: 15, fontWeight: '600' },
  signupBtn: { borderRadius: 8, overflow: 'hidden' },
  signupBtnGradient: { paddingHorizontal: 20, paddingVertical: 10 },
  signupBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  hero: { paddingHorizontal: 20, paddingVertical: 60 },
  heroContent: { maxWidth: 1200, marginHorizontal: 'auto', width: '100%', alignItems: 'center' },
  heroContentWide: { flexDirection: 'row', alignItems: 'center', gap: 60 },
  heroText: { flex: 1, alignItems: 'center' },
  heroTextWide: { flex: 1, alignItems: 'flex-start' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginBottom: 24 },
  badgeText: { color: '#0ea5e9', fontSize: 13, fontWeight: '600' },
  heroTitle: { fontSize: 36, fontWeight: '800', lineHeight: 44, marginBottom: 20, textAlign: 'center' },
  heroTitleHighlight: { color: '#0ea5e9' },
  heroSubtitle: { fontSize: 17, lineHeight: 28, marginBottom: 32, textAlign: 'center', maxWidth: 480 },
  heroCta: { flexDirection: 'row', gap: 16, marginBottom: 8, flexWrap: 'wrap', justifyContent: 'center' },
  ctaPrimary: { borderRadius: 10, overflow: 'hidden' },
  ctaPrimaryGradient: { paddingHorizontal: 28, paddingVertical: 16 },
  ctaPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  ctaSecondary: { paddingHorizontal: 28, paddingVertical: 16, borderRadius: 10, borderWidth: 1 },
  ctaSecondaryText: { fontSize: 16, fontWeight: '600' },
  carousel: { alignItems: 'center', paddingTop: 20 },
  phoneFrame: { width: 220, height: 440, borderRadius: 32, padding: 10, borderWidth: 3, borderColor: '#1e2a3a', ...Platform.select({ web: { boxShadow: '0 24px 48px -8px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.06)' }, default: { elevation: 20 } }) },
  phoneScreenWrapper: { flex: 1, borderRadius: 22, overflow: 'hidden' },
  phoneScreen: { width: '100%', height: '100%' },
  carouselControls: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 20 },
  carouselBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  carouselDots: { flexDirection: 'row', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { width: 20, borderRadius: 4 },
  carouselLabel: { fontSize: 13, fontWeight: '500', marginTop: 10 },
  carouselDisclaimer: { fontSize: 10, marginTop: 6, textAlign: 'center', fontStyle: 'italic' },
  section: { paddingHorizontal: 20, paddingVertical: 60 },
  sectionLabel: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, textAlign: 'center' },
  sectionTitle: { fontSize: 28, fontWeight: '700', textAlign: 'center', marginBottom: 12 },
  sectionSubtitle: { fontSize: 16, textAlign: 'center', marginBottom: 40, maxWidth: 600, alignSelf: 'center' },
  featuresGrid: { gap: 16, maxWidth: 1200, marginHorizontal: 'auto', width: '100%', alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  featuresGridWide: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'stretch' },
  featureCard: { padding: 24, borderRadius: 16, borderWidth: 1, width: Platform.OS === 'web' ? 340 : '100%', alignItems: 'center' },
  featureIcon: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  featureIconImage: { width: 36, height: 36 },
  featureTitle: { fontSize: 17, fontWeight: '600', marginBottom: 8, textAlign: 'center' },
  featureDesc: { fontSize: 14, lineHeight: 22, textAlign: 'center' },
  whyGrid: { gap: 16, maxWidth: 1200, width: '100%', justifyContent: 'center', alignItems: 'center', alignSelf: 'center' },
  whyGridWide: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'stretch' },
  whyCard: { padding: 24, borderRadius: 16, borderWidth: 1, width: Platform.OS === 'web' ? 260 : '100%', alignItems: 'center' },
  whyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  whyIconImage: { width: 34, height: 34 },
  whyTitle: { fontSize: 17, fontWeight: '600', marginBottom: 8, textAlign: 'center' },
  whyDesc: { fontSize: 14, lineHeight: 22, textAlign: 'center' },
  testimonialsGrid: { gap: 16, maxWidth: 1200, marginHorizontal: 'auto', width: '100%', alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  testimonialsGridWide: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'stretch' },
  testimonialCard: { padding: 24, borderRadius: 16, borderWidth: 1, width: Platform.OS === 'web' ? 340 : '100%' },
  starRow: { flexDirection: 'row', gap: 3, marginBottom: 14 },
  testimonialText: { fontSize: 15, lineHeight: 24, marginBottom: 20, fontStyle: 'italic' },
  testimonialAuthor: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  testimonialAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  testimonialAvatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  testimonialName: { fontSize: 14, fontWeight: '600' },
  testimonialRole: { fontSize: 13, marginTop: 2 },
  pricingContainer: {
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 16,
  },
  pricingContainerWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  pricingCardWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pricingCard: {
    width: Platform.OS === 'web' ? 270 : 320,
    padding: 24,
    borderRadius: 20,
    borderWidth: 2,
    ...Platform.select({
      web: { boxShadow: '0 4px 16px rgba(0,0,0,0.08)', transition: 'all 0.2s ease' },
      default: { elevation: 4 },
    }),
  },
  pricingCardPopular: {
    borderColor: '#38bdf8',
  },
  pricingCardSelected: {
    borderColor: '#0ea5e9',
    ...Platform.select({
      web: { boxShadow: '0 12px 40px rgba(14, 165, 233, 0.25)' },
      default: { elevation: 12 },
    }),
  },
  popularBadge: {
    alignSelf: 'center',
    backgroundColor: '#0ea5e9',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 12,
    marginBottom: 14,
  },
  popularBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  pricingTier: { fontSize: 22, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  pricingPriceRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 8, justifyContent: 'center' },
  pricingCurrency: { fontSize: 20, fontWeight: '600' },
  pricingAmount: { fontSize: 52, fontWeight: '800', lineHeight: 60 },
  pricingPeriod: { fontSize: 16 },
  pricingBest: { fontSize: 13, marginBottom: 16, textAlign: 'center', lineHeight: 18 },
  pricingDivider: { height: 1, marginBottom: 16 },
  pricingFeatures: { gap: 10, marginBottom: 24 },
  pricingFeature: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pricingCheckCircle: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  pricingFeatureText: { fontSize: 13, flex: 1, lineHeight: 18 },
  comingSoonBadge: {
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  comingSoonText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#0ea5e9',
    letterSpacing: 0.3,
  },
  pricingCtaWrapper: { borderRadius: 10, overflow: 'hidden' },
  pricingCtaPrimaryGradient: { paddingVertical: 14, alignItems: 'center', borderRadius: 10 },
  pricingCtaPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  pricingCtaSecondary: { paddingVertical: 14, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  pricingCtaSecondaryText: { fontSize: 15, fontWeight: '600' },
  faqList: { gap: 12, maxWidth: 800, marginHorizontal: 'auto', width: '100%' },
  faqItem: { borderRadius: 12, borderWidth: 1, padding: 20 },
  faqHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  faqQuestion: { fontSize: 16, fontWeight: '600', flex: 1, paddingRight: 12 },
  faqAnswer: { fontSize: 14, lineHeight: 22, marginTop: 12 },
  ctaSection: { paddingHorizontal: 20, paddingVertical: 60, alignItems: 'center' },
  ctaSectionTitle: { color: '#fff', fontSize: 28, fontWeight: '700', textAlign: 'center', marginBottom: 12 },
  ctaSectionSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 16, textAlign: 'center', marginBottom: 32, maxWidth: 500 },
  ctaSectionButtons: { flexDirection: 'row', gap: 16 },
  ctaSectionPrimary: { backgroundColor: '#fff', paddingHorizontal: 28, paddingVertical: 16, borderRadius: 10 },
  ctaSectionPrimaryText: { color: '#0284c7', fontSize: 16, fontWeight: '600' },
  ctaSectionSecondary: { borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)', paddingHorizontal: 28, paddingVertical: 16, borderRadius: 10 },
  ctaSectionSecondaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  footer: { paddingHorizontal: 20, paddingVertical: 40, borderTopWidth: 1, alignItems: 'center' },
  footerContent: { maxWidth: 1200, width: '100%', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', gap: 24, marginBottom: 24 },
  footerBrand: { maxWidth: 320, alignItems: 'center' },
  footerLogoImage: { width: 160, height: 56, tintColor: '#fff', marginBottom: 12 },
  footerDesc: { color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 22, textAlign: 'center' },
  footerLinks: { flexDirection: 'row', gap: 24, alignItems: 'center', justifyContent: 'center' },
  footerLink: { color: 'rgba(255,255,255,0.6)', fontSize: 14, textAlign: 'center' },
  footerCopyright: { color: 'rgba(255,255,255,0.4)', fontSize: 13, textAlign: 'center' },
});
