import { Platform } from 'react-native';
import { supabase } from './supabase';

export interface ExportResult {
  success: boolean;
  error?: string;
  filename?: string;
}

async function getOrgId(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .maybeSingle();
  return data?.organization_id ?? null;
}

export async function exportAllData(): Promise<ExportResult> {
  if (Platform.OS !== 'web') {
    return { success: false, error: 'Data export is only available on web.' };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const orgId = await getOrgId(user.id);
  if (!orgId) return { success: false, error: 'No organization found' };

  const fetchTable = async (table: string, extraFilters?: (q: any) => any) => {
    let query = supabase.from(table).select('*').eq('organization_id', orgId);
    if (extraFilters) query = extraFilters(query);
    const { data, error } = await query;
    if (error) console.warn(`Export warning for ${table}:`, error.message);
    return data ?? [];
  };

  const fetchUserTable = async (table: string) => {
    const { data, error } = await supabase.from(table).select('*').eq('user_id', user.id);
    if (error) console.warn(`Export warning for ${table}:`, error.message);
    return data ?? [];
  };

  const [
    clients,
    scheduleEvents,
    timeEntries,
    invoices,
    estimates,
    income,
    expenses,
    notes,
    todos,
    jobTypes,
    jobs,
    workOrders,
    vehicles,
    mileageReadings,
    teamMembers,
    clientAddresses,
    checklistTemplates,
    supplyTemplates,
  ] = await Promise.all([
    fetchTable('clients'),
    fetchTable('schedule_events'),
    fetchTable('time_entries'),
    fetchTable('invoices'),
    fetchTable('estimates'),
    fetchTable('income'),
    fetchTable('expenses'),
    fetchTable('notes'),
    fetchTable('todos'),
    fetchTable('job_types'),
    fetchTable('jobs'),
    fetchTable('work_orders'),
    fetchTable('vehicles'),
    fetchTable('mileage_readings'),
    fetchTable('organization_members'),
    fetchTable('client_addresses'),
    fetchTable('checklist_templates'),
    fetchTable('supply_templates'),
  ]);

  const exportData = {
    exportedAt: new Date().toISOString(),
    exportedBy: user.email,
    organizationId: orgId,
    version: '1.0',
    data: {
      clients,
      scheduleEvents,
      timeEntries,
      invoices,
      estimates,
      income,
      expenses,
      notes,
      todos,
      jobTypes,
      jobs,
      workOrders,
      vehicles,
      mileageReadings,
      teamMembers,
      clientAddresses,
      checklistTemplates,
      supplyTemplates,
    },
  };

  const json = JSON.stringify(exportData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const filename = `bizzy-export-${new Date().toISOString().slice(0, 10)}.json`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);

  return { success: true, filename };
}
