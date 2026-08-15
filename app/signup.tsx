import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  ScrollView,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useRouter } from 'expo-router';
import { Shield, Users, Info, Square, SquareCheck as CheckSquare } from 'lucide-react-native';
import Logo from '@/components/Logo';
import OnboardingModal from '@/components/OnboardingModal';
import CollapsibleField from '@/components/CollapsibleField';
import { useCollapsibleForm } from '@/hooks/useCollapsibleForm';
import { supabase } from '@/lib/supabase';
import getDynamicStyles from '@/styles/signupStyles';

type UserRole = 'admin' | 'employee' | null;

const provisionSmsNumber = async (organizationId: string, accessToken: string) => {
  try {
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl || !accessToken) return;

    fetch(`${supabaseUrl}/functions/v1/provision-sms-number`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        organization_id: organizationId,
        country: 'US',
      }),
    }).catch(() => {});
  } catch {
  }
};

const scheduleLifecycleEmails = async (
  orgId: string,
  ownerEmail: string,
  ownerName: string,
  orgName: string
) => {
  try {
    await supabase.rpc('schedule_org_lifecycle_emails', {
      p_org_id: orgId,
      p_owner_email: ownerEmail,
      p_owner_name: ownerName,
      p_org_name: orgName,
    });

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) return;

    const { data: session } = await supabase.auth.getSession();
    const accessToken = session?.session?.access_token;
    if (!accessToken) return;

    const { data: welcomeRecord } = await supabase
      .from('organization_lifecycle_emails')
      .select('id')
      .eq('organization_id', orgId)
      .eq('email_type', 'welcome')
      .maybeSingle();

    if (welcomeRecord?.id) {
      fetch(`${supabaseUrl}/functions/v1/send-lifecycle-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ lifecycle_email_id: welcomeRecord.id }),
      }).catch(() => {});
    }
  } catch {
  }
};

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>(null);
  const [joinCode, setJoinCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdJoinCode, setCreatedJoinCode] = useState('');
  const [createdOrgName, setCreatedOrgName] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [pendingNavigate, setPendingNavigate] = useState<string | null>(null);

  const codeInputRefs = useRef<(TextInput | null)[]>([]);
  const { signUp, signIn, user } = useAuth();
  const { refreshOrganizations } = useOrganization();
  const { colors } = useTheme();
  const router = useRouter();
  const { activeFieldId, toggleField } = useCollapsibleForm('displayName');
  const dynamicStyles = getDynamicStyles(colors);

  React.useEffect(() => {
    if (!pendingNavigate) return;
    if (user) {
      router.replace(pendingNavigate as any);
      return;
    }
    const timeout = setTimeout(async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (sess?.session) {
        router.replace(pendingNavigate as any);
      }
    }, 3000);
    return () => clearTimeout(timeout);
  }, [pendingNavigate, user]);

  const handleCodeChange = (value: string, index: number) => {
    const digit = value.replace(/[^0-9]/g, '').slice(-1);
    const newCode = [...joinCode];
    newCode[index] = digit;
    setJoinCode(newCode);

    if (digit && index < 5) {
      codeInputRefs.current[index + 1]?.focus();
    }
  };

  const handleCodeKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !joinCode[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus();
      const newCode = [...joinCode];
      newCode[index - 1] = '';
      setJoinCode(newCode);
    }
  };

  const fullJoinCode = joinCode.join('');

  const handleSignUp = async () => {
    if (!displayName.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }
    if (!selectedRole) {
      setError('Please select whether you are an Admin or Employee');
      return;
    }
    if (!termsAccepted) {
      setError('Please accept the Terms of Service and Privacy Policy to continue');
      return;
    }
    if (selectedRole === 'admin' && !businessName.trim()) {
      setError('Please enter your business name');
      return;
    }
    if (selectedRole === 'employee' && fullJoinCode.length !== 6) {
      setError('Please enter the full 6-digit organization code');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data: authData, error: signUpError } = await signUp(email, password);

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      if (!authData?.user) {
        setError('Failed to create account');
        setLoading(false);
        return;
      }

      if (!authData.session) {
        await new Promise(resolve => setTimeout(resolve, 800));
        let signInError: any = null;
        for (let attempt = 0; attempt < 2; attempt++) {
          if (attempt > 0) await new Promise(resolve => setTimeout(resolve, 1000));
          const result = await signIn(email, password);
          signInError = result.error;
          if (!signInError) break;
        }
        if (signInError) {
          setError('Account created but we could not sign you in automatically. Please go back and sign in with your credentials.');
          setLoading(false);
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const { data: sessionCheck } = await supabase.auth.getSession();
      if (!sessionCheck?.session) {
        setError('Session not established. Please try logging in.');
        setLoading(false);
        return;
      }

      const userId = authData.user.id;

      const acceptanceTimestamp = new Date().toISOString();
      await supabase
        .from('profiles')
        .update({
          display_name: displayName.trim(),
          terms_accepted_at: acceptanceTimestamp,
          privacy_accepted_at: acceptanceTimestamp,
          terms_privacy_version: '1.0'
        })
        .eq('id', userId);

      if (selectedRole === 'admin') {
        const orgSlug = businessName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + userId.substring(0, 8);

        const { data: orgData, error: orgError } = await supabase
          .rpc('create_organization_for_user', {
            p_name: businessName.trim(),
            p_slug: orgSlug,
          });

        if (orgError) {
          setError('Failed to create organization: ' + orgError.message);
          setLoading(false);
          return;
        }

        if (!orgData) {
          setError('Failed to create organization. Please try again.');
          setLoading(false);
          return;
        }

        provisionSmsNumber(orgData.id, authData.session?.access_token || '');
        scheduleLifecycleEmails(orgData.id, email.trim(), displayName.trim(), businessName.trim());

        setCreatedJoinCode(orgData.join_code);
        setCreatedOrgName(orgData.name);
        await refreshOrganizations();
        setShowSuccessModal(true);
        setLoading(false);
      } else {
        let joinResult = null;
        let rpcError = null;

        for (let attempt = 0; attempt < 3; attempt++) {
          if (attempt > 0) await new Promise(resolve => setTimeout(resolve, 600));
          const result = await supabase.rpc('join_organization_by_code', { p_join_code: fullJoinCode });
          joinResult = result.data;
          rpcError = result.error;
          if (!rpcError && joinResult?.success) break;
        }

        if (rpcError) {
          setError('Failed to join organization: ' + rpcError.message);
          setLoading(false);
          return;
        }

        if (!joinResult?.success) {
          setError(joinResult?.error || 'Invalid organization code. Please check with your admin.');
          setLoading(false);
          return;
        }

        await refreshOrganizations();

        const { data: orgs } = await supabase
          .from('organization_members')
          .select('organization_id')
          .eq('user_id', userId)
          .limit(1);

        if (!orgs || orgs.length === 0) {
          setError('Organization join succeeded but membership was not saved. Please log in and try again from settings.');
          setLoading(false);
          return;
        }

        if (user) {
          router.replace('/(tabs)/index');
        } else {
          setPendingNavigate('/(tabs)/index');
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during signup');
      setLoading(false);
    }
  };

  const handleSuccessContinue = async () => {
    setShowSuccessModal(false);
    if (user) {
      router.replace('/(tabs)/index');
    } else {
      setPendingNavigate('/(tabs)/index');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={dynamicStyles.container}
    >
      <ScrollView
        contentContainerStyle={dynamicStyles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={dynamicStyles.logoContainer}>
          <Logo size="large" showLightning={false} />
        </View>
        <Text style={dynamicStyles.subtitle}>Create your account</Text>

        {error ? (
          <View style={dynamicStyles.errorContainer}>
            <Text style={dynamicStyles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={dynamicStyles.form}>
          <CollapsibleField
            label="Your Name"
            fieldId="displayName"
            activeFieldId={activeFieldId}
            onToggle={toggleField}
            displayValue={displayName || undefined}
            startExpanded
          >
            <TextInput
              style={dynamicStyles.input}
              placeholder="Your Name"
              placeholderTextColor={colors.textSecondary}
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
              editable={!loading}
            />
          </CollapsibleField>

          <CollapsibleField
            label="Email"
            fieldId="email"
            activeFieldId={activeFieldId}
            onToggle={toggleField}
            displayValue={email || undefined}
            startExpanded
          >
            <TextInput
              style={dynamicStyles.input}
              placeholder="Email"
              placeholderTextColor={colors.textSecondary}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!loading}
            />
          </CollapsibleField>

          <CollapsibleField
            label="Password"
            fieldId="password"
            activeFieldId={activeFieldId}
            onToggle={toggleField}
            displayValue={password ? '********' : undefined}
            startExpanded
          >
            <TextInput
              style={dynamicStyles.input}
              placeholder="Password"
              placeholderTextColor={colors.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loading}
            />
          </CollapsibleField>

          <CollapsibleField
            label="Confirm Password"
            fieldId="confirmPassword"
            activeFieldId={activeFieldId}
            onToggle={toggleField}
            displayValue={confirmPassword ? '********' : undefined}
            startExpanded
          >
            <TextInput
              style={dynamicStyles.input}
              placeholder="Confirm Password"
              placeholderTextColor={colors.textSecondary}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              editable={!loading}
            />
          </CollapsibleField>

          <View style={dynamicStyles.roleSectionHeader}>
            <Text style={dynamicStyles.roleSectionTitle}>What's your role?</Text>
          </View>

          <View style={dynamicStyles.roleCards}>
            <Pressable
              style={[
                dynamicStyles.roleCard,
                selectedRole === 'admin' && dynamicStyles.roleCardSelected,
              ]}
              onPress={() => setSelectedRole('admin')}
              disabled={loading}
            >
              <View style={dynamicStyles.roleCardHeader}>
                <View style={[dynamicStyles.roleIcon, { backgroundColor: colors.primary + '15' }]}>
                  <Shield size={22} color={colors.primary} />
                </View>
                <TouchableOpacity
                  style={dynamicStyles.infoButton}
                  onPress={() => setShowInfoModal(true)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Info size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <Text style={[dynamicStyles.roleCardTitle, selectedRole === 'admin' && { color: colors.primary }]}>
                I'm an Admin
              </Text>
              <Text style={dynamicStyles.roleCardDesc}>
                Set up a new business
              </Text>
              {selectedRole === 'admin' && (
                <View style={[dynamicStyles.roleSelectedIndicator, { backgroundColor: colors.primary }]} />
              )}
            </Pressable>

            <Pressable
              style={[
                dynamicStyles.roleCard,
                selectedRole === 'employee' && [dynamicStyles.roleCardSelected, { borderColor: '#0891b2' }],
              ]}
              onPress={() => setSelectedRole('employee')}
              disabled={loading}
            >
              <View style={dynamicStyles.roleCardHeader}>
                <View style={[dynamicStyles.roleIcon, { backgroundColor: '#0891b215' }]}>
                  <Users size={22} color="#0891b2" />
                </View>
              </View>
              <Text style={[dynamicStyles.roleCardTitle, selectedRole === 'employee' && { color: '#0891b2' }]}>
                I'm an Employee
              </Text>
              <Text style={dynamicStyles.roleCardDesc}>
                Join an existing team
              </Text>
              {selectedRole === 'employee' && (
                <View style={[dynamicStyles.roleSelectedIndicator, { backgroundColor: '#0891b2' }]} />
              )}
            </Pressable>
          </View>

          {selectedRole === 'admin' && (
            <View style={dynamicStyles.roleDetailSection}>
              <CollapsibleField
                label="Business Name"
                fieldId="businessName"
                activeFieldId={activeFieldId}
                onToggle={toggleField}
                displayValue={businessName || undefined}
                startExpanded
                required
              >
                <TextInput
                  style={dynamicStyles.input}
                  placeholder="e.g. Smith's Landscaping"
                  placeholderTextColor={colors.textSecondary}
                  value={businessName}
                  onChangeText={setBusinessName}
                  autoCapitalize="words"
                  editable={!loading}
                />
              </CollapsibleField>
            </View>
          )}

          {selectedRole === 'employee' && (
            <View style={dynamicStyles.roleDetailSection}>
              <Text style={dynamicStyles.roleDetailLabel}>Organization Code</Text>
              <Text style={dynamicStyles.roleDetailHint}>
                Ask your admin for the 6-digit code
              </Text>
              <View style={dynamicStyles.codeInputRow}>
                {joinCode.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => { codeInputRefs.current[index] = ref; }}
                    style={[
                      dynamicStyles.codeInput,
                      digit ? dynamicStyles.codeInputFilled : null,
                    ]}
                    value={digit}
                    onChangeText={(val) => handleCodeChange(val, index)}
                    onKeyPress={(e) => handleCodeKeyPress(e, index)}
                    keyboardType="number-pad"
                    maxLength={1}
                    editable={!loading}
                    selectTextOnFocus
                  />
                ))}
              </View>
            </View>
          )}

          <Pressable
            style={dynamicStyles.termsContainer}
            onPress={() => setTermsAccepted(!termsAccepted)}
            disabled={loading}
          >
            <View style={dynamicStyles.checkboxContainer}>
              {termsAccepted ? (
                <CheckSquare size={22} color={colors.primary} />
              ) : (
                <Square size={22} color={colors.textSecondary} />
              )}
            </View>
            <View style={dynamicStyles.termsTextContainer}>
              <Text style={dynamicStyles.termsText}>
                I agree to the{' '}
                <Text
                  style={dynamicStyles.termsLink}
                  onPress={(e) => {
                    e.stopPropagation();
                    router.push('/terms');
                  }}
                >
                  Terms of Service
                </Text>
                {' '}and{' '}
                <Text
                  style={dynamicStyles.termsLink}
                  onPress={(e) => {
                    e.stopPropagation();
                    router.push('/privacy');
                  }}
                >
                  Privacy Policy
                </Text>
              </Text>
            </View>
          </Pressable>

          <TouchableOpacity
            style={[dynamicStyles.button, (!selectedRole || !termsAccepted || loading) && dynamicStyles.buttonDisabled]}
            onPress={handleSignUp}
            disabled={!selectedRole || !termsAccepted || loading}
          >
            <LinearGradient
              colors={['#1B4D6E', '#245d82']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={dynamicStyles.buttonGradient}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={dynamicStyles.buttonText}>Create Account</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.back()}
            disabled={loading}
          >
            <Text style={dynamicStyles.linkText}>
              Already have an account? Sign In
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={showInfoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowInfoModal(false)}
      >
        <Pressable style={dynamicStyles.modalOverlay} onPress={() => setShowInfoModal(false)}>
          <Pressable style={dynamicStyles.infoModalContent} onPress={(e) => e.stopPropagation()}>
            <View style={[dynamicStyles.infoModalIcon, { backgroundColor: colors.primary + '15' }]}>
              <Shield size={28} color={colors.primary} />
            </View>
            <Text style={dynamicStyles.infoModalTitle}>What is an Admin?</Text>
            <Text style={dynamicStyles.infoModalText}>
              As an Admin, you'll set up your own organization and business structure. You'll receive a unique 6-digit code that you can share with your employees so they can join your team.
            </Text>
            <Text style={dynamicStyles.infoModalText}>
              Admins can manage team members, view all time entries, and control business settings.
            </Text>
            <TouchableOpacity
              style={[dynamicStyles.button, { marginTop: 8 }]}
              onPress={() => setShowInfoModal(false)}
            >
              <LinearGradient
                colors={['#1B4D6E', '#245d82']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={dynamicStyles.buttonGradient}
              >
                <Text style={dynamicStyles.buttonText}>Got it</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <OnboardingModal
        visible={showSuccessModal}
        orgName={createdOrgName}
        joinCode={createdJoinCode}
        onFinish={handleSuccessContinue}
      />
    </KeyboardAvoidingView>
  );
}
