import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { PushNotificationService } from './pushNotificationService';
import { upsertLiveLocation } from './liveLocationService';

const BACKGROUND_LOCATION_TASK = 'background-location-task';

interface ClientGeofence {
  id: string;
  name: string;
  addressId?: string;
  latitude: number;
  longitude: number;
  scheduleEventId?: string;
}

interface BackgroundLocationData {
  userId: string;
  organizationId: string;
  timeEntryId: string;
  homeBase: { latitude: number; longitude: number } | null;
  homeBaseRadius: number;
  clients: Array<{
    id: string;
    name: string;
    latitude: number | null;
    longitude: number | null;
  }>;
  scheduledJobs: Array<{
    id: string;
    clientName: string;
    latitude: number;
    longitude: number;
    startTime?: string;
    clientId?: string;
    clientAddressId?: string;
  }>;
}

let backgroundData: BackgroundLocationData | null = null;
let lastHomeBaseCheckTime: number = 0;
let awayFromHomeBaseSince: number | null = null;
let wasAtHomeBase: boolean = false;
let stationaryLocation: { latitude: number; longitude: number; since: number } | null = null;
let initializedAtHomeBase: boolean = false;
let travelingSince: number | null = null;
let lastTravelLogTime: number = 0;
const TRAVEL_LOG_INTERVAL_MS = 120000;

// Geofence job session tracking: clientId -> active session id
const activeJobSessions: Map<string, string> = new Map();
// Track which geofences the user is currently inside
const currentGeofences: Set<string> = new Set();

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

