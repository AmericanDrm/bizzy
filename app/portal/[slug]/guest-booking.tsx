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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  CalendarDays,
  CircleCheck as CheckCircle,
  CircleAlert as AlertCircle,
  ArrowLeft,
  Send,
  User,
  Mail,
  Phone,
  Bell,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { portalPost, portalGet } from '@/lib/portalSupabase';

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

type Step = 'info' | 'calendar' | 'booking' | 'success';
type NotifPref = 'email' | 'text' | 'both';

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

interface SubmittedSummary {
  guest_name: string;
  guest_email: string;
  requested_date: string;
  requested_start_time: string;
  requested_end_time: string;
  service_type: string;
  notes: string;
}

export default function GuestBooking() {
  const { slug, email: prefillEmail } = useLocalSearchParams<{ slug: string; email?: string }>();
  const router = useRouter();

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  const [workingHours, setWorkingHours] = useState<WorkingHours | null>(null);
  const [busyWindows, setBusyWindows] = useState<Record<string, BusyWindow[]>>({});
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState('');

  const [step, setStep] = useState<Step>('info');
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState(prefillEmail || '');
  const [guestPhone, setGuestPhone] = useState('');
  const [notifPref, setNotifPref] = useState<NotifPref>('email');
  const [serviceType, setServiceType] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#007AFF');
  const [orgName, setOrgName] = useState('');
  const [submittedSummary, setSubmittedSummary] = useState<SubmittedSummary | null>(null);

  useEffect(() => {
    if (slug) {
      loadSettings();
      loadAvailability(today.getFullYear(), today.getMonth() + 1);
    }
  }, [slug]);

  useEffect(() => {
    loadAvailability(viewYear, viewMonth);
  }, [viewYear, viewMonth]);

  const loadSettings = async () => {
    try {
      const data = await portalGet({ action: 'settings', slug });
      if (data?.settings?.primary_color) setPrimaryColor(data.settings.primary_color);
      if (data?.organization?.name) setOrgName(data.organization.name);
    } catch {}
  };

  const loadAvailability = useCallback(async (year: number, month: number) => {
    setLoadingAvailability(true);
    setAvailabilityError('');
    try {
      const data = await portalPost({ action: 'get_availability', slug, year, month });
      if (data.error) { setAvailabilityError(data.error); return; }
      setWorkingHours(data.working_hours);
      setBusyWindows(data.busy_windows ?? {});
    } catch {
      setAvailabilityError('Failed to load availability.');
    } finally {
      setLoadingAvailability(false);
    }
  }, [slug]);

  const handleDateSelect = (dateStr: string) => {
    setSelectedDate(dateStr);
    setSelectedSlot(null);
  };

  const handleSlotSelect = (slot: TimeSlot) => {
    if (slot.busy) return;
    setSelectedSlot(slot);
    setStep('booking');
  };

  const handleContinueToCalendar = () => {
    if (!guestName.trim() || !guestEmail.trim()) return;
    setStep('calendar');
  };

  const handleSubmit = async () => {
    if (!selectedDate || !selectedSlot) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const data = await portalPost({
        action: 'guest_booking',
        slug,
        guest_name: guestName.trim(),
        guest_email: guestEmail.trim().toLowerCase(),
        guest_phone: guestPhone.trim(),
        guest_notification_preference: notifPref,
        requested_date: selectedDate,
        requested_start_time: selectedSlot.start,
        requested_end_time: selectedSlot.end,
        service_type: serviceType.trim(),
        notes: notes.trim(),
      });

      if (data.error) {
        setSubmitError(data.error);
        return;
      }

      setSubmittedSummary(data.summary ?? {
        guest_name: guestName.trim(),
        guest_email: guestEmail.trim().toLowerCase(),
        requested_date: selectedDate,
        requested_start_time: selectedSlot.start,
        requested_end_time: selectedSlot.end,
        service_type: serviceType.trim(),
        notes: notes.trim(),
      });
      setStep('success');
    } catch {
      setSubmitError('Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
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

  const { width } = Dimensions.get('window');
  const isWide = width > 700;

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

  const canContinue = guestName.trim().length > 0 && guestEmail.trim().length > 0;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: '#F2F2F7' }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.header, { borderBottomColor: primaryColor + '20' }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            if (step === 'booking') { setStep('calendar'); setSelectedSlot(null); }
            else if (step === 'calendar') setStep('info');
            else router.back();
          }}
        >
          <ArrowLeft size={20} color={primaryColor} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <CalendarDays size={18} color={primaryColor} />
          <Text style={[styles.headerTitle, { color: primaryColor }]}>Guest Booking</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, isWide && styles.scrollContentWide]}
        keyboardShouldPersistTaps="handled"
      >
        {step === 'success' && submittedSummary ? (
          <View style={[styles.card, styles.successCard]}>
            <View style={[styles.successIconWrap, { backgroundColor: primaryColor + '18' }]}>
              <CheckCircle size={36} color={primaryColor} />
            </View>
            <Text style={[styles.successTitle, { color: primaryColor }]}>Request Submitted!</Text>
            <Text style={styles.successSub}>
              {orgName || 'The business'} will review your request and get back to you.
            </Text>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryHeading}>What You Submitted</Text>
              <SummaryRow label="Name" value={submittedSummary.guest_name} />
              <SummaryRow label="Email" value={submittedSummary.guest_email} />
              {guestPhone.trim() ? <SummaryRow label="Phone" value={guestPhone.trim()} /> : null}
              <SummaryRow label="Date" value={formatDateDisplay(submittedSummary.requested_date)} />
              <SummaryRow
                label="Time"
                value={`${formatTime12(submittedSummary.requested_start_time)} – ${formatTime12(submittedSummary.requested_end_time)}`}
              />
              {submittedSummary.service_type ? <SummaryRow label="Service" value={submittedSummary.service_type} /> : null}
              {submittedSummary.notes ? <SummaryRow label="Notes" value={submittedSummary.notes} /> : null}
              <SummaryRow
                label="Notify via"
                value={notifPref === 'both' ? 'Email & Text' : notifPref === 'text' ? 'Text Message' : 'Email'}
              />
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={() => router.back()}>
              <LinearGradient
                colors={[primaryColor, shiftColor(primaryColor, -20)] as [string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.submitBtnGradient}
              >
                <Text style={styles.submitBtnText}>Back to Portal</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : step === 'info' ? (
          <View style={[styles.card, isWide && styles.cardWide]}>
            <View style={styles.infoHeader}>
              <View style={[styles.infoIconWrap, { backgroundColor: primaryColor + '15' }]}>
                <User size={24} color={primaryColor} />
              </View>
              <Text style={styles.infoTitle}>Your Information</Text>
              <Text style={styles.infoSub}>
                Tell us a bit about yourself so {orgName || 'the business'} can reach you.
              </Text>
            </View>

            <View style={styles.formField}>
              <Text style={styles.formLabel}>Full Name *</Text>
              <View style={styles.inputRow}>
                <User size={16} color="#8E8E93" />
                <TextInput
                  style={styles.inputRowText}
                  placeholder="Your full name"
                  placeholderTextColor="#C7C7CC"
                  value={guestName}
                  onChangeText={setGuestName}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </View>
            </View>

            <View style={styles.formField}>
              <Text style={styles.formLabel}>Email Address *</Text>
              <View style={styles.inputRow}>
                <Mail size={16} color="#8E8E93" />
                <TextInput
                  style={styles.inputRowText}
                  placeholder="your@email.com"
                  placeholderTextColor="#C7C7CC"
                  value={guestEmail}
                  onChangeText={setGuestEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  returnKeyType="next"
                />
              </View>
            </View>

            <View style={styles.formField}>
              <Text style={styles.formLabel}>Phone Number</Text>
              <View style={styles.inputRow}>
                <Phone size={16} color="#8E8E93" />
                <TextInput
                  style={styles.inputRowText}
                  placeholder="(555) 123-4567"
                  placeholderTextColor="#C7C7CC"
                  value={guestPhone}
                  onChangeText={setGuestPhone}
                  keyboardType="phone-pad"
                  returnKeyType="done"
                />
              </View>
            </View>

            <View style={styles.formField}>
              <Text style={styles.formLabel}>How should we notify you?</Text>
              <View style={styles.notifRow}>
                {(['email', 'text', 'both'] as NotifPref[]).map((pref) => (
                  <TouchableOpacity
                    key={pref}
                    style={[
                      styles.notifChip,
                      notifPref === pref && { backgroundColor: primaryColor + '18', borderColor: primaryColor },
                    ]}
                    onPress={() => setNotifPref(pref)}
                  >
                    <Bell size={14} color={notifPref === pref ? primaryColor : '#8E8E93'} />
                    <Text
                      style={[
                        styles.notifChipText,
                        notifPref === pref && { color: primaryColor, fontWeight: '600' },
                      ]}
                    >
                      {pref === 'both' ? 'Both' : pref === 'text' ? 'Text' : 'Email'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {notifPref !== 'email' && !guestPhone.trim() && (
                <Text style={styles.notifHint}>
                  Phone number is required for text notifications
                </Text>
              )}
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, !canContinue && { opacity: 0.5 }]}
              onPress={handleContinueToCalendar}
              disabled={!canContinue}
            >
              <LinearGradient
                colors={[primaryColor, shiftColor(primaryColor, -20)] as [string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.submitBtnGradient}
              >
                <Text style={styles.submitBtnText}>Choose a Date</Text>
                <ChevronRight size={18} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={[styles.card, isWide && styles.cardWide]}>
              <View style={styles.guestTag}>
                <User size={13} color={primaryColor} />
                <Text style={[styles.guestTagText, { color: primaryColor }]}>
                  Booking as {guestName.split(' ')[0]}
                </Text>
                <Text style={styles.guestTagEmail}>{guestEmail}</Text>
              </View>

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

            {selectedDate && workingHours && step === 'calendar' && (
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
                    {selectedDateSlots.map((slot) => (
                      <TouchableOpacity
                        key={slot.start}
                        style={[
                          styles.slotChip,
                          slot.busy && styles.slotChipBusy,
                        ]}
                        onPress={() => handleSlotSelect(slot)}
                        disabled={slot.busy}
                      >
                        <Text style={[
                          styles.slotChipText,
                          slot.busy && styles.slotChipTextBusy,
                        ]}>
                          {slot.label}
                        </Text>
                        {slot.busy && <Text style={styles.slotBusyLabel}>Busy</Text>}
                      </TouchableOpacity>
                    ))}
                  </View>
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
                  onPress={handleSubmit}
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
                      : <><Send size={16} color="#fff" /><Text style={styles.submitBtnText}>Submit Request</Text></>}
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelBookingBtn}
                  onPress={() => { setStep('calendar'); setSelectedSlot(null); }}
                >
                  <Text style={styles.cancelBookingText}>Choose a different time</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.helpBanner}>
              <AlertCircle size={16} color="#8E8E93" />
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

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
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

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  infoHeader: { alignItems: 'center', paddingTop: 28, paddingBottom: 8, paddingHorizontal: 24, gap: 8 },
  infoIconWrap: {
    width: 56, height: 56, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  infoTitle: { fontSize: 22, fontWeight: '700', color: '#1C1C1E' },
  infoSub: { fontSize: 14, color: '#8E8E93', textAlign: 'center', lineHeight: 20 },
  formField: { paddingHorizontal: 20, paddingVertical: 8, gap: 6 },
  formLabel: { fontSize: 13, fontWeight: '600', color: '#3C3C43' },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#F2F2F7', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  inputRowText: {
    flex: 1, fontSize: 15, color: '#1C1C1E',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
  },
  notifRow: { flexDirection: 'row', gap: 8 },
  notifChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1.5, borderColor: '#E5E5EA', backgroundColor: '#fff',
  },
  notifChipText: { fontSize: 13, color: '#8E8E93' },
  notifHint: { fontSize: 12, color: '#FF9500', marginTop: 4 },
  guestTag: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#F9F9FB', borderBottomWidth: 1, borderBottomColor: '#F2F2F7',
  },
  guestTagText: { fontSize: 13, fontWeight: '600' },
  guestTagEmail: { fontSize: 12, color: '#8E8E93' },
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
  slotChipText: { fontSize: 13, fontWeight: '500', color: '#1C1C1E' },
  slotChipTextBusy: { color: '#C7C7CC', textDecorationLine: 'line-through' },
  slotBusyLabel: {
    fontSize: 10, fontWeight: '600', color: '#FF3B30',
    backgroundColor: '#FFF0F0', paddingHorizontal: 5, paddingVertical: 1,
    borderRadius: 4, overflow: 'hidden',
  },
  bookingHeaderRow: { padding: 16, paddingBottom: 0 },
  bookingTimeTag: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  bookingTimeTagText: { fontSize: 12, fontWeight: '600' },
  bookingTitle: { fontSize: 20, fontWeight: '700', color: '#1C1C1E', paddingHorizontal: 16, marginTop: 10 },
  bookingSub: { fontSize: 14, color: '#8E8E93', paddingHorizontal: 16, marginTop: 4, marginBottom: 4, lineHeight: 20 },
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
    lineHeight: 22, paddingHorizontal: 24, marginBottom: 20,
  },
  summaryCard: {
    width: '100%', marginHorizontal: 16, backgroundColor: '#F9F9FB',
    borderRadius: 12, padding: 16, marginBottom: 20,
  },
  summaryHeading: { fontSize: 14, fontWeight: '700', color: '#1C1C1E', marginBottom: 12 },
  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F2F2F7',
  },
  summaryLabel: { fontSize: 13, color: '#8E8E93', minWidth: 70 },
  summaryValue: { flex: 1, fontSize: 13, color: '#1C1C1E', fontWeight: '500', textAlign: 'right' },
});
