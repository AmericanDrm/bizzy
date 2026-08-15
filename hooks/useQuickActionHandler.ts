import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import type { ParsedAction } from '@/lib/quickActionParser';

interface ActionCallbacks {
  onAddClient?: (name: string, phone?: string, address?: string, language?: string) => void;
  onInvoiceClient?: (prefill: any) => void;
  onScheduleClient?: (prefill: any, date: Date | null) => void;
  onAddExpense?: (prefill: any) => void;
  onAddIncome?: (prefill: any) => void;
  onRescheduleJob?: (event: { id: string; title: string; start_time: string }, targetDate: Date | null) => void;
  onEventsChanged?: () => void;
  onCreateEstimate?: (prefill: any) => void;
  onSendInvoice?: (invoice: any) => void;
  onSendEstimate?: (estimate: any) => void;
}

function getDayDate(day?: string): Date | null {
  if (!day) return null;
  const now = new Date();
  if (day === 'today') return now;
  if (day === 'tomorrow') {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return d;
  }
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const targetIdx = dayNames.indexOf(day.toLowerCase());
  if (targetIdx === -1) return null;
  const currentIdx = now.getDay();
  let diff = targetIdx - currentIdx;
  if (diff <= 0) diff += 7;
  const d = new Date(now);
  d.setDate(d.getDate() + diff);
  return d;
}

