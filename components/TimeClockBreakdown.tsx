import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { ChevronDown, ChevronUp, Clock, Users, User, Coffee, FileText } from 'lucide-react-native';
import { generateTimeClockPDF, TimeEntryForPdf } from '@/lib/timePdfService';

interface TimeEntry {
  id: string;
  clock_in: string;
  clock_out: string | null;
  notes: string | null;
  user_id: string;
  user_name?: string;
  user_email?: string;
  breaks?: { id: string; started_at: string; ended_at?: string; notes?: string }[];
}

interface Profile {
  id: string;
  email: string;
  display_name: string;
}

interface TimeClockBreakdownProps {
  entries: TimeEntry[];
  profiles: Profile[];
  colors: any;
  startDate: Date | null;
  endDate: Date | null;
  organizationName?: string;
}

function calcHours(clockIn: string, clockOut: string | null): number {
  if (!clockOut) return 0;
  return (new Date(clockOut).getTime() - new Date(clockIn).getTime()) / 3_600_000;
}

function formatHoursMinutes(hours: number): string {
  return `${hours.toFixed(2)}h`;
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

interface EmployeeData {
  userId: string;
  name: string;
  email: string;
  entries: TimeEntry[];
  totalHours: number;
  completedEntries: number;
  totalBreaks: number;
}

export default function TimeClockBreakdown({
  entries,
  profiles,
  colors,
  startDate,
  endDate,
  organizationName,
}: TimeClockBreakdownProps) {
  const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(new Set());
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  const employeeData = useMemo((): EmployeeData[] => {
    const profileMap: { [id: string]: Profile } = {};
    profiles.forEach((p) => { profileMap[p.id] = p; });

    const byUser: { [userId: string]: EmployeeData } = {};
    entries.forEach((entry) => {
      if (!byUser[entry.user_id]) {
        const profile = profileMap[entry.user_id];
        byUser[entry.user_id] = {
          userId: entry.user_id,
          name: entry.user_name || profile?.display_name || profile?.email || 'Unknown',
          email: entry.user_email || profile?.email || '',
          entries: [],
          totalHours: 0,
          completedEntries: 0,
          totalBreaks: 0,
        };
      }
      const emp = byUser[entry.user_id];
      emp.entries.push(entry);
      if (entry.clock_out) {
        emp.completedEntries++;
        emp.totalHours += calcHours(entry.clock_in, entry.clock_out);
      }
      emp.totalBreaks += (entry.breaks?.length || 0);
    });

    return Object.values(byUser).sort((a, b) => b.totalHours - a.totalHours);
  }, [entries, profiles]);

  const grandTotalHours = employeeData.reduce((s, e) => s + e.totalHours, 0);
  const grandTotalSessions = employeeData.reduce((s, e) => s + e.completedEntries, 0);

  const toggleEmployee = (userId: string) => {
    setExpandedEmployees((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const toggleMonth = (key: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleExportPdf = () => {
    const pdfEntries: TimeEntryForPdf[] = entries.map((e) => ({
      id: e.id,
      clock_in: e.clock_in,
      clock_out: e.clock_out,
      notes: e.notes,
      user_id: e.user_id,
      user_name: e.user_name,
      user_email: e.user_email,
      breaks: e.breaks,
    }));
    generateTimeClockPDF(pdfEntries, startDate, endDate, organizationName);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <Users size={16} color={colors.primary} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>Team Breakdown</Text>
        </View>
        <TouchableOpacity
          style={[styles.pdfBtn, { backgroundColor: colors.primary }]}
          onPress={handleExportPdf}
          activeOpacity={0.8}
        >
          <FileText size={14} color="#fff" />
          <Text style={styles.pdfBtnText}>PDF</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.summaryRow, { backgroundColor: colors.inputBackground }]}>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: colors.primary }]}>{employeeData.length}</Text>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Members</Text>
        </View>
        <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: colors.success }]}>{grandTotalSessions}</Text>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Sessions</Text>
        </View>
        <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: colors.primary }]}>{formatHoursMinutes(grandTotalHours)}</Text>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Total Hours</Text>
        </View>
      </View>

      {employeeData.map((emp) => {
        const isExpanded = expandedEmployees.has(emp.userId);
        const hoursPercent = grandTotalHours > 0 ? (emp.totalHours / grandTotalHours) * 100 : 0;

        const byMonth: { [key: string]: TimeEntry[] } = {};
        emp.entries.forEach((e) => {
          const key = e.clock_in.slice(0, 7);
          if (!byMonth[key]) byMonth[key] = [];
          byMonth[key].push(e);
        });
        const monthKeys = Object.keys(byMonth).sort((a, b) => b.localeCompare(a));

        return (
          <View key={emp.userId} style={[styles.employeeCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <TouchableOpacity
              style={styles.employeeHeader}
              onPress={() => toggleEmployee(emp.userId)}
              activeOpacity={0.7}
            >
              <View style={[styles.avatarCircle, { backgroundColor: colors.primary + '20' }]}>
                <User size={16} color={colors.primary} />
              </View>
              <View style={styles.employeeInfo}>
                <Text style={[styles.employeeName, { color: colors.text }]}>{emp.name}</Text>
                {emp.email ? (
                  <Text style={[styles.employeeEmail, { color: colors.textSecondary }]}>{emp.email}</Text>
                ) : null}
                <View style={[styles.progressBar, { backgroundColor: colors.inputBackground }]}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${hoursPercent}%` as any,
                        backgroundColor: colors.primary,
                      },
                    ]}
                  />
                </View>
              </View>
              <View style={styles.employeeStats}>
                <Text style={[styles.employeeHours, { color: colors.primary }]}>
                  {formatHoursMinutes(emp.totalHours)}
                </Text>
                <Text style={[styles.employeeSessions, { color: colors.textSecondary }]}>
                  {emp.completedEntries} sessions
                </Text>
              </View>
              {isExpanded ? (
                <ChevronUp size={16} color={colors.textSecondary} />
              ) : (
                <ChevronDown size={16} color={colors.textSecondary} />
              )}
            </TouchableOpacity>

            {isExpanded && (
              <View style={[styles.expandedContent, { borderTopColor: colors.border }]}>
                {monthKeys.map((mk) => {
                  const monthEntries = byMonth[mk];
                  const monthHours = monthEntries.reduce((s, e) => s + calcHours(e.clock_in, e.clock_out), 0);
                  const [year, month] = mk.split('-');
                  const monthLabel = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric',
                  });
                  const monthKey = `${emp.userId}-${mk}`;
                  const isMonthExpanded = expandedMonths.has(monthKey);

                  return (
                    <View key={mk}>
                      <TouchableOpacity
                        style={[styles.monthHeader, { backgroundColor: colors.inputBackground }]}
                        onPress={() => toggleMonth(monthKey)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.monthLabel, { color: colors.text }]}>{monthLabel}</Text>
                        <View style={styles.monthRight}>
                          <Text style={[styles.monthHours, { color: colors.primary }]}>
                            {formatHoursMinutes(monthHours)}
                          </Text>
                          {isMonthExpanded ? (
                            <ChevronUp size={14} color={colors.textSecondary} />
                          ) : (
                            <ChevronDown size={14} color={colors.textSecondary} />
                          )}
                        </View>
                      </TouchableOpacity>

                      {isMonthExpanded && monthEntries
                        .sort((a, b) => new Date(b.clock_in).getTime() - new Date(a.clock_in).getTime())
                        .map((entry) => {
                          const hours = calcHours(entry.clock_in, entry.clock_out);
                          const isActive = !entry.clock_out;
                          const breakCount = entry.breaks?.length || 0;

                          return (
                            <View key={entry.id} style={[styles.entryRow, { borderBottomColor: colors.border }]}>
                              <View style={styles.entryLeft}>
                                <Text style={[styles.entryDate, { color: colors.text }]}>
                                  {formatDate(entry.clock_in)}
                                </Text>
                                <View style={styles.entryTimes}>
                                  <View style={styles.timeChip}>
                                    <Clock size={10} color={colors.success} />
                                    <Text style={[styles.timeText, { color: colors.success }]}>
                                      {formatTime(entry.clock_in)}
                                    </Text>
                                  </View>
                                  <Text style={[styles.timeSep, { color: colors.textSecondary }]}>→</Text>
                                  {isActive ? (
                                    <View style={[styles.timeChip, { backgroundColor: '#fef3c7' }]}>
                                      <Text style={[styles.timeText, { color: '#92400e' }]}>Active</Text>
                                    </View>
                                  ) : (
                                    <View style={styles.timeChip}>
                                      <Clock size={10} color={colors.error} />
                                      <Text style={[styles.timeText, { color: colors.error }]}>
                                        {formatTime(entry.clock_out!)}
                                      </Text>
                                    </View>
                                  )}
                                  {breakCount > 0 && (
                                    <View style={[styles.breakChip, { backgroundColor: colors.inputBackground }]}>
                                      <Coffee size={10} color={colors.textSecondary} />
                                      <Text style={[styles.breakText, { color: colors.textSecondary }]}>{breakCount}</Text>
                                    </View>
                                  )}
                                </View>
                                {entry.notes ? (
                                  <Text style={[styles.entryNotes, { color: colors.textSecondary }]} numberOfLines={1}>
                                    {entry.notes}
                                  </Text>
                                ) : null}
                              </View>
                              <View style={styles.entryRight}>
                                {!isActive && (
                                  <Text style={[styles.entryHours, { color: colors.primary }]}>
                                    {formatHoursMinutes(hours)}
                                  </Text>
                                )}
                              </View>
                            </View>
                          );
                        })}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}

      {employeeData.length === 0 && (
        <View style={styles.empty}>
          <Clock size={32} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No time entries found</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
    paddingBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    marginBottom: 2,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  pdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  pdfBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  summaryRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 2,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  summaryDivider: {
    width: 1,
    height: 32,
  },
  employeeCard: {
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    ...Platform.select({
      web: { boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
      default: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
    }),
  },
  employeeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  employeeInfo: {
    flex: 1,
    gap: 3,
  },
  employeeName: {
    fontSize: 14,
    fontWeight: '700',
  },
  employeeEmail: {
    fontSize: 11,
  },
  progressBar: {
    height: 3,
    borderRadius: 2,
    marginTop: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  employeeStats: {
    alignItems: 'flex-end',
  },
  employeeHours: {
    fontSize: 16,
    fontWeight: '800',
  },
  employeeSessions: {
    fontSize: 11,
  },
  expandedContent: {
    borderTopWidth: 1,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  monthLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  monthRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  monthHours: {
    fontSize: 13,
    fontWeight: '700',
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  entryLeft: {
    flex: 1,
    gap: 4,
  },
  entryDate: {
    fontSize: 13,
    fontWeight: '600',
  },
  entryTimes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  timeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  timeSep: {
    fontSize: 11,
  },
  breakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  breakText: {
    fontSize: 11,
    fontWeight: '600',
  },
  entryNotes: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  entryRight: {
    alignItems: 'flex-end',
    flexShrink: 0,
    paddingLeft: 8,
  },
  entryHours: {
    fontSize: 15,
    fontWeight: '800',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  emptyText: {
    fontSize: 14,
  },
});
