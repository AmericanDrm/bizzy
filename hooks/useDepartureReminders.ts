import { useEffect, useRef, useCallback } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { getTravelTimeMinutes, getDistanceMeters } from '@/lib/directionsService';
import { PushNotificationService } from '@/lib/pushNotificationService';

const CHECK_INTERVAL_MS = 60 * 1000;
const JOB_SITE_RADIUS_METERS = 150;
const LOOK_AHEAD_MINUTES = 120;

interface ScheduleEventRow {
  id: string;
  title: string;
  start_time: string;
  client_id: string | null;
  client?: { name: string } | null;
  latitude: number | null;
  longitude: number | null;
  location: string | null;
}

interface UserLocation {
  latitude: number;
  longitude: number;
}

async function getCurrentLocation(): Promise<UserLocation | null> {
  if (Platform.OS === 'web') {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return null;
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => resolve(null),
        { timeout: 5000, maximumAge: 60000 }
      );
    });
  }

  try {
    const Location = require('expo-location');
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  } catch {
    return null;
  }
}

export function useDepartureReminders() {
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const firedRef = useRef<Set<string>>(new Set());

  const check = useCallback(async () => {
    if (!user?.id || !currentOrganization?.id) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('departure_reminders_enabled, departure_buffer_minutes')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile?.departure_reminders_enabled) return;
    const bufferMinutes: number = profile.departure_buffer_minutes ?? 5;

    const now = new Date();
    const windowEnd = new Date(now.getTime() + LOOK_AHEAD_MINUTES * 60 * 1000);

    const { data: events } = await supabase
      .from('schedule_events')
      .select('id, title, start_time, client_id, client:clients(name), latitude, longitude, location')
      .eq('organization_id', currentOrganization.id)
      .gte('start_time', now.toISOString())
      .lte('start_time', windowEnd.toISOString())
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    if (!events || events.length === 0) return;

    const eventIds = events.map((e: any) => e.id);
    const { data: existingReminders } = await supabase
      .from('departure_reminders')
      .select('schedule_event_id, status, on_my_way_sms_sent_at')
      .eq('user_id', user.id)
      .in('schedule_event_id', eventIds);

    const alreadyHandled = new Set<string>(
      (existingReminders || [])
        .filter((r: any) => r.status === 'sent' || r.on_my_way_sms_sent_at)
        .map((r: any) => r.schedule_event_id as string)
    );

    const location = await getCurrentLocation();
    if (!location) return;

    for (const event of events as ScheduleEventRow[]) {
      if (alreadyHandled.has(event.id)) continue;
      if (firedRef.current.has(event.id)) continue;

      const jobLat = Number(event.latitude);
      const jobLon = Number(event.longitude);

      const distToJob = getDistanceMeters(
        location.latitude, location.longitude,
        jobLat, jobLon
      );

      if (distToJob <= JOB_SITE_RADIUS_METERS) continue;

      const travelMinutes = await getTravelTimeMinutes(
        location.latitude, location.longitude,
        jobLat, jobLon
      );

      const departureTime = new Date(
        new Date(event.start_time).getTime() - (travelMinutes + bufferMinutes) * 60 * 1000
      );

      if (now < departureTime) continue;

      const clientName = (event.client as any)?.name || event.title;

      await PushNotificationService.triggerDepartureReminder(
        user.id,
        clientName,
        event.start_time,
        travelMinutes,
        event.id,
        event.location || undefined
      );

      await supabase.from('departure_reminders').upsert(
        {
          user_id: user.id,
          organization_id: currentOrganization.id,
          schedule_event_id: event.id,
          estimated_travel_minutes: travelMinutes,
          scheduled_departure_at: departureTime.toISOString(),
          status: 'sent',
        },
        { onConflict: 'user_id,schedule_event_id', ignoreDuplicates: false }
      );

      firedRef.current.add(event.id);
    }
  }, [user?.id, currentOrganization?.id]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!user?.id) return;

    check();

    intervalRef.current = setInterval(check, CHECK_INTERVAL_MS);

    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextState === 'active'
      ) {
        check();
      }
      appStateRef.current = nextState;
    });

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      sub.remove();
    };
  }, [user?.id, check]);
}
