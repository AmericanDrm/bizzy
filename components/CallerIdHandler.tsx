import { useEffect, useState, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  addPostCallListener,
  checkPendingPostCallAction,
  dismissPostCallAction,
  logCallAction,
  startAppStateMonitoring,
  stopAppStateMonitoring,
  loadCallerIdSettings,
  PostCallAction,
} from '@/lib/callerIdService';
import {
  buildPhoneIndex,
  loadPhoneIndexFromCache,
} from '@/lib/phoneIndexService';
import PostCallActionCard from './PostCallActionCard';

interface CallerIdHandlerProps {
  onScheduleClient: (clientId: string, clientName: string, phone: string, address: string) => void;
  onEstimateClient: (clientId: string, clientName: string) => void;
  onInvoiceClient: (clientId: string, clientName: string) => void;
  onCreateClient: (phone: string) => void;
}

export default function CallerIdHandler({
  onScheduleClient,
  onEstimateClient,
  onInvoiceClient,
  onCreateClient,
}: CallerIdHandlerProps) {
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const [postCallAction, setPostCallAction] = useState<PostCallAction | null>(null);
  const [cardVisible, setCardVisible] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [showPostCallCardSetting, setShowPostCallCardSetting] = useState(true);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!user?.id || !currentOrganization?.id) return;
    if (initializedRef.current) return;
    initializedRef.current = true;

    (async () => {
      const settings = await loadCallerIdSettings(user.id, currentOrganization.id);
      setEnabled(settings.enabled);
      setShowPostCallCardSetting(settings.showPostCallCard);

      if (settings.enabled) {
        const cached = await loadPhoneIndexFromCache();
        if (!cached) {
          await buildPhoneIndex(currentOrganization.id);
        }

        if (Platform.OS !== 'web') {
          startAppStateMonitoring();
        }

        const pending = await checkPendingPostCallAction();
        if (pending && settings.showPostCallCard) {
          setPostCallAction(pending);
          setCardVisible(true);
        }
      }
    })();

    return () => {
      stopAppStateMonitoring();
      initializedRef.current = false;
    };
  }, [user?.id, currentOrganization?.id]);

  useEffect(() => {
    if (!enabled || !showPostCallCardSetting) return;

    const unsubscribe = addPostCallListener((action) => {
      if (action) {
        setPostCallAction(action);
        setCardVisible(true);
      } else {
        setCardVisible(false);
      }
    });

    return unsubscribe;
  }, [enabled, showPostCallCardSetting]);

  const handleDismiss = useCallback(async () => {
    setCardVisible(false);
    await dismissPostCallAction();
    if (postCallAction && currentOrganization?.id) {
      await logCallAction(
        currentOrganization.id,
        postCallAction.clientId,
        postCallAction.phone,
        'dismissed'
      );
    }
  }, [postCallAction, currentOrganization?.id]);

  const handleSchedule = useCallback(async () => {
    if (!postCallAction) return;
    setCardVisible(false);
    await dismissPostCallAction();
    if (currentOrganization?.id) {
      await logCallAction(
        currentOrganization.id,
        postCallAction.clientId,
        postCallAction.phone,
        'scheduled'
      );
    }
    if (postCallAction.clientId) {
      onScheduleClient(
        postCallAction.clientId,
        postCallAction.clientName,
        postCallAction.phone,
        postCallAction.address
      );
    }
  }, [postCallAction, currentOrganization?.id, onScheduleClient]);

  const handleEstimate = useCallback(async () => {
    if (!postCallAction || !postCallAction.clientId) return;
    setCardVisible(false);
    await dismissPostCallAction();
    if (currentOrganization?.id) {
      await logCallAction(
        currentOrganization.id,
        postCallAction.clientId,
        postCallAction.phone,
        'estimate'
      );
    }
    onEstimateClient(postCallAction.clientId, postCallAction.clientName);
  }, [postCallAction, currentOrganization?.id, onEstimateClient]);

  const handleInvoice = useCallback(async () => {
    if (!postCallAction || !postCallAction.clientId) return;
    setCardVisible(false);
    await dismissPostCallAction();
    if (currentOrganization?.id) {
      await logCallAction(
        currentOrganization.id,
        postCallAction.clientId,
        postCallAction.phone,
        'invoice'
      );
    }
    onInvoiceClient(postCallAction.clientId, postCallAction.clientName);
  }, [postCallAction, currentOrganization?.id, onInvoiceClient]);

  const handleCreateClient = useCallback(async () => {
    if (!postCallAction) return;
    setCardVisible(false);
    await dismissPostCallAction();
    if (currentOrganization?.id) {
      await logCallAction(
        currentOrganization.id,
        null,
        postCallAction.phone,
        'create_client'
      );
    }
    onCreateClient(postCallAction.phone);
  }, [postCallAction, currentOrganization?.id, onCreateClient]);

  if (!enabled) return null;

  return (
    <PostCallActionCard
      visible={cardVisible}
      callAction={postCallAction}
      onSchedule={handleSchedule}
      onEstimate={handleEstimate}
      onInvoice={handleInvoice}
      onCreateClient={handleCreateClient}
      onDismiss={handleDismiss}
    />
  );
}
