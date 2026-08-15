import React, { useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import QuickActionBar from './QuickActionBar';
import ClientModal from './ClientModal';
import InvoiceModal from './InvoiceModal';
import FinanceModal from './FinanceModal';
import ScheduleModal from './ScheduleModal';
import type { ParsedAction } from '@/lib/quickActionParser';
import { supabase } from '@/lib/supabase';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';

export default function QuickActionHandler() {
  const router = useRouter();
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [clientModalVisible, setClientModalVisible] = useState(false);
  const [clientPrefillName, setClientPrefillName] = useState('');
  const [clientPrefillPhone, setClientPrefillPhone] = useState('');
  const [clientPrefillAddress, setClientPrefillAddress] = useState('');
  const [clientPrefillLanguage, setClientPrefillLanguage] = useState('');

  const [invoiceModalVisible, setInvoiceModalVisible] = useState(false);
  const [invoicePrefill, setInvoicePrefill] = useState<any>(null);

  const [financeModalVisible, setFinanceModalVisible] = useState(false);
  const [financeType, setFinanceType] = useState<'income' | 'expense'>('expense');
  const [financePrefill, setFinancePrefill] = useState<any>(null);

  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [schedulePrefillClient, setSchedulePrefillClient] = useState<any>(null);
  const [schedulePreselectedDate, setSchedulePreselectedDate] = useState<Date | null>(null);

  const findClientByName = useCallback(async (name: string) => {
    if (!currentOrganization?.id || !name) return null;
    const { data } = await supabase
      .from('clients')
      .select('id, name, phone, email, address')
      .eq('organization_id', currentOrganization.id)
      .ilike('name', `%${name}%`)
      .limit(1)
      .maybeSingle();
    return data;
  }, [currentOrganization?.id]);

  const getDayDate = (day?: string): Date | null => {
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
  };

  const handleAction = useCallback(async (action: ParsedAction) => {
    switch (action.type) {
      case 'direct_create_client':
      case 'add_client': {
        setClientPrefillName(action.clientName || '');
        setClientPrefillPhone(action.phone || '');
        setClientPrefillAddress(action.clientAddress || '');
        setClientPrefillLanguage(action.clientLanguage || '');
        setClientModalVisible(true);
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
            setInvoicePrefill({ clientId: client.id, items });
          } else {
            setInvoicePrefill(null);
          }
        } else {
          setInvoicePrefill(null);
        }
        setInvoiceModalVisible(true);
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
        } else if (targetDate) {
          targetDate.setHours(8, 0, 0, 0);
        }

        setSchedulePreselectedDate(targetDate);

        if (action.clientName) {
          const client = await findClientByName(action.clientName);
          if (client) {
            setSchedulePrefillClient({
              clientId: client.id,
              clientName: client.name,
              phone: client.phone,
              email: client.email,
              address: client.address,
              jobTitle: action.jobTitle,
              serviceScope: action.serviceScope,
              jobTypeName: action.jobTypeName,
              startHour: action.startHour,
              startMinute: action.startMinute,
            });
          } else {
            setSchedulePrefillClient({
              jobTitle: action.jobTitle,
              serviceScope: action.serviceScope,
              jobTypeName: action.jobTypeName,
              startHour: action.startHour,
              startMinute: action.startMinute,
            });
          }
        } else {
          setSchedulePrefillClient({
            jobTitle: action.jobTitle,
            serviceScope: action.serviceScope,
            jobTypeName: action.jobTypeName,
            startHour: action.startHour,
            startMinute: action.startMinute,
          });
        }
        setScheduleModalVisible(true);
        break;
      }

      case 'add_expense': {
        setFinanceType('expense');
        setFinancePrefill(action.amount ? {
          id: '',
          amount: action.amount,
          description: '',
          date: new Date().toISOString().split('T')[0],
          category: '',
          type: 'expense',
        } : null);
        setFinanceModalVisible(true);
        break;
      }

      case 'add_income': {
        setFinanceType('income');
        setFinancePrefill(action.amount ? {
          id: '',
          amount: action.amount,
          description: '',
          date: new Date().toISOString().split('T')[0],
          category: '',
          type: 'income',
        } : null);
        setFinanceModalVisible(true);
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
    }
  }, [findClientByName, router, currentOrganization?.id, user?.id, showToast]);

  const handleModalClose = useCallback(() => {
    setClientModalVisible(false);
    setInvoiceModalVisible(false);
    setFinanceModalVisible(false);
    setScheduleModalVisible(false);
    setClientPrefillName('');
    setClientPrefillPhone('');
    setClientPrefillAddress('');
    setClientPrefillLanguage('');
    setInvoicePrefill(null);
    setFinancePrefill(null);
    setSchedulePrefillClient(null);
    setSchedulePreselectedDate(null);
  }, []);

  return (
    <>
      <QuickActionBar onAction={handleAction} />

      <ClientModal
        visible={clientModalVisible}
        client={null}
        onClose={handleModalClose}
        onSave={handleModalClose}
        prefillName={clientPrefillName || undefined}
        prefillPhone={clientPrefillPhone || undefined}
        prefillAddress={clientPrefillAddress || undefined}
        prefillLanguage={clientPrefillLanguage || undefined}
      />

      <InvoiceModal
        visible={invoiceModalVisible}
        invoice={null}
        onClose={handleModalClose}
        onSave={handleModalClose}
        prefill={invoicePrefill}
      />

      <FinanceModal
        visible={financeModalVisible}
        type={financeType}
        item={financePrefill}
        onClose={handleModalClose}
        onSave={handleModalClose}
      />

      <ScheduleModal
        visible={scheduleModalVisible}
        onClose={handleModalClose}
        onSave={handleModalClose}
        preselectedDate={schedulePreselectedDate}
        prefillFromClient={schedulePrefillClient}
      />
    </>
  );
}
