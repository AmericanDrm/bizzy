import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Switch,
  Platform,
  Linking,
} from 'react-native';
import {
  X,
  Check,
  CircleCheck as CheckCircle,
  Send,
  Mail,
  MessageSquare,
  DollarSign,
  CreditCard,
  FileText,
  ChevronDown,
} from 'lucide-react-native';
import { supabase, invokeFunction } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import type { InvoicePDFData } from '@/lib/pdfGenerator';
import JobCompletionNotifyModal from '@/components/JobCompletionNotifyModal';

const PAYMENT_METHODS = [
  { label: 'Cash', value: 'cash' },
  { label: 'Check', value: 'check' },
  { label: 'Card', value: 'card' },
  { label: 'Venmo', value: 'venmo' },
  { label: 'Zelle', value: 'zelle' },
  { label: 'Bank Transfer', value: 'bank_transfer' },
  { label: 'Other', value: 'other' },
];

interface ScheduleEvent {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  location?: string;
  client_id: string | null;
  client?: { name: string } | null;
  amount?: number;
  payment_status?: string;
  payment_method?: string;
  line_items?: any[];
  job_type_id?: string;
  service_scope?: string;
  assigned_to?: string | null;
}

interface JobCompletionModalProps {
  visible: boolean;
  event: ScheduleEvent | null;
  onClose: () => void;
  onComplete: () => void;
}

