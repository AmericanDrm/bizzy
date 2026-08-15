import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  TextInput,
  Platform,
} from 'react-native';
import { Plus, Search, X, FileText, Receipt, Settings, Settings2, Image, Check, Clock, CircleAlert as AlertCircle, CreditCard, Banknote, Building2, MoveHorizontal as MoreHorizontal, CalendarPlus, PenTool, ThumbsDown, Trash2, Download, ArrowRightLeft, Link2, Copy, Users, Calendar, ClipboardList, Send } from 'lucide-react-native';
import SwipeableRow from '@/components/SwipeableRow';
import { supabase, invokeFunction } from '@/lib/supabase';
import { PDFGenerator } from '@/lib/pdfGenerator';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import { useTabNavigation } from '@/contexts/TabNavigationContext';
import { useLanguage } from '@/contexts/LanguageContext';
import InvoiceModal from '@/components/InvoiceModal';
import WorkflowFab from '@/components/WorkflowFab';
import type { FabAction } from '@/components/WorkflowFab';
import ClientModal from '@/components/ClientModal';
import ScheduleCalendarPickerModal from '@/components/ScheduleCalendarPickerModal';
import EstimateModal from '@/components/EstimateModal';
import EstimateApprovalModal from '@/components/EstimateApprovalModal';
import ConvertEstimateToJobModal from '@/components/ConvertEstimateToJobModal';
import ScheduleModal from '@/components/ScheduleModal';
import PaymentMethodModal from '@/components/PaymentMethodModal';
import LogoUploadModal from '@/components/LogoUploadModal';
import DateRangeFilter from '@/components/DateRangeFilter';
import { AnimatedTabContent } from '@/components/AnimatedTabContent';
import { getSlideDirection, getDynamicTabOrder } from '@/utils/tabAnimations';
import getDynamicStyles from '@/styles/invoicesStyles';
import { useLayout } from '@/contexts/LayoutContext';
import SwipeActionsSettingsModal from '@/components/SwipeActionsSettingsModal';
import { useOrganization } from '@/contexts/OrganizationContext';
import { inferPaneDetailsFromDescription } from '@/lib/productionRateService';
import { useQuickActionHandler } from '@/hooks/useQuickActionHandler';
import DuplicateInvoiceModal from '@/components/DuplicateInvoiceModal';

interface Invoice {
  id: string;
  client_id: string;
  invoice_number: string;
  status: string;
  issue_date: string;
  due_date: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  cc_fee_amount?: number;
  notes: string;
  sent_via?: string;
  sent_at?: string;
  payment_status?: string;
  payment_method?: string;
  amount_paid?: number;
  paid_date?: string;
  schedule_event_id?: string;
  client?: { name: string };
}

interface Estimate {
  id: string;
  client_id: string;
  estimate_number: string;
  status: string;
  issue_date: string;
  valid_until: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount_amount: number;
  discount_percentage: number;
  total: number;
  notes: string;
  sent_via?: string;
  sent_at?: string;
  validity_period?: string;
  requires_signature?: boolean;
  signed_at?: string;
  signature_data?: string;
  signed_by_name?: string;
  signed_by_email?: string;
  client_notes?: string;
  client?: { name: string };
  service_address_id?: string | null;
}

interface BusinessSettings {
  id: string;
  logo_url: string;
  business_name: string;
  stripe_payment_link?: string;
  venmo_username?: string;
  cashapp_username?: string;
  zelle_email?: string;
  zelle_phone?: string;
  check_payable_to?: string;
  check_mailing_address?: string;
  send_receipt_email?: boolean;
  include_google_review_on_receipt?: boolean;
  google_review_url?: string;
}

type TabType = 'invoices' | 'estimates';

