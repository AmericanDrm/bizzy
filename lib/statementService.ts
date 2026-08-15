import { supabase } from '@/lib/supabase';

export type SortMode = 'oldest_first' | 'newest_first' | 'past_due_first';

export interface StatementInvoice {
  id: string;
  invoice_number: string;
  memo: string | null;
  total: number;
  amount_paid: number;
  due_date: string;
  payment_status: string;
  issue_date: string;
}

export async function fetchOutstandingInvoices(clientId: string, organizationId: string): Promise<StatementInvoice[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select('id, invoice_number, memo, total, amount_paid, due_date, payment_status, issue_date')
    .eq('client_id', clientId)
    .eq('organization_id', organizationId)
    .not('payment_status', 'eq', 'paid')
    .order('due_date', { ascending: true });

  if (error || !data) return [];

  return data.map(inv => ({
    id: inv.id,
    invoice_number: inv.invoice_number || '',
    memo: inv.memo || null,
    total: Number(inv.total) || 0,
    amount_paid: Number(inv.amount_paid) || 0,
    due_date: inv.due_date,
    payment_status: inv.payment_status || 'sent',
    issue_date: inv.issue_date,
  }));
}

export function sortInvoices(invoices: StatementInvoice[], mode: SortMode): StatementInvoice[] {
  const sorted = [...invoices];
  const today = new Date().toISOString().split('T')[0];

  switch (mode) {
    case 'oldest_first':
      return sorted.sort((a, b) => a.due_date.localeCompare(b.due_date));
    case 'newest_first':
      return sorted.sort((a, b) => b.due_date.localeCompare(a.due_date));
    case 'past_due_first': {
      const pastDue = sorted.filter(i => i.due_date < today).sort((a, b) => a.due_date.localeCompare(b.due_date));
      const current = sorted.filter(i => i.due_date >= today).sort((a, b) => a.due_date.localeCompare(b.due_date));
      return [...pastDue, ...current];
    }
    default:
      return sorted;
  }
}

export function getAmountDue(invoice: StatementInvoice): number {
  return Math.max(0, invoice.total - invoice.amount_paid);
}

export function isOverdue(invoice: StatementInvoice): boolean {
  const today = new Date().toISOString().split('T')[0];
  return invoice.due_date < today;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

function getInvoiceLabel(invoice: StatementInvoice): string {
  if (invoice.memo && invoice.memo.trim()) {
    return `#${invoice.invoice_number} (${invoice.memo.trim()})`;
  }
  return `#${invoice.invoice_number}`;
}

export function buildStatementPlainText(
  invoices: StatementInvoice[],
  clientName: string,
  businessName: string,
): string {
  const lines: string[] = [];
  lines.push(`Outstanding Invoices from ${businessName}`);
  lines.push(`Client: ${clientName}`);
  lines.push('');

  let totalDue = 0;
  for (const inv of invoices) {
    const due = getAmountDue(inv);
    totalDue += due;
    const overdue = isOverdue(inv) ? ' [PAST DUE]' : '';
    lines.push(`${getInvoiceLabel(inv)} - ${formatCurrency(due)} - Due: ${formatDate(inv.due_date)}${overdue}`);
  }

  lines.push('');
  lines.push(`Total Outstanding: ${formatCurrency(totalDue)}`);

  return lines.join('\n');
}
