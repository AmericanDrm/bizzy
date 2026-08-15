export interface StopServiceWindow {
  start: string;
  end: string;
}

export interface RouteLocation {
  id: string;
  label: string;
  address: string;
  latitude: number;
  longitude: number;
  clientId?: string;
  clientAddressId?: string;
  durationAtStop?: number;
  notes?: string;
  clientType?: 'residential' | 'commercial' | 'contractor';
  serviceWindow?: StopServiceWindow;
}

export interface OptimizedRoute {
  stops: RouteLocation[];
  totalDistance: number;
  totalDuration: number;
  estimatedTimes: string[];
}

export interface RouteSegment {
  stops: RouteLocation[];
  estimatedTimes: string[];
  startTime: string;
  endTime: string;
  durationMinutes: number;
  distanceMiles: number;
  isFixedWindow: boolean;
  fixedWindowLabel?: string;
}

export interface ScheduledRoutePlan {
  segments: RouteSegment[];
  totalDuration: number;
  totalDistance: number;
  date: string;
  hasFixedWindows: boolean;
}

export interface RouteEndpoint {
  label: string;
  address: string;
  latitude: number;
  longitude: number;
  isCurrentLocation?: boolean;
}

export interface RouteOptimizationOptions {
  startTime?: string;
  averageSpeedMph?: number;
  includeReturnToStart?: boolean;
  startLocation?: RouteEndpoint;
  endLocation?: RouteEndpoint;
}

function degreesToRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3959;
  const dLat = degreesToRadians(lat2 - lat1);
  const dLon = degreesToRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(degreesToRadians(lat1)) *
      Math.cos(degreesToRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const straightLine = R * c;
  // Road distance is ~1.3x straight-line in suburban/urban grids.
  // Short hops (<0.5 mi) are proportionally more circuitous, so scale up more.
  const roadFactor = straightLine < 0.5 ? 1.45 : straightLine < 2 ? 1.35 : 1.25;
  return straightLine * roadFactor;
}

export function estimateDrivingTime(distanceMiles: number, averageSpeedMph: number = 35): number {
  const baseTime = (distanceMiles / averageSpeedMph) * 60;
  // Fixed per-stop overhead (traffic lights, turns, finding parking) regardless of distance.
  // Short legs have proportionally more intersection/signal delay than open road legs.
  const intersectionDelay = distanceMiles < 1 ? 3 : distanceMiles < 3 ? 5 : 7;
  return Math.ceil(baseTime + intersectionDelay);
}

function routeTotalDistance(route: number[], locations: RouteLocation[]): number {
  let d = 0;
  for (let i = 0; i < route.length - 1; i++) {
    d += calculateHaversineDistance(
      locations[route[i]].latitude, locations[route[i]].longitude,
      locations[route[i + 1]].latitude, locations[route[i + 1]].longitude
    );
  }
  return d;
}

function nearestNeighborFrom(locations: RouteLocation[], startIndex: number): number[] {
  if (locations.length <= 1) return [0];
  if (locations.length === 2) return [0, 1];

  const unvisited = new Set(Array.from({ length: locations.length }, (_, i) => i));
  const route: number[] = [];

  let current = startIndex;
  route.push(current);
  unvisited.delete(current);

  while (unvisited.size > 0) {
    let nearestIndex = -1;
    let nearestDistance = Infinity;

    for (const candidate of unvisited) {
      const distance = calculateHaversineDistance(
        locations[current].latitude,
        locations[current].longitude,
        locations[candidate].latitude,
        locations[candidate].longitude
      );
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = candidate;
      }
    }

    if (nearestIndex !== -1) {
      route.push(nearestIndex);
      unvisited.delete(nearestIndex);
      current = nearestIndex;
    } else {
      break;
    }
  }

  return route;
}


