import React, { createContext, useContext, useState, useCallback } from 'react';

export interface TimerPrefill {
  clientId: string;
  clientName: string;
}

interface TimerPrefillContextValue {
  timerPrefill: TimerPrefill | null;
  setTimerPrefill: (prefill: TimerPrefill | null) => void;
  consumeTimerPrefill: () => TimerPrefill | null;
}

const TimerPrefillContext = createContext<TimerPrefillContextValue>({
  timerPrefill: null,
  setTimerPrefill: () => {},
  consumeTimerPrefill: () => null,
});

export function TimerPrefillProvider({ children }: { children: React.ReactNode }) {
  const [timerPrefill, setTimerPrefillState] = useState<TimerPrefill | null>(null);

  const setTimerPrefill = useCallback((prefill: TimerPrefill | null) => {
    setTimerPrefillState(prefill);
  }, []);

  const consumeTimerPrefill = useCallback((): TimerPrefill | null => {
    const current = timerPrefill;
    setTimerPrefillState(null);
    return current;
  }, [timerPrefill]);

  return (
    <TimerPrefillContext.Provider value={{ timerPrefill, setTimerPrefill, consumeTimerPrefill }}>
      {children}
    </TimerPrefillContext.Provider>
  );
}

export function useTimerPrefill() {
  return useContext(TimerPrefillContext);
}
