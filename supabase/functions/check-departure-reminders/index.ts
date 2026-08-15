import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const JOB_SITE_RADIUS_METERS = 150;
const LOOK_AHEAD_MINUTES = 120;

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function getMapboxTravelMinutes(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
  mapboxToken: string
): Promise<number> {
  const fallback = Math.max(1, Math.round((haversineMeters(fromLat, fromLon, toLat, toLon) / 1000 / 40) * 60));
  if (!mapboxToken) return fallback;

  try {
    const url =
      `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/` +
      `${fromLon},${fromLat};${toLon},${toLat}` +
      `?access_token=${mapboxToken}&overview=false`;

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(t);

    if (!res.ok) return fallback;
    const json = await res.json();
    const secs: number | undefined = json?.routes?.[0]?.duration;
    return secs != null ? Math.max(1, Math.round(secs / 60)) : fallback;
  } catch {
    return fallback;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const mapboxToken = Deno.env.get("MAPBOX_ACCESS_TOKEN") || "";

    const supabase = createClient(supabaseUrl, serviceKey);

    const now = new Date();
    const windowEnd = new Date(now.getTime() + LOOK_AHEAD_MINUTES * 60 * 1000);

    const { data: events, error: eventsErr } = await supabase
      .from("schedule_events")
      .select(`
        id,
        title,
        start_time,
        client_id,
        latitude,
        longitude,
        location,
        assigned_to,
        organization_id
      `)
      .gte("start_time", now.toISOString())
      .lte("start_time", windowEnd.toISOString())
      .not("latitude", "is", null)
      .not("longitude", "is", null);

    if (eventsErr || !events || events.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const orgIds = [...new Set(events.map((e: any) => e.organization_id).filter(Boolean))];
    const { data: members } = await supabase
      .from("organization_members")
      .select("user_id, organization_id, role")
      .in("organization_id", orgIds);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, departure_reminders_enabled, departure_buffer_minutes")
      .in("id", (members || []).map((m: any) => m.user_id));

    const profileMap = new Map<string, { enabled: boolean; buffer: number }>(
      (profiles || []).map((p: any) => [
        p.id,
        {
          enabled: p.departure_reminders_enabled ?? true,
          buffer: p.departure_buffer_minutes ?? 5,
        },
      ])
    );

    const { data: liveLocations } = await supabase
      .from("crew_live_locations")
      .select("user_id, latitude, longitude, updated_at");

    const locationMap = new Map<string, { lat: number; lon: number }>(
      (liveLocations || [])
        .filter((l: any) => {
          const updated = new Date(l.updated_at);
          return now.getTime() - updated.getTime() < 10 * 60 * 1000;
        })
        .map((l: any) => [l.user_id, { lat: l.latitude, lon: l.longitude }])
    );

    const { data: existingReminders } = await supabase
      .from("departure_reminders")
      .select("user_id, schedule_event_id, status, on_my_way_sms_sent_at")
      .in("schedule_event_id", events.map((e: any) => e.id));

    const reminderKey = (userId: string, eventId: string) => `${userId}::${eventId}`;
    const sentSet = new Set<string>(
      (existingReminders || [])
        .filter((r: any) => r.status === "sent" || r.on_my_way_sms_sent_at)
        .map((r: any) => reminderKey(r.user_id, r.schedule_event_id))
    );

    let notified = 0;

    for (const event of events as any[]) {
      const orgId = event.organization_id;
      const orgMembers = (members || []).filter((m: any) => m.organization_id === orgId);

      const userIds: string[] = event.assigned_to
        ? [event.assigned_to]
        : orgMembers.filter((m: any) => m.role === "owner").map((m: any) => m.user_id);

      for (const userId of userIds) {
        const prefs = profileMap.get(userId);
        if (!prefs?.enabled) continue;

        const key = reminderKey(userId, event.id);
        if (sentSet.has(key)) continue;

        const userLoc = locationMap.get(userId);
        if (!userLoc) continue;

        const distToJob = haversineMeters(
          userLoc.lat, userLoc.lon,
          Number(event.latitude), Number(event.longitude)
        );

        if (distToJob <= JOB_SITE_RADIUS_METERS) continue;

        const travelMinutes = await getMapboxTravelMinutes(
          userLoc.lat, userLoc.lon,
          Number(event.latitude), Number(event.longitude),
          mapboxToken
        );

        const bufferMinutes = prefs.buffer;
        const departureTime = new Date(
          new Date(event.start_time).getTime() - (travelMinutes + bufferMinutes) * 60 * 1000
        );

        if (now < departureTime) continue;

        const { data: { users: pushTokenUsers } } = await (supabase.auth.admin as any).listUsers();
        void pushTokenUsers;

        const { data: tokenRows } = await supabase
          .from("push_tokens")
          .select("token")
          .eq("user_id", userId)
          .eq("active", true);

        const startDate = new Date(event.start_time);
        const timeStr = startDate.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });

        const title = `Time to leave for ${event.title}`;
        const addressLine = event.location ? `\n${event.location}` : "";
        const body = `Job at ${timeStr} — ~${travelMinutes} min away. Leave now to arrive on time.${addressLine}`;

        if (tokenRows && tokenRows.length > 0) {
          for (const row of tokenRows) {
            try {
              await fetch("https://exp.host/--/api/v2/push/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  to: row.token,
                  title,
                  body,
                  data: {
                    type: "departure_reminder",
                    scheduleEventId: event.id,
                    travelMinutes,
                    jobAddress: event.location ?? null,
                  },
                  sound: "default",
                  priority: "high",
                }),
              });
            } catch {}
          }
        }

        await supabase.from("departure_reminders").upsert(
          {
            user_id: userId,
            organization_id: orgId,
            schedule_event_id: event.id,
            estimated_travel_minutes: travelMinutes,
            scheduled_departure_at: departureTime.toISOString(),
            status: "sent",
          },
          { onConflict: "user_id,schedule_event_id", ignoreDuplicates: false }
        );

        sentSet.add(key);
        notified++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: events.length, notified }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
