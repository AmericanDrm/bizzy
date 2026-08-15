import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { normalizePhoneForComparison } from './utilities';

const PHONE_INDEX_KEY = '@bizzy_phone_index';
const PHONE_INDEX_VERSION_KEY = '@bizzy_phone_index_version';

export interface PhoneIndexEntry {
  clientId: string;
  clientName: string;
  phone: string;
  email: string;
  address: string;
  clientType: string;
  isSecondary: boolean;
}

interface PhoneIndex {
  entries: Record<string, PhoneIndexEntry[]>;
  version: number;
  lastUpdated: string;
}

let memoryIndex: PhoneIndex | null = null;

export function lookupPhoneNumber(rawPhone: string): PhoneIndexEntry[] {
  if (!memoryIndex) return [];
  const normalized = normalizePhoneForComparison(rawPhone);
  if (normalized.length < 7) return [];
  const exact = memoryIndex.entries[normalized];
  if (exact) return exact;
  const last7 = normalized.slice(-7);
  const matches: PhoneIndexEntry[] = [];
  for (const key of Object.keys(memoryIndex.entries)) {
    if (key.endsWith(last7)) {
      matches.push(...memoryIndex.entries[key]);
    }
  }
  return matches;
}

export async function buildPhoneIndex(organizationId: string): Promise<void> {
  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, name, phone, email, address, client_type, secondary_contact_name, secondary_contact_phone')
    .eq('organization_id', organizationId);

  if (error || !clients) return;

  const entries: Record<string, PhoneIndexEntry[]> = {};

  for (const client of clients) {
    if (client.phone) {
      const normalized = normalizePhoneForComparison(client.phone);
      if (normalized.length >= 7) {
        if (!entries[normalized]) entries[normalized] = [];
        entries[normalized].push({
          clientId: client.id,
          clientName: client.name || '',
          phone: client.phone,
          email: client.email || '',
          address: client.address || '',
          clientType: client.client_type || 'residential',
          isSecondary: false,
        });
      }
    }

    if (client.secondary_contact_phone) {
      const normalized = normalizePhoneForComparison(client.secondary_contact_phone);
      if (normalized.length >= 7) {
        if (!entries[normalized]) entries[normalized] = [];
        entries[normalized].push({
          clientId: client.id,
          clientName: client.secondary_contact_name || client.name || '',
          phone: client.secondary_contact_phone,
          email: client.email || '',
          address: client.address || '',
          clientType: client.client_type || 'residential',
          isSecondary: true,
        });
      }
    }
  }

  const index: PhoneIndex = {
    entries,
    version: Date.now(),
    lastUpdated: new Date().toISOString(),
  };

  memoryIndex = index;

  try {
    await AsyncStorage.setItem(PHONE_INDEX_KEY, JSON.stringify(index));
    await AsyncStorage.setItem(PHONE_INDEX_VERSION_KEY, String(index.version));
  } catch {}
}

export async function loadPhoneIndexFromCache(): Promise<boolean> {
  try {
    const cached = await AsyncStorage.getItem(PHONE_INDEX_KEY);
    if (cached) {
      memoryIndex = JSON.parse(cached) as PhoneIndex;
      return true;
    }
  } catch {}
  return false;
}

export function getPhoneIndexStats(): { entryCount: number; clientCount: number; lastUpdated: string | null } {
  if (!memoryIndex) return { entryCount: 0, clientCount: 0, lastUpdated: null };
  const uniqueClients = new Set<string>();
  for (const entries of Object.values(memoryIndex.entries)) {
    for (const entry of entries) {
      uniqueClients.add(entry.clientId);
    }
  }
  return {
    entryCount: Object.keys(memoryIndex.entries).length,
    clientCount: uniqueClients.size,
    lastUpdated: memoryIndex.lastUpdated,
  };
}

export function clearPhoneIndex(): void {
  memoryIndex = null;
  AsyncStorage.removeItem(PHONE_INDEX_KEY).catch(() => {});
  AsyncStorage.removeItem(PHONE_INDEX_VERSION_KEY).catch(() => {});
}
