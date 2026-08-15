import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { supabase } from '@/lib/supabase';

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '';
const CACHE_KEY = 'bizzy_previous_addresses';
const OFFLINE_QUEUE_KEY = 'bizzy_pending_geocode';

export interface AddressData {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  fullAddress: string;
  normalized: boolean;
}

export interface MapboxSuggestion {
  id: string;
  fullAddress: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  latitude: number;
  longitude: number;
  placeName?: string;
}

export interface BusinessResult {
  id: string;
  name: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  latitude: number;
  longitude: number;
  fullAddress: string;
  category?: string;
}

export interface PreviousAddress {
  id: string;
  fullAddress: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
}

interface PendingGeocode {
  fullAddress: string;
  latitude: number | null;
  longitude: number | null;
  clientId?: string;
  jobId?: string;
  createdAt: string;
}

export function hasMapboxToken(): boolean {
  return !!MAPBOX_TOKEN;
}

export function buildFullAddress(
  street: string,
  city: string,
  state: string,
  postalCode: string,
  country: string
): string {
  const parts: string[] = [];
  if (street.trim()) parts.push(street.trim());
  if (city.trim()) parts.push(city.trim());
  if (state.trim() && postalCode.trim()) {
    parts.push(`${state.trim()} ${postalCode.trim()}`);
  } else if (state.trim()) {
    parts.push(state.trim());
  } else if (postalCode.trim()) {
    parts.push(postalCode.trim());
  }
  if (country.trim() && country.trim() !== 'United States') {
    parts.push(country.trim());
  }
  return parts.join(', ');
}

function parseMapboxFeature(feature: any): MapboxSuggestion {
  const context = feature.context || [];
  const getCtx = (prefix: string) => {
    const item = context.find((c: any) => c.id?.startsWith(prefix));
    return item?.text || '';
  };

  const isPoi = feature.id?.startsWith('poi.');
  let street = '';
  let placeName: string | undefined;

  if (isPoi) {
    placeName = feature.text || '';
    const addressCtx = context.find((c: any) => c.id?.startsWith('address.'));
    if (addressCtx) {
      street = addressCtx.text || '';
    } else {
      const parts = (feature.place_name || '').split(',');
      street = parts.length > 1 ? parts[1]?.trim() : '';
    }
  } else {
    const streetNum = feature.address || '';
    const streetName = feature.text || '';
    street = streetNum ? `${streetNum} ${streetName}` : streetName;
  }

  return {
    id: feature.id,
    fullAddress: feature.place_name || '',
    street,
    city: getCtx('place.') || getCtx('locality.'),
    state: getCtx('region.'),
    postalCode: getCtx('postcode.'),
    country: getCtx('country.'),
    latitude: feature.center?.[1] ?? 0,
    longitude: feature.center?.[0] ?? 0,
    placeName,
  };
}

export async function searchMapbox(
  query: string,
  proximity?: { lat: number; lng: number }
): Promise<MapboxSuggestion[]> {
  if (!MAPBOX_TOKEN || !query.trim() || query.trim().length < 3) return [];

  try {
    const params = new URLSearchParams({
      access_token: MAPBOX_TOKEN,
      autocomplete: 'true',
      types: 'address',
      limit: '5',
      country: 'us',
    });

    if (proximity) {
      params.set('proximity', `${proximity.lng},${proximity.lat}`);
    }

    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query.trim())}.json?${params}`;
    const res = await fetch(url);
    if (!res.ok) return [];

    const data = await res.json();
    return (data.features || []).map(parseMapboxFeature);
  } catch {
    return [];
  }
}

export async function searchBusinesses(
  query: string,
  proximity?: { lat: number; lng: number }
): Promise<BusinessResult[]> {
  if (!query.trim() || query.trim().length < 2) return [];

  if (MAPBOX_TOKEN) {
    try {
      const params = new URLSearchParams({
        access_token: MAPBOX_TOKEN,
        autocomplete: 'true',
        types: 'poi',
        limit: '6',
        country: 'us',
      });

      if (proximity) {
        params.set('proximity', `${proximity.lng},${proximity.lat}`);
      }

      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query.trim())}.json?${params}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const results: BusinessResult[] = (data.features || []).map((f: any) => {
          const parsed = parseMapboxFeature(f);
          const category = f.properties?.category || f.properties?.maki || '';
          return {
            id: parsed.id,
            name: f.text || '',
            street: parsed.street,
            city: parsed.city,
            state: parsed.state,
            postalCode: parsed.postalCode,
            country: parsed.country || 'United States',
            latitude: parsed.latitude,
            longitude: parsed.longitude,
            fullAddress: parsed.fullAddress,
            category,
          };
        });
        if (results.length > 0) return results;
      }
    } catch {
    }
  }

  return searchNominatimBusinesses(query);
}

async function searchNominatimBusinesses(query: string): Promise<BusinessResult[]> {
  try {
    const params = new URLSearchParams({
      q: query,
      format: 'jsonv2',
      addressdetails: '1',
      limit: '6',
      countrycodes: 'us',
    });

    const url = `https://nominatim.openstreetmap.org/search?${params}`;
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'en', 'User-Agent': 'BizzyApp/1.0' },
    });
    if (!res.ok) return [];

    const data = await res.json();
    if (!Array.isArray(data)) return [];

    return data
      .filter((item: any) => item.address)
      .map((item: any) => {
        const addr = item.address;
        const streetNumber = addr.house_number || '';
        const streetName = addr.road || addr.street || addr.pedestrian || '';
        const street = [streetNumber, streetName].filter(Boolean).join(' ');
        const city = addr.city || addr.town || addr.village || addr.municipality || addr.county || '';
        const state = addr.state || addr.province || '';
        const postalCode = addr.postcode || '';
        const country = addr.country || 'United States';
        const name = item.name || item.display_name?.split(',')[0] || '';
        const fullAddress = buildFullAddress(street, city, state, postalCode, country);
        return {
          id: String(item.place_id),
          name,
          street,
          city,
          state,
          postalCode,
          country,
          latitude: parseFloat(item.lat),
          longitude: parseFloat(item.lon),
          fullAddress: name ? `${name}, ${fullAddress}` : fullAddress,
          category: item.type || item.class || '',
        } as BusinessResult;
      })
      .filter((r: BusinessResult) => r.name || r.street);
  } catch {
    return [];
  }
}

