import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';

export interface LocationStop {
  id: string;
  stopId: string;
  latitude: number;
  longitude: number;
  detectedAt: string;
  stopDurationMinutes: number;
  speedMph?: number;
  contextType: 'near_job' | 'unknown_location' | 'new_location';
  promptShown: boolean;
  userResponse?: string;
  relatedClientId?: string;
  relatedScheduleId?: string;
  address?: string;
}

export interface StopDetectionConfig {
  speedThresholdMph: number;
  durationThresholdMinutes: number;
  radiusMeters: number;
}

const DEFAULT_CONFIG: StopDetectionConfig = {
  speedThresholdMph: 1,
  durationThresholdMinutes: 5,
  radiusMeters: 50,
};

export const useLocationAudit = (config: Partial<StopDetectionConfig> = {}) => {
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const [detectedStops, setDetectedStops] = useState<LocationStop[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const stopTrackingRef = useRef<Map<string, { startTime: number; location: { lat: number; lng: number } }>>(new Map());

  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  const generateStopId = (latitude: number, longitude: number, date: Date): string => {
    const dateStr = date.toISOString().split('T')[0];
    const latRounded = Math.round(latitude * 10000) / 10000;
    const lngRounded = Math.round(longitude * 10000) / 10000;
    return `${latRounded}_${lngRounded}_${dateStr}`;
  };

  const checkIfStopExists = useCallback(async (stopId: string): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      const { data, error } = await supabase
        .from('location_audit_logs')
        .select('id')
        .eq('stop_id', stopId)
        .eq('user_id', user.id)
        .maybeSingle();

      return !!data;
    } catch (error) {
      console.error('Error checking stop existence:', error);
      return false;
    }
  }, [user?.id]);

  const recordStop = useCallback(async (
    latitude: number,
    longitude: number,
    durationMinutes: number,
    contextType: 'near_job' | 'unknown_location' | 'new_location',
    speedMph?: number,
    relatedClientId?: string,
    relatedScheduleId?: string,
    address?: string,
    timeEntryId?: string
  ): Promise<LocationStop | null> => {
    if (!user?.id || !currentOrganization?.id) return null;

    const stopId = generateStopId(latitude, longitude, new Date());
    const exists = await checkIfStopExists(stopId);

    if (exists) {
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('location_audit_logs')
        .insert({
          organization_id: currentOrganization.id,
          user_id: user.id,
          time_entry_id: timeEntryId || null,
          stop_id: stopId,
          latitude,
          longitude,
          detected_at: new Date().toISOString(),
          stop_duration_minutes: durationMinutes,
          speed_mph: speedMph,
          context_type: contextType,
          prompt_shown: false,
          related_client_id: relatedClientId || null,
          related_schedule_id: relatedScheduleId || null,
          address: address || null,
        })
        .select()
        .single();

      if (error) throw error;

      const newStop: LocationStop = {
        id: data.id,
        stopId: data.stop_id,
        latitude: data.latitude,
        longitude: data.longitude,
        detectedAt: data.detected_at,
        stopDurationMinutes: data.stop_duration_minutes,
        speedMph: data.speed_mph,
        contextType: data.context_type,
        promptShown: data.prompt_shown,
        userResponse: data.user_response,
        relatedClientId: data.related_client_id,
        relatedScheduleId: data.related_schedule_id,
        address: data.address,
      };

      setDetectedStops(prev => [...prev, newStop]);
      return newStop;
    } catch (error) {
      console.error('Error recording stop:', error);
      return null;
    }
  }, [user?.id, currentOrganization?.id, checkIfStopExists]);

  const updateStopResponse = useCallback(async (
    stopId: string,
    userResponse: string
  ): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      const { error } = await supabase
        .from('location_audit_logs')
        .update({
          user_response: userResponse,
          prompt_shown: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', stopId)
        .eq('user_id', user.id);

      if (error) throw error;

      setDetectedStops(prev =>
        prev.map(stop =>
          stop.id === stopId
            ? { ...stop, userResponse, promptShown: true }
            : stop
        )
      );

      return true;
    } catch (error) {
      console.error('Error updating stop response:', error);
      return false;
    }
  }, [user?.id]);

  const detectStop = useCallback((
    latitude: number,
    longitude: number,
    speedMph: number
  ): { isStopped: boolean; durationMinutes: number } => {
    const now = Date.now();
    const stopId = generateStopId(latitude, longitude, new Date());

    if (speedMph <= finalConfig.speedThresholdMph) {
      if (!stopTrackingRef.current.has(stopId)) {
        stopTrackingRef.current.set(stopId, {
          startTime: now,
          location: { lat: latitude, lng: longitude },
        });
      }

      const stopInfo = stopTrackingRef.current.get(stopId);
      if (stopInfo) {
        const durationMs = now - stopInfo.startTime;
        const durationMinutes = Math.floor(durationMs / 60000);

        if (durationMinutes >= finalConfig.durationThresholdMinutes) {
          return { isStopped: true, durationMinutes };
        }
      }
    } else {
      stopTrackingRef.current.delete(stopId);
    }

    return { isStopped: false, durationMinutes: 0 };
  }, [finalConfig.speedThresholdMph, finalConfig.durationThresholdMinutes]);

  const clearStops = useCallback(() => {
    setDetectedStops([]);
    stopTrackingRef.current.clear();
  }, []);

  const getRecentStops = useCallback(async (hours: number = 24): Promise<LocationStop[]> => {
    if (!user?.id) return [];

    try {
      const since = new Date();
      since.setHours(since.getHours() - hours);

      const { data, error } = await supabase
        .from('location_audit_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('detected_at', since.toISOString())
        .order('detected_at', { ascending: false });

      if (error) throw error;

      return data.map(d => ({
        id: d.id,
        stopId: d.stop_id,
        latitude: d.latitude,
        longitude: d.longitude,
        detectedAt: d.detected_at,
        stopDurationMinutes: d.stop_duration_minutes,
        speedMph: d.speed_mph,
        contextType: d.context_type,
        promptShown: d.prompt_shown,
        userResponse: d.user_response,
        relatedClientId: d.related_client_id,
        relatedScheduleId: d.related_schedule_id,
        address: d.address,
      }));
    } catch (error) {
      console.error('Error fetching recent stops:', error);
      return [];
    }
  }, [user?.id]);

  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = Date.now();
      const toDelete: string[] = [];

      stopTrackingRef.current.forEach((value, key) => {
        const age = now - value.startTime;
        if (age > 3600000) {
          toDelete.push(key);
        }
      });

      toDelete.forEach(key => stopTrackingRef.current.delete(key));
    }, 300000);

    return () => clearInterval(cleanup);
  }, []);

  return {
    detectedStops,
    isTracking,
    setIsTracking,
    detectStop,
    recordStop,
    updateStopResponse,
    clearStops,
    getRecentStops,
    generateStopId,
  };
};
