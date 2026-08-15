import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Send, MessageSquare, Building2 } from 'lucide-react-native';
import { portalSupabase } from '@/lib/portalSupabase';
import { usePortalAuth } from '@/contexts/PortalAuthContext';

interface PortalMessage {
  id: string;
  sender_type: 'client' | 'org';
  message: string;
  is_read: boolean;
  created_at: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onMessagesRead?: () => void;
  primaryColor?: string;
}

export default function PortalMessagesModal({ visible, onClose, onMessagesRead, primaryColor = '#007AFF' }: Props) {
  const { portalClient, portalAccount } = usePortalAuth();
  const [messages, setMessages] = useState<PortalMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (visible && portalClient && portalAccount) {
      loadMessages();
    }
  }, [visible, portalClient, portalAccount]);

  const loadMessages = async () => {
    if (!portalClient || !portalAccount) return;
    setLoading(true);
    try {
      const { data } = await portalSupabase
        .from('portal_messages')
        .select('id, sender_type, message, is_read, created_at')
        .eq('client_id', portalClient.id)
        .eq('organization_id', portalAccount.organization_id)
        .order('created_at', { ascending: true });

      setMessages(data || []);

      const unread = (data || []).filter((m: PortalMessage) => m.sender_type === 'org' && !m.is_read);
      if (unread.length > 0) {
        await portalSupabase
          .from('portal_messages')
          .update({ is_read: true })
          .in('id', unread.map((m: PortalMessage) => m.id));
        onMessagesRead?.();
      }

      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !portalClient || !portalAccount) return;
    setSending(true);
    setDraft('');
    try {
      const { data, error } = await portalSupabase
        .from('portal_messages')
        .insert({
          organization_id: portalAccount.organization_id,
          client_id: portalClient.id,
          portal_account_id: portalAccount.id,
          sender_type: 'client',
          message: text,
          is_read: false,
        })
        .select('id, sender_type, message, is_read, created_at')
        .single();

      if (!error && data) {
        setMessages((prev) => [...prev, data]);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
      }
    } catch {
    } finally {
      setSending(false);
    }
  };

  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts);
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      if (isToday) {
        return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      }
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
        ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } catch {
      return '';
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <X size={24} color="#1C1C1E" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <MessageSquare size={18} color={primaryColor} />
            <Text style={styles.headerTitle}>Messages</Text>
          </View>
          <View style={{ width: 32 }} />
        </View>

        {loading ? (
          <View style={styles.centerWrap}>
            <ActivityIndicator size="large" color={primaryColor} />
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={[styles.emptyIcon, { backgroundColor: primaryColor + '12' }]}>
              <MessageSquare size={32} color={primaryColor} />
            </View>
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptySub}>
              Send a message to the team and they'll reply here.
            </Text>
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
          >
            {messages.map((msg, idx) => {
              const isClient = msg.sender_type === 'client';
              const showDate =
                idx === 0 ||
                new Date(messages[idx - 1].created_at).toDateString() !==
                  new Date(msg.created_at).toDateString();
              return (
                <React.Fragment key={msg.id}>
                  {showDate && (
                    <View style={styles.dateDivider}>
                      <View style={styles.dateDividerLine} />
                      <Text style={styles.dateDividerText}>
                        {new Date(msg.created_at).toLocaleDateString('en-US', {
                          weekday: 'short', month: 'short', day: 'numeric',
                        })}
                      </Text>
                      <View style={styles.dateDividerLine} />
                    </View>
                  )}
                  <View style={[styles.bubbleRow, isClient ? styles.bubbleRowRight : styles.bubbleRowLeft]}>
                    {!isClient && (
                      <View style={styles.orgAvatar}>
                        <Building2 size={14} color="#fff" />
                      </View>
                    )}
                    <View style={[
                      styles.bubble,
                      isClient
                        ? [styles.bubbleClient, { backgroundColor: primaryColor }]
                        : styles.bubbleOrg,
                    ]}>
                      <Text style={[styles.bubbleText, isClient ? styles.bubbleTextClient : styles.bubbleTextOrg]}>
                        {msg.message}
                      </Text>
                      <Text style={[styles.bubbleTime, isClient ? styles.bubbleTimeClient : styles.bubbleTimeOrg]}>
                        {formatTime(msg.created_at)}
                      </Text>
                    </View>
                  </View>
                </React.Fragment>
              );
            })}
            <View style={{ height: 8 }} />
          </ScrollView>
        )}

        <View style={styles.inputBar}>
          <TextInput
            style={[styles.input, { ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}) }]}
            placeholder="Type a message..."
            placeholderTextColor="#C7C7CC"
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={1000}
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[styles.sendBtn, { overflow: 'hidden', backgroundColor: draft.trim() ? undefined : '#E5E5EA' }]}
            onPress={handleSend}
            disabled={!draft.trim() || sending}
          >
            {draft.trim() ? (
              <LinearGradient
                colors={['#1B4D6E', '#245d82']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.sendBtnGradient}
              >
                {sending
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Send size={18} color="#fff" />}
              </LinearGradient>
            ) : (
              sending
                ? <ActivityIndicator size="small" color="#fff" />
                : <Send size={18} color="#8E8E93" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
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
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#1C1C1E' },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 12 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#1C1C1E' },
  emptySub: { fontSize: 14, color: '#8E8E93', textAlign: 'center', lineHeight: 20 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingTop: 20 },
  dateDivider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 16 },
  dateDividerLine: { flex: 1, height: 1, backgroundColor: '#E5E5EA' },
  dateDividerText: { fontSize: 12, color: '#8E8E93', fontWeight: '500' },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 8, gap: 8 },
  bubbleRowLeft: { justifyContent: 'flex-start' },
  bubbleRowRight: { justifyContent: 'flex-end' },
  orgAvatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#8E8E93',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  bubble: {
    maxWidth: '78%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, gap: 3,
  },
  bubbleClient: { borderBottomRightRadius: 4 },
  bubbleOrg: { backgroundColor: '#fff', borderBottomLeftRadius: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  bubbleTextClient: { color: '#fff' },
  bubbleTextOrg: { color: '#1C1C1E' },
  bubbleTime: { fontSize: 10, alignSelf: 'flex-end' },
  bubbleTimeClient: { color: 'rgba(255,255,255,0.7)' },
  bubbleTimeOrg: { color: '#C7C7CC' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  input: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    color: '#1C1C1E',
    maxHeight: 120,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  sendBtnGradient: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
});