async function geocodeAddressNominatim(address: string): Promise<AddressData | null> {
  try {
    const params = new URLSearchParams({
      q: address.trim(),
      format: 'jsonv2',
      addressdetails: '1',
      limit: '1',
      countrycodes: 'us',
    });
    const url = `https://nominatim.openstreetmap.org/search?${params}`;
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'en', 'User-Agent': 'BizzyApp/1.0' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || !data.length) return null;
    const item = data[0];
    const addr = item.address || {};
    const streetNumber = addr.house_number || '';
    const streetName = addr.road || addr.street || addr.pedestrian || '';
    const street = [streetNumber, streetName].filter(Boolean).join(' ');
    const city = addr.city || addr.town || addr.village || addr.municipality || addr.county || '';
    const state = addr.state || addr.province || '';
    const postalCode = addr.postcode || '';
    const country = addr.country || 'United States';
    const fullAddress = buildFullAddress(street, city, state, postalCode, country);
    return {
      street,
      city,
      state,
      postalCode,
      country,
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
      fullAddress: fullAddress || address.trim(),
      normalized: true,
    };
  } catch {
    return null;
  }
}

export async function geocodeAddress(address: string): Promise<AddressData | null> {
  if (!address.trim()) return null;

  if (MAPBOX_TOKEN) {
    try {
      const params = new URLSearchParams({
        access_token: MAPBOX_TOKEN,
        types: 'address',
        limit: '1',
        country: 'us',
      });

      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address.trim())}.json?${params}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.features?.length) {
          const parsed = parseMapboxFeature(data.features[0]);
          return {
            street: parsed.street,
            city: parsed.city,
            state: parsed.state,
            postalCode: parsed.postalCode,
            country: parsed.country,
            latitude: parsed.latitude,
            longitude: parsed.longitude,
            fullAddress: parsed.fullAddress,
            normalized: true,
          };
        }
      }
    } catch {
    }
  }

  return geocodeAddressNominatim(address);
}