TaskManager.defineTask(
  BACKGROUND_LOCATION_TASK,
  async ({ data, error }: TaskManager.TaskManagerTaskBody<Location.LocationObject>) => {
    if (error) {
      console.error('Background location error:', error);
      return;
    }

    if (!data || !backgroundData) {
      return;
    }

    const { locations } = data as any;
    const location = locations[0];

    if (!location) return;

    const { userId, organizationId, timeEntryId, homeBase, homeBaseRadius, clients, scheduledJobs } = backgroundData;

    try {
      const currentLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      const speed = location.coords.speed ?? 0;
      const HOME_RADIUS = homeBaseRadius > 0 ? homeBaseRadius : 100;
      const JOB_GEOFENCE_RADIUS = 150;
      const now = Date.now();

      let status = 'traveling';
      let nearestClientId: string | null = null;

      if (homeBase) {
        const distanceFromHome = calculateDistance(
          currentLocation.latitude,
          currentLocation.longitude,
          homeBase.latitude,
          homeBase.longitude
        );

        const isAtHomeBase = distanceFromHome <= HOME_RADIUS;

        if (isAtHomeBase) {
          status = 'home_base';

          if (!initializedAtHomeBase) {
            initializedAtHomeBase = true;
            wasAtHomeBase = true;
          }

          if (!wasAtHomeBase && awayFromHomeBaseSince) {
            const minutesAway = (now - awayFromHomeBaseSince) / 1000 / 60;

            if (minutesAway >= 10) {
              await supabase.from('clock_out_prompts').insert({
                user_id: userId,
                time_entry_id: timeEntryId,
                triggered_at: new Date().toISOString(),
                minutes_away: Math.round(minutesAway),
              });

              PushNotificationService.triggerClockOutReminder(
                userId,
                Math.round(minutesAway),
                timeEntryId
              ).catch(() => {});
            }
          }

          wasAtHomeBase = true;
          awayFromHomeBaseSince = null;
          travelingSince = null;
        } else {
          if (wasAtHomeBase && !awayFromHomeBaseSince) {
            awayFromHomeBaseSince = now;
            travelingSince = now;
          }
          if (!initializedAtHomeBase) {
            initializedAtHomeBase = true;
            wasAtHomeBase = false;
            if (!awayFromHomeBaseSince) awayFromHomeBaseSince = now;
          }
          wasAtHomeBase = false;
        }
      } else {
        if (!initializedAtHomeBase) {
          initializedAtHomeBase = true;
          wasAtHomeBase = false;
        }
      }

      // Build full list of geofence targets: clients + scheduled jobs with coords
      const geofenceTargets: ClientGeofence[] = [];
      for (const client of clients) {
        if (client.latitude !== null && client.longitude !== null && !isNaN(client.latitude) && !isNaN(client.longitude)) {
          geofenceTargets.push({ id: client.id, name: client.name, latitude: client.latitude, longitude: client.longitude });
        }
      }
      for (const job of scheduledJobs) {
        if (!isNaN(job.latitude) && !isNaN(job.longitude)) {
          geofenceTargets.push({
            id: job.clientId || job.id,
            name: job.clientName,
            addressId: job.clientAddressId,
            scheduleEventId: job.id,
            latitude: job.latitude,
            longitude: job.longitude,
          });
        }
      }

      const insideGeofences = new Set<string>();

      for (const target of geofenceTargets) {
        const distance = calculateDistance(
          currentLocation.latitude,
          currentLocation.longitude,
          target.latitude,
          target.longitude
        );

        if (distance <= JOB_GEOFENCE_RADIUS) {
          status = 'job_site';
          if (!nearestClientId) nearestClientId = target.id;
          insideGeofences.add(target.id);

          // Auto-create geofence job session on entry
          if (!currentGeofences.has(target.id)) {
            currentGeofences.add(target.id);
            try {
              const { data: session } = await supabase
                .from('geofence_job_sessions')
                .insert({
                  organization_id: organizationId,
                  user_id: userId,
                  time_entry_id: timeEntryId,
                  client_id: target.id !== target.scheduleEventId ? target.id : null,
                  client_address_id: target.addressId || null,
                  schedule_event_id: target.scheduleEventId || null,
                  client_name: target.name,
                  arrived_at: new Date().toISOString(),
                  arrival_latitude: currentLocation.latitude,
                  arrival_longitude: currentLocation.longitude,
                  auto_tracked: true,
                  status: 'active',
                })
                .select('id')
                .single();

              if (session?.id) {
                activeJobSessions.set(target.id, session.id);
              }

              // Notify user of auto-detected job arrival
              PushNotificationService.triggerWorkOrderArrival(
                userId,
                target.name,
                timeEntryId
              ).catch(() => {});
            } catch {}
          }
        }
      }

      // Close sessions for geofences we've left
      for (const [clientId, sessionId] of activeJobSessions.entries()) {
        if (!insideGeofences.has(clientId)) {
          currentGeofences.delete(clientId);
          activeJobSessions.delete(clientId);
          const departedAt = new Date().toISOString();
          try {
            await supabase
              .from('geofence_job_sessions')
              .update({
                departed_at: departedAt,
                status: 'completed',
                updated_at: departedAt,
              })
              .eq('id', sessionId);

            const { data: session } = await supabase
              .from('geofence_job_sessions')
              .select('arrived_at, schedule_event_id')
              .eq('id', sessionId)
              .maybeSingle();

            if (session?.arrived_at && session?.schedule_event_id) {
              const arrivedMs = new Date(session.arrived_at).getTime();
              const departedMs = new Date(departedAt).getTime();
              const actualMinutes = Math.round((departedMs - arrivedMs) / 60000);

              if (actualMinutes > 0) {
                await supabase
                  .from('schedule_events')
                  .update({ actual_duration: actualMinutes })
                  .eq('id', session.schedule_event_id);

                const { data: ev } = await supabase
                  .from('schedule_events')
                  .select('job_type_id, organization_id')
                  .eq('id', session.schedule_event_id)
                  .maybeSingle();

                if (ev?.job_type_id && ev?.organization_id) {
                  const { data: pastEvents } = await supabase
                    .from('schedule_events')
                    .select('actual_duration')
                    .eq('job_type_id', ev.job_type_id)
                    .eq('organization_id', ev.organization_id)
                    .not('actual_duration', 'is', null)
                    .limit(50);

                  if (pastEvents && pastEvents.length > 0) {
                    const totalMinutes = pastEvents.reduce(
                      (sum, e) => sum + (e.actual_duration || 0),
                      0
                    );
                    const avgMinutes = Math.round(totalMinutes / pastEvents.length);
                    await supabase
                      .from('job_types')
                      .update({ avg_duration_minutes: avgMinutes })
                      .eq('id', ev.job_type_id);
                  }
                }
              }
            }
          } catch {}
        }
      }

      if (speed > 3) {
        if (status !== 'home_base' && status !== 'job_site') {
          status = 'traveling';
          if (!travelingSince) travelingSince = now;

          if (now - lastTravelLogTime >= TRAVEL_LOG_INTERVAL_MS) {
            await supabase.from('location_tracking').insert({
              user_id: userId,
              time_entry_id: timeEntryId,
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
              accuracy: location.coords.accuracy,
              speed: speed,
              status: 'traveling',
              timestamp: new Date(location.timestamp).toISOString(),
            });
            lastTravelLogTime = now;
          }
        }
      } else if (speed < 1) {
        if (status !== 'home_base' && status !== 'job_site') {
          status = speed < 0.5 ? 'stopped' : 'idle';
        }
        travelingSince = null;
      }

      const DETECTED_LOCATION_CLUSTER_RADIUS = 50;
      const STATIONARY_THRESHOLD_MINUTES = 5;

      if (speed < 1 && status !== 'home_base' && !nearestClientId) {
        if (!stationaryLocation) {
          stationaryLocation = {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            since: Date.now(),
          };
        } else {
          const distanceFromStationary = calculateDistance(
            currentLocation.latitude,
            currentLocation.longitude,
            stationaryLocation.latitude,
            stationaryLocation.longitude
          );

          if (distanceFromStationary > DETECTED_LOCATION_CLUSTER_RADIUS) {
            stationaryLocation = {
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
              since: Date.now(),
            };
          } else {
            const minutesStationary = (Date.now() - stationaryLocation.since) / 1000 / 60;

            if (minutesStationary >= STATIONARY_THRESHOLD_MINUTES) {
              const { data: existingLocations } = await supabase
                .from('detected_locations')
                .select('id, latitude, longitude, visit_count, total_minutes, last_detected_at')
                .eq('user_id', userId)
                .eq('dismissed', false)
                .is('associated_client_id', null);

              let foundExisting = false;

              if (existingLocations && existingLocations.length > 0) {
                for (const existing of existingLocations) {
                  const distanceToExisting = calculateDistance(
                    currentLocation.latitude,
                    currentLocation.longitude,
                    parseFloat(existing.latitude.toString()),
                    parseFloat(existing.longitude.toString())
                  );

                  if (distanceToExisting <= DETECTED_LOCATION_CLUSTER_RADIUS) {
                    const lastDetected = new Date(existing.last_detected_at).getTime();
                    const minutesSinceLastDetection = (Date.now() - lastDetected) / 1000 / 60;

                    await supabase
                      .from('detected_locations')
                      .update({
                        last_detected_at: new Date().toISOString(),
                        visit_count: existing.visit_count + 1,
                        total_minutes: existing.total_minutes + Math.round(minutesStationary),
                      })
                      .eq('id', existing.id);

                    foundExisting = true;
                    break;
                  }
                }
              }

              if (!foundExisting) {
                await supabase.from('detected_locations').insert({
                  user_id: userId,
                  time_entry_id: timeEntryId,
                  latitude: currentLocation.latitude,
                  longitude: currentLocation.longitude,
                  first_detected_at: new Date(Date.now() - minutesStationary * 60 * 1000).toISOString(),
                  last_detected_at: new Date().toISOString(),
                  visit_count: 1,
                  total_minutes: Math.round(minutesStationary),
                });
              }
            }
          }
        }
      } else {
        stationaryLocation = null;
      }

      await supabase.from('location_tracking').insert({
        user_id: userId,
        time_entry_id: timeEntryId,
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        accuracy: location.coords.accuracy,
        speed: speed,
        status: status,
        timestamp: new Date(location.timestamp).toISOString(),
      });

      const nearestClient = nearestClientId
        ? clients.find(c => c.id === nearestClientId)
        : null;

      upsertLiveLocation({
        userId,
        organizationId,
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        accuracy: location.coords.accuracy,
        speed,
        status,
        timeEntryId,
        clientName: nearestClient?.name ?? null,
      }).catch(() => {});

      lastHomeBaseCheckTime = Date.now();
    } catch (error) {
      console.error('Error processing background location:', error);
    }
  }
);

