import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { TriangleAlert as AlertTriangle, FileText, DollarSign, Clock, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface WorkflowEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  status: string;
  payment_status: string;
  amount: number | null;
  client_id: string | null;
  client_name: string | null;
  invoice_id: string | null;
}

interface Alert {
  id: string;
  type: 'behind_schedule' | 'missing_invoice' | 'payment_received' | 'running_late';
  message: string;
  action?: string;
  eventId: string;
  icon: 'alert' | 'invoice' | 'dollar' | 'clock';
}

interface WorkflowAlertsProps {
  events: WorkflowEvent[];
  activeTimeEntry?: { id: string; eventTitle?: string } | null;
  onDismiss?: (alertId: string) => void;
  onNotifyNextClient?: (eventId: string) => void;
  dismissedAlerts?: Set<string>;
}

export default function WorkflowAlerts({ events, activeTimeEntry, onDismiss, onNotifyNextClient, dismissedAlerts }: WorkflowAlertsProps) {
  const { colors, isDark } = useTheme();

  const alerts = useMemo(() => {
    const result: Alert[] = [];
    const now = new Date();

    const scheduledEvents = events.filter(e => e.status !== 'completed');
    const completedEvents = events.filter(e => e.status === 'completed');

    for (const event of scheduledEvents) {
      const start = new Date(event.start_time);
      const diffMs = now.getTime() - start.getTime();
      const minutesLate = diffMs / (1000 * 60);

      if (minutesLate > 15) {
        result.push({
          id: `behind-${event.id}`,
          type: 'behind_schedule',
          message: `You're running ${Math.round(minutesLate)} min behind on "${event.title}" — notify next client?`,
          action: 'Notify',
          eventId: event.id,
          icon: 'alert',
        });
      }
    }

    for (const event of completedEvents) {
      if (!event.invoice_id && event.client_id && event.amount) {
        result.push({
          id: `invoice-${event.id}`,
          type: 'missing_invoice',
          message: `Invoice for "${event.title}" not created yet — want to generate it?`,
          action: 'Generate',
          eventId: event.id,
          icon: 'invoice',
        });
      }
    }

    for (const event of completedEvents) {
      if (event.payment_status === 'paid' && event.amount) {
        result.push({
          id: `paid-${event.id}`,
          type: 'payment_received',
          message: `Payment received for "${event.title}" ($${event.amount.toFixed(0)})`,
          eventId: event.id,
          icon: 'dollar',
        });
      }
    }

    return result.slice(0, 3);
  }, [events, activeTimeEntry]);

  const visibleAlerts = dismissedAlerts ? alerts.filter(a => !dismissedAlerts.has(a.id)) : alerts;

  if (visibleAlerts.length === 0) return null;

  const ds = getDynamicStyles(colors, isDark);
  const iconMap = {
    alert: AlertTriangle,
    invoice: FileText,
    dollar: DollarSign,
    clock: Clock,
  };
  const colorMap: Record<string, { bg: string; text: string; icon: string }> = {
    behind_schedule: { bg: isDark ? 'rgba(217,119,6,0.15)' : '#FEF3C7', text: '#92400E', icon: '#D97706' },
    missing_invoice: { bg: isDark ? 'rgba(27,77,110,0.15)' : '#EAF2F8', text: '#1B4D6E', icon: '#1B4D6E' },
    payment_received: { bg: isDark ? 'rgba(45,139,87,0.15)' : '#E8F5EE', text: '#166534', icon: colors.success },
    running_late: { bg: isDark ? 'rgba(217,119,6,0.15)' : '#FEF3C7', text: '#92400E', icon: '#D97706' },
  };

  return (
    <View style={ds.container}>
      {visibleAlerts.map((alert) => {
        const IconComp = iconMap[alert.icon];
        const palette = colorMap[alert.type] || colorMap.missing_invoice;
        const showActions = alert.type === 'behind_schedule' && onNotifyNextClient;
        return (
          <View key={alert.id} style={[ds.alertCard, { backgroundColor: palette.bg }]}>
            <IconComp size={16} color={palette.icon} style={{ marginTop: 2 }} />
            <View style={ds.alertContent}>
              <Text style={[ds.alertText, { color: isDark ? colors.text : palette.text }]}>
                {alert.message}
              </Text>
              {showActions && (
                <View style={ds.actionRow}>
                  <TouchableOpacity
                    style={[ds.actionButton, ds.actionButtonYes]}
                    onPress={() => onNotifyNextClient(alert.eventId)}
                  >
                    <Text style={ds.actionButtonYesText}>Yes, Notify</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[ds.actionButton, ds.actionButtonNo, { borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)' }]}
                    onPress={() => onDismiss?.(alert.id)}
                  >
                    <Text style={[ds.actionButtonNoText, { color: isDark ? colors.textSecondary : palette.text }]}>No</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
            {!showActions && onDismiss && (
              <TouchableOpacity onPress={() => onDismiss(alert.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={14} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </View>
  );
}

const getDynamicStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      marginBottom: 12,
      gap: 6,
    },
    alertCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      padding: 12,
      borderRadius: 10,
    },
    alertContent: {
      flex: 1,
    },
    alertText: {
      fontSize: 13,
      fontWeight: '500',
      lineHeight: 18,
    },
    actionRow: {
      flexDirection: 'row' as const,
      gap: 8,
      marginTop: 10,
    },
    actionButton: {
      paddingVertical: 6,
      paddingHorizontal: 14,
      borderRadius: 6,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    actionButtonYes: {
      backgroundColor: '#D97706',
    },
    actionButtonYesText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '600' as const,
    },
    actionButtonNo: {
      backgroundColor: 'transparent',
      borderWidth: 1,
    },
    actionButtonNoText: {
      fontSize: 12,
      fontWeight: '600' as const,
    },
  });
