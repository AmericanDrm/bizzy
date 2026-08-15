import React, { createContext, useContext, useRef, useCallback } from 'react';
import { Platform } from 'react-native';

interface WebRefreshContextType {
  setRefreshFn: (fn: (() => void) | null) => void;
}

const WebRefreshContext = createContext<WebRefreshContextType>({
  setRefreshFn: () => {},
});

export function useWebRefresh(_fn: (() => void) | null) {
}

export function WebRefreshProvider({ children }: { children: React.ReactNode }) {
  const setRefreshFn = useCallback((_fn: (() => void) | null) => {}, []);

  return (
    <WebRefreshContext.Provider value={{ setRefreshFn }}>
      {children}
    </WebRefreshContext.Provider>
  );
}
