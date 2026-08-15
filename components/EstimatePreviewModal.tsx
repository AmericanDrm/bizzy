import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { formatCurrency } from '@/lib/utilities';
import GradientButton from './GradientButton';

interface EstimateItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  is_optional?: boolean;
  discount_amount?: number;
  discount_percentage?: number;
}

interface EstimatePreview {
  estimate_number: string;
  issue_date: string;
  valid_until: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  client_address: string;
  items: EstimateItem[];
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount_amount?: number;
  discount_percentage?: number;
  total: number;
  notes: string;
  business_name: string;
  business_address: string;
  business_phone: string;
  business_email: string;
  logo_url?: string;
}

interface EstimatePreviewModalProps {
  visible: boolean;
  estimate: EstimatePreview | null;
  onClose: () => void;
  onSend: () => void;
  onDownload?: () => void;
}

export default function EstimatePreviewModal({
  visible,
  estimate,
  onClose,
  onSend,
  onDownload,
}: EstimatePreviewModalProps) {
  const { colors } = useTheme();

  if (!estimate) return null;

  const dynamicStyles = getDynamicStyles(colors);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={dynamicStyles.container}>
        <View style={dynamicStyles.header}>
          <Text style={dynamicStyles.headerTitle}>Estimate Preview</Text>
          <TouchableOpacity onPress={onClose} style={dynamicStyles.closeButton}>
            <X size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={dynamicStyles.content}>
          <View style={dynamicStyles.docContainer}>
            <View style={dynamicStyles.headerSection}>
              {estimate.logo_url ? (
                <Image source={{ uri: estimate.logo_url }} style={styles.logo} />
              ) : null}
              <Text style={dynamicStyles.docTitle}>ESTIMATE</Text>
              <Text style={dynamicStyles.docNumber}>#{estimate.estimate_number}</Text>
            </View>

            <View style={dynamicStyles.businessSection}>
              <Text style={dynamicStyles.sectionTitle}>From:</Text>
              <Text style={dynamicStyles.businessName}>{estimate.business_name}</Text>
              {estimate.business_address ? <Text style={dynamicStyles.text}>{estimate.business_address}</Text> : null}
              {estimate.business_phone ? <Text style={dynamicStyles.text}>{estimate.business_phone}</Text> : null}
              {estimate.business_email ? <Text style={dynamicStyles.text}>{estimate.business_email}</Text> : null}
            </View>

            <View style={dynamicStyles.clientSection}>
              <Text style={dynamicStyles.sectionTitle}>Prepared For:</Text>
              <Text style={dynamicStyles.clientName}>{estimate.client_name}</Text>
              {estimate.client_address ? <Text style={dynamicStyles.text}>{estimate.client_address}</Text> : null}
              {estimate.client_phone ? <Text style={dynamicStyles.text}>{estimate.client_phone}</Text> : null}
              {estimate.client_email ? <Text style={dynamicStyles.text}>{estimate.client_email}</Text> : null}
            </View>

            <View style={dynamicStyles.dateSection}>
              <View style={dynamicStyles.dateRow}>
                <Text style={dynamicStyles.dateLabel}>Issue Date:</Text>
                <Text style={dynamicStyles.dateValue}>{estimate.issue_date}</Text>
              </View>
              <View style={dynamicStyles.dateRow}>
                <Text style={dynamicStyles.dateLabel}>Valid Until:</Text>
                <Text style={dynamicStyles.dateValue}>{estimate.valid_until}</Text>
              </View>
            </View>

            <View style={dynamicStyles.itemsSection}>
              <View style={dynamicStyles.itemsHeader}>
                <Text style={[dynamicStyles.itemsHeaderText, { flex: 2 }]}>Service</Text>
                <Text style={[dynamicStyles.itemsHeaderText, { flex: 1, textAlign: 'center' }]}>Qty</Text>
                <Text style={[dynamicStyles.itemsHeaderText, { flex: 1, textAlign: 'right' }]}>Rate</Text>
                <Text style={[dynamicStyles.itemsHeaderText, { flex: 1, textAlign: 'right' }]}>Amount</Text>
              </View>

              {estimate.items.map((item, index) => (
                <View key={index} style={dynamicStyles.itemRow}>
                  <View style={{ flex: 2 }}>
                    <Text style={dynamicStyles.itemText}>
                      {item.description}
                      {item.is_optional ? ' (Optional)' : ''}
                    </Text>
                    {(item.discount_amount ?? 0) > 0 && (
                      <Text style={dynamicStyles.discountText}>Discount: -{formatCurrency(item.discount_amount!)}</Text>
                    )}
                    {(item.discount_percentage ?? 0) > 0 && (
                      <Text style={dynamicStyles.discountText}>Discount: -{item.discount_percentage}%</Text>
                    )}
                  </View>
                  <Text style={[dynamicStyles.itemText, { flex: 1, textAlign: 'center' }]}>{item.quantity}</Text>
                  <Text style={[dynamicStyles.itemText, { flex: 1, textAlign: 'right' }]}>{formatCurrency(item.unit_price)}</Text>
                  <Text style={[dynamicStyles.itemText, { flex: 1, textAlign: 'right' }]}>{formatCurrency(item.total)}</Text>
                </View>
              ))}
            </View>

            <View style={dynamicStyles.totalsSection}>
              <View style={dynamicStyles.totalRow}>
                <Text style={dynamicStyles.totalLabel}>Subtotal:</Text>
                <Text style={dynamicStyles.totalValue}>{formatCurrency(estimate.subtotal)}</Text>
              </View>

              {(estimate.discount_amount ?? 0) > 0 && (
                <View style={dynamicStyles.totalRow}>
                  <Text style={[dynamicStyles.totalLabel, { color: '#34c759' }]}>Discount:</Text>
                  <Text style={[dynamicStyles.totalValue, { color: '#34c759' }]}>-{formatCurrency(estimate.discount_amount!)}</Text>
                </View>
              )}

              {(estimate.discount_percentage ?? 0) > 0 && (
                <View style={dynamicStyles.totalRow}>
                  <Text style={[dynamicStyles.totalLabel, { color: '#34c759' }]}>Discount ({estimate.discount_percentage}%):</Text>
                  <Text style={[dynamicStyles.totalValue, { color: '#34c759' }]}>
                    -{formatCurrency((estimate.subtotal * (estimate.discount_percentage ?? 0)) / 100)}
                  </Text>
                </View>
              )}

              {estimate.tax_rate > 0 && (
                <View style={dynamicStyles.totalRow}>
                  <Text style={dynamicStyles.totalLabel}>Tax ({estimate.tax_rate}%):</Text>
                  <Text style={dynamicStyles.totalValue}>{formatCurrency(estimate.tax_amount)}</Text>
                </View>
              )}

              <View style={dynamicStyles.totalRowFinal}>
                <Text style={dynamicStyles.totalLabelFinal}>Total:</Text>
                <Text style={dynamicStyles.totalValueFinal}>{formatCurrency(estimate.total)}</Text>
              </View>
            </View>

            {estimate.notes ? (
              <View style={dynamicStyles.notesSection}>
                <Text style={dynamicStyles.notesTitle}>Notes:</Text>
                <Text style={dynamicStyles.notesText}>{estimate.notes}</Text>
              </View>
            ) : null}

            <View style={dynamicStyles.validBadge}>
              <Text style={dynamicStyles.validBadgeText}>
                Valid until {estimate.valid_until}
              </Text>
            </View>
          </View>
        </ScrollView>

        <View style={dynamicStyles.footer}>
          {onDownload && (
            <TouchableOpacity
              onPress={onDownload}
              style={[dynamicStyles.secondaryButton, { marginRight: 12 }]}
            >
              <Text style={dynamicStyles.secondaryButtonText}>Download PDF</Text>
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <GradientButton title="Send Estimate" onPress={onSend} variant="primary" />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const getDynamicStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
    closeButton: { padding: 4 },
    content: { flex: 1 },
    docContainer: {
      backgroundColor: '#fff',
      margin: 16,
      padding: 24,
      borderRadius: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 3,
    },
    headerSection: { alignItems: 'center', marginBottom: 24 },
    docTitle: { fontSize: 28, fontWeight: 'bold', color: '#333', marginTop: 12 },
    docNumber: { fontSize: 16, color: '#666', marginTop: 4 },
    businessSection: { marginBottom: 24 },
    sectionTitle: {
      fontSize: 12,
      fontWeight: '600',
      color: '#666',
      marginBottom: 8,
      textTransform: 'uppercase',
    },
    businessName: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 4 },
    text: { fontSize: 14, color: '#666', marginBottom: 2 },
    clientSection: { marginBottom: 24 },
    clientName: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 4 },
    dateSection: {
      marginBottom: 24,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: '#e0e0e0',
    },
    dateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    dateLabel: { fontSize: 14, color: '#666' },
    dateValue: { fontSize: 14, fontWeight: '600', color: '#333' },
    itemsSection: { marginBottom: 24 },
    itemsHeader: {
      flexDirection: 'row',
      paddingVertical: 12,
      borderBottomWidth: 2,
      borderBottomColor: '#333',
      marginBottom: 8,
    },
    itemsHeaderText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#333',
      textTransform: 'uppercase',
    },
    itemRow: {
      flexDirection: 'row',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: '#e0e0e0',
      alignItems: 'center',
    },
    itemText: { fontSize: 14, color: '#333' },
    discountText: { fontSize: 12, color: '#34c759', marginTop: 2 },
    totalsSection: { alignItems: 'flex-end', marginBottom: 24 },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      minWidth: 250,
      marginBottom: 8,
    },
    totalLabel: { fontSize: 14, color: '#666' },
    totalValue: { fontSize: 14, fontWeight: '600', color: '#333' },
    totalRowFinal: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      minWidth: 250,
      paddingTop: 12,
      borderTopWidth: 2,
      borderTopColor: '#333',
      marginTop: 8,
    },
    totalLabelFinal: { fontSize: 18, fontWeight: 'bold', color: '#333' },
    totalValueFinal: { fontSize: 18, fontWeight: 'bold', color: '#333' },
    notesSection: {
      marginTop: 24,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: '#e0e0e0',
    },
    notesTitle: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 },
    notesText: { fontSize: 14, color: '#666', lineHeight: 20 },
    validBadge: {
      backgroundColor: '#fff8e8',
      padding: 12,
      borderRadius: 10,
      marginTop: 16,
      alignItems: 'center',
    },
    validBadgeText: { fontSize: 13, color: '#a68307', fontWeight: '500' },
    footer: {
      flexDirection: 'row',
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.card,
    },
    secondaryButton: {
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    secondaryButtonText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  });

const styles = StyleSheet.create({
  logo: { width: 120, height: 60, resizeMode: 'contain' },
});
