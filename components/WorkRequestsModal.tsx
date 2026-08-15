import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Platform,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, CalendarDays, Clock, Phone, PhoneCall, CircleCheck as CheckCircle, Circle as XCircle, ChevronDown, User, CircleAlert as AlertCircle, Inbox, CalendarPlus, UserPlus, Mail } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useTheme } from '@/contexts/ThemeContext';
import ScheduleModal from '@/components/ScheduleModal';

interface WorkRequest {
  id: string;
  client_id: string | null;
  requested_date: string;
  requested_start_time: string;
  requested_end_time: string;
  service_type: string;
  notes: string;
  phone_call_requested: boolean;
  status: 'pending' | 'approved' | 'declined' | 'completed';
  admin_notes: string;
  created_at: string;
  organization_id?: string;
  guest_name?: string;
  guest_email?: string;
  guest_phone?: string;
  guest_notification_preference?: string;
  converted_client_id?: string | null;
  clients: {
    name: string;
    phone: string;
    email: string;
  } | null;
}

type FilterStatus = 'all' | 'pending' | 'approved' | 'declined';

interface WorkRequestsModalProps {
  visible: boolean;
  onClose: () => void;
}

function formatDate(d: string): string {
  try {
    const [y, m, day] = d.split('-').map(Number);
    return new Date(y, m - 1, day).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    });
  } catch { return d; }
}

function formatTime(t: string): string {
  try {
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
  } catch { return t; }
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:  { label: 'Pending',  color: '#FF9500', bg: '#FFF9F0' },
  approved: { label: 'Approved', color: '#34C759', bg: '#F0FFF4' },
  declined: { label: 'Declined', color: '#FF3B30', bg: '#FFF2F0' },
  completed:{ label: 'Completed',color: '#8E8E93', bg: '#F2F2F7' },
};

function getRequestName(req: WorkRequest): string {
  if (req.clients?.name) return req.clients.name;
  if (req.guest_name) return `${req.guest_name} (Guest)`;
  return 'Unknown';
}

function getRequestPhone(req: WorkRequest): string {
  return req.clients?.phone || req.guest_phone || '';
}

function getRequestEmail(req: WorkRequest): string {
  return req.clients?.email || req.guest_email || '';
}

function isGuestRequest(req: WorkRequest): boolean {
  return !req.client_id && !!req.guest_email;
}

