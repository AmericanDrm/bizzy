import { supabase } from './supabase';

export interface ScheduleSlot {
  date: string;
  startTime: string;
  endTime: string;
  teamMemberId?: string;
  isBooked: boolean;
}

export interface RouteScheduleSuggestion {
  date: string;
  startTime: string;
  endTime: string;
  teamMemberId?: string;
  score: number;
  reason: string;
  extraDriveTime: number;
  totalRouteDuration: number;
  conflictCount: number;
  withinClientHours: boolean;
}

export interface RouteStopRef {
  clientId?: string;
  clientAddressId?: string;
}

export interface ScheduleAnalysisOptions {
  month: number;
  year: number;
  preferredDaysOfWeek?: number[];
  preferredTimeStart?: string;
  preferredTimeEnd?: string;
  teamMemberId?: string;
  routeDuration: number;
  minBufferMinutes?: number;
  routeStops?: RouteStopRef[];
}

interface ExistingEvent {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  assigned_to?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
}

function parseTime(timeStr: string): number {
  const match = timeStr.match(/(\d+):(\d+)(?:\s*(AM|PM))?/i);
  if (!match) return 0;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const meridiem = match[3]?.toUpperCase();

  if (meridiem === 'PM' && hours !== 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;

  return hours * 60 + minutes;
}

function formatTime(minutes: number): string {
  const hours24 = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  const hours12 = hours24 % 12 || 12;
  const meridiem = hours24 >= 12 ? 'PM' : 'AM';

  return `${hours12}:${mins.toString().padStart(2, '0')} ${meridiem}`;
}

function getDayOfWeek(dateStr: string): number {
  return new Date(dateStr + 'T00:00:00').getDay();
}

function isTimeSlotAvailable(
  date: string,
  startMinutes: number,
  endMinutes: number,
  existingEvents: ExistingEvent[],
  bufferMinutes: number = 30
): { available: boolean; conflictCount: number } {
  const dayEvents = existingEvents.filter((e) => e.date === date);

  let conflictCount = 0;

  for (const event of dayEvents) {
    const eventStart = parseTime(event.start_time);
    const eventEnd = parseTime(event.end_time);

    const proposedStart = startMinutes - bufferMinutes;
    const proposedEnd = endMinutes + bufferMinutes;

    if (
      (proposedStart >= eventStart && proposedStart < eventEnd) ||
      (proposedEnd > eventStart && proposedEnd <= eventEnd) ||
      (proposedStart <= eventStart && proposedEnd >= eventEnd)
    ) {
      conflictCount++;
    }
  }

  return { available: conflictCount === 0, conflictCount };
}

function getDaysInMonth(year: number, month: number): string[] {
  const days: string[] = [];
  const date = new Date(year, month - 1, 1);

  while (date.getMonth() === month - 1) {
    days.push(date.toISOString().split('T')[0]);
    date.setDate(date.getDate() + 1);
  }

  return days;
}

function scoreTimeSlot(
  date: string,
  startMinutes: number,
  endMinutes: number,
  preferredStart: number,
  preferredEnd: number,
  dayOfWeek: number,
  preferredDays: number[],
  conflictCount: number,
  existingEvents: ExistingEvent[],
  clientWindowStart: number | null,
  clientWindowEnd: number | null
): { score: number; reason: string; withinClientHours: boolean } {
  let score = 100;
  const reasons: string[] = [];

  if (conflictCount > 0) {
    score -= conflictCount * 30;
    reasons.push(`${conflictCount} conflict${conflictCount > 1 ? 's' : ''}`);
  }

  if (preferredDays.length > 0 && !preferredDays.includes(dayOfWeek)) {
    score -= 15;
  } else if (preferredDays.includes(dayOfWeek)) {
    reasons.push('Preferred day');
  }

  const timeDeviation = Math.abs(startMinutes - preferredStart);
  if (timeDeviation > 60) {
    score -= Math.min(timeDeviation / 30, 20);
  } else if (timeDeviation <= 15) {
    reasons.push('Ideal time');
  }

  if (dayOfWeek === 0 || dayOfWeek === 6) {
    score -= 10;
  }

  const dayEvents = existingEvents.filter((e) => e.date === date);
  if (dayEvents.length === 0) {
    score += 10;
    reasons.push('Clear schedule');
  } else if (dayEvents.length > 3) {
    score -= 10;
  }

  let withinClientHours = true;
  if (clientWindowStart !== null && clientWindowEnd !== null) {
    if (startMinutes >= clientWindowStart && endMinutes <= clientWindowEnd) {
      score += 20;
      reasons.push('Within client hours');
    } else {
      score -= 25;
      withinClientHours = false;
      reasons.push('Outside client hours');
    }
  }

  const today = new Date().toISOString().split('T')[0];
  if (date < today) {
    score = -100;
  }

  return {
    score: Math.max(0, score),
    reason: reasons.length > 0 ? reasons.join(', ') : 'Available',
    withinClientHours,
  };
}

async function resolveClientServiceWindow(
  organizationId: string,
  routeStops: RouteStopRef[]
): Promise<{ windowStart: number | null; windowEnd: number | null }> {
  const clientIds = [...new Set(routeStops.map((s) => s.clientId).filter(Boolean) as string[])];
  const addressIds = [...new Set(routeStops.map((s) => s.clientAddressId).filter(Boolean) as string[])];

  if (clientIds.length === 0 && addressIds.length === 0) {
    return { windowStart: null, windowEnd: null };
  }

  let latestStart = 0;
  let earliestEnd = 24 * 60;
  let hasAnyWindow = false;

  if (clientIds.length > 0) {
    const { data: clients } = await supabase
      .from('clients')
      .select('id, commercial_service_window_start, commercial_service_window_end')
      .in('id', clientIds)
      .eq('organization_id', organizationId);

    for (const client of clients || []) {
      if (client.commercial_service_window_start && client.commercial_service_window_end) {
        const ws = parseTime(client.commercial_service_window_start);
        const we = parseTime(client.commercial_service_window_end);
        if (ws < we) {
          hasAnyWindow = true;
          if (ws > latestStart) latestStart = ws;
          if (we < earliestEnd) earliestEnd = we;
        }
      }
    }
  }

  if (addressIds.length > 0) {
    const { data: addresses } = await supabase
      .from('client_addresses')
      .select('id, client_id, service_window_start, service_window_end, use_client_service_window')
      .in('id', addressIds);

    const addressClientIds = [...new Set(
      (addresses || []).filter((a) => a.use_client_service_window !== false).map((a) => a.client_id).filter(Boolean)
    )];

    let clientWindowMap: Record<string, { start: string; end: string }> = {};
    if (addressClientIds.length > 0) {
      const { data: addrClients } = await supabase
        .from('clients')
        .select('id, commercial_service_window_start, commercial_service_window_end')
        .in('id', addressClientIds)
        .eq('organization_id', organizationId);

      for (const c of addrClients || []) {
        if (c.commercial_service_window_start && c.commercial_service_window_end) {
          clientWindowMap[c.id] = {
            start: c.commercial_service_window_start,
            end: c.commercial_service_window_end,
          };
        }
      }
    }

    for (const addr of addresses || []) {
      let wsStr: string | null = null;
      let weStr: string | null = null;

      if (addr.use_client_service_window !== false && clientWindowMap[addr.client_id]) {
        wsStr = clientWindowMap[addr.client_id].start;
        weStr = clientWindowMap[addr.client_id].end;
      } else if (addr.service_window_start && addr.service_window_end) {
        wsStr = addr.service_window_start;
        weStr = addr.service_window_end;
      }

      if (wsStr && weStr) {
        const ws = parseTime(wsStr);
        const we = parseTime(weStr);
        if (ws < we) {
          hasAnyWindow = true;
          if (ws > latestStart) latestStart = ws;
          if (we < earliestEnd) earliestEnd = we;
        }
      }
    }
  }

  if (!hasAnyWindow || latestStart >= earliestEnd) {
    return { windowStart: null, windowEnd: null };
  }

  return { windowStart: latestStart, windowEnd: earliestEnd };
}

export async function resolvePerStopServiceWindows(
  organizationId: string,
  routeStops: RouteStopRef[]
): Promise<Map<string, { start: string; end: string }>> {
  const result = new Map<string, { start: string; end: string }>();
  const clientIds = [...new Set(routeStops.map((s) => s.clientId).filter(Boolean) as string[])];
  const addressIds = [...new Set(routeStops.map((s) => s.clientAddressId).filter(Boolean) as string[])];

  if (clientIds.length === 0 && addressIds.length === 0) return result;

  let clientWindowMap: Record<string, { start: string; end: string }> = {};

  if (clientIds.length > 0) {
    const { data: clients } = await supabase
      .from('clients')
      .select('id, commercial_service_window_start, commercial_service_window_end')
      .in('id', clientIds)
      .eq('organization_id', organizationId);

    for (const c of clients || []) {
      if (c.commercial_service_window_start && c.commercial_service_window_end) {
        clientWindowMap[c.id] = { start: c.commercial_service_window_start, end: c.commercial_service_window_end };
      }
    }
  }

  let addressMap: Record<string, { clientId: string; start: string | null; end: string | null; useClient: boolean }> = {};

  if (addressIds.length > 0) {
    const { data: addresses } = await supabase
      .from('client_addresses')
      .select('id, client_id, service_window_start, service_window_end, use_client_service_window')
      .in('id', addressIds);

    for (const a of addresses || []) {
      addressMap[a.id] = {
        clientId: a.client_id,
        start: a.service_window_start,
        end: a.service_window_end,
        useClient: a.use_client_service_window !== false,
      };
    }

    const needsClientLookup = [...new Set(
      Object.values(addressMap).filter(a => a.useClient && !clientWindowMap[a.clientId]).map(a => a.clientId)
    )];

    if (needsClientLookup.length > 0) {
      const { data: extraClients } = await supabase
        .from('clients')
        .select('id, commercial_service_window_start, commercial_service_window_end')
        .in('id', needsClientLookup)
        .eq('organization_id', organizationId);

      for (const c of extraClients || []) {
        if (c.commercial_service_window_start && c.commercial_service_window_end) {
          clientWindowMap[c.id] = { start: c.commercial_service_window_start, end: c.commercial_service_window_end };
        }
      }
    }
  }

  for (const stop of routeStops) {
    const key = stop.clientAddressId || stop.clientId || '';
    if (!key) continue;

    let window: { start: string; end: string } | null = null;

    if (stop.clientAddressId && addressMap[stop.clientAddressId]) {
      const addrInfo = addressMap[stop.clientAddressId];
      if (addrInfo.useClient && clientWindowMap[addrInfo.clientId]) {
        window = clientWindowMap[addrInfo.clientId];
      } else if (addrInfo.start && addrInfo.end) {
        window = { start: addrInfo.start, end: addrInfo.end };
      }
    } else if (stop.clientId && clientWindowMap[stop.clientId]) {
      window = clientWindowMap[stop.clientId];
    }

    if (window) {
      result.set(key, window);
    }
  }

  return result;
}

export async function analyzeScheduleForRoute(
  organizationId: string,
  options: ScheduleAnalysisOptions
): Promise<RouteScheduleSuggestion[]> {
  const {
    month,
    year,
    preferredDaysOfWeek = [1, 2, 3, 4, 5],
    preferredTimeStart = '09:00 AM',
    preferredTimeEnd = '03:00 PM',
    teamMemberId,
    routeDuration,
    minBufferMinutes = 30,
    routeStops = [],
  } = options;

  const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
  const endDate = new Date(year, month, 0).toISOString().split('T')[0];

  let query = supabase
    .from('schedule_events')
    .select('id, date, start_time, end_time, assigned_to, location, latitude, longitude')
    .eq('organization_id', organizationId)
    .gte('date', startDate)
    .lte('date', endDate);

  if (teamMemberId) {
    query = query.eq('assigned_to', teamMemberId);
  }

  const [eventsResult, clientWindow] = await Promise.all([
    query,
    routeStops.length > 0
      ? resolveClientServiceWindow(organizationId, routeStops)
      : Promise.resolve({ windowStart: null, windowEnd: null }),
  ]);

  if (eventsResult.error) {
    console.error('Error fetching schedule events:', eventsResult.error);
    return [];
  }

  const existingEvents = (eventsResult.data || []) as ExistingEvent[];
  const daysInMonth = getDaysInMonth(year, month);

  let preferredStartMinutes = parseTime(preferredTimeStart);
  let preferredEndMinutes = parseTime(preferredTimeEnd);

  if (clientWindow.windowStart !== null && clientWindow.windowEnd !== null) {
    preferredStartMinutes = Math.max(preferredStartMinutes, clientWindow.windowStart);
    preferredEndMinutes = Math.min(preferredEndMinutes, clientWindow.windowEnd);
    if (preferredStartMinutes >= preferredEndMinutes) {
      preferredStartMinutes = clientWindow.windowStart;
      preferredEndMinutes = clientWindow.windowEnd;
    }
  }

  const suggestions: RouteScheduleSuggestion[] = [];

  for (const date of daysInMonth) {
    const dayOfWeek = getDayOfWeek(date);

    const possibleStarts: number[] = [];

    for (let t = preferredStartMinutes; t <= preferredEndMinutes - routeDuration; t += 30) {
      possibleStarts.push(t);
    }

    if (possibleStarts.length === 0) {
      possibleStarts.push(preferredStartMinutes);
    }

    for (const startMinutes of possibleStarts) {
      const endMinutes = startMinutes + routeDuration;

      const { available, conflictCount } = isTimeSlotAvailable(
        date,
        startMinutes,
        endMinutes,
        existingEvents,
        minBufferMinutes
      );

      const { score, reason, withinClientHours } = scoreTimeSlot(
        date,
        startMinutes,
        endMinutes,
        preferredStartMinutes,
        preferredEndMinutes,
        dayOfWeek,
        preferredDaysOfWeek,
        conflictCount,
        existingEvents,
        clientWindow.windowStart,
        clientWindow.windowEnd
      );

      if (score >= 0) {
        suggestions.push({
          date,
          startTime: formatTime(startMinutes),
          endTime: formatTime(endMinutes),
          teamMemberId,
          score,
          reason,
          extraDriveTime: 0,
          totalRouteDuration: routeDuration,
          conflictCount,
          withinClientHours,
        });
      }
    }
  }

  suggestions.sort((a, b) => b.score - a.score);

  return suggestions.slice(0, 10);
}

export function formatScheduleSuggestion(suggestion: RouteScheduleSuggestion): string {
  const date = new Date(suggestion.date + 'T00:00:00');
  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const hours = Math.floor(suggestion.totalRouteDuration / 60);
  const minutes = suggestion.totalRouteDuration % 60;
  const durationStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  return `${dateStr} at ${suggestion.startTime} (${durationStr})`;
}

export async function getNextAvailableSlots(
  organizationId: string,
  routeDuration: number = 120,
  daysAhead: number = 14,
  routeStops: RouteStopRef[] = []
): Promise<RouteScheduleSuggestion[]> {
  const today = new Date();
  const futureDate = new Date(today);
  futureDate.setDate(today.getDate() + daysAhead);

  const startDateStr = today.toISOString().split('T')[0];
  const endDateStr = futureDate.toISOString().split('T')[0];

  const [eventsResult, clientWindow] = await Promise.all([
    supabase
      .from('schedule_events')
      .select('id, date, start_time, end_time, assigned_to, location, latitude, longitude')
      .eq('organization_id', organizationId)
      .gte('date', startDateStr)
      .lte('date', endDateStr),
    routeStops.length > 0
      ? resolveClientServiceWindow(organizationId, routeStops)
      : Promise.resolve({ windowStart: null, windowEnd: null }),
  ]);

  const existingEvents = (eventsResult.data || []) as ExistingEvent[];

  const fallbackStartTimes = [480, 510, 540, 570, 600, 630, 660, 690, 720, 750, 780, 810, 840, 870, 900];

  let baseStartTimes: number[];
  if (clientWindow.windowStart !== null) {
    const windowEnd = clientWindow.windowEnd ?? 1020;
    const latestStart = windowEnd - routeDuration;
    if (latestStart >= clientWindow.windowStart) {
      baseStartTimes = generateStartTimes(clientWindow.windowStart, latestStart);
    } else {
      baseStartTimes = fallbackStartTimes;
    }
  } else {
    baseStartTimes = fallbackStartTimes;
  }

  if (baseStartTimes.length === 0) {
    baseStartTimes = fallbackStartTimes;
  }

  const suggestions: RouteScheduleSuggestion[] = [];

  for (let i = 0; i <= daysAhead; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay();

    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    const nowMinutes = i === 0 ? new Date().getHours() * 60 + new Date().getMinutes() + 30 : 0;

    for (const startMinutes of baseStartTimes) {
      if (i === 0 && startMinutes < nowMinutes) continue;

      const endMinutes = startMinutes + routeDuration;

      const { available } = isTimeSlotAvailable(dateStr, startMinutes, endMinutes, existingEvents, 0);

      if (available) {
        const withinClientHours =
          clientWindow.windowStart === null ||
          (startMinutes >= clientWindow.windowStart && endMinutes <= (clientWindow.windowEnd ?? Infinity));

        suggestions.push({
          date: dateStr,
          startTime: formatTime(startMinutes),
          endTime: formatTime(endMinutes),
          score: 100 - i * 5,
          reason: withinClientHours ? 'Next available slot' : 'Next available (outside client hours)',
          extraDriveTime: 0,
          totalRouteDuration: routeDuration,
          conflictCount: 0,
          withinClientHours,
        });
        break;
      }
    }
  }

  return suggestions.slice(0, 5);
}

export interface SmartScheduleSuggestion extends RouteScheduleSuggestion {
  isSegmented: boolean;
  segmentBreakdown?: {
    label: string;
    startTime: string;
    endTime: string;
    stopCount: number;
    isFixed: boolean;
  }[];
}

export async function getSmartScheduleSlots(
  organizationId: string,
  route: { stops: { clientId?: string; clientAddressId?: string; durationAtStop?: number; label: string; latitude: number; longitude: number; serviceWindow?: { start: string; end: string } }[]; totalDuration: number; totalDistance: number },
  daysAhead: number = 14
): Promise<SmartScheduleSuggestion[]> {
  const today = new Date();
  const futureDate = new Date(today);
  futureDate.setDate(today.getDate() + daysAhead);
  const startDateStr = today.toISOString().split('T')[0];
  const endDateStr = futureDate.toISOString().split('T')[0];

  const { data: existingEventsData } = await supabase
    .from('schedule_events')
    .select('id, date, start_time, end_time, assigned_to, location, latitude, longitude')
    .eq('organization_id', organizationId)
    .gte('date', startDateStr)
    .lte('date', endDateStr);

  const existingEvents = (existingEventsData || []) as ExistingEvent[];

  const fixedStops = route.stops.filter(s => s.serviceWindow);
  const flexStops = route.stops.filter(s => !s.serviceWindow);
  const hasFixed = fixedStops.length > 0;

  if (!hasFixed) {
    const baseStartTimes = [540, 570, 600, 660, 720, 780];
    const suggestions: SmartScheduleSuggestion[] = [];

    for (let i = 0; i <= daysAhead; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      if (date.getDay() === 0 || date.getDay() === 6) continue;

      for (const startMin of baseStartTimes) {
        const endMin = startMin + route.totalDuration;
        const { available } = isTimeSlotAvailable(dateStr, startMin, endMin, existingEvents, 15);
        if (available) {
          suggestions.push({
            date: dateStr,
            startTime: formatTime(startMin),
            endTime: formatTime(endMin),
            score: 100 - i * 5,
            reason: 'Next available slot',
            extraDriveTime: 0,
            totalRouteDuration: route.totalDuration,
            conflictCount: 0,
            withinClientHours: true,
            isSegmented: false,
          });
          break;
        }
      }
      if (suggestions.length >= 5) break;
    }
    return suggestions;
  }

  const suggestions: SmartScheduleSuggestion[] = [];

  const fixedWindows = fixedStops.map(s => ({
    stop: s,
    windowStart: parseTime(s.serviceWindow!.start),
    windowEnd: parseTime(s.serviceWindow!.end),
  })).sort((a, b) => a.windowStart - b.windowStart);

  let flexDuration = 0;
  for (const s of flexStops) flexDuration += (s.durationAtStop || 30);
  const avgTravelPerStop = route.stops.length > 1 ? Math.ceil((route.totalDuration - route.stops.reduce((sum, s) => sum + (s.durationAtStop || 30), 0)) / (route.stops.length - 1)) : 10;
  const flexTravelTime = flexStops.length * avgTravelPerStop;
  const totalFlexNeeded = flexDuration + flexTravelTime;

  const earliestFixed = fixedWindows[0].windowStart;
  const latestFixedEnd = fixedWindows[fixedWindows.length - 1].windowEnd;

  for (let i = 0; i <= daysAhead; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    const possibleStarts = [
      Math.max(480, earliestFixed - totalFlexNeeded - 30),
      Math.max(480, earliestFixed - totalFlexNeeded),
      540,
      600,
    ];

    for (const dayStart of [...new Set(possibleStarts)].sort((a, b) => a - b)) {
      const beforeFixedGap = earliestFixed - dayStart;
      const afterFixedGap = Math.max(0, 1080 - latestFixedEnd);
      const totalFlexGap = beforeFixedGap + afterFixedGap;

      let gapBetweenFixed = 0;
      for (let f = 0; f < fixedWindows.length - 1; f++) {
        gapBetweenFixed += fixedWindows[f + 1].windowStart - fixedWindows[f].windowEnd;
      }
      const totalAvailableGap = totalFlexGap + gapBetweenFixed;

      if (totalAvailableGap < totalFlexNeeded) continue;

      const segmentBreakdown: SmartScheduleSuggestion['segmentBreakdown'] = [];
      let flexRemaining = flexStops.length;
      let currentT = dayStart;

      if (beforeFixedGap > avgTravelPerStop + 30 && flexRemaining > 0) {
        const fitCount = Math.min(flexRemaining, Math.floor(beforeFixedGap / (30 + avgTravelPerStop)));
        if (fitCount > 0) {
          const segEnd = currentT + fitCount * (30 + avgTravelPerStop);
          segmentBreakdown.push({
            label: `${fitCount} stop${fitCount > 1 ? 's' : ''} before fixed window`,
            startTime: formatTime(currentT),
            endTime: formatTime(Math.min(segEnd, earliestFixed)),
            stopCount: fitCount,
            isFixed: false,
          });
          flexRemaining -= fitCount;
          currentT = Math.min(segEnd, earliestFixed);
        }
      }

      for (const fw of fixedWindows) {
        segmentBreakdown.push({
          label: fw.stop.label,
          startTime: formatTime(fw.windowStart),
          endTime: formatTime(fw.windowEnd),
          stopCount: 1,
          isFixed: true,
        });
        currentT = fw.windowEnd;
      }

      if (flexRemaining > 0) {
        const segEnd = currentT + flexRemaining * (30 + avgTravelPerStop);
        segmentBreakdown.push({
          label: `${flexRemaining} stop${flexRemaining > 1 ? 's' : ''} after fixed window`,
          startTime: formatTime(currentT),
          endTime: formatTime(segEnd),
          stopCount: flexRemaining,
          isFixed: false,
        });
        currentT = segEnd;
      }

      const dayEndMin = currentT;
      const allSegmentsOk = segmentBreakdown.every(seg => {
        const segStart = parseTime(seg.startTime);
        const segEnd = parseTime(seg.endTime);
        const { available } = isTimeSlotAvailable(dateStr, segStart, segEnd, existingEvents, 10);
        return available;
      });

      if (!allSegmentsOk) continue;

      suggestions.push({
        date: dateStr,
        startTime: formatTime(dayStart),
        endTime: formatTime(dayEndMin),
        score: 100 - i * 5 + (beforeFixedGap >= totalFlexNeeded ? 10 : 0),
        reason: `Fits around ${fixedStops.length} fixed window${fixedStops.length > 1 ? 's' : ''}`,
        extraDriveTime: 0,
        totalRouteDuration: dayEndMin - dayStart,
        conflictCount: 0,
        withinClientHours: true,
        isSegmented: true,
        segmentBreakdown,
      });
      break;
    }

    if (suggestions.length >= 5) break;
  }

  return suggestions;
}

function generateStartTimes(windowStart: number, windowEnd: number): number[] {
  const times: number[] = [];
  for (let t = windowStart; t <= windowEnd; t += 30) {
    times.push(t);
  }
  if (times.length === 0) times.push(windowStart);
  return times;
}