function twoOptImprovement(route: number[], locations: RouteLocation[]): number[] {
  const improved = [...route];
  let improvement = true;
  const maxIterations = 100;
  let iterations = 0;
  const n = improved.length;

  while (improvement && iterations < maxIterations) {
    improvement = false;
    iterations++;

    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        // Edge (i -> i+1) and edge (j -> j+1).
        // When j is the last node there is no outgoing edge, so only compare
        // the inbound edge reversal cost: (i-1 -> i) vs (i-1 -> j).
        const hasNext = j < n - 1;

        const edgeA1 = i > 0
          ? calculateHaversineDistance(
              locations[improved[i - 1]].latitude, locations[improved[i - 1]].longitude,
              locations[improved[i]].latitude, locations[improved[i]].longitude
            )
          : 0;
        const edgeB1 = hasNext
          ? calculateHaversineDistance(
              locations[improved[j]].latitude, locations[improved[j]].longitude,
              locations[improved[j + 1]].latitude, locations[improved[j + 1]].longitude
            )
          : 0;

        const edgeA2 = i > 0
          ? calculateHaversineDistance(
              locations[improved[i - 1]].latitude, locations[improved[i - 1]].longitude,
              locations[improved[j]].latitude, locations[improved[j]].longitude
            )
          : 0;
        const edgeB2 = hasNext
          ? calculateHaversineDistance(
              locations[improved[i]].latitude, locations[improved[i]].longitude,
              locations[improved[j + 1]].latitude, locations[improved[j + 1]].longitude
            )
          : 0;

        const oldCost = edgeA1 + edgeB1;
        const newCost = edgeA2 + edgeB2;

        if (newCost < oldCost - 0.001) {
          const segment = improved.slice(i, j + 1).reverse();
          improved.splice(i, j - i + 1, ...segment);
          improvement = true;
        }
      }
    }
  }

  return improved;
}

// Or-Opt: try removing a chain of `segLen` stops from position i and inserting
// them after position j. This catches the "move one stop to a better slot"
// improvement that 2-opt cannot find (2-opt only reverses segments).
function orOptImprovement(route: number[], locations: RouteLocation[]): number[] {
  let improved = [...route];
  let anyImprovement = true;
  const maxPasses = 50;
  let pass = 0;

  while (anyImprovement && pass < maxPasses) {
    anyImprovement = false;
    pass++;

    for (const segLen of [1, 2, 3]) {
      const n = improved.length;
      if (n <= segLen + 1) continue;

      for (let i = 0; i < n - segLen + 1; i++) {
        // Cost of the three edges touching the segment at position i
        const prev = i > 0 ? improved[i - 1] : -1;
        const next = i + segLen < n ? improved[i + segLen] : -1;

        const removeCost =
          (prev !== -1 ? calculateHaversineDistance(
            locations[prev].latitude, locations[prev].longitude,
            locations[improved[i]].latitude, locations[improved[i]].longitude
          ) : 0) +
          (next !== -1 ? calculateHaversineDistance(
            locations[improved[i + segLen - 1]].latitude, locations[improved[i + segLen - 1]].longitude,
            locations[next].latitude, locations[next].longitude
          ) : 0) +
          (prev !== -1 && next !== -1 ? 0 : 0);

        const bridgeCost = prev !== -1 && next !== -1
          ? calculateHaversineDistance(
              locations[prev].latitude, locations[prev].longitude,
              locations[next].latitude, locations[next].longitude
            )
          : 0;

        const segSaveByRemoving = removeCost - bridgeCost;

        // Try inserting the segment after every other position
        for (let j = 0; j < n; j++) {
          if (j >= i - 1 && j <= i + segLen - 1) continue; // overlaps

          const insertAfter = improved[j];
          const insertBefore = j + 1 < n ? improved[j + 1] : -1;

          // Skip if j is adjacent to where the segment already sits
          if (insertBefore !== -1 && insertBefore === improved[i]) continue;

          const oldEdge = insertBefore !== -1
            ? calculateHaversineDistance(
                locations[insertAfter].latitude, locations[insertAfter].longitude,
                locations[insertBefore].latitude, locations[insertBefore].longitude
              )
            : 0;

          const newEdgePre = calculateHaversineDistance(
            locations[insertAfter].latitude, locations[insertAfter].longitude,
            locations[improved[i]].latitude, locations[improved[i]].longitude
          );
          const newEdgePost = insertBefore !== -1
            ? calculateHaversineDistance(
                locations[improved[i + segLen - 1]].latitude, locations[improved[i + segLen - 1]].longitude,
                locations[insertBefore].latitude, locations[insertBefore].longitude
              )
            : 0;

          const insertCost = newEdgePre + newEdgePost - oldEdge;
          const gain = segSaveByRemoving - insertCost;

          if (gain > 0.001) {
            const seg = improved.splice(i, segLen);
            const insertPos = improved.indexOf(insertAfter) + 1;
            improved.splice(insertPos, 0, ...seg);
            anyImprovement = true;
            break;
          }
        }

        if (anyImprovement) break;
      }

      if (anyImprovement) break;
    }
  }

  return improved;
}