let geofenceWatcherSubscription: Location.LocationSubscription | null = null;
let geofenceWatcherUserId: string | null = null;
let geofenceWatcherHomeBase: { latitude: number; longitude: number } | null = null;
let geofenceWatcherRadius: number = 100;
let wasOutsideHomeBase: boolean = true;
let lastClockInPromptTime: number = 0;
const CLOCK_IN_PROMPT_COOLDOWN_MS = 5 * 60 * 1000;

export class BackgroundLocationService {
  static async startBackgroundTracking(
    userId: string,
    timeEntryId: string,
    homeBase: { latitude: number; longitude: number } | null,
    clients: Array<{
      id: string;
      name: string;
      latitude: number | null;
      longitude: number | null;
    }>,
    organizationId?: string,
    homeBaseRadius?: number,
    scheduledJobs?: Array<{
      id: string;
      clientName: string;
      latitude: number;
      longitude: number;
      startTime?: string;
      clientId?: string;
      clientAddressId?: string;
    }>
  ): Promise<boolean> {
    try {
      if (Platform.OS === 'web') {
        return false;
      }

      const { status: foregroundStatus } =
        await Location.requestForegroundPermissionsAsync();

      if (foregroundStatus !== 'granted') {
        return false;
      }

      const { status: backgroundStatus } =
        await Location.requestBackgroundPermissionsAsync();

      if (backgroundStatus !== 'granted') {
        return false;
      }

      backgroundData = {
        userId,
        organizationId: organizationId || '',
        timeEntryId,
        homeBase,
        homeBaseRadius: homeBaseRadius ?? 100,
        clients,
        scheduledJobs: scheduledJobs ?? [],
      };

      wasAtHomeBase = false;
      initializedAtHomeBase = false;
      awayFromHomeBaseSince = null;
      travelingSince = null;
      lastTravelLogTime = 0;
      lastHomeBaseCheckTime = Date.now();
      activeJobSessions.clear();
      currentGeofences.clear();

      await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 30000,
        distanceInterval: 50,
        foregroundService: {
          notificationTitle: 'Bizzy is tracking your time',
          notificationBody: 'Location tracking is active while you are clocked in',
          notificationColor: '#2563eb',
        },
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
      });