export function useQuickActionHandler(callbacks: ActionCallbacks) {
  const router = useRouter();
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const { showToast } = useToast();

  const findClientByName = useCallback(async (name: string) => {
    if (!currentOrganization?.id || !name) return null;
    const { data } = await supabase
      .from('clients')
      .select('id, name')
      .eq('organization_id', currentOrganization.id)
      .ilike('name', `%${name}%`)
      .limit(1)
      .maybeSingle();
    return data;
  }, [currentOrganization?.id]);

  const findUpcomingEventByClient = useCallback(async (clientName: string) => {
    if (!currentOrganization?.id || !clientName) return null;

    const client = await findClientByName(clientName);
    if (!client) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sixtyDaysAgo = new Date(today);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const { data } = await supabase
      .from('schedule_events')
      .select('id, title, start_time, end_time, client_id, clients(name)')
      .eq('organization_id', currentOrganization.id)
      .eq('client_id', client.id)
      .gte('start_time', sixtyDaysAgo.toISOString())
      .order('start_time', { ascending: false })
      .limit(1)
      .maybeSingle();

    return data;
  }, [currentOrganization?.id, findClientByName]);

  const rescheduleEvent = useCallback(async (
    eventId: string,
    currentStartTime: string,
    currentEndTime: string | null,
    newDate: Date,
  ) => {
    const oldStart = new Date(currentStartTime);
    const oldEnd = currentEndTime ? new Date(currentEndTime) : new Date(oldStart.getTime() + 60 * 60 * 1000);
    const duration = oldEnd.getTime() - oldStart.getTime();

    const newStart = new Date(newDate);
    newStart.setHours(oldStart.getHours(), oldStart.getMinutes(), 0, 0);
    const newEnd = new Date(newStart.getTime() + duration);

    const { error } = await supabase
      .from('schedule_events')
      .update({
        start_time: newStart.toISOString(),
        end_time: newEnd.toISOString(),
      })
      .eq('id', eventId);

    if (error) throw error;
    return { newStart, newEnd };
  }, []);

  const handleAction = useCallback(async (action: ParsedAction) => {
    switch (action.type) {
      case 'direct_create_client':
      case 'add_client': {
        callbacks.onAddClient?.(action.clientName || '', action.phone, action.clientAddress, action.clientLanguage);
        break;
      }

      case 'invoice_client': {
        if (action.clientName) {
          const client = await findClientByName(action.clientName);
          if (client) {
            const items = action.amount ? [{
              description: 'Service',
              quantity: 1,
              unit_price: action.amount,
              discount_amount: 0,
              discount_percentage: 0,
              total: action.amount,
              display_order: 0,
            }] : [];
            callbacks.onInvoiceClient?.({ clientId: client.id, items });
          } else {
            callbacks.onInvoiceClient?.(null);
          }
        } else {
          callbacks.onInvoiceClient?.(null);
        }
        break;
      }

      case 'schedule_client': {
        let targetDate: Date | null = null;
        if (action.targetDate) {
          targetDate = new Date(action.targetDate);
        } else {
          targetDate = getDayDate(action.day);
        }

        if (action.startHour !== undefined && targetDate) {
          targetDate.setHours(action.startHour, action.startMinute || 0, 0, 0);
        }

        if (action.clientName) {
          const client = await findClientByName(action.clientName);
          callbacks.onScheduleClient?.(
            client ? {
              clientId: client.id,
              clientName: client.name,
              jobTitle: action.jobTitle,
              serviceScope: action.serviceScope,
              jobTypeName: action.jobTypeName,
              startHour: action.startHour,
              startMinute: action.startMinute,
            } : {
              jobTitle: action.jobTitle,
              serviceScope: action.serviceScope,
              jobTypeName: action.jobTypeName,
              startHour: action.startHour,
              startMinute: action.startMinute,
            },
            targetDate,
          );
        } else {
          callbacks.onScheduleClient?.({
            jobTitle: action.jobTitle,
            serviceScope: action.serviceScope,
            jobTypeName: action.jobTypeName,
            startHour: action.startHour,
            startMinute: action.startMinute,
          }, targetDate);
        }
        break;
      }

      case 'add_expense': {
        callbacks.onAddExpense?.(action.amount ? {
          id: '',
          amount: action.amount,
          description: '',
          date: new Date().toISOString().split('T')[0],
          category: '',
          type: 'expense',
        } : null);
        break;
      }

      case 'add_income': {
        callbacks.onAddIncome?.(action.amount ? {
          id: '',
          amount: action.amount,
          description: '',
          date: new Date().toISOString().split('T')[0],
          category: '',
          type: 'income',
        } : null);
        break;
      }

      case 'reschedule_job': {
        let targetDate: Date | null = null;
        if (action.targetDate) {
          targetDate = new Date(action.targetDate);
        } else if (action.day) {
          targetDate = getDayDate(action.day);
        }

        if (!action.clientName) {
          router.push('/(tabs)/schedule' as any);
          showToast({ message: 'Search for the job on the schedule to reschedule it', type: 'info', duration: 3000 });
          break;
        }

        const event = await findUpcomingEventByClient(action.clientName);
        if (!event) {
          showToast({ message: `No upcoming job found for "${action.clientName}"`, type: 'error', duration: 3000 });
          break;
        }

        if (targetDate) {
          try {
            await rescheduleEvent(event.id, event.start_time, event.end_time, targetDate);
            const dateLabel = targetDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            const clientLabel = (event as any).clients?.name || event.title;
            showToast({ message: `${clientLabel} moved to ${dateLabel}`, type: 'success', duration: 3000 });
            callbacks.onEventsChanged?.();
          } catch {
            showToast({ message: 'Failed to reschedule job', type: 'error', duration: 3000 });
          }
        } else {
          callbacks.onRescheduleJob?.(
            { id: event.id, title: (event as any).clients?.name || event.title, start_time: event.start_time },
            null,
          );
        }
        break;
      }

      case 'search_client': {
        router.push('/(tabs)/clients' as any);
        break;
      }

      case 'navigate': {
        if (action.navigateTo) {
          router.push(action.navigateTo as any);
        }
        break;
      }

      case 'create_estimate': {
        if (action.clientName) {
          const client = await findClientByName(action.clientName);
          callbacks.onCreateEstimate?.(client ? { clientId: client.id } : null);
        } else {
          callbacks.onCreateEstimate?.(null);
        }
        break;
      }

      case 'send_invoice': {
        if (!currentOrganization?.id) break;
        let clientId: string | null = null;
        if (action.clientName) {
          const client = await findClientByName(action.clientName);
          clientId = client?.id || null;
        }
        const invoiceQuery = supabase
          .from('invoices')
          .select('*')
          .eq('organization_id', currentOrganization.id)
          .order('created_at', { ascending: false })
          .limit(1);
        if (clientId) invoiceQuery.eq('client_id', clientId);
        const { data: invoiceData } = await invoiceQuery.maybeSingle();
        if (!invoiceData) {
          showToast({ message: action.clientName ? `No invoice found for "${action.clientName}"` : 'No invoice found', type: 'error', duration: 3000 });
          break;
        }
        callbacks.onSendInvoice?.(invoiceData);
        break;
      }

      case 'send_estimate': {
        if (!currentOrganization?.id) break;
        let clientId: string | null = null;
        if (action.clientName) {
          const client = await findClientByName(action.clientName);
          clientId = client?.id || null;
        }
        const estimateQuery = supabase
          .from('estimates')
          .select('*')
          .eq('organization_id', currentOrganization.id)
          .order('created_at', { ascending: false })
          .limit(1);
        if (clientId) estimateQuery.eq('client_id', clientId);
        const { data: estimateData } = await estimateQuery.maybeSingle();
        if (!estimateData) {
          showToast({ message: action.clientName ? `No estimate found for "${action.clientName}"` : 'No estimate found', type: 'error', duration: 3000 });
          break;
        }
        callbacks.onSendEstimate?.(estimateData);
        break;
      }

      case 'direct_create_note': {
        if (!user?.id) break;
        const title = action.noteTitle?.trim() || 'Quick note';
        const content = action.noteContent?.trim() || '';
        if (!title && !content) break;
        try {
          const { error } = await supabase.from('notes').insert({
            user_id: user.id,
            title,
            content,
          });
          if (error) throw error;
          showToast({ message: 'Note created', type: 'success', duration: 2500 });
          callbacks.onEventsChanged?.();
        } catch {
          showToast({ message: 'Failed to create note', type: 'error', duration: 3000 });
        }
        break;
      }

      case 'direct_create_shopping_list': {
        if (!currentOrganization?.id || !user?.id) break;
        const listTitle = action.noteTitle?.trim() || 'Shopping List';
        const items = action.shoppingItems || [];
        if (!listTitle && items.length === 0) break;
        try {
          const { data: listData, error: listError } = await supabase
            .from('shopping_lists')
            .insert({
              organization_id: currentOrganization.id,
              created_by: user.id,
              title: listTitle,
              notes: '',
              is_completed: false,
            })
            .select('id')
            .maybeSingle();
          if (listError) throw listError;
          if (listData && items.length > 0) {
            const itemRows = items.map((name, idx) => ({
              shopping_list_id: listData.id,
              organization_id: currentOrganization.id,
              name: name.trim(),
              quantity: null,
              unit: '',
              price: null,
              notes: '',
              is_purchased: false,
              display_order: idx,
            }));
            const { error: itemsError } = await supabase.from('shopping_list_items').insert(itemRows);
            if (itemsError) throw itemsError;
          }
          const itemCount = items.length;
          showToast({
            message: itemCount > 0 ? `Shopping list created with ${itemCount} item${itemCount > 1 ? 's' : ''}` : 'Shopping list created',
            type: 'success',
            duration: 2500,
          });
          callbacks.onEventsChanged?.();
        } catch {
          showToast({ message: 'Failed to create shopping list', type: 'error', duration: 3000 });
        }
        break;
      }
    }
  }, [findClientByName, findUpcomingEventByClient, rescheduleEvent, router, callbacks, showToast, currentOrganization?.id, user?.id]);

  return handleAction;
}