function nearestNeighborFromPoint(
  locations: RouteLocation[],
  startLat: number,
  startLon: number
): number[] {
  if (locations.length <= 1) return locations.length === 1 ? [0] : [];

  const unvisited = new Set(Array.from({ length: locations.length }, (_, i) => i));
  const route: number[] = [];

  let curLat = startLat;
  let curLon = startLon;

  while (unvisited.size > 0) {
    let nearestIndex = -1;
    let nearestDistance = Infinity;
    for (const candidate of unvisited) {
      const distance = calculateHaversineDistance(curLat, curLon, locations[candidate].latitude, locations[candidate].longitude);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = candidate;
      }
    }
    if (nearestIndex !== -1) {
      route.push(nearestIndex);
      unvisited.delete(nearestIndex);
      curLat = locations[nearestIndex].latitude;
      curLon = locations[nearestIndex].longitude;
    } else {
      break;
    }
  }
  return route;
}

export function optimizeRoute(
  locations: RouteLocation[],
  options: RouteOptimizationOptions = {}
): OptimizedRoute {
  if (locations.length === 0) {
    return {
      stops: [],
      totalDistance: 0,
      totalDuration: 0,
      estimatedTimes: [],
    };
  }

  if (locations.length === 1) {
    return {
      stops: [...locations],
      totalDistance: 0,
      totalDuration: locations[0].durationAtStop || 30,
      estimatedTimes: [options.startTime || '09:00 AM'],
    };
  }

  const { startTime = '09:00 AM', averageSpeedMph = 35, includeReturnToStart = false, startLocation, endLocation } = options;

  // Build multiple candidate routes and keep the best one.
  // 1. Multi-start nearest neighbor (every stop as start, or fixed start point)
  // 2. 2-opt edge reversal to flatten crossing paths
  // 3. Or-Opt relocation (move 1/2/3-stop chains to better positions)
  // Running all three in sequence consistently finds near-optimal routes that
  // single-pass NN + 2-opt cannot reach.

  const buildAndRefine = (seed: number[]): number[] => {
    let r = seed;
    if (r.length >= 4) r = twoOptImprovement(r, locations);
    if (r.length >= 3) r = orOptImprovement(r, locations);
    if (r.length >= 4) r = twoOptImprovement(r, locations);
    return r;
  };

  let routeIndices: number[];

  if (startLocation) {
    // With a fixed start, try NN from the start point then refine.
    const nnFixed = nearestNeighborFromPoint(locations, startLocation.latitude, startLocation.longitude);
    routeIndices = buildAndRefine(nnFixed);
  } else {
    // Multi-start: run NN from every stop, refine each, keep the best.
    let bestRoute: number[] = [];
    let bestDist = Infinity;

    for (let s = 0; s < locations.length; s++) {
      const candidate = buildAndRefine(nearestNeighborFrom(locations, s));
      const dist = routeTotalDistance(candidate, locations);
      if (dist < bestDist) {
        bestDist = dist;
        bestRoute = candidate;
      }
    }

    routeIndices = bestRoute;
  }

  const optimizedStops: RouteLocation[] = routeIndices.map((idx) => ({
    ...locations[idx],
  }));

  let totalDistance = 0;
  let totalDuration = 0;
  const estimatedTimes: string[] = [];

  let currentTime = parseTimeString(startTime);

  if (startLocation && optimizedStops.length > 0) {
    const depDistance = calculateHaversineDistance(
      startLocation.latitude, startLocation.longitude,
      optimizedStops[0].latitude, optimizedStops[0].longitude
    );
    const depTravel = estimateDrivingTime(depDistance, averageSpeedMph);
    totalDistance += depDistance;
    totalDuration += depTravel;
    currentTime += depTravel;
  }

  for (let i = 0; i < optimizedStops.length; i++) {
    estimatedTimes.push(formatTime(currentTime));

    const stopDuration = optimizedStops[i].durationAtStop || 30;
    currentTime += stopDuration;
    totalDuration += stopDuration;

    if (i < optimizedStops.length - 1) {
      const distance = calculateHaversineDistance(
        optimizedStops[i].latitude,
        optimizedStops[i].longitude,
        optimizedStops[i + 1].latitude,
        optimizedStops[i + 1].longitude
      );

      const travelTime = estimateDrivingTime(distance, averageSpeedMph);

      totalDistance += distance;
      totalDuration += travelTime;
      currentTime += travelTime;
    }
  }

  if (endLocation && optimizedStops.length > 0) {
    const lastStop = optimizedStops[optimizedStops.length - 1];
    const endDistance = calculateHaversineDistance(
      lastStop.latitude, lastStop.longitude,
      endLocation.latitude, endLocation.longitude
    );
    const endTravel = estimateDrivingTime(endDistance, averageSpeedMph);
    totalDistance += endDistance;
    totalDuration += endTravel;
  } else if (includeReturnToStart && optimizedStops.length > 1) {
    const returnDistance = calculateHaversineDistance(
      optimizedStops[optimizedStops.length - 1].latitude,
      optimizedStops[optimizedStops.length - 1].longitude,
      optimizedStops[0].latitude,
      optimizedStops[0].longitude
    );
    const returnTime = estimateDrivingTime(returnDistance, averageSpeedMph);
    totalDistance += returnDistance;
    totalDuration += returnTime;
  }

  return {
    stops: optimizedStops,
    totalDistance: Math.round(totalDistance * 100) / 100,
    totalDuration,
    estimatedTimes,
  };
}

