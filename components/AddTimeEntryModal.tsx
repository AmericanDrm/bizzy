import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { X, Clock, User, Calendar, ChevronDown, Briefcase, Package, Check } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';

interface Profile {
  id: string;
  email: string;
  display_name: string | null;
}

interface ClientOption {
  id: string;
  name: string;
}

interface AddTimeEntryModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}

type EntryMode = 'clock_times' | 'duration';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function formatTo12(hour: number, minute: number) {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 || 12;
  return `${h}:${pad(minute)} ${ampm}`;
}

function parseTimeInput(value: string): { hour: number; minute: number } | null {
  const cleaned = value.trim().toUpperCase();
  const match = cleaned.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
  if (!match) return null;
  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const meridiem = match[3];
  if (meridiem === 'PM' && hour !== 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

function buildDateTime(date: Date, hour: number, minute: number): Date {
  const d = new Date(date);
  d.setHours(hour, minute, 0, 0);
  return d;
}

export default function AddTimeEntryModal({ visible, onClose, onSaved }: AddTimeEntryModalProps) {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [mode, setMode] = useState<EntryMode>('clock_times');

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [clientSearch, setClientSearch] = useState('');

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dateInput, setDateInput] = useState('');

  const [clockInInput, setClockInInput] = useState('8:00 AM');
  const [clockOutInput, setClockOutInput] = useState('5:00 PM');

  const [durationHours, setDurationHours] = useState('8');
  const [durationMinutes, setDurationMinutes] = useState('0');
  const [durationStartInput, setDurationStartInput] = useState('8:00 AM');

  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [jobCategories, setJobCategories] = useState<{ id: string; name: string; scope_options?: string | null }[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [serviceScope, setServiceScope] = useState<'full_service' | 'exterior_only'>('full_service');

  useEffect(() => {
    if (visible) {
      loadProfiles();
      loadClients();
      loadJobCategories();
      const today = new Date();
      setSelectedDate(today);
      setDateInput(formatDateDisplay(today));
      setSelectedUserId(user?.id || '');
      setSelectedClientId(null);
      setClientSearch('');
      setShowClientPicker(false);
      setClockInInput('8:00 AM');
      setClockOutInput('5:00 PM');
      setDurationHours('8');
      setDurationMinutes('0');
      setDurationStartInput('8:00 AM');
      setNotes('');
      setError(null);
      setSelectedCategoryId(null);
      setServiceScope('full_service');
      setShowCategoryPicker(false);
    }
  }, [visible]);

  const loadJobCategories = async () => {
    if (!currentOrganization?.id) return;
    try {
      const { data } = await supabase
        .from('job_type_categories')
        .select('id, name, scope_options')
        .eq('organization_id', currentOrganization.id)
        .order('name');
      setJobCategories(data || []);
    } catch (_) {}
  };

  const loadClients = async () => {
    if (!currentOrganization?.id) return;
    try {
      const { data } = await supabase
        .from('clients')
        .select('id, name')
        .eq('organization_id', currentOrganization.id)
        .order('name');
      setClients(data || []);
    } catch (_) {}
  };

  const loadProfiles = async () => {
    try {
      let query = supabase.from('profiles').select('id, email, display_name');
      if (currentOrganization?.id) {
        const { data: members } = await supabase
          .from('organization_members')
          .select('user_id')
          .eq('organization_id', currentOrganization.id);
        if (members && members.length > 0) {
          const ids = members.map((m: any) => m.user_id);
          query = query.in('id', ids);
        }
      }
      const { data } = await query;
      setProfiles(data || []);
    } catch (_) {}
  };

  function formatDateDisplay(d: Date) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function parseDateInput(raw: string): Date | null {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d;
    return null;
  }

  const handleDateChange = (text: string) => {
    setDateInput(text);
    const parsed = parseDateInput(text);
    if (parsed) setSelectedDate(parsed);
  };

  const adjustDate = (delta: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    setSelectedDate(d);
    setDateInput(formatDateDisplay(d));
  };

  const selectedProfile = profiles.find(p => p.id === selectedUserId);
  const profileName = (p: Profile) => p.display_name || p.email?.split('@')[0] || p.email;

  const handleSave = async () => {
    setError(null);
    if (!selectedUserId) { setError('Please select an employee.'); return; }

    let clockIn: Date;
    let clockOut: Date;

    if (mode === 'clock_times') {
      const inParsed = parseTimeInput(clockInInput);
      const outParsed = parseTimeInput(clockOutInput);
      if (!inParsed) { setError('Invalid clock-in time. Use format like 8:00 AM'); return; }
      if (!outParsed) { setError('Invalid clock-out time. Use format like 5:00 PM'); return; }
      clockIn = buildDateTime(selectedDate, inParsed.hour, inParsed.minute);
      clockOut = buildDateTime(selectedDate, outParsed.hour, outParsed.minute);
      if (clockOut <= clockIn) {
        clockOut.setDate(clockOut.getDate() + 1);
      }
    } else {
      const startParsed = parseTimeInput(durationStartInput);
      if (!startParsed) { setError('Invalid start time. Use format like 8:00 AM'); return; }
      const hrs = parseFloat(durationHours) || 0;
      const mins = parseFloat(durationMinutes) || 0;
      if (hrs === 0 && mins === 0) { setError('Duration must be greater than 0.'); return; }
      clockIn = buildDateTime(selectedDate, startParsed.hour, startParsed.minute);
      clockOut = new Date(clockIn.getTime() + (hrs * 60 + mins) * 60 * 1000);
    }

    setSaving(true);
    try {
      const payload: any = {
        user_id: selectedUserId,
        clock_in: clockIn.toISOString(),
        clock_out: clockOut.toISOString(),
        is_clocked_in: false,
        notes: notes.trim() || null,
      };
      if (selectedClientId) payload.client_id = selectedClientId;
      if (currentOrganization?.id) payload.organization_id = currentOrganization.id;
      const { error: insertError } = await supabase.from('time_entries').insert(payload);
      if (insertError) throw insertError;

      // If a client and a category with scope options were chosen, also create a service history record
      const selectedCat = jobCategories.find(c => c.id === selectedCategoryId);
      if (selectedClientId && selectedCat?.scope_options && currentOrganization?.id) {
        const scope = selectedCat.scope_options === 'exterior_only' ? 'exterior_only' : serviceScope;
        const { data: newEvent } = await supabase
          .from('schedule_events')
          .insert({
            user_id: selectedUserId,
            client_id: selectedClientId,
            organization_id: currentOrganization.id,
            title: selectedCat.name,
            start_time: clockIn.toISOString(),
            end_time: clockOut.toISOString(),
            payment_status: 'unpaid',
          })
          .select('id')
          .maybeSingle();
        if (newEvent?.id) {
          await supabase.from('schedule_event_line_items').insert({
            schedule_event_id: newEvent.id,
            organization_id: currentOrganization.id,
            description: selectedCat.name,
            service_scope: scope,
            quantity: 1,
            unit_price: 0,
            total: 0,
          });
        }
      }

      onSaved();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to save entry.');
    } finally {
      setSaving(false);
    }
  };

  const bg = isDark ? '#0f172a' : '#ffffff';
  const cardBg = isDark ? '#1e293b' : '#f8fafc';
  const borderColor = isDark ? '#334155' : '#e2e8f0';
  const textColor = colors.text;
  const mutedColor = isDark ? '#64748b' : '#94a3b8';
  const inputBg = isDark ? '#0f172a' : '#ffffff';
  const accentColor = '#0ea5e9';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: bg }]}>
        <View style={[styles.header, { borderBottomColor: borderColor }]}>
          <Text style={[styles.title, { color: textColor }]}>Add Time Entry</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <X size={20} color={mutedColor} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Employee Selector */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: mutedColor }]}>Employee</Text>
            <TouchableOpacity
              style={[styles.selector, { backgroundColor: cardBg, borderColor }]}
              onPress={() => setShowUserPicker(!showUserPicker)}
            >
              <User size={16} color={accentColor} />
              <Text style={[styles.selectorText, { color: textColor }]}>
                {selectedProfile ? profileName(selectedProfile) : 'Select employee'}
              </Text>
              <ChevronDown size={16} color={mutedColor} />
            </TouchableOpacity>
            {showUserPicker && (
              <View style={[styles.dropdown, { backgroundColor: cardBg, borderColor }]}>
                {profiles.map(p => (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.dropdownItem, { borderBottomColor: borderColor }]}
                    onPress={() => { setSelectedUserId(p.id); setShowUserPicker(false); }}
                  >
                    <Text style={[styles.dropdownItemText, { color: textColor }, selectedUserId === p.id && { color: accentColor }]}>
                      {profileName(p)}
                    </Text>
                    {p.id === user?.id && (
                      <Text style={[styles.youBadge, { color: accentColor }]}>You</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Client Selector (optional, links to client service record) */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: mutedColor }]}>Client (optional)</Text>
            <TouchableOpacity
              style={[styles.selector, { backgroundColor: cardBg, borderColor }]}
              onPress={() => setShowClientPicker(!showClientPicker)}
            >
              <Briefcase size={16} color={accentColor} />
              <Text style={[styles.selectorText, { color: selectedClientId ? textColor : mutedColor }]}>
                {selectedClientId
                  ? (clients.find(c => c.id === selectedClientId)?.name || 'Client')
                  : 'No client (unassigned time)'}
              </Text>
              {selectedClientId ? (
                <TouchableOpacity onPress={() => setSelectedClientId(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <X size={14} color={mutedColor} />
                </TouchableOpacity>
              ) : (
                <ChevronDown size={16} color={mutedColor} />
              )}
            </TouchableOpacity>
            {showClientPicker && (
              <View style={[styles.dropdown, { backgroundColor: cardBg, borderColor, maxHeight: 240 }]}>
                <TextInput
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    fontSize: 14,
                    color: textColor,
                    borderBottomWidth: 1,
                    borderBottomColor: borderColor,
                  }}
                  value={clientSearch}
                  onChangeText={setClientSearch}
                  placeholder="Search clients..."
                  placeholderTextColor={mutedColor}
                />
                <ScrollView keyboardShouldPersistTaps="handled">
                  {clients
                    .filter(c => !clientSearch.trim() || c.name.toLowerCase().includes(clientSearch.toLowerCase()))
                    .map(c => (
                      <TouchableOpacity
                        key={c.id}
                        style={[styles.dropdownItem, { borderBottomColor: borderColor }]}
                        onPress={() => {
                          setSelectedClientId(c.id);
                          setShowClientPicker(false);
                          setClientSearch('');
                        }}
                      >
                        <Text style={[styles.dropdownItemText, { color: textColor }, selectedClientId === c.id && { color: accentColor }]}>
                          {c.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  {clients.length === 0 && (
                    <View style={{ padding: 14 }}>
                      <Text style={{ fontSize: 13, color: mutedColor }}>No clients found</Text>
                    </View>
                  )}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Job Category + Service Scope */}
          {jobCategories.length > 0 && (() => {
            const selectedCat = jobCategories.find(c => c.id === selectedCategoryId);
            const catScope = selectedCat?.scope_options;
            return (
              <View style={styles.section}>
                <Text style={[styles.label, { color: mutedColor }]}>Job Category (optional)</Text>
                <TouchableOpacity
                  style={[styles.selector, { backgroundColor: cardBg, borderColor: selectedCategoryId ? accentColor : borderColor }]}
                  onPress={() => setShowCategoryPicker(!showCategoryPicker)}
                >
                  <Package size={16} color={selectedCategoryId ? accentColor : mutedColor} />
                  <Text style={[styles.selectorText, { color: selectedCategoryId ? textColor : mutedColor }]}>
                    {selectedCategoryId ? selectedCat?.name || 'Category' : 'Select category'}
                  </Text>
                  {selectedCategoryId ? (
                    <TouchableOpacity onPress={() => { setSelectedCategoryId(null); setServiceScope('full_service'); setShowCategoryPicker(false); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <X size={14} color={mutedColor} />
                    </TouchableOpacity>
                  ) : (
                    <ChevronDown size={16} color={mutedColor} />
                  )}
                </TouchableOpacity>
                {showCategoryPicker && (
                  <View style={[styles.dropdown, { backgroundColor: cardBg, borderColor, maxHeight: 220 }]}>
                    <ScrollView keyboardShouldPersistTaps="handled">
                      {jobCategories.map(cat => (
                        <TouchableOpacity
                          key={cat.id}
                          style={[styles.dropdownItem, { borderBottomColor: borderColor }]}
                          onPress={() => {
                            setSelectedCategoryId(cat.id);
                            setShowCategoryPicker(false);
                            if (cat.scope_options === 'exterior_only') {
                              setServiceScope('exterior_only');
                            } else {
                              setServiceScope('full_service');
                            }
                          }}
                        >
                          <Text style={[styles.dropdownItemText, { color: selectedCategoryId === cat.id ? accentColor : textColor }]}>
                            {cat.name}
                          </Text>
                          {(cat.scope_options === 'both' || cat.scope_options === 'exterior_only') && (
                            <View style={{ backgroundColor: accentColor + '20', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                              <Text style={{ fontSize: 10, color: accentColor, fontWeight: '600' }}>
                                {cat.scope_options === 'exterior_only' ? 'Ext Only' : 'Full/Ext'}
                              </Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
                {/* Scope toggle — only when selected category supports both */}
                {selectedCategoryId && catScope === 'both' && (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    <TouchableOpacity
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: serviceScope === 'full_service' ? accentColor : borderColor, backgroundColor: serviceScope === 'full_service' ? accentColor + '12' : cardBg }}
                      onPress={() => setServiceScope('full_service')}
                    >
                      {serviceScope === 'full_service' && <Check size={13} color={accentColor} />}
                      <Text style={{ fontSize: 13, fontWeight: '600', color: serviceScope === 'full_service' ? accentColor : mutedColor }}>Full Service</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: serviceScope === 'exterior_only' ? accentColor : borderColor, backgroundColor: serviceScope === 'exterior_only' ? accentColor + '12' : cardBg }}
                      onPress={() => setServiceScope('exterior_only')}
                    >
                      {serviceScope === 'exterior_only' && <Check size={13} color={accentColor} />}
                      <Text style={{ fontSize: 13, fontWeight: '600', color: serviceScope === 'exterior_only' ? accentColor : mutedColor }}>Exterior Only</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {/* Fixed exterior-only label when category is exterior_only */}
                {selectedCategoryId && catScope === 'exterior_only' && (
                  <View style={{ marginTop: 8, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#f59e0b15', borderWidth: 1, borderColor: '#f59e0b40' }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#b45309' }}>Exterior Only — set by job category</Text>
                  </View>
                )}
              </View>
            );
          })()}

          {/* Date */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: mutedColor }]}>Date</Text>
            <View style={[styles.dateRow, { backgroundColor: cardBg, borderColor }]}>
              <TouchableOpacity onPress={() => adjustDate(-1)} style={styles.dateArrow}>
                <Text style={[styles.dateArrowText, { color: accentColor }]}>‹</Text>
              </TouchableOpacity>
              <View style={styles.dateInputWrap}>
                <Calendar size={14} color={accentColor} />
                <TextInput
                  style={[styles.dateInput, { color: textColor }]}
                  value={dateInput}
                  onChangeText={handleDateChange}
                  placeholder="e.g. Mar 25, 2026"
                  placeholderTextColor={mutedColor}
                />
              </View>
              <TouchableOpacity onPress={() => adjustDate(1)} style={styles.dateArrow}>
                <Text style={[styles.dateArrowText, { color: accentColor }]}>›</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Mode Toggle */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: mutedColor }]}>Entry Type</Text>
            <View style={[styles.modeToggle, { backgroundColor: cardBg, borderColor }]}>
              <TouchableOpacity
                style={[styles.modeBtn, mode === 'clock_times' && { backgroundColor: accentColor }]}
                onPress={() => setMode('clock_times')}
              >
                <Text style={[styles.modeBtnText, { color: mode === 'clock_times' ? '#ffffff' : mutedColor }]}>Clock In/Out</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, mode === 'duration' && { backgroundColor: accentColor }]}
                onPress={() => setMode('duration')}
              >
                <Text style={[styles.modeBtnText, { color: mode === 'duration' ? '#ffffff' : mutedColor }]}>Duration</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Clock In / Out Mode */}
          {mode === 'clock_times' && (
            <View style={styles.section}>
              <View style={styles.timeRow}>
                <View style={styles.timeField}>
                  <Text style={[styles.label, { color: mutedColor }]}>Clock In</Text>
                  <View style={[styles.timeInput, { backgroundColor: inputBg, borderColor }]}>
                    <Clock size={14} color={accentColor} />
                    <TextInput
                      style={[styles.timeText, { color: textColor }]}
                      value={clockInInput}
                      onChangeText={setClockInInput}
                      placeholder="8:00 AM"
                      placeholderTextColor={mutedColor}
                      autoCapitalize="characters"
                    />
                  </View>
                </View>
                <View style={styles.timeSep}>
                  <Text style={[styles.timeSepText, { color: mutedColor }]}>→</Text>
                </View>
                <View style={styles.timeField}>
                  <Text style={[styles.label, { color: mutedColor }]}>Clock Out</Text>
                  <View style={[styles.timeInput, { backgroundColor: inputBg, borderColor }]}>
                    <Clock size={14} color={accentColor} />
                    <TextInput
                      style={[styles.timeText, { color: textColor }]}
                      value={clockOutInput}
                      onChangeText={setClockOutInput}
                      placeholder="5:00 PM"
                      placeholderTextColor={mutedColor}
                      autoCapitalize="characters"
                    />
                  </View>
                </View>
              </View>
              <Text style={[styles.hint, { color: mutedColor }]}>Enter times like "8:00 AM" or "17:00"</Text>
            </View>
          )}

          {/* Duration Mode */}
          {mode === 'duration' && (
            <View style={styles.section}>
              <View style={styles.timeField}>
                <Text style={[styles.label, { color: mutedColor }]}>Start Time</Text>
                <View style={[styles.timeInput, { backgroundColor: inputBg, borderColor }]}>
                  <Clock size={14} color={accentColor} />
                  <TextInput
                    style={[styles.timeText, { color: textColor }]}
                    value={durationStartInput}
                    onChangeText={setDurationStartInput}
                    placeholder="8:00 AM"
                    placeholderTextColor={mutedColor}
                    autoCapitalize="characters"
                  />
                </View>
              </View>
              <View style={[styles.durationRow, { marginTop: 12 }]}>
                <View style={styles.durationField}>
                  <Text style={[styles.label, { color: mutedColor }]}>Hours</Text>
                  <View style={[styles.durationInput, { backgroundColor: inputBg, borderColor }]}>
                    <TextInput
                      style={[styles.durationText, { color: textColor }]}
                      value={durationHours}
                      onChangeText={setDurationHours}
                      keyboardType="numeric"
                      placeholder="8"
                      placeholderTextColor={mutedColor}
                    />
                    <Text style={[styles.durationUnit, { color: mutedColor }]}>hrs</Text>
                  </View>
                </View>
                <View style={styles.durationField}>
                  <Text style={[styles.label, { color: mutedColor }]}>Minutes</Text>
                  <View style={[styles.durationInput, { backgroundColor: inputBg, borderColor }]}>
                    <TextInput
                      style={[styles.durationText, { color: textColor }]}
                      value={durationMinutes}
                      onChangeText={setDurationMinutes}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={mutedColor}
                    />
                    <Text style={[styles.durationUnit, { color: mutedColor }]}>min</Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Notes */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: mutedColor }]}>Notes (optional)</Text>
            <TextInput
              style={[styles.notesInput, { backgroundColor: inputBg, borderColor, color: textColor }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Add a note..."
              placeholderTextColor={mutedColor}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {error && (
            <View style={[styles.errorBox, { backgroundColor: isDark ? '#1e1010' : '#fef2f2', borderColor: '#ef4444' }]}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: borderColor, backgroundColor: bg }]}>
          <TouchableOpacity style={[styles.cancelBtn, { borderColor }]} onPress={onClose}>
            <Text style={[styles.cancelText, { color: mutedColor }]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: accentColor }, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.saveText}>Save Entry</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  title: { fontSize: 18, fontWeight: '700' },
  closeBtn: { padding: 4 },
  body: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  section: { marginBottom: 20 },
  label: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  selectorText: { flex: 1, fontSize: 15 },
  dropdown: {
    borderWidth: 1,
    borderRadius: 10,
    marginTop: 4,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  dropdownItemText: { fontSize: 15 },
  youBadge: { fontSize: 11, fontWeight: '600' },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  dateArrow: { paddingHorizontal: 14, paddingVertical: 12 },
  dateArrowText: { fontSize: 22, fontWeight: '300' },
  dateInputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateInput: { flex: 1, fontSize: 15, paddingVertical: 12 },
  modeToggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 10,
    padding: 3,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  modeBtnText: { fontSize: 13, fontWeight: '600' },
  timeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  timeField: { flex: 1, minWidth: 0 },
  timeSep: { paddingBottom: 12, flexShrink: 0 },
  timeSepText: { fontSize: 16 },
  timeInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 0,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  timeText: { flex: 1, flexShrink: 1, fontSize: 15 },
  hint: { fontSize: 11, marginTop: 6 },
  durationRow: { flexDirection: 'row', gap: 12 },
  durationField: { flex: 1 },
  durationInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  durationText: { flex: 1, fontSize: 15 },
  durationUnit: { fontSize: 13 },
  notesInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 80,
  },
  errorBox: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  errorText: { color: '#ef4444', fontSize: 13 },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelText: { fontSize: 15, fontWeight: '600' },
  saveBtn: {
    flex: 2,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveText: { fontSize: 15, fontWeight: '700', color: '#ffffff' },
});
