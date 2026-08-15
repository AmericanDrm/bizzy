import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Switch,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Image,
} from 'react-native';
import { X, Globe, Copy, Check, Clock, Link, Code as Code2, MonitorSmartphone, ExternalLink, Image as ImageIcon, Upload, Trash2, DollarSign, Mail, Shield, Users } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/lib/supabase';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface PortalSettings {
  id?: string;
  is_enabled: boolean;
  portal_title: string;
  welcome_message: string;
  booking_start_time: string;
  booking_end_time: string;
  available_days: string[];
  allow_guest_booking: boolean;
  require_booking_approval: boolean;
  primary_color: string;
  logo_url?: string;
  max_bookings_per_day: number;
  cancellation_hours_notice: number;
  require_deposit: boolean;
  deposit_amount: number;
  deposit_type: 'fixed' | 'percentage';
  send_booking_confirmation_email: boolean;
}

const DEFAULTS: PortalSettings = {
  is_enabled: false,
  portal_title: 'Client Hub',
  welcome_message: 'Welcome! Sign in to view your invoices, estimates, and upcoming appointments.',
  booking_start_time: '09:00',
  booking_end_time: '17:00',
  available_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  allow_guest_booking: true,
  require_booking_approval: true,
  primary_color: '#007AFF',
  logo_url: undefined,
  max_bookings_per_day: 10,
  cancellation_hours_notice: 24,
  require_deposit: false,
  deposit_amount: 0,
  deposit_type: 'fixed',
  send_booking_confirmation_email: true,
};

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function ClientPortalSettingsModal({ visible, onClose }: Props) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const { currentOrganization } = useOrganization();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<PortalSettings>(DEFAULTS);
  const [linkCopied, setLinkCopied] = useState(false);
  const [iframeCopied, setIframeCopied] = useState(false);
  const [widgetCopied, setWidgetCopied] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const portalUrl = currentOrganization?.slug
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/portal/${currentOrganization.slug}`
    : '';

  useEffect(() => {
    if (visible && currentOrganization?.id) {
      loadSettings();
    }
  }, [visible, currentOrganization?.id]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('client_portal_settings')
        .select('*')
        .eq('organization_id', currentOrganization!.id)
        .maybeSingle();

      if (error) throw error;
      setSettings(data ? { ...DEFAULTS, ...data } : { ...DEFAULTS });
    } catch (err: any) {
      showToast({ message: 'Failed to load portal settings', type: 'error', duration: 3000 });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentOrganization?.id) return;
    setSaving(true);
    try {
      const payload = {
        organization_id: currentOrganization.id,
        is_enabled: settings.is_enabled,
        portal_title: settings.portal_title.trim() || 'Client Hub',
        welcome_message: settings.welcome_message.trim(),
        booking_start_time: settings.booking_start_time,
        booking_end_time: settings.booking_end_time,
        available_days: settings.available_days,
        allow_guest_booking: settings.allow_guest_booking,
        require_booking_approval: settings.require_booking_approval,
        primary_color: settings.primary_color,
        logo_url: settings.logo_url || null,
        max_bookings_per_day: settings.max_bookings_per_day || 10,
        cancellation_hours_notice: settings.cancellation_hours_notice || 24,
        require_deposit: settings.require_deposit,
        deposit_amount: settings.require_deposit ? (settings.deposit_amount || 0) : 0,
        deposit_type: settings.deposit_type || 'fixed',
        send_booking_confirmation_email: settings.send_booking_confirmation_email,
      };

      const { error } = await supabase
        .from('client_portal_settings')
        .upsert(payload, { onConflict: 'organization_id' });

      if (error) throw error;

      showToast({ message: 'Portal settings saved', type: 'success', duration: 2000 });
    } catch (err: any) {
      showToast({ message: err.message || 'Failed to save', type: 'error', duration: 3000 });
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (day: string) => {
    setSettings((prev) => ({
      ...prev,
      available_days: prev.available_days.includes(day)
        ? prev.available_days.filter((d) => d !== day)
        : [...prev.available_days, day],
    }));
  };

  const handleLogoUpload = async () => {
    if (!currentOrganization?.id) return;
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showToast({ message: 'Camera roll permission required', type: 'error', duration: 3000 });
        return;
      }
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setUploadingLogo(true);
      const ext = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
      const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
      const fileName = `portal-logo-${currentOrganization.id}-${Date.now()}.${ext}`;
      let fileBlob: Blob;
      if (Platform.OS === 'web') {
        const resp = await fetch(asset.uri);
        fileBlob = await resp.blob();
      } else {
        const resp = await fetch(asset.uri);
        fileBlob = await resp.blob();
      }
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('logos')
        .upload(fileName, fileBlob, { contentType: mimeType, upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('logos').getPublicUrl(uploadData.path);
      setSettings((p) => ({ ...p, logo_url: urlData.publicUrl }));
      showToast({ message: 'Logo uploaded', type: 'success', duration: 2000 });
    } catch (err: any) {
      showToast({ message: err.message || 'Upload failed', type: 'error', duration: 3000 });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = () => {
    setSettings((p) => ({ ...p, logo_url: undefined }));
  };

  const copyLink = () => {
    if (!portalUrl) return;
    copyToClipboard(portalUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
    showToast({ message: 'Portal link copied!', type: 'success', duration: 2000 });
  };

  const copyToClipboard = (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
  };

  const iframeCode = portalUrl
    ? `<iframe\n  src="${portalUrl}?embed=1"\n  width="100%"\n  height="640"\n  style="border:none;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.1);"\n  title="${settings.portal_title || 'Client Hub'}"\n  allow="forms"\n></iframe>`
    : '';

  const widgetCode = portalUrl
    ? `<!-- ${settings.portal_title || 'Client Hub'} by ToolBox -->\n<script>\n(function(){\n  var COLOR='${settings.primary_color || '#007AFF'}';\n  var URL='${portalUrl}?embed=1';\n  var LABEL='${settings.portal_title || 'Client Hub'}';\n  var s=document.createElement('style');\n  s.textContent='#_tbx-btn{position:fixed;bottom:24px;right:24px;width:56px;height:56px;border-radius:28px;background:'+COLOR+';border:none;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.2);display:flex;align-items:center;justify-content:center;z-index:9999;transition:transform .2s}#_tbx-btn:hover{transform:scale(1.08)}#_tbx-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:9998;align-items:flex-end;justify-content:flex-end;padding:80px 24px 24px}#_tbx-panel{width:420px;max-width:100%;height:620px;max-height:84vh;border-radius:16px;overflow:hidden;background:#fff;box-shadow:0 16px 48px rgba(0,0,0,.2)}#_tbx-panel iframe{width:100%;height:100%;border:none}#_tbx-close{position:fixed;bottom:660px;right:36px;background:rgba(255,255,255,.95);border:none;border-radius:50%;width:32px;height:32px;cursor:pointer;font-size:16px;z-index:10000;box-shadow:0 2px 8px rgba(0,0,0,.15)}@media(max-width:520px){#_tbx-overlay{padding:0}#_tbx-panel{width:100%;max-width:100%;height:100%;max-height:100%;border-radius:0}}';\n  document.head.appendChild(s);\n  var btn=document.createElement('button');\n  btn.id='_tbx-btn';\n  btn.title=LABEL;\n  btn.innerHTML='<svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z\"/></svg>';\n  var overlay=document.createElement('div');\n  overlay.id='_tbx-overlay';\n  var close=document.createElement('button');\n  close.id='_tbx-close';\n  close.innerHTML='&#x2715;';\n  close.onclick=function(){overlay.style.display='none'};\n  var panel=document.createElement('div');\n  panel.id='_tbx-panel';\n  var frame=document.createElement('iframe');\n  frame.src=URL;\n  frame.allow='forms';\n  panel.appendChild(frame);\n  overlay.appendChild(close);\n  overlay.appendChild(panel);\n  btn.onclick=function(){overlay.style.display='flex'};\n  overlay.addEventListener('click',function(e){if(e.target===overlay)overlay.style.display='none'});\n  document.body.appendChild(btn);\n  document.body.appendChild(overlay);\n})();\n<\/script>`
    : '';

  const copyIframe = () => {
    copyToClipboard(iframeCode);
    setIframeCopied(true);
    setTimeout(() => setIframeCopied(false), 2000);
    showToast({ message: 'Iframe code copied!', type: 'success', duration: 2000 });
  };

  const copyWidget = () => {
    copyToClipboard(widgetCode);
    setWidgetCopied(true);
    setTimeout(() => setWidgetCopied(false), 2000);
    showToast({ message: 'Widget code copied!', type: 'success', duration: 2000 });
  };

  const s = makeStyles(colors);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <X size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Client Portal</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            {saving
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Text style={[s.saveBtn, { color: colors.primary }]}>Save</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 48 }} />
          ) : (
            <>
              <View style={s.enableRow}>
                <View style={s.enableLeft}>
                  <Globe size={22} color={settings.is_enabled ? colors.success : colors.textSecondary} />
                  <View>
                    <Text style={s.enableTitle}>Client Portal</Text>
                    <Text style={s.enableSub}>
                      {settings.is_enabled ? 'Live — clients can access their hub' : 'Disabled — portal is hidden'}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={settings.is_enabled}
                  onValueChange={(v) => setSettings((p) => ({ ...p, is_enabled: v }))}
                  trackColor={{ false: colors.border, true: colors.success }}
                  thumbColor="#fff"
                />
              </View>

              {portalUrl ? (
                <View style={[s.linkCard, !settings.is_enabled && { opacity: 0.6 }]}>
                  {!settings.is_enabled && (
                    <Text style={[s.linkDisabledNote, { color: colors.textSecondary }]}>
                      Portal is disabled — enable it above to make this link live
                    </Text>
                  )}
                  <View style={s.linkRow}>
                    <Link size={14} color={colors.primary} />
                    <Text style={[s.linkText, { color: colors.primary }]} numberOfLines={1}>{portalUrl}</Text>
                  </View>
                  <TouchableOpacity style={[s.copyBtn, { overflow: 'hidden' }]} onPress={copyLink}>
                    <LinearGradient
                      colors={['#1B4D6E', '#245d82']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={s.copyBtnGradient}
                    >
                      {linkCopied
                        ? <Check size={14} color="#fff" />
                        : <Copy size={14} color="#fff" />}
                      <Text style={s.copyBtnText}>{linkCopied ? 'Copied!' : 'Copy Link'}</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              ) : null}

              <SectionHeader label="Branding" />

              <View style={s.fieldGroup}>
                <View style={{ paddingHorizontal: 16, paddingVertical: 14, gap: 10 }}>
                  <Text style={{ fontSize: 13, fontWeight: '500', color: colors.textSecondary }}>Logo</Text>
                  {settings.logo_url ? (
                    <View style={s.logoRow}>
                      <Image source={{ uri: settings.logo_url }} style={s.logoPreview} resizeMode="contain" />
                      <View style={{ flex: 1, gap: 6 }}>
                        <TouchableOpacity
                          style={[s.logoUploadBtn, { borderColor: colors.primary + '40', backgroundColor: colors.primary + '0C' }]}
                          onPress={handleLogoUpload}
                          disabled={uploadingLogo}
                        >
                          {uploadingLogo
                            ? <ActivityIndicator size="small" color={colors.primary} />
                            : <Upload size={14} color={colors.primary} />}
                          <Text style={[s.logoUploadText, { color: colors.primary }]}>
                            {uploadingLogo ? 'Uploading...' : 'Replace'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[s.logoUploadBtn, { borderColor: '#FF3B3040', backgroundColor: '#FF3B300C' }]}
                          onPress={handleRemoveLogo}
                        >
                          <Trash2 size={14} color="#FF3B30" />
                          <Text style={[s.logoUploadText, { color: '#FF3B30' }]}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[s.logoUploadAreaBtn, { borderColor: colors.border, backgroundColor: colors.inputBackground }]}
                      onPress={handleLogoUpload}
                      disabled={uploadingLogo}
                    >
                      {uploadingLogo ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <ImageIcon size={22} color={colors.textSecondary} />
                      )}
                      <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
                        {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>PNG or JPG, displayed in portal header</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={[s.divider, { backgroundColor: colors.border }]} />

                <FieldRow label="Portal Name">
                  <TextInput
                    style={[s.input, { color: colors.text, backgroundColor: colors.inputBackground }]}
                    value={settings.portal_title}
                    onChangeText={(v) => setSettings((p) => ({ ...p, portal_title: v }))}
                    placeholder="Client Hub"
                    placeholderTextColor={colors.textSecondary}
                  />
                </FieldRow>

                <FieldRow label="Welcome Message">
                  <TextInput
                    style={[s.input, s.textArea, { color: colors.text, backgroundColor: colors.inputBackground }]}
                    value={settings.welcome_message}
                    onChangeText={(v) => setSettings((p) => ({ ...p, welcome_message: v }))}
                    placeholder="Welcome message shown on the login page"
                    placeholderTextColor={colors.textSecondary}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </FieldRow>
              </View>

              <SectionHeader label="Booking Hours" />

              <View style={s.fieldGroup}>
                <View style={s.timeRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Start Time</Text>
                    <View style={[s.timeInput, { backgroundColor: colors.inputBackground }]}>
                      <Clock size={15} color={colors.textSecondary} />
                      <TextInput
                        style={[s.timeText, { color: colors.text }]}
                        value={settings.booking_start_time}
                        onChangeText={(v) => setSettings((p) => ({ ...p, booking_start_time: v }))}
                        placeholder="09:00"
                        placeholderTextColor={colors.textSecondary}
                      />
                    </View>
                  </View>
                  <Text style={[s.timeSep, { color: colors.textSecondary }]}>to</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>End Time</Text>
                    <View style={[s.timeInput, { backgroundColor: colors.inputBackground }]}>
                      <Clock size={15} color={colors.textSecondary} />
                      <TextInput
                        style={[s.timeText, { color: colors.text }]}
                        value={settings.booking_end_time}
                        onChangeText={(v) => setSettings((p) => ({ ...p, booking_end_time: v }))}
                        placeholder="17:00"
                        placeholderTextColor={colors.textSecondary}
                      />
                    </View>
                  </View>
                </View>

                <View style={s.daysWrap}>
                  <Text style={[s.fieldLabel, { color: colors.textSecondary, marginBottom: 8 }]}>Available Days</Text>
                  <View style={s.daysRow}>
                    {DAYS.map((day) => {
                      const active = settings.available_days.includes(day);
                      return (
                        <TouchableOpacity
                          key={day}
                          style={[
                            s.dayChip,
                            { borderColor: active ? colors.primary : colors.border },
                            active && { backgroundColor: colors.primary + '18' },
                          ]}
                          onPress={() => toggleDay(day)}
                        >
                          <Text
                            style={[
                              s.dayChipText,
                              { color: active ? colors.primary : colors.textSecondary },
                            ]}
                          >
                            {day.slice(0, 3)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>

              <SectionHeader label="Access & Approvals" />

              <View style={s.fieldGroup}>
                <ToggleRow
                  label="Allow Guest Booking"
                  description="Unknown visitors can submit a booking request without an account"
                  value={settings.allow_guest_booking}
                  onChange={(v) => setSettings((p) => ({ ...p, allow_guest_booking: v }))}
                  colors={colors}
                />
                <View style={[s.divider, { backgroundColor: colors.border }]} />
                <ToggleRow
                  label="Require Approval"
                  description="New booking requests need admin approval before confirmation"
                  value={settings.require_booking_approval}
                  onChange={(v) => setSettings((p) => ({ ...p, require_booking_approval: v }))}
                  colors={colors}
                />
              </View>

              <SectionHeader label="Booking Limits & Cancellation" />

              <View style={s.fieldGroup}>
                <View style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 6 }}>
                  <View style={s.limitRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '500', color: colors.text }}>Max Bookings / Day</Text>
                      <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>Cap the number of booking requests per day (0 = unlimited)</Text>
                    </View>
                    <TextInput
                      style={[s.numberInput, { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                      value={String(settings.max_bookings_per_day)}
                      onChangeText={(v) => setSettings((p) => ({ ...p, max_bookings_per_day: parseInt(v) || 0 }))}
                      keyboardType="number-pad"
                      maxLength={3}
                      {...(Platform.OS === 'web' ? { style: [s.numberInput, { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.border, outlineStyle: 'none' } as any] } : {})}
                    />
                  </View>
                </View>
                <View style={[s.divider, { backgroundColor: colors.border }]} />
                <View style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 6 }}>
                  <View style={s.limitRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '500', color: colors.text }}>Cancellation Notice</Text>
                      <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>Hours notice required for clients to cancel a booking</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <TextInput
                        style={[s.numberInput, { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                        value={String(settings.cancellation_hours_notice)}
                        onChangeText={(v) => setSettings((p) => ({ ...p, cancellation_hours_notice: parseInt(v) || 0 }))}
                        keyboardType="number-pad"
                        maxLength={3}
                        {...(Platform.OS === 'web' ? { style: [s.numberInput, { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.border, outlineStyle: 'none' } as any] } : {})}
                      />
                      <Text style={{ fontSize: 13, color: colors.textSecondary }}>hrs</Text>
                    </View>
                  </View>
                </View>
              </View>

              <SectionHeader label="Notifications" />

              <View style={s.fieldGroup}>
                <ToggleRow
                  label="Send Booking Confirmation Email"
                  description="Automatically email clients when their booking request is received"
                  value={settings.send_booking_confirmation_email}
                  onChange={(v) => setSettings((p) => ({ ...p, send_booking_confirmation_email: v }))}
                  colors={colors}
                />
              </View>

              <SectionHeader label="Deposits" />

              <View style={s.fieldGroup}>
                <ToggleRow
                  label="Require Deposit at Booking"
                  description="Collect a deposit when clients submit a booking request (requires Stripe)"
                  value={settings.require_deposit}
                  onChange={(v) => setSettings((p) => ({ ...p, require_deposit: v }))}
                  colors={colors}
                />
                {settings.require_deposit && (
                  <>
                    <View style={[s.divider, { backgroundColor: colors.border }]} />
                    <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                      <Text style={{ fontSize: 13, fontWeight: '500', color: colors.textSecondary, marginBottom: 10 }}>Deposit Type</Text>
                      <View style={s.depositTypeRow}>
                        {(['fixed', 'percentage'] as const).map((t) => (
                          <TouchableOpacity
                            key={t}
                            style={[
                              s.depositTypeChip,
                              { borderColor: settings.deposit_type === t ? colors.primary : colors.border },
                              settings.deposit_type === t && { backgroundColor: colors.primary + '12' },
                            ]}
                            onPress={() => setSettings((p) => ({ ...p, deposit_type: t }))}
                          >
                            {t === 'fixed' ? <DollarSign size={14} color={settings.deposit_type === t ? colors.primary : colors.textSecondary} /> : <Text style={{ fontSize: 14, color: settings.deposit_type === t ? colors.primary : colors.textSecondary }}>%</Text>}
                            <Text style={[s.depositTypeText, { color: settings.deposit_type === t ? colors.primary : colors.textSecondary }]}>
                              {t === 'fixed' ? 'Fixed Amount' : 'Percentage'}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <Text style={{ fontSize: 13, fontWeight: '500', color: colors.textSecondary, marginTop: 14, marginBottom: 6 }}>
                        {settings.deposit_type === 'fixed' ? 'Amount ($)' : 'Percentage (%)'}
                      </Text>
                      <TextInput
                        style={[s.input, { color: colors.text, backgroundColor: colors.inputBackground, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}) }]}
                        value={String(settings.deposit_amount || '')}
                        onChangeText={(v) => setSettings((p) => ({ ...p, deposit_amount: parseFloat(v) || 0 }))}
                        keyboardType="decimal-pad"
                        placeholder={settings.deposit_type === 'fixed' ? '50.00' : '25'}
                        placeholderTextColor={colors.textSecondary}
                      />
                    </View>
                  </>
                )}
              </View>

              <SectionHeader label="About Client Access" />
              <View style={[s.infoBanner, { backgroundColor: colors.inputBackground }]}>
                <Text style={[s.infoText, { color: colors.textSecondary }]}>
                  To give a client portal access, open their profile in the Clients tab and tap{' '}
                  <Text style={{ fontWeight: '600', color: colors.text }}>Enable Portal Access</Text>.
                  They'll receive a login link by email.
                </Text>
              </View>

              {settings.is_enabled && portalUrl ? (
                <>
                  <SectionHeader label="Embed on Your Website" />

                  <View style={[s.embedIntro, { backgroundColor: colors.inputBackground }]}>
                    <MonitorSmartphone size={18} color={colors.primary} />
                    <Text style={[s.embedIntroText, { color: colors.textSecondary }]}>
                      Add the Client Hub directly to your website. Choose the option that fits your site best.
                    </Text>
                  </View>

                  <View style={[s.embedCard, { backgroundColor: colors.card || colors.inputBackground }]}>
                    <View style={s.embedCardHeader}>
                      <View style={[s.embedBadge, { backgroundColor: colors.primary + '18' }]}>
                        <Code2 size={14} color={colors.primary} />
                        <Text style={[s.embedBadgeText, { color: colors.primary }]}>iFrame</Text>
                      </View>
                      <Text style={[s.embedCardTitle, { color: colors.text }]}>Embedded Section</Text>
                      <Text style={[s.embedCardDesc, { color: colors.textSecondary }]}>
                        Paste inside your page to display the portal inline — great for a dedicated "Client Login" page.
                      </Text>
                    </View>
                    <View style={[s.codeBlock, { backgroundColor: colors.background || '#F2F2F7' }]}>
                      <Text style={[s.codeText, { color: colors.textSecondary }]} numberOfLines={4}>{iframeCode}</Text>
                    </View>
                    <TouchableOpacity
                      style={[s.copyCodeBtn, { borderColor: colors.primary + '40', backgroundColor: colors.primary + '0C' }]}
                      onPress={copyIframe}
                    >
                      {iframeCopied ? <Check size={15} color={colors.primary} /> : <Copy size={15} color={colors.primary} />}
                      <Text style={[s.copyCodeText, { color: colors.primary }]}>
                        {iframeCopied ? 'Copied!' : 'Copy iFrame Code'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={[s.embedCard, { backgroundColor: colors.card || colors.inputBackground }]}>
                    <View style={s.embedCardHeader}>
                      <View style={[s.embedBadge, { backgroundColor: '#34C75918' }]}>
                        <ExternalLink size={14} color="#34C759" />
                        <Text style={[s.embedBadgeText, { color: '#34C759' }]}>Widget</Text>
                      </View>
                      <Text style={[s.embedCardTitle, { color: colors.text }]}>Floating Button</Text>
                      <Text style={[s.embedCardDesc, { color: colors.textSecondary }]}>
                        Paste before {'</body>'} for a floating chat-style button that opens the portal in a slide-up panel.
                      </Text>
                    </View>
                    <View style={[s.codeBlock, { backgroundColor: colors.background || '#F2F2F7' }]}>
                      <Text style={[s.codeText, { color: colors.textSecondary }]} numberOfLines={3}>
                        {'<script> /* Client Hub widget */ ... </script>'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[s.copyCodeBtn, { borderColor: '#34C75940', backgroundColor: '#34C75908' }]}
                      onPress={copyWidget}
                    >
                      {widgetCopied ? <Check size={15} color="#34C759" /> : <Copy size={15} color="#34C759" />}
                      <Text style={[s.copyCodeText, { color: '#34C759' }]}>
                        {widgetCopied ? 'Copied!' : 'Copy Widget Code'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={[s.infoBanner, { backgroundColor: colors.inputBackground, marginTop: 0 }]}>
                    <Text style={[s.infoText, { color: colors.textSecondary }]}>
                      Both options automatically connect to your organization's portal at{' '}
                      <Text style={{ fontWeight: '600', color: colors.text }}>
                        {portalUrl.replace(/^https?:\/\//, '')}
                      </Text>
                      . No extra configuration needed.
                    </Text>
                  </View>
                </>
              ) : null}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <Text style={sectionHeaderStyle}>{label.toUpperCase()}</Text>
  );
}

const sectionHeaderStyle: any = {
  fontSize: 12,
  fontWeight: '600',
  color: '#8E8E93',
  letterSpacing: 0.6,
  paddingHorizontal: 20,
  paddingTop: 20,
  paddingBottom: 8,
};

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6, paddingHorizontal: 16, paddingVertical: 10 }}>
      <Text style={{ fontSize: 13, fontWeight: '500', color: '#8E8E93' }}>{label}</Text>
      {children}
    </View>
  );
}

function ToggleRow({ label, description, value, onChange, colors }: { label: string; description: string; value: boolean; onChange: (v: boolean) => void; colors: any }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 }}>
      <View style={{ flex: 1, marginRight: 16 }}>
        <Text style={{ fontSize: 15, fontWeight: '500', color: colors.text }}>{label}</Text>
        <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2, lineHeight: 18 }}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor="#fff"
      />
    </View>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: Platform.OS === 'ios' ? 56 : 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: { fontSize: 17, fontWeight: '600', color: colors.text },
    saveBtn: { fontSize: 16, fontWeight: '600' },
    scroll: { flex: 1 },
    scrollContent: { paddingBottom: 48 },
    enableRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      margin: 16,
      padding: 16,
      backgroundColor: colors.card || colors.inputBackground,
      borderRadius: 14,
    },
    enableLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, marginRight: 12 },
    enableTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
    enableSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    linkCard: {
      marginHorizontal: 16,
      padding: 14,
      backgroundColor: colors.inputBackground,
      borderRadius: 12,
      gap: 10,
    },
    linkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    linkText: { flex: 1, fontSize: 13, fontWeight: '500' },
    copyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 8,
      borderRadius: 8,
    },
    copyBtnGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 16,
    },
    copyBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },
    linkDisabledNote: { fontSize: 12, fontStyle: 'italic' },
    fieldGroup: {
      marginHorizontal: 16,
      backgroundColor: colors.card || colors.surface || colors.inputBackground,
      borderRadius: 14,
      overflow: 'hidden',
    },
    input: {
      borderRadius: 8,
      padding: 12,
      fontSize: 15,
      borderWidth: 0,
      ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
    },
    textArea: { minHeight: 80 },
    fieldLabel: { fontSize: 13, fontWeight: '500', marginBottom: 4 },
    timeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
    timeInput: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
    timeText: { fontSize: 15, fontWeight: '500', borderWidth: 0, flex: 1, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}) },
    timeSep: { fontSize: 14, marginBottom: 12 },
    daysWrap: { paddingHorizontal: 16, paddingBottom: 16 },
    daysRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    dayChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5 },
    dayChipText: { fontSize: 13, fontWeight: '600' },
    divider: { height: 1, marginHorizontal: 16 },
    infoBanner: { marginHorizontal: 16, borderRadius: 12, padding: 14 },
    infoText: { fontSize: 14, lineHeight: 20 },
    embedIntro: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      marginHorizontal: 16,
      borderRadius: 12,
      padding: 14,
      marginBottom: 4,
    },
    embedIntroText: { flex: 1, fontSize: 14, lineHeight: 20 },
    embedCard: {
      marginHorizontal: 16,
      marginBottom: 12,
      borderRadius: 14,
      overflow: 'hidden',
    },
    embedCardHeader: { padding: 16, gap: 4 },
    embedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      alignSelf: 'flex-start',
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 20,
      marginBottom: 6,
    },
    embedBadgeText: { fontSize: 12, fontWeight: '600' },
    embedCardTitle: { fontSize: 15, fontWeight: '600' },
    embedCardDesc: { fontSize: 13, lineHeight: 18 },
    codeBlock: {
      marginHorizontal: 14,
      borderRadius: 8,
      padding: 12,
      marginBottom: 12,
    },
    codeText: {
      fontSize: 11,
      lineHeight: 18,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : Platform.OS === 'android' ? 'monospace' : 'monospace',
    },
    copyCodeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginHorizontal: 14,
      marginBottom: 14,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
    },
    copyCodeText: { fontSize: 13, fontWeight: '600' },
    logoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    logoPreview: { width: 64, height: 64, borderRadius: 12, backgroundColor: colors.inputBackground },
    logoUploadBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1,
    },
    logoUploadText: { fontSize: 13, fontWeight: '600' },
    logoUploadAreaBtn: {
      alignItems: 'center', justifyContent: 'center',
      borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed',
      paddingVertical: 24, gap: 4,
    },
    limitRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    numberInput: {
      width: 72, textAlign: 'center',
      borderRadius: 8, borderWidth: 1,
      paddingHorizontal: 10, paddingVertical: 8,
      fontSize: 15, fontWeight: '600',
    },
    depositTypeRow: { flexDirection: 'row', gap: 10 },
    depositTypeChip: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      paddingVertical: 10, borderRadius: 10, borderWidth: 1.5,
    },
    depositTypeText: { fontSize: 13, fontWeight: '600' },
  });
}
