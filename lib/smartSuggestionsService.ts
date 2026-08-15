import { supabase } from './supabase';
import type { ParsedAction } from './quickActionParser';

export interface SmartSuggestion {
  id: string;
  type: 'uninvoiced_job' | 'unpaid_reminder' | 'recurring_visit' | 'pending_estimate' | 'account_balance';
  label: string;
  description: string;
  priority: number;
  iconType: string;
  action: ParsedAction;
}

let cachedSuggestions: SmartSuggestion[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000;

export async function getSmartSuggestions(
  userId: string,
  organizationId: string,
): Promise<SmartSuggestion[]> {
  if (!userId || !organizationId) return [];

  const now = Date.now();
  if (cachedSuggestions && now - cacheTimestamp < CACHE_TTL) {
    return cachedSuggestions;
  }

  const suggestions: SmartSuggestion[] = [];

  try {
    const paymentInfo = await fetchRecentPaymentInfo(organizationId);

    const results = await Promise.allSettled([
      fetchUninvoicedJobs(organizationId, paymentInfo),
      fetchUnpaidInvoices(organizationId, paymentInfo),
      fetchRecurringVisitsDue(organizationId),
      fetchPendingEstimates(organizationId),
    ]);

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        suggestions.push(...result.value);
      }
    }
  } catch {
    // Return whatever we have
  }

  suggestions.sort((a, b) => b.priority - a.priority);
  cachedSuggestions = suggestions.slice(0, 6);
  cacheTimestamp = now;
  return cachedSuggestions;
}

export function invalidateSuggestionsCache() {
  cachedSuggestions = null;
  cacheTimestamp = 0;
}

async function fetchRecentPaymentInfo(organizationId: string): Promise<{
  paidEventIds: Set<string>;
  paidClientIds: Set<string>;
}> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: incomeData } = await supabase
    .from('income')
    .select('client_id, schedule_event_id')
    .eq('organization_id', organizationId)
    .gte('date', thirtyDaysAgo.toISOString().split('T')[0]);

  const paidEventIds = new Set<string>();
  const paidClientIds = new Set<string>();

  if (!incomeData) return { paidEventIds, paidClientIds };

  const eventIdsToResolve: string[] = [];

  for (const entry of incomeData) {
    if (entry.client_id) paidClientIds.add(entry.client_id);
    if (entry.schedule_event_id) {
      paidEventIds.add(entry.schedule_event_id);
      if (!entry.client_id) {
        eventIdsToResolve.push(entry.schedule_event_id);
      }
    }
  }

  if (eventIdsToResolve.length > 0) {
    const { data: events } = await supabase
      .from('schedule_events')
      .select('id, client_id')
      .in('id', eventIdsToResolve);

    if (events) {
      for (const ev of events) {
        if (ev.client_id) paidClientIds.add(ev.client_id);
      }
    }
  }

  return { paidEventIds, paidClientIds };
}

