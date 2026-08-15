import { Platform, AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { lookupPhoneNumber, PhoneIndexEntry } from './phoneIndexService';
import { normalizePhoneForComparison } from './utilities';

const CALLER_ID_ENABLED_KEY = '@bizzy_caller_id_enabled';
const LAST_INCOMING_CALL_KEY = '@bizzy_last_incoming_call';
const POST_CALL_CARD_KEY = '@bizzy_post_call_card';
const ACTIVE_CALL_KEY = '@bizzy_active_call';

export interface IncomingCallInfo {
  phoneNumber: string;
  timestamp: string;
  clientMatch: PhoneIndexEntry | null;
}

export interface PostCallAction {
  clientId: string | null;
  clientName: string;
  phone: string;
  email: string;
  address: string;
  clientType: string;
  callTimestamp: string;
  dismissed: boolean;
  isActiveCall: boolean;
}

let callStateListeners: Array<(info: IncomingCallInfo | null) => void> = [];
let postCallListeners: Array<(action: PostCallAction | null) => void> = [];
let appStateSubscription: { remove: () => void } | null = null;
let lastAppBackgroundTime: number = 0;
let activeCallInfo: IncomingCallInfo | null = null;

export function addCallStateListener(listener: (info: IncomingCallInfo | null) => void): () => void {
  callStateListeners.push(listener);
  return () => {
    callStateListeners = callStateListeners.filter(l => l !== listener);
  };
}

export function addPostCallListener(listener: (action: PostCallAction | null) => void): () => void {
  postCallListeners.push(listener);
  return () => {
    postCallListeners = postCallListeners.filter(l => l !== listener);
  };
}

function notifyCallState(info: IncomingCallInfo | null): void {
  for (const listener of callStateListeners) {
    try { listener(info); } catch {}
  }
}

function notifyPostCall(action: PostCallAction | null): void {
  for (const listener of postCallListeners) {
    try { listener(action); } catch {}
  }
}

export function handleIncomingCall(phoneNumber: string): IncomingCallInfo {
  const matches = lookupPhoneNumber(phoneNumber);
  const clientMatch = matches.length > 0 ? matches[0] : null;

  const info: IncomingCallInfo = {
    phoneNumber,
    timestamp: new Date().toISOString(),
    clientMatch,
  };

  activeCallInfo = info;

  AsyncStorage.setItem(LAST_INCOMING_CALL_KEY, JSON.stringify(info)).catch(() => {});
  AsyncStorage.setItem(ACTIVE_CALL_KEY, JSON.stringify(info)).catch(() => {});

  notifyCallState(info);

  const action = buildActionFromCallInfo(info, true);
  AsyncStorage.setItem(POST_CALL_CARD_KEY, JSON.stringify(action)).catch(() => {});
  notifyPostCall(action);

  return info;
}

function buildActionFromCallInfo(info: IncomingCallInfo, isActiveCall: boolean): PostCallAction {
  if (info.clientMatch) {
    return {
      clientId: info.clientMatch.clientId,
      clientName: info.clientMatch.clientName,
      phone: info.clientMatch.phone || info.phoneNumber,
      email: info.clientMatch.email,
      address: info.clientMatch.address,
      clientType: info.clientMatch.clientType,
      callTimestamp: info.timestamp,
      dismissed: false,
      isActiveCall,
    };
  }
  return {
    clientId: null,
    clientName: '',
    phone: info.phoneNumber,
    email: '',
    address: '',
    clientType: '',
    callTimestamp: info.timestamp,
    dismissed: false,
    isActiveCall,
  };
}

export function handleCallEnded(phoneNumber?: string): void {
  const wasActiveCall = activeCallInfo;
  activeCallInfo = null;

  notifyCallState(null);
  AsyncStorage.removeItem(ACTIVE_CALL_KEY).catch(() => {});

  const resolvedPhone = phoneNumber || wasActiveCall?.phoneNumber;
  if (resolvedPhone) {
    const matches = lookupPhoneNumber(resolvedPhone);
    const action: PostCallAction = matches.length > 0
      ? {
          clientId: matches[0].clientId,
          clientName: matches[0].clientName,
          phone: matches[0].phone || resolvedPhone,
          email: matches[0].email,
          address: matches[0].address,
          clientType: matches[0].clientType,
          callTimestamp: new Date().toISOString(),
          dismissed: false,
          isActiveCall: false,
        }
      : {
          clientId: null,
          clientName: '',
          phone: resolvedPhone,
          email: '',
          address: '',
          clientType: '',
          callTimestamp: new Date().toISOString(),
          dismissed: false,
          isActiveCall: false,
        };

    AsyncStorage.setItem(POST_CALL_CARD_KEY, JSON.stringify(action)).catch(() => {});
    notifyPostCall(action);
  }
}

export function getActiveCallInfo(): IncomingCallInfo | null {
  return activeCallInfo;
}

export async function checkPendingPostCallAction(): Promise<PostCallAction | null> {
  try {
    const stored = await AsyncStorage.getItem(POST_CALL_CARD_KEY);
    if (!stored) return null;
    const action = JSON.parse(stored) as PostCallAction;
    if (action.dismissed) {
      await AsyncStorage.removeItem(POST_CALL_CARD_KEY);
      return null;
    }
    if (action.isActiveCall) {
      const activeStored = await AsyncStorage.getItem(ACTIVE_CALL_KEY);
      if (!activeStored) {
        action.isActiveCall = false;
        await AsyncStorage.setItem(POST_CALL_CARD_KEY, JSON.stringify(action));
      }
    }
    const age = Date.now() - new Date(action.callTimestamp).getTime();
    if (age > 30 * 60 * 1000 && !action.isActiveCall) {
      await AsyncStorage.removeItem(POST_CALL_CARD_KEY);
      return null;
    }
    return action;
  } catch {
    return null;
  }
}

export async function dismissPostCallAction(): Promise<void> {
  await AsyncStorage.removeItem(POST_CALL_CARD_KEY).catch(() => {});
  notifyPostCall(null);
}

export async function logCallAction(
  organizationId: string,
  clientId: string | null,
  phoneNumber: string,
  actionTaken: string
): Promise<void> {
  await supabase.from('call_log').insert({
    organization_id: organizationId,
    client_id: clientId,
    phone_number: normalizePhoneForComparison(phoneNumber),
    action_taken: actionTaken,
    call_timestamp: new Date().toISOString(),
  });
}

export function startAppStateMonitoring(): void {
  if (Platform.OS === 'web') return;
  if (appStateSubscription) return;

  const handleAppStateChange = async (nextState: AppStateStatus) => {
    if (nextState === 'background' || nextState === 'inactive') {
      lastAppBackgroundTime = Date.now();
    }

    if (nextState === 'active' && lastAppBackgroundTime > 0) {
      const awayDuration = Date.now() - lastAppBackgroundTime;
      if (awayDuration > 3000 && awayDuration < 30 * 60 * 1000) {
        const pending = await checkPendingPostCallAction();
        if (pending) {
          notifyPostCall(pending);
        }
      }
      lastAppBackgroundTime = 0;
    }
  };

  appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
}

export function stopAppStateMonitoring(): void {
  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }
}

