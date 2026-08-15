import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Users as Users2, MapPin, Clock, Calendar, Check, CircleAlert as AlertCircle } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/lib/supabase';
import {
  RouteLocation,
  optimizeRoute,
  OptimizedRoute,
} from '@/lib/routeOptimizationService';
import { dispatchTeamRoutes } from '@/lib/routeOptimizationService';

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  profiles: {
    full_name: string;
    email: string;
  };
}

interface TeamDispatchModalProps {
  visible: boolean;
  onClose: () => void;
  locations: RouteLocation[];
}

export default function TeamDispatchModal({
  visible,
  onClose,
  locations,
}: TeamDispatchModalProps) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const { currentOrganization } = useOrganization();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [dispatchResult, setDispatchResult] = useState<any>(null);

  useEffect(() => {
    if (visible && currentOrganization) {
      loadTeamMembers();
    }
  }, [visible, currentOrganization]);

  const loadTeamMembers = async () => {
    if (!currentOrganization) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('organization_members')
        .select(`
          id,
          user_id,
          role,
          profiles (
            full_name,
            email
          )
        `)
        .eq('organization_id', currentOrganization.id)
        .in('role', ['member', 'manager', 'admin']);

      if (error) throw error;
      setTeamMembers(data || []);
    } catch (error: any) {
      showToast({
        message: error.message || 'Failed to load team members',
        type: 'error',
        duration: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleMemberSelection = (memberId: string) => {
    const newSelection = new Set(selectedMembers);
    if (newSelection.has(memberId)) {
      newSelection.delete(memberId);
    } else {
      newSelection.add(memberId);
    }
    setSelectedMembers(newSelection);
  };

  const handleDispatch = async () => {
    if (selectedMembers.size === 0) {
      showToast({
        message: 'Please select at least one team member',
        type: 'error',
        duration: 3000,
      });
      return;
    }

    if (locations.length === 0) {
      showToast({
        message: 'No locations to dispatch',
        type: 'error',
        duration: 3000,
      });
      return;
    }

    try {
      setDispatching(true);

      const memberIdsArray = Array.from(selectedMembers);
      const result = dispatchTeamRoutes(locations, memberIdsArray, {
        averageSpeedMph: 35,
        includeReturnToStart: false,
      });

      const enrichedResult = {
        ...result,
        assignments: result.assignments.map((assignment, index) => {
          const member = teamMembers.find((m) => m.user_id === memberIdsArray[index]);
          return {
            ...assignment,
            memberName: member?.profiles?.full_name || member?.profiles?.email || `Team Member ${index + 1}`,
          };
        }),
      };

      setDispatchResult(enrichedResult);

      showToast({
        message: `Successfully dispatched ${locations.length} locations to ${selectedMembers.size} team members`,
        type: 'success',
        duration: 4000,
      });
    } catch (error: any) {
      showToast({
        message: error.message || 'Failed to dispatch routes',
        type: 'error',
        duration: 4000,
      });
    } finally {
      setDispatching(false);
    }
  };

  const handleSaveDispatch = async () => {
    if (!dispatchResult || !currentOrganization) return;

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      for (const assignment of dispatchResult.assignments) {
        const { data: template, error: templateError } = await supabase
          .from('route_templates')
          .insert({
            organization_id: currentOrganization.id,
            name: `${assignment.memberName} - ${new Date().toLocaleDateString()}`,
            total_distance: assignment.route.totalDistance,
            total_duration: assignment.route.totalDuration,
            status: 'active',
            created_by: userData.user.id,
            assigned_to: assignment.memberId,
          })
          .select()
          .single();

        if (templateError) throw templateError;

        const stops = assignment.route.stops.map((stop, index) => ({
          route_template_id: template.id,
          stop_order: index + 1,
          client_id: stop.clientId || null,
          client_address_id: stop.clientAddressId || null,
          label: stop.label,
          address: stop.address,
          latitude: stop.latitude,
          longitude: stop.longitude,
          estimated_arrival: assignment.route.estimatedTimes[index],
          duration_at_stop: stop.durationAtStop || 30,
          notes: stop.notes,
        }));

        const { error: stopsError } = await supabase.from('route_stops').insert(stops);
        if (stopsError) throw stopsError;
      }

      showToast({
        message: 'Team dispatch saved successfully',
        type: 'success',
        duration: 3000,
      });

      onClose();
      setDispatchResult(null);
      setSelectedMembers(new Set());
    } catch (error: any) {
      showToast({
        message: error.message || 'Failed to save dispatch',
        type: 'error',
        duration: 4000,
      });
    }
  };

  const renderMemberItem = ({ item }: { item: TeamMember }) => {
    const isSelected = selectedMembers.has(item.user_id);
    return (
      <TouchableOpacity
        style={[
          styles.memberItem,
          { backgroundColor: colors.inputBackground, borderColor: colors.border },
          isSelected && { borderColor: colors.primary, backgroundColor: colors.primaryLight },
        ]}
        onPress={() => toggleMemberSelection(item.user_id)}
      >
        <View style={styles.memberInfo}>
          <View
            style={[
              styles.memberAvatar,
              { backgroundColor: isSelected ? colors.primary : colors.textSecondary },
            ]}
          >
            <Text style={styles.memberAvatarText}>
              {item.profiles?.full_name?.charAt(0) || item.profiles?.email?.charAt(0) || '?'}
            </Text>
          </View>
          <View style={styles.memberDetails}>
            <Text style={[styles.memberName, { color: colors.text }]}>
              {item.profiles?.full_name || item.profiles?.email || 'Unknown'}
            </Text>
            <Text style={[styles.memberRole, { color: colors.textSecondary }]}>
              {item.role}
            </Text>
          </View>
        </View>
        {isSelected && (
          <View style={[styles.checkCircle, { backgroundColor: colors.primary }]}>
            <Check size={16} color="#fff" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderDispatchResult = () => {
    if (!dispatchResult) return null;

    return (
      <View style={styles.resultContainer}>
        <Text style={[styles.resultTitle, { color: colors.text }]}>Dispatch Preview</Text>
        <Text style={[styles.resultSubtitle, { color: colors.textSecondary }]}>
          {dispatchResult.assignments.length} team members will receive routes
        </Text>

        <ScrollView style={styles.assignmentsList}>
          {dispatchResult.assignments.map((assignment: any, index: number) => (
            <View
              key={index}
              style={[styles.assignmentCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
            >
              <View style={styles.assignmentHeader}>
                <View style={[styles.memberAvatar, { backgroundColor: colors.primary }]}>
                  <Text style={styles.memberAvatarText}>
                    {assignment.memberName?.charAt(0) || '?'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.assignmentMemberName, { color: colors.text }]}>
                    {assignment.memberName}
                  </Text>
                  <Text style={[styles.assignmentStats, { color: colors.textSecondary }]}>
                    {assignment.route.stops.length} stops • {assignment.route.totalDistance.toFixed(1)} mi •{' '}
                    {Math.floor(assignment.route.totalDuration / 60)}h {assignment.route.totalDuration % 60}m
                  </Text>
                </View>
              </View>

              <View style={styles.stopsPreview}>
                {assignment.route.stops.slice(0, 3).map((stop: RouteLocation, stopIndex: number) => (
                  <View key={stopIndex} style={styles.stopItem}>
                    <MapPin size={12} color={colors.textSecondary} />
                    <Text style={[styles.stopLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                      {stop.label}
                    </Text>
                  </View>
                ))}
                {assignment.route.stops.length > 3 && (
                  <Text style={[styles.moreStops, { color: colors.textSecondary }]}>
                    +{assignment.route.stops.length - 3} more
                  </Text>
                )}
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={styles.resultActions}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.inputBackground }]}
            onPress={() => setDispatchResult(null)}
          >
            <Text style={[styles.actionButtonText, { color: colors.text }]}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.primaryButton, styles.gradientButton]}
            onPress={handleSaveDispatch}
          >
            <LinearGradient
              colors={['#1B4D6E', '#245d82']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gradientInner}
            >
              <Text style={[styles.actionButtonText, { color: '#fff' }]}>Save Dispatch</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={styles.headerLeft}>
            <Users2 size={24} color={colors.primary} />
            <Text style={[styles.headerTitle, { color: colors.text }]}>Team Dispatch</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {dispatchResult ? (
          renderDispatchResult()
        ) : (
          <View style={styles.content}>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Select Team Members</Text>
                <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                  {selectedMembers.size} selected
                </Text>
              </View>

              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              ) : teamMembers.length === 0 ? (
                <View style={styles.emptyState}>
                  <AlertCircle size={48} color={colors.textSecondary} />
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    No team members found
                  </Text>
                  <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                    Add team members to your organization first
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={teamMembers}
                  renderItem={renderMemberItem}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.membersList}
                />
              )}
            </View>

            <View style={[styles.infoCard, { backgroundColor: colors.primaryLight }]}>
              <Text style={[styles.infoText, { color: colors.text }]}>
                {locations.length} locations will be distributed among {selectedMembers.size} team member
                {selectedMembers.size !== 1 ? 's' : ''}
              </Text>
            </View>

            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.inputBackground }]}
                onPress={onClose}
              >
                <Text style={[styles.actionButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  styles.primaryButton,
                  styles.gradientButton,
                  (dispatching || selectedMembers.size === 0) && styles.disabledButton,
                ]}
                onPress={handleDispatch}
                disabled={dispatching || selectedMembers.size === 0}
              >
                <LinearGradient
                  colors={['#1B4D6E', '#245d82']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.gradientInner}
                >
                  {dispatching ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={[styles.actionButtonText, { color: '#fff' }]}>Dispatch Routes</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    flex: 1,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  sectionSubtitle: {
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  membersList: {
    gap: 12,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  memberDetails: {
    flex: 1,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  memberRole: {
    fontSize: 13,
    textTransform: 'capitalize',
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  infoText: {
    fontSize: 14,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    flex: 2,
  },
  disabledButton: {
    opacity: 0.5,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  resultContainer: {
    flex: 1,
    padding: 16,
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  resultSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  assignmentsList: {
    flex: 1,
    marginBottom: 16,
  },
  assignmentCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  assignmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  assignmentMemberName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  assignmentStats: {
    fontSize: 13,
  },
  stopsPreview: {
    gap: 6,
  },
  stopItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stopLabel: {
    fontSize: 13,
    flex: 1,
  },
  moreStops: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
  resultActions: {
    flexDirection: 'row',
    gap: 12,
  },
  gradientButton: {
    overflow: 'hidden',
    padding: 0,
  },
  gradientInner: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
