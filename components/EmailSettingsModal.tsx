import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Platform,
} from 'react-native';
import { X, Mail, CircleCheck as CheckCircle, CircleAlert as AlertCircle, Copy, RefreshCw, Globe, Shield, ChevronRight, Settings, ExternalLink, FileText, Calculator, Bell, Send, Smartphone, Zap } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase, fetchFunction } from '@/lib/supabase';

interface EmailSettings {
  id: string;
  organization_id: string;
  sending_domain: string;
  domain_status: string;
  domain_records: DnsRecord[] | null;
  custom_from_name: string;
  custom_from_email: string;
  is_active: boolean;
  setup_completed_at: string | null;
}

interface DnsRecord {
  type: string;
  name: string;
  value: string;
  status?: string;
  ttl?: string;
  priority?: number;
}

interface EmailSettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function EmailSettingsModal({
  visible,
  onClose,
}: EmailSettingsModalProps) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { currentOrganization } = useOrganization();

  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<EmailSettings | null>(null);
  const [settingUp, setSettingUp] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [customDomain, setCustomDomain] = useState('');
  const [showDomainInput, setShowDomainInput] = useState(false);
  const [addingDomain, setAddingDomain] = useState(false);
  const [emailChannel, setEmailChannel] = useState<'native' | 'mailgun'>('native');
  const [savingChannel, setSavingChannel] = useState(false);

  useEffect(() => {
    if (visible && currentOrganization) {
      loadEmailSettings();
      loadChannelPreference();
    }
  }, [visible, currentOrganization]);

  const loadEmailSettings = async () => {
    if (!currentOrganization) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tenant_email_settings')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        data.sending_domain = data.sending_domain?.toLowerCase();
        data.custom_from_email = data.custom_from_email?.toLowerCase();
      }

      setSettings(data);
    } catch (error: any) {
      console.error('Error loading email settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadChannelPreference = async () => {
    if (!currentOrganization) return;
    try {
      const { data } = await supabase
        .from('business_settings')
        .select('email_send_channel')
        .eq('organization_id', currentOrganization.id)
        .maybeSingle();
      if (data?.email_send_channel) {
        setEmailChannel(data.email_send_channel as 'native' | 'mailgun');
      }
    } catch {}
  };

  const handleChannelChange = async (channel: 'native' | 'mailgun') => {
    if (!currentOrganization) return;
    setSavingChannel(true);
    try {
      await supabase
        .from('business_settings')
        .update({ email_send_channel: channel })
        .eq('organization_id', currentOrganization.id);
      setEmailChannel(channel);
      showToast({
        message: channel === 'native'
          ? 'Email will now open your mail app'
          : 'Email will now send automatically via Mailgun',
        type: 'success',
        duration: 3000,
      });
    } catch {
      showToast({ message: 'Failed to save preference', type: 'error' });
    } finally {
      setSavingChannel(false);
    }
  };

  const handleSetupEmail = async () => {
    if (!currentOrganization) return;

    setSettingUp(true);
    try {
      const result = await fetchFunction('setup-tenant-email', {
        body: {
          organizationId: currentOrganization.id,
          customFromName: currentOrganization.name,
        },
      });

      if (result.success) {
        showToast({ message: result.message, type: 'success' });
        await loadEmailSettings();
      } else {
        showToast({ message: result.error || 'Setup failed', type: 'error' });
      }
    } catch (error: any) {
      showToast({ message: error.message || 'Setup failed', type: 'error' });
    } finally {
      setSettingUp(false);
    }
  };

  const handleAddCustomDomain = async () => {
    if (!currentOrganization || !customDomain.trim()) return;

    const normalizedDomain = customDomain.trim().toLowerCase();

    const domainRegex =
      /^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]?\.[a-z]{2,}$/;

    if (!domainRegex.test(normalizedDomain)) {
      showToast({ message: 'Please enter a valid domain', type: 'error' });
      return;
    }

    setAddingDomain(true);
    try {
      const result = await fetchFunction('manage-tenant-domain', {
        body: {
          organizationId: currentOrganization.id,
          action: 'init',
          domain: normalizedDomain,
        },
      });

      if (result.success) {
        showToast({
          message: 'Domain added. Configure DNS records below.',
          type: 'success',
        });
        setShowDomainInput(false);
        setCustomDomain('');
        await loadEmailSettings();
      } else {
        showToast({ message: result.error || 'Failed to add domain', type: 'error' });
      }
    } catch (error: any) {
      showToast({ message: error.message || 'Failed to add domain', type: 'error' });
    } finally {
      setAddingDomain(false);
    }
  };

  const handleVerifyDomain = async () => {
    if (!currentOrganization) return;

    setVerifying(true);
    try {
      const result = await fetchFunction('manage-tenant-domain', {
        body: {
          organizationId: currentOrganization.id,
          action: 'verify',
        },
      });

      if (result.success) {
        showToast({
          message: result.isActive
            ? 'Domain verified successfully!'
            : 'Verification in progress. DNS records may take time to propagate.',
          type: result.isActive ? 'success' : 'info',
          duration: 5000,
        });
        await loadEmailSettings();
      } else {
        showToast({ message: result.error || 'Verification failed', type: 'error' });
      }
    } catch (error: any) {
      showToast({ message: error.message || 'Verification failed', type: 'error' });
    } finally {
      setVerifying(false);
    }
  };

  const handleRemoveDomain = async () => {
    if (!currentOrganization) return;

    try {
      const result = await fetchFunction('manage-tenant-domain', {
        body: {
          organizationId: currentOrganization.id,
          action: 'remove',
        },
      });

      if (result.success) {
        showToast({ message: 'Custom domain removed', type: 'success' });
        await loadEmailSettings();
      } else {
        showToast({ message: result.error || 'Failed to remove domain', type: 'error' });
      }
    } catch (error: any) {
      showToast({ message: error.message || 'Failed to remove domain', type: 'error' });
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      if (Platform.OS === 'web' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      } else if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      showToast({ message: 'Copied to clipboard', type: 'success', duration: 2000 });
    } catch (err) {
      showToast({ message: 'Failed to copy', type: 'error', duration: 2000 });
    }
  };

  const dynamicStyles = getDynamicStyles(colors);

  const renderChannelSelector = () => (
    <View style={dynamicStyles.channelSelectorCard}>
      <Text style={dynamicStyles.channelSelectorTitle}>How to Send Emails</Text>
      <Text style={dynamicStyles.channelSelectorDescription}>
        Choose how invoices, estimates, and notifications are delivered to clients.
      </Text>
      <View style={dynamicStyles.channelOptions}>
        <TouchableOpacity
          style={[
            dynamicStyles.channelOption,
            emailChannel === 'native' && dynamicStyles.channelOptionSelected,
          ]}
          onPress={() => handleChannelChange('native')}
          disabled={savingChannel}
        >
          <View style={[
            dynamicStyles.channelOptionIcon,
            emailChannel === 'native' && { backgroundColor: `${colors.primary}20` },
          ]}>
            <Smartphone size={22} color={emailChannel === 'native' ? colors.primary : colors.textSecondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[
              dynamicStyles.channelOptionLabel,
              emailChannel === 'native' && { color: colors.primary, fontWeight: '600' },
            ]}>
              My Mail App
            </Text>
            <Text style={dynamicStyles.channelOptionSub}>Opens your email app, no setup required</Text>
          </View>
          {emailChannel === 'native' && <CheckCircle size={18} color={colors.primary} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            dynamicStyles.channelOption,
            emailChannel === 'mailgun' && dynamicStyles.channelOptionSelected,
          ]}
          onPress={() => handleChannelChange('mailgun')}
          disabled={savingChannel}
        >
          <View style={[
            dynamicStyles.channelOptionIcon,
            emailChannel === 'mailgun' && { backgroundColor: `${colors.primary}20` },
          ]}>
            <Zap size={22} color={emailChannel === 'mailgun' ? colors.primary : colors.textSecondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[
              dynamicStyles.channelOptionLabel,
              emailChannel === 'mailgun' && { color: colors.primary, fontWeight: '600' },
            ]}>
              Mailgun (Automatic)
            </Text>
            <Text style={dynamicStyles.channelOptionSub}>Sends automatically in the background</Text>
          </View>
          {emailChannel === 'mailgun' && <CheckCircle size={18} color={colors.primary} />}
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSetupSection = () => (
    <View style={dynamicStyles.setupSection}>
      <View style={dynamicStyles.setupIcon}>
        <Mail size={48} color={colors.primary} />
      </View>
      <Text style={dynamicStyles.setupTitle}>Set Up Email Sending</Text>
      <Text style={dynamicStyles.setupDescription}>
        Enable email sending to automatically send invoices, estimates, and notifications to your clients.
      </Text>
      <Text style={dynamicStyles.setupNote}>
        Your emails will be sent securely using your own isolated email credentials. No other organization can access your email data.
      </Text>
      <TouchableOpacity
        style={dynamicStyles.setupButton}
        onPress={handleSetupEmail}
        disabled={settingUp}
      >
        <LinearGradient
          colors={['#1B4D6E', '#245d82']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={dynamicStyles.setupButtonGradient}
        >
          {settingUp ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Settings size={20} color="#fff" />
              <Text style={dynamicStyles.setupButtonText}>Set Up Email</Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  const getActualFromEmail = () => {
    if (settings?.sending_domain && settings.sending_domain !== 'bizzypro.app') {
      return `noreply@${settings.sending_domain}`;
    }
    return 'noreply@bizzypro.app';
  };

  const renderEmailSourcePreview = () => {
    const fromEmail = getActualFromEmail();
    const fromName = settings?.custom_from_name || currentOrganization?.name || 'Your Business';
    const hasCustomDomain = settings?.sending_domain && settings.sending_domain !== 'bizzypro.app';

    return (
      <View style={dynamicStyles.emailSourceCard}>
        <View style={dynamicStyles.emailSourceHeader}>
          <Send size={18} color={colors.primary} />
          <Text style={dynamicStyles.emailSourceTitle}>Emails Will Be Sent From</Text>
        </View>

        <View style={dynamicStyles.emailSourcePreview}>
          <Text style={dynamicStyles.emailSourceFrom}>
            {fromName} &lt;{fromEmail}&gt;
          </Text>
        </View>

        <View style={dynamicStyles.emailSourceDivider} />

        <Text style={dynamicStyles.emailSourceSubtitle}>This applies to:</Text>

        <View style={dynamicStyles.emailTypeRow}>
          <View style={dynamicStyles.emailTypeIcon}>
            <FileText size={16} color={colors.primary} />
          </View>
          <Text style={dynamicStyles.emailTypeLabel}>Invoices</Text>
        </View>

        <View style={dynamicStyles.emailTypeRow}>
          <View style={dynamicStyles.emailTypeIcon}>
            <Calculator size={16} color={colors.success} />
          </View>
          <Text style={dynamicStyles.emailTypeLabel}>Estimates</Text>
        </View>

        <View style={dynamicStyles.emailTypeRow}>
          <View style={dynamicStyles.emailTypeIcon}>
            <Bell size={16} color={colors.warning || '#f59e0b'} />
          </View>
          <Text style={dynamicStyles.emailTypeLabel}>Notifications & Reminders</Text>
        </View>

        {!hasCustomDomain && (
          <View style={dynamicStyles.defaultDomainNote}>
            <AlertCircle size={14} color={colors.textSecondary} />
            <Text style={dynamicStyles.defaultDomainNoteText}>
              Using default bizzypro.app domain. Add a custom domain below to send from your own brand.
            </Text>
          </View>
        )}

        {hasCustomDomain && (
          <View style={dynamicStyles.customDomainNote}>
            <CheckCircle size={14} color="#22c55e" />
            <Text style={dynamicStyles.customDomainNoteText}>
              Using your verified domain: {settings?.sending_domain}
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderActiveSection = () => (
    <View>
      <View style={dynamicStyles.statusCard}>
        <View style={dynamicStyles.statusHeader}>
          <CheckCircle size={24} color="#22c55e" />
          <Text style={dynamicStyles.statusTitle}>Email Sending Active</Text>
        </View>
        <View style={dynamicStyles.statusDetails}>
          <View style={dynamicStyles.statusRow}>
            <Text style={dynamicStyles.statusLabel}>Domain Status:</Text>
            <View style={dynamicStyles.statusBadge}>
              <Text style={dynamicStyles.statusBadgeText}>
                {settings?.sending_domain === 'bizzypro.app' ? 'Default' : 'Custom'}
              </Text>
            </View>
          </View>
          <View style={dynamicStyles.statusRow}>
            <Text style={dynamicStyles.statusLabel}>Display Name:</Text>
            <Text style={dynamicStyles.statusValue}>{settings?.custom_from_name}</Text>
          </View>
        </View>
      </View>

      {renderEmailSourcePreview()}

      {settings?.sending_domain === 'bizzypro.app' && (
        <View style={dynamicStyles.customDomainSection}>
          <View style={dynamicStyles.customDomainHeader}>
            <Globe size={20} color={colors.primary} />
            <Text style={dynamicStyles.customDomainTitle}>Custom Domain (Optional)</Text>
          </View>
          <Text style={dynamicStyles.customDomainDescription}>
            Add your own domain (e.g., mail.yourcompany.com) to send emails from your brand.
          </Text>

          {showDomainInput ? (
            <View style={dynamicStyles.domainInputContainer}>
              <TextInput
                style={dynamicStyles.domainInput}
                placeholder="mail.yourcompany.com"
                placeholderTextColor={colors.textSecondary}
                value={customDomain}
                onChangeText={setCustomDomain}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={dynamicStyles.domainInputButtons}>
                <TouchableOpacity
                  style={dynamicStyles.cancelButton}
                  onPress={() => {
                    setShowDomainInput(false);
                    setCustomDomain('');
                  }}
                >
                  <Text style={dynamicStyles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={dynamicStyles.addButton}
                  onPress={handleAddCustomDomain}
                  disabled={addingDomain}
                >
                  <LinearGradient
                    colors={['#1B4D6E', '#245d82']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={dynamicStyles.addButtonGradient}
                  >
                    {addingDomain ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={dynamicStyles.addButtonText}>Add Domain</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={dynamicStyles.addDomainButton}
              onPress={() => setShowDomainInput(true)}
            >
              <Globe size={18} color={colors.primary} />
              <Text style={dynamicStyles.addDomainButtonText}>Add Custom Domain</Text>
              <ChevronRight size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );

  const renderPendingSection = () => (
    <View>
      <View style={[dynamicStyles.statusCard, dynamicStyles.pendingCard]}>
        <View style={dynamicStyles.statusHeader}>
          <AlertCircle size={24} color="#f59e0b" />
          <Text style={dynamicStyles.statusTitle}>Domain Verification Pending</Text>
        </View>
        <Text style={dynamicStyles.pendingDescription}>
          Add the following DNS records to your domain to complete verification. DNS changes may take up to 48 hours to propagate.
        </Text>
      </View>

      {settings?.domain_records && settings.domain_records.length > 0 && (
        <View style={dynamicStyles.dnsSection}>
          <Text style={dynamicStyles.dnsSectionTitle}>Required DNS Records</Text>
          {settings.domain_records.map((record, index) => (
            <View key={index} style={dynamicStyles.dnsRecord}>
              <View style={dynamicStyles.dnsRecordHeader}>
                <Text style={dynamicStyles.dnsRecordType}>{record.type}</Text>
                {record.status && (
                  <View style={[
                    dynamicStyles.dnsStatusBadge,
                    record.status === 'verified' && dynamicStyles.dnsStatusVerified
                  ]}>
                    <Text style={[
                      dynamicStyles.dnsStatusText,
                      record.status === 'verified' && dynamicStyles.dnsStatusTextVerified
                    ]}>
                      {record.status}
                    </Text>
                  </View>
                )}
              </View>
              <View style={dynamicStyles.dnsRecordRow}>
                <Text style={dynamicStyles.dnsLabel}>Name:</Text>
                <TouchableOpacity
                  style={dynamicStyles.dnsValueContainer}
                  onPress={() => copyToClipboard(record.name)}
                >
                  <Text style={dynamicStyles.dnsValue} numberOfLines={1}>
                    {record.name}
                  </Text>
                  <Copy size={14} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <View style={dynamicStyles.dnsRecordRow}>
                <Text style={dynamicStyles.dnsLabel}>Value:</Text>
                <TouchableOpacity
                  style={dynamicStyles.dnsValueContainer}
                  onPress={() => copyToClipboard(record.value)}
                >
                  <Text style={dynamicStyles.dnsValue} numberOfLines={2}>
                    {record.value}
                  </Text>
                  <Copy size={14} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              {record.priority !== undefined && (
                <View style={dynamicStyles.dnsRecordRow}>
                  <Text style={dynamicStyles.dnsLabel}>Priority:</Text>
                  <Text style={dynamicStyles.dnsValue}>{record.priority}</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      <View style={dynamicStyles.verifyActions}>
        <TouchableOpacity
          style={dynamicStyles.verifyButton}
          onPress={handleVerifyDomain}
          disabled={verifying}
        >
          <LinearGradient
            colors={['#1B4D6E', '#245d82']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={dynamicStyles.verifyButtonGradient}
          >
            {verifying ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <RefreshCw size={18} color="#fff" />
                <Text style={dynamicStyles.verifyButtonText}>Check Verification</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity
          style={dynamicStyles.removeButton}
          onPress={handleRemoveDomain}
        >
          <Text style={dynamicStyles.removeButtonText}>Remove Domain</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={dynamicStyles.overlay}>
        <View style={dynamicStyles.modal}>
          <View style={dynamicStyles.header}>
            <View style={dynamicStyles.headerTitle}>
              <Mail size={22} color={colors.primary} />
              <Text style={dynamicStyles.title}>Email Settings</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={dynamicStyles.content} showsVerticalScrollIndicator={false}>
            {renderChannelSelector()}

            {emailChannel === 'mailgun' && (
              <>
                {loading ? (
                  <View style={dynamicStyles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={dynamicStyles.loadingText}>Loading email settings...</Text>
                  </View>
                ) : !settings ? (
                  renderSetupSection()
                ) : settings.is_active ? (
                  renderActiveSection()
                ) : (
                  renderPendingSection()
                )}
              </>
            )}

            {emailChannel === 'native' && (
              <View style={dynamicStyles.nativeInfoCard}>
                <Mail size={20} color={colors.textSecondary} />
                <Text style={dynamicStyles.nativeInfoText}>
                  When you tap Send on an invoice or estimate, your email app will open with the PDF already attached and the message pre-filled. You send it from your own account.
                </Text>
              </View>
            )}

            <View style={dynamicStyles.securityNote}>
              <Shield size={16} color={colors.textSecondary} />
              <Text style={dynamicStyles.securityNoteText}>
                Your email API credentials are encrypted and stored securely. They are never visible to other users or organizations.
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const getDynamicStyles = (colors: any) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modal: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '90%',
      minHeight: '60%',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    title: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
    },
    content: {
      padding: 20,
    },
    loadingContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40,
    },
    loadingText: {
      marginTop: 12,
      color: colors.textSecondary,
      fontSize: 14,
    },
    setupSection: {
      alignItems: 'center',
      padding: 20,
    },
    setupIcon: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: colors.primaryLight || `${colors.primary}15`,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    setupTitle: {
      fontSize: 22,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    setupDescription: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 16,
    },
    setupNote: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 24,
      paddingHorizontal: 10,
    },
    setupButton: {
      borderRadius: 12,
      overflow: 'hidden' as const,
    },
    setupButtonGradient: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      paddingVertical: 14,
      paddingHorizontal: 32,
      gap: 8,
    },
    setupButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    statusCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: '#22c55e30',
    },
    pendingCard: {
      borderColor: '#f59e0b30',
    },
    statusHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 16,
    },
    statusTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
    },
    statusDetails: {
      gap: 8,
    },
    statusRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    statusLabel: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    statusValue: {
      fontSize: 14,
      color: colors.text,
      fontWeight: '500',
    },
    pendingDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    customDomainSection: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
    },
    customDomainHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    customDomainTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    customDomainDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
      marginBottom: 16,
    },
    addDomainButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 12,
      backgroundColor: colors.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    addDomainButtonText: {
      flex: 1,
      fontSize: 14,
      color: colors.primary,
      fontWeight: '500',
    },
    domainInputContainer: {
      gap: 12,
    },
    domainInput: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 15,
      color: colors.text,
    },
    domainInputButtons: {
      flexDirection: 'row',
      gap: 12,
    },
    cancelButton: {
      flex: 1,
      padding: 12,
      borderRadius: 8,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    cancelButtonText: {
      color: colors.textSecondary,
      fontWeight: '500',
    },
    addButton: {
      flex: 1,
      borderRadius: 8,
      overflow: 'hidden' as const,
    },
    addButtonGradient: {
      padding: 12,
      alignItems: 'center' as const,
    },
    addButtonText: {
      color: '#fff',
      fontWeight: '600',
    },
    dnsSection: {
      marginBottom: 20,
    },
    dnsSectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    dnsRecord: {
      backgroundColor: colors.card,
      borderRadius: 8,
      padding: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    dnsRecordHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    dnsRecordType: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
      backgroundColor: `${colors.primary}15`,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
    },
    dnsStatusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: '#f59e0b20',
    },
    dnsStatusVerified: {
      backgroundColor: '#22c55e20',
    },
    dnsStatusText: {
      fontSize: 12,
      fontWeight: '500',
      color: '#f59e0b',
    },
    dnsStatusTextVerified: {
      color: '#22c55e',
    },
    dnsRecordRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 6,
    },
    dnsLabel: {
      fontSize: 13,
      color: colors.textSecondary,
      width: 60,
    },
    dnsValueContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    dnsValue: {
      flex: 1,
      fontSize: 13,
      color: colors.text,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    verifyActions: {
      gap: 12,
      marginBottom: 20,
    },
    verifyButton: {
      borderRadius: 10,
      overflow: 'hidden' as const,
    },
    verifyButtonGradient: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      padding: 14,
      gap: 8,
    },
    verifyButtonText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '600',
    },
    removeButton: {
      alignItems: 'center',
      padding: 12,
    },
    removeButtonText: {
      color: '#ef4444',
      fontSize: 14,
      fontWeight: '500',
    },
    securityNote: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      padding: 16,
      backgroundColor: colors.card,
      borderRadius: 8,
      marginTop: 10,
      marginBottom: 30,
    },
    securityNoteText: {
      flex: 1,
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    emailSourceCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    emailSourceHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
    },
    emailSourceTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    emailSourcePreview: {
      backgroundColor: colors.surface,
      borderRadius: 8,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    emailSourceFrom: {
      fontSize: 14,
      color: colors.primary,
      fontWeight: '500',
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    emailSourceDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 12,
    },
    emailSourceSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 10,
    },
    emailTypeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 6,
    },
    emailTypeIcon: {
      width: 28,
      height: 28,
      borderRadius: 6,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emailTypeLabel: {
      fontSize: 14,
      color: colors.text,
    },
    defaultDomainNote: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      marginTop: 12,
      padding: 10,
      backgroundColor: `${colors.warning || '#f59e0b'}10`,
      borderRadius: 8,
    },
    defaultDomainNoteText: {
      flex: 1,
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 17,
    },
    customDomainNote: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 12,
      padding: 10,
      backgroundColor: '#22c55e10',
      borderRadius: 8,
    },
    customDomainNoteText: {
      flex: 1,
      fontSize: 12,
      color: '#22c55e',
      fontWeight: '500',
    },
    statusBadge: {
      backgroundColor: `${colors.primary}15`,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    statusBadgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary,
    },
    channelSelectorCard: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 16,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    channelSelectorTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    channelSelectorDescription: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
      marginBottom: 14,
    },
    channelOptions: {
      gap: 10,
    },
    channelOption: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      padding: 14,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      gap: 12,
    },
    channelOptionSelected: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}08`,
    },
    channelOptionIcon: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: `${colors.textSecondary}15`,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    channelOptionLabel: {
      fontSize: 14,
      color: colors.text,
      marginBottom: 2,
    },
    channelOptionSub: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    nativeInfoCard: {
      flexDirection: 'row' as const,
      alignItems: 'flex-start' as const,
      gap: 10,
      padding: 14,
      backgroundColor: colors.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 20,
    },
    nativeInfoText: {
      flex: 1,
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 19,
    },
  });
