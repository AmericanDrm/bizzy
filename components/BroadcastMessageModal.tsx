import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  FlatList,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Send, Users, MessageSquare, ChevronDown, ChevronUp, Save, Trash2, Plus, Check, ListFilter as Filter, CircleAlert as AlertCircle } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useToast } from '@/contexts/ToastContext';
import { supabase, invokeFunction } from '@/lib/supabase';

interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  client_type?: string | null;
}

interface BroadcastTemplate {
  id: string;
  name: string;
  message: string;
  created_at: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  clients: Client[];
  filterLabel?: string;
}

export default function BroadcastMessageModal({ visible, onClose, clients, filterLabel }: Props) {
  const { colors } = useTheme();
  const { currentOrganization } = useOrganization();
  const { showToast } = useToast();

  const [message, setMessage] = useState('');
  const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set());
  const [templates, setTemplates] = useState<BroadcastTemplate[]>([]);
  const [templatesExpanded, setTemplatesExpanded] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendMethod, setSendMethod] = useState<'sms' | 'email'>('sms');
  const [sentCount, setSentCount] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [smsChannel, setSmsChannel] = useState<'native' | 'twilio'>('native');
  const [emailChannel, setEmailChannel] = useState<'native' | 'mailgun'>('native');

  const CLIENT_TYPES = ['residential', 'commercial', 'contractor'] as const;

  const hasClientTypes = clients.some(c => c.client_type);

  const visibleClients = typeFilter
    ? clients.filter(c => c.client_type === typeFilter)
    : clients;

  useEffect(() => {
    if (visible) {
      setSelectedClientIds(new Set(clients.map(c => c.id)));
      fetchTemplates();
      loadChannelPreferences();
      setMessage('');
      setShowSuccess(false);
      setSentCount(0);
      setTypeFilter(null);
    }
  }, [visible, clients]);

  const loadChannelPreferences = async () => {
    if (!currentOrganization) return;
    try {
      const { data } = await supabase
        .from('business_settings')
        .select('sms_send_channel, email_send_channel')
        .eq('organization_id', currentOrganization.id)
        .maybeSingle();
      if (data) {
        setSmsChannel((data.sms_send_channel as 'native' | 'twilio') || 'native');
        setEmailChannel((data.email_send_channel as 'native' | 'mailgun') || 'native');
      }
    } catch {}
  };

  const fetchTemplates = async () => {
    if (!currentOrganization) return;
    const { data } = await supabase
      .from('broadcast_templates')
      .select('*')
      .eq('organization_id', currentOrganization.id)
      .order('created_at', { ascending: false });
    setTemplates(data || []);
  };

  const toggleClient = (id: string) => {
    setSelectedClientIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const allVisibleSelected = visibleClients.every(c => selectedClientIds.has(c.id));
    if (allVisibleSelected) {
      setSelectedClientIds(prev => {
        const next = new Set(prev);
        visibleClients.forEach(c => next.delete(c.id));
        return next;
      });
    } else {
      setSelectedClientIds(prev => {
        const next = new Set(prev);
        visibleClients.forEach(c => next.add(c.id));
        return next;
      });
    }
  };

  const applyTemplate = (t: BroadcastTemplate) => {
    setMessage(t.message);
    setTemplatesExpanded(false);
  };

  const saveTemplate = async () => {
    if (!templateName.trim() || !message.trim() || !currentOrganization) return;
    setSavingTemplate(true);
    const { error } = await supabase.from('broadcast_templates').insert({
      organization_id: currentOrganization.id,
      name: templateName.trim(),
      message: message.trim(),
    });
    setSavingTemplate(false);
    if (error) {
      showToast({ message: 'Failed to save template', type: 'error', duration: 3000 });
    } else {
      setTemplateName('');
      setShowSaveForm(false);
      fetchTemplates();
      showToast({ message: 'Template saved', type: 'success', duration: 2000 });
    }
  };

  const deleteTemplate = async (id: string) => {
    await supabase.from('broadcast_templates').delete().eq('id', id);
    fetchTemplates();
  };

  const sendMessages = async () => {
    if (!message.trim() || selectedClientIds.size === 0 || !currentOrganization) return;
    setSending(true);

    const selected = clients.filter(c => selectedClientIds.has(c.id));
    let count = 0;
    let failed = 0;

    for (const client of selected) {
      if (sendMethod === 'sms' && client.phone) {
        const { error } = await invokeFunction('send-sms', {
          to: client.phone,
          body: message.replace('{client_name}', client.name),
          organization_id: currentOrganization.id,
        });
        if (!error) count++;
        else failed++;
      } else if (sendMethod === 'email' && client.email) {
        const personalizedMessage = message.replace('{client_name}', client.name);
        const html = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;"><p style="font-size:15px;line-height:1.6;color:#1e293b;">${personalizedMessage.replace(/\n/g, '<br/>')}</p></div>`;
        const { error } = await invokeFunction('send-tenant-email', {
          organizationId: currentOrganization.id,
          to: client.email,
          subject: `Message from ${currentOrganization.name || 'Your Service Provider'}`,
          html,
        });
        if (!error) count++;
        else failed++;
      }
    }

    setSending(false);
    if (failed > 0 && count === 0) {
      showToast({ message: `Failed to send messages. Check your email/SMS settings.`, type: 'error', duration: 4000 });
      return;
    }
    setSentCount(count);
    setShowSuccess(true);
    if (failed > 0) {
      showToast({ message: `${count} sent, ${failed} failed`, type: 'warning', duration: 4000 });
    }
    setTimeout(() => {
      setShowSuccess(false);
      onClose();
    }, 2500);
  };

  const visibleSelectedCount = visibleClients.filter(c => selectedClientIds.has(c.id)).length;
  const allVisibleSelected = visibleClients.length > 0 && visibleClients.every(c => selectedClientIds.has(c.id));
  const selectedCount = clients.filter(c => selectedClientIds.has(c.id)).length;
  const validRecipients = clients.filter(c =>
    selectedClientIds.has(c.id) && (sendMethod === 'sms' ? c.phone : c.email)
  ).length;

  const styles = getStyles(colors);

  if (showSuccess) {
    return (
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={[styles.successCard]}>
            <View style={styles.successIcon}>
              <Check size={32} color="#fff" />
            </View>
            <Text style={styles.successTitle}>Messages Sent!</Text>
            <Text style={styles.successSubtitle}>{sentCount} message{sentCount !== 1 ? 's' : ''} sent successfully</Text>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Broadcast Message</Text>
              {filterLabel && (
                <Text style={styles.subtitle}>{filterLabel}</Text>
              )}
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            <View style={styles.methodRow}>
              <TouchableOpacity
                style={[styles.methodBtn, sendMethod === 'sms' && styles.methodBtnActive]}
                onPress={() => setSendMethod('sms')}
              >
                <MessageSquare size={15} color={sendMethod === 'sms' ? '#fff' : colors.textSecondary} />
                <Text style={[styles.methodBtnText, sendMethod === 'sms' && styles.methodBtnTextActive]}>SMS</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.methodBtn, sendMethod === 'email' && styles.methodBtnActive]}
                onPress={() => setSendMethod('email')}
              >
                <Send size={15} color={sendMethod === 'email' ? '#fff' : colors.textSecondary} />
                <Text style={[styles.methodBtnText, sendMethod === 'email' && styles.methodBtnTextActive]}>Email</Text>
              </TouchableOpacity>
            </View>

            {((sendMethod === 'sms' && smsChannel === 'native') || (sendMethod === 'email' && emailChannel === 'native')) && (
              <View style={styles.nativeBanner}>
                <AlertCircle size={16} color="#b45309" />
                <Text style={styles.nativeBannerText}>
                  Bulk sending requires {sendMethod === 'sms' ? 'Twilio' : 'Mailgun'}. Go to Settings {'>'} {sendMethod === 'sms' ? 'SMS Setup' : 'Email Settings'} to configure automatic sending.
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.templateToggle}
              onPress={() => setTemplatesExpanded(!templatesExpanded)}
            >
              <MessageSquare size={15} color={colors.primary} />
              <Text style={styles.templateToggleText}>Saved Templates</Text>
              <View style={{ flex: 1 }} />
              {templates.length > 0 && (
                <View style={styles.templateBadge}>
                  <Text style={styles.templateBadgeText}>{templates.length}</Text>
                </View>
              )}
              {templatesExpanded ? (
                <ChevronUp size={16} color={colors.textSecondary} />
              ) : (
                <ChevronDown size={16} color={colors.textSecondary} />
              )}
            </TouchableOpacity>

            {templatesExpanded && (
              <View style={styles.templateList}>
                {templates.length === 0 ? (
                  <Text style={styles.noTemplatesText}>No saved templates yet. Save a message below to create one.</Text>
                ) : (
                  templates.map(t => (
                    <View key={t.id} style={styles.templateItem}>
                      <TouchableOpacity style={styles.templateItemBody} onPress={() => applyTemplate(t)}>
                        <Text style={styles.templateItemName}>{t.name}</Text>
                        <Text style={styles.templateItemMsg} numberOfLines={2}>{t.message}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => deleteTemplate(t.id)} style={styles.templateDeleteBtn}>
                        <Trash2 size={14} color={colors.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
            )}

            <View style={styles.sectionLabel}>
              <Text style={styles.sectionLabelText}>Message</Text>
              <Text style={styles.charCount}>{message.length} chars</Text>
            </View>
            <TextInput
              style={styles.messageInput}
              placeholder="Type your message... Use {client_name} to personalize"
              placeholderTextColor={colors.textSecondary}
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={4}
            />

            {message.trim().length > 0 && (
              <View style={styles.saveRow}>
                {showSaveForm ? (
                  <View style={styles.saveForm}>
                    <TextInput
                      style={styles.saveInput}
                      placeholder="Template name..."
                      placeholderTextColor={colors.textSecondary}
                      value={templateName}
                      onChangeText={setTemplateName}
                    />
                    <TouchableOpacity
                      style={[styles.saveConfirmBtn, !templateName.trim() && { opacity: 0.5 }]}
                      onPress={saveTemplate}
                      disabled={!templateName.trim() || savingTemplate}
                    >
                      <LinearGradient
                        colors={['#1B4D6E', '#245d82']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.saveConfirmBtnGradient}
                      >
                        {savingTemplate ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={styles.saveConfirmBtnText}>Save</Text>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setShowSaveForm(false)} style={styles.saveCancelBtn}>
                      <X size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.saveTemplateBtn} onPress={() => setShowSaveForm(true)}>
                    <Save size={14} color={colors.primary} />
                    <Text style={styles.saveTemplateBtnText}>Save as template</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <View style={[styles.sectionLabel, { marginTop: 16 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Users size={14} color={colors.textSecondary} />
                <Text style={styles.sectionLabelText}>Recipients ({selectedCount} of {clients.length})</Text>
              </View>
              <TouchableOpacity onPress={toggleAll}>
                <Text style={styles.selectAllText}>
                  {allVisibleSelected ? 'Deselect All' : 'Select All'}
                </Text>
              </TouchableOpacity>
            </View>

            {hasClientTypes && (
              <View style={styles.typeFilterRow}>
                <Filter size={13} color={colors.textSecondary} />
                <TouchableOpacity
                  style={[styles.typeFilterChip, !typeFilter && styles.typeFilterChipActive]}
                  onPress={() => setTypeFilter(null)}
                >
                  <Text style={[styles.typeFilterChipText, !typeFilter && styles.typeFilterChipTextActive]}>All</Text>
                </TouchableOpacity>
                {CLIENT_TYPES.map(type => {
                  const count = clients.filter(c => c.client_type === type).length;
                  if (count === 0) return null;
                  const isActive = typeFilter === type;
                  return (
                    <TouchableOpacity
                      key={type}
                      style={[styles.typeFilterChip, isActive && styles.typeFilterChipActive]}
                      onPress={() => setTypeFilter(isActive ? null : type)}
                    >
                      <Text style={[styles.typeFilterChipText, isActive && styles.typeFilterChipTextActive]}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </Text>
                      <View style={[styles.typeFilterBadge, isActive && styles.typeFilterBadgeActive]}>
                        <Text style={[styles.typeFilterBadgeText, isActive && styles.typeFilterBadgeTextActive]}>{count}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <View style={styles.clientGrid}>
              {visibleClients.map(client => {
                const isSelected = selectedClientIds.has(client.id);
                const hasContact = sendMethod === 'sms' ? !!client.phone : !!client.email;
                return (
                  <TouchableOpacity
                    key={client.id}
                    style={[
                      styles.clientChip,
                      isSelected && styles.clientChipSelected,
                      !hasContact && styles.clientChipDisabled,
                    ]}
                    onPress={() => toggleClient(client.id)}
                  >
                    {isSelected && <Check size={11} color={isSelected ? '#fff' : colors.textSecondary} style={{ marginRight: 3 }} />}
                    <Text
                      style={[
                        styles.clientChipText,
                        isSelected && styles.clientChipTextSelected,
                        !hasContact && styles.clientChipTextDisabled,
                      ]}
                      numberOfLines={1}
                    >
                      {client.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {validRecipients < selectedCount && (
              <Text style={styles.warningText}>
                {selectedCount - validRecipients} client{selectedCount - validRecipients !== 1 ? 's' : ''} missing {sendMethod === 'sms' ? 'phone number' : 'email'} and will be skipped.
              </Text>
            )}

            <View style={{ height: 120 }} />
          </ScrollView>

          <View style={styles.footer}>
            <View style={styles.footerInfo}>
              <Text style={styles.footerInfoText}>
                Sending to <Text style={styles.footerInfoBold}>{validRecipients}</Text> recipient{validRecipients !== 1 ? 's' : ''} via {sendMethod.toUpperCase()}
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.sendBtn,
                (!message.trim() || validRecipients === 0 || sending ||
                  (sendMethod === 'sms' && smsChannel === 'native') ||
                  (sendMethod === 'email' && emailChannel === 'native')) && styles.sendBtnDisabled,
              ]}
              onPress={sendMessages}
              disabled={!message.trim() || validRecipients === 0 || sending ||
                (sendMethod === 'sms' && smsChannel === 'native') ||
                (sendMethod === 'email' && emailChannel === 'native')}
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
                    <Text style={styles.sendBtnText}>Send Broadcast</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '92%',
      minHeight: '70%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 14,
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
      marginTop: 3,
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.inputBackground,
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: {
      paddingHorizontal: 20,
      paddingTop: 16,
    },
    methodRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 14,
    },
    methodBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 9,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.inputBackground,
    },
    methodBtnActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    methodBtnText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    methodBtnTextActive: {
      color: '#fff',
    },
    templateToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingVertical: 10,
      paddingHorizontal: 12,
      backgroundColor: colors.inputBackground,
      borderRadius: 10,
      marginBottom: 8,
    },
    templateToggleText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
    },
    templateBadge: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 5,
    },
    templateBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#fff',
    },
    templateList: {
      backgroundColor: colors.inputBackground,
      borderRadius: 10,
      marginBottom: 12,
      overflow: 'hidden',
    },
    noTemplatesText: {
      fontSize: 12,
      color: colors.textSecondary,
      padding: 14,
      textAlign: 'center',
    },
    templateItem: {
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    templateItemBody: {
      flex: 1,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    templateItemName: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 3,
    },
    templateItemMsg: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    templateDeleteBtn: {
      padding: 14,
    },
    sectionLabel: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    sectionLabelText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    charCount: {
      fontSize: 11,
      color: colors.textSecondary,
    },
    messageInput: {
      backgroundColor: colors.inputBackground,
      borderRadius: 12,
      padding: 14,
      fontSize: 14,
      color: colors.text,
      minHeight: 100,
      textAlignVertical: 'top',
      borderWidth: 1,
      borderColor: colors.border,
      ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
    },
    saveRow: {
      marginTop: 8,
    },
    saveForm: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
    },
    saveInput: {
      flex: 1,
      backgroundColor: colors.inputBackground,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 13,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
      ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
    },
    saveConfirmBtn: {
      borderRadius: 8,
      overflow: 'hidden',
    },
    saveConfirmBtnGradient: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveConfirmBtnText: {
      fontSize: 13,
      fontWeight: '600',
      color: '#fff',
    },
    saveCancelBtn: {
      padding: 6,
    },
    saveTemplateBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      alignSelf: 'flex-start',
    },
    saveTemplateBtnText: {
      fontSize: 12,
      color: colors.primary,
      fontWeight: '600',
    },
    selectAllText: {
      fontSize: 12,
      color: colors.primary,
      fontWeight: '600',
    },
    typeFilterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 10,
      flexWrap: 'wrap',
    },
    typeFilterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 16,
      backgroundColor: colors.inputBackground,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    typeFilterChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    typeFilterChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
    },
    typeFilterChipTextActive: {
      color: '#fff',
    },
    typeFilterBadge: {
      backgroundColor: colors.border,
      borderRadius: 8,
      minWidth: 18,
      height: 18,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    typeFilterBadgeActive: {
      backgroundColor: 'rgba(255,255,255,0.25)',
    },
    typeFilterBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    typeFilterBadgeTextActive: {
      color: '#fff',
    },
    clientGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    clientChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: colors.inputBackground,
      borderWidth: 1.5,
      borderColor: colors.border,
      maxWidth: 160,
    },
    clientChipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    clientChipDisabled: {
      opacity: 0.4,
    },
    clientChipText: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.text,
    },
    clientChipTextSelected: {
      color: '#fff',
    },
    clientChipTextDisabled: {
      color: colors.textSecondary,
    },
    warningText: {
      fontSize: 12,
      color: '#D97706',
      marginTop: 8,
      backgroundColor: '#FEF3C7',
      padding: 10,
      borderRadius: 8,
    },
    nativeBanner: {
      flexDirection: 'row' as const,
      alignItems: 'flex-start' as const,
      gap: 8,
      padding: 12,
      backgroundColor: '#fef3c7',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: '#fcd34d',
      marginBottom: 12,
    },
    nativeBannerText: {
      flex: 1,
      fontSize: 13,
      color: '#92400e',
      lineHeight: 18,
    },
    footer: {
      padding: 16,
      paddingBottom: Platform.OS === 'ios' ? 32 : 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: 10,
    },
    footerInfo: {
      alignItems: 'center',
    },
    footerInfoText: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    footerInfoBold: {
      fontWeight: '700',
      color: colors.text,
    },
    sendBtn: {
      borderRadius: 12,
      overflow: 'hidden',
    },
    sendBtnGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
    },
    sendBtnDisabled: {
      opacity: 0.45,
    },
    sendBtnText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#fff',
    },
    successCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 40,
      alignItems: 'center',
      marginHorizontal: 40,
    },
    successIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: '#16A34A',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    successTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 6,
    },
    successSubtitle: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
    },
  });
