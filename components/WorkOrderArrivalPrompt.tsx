import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { FileText, X, MapPin } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import WorkOrderSheet from './WorkOrderSheet';
import WorkOrderFieldsModal from './WorkOrderFieldsModal';
import { PushNotificationService } from '@/lib/pushNotificationService';

interface NearbyWorkOrder {
  id: string;
  client_name: string;
  client_phone: string;
  job_type: string;
  scope: string;
  notes: string;
  status: string;
  scheduled_date: string;
  scheduled_time: string;
  location: string;
  address: string;
  crew_size: number;
  amount: number;
  visible_fields: string[];
  custom_fields: Record<string, string>;
  schedule_event_id: string | null;
}

interface WorkOrderArrivalPromptProps {
  latitude?: number | null;
  longitude?: number | null;
}

const PROXIMITY_THRESHOLD_METERS = 200;

function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function WorkOrderArrivalPrompt({ latitude, longitude }: WorkOrderArrivalPromptProps) {
  const [nearbyOrder, setNearbyOrder] = useState<NearbyWorkOrder | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [sheetVisible, setSheetVisible] = useState(false);
  const [fieldsModalVisible, setFieldsModalVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const { colors } = useTheme();
  const { user } = useAuth();
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkNearbyWorkOrders = async () => {
    if (!latitude || !longitude || !user?.id) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('work_orders')
        .select('*')
        .eq('scheduled_date', today)
        .eq('status', 'pending')
        .eq('arrival_notified', false);

      if (error || !data || data.length === 0) return;

      const eventIds = data.filter((wo) => wo.schedule_event_id).map((wo) => wo.schedule_event_id);
      if (eventIds.length === 0) return;

      const { data: events } = await supabase
        .from('schedule_events')
        .select('id, latitude, longitude')
        .in('id', eventIds);

      const eventMap = new Map<string, { latitude: number; longitude: number }>();
      (events || []).forEach((e: any) => {
        if (e.latitude && e.longitude) {
          eventMap.set(e.id, { latitude: Number(e.latitude), longitude: Number(e.longitude) });
        }
      });

      for (const wo of data) {
        if (dismissed.has(wo.id)) continue;
        if (!wo.schedule_event_id) continue;

        const eventLoc = eventMap.get(wo.schedule_event_id);
        if (!eventLoc) continue;

        const distance = getDistanceMeters(latitude, longitude, eventLoc.latitude, eventLoc.longitude);
        if (distance <= PROXIMITY_THRESHOLD_METERS) {
          setNearbyOrder(wo);
          showPrompt();

          await supabase
            .from('work_orders')
            .update({ arrival_notified: true })
            .eq('id', wo.id);

          if (user?.id) {
            PushNotificationService.triggerWorkOrderArrival(
              user.id,
              wo.client_name,
              wo.id
            ).catch(() => {});
          }

          return;
        }
      }
    } catch {
    }
  };

  useEffect(() => {
    if (!latitude || !longitude || !user?.id) return;
    checkNearbyWorkOrders();
    checkIntervalRef.current = setInterval(checkNearbyWorkOrders, 60000);
    return () => {
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    };
  }, [latitude, longitude, user?.id]);

  const showPrompt = () => {
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 50,
      friction: 8,
    }).start();
  };

  const hidePrompt = () => {
    Animated.timing(slideAnim, {
      toValue: -100,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      if (nearbyOrder) {
        setDismissed((prev) => new Set(prev).add(nearbyOrder.id));
      }
      setNearbyOrder(null);
    });
  };

  const handleView = () => {
    setSheetVisible(true);
    Animated.timing(slideAnim, {
      toValue: -100,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const handleEditFields = () => {
    setSheetVisible(false);
    setFieldsModalVisible(true);
  };

  const handleFieldsSaved = async () => {
    setFieldsModalVisible(false);
    if (nearbyOrder) {
      const { data } = await supabase
        .from('work_orders')
        .select('*')
        .eq('id', nearbyOrder.id)
        .maybeSingle();
      if (data) setNearbyOrder(data);
    }
  };

  if (!nearbyOrder && !sheetVisible) return null;

  return (
    <>
      {nearbyOrder && !sheetVisible && (
        <Animated.View
          style={[
            styles.promptContainer,
            {
              backgroundColor: colors.primary,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.promptContent}>
            <View style={styles.promptLeft}>
              <View style={styles.iconCircle}>
                <MapPin size={18} color="#fff" />
              </View>
              <View style={styles.promptText}>
                <Text style={styles.promptTitle}>You've arrived!</Text>
                <Text style={styles.promptSubtitle} numberOfLines={1}>
                  View work order for {nearbyOrder.client_name}
                </Text>
              </View>
            </View>
            <View style={styles.promptActions}>
              <TouchableOpacity style={styles.viewOrderButton} onPress={handleView}>
                <FileText size={16} color={colors.primary} />
                <Text style={[styles.viewOrderText, { color: colors.primary }]}>View</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dismissButton} onPress={hidePrompt}>
                <X size={18} color="rgba(255,255,255,0.8)" />
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      )}

      <WorkOrderSheet
        visible={sheetVisible}
        workOrder={nearbyOrder}
        onClose={() => {
          setSheetVisible(false);
          setNearbyOrder(null);
        }}
        onEditFields={handleEditFields}
      />

      {nearbyOrder && (
        <WorkOrderFieldsModal
          visible={fieldsModalVisible}
          workOrderId={nearbyOrder.id}
          currentFields={nearbyOrder.visible_fields || []}
          currentCustomFields={nearbyOrder.custom_fields || {}}
          onClose={() => setFieldsModalVisible(false)}
          onSave={handleFieldsSaved}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  promptContainer: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 0 : 50,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  promptContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  promptLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  promptText: {
    flex: 1,
  },
  promptTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  promptSubtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    marginTop: 1,
  },
  promptActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  viewOrderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  viewOrderText: {
    fontSize: 13,
    fontWeight: '700',
  },
  dismissButton: {
    padding: 4,
  },
});
