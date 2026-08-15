import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { Bell, CircleCheck as CheckCircle, Mail, MessageSquare, Smartphone, X, TriangleAlert as AlertTriangle, Send } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { fetchFunction } from '@/lib/supabase';

interface JobCompletionNotifyModalProps {
  visible: boolean;
  jobTitle: string;
  clientName: string;
  scheduleEventId: string;
  completedAt: string;
  onClose: () => void;
  onSkip: () => void;
}

type SendState = 'idle' | 'sending' | 'success' | 'error';

interface ChannelResult {
  email: boolean;
  sms: boolean;
  push: boolean;
}

export default function JobCompletionNotifyModal({
  visible,
  jobTitle,
  clientName,
  scheduleEventId,
  completedAt,
  onClose,
  onSkip,
}: JobCompletionNotifyModalProps) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();

  const [notes, setNotes] = useState('');
  const [sendState, setSendState] = useState<SendState>('idle');
  const [channelsSucceeded, setChannelsSucceeded] = useState<ChannelResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSend = async () => {
    if (!user || !currentOrganization) return;

    setSendState('sending');
    setErrorMessage('');

    // Get employee display name
    let employeeName = user.email ?? 'Employee';
    try {
      const { supabase } = await import('@/lib/supabase');
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .maybeSingle();
      if (profile?.display_name) employeeName = profile.display_name;
    } catch {}

    try {
      const result = await fetchFunction('notify-job-completion', {
        body: {
          organizationId: currentOrganization.id,
          scheduleEventId,
          employeeUserId: user.id,
          employeeName,
          jobTitle,
          clientName: clientName || '',
          completedAt,
          notes: notes.trim(),
        },
      });

      if (result?.channelsSucceeded) {
        setChannelsSucceeded(result.channelsSucceeded);
      } else {
        setChannelsSucceeded({ email: false, sms: false, push: false });
      }
      setSendState('success');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to send notifications. Please try again.');
      setSendState('error');
    }
  };

  const handleRetry = () => {
    setSendState('idle');
    setErrorMessage('');
    setChannelsSucceeded(null);
  };

  const handleClose = () => {
    setNotes('');
    setSendState('idle');
    setErrorMessage('');
    setChannelsSucceeded(null);
    onClose();
  };

  const s = makeStyles(colors);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={sendState === 'success' ? handleClose : onSkip}
    >
      <View style={s.overlay}>
        <View style={s.sheet}>
          {/* Handle bar */}
          <View style={s.handle} />

          {/* Header */}
          <View style={s.header}>
            <View style={s.headerIcon}>
              <Bell size={20} color="#1B4D6E" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>Notify Management</Text>
              <Text style={s.subtitle} numberOfLines={1}>
                {jobTitle}{clientName ? ` — ${clientName}` : ''}
              </Text>
            </View>
            <TouchableOpacity
              onPress={sendState === 'success' ? handleClose : onSkip}
              style={s.closeBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={s.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {sendState === 'success' ? (
              <SuccessView channelsSucceeded={channelsSucceeded} colors={colors} s={s} />
            ) : sendState === 'error' ? (
              <ErrorView
                message={errorMessage}
                onRetry={handleRetry}
                onSkip={onSkip}
                colors={colors}
                s={s}
              />
            ) : (
              <IdleView
                jobTitle={jobTitle}
                clientName={clientName}
                notes={notes}
                onNotesChange={setNotes}
                colors={colors}
                s={s}
              />
            )}
          </ScrollView>

          {/* Footer */}
          {sendState === 'idle' || sendState === 'sending' ? (
            <View style={s.footer}>
              <TouchableOpacity style={s.skipBtn} onPress={onSkip} disabled={sendState === 'sending'}>
                <Text style={[s.skipText, { color: colors.textSecondary }]}>Skip</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.sendBtn, sendState === 'sending' && { opacity: 0.7 }]}
                onPress={handleSend}
                disabled={sendState === 'sending'}
              >
                {sendState === 'sending' ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Send size={16} color="#fff" />
                    <Text style={s.sendText}>Notify Management</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : sendState === 'success' ? (
            <View style={s.footer}>
              <TouchableOpacity style={[s.sendBtn, { backgroundColor: '#2D8B57' }]} onPress={handleClose}>
                <CheckCircle size={16} color="#fff" />
                <Text style={s.sendText}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function IdleView({
  jobTitle, clientName, notes, onNotesChange, colors, s,
}: {
  jobTitle: string; clientName: string; notes: string;
  onNotesChange: (v: string) => void; colors: any; s: any;
}) {
  return (
    <>
      <View style={s.infoBox}>
        <AlertTriangle size={16} color="#b45309" />
        <Text style={s.infoText}>
          You don't have permission to create invoices. Your manager will be notified so they can handle billing.
        </Text>
      </View>

      <View style={s.detailCard}>
        <Text style={s.detailLabel}>Job</Text>
        <Text style={s.detailValue}>{jobTitle}</Text>
        {!!clientName && (
          <>
            <Text style={[s.detailLabel, { marginTop: 10 }]}>Client</Text>
            <Text style={s.detailValue}>{clientName}</Text>
          </>
        )}
        <Text style={[s.detailLabel, { marginTop: 10 }]}>Completed</Text>
        <Text style={s.detailValue}>
          {new Date().toLocaleString('en-US', {
            month: 'short', day: 'numeric',
            hour: 'numeric', minute: '2-digit', hour12: true,
          })}
        </Text>
      </View>

      <View style={s.channelRow}>
        <ChannelChip icon={<Mail size={13} color="#1B4D6E" />} label="Email" />
        <ChannelChip icon={<MessageSquare size={13} color="#1B4D6E" />} label="SMS" />
        <ChannelChip icon={<Smartphone size={13} color="#1B4D6E" />} label="Push" />
      </View>

      <View style={s.notesSection}>
        <Text style={[s.notesLabel, { color: colors.text }]}>Add a note (optional)</Text>
        <TextInput
          style={[s.notesInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
          value={notes}
          onChangeText={onNotesChange}
          placeholder="Any details for your manager..."
          placeholderTextColor={colors.textSecondary}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          maxLength={500}
        />
        {notes.length > 400 && (
          <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 4, textAlign: 'right' }}>
            {notes.length}/500
          </Text>
        )}
      </View>
    </>
  );
}

function SuccessView({ channelsSucceeded, colors, s }: { channelsSucceeded: ChannelResult | null; colors: any; s: any }) {
  const succeeded = channelsSucceeded
    ? Object.entries(channelsSucceeded).filter(([, v]) => v).map(([k]) => k)
    : [];

  return (
    <View style={s.successContainer}>
      <View style={s.successIconWrap}>
        <CheckCircle size={48} color="#2D8B57" />
      </View>
      <Text style={[s.successTitle, { color: colors.text }]}>Management Notified</Text>
      <Text style={[s.successBody, { color: colors.textSecondary }]}>
        Your manager has been alerted about the completed job and will handle the invoice.
      </Text>
      {succeeded.length > 0 && (
        <View style={s.channelRow}>
          {succeeded.includes('email') && (
            <ChannelChip icon={<CheckCircle size={13} color="#2D8B57" />} label="Email" success />
          )}
          {succeeded.includes('sms') && (
            <ChannelChip icon={<CheckCircle size={13} color="#2D8B57" />} label="SMS" success />
          )}
          {succeeded.includes('push') && (
            <ChannelChip icon={<CheckCircle size={13} color="#2D8B57" />} label="Push" success />
          )}
        </View>
      )}
    </View>
  );
}

function ErrorView({
  message, onRetry, onSkip, colors, s,
}: { message: string; onRetry: () => void; onSkip: () => void; colors: any; s: any }) {
  return (
    <View style={s.errorContainer}>
      <AlertTriangle size={40} color="#dc2626" />
      <Text style={[s.errorTitle, { color: colors.text }]}>Notification Failed</Text>
      <Text style={[s.errorBody, { color: colors.textSecondary }]}>
        {message || 'Something went wrong. You can retry or skip and notify your manager manually.'}
      </Text>
      <TouchableOpacity style={s.retryBtn} onPress={onRetry}>
        <Text style={s.retryText}>Try Again</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onSkip} style={{ marginTop: 12 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Skip</Text>
      </TouchableOpacity>
    </View>
  );
}

function ChannelChip({ icon, label, success = false }: { icon: React.ReactNode; label: string; success?: boolean }) {
  return (
    <View style={[chipStyle.chip, success && chipStyle.chipSuccess]}>
      {icon}
      <Text style={[chipStyle.label, success && chipStyle.labelSuccess]}>{label}</Text>
    </View>
  );
}

const chipStyle = StyleSheet.create({
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, backgroundColor: '#EFF6FF',
    borderWidth: 1, borderColor: '#BFDBFE',
  },
  chipSuccess: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  label: { fontSize: 12, color: '#1B4D6E', fontWeight: '600' },
  labelSuccess: { color: '#166534' },
});

function makeStyles(colors: any) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '88%',
      paddingBottom: Platform.OS === 'ios' ? 32 : 20,
    },
    handle: {
      width: 36, height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
      alignSelf: 'center',
      marginTop: 10, marginBottom: 4,
    },
    header: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 20, paddingVertical: 14,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    headerIcon: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: '#EFF6FF',
      alignItems: 'center', justifyContent: 'center',
    },
    title: { fontSize: 16, fontWeight: '700', color: colors.text },
    subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 1 },
    closeBtn: {
      width: 32, height: 32, borderRadius: 16,
      backgroundColor: colors.surface,
      alignItems: 'center', justifyContent: 'center',
    },
    body: { padding: 20, gap: 16 },
    infoBox: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 10,
      backgroundColor: '#FEF9C3',
      borderRadius: 10, padding: 12,
      borderWidth: 1, borderColor: '#FDE68A',
    },
    infoText: { flex: 1, fontSize: 13, color: '#92400E', lineHeight: 18 },
    detailCard: {
      backgroundColor: colors.surface,
      borderRadius: 12, padding: 16,
      borderWidth: 1, borderColor: colors.border,
    },
    detailLabel: { fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
    detailValue: { fontSize: 15, fontWeight: '600', color: colors.text, marginTop: 2 },
    channelRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    notesSection: { gap: 6 },
    notesLabel: { fontSize: 14, fontWeight: '600' },
    notesInput: {
      borderWidth: 1, borderRadius: 10,
      paddingHorizontal: 12, paddingVertical: 10,
      fontSize: 14, minHeight: 80,
    },
    footer: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingHorizontal: 20, paddingTop: 12,
      borderTopWidth: 1, borderTopColor: colors.border,
    },
    skipBtn: { paddingHorizontal: 16, paddingVertical: 12 },
    skipText: { fontSize: 14, fontWeight: '500' },
    sendBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 8, backgroundColor: '#1B4D6E',
      borderRadius: 12, paddingVertical: 13,
    },
    sendText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    // Success
    successContainer: { alignItems: 'center', paddingVertical: 24, gap: 12 },
    successIconWrap: {
      width: 80, height: 80, borderRadius: 40,
      backgroundColor: '#F0FDF4',
      alignItems: 'center', justifyContent: 'center',
    },
    successTitle: { fontSize: 20, fontWeight: '700' },
    successBody: { fontSize: 14, textAlign: 'center', lineHeight: 20, maxWidth: 280 },
    // Error
    errorContainer: { alignItems: 'center', paddingVertical: 24, gap: 12 },
    errorTitle: { fontSize: 18, fontWeight: '700' },
    errorBody: { fontSize: 14, textAlign: 'center', lineHeight: 20, maxWidth: 280 },
    retryBtn: {
      backgroundColor: '#1B4D6E', borderRadius: 10,
      paddingHorizontal: 28, paddingVertical: 11, marginTop: 8,
    },
    retryText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  });
}
