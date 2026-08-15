import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BIOMETRIC_ENABLED_KEY = '@biometric_enabled';

const isNative = Platform.OS !== 'web';

async function getLocalAuth() {
  if (!isNative) return null;
  try {
    return await import('expo-local-authentication');
  } catch {
    return null;
  }
}

export const BiometricAuth = {
  async isAvailable(): Promise<boolean> {
    if (!isNative) return false;
    try {
      const LocalAuthentication = await getLocalAuth();
      if (!LocalAuthentication) return false;
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      return hasHardware && isEnrolled;
    } catch (error) {
      console.error('Error checking biometric availability:', error);
      return false;
    }
  },

  async getSupportedTypes(): Promise<number[]> {
    if (!isNative) return [];
    try {
      const LocalAuthentication = await getLocalAuth();
      if (!LocalAuthentication) return [];
      return await LocalAuthentication.supportedAuthenticationTypesAsync();
    } catch (error) {
      console.error('Error getting supported types:', error);
      return [];
    }
  },

  async authenticate(reason: string = 'Authenticate to access your account'): Promise<boolean> {
    if (!isNative) return false;
    try {
      const LocalAuthentication = await getLocalAuth();
      if (!LocalAuthentication) return false;
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: reason,
        cancelLabel: 'Cancel',
        fallbackLabel: 'Use Password',
        disableDeviceFallback: false,
      });
      return result.success;
    } catch (error) {
      console.error('Error authenticating:', error);
      return false;
    }
  },

  async isEnabled(): Promise<boolean> {
    try {
      const enabled = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
      return enabled === 'true';
    } catch (error) {
      console.error('Error checking if biometric is enabled:', error);
      return false;
    }
  },

  async setEnabled(enabled: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, enabled ? 'true' : 'false');
    } catch (error) {
      console.error('Error setting biometric enabled:', error);
    }
  },

  async getBiometricTypeName(): Promise<string> {
    if (!isNative) return 'Biometric';
    try {
      const LocalAuthentication = await getLocalAuth();
      if (!LocalAuthentication) return 'Biometric';
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        return 'Face ID';
      } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        return 'Fingerprint';
      } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
        return 'Iris';
      }
    } catch {
      // fall through
    }
    return 'Biometric';
  },
};
