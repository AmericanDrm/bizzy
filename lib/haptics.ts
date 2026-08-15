import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const isNative = Platform.OS !== 'web';

export const HapticPatterns = {
  navigation() {
    if (!isNative) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  },
  selection() {
    if (!isNative) return;
    Haptics.selectionAsync();
  },
  confirm() {
    if (!isNative) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  },
  success() {
    if (!isNative) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },
  warning() {
    if (!isNative) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  },
  error() {
    if (!isNative) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  },
  heavy() {
    if (!isNative) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  },
  clockIn() {
    if (!isNative) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },
  clockOut() {
    if (!isNative) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  },
  delete() {
    if (!isNative) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  },
  swipeAction() {
    if (!isNative) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  },
  longPress() {
    if (!isNative) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  },
};
