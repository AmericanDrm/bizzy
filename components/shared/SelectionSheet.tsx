import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import { X, Search, CircleCheck as CheckCircle, Plus } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

export interface SelectionItem {
  id: string;
  label: string;
  sublabel?: string;
  badge?: string;
}

interface SelectionSheetProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  items: SelectionItem[];
  selectedId?: string | null;
  onDismiss: () => void;
  onSelect: (id: string) => void;
  searchPlaceholder?: string;
  searchable?: boolean;
  showAddNew?: boolean;
  addNewLabel?: string;
  onAddNew?: () => void;
  infoText?: string;
  confirmOnSelect?: boolean;
}

export default function SelectionSheet({
  visible,
  title,
  subtitle,
  items,
  selectedId,
  onDismiss,
  onSelect,
  searchPlaceholder = 'Search...',
  searchable = true,
  showAddNew = false,
  addNewLabel = 'Add New',
  onAddNew,
  infoText,
  confirmOnSelect = false,
}: SelectionSheetProps) {
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setInternalSelectedId(selectedId ?? null);
      setSearchQuery('');
      if (searchable) {
        setTimeout(() => searchRef.current?.focus(), 100);
      }
    }
  }, [visible, selectedId, searchable]);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    return items.filter(item =>
      item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.sublabel?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
    );
  }, [items, searchQuery]);

  const handleSelect = (id: string) => {
    if (confirmOnSelect) {
      setInternalSelectedId(id);
    } else {
      onSelect(id);
      onDismiss();
    }
  };

  const handleConfirm = () => {
    if (internalSelectedId) {
      onSelect(internalSelectedId);
    }
    onDismiss();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onDismiss}>
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          <View style={styles.container}>
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>{title}</Text>
                {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
              </View>
              <TouchableOpacity onPress={onDismiss} style={styles.closeButton}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {infoText ? (
              <View style={styles.infoBox}>
                <Text style={styles.infoText}>{infoText}</Text>
              </View>
            ) : null}

            {searchable ? (
              <View style={styles.searchContainer}>
                <Search size={18} color="#6b7280" />
                <TextInput
                  ref={searchRef}
                  style={styles.searchInput}
                  placeholder={searchPlaceholder}
                  placeholderTextColor="#9ca3af"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  {...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {})}
                />
              </View>
            ) : null}

            <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
              {filteredItems.map(item => {
                const isSelected = confirmOnSelect
                  ? internalSelectedId === item.id
                  : selectedId === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.card, isSelected && styles.cardSelected]}
                    onPress={() => handleSelect(item.id)}
                  >
                    <View style={styles.cardInfo}>
                      <Text style={styles.cardLabel}>{item.label}</Text>
                      {item.sublabel ? (
                        <Text style={styles.cardSublabel}>{item.sublabel}</Text>
                      ) : null}
                    </View>
                    {item.badge ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{item.badge}</Text>
                      </View>
                    ) : null}
                    {isSelected ? (
                      <View style={styles.checkmark}>
                        <CheckCircle size={24} color="#2563eb" />
                      </View>
                    ) : null}
                  </TouchableOpacity>
                );
              })}

              {filteredItems.length === 0 && !showAddNew && (
                <Text style={styles.emptyText}>No results found</Text>
              )}

              {showAddNew && (
                <TouchableOpacity
                  style={[styles.card, styles.addNewCard]}
                  onPress={() => {
                    onAddNew?.();
                    onDismiss();
                  }}
                >
                  <Plus size={20} color="#2563eb" />
                  <Text style={styles.addNewText}>{addNewLabel}</Text>
                </TouchableOpacity>
              )}
            </ScrollView>

            {confirmOnSelect ? (
              <View style={styles.footer}>
                <TouchableOpacity style={styles.cancelButton} onPress={onDismiss}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmButton, { overflow: 'hidden' }, !internalSelectedId && styles.confirmButtonDisabled]}
                  onPress={handleConfirm}
                  disabled={!internalSelectedId}
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
            ) : null}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
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
    margin: 20,
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#1e40af',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    padding: 0,
    margin: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  list: {
    maxHeight: 400,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    marginBottom: 12,
  },
  cardSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  cardInfo: {
    flex: 1,
  },
  cardLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  cardSublabel: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    marginLeft: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2563eb',
  },
  checkmark: {
    marginLeft: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    paddingVertical: 20,
  },
  addNewCard: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
    gap: 8,
  },
  addNewText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563eb',
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
