import { Platform } from 'react-native';
import { supabase } from './supabase';

let ExpoCalendar: typeof import('expo-calendar') | null = null;

async function getExpoCalendar() {
  if (Platform.OS === 'web') return null;
  if (!ExpoCalendar) {
    try {
      ExpoCalendar = await import('expo-calendar');
    } catch {
      return null;
    }
  }
  return ExpoCalendar;
}

export interface CalendarSyncSettings {
  id?: string;
  user_id: string;
  organization_id?: string;
  device_calendar_id: string;
  calendar_name: string;
  sync_enabled: boolean;
  sync_direction: 'two_way' | 'app_to_calendar' | 'calendar_to_app';
  last_synced_at?: string;
}

export interface DeviceCalendar {
  id: string;
  title: string;
  source: string;
  color: string;
  allowsModifications: boolean;
}

const BIZZY_CALENDAR_TITLE = 'Bizzy';

export async function requestCalendarPermissions(): Promise<boolean> {
  const cal = await getExpoCalendar();
  if (!cal) return false;
  const { status } = await cal.requestCalendarPermissionsAsync();
  return status === 'granted';
}

export async function getDeviceCalendars(): Promise<DeviceCalendar[]> {
  const cal = await getExpoCalendar();
  if (!cal) return [];

  const hasPermission = await requestCalendarPermissions();
  if (!hasPermission) return [];

  const calendars = await cal.getCalendarsAsync(cal.EntityTypes.EVENT);
  return calendars
    .filter((c: any) => c.allowsModifications !== false)
    .map((c: any) => ({
      id: c.id,
      title: c.title || 'Untitled',
      source: c.source?.name || c.source?.type || 'Unknown',
      color: c.color || '#2563eb',
      allowsModifications: c.allowsModifications !== false,
    }));
}

export async function createBizzyCalendar(): Promise<string | null> {
  const cal = await getExpoCalendar();
  if (!cal) return null;

  const hasPermission = await requestCalendarPermissions();
  if (!hasPermission) return null;

  const calendars = await cal.getCalendarsAsync(cal.EntityTypes.EVENT);
  const existing = calendars.find((c: any) => c.title === BIZZY_CALENDAR_TITLE);
  if (existing) return existing.id;

  if (Platform.OS === 'ios') {
    const defaultCal = calendars.find(
      (c: any) => c.source?.type === 'local' || c.source?.type === 'caldav'
    );
    if (!defaultCal?.source) return null;

    const newId = await cal.createCalendarAsync({
      title: BIZZY_CALENDAR_TITLE,
      color: '#0ea5e9',
      entityType: cal.EntityTypes.EVENT,
      sourceId: defaultCal.source.id,
      source: {
        isLocalAccount: defaultCal.source.type === 'local',
        name: defaultCal.source.name,
        type: defaultCal.source.type,
      },
      name: BIZZY_CALENDAR_TITLE,
      ownerAccount: 'personal',
      accessLevel: cal.CalendarAccessLevel.OWNER,
    });
    return newId;
  }

  if (Platform.OS === 'android') {
    const localSource = calendars.find(
      (c: any) => c.accessLevel === 'owner' || c.source?.type === 'com.google'
    );
    const newId = await cal.createCalendarAsync({
      title: BIZZY_CALENDAR_TITLE,
      color: '#0ea5e9',
      entityType: cal.EntityTypes.EVENT,
      sourceId: localSource?.source?.id,
      source: localSource?.source || {
        isLocalAccount: true,
        name: BIZZY_CALENDAR_TITLE,
        type: 'local',
      },
      name: BIZZY_CALENDAR_TITLE,
      ownerAccount: 'personal',
      accessLevel: cal.CalendarAccessLevel.OWNER,
    });
    return newId;
  }

  return null;
}

