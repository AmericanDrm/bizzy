import { supabase } from './supabase';

export interface CachedAddress {
  id: string;
  full_address: string;
  street: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  normalized: boolean;
  use_count: number;
  last_used_at: string;
}

class AddressCacheService {
  async getCachedAddresses(organizationId: string, searchTerm?: string): Promise<CachedAddress[]> {
    try {
      let query = supabase
        .from('address_suggestions_cache')
        .select('*')
        .eq('organization_id', organizationId)
        .order('use_count', { ascending: false })
        .order('last_used_at', { ascending: false })
        .limit(10);

      if (searchTerm && searchTerm.length >= 2) {
        query = query.ilike('full_address', `%${searchTerm}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching cached addresses:', error);
      return [];
    }
  }

  async cacheAddress(
    organizationId: string,
    address: {
      full_address: string;
      street: string;
      city: string;
      state: string;
      postal_code: string;
      country?: string;
      latitude?: number | null;
      longitude?: number | null;
      normalized?: boolean;
    }
  ): Promise<boolean> {
    try {
      const { data: existing } = await supabase
        .from('address_suggestions_cache')
        .select('id, use_count')
        .eq('organization_id', organizationId)
        .eq('full_address', address.full_address)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('address_suggestions_cache')
          .update({
            use_count: existing.use_count + 1,
            last_used_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        return !error;
      } else {
        const { error } = await supabase
          .from('address_suggestions_cache')
          .insert({
            organization_id: organizationId,
            full_address: address.full_address,
            street: address.street,
            city: address.city,
            state: address.state,
            postal_code: address.postal_code,
            country: address.country || 'United States',
            latitude: address.latitude || null,
            longitude: address.longitude || null,
            normalized: address.normalized || false,
            use_count: 1,
            last_used_at: new Date().toISOString(),
          });

        return !error;
      }
    } catch (error) {
      console.error('Error caching address:', error);
      return false;
    }
  }

  async getMostUsedAddresses(organizationId: string, limit: number = 5): Promise<CachedAddress[]> {
    try {
      const { data, error } = await supabase
        .from('address_suggestions_cache')
        .select('*')
        .eq('organization_id', organizationId)
        .order('use_count', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching most used addresses:', error);
      return [];
    }
  }

  async getRecentAddresses(organizationId: string, limit: number = 5): Promise<CachedAddress[]> {
    try {
      const { data, error } = await supabase
        .from('address_suggestions_cache')
        .select('*')
        .eq('organization_id', organizationId)
        .order('last_used_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching recent addresses:', error);
      return [];
    }
  }

  async deleteAddress(addressId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('address_suggestions_cache')
        .delete()
        .eq('id', addressId);

      return !error;
    } catch (error) {
      console.error('Error deleting cached address:', error);
      return false;
    }
  }

  async clearCache(organizationId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('address_suggestions_cache')
        .delete()
        .eq('organization_id', organizationId);

      return !error;
    } catch (error) {
      console.error('Error clearing address cache:', error);
      return false;
    }
  }
}

export const addressCacheService = new AddressCacheService();
export default addressCacheService;
