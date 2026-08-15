import { Platform } from 'react-native';
import { supabase, fetchFunction } from './supabase';
import Constants from 'expo-constants';

type NotificationsModule = typeof import('expo-notifications');

let Notifications: NotificationsModule | null = null;

if (Platform.OS !== 'web') {
  try {
    Notifications = require('expo-notifications') as NotificationsModule;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch {}
}

export type NotificationType =
  | 'clock_out_prompt'
  | 'clock_in_prompt'
  | 'work_order_arrival'
  | 'idle_alert'
  | 'schedule_reminder'
  | 'break_expiry'
  | 'equipment_checklist_prompt'
  | 'estimate_approved'
  | 'departure_reminder'
  | 'general';

interface SendNotificationPayload {
  userId: string;
  title: string;
  body: string;
  type: NotificationType;
  data?: Record<string, unknown>;
}

export class PushNotificationService {
  private static expoPushToken: string | null = null;

  static async registerForPushNotifications(userId: string): Promise<string | null> {
    if (Platform.OS === 'web' || !Notifications) {
      return null;
    }

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
            allowAnnouncements: true,
          },
        });
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        return null;
      }

      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      const tokenResponse = await Notifications.getExpoPushTokenAsync({
        projectId,
      });

      const token = tokenResponse.data;
      this.expoPushToken = token;

      await this.saveTokenToDatabase(userId, token);

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#2563eb',
          sound: 'default',
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          bypassDnd: false,
          showBadge: true,
        });

        await Notifications.setNotificationChannelAsync('clock-out', {
          name: 'Clock Out Reminders',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#2563eb',
          sound: 'default',
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          showBadge: true,
        });

        await Notifications.setNotificationChannelAsync('arrivals', {
          name: 'Job Site Arrivals',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#2563eb',
          sound: 'default',
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          showBadge: true,
        });

        await Notifications.setNotificationChannelAsync('breaks', {
          name: 'Break Reminders',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#4A90A4',
          sound: 'default',
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          showBadge: true,
        });

        await Notifications.setNotificationChannelAsync('messages', {
          name: 'Client Messages',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#2563eb',
          sound: 'default',
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          showBadge: true,
        });

        await Notifications.setNotificationChannelAsync('clock-in', {
          name: 'Clock In Reminders',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#16a34a',
          sound: 'default',
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          showBadge: true,
        });

        await Notifications.setNotificationChannelAsync('departures', {
          name: 'Departure Reminders',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 300, 200, 300],
          lightColor: '#0284c7',
          sound: 'default',
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          bypassDnd: false,
          showBadge: true,
        });
      }

      return token;
    } catch {
      return null;
    }
  }

  private static async saveTokenToDatabase(userId: string, token: string): Promise<void> {
    try {
      const { data: existing } = await supabase
        .from('push_tokens')
        .select('id')
        .eq('user_id', userId)
        .eq('token', token)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('push_tokens')
          .update({
            active: true,
            platform: Platform.OS,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        await supabase.from('push_tokens').insert({
          user_id: userId,
          token,
          platform: Platform.OS,
          active: true,
        });
      }
    } catch {}
  }

  static async deactivateToken(userId: string): Promise<void> {
    if (!this.expoPushToken) return;

    try {
      await supabase
        .from('push_tokens')
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('token', this.expoPushToken);
    } catch {}
  }

  static async sendLocalNotification(
    title: string,
    body: string,
    channelId: string = 'default',
    data?: Record<string, unknown>
  ): Promise<void> {
    if (Platform.OS === 'web' || !Notifications) return;

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: data || {},
          sound: 'default',
          ...(Platform.OS === 'android' ? { channelId } : {}),
        },
        trigger: null,
      });
    } catch {}
  }

  static async sendPushViaEdgeFunction(payload: SendNotificationPayload): Promise<boolean> {
    try {
      const data = await fetchFunction('send-push-notification', { body: payload });
      if (data.error) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  static async triggerClockOutReminder(
    userId: string,
    minutesAway: number,
    timeEntryId: string
  ): Promise<void> {
    await this.sendLocalNotification(
      'Time to Clock Out?',
      `You returned to your home base after being away for ${minutesAway} minutes. Tap to clock out.`,
      'clock-out',
      { type: 'clock_out_prompt', timeEntryId }
    );

    await this.sendPushViaEdgeFunction({
      userId,
      title: 'Time to Clock Out?',
      body: `You returned to your home base after being away for ${minutesAway} minutes.`,
      type: 'clock_out_prompt',
      data: { timeEntryId },
    });
  }

  static async triggerClockInPrompt(userId: string): Promise<void> {
    await this.sendLocalNotification(
      'Ready to Start Work?',
      "You're at your home base. Tap to clock in and start tracking your time.",
      'clock-in',
      { type: 'clock_in_prompt' }
    );

    await this.sendPushViaEdgeFunction({
      userId,
      title: 'Ready to Start Work?',
      body: "You're at your home base. Tap to clock in and start tracking your time.",
      type: 'clock_in_prompt',
    });
  }

  static async triggerWorkOrderArrival(
    userId: string,
    clientName: string,
    workOrderId: string
  ): Promise<void> {
    await this.sendLocalNotification(
      "You've Arrived!",
      `View work order for ${clientName}`,
      'arrivals',
      { type: 'work_order_arrival', workOrderId }
    );

    await this.sendPushViaEdgeFunction({
      userId,
      title: "You've Arrived!",
      body: `View work order for ${clientName}`,
      type: 'work_order_arrival',
      data: { workOrderId },
    });
  }

  static async triggerDepartureReminder(
    userId: string,
    clientName: string,
    jobStartTime: string,
    travelMinutes: number,
    scheduleEventId: string,
    jobAddress?: string
  ): Promise<void> {
    const startDate = new Date(jobStartTime);
    const timeStr = startDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    const title = `Time to leave for ${clientName}`;
    const addressLine = jobAddress ? `\n${jobAddress}` : '';
    const body = `Job at ${timeStr} — ~${travelMinutes} min away. Leave now to arrive on time.${addressLine}`;

    await this.sendLocalNotification(title, body, 'departures', {
      type: 'departure_reminder',
      scheduleEventId,
      travelMinutes,
      jobAddress: jobAddress ?? null,
    });

    await this.sendPushViaEdgeFunction({
      userId,
      title,
      body,
      type: 'departure_reminder',
      data: { scheduleEventId, travelMinutes, jobAddress: jobAddress ?? null },
    });
  }

  static async triggerEquipmentChecklistPrompt(workDate: string): Promise<void> {
    await this.sendLocalNotification(
      'Equipment Needed Today?',
      'Would you like to review the equipment checklist for your jobs today?',
      'clock-in',
      { type: 'equipment_checklist_prompt', workDate }
    );
  }

  static async triggerIdleAlert(userId: string, minutesIdle: number): Promise<void> {
    await this.sendLocalNotification(
      'Still Working?',
      `You have been idle for ${minutesIdle} minutes. Are you still on the clock?`,
      'default',
      { type: 'idle_alert' }
    );

    await this.sendPushViaEdgeFunction({
      userId,
      title: 'Still Working?',
      body: `You have been idle for ${minutesIdle} minutes. Are you still on the clock?`,
      type: 'idle_alert',
    });
  }

  static addNotificationReceivedListener(
    callback: (notification: any) => void
  ) {
    if (!Notifications) return { remove: () => {} };
    return Notifications.addNotificationReceivedListener(callback);
  }

  static addNotificationResponseListener(
    callback: (response: any) => void
  ) {
    if (!Notifications) return { remove: () => {} };
    return Notifications.addNotificationResponseReceivedListener(callback);
  }

  static async getBadgeCount(): Promise<number> {
    if (Platform.OS === 'web' || !Notifications) return 0;
    return Notifications.getBadgeCountAsync();
  }

  static async setBadgeCount(count: number): Promise<void> {
    if (Platform.OS === 'web' || !Notifications) return;
    await Notifications.setBadgeCountAsync(count);
  }

  static async dismissAllNotifications(): Promise<void> {
    if (Platform.OS === 'web' || !Notifications) return;
    await Notifications.dismissAllNotificationsAsync();
  }
}
