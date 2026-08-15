import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import { X, Mail, Save, Info, Bell, Briefcase } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/lib/supabase';
import AIAssistButton from './AIAssistButton';
import CollapsibleField from './CollapsibleField';
import { useCollapsibleForm } from '@/hooks/useCollapsibleForm';

interface EmailTemplatesModalProps {
  visible: boolean;
  onClose: () => void;
}

interface EmailTemplate {
  id?: string;
  template_type: string;
  template_name: string;
  email_subject: string;
  email_body: string;
  delivery_method: string;
  send_automatically: boolean;
  send_interval_value: number;
  send_interval_unit: string;
  send_interval_timing: string;
}

type TabKey = 'invoice' | 'estimate' | 'reminder' | 'job_created';

const TABS: { key: TabKey; label: string; icon: any; templateType: string }[] = [
  { key: 'invoice',     label: 'Invoice',     icon: Mail,      templateType: 'invoice_email' },
  { key: 'estimate',    label: 'Estimate',    icon: Mail,      templateType: 'estimate_email' },
  { key: 'reminder',    label: 'Reminder',    icon: Bell,      templateType: 'reminder' },
  { key: 'job_created', label: 'Job Created', icon: Briefcase, templateType: 'job_created' },
];

const INTERVAL_UNITS = ['hours', 'days', 'weeks', 'months'];

const INVOICE_PLACEHOLDERS = [
  '{business_name}', '{client_name}', '{invoice_number}',
  '{total}', '{due_date}', '{issue_date}', '{status}', '{subtotal}', '{tax_amount}',
];
const ESTIMATE_PLACEHOLDERS = [
  '{business_name}', '{client_name}', '{estimate_number}',
  '{total}', '{valid_until}', '{subtotal}', '{tax_amount}',
];
const REMINDER_PLACEHOLDERS = [
  '{business_name}', '{client_name}', '{date}', '{time}',
];
const JOB_CREATED_PLACEHOLDERS = [
  '{business_name}', '{client_name}', '{job_title}', '{date}', '{time}',
];

const PLACEHOLDERS_BY_TAB: Record<TabKey, string[]> = {
  invoice:     INVOICE_PLACEHOLDERS,
  estimate:    ESTIMATE_PLACEHOLDERS,
  reminder:    REMINDER_PLACEHOLDERS,
  job_created: JOB_CREATED_PLACEHOLDERS,
};

const DEFAULTS: Record<string, Omit<EmailTemplate, 'id'>> = {
  invoice_email: {
    template_type: 'invoice_email',
    template_name: 'Invoice Email',
    email_subject: 'Invoice #{invoice_number} from {business_name}',
    email_body: '<p>Hello {client_name},</p><p>Thank you for your business! Please find your invoice attached.</p><p><strong>Invoice Number:</strong> {invoice_number}<br><strong>Total Amount:</strong> ${total}<br><strong>Due Date:</strong> {due_date}</p><p>If you have any questions about this invoice, please don\'t hesitate to contact us.</p><p>Best regards,<br>{business_name}</p>',
    delivery_method: 'email',
    send_automatically: false,
    send_interval_value: 1,
    send_interval_unit: 'days',
    send_interval_timing: 'before',
  },
  estimate_email: {
    template_type: 'estimate_email',
    template_name: 'Estimate Email',
    email_subject: 'Estimate #{estimate_number} from {business_name}',
    email_body: '<p>Hello {client_name},</p><p>Thank you for your interest! Please find your estimate below.</p><p><strong>Estimate Number:</strong> {estimate_number}<br><strong>Total Amount:</strong> ${total}<br><strong>Valid Until:</strong> {valid_until}</p><p>We look forward to working with you. If you have any questions or would like to proceed, please let us know!</p><p>Best regards,<br>{business_name}</p>',
    delivery_method: 'email',
    send_automatically: false,
    send_interval_value: 1,
    send_interval_unit: 'days',
    send_interval_timing: 'before',
  },
  reminder: {
    template_type: 'reminder',
    template_name: 'Reminder (Email)',
    email_subject: 'Reminder: Your Upcoming Service — {business_name}',
    email_body: '<p>Hi {client_name},</p><p>This is a friendly reminder about your upcoming service scheduled for <strong>{date}</strong> at <strong>{time}</strong>.</p><p>If you need to reschedule or have any questions, please don\'t hesitate to reach out.</p><p>Best regards,<br>{business_name}</p>',
    delivery_method: 'email',
    send_automatically: false,
    send_interval_value: 1,
    send_interval_unit: 'days',
    send_interval_timing: 'before',
  },
  job_created: {
    template_type: 'job_created',
    template_name: 'Job Created (Email)',
    email_subject: 'Your Job Has Been Scheduled — {business_name}',
    email_body: '<p>Hi {client_name},</p><p>Great news! A new job has been scheduled for you:</p><p><strong>Service:</strong> {job_title}<br><strong>Date:</strong> {date}<br><strong>Time:</strong> {time}</p><p>If you have any questions or need to make changes, please contact us.</p><p>Best regards,<br>{business_name}</p>',
    delivery_method: 'email',
    send_automatically: false,
    send_interval_value: 0,
    send_interval_unit: 'days',
    send_interval_timing: 'after',
  },
};

