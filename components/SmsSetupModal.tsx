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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Phone, CircleCheck as CheckCircle, MessageSquare, Sparkles, Send, Users, RefreshCw, TriangleAlert as AlertTriangle, Smartphone, Zap } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useToast } from '@/contexts/ToastContext';
import { supabase, fetchFunction } from '@/lib/supabase';

interface SmsSettings {
  twilio_phone_number: string | null;
  is_active: boolean;
}

interface SmsSetupModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function SmsSetupModal({ visible, onClose }: SmsSetupModalProps) {
  const { colors } = useTheme();
  const { currentOrganization } = useOrganization();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<SmsSettings | null>(null);
  const [provisioning, setProvisioning] = useState(false);
  const [twilioConfigured, setTwilioConfigured] = useState<boolean | null>(null);
  const [testSending, setTestSending] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [numberError, setNumberError] = useState<string | null>(null);
  const [smsChannel, setSmsChannel] = useState<'native' | 'twilio'>('native');
  const [savingChannel, setSavingChannel] = useState(false);

  useEffect(() => {
    if (visible && currentOrganization) {
      fetchSmsSettings();
      checkTwilioConfig();
      loadChannelPreference();
    }
  }, [visible, currentOrganization]);

  const loadChannelPreference = async () => {
    if (!currentOrganization) return;
    try {
      const { data } = await supabase
        .from('business_settings')
        .select('sms_send_channel')
        .eq('organization_id', currentOrganization.id)
        .maybeSingle();
      if (data?.sms_send_channel) {
        setSmsChannel(data.sms_send_channel as 'native' | 'twilio');
      }
    } catch {}
  };

  const handleChannelChange = async (channel: 'native' | 'twilio') => {
    if (!currentOrganization) return;
    setSavingChannel(true);
    try {
      await supabase
        .from('business_settings')
        .update({ sms_send_channel: channel })
        .eq('organization_id', currentOrganization.id);
      setSmsChannel(channel);
      showToast({
        message: channel === 'native'
          ? 'SMS will now open your messaging app'
          : 'SMS will now send automatically via Twilio',
        type: 'success',
        duration: 3000,
      });
    } catch {
      showToast({ message: 'Failed to save preference', type: 'error' });
    } finally {
      setSavingChannel(false);
    }
  };

  const checkTwilioConfig = async () => {
    if (!currentOrganization) return;
    try {
      const data = await fetchFunction(
        `get-sms-settings?organization_id=${currentOrganization.id}`,
        { method: 'GET' }
      );
      setTwilioConfigured(data.twilio_configured !== false);
      if (data.settings) setSettings(data.settings);
    } catch {
      setTwilioConfigured(false);
    }
  };

