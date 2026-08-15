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
  Alert,
  Switch,
} from 'react-native';
import { X, MessageSquare, Bell, Briefcase, Mail } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useToast } from '@/contexts/ToastContext';

interface SmsTemplate {
  id?: string;
  template_type: string;
  message_text: string;
  send_automatically: boolean;
  send_interval_value: number;
  send_interval_unit: string;
  send_interval_timing: string;
}

interface EmailFollowUpTemplate {
  id?: string;
  subject: string;
  body: string;
}

interface MessageTemplatesModalProps {
  visible: boolean;
  onClose: () => void;
}

type TabKey = 'quick_actions' | 'reminder' | 'job_created';

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: 'quick_actions', label: 'Quick Actions', icon: MessageSquare },
  { key: 'reminder',      label: 'Reminder',      icon: Bell },
  { key: 'job_created',   label: 'Job Created',   icon: Briefcase },
];

const QUICK_ACTION_TYPES = ['day_of', 'on_way', 'follow_up'] as const;
const INTERVAL_UNITS = ['hours', 'days', 'weeks', 'months'];

const EMAIL_FOLLOW_UP_DEFAULTS: EmailFollowUpTemplate = {
  subject: 'How did we do, {client_name}?',
  body:
    'Hi {client_name},\n\nThank you for choosing {business_name}! We hope you are happy with your recent service.\n\nIf you have a moment, we would really appreciate it if you left us a review — it makes a huge difference to our small business:\n{review_link}\n\nIf anything wasn\'t perfect, please let us know. We\'d love the chance to make it right.\n\nThank you,\n{business_name}',
};

const QUICK_ACTION_INFO: Record<string, { title: string; description: string; placeholders: string; default: string }> = {
  day_of: {
    title: 'Day-of Reminder',
    description: 'Sent as a reminder on the day of the appointment',
    placeholders: '{client_name}, {time}, {job_title}, {date}',
    default: 'Hi {client_name}! This is a reminder about your appointment today at {time} for {job_title}. Looking forward to seeing you!',
  },
  on_way: {
    title: 'On the Way',
    description: "Sent when you're heading to the appointment",
    placeholders: '{client_name}, {job_title}, {location}',
    default: "Hi {client_name}! I'm on my way to your location for {job_title}. I should arrive in approximately 15 minutes.",
  },
  follow_up: {
    title: 'Follow-up',
    description: 'Auto-sent when a job is marked complete. {technician_name} fills in with the assigned tech\'s first name, or is omitted if no tech was assigned. Only sends if a Google review link is set in business settings.',
    placeholders: '{client_name}, {business_name}, {technician_name}, {review_link}',
    default: "Hi {client_name}, this is {business_name}. If you were happy with your service from {technician_name}, would you mind leaving us a quick review? It really helps: {review_link}\nIf anything wasn't perfect, let us know\u2014we'd love to make it right.",
  },
};

const SMS_DEFAULTS: Record<string, Omit<SmsTemplate, 'id'>> = {
  reminder: {
    template_type: 'reminder',
    message_text: 'Hi {client_name}, this is a reminder about your upcoming service on {date} at {time}. Please let us know if you have any questions!',
    send_automatically: false,
    send_interval_value: 1,
    send_interval_unit: 'days',
    send_interval_timing: 'before',
  },
  job_created: {
    template_type: 'job_created',
    message_text: 'Hi {client_name}, a new job has been scheduled for you: {job_title} on {date} at {time}. We look forward to seeing you!',
    send_automatically: false,
    send_interval_value: 0,
    send_interval_unit: 'days',
    send_interval_timing: 'after',
  },
};

const TAB_DESCRIPTIONS: Record<TabKey, string> = {
  quick_actions: 'Customize the one-tap SMS messages you can send from a client\'s profile.',
  reminder: 'Send this reminder manually any time, or configure it to auto-send on a schedule relative to a job or event.',
  job_created: 'This SMS is sent to a client when a new job is created. Send manually or enable auto-send.',
};