export default function InvoicesScreen() {
  const [activeTab, setActiveTab] = useState<TabType>('invoices');
  const [previousTab, setPreviousTab] = useState<TabType | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [invoiceModalVisible, setInvoiceModalVisible] = useState(false);
  const [estimateModalVisible, setEstimateModalVisible] = useState(false);
  const [invoiceModalKey, setInvoiceModalKey] = useState(0);
  const [estimateModalKey, setEstimateModalKey] = useState(0);
  const openInvoiceModal = () => { setInvoiceModalKey(k => k + 1); setInvoiceModalVisible(true); };
  const openEstimateModal = () => { setEstimateModalKey(k => k + 1); setEstimateModalVisible(true); };
  const [invoiceAutoSend, setInvoiceAutoSend] = useState(false);
  const [estimateAutoSend, setEstimateAutoSend] = useState(false);
  const [logoModalVisible, setLogoModalVisible] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedEstimate, setSelectedEstimate] = useState<Estimate | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [selectedPaymentInvoice, setSelectedPaymentInvoice] = useState<Invoice | null>(null);
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [approvalModalVisible, setApprovalModalVisible] = useState(false);
  const [approvalEstimateId, setApprovalEstimateId] = useState<string | null>(null);
  const [approvalClientName, setApprovalClientName] = useState('');
  const [approvalClientEmail, setApprovalClientEmail] = useState('');
  const [convertModalVisible, setConvertModalVisible] = useState(false);
  const [convertEstimateId, setConvertEstimateId] = useState<string | null>(null);
  const [estimatePrefill, setEstimatePrefill] = useState<{ estimateId: string; clientId: string; title: string; description: string; amount: number } | null>(null);
  const [invoicePrefill, setInvoicePrefill] = useState<{ clientId: string; items: any[]; notes?: string; taxRate?: string } | null>(null);
  const [duplicateModalVisible, setDuplicateModalVisible] = useState(false);
  const [duplicateSourceInvoice, setDuplicateSourceInvoice] = useState<any>(null);
  const [fabOpen, setFabOpen] = useState(false);
  const [contextEstimate, setContextEstimate] = useState<Estimate | null>(null);
  const [contextInvoice, setContextInvoice] = useState<Invoice | null>(null);
  const [clientModalVisible, setClientModalVisible] = useState(false);
  const [clientForEdit, setClientForEdit] = useState<any>(null);
  const [clientPrefillName, setClientPrefillName] = useState('');
  const [clientPrefillPhone, setClientPrefillPhone] = useState('');
  const [clientPrefillAddress, setClientPrefillAddress] = useState('');
  const [clientPrefillLanguage, setClientPrefillLanguage] = useState('');
  const [calendarPickerVisible, setCalendarPickerVisible] = useState(false);
  const [scheduleClientPrefill, setScheduleClientPrefill] = useState<any>(null);
  const [schedulePreselectedDate, setSchedulePreselectedDate] = useState<Date | null>(null);
  const [invoiceFilter, setInvoiceFilter] = useState<'all' | 'unpaid' | 'unsent'>('unpaid');
  const [estimateFilter, setEstimateFilter] = useState<'all' | 'unsent'>('all');
  const [invoicePage, setInvoicePage] = useState(1);
  const [estimatePage, setEstimatePage] = useState(1);
  const PAGE_SIZE = 25;
  const { user } = useAuth();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const { currentTab: globalCurrentTab, previousTab: globalPreviousTab } = useTabNavigation();
  const { currentOrganization, isAdminOrOwner, employeeInvoicesHidden } = useOrganization();
  const handleQuickAction = useQuickActionHandler({
    onInvoiceClient: (prefill) => {
      setInvoiceAutoSend(false);
      setSelectedInvoice(null);
      openInvoiceModal();
    },
    onScheduleClient: (prefill, date) => {
      setScheduleClientPrefill(prefill);
      setSchedulePreselectedDate(date);
      setScheduleModalVisible(true);
    },
    onAddClient: (name, phone, address, language) => {
      setClientPrefillName(name || '');
      setClientPrefillPhone(phone || '');
      setClientPrefillAddress(address || '');
      setClientPrefillLanguage(language || '');
      setClientModalVisible(true);
    },
    onCreateEstimate: (prefill) => {
      setEstimateAutoSend(false);
      setSelectedEstimate(null);
      openEstimateModal();
    },
    onSendInvoice: (invoice) => {
      setInvoiceAutoSend(true);
      setSelectedInvoice(invoice);
      openInvoiceModal();
    },
    onSendEstimate: (estimate) => {
      setEstimateAutoSend(true);
      setSelectedEstimate(estimate);
      openEstimateModal();
    },
  });
  const pendingInvoiceDeleteRef = useRef<{ invoice: Invoice; timeoutId: ReturnType<typeof setTimeout> } | null>(null);
  const pendingEstimateDeleteRef = useRef<{ estimate: Estimate; timeoutId: ReturnType<typeof setTimeout> } | null>(null);
  const { visibleTabs, dominantHand, swipeActionsInvoices } = useLayout();
  const [swipeSettingsVisible, setSwipeSettingsVisible] = useState(false);
  const dynamicOrder = getDynamicTabOrder(visibleTabs);
  const slideDirection = getSlideDirection(globalPreviousTab, globalCurrentTab, dynamicOrder);
  const dynamicStyles = getDynamicStyles(colors);
  const filteredInvoices = useMemo(() => {
    let filtered = invoices;

    if (invoiceFilter === 'unpaid') {
      filtered = filtered.filter(inv => inv.payment_status !== 'paid');
    } else if (invoiceFilter === 'unsent') {
      filtered = filtered.filter(inv => inv.status === 'draft' || !inv.sent_at);
    }

    if (startDate || endDate) {
      filtered = filtered.filter(inv => {
        const invDate = new Date(inv.issue_date);
        if (startDate && invDate < startDate) return false;
        if (endDate && invDate > endDate) return false;
        return true;
      });
    }

    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(
        inv =>
          inv.invoice_number.toLowerCase().includes(query) ||
          inv.client?.name?.toLowerCase().includes(query) ||
          inv.status.toLowerCase().includes(query) ||
          inv.payment_status?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [invoices, debouncedSearchQuery, startDate, endDate, invoiceFilter]);

  const unpaidTotal = useMemo(() => {
    if (invoiceFilter !== 'unpaid') return null;
    return filteredInvoices.reduce((sum, inv) => {
      const remaining = (inv.total || 0) - (inv.amount_paid || 0);
      return sum + Math.max(remaining, 0);
    }, 0);
  }, [filteredInvoices, invoiceFilter]);

  const filteredEstimates = useMemo(() => {
    let filtered = estimates;

    if (estimateFilter === 'unsent') {
      filtered = filtered.filter(est => est.status === 'draft' || !est.sent_at);
    }

    if (startDate || endDate) {
      filtered = filtered.filter(est => {
        const estDate = new Date(est.issue_date);
        if (startDate && estDate < startDate) return false;
        if (endDate && estDate > endDate) return false;
        return true;
      });
    }

    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(
        est =>
          est.estimate_number.toLowerCase().includes(query) ||
          est.client?.name?.toLowerCase().includes(query) ||
          est.status.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [estimates, debouncedSearchQuery, startDate, endDate, estimateFilter]);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setInvoicePage(1);
      setEstimatePage(1);
    }, 300);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery]);

  useEffect(() => { setInvoicePage(1); }, [invoiceFilter, startDate, endDate]);
  useEffect(() => { setEstimatePage(1); }, [estimateFilter, startDate, endDate]);

  const pagedInvoices = useMemo(() =>
    filteredInvoices.slice(0, invoicePage * PAGE_SIZE)
  , [filteredInvoices, invoicePage]);

  const pagedEstimates = useMemo(() =>
    filteredEstimates.slice(0, estimatePage * PAGE_SIZE)
  , [filteredEstimates, estimatePage]);

  const handleLoadMoreInvoices = useCallback(() => {
    if (pagedInvoices.length < filteredInvoices.length) setInvoicePage(p => p + 1);
  }, [pagedInvoices.length, filteredInvoices.length]);

  const handleLoadMoreEstimates = useCallback(() => {
    if (pagedEstimates.length < filteredEstimates.length) setEstimatePage(p => p + 1);
  }, [pagedEstimates.length, filteredEstimates.length]);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!currentOrganization) return;

    const estimatesChannel = supabase
      .channel(`estimates-status-${currentOrganization.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'estimates',
          filter: `organization_id=eq.${currentOrganization.id}`,
        },
        (payload) => {
          setEstimates((prev) =>
            prev.map((est) =>
              est.id === payload.new.id ? { ...est, ...payload.new } : est
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(estimatesChannel);
    };
  }, [currentOrganization?.id]);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchInvoices(), fetchEstimates(), fetchBusinessSettings()]);
    setLoading(false);
  };

  const fetchInvoices = async () => {
    if (!currentOrganization) return;
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, client:clients(name)')
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setInvoices(data || []);
    } catch (error: any) {
      showToast({
        message: error?.message || 'Failed to load invoices',
        type: 'error',
        duration: 8000,
        action: { label: 'Retry', onPress: () => fetchInvoices() },
      });
    }
  };

  const fetchEstimates = async () => {
    if (!currentOrganization) return;
    try {
      const { data, error } = await supabase
        .from('estimates')
        .select('*, client:clients(name)')
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setEstimates(data || []);
    } catch (error: any) {
      showToast({
        message: error?.message || 'Failed to load estimates',
        type: 'error',
        duration: 8000,
        action: { label: 'Retry', onPress: () => fetchEstimates() },
      });
    }
  };

  const fetchBusinessSettings = async () => {
    if (!currentOrganization) return;
    try {
      const { data, error } = await supabase
        .from('business_settings')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setBusinessSettings(data);
      }
    } catch (error: any) {
      console.error('Failed to load business settings:', error);
    }
  };

  const handleAddInvoice = useCallback(() => {
    setSelectedInvoice(null);
    openInvoiceModal();
  }, []);

  const handleEditInvoice = useCallback((invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setContextInvoice(invoice);
    setContextEstimate(null);
    openInvoiceModal();
  }, []);

  const handleDeleteInvoice = (invoice: Invoice) => {
    if (pendingInvoiceDeleteRef.current) {
      clearTimeout(pendingInvoiceDeleteRef.current.timeoutId);
      executeInvoiceDelete(pendingInvoiceDeleteRef.current.invoice);
    }

    setInvoices((prev) => prev.filter((i) => i.id !== invoice.id));

    const timeoutId = setTimeout(() => {
      executeInvoiceDelete(invoice);
      pendingInvoiceDeleteRef.current = null;
    }, 5000);

    pendingInvoiceDeleteRef.current = { invoice, timeoutId };

    showToast({
      message: `Invoice ${invoice.invoice_number} deleted`,
      type: 'info',
      duration: 5000,
      action: {
        label: 'Undo',
        onPress: () => {
          if (pendingInvoiceDeleteRef.current?.invoice.id === invoice.id) {
            clearTimeout(pendingInvoiceDeleteRef.current.timeoutId);
            pendingInvoiceDeleteRef.current = null;
            setInvoices((prev) => [invoice, ...prev]);
            showToast({ message: 'Invoice restored', type: 'success', duration: 2000 });
          }
        },
      },
    });
  };

  const executeInvoiceDelete = async (invoice: Invoice) => {
    try {
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoice.id)
       .eq('user_id', user!.id);
      
      if (error) throw error;
    } catch (error: any) {
      showToast({
        message: error?.message || 'Failed to delete invoice',
        type: 'error',
        duration: 4000,
      });
      fetchInvoices();
    }
  };

  const handleAddEstimate = useCallback(() => {
    setSelectedEstimate(null);
    openEstimateModal();
  }, []);

  const handleEditEstimate = useCallback((estimate: Estimate) => {
    setSelectedEstimate(estimate);
    setContextEstimate(estimate);
    setContextInvoice(null);
    openEstimateModal();
  }, []);

  const handleDeleteEstimate = (estimate: Estimate) => {
    if (pendingEstimateDeleteRef.current) {
      clearTimeout(pendingEstimateDeleteRef.current.timeoutId);
      executeEstimateDelete(pendingEstimateDeleteRef.current.estimate);
    }

    setEstimates((prev) => prev.filter((e) => e.id !== estimate.id));

    const timeoutId = setTimeout(() => {
      executeEstimateDelete(estimate);
      pendingEstimateDeleteRef.current = null;
    }, 5000);

    pendingEstimateDeleteRef.current = { estimate, timeoutId };

    showToast({
      message: `Estimate ${estimate.estimate_number} deleted`,
      type: 'info',
      duration: 5000,
      action: {
        label: 'Undo',
        onPress: () => {
          if (pendingEstimateDeleteRef.current?.estimate.id === estimate.id) {
            clearTimeout(pendingEstimateDeleteRef.current.timeoutId);
            pendingEstimateDeleteRef.current = null;
            setEstimates((prev) => [estimate, ...prev]);
            showToast({ message: 'Estimate restored', type: 'success', duration: 2000 });
          }
        },
      },
    });
  };

  const executeEstimateDelete = async (estimate: Estimate) => {
    try {
      const { error } = await supabase
        .from('estimates')
        .delete()
        .eq('id', estimate.id)
        .eq('user_id', user!.id);
      
      if (error) throw error;
    } catch (error: any) {
      showToast({
        message: error?.message || 'Failed to delete estimate',
        type: 'error',
        duration: 4000,
      });
      fetchEstimates();
    }
  };

  const handleSetInvoiceFilter = useCallback((f: 'all' | 'unpaid' | 'unsent') => setInvoiceFilter(f), []);
  const handleSetEstimateFilter = useCallback((f: 'all' | 'unsent') => setEstimateFilter(f), []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
      case 'accepted':
      case 'approved':
        return colors.success;
      case 'sent':
        return colors.primary;
      case 'overdue':
      case 'declined':
      case 'expired':
        return colors.error;
      case 'cancelled':
        return colors.textSecondary;
      default:
        return colors.warning;
    }
  };

  const handleApproveEstimate = async (estimate: Estimate) => {
    const { data: client } = await supabase
      .from('clients')
      .select('name, email')
      .eq('id', estimate.client_id)
      .maybeSingle();

    setApprovalEstimateId(estimate.id);
    setApprovalClientName(client?.name || '');
    setApprovalClientEmail(client?.email || '');
    setApprovalModalVisible(true);
  };

  const handleConvertToJob = async (estimate: Estimate) => {
    setConvertEstimateId(estimate.id);
    setConvertModalVisible(true);
  };

  const handleConvertToInvoice = async (estimate: Estimate) => {
    try {
      const { data: items } = await supabase
        .from('estimate_items')
        .select('*')
        .eq('estimate_id', estimate.id);

      const { data: numData } = await supabase.rpc('generate_invoice_number');
      const invoiceNumber = numData || `INV-${Date.now()}`;

      const today = new Date().toISOString().split('T')[0];
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      const invoiceItems = (items || []).map((item: any) => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.total,
        pane_details: item.pane_details || null,
        service_scope: item.service_scope || null,
        job_type_id: item.job_type_id || null,
        display_order: item.display_order || null,
      }));

      const { data, error } = await supabase
        .from('invoices')
        .insert({
          user_id: user!.id,
          client_id: estimate.client_id,
          invoice_number: invoiceNumber,
          status: 'draft',
          issue_date: today,
          due_date: dueDate.toISOString().split('T')[0],
          subtotal: estimate.subtotal,
          tax_rate: estimate.tax_rate,
          tax_amount: estimate.tax_amount,
          total: estimate.total,
          notes: estimate.notes || '',
          payment_status: 'draft',
          payment_terms: 'net_30',
          service_address_id: estimate.service_address_id || null,
        })
        .select('id')
        .single();

      if (error) throw error;

      if (invoiceItems.length > 0) {
        const { error: itemsError } = await supabase
          .from('invoice_items')
          .insert(invoiceItems.map((item: any) => ({ ...item, invoice_id: data.id })));
        if (itemsError) throw itemsError;
      }

      if (currentOrganization?.id) {
        const serviceAddressId = estimate.service_address_id || null;
        const paneItems = (items || []).filter(
          (item: any) => item.job_type_id && item.quantity > 0
        );
        for (const item of paneItems) {
          const resolvedPaneDetails = item.pane_details ||
            inferPaneDetailsFromDescription(item.description, item.quantity);

          let query = supabase
            .from('client_unit_quantities')
            .select('id, pane_details')
            .eq('client_id', estimate.client_id)
            .eq('job_type_id', item.job_type_id);

          if (serviceAddressId) {
            query = query.eq('address_id', serviceAddressId);
          } else {
            query = query.is('address_id', null);
          }

          const { data: existing } = await query.maybeSingle();

          if (existing) {
            await supabase
              .from('client_unit_quantities')
              .update({
                quantity: item.quantity,
                pane_details: resolvedPaneDetails || existing.pane_details || null,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existing.id);
          } else {
            await supabase
              .from('client_unit_quantities')
              .insert({
                client_id: estimate.client_id,
                job_type_id: item.job_type_id,
                quantity: item.quantity,
                pane_details: resolvedPaneDetails || null,
                organization_id: currentOrganization.id,
                address_id: serviceAddressId,
              });
          }
        }
      }

      await supabase
        .from('estimates')
        .update({ status: 'converted', updated_at: new Date().toISOString() })
        .eq('id', estimate.id);

      fetchInvoices();
      fetchEstimates();
      setActiveTab('invoices');
      showToast({ message: `Invoice ${invoiceNumber} created from estimate`, type: 'success', duration: 3000 });
    } catch (error: any) {
      showToast({ message: error?.message || 'Failed to convert estimate', type: 'error', duration: 4000 });
    }
  };

  const handleDownloadEstimatePDF = async (estimate: Estimate) => {
    try {
      const [{ data: items }, { data: client }] = await Promise.all([
        supabase
          .from('estimate_items')
          .select('*')
          .eq('estimate_id', estimate.id)
          .order('display_order'),
        supabase
          .from('clients')
          .select('name, email, phone, address')
          .eq('id', estimate.client_id)
          .maybeSingle(),
      ]);

      const bs = businessSettings || {} as any;
      const success = await PDFGenerator.shareEstimatePDF({
        estimate_number: estimate.estimate_number,
        issue_date: estimate.issue_date,
        valid_until: estimate.valid_until,
        client_name: client?.name || estimate.client?.name || '',
        client_email: client?.email || '',
        client_phone: client?.phone || '',
        client_address: client?.address || '',
        business_name: bs.business_name || '',
        business_address: bs.business_address || '',
        business_phone: bs.business_phone || '',
        business_email: bs.business_email || '',
        logo_url: bs.logo_url || undefined,
        items: (items || []).map((i: any) => ({
          description: i.description,
          quantity: i.quantity,
          unit_price: i.unit_price,
          total: i.total,
          is_optional: i.is_optional,
          discount_amount: i.discount_amount,
          discount_percentage: i.discount_percentage,
        })),
        subtotal: estimate.subtotal,
        tax_rate: estimate.tax_rate,
        tax_amount: estimate.tax_amount,
        discount_amount: estimate.discount_amount,
        discount_percentage: estimate.discount_percentage,
        total: estimate.total,
        notes: estimate.notes || '',
      });

      if (success) {
        showToast({ message: 'Estimate PDF ready', type: 'success' });
      } else {
        showToast({ message: 'PDF sharing not available on this device', type: 'warning' });
      }
    } catch (error: any) {
      showToast({ message: error?.message || 'Failed to generate PDF', type: 'error', duration: 4000 });
    }
  };

  const handleDownloadInvoicePDF = async (invoice: Invoice) => {
    try {
      const [{ data: items }, { data: client }] = await Promise.all([
        supabase
          .from('invoice_items')
          .select('*')
          .eq('invoice_id', invoice.id),
        supabase
          .from('clients')
          .select('name, email, phone, address')
          .eq('id', invoice.client_id)
          .maybeSingle(),
      ]);

      const bs = businessSettings || {} as any;
      const success = await PDFGenerator.shareInvoicePDF({
        invoice_number: invoice.invoice_number,
        issue_date: invoice.issue_date,
        due_date: invoice.due_date,
        client_name: client?.name || invoice.client?.name || '',
        client_email: client?.email || '',
        client_phone: client?.phone || '',
        client_address: client?.address || '',
        business_name: bs.business_name || '',
        business_address: bs.business_address || '',
        business_phone: bs.business_phone || '',
        business_email: bs.business_email || '',
        logo_url: bs.logo_url || undefined,
        items: (items || []).map((i: any) => ({
          description: i.description,
          quantity: i.quantity,
          unit_price: i.unit_price,
          total: i.total,
        })),
        subtotal: invoice.subtotal,
        tax_rate: invoice.tax_rate,
        tax_amount: invoice.tax_amount,
        total: invoice.total,
        notes: invoice.notes || '',
        payment_terms: (invoice as any).payment_terms,
        late_fee_amount: (invoice as any).late_fee_amount,
        memo: (invoice as any).memo || undefined,
        stripe_payment_link: bs.stripe_payment_link || undefined,
        venmo_username: bs.venmo_username || undefined,
        cashapp_username: bs.cashapp_username || undefined,
        zelle_email: bs.zelle_email || undefined,
        zelle_phone: bs.zelle_phone || undefined,
        check_payable_to: bs.check_payable_to || undefined,
        check_mailing_address: bs.check_mailing_address || undefined,
      });

      if (success) {
        showToast({ message: 'Invoice PDF ready', type: 'success' });
      } else {
        showToast({ message: 'PDF sharing not available on this device', type: 'warning' });
      }
    } catch (error: any) {
      showToast({ message: error?.message || 'Failed to generate PDF', type: 'error', duration: 4000 });
    }
  };

  const handleQuickPaymentStatus = async (invoice: Invoice, status: 'pending' | 'overdue') => {
    try {
      const { error } = await supabase
        .from('invoices')
        .update({
          payment_status: status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', invoice.id)
        .eq('user_id', user!.id);

      if (error) throw error;

      setInvoices(prev =>
        prev.map(inv =>
          inv.id === invoice.id ? { ...inv, payment_status: status } : inv
        )
      );

      showToast({
        message: `Invoice marked as ${status}`,
        type: 'success',
        duration: 2000,
      });
    } catch (error: any) {
      showToast({
        message: error?.message || 'Failed to update payment status',
        type: 'error',
        duration: 4000,
      });
    }
  };

  const handleSendReminder = useCallback(async (invoice: Invoice) => {
    if (!currentOrganization) return;
    try {
      const { data: client } = await supabase
        .from('clients')
        .select('name, email')
        .eq('id', invoice.client_id)
        .maybeSingle();
      if (!client?.email) {
        showToast({ message: 'No email on file for this client', type: 'error', duration: 3000 });
        return;
      }
      const { data, error } = await invokeFunction('send-invoice-email', {
        invoiceId: invoice.id,
        clientEmail: client.email,
        clientName: client.name,
        sendToSelf: false,
      });
      if (error || !data?.success) {
        throw new Error(error?.message || data?.error || 'Failed to send reminder');
      }
      showToast({ message: `Reminder sent to ${client.email}`, type: 'success', duration: 3000 });
    } catch (e: any) {
      showToast({ message: e.message || 'Failed to send reminder', type: 'error', duration: 4000 });
    }
  }, [currentOrganization, showToast]);

  const handleDuplicateInvoice = useCallback(async (invoice: Invoice) => {
    setDuplicateSourceInvoice(invoice);
    setDuplicateModalVisible(true);
  }, []);

  const handleDuplicateClientLastInvoice = useCallback(async (clientId: string) => {
    if (!currentOrganization) return;
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, client_id, invoice_number, tax_rate, notes, memo, payment_terms, subtotal, tax_amount, total, client:clients(name)')
        .eq('client_id', clientId)
        .eq('organization_id', currentOrganization.id)
        .order('issue_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        showToast({ message: 'No invoices found for this client', type: 'error', duration: 3000 });
        return;
      }
      setDuplicateSourceInvoice(data);
      setDuplicateModalVisible(true);
    } catch (err: any) {
      showToast({ message: err?.message || 'Failed to load invoice', type: 'error', duration: 4000 });
    }
  }, [currentOrganization, showToast]);

  const handleCopyPaymentLink = useCallback(async () => {
    const link = businessSettings?.stripe_payment_link;
    if (!link) return;
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(link);
      showToast({ message: 'Payment link copied to clipboard', type: 'success', duration: 2000 });
    }
  }, [businessSettings?.stripe_payment_link]);

  const closeFab = useCallback(() => setFabOpen(false), []);
  const toggleFab = useCallback(() => {
    if (!contextEstimate && !contextInvoice) {
      if (activeTab === 'invoices') {
        handleAddInvoice();
      } else {
        handleAddEstimate();
      }
      return;
    }
    setFabOpen(prev => !prev);
  }, [contextEstimate, contextInvoice, activeTab, handleAddInvoice, handleAddEstimate]);

  const handleContextEditClient = useCallback(async () => {
    closeFab();
    const clientId = contextEstimate?.client_id || contextInvoice?.client_id;
    if (clientId) {
      const { data } = await supabase
        .from('clients')
        .select('id, name, email, phone, address, notes')
        .eq('id', clientId)
        .maybeSingle();
      if (data) {
        setClientForEdit(data);
        setClientModalVisible(true);
      }
    }
  }, [contextEstimate, contextInvoice]);

  const handleContextScheduleJob = useCallback(async () => {
    closeFab();
    const clientId = contextEstimate?.client_id || contextInvoice?.client_id;
    if (clientId) {
      const { data } = await supabase
        .from('clients')
        .select('id, name, phone, email, address')
        .eq('id', clientId)
        .maybeSingle();
      if (data) {
        setScheduleClientPrefill({
          clientId: data.id,
          clientName: data.name,
          address: data.address,
          phone: data.phone,
          email: data.email,
        });
        setCalendarPickerVisible(true);
      }
    }
  }, [contextEstimate, contextInvoice]);

  const handleContextCreateInvoice = useCallback(() => {
    closeFab();
    if (contextEstimate) {
      setSelectedInvoice(null);
      setContextInvoice(null);
      openInvoiceModal();
    }
  }, [contextEstimate]);

  const fabActions = useMemo((): FabAction[] => {
    if (contextEstimate) {
      return [
        { id: 'editClient', label: 'Edit Client', icon: Users, color: '#1B4D6E', onPress: handleContextEditClient },
        { id: 'schedule', label: 'Schedule Job', icon: Calendar, color: '#d97706', onPress: handleContextScheduleJob },
        { id: 'invoice', label: 'Create Invoice', icon: Receipt, color: '#059669', onPress: handleContextCreateInvoice },
      ];
    }
    if (contextInvoice) {
      return [
        { id: 'editClient', label: 'Edit Client', icon: Users, color: '#1B4D6E', onPress: handleContextEditClient },
        { id: 'estimate', label: 'New Estimate', icon: ClipboardList, color: '#2563eb', onPress: () => { closeFab(); setSelectedEstimate(null); openEstimateModal(); } },
        { id: 'schedule', label: 'Schedule Job', icon: Calendar, color: '#d97706', onPress: handleContextScheduleJob },
      ];
    }
    if (activeTab === 'invoices') {
      return [
        { id: 'invoice', label: 'New Invoice', icon: Receipt, color: '#059669', onPress: () => { closeFab(); handleAddInvoice(); } },
      ];
    }
    return [
      { id: 'estimate', label: 'New Estimate', icon: ClipboardList, color: '#2563eb', onPress: () => { closeFab(); handleAddEstimate(); } },
    ];
  }, [contextEstimate, contextInvoice, activeTab, handleContextEditClient, handleContextScheduleJob, handleContextCreateInvoice, handleAddInvoice, handleAddEstimate]);

  const handleMarkAsPaid = (invoice: Invoice) => {
    setSelectedPaymentInvoice(invoice);
    setPaymentModalVisible(true);
  };

  const handleConfirmPayment = async (paymentMethod: string, details?: any) => {
    if (!selectedPaymentInvoice) return;

    try {
      const allowedMethods = ['cash', 'check', 'card', 'bank_transfer', 'other'];
      const methodLabel = allowedMethods.includes(paymentMethod) ? paymentMethod : 'other';
      const paidDate = new Date().toISOString();
      const { error } = await supabase
        .from('invoices')
        .update({
          payment_status: 'paid',
          payment_method: methodLabel,
          amount_paid: selectedPaymentInvoice.total,
          paid_date: paidDate,
          updated_at: paidDate,
        })
        .eq('id', selectedPaymentInvoice.id)
        .eq('user_id', user!.id);

      if (error) throw error;

      setInvoices(prev =>
        prev.map(inv =>
          inv.id === selectedPaymentInvoice.id
            ? { ...inv, payment_status: 'paid', payment_method: methodLabel, amount_paid: inv.total, paid_date: paidDate }
            : inv
        )
      );

      const { data: existingIncome } = await supabase
        .from('income')
        .select('id')
        .or(`invoice_id.eq.${selectedPaymentInvoice.id}${selectedPaymentInvoice.schedule_event_id ? `,schedule_event_id.eq.${selectedPaymentInvoice.schedule_event_id}` : ''}`)
        .maybeSingle();

      const isCardPayment = methodLabel === 'credit/debit_card' || methodLabel === 'card';

      if (existingIncome) {
        showToast({
          message: 'Payment already recorded in income — invoice marked as paid',
          type: 'warning',
          duration: 4000,
        });
      } else {
        const ccFeeAmount = Number(selectedPaymentInvoice.cc_fee_amount) || 0;
        const incomeAmount = isCardPayment
          ? selectedPaymentInvoice.total
          : selectedPaymentInvoice.total - ccFeeAmount;

        const incomeData: any = {
          amount: incomeAmount,
          description: `Invoice #${selectedPaymentInvoice.invoice_number}${selectedPaymentInvoice.client?.name ? ` - ${selectedPaymentInvoice.client.name}` : ''}`,
          date: new Date().toISOString().split('T')[0],
          category: 'Invoice Payment',
          payment_method: methodLabel,
          client_id: selectedPaymentInvoice.client_id,
          user_id: user!.id,
          invoice_id: selectedPaymentInvoice.id,
        };
        if (selectedPaymentInvoice.schedule_event_id) {
          incomeData.schedule_event_id = selectedPaymentInvoice.schedule_event_id;
        }
        await supabase.from('income').insert(incomeData);

        if (isCardPayment && ccFeeAmount > 0 && currentOrganization) {
          await supabase.from('expenses').insert({
            user_id: user!.id,
            organization_id: currentOrganization.id,
            amount: ccFeeAmount,
            description: `CC processing fee — Invoice #${selectedPaymentInvoice.invoice_number}`,
            date: new Date().toISOString().split('T')[0],
            category: 'Credit Card Processing Fee',
          });
        }
      }
      const shouldSendReceipt = isCardPayment && businessSettings?.send_receipt_email !== false;

      if (shouldSendReceipt) {
        const { data: client } = await supabase
          .from('clients')
          .select('name, email, google_review_url')
          .eq('id', selectedPaymentInvoice.client_id)
          .maybeSingle();

        if (client?.email) {
          const googleReviewUrl = client.google_review_url ||
            (businessSettings?.include_google_review_on_receipt ? businessSettings?.google_review_url : null);

          invokeFunction('send-receipt-email', {
            invoiceId: selectedPaymentInvoice.id,
            clientEmail: client.email,
            clientName: client.name,
            amountPaid: selectedPaymentInvoice.total,
            paidDate,
            googleReviewUrl: googleReviewUrl || null,
          }).then(({ data: receiptData }) => {
            if (receiptData?.success) {
              showToast({ message: 'Receipt sent to client', type: 'success', duration: 2500 });
            }
          }).catch(() => {});
        }
      }

      showToast({
        message: `Invoice marked as paid via ${paymentMethod}`,
        type: 'success',
        duration: 2000,
      });
    } catch (error: any) {
      showToast({
        message: error?.message || 'Failed to update payment status',
        type: 'error',
        duration: 4000,
      });
    } finally {
      setPaymentModalVisible(false);
      setSelectedPaymentInvoice(null);
    }
  };

  const renderInvoice = useCallback(({ item }: { item: Invoice }) => {
    const paymentStatusColor = item.payment_status === 'paid' ? colors.success :
                                item.payment_status === 'overdue' ? colors.error :
                                item.payment_status === 'partial' ? colors.warning :
                                colors.warning;

    const invoiceActionMap: Record<string, { label: string; icon: React.ReactNode; color: string; onPress: () => void } | null> = {
      mark_paid: item.payment_status !== 'paid' ? {
        label: 'Mark Paid',
        icon: <Check size={18} color="#fff" />,
        color: '#16a34a',
        onPress: () => handleMarkAsPaid(item),
      } : null,
      pdf: {
        label: 'PDF',
        icon: <Download size={18} color="#fff" />,
        color: '#1B4D6E',
        onPress: () => handleDownloadInvoicePDF(item),
      },
      send: item.payment_status !== 'paid' ? {
        label: 'Send',
        icon: <Send size={18} color="#fff" />,
        color: '#0891b2',
        onPress: () => handleSendReminder(item),
      } : null,
      remind: item.payment_status !== 'paid' ? {
        label: 'Remind',
        icon: <Send size={18} color="#fff" />,
        color: '#d97706',
        onPress: () => handleSendReminder(item),
      } : null,
      delete: isAdminOrOwner ? {
        label: 'Delete',
        icon: <Trash2 size={18} color="#fff" />,
        color: '#dc2626',
        onPress: () => handleDeleteInvoice(item),
      } : null,
      duplicate: {
        label: 'Duplicate',
        icon: <Copy size={18} color="#fff" />,
        color: '#475569',
        onPress: () => handleDuplicateInvoice(item),
      },
    };

    const rightIds = swipeActionsInvoices?.right ?? ['mark_paid', 'pdf', 'delete'];
    const leftIds = swipeActionsInvoices?.left ?? ['remind'];

    const swipeRightActions = rightIds
      .map(id => invoiceActionMap[id])
      .filter((a): a is NonNullable<typeof a> => a !== null);

    const swipeLeftActions = leftIds
      .map(id => invoiceActionMap[id])
      .filter((a): a is NonNullable<typeof a> => a !== null);

    return (
      <SwipeableRow rightActions={swipeRightActions} leftActions={swipeLeftActions}>
        <TouchableOpacity
          style={dynamicStyles.card}
        onPress={() => handleEditInvoice(item)}
        onLongPress={isAdminOrOwner ? () => handleDeleteInvoice(item) : undefined}
      >
        <View style={dynamicStyles.cardHeader}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={dynamicStyles.cardNumber}>{item.memo || item.invoice_number}</Text>
            <Text style={dynamicStyles.cardClient}>{item.client?.name || t('invoice_unknown_client')}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {(() => {
              const statusPriority = ['paid', 'overdue', 'sent', 'pending', 'draft', 'cancelled'];
              const allStatuses = [item.status, item.payment_status].filter(Boolean) as string[];
              const displayStatus = allStatuses.sort((a, b) => statusPriority.indexOf(a) - statusPriority.indexOf(b))[0] || item.status;
              const displayColor = getStatusColor(displayStatus);
              return (
                <View style={[dynamicStyles.statusBadge, { backgroundColor: displayColor + '20' }]}>
                  <Text style={[dynamicStyles.statusText, { color: displayColor }]}>
                    {displayStatus.toUpperCase()}
                  </Text>
                </View>
              );
            })()}
            {isAdminOrOwner && (
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  handleDeleteInvoice(item);
                }}
                style={{ padding: 4 }}
              >
                <Trash2 size={16} color={colors.error} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={dynamicStyles.quickActions}>
          {item.payment_status !== 'paid' && (
            <TouchableOpacity
              style={[dynamicStyles.quickActionButton, { backgroundColor: colors.success + '15' }]}
              onPress={() => handleMarkAsPaid(item)}
            >
              <Check size={13} color={colors.success} />
              <Text style={[dynamicStyles.quickActionText, { color: colors.success }]}>{t('invoice_status_paid')}</Text>
            </TouchableOpacity>
          )}

          {item.payment_status !== 'paid' && (item.payment_status === 'overdue' || (item.due_date && new Date(item.due_date) < new Date())) && (
            <TouchableOpacity
              style={[dynamicStyles.quickActionButton, { backgroundColor: colors.error + '15' }]}
              onPress={() => handleSendReminder(item)}
            >
              <Send size={13} color={colors.error} />
              <Text style={[dynamicStyles.quickActionText, { color: colors.error }]}>Remind</Text>
            </TouchableOpacity>
          )}

          {item.payment_status === 'paid' && item.payment_method && (
            <View style={[dynamicStyles.paymentMethodBadge, { backgroundColor: colors.success + '15' }]}>
              {item.payment_method === 'card' && <CreditCard size={13} color={colors.success} />}
              {item.payment_method === 'cash' && <Banknote size={13} color={colors.success} />}
              {item.payment_method === 'bank_transfer' && <Building2 size={13} color={colors.success} />}
              {!['card', 'cash', 'bank_transfer'].includes(item.payment_method) && <Check size={13} color={colors.success} />}
              <Text style={[dynamicStyles.paymentMethodText, { color: colors.success }]}>
                {item.payment_method.replace('_', ' ')}
              </Text>
            </View>
          )}

          {businessSettings?.stripe_payment_link && item.payment_status !== 'paid' && (
            <TouchableOpacity
              style={[dynamicStyles.quickActionButton, { backgroundColor: colors.primary + '12' }]}
              onPress={handleCopyPaymentLink}
            >
              <Link2 size={13} color={colors.primary} />
              <Text style={[dynamicStyles.quickActionText, { color: colors.primary }]}>Pay Link</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[dynamicStyles.quickActionButton, { backgroundColor: '#47556915' }]}
            onPress={(e) => { e.stopPropagation(); handleDuplicateInvoice(item); }}
          >
            <Copy size={13} color="#475569" />
            <Text style={[dynamicStyles.quickActionText, { color: '#475569' }]}>Duplicate</Text>
          </TouchableOpacity>
        </View>

        <View style={dynamicStyles.cardFooter}>
          <View style={{ flex: 1 }} />
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <Text style={[
              dynamicStyles.cardTotal,
              item.payment_status !== 'paid' && item.due_date && new Date(item.due_date) < new Date()
                ? { color: '#b91c1c' }
                : { color: '#ffffff' }
            ]}>
              {t('invoice_due')}{item.due_date}
            </Text>
            <Text style={dynamicStyles.cardTotal}>${Number(item.total).toFixed(2)}</Text>
          </View>
        </View>
        </TouchableOpacity>
      </SwipeableRow>
    );
  }, [dynamicStyles, colors, t, isAdminOrOwner, handleEditInvoice, handleDeleteInvoice, handleMarkAsPaid, handleQuickPaymentStatus, handleDownloadInvoicePDF, handleDuplicateInvoice, businessSettings?.stripe_payment_link, handleCopyPaymentLink, handleSendReminder]);

  const renderEstimate = useCallback(({ item }: { item: Estimate }) => {
    const isApproved = item.status === 'approved';
    const isDeclined = item.status === 'declined';

    const estimateSwipeRight = !isApproved && !isDeclined ? [{
      label: 'Approve',
      icon: <Check size={18} color="#fff" />,
      color: '#16a34a',
      onPress: () => handleApproveEstimate(item),
    }] : [];

    const estimateSwipeLeft = !isDeclined ? [{
      label: 'Remind',
      icon: <Send size={18} color="#fff" />,
      color: '#d97706',
      onPress: () => handleSendReminder(item as any),
    }] : [];

    return (
      <SwipeableRow rightActions={estimateSwipeRight} leftActions={estimateSwipeLeft}>
      <TouchableOpacity
        style={dynamicStyles.card}
        onPress={() => handleEditEstimate(item)}
        onLongPress={isAdminOrOwner ? () => handleDeleteEstimate(item) : undefined}
      >
        <View style={dynamicStyles.cardHeader}>
          <View>
            <Text style={dynamicStyles.cardNumber}>{(item as any).memo || item.estimate_number}</Text>
            <Text style={dynamicStyles.cardClient}>{item.client?.name || t('invoice_unknown_client')}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={[dynamicStyles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
              <Text style={[dynamicStyles.statusText, { color: getStatusColor(item.status) }]}>
                {item.status.toUpperCase()}
              </Text>
            </View>
            {isAdminOrOwner && (
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  handleDeleteEstimate(item);
                }}
                style={{ padding: 4 }}
              >
                <Trash2 size={18} color={colors.error} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {isApproved && (
          <View style={{ paddingHorizontal: 16, paddingBottom: 4 }}>
            {item.signed_by_name && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <PenTool size={12} color={colors.success} />
                <Text style={{ fontSize: 12, color: colors.success }}>
                  {t('invoice_signed_by')}{item.signed_by_name}{item.signed_at ? ` on ${new Date(item.signed_at).toLocaleDateString()}` : ''}
                </Text>
              </View>
            )}
            {item.client_notes ? (
              <Text style={{ fontSize: 12, color: colors.textSecondary, fontStyle: 'italic', marginBottom: 4 }}>
                {t('invoice_client_notes')}"{item.client_notes}"
              </Text>
            ) : null}
          </View>
        )}

        {isDeclined && item.client_notes ? (
          <View style={{ paddingHorizontal: 16, paddingBottom: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <ThumbsDown size={12} color={colors.error} />
              <Text style={{ fontSize: 12, color: colors.error }}>{t('invoice_declined')}</Text>
            </View>
            <Text style={{ fontSize: 12, color: colors.textSecondary, fontStyle: 'italic' }}>
              "{item.client_notes}"
            </Text>
          </View>
        ) : null}

        <View style={dynamicStyles.quickActions}>
          {!isApproved && !isDeclined && (
            <TouchableOpacity
              style={[dynamicStyles.quickActionButton, { backgroundColor: colors.success + '15' }]}
              onPress={() => handleApproveEstimate(item)}
            >
              <Check size={14} color={colors.success} />
              <Text style={[dynamicStyles.quickActionText, { color: colors.success }]}>{t('invoices_filter_approve')}</Text>
            </TouchableOpacity>
          )}
          {isApproved && (
            <>
              <TouchableOpacity
                style={[dynamicStyles.quickActionButton, { backgroundColor: colors.primary + '15' }]}
                onPress={() => handleConvertToJob(item)}
              >
                <CalendarPlus size={14} color={colors.primary} />
                <Text style={[dynamicStyles.quickActionText, { color: colors.primary }]}>{t('invoices_filter_schedule')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[dynamicStyles.quickActionButton, { backgroundColor: '#0891b2' + '15' }]}
                onPress={() => handleConvertToInvoice(item)}
              >
                <ArrowRightLeft size={14} color="#0891b2" />
                <Text style={[dynamicStyles.quickActionText, { color: '#0891b2' }]}>{t('invoices_filter_invoice')}</Text>
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity
            style={[dynamicStyles.quickActionButton, { backgroundColor: colors.textSecondary + '12' }]}
            onPress={() => handleDownloadEstimatePDF(item)}
          >
            <Download size={14} color={colors.textSecondary} />
            <Text style={[dynamicStyles.quickActionText, { color: colors.textSecondary }]}>{t('invoice_pdf')}</Text>
          </TouchableOpacity>
        </View>

        <View style={dynamicStyles.cardFooter}>
          <Text style={dynamicStyles.cardDate}>{t('estimate_valid_until')}{item.valid_until}</Text>
          <Text style={dynamicStyles.cardTotal}>${Number(item.total).toFixed(2)}</Text>
        </View>
      </TouchableOpacity>
      </SwipeableRow>
    );
  }, [dynamicStyles, colors, t, isAdminOrOwner, handleEditEstimate, handleDeleteEstimate, handleApproveEstimate, handleConvertToJob, handleConvertToInvoice, handleDownloadEstimatePDF, handleSendReminder]);

  if (employeeInvoicesHidden && !isAdminOrOwner) {
    return (
      <View style={[dynamicStyles.container, { justifyContent: 'center', alignItems: 'center', gap: 12 }]}>
        <Receipt size={48} color={colors.textSecondary} />
        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>Access Restricted</Text>
        <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', maxWidth: 260, lineHeight: 20 }}>
          Your organization has disabled invoice access for team members. Contact your owner or admin for assistance.
        </Text>
      </View>
    );
  }

  return (
    <AnimatedTabContent
      activeTab={globalCurrentTab}
      tabKey="invoices"
      direction={slideDirection}
    >
      <View style={dynamicStyles.container}>
      <View style={dynamicStyles.header}>
        <Text style={dynamicStyles.headerTitle}>{t('invoices_title')}</Text>
        <View style={dynamicStyles.headerLeft}>
          <Text style={dynamicStyles.headerSubtitle}>
            {activeTab === 'invoices' ? `${invoices.length} ${t('invoices_tab').toLowerCase()}` : `${estimates.length} ${t('estimates_tab').toLowerCase()}`}
          </Text>
        </View>
        {isAdminOrOwner && (
          <TouchableOpacity onPress={() => setLogoModalVisible(true)} style={dynamicStyles.iconButton}>
            <Image size={20} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      <View style={dynamicStyles.tabContainer}>
        <TouchableOpacity
          style={[dynamicStyles.tab, activeTab === 'invoices' && dynamicStyles.activeTab]}
          onPress={() => {
            setPreviousTab(activeTab);
            setActiveTab('invoices');
          }}
        >
          <Receipt size={18} color={activeTab === 'invoices' ? colors.primary : colors.textSecondary} />
          <Text style={[dynamicStyles.tabText, activeTab === 'invoices' && dynamicStyles.activeTabText]}>
            {t('invoices_tab')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[dynamicStyles.tab, activeTab === 'estimates' && dynamicStyles.activeTab]}
          onPress={() => {
            setPreviousTab(activeTab);
            setActiveTab('estimates');
          }}
        >
          <FileText size={18} color={activeTab === 'estimates' ? colors.primary : colors.textSecondary} />
          <Text style={[dynamicStyles.tabText, activeTab === 'estimates' && dynamicStyles.activeTabText]}>
            {t('estimates_tab')}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={dynamicStyles.searchContainer}>
        <Search size={20} color={colors.textSecondary} />
        <TextInput
          style={dynamicStyles.searchInput}
          placeholder={activeTab === 'invoices' ? t('invoices_search_placeholder') : t('estimates_search_placeholder')}
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <X size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => setSwipeSettingsVisible(true)} activeOpacity={0.7} style={{ padding: 4 }}>
          <Settings2 size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={dynamicStyles.filterContainer}>
        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
        />
      </View>

      {activeTab === 'invoices' && (
        <View style={dynamicStyles.statusFilterContainer}>
          <TouchableOpacity
            style={[
              dynamicStyles.statusFilterButton,
              invoiceFilter === 'unpaid' && dynamicStyles.statusFilterButtonActive
            ]}
            onPress={() => handleSetInvoiceFilter('unpaid')}
          >
            <Text style={[
              dynamicStyles.statusFilterText,
              invoiceFilter === 'unpaid' && dynamicStyles.statusFilterTextActive
            ]}>
              {t('invoices_filter_unpaid')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              dynamicStyles.statusFilterButton,
              invoiceFilter === 'unsent' && dynamicStyles.statusFilterButtonActive
            ]}
            onPress={() => handleSetInvoiceFilter('unsent')}
          >
            <Text style={[
              dynamicStyles.statusFilterText,
              invoiceFilter === 'unsent' && dynamicStyles.statusFilterTextActive
            ]}>
              {t('invoices_filter_unsent')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              dynamicStyles.statusFilterButton,
              invoiceFilter === 'all' && dynamicStyles.statusFilterButtonActive
            ]}
            onPress={() => handleSetInvoiceFilter('all')}
          >
            <Text style={[
              dynamicStyles.statusFilterText,
              invoiceFilter === 'all' && dynamicStyles.statusFilterTextActive
            ]}>
              {t('invoices_filter_all')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {activeTab === 'estimates' && (
        <View style={dynamicStyles.statusFilterContainer}>
          <TouchableOpacity
            style={[
              dynamicStyles.statusFilterButton,
              estimateFilter === 'unsent' && dynamicStyles.statusFilterButtonActive
            ]}
            onPress={() => handleSetEstimateFilter('unsent')}
          >
            <Text style={[
              dynamicStyles.statusFilterText,
              estimateFilter === 'unsent' && dynamicStyles.statusFilterTextActive
            ]}>
              {t('invoices_filter_unsent')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              dynamicStyles.statusFilterButton,
              estimateFilter === 'all' && dynamicStyles.statusFilterButtonActive
            ]}
            onPress={() => handleSetEstimateFilter('all')}
          >
            <Text style={[
              dynamicStyles.statusFilterText,
              estimateFilter === 'all' && dynamicStyles.statusFilterTextActive
            ]}>
              {t('invoices_filter_all')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <AnimatedTabContent
  activeTab={activeTab}
  tabKey="invoices"
  direction={getSlideDirection(globalPreviousTab, globalCurrentTab, dynamicOrder)}
        
      >
        <FlatList
          data={pagedInvoices}
          renderItem={renderInvoice}
          keyExtractor={item => item.id}
          contentContainerStyle={dynamicStyles.list}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          onEndReached={handleLoadMoreInvoices}
          onEndReachedThreshold={0.3}
          ListHeaderComponent={unpaidTotal !== null && filteredInvoices.length > 0 ? (
            <View style={{
              marginHorizontal: 16,
              marginTop: 12,
              marginBottom: 4,
              borderRadius: 14,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 16,
              alignItems: 'center',
            }}>
              <Text style={{ fontSize: 11, color: colors.textSecondary, letterSpacing: 0.8, marginBottom: 4, textTransform: 'uppercase' }}>
                Total Pending
              </Text>
              <Text style={{ fontSize: 28, fontWeight: '700', color: colors.warning }}>
                ${unpaidTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                across {filteredInvoices.length} unpaid invoice{filteredInvoices.length !== 1 ? 's' : ''}
              </Text>
            </View>
          ) : null}
          ListEmptyComponent={
            <View style={dynamicStyles.emptyContainer}>
              <Text style={dynamicStyles.emptyText}>{t('invoices_empty')}</Text>
              <Text style={dynamicStyles.emptySubtext}>{t('invoices_empty_sub')}</Text>
            </View>
          }
        />
      </AnimatedTabContent>

      <AnimatedTabContent
        activeTab={activeTab}
        tabKey="estimates"
        direction={getSlideDirection(globalPreviousTab, globalCurrentTab, dynamicOrder)}
      >
        <FlatList
          data={pagedEstimates}
          renderItem={renderEstimate}
          keyExtractor={item => item.id}
          contentContainerStyle={dynamicStyles.list}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          onEndReached={handleLoadMoreEstimates}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={dynamicStyles.emptyContainer}>
              <Text style={dynamicStyles.emptyText}>{t('estimates_empty')}</Text>
              <Text style={dynamicStyles.emptySubtext}>{t('estimates_empty_sub')}</Text>
            </View>
          }
        />
      </AnimatedTabContent>

      <WorkflowFab
        actions={fabActions}
        isOpen={fabOpen}
        onToggle={toggleFab}
        onClose={closeFab}
        style={dynamicStyles.fab}
        onQuickAction={handleQuickAction}
        dominantHand={dominantHand}
      />

      <InvoiceModal
        key={`invoice-${invoiceModalKey}`}
        visible={invoiceModalVisible}
        invoice={selectedInvoice}
        prefill={invoicePrefill}
        autoOpenSend={invoiceAutoSend}
        onClose={() => {
          setInvoiceModalVisible(false);
          setSelectedInvoice(null);
          setContextInvoice(null);
          setInvoiceAutoSend(false);
          setInvoicePrefill(null);
          closeFab();
        }}
        onSave={() => {
          setInvoiceModalVisible(false);
          setSelectedInvoice(null);
          setContextInvoice(null);
          setInvoiceAutoSend(false);
          setInvoicePrefill(null);
          closeFab();
          fetchInvoices();
        }}
      />

      <EstimateModal
        key={`estimate-${estimateModalKey}`}
        visible={estimateModalVisible}
        estimate={selectedEstimate}
        autoOpenSend={estimateAutoSend}
        onClose={() => {
          setEstimateModalVisible(false);
          setSelectedEstimate(null);
          setContextEstimate(null);
          setEstimateAutoSend(false);
          closeFab();
        }}
        onSave={() => {
          setEstimateModalVisible(false);
          setSelectedEstimate(null);
          setContextEstimate(null);
          setEstimateAutoSend(false);
          closeFab();
          fetchEstimates();
        }}
      />

      <LogoUploadModal
        visible={logoModalVisible}
        onClose={() => setLogoModalVisible(false)}
        currentLogoUrl={businessSettings?.logo_url || ''}
        onLogoUpdated={fetchBusinessSettings}
        businessSettingsId={businessSettings?.id || ''}
      />

      <PaymentMethodModal
        visible={paymentModalVisible && selectedPaymentInvoice !== null}
        onClose={() => {
          setPaymentModalVisible(false);
          setSelectedPaymentInvoice(null);
        }}
        amount={selectedPaymentInvoice?.total || 0}
        onPaymentComplete={handleConfirmPayment}
        acceptedMethods={(() => {
          const methods: string[] = ['cash', 'check', 'card'];
          if (businessSettings?.venmo_username) methods.push('venmo');
          if (businessSettings?.cashapp_username) methods.push('cashapp');
          if (businessSettings?.zelle_email || businessSettings?.zelle_phone) methods.push('zelle');
          methods.push('bank_transfer', 'other');
          return methods;
        })()}
      />

      <EstimateApprovalModal
        visible={approvalModalVisible}
        estimateId={approvalEstimateId}
        clientName={approvalClientName}
        clientEmail={approvalClientEmail}
        onClose={() => {
          setApprovalModalVisible(false);
          setApprovalEstimateId(null);
        }}
        onApprove={(approvedEstimateId) => {
          setApprovalModalVisible(false);
          setApprovalEstimateId(null);
          fetchEstimates();
          Alert.alert(
            'Estimate Approved',
            'Would you like to create a job from this estimate?',
            [
              { text: 'Not Now', style: 'cancel' },
              {
                text: 'Create Job',
                onPress: () => {
                  setConvertEstimateId(approvedEstimateId);
                  setConvertModalVisible(true);
                },
              },
            ]
          );
        }}
      />

      <ConvertEstimateToJobModal
        visible={convertModalVisible}
        estimateId={convertEstimateId}
        onClose={() => {
          setConvertModalVisible(false);
          setConvertEstimateId(null);
        }}
        onSuccess={(jobId) => {
          setConvertModalVisible(false);
          setConvertEstimateId(null);
          fetchEstimates();
        }}
      />

      <ScheduleModal
        visible={scheduleModalVisible}
        event={null}
        preselectedDate={schedulePreselectedDate}
        onClose={() => {
          setScheduleModalVisible(false);
          setEstimatePrefill(null);
          setScheduleClientPrefill(null);
          setSchedulePreselectedDate(null);
        }}
        onSave={() => {
          setScheduleModalVisible(false);
          setEstimatePrefill(null);
          setScheduleClientPrefill(null);
          setSchedulePreselectedDate(null);
          fetchEstimates();
          showToast({ message: 'Job scheduled successfully', type: 'success', duration: 3000 });
        }}
        prefillFromEstimate={estimatePrefill}
        prefillFromClient={scheduleClientPrefill}
      />

      <ClientModal
        visible={clientModalVisible}
        client={clientForEdit}
        onClose={() => { setClientModalVisible(false); setClientForEdit(null); setClientPrefillName(''); setClientPrefillPhone(''); setClientPrefillAddress(''); setClientPrefillLanguage(''); }}
        onSave={() => { setClientModalVisible(false); setClientForEdit(null); setClientPrefillName(''); setClientPrefillPhone(''); setClientPrefillAddress(''); setClientPrefillLanguage(''); fetchData(); }}
        prefillName={clientPrefillName || undefined}
        prefillPhone={clientPrefillPhone || undefined}
        prefillAddress={clientPrefillAddress || undefined}
        prefillLanguage={clientPrefillLanguage || undefined}
        onDuplicateLastInvoice={(clientId) => {
          setClientModalVisible(false);
          setClientForEdit(null);
          handleDuplicateClientLastInvoice(clientId);
        }}
      />

      <ScheduleCalendarPickerModal
        visible={calendarPickerVisible}
        selectedDate={schedulePreselectedDate?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0]}
        onConfirm={(dateStr) => {
          const picked = new Date(dateStr + 'T00:00:00');
          setSchedulePreselectedDate(picked);
          setCalendarPickerVisible(false);
          setScheduleModalVisible(true);
        }}
        onCancel={() => {
          setCalendarPickerVisible(false);
          setScheduleClientPrefill(null);
        }}
        title="Select Job Date"
      />
      <SwipeActionsSettingsModal
        visible={swipeSettingsVisible}
        onClose={() => setSwipeSettingsVisible(false)}
        context="invoices"
      />

      <DuplicateInvoiceModal
        visible={duplicateModalVisible}
        sourceInvoice={duplicateSourceInvoice}
        onClose={() => { setDuplicateModalVisible(false); setDuplicateSourceInvoice(null); }}
        onCreated={() => { setDuplicateModalVisible(false); setDuplicateSourceInvoice(null); fetchData(); }}
      />
      </View>
    </AnimatedTabContent>
  );
}