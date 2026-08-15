import { supabase } from './supabase';

interface LiveLocationUpdate {
  userId: string;
  organizationId: string;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  speed?: number;
  status?: string;
  timeEntryId?: string | null;
  clientName?: string | null;
}

export async function upsertLiveLocation(update: LiveLocationUpdate): Promise<void> {
  try {
    const { data: existing } = await supabase
      .from('crew_live_locations')
      .select('id')
      .eq('user_id', update.userId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('crew_live_locations')
        .update({
          organization_id: update.organizationId,
          latitude: update.latitude,
          longitude: update.longitude,
          accuracy: update.accuracy ?? null,
          speed: update.speed ?? 0,
          status: update.status ?? 'unknown',
          time_entry_id: update.timeEntryId ?? null,
          client_name: update.clientName ?? '',
          is_active: true,
          last_updated: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      await supabase.from('crew_live_locations').insert({
        user_id: update.userId,
        organization_id: update.organizationId,
        latitude: update.latitude,
        longitude: update.longitude,
        accuracy: update.accuracy ?? null,
        speed: update.speed ?? 0,
        status: update.status ?? 'unknown',
        time_entry_id: update.timeEntryId ?? null,
        client_name: update.clientName ?? '',
        is_active: true,
      });
    }
  } catch (error) {
    console.error('Error upserting live location:', error);
  }
}

export async function deactivateLiveLocation(userId: string): Promise<void> {
  try {
    await supabase
      .from('crew_live_locations')
      .update({
        is_active: false,
        last_updated: new Date().toISOString(),
      })
      .eq('user_id', userId);
  } catch (error) {
    console.error('Error deactivating live location:', error);
  }
}
