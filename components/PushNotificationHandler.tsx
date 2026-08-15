import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/contexts/AuthContext';
import { PushNotificationService } from '@/lib/pushNotificationService';
import { useRouter } from 'expo-router';

export const NOTIFICATION_INTENT_KEY = 'pending_notification_intent';

export type NotificationIntent =
  | { type: 'clock_in' }
  | { type: 'clock_out'; timeEntryId?: string }
  | { type: 'work_order_arrival'; workOrderId?: string }
  | { type: 'idle_alert' }
  | { type: 'equipment_checklist_prompt'; workDate?: string }
  | { type: 'estimate_approved'; estimateId?: string; jobId?: string }
  | { type: 'departure_reminder'; scheduleEventId?: string };

export async function setNotificationIntent(intent: NotificationIntent): Promise<void> {
  try {
    await AsyncStorage.setItem(NOTIFICATION_INTENT_KEY, JSON.stringify(intent));
  } catch {}
}

export async function getAndClearNotificationIntent(): Promise<NotificationIntent | null> {
  try {
    const val = await AsyncStorage.getItem(NOTIFICATION_INTENT_KEY);
    if (!val) return null;
    await AsyncStorage.removeItem(NOTIFICATION_INTENT_KEY);
    return JSON.parse(val) as NotificationIntent;
  } catch {
    return null;
  }
}

export default function PushNotificationHandler() {
  const { user, session } = useAuth();
  const router = useRouter();
  const registeredRef = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!session || !user?.id || registeredRef.current) return;

    registeredRef.current = true;
    PushNotificationService.registerForPushNotifications(user.id);

    const receivedSub = PushNotificationService.addNotificationReceivedListener(
      (_notification) => {}
    );

    const responseSub = PushNotificationService.addNotificationResponseListener(
      async (response) => {
        const data = response.notification.request.content.data;
        if (!data) return;

        const type = data.type as string;

        try {
          if (type === 'clock_in_prompt') {
            await setNotificationIntent({ type: 'clock_in' });
            router.push('/(tabs)/time');
          } else if (type === 'clock_out_prompt') {
            await setNotificationIntent({ type: 'clock_out', timeEntryId: data.timeEntryId as string | undefined });
            router.push('/(tabs)/time');
          } else if (type === 'work_order_arrival') {
            await setNotificationIntent({ type: 'work_order_arrival', workOrderId: data.workOrderId as string | undefined });
            router.push('/(tabs)/schedule');
          } else if (type === 'idle_alert') {
            await setNotificationIntent({ type: 'idle_alert' });
            router.push('/(tabs)/time');
          } else if (type === 'equipment_checklist_prompt') {
            await setNotificationIntent({ type: 'equipment_checklist_prompt', workDate: data.workDate as string | undefined });
            router.push('/(tabs)/time');
          } else if (type === 'estimate_approved') {
            await setNotificationIntent({ type: 'estimate_approved', estimateId: data.estimateId as string | undefined, jobId: data.jobId as string | undefined });
            router.push('/(tabs)/invoices');
          } else if (type === 'departure_reminder') {
            await setNotificationIntent({ type: 'departure_reminder', scheduleEventId: data.scheduleEventId as string | undefined });
            router.push('/(tabs)/schedule');
          }
        } catch {}
      }
    );

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, [session, user?.id]);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    if ((!session || !user?.id) && registeredRef.current) {
      registeredRef.current = false;
    }
  }, [session, user?.id]);

  return null;
}
