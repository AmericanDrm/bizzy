import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import {
  Phone,
  CalendarPlus,
  FileText,
  Receipt,
  X,
  MapPin,
  UserPlus,
  PhoneCall,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { formatPhoneNumber } from '@/lib/utilities';
import { PostCallAction } from '@/lib/callerIdService';

interface PostCallActionCardProps {
  visible: boolean;
  callAction: PostCallAction | null;
  onSchedule: () => void;
  onEstimate: () => void;
  onInvoice: () => void;
  onCreateClient: () => void;
  onDismiss: () => void;
}

export default function PostCallActionCard({
  visible,
  callAction,
  onSchedule,
  onEstimate,
  onInvoice,
  onCreateClient,
  onDismiss,
}: PostCallActionCardProps) {
  const { colors, isDark } = useTheme();
  const slideAnim = useRef(new Animated.Value(300)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 300,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  useEffect(() => {
    if (callAction?.isActiveCall) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [callAction?.isActiveCall]);

  if (!callAction) return null;

  const isKnownClient = !!callAction.clientId;
  const isActive = callAction.isActiveCall;

  const timeSinceCall = (): string => {
    const ms = Date.now() - new Date(callAction.callTimestamp).getTime();
    const minutes = Math.floor(ms / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes === 1) return '1 min ago';
    return `${minutes} min ago`;
  };

  const isCommercial = callAction.clientType === 'commercial';

  const badgeBgColor = isActive ? '#ef4444' + '20' : colors.success + '15';
  const badgeTextColor = isActive ? '#ef4444' : colors.success;

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    card: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingTop: 12,
      paddingHorizontal: 20,
      paddingBottom: Platform.OS === 'ios' ? 40 : 24,
      ...Platform.select({
        web: { boxShadow: '0 -4px 20px rgba(0,0,0,0.15)' } as any,
        default: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.15,
          shadowRadius: 20,
          elevation: 20,
        },
      }),
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: 'center',
      marginBottom: 16,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    callBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: badgeBgColor,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
    },
    callBadgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: badgeTextColor,
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.inputBackground,
      justifyContent: 'center',
      alignItems: 'center',
    },
    clientSection: {
      backgroundColor: colors.inputBackground,
      borderRadius: 16,
      padding: 16,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: isActive ? '#ef4444' + '30' : colors.border,
    },
    clientName: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    unknownCallerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 2,
    },
    unknownCallerSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 12,
    },
    clientType: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 12,
    },
    clientTypeBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: isCommercial ? '#0369a115' : colors.primary + '15',
    },
    clientTypeBadgeText: {
      fontSize: 11,
      fontWeight: '600',
      color: isCommercial ? '#0369a1' : colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 6,
    },
    detailText: {
      fontSize: 14,
      color: colors.textSecondary,
      flex: 1,
    },
    actionsTitle: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 12,
    },
    actionsGrid: {
      gap: 10,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: 14,
      overflow: 'hidden',
    },
    actionButtonInner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 14,
      paddingHorizontal: 16,
      flex: 1,
    },
    actionIconContainer: {
      width: 40,
      height: 40,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    actionTextContainer: {
      flex: 1,
    },
    actionTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: '#fff',
    },
    actionSubtitle: {
      fontSize: 12,
      color: 'rgba(255,255,255,0.8)',
      marginTop: 1,
    },
    secondaryAction: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    secondaryActionIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.inputBackground,
      justifyContent: 'center',
      alignItems: 'center',
    },
    secondaryActionTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    secondaryActionSubtitle: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 1,
    },
    dismissText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 16,
    },
    activeDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#ef4444',
    },
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onDismiss}
    >
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={onDismiss}
        />
        <Animated.View
          style={[styles.card, { transform: [{ translateY: slideAnim }] }]}
        >
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.callBadge}>
                {isActive ? (
                  <Animated.View style={[styles.activeDot, { transform: [{ scale: pulseAnim }] }]} />
                ) : (
                  <Phone size={14} color={badgeTextColor} />
                )}
                <Text style={styles.callBadgeText}>
                  {isActive ? 'Call in progress' : `Call ended ${timeSinceCall()}`}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onDismiss}>
              <X size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.clientSection}>
            {isKnownClient ? (
              <>
                <Text style={styles.clientName}>{callAction.clientName}</Text>
                <View style={styles.clientType}>
                  <View style={styles.clientTypeBadge}>
                    <Text style={styles.clientTypeBadgeText}>
                      {isCommercial ? 'Commercial' : 'Residential'}
                    </Text>
                  </View>
                </View>
                {callAction.phone ? (
                  <View style={styles.detailRow}>
                    <Phone size={14} color={colors.textSecondary} />
                    <Text style={styles.detailText}>
                      {formatPhoneNumber(callAction.phone)}
                    </Text>
                  </View>
                ) : null}
                {callAction.address ? (
                  <View style={styles.detailRow}>
                    <MapPin size={14} color={colors.textSecondary} />
                    <Text style={styles.detailText} numberOfLines={2}>
                      {callAction.address}
                    </Text>
                  </View>
                ) : null}
              </>
            ) : (
              <>
                <Text style={styles.unknownCallerTitle}>Unknown Number</Text>
                <Text style={styles.unknownCallerSubtitle}>
                  This number is not in your client list
                </Text>
                <View style={styles.detailRow}>
                  <Phone size={14} color={colors.textSecondary} />
                  <Text style={styles.detailText}>
                    {formatPhoneNumber(callAction.phone)}
                  </Text>
                </View>
              </>
            )}
          </View>

          <Text style={styles.actionsTitle}>Quick Actions</Text>

          <View style={styles.actionsGrid}>
            {isKnownClient ? (
              <>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={onSchedule}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={isDark ? ['#1B4D6E', '#2a6d96'] : ['#1B4D6E', '#245f85']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.actionButtonInner, { borderRadius: 14 }]}
                  >
                    <View style={[styles.actionIconContainer, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                      <CalendarPlus size={20} color="#fff" />
                    </View>
                    <View style={styles.actionTextContainer}>
                      <Text style={styles.actionTitle}>Schedule Job</Text>
                      <Text style={styles.actionSubtitle}>
                        Auto-filled with client details
                      </Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryAction}
                  onPress={onEstimate}
                  activeOpacity={0.7}
                >
                  <View style={styles.secondaryActionIcon}>
                    <FileText size={20} color={colors.primary} />
                  </View>
                  <View style={styles.actionTextContainer}>
                    <Text style={styles.secondaryActionTitle}>Create Estimate</Text>
                    <Text style={styles.secondaryActionSubtitle}>
                      Send a quote to {callAction.clientName.split(' ')[0]}
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryAction}
                  onPress={onInvoice}
                  activeOpacity={0.7}
                >
                  <View style={styles.secondaryActionIcon}>
                    <Receipt size={20} color={colors.primary} />
                  </View>
                  <View style={styles.actionTextContainer}>
                    <Text style={styles.secondaryActionTitle}>Create Invoice</Text>
                    <Text style={styles.secondaryActionSubtitle}>
                      Bill for a recent service
                    </Text>
                  </View>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={onCreateClient}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={isDark ? ['#1B4D6E', '#2a6d96'] : ['#1B4D6E', '#245f85']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.actionButtonInner, { borderRadius: 14 }]}
                  >
                    <View style={[styles.actionIconContainer, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                      <UserPlus size={20} color="#fff" />
                    </View>
                    <View style={styles.actionTextContainer}>
                      <Text style={styles.actionTitle}>Add as New Client</Text>
                      <Text style={styles.actionSubtitle}>
                        Phone number will be pre-filled
                      </Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryAction}
                  onPress={onSchedule}
                  activeOpacity={0.7}
                >
                  <View style={styles.secondaryActionIcon}>
                    <CalendarPlus size={20} color={colors.primary} />
                  </View>
                  <View style={styles.actionTextContainer}>
                    <Text style={styles.secondaryActionTitle}>Schedule Job</Text>
                    <Text style={styles.secondaryActionSubtitle}>
                      Create a job without a client record
                    </Text>
                  </View>
                </TouchableOpacity>
              </>
            )}
          </View>

          <TouchableOpacity onPress={onDismiss}>
            <Text style={styles.dismissText}>Dismiss</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
