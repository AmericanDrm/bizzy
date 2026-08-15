import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TextInput,
} from 'react-native';
import { X, CircleCheck as CheckCircle, Coffee, ArrowRight, Clock } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface JobDepartureModalProps {
  visible: boolean;
  clientName: string;
  onDismiss: () => void;
  onConfirm: (reason: 'completed' | 'break' | 'next_job' | 'other', notes?: string) => void;
}

export default function JobDepartureModal({
  visible,
  clientName,
  onDismiss,
  onConfirm,
}: JobDepartureModalProps) {
  const [selectedReason, setSelectedReason] = useState<
    'completed' | 'break' | 'next_job' | 'other' | null
  >(null);
  const [notes, setNotes] = useState('');

  const reasons = [
    {
      id: 'completed' as const,
      label: 'Job Completed',
      icon: CheckCircle,
      color: '#10b981',
      description: 'Finished work at this location',
    },
    {
      id: 'break' as const,
      label: 'Taking a Break',
      icon: Coffee,
      color: '#f59e0b',
      description: 'Leaving for lunch or break',
    },
    {
      id: 'next_job' as const,
      label: 'Next Job',
      icon: ArrowRight,
      color: '#3b82f6',
      description: 'Moving to another job site',
    },
    {
      id: 'other' as const,
      label: 'Other',
      icon: Clock,
      color: '#6b7280',
      description: 'Other reason',
    },
  ];

  const handleConfirm = () => {
    if (selectedReason) {
      onConfirm(selectedReason, notes || undefined);
      setSelectedReason(null);
      setNotes('');
    }
  };

  const handleCancel = () => {
    setSelectedReason(null);
    setNotes('');
    onDismiss();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Leaving Job Site</Text>
              <Text style={styles.subtitle}>{clientName}</Text>
            </View>
            <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
              <X size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <Text style={styles.prompt}>Why are you leaving this location?</Text>

          <View style={styles.reasonsList}>
            {reasons.map((reason) => {
              const Icon = reason.icon;
              const isSelected = selectedReason === reason.id;

              return (
                <TouchableOpacity
                  key={reason.id}
                  style={[
                    styles.reasonCard,
                    isSelected && { ...styles.reasonCardSelected, borderColor: reason.color },
                  ]}
                  onPress={() => setSelectedReason(reason.id)}
                >
                  <View
                    style={[
                      styles.iconContainer,
                      { backgroundColor: `${reason.color}20` },
                    ]}
                  >
                    <Icon size={24} color={reason.color} />
                  </View>
                  <View style={styles.reasonContent}>
                    <Text style={styles.reasonLabel}>{reason.label}</Text>
                    <Text style={styles.reasonDescription}>{reason.description}</Text>
                  </View>
                  {isSelected && (
                    <View style={styles.checkmark}>
                      <CheckCircle size={20} color={reason.color} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {selectedReason && (
            <View style={styles.notesSection}>
              <Text style={styles.notesLabel}>Additional Notes (Optional)</Text>
              <TextInput
                style={styles.notesInput}
                value={notes}
                onChangeText={setNotes}
                placeholder="Add any additional details..."
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={3}
              />
            </View>
          )}

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.confirmButton,
                { overflow: 'hidden' },
                !selectedReason && styles.confirmButtonDisabled,
              ]}
              onPress={handleConfirm}
              disabled={!selectedReason}
            >
              {selectedReason && (
                <LinearGradient
                  colors={['#1B4D6E', '#245d82']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              )}
              <Text style={styles.confirmButtonText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  closeButton: {
    padding: 4,
  },
  prompt: {
    fontSize: 16,
    color: '#374151',
    padding: 20,
    paddingBottom: 12,
  },
  reasonsList: {
    padding: 20,
    paddingTop: 8,
    gap: 12,
  },
  reasonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    gap: 12,
  },
  reasonCardSelected: {
    borderWidth: 2,
    backgroundColor: '#f9fafb',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reasonContent: {
    flex: 1,
  },
  reasonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  reasonDescription: {
    fontSize: 13,
    color: '#6b7280',
  },
  checkmark: {
    marginLeft: 8,
  },
  notesSection: {
    padding: 20,
    paddingTop: 0,
  },
  notesLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  confirmButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: '#cbd5e1',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
