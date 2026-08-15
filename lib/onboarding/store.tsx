import React, { createContext, useContext, useState, useCallback } from 'react';

export interface OnboardingData {
  businessName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  businessType: string;
  teamSize: string;
  primaryGoal: string;
  role: 'owner' | 'employee' | '';
  joinCode: string;
}

interface OnboardingContextType {
  data: OnboardingData;
  setBusinessName: (v: string) => void;
  setFirstName: (v: string) => void;
  setLastName: (v: string) => void;
  setEmail: (v: string) => void;
  setPhone: (v: string) => void;
  setPassword: (v: string) => void;
  setBusinessType: (v: string) => void;
  setTeamSize: (v: string) => void;
  setPrimaryGoal: (v: string) => void;
  setRole: (v: 'owner' | 'employee') => void;
  setJoinCode: (v: string) => void;
  reset: () => void;
}

const initialData: OnboardingData = {
  businessName: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: '',
  businessType: '',
  teamSize: '',
  primaryGoal: '',
  role: '',
  joinCode: '',
};

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<OnboardingData>(initialData);

  const setBusinessName = useCallback((v: string) => setData(d => ({ ...d, businessName: v })), []);
  const setFirstName = useCallback((v: string) => setData(d => ({ ...d, firstName: v })), []);
  const setLastName = useCallback((v: string) => setData(d => ({ ...d, lastName: v })), []);
  const setEmail = useCallback((v: string) => setData(d => ({ ...d, email: v })), []);
  const setPhone = useCallback((v: string) => setData(d => ({ ...d, phone: v })), []);
  const setPassword = useCallback((v: string) => setData(d => ({ ...d, password: v })), []);
  const setBusinessType = useCallback((v: string) => setData(d => ({ ...d, businessType: v })), []);
  const setTeamSize = useCallback((v: string) => setData(d => ({ ...d, teamSize: v })), []);
  const setPrimaryGoal = useCallback((v: string) => setData(d => ({ ...d, primaryGoal: v })), []);
  const setRole = useCallback((v: 'owner' | 'employee') => setData(d => ({ ...d, role: v })), []);
  const setJoinCode = useCallback((v: string) => setData(d => ({ ...d, joinCode: v })), []);
  const reset = useCallback(() => setData(initialData), []);

  return (
    <OnboardingContext.Provider
      value={{
        data,
        setBusinessName,
        setFirstName,
        setLastName,
        setEmail,
        setPhone,
        setPassword,
        setBusinessType,
        setTeamSize,
        setPrimaryGoal,
        setRole,
        setJoinCode,
        reset,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider');
  return ctx;
}
