import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { X, Navigation, Clock, MessageSquare, Send, CircleCheck as CheckCircle, TriangleAlert as AlertTriangle, Bell, ChevronRight, MapPin, CreditCard as Edit3, Smartphone } from 'lucide-react-native';
import AddressLink from '@/components/AddressLink';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useToast } from '@/contexts/ToastContext';
import { LinearGradient } from 'expo-linear-gradient';
import { LocationService } from '@/lib/locationService';
import { sendSMS } from '@/lib/utilities';

interface ScheduleEvent {
  id: string;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  location: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  client_id: string | null;
  client?: { name: string } | null;
  amount?: number;
}

interface JobNotificationPromptProps {
  visible: boolean;
  event: ScheduleEvent | null;
  userLatitude: number | null;
  userLongitude: number | null;
  onClose: () => void;
  onSkip: () => void;
}

interface NotificationOption {
  id: string;
  label: string;
  description: string;
  icon: typeof Navigation;
  color: string;
}

const AVERAGE_SPEED_KMH = 40;

function estimateTravelMinutes(distanceMeters: number): number {
  const distanceKm = distanceMeters / 1000;
  const hours = distanceKm / AVERAGE_SPEED_KMH;
  return Math.max(1, Math.round(hours * 60));
}

function formatEtaWindow(minutesAway: number): string {
  const now = new Date();
  const arrivalTime = new Date(now.getTime() + minutesAway * 60000);
  const windowEnd = new Date(arrivalTime.getTime() + 5 * 60000);

  const fmt = (d: Date) => {
    let h = d.getHours();
    const m = d.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  return `${fmt(arrivalTime)} - ${fmt(windowEnd)}`;
}

export default function JobNotificationPrompt({
  visible,
  event,
  userLatitude,
  userLongitude,
  onClose,
  onSkip,
}: JobNotificationPromptProps) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [customMessage, setCustomMessage] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [clientPhone, setClientPhone] = useState<string | null>(null);
  const [clientName, setClientName] = useState('');
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);
  const [loadingClient, setLoadingClient] = useState(false);

  const { colors } = useTheme();
  const { currentOrganization } = useOrganization();
  const { showToast } = useToast();
  const styles = getStyles(colors);

  useEffect(() => {
    if (visible && event?.client_id) {
      fetchClientInfo();
      calculateDistance();
    }
    if (!visible) {
      setSent(false);
      setSelectedOption(null);
      setCustomMessage('');
      setShowCustomInput(false);
      setClientPhone(null);
      setDistanceMeters(null);
      setEtaMinutes(null);
    }
  }, [visible, event?.client_id]);

  const fetchClientInfo = async () => {
    if (!event?.client_id) return;
    setLoadingClient(true);
    try {
      const { data } = await supabase
        .from('clients')
        .select('name, phone')
        .eq('id', event.client_id)
        .maybeSingle();
      if (data) {
        setClientPhone(data.phone || null);
        setClientName(data.name || event.client?.name || '');
      }
    } catch {
    } finally {
      setLoadingClient(false);
    }
  };

  const calculateDistance = () => {
    if (
      !userLatitude ||
      !userLongitude ||
      !event?.latitude ||
      !event?.longitude
    ) {
      setDistanceMeters(null);
      setEtaMinutes(null);
      return;
    }

    const dist = LocationService.getDistanceBetween(
      { latitude: userLatitude, longitude: userLongitude },
      { latitude: Number(event.latitude), longitude: Number(event.longitude) }
    );
    setDistanceMeters(dist);
    setEtaMinutes(estimateTravelMinutes(dist));
  };

  const buildMessage = (optionId: string): string => {
    const name = clientName || 'there';
    const jobTitle = event?.title || 'your appointment';

    switch (optionId) {
      case 'on_my_way': {
        if (etaMinutes !== null && etaMinutes > 0) {
          const window = formatEtaWindow(etaMinutes);
          return `Hi ${name}! We are on our way for ${jobTitle}. We expect to arrive between ${window}. See you soon!`;
        }
        return `Hi ${name}! We are on our way for ${jobTitle}. We will be there shortly!`;
      }
      case 'running_behind':
        return `Hi ${name}! We wanted to let you know we are running a bit behind schedule for ${jobTitle}. We will be there as soon as possible — thank you for your patience!`;
      case 'reminder':
        return `Hi ${name}! Just a friendly reminder about ${jobTitle} scheduled for today. Please let us know if you need to make any changes.`;
      case 'all_finished':
        return `Hi ${name}! We have finished up ${jobTitle} at your property. Thank you for your business — we appreciate it!`;
      case 'custom':
        return customMessage.trim();
      default:
        return '';
    }
  };

  const handleSend = async (optionId: string) => {
    if (!clientPhone) {
      showToast({ message: 'No phone number on file for this client', type: 'error', duration: 4000 });
      return;
    }
    if (!currentOrganization?.id) return;
    if (optionId === 'custom' && !customMessage.trim()) return;

    setSending(true);
    setSelectedOption(optionId);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const message = buildMessage(optionId);
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
      const response = await fetch(`${supabaseUrl}/functions/v1/send-sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          organization_id: currentOrganization.id,
          to: clientPhone,
          body: message,
          client_id: event?.client_id,
        }),
      });

      const result = await response.json();
      if (!response.ok || result.error) {
        throw new Error(result.error || 'Failed to send notification');
      }

      if (optionId === 'on_my_way' && event?.id) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          await supabase
            .from('departure_reminders')
            .upsert(
              {
                user_id: user.id,
                organization_id: currentOrganization.id,
                schedule_event_id: event.id,
                status: 'sent',
                on_my_way_sms_sent_at: new Date().toISOString(),
                on_my_way_method: 'twilio',
              },
              { onConflict: 'user_id,schedule_event_id', ignoreDuplicates: false }
            );
        }
      }

      setSent(true);
      showToast({ message: `Notification sent to ${clientName}`, type: 'success' });

      setTimeout(() => {
        onSkip();
      }, 800);
    } catch (err: any) {
      showToast({ message: err.message || 'Failed to send', type: 'error', duration: 5000 });
    } finally {
      setSending(false);
    }
  };

  const handleSendNative = async (optionId: string) => {
    if (!clientPhone) {
      showToast({ message: 'No phone number on file for this client', type: 'error', duration: 4000 });
      return;
    }
    const message = buildMessage(optionId || 'on_my_way');
    await sendSMS(clientPhone, message);

    if (event?.id && currentOrganization?.id) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        await supabase
          .from('departure_reminders')
          .upsert(
            {
              user_id: user.id,
              organization_id: currentOrganization.id,
              schedule_event_id: event.id,
              status: 'sent',
              on_my_way_sms_sent_at: new Date().toISOString(),
              on_my_way_method: 'native',
            },
            { onConflict: 'user_id,schedule_event_id', ignoreDuplicates: false }
          );
      }
    }

    showToast({ message: 'Opening your messages app...', type: 'success' });
    setTimeout(() => onSkip(), 400);
  };

  const notificationOptions: NotificationOption[] = [
    {
      id: 'on_my_way',
      label: 'On My Way',
      description: etaMinutes
        ? `ETA: ${formatEtaWindow(etaMinutes)} (${Math.round((distanceMeters || 0) / 1000 * 10) / 10} km away)`
        : 'Let them know you are headed their way',
      icon: Navigation,
      color: '#059669',
    },
    {
      id: 'running_behind',
      label: 'Running Behind',
      description: 'Let them know you will be a little late',
      icon: AlertTriangle,
      color: '#d97706',
    },
    {
      id: 'reminder',
      label: 'Appointment Reminder',
      description: 'Send a quick reminder about today\'s job',
      icon: Bell,
      color: '#2563eb',
    },
    {
      id: 'all_finished',
      label: 'All Finished',
      description: 'Let them know the job is complete',
      icon: CheckCircle,
      color: '#0d9488',
    },
  ];

  const noPhone = !loadingClient && !clientPhone;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <View style={styles.container}>
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={[styles.headerIcon, { backgroundColor: colors.primary + '20' }]}>
                  <MessageSquare size={18} color={colors.primary} />
                </View>
                <View>
                  <Text style={[styles.headerTitle, { color: colors.text }]}>Notify Client</Text>
                  <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                    {event?.client?.name || clientName || event?.title}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {loadingClient ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : (
              <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {noPhone && (
                  <View style={[styles.warningBanner, { backgroundColor: '#d97706' + '15' }]}>
                    <AlertTriangle size={16} color="#d97706" />
                    <Text style={[styles.warningText, { color: '#d97706' }]}>
                      No phone number on file for this client
                    </Text>
                  </View>
                )}

                {etaMinutes !== null && distanceMeters !== null && (
                  <View style={[styles.etaBanner, { backgroundColor: colors.primary + '10' }]}>
                    <MapPin size={16} color={colors.primary} />
                    <Text style={[styles.etaText, { color: colors.primary }]}>
                      {Math.round(distanceMeters / 1000 * 10) / 10} km away
                      {' \u2022 '}~{etaMinutes} min drive
                    </Text>
                  </View>
                )}

                {(event?.location || event?.address) && (
                  <View style={[styles.addressBanner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <MapPin size={14} color={colors.textSecondary} />
                    <AddressLink
                      address={(event.location || event.address) as string}
                      textStyle={[styles.addressLinkText, { color: colors.primary }]}
                      numberOfLines={2}
                    />
                  </View>
                )}

                {notificationOptions.map((option) => {
                  const isSelected = selectedOption === option.id;
                  const isSent = sent && isSelected;
                  const IconComponent = option.icon;

                  return (
                    <TouchableOpacity
                      key={option.id}
                      style={[
                        styles.optionCard,
                        { backgroundColor: colors.surface, borderColor: colors.border },
                        isSelected && { borderColor: option.color, backgroundColor: option.color + '08' },
                        isSent && { borderColor: '#059669', backgroundColor: '#059669' + '10' },
                      ]}
                      onPress={() => handleSend(option.id)}
                      disabled={sending || sent || noPhone}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.optionIconContainer, { backgroundColor: option.color + '15' }]}>
                        {isSent ? (
                          <CheckCircle size={20} color="#059669" />
                        ) : sending && isSelected ? (
                          <ActivityIndicator size="small" color={option.color} />
                        ) : (
                          <IconComponent size={20} color={option.color} />
                        )}
                      </View>
                      <View style={styles.optionTextContainer}>
                        <Text style={[styles.optionLabel, { color: colors.text }]}>
                          {isSent ? 'Sent!' : option.label}
                        </Text>
                        <Text style={[styles.optionDescription, { color: colors.textSecondary }]} numberOfLines={2}>
                          {option.description}
                        </Text>
                      </View>
                      {!sending && !sent && (
                        <Send size={16} color={noPhone ? colors.border : option.color} />
                      )}
                    </TouchableOpacity>
                  );
                })}

                {!showCustomInput ? (
                  <TouchableOpacity
                    style={[styles.customButton, { borderColor: colors.border }]}
                    onPress={() => setShowCustomInput(true)}
                    disabled={sending || sent || noPhone}
                  >
                    <Edit3 size={16} color={colors.textSecondary} />
                    <Text style={[styles.customButtonText, { color: colors.textSecondary }]}>
                      Write custom message
                    </Text>
                    <ChevronRight size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.customInputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <TextInput
                      style={[styles.customInput, { color: colors.text, borderColor: colors.border }]}
                      placeholder="Type your message..."
                      placeholderTextColor={colors.textSecondary}
                      value={customMessage}
                      onChangeText={setCustomMessage}
                      multiline
                      numberOfLines={3}
                      autoFocus
                    />
                    <TouchableOpacity
                      style={[
                        styles.sendCustomButton,
                        { overflow: 'hidden', backgroundColor: customMessage.trim() ? undefined : colors.border },
                      ]}
                      onPress={() => handleSend('custom')}
                      disabled={!customMessage.trim() || sending || sent}
                    >
                      {customMessage.trim() && (
                        <LinearGradient
                          colors={['#1B4D6E', '#245d82']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={StyleSheet.absoluteFill}
                        />
                      )}
                      {sending && selectedOption === 'custom' ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Send size={14} color="#fff" />
                          <Text style={styles.sendCustomText}>Send</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
            )}

            {!sent && !noPhone && Platform.OS !== 'web' && (
              <TouchableOpacity
                style={[styles.nativeButton, { borderTopColor: colors.border, borderBottomColor: colors.border }]}
                onPress={() => handleSendNative('on_my_way')}
                disabled={sending}
              >
                <Smartphone size={16} color={colors.textSecondary} />
                <Text style={[styles.nativeText, { color: colors.textSecondary }]}>
                  Send manually via your phone
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.skipButton, { borderTopColor: colors.border }]}
              onPress={onSkip}
              disabled={sending}
            >
              <Text style={[styles.skipText, { color: colors.textSecondary }]}>
                Skip & View Job
              </Text>
              <ChevronRight size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    keyboardView: {
      justifyContent: 'flex-end',
    },
    container: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '85%',
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    headerIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '700',
    },
    headerSubtitle: {
      fontSize: 13,
      marginTop: 1,
    },
    closeButton: {
      padding: 8,
    },
    loadingContainer: {
      padding: 40,
      alignItems: 'center',
    },
    content: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 8,
    },
    warningBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 12,
      borderRadius: 10,
      marginBottom: 12,
    },
    warningText: {
      fontSize: 13,
      fontWeight: '500',
      flex: 1,
    },
    etaBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 12,
      borderRadius: 10,
      marginBottom: 8,
    },
    etaText: {
      fontSize: 13,
      fontWeight: '600',
    },
    addressBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 12,
      borderRadius: 10,
      borderWidth: 1,
      marginBottom: 12,
    },
    addressLinkText: {
      fontSize: 13,
      fontWeight: '500',
      textDecorationLine: 'underline',
      flex: 1,
    },
    optionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 10,
      gap: 12,
    },
    optionIconContainer: {
      width: 40,
      height: 40,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    optionTextContainer: {
      flex: 1,
    },
    optionLabel: {
      fontSize: 15,
      fontWeight: '600',
    },
    optionDescription: {
      fontSize: 12,
      marginTop: 2,
      lineHeight: 16,
    },
    customButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderStyle: 'dashed',
      marginBottom: 10,
    },
    customButtonText: {
      flex: 1,
      fontSize: 14,
      fontWeight: '500',
    },
    customInputContainer: {
      borderRadius: 12,
      borderWidth: 1,
      padding: 12,
      marginBottom: 10,
    },
    customInput: {
      fontSize: 14,
      minHeight: 70,
      textAlignVertical: 'top',
      marginBottom: 10,
    },
    sendCustomButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 8,
      alignSelf: 'flex-end',
    },
    sendCustomText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '600',
    },
    nativeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 13,
      borderTopWidth: 1,
      borderBottomWidth: 1,
    },
    nativeText: {
      fontSize: 13,
      fontWeight: '500',
    },
    skipButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingVertical: 16,
      borderTopWidth: 1,
    },
    skipText: {
      fontSize: 15,
      fontWeight: '500',
    },
  });