const TEMPLATE_PLACEHOLDERS: Record<TabKey, string> = {
  quick_actions: '{client_name}, {business_name}, {technician_name}, {review_link}, {time}, {job_title}, {date}, {location}',
  reminder: '{client_name}, {date}, {time}, {business_name}',
  job_created: '{client_name}, {job_title}, {date}, {time}, {business_name}',
};

export default function MessageTemplatesModal({ visible, onClose }: MessageTemplatesModalProps) {
  const { colors } = useTheme();
  const { currentOrganization } = useOrganization();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('quick_actions');
  const [quickActionTexts, setQuickActionTexts] = useState<Record<string, string>>({});
  const [quickActionIds, setQuickActionIds] = useState<Record<string, string>>({});
  const [advancedTemplates, setAdvancedTemplates] = useState<Record<string, SmsTemplate>>({});
  const [emailFollowUp, setEmailFollowUp] = useState<EmailFollowUpTemplate>({ ...EMAIL_FOLLOW_UP_DEFAULTS });

  useEffect(() => {
    if (visible && currentOrganization?.id) {
      fetchTemplates();
    }
  }, [visible, currentOrganization?.id]);

  const fetchTemplates = async () => {
    if (!currentOrganization?.id) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('message_templates')
        .select('id, template_type, message_text, send_automatically, send_interval_value, send_interval_unit, send_interval_timing')
        .eq('organization_id', currentOrganization.id)
        .in('template_type', ['day_of', 'on_way', 'follow_up', 'reminder', 'job_created'])
        .eq('delivery_method', 'sms');

      if (error) throw error;

      const texts: Record<string, string> = {};
      const ids: Record<string, string> = {};
      const advanced: Record<string, SmsTemplate> = {};

      (data || []).forEach((t) => {
        if (QUICK_ACTION_TYPES.includes(t.template_type as any)) {
          texts[t.template_type] = t.message_text || '';
          ids[t.template_type] = t.id;
        } else {
          advanced[t.template_type] = {
            id: t.id,
            template_type: t.template_type,
            message_text: t.message_text || '',
            send_automatically: t.send_automatically ?? false,
            send_interval_value: t.send_interval_value ?? 1,
            send_interval_unit: t.send_interval_unit ?? 'days',
            send_interval_timing: t.send_interval_timing ?? 'before',
          };
        }
      });

      QUICK_ACTION_TYPES.forEach((type) => {
        if (!texts[type]) texts[type] = QUICK_ACTION_INFO[type].default;
      });

      Object.keys(SMS_DEFAULTS).forEach((key) => {
        if (!advanced[key]) advanced[key] = { ...SMS_DEFAULTS[key] };
        else advanced[key] = { ...SMS_DEFAULTS[key], ...advanced[key] };
      });

      setQuickActionTexts(texts);
      setQuickActionIds(ids);
      setAdvancedTemplates(advanced);

      const { data: emailData } = await supabase
        .from('message_templates')
        .select('id, email_subject, email_body, message_text')
        .eq('organization_id', currentOrganization.id)
        .eq('template_type', 'follow_up')
        .eq('delivery_method', 'email')
        .maybeSingle();

      if (emailData) {
        setEmailFollowUp({
          id: emailData.id,
          subject: emailData.email_subject || EMAIL_FOLLOW_UP_DEFAULTS.subject,
          body: emailData.email_body || emailData.message_text || EMAIL_FOLLOW_UP_DEFAULTS.body,
        });
      } else {
        setEmailFollowUp({ ...EMAIL_FOLLOW_UP_DEFAULTS });
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveQuickActions = async () => {
    if (!currentOrganization?.id) return;
    setSaving(true);
    try {
      for (const type of QUICK_ACTION_TYPES) {
        const id = quickActionIds[type];
        if (id) {
          const { error } = await supabase
            .from('message_templates')
            .update({ message_text: quickActionTexts[type], updated_at: new Date().toISOString() })
            .eq('id', id);
          if (error) throw error;
        }
      }
      showToast({ message: 'SMS templates updated', type: 'success' });
      onClose();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update templates');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEmailFollowUp = async () => {
    if (!currentOrganization?.id) return;
    if (!emailFollowUp.subject.trim() || !emailFollowUp.body.trim()) {
      Alert.alert('Validation Error', 'Subject and body are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        email_subject: emailFollowUp.subject,
        email_body: emailFollowUp.body,
        message_text: emailFollowUp.body,
        updated_at: new Date().toISOString(),
      };
      if (emailFollowUp.id) {
        const { error } = await supabase
          .from('message_templates')
          .update(payload)
          .eq('id', emailFollowUp.id);
        if (error) throw error;
      } else {
        const { data: authData } = await supabase.auth.getUser();
        const { data, error } = await supabase
          .from('message_templates')
          .insert({
            ...payload,
            user_id: authData?.user?.id,
            organization_id: currentOrganization.id,
            template_type: 'follow_up',
            template_name: 'Review Request (Email)',
            delivery_method: 'email',
            is_active: true,
          })
          .select('id')
          .single();
        if (error) throw error;
        setEmailFollowUp((prev) => ({ ...prev, id: data.id }));
      }
      showToast({ message: 'Email template saved', type: 'success' });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save email template');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAdvanced = async (key: 'reminder' | 'job_created') => {
    if (!currentOrganization?.id) return;
    const tpl = advancedTemplates[key];
    if (!tpl) return;

    if (!tpl.message_text.trim()) {
      Alert.alert('Validation Error', 'Message text is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        message_text: tpl.message_text,
        send_automatically: tpl.send_automatically,
        send_interval_value: tpl.send_interval_value,
        send_interval_unit: tpl.send_interval_unit,
        send_interval_timing: tpl.send_interval_timing,
        updated_at: new Date().toISOString(),
      };

      if (tpl.id) {
        const { error } = await supabase
          .from('message_templates')
          .update(payload)
          .eq('id', tpl.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('message_templates')
          .insert({
            ...payload,
            organization_id: currentOrganization.id,
            template_type: key,
            template_name: key === 'reminder' ? 'Reminder (SMS)' : 'Job Created (SMS)',
            delivery_method: 'sms',
            is_active: true,
          })
          .select('id')
          .single();
        if (error) throw error;
        setAdvancedTemplates((prev) => ({ ...prev, [key]: { ...tpl, id: data.id } }));
      }

      showToast({ message: 'Template saved', type: 'success' });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const updateAdvanced = (key: string, field: keyof SmsTemplate, value: any) => {
    setAdvancedTemplates((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || SMS_DEFAULTS[key]), [field]: value },
    }));
  };

  const handleResetQuick = (type: string) => {
    Alert.alert('Reset Template', 'Reset to default?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => setQuickActionTexts((prev) => ({ ...prev, [type]: QUICK_ACTION_INFO[type].default })),
      },
    ]);
  };

  const handleResetEmailFollowUp = () => {
    Alert.alert('Reset Template', 'Reset to default?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => setEmailFollowUp((prev) => ({ ...prev, ...EMAIL_FOLLOW_UP_DEFAULTS })) },
    ]);
  };

  const handleResetAdvanced = (key: string) => {
    Alert.alert('Reset Template', 'Reset to default?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () =>
          setAdvancedTemplates((prev) => ({
            ...prev,
            [key]: { ...(prev[key] || SMS_DEFAULTS[key]), message_text: SMS_DEFAULTS[key].message_text },
          })),
      },
    ]);
  };

  const dynamicStyles = getDynamicStyles(colors);

  const renderAdvancedTab = (key: 'reminder' | 'job_created') => {
    const tpl = advancedTemplates[key] || SMS_DEFAULTS[key];
    return (
      <>
        <View style={dynamicStyles.infoBox}>
          <Text style={dynamicStyles.infoText}>{TAB_DESCRIPTIONS[key]}</Text>
        </View>

        <View style={dynamicStyles.scheduleCard}>
          <View style={dynamicStyles.scheduleRow}>
            <View style={dynamicStyles.scheduleLabel}>
              <Text style={dynamicStyles.sectionTitle}>Send Automatically</Text>
              <Text style={dynamicStyles.placeholders}>Auto-send based on the interval below</Text>
            </View>
            <Switch
              value={tpl.send_automatically}
              onValueChange={(v) => updateAdvanced(key, 'send_automatically', v)}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#fff"
            />
          </View>

          {tpl.send_automatically && (
            <View style={dynamicStyles.intervalBlock}>
              <View style={dynamicStyles.intervalRow}>
                <View style={dynamicStyles.intervalNumWrap}>
                  <Text style={dynamicStyles.smallLabel}>Every</Text>
                  <TextInput
                    style={dynamicStyles.intervalInput}
                    value={String(tpl.send_interval_value)}
                    onChangeText={(v) => updateAdvanced(key, 'send_interval_value', parseInt(v) || 0)}
                    keyboardType="number-pad"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
                <View style={dynamicStyles.intervalUnitWrap}>
                  <Text style={dynamicStyles.smallLabel}>Unit</Text>
                  <View style={dynamicStyles.chipRow}>
                    {INTERVAL_UNITS.map((u) => (
                      <TouchableOpacity
                        key={u}
                        style={[dynamicStyles.chip, tpl.send_interval_unit === u && dynamicStyles.chipActive]}
                        onPress={() => updateAdvanced(key, 'send_interval_unit', u)}
                      >
                        <Text style={[dynamicStyles.chipText, tpl.send_interval_unit === u && dynamicStyles.chipTextActive]}>{u}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
              <View>
                <Text style={dynamicStyles.smallLabel}>Timing</Text>
                <View style={dynamicStyles.timingToggle}>
                  {['before', 'after'].map((t) => (
                    <TouchableOpacity
                      key={t}
                      style={[dynamicStyles.timingOption, tpl.send_interval_timing === t && dynamicStyles.timingOptionActive]}
                      onPress={() => updateAdvanced(key, 'send_interval_timing', t)}
                    >
                      <Text style={[dynamicStyles.timingText, tpl.send_interval_timing === t && dynamicStyles.timingTextActive]}>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          )}
        </View>

        <View style={dynamicStyles.templateSection}>
          <View style={dynamicStyles.templateHeader}>
            <View style={dynamicStyles.templateHeaderLeft}>
              <Text style={dynamicStyles.templateTitle}>SMS Message</Text>
              <Text style={dynamicStyles.placeholders}>Available: {TEMPLATE_PLACEHOLDERS[key]}</Text>
            </View>
            <TouchableOpacity style={dynamicStyles.resetButton} onPress={() => handleResetAdvanced(key)}>
              <Text style={dynamicStyles.resetButtonText}>Reset</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={dynamicStyles.textArea}
            value={tpl.message_text}
            onChangeText={(text) => updateAdvanced(key, 'message_text', text)}
            placeholder="Enter message template..."
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={4}
            editable={!saving}
          />
        </View>

        <View style={dynamicStyles.footer}>
          <TouchableOpacity style={dynamicStyles.cancelButton} onPress={onClose} disabled={saving}>
            <Text style={dynamicStyles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[dynamicStyles.saveButton, saving && dynamicStyles.saveButtonDisabled]}
            onPress={() => handleSaveAdvanced(key)}
            disabled={saving}
          >
            <LinearGradient
              colors={['#1B4D6E', '#245d82']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={dynamicStyles.saveButtonGradient}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={dynamicStyles.saveButtonText}>Save</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={dynamicStyles.container}>
        <View style={dynamicStyles.overlay}>
          <View style={dynamicStyles.modal}>
            <View style={dynamicStyles.header}>
              <View style={dynamicStyles.headerLeft}>
                <MessageSquare size={24} color={colors.primary} />
                <Text style={dynamicStyles.title}>SMS Templates</Text>
              </View>
              <TouchableOpacity onPress={onClose} disabled={saving}>
                <X size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={dynamicStyles.tabsScroll} contentContainerStyle={dynamicStyles.tabs}>
              {TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    style={[dynamicStyles.tab, activeTab === tab.key && dynamicStyles.tabActive]}
                    onPress={() => setActiveTab(tab.key)}
                  >
                    <Icon size={14} color={activeTab === tab.key ? '#fff' : colors.textSecondary} />
                    <Text style={[dynamicStyles.tabText, activeTab === tab.key && dynamicStyles.tabTextActive]}>{tab.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {loading ? (
              <View style={dynamicStyles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : (
              <ScrollView style={dynamicStyles.content}>
                {activeTab === 'quick_actions' && (
                  <>
                    <Text style={dynamicStyles.description}>{TAB_DESCRIPTIONS.quick_actions}</Text>

                    {QUICK_ACTION_TYPES.map((type) => {
                      const info = QUICK_ACTION_INFO[type];
                      return (
                        <View key={type} style={dynamicStyles.templateSection}>
                          <View style={dynamicStyles.templateHeader}>
                            <View style={dynamicStyles.templateHeaderLeft}>
                              <Text style={dynamicStyles.templateTitle}>{info.title}</Text>
                              <Text style={dynamicStyles.templateDescription}>{info.description}</Text>
                              <Text style={dynamicStyles.placeholders}>Available: {info.placeholders}</Text>
                            </View>
                            <TouchableOpacity style={dynamicStyles.resetButton} onPress={() => handleResetQuick(type)}>
                              <Text style={dynamicStyles.resetButtonText}>Reset</Text>
                            </TouchableOpacity>
                          </View>
                          <TextInput
                            style={dynamicStyles.textArea}
                            value={quickActionTexts[type] || ''}
                            onChangeText={(text) => setQuickActionTexts((prev) => ({ ...prev, [type]: text }))}
                            placeholder="Enter message template..."
                            placeholderTextColor={colors.textSecondary}
                            multiline
                            numberOfLines={4}
                            editable={!saving}
                          />
                        </View>
                      );
                    })}

                    <View style={dynamicStyles.footer}>
                      <TouchableOpacity style={dynamicStyles.cancelButton} onPress={onClose} disabled={saving}>
                        <Text style={dynamicStyles.cancelButtonText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[dynamicStyles.saveButton, saving && dynamicStyles.saveButtonDisabled]}
                        onPress={handleSaveQuickActions}
                        disabled={saving}
                      >
                        <LinearGradient
                          colors={['#1B4D6E', '#245d82']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={dynamicStyles.saveButtonGradient}
                        >
                          {saving ? <ActivityIndicator color="#fff" /> : <Text style={dynamicStyles.saveButtonText}>Save Changes</Text>}
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>

                    {/* ── Email Follow-up / Review Request ── */}
                    <View style={[dynamicStyles.templateSection, { marginTop: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 20 }]}>
                      <View style={[dynamicStyles.templateHeader, { marginBottom: 4 }]}>
                        <View style={dynamicStyles.templateHeaderLeft}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Mail size={15} color={colors.primary} />
                            <Text style={dynamicStyles.templateTitle}>Review Request (Email)</Text>
                          </View>
                          <Text style={dynamicStyles.templateDescription}>
                            Sent when "Review Ask" is tapped on a client with an email address and Email is the preferred send channel.
                          </Text>
                          <Text style={dynamicStyles.placeholders}>Available: {'{{client_name}}, {{business_name}}, {{review_link}}'}</Text>
                        </View>
                        <TouchableOpacity style={dynamicStyles.resetButton} onPress={handleResetEmailFollowUp}>
                          <Text style={dynamicStyles.resetButtonText}>Reset</Text>
                        </TouchableOpacity>
                      </View>

                      <Text style={[dynamicStyles.smallLabel, { marginTop: 10, marginBottom: 4 }]}>Subject</Text>
                      <TextInput
                        style={[dynamicStyles.textArea, { minHeight: 44, paddingVertical: 10 }]}
                        value={emailFollowUp.subject}
                        onChangeText={(v) => setEmailFollowUp((prev) => ({ ...prev, subject: v }))}
                        placeholder="Email subject line..."
                        placeholderTextColor={colors.textSecondary}
                        multiline={false}
                        editable={!saving}
                      />

                      <Text style={[dynamicStyles.smallLabel, { marginTop: 12, marginBottom: 4 }]}>Body</Text>
                      <TextInput
                        style={[dynamicStyles.textArea, { minHeight: 160 }]}
                        value={emailFollowUp.body}
                        onChangeText={(v) => setEmailFollowUp((prev) => ({ ...prev, body: v }))}
                        placeholder="Email body..."
                        placeholderTextColor={colors.textSecondary}
                        multiline
                        numberOfLines={7}
                        editable={!saving}
                      />
                    </View>

                    <View style={[dynamicStyles.footer, { marginTop: 8 }]}>
                      <TouchableOpacity style={dynamicStyles.cancelButton} onPress={onClose} disabled={saving}>
                        <Text style={dynamicStyles.cancelButtonText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[dynamicStyles.saveButton, saving && dynamicStyles.saveButtonDisabled]}
                        onPress={handleSaveEmailFollowUp}
                        disabled={saving}
                      >
                        <LinearGradient
                          colors={['#1B4D6E', '#245d82']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={dynamicStyles.saveButtonGradient}
                        >
                          {saving ? <ActivityIndicator color="#fff" /> : <Text style={dynamicStyles.saveButtonText}>Save Email</Text>}
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  </>
                )}

                {activeTab === 'reminder' && renderAdvancedTab('reminder')}
                {activeTab === 'job_created' && renderAdvancedTab('job_created')}
              </ScrollView>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const getDynamicStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1 },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modal: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '92%',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
    },
    tabsScroll: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tabs: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 8,
    },
    tab: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 7,
      paddingHorizontal: 14,
      borderRadius: 20,
      backgroundColor: colors.inputBackground,
    },
    tabActive: {
      backgroundColor: colors.primary,
    },
    tabText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    tabTextActive: {
      color: '#fff',
    },
    loadingContainer: {
      padding: 60,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      padding: 20,
    },
    description: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 24,
      lineHeight: 20,
    },
    infoBox: {
      padding: 14,
      backgroundColor: colors.primary + '12',
      borderRadius: 12,
      marginBottom: 20,
    },
    infoText: {
      fontSize: 13,
      color: colors.text,
      lineHeight: 18,
    },
    scheduleCard: {
      backgroundColor: colors.inputBackground,
      borderRadius: 12,
      padding: 16,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 16,
    },
    scheduleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    scheduleLabel: {
      flex: 1,
      marginRight: 12,
    },
    intervalBlock: {
      gap: 12,
    },
    intervalRow: {
      flexDirection: 'row',
      gap: 16,
      alignItems: 'flex-start',
    },
    intervalNumWrap: {
      gap: 6,
    },
    intervalUnitWrap: {
      flex: 1,
      gap: 6,
    },
    intervalInput: {
      backgroundColor: colors.surface,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 15,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
      width: 72,
    },
    smallLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    chipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipText: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    chipTextActive: {
      color: '#fff',
      fontWeight: '600',
    },
    timingToggle: {
      flexDirection: 'row',
      gap: 8,
    },
    timingOption: {
      flex: 1,
      paddingVertical: 8,
      alignItems: 'center',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    timingOptionActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    timingText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    timingTextActive: {
      color: '#fff',
    },
    templateSection: {
      marginBottom: 32,
    },
    templateHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    templateHeaderLeft: {
      flex: 1,
      marginRight: 12,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    templateTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    templateDescription: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    placeholders: {
      fontSize: 12,
      color: colors.textSecondary,
      fontStyle: 'italic',
    },
    resetButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    resetButtonText: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    textArea: {
      backgroundColor: colors.inputBackground,
      borderRadius: 8,
      padding: 12,
      fontSize: 14,
      borderWidth: 1,
      borderColor: colors.border,
      minHeight: 100,
      textAlignVertical: 'top',
      color: colors.text,
    },
    footer: {
      flexDirection: 'row',
      gap: 12,
      paddingTop: 8,
      paddingBottom: 24,
    },
    cancelButton: {
      flex: 1,
      padding: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    saveButton: {
      flex: 1,
      borderRadius: 8,
      overflow: 'hidden' as const,
    },
    saveButtonGradient: {
      padding: 16,
      alignItems: 'center' as const,
    },
    saveButtonDisabled: {
      opacity: 0.6,
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#fff',
    },
  });
