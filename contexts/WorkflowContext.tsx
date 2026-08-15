import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';

export interface WorkflowClient {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  addressId?: string;
  latitude?: number;
  longitude?: number;
  typicalJobDuration?: number;
  priceOverride?: number;
  priceOverrideEnabled?: boolean;
  accessCode?: string;
  accessCodeType?: string;
  serviceWindowStart?: string;
  serviceWindowEnd?: string;
}

export interface WorkflowEstimate {
  id: string;
  clientId: string;
  clientName?: string;
  title?: string;
  description?: string;
  total: number;
  items?: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
  }>;
  taxRate?: number;
  notes?: string;
}

export interface WorkflowScheduleEvent {
  id: string;
  title: string;
  clientId: string | null;
  clientName?: string;
  location?: string;
  amount?: number;
  startTime?: string;
}

export interface WorkflowInvoice {
  id: string;
  clientId: string;
  clientName?: string;
  total: number;
  items?: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
  }>;
}

interface WorkflowContextValue {
  selectedClient: WorkflowClient | null;
  selectedEstimate: WorkflowEstimate | null;
  selectedScheduleEvent: WorkflowScheduleEvent | null;
  selectedInvoice: WorkflowInvoice | null;
  setWorkflowClient: (client: WorkflowClient | null) => void;
  setWorkflowEstimate: (estimate: WorkflowEstimate | null) => void;
  setWorkflowScheduleEvent: (event: WorkflowScheduleEvent | null) => void;
  setWorkflowInvoice: (invoice: WorkflowInvoice | null) => void;
  clearWorkflow: () => void;
}

const WorkflowContext = createContext<WorkflowContextValue>({
  selectedClient: null,
  selectedEstimate: null,
  selectedScheduleEvent: null,
  selectedInvoice: null,
  setWorkflowClient: () => {},
  setWorkflowEstimate: () => {},
  setWorkflowScheduleEvent: () => {},
  setWorkflowInvoice: () => {},
  clearWorkflow: () => {},
});

export function WorkflowProvider({ children }: { children: ReactNode }) {
  const [selectedClient, setSelectedClient] = useState<WorkflowClient | null>(null);
  const [selectedEstimate, setSelectedEstimate] = useState<WorkflowEstimate | null>(null);
  const [selectedScheduleEvent, setSelectedScheduleEvent] = useState<WorkflowScheduleEvent | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<WorkflowInvoice | null>(null);

  const setWorkflowClient = useCallback((client: WorkflowClient | null) => {
    setSelectedClient(client);
  }, []);

  const setWorkflowEstimate = useCallback((estimate: WorkflowEstimate | null) => {
    setSelectedEstimate(estimate);
  }, []);

  const setWorkflowScheduleEvent = useCallback((event: WorkflowScheduleEvent | null) => {
    setSelectedScheduleEvent(event);
  }, []);

  const setWorkflowInvoice = useCallback((invoice: WorkflowInvoice | null) => {
    setSelectedInvoice(invoice);
  }, []);

  const clearWorkflow = useCallback(() => {
    setSelectedClient(null);
    setSelectedEstimate(null);
    setSelectedScheduleEvent(null);
    setSelectedInvoice(null);
  }, []);

  const value = useMemo(() => ({
    selectedClient,
    selectedEstimate,
    selectedScheduleEvent,
    selectedInvoice,
    setWorkflowClient,
    setWorkflowEstimate,
    setWorkflowScheduleEvent,
    setWorkflowInvoice,
    clearWorkflow,
  }), [selectedClient, selectedEstimate, selectedScheduleEvent, selectedInvoice,
    setWorkflowClient, setWorkflowEstimate, setWorkflowScheduleEvent, setWorkflowInvoice, clearWorkflow]);

  return (
    <WorkflowContext.Provider value={value}>
      {children}
    </WorkflowContext.Provider>
  );
}

export function useWorkflow() {
  return useContext(WorkflowContext);
}