export default function WorkRequestsModal({ visible, onClose }: WorkRequestsModalProps) {
  const { currentOrganization } = useOrganization();
  const { colors } = useTheme();
  const [requests, setRequests] = useState<WorkRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterStatus>('pending');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [schedulePrefill, setSchedulePrefill] = useState<{ clientId: string; clientName: string; title: string; description: string; date?: Date } | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  useEffect(() => {
    if (visible && currentOrganization) {
      loadRequests();
    }
  }, [visible, currentOrganization]);

  const loadRequests = useCallback(async () => {
    if (!currentOrganization) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('client_work_requests')
        .select('*, clients(name, phone, email)')
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false });
      if (!error) setRequests(data ?? []);
    } finally {
      setLoading(false);
    }
  }, [currentOrganization]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadRequests();
    setRefreshing(false);
  };

  const sendDecisionNotification = async (requestId: string, decision: string) => {
    try {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
      const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || anonKey;
      await fetch(`${supabaseUrl}/functions/v1/portal-public-api`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': anonKey,
        },
        body: JSON.stringify({
          action: 'notify_request_decision',
          work_request_id: requestId,
          decision,
        }),
      });
    } catch {}
  };

  const updateStatus = async (id: string, status: WorkRequest['status']) => {
    setUpdatingId(id);
    try {
      const { error } = await supabase
        .from('client_work_requests')
        .update({ status, reviewed_at: new Date().toISOString() })
        .eq('id', id);
      if (!error) {
        setRequests((prev) =>
          prev.map((r) => (r.id === id ? { ...r, status } : r))
        );
        if (status === 'approved' || status === 'declined') {
          sendDecisionNotification(id, status);
        }
      }
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCall = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned) Linking.openURL(`tel:${cleaned}`);
  };

  const handleConvertGuest = async (req: WorkRequest) => {
    if (!currentOrganization || !req.guest_name || !req.guest_email) return;
    setConvertingId(req.id);
    try {
      const { data: existing } = await supabase
        .from('clients')
        .select('id')
        .eq('organization_id', currentOrganization.id)
        .ilike('email', req.guest_email.trim().toLowerCase())
        .maybeSingle();

      let clientId: string;

      if (existing) {
        clientId = existing.id;
      } else {
        const { data: newClient, error: insertErr } = await supabase
          .from('clients')
          .insert({
            organization_id: currentOrganization.id,
            name: req.guest_name,
            email: req.guest_email.trim().toLowerCase(),
            phone: req.guest_phone || '',
            notification_preference: req.guest_notification_preference || 'email',
          })
          .select('id')
          .single();

        if (insertErr || !newClient) return;
        clientId = newClient.id;
      }

      await supabase
        .from('client_work_requests')
        .update({ converted_client_id: clientId, client_id: clientId })
        .eq('id', req.id);

      setRequests((prev) =>
        prev.map((r) =>
          r.id === req.id ? { ...r, converted_client_id: clientId, client_id: clientId } : r
        )
      );
    } finally {
      setConvertingId(null);
    }
  };

  const handleScheduleJob = async (req: WorkRequest) => {
    const prefillDate = req.requested_date ? new Date(req.requested_date + 'T' + (req.requested_start_time || '09:00')) : undefined;
    if (req.status === 'pending') {
      await updateStatus(req.id, 'approved');
    }
    const clientId = req.client_id || req.converted_client_id || '';
    const clientName = req.clients?.name || req.guest_name || '';
    setSchedulePrefill({
      clientId,
      clientName,
      title: req.service_type || 'Service Appointment',
      description: req.notes || '',
      date: prefillDate,
    });
    setScheduleModalVisible(true);
  };

  const filtered = requests.filter((r) =>
    filter === 'all' ? true : r.status === filter
  );

  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const callbackCount = requests.filter((r) => r.status === 'pending' && r.phone_call_requested).length;
  const guestCount = requests.filter((r) => r.status === 'pending' && isGuestRequest(r)).length;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Scheduling Requests</Text>
            {pendingCount > 0 && (
              <Text style={styles.headerSub}>
                {pendingCount} pending
                {guestCount > 0 ? ` · ${guestCount} guest${guestCount > 1 ? 's' : ''}` : ''}
                {callbackCount > 0 ? ` · ${callbackCount} callback${callbackCount > 1 ? 's' : ''}` : ''}
              </Text>
            )}
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <X size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {callbackCount > 0 && (
          <View style={styles.callbackBanner}>
            <PhoneCall size={16} color="#FF9500" />
            <Text style={styles.callbackBannerText}>
              {callbackCount} client{callbackCount > 1 ? 's need' : ' needs'} a callback — they requested a busy time slot.
            </Text>
          </View>
        )}

        <View style={styles.filterRow}>
          {(['pending', 'approved', 'declined', 'all'] as FilterStatus[]).map((f) => {
            const count = f === 'all' ? requests.length : requests.filter(r => r.status === f).length;
            return (
              <TouchableOpacity
                key={f}
                style={[styles.filterChip, filter === f && styles.filterChipActive]}
                onPress={() => setFilter(f)}
              >
                <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </Text>
                {count > 0 && (
                  <View style={[styles.filterBadge, filter === f && styles.filterBadgeActive]}>
                    <Text style={[styles.filterBadgeText, filter === f && styles.filterBadgeTextActive]}>
                      {count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#007AFF" />
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          >
            {filtered.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Inbox size={40} color={colors.textSecondary} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No requests</Text>
                <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                  {filter === 'pending' ? 'No pending requests right now.' : `No ${filter} requests.`}
                </Text>
              </View>
            ) : (
              filtered.map((req) => (
                <RequestCard
                  key={req.id}
                  req={req}
                  expanded={expandedId === req.id}
                  updating={updatingId === req.id}
                  converting={convertingId === req.id}
                  onToggle={() => setExpandedId(expandedId === req.id ? null : req.id)}
                  onApprove={() => updateStatus(req.id, 'approved')}
                  onDecline={() => updateStatus(req.id, 'declined')}
                  onCall={() => handleCall(getRequestPhone(req))}
                  onSchedule={() => handleScheduleJob(req)}
                  onConvert={() => handleConvertGuest(req)}
                  colors={colors}
                />
              ))
            )}
          </ScrollView>
        )}

        {scheduleModalVisible && schedulePrefill && (
          <ScheduleModal
            visible={scheduleModalVisible}
            event={null}
            preselectedDate={schedulePrefill.date || null}
            prefillFromClient={{
              clientId: schedulePrefill.clientId,
              clientName: schedulePrefill.clientName,
              address: '',
              jobTitle: schedulePrefill.title,
            }}
            onClose={() => { setScheduleModalVisible(false); setSchedulePrefill(null); }}
            onSave={() => { setScheduleModalVisible(false); setSchedulePrefill(null); loadRequests(); }}
          />
        )}
      </View>
    </Modal>
  );
}

function RequestCard({ req, expanded, updating, converting, onToggle, onApprove, onDecline, onCall, onSchedule, onConvert, colors }: {
  req: WorkRequest;
  expanded: boolean;
  updating: boolean;
  converting: boolean;
  onToggle: () => void;
  onApprove: () => void;
  onDecline: () => void;
  onCall: () => void;
  onSchedule: () => void;
  onConvert: () => void;
  colors: any;
}) {
  const cfg = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.pending;
  const isPending = req.status === 'pending';
  const isGuest = isGuestRequest(req);
  const hasPhone = !!getRequestPhone(req);
  const displayName = getRequestName(req);
  const displayEmail = getRequestEmail(req);
  const alreadyConverted = !!req.converted_client_id || (isGuest && !!req.client_id);

  return (
    <View style={[styles.card, { borderColor: req.phone_call_requested && isPending ? '#FF950040' : colors.border }]}>
      {isGuest && !alreadyConverted && (
        <View style={styles.guestFlag}>
          <User size={11} color="#007AFF" />
          <Text style={styles.guestFlagText}>Guest request</Text>
        </View>
      )}
      {isGuest && alreadyConverted && (
        <View style={[styles.guestFlag, { backgroundColor: '#F0FFF4' }]}>
          <CheckCircle size={11} color="#34C759" />
          <Text style={[styles.guestFlagText, { color: '#34C759' }]}>Converted to client</Text>
        </View>
      )}
      {req.phone_call_requested && isPending && (
        <View style={styles.callbackFlag}>
          <PhoneCall size={11} color="#FF9500" />
          <Text style={styles.callbackFlagText}>Callback requested</Text>
        </View>
      )}

      <TouchableOpacity style={styles.cardHeader} onPress={onToggle} activeOpacity={0.7}>
        <View style={styles.cardHeaderLeft}>
          <View style={[styles.clientAvatar, { backgroundColor: isGuest ? '#FF950018' : '#007AFF18' }]}>
            <User size={16} color={isGuest ? '#FF9500' : '#007AFF'} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.clientName, { color: colors.text }]} numberOfLines={1}>
              {displayName}
            </Text>
            <View style={styles.dateTimeRow}>
              <CalendarDays size={12} color={colors.textSecondary} />
              <Text style={[styles.dateTimeText, { color: colors.textSecondary }]}>
                {formatDate(req.requested_date)}
              </Text>
              <Clock size={12} color={colors.textSecondary} />
              <Text style={[styles.dateTimeText, { color: colors.textSecondary }]}>
                {formatTime(req.requested_start_time)} – {formatTime(req.requested_end_time)}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.cardHeaderRight}>
          <View style={[styles.statusChip, { backgroundColor: cfg.bg }]}>
            <Text style={[styles.statusChipText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
          <ChevronDown
            size={16}
            color={colors.textSecondary}
            style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}
          />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={[styles.cardBody, { borderTopColor: colors.border }]}>
          {req.service_type ? (
            <InfoRow label="Service" value={req.service_type} colors={colors} />
          ) : null}
          {req.notes ? (
            <InfoRow label="Notes" value={req.notes} colors={colors} />
          ) : null}
          {displayEmail ? (
            <InfoRow label="Email" value={displayEmail} colors={colors} />
          ) : null}
          {hasPhone ? (
            <InfoRow label="Phone" value={getRequestPhone(req)} colors={colors} />
          ) : null}
          {isGuest && req.guest_notification_preference && (
            <InfoRow
              label="Notify via"
              value={req.guest_notification_preference === 'both' ? 'Email & Text' : req.guest_notification_preference === 'text' ? 'Text' : 'Email'}
              colors={colors}
            />
          )}
          <InfoRow
            label="Submitted"
            value={new Date(req.created_at).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
            })}
            colors={colors}
          />

          {req.phone_call_requested && (
            <View style={styles.callbackNote}>
              <PhoneCall size={14} color="#FF9500" />
              <Text style={styles.callbackNoteText}>
                This client tapped a busy slot and requested a callback to work out the timing.
              </Text>
            </View>
          )}

          {isGuest && !alreadyConverted && (
            <TouchableOpacity
              style={[styles.convertBtn, converting && { opacity: 0.6 }]}
              onPress={onConvert}
              disabled={converting}
            >
              {converting
                ? <ActivityIndicator size="small" color="#007AFF" />
                : <>
                    <UserPlus size={14} color="#007AFF" />
                    <Text style={styles.convertBtnText}>Convert to Client</Text>
                  </>}
            </TouchableOpacity>
          )}

          <View style={styles.actionRow}>
            {hasPhone && (
              <TouchableOpacity style={styles.callBtn} onPress={onCall}>
                <LinearGradient
                  colors={['#2D8B57', '#34a065']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.callBtnGradient}
                >
                  <Phone size={15} color="#fff" />
                  <Text style={styles.callBtnText}>Call</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
            {isPending && (
              <>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.approveBtn, updating && { opacity: 0.6 }]}
                  onPress={onApprove}
                  disabled={updating}
                >
                  <LinearGradient
                    colors={['#1B4D6E', '#245d82']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.approveBtnGradient}
                  >
                    {updating
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <><CheckCircle size={14} color="#fff" /><Text style={styles.actionBtnText}>Approve</Text></>}
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.declineBtn, updating && { opacity: 0.6 }]}
                  onPress={onDecline}
                  disabled={updating}
                >
                  {updating
                    ? <ActivityIndicator size="small" color="#FF3B30" />
                    : <><XCircle size={14} color="#FF3B30" /><Text style={styles.declineBtnText}>Decline</Text></>}
                </TouchableOpacity>
              </>
            )}
            {(req.status === 'approved' || isPending) && (
              <TouchableOpacity style={[styles.actionBtn, styles.scheduleJobBtn]} onPress={onSchedule}>
                <LinearGradient
                  colors={['#2D8B57', '#34a065']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.scheduleJobBtnGradient}
                >
                  <CalendarPlus size={14} color="#fff" />
                  <Text style={styles.actionBtnText}>Schedule Job</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

function InfoRow({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 20 : 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  headerSub: { fontSize: 13, color: '#FF9500', marginTop: 2, fontWeight: '500' },
  closeBtn: { padding: 4, marginTop: 2 },
  callbackBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    margin: 16, marginBottom: 4,
    padding: 12, backgroundColor: '#FFF9F0',
    borderRadius: 10, borderWidth: 1, borderColor: '#FF950030',
  },
  callbackBannerText: { flex: 1, fontSize: 13, color: '#664400', fontWeight: '500', lineHeight: 18 },
  filterRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12,
  },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, backgroundColor: '#F2F2F7',
  },
  filterChipActive: { backgroundColor: '#007AFF' },
  filterChipText: { fontSize: 13, fontWeight: '600', color: '#3C3C43' },
  filterChipTextActive: { color: '#fff' },
  filterBadge: {
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: '#C7C7CC', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
  filterBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  filterBadgeTextActive: { color: '#fff' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 10, paddingBottom: 48 },
  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600' },
  emptySub: { fontSize: 14, textAlign: 'center' },
  card: {
    backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 1, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  guestFlag: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 5,
    backgroundColor: '#F0F6FF',
  },
  guestFlagText: { fontSize: 11, color: '#007AFF', fontWeight: '600' },
  callbackFlag: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 5,
    backgroundColor: '#FFF9F0',
  },
  callbackFlagText: { fontSize: 11, color: '#FF9500', fontWeight: '600' },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', padding: 14, gap: 10,
  },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  clientAvatar: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  clientName: { fontSize: 15, fontWeight: '600' },
  dateTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3, flexWrap: 'wrap' },
  dateTimeText: { fontSize: 12 },
  cardHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  statusChip: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  statusChipText: { fontSize: 11, fontWeight: '700' },
  cardBody: { borderTopWidth: 1, padding: 14, gap: 8 },
  infoRow: { flexDirection: 'row', gap: 8 },
  infoLabel: { fontSize: 12, fontWeight: '600', minWidth: 56 },
  infoValue: { flex: 1, fontSize: 13, lineHeight: 18 },
  callbackNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    padding: 10, backgroundColor: '#FFF9F0', borderRadius: 8,
    marginTop: 4,
  },
  callbackNoteText: { flex: 1, fontSize: 12, color: '#664400', lineHeight: 17 },
  convertBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 8, borderRadius: 8,
    backgroundColor: '#007AFF12', borderWidth: 1, borderColor: '#007AFF30',
    marginTop: 4,
  },
  convertBtnText: { fontSize: 13, fontWeight: '600', color: '#007AFF' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  callBtn: {
    borderRadius: 9, overflow: 'hidden',
  },
  callBtnGradient: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  callBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  actionBtn: {
    flex: 1, borderRadius: 9, overflow: 'hidden',
  },
  approveBtn: {},
  approveBtnGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10,
  },
  scheduleJobBtn: {},
  scheduleJobBtnGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10,
  },
  declineBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10,
    backgroundColor: '#FFF2F0', borderWidth: 1, borderColor: '#FF3B3020',
  },
  actionBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  declineBtnText: { fontSize: 13, fontWeight: '600', color: '#FF3B30' },
});
