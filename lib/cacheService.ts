import AsyncStorage from '@react-native-async-storage/async-storage';

interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

const CACHE_PREFIX = '@cache_';

export const CacheService = {
  async set<T>(key: string, data: T, ttlSeconds: number = 300): Promise<void> {
    try {
      const cacheItem: CacheItem<T> = {
        data,
        timestamp: Date.now(),
        ttl: ttlSeconds * 1000,
      };
      await AsyncStorage.setItem(CACHE_PREFIX + key, JSON.stringify(cacheItem));
    } catch (error) {
      console.error('Cache set error:', error);
    }
  },

  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await AsyncStorage.getItem(CACHE_PREFIX + key);
      if (!cached) return null;

      const cacheItem: CacheItem<T> = JSON.parse(cached);
      const now = Date.now();

      if (now - cacheItem.timestamp > cacheItem.ttl) {
        await this.remove(key);
        return null;
      }

      return cacheItem.data;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  },

  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(CACHE_PREFIX + key);
    } catch (error) {
      console.error('Cache remove error:', error);
    }
  },

  async clear(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter((key) => key.startsWith(CACHE_PREFIX));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  },

  async has(key: string): Promise<boolean> {
    const data = await this.get(key);
    return data !== null;
  },

  async getOrFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds: number = 300
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const data = await fetchFn();
    await this.set(key, data, ttlSeconds);
    return data;
  },

  getCacheKeys() {
    return {
      CLIENTS: 'clients_list',
      JOB_TYPES: 'job_types_list',
      BUSINESS_SETTINGS: 'business_settings',
      MESSAGE_TEMPLATES: 'message_templates',
      INVOICES: 'invoices_list',
      ESTIMATES: 'estimates_list',
      SCHEDULE_EVENTS: 'schedule_events_list',
      PROFILE: 'user_profile',
    };
  },
};

export const invalidateCache = async (...keys: string[]) => {
  for (const key of keys) {
    await CacheService.remove(key);
  }
};

export const invalidateAllCache = async () => {
  await CacheService.clear();
};