async function reverseGeocodeNominatim(lat: number, lng: number): Promise<AddressData | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1`;
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'en', 'User-Agent': 'BizzyApp/1.0' },
    });
    if (!res.ok) return null;

    const data = await res.json();
    if (!data || !data.address) return null;

    const addr = data.address;
    const streetNumber = addr.house_number || '';
    const streetName = addr.road || addr.street || addr.pedestrian || '';
    const street = [streetNumber, streetName].filter(Boolean).join(' ');
    const city = addr.city || addr.town || addr.village || addr.municipality || addr.county || '';
    const state = addr.state || addr.province || '';
    const postalCode = addr.postcode || '';
    const country = addr.country || 'United States';

    if (!street && !city) return null;

    const fullAddress = buildFullAddress(street, city, state, postalCode, country);

    return {
      street,
      city,
      state,
      postalCode,
      country,
      latitude: lat,
      longitude: lng,
      fullAddress,
      normalized: true,
    };
  } catch {
    return null;
  }
}

export async function reverseGeocode(lat: number, lng: number): Promise<AddressData | null> {
  if (MAPBOX_TOKEN) {
    try {
      const params = new URLSearchParams({
        access_token: MAPBOX_TOKEN,
        types: 'address',
        limit: '1',
      });

      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?${params}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Mapbox request failed');

      const data = await res.json();
      if (!data.features?.length) throw new Error('No features found');

      const parsed = parseMapboxFeature(data.features[0]);
      return {
        street: parsed.street,
        city: parsed.city,
        state: parsed.state,
        postalCode: parsed.postalCode,
        country: parsed.country,
        latitude: parsed.latitude,
        longitude: parsed.longitude,
        fullAddress: parsed.fullAddress,
        normalized: true,
      };
    } catch {
    }
  }

  try {
    const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    if (results && results.length > 0) {
      const result = results[0];
      const street = [result.streetNumber, result.street].filter(Boolean).join(' ');
      const city = result.city || result.subregion || '';
      const state = result.region || result.isoCountryCode || '';
      const postalCode = result.postalCode || '';
      const country = result.country || 'United States';

      if (street || city) {
        const fullAddress = buildFullAddress(street, city, state, postalCode, country);
        return {
          street,
          city,
          state,
          postalCode,
          country,
          latitude: lat,
          longitude: lng,
          fullAddress,
          normalized: true,
        };
      }
    }
  } catch {
  }

  return reverseGeocodeNominatim(lat, lng);
}

export async function fetchPreviousAddresses(orgId: string): Promise<PreviousAddress[]> {
  try {
    const { data, error } = await supabase
      .from('previous_addresses')
      .select('id, full_address, street, city, state, postal_code, country, latitude, longitude')
      .eq('organization_id', orgId)
      .order('last_used_at', { ascending: false })
      .limit(50);

    if (error || !data) return [];

    const addresses = data.map((row: any) => ({
      id: row.id,
      fullAddress: row.full_address,
      street: row.street,
      city: row.city,
      state: row.state,
      postalCode: row.postal_code,
      country: row.country,
      latitude: row.latitude,
      longitude: row.longitude,
    }));

    await AsyncStorage.setItem(`${CACHE_KEY}_${orgId}`, JSON.stringify(addresses));
    return addresses;
  } catch {
    return getCachedPreviousAddresses(orgId);
  }
}

async function getCachedPreviousAddresses(orgId: string): Promise<PreviousAddress[]> {
  try {
    const cached = await AsyncStorage.getItem(`${CACHE_KEY}_${orgId}`);
    return cached ? JSON.parse(cached) : [];
  } catch {
    return [];
  }
}

export function filterPreviousAddresses(
  addresses: PreviousAddress[],
  query: string
): PreviousAddress[] {
  if (!query.trim()) return addresses.slice(0, 5);
  const q = query.toLowerCase();
  return addresses
    .filter(
      (a) =>
        a.fullAddress.toLowerCase().includes(q) ||
        a.street.toLowerCase().includes(q) ||
        a.city.toLowerCase().includes(q)
    )
    .slice(0, 5);
}

export async function savePreviousAddress(
  orgId: string,
  address: AddressData
): Promise<void> {
  if (!address.street.trim() || !orgId) return;

  const fullAddr = address.fullAddress || buildFullAddress(
    address.street, address.city, address.state, address.postalCode, address.country
  );

  try {
    await supabase
      .from('previous_addresses')
      .upsert(
        {
          organization_id: orgId,
          full_address: fullAddr,
          street: address.street,
          city: address.city,
          state: address.state,
          postal_code: address.postalCode,
          country: address.country,
          latitude: address.latitude,
          longitude: address.longitude,
          normalized: address.normalized,
          last_used_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'organization_id,full_address' }
      );
  } catch {
    // Silently fail - non-critical
  }
}

export async function addToOfflineQueue(entry: PendingGeocode): Promise<void> {
  try {
    const existing = await getOfflineQueue();
    existing.push(entry);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(existing));
  } catch {
    // Silently fail
  }
}

export async function getOfflineQueue(): Promise<PendingGeocode[]> {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function processOfflineQueue(orgId: string): Promise<void> {
  const queue = await getOfflineQueue();
  if (!queue.length) return;

  const remaining: PendingGeocode[] = [];

  for (const entry of queue) {
    const result = await geocodeAddress(entry.fullAddress);
    if (result) {
      await savePreviousAddress(orgId, result);

      if (entry.clientId) {
        await supabase
          .from('client_addresses')
          .update({
            latitude: result.latitude,
            longitude: result.longitude,
            street: result.street,
            city: result.city,
            state: result.state,
            postal_code: result.postalCode,
            country: result.country,
            normalized: true,
          })
          .eq('client_id', entry.clientId)
          .eq('address', entry.fullAddress);
      }
    } else {
      remaining.push(entry);
    }
  }

  await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
}

export function emptyAddressData(): AddressData {
  return {
    street: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'United States',
    latitude: null,
    longitude: null,
    fullAddress: '',
    normalized: false,
  };
}
