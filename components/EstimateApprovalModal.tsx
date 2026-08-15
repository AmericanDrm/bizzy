import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, CircleCheck as CheckCircle, CircleAlert as AlertCircle, PenTool, DollarSign } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import SignatureCanvas from '@/components/SignatureCanvas';
import { useToast } from '@/contexts/ToastContext';
import { useTheme } from '@/contexts/ThemeContext';

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
  approved_by_client: boolean;
}

interface Estimate {
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
  signed_at?: string;
  signature_data?: string;
}

interface EstimateApprovalModalProps {
  visible: boolean;
  estimateId: string | null;
  clientName: string;
  clientEmail: string;
  onClose: () => void;
  onApprove: (estimateId: string) => void;
}

export default function EstimateApprovalModal({
  visible,
  estimateId,
  clientName,
  clientEmail,
  onClose,
  onApprove,
}: EstimateApprovalModalProps) {
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [items, setItems] = useState<EstimateItem[]>([]);
  const [clientNotes, setClientNotes] = useState('');
  const [signedByName, setSignedByName] = useState(clientName);
  const [signedByEmail, setSignedByEmail] = useState(clientEmail);
  const [showSignature, setShowSignature] = useState(false);
  const [signatureData, setSignatureData] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { showToast } = useToast();
  const { colors } = useTheme();

  useEffect(() => {
    if (visible && estimateId) {
      fetchEstimateDetails();
    }
  }, [visible, estimateId]);

  const fetchEstimateDetails = async () => {
    setLoading(true);
    setError('');

    try {
      const { data: estimateData, error: estimateError } = await supabase
        .from('estimates')
        .select('*')
        .eq('id', estimateId)
        .single();

      if (estimateError) throw estimateError;

      const { data: itemsData, error: itemsError } = await supabase
        .from('estimate_items')
        .select('*')
        .eq('estimate_id', estimateId)
        .order('display_order', { ascending: true });

      if (itemsError) throw itemsError;

      setEstimate(estimateData);
      setItems(
        itemsData.map((item) => ({
          ...item,
          approved_by_client: item.approved_by_client !== false,
        }))
      );

      if (estimateData.signed_at) {
        setSignatureData(estimateData.signature_data || '');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to load estimate');
    } finally {
      setLoading(false);
    }
  };

  const toggleItemApproval = (index: number) => {
    const newItems = [...items];
    newItems[index].approved_by_client = !newItems[index].approved_by_client;
    setItems(newItems);
  };

  const calculateTotals = () => {
    const approvedItems = items.filter((item) => item.approved_by_client);
    const itemsSubtotal = approvedItems.reduce((sum, item) => {
      const baseTotal = item.quantity * item.unit_price;
      let discount = 0;

      if (item.discount_percentage > 0) {
        discount = baseTotal * (item.discount_percentage / 100);
      } else if (item.discount_amount > 0) {
        discount = item.discount_amount;
      }

      return sum + Math.max(0, baseTotal - discount);
    }, 0);

    let overallDiscount = 0;
    if (estimate) {
      if (estimate.discount_percentage > 0) {
        overallDiscount = itemsSubtotal * (estimate.discount_percentage / 100);
      } else if (estimate.discount_amount > 0) {
        overallDiscount = estimate.discount_amount;
      }
    }

    const subtotal = Math.max(0, itemsSubtotal - overallDiscount);
    const tax = subtotal * ((estimate?.tax_rate || 0) / 100);

    return {
      itemsSubtotal,
      overallDiscount,
      subtotal,
      taxAmount: tax,
      total: subtotal + tax,
    };
  };

  const handleSignature = (signature: string) => {
    setSignatureData(signature);
    setShowSignature(false);
  };

  const handleApprove = async () => {
    if (!estimate) return;

    if (estimate.requires_signature && !signatureData) {
      setError('Please provide your signature');
      return;
    }

    if (!signedByName.trim()) {
      setError('Please enter your name');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const { itemsSubtotal, overallDiscount, subtotal, taxAmount, total } = calculateTotals();

      const { error: estimateError } = await supabase
        .from('estimates')
        .update({
          status: 'approved',
          signed_at: new Date().toISOString(),
          signature_data: signatureData || null,
          signed_by_name: signedByName.trim() || null,
          signed_by_email: signedByEmail.trim() || null,
          client_notes: clientNotes.trim() || null,
          subtotal,
          tax_amount: taxAmount,
          total,
          updated_at: new Date().toISOString(),
        })
        .eq('id', estimateId);

      if (estimateError) {
        console.error('Estimate update error:', estimateError);
        throw new Error(estimateError.message || 'Failed to update estimate');
      }

      const approvedIds = items.filter(i => i.approved_by_client).map(i => i.id);
      const rejectedIds = items.filter(i => !i.approved_by_client).map(i => i.id);

      if (approvedIds.length > 0) {
        const { error: approvedError } = await supabase
          .from('estimate_items')
          .update({ approved_by_client: true })
          .in('id', approvedIds);
        if (approvedError) throw new Error(approvedError.message || 'Failed to update estimate items');
      }

      if (rejectedIds.length > 0) {
        const { error: rejectedError } = await supabase
          .from('estimate_items')
          .update({ approved_by_client: false })
          .in('id', rejectedIds);
        if (rejectedError) throw new Error(rejectedError.message || 'Failed to update estimate items');
      }

      showToast({ message: 'Estimate approved successfully', type: 'success' });
      onApprove(estimateId!);
      onClose();
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to approve estimate';
      const cleanMessage = errorMessage.replace(/<[^>]*>/g, '').substring(0, 200);
      console.error('Approval error:', error);
      setError(cleanMessage);
      showToast({ message: cleanMessage, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (!estimate) {
    return (
      <Modal visible={visible} animationType="slide" transparent>
        <View style={styles.loadingContainer}>
          <View style={[styles.loadingBox, { backgroundColor: colors.surface }]}>
            {loading ? (
              <>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.text }]}>Loading estimate...</Text>
              </>
            ) : (
              <>
                <AlertCircle size={48} color={colors.error} />
                <Text style={[styles.errorTitle, { color: colors.error }]}>Failed to Load</Text>
                <Text style={[styles.errorText, { color: colors.textSecondary }]}>{error}</Text>
                <TouchableOpacity
                  style={[styles.closeButton, { overflow: 'hidden' }]}
                  onPress={onClose}
                >
                  <LinearGradient
                    colors={['#1B4D6E', '#245d82']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.closeButtonGradient}
                  >
                    <Text style={styles.closeButtonText}>Close</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    );
  }

  if (showSignature) {
    return (
      <Modal visible={visible} animationType="slide" transparent>
        <View style={styles.signatureContainer}>
          <SignatureCanvas
            onSave={handleSignature}
            onCancel={() => setShowSignature(false)}
          />
        </View>
      </Modal>
    );
  }

  const { itemsSubtotal, overallDiscount, subtotal, taxAmount, total } = calculateTotals();
  const isAlreadySigned = !!estimate.signed_at;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={[styles.modal, { backgroundColor: colors.surface }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View>
              <Text style={[styles.title, { color: colors.text }]}>Estimate Review</Text>
              <Text style={[styles.estimateNumber, { color: colors.textSecondary }]}>
                {estimate.estimate_number}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} disabled={saving}>
              <X size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {error ? (
            <View style={[styles.errorContainer, { backgroundColor: colors.errorBackground }]}>
              <Text style={[styles.errorBannerText, { color: colors.error }]}>{error}</Text>
            </View>
          ) : null}

          {isAlreadySigned && (
            <View style={[styles.approvedBanner, { backgroundColor: colors.successBackground }]}>
              <CheckCircle size={20} color={colors.success} />
              <Text style={[styles.approvedText, { color: colors.success }]}>
                This estimate has been approved and signed
              </Text>
            </View>
          )}

          <ScrollView style={styles.content}>
            <View style={[styles.infoSection, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Issue Date:</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {new Date(estimate.issue_date).toLocaleDateString()}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Valid Until:</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {new Date(estimate.valid_until).toLocaleDateString()}
                </Text>
              </View>
            </View>

            {estimate.notes && (
              <View style={[styles.notesSection, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                <Text style={[styles.notesTitle, { color: colors.text }]}>Notes from Provider</Text>
                <Text style={[styles.notesText, { color: colors.textSecondary }]}>{estimate.notes}</Text>
              </View>
            )}

            <View style={styles.itemsSection}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Line Items</Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                {items.some((item) => item.is_optional)
                  ? 'Toggle items to approve or decline optional items'
                  : 'All items included in this estimate'}
              </Text>

              {items.map((item, index) => (
                <View
                  key={item.id}
                  style={[
                    styles.itemCard,
                    { backgroundColor: colors.cardBackground, borderColor: colors.border },
                    !item.approved_by_client && styles.itemCardUnapproved,
                  ]}
                >
                  <View style={styles.itemHeader}>
                    <View style={styles.itemHeaderLeft}>
                      <Text style={[styles.itemNumber, { color: colors.textSecondary }]}>#{index + 1}</Text>
                      {item.is_optional && (
                        <View style={[styles.optionalBadge, { backgroundColor: colors.warning + '20', borderColor: colors.warning }]}>
                          <Text style={[styles.optionalText, { color: colors.warning }]}>Optional</Text>
                        </View>
                      )}
                    </View>
                    {!isAlreadySigned && (
                      <Switch
                        value={item.approved_by_client}
                        onValueChange={() => toggleItemApproval(index)}
                        trackColor={{ false: colors.border, true: colors.success }}
                        disabled={!item.is_optional}
                      />
                    )}
                  </View>

                  <Text style={[styles.itemDescription, { color: colors.text }]}>{item.description}</Text>

                  <View style={styles.itemDetails}>
                    <View style={styles.itemDetailRow}>
                      <Text style={[styles.itemDetailLabel, { color: colors.textSecondary }]}>Quantity:</Text>
                      <Text style={[styles.itemDetailValue, { color: colors.text }]}>{item.quantity}</Text>
                    </View>
                    <View style={styles.itemDetailRow}>
                      <Text style={[styles.itemDetailLabel, { color: colors.textSecondary }]}>Unit Price:</Text>
                      <Text style={[styles.itemDetailValue, { color: colors.text }]}>
                        ${item.unit_price.toFixed(2)}
                      </Text>
                    </View>
                    {(item.discount_amount > 0 || item.discount_percentage > 0) && (
                      <View style={styles.itemDetailRow}>
                        <Text style={[styles.itemDetailLabel, { color: colors.success }]}>Discount:</Text>
                        <Text style={[styles.itemDetailValue, { color: colors.success }]}>
                          {item.discount_percentage > 0
                            ? `${item.discount_percentage}%`
                            : `$${item.discount_amount.toFixed(2)}`}
                        </Text>
                      </View>
                    )}
                  </View>

                  {item.notes && (
                    <Text style={[styles.itemNotes, { color: colors.textSecondary }]}>{item.notes}</Text>
                  )}

                  <View style={[styles.itemTotal, { borderTopColor: colors.border }]}>
                    <Text style={[styles.itemTotalLabel, { color: colors.textSecondary }]}>Item Total:</Text>
                    <Text style={[styles.itemTotalValue, { color: colors.text }]}>
                      ${(() => {
                        const baseTotal = item.quantity * item.unit_price;
                        let discount = 0;
                        if (item.discount_percentage > 0) {
                          discount = baseTotal * (item.discount_percentage / 100);
                        } else if (item.discount_amount > 0) {
                          discount = item.discount_amount;
                        }
                        return Math.max(0, baseTotal - discount).toFixed(2);
                      })()}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={[styles.totalsSection, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
              <Text style={[styles.totalsTitle, { color: colors.text }]}>Estimate Total</Text>

              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Items Subtotal</Text>
                <Text style={[styles.totalValue, { color: colors.text }]}>${itemsSubtotal.toFixed(2)}</Text>
              </View>

              {overallDiscount > 0 && (
                <View style={styles.totalRow}>
                  <Text style={[styles.totalLabel, { color: colors.success }]}>Overall Discount</Text>
                  <Text style={[styles.totalValue, { color: colors.success }]}>-${overallDiscount.toFixed(2)}</Text>
                </View>
              )}

              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Subtotal</Text>
                <Text style={[styles.totalValue, { color: colors.text }]}>${subtotal.toFixed(2)}</Text>
              </View>

              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>
                  Tax ({estimate.tax_rate}%)
                </Text>
                <Text style={[styles.totalValue, { color: colors.text }]}>${taxAmount.toFixed(2)}</Text>
              </View>

              <View style={[styles.totalRow, styles.grandTotalRow, { borderTopColor: colors.border }]}>
                <Text style={[styles.grandTotalLabel, { color: colors.text }]}>Total</Text>
                <Text style={[styles.grandTotalValue, { color: colors.primary }]}>${total.toFixed(2)}</Text>
              </View>
            </View>

            {!isAlreadySigned && (
              <>
                <View style={styles.clientInfoSection}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Information</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                    value={signedByName}
                    onChangeText={setSignedByName}
                    placeholder="Your Name *"
                    placeholderTextColor={colors.textSecondary}
                  />
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                    value={signedByEmail}
                    onChangeText={setSignedByEmail}
                    placeholder="Your Email *"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  <TextInput
                    style={[styles.input, styles.textArea, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                    value={clientNotes}
                    onChangeText={setClientNotes}
                    placeholder="Additional notes or questions (optional)"
                    placeholderTextColor={colors.textSecondary}
                    multiline
                    numberOfLines={3}
                  />
                </View>

                {estimate.requires_signature && (
                  <View style={[styles.signatureSection, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                    <View style={styles.signatureHeader}>
                      <PenTool size={20} color={colors.primary} />
                      <Text style={[styles.signatureTitle, { color: colors.text }]}>Signature Required</Text>
                    </View>

                    {signatureData ? (
                      <View style={styles.signaturePreview}>
                        <Image
                          source={{ uri: signatureData }}
                          style={[styles.signatureImage, { borderColor: colors.border }]}
                          resizeMode="contain"
                        />
                        <TouchableOpacity
                          style={[styles.changeSignatureButton, { borderColor: colors.border }]}
                          onPress={() => setShowSignature(true)}
                        >
                          <Text style={[styles.changeSignatureText, { color: colors.primary }]}>Change Signature</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[styles.addSignatureButton, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}
                        onPress={() => setShowSignature(true)}
                      >
                        <PenTool size={20} color={colors.primary} />
                        <Text style={[styles.addSignatureText, { color: colors.primary }]}>Add Signature</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </>
            )}
          </ScrollView>

          {!isAlreadySigned && (
            <View style={[styles.footer, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: colors.border }]}
                onPress={onClose}
                disabled={saving}
              >
                <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.approveButton, { overflow: 'hidden' }, saving && styles.approveButtonDisabled]}
                onPress={handleApprove}
                disabled={saving}
              >
                <LinearGradient
                  colors={['#2D8B57', '#34a065']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.approveButtonGradient}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <CheckCircle size={20} color="#fff" />
                      <Text style={styles.approveButtonText}>Approve Estimate</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '95%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  estimateNumber: {
    fontSize: 14,
    marginTop: 4,
  },
  content: {
    padding: 20,
  },
  errorContainer: {
    padding: 12,
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 8,
  },
  errorBannerText: {
    fontSize: 14,
    textAlign: 'center',
  },
  approvedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 8,
  },
  approvedText: {
    fontSize: 14,
    fontWeight: '600',
  },
  infoSection: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  notesSection: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  notesTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  notesText: {
    fontSize: 14,
    lineHeight: 20,
  },
  itemsSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: 12,
  },
  itemCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  itemCardUnapproved: {
    opacity: 0.5,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  itemHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemNumber: {
    fontSize: 14,
    fontWeight: '600',
  },
  optionalBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  optionalText: {
    fontSize: 11,
    fontWeight: '600',
  },
  itemDescription: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  itemDetails: {
    gap: 6,
  },
  itemDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemDetailLabel: {
    fontSize: 14,
  },
  itemDetailValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  itemNotes: {
    fontSize: 13,
    marginTop: 8,
    fontStyle: 'italic',
  },
  itemTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    marginTop: 12,
    borderTopWidth: 1,
  },
  itemTotalLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  itemTotalValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  totalsSection: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  totalsTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 14,
  },
  totalValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  grandTotalRow: {
    borderTopWidth: 2,
    paddingTop: 12,
    marginTop: 8,
    marginBottom: 0,
  },
  grandTotalLabel: {
    fontSize: 18,
    fontWeight: '700',
  },
  grandTotalValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  clientInfoSection: {
    marginBottom: 16,
  },
  input: {
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  signatureSection: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  signatureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  signatureTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  signaturePreview: {
    gap: 12,
  },
  signatureImage: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    borderWidth: 1,
  },
  changeSignatureButton: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  changeSignatureText: {
    fontSize: 14,
    fontWeight: '600',
  },
  addSignatureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  addSignatureText: {
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  approveButton: {
    flex: 2,
    borderRadius: 8,
  },
  approveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
  },
  approveButtonDisabled: {
    opacity: 0.6,
  },
  approveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingBox: {
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    gap: 16,
    minWidth: 200,
  },
  loadingText: {
    fontSize: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  closeButton: {
    borderRadius: 8,
    marginTop: 8,
  },
  closeButtonGradient: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  signatureContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
});
