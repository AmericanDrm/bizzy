import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { usePathname } from 'expo-router';

type TabRoute = 'index' | 'clients' | 'schedule' | 'time' | 'invoices' | 'notes' | 'finances';

interface TabNavigationContextType {
  currentTab: TabRoute;
  previousTab: TabRoute | null;
}

const TabNavigationContext = createContext<TabNavigationContextType | undefined>(undefined);

const routeToTab = (pathname: string): TabRoute => {
  const cleanPath = pathname.replace(/^\//, '').split('/')[0] || 'index';

  const validTabs: TabRoute[] = ['index', 'clients', 'schedule', 'time', 'invoices', 'notes', 'finances'];

  if (validTabs.includes(cleanPath as TabRoute)) {
    return cleanPath as TabRoute;
  }

  return 'index';
};

export function TabNavigationProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [currentTab, setCurrentTab] = useState<TabRoute>('index');
  const [previousTab, setPreviousTab] = useState<TabRoute | null>(null);

  useEffect(() => {
    const newTab = routeToTab(pathname);

    if (newTab !== currentTab) {
      setPreviousTab(currentTab);
      setCurrentTab(newTab);
    }
  }, [pathname]);

  return (
    <TabNavigationContext.Provider value={{ currentTab, previousTab }}>
      {children}
    </TabNavigationContext.Provider>
  );
}

export function useTabNavigation() {
  const context = useContext(TabNavigationContext);
  if (!context) {
    throw new Error('useTabNavigation must be used within TabNavigationProvider');
  }
  return context;
}
