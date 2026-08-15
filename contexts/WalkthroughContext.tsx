import React, { createContext, useContext, useState, useRef, useCallback, ReactNode } from 'react';
import { WALKTHROUGH_STEPS, WalkthroughStep } from '@/constants/walkthroughSteps';
import {
  trackWalkthroughEvent,
  updateUserWalkthroughStatus,
  generateSessionId,
} from '@/lib/analyticsService';

interface ElementPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface RegisteredElement {
  ref: any;
  position: ElementPosition | null;
}

interface WalkthroughContextType {
  isActive: boolean;
  currentStepIndex: number;
  currentStep: WalkthroughStep | null;
  registeredElements: Map<string, RegisteredElement>;
  startWalkthrough: (source?: 'first_time' | 'settings' | 'help_button' | 'reminder') => void;
  stopWalkthrough: (reason?: 'completed' | 'skipped') => void;
  nextStep: () => void;
  previousStep: () => void;
  skipStep: () => void;
  registerElement: (id: string, ref: any) => void;
  unregisterElement: (id: string) => void;
  getElementPosition: (id: string) => ElementPosition | null;
  jumpToStep: (stepId: string) => void;
}

const WalkthroughContext = createContext<WalkthroughContextType | undefined>(undefined);

export function WalkthroughProvider({ children }: { children: ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const registeredElements = useRef<Map<string, RegisteredElement>>(new Map());
  const stepStartTime = useRef<number>(Date.now());
  const walkthroughSource = useRef<'first_time' | 'settings' | 'help_button' | 'reminder'>('settings');

  const currentStep = isActive ? WALKTHROUGH_STEPS[currentStepIndex] : null;

  const startWalkthrough = useCallback(
    async (source: 'first_time' | 'settings' | 'help_button' | 'reminder' = 'settings') => {
      generateSessionId();
      walkthroughSource.current = source;
      setIsActive(true);
      setCurrentStepIndex(0);
      stepStartTime.current = Date.now();

      await trackWalkthroughEvent({
        actionType: 'started',
        source,
        completionPercentage: 0,
      });

      await updateUserWalkthroughStatus('started', WALKTHROUGH_STEPS[0].id);
    },
    []
  );

  const stopWalkthrough = useCallback(
    async (reason: 'completed' | 'skipped' = 'skipped') => {
      const timeSpent = Math.floor((Date.now() - stepStartTime.current) / 1000);
      const completionPercentage = (currentStepIndex / WALKTHROUGH_STEPS.length) * 100;

      await trackWalkthroughEvent({
        actionType: reason,
        stepId: currentStep?.id,
        timeSpentSeconds: timeSpent,
        completionPercentage,
      });

      await updateUserWalkthroughStatus(reason, currentStep?.id);

      setIsActive(false);
      setCurrentStepIndex(0);
    },
    [currentStepIndex, currentStep]
  );

  const nextStep = useCallback(async () => {
    const timeSpent = Math.floor((Date.now() - stepStartTime.current) / 1000);

    if (currentStep) {
      await trackWalkthroughEvent({
        actionType: 'step_viewed',
        stepId: currentStep.id,
        timeSpentSeconds: timeSpent,
        completionPercentage: ((currentStepIndex + 1) / WALKTHROUGH_STEPS.length) * 100,
      });
    }

    if (currentStepIndex < WALKTHROUGH_STEPS.length - 1) {
      const nextIndex = currentStepIndex + 1;
      setCurrentStepIndex(nextIndex);
      stepStartTime.current = Date.now();
      await updateUserWalkthroughStatus('started', WALKTHROUGH_STEPS[nextIndex].id);
    } else {
      await stopWalkthrough('completed');
    }
  }, [currentStepIndex, currentStep, stopWalkthrough]);

  const previousStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
      stepStartTime.current = Date.now();
    }
  }, [currentStepIndex]);

  const skipStep = useCallback(async () => {
    if (currentStep) {
      await trackWalkthroughEvent({
        actionType: 'step_skipped',
        stepId: currentStep.id,
        completionPercentage: ((currentStepIndex + 1) / WALKTHROUGH_STEPS.length) * 100,
      });
    }
    await nextStep();
  }, [currentStep, currentStepIndex, nextStep]);

  const registerElement = useCallback((id: string, ref: any) => {
    registeredElements.current.set(id, { ref, position: null });
  }, []);

  const unregisterElement = useCallback((id: string) => {
    registeredElements.current.delete(id);
  }, []);

  const getElementPosition = useCallback((id: string): ElementPosition | null => {
    const element = registeredElements.current.get(id);
    return element?.position || null;
  }, []);

  const jumpToStep = useCallback(
    (stepId: string) => {
      const stepIndex = WALKTHROUGH_STEPS.findIndex((step) => step.id === stepId);
      if (stepIndex !== -1) {
        setCurrentStepIndex(stepIndex);
        stepStartTime.current = Date.now();
      }
    },
    []
  );

  const value: WalkthroughContextType = {
    isActive,
    currentStepIndex,
    currentStep,
    registeredElements: registeredElements.current,
    startWalkthrough,
    stopWalkthrough,
    nextStep,
    previousStep,
    skipStep,
    registerElement,
    unregisterElement,
    getElementPosition,
    jumpToStep,
  };

  return <WalkthroughContext.Provider value={value}>{children}</WalkthroughContext.Provider>;
}

export function useWalkthrough() {
  const context = useContext(WalkthroughContext);
  if (!context) {
    throw new Error('useWalkthrough must be used within WalkthroughProvider');
  }
  return context;
}
