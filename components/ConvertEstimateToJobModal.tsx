import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Calendar, Clock, CircleCheck as CheckCircle, Briefcase } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import ScheduleCalendarPickerModal from '@/components/ScheduleCalendarPickerModal';
import TimePicker from '@/components/TimePicker';
import { useToast } from '@/contexts/ToastContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { formatCurrency } from '@/lib/utilities';
import { inferPaneDetailsFromDescription } from '@/lib/productionRateService';

interface EstimateItem {
  id: string;
  job_type_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  approved_by_client: boolean;
  notes?: string;
  pane_details?: Record<string, number> | null;
  service_scope?: string | null;
}

interface Estimate {
  id: string;
  estimate_number: string;
  client_id: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  notes?: string;
  client_notes?: string;
  signed_by_name?: string;
  signed_by_email?: string;
  service_address_id?: string | null;
}

interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
}

interface ConvertEstimateToJobModalProps {
  visible: boolean;
  estimateId: string | null;
  onClose: () => void;
  onSuccess: (jobId: string) => void;
}

export default function ConvertEstimateToJobModal({
  visible,
  estimateId,
  onClose,
  onSuccess,
}: ConvertEstimateToJobModalProps) {
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [items, setItems] = useState<EstimateItem[]>([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('09:00');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { showToast } = useToast();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();

  useEffect(() => {
    if (visible && estimateId) {
      fetchEstimateDetails();
      const today = new Date();
      setSelectedDate(today.toISOString().split('T')[0]);
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

      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', estimateData.client_id)
        .single();

      if (clientError) throw clientError;

      const { data: itemsData, error: itemsError } = await supabase
        .from('estimate_items')
        .select('*')
        .eq('estimate_id', estimateId)
        .eq('approved_by_client', true)
        .order('display_order', { ascending: true });

      if (itemsError) throw itemsError;

      setEstimate(estimateData);
      setClient(clientData);
      setItems(itemsData || []);
    } catch (error: any) {
      setError(error.message || 'Failed to load estimate');
      showToast({ message: 'Failed to load estimate details', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleConvert = async () => {
    if (!estimate || !client) return;

    if (!selectedDate) {
      setError('Please select a job date');
      return;
    }

    if (!selectedTime) {
      setError('Please select a start time');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const startDateTime = new Date(`${selectedDate}T${selectedTime}:00`);
      const endDateTime = new Date(startDateTime.getTime() + 2 * 60 * 60 * 1000);

      const jobDescription = items.map((item) => item.description).join('\n');
      const jobNotes = [estimate.notes, estimate.client_notes]
        .filter(Boolean)
        .join('\n\n');

      const jobTitle = items.length === 1
        ? items[0].description
        : `${client.name} - Estimate #${estimate.estimate_number}`;

      const jobTypeId = items.length === 1 && items[0].job_type_id
        ? items[0].job_type_id
        : null;

      const { data: job, error: jobError } = await supabase
        .from('schedule_events')
        .insert({
          user_id: user!.id,
          client_id: estimate.client_id,
          job_type_id: jobTypeId,
          estimate_id: estimate.id,
          title: jobTitle,
          description: jobDescription,
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          address: client.address || '',
          latitude: client.latitude,
          longitude: client.longitude,
          amount: estimate.total,
          payment_status: 'unpaid',
          service_address_id: estimate.service_address_id || null,
        })
        .select()
        .single();

      if (jobError) throw jobError;

      if (currentOrganization?.id) {
        const serviceAddressId = estimate.service_address_id || null;
        const paneItems = items.filter(
          (item) => item.job_type_id && item.quantity > 0
        );
        for (const item of paneItems) {
          const resolvedPaneDetails = item.pane_details ||
            inferPaneDetailsFromDescription(item.description, item.quantity);

          let query = supabase
            .from('client_unit_quantities')
            .select('id, pane_details')
            .eq('client_id', estimate.client_id)
            .eq('job_type_id', item.job_type_id!);

          if (serviceAddressId) {
            query = query.eq('address_id', serviceAddressId);
          } else {
            query = query.is('address_id', null);
          }

          const { data: existing } = await query.maybeSingle();

          if (existing) {
            await supabase
              .from('client_unit_quantities')
              .update({
                quantity: item.quantity,
                pane_details: resolvedPaneDetails || existing.pane_details || null,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existing.id);
          } else {
            await supabase
              .from('client_unit_quantities')
              .insert({
                client_id: estimate.client_id,
                job_type_id: item.job_type_id,
                quantity: item.quantity,
                pane_details: resolvedPaneDetails || null,
                organization_id: currentOrganization.id,
                address_id: serviceAddressId,
              });
          }
        }
      }

      showToast({
        message: 'Estimate converted to job successfully',
        type: 'success',
      });

      onSuccess(job.id);
      onClose();
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to convert estimate';
      setError(errorMessage);
      showToast({ message: errorMessage, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (!estimate || !client) {
    return (
      <Modal visible={visible} animationType="slide" transparent>
        <View style={styles.loadingContainer}>
          <View style={[styles.loadingBox, { backgroundColor: colors.surface }]}>
            {loading ? (
              <>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.text }]}>
                  Loading estimate...
                </Text>
              </>
            ) : (
              <>
                <X size={48} color={colors.error} />
                <Text style={[styles.errorTitle, { color: colors.error }]}>
                  Failed to Load
                </Text>
                <Text style={[styles.errorText, { color: colors.textSecondary }]}>
                  {error}
                </Text>
                <TouchableOpacity
                  style={styles.closeButton}
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

  const approvedItemsCount = items.length;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={[styles.modal, { backgroundColor: colors.surface }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View>
              <Text style={[styles.title, { color: colors.text }]}>
                Convert to Job
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Estimate #{estimate.estimate_number}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} disabled={saving}>
              <X size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {error ? (
            <View style={[styles.errorContainer, { backgroundColor: colors.errorBackground }]}>
              <Text style={[styles.errorBannerText, { color: colors.error }]}>
                {error}
              </Text>
            </View>
          ) : null}

          <ScrollView style={styles.content}>
            <View style={[styles.infoCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Client:</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{client.name}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Total Amount:</Text>
                <Text style={[styles.infoValue, { color: colors.primary }]}>
                  {formatCurrency(estimate.total)}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Approved Items:</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {approvedItemsCount}
                </Text>
              </View>
              {client.address && (
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Location:</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]} numberOfLines={2}>
                    {client.address}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Approved Services
              </Text>
              {items.map((item, index) => (
                <View
                  key={item.id}
                  style={[styles.itemCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
                >
                  <View style={styles.itemHeader}>
                    <Text style={[styles.itemDescription, { color: colors.text }]}>
                      {item.description}
                    </Text>
                    <Text style={[styles.itemTotal, { color: colors.primary }]}>
                      {formatCurrency(item.total)}
                    </Text>
                  </View>
                  <Text style={[styles.itemDetails, { color: colors.textSecondary }]}>
                    Qty: {item.quantity} × {formatCurrency(item.unit_price)}
                  </Text>
                  {item.notes && (
                    <Text style={[styles.itemNotes, { color: colors.textSecondary }]}>
                      {item.notes}
                    </Text>
                  )}
                </View>
              ))}
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Schedule Job
              </Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                Select date and time for this job
              </Text>

              <TouchableOpacity
                style={[styles.dateTimeButton, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
                onPress={() => setShowDatePicker(true)}
              >
                <Calendar size={20} color={colors.primary} />
                <View style={styles.dateTimeContent}>
                  <Text style={[styles.dateTimeLabel, { color: colors.textSecondary }]}>
                    Job Date
                  </Text>
                  <Text style={[styles.dateTimeValue, { color: colors.text }]}>
                    {selectedDate
                      ? new Date(selectedDate).toLocaleDateString('en-US', {
                          weekday: 'long',
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : 'Select date'}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.dateTimeButton, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
                onPress={() => setShowTimePicker(true)}
              >
                <Clock size={20} color={colors.primary} />
                <View style={styles.dateTimeContent}>
                  <Text style={[styles.dateTimeLabel, { color: colors.textSecondary }]}>
                    Start Time
                  </Text>
                  <Text style={[styles.dateTimeValue, { color: colors.text }]}>
                    {selectedTime
                      ? new Date(`2000-01-01T${selectedTime}`).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true,
                        })
                      : 'Select time'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {(estimate.notes || estimate.client_notes) && (
              <View style={[styles.notesCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                <Text style={[styles.notesTitle, { color: colors.text }]}>
                  Notes (will be copied to job)
                </Text>
                {estimate.notes && (
                  <Text style={[styles.notesText, { color: colors.textSecondary }]}>
                    Provider: {estimate.notes}
                  </Text>
                )}
                {estimate.client_notes && (
                  <Text style={[styles.notesText, { color: colors.textSecondary }]}>
                    Client: {estimate.client_notes}
                  </Text>
                )}
              </View>
            )}
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: colors.border }]}
              onPress={onClose}
              disabled={saving}
            >
              <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.convertButton,
                saving && styles.convertButtonDisabled,
              ]}
              onPress={handleConvert}
              disabled={saving}
            >
              <LinearGradient
                colors={['#2D8B57', '#34a065']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.convertButtonGradient}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <CheckCircle size={20} color="#fff" />
                    <Text style={styles.convertButtonText}>Create Job</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        <ScheduleCalendarPickerModal
          visible={showDatePicker}
          selectedDate={selectedDate || new Date().toISOString().split('T')[0]}
          onConfirm={(date) => {
            setSelectedDate(date);
            setShowDatePicker(false);
          }}
          onCancel={() => setShowDatePicker(false)}
          title="Select Job Date"
        />

        <TimePicker
          visible={showTimePicker}
          value={selectedTime}
          onConfirm={(time) => {
            setSelectedTime(time);
            setShowTimePicker(false);
          }}
          onCancel={() => setShowTimePicker(false)}
        />
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
    maxHeight: '90%',
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
  subtitle: {
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
  infoCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    flex: 2,
    textAlign: 'right',
  },
  section: {
    marginBottom: 20,
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
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  itemDescription: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  itemTotal: {
    fontSize: 15,
    fontWeight: '700',
  },
  itemDetails: {
    fontSize: 13,
    marginTop: 4,
  },
  itemNotes: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 6,
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  dateTimeContent: {
    marginLeft: 12,
    flex: 1,
  },
  dateTimeLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  dateTimeValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  notesCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
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
    marginBottom: 8,
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
  convertButton: {
    flex: 2,
    overflow: 'hidden',
    borderRadius: 8,
  },
  convertButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
  },
  convertButtonDisabled: {
    opacity: 0.6,
  },
  convertButtonText: {
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
    overflow: 'hidden',
    borderRadius: 8,
    marginTop: 8,
  },
  closeButtonGradient: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
