import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Dimensions,
  Alert,
  TextInput,
  Modal,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FileText, Receipt, Calendar, LogOut, ChevronRight, CircleCheck as CheckCircle, Clock, CircleAlert as AlertCircle, User, Phone, Mail, Inbox, Building2, MessageSquare, MapPin, Download, X, CreditCard as Edit2, Save, Ban, Banknote } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { portalSupabase } from '@/lib/portalSupabase';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import PortalMessagesModal from '@/components/PortalMessagesModal';
import PaymentOptionsSheet from '@/components/PaymentOptionsSheet';

interface Invoice {
  id: string;
  invoice_number: string;
  total: number;
  subtotal: number;
  tax_amount: number;
  status: string;
  created_at: string;
  due_date?: string;
  notes?: string;
}

interface Estimate {
  id: string;
  estimate_number?: string;
  title?: string;
  total: number;
  status: string;
  created_at: string;
}

interface ScheduleEvent {
  id: string;
  title: string;
  scheduled_date: string;
  start_time?: string;
  status?: string;
}

interface WorkRequest {
  id: string;
  requested_date: string;
  requested_start_time: string;
  requested_end_time?: string;
  service_type: string;
  notes?: string;
  phone_call_requested?: boolean;
  status: string;
  admin_notes?: string;
  created_at: string;
}

interface ClientAddress {
  id: string;
  label?: string;
  address?: string;
  street?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  is_primary?: boolean;
  type?: string;
  access_code?: string;
}

interface PortalSettings {
  primary_color?: string;
  portal_title?: string;
  logo_url?: string;
  cancellation_hours_notice?: number;
}

function shiftColor(hex: string, amount: number): string {
  try {
    const r = Math.max(0, Math.min(255, parseInt(hex.slice(1, 3), 16) + amount));
    const g = Math.max(0, Math.min(255, parseInt(hex.slice(3, 5), 16) + amount));
    const b = Math.max(0, Math.min(255, parseInt(hex.slice(5, 7), 16) + amount));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  } catch {
    return hex;
  }
}