  const fetchSmsSettings = async () => {
    if (!currentOrganization) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tenant_sms_settings')
        .select('twilio_phone_number, is_active')
        .eq('organization_id', currentOrganization.id)
        .maybeSingle();

      if (error) throw error;
      setSettings(data);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const handleProvisionNumber = async (replaceExisting = false) => {
    if (!currentOrganization) return;
    setProvisioning(true);
    try {
      const data = await fetchFunction('provision-sms-number', {
        body: {
          organization_id: currentOrganization.id,
          country: 'US',
          replace_existing: replaceExisting,
        },
      });

      if (data.error) {
        throw new Error(data.error);
      }

      setNumberError(null);
      showToast({ message: 'New phone number provisioned!', type: 'success' });
      await fetchSmsSettings();
    } catch (error: any) {
      showToast({ message: error.message || 'Failed to provision number.', type: 'error' });
    } finally {
      setProvisioning(false);
    }
  };

  const handleSendTest = async () => {
    if (!currentOrganization) return;

    const cleaned = testPhone.replace(/\D/g, '');
    if (cleaned.length < 10) {
      showToast({ message: 'Enter a valid phone number to send a test.', type: 'error' });
      return;
    }

    setTestSending(true);
    try {
      const result = await fetchFunction('send-sms', {
        body: {
          organization_id: currentOrganization.id,
          to: testPhone,
          body: `Test from ${currentOrganization.name || 'your business'}! Your SMS notifications are working.`,
        },
      });

      if (result.error) {
        if (result.code === 21659 || result.code === 30032) {
          setNumberError(result.error);
        }
        throw new Error(result.error);
      }

      setNumberError(null);
      showToast({ message: `Test SMS sent to ${testPhone}!`, type: 'success' });
      setTestPhone('');
    } catch (error: any) {
      showToast({ message: error.message || 'Failed to send test SMS.', type: 'error', duration: 5000 });
    } finally {
      setTestSending(false);
    }
  };

  const dynamicStyles = getDynamicStyles(colors);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={dynamicStyles.overlay}>
        <View style={dynamicStyles.modal}>
          <View style={dynamicStyles.header}>
            <Text style={dynamicStyles.title}>SMS Notifications</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={dynamicStyles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={dynamicStyles.loadingText}>Loading SMS settings...</Text>
            </View>
          ) : (
            <ScrollView style={dynamicStyles.content} showsVerticalScrollIndicator={false}>
              <View style={dynamicStyles.channelSelectorCard}>
                <Text style={dynamicStyles.channelSelectorTitle}>How to Send SMS</Text>
                <Text style={dynamicStyles.channelSelectorDescription}>
                  Choose how messages are sent to clients.
                </Text>
                <View style={dynamicStyles.channelOptions}>
                  <TouchableOpacity
                    style={[
                      dynamicStyles.channelOption,
                      smsChannel === 'native' && dynamicStyles.channelOptionSelected,
                    ]}
                    onPress={() => handleChannelChange('native')}
                    disabled={savingChannel}
                  >
                    <View style={[
                      dynamicStyles.channelOptionIcon,
                      smsChannel === 'native' && { backgroundColor: `${colors.primary}20` },
                    ]}>
                      <Smartphone size={22} color={smsChannel === 'native' ? colors.primary : colors.textSecondary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[
                        dynamicStyles.channelOptionLabel,
                        smsChannel === 'native' && { color: colors.primary, fontWeight: '600' },
                      ]}>
                        My SMS App
                      </Text>
                      <Text style={dynamicStyles.channelOptionSub}>Opens your messaging app, no setup required</Text>
                    </View>
                    {smsChannel === 'native' && <CheckCircle size={18} color={colors.primary} />}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      dynamicStyles.channelOption,
                      smsChannel === 'twilio' && dynamicStyles.channelOptionSelected,
                    ]}
                    onPress={() => handleChannelChange('twilio')}
                    disabled={savingChannel}
                  >
                    <View style={[
                      dynamicStyles.channelOptionIcon,
                      smsChannel === 'twilio' && { backgroundColor: `${colors.primary}20` },
                    ]}>
                      <Zap size={22} color={smsChannel === 'twilio' ? colors.primary : colors.textSecondary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[
                        dynamicStyles.channelOptionLabel,
                        smsChannel === 'twilio' && { color: colors.primary, fontWeight: '600' },
                      ]}>
                        Twilio (Automatic)
                      </Text>
                      <Text style={dynamicStyles.channelOptionSub}>Sends automatically from a dedicated number</Text>
                    </View>
                    {smsChannel === 'twilio' && <CheckCircle size={18} color={colors.primary} />}
                  </TouchableOpacity>
                </View>
              </View>

              {smsChannel === 'native' && (
                <View style={dynamicStyles.nativeInfoCard}>
                  <MessageSquare size={20} color={colors.textSecondary} />
                  <Text style={dynamicStyles.nativeInfoText}>
                    When you send a message, your SMS app will open with the message pre-filled. You send it from your own number.
                  </Text>
                </View>
              )}

              {smsChannel === 'twilio' && twilioConfigured === false && (
                <View style={dynamicStyles.comingSoonBanner}>
                  <View style={dynamicStyles.comingSoonIconContainer}>
                    <Sparkles size={24} color="#f59e0b" />
                  </View>
                  <View style={dynamicStyles.comingSoonContent}>
                    <Text style={dynamicStyles.comingSoonTitle}>Coming Soon</Text>
                    <Text style={dynamicStyles.comingSoonText}>
                      SMS messaging requires additional configuration. This feature will be available once your account is upgraded.
                    </Text>
                  </View>
                </View>
              )}

