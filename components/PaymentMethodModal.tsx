import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  X,
  CreditCard,
  Banknote,
  Building2,
  Landmark,
  Smartphone,
  CircleCheck as CheckCircle,
  Receipt,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface PaymentMethod {
  id: string;
  label: string;
  icon: typeof CreditCard;
}

const ALL_METHODS: PaymentMethod[] = [
  { id: 'cash', label: 'Cash', icon: Banknote },
  { id: 'check', label: 'Check', icon: Receipt },
  { id: 'card', label: 'Credit/Debit Card', icon: CreditCard },
  { id: 'venmo', label: 'Venmo', icon: Smartphone },
  { id: 'cashapp', label: 'Cash App', icon: Smartphone },
  { id: 'zelle', label: 'Zelle', icon: Landmark },
  { id: 'bank_transfer', label: 'Bank Transfer', icon: Building2 },
  { id: 'other', label: 'Other', icon: Banknote },
];

interface PaymentMethodModalProps {
  visible: boolean;
  onClose: () => void;
  amount: number;
  onPaymentComplete: (method: string) => void;
  acceptedMethods?: string[];
}

export default function PaymentMethodModal({
  visible,
  onClose,
  amount,
  onPaymentComplete,
  acceptedMethods,
}: PaymentMethodModalProps) {
  const { colors } = useTheme();
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setSelectedMethod(null);
    }
  }, [visible]);

  const availableMethods = acceptedMethods && acceptedMethods.length > 0
    ? ALL_METHODS.filter(m => acceptedMethods.includes(m.id))
    : ALL_METHODS;

  const handleConfirm = () => {
    if (!selectedMethod) return;
    const method = ALL_METHODS.find(m => m.id === selectedMethod);
    onPaymentComplete(method?.id || selectedMethod);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Record Payment</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <View style={[styles.amountContainer, { backgroundColor: colors.surface }]}>
              <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>Amount Received</Text>
              <Text style={[styles.amountValue, { color: colors.success }]}>${amount.toFixed(2)}</Text>
            </View>

            <Text style={[styles.sectionTitle, { color: colors.text }]}>How did the client pay?</Text>

            {availableMethods.map((method) => {
              const Icon = method.icon;
              const isSelected = selectedMethod === method.id;
              return (
                <TouchableOpacity
                  key={method.id}
                  style={[
                    styles.methodButton,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    isSelected && { borderColor: colors.primary, borderWidth: 2 },
                  ]}
                  onPress={() => setSelectedMethod(method.id)}
                >
                  <Icon size={22} color={isSelected ? colors.primary : colors.textSecondary} />
                  <Text style={[styles.methodText, { color: colors.text }]}>{method.label}</Text>
                  {isSelected && <CheckCircle size={20} color={colors.primary} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.cancelButton, { backgroundColor: colors.surface }]}
              onPress={onClose}
            >
              <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.confirmButton,
                !selectedMethod && styles.disabledButton,
              ]}
              onPress={handleConfirm}
              disabled={!selectedMethod}
            >
              <LinearGradient
                colors={['#1B4D6E', '#245d82']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.confirmButtonGradient}
              >
                <Text style={styles.confirmButtonText}>Confirm Payment</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '80%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    ...Platform.select({
      web: { maxWidth: 600, alignSelf: 'center', width: '100%' },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalBody: {
    padding: 20,
  },
  amountContainer: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  methodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    gap: 12,
  },
  methodText: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 12,
  },
  confirmButtonGradient: {
    padding: 16,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
});
