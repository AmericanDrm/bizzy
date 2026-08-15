import { supabase } from './supabase';
import { getCurrentOrganizationId, requiresOrganizationId, withOrganization, withOrganizationBatch } from './organizationHelper';

const CACHE_TTL_MS = 30 * 1000;

let cachedUserId: string | null = null;
let cachedOrgId: string | null = null;
let cacheTimestamp: number = 0;

async function ensureOrganizationId(): Promise<string | null> {
  const now = Date.now();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    clearOrgCache();
    return null;
  }

  if (cachedUserId !== user.id) {
    clearOrgCache();
  }

  if (cachedOrgId && cachedUserId === user.id && (now - cacheTimestamp < CACHE_TTL_MS)) {
    return cachedOrgId;
  }

  cachedUserId = user.id;
  cachedOrgId = await getCurrentOrganizationId(user.id);
  cacheTimestamp = Date.now();

  return cachedOrgId;
}

export function clearOrgCache() {
  cachedUserId = null;
  cachedOrgId = null;
  cacheTimestamp = 0;
}

export const orgSupabase = {
  from: (table: string) => {
    const query = supabase.from(table);

    const originalInsert = query.insert.bind(query);

    (query as any).insert = async (values: any, options?: any) => {
      if (!requiresOrganizationId(table)) {
        return originalInsert(values, options);
      }

      const orgId = await ensureOrganizationId();
      if (!orgId) {
        throw new Error(`Cannot insert into ${table}: No organization context available. User must be a member of an organization.`);
      }

      const valuesWithOrg = Array.isArray(values)
        ? withOrganizationBatch(values, orgId)
        : withOrganization(values, orgId);

      return originalInsert(valuesWithOrg, options);
    };

    return query;
  },

  auth: supabase.auth,
  storage: supabase.storage,
  functions: supabase.functions,
  channel: supabase.channel.bind(supabase),
  getChannels: supabase.getChannels.bind(supabase),
  removeChannel: supabase.removeChannel.bind(supabase),
  removeAllChannels: supabase.removeAllChannels.bind(supabase),
  rpc: supabase.rpc.bind(supabase),
};
