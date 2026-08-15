import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X, Send, MessageSquare, Bookmark, Trash2, ChevronRight, User, Phone } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';

interface QuickSendTemplate {
  id: string;
  name: string;
  message: string;
  sort_order: number;
}

interface ContactOption {
  label: string;
  name: string;
  phone: string;
  isPrimary: boolean;
}

interface ClientQuickSendModalProps {
  visible: boolean;
  onClose: () => void;
  clientName: string;
  primaryPhone: string;
  secondaryContactName?: string;
  secondaryPhone?: string;
}

const DEFAULT_TEMPLATES = [
  { name: 'On My Way', message: 'Hi, this is a reminder that we are on our way to your location today. We will arrive shortly!' },
  { name: 'Reminder', message: 'Hi! Just a friendly reminder that we have a scheduled appointment coming up. Please let us know if you need to reschedule.' },
  { name: 'All Finished', message: 'Hi! We have finished up at your property. Thank you for your business — we appreciate it!' },
  { name: 'Running Late', message: 'Hi, we wanted to let you know that we are running a bit behind schedule. We will be there soon — thank you for your patience!' },
  { name: 'Confirm Appointment', message: 'Hi! We are confirming your upcoming appointment. Please reply to confirm or let us know if you need to make any changes.' },
];

export default function ClientQuickSendModal({
  visible,
  onClose,
  clientName,
  primaryPhone,
  secondaryContactName,
  secondaryPhone,
}: ClientQuickSendModalProps) {
  const [templates, setTemplates] = useState<QuickSendTemplate[]>([]);
  const [selectedContact, setSelectedContact] = useState<ContactOption | null>(null);
  const [messageText, setMessageText] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [showTemplateList, setShowTemplateList] = useState(false);
  const [sending, setSending] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const { currentOrganization } = useOrganization();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const styles = getStyles(colors);

  const contacts: ContactOption[] = [
    ...(primaryPhone ? [{ label: 'Primary', name: clientName, phone: primaryPhone, isPrimary: true }] : []),
    ...(secondaryPhone ? [{
      label: 'Secondary',
      name: secondaryContactName || 'Secondary Contact',
      phone: secondaryPhone,
      isPrimary: false,
    }] : []),
  ];

  useEffect(() => {
    if (visible) {
      if (contacts.length > 0) setSelectedContact(contacts[0]);
      setMessageText('');
      setShowSaveTemplate(false);
      setShowTemplateList(false);
      setTemplateName('');
      fetchTemplates();
    }
  }, [visible]);

  const fetchTemplates = async () => {
    if (!currentOrganization?.id) return;
    setLoadingTemplates(true);
    const { data } = await supabase
      .from('quick_send_templates')
      .select('id, name, message, sort_order')
      .eq('organization_id', currentOrganization.id)
      .order('sort_order')
      .order('created_at');
    setTemplates(data || []);
    setLoadingTemplates(false);
  };

  const handleSelectTemplate = (msg: string) => {
    setMessageText(msg);
    setShowTemplateList(false);
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim() || !messageText.trim() || !currentOrganization?.id) return;
    setSavingTemplate(true);
    const { error } = await supabase.from('quick_send_templates').insert({
      organization_id: currentOrganization.id,
      name: templateName.trim(),
      message: messageText.trim(),
      sort_order: templates.length,
    });
    setSavingTemplate(false);
    if (!error) {
      showToast({ message: 'Template saved', type: 'success' });
      setTemplateName('');
      setShowSaveTemplate(false);
      fetchTemplates();
    } else {
      showToast({ message: 'Failed to save template', type: 'error' });
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    const { error } = await supabase.from('quick_send_templates').delete().eq('id', id);
    if (!error) {
      setTemplates(prev => prev.filter(t => t.id !== id));
      showToast({ message: 'Template deleted', type: 'info' });
    }
  };

  const handleSend = async () => {
    if (!messageText.trim() || !selectedContact || !currentOrganization?.id) return;
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
      const response = await fetch(`${supabaseUrl}/functions/v1/send-sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          organization_id: currentOrganization.id,
          to: selectedContact.phone,
          body: messageText.trim(),
        }),
      });

      const result = await response.json();
      if (!response.ok || result.error) {
        throw new Error(result.error || 'Failed to send message');
      }
      showToast({ message: `Message sent to ${selectedContact.name}`, type: 'success' });
      onClose();
    } catch (err: any) {
      showToast({ message: err.message || 'Failed to send message', type: 'error', duration: 5000 });
    } finally {
      setSending(false);
    }
  };

  const allTemplates = [
    ...templates,
    ...DEFAULT_TEMPLATES.filter(dt => !templates.some(t => t.name === dt.name)).map((dt, i) => ({
      id: `default-${i}`,
      name: dt.name,
      message: dt.message,
      sort_order: 999,
    })),
  ];

  const canSend = !!messageText.trim() && !!selectedContact;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.backdrop}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Quick Message</Text>
              <Text style={styles.subtitle}>{clientName}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
            {contacts.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Send To</Text>
                <View style={styles.contactRow}>
                  {contacts.map(c => (
                    <TouchableOpacity
                      key={c.phone}
                      style={[styles.contactChip, selectedContact?.phone === c.phone && styles.contactChipActive]}
                      onPress={() => setSelectedContact(c)}
                    >
                      <User size={13} color={selectedContact?.phone === c.phone ? '#fff' : colors.textSecondary} />
                      <View>
                        <Text style={[styles.contactChipLabel, selectedContact?.phone === c.phone && styles.contactChipLabelActive]}>
                          {c.label}
                        </Text>
                        <Text style={[styles.contactChipName, selectedContact?.phone === c.phone && styles.contactChipNameActive]}>
                          {c.name}
                        </Text>
                        <View style={styles.contactChipPhone}>
                          <Phone size={11} color={selectedContact?.phone === c.phone ? 'rgba(255,255,255,0.75)' : colors.textSecondary} />
                          <Text style={[styles.contactChipPhoneText, selectedContact?.phone === c.phone && styles.contactChipPhoneTextActive]}>
                            {c.phone}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {contacts.length === 0 && (
              <View style={styles.noPhoneWarning}>
                <Phone size={16} color="#92400e" />
                <Text style={styles.noPhoneText}>No phone numbers saved for this client.</Text>
              </View>
            )}

            <View style={styles.section}>
              <View style={styles.messageLabelRow}>
                <Text style={styles.sectionLabel}>Message</Text>
                <TouchableOpacity
                  style={styles.templatePickerBtn}
                  onPress={() => setShowTemplateList(!showTemplateList)}
                >
                  <Bookmark size={13} color="#1B4D6E" />
                  <Text style={styles.templatePickerBtnText}>Templates</Text>
                  <ChevronRight
                    size={13}
                    color="#1B4D6E"
                    style={{ transform: [{ rotate: showTemplateList ? '90deg' : '0deg' }] }}
                  />
                </TouchableOpacity>
              </View>

              {showTemplateList && (
                <View style={styles.templateList}>
                  {loadingTemplates ? (
                    <ActivityIndicator size="small" color="#1B4D6E" style={{ padding: 12 }} />
                  ) : allTemplates.length === 0 ? (
                    <Text style={styles.emptyTemplateText}>No templates yet</Text>
                  ) : (
                    allTemplates.map(t => (
                      <View key={t.id} style={styles.templateItem}>
                        <TouchableOpacity
                          style={styles.templateItemContent}
                          onPress={() => handleSelectTemplate(t.message)}
                        >
                          <Text style={styles.templateItemName}>{t.name}</Text>
                          <Text style={styles.templateItemMsg} numberOfLines={2}>{t.message}</Text>
                        </TouchableOpacity>
                        {!t.id.startsWith('default-') && (
                          <TouchableOpacity
                            style={styles.templateDeleteBtn}
                            onPress={() => handleDeleteTemplate(t.id)}
                          >
                            <Trash2 size={14} color="#dc2626" />
                          </TouchableOpacity>
                        )}
                      </View>
                    ))
                  )}
                </View>
              )}

              <TextInput
                style={styles.messageInput}
                value={messageText}
                onChangeText={setMessageText}
                placeholder="Type your message..."
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
              />

              <TouchableOpacity
                style={styles.saveTemplateToggle}
                onPress={() => setShowSaveTemplate(!showSaveTemplate)}
              >
                <Bookmark size={13} color="#1B4D6E" />
                <Text style={styles.saveTemplateToggleText}>Save as template</Text>
              </TouchableOpacity>

              {showSaveTemplate && (
                <View style={styles.saveTemplateRow}>
                  <TextInput
                    style={styles.templateNameInput}
                    value={templateName}
                    onChangeText={setTemplateName}
                    placeholder="Template name (e.g. On My Way)"
                    placeholderTextColor={colors.textSecondary}
                  />
                  <TouchableOpacity
                    style={[styles.saveTemplateBtn, { overflow: 'hidden' }, (!templateName.trim() || savingTemplate) && styles.saveBtnDisabled]}
                    onPress={handleSaveTemplate}
                    disabled={!templateName.trim() || savingTemplate}
                  >
                    <LinearGradient
                      colors={['#1B4D6E', '#245d82']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.saveTemplateBtnGradient}
                    >
                      {savingTemplate ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.saveTemplateBtnText}>Save</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sendBtn, { overflow: 'hidden' }, (!canSend || sending) && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!canSend || sending}
            >
              <LinearGradient
                colors={['#1B4D6E', '#245d82']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.sendBtnGradient}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Send size={16} color="#fff" />
                    <Text style={styles.sendBtnText}>Send Message</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function getStyles(colors: any) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '90%',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    subtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    closeBtn: {
      padding: 4,
    },
    body: {
      paddingHorizontal: 20,
    },
    section: {
      marginTop: 20,
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 10,
    },
    contactRow: {
      flexDirection: 'row',
      gap: 10,
      flexWrap: 'wrap',
    },
    contactChip: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
      flex: 1,
      minWidth: 140,
    },
    contactChipActive: {
      borderColor: '#1B4D6E',
      backgroundColor: '#1B4D6E',
    },
    contactChipLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    contactChipLabelActive: {
      color: 'rgba(255,255,255,0.7)',
    },
    contactChipName: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginTop: 1,
    },
    contactChipNameActive: {
      color: '#fff',
    },
    contactChipPhone: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 3,
    },
    contactChipPhoneText: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    contactChipPhoneTextActive: {
      color: 'rgba(255,255,255,0.75)',
    },
    noPhoneWarning: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: '#fef3c7',
      borderRadius: 10,
      padding: 14,
      marginTop: 16,
    },
    noPhoneText: {
      fontSize: 14,
      color: '#92400e',
    },
    messageLabelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    templatePickerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#1B4D6E',
    },
    templatePickerBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#1B4D6E',
    },
    templateList: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      marginBottom: 12,
      overflow: 'hidden',
    },
    emptyTemplateText: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
      padding: 16,
    },
    templateItem: {
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    templateItemContent: {
      flex: 1,
      padding: 12,
    },
    templateItemName: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    templateItemMsg: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
      lineHeight: 17,
    },
    templateDeleteBtn: {
      padding: 12,
    },
    messageInput: {
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 14,
      fontSize: 15,
      color: colors.text,
      minHeight: 120,
      backgroundColor: colors.background,
    },
    saveTemplateToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 10,
      alignSelf: 'flex-start',
    },
    saveTemplateToggleText: {
      fontSize: 13,
      color: '#1B4D6E',
      fontWeight: '500',
    },
    saveTemplateRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 10,
      marginBottom: 4,
    },
    templateNameInput: {
      flex: 1,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 10,
      fontSize: 14,
      color: colors.text,
      backgroundColor: colors.background,
    },
    saveTemplateBtn: {
      borderRadius: 10,
      minWidth: 64,
    },
    saveTemplateBtnGradient: {
      paddingHorizontal: 16,
      justifyContent: 'center',
      alignItems: 'center',
      flex: 1,
    },
    saveBtnDisabled: {
      opacity: 0.4,
    },
    saveTemplateBtnText: {
      color: '#fff',
      fontWeight: '600',
      fontSize: 14,
    },
    footer: {
      flexDirection: 'row',
      gap: 12,
      padding: 20,
      paddingBottom: Platform.OS === 'ios' ? 32 : 20,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    cancelBtn: {
      flex: 1,
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    cancelBtnText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    sendBtn: {
      flex: 2,
      borderRadius: 12,
    },
    sendBtnGradient: {
      padding: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    sendBtnDisabled: {
      opacity: 0.4,
    },
    sendBtnText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#fff',
    },
  });
}