      console.log('Background location tracking started');
      return true;
    } catch (error) {
      console.error('Error starting background location tracking:', error);
      return false;
    }
  }

  static async stopBackgroundTracking(): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        return;
      }

      const isRegistered = await TaskManager.isTaskRegisteredAsync(
        BACKGROUND_LOCATION_TASK
      );

      if (isRegistered) {
        await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
        console.log('Background location tracking stopped');
      }

      // Close all open geofence job sessions
      const now = new Date().toISOString();
      for (const [clientId, sessionId] of activeJobSessions.entries()) {
        try {
          await supabase
            .from('geofence_job_sessions')
            .update({ departed_at: now, status: 'completed', updated_at: now })
            .eq('id', sessionId);
        } catch {}
      }
      activeJobSessions.clear();
      currentGeofences.clear();

      backgroundData = null;
      wasAtHomeBase = false;
      initializedAtHomeBase = false;
      awayFromHomeBaseSince = null;
      travelingSince = null;
      lastTravelLogTime = 0;
      lastHomeBaseCheckTime = 0;
      stationaryLocation = null;
    } catch (error) {
      console.error('Error stopping background location tracking:', error);
    }
  }

  static async isTrackingActive(): Promise<boolean> {
    try {
      if (Platform.OS === 'web') {
        return false;
      }

      return await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
    } catch (error) {
      console.error('Error checking tracking status:', error);
      return false;
    }
  }

  static async startGeofenceWatcher(
    userId: string,
    homeBase: { latitude: number; longitude: number },
    homeBaseRadius: number = 100
  ): Promise<boolean> {
    if (Platform.OS === 'web') return false;

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return false;

      await this.stopGeofenceWatcher();

      geofenceWatcherUserId = userId;
      geofenceWatcherHomeBase = homeBase;
      geofenceWatcherRadius = homeBaseRadius > 0 ? homeBaseRadius : 100;
      wasOutsideHomeBase = true;

      geofenceWatcherSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 30000,
          distanceInterval: 30,
        },
        async (location) => {
          if (!geofenceWatcherHomeBase || !geofenceWatcherUserId) return;

          const dist = calculateDistance(
            location.coords.latitude,
            location.coords.longitude,
            geofenceWatcherHomeBase.latitude,
            geofenceWatcherHomeBase.longitude
          );

          const isInsideGeofence = dist <= geofenceWatcherRadius;
          const now = Date.now();

          if (isInsideGeofence && wasOutsideHomeBase) {
            wasOutsideHomeBase = false;

            const cooldownElapsed = now - lastClockInPromptTime >= CLOCK_IN_PROMPT_COOLDOWN_MS;
            if (cooldownElapsed) {
              lastClockInPromptTime = now;
              PushNotificationService.triggerClockInPrompt(geofenceWatcherUserId).catch(() => {});
            }
          } else if (!isInsideGeofence) {
            wasOutsideHomeBase = true;
          }
        }
      );

      return true;
    } catch {
      return false;
    }
  }

  static async stopGeofenceWatcher(): Promise<void> {
    try {
      if (geofenceWatcherSubscription) {
        geofenceWatcherSubscription.remove();
        geofenceWatcherSubscription = null;
      }
      geofenceWatcherUserId = null;
      geofenceWatcherHomeBase = null;
      wasOutsideHomeBase = true;
    } catch {}
  }

  static async hasBackgroundPermissions(): Promise<boolean> {
    try {
      if (Platform.OS === 'web') {
        return false;
      }

      const { status } = await Location.getBackgroundPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error checking background permissions:', error);
      return false;
    }
  }
}