              {smsChannel === 'twilio' && twilioConfigured !== false && (
                <>
                  <View style={dynamicStyles.section}>
                    <Text style={dynamicStyles.sectionTitle}>Your SMS Number</Text>

                    {settings?.twilio_phone_number ? (
                      <View>
                        <View style={dynamicStyles.statusCard}>
                          <View style={[dynamicStyles.statusIconContainer, { backgroundColor: numberError ? '#fee2e2' : '#dcfce7' }]}>
                            <Phone size={24} color={numberError ? '#dc2626' : '#16a34a'} />
                          </View>
                          <View style={dynamicStyles.statusInfo}>
                            <Text style={dynamicStyles.phoneNumber}>{settings.twilio_phone_number}</Text>
                            <Text style={dynamicStyles.statusText}>
                              {numberError ? 'Number is no longer active' : 'Active and ready to send'}
                            </Text>
                          </View>
                          {numberError ? (
                            <AlertTriangle size={20} color="#dc2626" />
                          ) : (
                            <CheckCircle size={20} color="#16a34a" />
                          )}
                        </View>
                        {(numberError || provisioning) && (
                          <View style={dynamicStyles.numberErrorContainer}>
                            {numberError && !provisioning && (
                              <Text style={dynamicStyles.numberErrorText}>{numberError}</Text>
                            )}
                            {provisioning && (
                              <Text style={dynamicStyles.numberErrorText}>Provisioning a new number...</Text>
                            )}
                            <TouchableOpacity
                              style={[
                                dynamicStyles.reprovisionButton,
                                provisioning && { opacity: 0.6 },
                              ]}
                              onPress={() => handleProvisionNumber(true)}
                              disabled={provisioning}
                            >
                              <LinearGradient
                                colors={['#dc2626', '#b91c1c']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={dynamicStyles.reprovisionButtonGradient}
                              >
                                {provisioning ? (
                                  <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                  <>
                                    <RefreshCw size={16} color="#fff" />
                                    <Text style={dynamicStyles.reprovisionButtonText}>Get New Number</Text>
                                  </>
                                )}
                              </LinearGradient>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    ) : (
                      <View style={dynamicStyles.statusCard}>
                        <View style={[dynamicStyles.statusIconContainer, { backgroundColor: colors.border }]}>
                          <Phone size={24} color={colors.textSecondary} />
                        </View>
                        <View style={dynamicStyles.statusInfo}>
                          <Text style={dynamicStyles.statusLabel}>No phone number yet</Text>
                          <Text style={dynamicStyles.statusText}>
                            Get a dedicated number to send SMS to clients
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={dynamicStyles.actionButton}
                          onPress={handleProvisionNumber}
                          disabled={provisioning}
                        >
                          <LinearGradient
                            colors={['#1B4D6E', '#245d82']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={dynamicStyles.actionButtonGradient}
                          >
                            {provisioning ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <Text style={dynamicStyles.actionButtonText}>Get Number</Text>
                            )}
                          </LinearGradient>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>

                  {settings?.twilio_phone_number && (
                    <>
                      <View style={dynamicStyles.section}>
                        <Text style={dynamicStyles.sectionTitle}>How It Works</Text>
                        <View style={dynamicStyles.featureList}>
                          <View style={dynamicStyles.featureItem}>
                            <View style={[dynamicStyles.featureIcon, { backgroundColor: '#dbeafe' }]}>
                              <MessageSquare size={18} color="#2563eb" />
                            </View>
                            <View style={dynamicStyles.featureContent}>
                              <Text style={dynamicStyles.featureTitle}>On My Way Notifications</Text>
                              <Text style={dynamicStyles.featureDescription}>
                                Tap a scheduled job and notify clients you are headed their way with an estimated arrival time.
                              </Text>
                            </View>
                          </View>
                          <View style={dynamicStyles.featureItem}>
                            <View style={[dynamicStyles.featureIcon, { backgroundColor: '#dcfce7' }]}>
                              <Users size={18} color="#16a34a" />
                            </View>
                            <View style={dynamicStyles.featureContent}>
                              <Text style={dynamicStyles.featureTitle}>Client Phone Numbers</Text>
                              <Text style={dynamicStyles.featureDescription}>
                                Make sure your clients have a phone number saved. Go to Clients, tap a client, and add their number.
                              </Text>
                            </View>
                          </View>
                          <View style={dynamicStyles.featureItem}>
                            <View style={[dynamicStyles.featureIcon, { backgroundColor: '#fef3c7' }]}>
                              <Send size={18} color="#d97706" />
                            </View>
                            <View style={dynamicStyles.featureContent}>
                              <Text style={dynamicStyles.featureTitle}>Quick Send from Schedule</Text>
                              <Text style={dynamicStyles.featureDescription}>
                                From the Schedule tab, tap a job to see notification options: On My Way, Running Behind, Reminder, or All Finished.
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>

                      <View style={dynamicStyles.section}>
                        <Text style={dynamicStyles.sectionTitle}>Send a Test</Text>
                        <TextInput
                          style={dynamicStyles.testInput}
                          value={testPhone}
                          onChangeText={setTestPhone}
                          placeholder="Enter your phone number"
                          placeholderTextColor={colors.textSecondary}
                          keyboardType="phone-pad"
                        />
                        <TouchableOpacity
                          style={[
                            dynamicStyles.testButton,
                            (!testPhone.replace(/\D/g, '').length) && { opacity: 0.5 },
                          ]}
                          onPress={handleSendTest}
                          disabled={testSending || !testPhone.replace(/\D/g, '').length}
                        >
                          <LinearGradient
                            colors={['#1B4D6E', '#245d82']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={dynamicStyles.testButtonGradient}
                          >
                            {testSending ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <>
                                <Send size={16} color="#fff" />
                                <Text style={dynamicStyles.testButtonText}>Send Test SMS</Text>
                              </>
                            )}
                          </LinearGradient>
                        </TouchableOpacity>
                        <Text style={dynamicStyles.testHint}>
                          Enter your number above to verify SMS is working.
                        </Text>
                      </View>
                    </>
                  )}
                </>
              )}

              <View style={{ height: 40 }} />
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const getDynamicStyles = (colors: any) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modal: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '90%',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
    },
    loadingContainer: {
      padding: 60,
      alignItems: 'center',
      gap: 16,
    },
    loadingText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    content: {
      padding: 20,
    },
    section: {
      marginBottom: 28,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 12,
    },
    statusCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      backgroundColor: colors.card,
      borderRadius: 12,
      gap: 12,
    },
    statusIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statusInfo: {
      flex: 1,
    },
    phoneNumber: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 2,
    },
    statusLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    statusText: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    actionButton: {
      borderRadius: 8,
      overflow: 'hidden',
    },
    actionButtonGradient: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionButtonText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '600',
    },
    featureList: {
      gap: 16,
    },
    featureItem: {
      flexDirection: 'row',
      gap: 12,
      alignItems: 'flex-start',
    },
    featureIcon: {
      width: 40,
      height: 40,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    featureContent: {
      flex: 1,
    },
    featureTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 3,
    },
    featureDescription: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    testInput: {
      backgroundColor: colors.card,
      borderRadius: 10,
      paddingVertical: 14,
      paddingHorizontal: 16,
      fontSize: 16,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
    },
    testButton: {
      borderRadius: 10,
      overflow: 'hidden',
    },
    testButtonGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
    },
    testButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: '#fff',
    },
    testHint: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 8,
    },
    numberErrorContainer: {
      marginTop: 12,
      padding: 14,
      backgroundColor: '#fef2f2',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: '#fecaca',
      gap: 12,
    },
    numberErrorText: {
      fontSize: 13,
      color: '#991b1b',
      lineHeight: 18,
    },
    reprovisionButton: {
      borderRadius: 8,
      overflow: 'hidden',
    },
    reprovisionButtonGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
    },
    reprovisionButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#fff',
    },
    comingSoonBanner: {
      flexDirection: 'row',
      padding: 16,
      backgroundColor: '#fef3c7',
      borderRadius: 12,
      gap: 12,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: '#f59e0b40',
    },
    comingSoonIconContainer: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: '#fef9c3',
      alignItems: 'center',
      justifyContent: 'center',
    },
    comingSoonContent: {
      flex: 1,
    },
    comingSoonTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: '#92400e',
      marginBottom: 4,
    },
    comingSoonText: {
      fontSize: 13,
      color: '#a16207',
      lineHeight: 18,
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
