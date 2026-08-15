import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { X, MapPin, Clock, Camera, CheckCircle, Coffee, ArrowRight, Calendar } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { LocationService } from '@/lib/locationService';

interface SessionHistoryModalProps {
  visible: boolean;
  onClose: () => void;
}

interface ProductivitySession {
  id: string;
  user_id: string;
  time_entry_id: string | null;
  client_id: string | null;
  session_type: string;
  start_time: string;
  end_time: string | null;
  departure_reason: string | null;
  entry_latitude: number | null;
  entry_longitude: number | null;
  exit_latitude: number | null;
  exit_longitude: number | null;
  duration_minutes: number | null;
  notes: string | null;
  client: {
    name: string;
    address: string;
  } | null;
  photos: Array<{
    id: string;
    photo_url: string;
    caption: string;
    created_at: string;
  }>;
}

export default function SessionHistoryModal({
  visible,
  onClose,
}: SessionHistoryModalProps) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<ProductivitySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (visible) {
      fetchSessions();
    }
  }, [visible]);

  const fetchSessions = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('productivity_sessions')
        .select(`
          *,
          client:clients(name, address),
          photos:client_photos(id, photo_url, caption, created_at)
        `)
        .eq('user_id', user.id)
        .not('end_time', 'is', null)
        .order('start_time', { ascending: false })
        .limit(50);

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSessionExpansion = (sessionId: string) => {
    setExpandedSessions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sessionId)) {
        newSet.delete(sessionId);
      } else {
        newSet.add(sessionId);
      }
      return newSet;
    });
  };

  const formatDuration = (startTime: string, endTime: string | null) => {
    if (!endTime) return 'In progress';
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diff = end.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getDepartureReasonIcon = (reason: string | null) => {
    switch (reason) {
      case 'completed':
        return <CheckCircle size={16} color="#10b981" />;
      case 'break':
        return <Coffee size={16} color="#f59e0b" />;
      case 'next_job':
        return <ArrowRight size={16} color="#3b82f6" />;
      default:
        return <Clock size={16} color="#6b7280" />;
    }
  };

  const getDepartureReasonText = (reason: string | null) => {
    switch (reason) {
      case 'completed':
        return 'Job Completed';
      case 'break':
        return 'Break';
      case 'next_job':
        return 'Next Job';
      case 'other':
        return 'Other';
      default:
        return 'Unknown';
    }
  };

  const renderSession = (session: ProductivitySession) => {
    const isExpanded = expandedSessions.has(session.id);
    const hasPhotos = session.photos && session.photos.length > 0;

    return (
      <TouchableOpacity
        key={session.id}
        style={styles.sessionCard}
        onPress={() => toggleSessionExpansion(session.id)}
      >
        <View style={styles.sessionHeader}>
          <View style={styles.sessionInfo}>
            <View style={styles.sessionTitleRow}>
              <MapPin size={18} color="#3b82f6" />
              <Text style={styles.sessionTitle}>
                {session.client?.name || 'Unknown Location'}
              </Text>
            </View>
            <Text style={styles.sessionDate}>{formatDate(session.start_time)}</Text>
          </View>
          <View style={styles.sessionStats}>
            <Text style={styles.sessionDuration}>
              {formatDuration(session.start_time, session.end_time)}
            </Text>
            {hasPhotos && (
              <View style={styles.photoBadge}>
                <Camera size={14} color="#fff" />
                <Text style={styles.photoBadgeText}>{session.photos.length}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.sessionTimeRow}>
          <Text style={styles.sessionTime}>
            {formatTime(session.start_time)} - {session.end_time ? formatTime(session.end_time) : 'Now'}
          </Text>
        </View>

        {session.departure_reason && (
          <View style={styles.departureReasonContainer}>
            {getDepartureReasonIcon(session.departure_reason)}
            <Text style={styles.departureReasonText}>
              {getDepartureReasonText(session.departure_reason)}
            </Text>
          </View>
        )}

        {isExpanded && (
          <View style={styles.expandedContent}>
            {session.client?.address && (
              <View style={styles.detailRow}>
                <MapPin size={14} color="#6b7280" />
                <Text style={styles.detailText}>{session.client.address}</Text>
              </View>
            )}

            {session.notes && (
              <View style={styles.notesContainer}>
                <Text style={styles.notesLabel}>Notes:</Text>
                <Text style={styles.notesText}>{session.notes}</Text>
              </View>
            )}

            {hasPhotos && (
              <View style={styles.photosSection}>
                <Text style={styles.photosSectionTitle}>Photos ({session.photos.length})</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.photosGrid}>
                    {session.photos.map((photo) => (
                      <View key={photo.id} style={styles.photoItem}>
                        <Image source={{ uri: photo.photo_url }} style={styles.photoImage} />
                        {photo.caption && (
                          <Text style={styles.photoCaption} numberOfLines={1}>
                            {photo.caption}
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Session History</Text>
              <Text style={styles.subtitle}>Recent productivity sessions</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2563eb" />
                <Text style={styles.loadingText}>Loading sessions...</Text>
              </View>
            ) : sessions.length === 0 ? (
              <View style={styles.emptyState}>
                <Calendar size={48} color="#9ca3af" />
                <Text style={styles.emptyStateText}>
                  No session history yet.{'\n'}Sessions will appear here after you clock in and out at job sites.
                </Text>
              </View>
            ) : (
              sessions.map(renderSession)
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  content: {
    padding: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 24,
  },
  sessionCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  sessionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  sessionDate: {
    fontSize: 13,
    color: '#6b7280',
  },
  sessionStats: {
    alignItems: 'flex-end',
    gap: 6,
  },
  sessionDuration: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  photoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  photoBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  sessionTimeRow: {
    marginBottom: 8,
  },
  sessionTime: {
    fontSize: 14,
    color: '#6b7280',
  },
  departureReasonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  departureReasonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
  expandedContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 12,
  },
  detailText: {
    fontSize: 14,
    color: '#6b7280',
    flex: 1,
  },
  notesContainer: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  photosSection: {
    marginTop: 8,
  },
  photosSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  photosGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  photoItem: {
    width: 120,
  },
  photoImage: {
    width: 120,
    height: 120,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
  },
  photoCaption: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
});