const TAB_DESCRIPTIONS: Record<TabKey, string> = {
  invoice:     'Customize the email sent when you email an invoice to a client.',
  estimate:    'Customize the email sent when you email an estimate to a client.',
  reminder:    'Send this reminder manually any time, or configure it to send automatically at a set interval before or after a scheduled event.',
  job_created: 'This email is sent to a client when a new job is created. It can be sent manually or triggered automatically.',
};

export default function EmailTemplatesModal({ visible, onClose }: EmailTemplatesModalProps) {
  const { colors } = useTheme();
  const { currentOrganization } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('invoice');
  const [templates, setTemplates] = useState<Record<string, EmailTemplate>>({});
  const { activeFieldId, toggleField } = useCollapsibleForm();

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
        .select('id, template_type, template_name, email_subject, email_body, delivery_method, send_automatically, send_interval_value, send_interval_unit, send_interval_timing')
        .eq('organization_id', currentOrganization.id)
        .in('template_type', ['invoice_email', 'estimate_email', 'reminder', 'job_created'])
        .eq('delivery_method', 'email');

      if (error) throw error;

      const map: Record<string, EmailTemplate> = {};
      (data || []).forEach((t) => {
        map[t.template_type] = {
          id: t.id,
          template_type: t.template_type,
          template_name: t.template_name || '',
          email_subject: t.email_subject || '',
          email_body: t.email_body || '',
          delivery_method: t.delivery_method || 'email',
          send_automatically: t.send_automatically ?? false,
          send_interval_value: t.send_interval_value ?? 1,
          send_interval_unit: t.send_interval_unit ?? 'days',
          send_interval_timing: t.send_interval_timing ?? 'before',
        };
      });

      const merged: Record<string, EmailTemplate> = {};
      Object.keys(DEFAULTS).forEach((key) => {
        merged[key] = map[key] ? { ...DEFAULTS[key], ...map[key] } : { ...DEFAULTS[key] };
      });

      setTemplates(merged);
    } catch (error) {
      console.error('Error fetching email templates:', error);
      Alert.alert('Error', 'Failed to load email templates');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentOrganization?.id) return;

    const tabInfo = TABS.find((t) => t.key === activeTab)!;
    const current = templates[tabInfo.templateType];
    if (!current) return;

    if (!current.email_subject.trim() || !current.email_body.trim()) {
      Alert.alert('Validation Error', 'Email subject and body are required');
      return;
    }

    try {
      setSaving(true);

      const payload = {
        email_subject: current.email_subject,
        email_body: current.email_body,
        send_automatically: current.send_automatically,
        send_interval_value: current.send_interval_value,
        send_interval_unit: current.send_interval_unit,
        send_interval_timing: current.send_interval_timing,
        updated_at: new Date().toISOString(),
      };

      if (current.id) {
        const { error } = await supabase
          .from('message_templates')
          .update(payload)
          .eq('id', current.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('message_templates')
          .insert({
            ...payload,
            organization_id: currentOrganization.id,
            template_type: current.template_type,
            template_name: current.template_name,
            delivery_method: 'email',
            is_active: true,
          })
          .select('id')
          .single();
        if (error) throw error;
        setTemplates((prev) => ({
          ...prev,
          [tabInfo.templateType]: { ...current, id: data.id },
        }));
      }

      Alert.alert('Saved', `${TABS.find((t) => t.key === activeTab)?.label} email template updated.`);
    } catch (error) {
      console.error('Error saving template:', error);
      Alert.alert('Error', 'Failed to save email template');
    } finally {
      setSaving(false);
    }
  };

  const updateCurrent = (field: keyof EmailTemplate, value: any) => {
    const tabInfo = TABS.find((t) => t.key === activeTab)!;
    setTemplates((prev) => ({
      ...prev,
      [tabInfo.templateType]: { ...(prev[tabInfo.templateType] || DEFAULTS[tabInfo.templateType]), [field]: value },
    }));
  };

  const insertPlaceholder = (placeholder: string) => {
    const tabInfo = TABS.find((t) => t.key === activeTab)!;
    const current = templates[tabInfo.templateType];
    if (!current) return;
    updateCurrent('email_body', (current.email_body || '') + placeholder);
  };

  const handleReset = () => {
    const tabInfo = TABS.find((t) => t.key === activeTab)!;
    Alert.alert('Reset to Default', 'This will reset the subject and body to the default content. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => {
          const def = DEFAULTS[tabInfo.templateType];
          setTemplates((prev) => ({
            ...prev,
            [tabInfo.templateType]: { ...(prev[tabInfo.templateType] || def), email_subject: def.email_subject, email_body: def.email_body },
          }));
        },
      },
    ]);
  };

  const tabInfo = TABS.find((t) => t.key === activeTab)!;
  const current = templates[tabInfo.templateType] || DEFAULTS[tabInfo.templateType];
  const placeholders = PLACEHOLDERS_BY_TAB[activeTab];
  const showSchedule = activeTab === 'reminder' || activeTab === 'job_created';

  const styles = getStyles(colors);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Mail size={20} color={colors.primary} />
              <Text style={styles.title}>Email Templates</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabs}>
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.tab, activeTab === tab.key && styles.tabActive]}
                  onPress={() => setActiveTab(tab.key)}
                >
                  <Icon size={14} color={activeTab === tab.key ? '#fff' : colors.textSecondary} />
                  <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Loading templates...</Text>
            </View>
          ) : (
            <>
              <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.infoBox}>
                  <Info size={16} color={colors.primary} />
                  <Text style={styles.infoText}>{TAB_DESCRIPTIONS[activeTab]}</Text>
                </View>

                {showSchedule && (
                  <View style={styles.scheduleCard}>
                    <View style={styles.scheduleRow}>
                      <View style={styles.scheduleLabel}>
                        <Text style={styles.label}>Send Automatically</Text>
                        <Text style={styles.hint}>Auto-send based on the interval below</Text>
                      </View>
                      <Switch
                        value={current.send_automatically}
                        onValueChange={(v) => updateCurrent('send_automatically', v)}
                        trackColor={{ false: colors.border, true: colors.primary }}
                        thumbColor="#fff"
                      />
                    </View>

                    {current.send_automatically && (
                      <View style={styles.intervalRow}>
                        <View style={styles.intervalNum}>
                          <Text style={styles.label}>Every</Text>
                          <TextInput
                            style={styles.intervalInput}
                            value={String(current.send_interval_value)}
                            onChangeText={(v) => updateCurrent('send_interval_value', parseInt(v) || 0)}
                            keyboardType="number-pad"
                            placeholderTextColor={colors.textSecondary}
                          />
                        </View>
                        <View style={styles.intervalUnit}>
                          <Text style={styles.label}>Unit</Text>
                          <View style={styles.unitPicker}>
                            {INTERVAL_UNITS.map((u) => (
                              <TouchableOpacity
                                key={u}
                                style={[styles.unitOption, current.send_interval_unit === u && styles.unitOptionActive]}
                                onPress={() => updateCurrent('send_interval_unit', u)}
                              >
                                <Text style={[styles.unitOptionText, current.send_interval_unit === u && styles.unitOptionTextActive]}>
                                  {u}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                        <View style={styles.intervalTiming}>
                          <Text style={styles.label}>Timing</Text>
                          <View style={styles.timingToggle}>
                            {['before', 'after'].map((t) => (
                              <TouchableOpacity
                                key={t}
                                style={[styles.timingOption, current.send_interval_timing === t && styles.timingOptionActive]}
                                onPress={() => updateCurrent('send_interval_timing', t)}
                              >
                                <Text style={[styles.timingOptionText, current.send_interval_timing === t && styles.timingOptionTextActive]}>
                                  {t.charAt(0).toUpperCase() + t.slice(1)}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      </View>
                    )}
                  </View>
                )}

                <CollapsibleField
                  label="Email Subject"
                  fieldId="email_subject"
                  activeFieldId={activeFieldId}
                  onToggle={toggleField}
                  displayValue={current.email_subject || undefined}
                  required
                >
                  <View style={styles.section}>
                    <View style={styles.labelRow}>
                      <Text style={styles.label}>Email Subject</Text>
                      <AIAssistButton
                        type="email_subject"
                        context={{ type: activeTab, clientName: 'client' }}
                        onGenerate={(value) => updateCurrent('email_subject', value)}
                        compact
                      />
                    </View>
                    <TextInput
                      style={styles.input}
                      value={current.email_subject}
                      onChangeText={(value) => updateCurrent('email_subject', value)}
                      placeholder="Email subject line"
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>
                </CollapsibleField>

                <CollapsibleField
                  label="Email Body"
                  fieldId="email_body"
                  activeFieldId={activeFieldId}
                  onToggle={toggleField}
                  displayValue={current.email_body ? current.email_body.replace(/<[^>]*>/g, '').substring(0, 80) + (current.email_body.replace(/<[^>]*>/g, '').length > 80 ? '...' : '') : undefined}
                  required
                >
                  <View style={styles.section}>
                    <View style={styles.labelRow}>
                      <Text style={styles.label}>Email Body</Text>
                      <AIAssistButton
                        type="email_body"
                        context={{ type: activeTab, clientName: 'client', businessName: 'Your Business' }}
                        onGenerate={(value) => updateCurrent('email_body', value)}
                        compact
                      />
                    </View>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      value={current.email_body}
                      onChangeText={(value) => updateCurrent('email_body', value)}
                      placeholder="Email message content"
                      placeholderTextColor={colors.textSecondary}
                      multiline
                      numberOfLines={8}
                      textAlignVertical="top"
                    />
                    <Text style={styles.hint}>Supports basic HTML tags like &lt;p&gt;, &lt;strong&gt;, &lt;br&gt;</Text>
                  </View>
                </CollapsibleField>

                <View style={styles.section}>
                  <Text style={styles.label}>Available Placeholders</Text>
                  <Text style={styles.hint}>Tap to insert into email body</Text>
                  <View style={styles.placeholderGrid}>
                    {placeholders.map((placeholder) => (
                      <TouchableOpacity
                        key={placeholder}
                        style={styles.placeholderChip}
                        onPress={() => insertPlaceholder(placeholder)}
                      >
                        <Text style={styles.placeholderText}>{placeholder}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.previewSection}>
                  <Text style={styles.label}>Preview</Text>
                  <View style={styles.previewBox}>
                    <Text style={styles.previewSubject}>Subject: {current.email_subject || 'No subject'}</Text>
                    <View style={styles.previewDivider} />
                    <Text style={styles.previewBody}>{current.email_body || 'No message content'}</Text>
                  </View>
                </View>
              </ScrollView>

              <View style={styles.footer}>
                <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
                  <Text style={styles.resetButtonText}>Reset to Default</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveButton, saving && styles.buttonDisabled]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  <LinearGradient
                    colors={['#1B4D6E', '#245d82']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.saveButtonGradient}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Save size={18} color="#fff" />
                        <Text style={styles.saveButtonText}>Save</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modal: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '95%',
      minHeight: '80%',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    closeButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.inputBackground,
      justifyContent: 'center',
      alignItems: 'center',
    },
    tabsScroll: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tabs: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 8,
    },
    tab: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
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
      paddingVertical: 80,
      alignItems: 'center',
      gap: 16,
    },
    loadingText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    content: {
      flex: 1,
      padding: 20,
    },
    infoBox: {
      flexDirection: 'row',
      gap: 12,
      padding: 14,
      backgroundColor: colors.primary + '12',
      borderRadius: 12,
      marginBottom: 20,
    },
    infoText: {
      flex: 1,
      fontSize: 13,
      color: colors.text,
      lineHeight: 18,
    },
    scheduleCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
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
    intervalRow: {
      gap: 12,
    },
    intervalNum: {
      gap: 6,
    },
    intervalUnit: {
      gap: 6,
    },
    intervalTiming: {
      gap: 6,
    },
    intervalInput: {
      backgroundColor: colors.inputBackground,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
      width: 80,
    },
    unitPicker: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    unitOption: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.inputBackground,
    },
    unitOptionActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    unitOptionText: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    unitOptionTextActive: {
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
      backgroundColor: colors.inputBackground,
    },
    timingOptionActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    timingOptionText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    timingOptionTextActive: {
      color: '#fff',
    },
    section: {
      marginBottom: 24,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    labelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    input: {
      backgroundColor: colors.inputBackground,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 15,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
    },
    textArea: {
      minHeight: 120,
      paddingTop: 12,
    },
    hint: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 6,
    },
    placeholderGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 8,
    },
    placeholderChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: colors.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    placeholderText: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.primary,
    },
    previewSection: {
      marginTop: 8,
      marginBottom: 20,
    },
    previewBox: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    previewSubject: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    previewDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginBottom: 12,
    },
    previewBody: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    footer: {
      flexDirection: 'row',
      gap: 12,
      padding: 20,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    resetButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    resetButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    saveButton: {
      flex: 2,
      borderRadius: 12,
      overflow: 'hidden' as const,
    },
    saveButtonGradient: {
      flexDirection: 'row' as const,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      paddingVertical: 14,
      gap: 8,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#fff',
    },
  });
