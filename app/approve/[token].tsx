import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  Switch,
  Platform,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { CircleCheck as CheckCircle, CircleAlert as AlertCircle } from 'lucide-react-native';

const SUPABASE_URL = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

interface EstimateItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  discount_percentage: number;
  is_optional: boolean;
  notes: string;
  total: number;
  display_order: number;
}

interface EstimateData {
  estimate: {
    id: string;
    estimate_number: string;
    issue_date: string;
    valid_until: string;
    subtotal: number;
    tax_rate: number;
    tax_amount: number;
    discount_amount: number;
    discount_percentage: number;
    total: number;
    notes: string;
    requires_signature: boolean;
    status: string;
  };
  items: EstimateItem[];
  business: {
    business_name: string;
    business_phone: string;
    business_email: string;
    business_address: string;
    logo_url?: string;
  };
  client: {
    name: string;
    email: string;
  };
}

export default function ApproveEstimate() {
  const { token } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [estimateData, setEstimateData] = useState<EstimateData | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [signedByName, setSignedByName] = useState('');
  const [signedByEmail, setSignedByEmail] = useState('');
  const [clientNotes, setClientNotes] = useState('');
  const [agreeToSign, setAgreeToSign] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchEstimateData();
  }, [token]);

  const fetchEstimateData = async () => {
    if (!token) {
      setError('No approval token provided');
      setLoading(false);
      return;
    }

    try {
      if (!SUPABASE_URL) {
        setError('Configuration error: Supabase URL not found');
        setLoading(false);
        return;
      }

      const apiUrl = `${SUPABASE_URL}/functions/v1/estimate-approval-get`;

      const response = await fetch(`${apiUrl}?token=${token}`, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
        },
      });
      const data = await response.json();

      if (!response.ok || data.error) {
        setError(data.error || `Server error: ${response.status}`);
        setLoading(false);
        return;
      }

      if (!data.estimate || !data.items) {
        setError('Invalid response from server');
        setLoading(false);
        return;
      }

      setEstimateData(data);
      setSignedByName(data.client?.name || '');
      setSignedByEmail(data.client?.email || '');

      const allItems = new Set<string>();
      data.items.forEach((item: EstimateItem) => {
        allItems.add(item.id);
      });
      setSelectedItems(allItems);
    } catch (err: any) {
      setError(err.message || 'Failed to load estimate');
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const calculateTotals = () => {
    if (!estimateData) return { subtotal: 0, taxAmount: 0, total: 0, discount: 0 };

    const approvedItems = estimateData.items.filter((item) => selectedItems.has(item.id));
    const itemsSubtotal = approvedItems.reduce((sum, item) => sum + item.total, 0);

    let discount = 0;
    if (estimateData.estimate.discount_percentage > 0) {
      discount = itemsSubtotal * (estimateData.estimate.discount_percentage / 100);
    } else if (estimateData.estimate.discount_amount > 0) {
      discount = estimateData.estimate.discount_amount;
    }

    const subtotal = Math.max(0, itemsSubtotal - discount);
    const taxAmount = subtotal * (estimateData.estimate.tax_rate / 100);
    const total = subtotal + taxAmount;

    return { subtotal: itemsSubtotal, discount, taxAmount, total };
  };

  const handleSubmit = async () => {
    if (!estimateData) return;

    if (estimateData.estimate.requires_signature && !agreeToSign) {
      setError('Please confirm that you agree to sign off on this estimate');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const apiUrl = `${SUPABASE_URL}/functions/v1/estimate-approval-submit`;

      const payload = {
        token,
        approvedItemIds: Array.from(selectedItems),
        signatureData: `Signed by ${signedByName.trim()}`,
        signedByName: signedByName.trim(),
        signedByEmail: signedByEmail.trim(),
        clientNotes: clientNotes.trim(),
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        setError(data.error || `Server returned ${response.status}`);
        return;
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to submit approval');
    } finally {
      setSubmitting(false);
    }
  };


  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#1a3c5e" />
          <Text style={styles.loadingText}>Loading estimate...</Text>
        </View>
      </View>
    );
  }

  if (error && !estimateData) {
    return (
      <View style={styles.container}>
        <View style={styles.errorBox}>
          <AlertCircle size={48} color="#ff3b30" />
          <Text style={styles.errorTitle}>Unable to Load Estimate</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </View>
    );
  }

  if (success) {
    return (
      <View style={styles.container}>
        <View style={styles.successBox}>
          <CheckCircle size={64} color="#34c759" />
          <Text style={styles.successTitle}>Estimate Approved!</Text>
          <Text style={styles.successText}>
            Thank you! Your approval has been submitted to {estimateData?.business.business_name}. They
            will be in touch to schedule your service.
          </Text>
        </View>
      </View>
    );
  }

  if (!estimateData) return null;

  const { subtotal, discount, taxAmount, total } = calculateTotals();
  const sortedItems = [...estimateData.items].sort((a, b) => a.display_order - b.display_order);

  return (
    <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
      <View style={styles.page}>
        <View style={styles.header}>
          {estimateData.business.logo_url && (
            <Image source={{ uri: estimateData.business.logo_url }} style={styles.logo} resizeMode="contain" />
          )}
          <Text style={styles.businessName}>{estimateData.business.business_name}</Text>
          <Text style={styles.headerTitle}>Estimate for Your Review</Text>
          <Text style={styles.estimateNumber}>#{estimateData.estimate.estimate_number}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Estimate Details</Text>
          <View style={styles.metaGrid}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Issue Date</Text>
              <Text style={styles.metaValue}>
                {new Date(estimateData.estimate.issue_date).toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Valid Until</Text>
              <Text style={styles.metaValue}>
                {new Date(estimateData.estimate.valid_until).toLocaleDateString()}
              </Text>
            </View>
          </View>
          {estimateData.estimate.notes && (
            <View style={styles.notesBox}>
              <Text style={styles.notesTitle}>Notes:</Text>
              <Text style={styles.notesText}>{estimateData.estimate.notes}</Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            Services
            {sortedItems.some((i) => i.is_optional) && (
              <Text style={styles.cardSubtitle}> - Toggle optional items</Text>
            )}
          </Text>

          {error && (
            <View style={styles.errorBanner}>
              <AlertCircle size={20} color="#ff3b30" />
              <Text style={styles.errorBannerText}>{error}</Text>
            </View>
          )}

          {sortedItems.map((item, index) => {
            const isSelected = selectedItems.has(item.id);
            return (
              <View
                key={item.id}
                style={[styles.lineItem, !isSelected && item.is_optional && styles.lineItemDisabled]}
              >
                <View style={styles.itemLeft}>
                  {item.is_optional ? (
                    <Switch
                      value={isSelected}
                      onValueChange={() => toggleItem(item.id)}
                      trackColor={{ false: '#ccc', true: '#0071e3' }}
                    />
                  ) : (
                    <View style={styles.includedBadge}>
                      <Text style={styles.includedText}>Included</Text>
                    </View>
                  )}
                  <View style={styles.itemInfo}>
                    <View style={styles.itemDescRow}>
                      <Text style={styles.itemDesc}>{item.description}</Text>
                      {item.is_optional && <View style={styles.optTag}><Text style={styles.optTagText}>Optional</Text></View>}
                    </View>
                    {item.notes && <Text style={styles.itemNotes}>{item.notes}</Text>}
                  </View>
                </View>
                <View style={styles.itemRight}>
                  <Text style={styles.qty}>
                    {item.quantity} × ${item.unit_price.toFixed(2)}
                  </Text>
                  <Text style={styles.lineTotal}>${item.total.toFixed(2)}</Text>
                </View>
              </View>
            );
          })}

          <View style={styles.totals}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>${subtotal.toFixed(2)}</Text>
            </View>
            {discount > 0 && (
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: '#34c759' }]}>
                  Discount
                  {estimateData.estimate.discount_percentage > 0 &&
                    ` (${estimateData.estimate.discount_percentage}%)`}
                </Text>
                <Text style={[styles.totalValue, { color: '#34c759' }]}>-${discount.toFixed(2)}</Text>
              </View>
            )}
            {estimateData.estimate.tax_rate > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Tax ({estimateData.estimate.tax_rate}%)</Text>
                <Text style={styles.totalValue}>${taxAmount.toFixed(2)}</Text>
              </View>
            )}
            <View style={[styles.totalRow, styles.grandTotalRow]}>
              <Text style={styles.grandTotalLabel}>Total</Text>
              <Text style={styles.grandTotalValue}>${total.toFixed(2)}</Text>
            </View>
          </View>

          <View style={styles.validUntil}>
            <Text style={styles.validUntilText}>
              This estimate is valid until {new Date(estimateData.estimate.valid_until).toLocaleDateString()}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.clientInfoRow}>
            <View style={styles.clientInfoAvatar}>
              <Text style={styles.clientInfoAvatarText}>
                {(estimateData.client.name || '?')[0].toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.clientInfoName}>{estimateData.client.name}</Text>
              {estimateData.client.email ? (
                <Text style={styles.clientInfoEmail}>{estimateData.client.email}</Text>
              ) : null}
            </View>
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Notes or Questions (optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={clientNotes}
              onChangeText={setClientNotes}
              placeholder="Any questions or special requests..."
              multiline
              numberOfLines={3}
            />
          </View>
        </View>

        {estimateData.estimate.requires_signature && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Signature Confirmation *</Text>
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => setAgreeToSign(!agreeToSign)}
            >
              <View style={[styles.checkbox, agreeToSign && styles.checkboxChecked]}>
                {agreeToSign && <CheckCircle size={20} color="#fff" />}
              </View>
              <Text style={styles.checkboxLabel}>
                By clicking this box, you are saying that you are signing off on this estimate
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.approveButton, submitting && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            <LinearGradient
              colors={['#1B4D6E', '#245d82'] as [string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.approveButtonGradient}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <CheckCircle size={20} color="#fff" />
                  <Text style={styles.approveButtonText}>Approve & Sign Estimate</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  scrollContainer: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  scrollContent: {
    paddingVertical: 24,
  },
  page: {
    maxWidth: 700,
    marginHorizontal: 'auto',
    paddingHorizontal: 16,
  },
  header: {
    backgroundColor: '#1a3c5e',
    borderRadius: 16,
    padding: 32,
    marginBottom: 24,
    alignItems: 'center',
  },
  logo: {
    width: 140,
    height: 50,
    marginBottom: 12,
  },
  businessName: {
    fontSize: 26,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.95)',
    marginBottom: 4,
  },
  estimateNumber: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    color: '#1d1d1f',
  },
  cardSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: '#86868b',
  },
  metaGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  metaItem: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 13,
    color: '#86868b',
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1d1d1f',
  },
  notesBox: {
    padding: 12,
    backgroundColor: '#f9f9fb',
    borderRadius: 10,
  },
  notesTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#515154',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 13,
    color: '#515154',
    lineHeight: 20,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff2f2',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ffcccc',
  },
  errorBannerText: {
    flex: 1,
    color: '#ff3b30',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  lineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  lineItemDisabled: {
    opacity: 0.4,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  itemInfo: {
    flex: 1,
  },
  itemDescRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  itemDesc: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1d1d1f',
  },
  itemNotes: {
    fontSize: 12,
    color: '#86868b',
    marginTop: 2,
  },
  includedBadge: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  includedText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#86868b',
  },
  optTag: {
    backgroundColor: '#e8f4fd',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  optTagText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#0071e3',
  },
  itemRight: {
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  qty: {
    fontSize: 12,
    color: '#86868b',
    marginBottom: 2,
  },
  lineTotal: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1d1d1f',
  },
  totals: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 16,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  totalLabel: {
    fontSize: 14,
    color: '#86868b',
  },
  totalValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1d1d1f',
  },
  grandTotalRow: {
    borderTopWidth: 2,
    borderTopColor: '#1d1d1f',
    marginTop: 8,
    paddingTop: 12,
  },
  grandTotalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a3c5e',
  },
  grandTotalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a3c5e',
  },
  validUntil: {
    backgroundColor: '#fff8e8',
    padding: 10,
    borderRadius: 10,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  validUntilText: {
    fontSize: 13,
    color: '#a68307',
    textAlign: 'center',
  },
  clientInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 20,
    padding: 14,
    backgroundColor: '#f5f7fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8eaed',
  },
  clientInfoAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1a3c5e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientInfoAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  clientInfoName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1d1d1f',
  },
  clientInfoEmail: {
    fontSize: 13,
    color: '#86868b',
    marginTop: 2,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#86868b',
    marginBottom: 6,
  },
  input: {
    width: '100%',
    padding: 12,
    borderWidth: 0,
    borderRadius: 10,
    fontSize: 15,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#d2d2d7',
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d2d2d7',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: '#0071e3',
    borderColor: '#0071e3',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 15,
    color: '#1d1d1f',
    lineHeight: 22,
    paddingTop: 2,
  },
  actions: {
    marginBottom: 32,
  },
  approveButton: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden' as const,
  },
  approveButtonGradient: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    padding: 16,
  },
  approveButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  loadingBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    gap: 16,
    minWidth: 200,
  },
  loadingText: {
    fontSize: 16,
    color: '#1d1d1f',
  },
  errorBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 48,
    maxWidth: 480,
    alignItems: 'center',
    gap: 12,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1d1d1f',
  },
  errorText: {
    fontSize: 14,
    color: '#86868b',
    textAlign: 'center',
  },
  successBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 48,
    maxWidth: 480,
    alignItems: 'center',
    gap: 16,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1d1d1f',
    marginTop: 16,
  },
  successText: {
    fontSize: 15,
    color: '#86868b',
    textAlign: 'center',
    lineHeight: 22,
  },
});
