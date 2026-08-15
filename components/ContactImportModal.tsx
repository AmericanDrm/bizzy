import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, User, CircleCheck as CheckCircle, CircleAlert as AlertCircle } from 'lucide-react-native';
import {
  getContacts,
  importContactsAsClients,
  ImportedContact,
} from '@/lib/imports';
import { useAuth } from '@/contexts/AuthContext';

interface ContactImportModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ContactImportModal({
  visible,
  onClose,
  onSuccess,
}: ContactImportModalProps) {
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<ImportedContact[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Set<number>>(new Set());
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number; skipped: number } | null>(null);
  const { user } = useAuth();

  const handleLoadContacts = async () => {
    if (Platform.OS === 'web') {
      setError('Contact import is only available on mobile devices');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const loadedContacts = await getContacts();
      setContacts(loadedContacts);
      const allSelected = new Set(loadedContacts.map((_, i) => i));
      setSelectedContacts(allSelected);
    } catch (err: any) {
      setError(err.message || 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

  const toggleContact = (index: number) => {
    const newSelected = new Set(selectedContacts);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedContacts(newSelected);
  };

  const handleImport = async () => {
    const contactsToImport = contacts.filter((_, i) => selectedContacts.has(i));
    if (contactsToImport.length === 0) {
      setError('Please select at least one contact');
      return;
    }

    setImporting(true);
    setError('');
    try {
      const result = await importContactsAsClients(contactsToImport, user!.id);
      setImportResult(result);
      if (result.success > 0) {
        setTimeout(() => {
          onSuccess();
          handleClose();
        }, 2000);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to import contacts');
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setContacts([]);
    setSelectedContacts(new Set());
    setError('');
    setImportResult(null);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={handleClose}>
      <View style={styles.container}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.header}>
              <Text style={styles.title}>Import Contacts</Text>
              <TouchableOpacity onPress={handleClose} disabled={importing}>
                <X size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {error ? (
              <View style={styles.errorContainer}>
                <AlertCircle size={16} color="#c00" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {importResult ? (
              <View style={styles.resultContainer}>
                <CheckCircle size={48} color="#34C759" />
                <Text style={styles.resultTitle}>Import Complete</Text>
                <Text style={styles.resultText}>
                  Successfully imported {importResult.success} contact{importResult.success !== 1 ? 's' : ''}
                </Text>
                {importResult.skipped > 0 && (
                  <Text style={styles.resultSkippedText}>
                    {importResult.skipped} skipped (already exist by name or phone)
                  </Text>
                )}
                {importResult.failed > 0 && (
                  <Text style={styles.resultFailedText}>
                    {importResult.failed} contact{importResult.failed !== 1 ? 's' : ''} failed to import
                  </Text>
                )}
              </View>
            ) : contacts.length === 0 ? (
              <View style={styles.emptyState}>
                <User size={48} color="#ccc" />
                <Text style={styles.emptyTitle}>
                  {Platform.OS === 'web' ? 'Not Available on Web' : 'Load Your Contacts'}
                </Text>
                <Text style={styles.emptyText}>
                  {Platform.OS === 'web'
                    ? 'Contact import is only available on iOS and Android devices'
                    : 'Import contacts from your device to quickly add them as clients'}
                </Text>
                {Platform.OS !== 'web' && (
                  <TouchableOpacity
                    style={styles.loadButton}
                    onPress={handleLoadContacts}
                    disabled={loading}
                  >
                    <LinearGradient
                      colors={['#1B4D6E', '#245d82']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.loadButtonGradient}
                    >
                      {loading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.loadButtonText}>Load Contacts</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <>
                <View style={styles.selectAllContainer}>
                  <Text style={styles.selectAllText}>
                    {selectedContacts.size} of {contacts.length} selected
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      if (selectedContacts.size === contacts.length) {
                        setSelectedContacts(new Set());
                      } else {
                        setSelectedContacts(new Set(contacts.map((_, i) => i)));
                      }
                    }}
                  >
                    <Text style={styles.selectAllButton}>
                      {selectedContacts.size === contacts.length ? 'Deselect All' : 'Select All'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <FlatList
                  data={contacts}
                  keyExtractor={(_, index) => index.toString()}
                  renderItem={({ item, index }) => (
                    <TouchableOpacity
                      style={[
                        styles.contactItem,
                        selectedContacts.has(index) && styles.contactItemSelected,
                      ]}
                      onPress={() => toggleContact(index)}
                    >
                      <View style={styles.contactInfo}>
                        <Text style={styles.contactName}>{item.name}</Text>
                        <Text style={styles.contactDetail}>{item.phone}</Text>
                        {item.email ? (
                          <Text style={styles.contactDetail}>{item.email}</Text>
                        ) : null}
                      </View>
                      <View
                        style={[
                          styles.checkbox,
                          selectedContacts.has(index) && styles.checkboxSelected,
                        ]}
                      >
                        {selectedContacts.has(index) && <CheckCircle size={20} color="#007AFF" />}
                      </View>
                    </TouchableOpacity>
                  )}
                  contentContainerStyle={styles.listContent}
                />

                <View style={styles.footer}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={handleClose}
                    disabled={importing}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.importButton, importing && styles.importButtonDisabled]}
                    onPress={handleImport}
                    disabled={importing || selectedContacts.size === 0}
                  >
                    <LinearGradient
                      colors={['#1B4D6E', '#245d82']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.importButtonGradient}
                    >
                      {importing ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.importButtonText}>
                          Import {selectedContacts.size} Contacts
                        </Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fee',
    padding: 12,
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 8,
  },
  errorText: {
    color: '#c00',
    fontSize: 14,
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  loadButton: {
    borderRadius: 8,
    overflow: 'hidden',
    minWidth: 150,
  },
  loadButtonGradient: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    alignItems: 'center',
  },
  loadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  selectAllContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  selectAllText: {
    fontSize: 14,
    color: '#666',
  },
  selectAllButton: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  listContent: {
    padding: 12,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  contactItemSelected: {
    backgroundColor: '#f0f8ff',
    borderColor: '#007AFF',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  contactDetail: {
    fontSize: 13,
    color: '#666',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    borderColor: '#007AFF',
  },
  resultContainer: {
    alignItems: 'center',
    padding: 40,
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  resultText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  resultSkippedText: {
    fontSize: 14,
    color: '#007AFF',
    textAlign: 'center',
    marginTop: 8,
  },
  resultFailedText: {
    fontSize: 14,
    color: '#FF9500',
    textAlign: 'center',
    marginTop: 8,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  importButton: {
    flex: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  importButtonGradient: {
    padding: 16,
    alignItems: 'center',
  },
  importButtonDisabled: {
    opacity: 0.6,
  },
  importButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
