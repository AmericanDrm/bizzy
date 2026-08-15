import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { X, MapPin, CircleCheck as CheckCircle } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { LocationService } from '@/lib/locationService';

interface NearbyClient {
  id: string;
  name: string;
  address: string;
  distance: number;
  isScheduled?: boolean;
}

interface ClientSelectionModalProps {
  visible: boolean;
  nearbyClients: NearbyClient[];
  onDismiss: () => void;
  onSelect: (clientId: string) => void;
}

export default function ClientSelectionModal({
  visible,
  nearbyClients,
  onDismiss,
  onSelect,
}: ClientSelectionModalProps) {
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const handleConfirm = () => {
    if (selectedClientId) {
      onSelect(selectedClientId);
      setSelectedClientId(null);
    }
  };

  const handleCancel = () => {
    setSelectedClientId(null);
    onDismiss();
  };

  const sortedClients = [...nearbyClients].sort((a, b) => {
    if (a.isScheduled && !b.isScheduled) return -1;
    if (!a.isScheduled && b.isScheduled) return 1;
    return a.distance - b.distance;
  });

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Select Client</Text>
              <Text style={styles.subtitle}>
                Multiple clients found nearby
              </Text>
            </View>
            <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
              <X size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <View style={styles.infoBox}>
            <MapPin size={16} color="#2563eb" />
            <Text style={styles.infoText}>
              Which client is this photo for?
            </Text>
          </View>

          <ScrollView style={styles.clientsList}>
            {sortedClients.map((client) => {
              const isSelected = selectedClientId === client.id;

              return (
                <TouchableOpacity
                  key={client.id}
                  style={[
                    styles.clientCard,
                    isSelected && styles.clientCardSelected,
                  ]}
                  onPress={() => setSelectedClientId(client.id)}
                >
                  <View style={styles.clientInfo}>
                    <View style={styles.clientHeader}>
                      <Text style={styles.clientName}>{client.name}</Text>
                      {client.isScheduled && (
                        <View style={styles.scheduledBadge}>
                          <Text style={styles.scheduledText}>Scheduled</Text>
                        </View>
                      )}
                    </View>
                    {client.address && (
                      <Text style={styles.clientAddress}>{client.address}</Text>
                    )}
                    <View style={styles.distanceContainer}>
                      <MapPin size={14} color="#6b7280" />
                      <Text style={styles.distanceText}>
                        {LocationService.formatDistance(client.distance)} away
                      </Text>
                    </View>
                  </View>
                  {isSelected && (
                    <View style={styles.checkmark}>
                      <CheckCircle size={24} color="#2563eb" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.confirmButton,
                { overflow: 'hidden' },
                !selectedClientId && styles.confirmButtonDisabled,
              ]}
              onPress={handleConfirm}
              disabled={!selectedClientId}
            >
              <LinearGradient
                colors={['#1B4D6E', '#245d82']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.confirmButtonGradient}
              >
                <Text style={styles.confirmButtonText}>Confirm</Text>
              </LinearGradient>
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
    maxHeight: '80%',
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
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: 20,
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#1e40af',
    flex: 1,
  },
  clientsList: {
    maxHeight: 400,
    paddingHorizontal: 20,
  },
  clientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    marginBottom: 12,
  },
  clientCardSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  clientInfo: {
    flex: 1,
  },
  clientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  clientName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  scheduledBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  scheduledText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  clientAddress: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 6,
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  distanceText: {
    fontSize: 13,
    color: '#6b7280',
  },
  checkmark: {
    marginLeft: 12,
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
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonGradient: {
    padding: 16,
    alignItems: 'center',
    width: '100%',
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
