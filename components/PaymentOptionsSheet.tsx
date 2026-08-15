import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import {
  X,
  CreditCard,
  Banknote,
  Landmark,
  Mail,
  ExternalLink,
  Phone,
  Copy,
  CircleCheck as CheckCircle,
} from 'lucide-react-native';
import { portalGet, portalPostAuth, portalSupabase } from '@/lib/portalSupabase';

interface PaymentMethods {
  stripe_payment_link: string | null;
  venmo_username: string | null;
  cashapp_username: string | null;
  zelle_email: string | null;
  zelle_phone: string | null;
  check_payable_to: string | null;
  check_mailing_address: string | null;
  cc_processing_fee_percent: number;
}

interface PaymentOptionsSheetProps {
  visible: boolean;
  onClose: () => void;
  slug: string;
  invoiceAmount?: number;
  invoiceNumber?: string;
  invoiceId?: string;
  primaryColor?: string;
}

export default function PaymentOptionsSheet({
  visible,
  onClose,
  slug,
  invoiceAmount,
  invoiceNumber,
  invoiceId,
  primaryColor = '#007AFF',
}: PaymentOptionsSheetProps) {
  const [loading, setLoading] = useState(true);
  const [methods, setMethods] = useState<PaymentMethods | null>(null);
  const [instructions, setInstructions] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  useEffect(() => {
    if (visible && slug) loadPaymentMethods();
  }, [visible, slug]);

  const loadPaymentMethods = async () => {
    setLoading(true);
    try {
      const data = await portalGet({ action: 'payment_methods', slug });
      if (data?.payment_methods) setMethods(data.payment_methods);
      if (data?.payment_instructions) setInstructions(data.payment_instructions);
    } catch {}
    setLoading(false);
  };

  const copyToClipboard = async (text: string, field: string) => {
    if (Platform.OS === 'web') {
      try {
        await navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
      } catch {}
    }
  };

  const hasAnyMethod = methods && (
    methods.stripe_payment_link ||
    methods.venmo_username ||
    methods.cashapp_username ||
    methods.zelle_email ||
    methods.zelle_phone ||
    methods.check_payable_to
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Payment Options</Text>
            {invoiceNumber && (
              <Text style={styles.headerSub}>Invoice #{invoiceNumber}</Text>
            )}
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <X size={22} color="#3C3C43" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={primaryColor} />
            </View>
          ) : !hasAnyMethod && !instructions ? (
            <View style={styles.emptyWrap}>
              <CreditCard size={40} color="#C7C7CC" />
              <Text style={styles.emptyTitle}>No Payment Methods</Text>
              <Text style={styles.emptySub}>
                This business has not configured payment options yet. Please contact them directly.
              </Text>
            </View>
          ) : (
            <>
              {invoiceAmount && invoiceAmount > 0 && (
                <View style={[styles.amountCard, { borderLeftColor: primaryColor }]}>
                  <Text style={styles.amountLabel}>Amount Due</Text>
                  <Text style={[styles.amountValue, { color: primaryColor }]}>
                    ${Number(invoiceAmount).toFixed(2)}
                  </Text>
                </View>
              )}

              {methods?.stripe_payment_link && (
                <TouchableOpacity
                  style={[styles.methodCard, styles.stripeCard]}
                  onPress={async () => {
                    if (checkoutLoading) return;
                    setCheckoutError(null);
                    if (invoiceId) {
                      setCheckoutLoading(true);
                      try {
                        const { data: { session } } = await portalSupabase.auth.getSession();
                        const token = session?.access_token || '';
                        const res = await portalPostAuth(
                          { action: 'create_checkout', slug, invoiceId },
                          token,
                        );
                        if (res?.checkoutUrl) {
                          Linking.openURL(res.checkoutUrl);
                        } else {
                          setCheckoutError(res?.error || 'Failed to start checkout. Please try again.');
                        }
                      } catch {
                        setCheckoutError('Failed to start checkout. Please try again.');
                      }
                      setCheckoutLoading(false);
                    } else {
                      Linking.openURL(methods.stripe_payment_link!);
                    }
                  }}
                >
                  <View style={[styles.methodIconWrap, { backgroundColor: '#635BFF18' }]}>
                    {checkoutLoading
                      ? <ActivityIndicator size="small" color="#635BFF" />
                      : <CreditCard size={20} color="#635BFF" />}
                  </View>
                  <View style={styles.methodContent}>
                    <Text style={styles.methodTitle}>Pay with Card</Text>
                    <Text style={styles.methodSub}>
                      Secure payment via Stripe
                      {methods.cc_processing_fee_percent > 0
                        ? ` (${methods.cc_processing_fee_percent}% processing fee may apply)`
                        : ''}
                    </Text>
                    {checkoutError ? (
                      <Text style={styles.checkoutError}>{checkoutError}</Text>
                    ) : null}
                  </View>
                  <ExternalLink size={16} color="#635BFF" />
                </TouchableOpacity>
              )}

              {methods?.venmo_username && (
                <View style={styles.methodCard}>
                  <View style={[styles.methodIconWrap, { backgroundColor: '#008CFF18' }]}>
                    <Banknote size={20} color="#008CFF" />
                  </View>
                  <View style={styles.methodContent}>
                    <Text style={styles.methodTitle}>Venmo</Text>
                    <View style={styles.valueRow}>
                      <Text style={styles.methodValue}>@{methods.venmo_username}</Text>
                      <CopyButton
                        text={methods.venmo_username}
                        field="venmo"
                        copiedField={copiedField}
                        onCopy={copyToClipboard}
                        color="#008CFF"
                      />
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => Linking.openURL(`https://venmo.com/${methods.venmo_username}`)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <ExternalLink size={16} color="#008CFF" />
                  </TouchableOpacity>
                </View>
              )}

              {methods?.cashapp_username && (
                <View style={styles.methodCard}>
                  <View style={[styles.methodIconWrap, { backgroundColor: '#00D63218' }]}>
                    <Banknote size={20} color="#00D632" />
                  </View>
                  <View style={styles.methodContent}>
                    <Text style={styles.methodTitle}>Cash App</Text>
                    <View style={styles.valueRow}>
                      <Text style={styles.methodValue}>${methods.cashapp_username}</Text>
                      <CopyButton
                        text={`$${methods.cashapp_username}`}
                        field="cashapp"
                        copiedField={copiedField}
                        onCopy={copyToClipboard}
                        color="#00D632"
                      />
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => Linking.openURL(`https://cash.app/$${methods.cashapp_username}`)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <ExternalLink size={16} color="#00D632" />
                  </TouchableOpacity>
                </View>
              )}

              {(methods?.zelle_email || methods?.zelle_phone) && (
                <View style={styles.methodCard}>
                  <View style={[styles.methodIconWrap, { backgroundColor: '#6D1ED418' }]}>
                    <Landmark size={20} color="#6D1ED4" />
                  </View>
                  <View style={styles.methodContent}>
                    <Text style={styles.methodTitle}>Zelle</Text>
                    {methods.zelle_email && (
                      <View style={styles.valueRow}>
                        <Mail size={13} color="#8E8E93" />
                        <Text style={styles.methodValue}>{methods.zelle_email}</Text>
                        <CopyButton
                          text={methods.zelle_email}
                          field="zelle_email"
                          copiedField={copiedField}
                          onCopy={copyToClipboard}
                          color="#6D1ED4"
                        />
                      </View>
                    )}
                    {methods.zelle_phone && (
                      <View style={styles.valueRow}>
                        <Phone size={13} color="#8E8E93" />
                        <Text style={styles.methodValue}>{methods.zelle_phone}</Text>
                        <CopyButton
                          text={methods.zelle_phone}
                          field="zelle_phone"
                          copiedField={copiedField}
                          onCopy={copyToClipboard}
                          color="#6D1ED4"
                        />
                      </View>
                    )}
                  </View>
                </View>
              )}

              {methods?.check_payable_to && (
                <View style={styles.methodCard}>
                  <View style={[styles.methodIconWrap, { backgroundColor: '#8E8E9318' }]}>
                    <Banknote size={20} color="#3C3C43" />
                  </View>
                  <View style={styles.methodContent}>
                    <Text style={styles.methodTitle}>Check</Text>
                    <Text style={styles.methodSub}>
                      Make payable to: <Text style={{ fontWeight: '600', color: '#1C1C1E' }}>{methods.check_payable_to}</Text>
                    </Text>
                    {methods.check_mailing_address && (
                      <Text style={styles.methodSub}>
                        Mail to: {methods.check_mailing_address}
                      </Text>
                    )}
                  </View>
                </View>
              )}

              {instructions ? (
                <View style={styles.instructionsCard}>
                  <Text style={styles.instructionsTitle}>Payment Instructions</Text>
                  <Text style={styles.instructionsText}>{instructions}</Text>
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function CopyButton({
  text,
  field,
  copiedField,
  onCopy,
  color,
}: {
  text: string;
  field: string;
  copiedField: string | null;
  onCopy: (text: string, field: string) => void;
  color: string;
}) {
  if (Platform.OS !== 'web') return null;
  const isCopied = copiedField === field;
  return (
    <TouchableOpacity
      style={styles.copyBtn}
      onPress={() => onCopy(text, field)}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
    >
      {isCopied
        ? <CheckCircle size={14} color="#34C759" />
        : <Copy size={14} color={color} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 56 : 20,
    paddingBottom: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#F2F2F7',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1C1C1E' },
  headerSub: { fontSize: 13, color: '#8E8E93', marginTop: 2 },
  closeBtn: { padding: 4 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 10, paddingBottom: 48 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyWrap: { alignItems: 'center', paddingTop: 80, gap: 12, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#3C3C43' },
  emptySub: { fontSize: 14, color: '#8E8E93', textAlign: 'center', lineHeight: 20 },
  amountCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    borderLeftWidth: 4, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  amountLabel: { fontSize: 14, color: '#8E8E93', fontWeight: '500' },
  amountValue: { fontSize: 24, fontWeight: '700' },
  methodCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  stripeCard: { borderWidth: 1.5, borderColor: '#635BFF20' },
  methodIconWrap: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  methodContent: { flex: 1, gap: 2 },
  methodTitle: { fontSize: 15, fontWeight: '600', color: '#1C1C1E' },
  methodSub: { fontSize: 13, color: '#8E8E93', lineHeight: 18 },
  methodValue: { fontSize: 14, color: '#1C1C1E', fontWeight: '500' },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  copyBtn: { padding: 2 },
  instructionsCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  instructionsTitle: { fontSize: 14, fontWeight: '600', color: '#3C3C43', marginBottom: 8 },
  instructionsText: { fontSize: 14, color: '#3C3C43', lineHeight: 20 },
  checkoutError: { fontSize: 12, color: '#FF3B30', marginTop: 4, lineHeight: 16 },
});
