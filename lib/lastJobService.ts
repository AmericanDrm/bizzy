import { supabase } from '@/lib/supabase';

export interface LastJobData {
  eventId: string;
  title: string;
  description: string | null;
  jobTypeId: string | null;
  serviceScope: string | null;
  crewSize: number;
  amount: number | null;
  assignedTo: string | null;
  teamMembers: string[] | null;
  clientAddressId: string | null;
  lineItems: LastJobLineItem[];
  lastJobDate: string;
}

export interface LastJobLineItem {
  id: string;
  description: string;
  quantity: string;
  unit_price: string;
  scope: string;
  job_type_id: string | null;
  pane_details: any;
}

export async function fetchLastJobForClient(
  clientId: string,
  organizationId: string,
  clientAddressId?: string | null
): Promise<LastJobData | null> {
  try {
    let query = supabase
      .from('schedule_events')
      .select('id, title, description, job_type_id, service_scope, crew_size, amount, assigned_to, team_members, client_address_id, start_time')
      .eq('client_id', clientId)
      .eq('organization_id', organizationId)
      .order('start_time', { ascending: false })
      .limit(1);

    if (clientAddressId) {
      query = query.eq('client_address_id', clientAddressId);
    }

    const { data: events, error } = await query;
    if (error) throw error;

    let event = events?.[0] || null;

    if (!event && clientAddressId) {
      const { data: fallback, error: fbErr } = await supabase
        .from('schedule_events')
        .select('id, title, description, job_type_id, service_scope, crew_size, amount, assigned_to, team_members, client_address_id, start_time')
        .eq('client_id', clientId)
        .eq('organization_id', organizationId)
        .order('start_time', { ascending: false })
        .limit(1);
      if (fbErr) throw fbErr;
      event = fallback?.[0] || null;
    }

    if (!event) return null;

    const { data: lineItemRows, error: liErr } = await supabase
      .from('schedule_event_line_items')
      .select('id, description, quantity, unit_price, service_scope, job_type_id, pane_details, display_order')
      .eq('schedule_event_id', event.id)
      .order('display_order', { ascending: true });

    if (liErr) {
      console.error('Error fetching line items:', liErr);
    }

    const lineItems: LastJobLineItem[] = (lineItemRows || []).map((li: any) => ({
      id: Math.random().toString(36).substr(2, 9),
      description: li.description || '',
      quantity: String(li.quantity || 1),
      unit_price: String(li.unit_price || 0),
      scope: li.service_scope === 'exterior_only' ? 'exterior' : li.service_scope === 'interior_only' ? 'interior' : 'both',
      job_type_id: li.job_type_id,
      pane_details: li.pane_details,
    }));

    const dateStr = new Date(event.start_time).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    return {
      eventId: event.id,
      title: event.title || '',
      description: event.description || null,
      jobTypeId: event.job_type_id || null,
      serviceScope: event.service_scope || null,
      crewSize: event.crew_size || 1,
      amount: event.amount ? parseFloat(event.amount) : null,
      assignedTo: event.assigned_to || null,
      teamMembers: event.team_members || null,
      clientAddressId: event.client_address_id || null,
      lineItems,
      lastJobDate: dateStr,
    };
  } catch (err) {
    console.error('Error fetching last job for client:', err);
    return null;
  }
}
