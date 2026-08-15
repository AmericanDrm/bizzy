import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Dimensions,
  Platform,
} from 'react-native';

let MapView: any;
let Marker: any;
let Polyline: any;
let PROVIDER_GOOGLE: any;

if (Platform.OS !== 'web') {
  try {
    const RNMaps = require('react-native-maps');
    MapView = RNMaps.default;
    Marker = RNMaps.Marker;
    Polyline = RNMaps.Polyline;
    PROVIDER_GOOGLE = RNMaps.PROVIDER_GOOGLE;
  } catch {}
}
import {
  X,
  MapPin,
  Navigation,
  Clock,
  Search,
  User,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RefreshCw,
  Locate,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { useOrganization } from '@/contexts/OrganizationContext';

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

interface CrewLocationMapProps {
  visible: boolean;
  onClose: () => void;
}

interface LocationHistory {
  latitude: number;
  longitude: number;
  timestamp: string;
}

const STATUS_COLORS: Record<string, string> = {
  home_base: '#188038',
  job_site: '#0071e3',
  traveling: '#e37400',
  stopped: '#d93025',
  idle: '#98989d',
  unknown: '#98989d',
};

const STATUS_LABELS: Record<string, string> = {
  home_base: 'At Home Base',
  job_site: 'At Job Site',
  traveling: 'Traveling',
  stopped: 'Stopped',
  idle: 'Idle',
  unknown: 'Unknown',
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

export default function CrewLocationMap({ visible, onClose }: CrewLocationMapProps) {
  const { colors } = useTheme();
  const { currentOrganization } = useOrganization();
  const [members, setMembers] = useState<CrewMemberWithLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState<CrewMemberWithLocation | null>(null);
  const [locationHistory, setLocationHistory] = useState<LocationHistory[]>([]);
  const mapRef = useRef<MapView>(null);
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

  const handleMemberClick = async (member: CrewMemberWithLocation) => {
    setSelectedMember(member);

    if (member.time_entry_id) {
      const { data } = await supabase
        .from('crew_live_locations')
        .select('latitude, longitude, last_updated')
        .eq('user_id', member.user_id)
        .eq('time_entry_id', member.time_entry_id)
        .order('last_updated', { ascending: true })
        .limit(50);

      if (data) {
        setLocationHistory(
          data.map((d: any) => ({
            latitude: d.latitude,
            longitude: d.longitude,
            timestamp: d.last_updated,
          }))
        );
      }
    }
  };

  const filteredMembers = members.filter(
    (m) =>
      m.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.client_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const fitMapToMembers = () => {
    if (!mapRef.current || filteredMembers.length === 0) return;

    const coordinates = filteredMembers.map((m) => ({
      latitude: m.latitude,
      longitude: m.longitude,
    }));

    mapRef.current.fitToCoordinates(coordinates, {
      edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
      animated: true,
    });
  };

  const getInitialRegion = () => {
    if (filteredMembers.length === 0) {
      return {
        latitude: 37.78825,
        longitude: -122.4324,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      };
    }

    if (filteredMembers.length === 1) {
      return {
        latitude: filteredMembers[0].latitude,
        longitude: filteredMembers[0].longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }

    const lats = filteredMembers.map((m) => m.latitude);
    const lngs = filteredMembers.map((m) => m.longitude);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: (maxLat - minLat) * 1.5 || 0.01,
      longitudeDelta: (maxLng - minLng) * 1.5 || 0.01,
    };
  };

  const centerOnMember = (member: CrewMemberWithLocation) => {
    if (!mapRef.current) return;

    mapRef.current.animateToRegion(
      {
        latitude: member.latitude,
        longitude: member.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      1000
    );
  };

  useEffect(() => {
    if (filteredMembers.length > 0) {
      setTimeout(() => fitMapToMembers(), 500);
    }
  }, [filteredMembers.length]);

  const styles = getStyles(colors);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <MapPin size={20} color={colors.primary} />
              <Text style={styles.title}>Crew Location Map</Text>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity
                onPress={handleRefresh}
                style={styles.iconButton}
                disabled={refreshing}
              >
                <RefreshCw
                  size={18}
                  color={refreshing ? colors.textSecondary : colors.primary}
                />
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={styles.iconButton}>
                <X size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.searchContainer}>
            <Search size={18} color={colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search team members..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.mapControls}>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={fitMapToMembers}
            >
              <Locate size={16} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Loading map...</Text>
            </View>
          ) : filteredMembers.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MapPin size={48} color={colors.textSecondary} strokeWidth={1.5} />
              <Text style={styles.emptyTitle}>No Active Crew Members</Text>
              <Text style={styles.emptySubtitle}>
                Crew members will appear here when they clock in with location tracking enabled.
              </Text>
            </View>
          ) : Platform.OS === 'web' ? (
            <View style={styles.webNotSupportedContainer}>
              <MapPin size={64} color={colors.textSecondary} strokeWidth={1.5} />
              <Text style={[styles.webNotSupportedTitle, { color: colors.text }]}>
                Map View Not Available on Web
              </Text>
              <Text style={[styles.webNotSupportedText, { color: colors.textSecondary }]}>
                The crew location map feature is only available on iOS and Android devices. Please use the mobile app to view live crew locations on the map.
              </Text>
              <View style={styles.crewListContainer}>
                <Text style={[styles.crewListTitle, { color: colors.text }]}>Active Crew Members:</Text>
                <ScrollView style={styles.crewList}>
                  {filteredMembers.map((member) => {
                    const statusInfo = STATUS_LABELS[member.status] || STATUS_LABELS.unknown;
                    return (
                      <TouchableOpacity
                        key={member.id}
                        style={[styles.crewListItem, { backgroundColor: colors.card }]}
                        onPress={() => handleMemberClick(member)}
                      >
                        <View style={[styles.crewListAvatar, { backgroundColor: STATUS_COLORS[member.status] + '20' }]}>
                          <Text style={[styles.crewListAvatarText, { color: STATUS_COLORS[member.status] }]}>
                            {member.display_name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.crewListInfo}>
                          <Text style={[styles.crewListName, { color: colors.text }]}>{member.display_name}</Text>
                          <Text style={[styles.crewListStatus, { color: colors.textSecondary }]}>
                            {statusInfo} • {getTimeAgo(member.last_updated)}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.mapContainer}>
                <MapView
                  ref={mapRef}
                  provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                  style={styles.map}
                  initialRegion={getInitialRegion()}
                  showsUserLocation={false}
                  showsMyLocationButton={false}
                  showsCompass={true}
                  showsScale={true}
                  loadingEnabled={true}
                >
                  {selectedMember && locationHistory.length > 1 && (
                    <Polyline
                      coordinates={locationHistory.map((loc) => ({
                        latitude: loc.latitude,
                        longitude: loc.longitude,
                      }))}
                      strokeColor="#0071e3"
                      strokeWidth={3}
                      lineDashPattern={[5, 5]}
                    />
                  )}

                  {filteredMembers.map((member) => {
                    const color = STATUS_COLORS[member.status] || STATUS_COLORS.unknown;
                    const isSelected = selectedMember?.id === member.id;

                    return (
                      <Marker
                        key={member.id}
                        coordinate={{
                          latitude: member.latitude,
                          longitude: member.longitude,
                        }}
                        onPress={() => {
                          handleMemberClick(member);
                          centerOnMember(member);
                        }}
                        pinColor={color}
                      >
                        <View
                          style={[
                            styles.customMarker,
                            {
                              backgroundColor: color,
                              borderWidth: isSelected ? 3 : 2,
                              borderColor: isSelected ? '#fff' : color + 'DD',
                              transform: [{ scale: isSelected ? 1.2 : 1 }],
                            },
                          ]}
                        >
                          <Text style={styles.markerText}>
                            {member.display_name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      </Marker>
                    );
                  })}
                </MapView>
              </View>

              <View style={styles.detailsContainer}>
                {selectedMember ? (
                  <View style={styles.detailsCard}>
                    <View style={styles.detailsHeader}>
                      <View style={styles.detailsHeaderLeft}>
                        <View
                          style={[
                            styles.detailsAvatar,
                            { backgroundColor: STATUS_COLORS[selectedMember.status] + '20' },
                          ]}
                        >
                          <Text
                            style={[
                              styles.detailsAvatarText,
                              { color: STATUS_COLORS[selectedMember.status] },
                            ]}
                          >
                            {selectedMember.display_name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View>
                          <Text style={styles.detailsName}>{selectedMember.display_name}</Text>
                          <Text style={styles.detailsEmail}>{selectedMember.email}</Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedMember(null);
                          setLocationHistory([]);
                        }}
                      >
                        <X size={20} color={colors.textSecondary} />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.detailsInfo}>
                      {selectedMember.client_name && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Client:</Text>
                          <Text style={styles.detailValue}>{selectedMember.client_name}</Text>
                        </View>
                      )}
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Speed:</Text>
                        <Text style={styles.detailValue}>{formatSpeed(selectedMember.speed)}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Location:</Text>
                        <Text style={styles.detailValue}>
                          {selectedMember.latitude.toFixed(5)}, {selectedMember.longitude.toFixed(5)}
                        </Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Last Update:</Text>
                        <Text style={styles.detailValue}>
                          {getTimeAgo(selectedMember.last_updated)}
                        </Text>
                      </View>
                      {locationHistory.length > 1 && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Path History:</Text>
                          <Text style={styles.detailValue}>
                            {locationHistory.length} locations tracked
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                ) : (
                  <View style={styles.hintContainer}>
                    <User size={24} color={colors.textSecondary} />
                    <Text style={styles.hintText}>
                      Tap a team member on the map to view their details and tracking history
                    </Text>
                  </View>
                )}
              </View>
            </>
          )}
        </View>
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
    modal: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '95%',
      minHeight: '80%',
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
    iconButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.inputBackground,
      justifyContent: 'center',
      alignItems: 'center',
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.inputBackground,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginHorizontal: 20,
      marginTop: 16,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      color: colors.text,
      padding: 0,
      margin: 0,
      borderWidth: 0,
      backgroundColor: 'transparent',
      ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
    } as any,
    mapControls: {
      position: 'absolute',
      top: 120,
      right: 20,
      gap: 8,
      zIndex: 10,
    },
    controlButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    loadingContainer: {
      paddingVertical: 80,
      alignItems: 'center',
      gap: 16,
    },
    loadingText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    emptyContainer: {
      paddingVertical: 80,
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 32,
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
    },
    mapContainer: {
      flex: 1,
      marginTop: 16,
      overflow: 'hidden',
    },
    map: {
      flex: 1,
      minHeight: 400,
    },
    customMarker: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 5,
    },
    markerText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '700',
    },
    detailsContainer: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
      padding: 20,
    },
    detailsCard: {
      gap: 16,
    },
    detailsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    detailsHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    detailsAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
    },
    detailsAvatarText: {
      fontSize: 20,
      fontWeight: '700',
    },
    detailsName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    detailsEmail: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    detailsInfo: {
      gap: 10,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    detailLabel: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    detailValue: {
      fontSize: 14,
      color: colors.text,
      fontWeight: '600',
    },
    hintContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 16,
      backgroundColor: colors.inputBackground,
      borderRadius: 12,
    },
    hintText: {
      flex: 1,
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    webNotSupportedContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
      gap: 16,
    },
    webNotSupportedTitle: {
      fontSize: 20,
      fontWeight: '700',
      textAlign: 'center',
      marginTop: 8,
    },
    webNotSupportedText: {
      fontSize: 15,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 16,
    },
    crewListContainer: {
      width: '100%',
      maxWidth: 500,
      marginTop: 16,
    },
    crewListTitle: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 12,
    },
    crewList: {
      maxHeight: 300,
    },
    crewListItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderRadius: 12,
      marginBottom: 8,
      gap: 12,
    },
    crewListAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    crewListAvatarText: {
      fontSize: 16,
      fontWeight: '700',
    },
    crewListInfo: {
      flex: 1,
    },
    crewListName: {
      fontSize: 15,
      fontWeight: '600',
      marginBottom: 2,
    },
    crewListStatus: {
      fontSize: 13,
    },
  });