export async function isCallerIdEnabled(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(CALLER_ID_ENABLED_KEY);
    return val === 'true';
  } catch {
    return false;
  }
}

export async function setCallerIdEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(CALLER_ID_ENABLED_KEY, enabled ? 'true' : 'false');
}

export async function loadCallerIdSettings(
  userId: string,
  organizationId: string
): Promise<{ enabled: boolean; showPostCallCard: boolean; autoPrefillSchedule: boolean }> {
  const { data } = await supabase
    .from('caller_id_settings')
    .select('enabled, show_post_call_card, auto_prefill_schedule')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (data) {
    return {
      enabled: data.enabled,
      showPostCallCard: data.show_post_call_card,
      autoPrefillSchedule: data.auto_prefill_schedule,
    };
  }

  return { enabled: false, showPostCallCard: true, autoPrefillSchedule: true };
}

export async function saveCallerIdSettings(
  userId: string,
  organizationId: string,
  settings: { enabled: boolean; showPostCallCard: boolean; autoPrefillSchedule: boolean }
): Promise<void> {
  await supabase
    .from('caller_id_settings')
    .upsert({
      user_id: userId,
      organization_id: organizationId,
      enabled: settings.enabled,
      show_post_call_card: settings.showPostCallCard,
      auto_prefill_schedule: settings.autoPrefillSchedule,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'organization_id,user_id' });
}

export function getPlatformCapabilities(): {
  canDetectIncomingCalls: boolean;
  canGetCallerNumber: boolean;
  canShowOverlay: boolean;
  canShowCallerName: boolean;
  requiresDevBuild: boolean;
  setupInstructions: string;
} {
  if (Platform.OS === 'ios') {
    return {
      canDetectIncomingCalls: false,
      canGetCallerNumber: false,
      canShowOverlay: false,
      canShowCallerName: true,
      requiresDevBuild: true,
      setupInstructions: 'Enable Bizzy in Settings > Phone > Call Blocking & Identification',
    };
  }

  if (Platform.OS === 'android') {
    return {
      canDetectIncomingCalls: true,
      canGetCallerNumber: true,
      canShowOverlay: true,
      canShowCallerName: true,
      requiresDevBuild: true,
      setupInstructions: 'Grant phone state and overlay permissions when prompted',
    };
  }

  return {
    canDetectIncomingCalls: false,
    canGetCallerNumber: false,
    canShowOverlay: false,
    canShowCallerName: false,
    requiresDevBuild: false,
    setupInstructions: 'Caller ID is available on mobile devices only',
  };
}