export async function loadSyncSettings(userId: string): Promise<CalendarSyncSettings | null> {
  const { data } = await supabase
    .from('calendar_sync_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  return data;
}

export async function saveSyncSettings(settings: CalendarSyncSettings): Promise<void> {
  const { id, ...rest } = settings;
  if (id) {
    await supabase
      .from('calendar_sync_settings')
      .update({ ...rest, updated_at: new Date().toISOString() })
      .eq('id', id);
  } else {
    await supabase.from('calendar_sync_settings').insert(rest);
  }
}

export async function syncEventToDevice(
  syncSettings: CalendarSyncSettings,
  eventData: {
    id: string;
    title: string;
    description?: string;
    start_time: string;
    end_time: string;
    location?: string;
    external_calendar_event_id?: string | null;
  }
): Promise<string | null> {
  if (!syncSettings.sync_enabled) return null;
  if (syncSettings.sync_direction === 'calendar_to_app') return null;

  const cal = await getExpoCalendar();
  if (!cal) return null;

  const eventDetails = {
    title: eventData.title,
    notes: eventData.description || '',
    startDate: new Date(eventData.start_time),
    endDate: new Date(eventData.end_time),
    location: eventData.location || '',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };

  try {
    if (eventData.external_calendar_event_id) {
      await cal.updateEventAsync(eventData.external_calendar_event_id, eventDetails);
      await supabase
        .from('schedule_events')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('id', eventData.id);
      return eventData.external_calendar_event_id;
    }

    const deviceEventId = await cal.createEventAsync(
      syncSettings.device_calendar_id,
      eventDetails
    );

    await supabase
      .from('schedule_events')
      .update({
        external_calendar_event_id: deviceEventId,
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', eventData.id);

    return deviceEventId;
  } catch {
    return null;
  }
}

export async function deleteEventFromDevice(
  externalCalendarEventId: string | null | undefined
): Promise<void> {
  if (!externalCalendarEventId) return;

  const cal = await getExpoCalendar();
  if (!cal) return;

  try {
    await cal.deleteEventAsync(externalCalendarEventId);
  } catch {
    // Event may already be deleted on device
  }
}

export async function syncFromDevice(
  syncSettings: CalendarSyncSettings,
  userId: string
): Promise<{ added: number; updated: number; deleted: number }> {
  if (!syncSettings.sync_enabled) return { added: 0, updated: 0, deleted: 0 };
  if (syncSettings.sync_direction === 'app_to_calendar') return { added: 0, updated: 0, deleted: 0 };

  const cal = await getExpoCalendar();
  if (!cal) return { added: 0, updated: 0, deleted: 0 };

  let added = 0;
  let updated = 0;
  let deleted = 0;

  const now = new Date();
  const startDate = new Date(now);
  startDate.setMonth(startDate.getMonth() - 1);
  const endDate = new Date(now);
  endDate.setMonth(endDate.getMonth() + 6);

  try {
    const deviceEvents = await cal.getEventsAsync(
      [syncSettings.device_calendar_id],
      startDate,
      endDate
    );

    const { data: appEvents } = await supabase
      .from('schedule_events')
      .select('id, title, start_time, end_time, location, description, external_calendar_event_id, sync_source')
      .eq('user_id', userId)
      .gte('start_time', startDate.toISOString())
      .lte('start_time', endDate.toISOString());

    const appEventsByExtId = new Map<string, any>();
    const appEventIds = new Set<string>();
    for (const ae of appEvents || []) {
      if (ae.external_calendar_event_id) {
        appEventsByExtId.set(ae.external_calendar_event_id, ae);
      }
      appEventIds.add(ae.id);
    }

    const deviceEventIds = new Set<string>();

    for (const de of deviceEvents) {
      deviceEventIds.add(de.id);
      const existing = appEventsByExtId.get(de.id);

      if (existing) {
        const deviceStart = new Date(de.startDate).toISOString();
        const deviceEnd = new Date(de.endDate).toISOString();
        const appStart = new Date(existing.start_time).toISOString();
        const appEnd = new Date(existing.end_time).toISOString();

        const titleChanged = de.title !== existing.title;
        const timeChanged = deviceStart !== appStart || deviceEnd !== appEnd;
        const locationChanged = (de.location || '') !== (existing.location || '');

        if (titleChanged || timeChanged || locationChanged) {
          await supabase
            .from('schedule_events')
            .update({
              title: de.title || existing.title,
              start_time: deviceStart,
              end_time: deviceEnd,
              location: de.location || '',
              last_synced_at: new Date().toISOString(),
            })
            .eq('id', existing.id);
          updated++;
        }
      } else {
        const { data: dupCheck } = await supabase
          .from('schedule_events')
          .select('id')
          .eq('user_id', userId)
          .eq('title', de.title || 'Untitled')
          .eq('start_time', new Date(de.startDate).toISOString())
          .maybeSingle();

        if (!dupCheck) {
          await supabase.from('schedule_events').insert({
            user_id: userId,
            title: de.title || 'Untitled',
            description: de.notes || '',
            start_time: new Date(de.startDate).toISOString(),
            end_time: new Date(de.endDate).toISOString(),
            location: de.location || '',
            external_calendar_event_id: de.id,
            sync_source: 'device',
            last_synced_at: new Date().toISOString(),
          });
          added++;
        }
      }
    }

    for (const ae of appEvents || []) {
      if (ae.external_calendar_event_id && ae.sync_source === 'device' && !deviceEventIds.has(ae.external_calendar_event_id)) {
        await supabase
          .from('schedule_events')
          .delete()
          .eq('id', ae.id)
          .eq('user_id', userId);
        deleted++;
      }
    }

    await supabase
      .from('calendar_sync_settings')
      .update({ last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('user_id', userId);
  } catch {
    // Sync failed silently
  }

  return { added, updated, deleted };
}

export async function performFullSync(userId: string): Promise<{
  outbound: number;
  inbound: { added: number; updated: number; deleted: number };
} | null> {
  const settings = await loadSyncSettings(userId);
  if (!settings || !settings.sync_enabled) return null;

  let outbound = 0;

  if (settings.sync_direction !== 'calendar_to_app') {
    const { data: unsyncedEvents } = await supabase
      .from('schedule_events')
      .select('id, title, description, start_time, end_time, location, external_calendar_event_id')
      .eq('user_id', userId)
      .is('external_calendar_event_id', null)
      .not('sync_source', 'eq', 'device');

    for (const event of unsyncedEvents || []) {
      const result = await syncEventToDevice(settings, event);
      if (result) outbound++;
    }
  }

  const inbound = await syncFromDevice(settings, userId);

  return { outbound, inbound };
}