async function fetchUninvoicedJobs(organizationId: string, paymentInfo: { paidEventIds: Set<string>; paidClientIds: Set<string> }): Promise<SmartSuggestion[]> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data, error } = await supabase
    .from('schedule_events')
    .select('id, title, completed_at, amount, client_id, payment_status, clients(name)')
    .eq('organization_id', organizationId)
    .eq('status', 'completed')
    .is('invoice_id', null)
    .neq('payment_status', 'paid')
    .not('completed_at', 'is', null)
    .gte('completed_at', sevenDaysAgo.toISOString())
    .order('completed_at', { ascending: false })
    .limit(5);

  if (error || !data) return [];

  const unpaidJobs = data.filter((job: any) => {
    if (paymentInfo.paidEventIds.has(job.id)) return false;
    if (job.client_id && paymentInfo.paidClientIds.has(job.client_id)) return false;
    return true;
  });

  return unpaidJobs.map((job: any) => {
    const clientName = job.clients?.name || 'Unknown';
    const daysAgo = Math.floor(
      (Date.now() - new Date(job.completed_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    const dayLabel = daysAgo === 0 ? 'today' : daysAgo === 1 ? 'yesterday' : `${daysAgo} days ago`;
    const amountStr = job.amount ? ` - $${Number(job.amount).toFixed(0)}` : '';

    return {
      id: `uninvoiced-${job.id}`,
      type: 'uninvoiced_job' as const,
      label: `Invoice ${clientName} for completed job`,
      description: `Completed ${dayLabel}${amountStr}`,
      priority: 90 - daysAgo * 5,
      iconType: 'invoice_client',
      action: {
        type: 'invoice_client' as const,
        label: `Invoice ${clientName}`,
        description: `Create invoice for completed job`,
        clientName,
        amount: job.amount ? Number(job.amount) : undefined,
        raw: `invoice ${clientName}`,
      },
    };
  });
}

async function fetchUnpaidInvoices(organizationId: string, paymentInfo: { paidEventIds: Set<string>; paidClientIds: Set<string> }): Promise<SmartSuggestion[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select('id, invoice_number, total, amount_paid, due_date, status, payment_status, client_id, clients(name)')
    .eq('organization_id', organizationId)
    .in('status', ['sent', 'overdue'])
    .neq('payment_status', 'paid')
    .order('due_date', { ascending: true })
    .limit(10);

  if (error || !data) return [];

  const unpaidInvoices = data.filter((inv: any) => {
    if (Number(inv.amount_paid || 0) >= Number(inv.total) && Number(inv.total) > 0) return false;
    if (inv.client_id && paymentInfo.paidClientIds.has(inv.client_id)) return false;
    return true;
  });

  const suggestions: SmartSuggestion[] = [];
  const overdueInvoices = unpaidInvoices.filter((inv: any) => {
    const dueDate = new Date(inv.due_date);
    return dueDate < new Date();
  });

  if (overdueInvoices.length >= 2) {
    suggestions.push({
      id: 'batch-overdue',
      type: 'unpaid_reminder',
      label: `${overdueInvoices.length} overdue invoices need attention`,
      description: `Send reminders to clients with past-due balances`,
      priority: 95,
      iconType: 'invoice_client',
      action: {
        type: 'navigate' as const,
        label: 'View overdue invoices',
        description: 'Go to invoices tab',
        navigateTo: '/(tabs)/invoices',
        raw: 'invoices',
      },
    });
  }

  for (const inv of unpaidInvoices.slice(0, 2)) {
    const clientName = (inv as any).clients?.name || 'Unknown';
    const outstanding = Number(inv.total) - Number(inv.amount_paid || 0);
    const dueDate = new Date(inv.due_date);
    const now = new Date();
    const daysDiff = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    const isOverdue = daysDiff > 0;

    suggestions.push({
      id: `unpaid-${inv.id}`,
      type: 'unpaid_reminder',
      label: `Reminder for ${clientName}`,
      description: isOverdue
        ? `$${outstanding.toFixed(0)} overdue by ${daysDiff} days`
        : `$${outstanding.toFixed(0)} due in ${Math.abs(daysDiff)} days`,
      priority: isOverdue ? 85 + Math.min(daysDiff, 10) : 60 - Math.abs(daysDiff),
      iconType: 'invoice_client',
      action: {
        type: 'navigate' as const,
        label: `View invoice for ${clientName}`,
        description: 'Open invoices',
        navigateTo: '/(tabs)/invoices',
        raw: `invoice ${clientName}`,
      },
    });
  }

  return suggestions;
}

async function fetchRecurringVisitsDue(organizationId: string): Promise<SmartSuggestion[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('id, name, total_jobs_completed, last_service_date_by_type')
    .eq('organization_id', organizationId)
    .gt('total_jobs_completed', 1)
    .order('total_jobs_completed', { ascending: false })
    .limit(20);

  if (error || !data) return [];

  const suggestions: SmartSuggestion[] = [];
  const now = new Date();

  for (const client of data) {
    if (!client.last_service_date_by_type || typeof client.last_service_date_by_type !== 'object') continue;

    const serviceTypes = Object.entries(client.last_service_date_by_type as Record<string, string>);
    for (const [serviceType, lastDate] of serviceTypes) {
      if (!lastDate) continue;
      const lastServiceDate = new Date(lastDate);
      const daysSince = Math.floor((now.getTime() - lastServiceDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysSince >= 25 && daysSince <= 90) {
        suggestions.push({
          id: `recurring-${client.id}-${serviceType}`,
          type: 'recurring_visit',
          label: `Schedule ${client.name}`,
          description: `Last service ${daysSince} days ago`,
          priority: 70 + Math.min(daysSince - 25, 20),
          iconType: 'schedule_client',
          action: {
            type: 'schedule_client' as const,
            label: `Schedule ${client.name}`,
            description: `Schedule next visit`,
            clientName: client.name,
            raw: `schedule ${client.name}`,
          },
        });
        break;
      }
    }
  }

  return suggestions.slice(0, 3);
}

async function fetchPendingEstimates(organizationId: string): Promise<SmartSuggestion[]> {
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const { data, error } = await supabase
    .from('estimates')
    .select('id, estimate_number, total, sent_at, status, client_id, clients(name)')
    .eq('organization_id', organizationId)
    .eq('status', 'sent')
    .not('sent_at', 'is', null)
    .lte('sent_at', threeDaysAgo.toISOString())
    .order('sent_at', { ascending: true })
    .limit(3);

  if (error || !data) return [];

  return data.map((est: any) => {
    const clientName = est.clients?.name || 'Unknown';
    const daysSince = Math.floor(
      (Date.now() - new Date(est.sent_at).getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      id: `estimate-${est.id}`,
      type: 'pending_estimate' as const,
      label: `Follow up with ${clientName}`,
      description: `Estimate sent ${daysSince} days ago - $${Number(est.total).toFixed(0)}`,
      priority: 65 + Math.min(daysSince, 15),
      iconType: 'navigate',
      action: {
        type: 'navigate' as const,
        label: `View estimate for ${clientName}`,
        description: 'Open estimates',
        navigateTo: '/(tabs)/invoices',
        raw: `estimate ${clientName}`,
      },
    };
  });
}