export default function JobCompletionModal({
  visible,
  event,
  onClose,
  onComplete,
}: JobCompletionModalProps) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const { currentOrganization, employeeInvoicesHidden, isAdminOrOwner } = useOrganization();

  // True when this user is a restricted employee (can't create invoices)
  const isRestrictedEmployee = employeeInvoicesHidden && !isAdminOrOwner;

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [completedEventId, setCompletedEventId] = useState('');
  const [completedAt, setCompletedAt] = useState('');
  const [showNotifyModal, setShowNotifyModal] = useState(false);

  const [createInvoice, setCreateInvoice] = useState(true);
  const [recordPayment, setRecordPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [showPaymentMethods, setShowPaymentMethods] = useState(false);
  const [sendInvoice, setSendInvoice] = useState(false);
  const [sendMethod, setSendMethod] = useState<'email' | 'sms'>('email');

  const [lineItems, setLineItems] = useState<{ description: string; quantity: number; unit_price: number; total: number }[]>([]);
  const [taxRate, setTaxRate] = useState(0);
  const [notes, setNotes] = useState('');

  const [clientData, setClientData] = useState<any>(null);
  const [businessSettings, setBusinessSettings] = useState<any>(null);
  const [technicianFirstName, setTechnicianFirstName] = useState<string | null>(null);
  const [ccFeePercent, setCcFeePercent] = useState(0);
  const [includeCcFee, setIncludeCcFee] = useState(false);

  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const base = subtotal + taxAmount;
  const ccFee = includeCcFee && ccFeePercent > 0 ? base / (1 - ccFeePercent / 100) - base : 0;
  const total = subtotal + taxAmount + ccFee;

  const fetchData = useCallback(async () => {
    if (!event?.client_id || !currentOrganization?.id) return;
    setInitialLoading(true);

    try {
      const fetches: Promise<any>[] = [
        supabase
          .from('clients')
          .select('id, name, email, phone, address, review_follow_up_sent_at')
          .eq('id', event.client_id)
          .maybeSingle(),
        supabase
          .from('business_settings')
          .select('*')
          .eq('organization_id', currentOrganization.id)
          .maybeSingle(),
      ];

      if (event.assigned_to) {
        fetches.push(
          supabase
            .from('profiles')
            .select('display_name')
            .eq('id', event.assigned_to)
            .maybeSingle()
        );
      }

      const [clientRes, settingsRes, techRes] = await Promise.all(fetches);

      if (clientRes.data) setClientData(clientRes.data);
      if (settingsRes.data) {
        setBusinessSettings(settingsRes.data);
        const defaultRate = settingsRes.data.default_tax_rate ?? 0;
        const autoApply = settingsRes.data.auto_apply_tax ?? true;
        if (autoApply && defaultRate > 0) setTaxRate(defaultRate);
        setCcFeePercent(settingsRes.data.cc_processing_fee_percent ?? 0);
      }
      if (techRes?.data?.display_name) {
        setTechnicianFirstName(techRes.data.display_name.trim().split(' ')[0]);
      } else {
        setTechnicianFirstName(null);
      }

      buildLineItems();
    } catch (err) {
      console.error('Error loading job completion data:', err);
    } finally {
      setInitialLoading(false);
    }
  }, [event, currentOrganization]);

  const buildLineItems = useCallback(() => {
    if (!event) return;

    if (event.line_items && Array.isArray(event.line_items) && event.line_items.length > 0) {
      const items = event.line_items.map((li: any) => ({
        description: li.description || 'Service',
        quantity: Number(li.quantity) || 1,
        unit_price: Number(li.unit_price) || 0,
        total: (Number(li.quantity) || 1) * (Number(li.unit_price) || 0),
      }));
      setLineItems(items);
    } else if (event.amount && event.amount > 0) {
      setLineItems([{
        description: event.title || 'Service',
        quantity: 1,
        unit_price: event.amount,
        total: event.amount,
      }]);
    } else {
      setLineItems([{
        description: event.title || 'Service',
        quantity: 1,
        unit_price: 0,
        total: 0,
      }]);
    }
  }, [event]);

  useEffect(() => {
    if (visible && event) {
      setCreateInvoice(!isRestrictedEmployee);
      setRecordPayment(false);
      setPaymentMethod('');
      setSendInvoice(false);
      setSendMethod('email');
      setNotes('');
      setIncludeCcFee(false);
      setShowPaymentMethods(false);
      setCompletedEventId('');
      setCompletedAt('');
      setShowNotifyModal(false);
      fetchData();
    }
  }, [visible, event, isRestrictedEmployee]);

  const sendFollowUpSms = useCallback(async () => {
    if (!clientData?.phone || !currentOrganization?.id) return;
    const reviewLink = businessSettings?.google_review_url;
    if (!reviewLink) return;
    // Skip if a review follow-up was already sent to this client
    if (clientData.review_follow_up_sent_at) return;

    try {
      const { data: templateData } = await supabase
        .from('message_templates')
        .select('message_text')
        .eq('organization_id', currentOrganization.id)
        .eq('template_type', 'follow_up')
        .eq('delivery_method', 'sms')
        .maybeSingle();

      const defaultTemplate = technicianFirstName
        ? "Hi {client_name}, this is {business_name}. If you were happy with your service from {technician_name}, would you mind leaving us a quick review? It really helps: {review_link}\nIf anything wasn't perfect, let us know\u2014we'd love to make it right."
        : "Hi {client_name}, this is {business_name}. If you were happy with your service, would you mind leaving us a quick review? It really helps: {review_link}\nIf anything wasn't perfect, let us know\u2014we'd love to make it right.";

      let message = templateData?.message_text || defaultTemplate;

      const businessName = businessSettings?.business_name || businessSettings?.name || 'us';
      const clientName = clientData.name || 'there';

      message = message.replace(/\{client_name\}/g, clientName);
      message = message.replace(/\{business_name\}/g, businessName);
      message = message.replace(/\{review_link\}/g, reviewLink);

      if (technicianFirstName) {
        message = message.replace(/\{technician_name\}/g, technicianFirstName);
      } else {
        message = message.replace(/,?\s*If you were happy with your service from \{technician_name\}/gi, '');
        message = message.replace(/\{technician_name\}/g, '');
      }

      const smsChannel: 'native' | 'twilio' = businessSettings?.sms_send_channel || 'native';

      if (smsChannel === 'native') {
        const phoneNumber = clientData.phone.replace(/\D/g, '');
        const smsUrl = Platform.OS === 'ios'
          ? `sms:${phoneNumber}&body=${encodeURIComponent(message)}`
          : `sms:${phoneNumber}?body=${encodeURIComponent(message)}`;
        await Linking.openURL(smsUrl);
      } else {
        await invokeFunction('send-sms', {
          organization_id: currentOrganization.id,
          to: clientData.phone,
          body: message,
        });
      }

      await supabase
        .from('clients')
        .update({ review_follow_up_sent_at: new Date().toISOString() })
        .eq('id', clientData.id);
    } catch (err) {
      console.error('Follow-up SMS failed:', err);
    }
  }, [clientData, businessSettings, technicianFirstName, currentOrganization]);

  const handleComplete = async () => {
    if (!event || !user) return;
    if (recordPayment && !paymentMethod) {
      showToast({ message: 'Please select a payment method', type: 'warning' });
      return;
    }

    setLoading(true);
    try {
      const realEventId = getRealEventId(event.id);
      const nowIso = new Date().toISOString();

      await supabase
        .from('schedule_events')
        .update({
          status: 'completed',
          completed_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', realEventId);

      // Restricted employees cannot create invoices — show notify modal and exit
      if (isRestrictedEmployee) {
        setCompletedEventId(realEventId);
        setCompletedAt(nowIso);
        setLoading(false);
        onComplete();
        setShowNotifyModal(true);
        sendFollowUpSms();
        return;
      }

      let invoiceId: string | null = null;
      let invoiceNumber: string | null = null;

      if (createInvoice && event.client_id) {
        const result = await createInvoiceRecord(realEventId);
        invoiceId = result.invoiceId;
        invoiceNumber = result.invoiceNumber;

        await supabase
          .from('schedule_events')
          .update({ invoice_id: invoiceId })
          .eq('id', realEventId);
      }

      if (recordPayment && paymentMethod) {
        const paidDate = new Date().toISOString().split('T')[0];
        const amountPaid = total > 0 ? total : (event.amount || 0);

        await supabase
          .from('schedule_events')
          .update({
            payment_status: 'paid',
            payment_method: paymentMethod,
            paid_date: paidDate,
            amount: amountPaid || event.amount || null,
            amount_paid: amountPaid || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', realEventId);

        if (amountPaid > 0) {
          const { data: existingIncome } = await supabase
            .from('income')
            .select('id')
            .eq('schedule_event_id', realEventId)
            .maybeSingle();

          if (!existingIncome) {
            const clientName = event.client?.name || clientData?.name || '';
            const isCardPay = paymentMethod === 'card';
            const incomeRecord: any = {
              user_id: user.id,
              schedule_event_id: realEventId,
              client_id: event.client_id,
              amount: isCardPay ? amountPaid : amountPaid - ccFee,
              description: clientName ? `${event.title} - ${clientName}` : event.title,
              date: paidDate,
              category: 'Job Payment',
              payment_method: paymentMethod,
            };
            if (invoiceId) {
              incomeRecord.invoice_id = invoiceId;
            }
            await supabase.from('income').insert(incomeRecord);

            if (isCardPay && ccFee > 0 && currentOrganization) {
              await supabase.from('expenses').insert({
                user_id: user.id,
                organization_id: currentOrganization.id,
                amount: ccFee,
                description: `CC processing fee — ${clientName ? `${event.title} - ${clientName}` : event.title}`,
                date: paidDate,
                category: 'Credit Card Processing Fee',
              });
            }
          }
        }

        if (invoiceId) {
          await supabase
            .from('invoices')
            .update({
              payment_status: 'paid',
              payment_method: paymentMethod,
              amount_paid: total > 0 ? total : (event.amount || 0),
              paid_date: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', invoiceId);
        }
      }

      if (sendInvoice && invoiceId && event.client_id) {
        await sendInvoiceToClient(invoiceId, invoiceNumber || '');
      }

      const actions: string[] = ['Job completed'];
      if (createInvoice && invoiceId) actions.push('invoice created');
      if (recordPayment) actions.push('payment recorded');
      if (sendInvoice && invoiceId) actions.push(`invoice sent via ${sendMethod}`);

      showToast({ message: actions.join(', '), type: 'success', duration: 3000 });
      onComplete();
      onClose();
      sendFollowUpSms();
    } catch (error: any) {
      console.error('Job completion error:', error);
      showToast({ message: error?.message || 'Failed to complete job', type: 'error', duration: 4000 });
    } finally {
      setLoading(false);
    }
  };

  const createInvoiceRecord = async (eventId: string) => {
    const { data: numData } = await supabase.rpc('generate_invoice_number');
    const invoiceNumber = numData || `INV-${Date.now()}`;
    const today = new Date().toISOString().split('T')[0];

    const paymentStatusValue = recordPayment && paymentMethod ? 'paid' : 'draft';
    const amountPaidValue = recordPayment && paymentMethod ? total : 0;

    const { data: invoiceData, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        user_id: user!.id,
        client_id: event!.client_id,
        organization_id: currentOrganization!.id,
        invoice_number: invoiceNumber,
        status: 'draft',
        issue_date: today,
        due_date: today,
        payment_terms: 'due_on_receipt',
        subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        late_fee_amount: 0,
        cc_fee_percent: includeCcFee ? ccFeePercent : 0,
        cc_fee_amount: ccFee,
        total,
        notes,
        payment_status: paymentStatusValue,
        payment_method: recordPayment ? paymentMethod : null,
        amount_paid: amountPaidValue,
        paid_date: recordPayment && paymentMethod ? new Date().toISOString() : null,
        schedule_event_id: eventId,
      })
      .select('id')
      .single();

    if (invoiceError) throw invoiceError;

    const itemsToInsert = lineItems
      .filter(item => item.description.trim())
      .map(item => ({
        invoice_id: invoiceData.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.total,
      }));

    if (itemsToInsert.length > 0) {
      const { error: itemsError } = await supabase.from('invoice_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;
    }

    return { invoiceId: invoiceData.id, invoiceNumber };
  };

  const sendInvoiceToClient = async (invoiceId: string, invoiceNumber: string) => {
    if (!clientData) return;

    if (sendMethod === 'email' && clientData.email) {
      try {
        let pdfBase64 = '';
        try {
          const pdfData: InvoicePDFData = {
            invoice_number: invoiceNumber,
            issue_date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            due_date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            client_name: clientData.name,
            client_email: clientData.email || '',
            client_phone: clientData.phone || '',
            client_address: clientData.address || '',
            business_name: businessSettings?.business_name || '',
            business_address: businessSettings?.business_address || '',
            business_phone: businessSettings?.business_phone || '',
            business_email: businessSettings?.business_email || '',
            logo_url: businessSettings?.logo_url || undefined,
            items: lineItems.filter(i => i.description.trim()).map(i => ({
              description: i.description,
              quantity: i.quantity,
              unit_price: i.unit_price,
              total: i.total,
            })),
            subtotal,
            tax_rate: taxRate,
            tax_amount: taxAmount,
            total,
            notes: notes || '',
            payment_terms: 'due_on_receipt',
            cc_fee_percent: includeCcFee ? ccFeePercent : undefined,
            cc_fee_amount: ccFee > 0 ? ccFee : undefined,
            venmo_username: businessSettings?.venmo_username || undefined,
            cashapp_username: businessSettings?.cashapp_username || undefined,
            zelle_email: businessSettings?.zelle_email || undefined,
            zelle_phone: businessSettings?.zelle_phone || undefined,
            check_payable_to: businessSettings?.check_payable_to || undefined,
            check_mailing_address: businessSettings?.check_mailing_address || undefined,
            stripe_payment_link: businessSettings?.stripe_payment_link || undefined,
          };

          if (Platform.OS === 'web') {
            const { buildInvoicePDF } = await import('@/lib/webPdfBuilder');
            const pdfDoc = await buildInvoicePDF(pdfData);
            const pdfBlob = pdfDoc.output('blob');
            const reader = new FileReader();
            await new Promise<void>((resolve, reject) => {
              reader.onloadend = () => {
                if (reader.result && typeof reader.result === 'string') {
                  pdfBase64 = reader.result.split(',')[1];
                  resolve();
                } else {
                  reject(new Error('Failed to convert PDF'));
                }
              };
              reader.onerror = reject;
              reader.readAsDataURL(pdfBlob);
            });
          }
        } catch (pdfErr) {
          console.error('PDF generation failed, sending without attachment:', pdfErr);
        }

        await invokeFunction('send-invoice-email', {
          invoiceId,
          clientEmail: clientData.email,
          clientName: clientData.name,
          sendToSelf: false,
          pdfBase64: pdfBase64 || undefined,
        });

        await supabase.from('invoices').update({
          status: 'sent',
          sent_via: 'email',
          sent_at: new Date().toISOString(),
        }).eq('id', invoiceId);
      } catch (emailErr) {
        console.error('Email send failed:', emailErr);
        showToast({ message: 'Invoice created but email failed to send', type: 'warning' });
      }
    } else if (sendMethod === 'sms' && clientData.phone) {
      try {
        const message = `Hi ${clientData.name}, your invoice #${invoiceNumber} for $${total.toFixed(2)} is ready. Thank you!`;
        await invokeFunction('send-sms', {
          organization_id: currentOrganization!.id,
          to: clientData.phone,
          body: message,
        });
        await supabase.from('invoices').update({
          status: 'sent',
          sent_via: 'sms',
          sent_at: new Date().toISOString(),
        }).eq('id', invoiceId);
      } catch (smsErr) {
        console.error('SMS send failed:', smsErr);
        showToast({ message: 'Invoice created but SMS failed to send', type: 'warning' });
      }
    }
  };

  const getRealEventId = (id: string) => {
    const datePattern = /-\d{4}-\d{2}-\d{2}$/;
    return datePattern.test(id) ? id.replace(datePattern, '') : id;
  };

  const formatCurrency = (n: number) => `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

  const ds = getDynamicStyles(colors);

  if (!event) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={ds.overlay}>
        <View style={ds.container}>
          <View style={ds.header}>
            <View style={{ flex: 1 }}>
              <Text style={ds.headerTitle}>Complete Job</Text>
              <Text style={ds.headerSubtitle} numberOfLines={1}>
                {event.title}{event.client?.name ? ` - ${event.client.name}` : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={ds.closeButton}>
              <X size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          {initialLoading ? (
            <View style={ds.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <ScrollView style={ds.scrollContent} showsVerticalScrollIndicator={false}>
              <View style={ds.completionBanner}>
                <CheckCircle size={20} color="#fff" />
                <Text style={ds.completionBannerText}>Mark this job as completed</Text>
              </View>

              {isRestrictedEmployee ? (
                <View style={{ marginHorizontal: 16, marginTop: 12, backgroundColor: '#FEF9C3', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#FDE68A', flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                  <Text style={{ fontSize: 15 }}>⚠️</Text>
                  <Text style={{ flex: 1, fontSize: 13, color: '#92400E', lineHeight: 18 }}>
                    Invoice creation is managed by your owner or admin. After completing this job, you'll be able to notify them automatically.
                  </Text>
                </View>
              ) : (
                <>
                  <View style={ds.section}>
                    <Text style={ds.sectionTitle}>Invoice Summary</Text>
                    {lineItems.map((item, idx) => (
                      <View key={idx} style={ds.lineItemRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={ds.lineItemDesc} numberOfLines={1}>{item.description}</Text>
                          <Text style={ds.lineItemDetail}>
                            {item.quantity} x {formatCurrency(item.unit_price)}
                          </Text>
                        </View>
                        <Text style={ds.lineItemTotal}>{formatCurrency(item.total)}</Text>
                      </View>
                    ))}
                    {taxRate > 0 && (
                      <View style={ds.summaryRow}>
                        <Text style={ds.summaryLabel}>Tax ({taxRate}%)</Text>
                        <Text style={ds.summaryValue}>{formatCurrency(taxAmount)}</Text>
                      </View>
                    )}
                    {includeCcFee && ccFee > 0 && (
                      <View style={ds.summaryRow}>
                        <Text style={ds.summaryLabel}>CC Fee ({ccFeePercent}%)</Text>
                        <Text style={ds.summaryValue}>{formatCurrency(ccFee)}</Text>
                      </View>
                    )}
                    <View style={ds.totalRow}>
                      <Text style={ds.totalLabel}>Total</Text>
                      <Text style={ds.totalValue}>{formatCurrency(total)}</Text>
                    </View>
                  </View>

                  <View style={ds.section}>
                    <View style={ds.toggleRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={ds.toggleLabel}>Create Invoice</Text>
                        <Text style={ds.toggleHint}>Auto-generate invoice from job details</Text>
                      </View>
                      <Switch
                        value={createInvoice}
                        onValueChange={setCreateInvoice}
                        trackColor={{ false: colors.border, true: colors.primary + '60' }}
                        thumbColor={createInvoice ? colors.primary : colors.textSecondary}
                      />
                    </View>

                    {ccFeePercent > 0 && createInvoice && (
                      <View style={ds.toggleRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={ds.toggleLabel}>Include CC Fee ({ccFeePercent}%)</Text>
                          <Text style={ds.toggleHint}>Add processing fee to invoice total</Text>
                        </View>
                        <Switch
                          value={includeCcFee}
                          onValueChange={setIncludeCcFee}
                          trackColor={{ false: colors.border, true: colors.primary + '60' }}
                          thumbColor={includeCcFee ? colors.primary : colors.textSecondary}
                        />
                      </View>
                    )}

                    <View style={ds.toggleRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={ds.toggleLabel}>Record Payment Now</Text>
                        <Text style={ds.toggleHint}>Mark as paid and add to income</Text>
                      </View>
                      <Switch
                        value={recordPayment}
                        onValueChange={(val) => {
                          setRecordPayment(val);
                          if (!val) setPaymentMethod('');
                        }}
                        trackColor={{ false: colors.border, true: colors.success + '60' }}
                        thumbColor={recordPayment ? colors.success : colors.textSecondary}
                      />
                    </View>

                    {recordPayment && (
                      <View style={ds.paymentMethodSection}>
                        <TouchableOpacity
                          style={ds.paymentMethodSelector}
                          onPress={() => setShowPaymentMethods(!showPaymentMethods)}
                        >
                          <CreditCard size={16} color={colors.textSecondary} />
                          <Text style={[ds.paymentMethodText, !paymentMethod && { color: colors.textSecondary }]}>
                            {paymentMethod ? PAYMENT_METHODS.find(m => m.value === paymentMethod)?.label : 'Select payment method'}
                          </Text>
                          <ChevronDown size={16} color={colors.textSecondary} />
                        </TouchableOpacity>
                        {showPaymentMethods && (
                          <View style={ds.paymentMethodList}>
                            {PAYMENT_METHODS.map((method) => (
                              <TouchableOpacity
                                key={method.value}
                                style={[ds.paymentMethodOption, paymentMethod === method.value && ds.paymentMethodOptionActive]}
                                onPress={() => {
                                  setPaymentMethod(method.value);
                                  setShowPaymentMethods(false);
                                }}
                              >
                                <Text style={[ds.paymentMethodOptionText, paymentMethod === method.value && ds.paymentMethodOptionTextActive]}>
                                  {method.label}
                                </Text>
                                {paymentMethod === method.value && <Check size={16} color={colors.primary} />}
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </View>
                    )}

                    {createInvoice && (
                      <View style={ds.toggleRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={ds.toggleLabel}>Send Invoice</Text>
                          <Text style={ds.toggleHint}>
                            {clientData?.email ? 'Email invoice to client immediately' : clientData?.phone ? 'SMS invoice to client immediately' : 'No email or phone on file'}
                          </Text>
                        </View>
                        <Switch
                          value={sendInvoice}
                          onValueChange={setSendInvoice}
                          disabled={!clientData?.email && !clientData?.phone}
                          trackColor={{ false: colors.border, true: colors.primary + '60' }}
                          thumbColor={sendInvoice ? colors.primary : colors.textSecondary}
                        />
                      </View>
                    )}

                    {sendInvoice && clientData?.email && clientData?.phone && (
                      <View style={ds.sendMethodRow}>
                        <TouchableOpacity
                          style={[ds.sendMethodOption, sendMethod === 'email' && ds.sendMethodOptionActive]}
                          onPress={() => setSendMethod('email')}
                        >
                          <Mail size={16} color={sendMethod === 'email' ? '#fff' : colors.textSecondary} />
                          <Text style={[ds.sendMethodText, sendMethod === 'email' && ds.sendMethodTextActive]}>Email</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[ds.sendMethodOption, sendMethod === 'sms' && ds.sendMethodOptionActive]}
                          onPress={() => setSendMethod('sms')}
                        >
                          <MessageSquare size={16} color={sendMethod === 'sms' ? '#fff' : colors.textSecondary} />
                          <Text style={[ds.sendMethodText, sendMethod === 'sms' && ds.sendMethodTextActive]}>SMS</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>

                  {createInvoice && (
                    <View style={ds.section}>
                      <Text style={ds.sectionTitle}>Invoice Notes</Text>
                      <TextInput
                        style={ds.notesInput}
                        value={notes}
                        onChangeText={setNotes}
                        placeholder="Optional notes for the invoice..."
                        placeholderTextColor={colors.textSecondary}
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                      />
                    </View>
                  )}
                </>
              )}

              <View style={{ height: 24 }} />
            </ScrollView>
          )}

          <View style={ds.footer}>
            <TouchableOpacity style={ds.cancelButton} onPress={onClose} disabled={loading}>
              <Text style={ds.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[ds.completeButton, loading && { opacity: 0.6 }]}
              onPress={handleComplete}
              disabled={loading || initialLoading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <CheckCircle size={18} color="#fff" />
                  <Text style={ds.completeButtonText}>Complete Job</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
      <JobCompletionNotifyModal
        visible={showNotifyModal}
        jobTitle={event?.title || ''}
        clientName={event?.client?.name || clientData?.name || ''}
        scheduleEventId={completedEventId}
        completedAt={completedAt}
        onClose={() => setShowNotifyModal(false)}
        onSkip={() => setShowNotifyModal(false)}
      />
    </Modal>
  );
}

const getDynamicStyles = (colors: any) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    container: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '92%',
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    headerSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    closeButton: {
      padding: 8,
      marginLeft: 12,
    },
    loadingContainer: {
      padding: 60,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scrollContent: {
      flex: 1,
    },
    completionBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: '#2D8B57',
      marginHorizontal: 16,
      marginTop: 16,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 10,
    },
    completionBannerText: {
      fontSize: 15,
      fontWeight: '600',
      color: '#fff',
    },
    section: {
      marginHorizontal: 16,
      marginTop: 16,
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 12,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    lineItemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border + '50',
    },
    lineItemDesc: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
    },
    lineItemDetail: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    lineItemTotal: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginLeft: 12,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 6,
      marginTop: 4,
    },
    summaryLabel: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    summaryValue: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingTop: 12,
      marginTop: 8,
      borderTopWidth: 2,
      borderTopColor: colors.primary,
    },
    totalLabel: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.text,
    },
    totalValue: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.primary,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border + '30',
    },
    toggleLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    toggleHint: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    paymentMethodSection: {
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border + '30',
    },
    paymentMethodSelector: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.inputBackground,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    paymentMethodText: {
      flex: 1,
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
    },
    paymentMethodList: {
      marginTop: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    paymentMethodOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border + '30',
    },
    paymentMethodOptionActive: {
      backgroundColor: colors.primaryLight,
    },
    paymentMethodOptionText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
    },
    paymentMethodOptionTextActive: {
      color: colors.primary,
      fontWeight: '600',
    },
    sendMethodRow: {
      flexDirection: 'row',
      gap: 10,
      paddingVertical: 12,
    },
    sendMethodOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sendMethodOptionActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    sendMethodText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    sendMethodTextActive: {
      color: '#fff',
    },
    notesInput: {
      backgroundColor: colors.inputBackground,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 14,
      color: colors.text,
      minHeight: 70,
    },
    footer: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: 12,
    },
    cancelButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 10,
      alignItems: 'center',
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cancelButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    completeButton: {
      flex: 2,
      flexDirection: 'row',
      paddingVertical: 14,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: '#2D8B57',
    },
    completeButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#fff',
    },
  });
