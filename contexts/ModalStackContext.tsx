import React, { createContext, useContext, useRef, useCallback } from 'react';
import { Alert, Platform } from 'react-native';

interface ModalEntry {
  id: string;
  close: () => void;
  isDirty?: () => boolean;
}

interface ModalStackContextValue {
  registerModal: (entry: ModalEntry) => void;
  unregisterModal: (id: string) => void;
  closeTopModal: () => boolean;
  hasOpenModal: () => boolean;
}

const ModalStackContext = createContext<ModalStackContextValue | null>(null);

function confirmDiscard(onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm('You have unsaved changes. Discard and go back?')) {
      onConfirm();
    }
  } else {
    Alert.alert(
      'Unsaved Changes',
      'You have unsaved changes. Discard and go back?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: onConfirm },
      ]
    );
  }
}

export function ModalStackProvider({ children }: { children: React.ReactNode }) {
  const stackRef = useRef<ModalEntry[]>([]);

  const registerModal = useCallback((entry: ModalEntry) => {
    stackRef.current = stackRef.current.filter((e) => e.id !== entry.id);
    stackRef.current.push(entry);
  }, []);

  const unregisterModal = useCallback((id: string) => {
    stackRef.current = stackRef.current.filter((e) => e.id !== id);
  }, []);

  const closeTopModal = useCallback((): boolean => {
    const stack = stackRef.current;
    if (stack.length === 0) return false;
    const top = stack[stack.length - 1];
    const dirty = top.isDirty ? top.isDirty() : false;
    if (dirty) {
      confirmDiscard(() => top.close());
    } else {
      top.close();
    }
    return true;
  }, []);

  const hasOpenModal = useCallback((): boolean => {
    return stackRef.current.length > 0;
  }, []);

  return (
    <ModalStackContext.Provider value={{ registerModal, unregisterModal, closeTopModal, hasOpenModal }}>
      {children}
    </ModalStackContext.Provider>
  );
}

export function useModalStack() {
  const ctx = useContext(ModalStackContext);
  if (!ctx) throw new Error('useModalStack must be used within ModalStackProvider');
  return ctx;
}

export function useRegisterModal(
  id: string,
  visible: boolean,
  closeFn: () => void,
  isDirtyFn?: () => boolean
) {
  const { registerModal, unregisterModal } = useModalStack();
  const closeFnRef = useRef(closeFn);
  const isDirtyFnRef = useRef(isDirtyFn);
  closeFnRef.current = closeFn;
  isDirtyFnRef.current = isDirtyFn;

  React.useEffect(() => {
    if (visible) {
      registerModal({
        id,
        close: () => closeFnRef.current(),
        isDirty: isDirtyFnRef.current ? () => isDirtyFnRef.current!() : undefined,
      });
      return () => {
        unregisterModal(id);
      };
    }
  }, [visible, id, registerModal, unregisterModal]);
}
