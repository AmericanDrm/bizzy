import React, { createContext, useContext, useState, useCallback } from 'react';
import { RouteLocation } from '@/lib/routeOptimizationService';

interface RouteQueueContextValue {
  pendingLocations: RouteLocation[];
  addPendingLocations: (locs: RouteLocation[]) => void;
  consumePendingLocations: () => RouteLocation[];
}

const RouteQueueContext = createContext<RouteQueueContextValue>({
  pendingLocations: [],
  addPendingLocations: () => {},
  consumePendingLocations: () => [],
});

export function RouteQueueProvider({ children }: { children: React.ReactNode }) {
  const [pendingLocations, setPendingLocations] = useState<RouteLocation[]>([]);

  const addPendingLocations = useCallback((locs: RouteLocation[]) => {
    setPendingLocations((prev) => {
      const existingIds = new Set(prev.map((l) => l.id));
      return [...prev, ...locs.filter((l) => !existingIds.has(l.id))];
    });
  }, []);

  const consumePendingLocations = useCallback((): RouteLocation[] => {
    const current = pendingLocations;
    setPendingLocations([]);
    return current;
  }, [pendingLocations]);

  return (
    <RouteQueueContext.Provider value={{ pendingLocations, addPendingLocations, consumePendingLocations }}>
      {children}
    </RouteQueueContext.Provider>
  );
}

export function useRouteQueue() {
  return useContext(RouteQueueContext);
}
