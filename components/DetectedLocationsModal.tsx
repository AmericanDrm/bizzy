import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { MapPin, X, Eye, Calendar, Clock, MapPinned, Plus, Link2, Trash2, CircleCheck as CheckCircle2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';

interface DetectedLocation {
  id: string;
  latitude: number;
  longitude: number;
  first_detected_at: string;
  last_detected_at: string;
  visit_count: number;
  total_minutes: number;
  address: string | null;
  associated_client_id: string | null;
  dismissed: boolean;
}

interface Client {
  id: string;
  name: string;
  address: string;
}

interface DetectedLocationsModalProps {
  visible: boolean;
  onClose: () => void;
  onCreateClient: (latitude: number, longitude: number) => void;
  onCreateScheduledJob: (latitude: number, longitude: number, clientId?: string) => void;
  userId: string;
}

export function DetectedLocationsModal({
  visible,
  onClose,
  onCreateClient,
  onCreateScheduledJob,
  userId,
}: DetectedLocationsModalProps) {
  const { colors } = useTheme();
  const { showToast } = useToast();

  const [locations, setLocations] = useState<DetectedLocation[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedLocation, setExpandedLocation] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (visible) {
      fetchDetectedLocations();
      fetchClients();
    }
  }, [visible]);

  const fetchDetectedLocations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('detected_locations')
        .select('*')
        .eq('user_id', userId)
        .eq('dismissed', false)
        .is('associated_client_id', null)
        .order('last_detected_at', { ascending: false });

      if (error) throw error;
      setLocations(data || []);
    } catch (error: any) {
      showToast({ message: error.message || 'Failed to load detected locations', type: 'error', duration: 4000 });
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, address')
        .eq('user_id', userId)
        .order('name');

      if (error) throw error;
      setClients(data || []);
    } catch (error: any) {
      console.error('Error fetching clients:', error);
    }
  };

  const handleAssociateWithClient = async (locationId: string, clientId: string) => {
    try {
      const { error } = await supabase
        .from('detected_locations')
        .update({ associated_client_id: clientId })
        .eq('id', locationId);

      if (error) throw error;

      showToast({ message: 'Location associated with client', type: 'success', duration: 2000 });
      fetchDetectedLocations();
    } catch (error: any) {
      showToast({ message: error.message || 'Failed to associate location', type: 'error', duration: 4000 });
    }
  };

  const handleDismiss = async (locationId: string) => {
    try {
      const { error } = await supabase
        .from('detected_locations')
        .update({ dismissed: true })
        .eq('id', locationId);

      if (error) throw error;

      showToast({ message: 'Location dismissed', type: 'success', duration: 2000 });
      fetchDetectedLocations();
    } catch (error: any) {
      showToast({ message: error.message || 'Failed to dismiss location', type: 'error', duration: 4000 });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const formatCoordinates = (lat: number, lon: number) => {
    return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  };

  const styles = StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '90%',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      flex: 1,
    },
    closeButton: {
      padding: 8,
      borderRadius: 12,
      backgroundColor: colors.inputBackground,
    },
    content: {
      flex: 1,
    },
    emptyState: {
      padding: 40,
      alignItems: 'center',
    },
    emptyIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.inputBackground,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    emptyDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    locationCard: {
      backgroundColor: colors.inputBackground,
      marginHorizontal: 16,
      marginVertical: 8,
      borderRadius: 16,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    locationHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      gap: 12,
    },
    locationIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primary + '20',
      alignItems: 'center',
      justifyContent: 'center',
    },
    locationInfo: {
      flex: 1,
    },
    locationTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    locationSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    expandButton: {
      padding: 8,
    },
    statsRow: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingBottom: 12,
      gap: 12,
    },
    statItem: {
      flex: 1,
      backgroundColor: colors.surface,
      padding: 12,
      borderRadius: 12,
      alignItems: 'center',
    },
    statLabel: {
      fontSize: 11,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    statValue: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    expandedContent: {
      paddingHorizontal: 16,
      paddingBottom: 16,
      gap: 12,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      borderRadius: 12,
      gap: 10,
    },
    primaryAction: {
      overflow: 'hidden' as const,
    },
    secondaryAction: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    dangerAction: {
      backgroundColor: colors.error + '15',
      borderWidth: 1,
      borderColor: colors.error + '30',
    },
    actionText: {
      fontSize: 15,
      fontWeight: '600',
      flex: 1,
    },
    primaryActionText: {
      color: '#fff',
    },
    secondaryActionText: {
      color: colors.text,
    },
    dangerActionText: {
      color: colors.error,
    },
    clientPicker: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
    },
    clientOption: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 8,
      marginBottom: 4,
    },
    clientOptionSelected: {
      backgroundColor: colors.primary + '20',
    },
    clientOptionText: {
      fontSize: 14,
      color: colors.text,
      flex: 1,
      marginLeft: 10,
    },
    clientOptionAddress: {
      fontSize: 12,
      color: colors.textSecondary,
      marginLeft: 10,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 8,
      marginTop: 4,
    },
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Potential Job Sites</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <X size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={[styles.emptyState, { paddingVertical: 60 }]}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : locations.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <MapPin size={32} color={colors.textSecondary} />
              </View>
              <Text style={styles.emptyTitle}>No Locations Detected</Text>
              <Text style={styles.emptyDescription}>
                When you spend time at new locations while clocked in, they'll appear here so you
                can track them as job sites.
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {locations.map((location) => (
                <View key={location.id} style={styles.locationCard}>
                  <TouchableOpacity
                    style={styles.locationHeader}
                    onPress={() =>
                      setExpandedLocation(expandedLocation === location.id ? null : location.id)
                    }>
                    <View style={styles.locationIcon}>
                      <MapPinned size={24} color={colors.primary} />
                    </View>
                    <View style={styles.locationInfo}>
                      <Text style={styles.locationTitle}>
                        Unknown Location #{locations.indexOf(location) + 1}
                      </Text>
                      <Text style={styles.locationSubtitle}>
                        {formatCoordinates(location.latitude, location.longitude)}
                      </Text>
                    </View>
                    <View style={styles.expandButton}>
                      <Eye size={20} color={colors.textSecondary} />
                    </View>
                  </TouchableOpacity>

                  <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>Visits</Text>
                      <Text style={styles.statValue}>{location.visit_count}</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>Total Time</Text>
                      <Text style={styles.statValue}>{formatDuration(location.total_minutes)}</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>Last Visit</Text>
                      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
                        {formatDate(location.last_detected_at)}
                      </Text>
                    </View>
                  </View>

                  {expandedLocation === location.id && (
                    <View style={styles.expandedContent}>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.primaryAction]}
                        onPress={() => {
                          onCreateClient(location.latitude, location.longitude);
                          onClose();
                        }}>
                        <LinearGradient
                          colors={['#1B4D6E', '#245d82']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={StyleSheet.absoluteFill}
                        />
                        <Plus size={20} color="#fff" />
                        <Text style={[styles.actionText, styles.primaryActionText]}>
                          Create New Client Here
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.actionButton, styles.secondaryAction]}
                        onPress={() => {
                          onCreateScheduledJob(location.latitude, location.longitude);
                          onClose();
                        }}>
                        <Calendar size={20} color={colors.text} />
                        <Text style={[styles.actionText, styles.secondaryActionText]}>
                          Schedule Job at This Location
                        </Text>
                      </TouchableOpacity>

                      {clients.length > 0 && (
                        <>
                          <Text style={styles.sectionTitle}>Or Associate with Existing Client:</Text>
                          <View style={styles.clientPicker}>
                            {clients.slice(0, 5).map((client) => (
                              <TouchableOpacity
                                key={client.id}
                                style={[
                                  styles.clientOption,
                                  selectedClient[location.id] === client.id &&
                                    styles.clientOptionSelected,
                                ]}
                                onPress={() => {
                                  setSelectedClient({ ...selectedClient, [location.id]: client.id });
                                  handleAssociateWithClient(location.id, client.id);
                                }}>
                                <CheckCircle2
                                  size={18}
                                  color={
                                    selectedClient[location.id] === client.id
                                      ? colors.primary
                                      : colors.border
                                  }
                                />
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.clientOptionText}>{client.name}</Text>
                                  {client.address && (
                                    <Text style={styles.clientOptionAddress}>{client.address}</Text>
                                  )}
                                </View>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </>
                      )}

                      <TouchableOpacity
                        style={[styles.actionButton, styles.dangerAction]}
                        onPress={() => handleDismiss(location.id)}>
                        <Trash2 size={20} color={colors.error} />
                        <Text style={[styles.actionText, styles.dangerActionText]}>
                          Dismiss This Location
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))}
              <View style={{ height: 20 }} />
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
