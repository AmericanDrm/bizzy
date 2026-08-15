import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Animated,
} from 'react-native';
import {
  X,
  MapPin,
  Navigation,
  Clock,
  Circle,
  Truck,
  Home,
  Briefcase,
  Pause,
  Radio,
  RefreshCw,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import CrewLocationMap from './CrewLocationMap';

interface CrewLocation {
  id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  speed: number;
  status: string;
  client_name: string;
  is_active: boolean;
  last_updated: string;
  time_entry_id: string | null;
}

interface CrewMemberWithLocation extends CrewLocation {
  display_name: string;
  email: string;
}

interface LiveCrewTrackerProps {
  visible: boolean;
  onClose: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  home_base: { label: 'At Home Base', color: '#188038', icon: Home },
  job_site: { label: 'At Job Site', color: '#0071e3', icon: Briefcase },
  traveling: { label: 'Traveling', color: '#e37400', icon: Truck },
  stopped: { label: 'Stopped', color: '#d93025', icon: Pause },
  idle: { label: 'Idle', color: '#98989d', icon: Circle },
  unknown: { label: 'Unknown', color: '#98989d', icon: Circle },
};

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatSpeed(mps: number): string {
  const mph = mps * 2.237;
  if (mph < 1) return 'Stationary';
  return `${Math.round(mph)} mph`;
}

export default function LiveCrewTracker({ visible, onClose }: LiveCrewTrackerProps) {
  const { colors } = useTheme();
  const { currentOrganization } = useOrganization();
  const [members, setMembers] = useState<CrewMemberWithLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const pulseAnims = useRef<Record<string, Animated.Value>>({});
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (visible && currentOrganization?.id) {
      fetchCrewLocations();
      intervalRef.current = setInterval(fetchCrewLocations, 15000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [visible, currentOrganization?.id]);

  useEffect(() => {
    members.forEach((m) => {
      if (m.is_active && !pulseAnims.current[m.user_id]) {
        pulseAnims.current[m.user_id] = new Animated.Value(1);
        startPulse(m.user_id);
      }
    });
  }, [members]);

  const startPulse = (userId: string) => {
    const anim = pulseAnims.current[userId];
    if (!anim) return;

    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1.4, duration: 1000, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  };

  const fetchCrewLocations = async () => {
    if (!currentOrganization?.id) return;

    try {
      if (!refreshing) setLoading(members.length === 0);

      const { data: locations, error } = await supabase
        .from('crew_live_locations')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .eq('is_active', true)
        .order('last_updated', { ascending: false });

      if (error) throw error;

      if (!locations || locations.length === 0) {
        setMembers([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const userIds = locations.map((l: CrewLocation) => l.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, display_name')
        .in('id', userIds);

      const profileMap = new Map<string, { email: string; display_name: string }>();
      (profiles || []).forEach((p: any) => {
        profileMap.set(p.id, {
          email: p.email || '',
          display_name: p.display_name || p.email?.split('@')[0] || 'Unknown',
        });
      });

      const merged: CrewMemberWithLocation[] = locations.map((loc: CrewLocation) => {
        const profile = profileMap.get(loc.user_id);
        return {
          ...loc,
          display_name: profile?.display_name || 'Unknown',
          email: profile?.email || '',
        };
      });

      setMembers(merged);
    } catch (error) {
      console.error('Error fetching crew locations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchCrewLocations();
  };

  const activeMembers = members.filter((m) => m.is_active);
  const statusCounts = activeMembers.reduce(
    (acc, m) => {
      const key = m.status in STATUS_CONFIG ? m.status : 'unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const styles = getStyles(colors);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Radio size={20} color={colors.primary} />
              <Text style={styles.title}>Live Crew Tracker</Text>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity
                onPress={handleRefresh}
                style={styles.refreshButton}
                disabled={refreshing}
              >
                <RefreshCw
                  size={18}
                  color={refreshing ? colors.textSecondary : colors.primary}
                />
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {activeMembers.length > 0 && (
            <View style={styles.summaryBar}>
              <View style={styles.summaryItem}>
                <View style={[styles.liveIndicator, { backgroundColor: colors.success }]} />
                <Text style={styles.summaryText}>
                  {activeMembers.length} active
                </Text>
              </View>
              {Object.entries(statusCounts).map(([status, count]) => {
                const config = STATUS_CONFIG[status] || STATUS_CONFIG.unknown;
                return (
                  <View key={status} style={styles.summaryItem}>
                    <View style={[styles.statusDot, { backgroundColor: config.color }]} />
                    <Text style={styles.summaryText}>
                      {count} {config.label.toLowerCase()}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Loading crew positions...</Text>
              </View>
            ) : activeMembers.length === 0 ? (
              <View style={styles.emptyContainer}>
                <MapPin size={48} color={colors.textSecondary} strokeWidth={1.5} />
                <Text style={styles.emptyTitle}>No Active Crew Members</Text>
                <Text style={styles.emptySubtitle}>
                  Crew members will appear here when they clock in with location tracking enabled.
                </Text>
              </View>
            ) : (
              <View style={styles.membersList}>
                {activeMembers.map((member) => {
                  const config = STATUS_CONFIG[member.status] || STATUS_CONFIG.unknown;
                  const StatusIcon = config.icon;
                  const pulseAnim = pulseAnims.current[member.user_id];
                  const timeSinceUpdate = Date.now() - new Date(member.last_updated).getTime();
                  const isStale = timeSinceUpdate > 5 * 60 * 1000;

                  return (
                    <View key={member.id} style={styles.memberCard}>
                      <View style={styles.memberCardHeader}>
                        <View style={styles.memberAvatarContainer}>
                          <View style={[styles.memberAvatar, { backgroundColor: config.color + '20' }]}>
                            <Text style={[styles.memberAvatarText, { color: config.color }]}>
                              {member.display_name.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                          {!isStale && pulseAnim && (
                            <Animated.View
                              style={[
                                styles.pulseRing,
                                {
                                  borderColor: config.color,
                                  transform: [{ scale: pulseAnim }],
                                  opacity: pulseAnim.interpolate({
                                    inputRange: [1, 1.4],
                                    outputRange: [0.6, 0],
                                  }),
                                },
                              ]}
                            />
                          )}
                        </View>
                        <View style={styles.memberInfo}>
                          <Text style={styles.memberName}>{member.display_name}</Text>
                          <Text style={styles.memberEmail}>{member.email}</Text>
                        </View>
                        <View style={styles.headerActions}>
                          <View style={[styles.statusBadge, { backgroundColor: config.color + '18' }]}>
                            <StatusIcon size={14} color={config.color} />
                            <Text style={[styles.statusBadgeText, { color: config.color }]}>
                              {config.label}
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={[styles.mapButton, { borderColor: colors.border, backgroundColor: colors.inputBackground }]}
                            onPress={() => setShowMap(true)}
                          >
                            <MapPin size={16} color={colors.primary} />
                          </TouchableOpacity>
                        </View>
                      </View>

                      <View style={styles.memberDetails}>
                        {member.client_name ? (
                          <View style={styles.detailRow}>
                            <Briefcase size={14} color={colors.textSecondary} />
                            <Text style={styles.detailText}>{member.client_name}</Text>
                          </View>
                        ) : null}

                        <View style={styles.detailRow}>
                          <Navigation size={14} color={colors.textSecondary} />
                          <Text style={styles.detailText}>{formatSpeed(member.speed)}</Text>
                        </View>

                        <View style={styles.detailRow}>
                          <MapPin size={14} color={colors.textSecondary} />
                          <Text style={styles.detailText}>
                            {member.latitude.toFixed(5)}, {member.longitude.toFixed(5)}
                          </Text>
                        </View>

                        <View style={styles.detailRow}>
                          <Clock size={14} color={isStale ? colors.warning : colors.textSecondary} />
                          <Text
                            style={[
                              styles.detailText,
                              isStale && { color: colors.warning },
                            ]}
                          >
                            Updated {getTimeAgo(member.last_updated)}
                            {isStale ? ' (stale)' : ''}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </View>
      </View>

      <CrewLocationMap visible={showMap} onClose={() => setShowMap(false)} />
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
    modal: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '92%',
      minHeight: '60%',
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
      gap: 10,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    refreshButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.inputBackground,
      justifyContent: 'center',
      alignItems: 'center',
    },
    closeButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.inputBackground,
      justifyContent: 'center',
      alignItems: 'center',
    },
    summaryBar: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    summaryItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    liveIndicator: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    summaryText: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    content: {
      flex: 1,
      padding: 20,
    },
    loadingContainer: {
      paddingVertical: 60,
      alignItems: 'center',
      gap: 16,
    },
    loadingText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    emptyContainer: {
      paddingVertical: 60,
      alignItems: 'center',
      gap: 12,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginTop: 8,
    },
    emptySubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      paddingHorizontal: 32,
    },
    membersList: {
      gap: 12,
      paddingBottom: 40,
    },
    memberCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 16,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    memberCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      gap: 12,
    },
    memberAvatarContainer: {
      width: 44,
      height: 44,
      justifyContent: 'center',
      alignItems: 'center',
    },
    memberAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
    },
    memberAvatarText: {
      fontSize: 18,
      fontWeight: '700',
    },
    pulseRing: {
      position: 'absolute',
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 2,
    },
    memberInfo: {
      flex: 1,
    },
    memberName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    memberEmail: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 1,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 12,
    },
    statusBadgeText: {
      fontSize: 11,
      fontWeight: '600',
    },
    mapButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    memberDetails: {
      paddingHorizontal: 16,
      paddingBottom: 14,
      paddingTop: 12,
      gap: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border + '40',
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingTop: 4,
    },
    detailText: {
      fontSize: 13,
      color: colors.textSecondary,
    },
  });
