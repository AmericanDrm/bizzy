import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { CalendarDays, Receipt, Inbox, TrendingUp, ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';

interface BriefingData {
  todayJobCount: number;
  overdueInvoiceCount: number;
  overdueInvoiceTotal: number;
  pendingWorkRequestCount: number;
  nextJobTime: string | null;
  nextJobClient: string | null;
}

export default function MorningBriefing() {
  const [data, setData] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(true);
  const { colors, isDark } = useTheme();
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const router = useRouter();

  const fetchBriefing = useCallback(async () => {
    if (!currentOrganization?.id) return;
    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(startOfDay);
      endOfDay.setDate(endOfDay.getDate() + 1);
      const todayStr = startOfDay.toISOString().split('T')[0];

      const [eventsRes, invoicesRes, requestsRes] = await Promise.all([
        supabase
          .from('schedule_events')
          .select('id, title, start_time, clients(name)')
          .eq('organization_id', currentOrganization.id)
          .gte('start_time', startOfDay.toISOString())
          .lt('start_time', endOfDay.toISOString())
          .order('start_time', { ascending: true }),
        supabase
          .from('invoices')
          .select('id, total, due_date, payment_status')
          .eq('organization_id', currentOrganization.id)
          .neq('payment_status', 'paid')
          .lt('due_date', todayStr),
        supabase
          .from('client_work_requests')
          .select('id')
          .eq('organization_id', currentOrganization.id)
          .eq('status', 'pending'),
      ]);

      const events = eventsRes.data || [];
      const overdueInvoices = invoicesRes.data || [];
      const pendingRequests = requestsRes.data || [];

      const nextJob = events.find((e: any) => e.status !== 'completed');

      setData({
        todayJobCount: events.length,
        overdueInvoiceCount: overdueInvoices.length,
        overdueInvoiceTotal: overdueInvoices.reduce((sum: number, inv: any) => sum + (Number(inv.total) || 0), 0),
        pendingWorkRequestCount: pendingRequests.length,
        nextJobTime: nextJob?.start_time || null,
        nextJobClient: (nextJob as any)?.clients?.name || nextJob?.title || null,
      });
    } catch (err) {
      console.error('MorningBriefing fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id]);

  useEffect(() => {
    fetchBriefing();
  }, [fetchBriefing]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const formatDate = () => {
    return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  };

  if (loading || !data) return null;

  const hasAlerts = data.overdueInvoiceCount > 0 || data.pendingWorkRequestCount > 0;

  const styles = makeStyles(colors, isDark);

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View>
          <Text style={styles.date}>{formatDate()}</Text>
        </View>
        {data.todayJobCount > 0 && (
          <TouchableOpacity style={styles.jobsBadge} onPress={() => router.push('/(tabs)/schedule' as any)} activeOpacity={0.75}>
            <CalendarDays size={13} color={colors.primary} />
            <Text style={styles.jobsBadgeText}>{data.todayJobCount} job{data.todayJobCount !== 1 ? 's' : ''} today</Text>
            <ChevronRight size={12} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {data.nextJobClient && data.nextJobTime && (
        <TouchableOpacity style={styles.nextJobRow} onPress={() => router.push('/(tabs)/schedule' as any)} activeOpacity={0.75}>
          <TrendingUp size={13} color={colors.success} />
          <Text style={styles.nextJobText} numberOfLines={1}>
            Next: <Text style={{ fontWeight: '600', color: colors.text }}>{data.nextJobClient}</Text> at {formatTime(data.nextJobTime)}
          </Text>
        </TouchableOpacity>
      )}

      {hasAlerts && (
        <View style={styles.alertsRow}>
          {data.overdueInvoiceCount > 0 && (
            <TouchableOpacity style={styles.alertChip} onPress={() => router.push('/(tabs)/invoices' as any)} activeOpacity={0.75}>
              <Receipt size={12} color={colors.error} />
              <Text style={styles.alertChipText}>
                {data.overdueInvoiceCount} overdue{data.overdueInvoiceTotal > 0 ? ` · $${data.overdueInvoiceTotal.toFixed(0)}` : ''}
              </Text>
            </TouchableOpacity>
          )}
          {data.pendingWorkRequestCount > 0 && (
            <TouchableOpacity
              style={[styles.alertChip, { borderColor: '#f59e0b' + '40', backgroundColor: '#f59e0b' + '0f' }]}
              onPress={() => router.push('/(tabs)/clients' as any)}
              activeOpacity={0.75}
            >
              <Inbox size={12} color="#b45309" />
              <Text style={[styles.alertChipText, { color: '#b45309' }]}>
                {data.pendingWorkRequestCount} request{data.pendingWorkRequestCount !== 1 ? 's' : ''}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

function makeStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    container: {
      backgroundColor: colors.cardBackground || colors.surface,
      borderRadius: 16,
      padding: 16,
      marginHorizontal: 16,
      marginTop: 8,
      marginBottom: 4,
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
      ...Platform.select({
        web: { boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.06)' } as any,
        default: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDark ? 0.18 : 0.06,
          shadowRadius: 8,
          elevation: 2,
        },
      }),
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    greeting: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      letterSpacing: -0.3,
    },
    date: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    jobsBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.primary + '12',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.primary + '25',
    },
    jobsBadgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary,
    },
    nextJobRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.success + '0a',
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.success + '25',
    },
    nextJobText: {
      fontSize: 13,
      color: colors.textSecondary,
      flex: 1,
    },
    alertsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    alertChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: (colors.error || '#dc2626') + '0f',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: (colors.error || '#dc2626') + '35',
    },
    alertChipText: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.error || '#dc2626',
    },
  });
}
