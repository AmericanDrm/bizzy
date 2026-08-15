import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { X, Clock, MapPin, User, MessageSquare, CalendarClock } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { supabase, invokeFunction } from '../lib/supabase';
import { useOrganization } from '../contexts/OrganizationContext';
import { useToast } from '../contexts/ToastContext';

interface ClockInEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  client_id: string | null;
  client_name: string | null;
  client_phone: string | null;
  address: string | null;
}

interface ClockInInfoSheetProps {
  visible: boolean;
  firstEvent: ClockInEvent | null;
  allEvents: ClockInEvent[];
  onClose: () => void;
}

export default function ClockInInfoSheet({ visible, firstEvent, allEvents, onClose }: ClockInInfoSheetProps) {
  const { colors, isDark } = useTheme();
  const { currentOrganization } = useOrganization();
  const { showToast } = useToast();

  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (visible) {
      setSent(false);
      setSending(false);
      if (firstEvent?.client_phone) {
        autoSendToFirstClient();
      }
    }
  }, [visible]);

  const autoSendToFirstClient = async () => {
    if (!firstEvent?.client_phone || !currentOrganization?.id) return;
    setSending(true);
    try {
      const startTime = new Date(firstEvent.start_time);
      const timeStr = startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      const message = `Hi ${firstEvent.client_name || 'there'}! Just letting you know I'm on my way for your ${timeStr} appointment. See you soon!`;

      const { data: settingsData } = await supabase
        .from('business_settings')
        .select('sms_send_channel')
        .eq('organization_id', currentOrganization.id)
        .maybeSingle();

      const channel = (settingsData?.sms_send_channel as 'native' | 'twilio') || 'native';

      if (channel === 'twilio') {
        const { error } = await invokeFunction('send-sms', {
          to: firstEvent.client_phone,
          body: message,
          organizationId: currentOrganization.id,
        });
        if (error) throw new Error(error.message);
      } else {
        const phoneNumber = firstEvent.client_phone.replace(/\D/g, '');
        const smsUrl = Platform.OS === 'ios'
          ? `sms:${phoneNumber}&body=${encodeURIComponent(message)}`
          : `sms:${phoneNumber}?body=${encodeURIComponent(message)}`;
        const { Linking } = require('react-native');
        await Linking.openURL(smsUrl);
      }

      setSent(true);
    } catch (err: any) {
      console.error('Auto-send failed:', err);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (isoStr: string) => {
    try {
      return new Date(isoStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const styles = getStyles(colors, isDark);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Clock size={22} color={colors.primary} />
            <Text style={styles.headerTitle}>Clocked In</Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {firstEvent && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>FIRST JOB</Text>
              <View style={styles.card}>
                <View style={styles.cardRow}>
                  <CalendarClock size={16} color={colors.primary} />
                  <Text style={styles.cardTitle}>{firstEvent.title}</Text>
                </View>

                {firstEvent.start_time && (
                  <View style={styles.cardDetail}>
                    <Clock size={13} color={colors.textSecondary} />
                    <Text style={styles.cardDetailText}>
                      {formatTime(firstEvent.start_time)}
                      {firstEvent.end_time ? ` – ${formatTime(firstEvent.end_time)}` : ''}
                    </Text>
                  </View>
                )}

                {firstEvent.client_name && (
                  <View style={styles.cardDetail}>
                    <User size={13} color={colors.textSecondary} />
                    <Text style={styles.cardDetailText}>{firstEvent.client_name}</Text>
                  </View>
                )}

                {firstEvent.address && (
                  <View style={styles.cardDetail}>
                    <MapPin size={13} color={colors.textSecondary} />
                    <Text style={styles.cardDetailText}>{firstEvent.address}</Text>
                  </View>
                )}

                {firstEvent.client_phone && (
                  <View style={styles.notificationRow}>
                    <MessageSquare size={14} color={sent ? colors.success : colors.textSecondary} />
                    {sending ? (
                      <View style={styles.sendingRow}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={styles.sendingText}>Sending "On My Way" to {firstEvent.client_name || 'client'}...</Text>
                      </View>
                    ) : sent ? (
                      <Text style={[styles.notificationText, { color: colors.success }]}>
                        "On My Way" sent to {firstEvent.client_name || 'client'}
                      </Text>
                    ) : (
                      <Text style={styles.notificationText}>No phone on file for auto-notify</Text>
                    )}
                  </View>
                )}
              </View>
            </View>
          )}

          {allEvents.length > 1 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>TODAY'S SCHEDULE</Text>
              {allEvents.map((event, index) => (
                <View key={event.id} style={[styles.scheduleRow, index < allEvents.length - 1 && styles.scheduleRowBorder]}>
                  <View style={[styles.scheduleDot, { backgroundColor: index === 0 ? colors.primary : colors.textTertiary }]} />
                  <View style={styles.scheduleContent}>
                    <Text style={styles.scheduleTime}>{formatTime(event.start_time)}</Text>
                    <Text style={styles.scheduleTitle} numberOfLines={1}>{event.title}</Text>
                    {event.client_name && (
                      <Text style={styles.scheduleClient} numberOfLines={1}>{event.client_name}</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}

          {!firstEvent && (
            <View style={styles.emptyState}>
              <Clock size={40} color={colors.textTertiary} />
              <Text style={styles.emptyTitle}>You're clocked in</Text>
              <Text style={styles.emptySubtitle}>No jobs scheduled for today.</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.doneButton} onPress={onClose}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const getStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: Platform.OS === 'ios' ? 16 : 20,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6',
      alignItems: 'center',
      justifyContent: 'center',
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
      gap: 20,
    },
    section: {
      gap: 8,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textTertiary,
      letterSpacing: 0.8,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 8,
    },
    cardRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      flex: 1,
    },
    cardDetail: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 7,
    },
    cardDetailText: {
      fontSize: 14,
      color: colors.textSecondary,
      flex: 1,
      lineHeight: 20,
    },
    notificationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      marginTop: 4,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    sendingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    sendingText: {
      fontSize: 13,
      color: colors.primary,
      fontStyle: 'italic',
    },
    notificationText: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    scheduleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      paddingVertical: 10,
      backgroundColor: colors.surface,
      paddingHorizontal: 14,
    },
    scheduleRowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    scheduleDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginTop: 5,
    },
    scheduleContent: {
      flex: 1,
      gap: 2,
    },
    scheduleTime: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    scheduleTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    scheduleClient: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: 48,
      gap: 10,
    },
    emptyTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
    },
    emptySubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    footer: {
      padding: 16,
      paddingBottom: Platform.OS === 'ios' ? 32 : 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
    },
    doneButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
    },
    doneButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#fff',
    },
  });
