import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, ChevronDown, Users, Clock, CalendarDays, SquareCheck as CheckSquare } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import DatePicker from './DatePicker';
import JobChecklistsModal from './JobChecklistsModal';
import AIAssistButton from './AIAssistButton';
import CollapsibleField from './CollapsibleField';
import { useCollapsibleForm } from '@/hooks/useCollapsibleForm';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useRegisterModal } from '@/contexts/ModalStackContext';

interface Job {
  id: string;
  client_id: string;
  title: string;
  description: string;
  date: string;
  status: string;
  amount: number;
}

interface Client {
  id: string;
  name: string;
}

interface JobModalProps {
  visible: boolean;
  job: Job | null;
  onClose: () => void;
  onSave: () => void;
  preFilledData?: {
    title?: string;
    client_id?: string;
    description?: string;
  };
}

export default function JobModal({ visible, job, onClose, onSave, preFilledData }: JobModalProps) {
  useRegisterModal('job-modal', visible, onClose);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [status, setStatus] = useState('pending');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [crewSize, setCrewSize] = useState('1');
  const [actualDuration, setActualDuration] = useState('');
  const [showChecklists, setShowChecklists] = useState(false);
  const [checklistTemplates, setChecklistTemplates] = useState<any[]>([]);
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const { activeFieldId, toggleField } = useCollapsibleForm();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { currentOrganization } = useOrganization();

  useEffect(() => {
    if (visible) {
      fetchClients();
      if (!job) {
        fetchChecklistTemplates();
      }
    }
  }, [visible, job]);

  useEffect(() => {
    if (job) {
      setSelectedClientId(job.client_id);
      setTitle(job.title);
      setDescription(job.description);
      setDate(job.date);
      setStatus(job.status);
      setAmount(job.amount.toString());
      setCrewSize(((job as any).crew_size || 1).toString());
      setActualDuration(((job as any).actual_duration_minutes || '').toString());
    } else {
      resetForm();
      if (preFilledData && visible) {
        if (preFilledData.title) setTitle(preFilledData.title);
        if (preFilledData.client_id) setSelectedClientId(preFilledData.client_id);
        if (preFilledData.description) setDescription(preFilledData.description);
      }
    }
  }, [job, visible, preFilledData]);

  const fetchClients = async () => {
    try {
      let query = supabase
        .from('clients')
        .select('id, name');
      if (currentOrganization?.id) {
        query = query.eq('organization_id', currentOrganization.id);
      }
      const { data, error } = await query.order('name', { ascending: true });

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  const fetchChecklistTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('checklist_templates')
        .select('id, title, name, description')
        .eq('is_shared', true)
        .order('title', { ascending: true });

      if (error) throw error;
      setChecklistTemplates(data || []);
    } catch (error) {
      console.error('Error fetching checklist templates:', error);
    }
  };

  const applyTemplates = async (jobId: string) => {
    if (selectedTemplates.length === 0) return;

    try {
      for (const templateId of selectedTemplates) {
        const { data: template } = await supabase
          .from('checklist_templates')
          .select('title, name, description')
          .eq('id', templateId)
          .single();

        if (!template) continue;

        const { data: checklist, error: checklistError } = await supabase
          .from('job_checklists')
          .insert({
            job_id: jobId,
            title: template.title || template.name,
            description: template.description || '',
            created_by: user?.id,
          })
          .select()
          .single();

        if (checklistError) throw checklistError;

        const { data: items } = await supabase
          .from('checklist_template_items')
          .select('description, label, notes, display_order, sort_order')
          .eq('template_id', templateId)
          .order('display_order', { ascending: true });

        if (items && items.length > 0) {
          const checklistItems = items.map((item: any) => ({
            checklist_id: checklist.id,
            description: item.description || item.label,
            notes: item.notes || '',
            display_order: item.display_order || item.sort_order || 0,
            created_by: user?.id,
          }));

          await supabase.from('job_checklist_items').insert(checklistItems);
        }
      }
    } catch (error: any) {
      console.error('Error applying templates:', error);
      showToast({ message: 'Failed to apply some checklist templates', type: 'error' });
    }
  };

  const resetForm = () => {
    setSelectedClientId('');
    setTitle('');
    setDescription('');
    setDate(new Date().toISOString().split('T')[0]);
    setStatus('pending');
    setAmount('');
    setCrewSize('1');
    setActualDuration('');
    setSelectedTemplates([]);
    setError('');
  };

  const handleSave = async () => {
    if (!selectedClientId) {
      setError('Please select a client');
      return;
    }

    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    if (!amount || isNaN(Number(amount))) {
      setError('Please enter a valid amount');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const jobData: any = {
        client_id: selectedClientId,
        title: title.trim(),
        description: description.trim(),
        date: date || new Date().toISOString().split('T')[0],
        status,
        amount: Number(amount),
        crew_size: crewSize ? Number(crewSize) : 1,
        updated_at: new Date().toISOString(),
      };

      if (status === 'completed' && actualDuration) {
        jobData.actual_duration_minutes = Number(actualDuration);
      }

      if (job) {
        const { error } = await supabase
          .from('jobs')
          .update(jobData)
          .eq('id', job.id);

        if (error) throw error;
        showToast({ message: 'Job updated', type: 'success' });
      } else {
        const { data: newJob, error } = await supabase
          .from('jobs')
          .insert({
            ...jobData,
            user_id: user?.id,
          })
          .select()
          .single();

        if (error) throw error;

        if (newJob && selectedTemplates.length > 0) {
          await applyTemplates(newJob.id);
        }

        showToast({ message: 'Job created', type: 'success' });
      }

      resetForm();
      onSave();
    } catch (error: any) {
      setError(error.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const statuses = [
    { value: 'pending', label: 'Pending' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
  ];

  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const selectedStatusLabel =
    statuses.find((s) => s.value === status)?.label || 'Select status';

  return (
    <>
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.header}>
              <Text style={styles.title}>{job ? 'Edit Job' : 'Add Job'}</Text>
              <TouchableOpacity onPress={onClose} disabled={loading}>
                <X size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <ScrollView style={styles.form} keyboardShouldPersistTaps="handled">
              <CollapsibleField
                label="Client"
                fieldId="client"
                activeFieldId={activeFieldId}
                onToggle={toggleField}
                displayValue={selectedClient?.name}
                required
              >
                <View style={styles.pickerList}>
                  <View style={styles.searchContainer}>
                    <TextInput
                      style={styles.searchInput}
                      value={clientSearchQuery}
                      onChangeText={setClientSearchQuery}
                      placeholder="Search clients..."
                      placeholderTextColor="#999"
                      autoFocus
                    />
                    {clientSearchQuery.length > 0 && (
                      <TouchableOpacity
                        style={styles.clearSearchButton}
                        onPress={() => setClientSearchQuery('')}
                      >
                        <X size={16} color="#666" />
                      </TouchableOpacity>
                    )}
                  </View>
                  <ScrollView style={styles.clientScrollView} nestedScrollEnabled>
                    {clients
                      .filter((client) =>
                        client.name.toLowerCase().includes(clientSearchQuery.toLowerCase())
                      )
                      .map((client) => (
                        <TouchableOpacity
                          key={client.id}
                          style={styles.pickerItem}
                          onPress={() => {
                            setSelectedClientId(client.id);
                            setClientSearchQuery('');
                            toggleField('client');
                          }}
                        >
                          <Text style={styles.pickerItemText}>{client.name}</Text>
                        </TouchableOpacity>
                      ))}
                    {clients.filter((client) =>
                      client.name.toLowerCase().includes(clientSearchQuery.toLowerCase())
                    ).length === 0 && (
                      <View style={styles.noResultsContainer}>
                        <Text style={styles.noResultsText}>No clients found</Text>
                      </View>
                    )}
                  </ScrollView>
                </View>
              </CollapsibleField>

              <CollapsibleField
                label="Title"
                fieldId="title"
                activeFieldId={activeFieldId}
                onToggle={toggleField}
                displayValue={title || undefined}
                required
              >
                <TextInput
                  style={styles.input}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Job title"
                  editable={!loading}
                />
              </CollapsibleField>

              <CollapsibleField
                label="Date"
                fieldId="date"
                activeFieldId={activeFieldId}
                onToggle={(id) => {
                  toggleField(id);
                  if (activeFieldId !== 'date') {
                    setShowDatePicker(true);
                  }
                }}
                displayValue={date || undefined}
              >
                <TouchableOpacity
                  style={styles.picker}
                  onPress={() => !loading && setShowDatePicker(true)}
                >
                  <Text style={[styles.pickerText, !date && { color: '#999' }]}>
                    {date || 'Select Date'}
                  </Text>
                  <CalendarDays size={18} color="#666" />
                </TouchableOpacity>
              </CollapsibleField>

              <CollapsibleField
                label="Amount"
                fieldId="amount"
                activeFieldId={activeFieldId}
                onToggle={toggleField}
                displayValue={amount ? `$${amount}` : undefined}
                required
              >
                <TextInput
                  style={styles.input}
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  editable={!loading}
                />
              </CollapsibleField>

              <CollapsibleField
                label="Description"
                fieldId="description"
                activeFieldId={activeFieldId}
                onToggle={toggleField}
                displayValue={description ? description.substring(0, 40) + (description.length > 40 ? '...' : '') : undefined}
              >
                <View style={styles.labelRow}>
                  <AIAssistButton
                    type="job_description"
                    compact
                    onGenerate={(text) => setDescription(text)}
                    jobTypeName={title}
                    existingContent={description}
                    context={{ title }}
                  />
                </View>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Job description..."
                  multiline
                  numberOfLines={4}
                  editable={!loading}
                />
              </CollapsibleField>

              <CollapsibleField
                label="Status"
                fieldId="status"
                activeFieldId={activeFieldId}
                onToggle={toggleField}
                displayValue={selectedStatusLabel}
              >
                <View style={styles.pickerList}>
                  {statuses.map((statusOption) => (
                    <TouchableOpacity
                      key={statusOption.value}
                      style={[styles.pickerItem, status === statusOption.value && { backgroundColor: '#e8f4ff' }]}
                      onPress={() => {
                        setStatus(statusOption.value);
                        toggleField('status');
                      }}
                    >
                      <Text style={[styles.pickerItemText, status === statusOption.value && { fontWeight: '600', color: '#007AFF' }]}>
                        {statusOption.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </CollapsibleField>

              <CollapsibleField
                label="Crew Size"
                fieldId="crewSize"
                activeFieldId={activeFieldId}
                onToggle={toggleField}
                displayValue={crewSize !== '1' ? crewSize : undefined}
              >
                <TextInput
                  style={styles.input}
                  value={crewSize}
                  onChangeText={setCrewSize}
                  placeholder="1"
                  keyboardType="number-pad"
                  editable={!loading}
                />
              </CollapsibleField>

              {!job && checklistTemplates.length > 0 && (
                <CollapsibleField
                  label="Checklist Templates"
                  fieldId="checklists"
                  activeFieldId={activeFieldId}
                  onToggle={toggleField}
                  displayValue={selectedTemplates.length > 0 ? `${selectedTemplates.length} selected` : undefined}
                >
                  <View style={styles.pickerList}>
                    {checklistTemplates.map((template: any) => {
                      const isSelected = selectedTemplates.includes(template.id);
                      return (
                        <TouchableOpacity
                          key={template.id}
                          style={[styles.pickerItem, isSelected && { backgroundColor: '#e8f4ff' }]}
                          onPress={() => {
                            setSelectedTemplates((prev) =>
                              isSelected
                                ? prev.filter((id) => id !== template.id)
                                : [...prev, template.id]
                            );
                          }}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.pickerItemText, isSelected && { fontWeight: '600', color: '#007AFF' }]}>
                              {template.title || template.name}
                            </Text>
                            {template.description && (
                              <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                                {template.description}
                              </Text>
                            )}
                          </View>
                          {isSelected && <CheckSquare size={20} color="#007AFF" />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </CollapsibleField>
              )}

              {status === 'completed' && (
                <CollapsibleField
                  label="Actual Duration (minutes)"
                  fieldId="duration"
                  activeFieldId={activeFieldId}
                  onToggle={toggleField}
                  displayValue={actualDuration ? `${actualDuration} min` : undefined}
                >
                  <TextInput
                    style={[styles.input, styles.completedInput]}
                    value={actualDuration}
                    onChangeText={setActualDuration}
                    placeholder="Enter actual time spent"
                    keyboardType="number-pad"
                    editable={!loading}
                  />
                  <Text style={styles.durationHint}>
                    This helps improve future job estimates
                  </Text>
                </CollapsibleField>
              )}

              {job && job.id && (
                <View style={styles.checklistSection}>
                  <TouchableOpacity
                    style={styles.checklistButton}
                    onPress={() => setShowChecklists(true)}
                  >
                    <CheckSquare size={20} color="#007AFF" />
                    <Text style={styles.checklistButtonText}>Manage Checklists</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onClose}
                disabled={loading}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, loading && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={loading}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#1B4D6E', '#245d82']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.saveButtonGradient}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>

      <DatePicker
        visible={showDatePicker}
        value={date || new Date().toISOString().split('T')[0]}
        onConfirm={(d) => {
          setDate(d);
          setShowDatePicker(false);
        }}
        onCancel={() => setShowDatePicker(false)}
        title="Select Date"
      />

      {job && job.id && (
        <JobChecklistsModal
          visible={showChecklists}
          jobId={job.id}
          jobTitle={title}
          onClose={() => setShowChecklists(false)}
        />
      )}
    </>
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
  form: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  picker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  pickerText: {
    fontSize: 16,
    color: '#333',
  },
  placeholderText: {
    color: '#999',
  },
  pickerList: {
    marginTop: 8,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    maxHeight: 250,
    overflow: 'hidden',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    padding: 0,
    margin: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  } as any,
  clearSearchButton: {
    padding: 4,
  },
  clientScrollView: {
    maxHeight: 190,
  },
  noResultsContainer: {
    padding: 20,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 14,
    color: '#999',
  },
  pickerItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  pickerItemText: {
    fontSize: 16,
    color: '#333',
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
  saveButton: {
    flex: 1,
    borderRadius: 8,
    alignItems: 'center',
    overflow: 'hidden',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  errorContainer: {
    backgroundColor: '#fee',
    padding: 12,
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 8,
  },
  errorText: {
    color: '#c00',
    fontSize: 14,
    textAlign: 'center',
  },
  labelWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  completedInput: {
    borderColor: '#10b981',
    borderWidth: 2,
    backgroundColor: '#f0fdf4',
  },
  durationHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 6,
    fontStyle: 'italic',
  },
  checklistSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  checklistButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    backgroundColor: '#e8f4ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  checklistButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  sectionHeader: {
    marginTop: 16,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  moreOptionsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    marginTop: 8,
    marginBottom: 12,
  },
  moreOptionsText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#007AFF',
  },
});