export default function PortalDashboard() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { session, portalClient, portalAccount, loading: authLoading, signOut, refreshPortalClient } = usePortalAuth();

  const [stripeSuccess, setStripeSuccess] = useState(false);
  const [stripeCancel, setStripeCancel] = useState(false);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [schedule, setSchedule] = useState<ScheduleEvent[]>([]);
  const [workRequests, setWorkRequests] = useState<WorkRequest[]>([]);
  const [addresses, setAddresses] = useState<ClientAddress[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [portalSettings, setPortalSettings] = useState<PortalSettings>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showMessages, setShowMessages] = useState(false);
  const [editingAddress, setEditingAddress] = useState<ClientAddress | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editAccess, setEditAccess] = useState('');
  const [savingAddress, setSavingAddress] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);

  const [editingProfile, setEditingProfile] = useState(false);
  const [editProfileName, setEditProfileName] = useState('');
  const [editProfilePhone, setEditProfilePhone] = useState('');
  const [editProfileNotif, setEditProfileNotif] = useState<'email' | 'text' | 'both' | 'none'>('email');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');

  const primaryColor = portalSettings?.primary_color || '#007AFF';

  useEffect(() => {
    if (!authLoading && !session) {
      router.replace(`/portal/${slug}`);
    }
  }, [authLoading, session]);

  useEffect(() => {
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    if (params.get('stripe_success') === 'true') {
      setStripeSuccess(true);
      setTimeout(() => setStripeSuccess(false), 8000);
    }
    if (params.get('stripe_cancel') === 'true') {
      setStripeCancel(true);
      setTimeout(() => setStripeCancel(false), 8000);
    }
  }, []);

  useEffect(() => {
    if (session && portalClient) {
      loadData();
      loadSettings();
    }
  }, [session, portalClient]);

  const loadSettings = async () => {
    try {
      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/portal-public-api?action=settings&slug=${slug}`,
        { headers: { apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '' } }
      );
      const data = await res.json();
      if (data?.settings) setPortalSettings(data.settings);
    } catch {}
  };

  const loadData = async () => {
    setLoading(true);
    await Promise.all([
      loadInvoices(),
      loadEstimates(),
      loadSchedule(),
      loadWorkRequests(),
      loadAddresses(),
      loadUnreadCount(),
    ]);
    setLoading(false);
  };

  const loadInvoices = async () => {
    const { data } = await portalSupabase
      .from('invoices')
      .select('id, invoice_number, total, subtotal, tax_amount, status, created_at, due_date, notes')
      .order('created_at', { ascending: false })
      .limit(10);
    setInvoices(data || []);
  };

  const loadEstimates = async () => {
    const { data } = await portalSupabase
      .from('estimates')
      .select('id, estimate_number, title, total, status, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    setEstimates(data || []);
  };

  const loadSchedule = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await portalSupabase
      .from('schedule_events')
      .select('id, title, scheduled_date, start_time, status')
      .gte('scheduled_date', today)
      .order('scheduled_date', { ascending: true })
      .limit(5);
    setSchedule(data || []);
  };

  const loadWorkRequests = async () => {
    if (!portalClient?.id) return;
    const { data } = await portalSupabase
      .from('client_work_requests')
      .select('id, requested_date, requested_start_time, requested_end_time, service_type, notes, phone_call_requested, status, admin_notes, created_at')
      .eq('client_id', portalClient.id)
      .order('created_at', { ascending: false })
      .limit(10);
    setWorkRequests(data || []);
  };

  const loadAddresses = async () => {
    if (!portalClient?.id) return;
    const { data } = await portalSupabase
      .from('client_addresses')
      .select('id, label, address, street, city, state, postal_code, is_primary, type, access_code')
      .eq('client_id', portalClient.id)
      .order('is_primary', { ascending: false });
    setAddresses(data || []);
  };

  const loadUnreadCount = async () => {
    if (!portalClient?.id || !portalAccount?.organization_id) return;
    const { count } = await portalSupabase
      .from('portal_messages')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', portalClient.id)
      .eq('organization_id', portalAccount.organization_id)
      .eq('sender_type', 'org')
      .eq('is_read', false);
    setUnreadCount(count || 0);
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace(`/portal/${slug}`);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleDownloadInvoice = (inv: Invoice) => {
    if (Platform.OS !== 'web') return;
    const html = buildInvoiceHtml(inv);
    const win = (window as any).open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.onload = () => {
        win.focus();
        win.print();
      };
    }
  };

  const handleCancelRequest = async (req: WorkRequest) => {
    if (Platform.OS === 'web') {
      if (!window.confirm(`Cancel your booking request for ${formatDate(req.requested_date)}?`)) return;
    } else {
      Alert.alert(
        'Cancel Booking',
        `Cancel your request for ${formatDate(req.requested_date)}?`,
        [
          { text: 'No', style: 'cancel' },
          { text: 'Yes, Cancel', style: 'destructive', onPress: () => doCancelRequest(req.id) },
        ]
      );
      return;
    }
    doCancelRequest(req.id);
  };

  const doCancelRequest = async (id: string) => {
    setCancellingId(id);
    try {
      await portalSupabase
        .from('client_work_requests')
        .update({ status: 'cancelled' })
        .eq('id', id);
      setWorkRequests((prev) => prev.map((r) => r.id === id ? { ...r, status: 'cancelled' } : r));
    } catch {
    } finally {
      setCancellingId(null);
    }
  };

  const openEditAddress = (addr: ClientAddress) => {
    setEditingAddress(addr);
    setEditLabel(addr.label || '');
    setEditAccess(addr.access_code || '');
  };

  const handleSaveAddress = async () => {
    if (!editingAddress) return;
    setSavingAddress(true);
    try {
      await portalSupabase
        .from('client_addresses')
        .update({ label: editLabel.trim() || null, access_code: editAccess.trim() || null })
        .eq('id', editingAddress.id);
      setAddresses((prev) => prev.map((a) =>
        a.id === editingAddress.id ? { ...a, label: editLabel.trim(), access_code: editAccess.trim() } : a
      ));
      setEditingAddress(null);
    } catch {
    } finally {
      setSavingAddress(false);
    }
  };

  const openEditProfile = () => {
    setEditProfileName(portalClient?.name || '');
    setEditProfilePhone(portalClient?.phone || '');
    setEditProfileNotif((portalClient as any)?.notification_preference || 'email');
    setProfileError('');
    setEditingProfile(true);
  };

  const handleSaveProfile = async () => {
    if (!editProfileName.trim() || editProfileName.trim().length < 2) {
      setProfileError('Name must be at least 2 characters.');
      return;
    }
    setSavingProfile(true);
    setProfileError('');
    try {
      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/portal-public-api`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
            'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
          },
          body: JSON.stringify({
            action: 'update_profile',
            name: editProfileName.trim(),
            phone: editProfilePhone.trim() || null,
            notification_preference: editProfileNotif,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setProfileError(data?.error || 'Failed to save changes.');
        return;
      }
      await refreshPortalClient();
      setEditingProfile(false);
    } catch {
      setProfileError('Something went wrong. Please try again.');
    } finally {
      setSavingProfile(false);
    }
  };

  const { width } = Dimensions.get('window');
  const isWide = width > 768;

  if (authLoading || loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={primaryColor} />
      </View>
    );
  }

  if (!portalClient) {
    return (
      <View style={styles.loadingWrap}>
        <AlertCircle size={40} color="#FF3B30" />
        <Text style={styles.errorTitle}>Access Denied</Text>
        <Text style={styles.errorSub}>Your account doesn't have portal access.</Text>
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutBtnText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const pendingInvoices = invoices.filter((i) => i.status === 'pending' || i.status === 'sent' || i.status === 'overdue');
  const openEstimates = estimates.filter((e) => e.status === 'sent' || e.status === 'draft');
  const activeRequests = workRequests.filter((r) => r.status !== 'cancelled');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {portalSettings.logo_url ? (
            <Image source={{ uri: portalSettings.logo_url }} style={styles.logoImg} resizeMode="contain" />
          ) : (
            <View style={[styles.avatarWrap, { backgroundColor: primaryColor + '12' }]}>
              <User size={20} color={primaryColor} />
            </View>
          )}
          <View>
            <Text style={styles.headerGreeting}>Welcome back,</Text>
            <Text style={styles.headerName}>{portalClient.name.split(' ')[0]}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => setShowMessages(true)}
          >
            <MessageSquare size={22} color="#3C3C43" />
            {unreadCount > 0 && (
              <View style={[styles.badge, { backgroundColor: primaryColor }]}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} onPress={handleSignOut}>
            <LogOut size={20} color="#8E8E93" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, isWide && styles.scrollContentWide]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {stripeSuccess && (
          <View style={styles.stripeBanner}>
            <CheckCircle size={18} color="#34C759" />
            <Text style={styles.stripeBannerText}>Payment successful! Your invoice has been updated.</Text>
          </View>
        )}
        {stripeCancel && (
          <View style={[styles.stripeBanner, { backgroundColor: '#FF3B3010' }]}>
            <X size={18} color="#FF3B30" />
            <Text style={[styles.stripeBannerText, { color: '#FF3B30' }]}>Payment was cancelled. You can try again anytime.</Text>
          </View>
        )}
        {unreadCount > 0 && (
          <TouchableOpacity
            style={[styles.notifBanner, { borderLeftColor: primaryColor }]}
            onPress={() => setShowMessages(true)}
            activeOpacity={0.7}
          >
            <View style={[styles.notifBannerDot, { backgroundColor: primaryColor }]} />
            <Text style={styles.notifBannerText}>
              You have {unreadCount} unread message{unreadCount > 1 ? 's' : ''}
            </Text>
            <ChevronRight size={16} color={primaryColor} />
          </TouchableOpacity>
        )}

        {(pendingInvoices.length > 0 || openEstimates.length > 0) && (
          <View style={styles.alertCard}>
            <AlertCircle size={16} color="#FF9500" />
            <Text style={styles.alertText}>
              {pendingInvoices.length > 0
                ? `You have ${pendingInvoices.length} unpaid invoice${pendingInvoices.length > 1 ? 's' : ''}`
                : `You have ${openEstimates.length} estimate${openEstimates.length > 1 ? 's' : ''} awaiting review`}
            </Text>
          </View>
        )}

        <View style={[styles.quickActionsRow, isWide && styles.quickActionsRowWide]}>
          <TouchableOpacity
            style={[styles.quickBtn, { overflow: 'hidden' }]}
            onPress={() => router.push(`/portal/${slug}/schedule` as any)}
          >
            <LinearGradient
              colors={[primaryColor, shiftColor(primaryColor, -20)] as [string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.quickBtnGradient}
            >
              <View style={styles.quickBtnIcon}>
                <Calendar size={20} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.quickBtnTitle}>Schedule</Text>
                <Text style={styles.quickBtnSub}>Book an appointment</Text>
              </View>
              <ChevronRight size={18} color="rgba(255,255,255,0.7)" />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickBtnSecondary, { borderColor: primaryColor + '30' }]}
            onPress={() => setShowMessages(true)}
          >
            <View style={[styles.quickBtnIconSecondary, { backgroundColor: primaryColor + '12' }]}>
              <MessageSquare size={20} color={primaryColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.quickBtnTitleSecondary, { color: primaryColor }]}>Messages</Text>
              <Text style={styles.quickBtnSubSecondary}>
                {unreadCount > 0 ? `${unreadCount} new message${unreadCount > 1 ? 's' : ''}` : 'Contact us'}
              </Text>
            </View>
            {unreadCount > 0 && (
              <View style={[styles.inlineBadge, { backgroundColor: primaryColor }]}>
                <Text style={styles.badgeText}>{unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={[styles.statsRow, isWide && styles.statsRowWide]}>
          <StatCard
            icon={<Receipt size={20} color={primaryColor} />}
            label="Invoices"
            value={invoices.length}
            sub={pendingInvoices.length > 0 ? `${pendingInvoices.length} pending` : 'All paid'}
            color={primaryColor}
            badge={pendingInvoices.length}
          />
          <StatCard
            icon={<FileText size={20} color="#34C759" />}
            label="Estimates"
            value={estimates.length}
            sub={openEstimates.length > 0 ? `${openEstimates.length} open` : 'Up to date'}
            color="#34C759"
            badge={openEstimates.length}
          />
          <StatCard
            icon={<Calendar size={20} color="#FF9500" />}
            label="Upcoming"
            value={schedule.length}
            sub={schedule.length > 0 ? 'Appointments' : 'None scheduled'}
            color="#FF9500"
          />
        </View>

        {schedule.length > 0 && (
          <Section title="Upcoming Appointments" icon={<Calendar size={18} color="#FF9500" />}>
            {schedule.map((event) => (
              <View key={event.id} style={styles.listItem}>
                <View style={styles.listItemLeft}>
                  <View style={[styles.listItemDot, { backgroundColor: '#FF950018' }]}>
                    <Calendar size={14} color="#FF9500" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.listItemTitle} numberOfLines={1}>{event.title}</Text>
                    <Text style={styles.listItemSub}>
                      {formatDate(event.scheduled_date)}
                      {event.start_time ? `  •  ${formatTime(event.start_time)}` : ''}
                    </Text>
                  </View>
                </View>
                {event.status && (
                  <StatusChip status={event.status} />
                )}
              </View>
            ))}
          </Section>
        )}

        {invoices.length > 0 && (
          <Section
            title="Invoices"
            icon={<Receipt size={18} color={primaryColor} />}
            badge={pendingInvoices.length}
            badgeColor={primaryColor}
          >
            {invoices.slice(0, 5).map((inv) => (
              <View key={inv.id} style={styles.listItem}>
                <View style={styles.listItemLeft}>
                  <View style={[styles.listItemDot, { backgroundColor: statusColor(inv.status) + '18' }]}>
                    {statusIcon(inv.status)}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.listItemTitle}>
                      {inv.invoice_number ? `Invoice #${inv.invoice_number}` : 'Invoice'}
                    </Text>
                    <Text style={styles.listItemSub}>{formatDate(inv.created_at)}</Text>
                  </View>
                </View>
                <View style={styles.listItemRight}>
                  <Text style={styles.listItemAmount}>${Number(inv.total || 0).toFixed(2)}</Text>
                  <View style={styles.invoiceActions}>
                    <StatusChip status={inv.status} />
                    {(inv.status === 'pending' || inv.status === 'sent' || inv.status === 'overdue') && (
                      <TouchableOpacity
                        style={[styles.payBtn, { backgroundColor: primaryColor + '15' }]}
                        onPress={() => { setPaymentInvoice(inv); setShowPayment(true); }}
                        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                      >
                        <Banknote size={13} color={primaryColor} />
                        <Text style={[styles.payBtnText, { color: primaryColor }]}>Pay</Text>
                      </TouchableOpacity>
                    )}
                    {Platform.OS === 'web' && (
                      <TouchableOpacity
                        style={styles.downloadBtn}
                        onPress={() => handleDownloadInvoice(inv)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Download size={14} color="#8E8E93" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            ))}
          </Section>
        )}

        {estimates.length > 0 && (
          <Section
            title="Estimates"
            icon={<FileText size={18} color="#34C759" />}
            badge={openEstimates.length}
            badgeColor="#34C759"
          >
            {estimates.slice(0, 5).map((est) => (
              <View key={est.id} style={styles.listItem}>
                <View style={styles.listItemLeft}>
                  <View style={[styles.listItemDot, { backgroundColor: '#34C75918' }]}>
                    <FileText size={14} color="#34C759" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.listItemTitle} numberOfLines={1}>
                      {est.title || (est.estimate_number ? `Estimate #${est.estimate_number}` : 'Estimate')}
                    </Text>
                    <Text style={styles.listItemSub}>{formatDate(est.created_at)}</Text>
                  </View>
                </View>
                <View style={styles.listItemRight}>
                  <Text style={styles.listItemAmount}>${Number(est.total || 0).toFixed(2)}</Text>
                  <StatusChip status={est.status} />
                </View>
              </View>
            ))}
          </Section>
        )}

        {activeRequests.length > 0 && (
          <Section title="My Booking Requests" icon={<Inbox size={18} color="#5856D6" />}>
            {workRequests.map((req) => {
              const rColor = reqStatusColor(req.status);
              const isCancellable = req.status === 'pending';
              return (
                <View key={req.id} style={styles.listItem}>
                  <View style={styles.listItemLeft}>
                    <View style={[styles.listItemDot, { backgroundColor: rColor + '18' }]}>
                      {req.status === 'approved' || req.status === 'completed'
                        ? <CheckCircle size={14} color={rColor} />
                        : req.status === 'declined' || req.status === 'cancelled'
                        ? <Ban size={14} color={rColor} />
                        : <Clock size={14} color={rColor} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.listItemTitle} numberOfLines={1}>
                        {req.service_type || 'Service Request'}
                      </Text>
                      <Text style={styles.listItemSub}>
                        {req.requested_date ? formatDate(req.requested_date) : formatDate(req.created_at)}
                        {req.requested_start_time ? `  •  ${formatTime(req.requested_start_time)}` : ''}
                      </Text>
                      {req.admin_notes ? (
                        <Text style={[styles.listItemSub, { color: rColor, marginTop: 2 }]} numberOfLines={1}>
                          {req.admin_notes}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <View style={styles.listItemRight}>
                    <View style={[styles.chip, { backgroundColor: rColor + '18' }]}>
                      <Text style={[styles.chipText, { color: rColor }]}>{reqStatusLabel(req.status)}</Text>
                    </View>
                    {isCancellable && (
                      <TouchableOpacity
                        style={styles.cancelReqBtn}
                        onPress={() => handleCancelRequest(req)}
                        disabled={cancellingId === req.id}
                      >
                        {cancellingId === req.id
                          ? <ActivityIndicator size="small" color="#FF3B30" />
                          : <X size={14} color="#FF3B30" />}
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </Section>
        )}

        {addresses.length > 0 && (
          <Section title="My Properties" icon={<MapPin size={18} color="#FF9500" />}>
            {addresses.map((addr) => {
              const fullAddress = addr.address || [addr.street, addr.city, addr.state, addr.postal_code].filter(Boolean).join(', ');
              return (
                <View key={addr.id} style={styles.listItem}>
                  <View style={styles.listItemLeft}>
                    <View style={[styles.listItemDot, { backgroundColor: '#FF950018' }]}>
                      <MapPin size={14} color="#FF9500" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.propRow}>
                        {addr.is_primary && (
                          <View style={styles.primaryBadge}>
                            <Text style={styles.primaryBadgeText}>Primary</Text>
                          </View>
                        )}
                        <Text style={styles.listItemTitle} numberOfLines={1}>
                          {addr.label || addr.type || 'Property'}
                        </Text>
                      </View>
                      {fullAddress ? (
                        <Text style={styles.listItemSub} numberOfLines={2}>{fullAddress}</Text>
                      ) : null}
                      {addr.access_code ? (
                        <Text style={[styles.listItemSub, { color: '#3C3C43' }]}>Access: {addr.access_code}</Text>
                      ) : null}
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() => openEditAddress(addr)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Edit2 size={15} color="#8E8E93" />
                  </TouchableOpacity>
                </View>
              );
            })}
          </Section>
        )}

        {invoices.length === 0 && estimates.length === 0 && schedule.length === 0 && addresses.length === 0 && (
          <View style={styles.emptyState}>
            <Building2 size={48} color="#C7C7CC" />
            <Text style={styles.emptyTitle}>Nothing here yet</Text>
            <Text style={styles.emptySub}>Your invoices, estimates, and appointments will appear here.</Text>
          </View>
        )}

        <View style={styles.clientCard}>
          <View style={styles.clientCardHeader}>
            <Text style={styles.clientCardTitle}>Your Contact Info</Text>
            <TouchableOpacity style={styles.editBtn} onPress={openEditProfile} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Edit2 size={15} color="#8E8E93" />
            </TouchableOpacity>
          </View>
          {portalClient.email ? (
            <View style={styles.contactRow}>
              <Mail size={15} color="#8E8E93" />
              <Text style={styles.contactText}>{portalClient.email}</Text>
            </View>
          ) : null}
          {portalClient.phone ? (
            <View style={styles.contactRow}>
              <Phone size={15} color="#8E8E93" />
              <Text style={styles.contactText}>{portalClient.phone}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Powered by <Text style={styles.footerBrand}>ToolBox</Text></Text>
        </View>
      </ScrollView>

      <PortalMessagesModal
        visible={showMessages}
        onClose={() => setShowMessages(false)}
        onMessagesRead={() => setUnreadCount(0)}
        primaryColor={primaryColor}
      />

      <PaymentOptionsSheet
        visible={showPayment}
        onClose={() => { setShowPayment(false); setPaymentInvoice(null); }}
        slug={slug}
        invoiceAmount={paymentInvoice?.total}
        invoiceNumber={paymentInvoice?.invoice_number}
        invoiceId={paymentInvoice?.id}
        primaryColor={primaryColor}
      />

      <Modal
        visible={!!editingAddress}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => setEditingAddress(null)}
      >
        <View style={styles.editModal}>
          <View style={styles.editModalHeader}>
            <TouchableOpacity onPress={() => setEditingAddress(null)}>
              <X size={22} color="#1C1C1E" />
            </TouchableOpacity>
            <Text style={styles.editModalTitle}>Edit Property</Text>
            <TouchableOpacity onPress={handleSaveAddress} disabled={savingAddress}>
              {savingAddress
                ? <ActivityIndicator size="small" color={primaryColor} />
                : <Save size={20} color={primaryColor} />}
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 16 }}>
            <View>
              <Text style={styles.editFieldLabel}>Property Label</Text>
              <TextInput
                style={[styles.editInput, { ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}) }]}
                value={editLabel}
                onChangeText={setEditLabel}
                placeholder="e.g. Home, Office, Vacation..."
                placeholderTextColor="#C7C7CC"
              />
            </View>
            <View>
              <Text style={styles.editFieldLabel}>Access Code / Entry Notes</Text>
              <TextInput
                style={[styles.editInput, { minHeight: 80, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}) }]}
                value={editAccess}
                onChangeText={setEditAccess}
                placeholder="Gate code, key lockbox, entry instructions..."
                placeholderTextColor="#C7C7CC"
                multiline
                textAlignVertical="top"
              />
            </View>
            {editingAddress && (
              <View style={styles.addressReadOnly}>
                <Text style={styles.addressReadOnlyLabel}>Address (contact us to update)</Text>
                <Text style={styles.addressReadOnlyText}>
                  {editingAddress.address ||
                    [editingAddress.street, editingAddress.city, editingAddress.state, editingAddress.postal_code]
                      .filter(Boolean).join(', ') || 'No address on file'}
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={editingProfile}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => setEditingProfile(false)}
      >
        <View style={styles.editModal}>
          <View style={styles.editModalHeader}>
            <TouchableOpacity onPress={() => setEditingProfile(false)}>
              <X size={22} color="#1C1C1E" />
            </TouchableOpacity>
            <Text style={styles.editModalTitle}>Edit Contact Info</Text>
            <TouchableOpacity onPress={handleSaveProfile} disabled={savingProfile}>
              {savingProfile
                ? <ActivityIndicator size="small" color={primaryColor} />
                : <Save size={20} color={primaryColor} />}
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 16 }}>
            {profileError ? (
              <View style={styles.profileErrorBanner}>
                <Text style={styles.profileErrorText}>{profileError}</Text>
              </View>
            ) : null}
            <View>
              <Text style={styles.editFieldLabel}>Full Name</Text>
              <TextInput
                style={[styles.editInput, { ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}) }]}
                value={editProfileName}
                onChangeText={setEditProfileName}
                placeholder="Your full name"
                placeholderTextColor="#C7C7CC"
                autoCapitalize="words"
              />
            </View>
            <View>
              <Text style={styles.editFieldLabel}>Phone Number</Text>
              <TextInput
                style={[styles.editInput, { ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}) }]}
                value={editProfilePhone}
                onChangeText={setEditProfilePhone}
                placeholder="Your phone number"
                placeholderTextColor="#C7C7CC"
                keyboardType="phone-pad"
              />
            </View>
            <View>
              <Text style={styles.editFieldLabel}>Notification Preference</Text>
              <View style={styles.notifChips}>
                {(['email', 'text', 'both', 'none'] as const).map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[
                      styles.notifChip,
                      editProfileNotif === opt && { backgroundColor: primaryColor, borderColor: primaryColor },
                    ]}
                    onPress={() => setEditProfileNotif(opt)}
                  >
                    <Text style={[
                      styles.notifChipText,
                      editProfileNotif === opt && { color: '#fff' },
                    ]}>
                      {opt.charAt(0).toUpperCase() + opt.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function Section({ title, icon, children, badge, badgeColor }: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  badge?: number;
  badgeColor?: string;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        {icon}
        <Text style={styles.sectionTitle}>{title}</Text>
        {badge && badge > 0 ? (
          <View style={[styles.sectionBadge, { backgroundColor: (badgeColor || '#FF9500') + '18' }]}>
            <Text style={[styles.sectionBadgeText, { color: badgeColor || '#FF9500' }]}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <View>{children}</View>
    </View>
  );
}

function StatCard({ icon, label, value, sub, color, badge }: {
  icon: React.ReactNode; label: string; value: number; sub: string; color: string; badge?: number;
}) {
  return (
    <View style={[styles.statCard, { borderTopColor: color }]}>
      <View style={{ position: 'relative' }}>
        <View style={[styles.statIconWrap, { backgroundColor: color + '12' }]}>{icon}</View>
        {badge && badge > 0 ? (
          <View style={[styles.statBadge, { backgroundColor: color }]}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statSub}>{sub}</Text>
    </View>
  );
}

function StatusChip({ status }: { status: string }) {
  const color = statusColor(status);
  return (
    <View style={[styles.chip, { backgroundColor: color + '18' }]}>
      <Text style={[styles.chipText, { color }]}>{statusLabel(status)}</Text>
    </View>
  );
}

function statusColor(s: string) {
  switch (s) {
    case 'paid': return '#34C759';
    case 'overdue': return '#FF3B30';
    case 'sent': return '#007AFF';
    case 'approved': return '#34C759';
    case 'draft': return '#8E8E93';
    case 'scheduled': return '#34C759';
    case 'completed': return '#34C759';
    case 'cancelled': return '#8E8E93';
    default: return '#FF9500';
  }
}

function statusLabel(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Pending';
}

function statusIcon(s: string) {
  if (s === 'paid') return <CheckCircle size={14} color="#34C759" />;
  if (s === 'overdue') return <AlertCircle size={14} color="#FF3B30" />;
  return <Clock size={14} color="#FF9500" />;
}

function reqStatusColor(s: string) {
  if (s === 'approved') return '#34C759';
  if (s === 'declined') return '#FF3B30';
  if (s === 'cancelled') return '#8E8E93';
  if (s === 'completed') return '#34C759';
  return '#FF9500';
}

function reqStatusLabel(s: string) {
  if (s === 'approved') return 'Approved';
  if (s === 'declined') return 'Declined';
  if (s === 'cancelled') return 'Cancelled';
  if (s === 'completed') return 'Completed';
  return 'Pending';
}

function formatDate(d: string) {
  try {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return d; }
}

function formatTime(t: string) {
  try {
    const [h, m] = t.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  } catch { return t; }
}

function buildInvoiceHtml(inv: Invoice): string {
  const num = inv.invoice_number ? `#${inv.invoice_number}` : '';
  const issued = formatDate(inv.created_at);
  const due = inv.due_date ? formatDate(inv.due_date) : 'N/A';
  const subtotal = Number(inv.subtotal || inv.total || 0).toFixed(2);
  const tax = Number(inv.tax_amount || 0).toFixed(2);
  const total = Number(inv.total || 0).toFixed(2);
  const statusTxt = inv.status ? inv.status.charAt(0).toUpperCase() + inv.status.slice(1) : '';
  return `<!DOCTYPE html><html><head><title>Invoice ${num}</title>
  <style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:680px;margin:40px auto;padding:0 24px;color:#1C1C1E}
  h1{font-size:28px;font-weight:700;margin:0 0 4px}
  .meta{color:#8E8E93;font-size:14px;margin-bottom:32px}
  .row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #F2F2F7;font-size:15px}
  .row.total{font-weight:700;font-size:17px;border-top:2px solid #1C1C1E;border-bottom:none;margin-top:8px}
  .badge{display:inline-block;padding:3px 10px;border-radius:6px;font-size:12px;font-weight:600;
    background:${inv.status === 'paid' ? '#34C75920' : '#FF950020'};
    color:${inv.status === 'paid' ? '#34C759' : '#FF9500'}}
  .notes{margin-top:24px;background:#F9F9F9;border-radius:10px;padding:14px;font-size:14px;color:#3C3C43}
  @media print{body{margin:20px}}</style></head><body>
  <h1>Invoice ${num}</h1>
  <div class="meta">Issued ${issued} &nbsp;•&nbsp; Due ${due} &nbsp;•&nbsp; <span class="badge">${statusTxt}</span></div>
  <div class="row"><span>Subtotal</span><span>$${subtotal}</span></div>
  <div class="row"><span>Tax</span><span>$${tax}</span></div>
  <div class="row total"><span>Total</span><span>$${total}</span></div>
  ${inv.notes ? `<div class="notes">${inv.notes}</div>` : ''}
  </body></html>`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 },
  errorTitle: { fontSize: 20, fontWeight: '700', color: '#1C1C1E' },
  errorSub: { fontSize: 15, color: '#8E8E93', textAlign: 'center', lineHeight: 22 },
  signOutBtn: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: '#F2F2F7', borderRadius: 10 },
  signOutBtnText: { fontSize: 15, fontWeight: '600', color: '#FF3B30' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 56 : 20,
    paddingBottom: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  logoImg: { width: 40, height: 40, borderRadius: 8 },
  avatarWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerGreeting: { fontSize: 12, color: '#8E8E93' },
  headerName: { fontSize: 18, fontWeight: '700', color: '#1C1C1E' },
  headerIconBtn: { padding: 8, position: 'relative' },
  badge: {
    position: 'absolute', top: 4, right: 4,
    minWidth: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12, paddingBottom: 48 },
  scrollContentWide: { maxWidth: 800, alignSelf: 'center' as any, width: '100%', paddingHorizontal: 24 },
  alertCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFF9F0', borderRadius: 12, padding: 14,
    borderLeftWidth: 3, borderLeftColor: '#FF9500',
  },
  alertText: { flex: 1, fontSize: 14, color: '#664400', fontWeight: '500' },
  quickActionsRow: { flexDirection: 'column', gap: 10 },
  quickActionsRowWide: { flexDirection: 'row' },
  quickBtn: {
    borderRadius: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15, shadowRadius: 10, elevation: 4,
    flex: 1,
  },
  quickBtnGradient: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  quickBtnIcon: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center',
  },
  quickBtnTitle: { fontSize: 15, fontWeight: '700', color: '#fff' },
  quickBtnSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
  quickBtnSecondary: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#fff', borderWidth: 1.5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
    flex: 1,
  },
  quickBtnIconSecondary: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  quickBtnTitleSecondary: { fontSize: 15, fontWeight: '700' },
  quickBtnSubSecondary: { fontSize: 12, color: '#8E8E93', marginTop: 1 },
  inlineBadge: {
    minWidth: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5,
  },
  statsRow: { flexDirection: 'row', gap: 10 },
  statsRowWide: { gap: 14 },
  statCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 12,
    alignItems: 'center', gap: 3, borderTopWidth: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  statIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  statBadge: {
    position: 'absolute', top: -4, right: -4,
    minWidth: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  statValue: { fontSize: 22, fontWeight: '700', color: '#1C1C1E' },
  statLabel: { fontSize: 12, fontWeight: '600', color: '#3C3C43' },
  statSub: { fontSize: 11, color: '#8E8E93', textAlign: 'center' },
  section: {
    backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: '#F2F2F7',
  },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#1C1C1E', flex: 1 },
  sectionBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  sectionBadgeText: { fontSize: 11, fontWeight: '700' },
  listItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F2F2F7',
  },
  listItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  listItemDot: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  listItemTitle: { fontSize: 14, fontWeight: '500', color: '#1C1C1E' },
  listItemSub: { fontSize: 12, color: '#8E8E93', marginTop: 1 },
  listItemRight: { alignItems: 'flex-end', gap: 4, marginLeft: 8, flexShrink: 0 },
  listItemAmount: { fontSize: 14, fontWeight: '600', color: '#1C1C1E' },
  invoiceActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  downloadBtn: { padding: 4 },
  payBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  payBtnText: { fontSize: 11, fontWeight: '700' },
  notifBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    borderLeftWidth: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  notifBannerDot: { width: 8, height: 8, borderRadius: 4 },
  notifBannerText: { flex: 1, fontSize: 14, color: '#1C1C1E', fontWeight: '500' },
  stripeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#34C75910', borderRadius: 12, padding: 14,
    marginBottom: 4,
  },
  stripeBannerText: { flex: 1, fontSize: 14, color: '#34C759', fontWeight: '600' },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  chipText: { fontSize: 11, fontWeight: '600' },
  cancelReqBtn: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: '#FFF2F2', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#FF3B3020',
  },
  propRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  primaryBadge: {
    backgroundColor: '#34C75918', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4,
  },
  primaryBadgeText: { fontSize: 10, fontWeight: '600', color: '#34C759' },
  editBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: '#F2F2F7', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#3C3C43' },
  emptySub: { fontSize: 14, color: '#8E8E93', textAlign: 'center', lineHeight: 20 },
  clientCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  clientCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  clientCardTitle: { fontSize: 14, fontWeight: '600', color: '#3C3C43' },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  contactText: { fontSize: 14, color: '#3C3C43' },
  profileErrorBanner: {
    backgroundColor: '#FFF2F2', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#FF3B3020',
  },
  profileErrorText: { fontSize: 14, color: '#FF3B30' },
  notifChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  notifChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: '#E5E5EA', backgroundColor: '#F2F2F7',
  },
  notifChipText: { fontSize: 14, fontWeight: '500', color: '#3C3C43' },
  footer: { alignItems: 'center', paddingTop: 4 },
  footerText: { fontSize: 12, color: '#C7C7CC' },
  footerBrand: { fontWeight: '600', color: '#8E8E93' },
  editModal: { flex: 1, backgroundColor: '#F2F2F7' },
  editModalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 56 : 20, paddingBottom: 14,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F2F2F7',
  },
  editModalTitle: { fontSize: 17, fontWeight: '600', color: '#1C1C1E' },
  editFieldLabel: { fontSize: 13, fontWeight: '500', color: '#8E8E93', marginBottom: 6 },
  editInput: {
    backgroundColor: '#fff', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#1C1C1E',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  addressReadOnly: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  addressReadOnlyLabel: { fontSize: 12, color: '#8E8E93', marginBottom: 4, fontWeight: '500' },
  addressReadOnlyText: { fontSize: 15, color: '#3C3C43', lineHeight: 21 },
});
