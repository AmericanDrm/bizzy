import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { X, MapPin, CircleCheck as CheckCircle, Search, Pen, ListChecks, Images, ChevronDown, ChevronUp, FolderOpen, FolderPlus } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/lib/supabase';
import * as FileSystem from 'expo-file-system';

interface Client {
  id: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
}

interface BulkItem {
  uri: string;
  selected: boolean;
  annotationData?: string;
}

interface ChecklistItem {
  id: string;
  checklist_id: string;
  description: string;
  checklist_title?: string;
  job_title?: string;
}

interface ClientPhotoSelectorModalProps {
  visible: boolean;
  photoUri: string;
  location: { latitude: number; longitude: number } | null;
  suggestedClient: Client | null;
  annotationData?: string;
  bulkItems?: BulkItem[];
  onAnnotate?: () => void;
  onClose: () => void;
  onSave: () => void;
}

export default function ClientPhotoSelectorModal({
  visible,
  photoUri,
  location,
  suggestedClient,
  annotationData,
  bulkItems = [],
  onAnnotate,
  onClose,
  onSave,
}: ClientPhotoSelectorModalProps) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { currentOrganization } = useOrganization();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [caption, setCaption] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savingProgress, setSavingProgress] = useState<{ current: number; total: number } | null>(null);

  const [localAnnotationData, setLocalAnnotationData] = useState<string | undefined>(annotationData);

  const [showChecklistPicker, setShowChecklistPicker] = useState(false);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [loadingChecklists, setLoadingChecklists] = useState(false);
  const [selectedChecklistItemId, setSelectedChecklistItemId] = useState<string | null>(null);
  const [checklistSearch, setChecklistSearch] = useState('');

  const [folderName, setFolderName] = useState('');
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [existingFolders, setExistingFolders] = useState<string[]>([]);

  const FOLDER_SUGGESTIONS = ['Before', 'After', 'Damage', 'Completion', 'Progress'];

  const isBulk = bulkItems.length > 1;
  const selectedBulkCount = bulkItems.filter((b) => b.selected).length;

  useEffect(() => {
    if (visible) {
      fetchClients();
      if (suggestedClient) setSelectedClient(suggestedClient);
    }
  }, [visible, suggestedClient]);

  useEffect(() => {
    if (selectedClient) {
      supabase
        .from('client_photos')
        .select('folder_name')
        .eq('client_id', selectedClient.id)
        .not('folder_name', 'is', null)
        .then(({ data }) => {
          if (data) {
            const names = Array.from(new Set(data.map((r: any) => r.folder_name).filter(Boolean))) as string[];
            setExistingFolders(names.sort());
          }
        });
    }
  }, [selectedClient]);

  useEffect(() => {
    setLocalAnnotationData(annotationData);
  }, [annotationData]);

  const fetchClients = async () => {
    if (!currentOrganization) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, address, latitude, longitude')
        .eq('organization_id', currentOrganization.id)
        .order('name', { ascending: true });
      if (error) throw error;
      setClients(data || []);
    } catch (error: any) {
      showToast({ message: error.message || 'Failed to load clients', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const fetchChecklistItems = async () => {
    if (!currentOrganization) return;
    setLoadingChecklists(true);
    try {
      const { data: checklists, error: clErr } = await supabase
        .from('job_checklists')
        .select(`
          id,
          title,
          job_id,
          schedule_events!inner(title)
        `)
        .eq('organization_id', currentOrganization.id)
        .limit(20);

      if (clErr) {
        const { data: simpleChecklists } = await supabase
          .from('job_checklists')
          .select('id, title, job_id')
          .eq('organization_id', currentOrganization.id)
          .limit(20);

        if (!simpleChecklists) { setLoadingChecklists(false); return; }

        const allItems: ChecklistItem[] = [];
        for (const cl of simpleChecklists) {
          const { data: items } = await supabase
            .from('job_checklist_items')
            .select('id, checklist_id, description')
            .eq('checklist_id', cl.id)
            .limit(30);
          (items || []).forEach((item: any) => {
            allItems.push({
              id: item.id,
              checklist_id: item.checklist_id,
              description: item.description,
              checklist_title: cl.title,
            });
          });
        }
        setChecklistItems(allItems);
        setLoadingChecklists(false);
        return;
      }

      const allItems: ChecklistItem[] = [];
      for (const cl of (checklists || [])) {
        const { data: items } = await supabase
          .from('job_checklist_items')
          .select('id, checklist_id, description')
          .eq('checklist_id', cl.id)
          .limit(30);
        (items || []).forEach((item: any) => {
          allItems.push({
            id: item.id,
            checklist_id: item.checklist_id,
            description: item.description,
            checklist_title: cl.title,
          });
        });
      }
      setChecklistItems(allItems);
    } catch {
    } finally {
      setLoadingChecklists(false);
    }
  };

  const uploadPhoto = async (uri: string): Promise<string> => {
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
    const filePath = `${currentOrganization?.id}/photos/${fileName}`;

    let uploadError: any;

    if (Platform.OS === 'web') {
      const response = await fetch(uri);
      const blob = await response.blob();
      const { error } = await supabase.storage
        .from('client-photos')
        .upload(filePath, blob, { contentType: 'image/jpeg', upsert: false });
      uploadError = error;
    } else {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) throw new Error('File does not exist');
      const formData = new FormData();
      formData.append('file', { uri, name: fileName, type: 'image/jpeg' } as any);
      const { error } = await supabase.storage
        .from('client-photos')
        .upload(filePath, formData, { contentType: 'image/jpeg', upsert: false });
      uploadError = error;
    }

    if (uploadError) throw uploadError;
    const { data: urlData } = supabase.storage.from('client-photos').getPublicUrl(filePath);
    return urlData.publicUrl;
  };

  const insertPhotoRecord = async (
    uri: string,
    photoAnnotationData?: string,
    checklistItemId?: string | null
  ): Promise<string> => {
    const photoUrl = await uploadPhoto(uri);
    const { data: record, error } = await supabase
      .from('client_photos')
      .insert({
        organization_id: currentOrganization!.id,
        user_id: user?.id,
        client_id: selectedClient!.id,
        photo_url: photoUrl,
        caption: caption.trim(),
        latitude: location?.latitude,
        longitude: location?.longitude,
        captured_at: new Date().toISOString(),
        auto_associated: suggestedClient?.id === selectedClient!.id,
        annotation_data: photoAnnotationData || null,
        folder_name: folderName.trim() || null,
        distance_from_client:
          location && selectedClient?.latitude && selectedClient?.longitude
            ? calcDist(location.latitude, location.longitude, selectedClient.latitude, selectedClient.longitude)
            : null,
      })
      .select('id')
      .single();
    if (error) throw error;

    if (checklistItemId && record) {
      await supabase.from('checklist_item_photos').insert({
        organization_id: currentOrganization!.id,
        checklist_item_id: checklistItemId,
        photo_id: record.id,
        added_by: user!.id,
      });
    }
    return record.id;
  };

  const handleSave = async () => {
    if (!selectedClient) {
      showToast({ message: 'Please select a client', type: 'error' });
      return;
    }
    if (!currentOrganization) return;
    setSaving(true);

    try {
      if (isBulk) {
        const selected = bulkItems.filter((b) => b.selected);
        setSavingProgress({ current: 0, total: selected.length });
        for (let i = 0; i < selected.length; i++) {
          await insertPhotoRecord(selected[i].uri, selected[i].annotationData, selectedChecklistItemId);
          setSavingProgress({ current: i + 1, total: selected.length });
        }
        showToast({ message: `${selected.length} photos saved`, type: 'success' });
      } else {
        await insertPhotoRecord(photoUri, localAnnotationData, selectedChecklistItemId);
        showToast({ message: 'Photo saved successfully', type: 'success' });
      }
      onSave();
      handleClose();
    } catch (error: any) {
      showToast({ message: error.message || 'Failed to save photo', type: 'error' });
    } finally {
      setSaving(false);
      setSavingProgress(null);
    }
  };

  const calcDist = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180, φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180, Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const handleClose = () => {
    setSelectedClient(null);
    setCaption('');
    setSearchQuery('');
    setSelectedChecklistItemId(null);
    setShowChecklistPicker(false);
    setChecklistItems([]);
    setChecklistSearch('');
    setLocalAnnotationData(undefined);
    setFolderName('');
    setShowFolderPicker(false);
    setExistingFolders([]);
    onClose();
  };

  const filteredClients = clients.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredChecklistItems = checklistItems.filter((ci) =>
    ci.description.toLowerCase().includes(checklistSearch.toLowerCase()) ||
    (ci.checklist_title || '').toLowerCase().includes(checklistSearch.toLowerCase())
  );

  const selectedChecklistItem = checklistItems.find((ci) => ci.id === selectedChecklistItemId);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.container}>
        <View style={[styles.modal, { backgroundColor: colors.card }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {isBulk ? `Save ${selectedBulkCount} Photos` : 'Save Photo'}
            </Text>
            <TouchableOpacity onPress={handleClose} disabled={saving}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator>
            <View style={styles.content}>
              {isBulk ? (
                <View style={styles.bulkPreviewRow}>
                  <Images size={20} color={colors.primary} />
                  <Text style={[styles.bulkLabel, { color: colors.text }]}>
                    {selectedBulkCount} photo{selectedBulkCount !== 1 ? 's' : ''} ready to upload
                  </Text>
                </View>
              ) : (
                <View style={styles.previewWrapper}>
                  <Image source={{ uri: photoUri }} style={styles.preview} resizeMode="cover" />
                  {onAnnotate && (
                    <TouchableOpacity
                      style={[styles.annotateOverlayBtn, { backgroundColor: colors.card }]}
                      onPress={onAnnotate}
                      disabled={saving}
                    >
                      <Pen size={16} color={colors.primary} />
                      <Text style={[styles.annotateOverlayBtnText, { color: colors.primary }]}>
                        {localAnnotationData ? 'Re-annotate' : 'Annotate'}
                      </Text>
                    </TouchableOpacity>
                  )}
                  {annotationData && (
                    <View style={[styles.annotatedBadge, { backgroundColor: '#3b82f6' }]}>
                      <Pen size={12} color="#fff" />
                      <Text style={styles.annotatedBadgeText}>Annotated</Text>
                    </View>
                  )}
                </View>
              )}

              {location && (
                <View style={[styles.locationBadge, { backgroundColor: colors.primaryLight }]}>
                  <MapPin size={16} color={colors.primary} />
                  <Text style={[styles.locationText, { color: colors.primary }]}>Location captured</Text>
                </View>
              )}

              {suggestedClient && (
                <View style={[styles.suggestion, { backgroundColor: colors.successBackground }]}>
                  <CheckCircle size={20} color={colors.success} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.suggestionTitle, { color: colors.success }]}>
                      Suggested: {suggestedClient.name}
                    </Text>
                    <Text style={[styles.suggestionText, { color: colors.textSecondary }]}>
                      Based on your location
                    </Text>
                  </View>
                </View>
              )}

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Caption (Optional)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                  value={caption}
                  onChangeText={setCaption}
                  placeholder="Add a caption..."
                  placeholderTextColor={colors.textSecondary}
                  editable={!saving}
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.checklistToggle,
                  { backgroundColor: showFolderPicker ? colors.primaryLight : colors.background, borderColor: folderName ? colors.primary : colors.border },
                ]}
                onPress={() => setShowFolderPicker(v => !v)}
                disabled={saving}
              >
                <FolderOpen size={18} color={folderName ? colors.primary : colors.textSecondary} />
                <Text style={[styles.checklistToggleText, { color: folderName ? colors.primary : colors.text }]}>
                  {folderName ? `Folder: ${folderName}` : 'Add to Folder (Optional)'}
                </Text>
                {showFolderPicker ? (
                  <ChevronUp size={18} color={colors.textSecondary} />
                ) : (
                  <ChevronDown size={18} color={colors.textSecondary} />
                )}
              </TouchableOpacity>

              {showFolderPicker && (
                <View style={[styles.checklistPanel, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  {[...existingFolders, ...FOLDER_SUGGESTIONS.filter(s => !existingFolders.includes(s))].map(f => (
                    <TouchableOpacity
                      key={f}
                      style={[styles.checklistItem, folderName === f && { backgroundColor: colors.primaryLight }]}
                      onPress={() => { setFolderName(folderName === f ? '' : f); }}
                    >
                      <FolderOpen size={15} color={folderName === f ? colors.primary : colors.textSecondary} />
                      <Text style={[styles.checklistItemText, { color: folderName === f ? colors.primary : colors.text }]}>
                        {f}
                      </Text>
                      {folderName === f && <CheckCircle size={16} color={colors.primary} />}
                    </TouchableOpacity>
                  ))}
                  <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 4 }]}>
                    <FolderPlus size={14} color={colors.textSecondary} />
                    <TextInput
                      style={[styles.searchInput, { color: colors.text }]}
                      value={folderName}
                      onChangeText={setFolderName}
                      placeholder="Or type a custom folder name..."
                      placeholderTextColor={colors.textSecondary}
                      autoCapitalize="words"
                    />
                  </View>
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.checklistToggle,
                  { backgroundColor: showChecklistPicker ? colors.primaryLight : colors.background, borderColor: showChecklistPicker ? colors.primary : colors.border },
                ]}
                onPress={() => {
                  if (!showChecklistPicker && checklistItems.length === 0) {
                    fetchChecklistItems();
                  }
                  setShowChecklistPicker((v) => !v);
                }}
                disabled={saving}
              >
                <ListChecks size={18} color={showChecklistPicker ? colors.primary : colors.textSecondary} />
                <Text style={[styles.checklistToggleText, { color: showChecklistPicker ? colors.primary : colors.text }]}>
                  {selectedChecklistItem ? `Checklist: ${selectedChecklistItem.description}` : 'Add to Checklist (Optional)'}
                </Text>
                {showChecklistPicker ? (
                  <ChevronUp size={18} color={colors.textSecondary} />
                ) : (
                  <ChevronDown size={18} color={colors.textSecondary} />
                )}
              </TouchableOpacity>

              {showChecklistPicker && (
                <View style={[styles.checklistPanel, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Search size={16} color={colors.textSecondary} />
                    <TextInput
                      style={[styles.searchInput, { color: colors.text }]}
                      value={checklistSearch}
                      onChangeText={setChecklistSearch}
                      placeholder="Search checklist items..."
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>
                  {loadingChecklists ? (
                    <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 12 }} />
                  ) : filteredChecklistItems.length === 0 ? (
                    <Text style={[styles.noChecklistText, { color: colors.textSecondary }]}>
                      No checklist items found. Create a job checklist first.
                    </Text>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={[styles.checklistItem, !selectedChecklistItemId && { backgroundColor: colors.primaryLight }]}
                        onPress={() => setSelectedChecklistItemId(null)}
                      >
                        <Text style={[styles.checklistItemText, { color: !selectedChecklistItemId ? colors.primary : colors.textSecondary }]}>
                          None
                        </Text>
                      </TouchableOpacity>
                      {filteredChecklistItems.map((ci) => (
                        <TouchableOpacity
                          key={ci.id}
                          style={[
                            styles.checklistItem,
                            selectedChecklistItemId === ci.id && { backgroundColor: colors.primaryLight },
                          ]}
                          onPress={() => setSelectedChecklistItemId(ci.id)}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.checklistItemText, { color: selectedChecklistItemId === ci.id ? colors.primary : colors.text }]}>
                              {ci.description}
                            </Text>
                            {ci.checklist_title && (
                              <Text style={[styles.checklistItemSub, { color: colors.textSecondary }]}>
                                {ci.checklist_title}
                              </Text>
                            )}
                          </View>
                          {selectedChecklistItemId === ci.id && (
                            <CheckCircle size={18} color={colors.primary} />
                          )}
                        </TouchableOpacity>
                      ))}
                    </>
                  )}
                </View>
              )}

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Select Client *</Text>
                <View style={[styles.searchBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Search size={20} color={colors.textSecondary} />
                  <TextInput
                    style={[styles.searchInput, { color: colors.text }]}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search clients..."
                    placeholderTextColor={colors.textSecondary}
                    editable={!saving}
                  />
                </View>
              </View>

              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              ) : (
                <View style={styles.clientListContainer}>
                  {filteredClients.map((client) => {
                    const isSelected = selectedClient?.id === client.id;
                    const isSuggested = suggestedClient?.id === client.id;
                    return (
                      <TouchableOpacity
                        key={client.id}
                        style={[
                          styles.clientItem,
                          { backgroundColor: colors.background, borderColor: colors.border },
                          isSelected && { backgroundColor: colors.primaryLight, borderColor: colors.primary },
                        ]}
                        onPress={() => setSelectedClient(client)}
                        disabled={saving}
                      >
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={[styles.clientName, { color: colors.text }, isSelected && { color: colors.primary, fontWeight: '600' }]}>
                              {client.name}
                            </Text>
                            {isSuggested && (
                              <View style={[styles.suggestedBadge, { backgroundColor: colors.success }]}>
                                <Text style={styles.suggestedBadgeText}>Nearest</Text>
                              </View>
                            )}
                          </View>
                          {client.address && (
                            <Text style={[styles.clientAddress, { color: colors.textSecondary }]}>
                              {client.address}
                            </Text>
                          )}
                        </View>
                        {isSelected && <CheckCircle size={24} color={colors.primary} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton, { backgroundColor: colors.background }]}
              onPress={handleClose}
              disabled={saving}
            >
              <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                styles.saveButton,
                { overflow: 'hidden' },
                (!selectedClient || saving) && styles.disabledButton,
              ]}
              onPress={handleSave}
              disabled={!selectedClient || saving}
            >
              <LinearGradient
                colors={['#1B4D6E', '#245d82']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.saveButtonGradient}
              >
                {saving ? (
                  <View style={{ alignItems: 'center' }}>
                    <ActivityIndicator color="#fff" />
                    {savingProgress && (
                      <Text style={styles.savingProgressText}>
                        {savingProgress.current}/{savingProgress.total}
                      </Text>
                    )}
                  </View>
                ) : (
                  <Text style={styles.saveButtonText}>
                    {isBulk ? `Save ${selectedBulkCount} Photos` : 'Save Photo'}
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
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
    maxHeight: '92%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  scrollContent: {
    maxHeight: '75%',
  },
  content: {
    padding: 16,
  },
  bulkPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    marginBottom: 16,
  },
  bulkLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  previewWrapper: {
    marginBottom: 16,
    position: 'relative',
  },
  preview: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  annotateOverlayBtn: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  annotateOverlayBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  annotatedBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  annotatedBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  locationText: {
    fontSize: 14,
    fontWeight: '500',
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  suggestionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  suggestionText: {
    fontSize: 14,
    marginTop: 2,
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
  },
  checklistToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    marginBottom: 10,
  },
  checklistToggleText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  checklistPanel: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    maxHeight: 200,
  },
  noChecklistText: {
    fontSize: 13,
    textAlign: 'center',
    padding: 12,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 4,
    gap: 8,
  },
  checklistItemText: {
    fontSize: 14,
    fontWeight: '500',
  },
  checklistItemSub: {
    fontSize: 12,
    marginTop: 2,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
    margin: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  } as any,
  loadingContainer: {
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clientListContainer: {
    marginBottom: 8,
  },
  clientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    marginBottom: 8,
  },
  clientName: {
    fontSize: 15,
  },
  clientAddress: {
    fontSize: 13,
    marginTop: 3,
  },
  suggestedBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  suggestedBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
  },
  button: {
    flex: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    padding: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    overflow: 'hidden',
  },
  saveButtonGradient: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
  savingProgressText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
  },
});
