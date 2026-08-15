import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { MapPin, Clock, Coffee, ShoppingCart, CircleAlert as AlertCircle, Play, X, Timer, ChevronDown, ChevronUp, Building2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';

export interface StationaryStopData {
  latitude: number;
  longitude: number;
  stoppedSince: Date;
  stoppedMinutes: number;
  address?: string;
  nearbyClient?: {
    id: string;
    name: string;
    distance: number;
  };
  nearbyScheduledJob?: {
    id: string;
    clientName: string;
    clientId?: string;
    distance: number;
    scheduledStartTime?: string;
  };
}

interface StationaryStopPromptProps {
  visible: boolean;
  data: StationaryStopData | null;
  onDismiss: () => void;
  onStartJobTimer: (backdateMinutes: number, clientId?: string, scheduleEventId?: string) => void;
  onSetContext: (context: 'on_break' | 'getting_supplies' | 'stuck_in_traffic') => void;
  onAddAsJobSite?: () => void;
}

type ContextChoice = 'job' | 'break' | 'supplies' | 'traffic' | null;

const BACKDATE_OPTIONS = [
  { label: 'Just now', minutes: 0 },
  { label: '5 min ago', minutes: 5 },
  { label: '10 min ago', minutes: 10 },
  { label: '15 min ago', minutes: 15 },
  { label: '20 min ago', minutes: 20 },
  { label: '30 min ago', minutes: 30 },
];

export default function StationaryStopPrompt({
  visible,
  data,
  onDismiss,
  onStartJobTimer,
  onSetContext,
  onAddAsJobSite,
}: StationaryStopPromptProps) {
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [selectedContext, setSelectedContext] = useState<ContextChoice>(null);
  const [selectedBackdate, setSelectedBackdate] = useState(0);
  const [showBackdateOptions, setShowBackdateOptions] = useState(false);

  useEffect(() => {
    if (visible) {
      setSelectedContext(null);
      setLoading(false);
      if (data) {
        const suggestedBackdate = Math.min(data.stoppedMinutes, 30);
        const closest = BACKDATE_OPTIONS.reduce((best, opt) =>
          Math.abs(opt.minutes - suggestedBackdate) < Math.abs(best.minutes - suggestedBackdate) ? opt : best
        );
        setSelectedBackdate(closest.minutes);
      } else {
        setSelectedBackdate(0);
      }
      setShowBackdateOptions(false);
    }
  }, [visible, data]);

  if (!data) return null;

  const formatTime = (date: Date) =>
    date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  const backdateTime = new Date(data.stoppedSince.getTime() - selectedBackdate * 60000);

  const selectedOption = BACKDATE_OPTIONS.find(o => o.minutes === selectedBackdate) || BACKDATE_OPTIONS[0];

  const handleStartJob = async () => {
    setLoading(true);
    try {
      const clientId = data.nearbyScheduledJob?.clientId || data.nearbyClient?.id;
      const scheduleEventId = data.nearbyScheduledJob?.id;
      await onStartJobTimer(selectedBackdate, clientId, scheduleEventId);
    } finally {
      setLoading(false);
    }
  };

  const handleContextAction = async (ctx: 'on_break' | 'getting_supplies' | 'stuck_in_traffic') => {
    setLoading(true);
    try {
      await onSetContext(ctx);
    } finally {
      setLoading(false);
    }
  };

  const styles = getStyles(colors, isDark);

  const hasKnownClient = !!(data.nearbyScheduledJob || data.nearbyClient);
  const clientName = data.nearbyScheduledJob?.clientName || data.nearbyClient?.name;
  const isScheduled = !!data.nearbyScheduledJob;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
          <View style={styles.handle} />

          <TouchableOpacity style={styles.closeBtn} onPress={onDismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <X size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            <View style={styles.iconWrap}>
              <MapPin size={32} color={colors.primary} />
            </View>

            <Text style={styles.title}>
              {hasKnownClient && isScheduled
                ? `You've arrived at ${clientName}`
                : hasKnownClient
                ? `Near ${clientName}`
                : `Stopped for ${data.stoppedMinutes} min`}
            </Text>

            {data.address ? (
              <Text style={styles.address} numberOfLines={2}>{data.address}</Text>
            ) : null}

            <View style={styles.infoRow}>
              <View style={styles.infoChip}>
                <Timer size={13} color={colors.primary} />
                <Text style={[styles.infoChipText, { color: colors.primary }]}>
                  Stopped {data.stoppedMinutes} min
                </Text>
              </View>
              {hasKnownClient && (
                <View style={styles.infoChip}>
                  <Building2 size={13} color={colors.textSecondary} />
                  <Text style={[styles.infoChipText, { color: colors.textSecondary }]}>
                    {Math.round((data.nearbyScheduledJob?.distance ?? data.nearbyClient?.distance ?? 0))}m away
                  </Text>
                </View>
              )}
            </View>

            {!selectedContext && (
              <View style={styles.optionsSection}>
                <Text style={styles.sectionLabel}>What are you doing?</Text>

                {hasKnownClient && (
                  <TouchableOpacity
                    style={[styles.optionCard, styles.primaryOptionCard]}
                    onPress={() => setSelectedContext('job')}
                    activeOpacity={0.8}
                    disabled={loading}
                  >
                    <LinearGradient
                      colors={[colors.primary, colors.primary + 'dd']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <View style={styles.optionCardContent}>
                      <View style={[styles.optionIconWrap, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                        <Play size={22} color="#fff" />
                      </View>
                      <View style={styles.optionTextWrap}>
                        <Text style={[styles.optionTitle, { color: '#fff' }]}>
                          {isScheduled ? `Start job — ${clientName}` : `Working at ${clientName}`}
                        </Text>
                        <Text style={[styles.optionSub, { color: 'rgba(255,255,255,0.75)' }]}>
                          Log time starting from arrival
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                )}

                {!hasKnownClient && (
                  <TouchableOpacity
                    style={[styles.optionCard, styles.primaryOptionCard]}
                    onPress={() => setSelectedContext('job')}
                    activeOpacity={0.8}
                    disabled={loading}
                  >
                    <LinearGradient
                      colors={[colors.primary, colors.primary + 'dd']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <View style={styles.optionCardContent}>
                      <View style={[styles.optionIconWrap, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                        <MapPin size={22} color="#fff" />
                      </View>
                      <View style={styles.optionTextWrap}>
                        <Text style={[styles.optionTitle, { color: '#fff' }]}>At a job site</Text>
                        <Text style={[styles.optionSub, { color: 'rgba(255,255,255,0.75)' }]}>
                          Log time from when you arrived
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                )}

                {[
                  { key: 'break' as ContextChoice, ctx: 'on_break' as const, icon: Coffee, label: 'On Break', sub: 'Taking a break', color: '#f59e0b' },
                  { key: 'supplies' as ContextChoice, ctx: 'getting_supplies' as const, icon: ShoppingCart, label: 'Getting Supplies', sub: 'Picking up materials', color: '#3b82f6' },
                  { key: 'traffic' as ContextChoice, ctx: 'stuck_in_traffic' as const, icon: AlertCircle, label: 'Stuck in Traffic', sub: 'Delayed in transit', color: '#ef4444' },
                ].map(item => (
                  <TouchableOpacity
                    key={item.key}
                    style={styles.optionCard}
                    onPress={() => handleContextAction(item.ctx)}
                    activeOpacity={0.75}
                    disabled={loading}
                  >
                    <View style={styles.optionCardContent}>
                      <View style={[styles.optionIconWrap, { backgroundColor: item.color + '18' }]}>
                        <item.icon size={22} color={item.color} />
                      </View>
                      <View style={styles.optionTextWrap}>
                        <Text style={[styles.optionTitle, { color: colors.text }]}>{item.label}</Text>
                        <Text style={[styles.optionSub, { color: colors.textSecondary }]}>{item.sub}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}

                {!hasKnownClient && onAddAsJobSite && (
                  <TouchableOpacity
                    style={[styles.optionCard, { borderStyle: 'dashed' }]}
                    onPress={onAddAsJobSite}
                    activeOpacity={0.75}
                    disabled={loading}
                  >
                    <View style={styles.optionCardContent}>
                      <View style={[styles.optionIconWrap, { backgroundColor: '#10b981' + '18' }]}>
                        <MapPin size={22} color="#10b981" />
                      </View>
                      <View style={styles.optionTextWrap}>
                        <Text style={[styles.optionTitle, { color: colors.text }]}>Add as New Job Site</Text>
                        <Text style={[styles.optionSub, { color: colors.textSecondary }]}>Save this location as a client</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {selectedContext === 'job' && (
              <View style={styles.backdateSection}>
                <Text style={styles.sectionLabel}>When did you start?</Text>
                <Text style={styles.backdateSub}>
                  Set your job timer to start from when you actually arrived
                </Text>

                <TouchableOpacity
                  style={styles.backdateSelector}
                  onPress={() => setShowBackdateOptions(v => !v)}
                  activeOpacity={0.8}
                >
                  <View style={styles.backdateSelectorLeft}>
                    <Clock size={18} color={colors.primary} />
                    <View>
                      <Text style={[styles.backdateSelectorLabel, { color: colors.textSecondary }]}>Start time</Text>
                      <Text style={[styles.backdateSelectorValue, { color: colors.text }]}>
                        {formatTime(backdateTime)} ({selectedOption.label})
                      </Text>
                    </View>
                  </View>
                  {showBackdateOptions
                    ? <ChevronUp size={18} color={colors.textSecondary} />
                    : <ChevronDown size={18} color={colors.textSecondary} />
                  }
                </TouchableOpacity>

                {showBackdateOptions && (
                  <View style={styles.backdateOptions}>
                    {BACKDATE_OPTIONS.map(opt => {
                      const optTime = new Date(data.stoppedSince.getTime() - opt.minutes * 60000);
                      const isSelected = selectedBackdate === opt.minutes;
                      return (
                        <TouchableOpacity
                          key={opt.minutes}
                          style={[styles.backdateOption, isSelected && styles.backdateOptionSelected]}
                          onPress={() => { setSelectedBackdate(opt.minutes); setShowBackdateOptions(false); }}
                        >
                          <Text style={[styles.backdateOptionLabel, isSelected && styles.backdateOptionLabelSelected]}>
                            {opt.label}
                          </Text>
                          <Text style={[styles.backdateOptionTime, isSelected && styles.backdateOptionTimeSelected]}>
                            {formatTime(optTime)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                <View style={styles.startTimeCard}>
                  <Clock size={16} color={colors.primary} />
                  <Text style={[styles.startTimeText, { color: colors.text }]}>
                    Timer will start from{' '}
                    <Text style={{ fontWeight: '700', color: colors.primary }}>
                      {formatTime(backdateTime)}
                    </Text>
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.confirmBtn, loading && { opacity: 0.6 }]}
                  onPress={handleStartJob}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={[colors.primary, colors.primary + 'cc']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[StyleSheet.absoluteFill, { borderRadius: 14 }]}
                  />
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Play size={18} color="#fff" />
                      <Text style={styles.confirmBtnText}>Start Job Timer</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity style={styles.backBtn} onPress={() => setSelectedContext(null)} disabled={loading}>
                  <Text style={[styles.backBtnText, { color: colors.textSecondary }]}>Back</Text>
                </TouchableOpacity>
              </View>
            )}

            {selectedContext !== 'job' && !loading && (
              <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss}>
                <Text style={[styles.dismissBtnText, { color: colors.textSecondary }]}>
                  Just passing by
                </Text>
              </TouchableOpacity>
            )}

            {loading && (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Saving...</Text>
              </View>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const getStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 24,
      paddingBottom: 40,
      paddingTop: 12,
      maxHeight: '90%',
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: 'center',
      marginBottom: 16,
    },
    closeBtn: {
      position: 'absolute',
      top: 20,
      right: 20,
      zIndex: 1,
      padding: 6,
    },
    iconWrap: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.primary + '18',
      justifyContent: 'center',
      alignItems: 'center',
      alignSelf: 'center',
      marginBottom: 14,
      marginTop: 8,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 6,
    },
    address: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 12,
      lineHeight: 18,
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
      marginBottom: 20,
    },
    infoChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: colors.inputBackground,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    infoChipText: {
      fontSize: 12,
      fontWeight: '600',
    },
    optionsSection: {
      gap: 10,
      marginBottom: 8,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 4,
    },
    optionCard: {
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    primaryOptionCard: {
      borderColor: 'transparent',
      overflow: 'hidden',
    },
    optionCardContent: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      gap: 12,
    },
    optionIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
    },
    optionTextWrap: {
      flex: 1,
    },
    optionTitle: {
      fontSize: 15,
      fontWeight: '600',
      marginBottom: 2,
    },
    optionSub: {
      fontSize: 12,
    },
    backdateSection: {
      gap: 12,
      marginBottom: 8,
    },
    backdateSub: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    backdateSelector: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.inputBackground,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.border,
      padding: 14,
      gap: 12,
    },
    backdateSelectorLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    backdateSelectorLabel: {
      fontSize: 11,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    backdateSelectorValue: {
      fontSize: 15,
      fontWeight: '600',
      marginTop: 1,
    },
    backdateOptions: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    backdateOption: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 13,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      backgroundColor: colors.inputBackground,
    },
    backdateOptionSelected: {
      backgroundColor: colors.primary + '15',
    },
    backdateOptionLabel: {
      fontSize: 15,
      fontWeight: '500',
      color: colors.text,
    },
    backdateOptionLabelSelected: {
      fontWeight: '700',
      color: colors.primary,
    },
    backdateOptionTime: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    backdateOptionTimeSelected: {
      color: colors.primary,
      fontWeight: '600',
    },
    startTimeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.primary + '10',
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.primary + '30',
    },
    startTimeText: {
      fontSize: 14,
      flex: 1,
    },
    confirmBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 16,
      borderRadius: 14,
      overflow: 'hidden',
    },
    confirmBtnText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '700',
    },
    backBtn: {
      alignItems: 'center',
      paddingVertical: 8,
    },
    backBtnText: {
      fontSize: 14,
      fontWeight: '500',
    },
    dismissBtn: {
      alignItems: 'center',
      paddingVertical: 14,
      marginTop: 4,
    },
    dismissBtnText: {
      fontSize: 14,
      fontWeight: '500',
    },
    loadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
    },
    loadingText: {
      fontSize: 14,
    },
  });
