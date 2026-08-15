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

interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface InvoicePreview {
  invoice_number: string;
  issue_date: string;
  due_date: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  client_address: string;
  items: InvoiceItem[];
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  notes: string;
  business_name: string;
  business_address: string;
  business_phone: string;
  business_email: string;
  logo_url?: string;
  late_fee_amount?: number;
  cc_fee_percent?: number;
  cc_fee_amount?: number;
  payment_terms?: string;
  memo?: string;
}

interface InvoicePreviewModalProps {
  visible: boolean;
  invoice: InvoicePreview | null;
  onClose: () => void;
  onSend: () => void;
  onDownload?: () => void;
}

export default function InvoicePreviewModal({
  visible,
  invoice,
  onClose,
  onSend,
  onDownload,
}: InvoicePreviewModalProps) {
  const { colors } = useTheme();

  if (!invoice) return null;

  const dynamicStyles = getDynamicStyles(colors);

  const getPaymentTermsLabel = (terms: string | undefined): string => {
    switch (terms) {
      case 'due_on_receipt':
        return 'Due on Receipt';
      case 'net_15':
        return 'Net 15 Days';
      case 'net_30':
        return 'Net 30 Days';
      case 'net_60':
        return 'Net 60 Days';
      case 'net_90':
        return 'Net 90 Days';
      default:
        return 'Net 30 Days';
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={dynamicStyles.container}>
        <View style={dynamicStyles.header}>
          <Text style={dynamicStyles.headerTitle}>Invoice Preview</Text>
          <TouchableOpacity onPress={onClose} style={dynamicStyles.closeButton}>
            <X size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={dynamicStyles.content}>
          <View style={dynamicStyles.invoiceContainer}>
            <View style={dynamicStyles.headerSection}>
              {invoice.logo_url ? (
                <Image source={{ uri: invoice.logo_url }} style={styles.logo} />
              ) : null}
              <Text style={dynamicStyles.invoiceTitle}>INVOICE</Text>
              <Text style={dynamicStyles.invoiceNumber}>{invoice.memo || `#${invoice.invoice_number}`}</Text>
            </View>

            <View style={dynamicStyles.businessSection}>
              <Text style={dynamicStyles.sectionTitle}>From:</Text>
              <Text style={dynamicStyles.businessName}>{invoice.business_name}</Text>
              <Text style={dynamicStyles.text}>{invoice.business_address}</Text>
              <Text style={dynamicStyles.text}>{invoice.business_phone}</Text>
              <Text style={dynamicStyles.text}>{invoice.business_email}</Text>
            </View>

            <View style={dynamicStyles.clientSection}>
              <Text style={dynamicStyles.sectionTitle}>Bill To:</Text>
              <Text style={dynamicStyles.clientName}>{invoice.client_name}</Text>
              <Text style={dynamicStyles.text}>{invoice.client_address}</Text>
              <Text style={dynamicStyles.text}>{invoice.client_phone}</Text>
              <Text style={dynamicStyles.text}>{invoice.client_email}</Text>
            </View>

            <View style={dynamicStyles.dateSection}>
              <View style={dynamicStyles.dateRow}>
                <Text style={dynamicStyles.dateLabel}>Issue Date:</Text>
                <Text style={dynamicStyles.dateValue}>{invoice.issue_date}</Text>
              </View>
              <View style={dynamicStyles.dateRow}>
                <Text style={dynamicStyles.dateLabel}>Due Date:</Text>
                <Text style={dynamicStyles.dateValue}>{invoice.due_date}</Text>
              </View>
              <View style={dynamicStyles.dateRow}>
                <Text style={dynamicStyles.dateLabel}>Payment Terms:</Text>
                <Text style={dynamicStyles.dateValue}>
                  {getPaymentTermsLabel(invoice.payment_terms)}
                </Text>
              </View>
            </View>

            <View style={dynamicStyles.itemsSection}>
              <View style={dynamicStyles.itemsHeader}>
                <Text style={[dynamicStyles.itemsHeaderText, { flex: 2 }]}>Description</Text>
                <Text style={[dynamicStyles.itemsHeaderText, { flex: 1, textAlign: 'center' }]}>
                  Qty
                </Text>
                <Text style={[dynamicStyles.itemsHeaderText, { flex: 1, textAlign: 'right' }]}>
                  Rate
                </Text>
                <Text style={[dynamicStyles.itemsHeaderText, { flex: 1, textAlign: 'right' }]}>
                  Amount
                </Text>
              </View>

              {invoice.items.map((item, index) => (
                <View key={index} style={dynamicStyles.itemRow}>
                  <Text style={[dynamicStyles.itemText, { flex: 2 }]}>{item.description}</Text>
                  <Text style={[dynamicStyles.itemText, { flex: 1, textAlign: 'center' }]}>
                    {item.quantity}
                  </Text>
                  <Text style={[dynamicStyles.itemText, { flex: 1, textAlign: 'right' }]}>
                    {formatCurrency(item.unit_price)}
                  </Text>
                  <Text style={[dynamicStyles.itemText, { flex: 1, textAlign: 'right' }]}>
                    {formatCurrency(item.total)}
                  </Text>
                </View>
              ))}
            </View>

            <View style={dynamicStyles.totalsSection}>
              <View style={dynamicStyles.totalRow}>
                <Text style={dynamicStyles.totalLabel}>Subtotal:</Text>
                <Text style={dynamicStyles.totalValue}>{formatCurrency(invoice.subtotal)}</Text>
              </View>

              {invoice.tax_rate > 0 && (
                <View style={dynamicStyles.totalRow}>
                  <Text style={dynamicStyles.totalLabel}>Tax ({invoice.tax_rate}%):</Text>
                  <Text style={dynamicStyles.totalValue}>{formatCurrency(invoice.tax_amount)}</Text>
                </View>
              )}

              {invoice.late_fee_amount && invoice.late_fee_amount > 0 && (
                <View style={dynamicStyles.totalRow}>
                  <Text style={[dynamicStyles.totalLabel, { color: '#1B4D6E' }]}>Late Fee:</Text>
                  <Text style={[dynamicStyles.totalValue, { color: '#1B4D6E' }]}>
                    {formatCurrency(invoice.late_fee_amount)}
                  </Text>
                </View>
              )}

              {invoice.cc_fee_amount && invoice.cc_fee_amount > 0 && (
                <View style={dynamicStyles.totalRow}>
                  <Text style={dynamicStyles.totalLabel}>CC Processing Fee ({invoice.cc_fee_percent}%):</Text>
                  <Text style={dynamicStyles.totalValue}>
                    {formatCurrency(invoice.cc_fee_amount)}
                  </Text>
                </View>
              )}

              <View style={dynamicStyles.totalRowFinal}>
                <Text style={dynamicStyles.totalLabelFinal}>Total:</Text>
                <Text style={dynamicStyles.totalValueFinal}>{formatCurrency(invoice.total)}</Text>
              </View>
            </View>

            {invoice.notes ? (
              <View style={dynamicStyles.notesSection}>
                <Text style={dynamicStyles.notesTitle}>Notes:</Text>
                <Text style={dynamicStyles.notesText}>{invoice.notes}</Text>
              </View>
            ) : null}
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
            <GradientButton title="Send Invoice" onPress={onSend} variant="primary" />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const getDynamicStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    closeButton: {
      padding: 4,
    },
    content: {
      flex: 1,
    },
    invoiceContainer: {
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
    headerSection: {
      alignItems: 'center',
      marginBottom: 24,
    },
    invoiceTitle: {
      fontSize: 28,
      fontWeight: 'bold',
      color: '#333',
      marginTop: 12,
    },
    invoiceNumber: {
      fontSize: 16,
      color: '#666',
      marginTop: 4,
    },
    businessSection: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: '600',
      color: '#666',
      marginBottom: 8,
      textTransform: 'uppercase',
    },
    businessName: {
      fontSize: 16,
      fontWeight: '600',
      color: '#333',
      marginBottom: 4,
    },
    text: {
      fontSize: 14,
      color: '#666',
      marginBottom: 2,
    },
    clientSection: {
      marginBottom: 24,
    },
    clientName: {
      fontSize: 16,
      fontWeight: '600',
      color: '#333',
      marginBottom: 4,
    },
    dateSection: {
      marginBottom: 24,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: '#e0e0e0',
    },
    dateRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    dateLabel: {
      fontSize: 14,
      color: '#666',
    },
    dateValue: {
      fontSize: 14,
      fontWeight: '600',
      color: '#333',
    },
    itemsSection: {
      marginBottom: 24,
    },
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
    },
    itemText: {
      fontSize: 14,
      color: '#333',
    },
    totalsSection: {
      alignItems: 'flex-end',
      marginBottom: 24,
    },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      minWidth: 250,
      marginBottom: 8,
    },
    totalLabel: {
      fontSize: 14,
      color: '#666',
    },
    totalValue: {
      fontSize: 14,
      fontWeight: '600',
      color: '#333',
    },
    totalRowFinal: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      minWidth: 250,
      paddingTop: 12,
      borderTopWidth: 2,
      borderTopColor: '#333',
      marginTop: 8,
    },
    totalLabelFinal: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#333',
    },
    totalValueFinal: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#333',
    },
    notesSection: {
      marginTop: 24,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: '#e0e0e0',
    },
    notesTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: '#333',
      marginBottom: 8,
    },
    notesText: {
      fontSize: 14,
      color: '#666',
      lineHeight: 20,
    },
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
    secondaryButtonText: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: '600',
    },
  });

const styles = StyleSheet.create({
  logo: {
    width: 120,
    height: 60,
    resizeMode: 'contain',
  },
});
