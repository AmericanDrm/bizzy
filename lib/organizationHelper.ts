import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

export async function getCurrentOrganizationId(userId: string): Promise<string | null> {
  try {
    const storedOrgId = await AsyncStorage.getItem(`current_org_${userId}`);

    if (storedOrgId) {
      const { data: membership } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('organization_id', storedOrgId)
        .eq('user_id', userId)
        .maybeSingle();

      if (membership) {
        return membership.organization_id;
      }
    }

    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .order('joined_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (membership) {
      await AsyncStorage.setItem(`current_org_${userId}`, membership.organization_id);
      return membership.organization_id;
    }

    return null;
  } catch (error) {
    console.error('Error getting current organization ID:', error);
    return null;
  }
}

export function withOrganization<T extends Record<string, any>>(
  data: T,
  organizationId: string
): T & { organization_id: string } {
  return {
    ...data,
    organization_id: organizationId,
  };
}

export function withOrganizationBatch<T extends Record<string, any>>(
  dataArray: T[],
  organizationId: string
): (T & { organization_id: string })[] {
  return dataArray.map(data => withOrganization(data, organizationId));
}

export const TABLES_REQUIRING_ORG_ID = [
  'clients',
  'jobs',
  'job_types',
  'schedule_events',
  'time_entries',
  'notes',
  'invoices',
  'estimates',
  'income',
  'expenses',
  'message_templates',
  'client_photos',
  'sent_messages',
  'job_service_packages',
  'client_job_history',
  'productivity_sessions',
  'location_tracking',
  'detected_locations',
  'clock_out_prompts',
  'work_orders',
] as const;

export type TableRequiringOrgId = typeof TABLES_REQUIRING_ORG_ID[number];

export function requiresOrganizationId(tableName: string): boolean {
  return TABLES_REQUIRING_ORG_ID.includes(tableName as TableRequiringOrgId);
}
