import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Dimensions,
  KeyboardAvoidingView,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Clock, CalendarDays, CircleCheck as CheckCircle, Phone, MessageSquare, CircleAlert as AlertCircle, ArrowLeft, Send, X, PhoneCall, PhoneMissed } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { portalPost, portalPostAuth, portalSupabase } from '@/lib/portalSupabase';
import { usePortalAuth } from '@/contexts/PortalAuthContext';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_MAP: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6,
};

interface WorkingHours {
  start_time: string;
  end_time: string;
  available_days: string[];
}

interface BusyWindow {
  start: string;
  end: string;
}

interface TimeSlot {
  start: string;
  end: string;
  label: string;
  busy: boolean;
}

type Step = 'calendar' | 'booking' | 'success' | 'call_success';

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function formatTime12(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function generateSlots(workingHours: WorkingHours, busyWindows: BusyWindow[]): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const start = timeToMinutes(workingHours.start_time);
  const end = timeToMinutes(workingHours.end_time);
  const duration = 60;
  for (let t = start; t + duration <= end; t += duration) {
    const slotStart = minutesToTime(t);
    const slotEnd = minutesToTime(t + duration);
    const busy = busyWindows.some(
      (w) => timeToMinutes(w.start) < t + duration && timeToMinutes(w.end) > t
    );
    slots.push({ start: slotStart, end: slotEnd, label: `${formatTime12(slotStart)} – ${formatTime12(slotEnd)}`, busy });
  }
  return slots;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

function toDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatDateDisplay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function isCurrentlyBusinessHours(workingHours: WorkingHours): boolean {
  const now = new Date();
  const dayName = DAY_LABELS[now.getDay()];
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = timeToMinutes(workingHours.start_time);
  const endMinutes = timeToMinutes(workingHours.end_time);
  const dayOpen = workingHours.available_days.some(
    (d) => DAY_MAP[d] === DAY_MAP[dayName]
  );
  return dayOpen && currentMinutes >= startMinutes && currentMinutes < endMinutes;
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

export default function PortalSchedule() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { session, portalClient, portalAccount, loading: authLoading } = usePortalAuth();

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [busySlotForCall, setBusySlotForCall] = useState<TimeSlot | null>(null);

  const [workingHours, setWorkingHours] = useState<WorkingHours | null>(null);
  const [busyWindows, setBusyWindows] = useState<Record<string, BusyWindow[]>>({});
  const [contactPhone, setContactPhone] = useState('');
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState('');

  const [step, setStep] = useState<Step>('calendar');
  const [serviceType, setServiceType] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#007AFF');

  useEffect(() => {
    if (!authLoading && !session) {
      router.replace(`/portal/${slug}` as any);
    }
  }, [authLoading, session]);

  useEffect(() => {
    loadAvailability(today.getFullYear(), today.getMonth() + 1);
  }, [slug]);

  useEffect(() => {
    loadAvailability(viewYear, viewMonth);
  }, [viewYear, viewMonth]);

  const loadAvailability = useCallback(async (year: number, month: number) => {
    setLoadingAvailability(true);
    setAvailabilityError('');
    try {
      const data = await portalPost({ action: 'get_availability', slug, year, month });
      if (data.error) { setAvailabilityError(data.error); return; }
      setWorkingHours(data.working_hours);
      setBusyWindows(data.busy_windows ?? {});
      if (data.contact_phone) setContactPhone(data.contact_phone);
      if (!primaryColor || primaryColor === '#007AFF') {
        try {
          const settingsData = await fetch(
            `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/portal-public-api?action=settings&slug=${slug}`,
            { headers: { apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '' } }
          ).then((r) => r.json());
          if (settingsData?.settings?.primary_color) setPrimaryColor(settingsData.settings.primary_color);
        } catch {}
      }
    } catch {
      setAvailabilityError('Failed to load availability.');
    } finally {
      setLoadingAvailability(false);
    }
  }, [slug]);

  const handleDateSelect = (dateStr: string) => {
    setSelectedDate(dateStr);
    setSelectedSlot(null);
    setBusySlotForCall(null);
    setStep('calendar');
  };

  const handleSlotSelect = (slot: TimeSlot) => {
    if (slot.busy) {
      setBusySlotForCall(slot);
      setSelectedSlot(null);
    } else {
      setSelectedSlot(slot);
      setBusySlotForCall(null);
      setStep('booking');
    }
  };

  const handleCallUs = () => {
    if (contactPhone) {
      const cleaned = contactPhone.replace(/\D/g, '');
      Linking.openURL(`tel:${cleaned}`);
    }
  };

  const handleSubmitRequest = async (phoneCallRequested: boolean, forSlot?: TimeSlot) => {
    if (!portalAccount || !portalClient) return;
    const slot = forSlot ?? selectedSlot;
    if (!selectedDate || !slot) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const { data: inserted, error } = await portalSupabase
        .from('client_work_requests')
        .insert({
          organization_id: portalAccount.organization_id,
          client_id: portalAccount.client_id,
          portal_account_id: portalAccount.id,
          requested_date: selectedDate,
          requested_start_time: slot.start,
          requested_end_time: slot.end,
          service_type: serviceType.trim(),
          notes: notes.trim(),
          phone_call_requested: phoneCallRequested,
          status: 'pending',
        })
        .select('id')
        .single();

      if (error) { setSubmitError('Submission failed. Please try again.'); return; }

      if (session?.access_token && inserted?.id) {
        try {
          await portalPostAuth(
            { action: 'notify_callback_request', work_request_id: inserted.id },
            session.access_token
          );
        } catch {}
        if (!phoneCallRequested) {
          try {
            await portalPostAuth(
              { action: 'send_booking_confirmation', work_request_id: inserted.id },
              session.access_token
            );
          } catch {}
        }
      }

      setStep(phoneCallRequested ? 'call_success' : 'success');
    } catch {
      setSubmitError('Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetAll = () => {
    setSelectedDate(null);
    setSelectedSlot(null);
    setBusySlotForCall(null);
    setStep('calendar');
    setServiceType('');
    setNotes('');
    setSubmitError('');
  };

  const prevMonth = () => {
    if (viewMonth === 1) { setViewYear(y => y - 1); setViewMonth(12); }
    else setViewMonth(m => m - 1);
    setSelectedDate(null);
    setSelectedSlot(null);
  };

  const nextMonth = () => {
    if (viewMonth === 12) { setViewYear(y => y + 1); setViewMonth(1); }
    else setViewMonth(m => m + 1);
    setSelectedDate(null);
    setSelectedSlot(null);
  };

  const todayStr = toDateString(today.getFullYear(), today.getMonth() + 1, today.getDate());
  const availableDayNums = new Set((workingHours?.available_days ?? []).map((d) => DAY_MAP[d] ?? -1));

  const isDayAvailable = (year: number, month: number, day: number): boolean => {
    const dateStr = toDateString(year, month, day);
    if (dateStr < todayStr) return false;
    const dayOfWeek = new Date(year, month - 1, day).getDay();
    return availableDayNums.has(dayOfWeek);
  };

  const hasBusyOnDate = (dateStr: string): boolean => {
    const windows = busyWindows[dateStr];
    if (!windows?.length || !workingHours) return false;
    return generateSlots(workingHours, windows).some((s) => s.busy);
  };

  const isFullyBusy = (dateStr: string): boolean => {
    if (!workingHours) return false;
    const windows = busyWindows[dateStr];
    if (!windows?.length) return false;
    return generateSlots(workingHours, windows).every((s) => s.busy);
  };

  const duringHours = workingHours ? isCurrentlyBusinessHours(workingHours) : false;
  const { width } = Dimensions.get('window');
  const isWide = width > 700;

  if (authLoading) {
    return (
      <View style={styles.fullCenter}>
        <ActivityIndicator size="large" color={primaryColor} />
      </View>
    );
  }

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const calendarCells: Array<number | null> = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (calendarCells.length % 7 !== 0) calendarCells.push(null);

  const selectedDateSlots: TimeSlot[] =
    selectedDate && workingHours
      ? generateSlots(workingHours, busyWindows[selectedDate] ?? [])
      : [];

  const canGoPrev =
    viewYear > today.getFullYear() ||
    (viewYear === today.getFullYear() && viewMonth > today.getMonth() + 1);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: '#F2F2F7' }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.header, { borderBottomColor: primaryColor + '20' }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={20} color={primaryColor} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <CalendarDays size={18} color={primaryColor} />
          <Text style={[styles.headerTitle, { color: primaryColor }]}>Schedule Appointment</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, isWide && styles.scrollContentWide]}
        keyboardShouldPersistTaps="handled"
      >
        {(step === 'success' || step === 'call_success') ? (
          <SuccessCard
            isCallRequest={step === 'call_success'}
            color={primaryColor}
            date={selectedDate!}
            slot={(selectedSlot ?? busySlotForCall)!}
            onScheduleAnother={resetAll}
            onGoHome={() => router.replace(`/portal/${slug}/dashboard` as any)}
          />
        ) : (
          <>
            <View style={[styles.card, isWide && styles.cardWide]}>
              <View style={styles.monthNav}>
                <TouchableOpacity
                  style={[styles.monthNavBtn, !canGoPrev && styles.monthNavBtnDisabled]}
                  onPress={prevMonth}
                  disabled={!canGoPrev}
                >
                  <ChevronLeft size={20} color={canGoPrev ? '#1C1C1E' : '#C7C7CC'} />
                </TouchableOpacity>
                <Text style={styles.monthLabel}>{MONTH_NAMES[viewMonth - 1]} {viewYear}</Text>
                <TouchableOpacity style={styles.monthNavBtn} onPress={nextMonth}>
                  <ChevronRight size={20} color="#1C1C1E" />
                </TouchableOpacity>
              </View>

              <View style={styles.dayHeaderRow}>
                {DAY_LABELS.map((d) => (
                  <Text key={d} style={styles.dayHeader}>{d}</Text>
                ))}
              </View>

              {loadingAvailability ? (
                <View style={styles.calendarLoader}>
                  <ActivityIndicator size="small" color={primaryColor} />
                  <Text style={styles.calendarLoaderText}>Loading availability...</Text>
                </View>
              ) : availabilityError ? (
                <View style={styles.calendarLoader}>
                  <AlertCircle size={20} color="#FF3B30" />
                  <Text style={[styles.calendarLoaderText, { color: '#FF3B30' }]}>{availabilityError}</Text>
                </View>
              ) : (
                <View style={styles.calendarGrid}>
                  {calendarCells.map((day, idx) => {
                    if (day === null) return <View key={`e-${idx}`} style={styles.dayCell} />;
                    const dateStr = toDateString(viewYear, viewMonth, day);
                    const isAvail = isDayAvailable(viewYear, viewMonth, day);
                    const isSel = selectedDate === dateStr;
                    const isToday = dateStr === todayStr;
                    const hasBusy = isAvail && hasBusyOnDate(dateStr);
                    const fullyBusy = isAvail && isFullyBusy(dateStr);
                    return (
                      <TouchableOpacity
                        key={dateStr}
                        style={[
                          styles.dayCell,
                          isAvail && !fullyBusy && styles.dayCellAvailable,
                          isToday && !isSel && styles.dayCellToday,
                          isSel && { backgroundColor: primaryColor },
                          fullyBusy && styles.dayCellFullBusy,
                          !isAvail && styles.dayCellDisabled,
                        ]}
                        onPress={() => isAvail && handleDateSelect(dateStr)}
                        disabled={!isAvail}
                      >
                        <Text style={[
                          styles.dayCellText,
                          !isAvail && styles.dayCellTextDisabled,
                          isToday && !isSel && { color: primaryColor, fontWeight: '700' },
                          isSel && { color: '#fff', fontWeight: '700' },
                        ]}>
                          {day}
                        </Text>
                        {hasBusy && !isSel && (
                          <View style={[styles.busyDot, fullyBusy ? styles.busyDotFull : { backgroundColor: '#FF9500' }]} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <View style={styles.legend}>
                <LegendItem color={primaryColor} label="Selected" filled />
                <LegendItem color="#FF9500" label="Partially busy" dot />
                <LegendItem color="#FF3B30" label="Fully booked" dot />
              </View>
            </View>

            {selectedDate && workingHours && (
              <View style={[styles.card, isWide && styles.cardWide, { marginTop: 12 }]}>
                <View style={styles.slotHeader}>
                  <Clock size={16} color={primaryColor} />
                  <Text style={[styles.slotHeaderText, { color: primaryColor }]}>
                    {formatDateDisplay(selectedDate)}
                  </Text>
                </View>

                {selectedDateSlots.length === 0 ? (
                  <View style={styles.noSlotsWrap}>
                    <AlertCircle size={20} color="#8E8E93" />
                    <Text style={styles.noSlotsText}>No time slots available for this day.</Text>
                  </View>
                ) : (
                  <View style={styles.slotsGrid}>
                    {selectedDateSlots.map((slot) => {
                      const isSel = selectedSlot?.start === slot.start;
                      const isCallTarget = busySlotForCall?.start === slot.start;
                      return (
                        <TouchableOpacity
                          key={slot.start}
                          style={[
                            styles.slotChip,
                            slot.busy && styles.slotChipBusy,
                            isSel && { backgroundColor: primaryColor, borderColor: primaryColor },
                            isCallTarget && styles.slotChipCallTarget,
                          ]}
                          onPress={() => handleSlotSelect(slot)}
                        >
                          <Text style={[
                            styles.slotChipText,
                            slot.busy && styles.slotChipTextBusy,
                            isSel && { color: '#fff' },
                          ]}>
                            {slot.label}
                          </Text>
                          {slot.busy && <Text style={styles.slotBusyLabel}>Busy</Text>}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {busySlotForCall && (
                  <BusySlotCallPrompt
                    slot={busySlotForCall}
                    workingHours={workingHours}
                    contactPhone={contactPhone}
                    duringHours={duringHours}
                    submitting={submitting}
                    submitError={submitError}
                    onCallUs={handleCallUs}
                    onRequestCallback={() => handleSubmitRequest(true, busySlotForCall)}
                    onDismiss={() => setBusySlotForCall(null)}
                  />
                )}
              </View>
            )}

            {step === 'booking' && selectedSlot && selectedDate && (
              <View style={[styles.card, isWide && styles.cardWide, { marginTop: 12 }]}>
                <View style={styles.bookingHeaderRow}>
                  <View style={[styles.bookingTimeTag, { backgroundColor: primaryColor + '18' }]}>
                    <Clock size={14} color={primaryColor} />
                    <Text style={[styles.bookingTimeTagText, { color: primaryColor }]}>
                      {formatDateDisplay(selectedDate)} · {selectedSlot.label}
                    </Text>
                  </View>
                </View>

                <Text style={styles.bookingTitle}>Confirm Your Request</Text>
                <Text style={styles.bookingSub}>
                  Tell us what you need and we'll confirm your appointment.
                </Text>

                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Type of Service</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. Window cleaning, estimate, maintenance..."
                    placeholderTextColor="#C7C7CC"
                    value={serviceType}
                    onChangeText={setServiceType}
                    returnKeyType="next"
                  />
                </View>

                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Additional Notes</Text>
                  <TextInput
                    style={[styles.formInput, styles.formTextArea]}
                    placeholder="Any details, special requests, or access notes..."
                    placeholderTextColor="#C7C7CC"
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>

                {submitError ? (
                  <View style={styles.errorBanner}>
                    <AlertCircle size={14} color="#FF3B30" />
                    <Text style={styles.errorBannerText}>{submitError}</Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                  onPress={() => handleSubmitRequest(false)}
                  disabled={submitting}
                >
                  <LinearGradient
                    colors={[primaryColor, shiftColor(primaryColor, -20)] as [string, string]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.submitBtnGradient}
                  >
                    {submitting
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <><Send size={16} color="#fff" /><Text style={styles.submitBtnText}>Request Appointment</Text></>}
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelBookingBtn}
                  onPress={() => { setStep('calendar'); setSelectedSlot(null); }}
                >
                  <Text style={styles.cancelBookingText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.helpBanner}>
              <MessageSquare size={16} color="#8E8E93" />
              <Text style={styles.helpBannerText}>
                Appointments are subject to confirmation. You'll be notified once your request is reviewed.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function BusySlotCallPrompt({
  slot, workingHours, contactPhone, duringHours,
  submitting, submitError, onCallUs, onRequestCallback, onDismiss,
}: {
  slot: TimeSlot;
  workingHours: WorkingHours;
  contactPhone: string;
  duringHours: boolean;
  submitting: boolean;
  submitError: string;
  onCallUs: () => void;
  onRequestCallback: () => void;
  onDismiss: () => void;
}) {
  return (
    <View style={styles.callPromptWrap}>
      <View style={styles.callPromptInner}>
        <View style={[styles.callPromptIconWrap, { backgroundColor: duringHours ? '#FFF5E6' : '#F2F2F7' }]}>
          {duringHours
            ? <PhoneCall size={22} color="#FF9500" />
            : <PhoneMissed size={22} color="#8E8E93" />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.callPromptTitle}>This slot is booked</Text>
          <Text style={styles.callPromptSub}>
            {duringHours
              ? contactPhone
                ? `We're open right now! Call us directly and we'll see if we can fit you in.`
                : `We may be able to work something out — request a callback and we'll reach out.`
              : `We're currently closed. Leave a callback request and we'll call you when we open.`}
          </Text>
          {!duringHours && workingHours && (
            <Text style={styles.hoursNote}>
              Hours: {formatTime12(workingHours.start_time)} – {formatTime12(workingHours.end_time)}
            </Text>
          )}
        </View>
      </View>

      {duringHours && contactPhone ? (
        <View style={styles.callActionsRow}>
          <TouchableOpacity
            style={[styles.callDirectBtn, { flex: 1, overflow: 'hidden' }]}
            onPress={onCallUs}
          >
            <LinearGradient
              colors={['#2D8B57', '#34a065'] as [string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.callDirectBtnGradient}
            >
              <Phone size={16} color="#fff" />
              <Text style={styles.callDirectBtnText}>Call Now</Text>
              <Text style={styles.callDirectBtnSub}>{contactPhone}</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.callbackSecondaryBtn, { flex: 1 }]}
            onPress={onRequestCallback}
            disabled={submitting}
          >
            {submitting
              ? <ActivityIndicator size="small" color="#FF9500" />
              : <>
                  <MessageSquare size={15} color="#FF9500" />
                  <Text style={styles.callbackSecondaryText}>Request Callback</Text>
                </>}
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.callRequestBtn, submitting && { opacity: 0.6 }]}
          onPress={onRequestCallback}
          disabled={submitting}
        >
          <LinearGradient
            colors={['#d4850a', '#c27608'] as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.callRequestBtnGradient}
          >
            {submitting
              ? <ActivityIndicator size="small" color="#fff" />
              : <>
                  <Phone size={15} color="#fff" />
                  <Text style={styles.callRequestBtnText}>Request a Callback</Text>
                </>}
          </LinearGradient>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.callPromptDismiss} onPress={onDismiss}>
        <X size={14} color="#8E8E93" />
        <Text style={styles.callPromptDismissText}>Choose a different time</Text>
      </TouchableOpacity>

      {submitError ? <Text style={styles.submitError}>{submitError}</Text> : null}
    </View>
  );
}

function LegendItem({ color, label, filled, dot }: { color: string; label: string; filled?: boolean; dot?: boolean }) {
  return (
    <View style={legendStyles.row}>
      {dot
        ? <View style={[legendStyles.dot, { backgroundColor: color }]} />
        : <View style={[legendStyles.circle, filled ? { backgroundColor: color } : { borderColor: color, borderWidth: 1.5 }]} />}
      <Text style={legendStyles.label}>{label}</Text>
    </View>
  );
}

const legendStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  circle: { width: 14, height: 14, borderRadius: 7 },
  label: { fontSize: 11, color: '#8E8E93' },
});

function SuccessCard({ isCallRequest, color, date, slot, onScheduleAnother, onGoHome }: {
  isCallRequest: boolean; color: string; date: string; slot: TimeSlot;
  onScheduleAnother: () => void; onGoHome: () => void;
}) {
  return (
    <View style={[styles.card, styles.successCard]}>
      <View style={[styles.successIconWrap, { backgroundColor: color + '18' }]}>
        {isCallRequest ? <PhoneCall size={36} color={color} /> : <CheckCircle size={36} color={color} />}
      </View>
      <Text style={[styles.successTitle, { color }]}>
        {isCallRequest ? 'Callback Requested!' : 'Request Submitted!'}
      </Text>
      <Text style={styles.successSub}>
        {isCallRequest
          ? `We'll give you a call to see if we can fit you in on ${formatDateDisplay(date)} around ${slot.label.split('–')[0].trim()}.`
          : `Your request for ${formatDateDisplay(date)} at ${slot.label.split('–')[0].trim()} has been received. We'll confirm shortly.`}
      </Text>
      <View style={styles.successDetails}>
        <View style={[styles.successDetailRow, { backgroundColor: color + '0C' }]}>
          <CalendarDays size={15} color={color} />
          <Text style={[styles.successDetailText, { color }]}>{formatDateDisplay(date)}</Text>
        </View>
        <View style={[styles.successDetailRow, { backgroundColor: color + '0C' }]}>
          <Clock size={15} color={color} />
          <Text style={[styles.successDetailText, { color }]}>{slot.label}</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.submitBtn} onPress={onGoHome}>
        <LinearGradient
          colors={[color, shiftColor(color, -20)] as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.submitBtnGradient}
        >
          <Text style={styles.submitBtnText}>Back to Dashboard</Text>
        </LinearGradient>
      </TouchableOpacity>
      <TouchableOpacity style={styles.cancelBookingBtn} onPress={onScheduleAnother}>
        <Text style={styles.cancelBookingText}>Schedule Another</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  fullCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 20,
    paddingBottom: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 48 },
  scrollContentWide: { paddingHorizontal: 48, maxWidth: 680, alignSelf: 'center', width: '100%' },
  card: {
    backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 12, elevation: 3,
  },
  cardWide: { maxWidth: 580 },
  monthNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, paddingBottom: 8,
  },
  monthNavBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#F2F2F7', alignItems: 'center', justifyContent: 'center',
  },
  monthNavBtnDisabled: { opacity: 0.4 },
  monthLabel: { fontSize: 17, fontWeight: '700', color: '#1C1C1E' },
  dayHeaderRow: { flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 8 },
  dayHeader: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', color: '#8E8E93', letterSpacing: 0.3 },
  calendarLoader: { alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  calendarLoaderText: { fontSize: 14, color: '#8E8E93' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8, paddingBottom: 8 },
  dayCell: {
    width: `${100 / 7}%` as any, aspectRatio: 1,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 999, padding: 4, position: 'relative',
  },
  dayCellAvailable: { backgroundColor: '#F9F9F9' },
  dayCellDisabled: { opacity: 0.3 },
  dayCellToday: { backgroundColor: '#F2F2F7' },
  dayCellFullBusy: { backgroundColor: '#FFF0F0' },
  dayCellText: { fontSize: 14, color: '#1C1C1E', fontWeight: '400' },
  dayCellTextDisabled: { color: '#C7C7CC' },
  busyDot: { position: 'absolute', bottom: 3, width: 5, height: 5, borderRadius: 3, backgroundColor: '#FF9500' },
  busyDotFull: { backgroundColor: '#FF3B30' },
  legend: { flexDirection: 'row', gap: 16, justifyContent: 'center', paddingBottom: 14, paddingTop: 4 },
  slotHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#F2F2F7',
  },
  slotHeaderText: { fontSize: 15, fontWeight: '600' },
  noSlotsWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 24, justifyContent: 'center' },
  noSlotsText: { fontSize: 14, color: '#8E8E93' },
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 16 },
  slotChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1.5, borderColor: '#E5E5EA', backgroundColor: '#fff',
  },
  slotChipBusy: { borderColor: '#FFCDD2', backgroundColor: '#FFF5F5' },
  slotChipCallTarget: { borderColor: '#FF9500', backgroundColor: '#FFF9F0' },
  slotChipText: { fontSize: 13, fontWeight: '500', color: '#1C1C1E' },
  slotChipTextBusy: { color: '#C7C7CC', textDecorationLine: 'line-through' },
  slotBusyLabel: {
    fontSize: 10, fontWeight: '600', color: '#FF3B30',
    backgroundColor: '#FFF0F0', paddingHorizontal: 5, paddingVertical: 1,
    borderRadius: 4, overflow: 'hidden',
  },
  callPromptWrap: {
    margin: 12, borderRadius: 12, backgroundColor: '#FFFBF5',
    borderWidth: 1, borderColor: '#FF950030', padding: 16, gap: 12,
  },
  callPromptInner: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  callPromptIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  callPromptTitle: { fontSize: 15, fontWeight: '600', color: '#1C1C1E', marginBottom: 3 },
  callPromptSub: { fontSize: 13, color: '#6C6C70', lineHeight: 19 },
  hoursNote: { fontSize: 12, color: '#8E8E93', marginTop: 4, fontWeight: '500' },
  callActionsRow: { flexDirection: 'row', gap: 8 },
  callDirectBtn: {
    borderRadius: 10,
    overflow: 'hidden' as const,
  },
  callDirectBtnGradient: {
    flexDirection: 'column' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 2,
    paddingVertical: 12,
  },
  callDirectBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  callDirectBtnSub: { fontSize: 11, color: 'rgba(255,255,255,0.85)' },
  callbackSecondaryBtn: {
    flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 12, borderRadius: 10,
    backgroundColor: '#FFF9F0', borderWidth: 1.5, borderColor: '#FF9500',
  },
  callbackSecondaryText: { fontSize: 13, fontWeight: '600', color: '#FF9500' },
  callRequestBtn: {
    borderRadius: 10, overflow: 'hidden' as const,
  },
  callRequestBtnGradient: {
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const,
    gap: 8, paddingVertical: 12,
  },
  callRequestBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  callPromptDismiss: { flexDirection: 'row', alignItems: 'center', gap: 5, justifyContent: 'center' },
  callPromptDismissText: { fontSize: 13, color: '#8E8E93' },
  bookingHeaderRow: { padding: 16, paddingBottom: 0 },
  bookingTimeTag: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  bookingTimeTagText: { fontSize: 12, fontWeight: '600' },
  bookingTitle: { fontSize: 20, fontWeight: '700', color: '#1C1C1E', paddingHorizontal: 16, marginTop: 10 },
  bookingSub: { fontSize: 14, color: '#8E8E93', paddingHorizontal: 16, marginTop: 4, marginBottom: 4, lineHeight: 20 },
  formField: { paddingHorizontal: 16, paddingVertical: 10, gap: 6 },
  formLabel: { fontSize: 13, fontWeight: '600', color: '#3C3C43' },
  formInput: {
    backgroundColor: '#F2F2F7', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#1C1C1E',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
  },
  formTextArea: { minHeight: 80 },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, padding: 12, backgroundColor: '#FFF2F2', borderRadius: 10,
  },
  errorBannerText: { flex: 1, fontSize: 13, color: '#FF3B30' },
  submitBtn: {
    marginHorizontal: 16, marginTop: 8, marginBottom: 4, borderRadius: 12, overflow: 'hidden' as const,
  },
  submitBtnGradient: {
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 8,
    paddingVertical: 14,
  },
  submitBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  cancelBookingBtn: { alignItems: 'center', paddingVertical: 12, marginBottom: 4 },
  cancelBookingText: { fontSize: 14, color: '#8E8E93' },
  helpBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    marginTop: 16, padding: 14, backgroundColor: '#F2F2F7', borderRadius: 12,
  },
  helpBannerText: { flex: 1, fontSize: 13, color: '#8E8E93', lineHeight: 19 },
  successCard: { marginTop: 16, padding: 0, alignItems: 'center' },
  successIconWrap: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center', marginTop: 36, marginBottom: 16,
  },
  successTitle: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  successSub: {
    fontSize: 15, color: '#8E8E93', textAlign: 'center',
    lineHeight: 22, paddingHorizontal: 24, marginBottom: 24,
  },
  successDetails: { width: '100%', paddingHorizontal: 16, gap: 8, marginBottom: 24 },
  successDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10 },
  successDetailText: { fontSize: 14, fontWeight: '600' },
  submitError: { fontSize: 13, color: '#FF3B30', textAlign: 'center', marginTop: 4 },
});