function parseTimeString(timeStr: string): number {
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return 540;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const meridiem = match[3].toUpperCase();

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

export function buildSegmentedRoutePlan(
  route: OptimizedRoute,
  dayStartTime: string = '12:30 PM',
  averageSpeedMph: number = 35
): ScheduledRoutePlan {
  const fixedStops: { index: number; windowStart: number; windowEnd: number }[] = [];
  const flexibleStopIndices: number[] = [];

  for (let i = 0; i < route.stops.length; i++) {
    const sw = route.stops[i].serviceWindow;
    if (sw) {
      fixedStops.push({ index: i, windowStart: parseTimeString(sw.start), windowEnd: parseTimeString(sw.end) });
    } else {
      flexibleStopIndices.push(i);
    }
  }

  if (fixedStops.length === 0) {
    const startMin = parseTimeString(dayStartTime);
    const endMin = startMin + route.totalDuration;
    return {
      segments: [{
        stops: route.stops,
        estimatedTimes: route.estimatedTimes,
        startTime: dayStartTime,
        endTime: formatTime(endMin),
        durationMinutes: route.totalDuration,
        distanceMiles: route.totalDistance,
        isFixedWindow: false,
      }],
      totalDuration: route.totalDuration,
      totalDistance: route.totalDistance,
      date: '',
      hasFixedWindows: false,
    };
  }

  fixedStops.sort((a, b) => a.windowStart - b.windowStart);

  const segments: RouteSegment[] = [];
  let currentTime = parseTimeString(dayStartTime);
  let totalDist = 0;
  let totalDur = 0;
  let prevLat = route.stops[0]?.latitude || 0;
  let prevLon = route.stops[0]?.longitude || 0;
  const usedIndices = new Set<number>();

  const buildFlexSegment = (stopIndices: number[], startT: number, deadlineT: number | null): RouteSegment | null => {
    if (stopIndices.length === 0) return null;
    const segStops: RouteLocation[] = [];
    const segTimes: string[] = [];
    let segDist = 0;
    let t = startT;

    for (const idx of stopIndices) {
      const stop = route.stops[idx];
      if (prevLat !== 0 && prevLon !== 0) {
        const d = calculateHaversineDistance(prevLat, prevLon, stop.latitude, stop.longitude);
        const travel = estimateDrivingTime(d, averageSpeedMph);
        segDist += d;
        t += travel;
      }
      segTimes.push(formatTime(t));
      const dur = stop.durationAtStop || 30;
      t += dur;
      segStops.push(stop);
      prevLat = stop.latitude;
      prevLon = stop.longitude;
      usedIndices.add(idx);
    }

    return {
      stops: segStops,
      estimatedTimes: segTimes,
      startTime: formatTime(startT),
      endTime: formatTime(t),
      durationMinutes: t - startT,
      distanceMiles: Math.round(segDist * 100) / 100,
      isFixedWindow: false,
    };
  };

  for (const fixed of fixedStops) {
    const availableFlex = flexibleStopIndices.filter(i => !usedIndices.has(i));
    const fitsBeforeFixed: number[] = [];

    let testTime = currentTime;
    for (const idx of availableFlex) {
      const stop = route.stops[idx];
      const d = calculateHaversineDistance(prevLat, prevLon, stop.latitude, stop.longitude);
      const travel = estimateDrivingTime(d, averageSpeedMph);
      const dur = stop.durationAtStop || 30;
      const needed = travel + dur;

      const travelToFixed = estimateDrivingTime(
        calculateHaversineDistance(stop.latitude, stop.longitude, route.stops[fixed.index].latitude, route.stops[fixed.index].longitude),
        averageSpeedMph
      );

      if (testTime + needed + travelToFixed <= fixed.windowStart) {
        fitsBeforeFixed.push(idx);
        testTime += needed;
        prevLat = stop.latitude;
        prevLon = stop.longitude;
      }
    }

    if (fitsBeforeFixed.length > 0) {
      const seg = buildFlexSegment(fitsBeforeFixed, currentTime, fixed.windowStart);
      if (seg) {
        segments.push(seg);
        totalDist += seg.distanceMiles;
        totalDur += seg.durationMinutes;
        currentTime = parseTimeString(seg.endTime);
      }
    }

    const fixedStop = route.stops[fixed.index];
    if (prevLat !== 0 && prevLon !== 0) {
      const travelDist = calculateHaversineDistance(prevLat, prevLon, fixedStop.latitude, fixedStop.longitude);
      totalDist += travelDist;
      const travelTime = estimateDrivingTime(travelDist, averageSpeedMph);
      totalDur += travelTime;
    }

    const fixedDur = fixed.windowEnd - fixed.windowStart;
    segments.push({
      stops: [fixedStop],
      estimatedTimes: [formatTime(fixed.windowStart)],
      startTime: formatTime(fixed.windowStart),
      endTime: formatTime(fixed.windowEnd),
      durationMinutes: fixedDur,
      distanceMiles: 0,
      isFixedWindow: true,
      fixedWindowLabel: `${formatTime(fixed.windowStart)} - ${formatTime(fixed.windowEnd)}`,
    });

    totalDur += fixedDur;
    usedIndices.add(fixed.index);
    currentTime = fixed.windowEnd;
    prevLat = fixedStop.latitude;
    prevLon = fixedStop.longitude;
  }

  const remainingFlex = flexibleStopIndices.filter(i => !usedIndices.has(i));
  if (remainingFlex.length > 0) {
    const seg = buildFlexSegment(remainingFlex, currentTime, null);
    if (seg) {
      segments.push(seg);
      totalDist += seg.distanceMiles;
      totalDur += seg.durationMinutes;
    }
  }

  return {
    segments,
    totalDuration: totalDur,
    totalDistance: Math.round(totalDist * 100) / 100,
    date: '',
    hasFixedWindows: true,
  };
}

export function calculateRouteDistance(locations: RouteLocation[]): number {
  if (locations.length <= 1) return 0;

  let totalDistance = 0;
  for (let i = 0; i < locations.length - 1; i++) {
    totalDistance += calculateHaversineDistance(
      locations[i].latitude,
      locations[i].longitude,
      locations[i + 1].latitude,
      locations[i + 1].longitude
    );
  }

  return Math.round(totalDistance * 100) / 100;
}

export function getBoundingBox(locations: RouteLocation[]): {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
} {
  if (locations.length === 0) {
    return { minLat: 0, maxLat: 0, minLng: 0, maxLng: 0 };
  }

  return locations.reduce(
    (bounds, loc) => ({
      minLat: Math.min(bounds.minLat, loc.latitude),
      maxLat: Math.max(bounds.maxLat, loc.latitude),
      minLng: Math.min(bounds.minLng, loc.longitude),
      maxLng: Math.max(bounds.maxLng, loc.longitude),
    }),
    {
      minLat: locations[0].latitude,
      maxLat: locations[0].latitude,
      minLng: locations[0].longitude,
      maxLng: locations[0].longitude,
    }
  );
}

function calculateCentroid(locations: RouteLocation[]): { lat: number; lng: number } {
  if (locations.length === 0) {
    return { lat: 0, lng: 0 };
  }

  const sum = locations.reduce(
    (acc, loc) => ({
      lat: acc.lat + loc.latitude,
      lng: acc.lng + loc.longitude,
    }),
    { lat: 0, lng: 0 }
  );

  return {
    lat: sum.lat / locations.length,
    lng: sum.lng / locations.length,
  };
}

function assignLocationsToTeams(
  locations: RouteLocation[],
  numTeams: number
): RouteLocation[][] {
  if (numTeams <= 0 || locations.length === 0) return [];
  if (numTeams === 1) return [locations];

  const centroid = calculateCentroid(locations);

  // Assign each location to a sector based on its compass angle from the centroid.
  // This keeps each team's stops geographically contiguous — no criss-crossing.
  const withAngle = locations.map((loc) => {
    const angle = Math.atan2(loc.longitude - centroid.lng, loc.latitude - centroid.lat);
    return { loc, angle };
  });

  withAngle.sort((a, b) => a.angle - b.angle);

  const assignments: RouteLocation[][] = Array.from({ length: numTeams }, () => []);
  const targetSize = Math.ceil(locations.length / numTeams);

  withAngle.forEach(({ loc }, idx) => {
    const teamIndex = Math.min(Math.floor(idx / targetSize), numTeams - 1);
    assignments[teamIndex].push(loc);
  });

  return assignments.filter((team) => team.length > 0);
}


export interface TeamDispatchAssignment {
  memberId: string;
  memberName: string;
  route: OptimizedRoute;
}

export interface TeamDispatchResult {
  assignments: TeamDispatchAssignment[];
  totalDistance: number;
  totalDuration: number;
  averageDistance: number;
  averageDuration: number;
}

export function dispatchTeamRoutes(
  locations: RouteLocation[],
  memberIds: string[],
  options: RouteOptimizationOptions = {}
): TeamDispatchResult {
  if (locations.length === 0 || memberIds.length === 0) {
    return {
      assignments: [],
      totalDistance: 0,
      totalDuration: 0,
      averageDistance: 0,
      averageDuration: 0,
    };
  }

  const teamAssignments = assignLocationsToTeams(locations, memberIds.length);

  const assignments: TeamDispatchAssignment[] = teamAssignments.map((teamLocations, index) => {
    const route = optimizeRoute(teamLocations, options);
    return {
      memberId: memberIds[index],
      memberName: `Team Member ${index + 1}`,
      route,
    };
  });

  const totalDistance = assignments.reduce((sum, a) => sum + a.route.totalDistance, 0);
  const totalDuration = assignments.reduce((sum, a) => sum + a.route.totalDuration, 0);

  return {
    assignments,
    totalDistance,
    totalDuration,
    averageDistance: assignments.length > 0 ? totalDistance / assignments.length : 0,
    averageDuration: assignments.length > 0 ? totalDuration / assignments.length : 0,
  };
}
