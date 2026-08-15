import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Building2,
  Mail,
  Lock,
  ArrowRight,
  ChevronLeft,
  CircleUser as UserCircle,
  CircleAlert as AlertCircle,
  CircleCheck as CheckCircle,
  Eye,
  EyeOff,
  UserPlus,
  KeyRound,
  Search,
  User,
  MapPin,
} from 'lucide-react-native';
import { Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { portalGet, portalPost, portalSupabase } from '@/lib/portalSupabase';
import { usePortalAuth } from '@/contexts/PortalAuthContext';

interface PortalSettings {
  is_enabled: boolean;
  portal_title: string;
  welcome_message: string;
  allow_guest_booking: boolean;
  primary_color: string;
  logo_url?: string;
}

interface OrgInfo {
  id: string;
  name: string;
  slug: string;
}

interface NameMatch {
  id: string;
  name: string;
  masked_email: string;
  masked_address: string;
  has_email: boolean;
}

type Step =
  | 'loading'
  | 'email'
  | 'name_search'
  | 'name_results'
  | 'signin'
  | 'signin_by_name'
  | 'register'
  | 'forgot'
  | 'guest'
  | 'success'
  | 'registered'
  | 'reset_sent'
  | 'disabled'
  | 'not_found';

export default function PortalLanding() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { session, portalClient, loading: authLoading } = usePortalAuth();

  const [step, setStep] = useState<Step>('loading');
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [settings, setSettings] = useState<PortalSettings | null>(null);

  const [email, setEmail] = useState('');
  const [nameQuery, setNameQuery] = useState('');
  const [nameMatches, setNameMatches] = useState<NameMatch[]>([]);
  const [searchingName, setSearchingName] = useState(false);
  const [nameSearchError, setNameSearchError] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [clientName, setClientName] = useState('');
  const [hasAccount, setHasAccount] = useState(false);
  const [isPortalEnabled, setIsPortalEnabled] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const emailRef = useRef<TextInput>(null);
  const nameRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const isEmbed = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('embed') === '1'
    : false;

  const primaryColor = settings?.primary_color || '#007AFF';

  useEffect(() => {
    if (!authLoading && session && portalClient) {
      const target = `/portal/${slug}/dashboard${isEmbed ? '?embed=1' : ''}`;
      router.replace(target as any);
    }
  }, [authLoading, session, portalClient]);

  useEffect(() => {
    if (slug) loadSettings();
  }, [slug]);

  const loadSettings = async () => {
    setStep('loading');
    try {
      const data = await portalGet({ action: 'settings', slug });
      if (data.error || !data.organization) { setStep('not_found'); return; }
      setOrg(data.organization);
      if (!data.settings || !data.settings.is_enabled) { setSettings(data.settings); setStep('disabled'); return; }
      setSettings(data.settings);
      setStep('email');
    } catch {
      setStep('not_found');
    }
  };

  const resetToEmail = () => {
    setStep('email');
    setPassword('');
    setConfirmPassword('');
    setError('');
    setClientName('');
    setHasAccount(false);
    setIsPortalEnabled(false);
    setNameQuery('');
    setNameMatches([]);
    setNameSearchError('');
    setTimeout(() => emailRef.current?.focus(), 300);
  };

  const handleEmailSubmit = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    setSubmitting(true);
    setError('');
    try {
      const data = await portalPost({ action: 'lookup', slug, email: trimmed });
      if (data.found) {
        setClientName(data.name);
        setHasAccount(data.has_account);
        setIsPortalEnabled(data.is_portal_enabled);
        setStep('signin');
        setTimeout(() => passwordRef.current?.focus(), 300);
      } else {
        if (settings?.allow_guest_booking) {
          setStep('guest');
        } else {
          setError("We couldn't find an account with that email. Please contact the business to be added.");
        }
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleNameSearch = async () => {
    const trimmed = nameQuery.trim();
    if (trimmed.length < 2) {
      setNameSearchError('Enter at least 2 characters to search.');
      return;
    }
    setSearchingName(true);
    setNameSearchError('');
    setNameMatches([]);
    try {
      const data = await portalPost({ action: 'lookup_by_name', slug, name: trimmed });
      if (data.error) { setNameSearchError(data.error); return; }
      if (!data.matches || data.matches.length === 0) {
        setNameSearchError("No accounts found with that name. Try your email instead.");
        return;
      }
      setNameMatches(data.matches);
      setStep('name_results');
    } catch {
      setNameSearchError('Search failed. Please try again.');
    } finally {
      setSearchingName(false);
    }
  };

  const handleSelectNameMatch = async (match: NameMatch) => {
    setClientName(match.name);

    const { data: portalAccount } = await portalSupabase
      .from('client_portal_accounts')
      .select('id, is_active')
      .eq('client_id', match.id)
      .maybeSingle();

    setHasAccount(!!portalAccount && portalAccount.is_active);
    setIsPortalEnabled(true);

    if (match.has_email) {
      setEmail('');
    }

    setStep('signin_by_name');
  };

  const handleSignIn = async () => {
    if (!password.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const { error: signInError } = await portalSupabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (signInError) { setError('Incorrect email or password. Please try again.'); return; }
      setStep('success');
      setTimeout(() => {
        router.replace(`/portal/${slug}/dashboard${isEmbed ? '?embed=1' : ''}` as any);
      }, 1200);
    } catch {
      setError('Sign in failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async () => {
    if (!password.trim() || !confirmPassword.trim()) return;
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setSubmitting(true);
    setError('');
    try {
      const data = await portalPost({ action: 'register', slug, email: email.trim().toLowerCase(), password });
      if (data.error) { setError(data.error); return; }
      setStep('registered');
    } catch {
      setError('Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    setSubmitting(true);
    setError('');
    try {
      await portalPost({ action: 'reset_password', slug, email: email.trim().toLowerCase() });
      setStep('reset_sent');
    } catch {
      setError('Failed to send reset email. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const { width } = Dimensions.get('window');
  const isWide = !isEmbed && width > 640;

  if (step === 'loading' || authLoading) {
    return (
      <View style={styles.fullCenter}>
        <ActivityIndicator size="large" color={primaryColor} />
      </View>
    );
  }

  if (step === 'not_found') {
    return (
      <View style={styles.fullCenter}>
        <AlertCircle size={48} color="#FF3B30" />
        <Text style={styles.notFoundTitle}>Portal Not Found</Text>
        <Text style={styles.notFoundText}>This client portal link is invalid or has been removed.</Text>
      </View>
    );
  }

  if (step === 'disabled') {
    return (
      <View style={styles.fullCenter}>
        <Building2 size={48} color="#8E8E93" />
        <Text style={styles.notFoundTitle}>{org?.name}</Text>
        <Text style={styles.notFoundText}>The client portal for this business is not currently available.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: isEmbed ? '#fff' : lighten(primaryColor) }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          isWide && styles.scrollWide,
          isEmbed && styles.scrollEmbed,
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.card, isWide && styles.cardWide, isEmbed && styles.cardEmbed]}>

          {!isEmbed && (
            <View style={[styles.cardHeader, { backgroundColor: primaryColor }]}>
              {settings?.logo_url ? (
                <Image
                  source={{ uri: settings.logo_url }}
                  style={styles.orgLogo}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.orgIconWrap}>
                  <Building2 size={28} color="#fff" />
                </View>
              )}
              <Text style={styles.orgName}>{org?.name}</Text>
              <Text style={styles.portalLabel}>{settings?.portal_title || 'Client Hub'}</Text>
            </View>
          )}

          {isEmbed && (
            <View style={[styles.embedHeader, { borderBottomColor: primaryColor + '30' }]}>
              <View style={[styles.embedDot, { backgroundColor: primaryColor }]} />
              <Text style={[styles.embedOrgName, { color: primaryColor }]}>{org?.name}</Text>
              <Text style={styles.embedPortalLabel}>{settings?.portal_title || 'Client Hub'}</Text>
            </View>
          )}

          <View style={styles.cardBody}>

            {step === 'email' && (
              <>
                <Text style={styles.welcomeHeading}>Welcome</Text>
                <Text style={styles.welcomeSub}>
                  {settings?.welcome_message || 'Sign in to view your account.'}
                </Text>
                <View style={styles.fieldWrap}>
                  <Text style={styles.fieldLabel}>Email Address</Text>
                  <View style={styles.inputRow}>
                    <Mail size={18} color="#8E8E93" style={styles.inputIcon} />
                    <TextInput
                      ref={emailRef}
                      style={styles.input}
                      placeholder="your@email.com"
                      placeholderTextColor="#C7C7CC"
                      value={email}
                      onChangeText={(v) => { setEmail(v); setError(''); }}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                      returnKeyType="go"
                      onSubmitEditing={handleEmailSubmit}
                    />
                  </View>
                </View>
                {error ? <ErrorBanner message={error} /> : null}
                <PrimaryBtn
                  label="Continue"
                  color={primaryColor}
                  loading={submitting}
                  disabled={!email.trim()}
                  onPress={handleEmailSubmit}
                />
                <View style={styles.dividerRow}>
                  <View style={styles.divider} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.divider} />
                </View>
                <TouchableOpacity
                  style={styles.nameSearchLink}
                  onPress={() => { setStep('name_search'); setTimeout(() => nameRef.current?.focus(), 300); }}
                >
                  <Search size={15} color={primaryColor} />
                  <Text style={[styles.nameSearchLinkText, { color: primaryColor }]}>
                    Find my account by name
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {step === 'name_search' && (
              <>
                <BackBtn onPress={resetToEmail} label="Back to email" />
                <View style={styles.registerHeadWrap}>
                  <View style={[styles.registerIcon, { backgroundColor: primaryColor + '15' }]}>
                    <Search size={24} color={primaryColor} />
                  </View>
                  <Text style={styles.welcomeHeading}>Find Your Account</Text>
                  <Text style={styles.welcomeSub}>
                    Enter your name to search for your account.
                  </Text>
                </View>
                <View style={styles.fieldWrap}>
                  <Text style={styles.fieldLabel}>Your Name</Text>
                  <View style={styles.inputRow}>
                    <User size={18} color="#8E8E93" style={styles.inputIcon} />
                    <TextInput
                      ref={nameRef}
                      style={styles.input}
                      placeholder="e.g. John Smith"
                      placeholderTextColor="#C7C7CC"
                      value={nameQuery}
                      onChangeText={(v) => { setNameQuery(v); setNameSearchError(''); }}
                      autoCapitalize="words"
                      returnKeyType="search"
                      onSubmitEditing={handleNameSearch}
                    />
                  </View>
                </View>
                {nameSearchError ? <ErrorBanner message={nameSearchError} /> : null}
                <PrimaryBtn
                  label="Search"
                  color={primaryColor}
                  loading={searchingName}
                  disabled={nameQuery.trim().length < 2}
                  onPress={handleNameSearch}
                />
              </>
            )}

            {step === 'name_results' && (
              <>
                <BackBtn onPress={() => { setStep('name_search'); setNameMatches([]); }} label="Search again" />
                <Text style={styles.welcomeHeading}>Select Your Account</Text>
                <Text style={styles.welcomeSub}>
                  We found {nameMatches.length} account{nameMatches.length > 1 ? 's' : ''} matching "{nameQuery}". Which one is you?
                </Text>

                {nameMatches.map((match) => (
                  <TouchableOpacity
                    key={match.id}
                    style={styles.matchCard}
                    onPress={async () => {
                      setClientName(match.name);
                      setIsPortalEnabled(true);

                      const { data: pa } = await portalSupabase
                        .from('client_portal_accounts')
                        .select('id, is_active')
                        .eq('client_id', match.id)
                        .maybeSingle();

                      setHasAccount(!!pa && pa.is_active);
                      setStep('signin_by_name');
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.matchAvatar, { backgroundColor: primaryColor + '18' }]}>
                      <User size={18} color={primaryColor} />
                    </View>
                    <View style={styles.matchContent}>
                      <Text style={styles.matchName}>{match.name}</Text>
                      {match.masked_email ? (
                        <View style={styles.matchDetail}>
                          <Mail size={12} color="#8E8E93" />
                          <Text style={styles.matchDetailText}>{match.masked_email}</Text>
                        </View>
                      ) : match.masked_address ? (
                        <View style={styles.matchDetail}>
                          <MapPin size={12} color="#8E8E93" />
                          <Text style={styles.matchDetailText}>{match.masked_address}</Text>
                        </View>
                      ) : null}
                    </View>
                    <ArrowRight size={16} color="#C7C7CC" />
                  </TouchableOpacity>
                ))}

                <View style={styles.dividerRow}>
                  <View style={styles.divider} />
                  <Text style={styles.dividerText}>not you?</Text>
                  <View style={styles.divider} />
                </View>
                <SecondaryBtn label="Search by email instead" onPress={resetToEmail} />
              </>
            )}

            {(step === 'signin' || step === 'signin_by_name') && (
              <>
                <BackBtn
                  onPress={() => {
                    if (step === 'signin_by_name') setStep('name_results');
                    else resetToEmail();
                  }}
                  label={step === 'signin_by_name' ? 'Back' : 'Change email'}
                />
                <ClientWelcome name={clientName} email={email} color={primaryColor} showEmail={step === 'signin'} />

                {!isPortalEnabled && (
                  <InfoBanner
                    message={`Portal access for this account hasn't been activated yet. Please contact ${org?.name}.`}
                    color="#FF9500"
                    bgColor="#FFF9F0"
                  />
                )}

                {isPortalEnabled && !hasAccount && (
                  <>
                    <InfoBanner
                      message={step === 'signin'
                        ? "You don't have a password yet. Create one to access your account."
                        : "Set up a password to access your account online."}
                      color="#007AFF"
                      bgColor="#F0F6FF"
                    />
                    {step === 'signin' ? (
                      <PrimaryBtn
                        label="Set Up My Account"
                        color={primaryColor}
                        onPress={() => { setStep('register'); setTimeout(() => passwordRef.current?.focus(), 300); }}
                      />
                    ) : (
                      <>
                        <InfoBanner
                          message="Enter the email address on file with us to set up your account."
                          color="#8E8E93"
                          bgColor="#F2F2F7"
                        />
                        <View style={styles.fieldWrap}>
                          <Text style={styles.fieldLabel}>Email Address</Text>
                          <View style={styles.inputRow}>
                            <Mail size={18} color="#8E8E93" style={styles.inputIcon} />
                            <TextInput
                              style={styles.input}
                              placeholder="your@email.com"
                              placeholderTextColor="#C7C7CC"
                              value={email}
                              onChangeText={(v) => { setEmail(v); setError(''); }}
                              keyboardType="email-address"
                              autoCapitalize="none"
                              returnKeyType="go"
                            />
                          </View>
                        </View>
                        {error ? <ErrorBanner message={error} /> : null}
                        <PrimaryBtn
                          label="Set Up My Account"
                          color={primaryColor}
                          disabled={!email.trim()}
                          onPress={() => { setStep('register'); setTimeout(() => passwordRef.current?.focus(), 300); }}
                        />
                      </>
                    )}
                  </>
                )}

                {isPortalEnabled && hasAccount && (
                  <>
                    {step === 'signin_by_name' && (
                      <View style={styles.fieldWrap}>
                        <Text style={styles.fieldLabel}>Email Address</Text>
                        <View style={styles.inputRow}>
                          <Mail size={18} color="#8E8E93" style={styles.inputIcon} />
                          <TextInput
                            style={styles.input}
                            placeholder="your@email.com"
                            placeholderTextColor="#C7C7CC"
                            value={email}
                            onChangeText={(v) => { setEmail(v); setError(''); }}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            returnKeyType="next"
                            onSubmitEditing={() => passwordRef.current?.focus()}
                          />
                        </View>
                      </View>
                    )}
                    <View style={styles.fieldWrap}>
                      <Text style={styles.fieldLabel}>Password</Text>
                      <View style={styles.inputRow}>
                        <Lock size={18} color="#8E8E93" style={styles.inputIcon} />
                        <TextInput
                          ref={passwordRef}
                          style={styles.input}
                          placeholder="Enter your password"
                          placeholderTextColor="#C7C7CC"
                          value={password}
                          onChangeText={(v) => { setPassword(v); setError(''); }}
                          secureTextEntry={!showPassword}
                          returnKeyType="go"
                          onSubmitEditing={handleSignIn}
                        />
                        <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.eyeBtn}>
                          {showPassword ? <EyeOff size={18} color="#8E8E93" /> : <Eye size={18} color="#8E8E93" />}
                        </TouchableOpacity>
                      </View>
                    </View>
                    {error ? <ErrorBanner message={error} /> : null}
                    <PrimaryBtn
                      label="Sign In"
                      color={primaryColor}
                      loading={submitting}
                      disabled={!password.trim() || (step === 'signin_by_name' && !email.trim())}
                      onPress={handleSignIn}
                    />
                    <TouchableOpacity
                      onPress={() => {
                        setStep('forgot');
                      }}
                      style={styles.forgotBtn}
                    >
                      <KeyRound size={14} color="#8E8E93" />
                      <Text style={styles.forgotText}>Forgot password?</Text>
                    </TouchableOpacity>
                  </>
                )}
              </>
            )}

            {step === 'register' && (
              <>
                <BackBtn onPress={() => { setStep('signin'); setPassword(''); setConfirmPassword(''); setError(''); }} label="Back" />
                <View style={styles.registerHeadWrap}>
                  <View style={[styles.registerIcon, { backgroundColor: primaryColor + '15' }]}>
                    <UserPlus size={24} color={primaryColor} />
                  </View>
                  <Text style={styles.welcomeHeading}>Set Up Your Account</Text>
                  <Text style={styles.welcomeSub}>
                    Create a password for <Text style={{ fontWeight: '600', color: '#1C1C1E' }}>{email}</Text>
                  </Text>
                </View>
                <View style={styles.fieldWrap}>
                  <Text style={styles.fieldLabel}>Password</Text>
                  <View style={styles.inputRow}>
                    <Lock size={18} color="#8E8E93" style={styles.inputIcon} />
                    <TextInput
                      ref={passwordRef}
                      style={styles.input}
                      placeholder="At least 8 characters"
                      placeholderTextColor="#C7C7CC"
                      value={password}
                      onChangeText={(v) => { setPassword(v); setError(''); }}
                      secureTextEntry={!showPassword}
                      returnKeyType="next"
                      onSubmitEditing={() => confirmRef.current?.focus()}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.eyeBtn}>
                      {showPassword ? <EyeOff size={18} color="#8E8E93" /> : <Eye size={18} color="#8E8E93" />}
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.fieldWrap}>
                  <Text style={styles.fieldLabel}>Confirm Password</Text>
                  <View style={styles.inputRow}>
                    <Lock size={18} color="#8E8E93" style={styles.inputIcon} />
                    <TextInput
                      ref={confirmRef}
                      style={styles.input}
                      placeholder="Repeat your password"
                      placeholderTextColor="#C7C7CC"
                      value={confirmPassword}
                      onChangeText={(v) => { setConfirmPassword(v); setError(''); }}
                      secureTextEntry={!showConfirm}
                      returnKeyType="go"
                      onSubmitEditing={handleRegister}
                    />
                    <TouchableOpacity onPress={() => setShowConfirm(v => !v)} style={styles.eyeBtn}>
                      {showConfirm ? <EyeOff size={18} color="#8E8E93" /> : <Eye size={18} color="#8E8E93" />}
                    </TouchableOpacity>
                  </View>
                </View>
                {error ? <ErrorBanner message={error} /> : null}
                <PrimaryBtn
                  label="Create Account"
                  color={primaryColor}
                  loading={submitting}
                  disabled={!password.trim() || !confirmPassword.trim()}
                  onPress={handleRegister}
                />
              </>
            )}

            {step === 'forgot' && (
              <>
                <BackBtn onPress={() => { setStep('signin'); setError(''); }} label="Back to sign in" />
                <Text style={styles.welcomeHeading}>Reset Password</Text>
                <Text style={styles.welcomeSub}>
                  We'll send a password reset link to{' '}
                  {email
                    ? <Text style={{ fontWeight: '600', color: '#1C1C1E' }}>{email}</Text>
                    : 'your email address'}
                </Text>
                {!email.trim() && (
                  <View style={styles.fieldWrap}>
                    <Text style={styles.fieldLabel}>Email Address</Text>
                    <View style={styles.inputRow}>
                      <Mail size={18} color="#8E8E93" style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="your@email.com"
                        placeholderTextColor="#C7C7CC"
                        value={email}
                        onChangeText={(v) => { setEmail(v); setError(''); }}
                        keyboardType="email-address"
                        autoCapitalize="none"
                      />
                    </View>
                  </View>
                )}
                {error ? <ErrorBanner message={error} /> : null}
                <PrimaryBtn
                  label="Send Reset Link"
                  color={primaryColor}
                  loading={submitting}
                  disabled={!email.trim()}
                  onPress={handleForgotPassword}
                />
              </>
            )}

            {step === 'guest' && (
              <>
                <BackBtn onPress={resetToEmail} label="Back" />
                <Text style={styles.welcomeHeading}>Guest Access</Text>
                <Text style={styles.welcomeSub}>
                  We don't have an account for <Text style={{ fontWeight: '600' }}>{email}</Text>.{'\n\n'}
                  You can submit a booking request as a guest — {org?.name} will follow up with you.
                </Text>
                <PrimaryBtn
                  label="Continue as Guest"
                  color={primaryColor}
                  onPress={() => router.push(`/portal/${slug}/guest-booking?email=${encodeURIComponent(email)}${isEmbed ? '&embed=1' : ''}` as any)}
                />
                <View style={styles.dividerRow}>
                  <View style={styles.divider} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.divider} />
                </View>
                <SecondaryBtn label="Try a different email" onPress={resetToEmail} />
              </>
            )}

            {step === 'registered' && (
              <SuccessView
                color={primaryColor}
                title="Account Created!"
                sub="Your account is ready. Sign in now to access your portal."
                action="Sign In"
                onAction={() => {
                  setStep('signin');
                  setHasAccount(true);
                  setPassword('');
                  setConfirmPassword('');
                }}
              />
            )}

            {step === 'reset_sent' && (
              <SuccessView
                color={primaryColor}
                title="Check Your Email"
                sub={`A password reset link has been sent to ${email}.`}
                action="Back to Sign In"
                onAction={() => { setStep('signin'); setError(''); }}
              />
            )}

            {step === 'success' && (
              <View style={styles.successWrap}>
                <View style={[styles.successIcon, { backgroundColor: primaryColor + '18' }]}>
                  <CheckCircle size={40} color={primaryColor} />
                </View>
                <Text style={[styles.successTitle, { color: primaryColor }]}>Signed in!</Text>
                <Text style={styles.successSub}>Loading your account...</Text>
                <ActivityIndicator size="small" color={primaryColor} style={{ marginTop: 16 }} />
              </View>
            )}

          </View>

          {!isEmbed && (
            <View style={styles.cardFooter}>
              <Text style={styles.footerText}>
                Powered by <Text style={[styles.footerBrand, { color: primaryColor }]}>ToolBox</Text>
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function PrimaryBtn({ label, color, loading, disabled, onPress }: { label: string; color: string; loading?: boolean; disabled?: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.primaryBtn, (disabled || loading) && styles.btnDisabled]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      <LinearGradient
        colors={[color, shiftColor(color, -20)] as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.primaryBtnGradient}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Text style={styles.primaryBtnText}>{label}</Text>
            <ArrowRight size={18} color="#fff" />
          </>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

function SecondaryBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.secondaryBtn} onPress={onPress}>
      <Text style={styles.secondaryBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

function BackBtn({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <TouchableOpacity style={styles.backBtn} onPress={onPress}>
      <ChevronLeft size={18} color="#8E8E93" />
      <Text style={styles.backBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

function ClientWelcome({ name, email, color, showEmail }: { name: string; email: string; color: string; showEmail?: boolean }) {
  return (
    <View style={styles.clientWelcomeWrap}>
      <View style={[styles.clientAvatar, { backgroundColor: color + '22' }]}>
        <UserCircle size={32} color={color} />
      </View>
      <Text style={[styles.clientWelcomeText, { color }]}>Welcome back, {name.split(' ')[0]}!</Text>
      {showEmail && email ? <Text style={styles.clientEmailText}>{email}</Text> : null}
    </View>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <View style={styles.errorBanner}>
      <AlertCircle size={15} color="#FF3B30" />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

function InfoBanner({ message, color, bgColor }: { message: string; color: string; bgColor: string }) {
  return (
    <View style={[styles.infoBanner, { backgroundColor: bgColor }]}>
      <AlertCircle size={15} color={color} />
      <Text style={[styles.infoText, { color }]}>{message}</Text>
    </View>
  );
}

function SuccessView({ color, title, sub, action, onAction }: { color: string; title: string; sub: string; action: string; onAction: () => void }) {
  return (
    <View style={styles.successWrap}>
      <View style={[styles.successIcon, { backgroundColor: color + '18' }]}>
        <CheckCircle size={40} color={color} />
      </View>
      <Text style={[styles.successTitle, { color }]}>{title}</Text>
      <Text style={styles.successSub}>{sub}</Text>
      <TouchableOpacity style={[styles.primaryBtn, { marginTop: 8 }]} onPress={onAction}>
        <LinearGradient
          colors={[color, shiftColor(color, -20)] as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.primaryBtnGradient}
        >
          <Text style={styles.primaryBtnText}>{action}</Text>
          <ArrowRight size={18} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

function shiftColor(hex: string, amount: number): string {
  try {
    const r = Math.max(0, Math.min(255, parseInt(hex.slice(1, 3), 16) + amount));
    const g = Math.max(0, Math.min(255, parseInt(hex.slice(3, 5), 16) + amount));
    const b = Math.max(0, Math.min(255, parseInt(hex.slice(5, 7), 16) + amount));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  } catch {
    return hex;
  }
}

function lighten(hex: string): string {
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const mix = (c: number) => Math.round(c * 0.08 + 247 * 0.92);
    return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
  } catch {
    return '#F2F2F7';
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: '100%' as any },
  fullCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2F2F7', padding: 32, gap: 16 },
  notFoundTitle: { fontSize: 20, fontWeight: '700', color: '#1C1C1E', textAlign: 'center' },
  notFoundText: { fontSize: 15, color: '#8E8E93', textAlign: 'center', lineHeight: 22 },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24, paddingVertical: 48 },
  scrollWide: { paddingVertical: 72 },
  scrollEmbed: { padding: 0, paddingVertical: 0 },
  card: { width: '100%', maxWidth: 440, backgroundColor: '#FFFFFF', borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 10 },
  cardWide: { maxWidth: 480 },
  cardEmbed: { borderRadius: 0, shadowOpacity: 0, elevation: 0, maxWidth: '100%' as any },
  cardHeader: { paddingTop: 36, paddingBottom: 28, paddingHorizontal: 32, alignItems: 'center', gap: 10 },
  orgIconWrap: { width: 56, height: 56, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  orgLogo: { width: 72, height: 72, borderRadius: 12, marginBottom: 4, backgroundColor: 'rgba(255,255,255,0.15)' },
  orgName: { fontSize: 20, fontWeight: '700', color: '#fff', textAlign: 'center' },
  portalLabel: { fontSize: 13, color: 'rgba(255,255,255,0.75)', letterSpacing: 0.5, textTransform: 'uppercase' },
  embedHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16, paddingHorizontal: 20, borderBottomWidth: 1 },
  embedDot: { width: 8, height: 8, borderRadius: 4 },
  embedOrgName: { fontSize: 14, fontWeight: '700' },
  embedPortalLabel: { fontSize: 12, color: '#8E8E93' },
  cardBody: { padding: 28, gap: 16 },
  welcomeHeading: { fontSize: 24, fontWeight: '700', color: '#1C1C1E' },
  welcomeSub: { fontSize: 15, color: '#8E8E93', lineHeight: 22 },
  fieldWrap: { gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#3C3C43', letterSpacing: 0.2 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F2F2F7', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 4, height: 52 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16, color: '#1C1C1E', borderWidth: 0, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}) },
  eyeBtn: { padding: 4 },
  primaryBtn: { height: 52, borderRadius: 12, overflow: 'hidden' as const, marginTop: 4 },
  primaryBtnGradient: { flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 8 },
  primaryBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  btnDisabled: { opacity: 0.5 },
  secondaryBtn: { height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2F2F7' },
  secondaryBtnText: { fontSize: 16, fontWeight: '500', color: '#1C1C1E' },
  errorBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#FFF2F2', borderRadius: 10, padding: 12 },
  errorText: { flex: 1, fontSize: 14, color: '#FF3B30', lineHeight: 20 },
  infoBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 10, padding: 12 },
  infoText: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '500' },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  backBtnText: { fontSize: 14, color: '#8E8E93' },
  clientWelcomeWrap: { alignItems: 'center', gap: 8, paddingVertical: 8 },
  clientAvatar: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  clientWelcomeText: { fontSize: 20, fontWeight: '700' },
  clientEmailText: { fontSize: 14, color: '#8E8E93' },
  registerHeadWrap: { alignItems: 'center', gap: 8 },
  registerIcon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  forgotBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', paddingVertical: 4 },
  forgotText: { fontSize: 14, color: '#8E8E93' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 },
  divider: { flex: 1, height: 1, backgroundColor: '#E5E5EA' },
  dividerText: { fontSize: 13, color: '#8E8E93' },
  nameSearchLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 4 },
  nameSearchLinkText: { fontSize: 14, fontWeight: '500' },
  matchCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#F9F9FB', borderRadius: 12,
    padding: 14, borderWidth: 1, borderColor: '#E5E5EA',
  },
  matchAvatar: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  matchContent: { flex: 1, gap: 3 },
  matchName: { fontSize: 15, fontWeight: '600', color: '#1C1C1E' },
  matchDetail: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  matchDetailText: { fontSize: 13, color: '#8E8E93', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  successWrap: { alignItems: 'center', paddingVertical: 16, gap: 12 },
  successIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  successTitle: { fontSize: 24, fontWeight: '700' },
  successSub: { fontSize: 15, color: '#8E8E93', textAlign: 'center', lineHeight: 22 },
  cardFooter: { paddingVertical: 16, paddingHorizontal: 28, borderTopWidth: 1, borderTopColor: '#F2F2F7', alignItems: 'center' },
  footerText: { fontSize: 12, color: '#C7C7CC' },
  footerBrand: { fontWeight: '600' },
});
