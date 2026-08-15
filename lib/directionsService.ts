import { Platform } from 'react-native';

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '';

function haversineDistanceMeters(
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
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fallbackTravelMinutes(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const meters = haversineDistanceMeters(lat1, lon1, lat2, lon2);
  const km = meters / 1000;
  const avgSpeedKmh = 40;
  return Math.max(1, Math.round((km / avgSpeedKmh) * 60));
}

export async function getTravelTimeMinutes(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number
): Promise<number> {
  if (!MAPBOX_TOKEN) {
    return fallbackTravelMinutes(fromLat, fromLon, toLat, toLon);
  }

  try {
    const url =
      `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/` +
      `${fromLon},${fromLat};${toLon},${toLat}` +
      `?access_token=${MAPBOX_TOKEN}` +
      `&overview=false`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      return fallbackTravelMinutes(fromLat, fromLon, toLat, toLon);
    }

    const json = await response.json();
    const durationSeconds: number | undefined = json?.routes?.[0]?.duration;

    if (durationSeconds == null) {
      return fallbackTravelMinutes(fromLat, fromLon, toLat, toLon);
    }

    return Math.max(1, Math.round(durationSeconds / 60));
  } catch {
    return fallbackTravelMinutes(fromLat, fromLon, toLat, toLon);
  }
}

export function getDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  return haversineDistanceMeters(lat1, lon1, lat2, lon2);
}
