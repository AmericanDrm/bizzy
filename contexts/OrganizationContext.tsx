import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';
import { clearOrgCache } from '@/lib/supabaseClient';

interface Organization {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'manager' | 'member';
  joined_at: string;
}

interface OrganizationContextType {
  currentOrganization: Organization | null;
  organizationMember: OrganizationMember | null;
  organizations: Organization[];
  loading: boolean;
  noOrganization: boolean;
  currentOrgId: string | null;
  currentUserRole: 'owner' | 'admin' | 'manager' | 'member' | null;
  isOwner: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isAdminOrOwner: boolean;
  isAdminOrManager: boolean;
  employeeInvoicesHidden: boolean;
  switchOrganization: (orgId: string) => Promise<void>;
  refreshOrganizations: () => Promise<void>;
}

const FALLBACK_VALUE: OrganizationContextType = {
  currentOrganization: null,
  organizationMember: null,
  organizations: [],
  loading: true,
  noOrganization: false,
  currentOrgId: null,
  currentUserRole: null,
  isOwner: false,
  isAdmin: false,
  isManager: false,
  isAdminOrOwner: false,
  isAdminOrManager: false,
  employeeInvoicesHidden: false,
  switchOrganization: async () => {},
  refreshOrganizations: async () => {},
};

const OrganizationContext = createContext<OrganizationContextType>(FALLBACK_VALUE);

export function useOrganization() {
  return useContext(OrganizationContext);
}

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [organizationMember, setOrganizationMember] = useState<OrganizationMember | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [noOrganization, setNoOrganization] = useState(false);
  const [employeeInvoicesHidden, setEmployeeInvoicesHidden] = useState(false);

  const loadOrganizations = useCallback(async () => {
    if (!user?.id) {
      setCurrentOrganization(null);
      setOrganizationMember(null);
      setOrganizations([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: memberships, error: membershipsError } = await supabase
        .from('organization_members')
        .select('*, organizations(*)')
        .eq('user_id', user.id);

      if (membershipsError) {
        console.error('Error loading organization memberships:', membershipsError);
        setCurrentOrganization(null);
        setOrganizationMember(null);
        setOrganizations([]);
        setNoOrganization(false);
        setLoading(false);
        return;
      }

      if (memberships && memberships.length > 0) {
        const orgs = memberships.map((m: any) => m.organizations).filter(Boolean);
        setOrganizations(orgs);
        setNoOrganization(false);

        const storedOrgId = await AsyncStorage.getItem(`current_org_${user.id}`);
        let currentMembership = memberships.find((m: any) => m.organization_id === storedOrgId);

        if (!currentMembership) {
          currentMembership = memberships[0];
        }

        setCurrentOrganization(currentMembership.organizations);
        setOrganizationMember({
          id: currentMembership.id,
          organization_id: currentMembership.organization_id,
          user_id: currentMembership.user_id,
          role: currentMembership.role,
          joined_at: currentMembership.joined_at,
        });

        // Load org-level permission settings
        const { data: bizSettings } = await supabase
          .from('business_settings')
          .select('employee_invoices_hidden')
          .eq('organization_id', currentMembership.organization_id)
          .maybeSingle();
        setEmployeeInvoicesHidden(bizSettings?.employee_invoices_hidden ?? false);

        await AsyncStorage.setItem(`current_org_${user.id}`, currentMembership.organization_id);
        clearOrgCache();
      } else {
        setCurrentOrganization(null);
        setOrganizationMember(null);
        setOrganizations([]);
        setNoOrganization(true);
      }
    } catch (error) {
      console.error('Error loading organizations:', error);
      setCurrentOrganization(null);
      setOrganizationMember(null);
      setOrganizations([]);
      setNoOrganization(false);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (user?.id) {
      loadOrganizations().catch(err => {
        console.error('Failed to load organizations in useEffect:', err);
        setCurrentOrganization(null);
        setOrganizationMember(null);
        setOrganizations([]);
        setLoading(false);
      });
    } else {
      setCurrentOrganization(null);
      setOrganizationMember(null);
      setOrganizations([]);
      setLoading(false);
    }
  }, [user?.id, authLoading, loadOrganizations]);

  const switchOrganization = useCallback(async (orgId: string) => {
    if (!user?.id) {
      console.warn('Cannot switch organization: user not authenticated');
      return;
    }

    const org = organizations.find(o => o.id === orgId);
    if (!org) {
      console.warn('Cannot switch to organization: not found in user organizations');
      return;
    }

    try {
      const { data: membership, error } = await supabase
        .from('organization_members')
        .select('*')
        .eq('organization_id', orgId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching organization membership:', error);
        return;
      }

      if (membership) {
        setCurrentOrganization(org);
        setOrganizationMember(membership);
        await AsyncStorage.setItem(`current_org_${user.id}`, orgId);
        clearOrgCache();
      } else {
        console.warn('User is not a member of the target organization');
      }
    } catch (error) {
      console.error('Error switching organization:', error);
    }
  }, [user?.id, organizations]);

  const refreshOrganizations = useCallback(async () => {
    await loadOrganizations();
  }, [loadOrganizations]);

  // Computed values (memoized for performance)
  const currentOrgId = useMemo(() => currentOrganization?.id || null, [currentOrganization?.id]);

  const currentUserRole = useMemo(() => organizationMember?.role || null, [organizationMember?.role]);

  const isOwner = useMemo(() => currentUserRole === 'owner', [currentUserRole]);

  const isAdmin = useMemo(() => currentUserRole === 'admin', [currentUserRole]);

  const isManager = useMemo(() => currentUserRole === 'manager', [currentUserRole]);

  const isAdminOrOwner = useMemo(() =>
    currentUserRole === 'owner' || currentUserRole === 'admin',
    [currentUserRole]
  );

  const isAdminOrManager = useMemo(() =>
    currentUserRole === 'owner' || currentUserRole === 'admin' || currentUserRole === 'manager',
    [currentUserRole]
  );

  const value = useMemo(() => ({
    currentOrganization,
    organizationMember,
    organizations,
    loading,
    noOrganization,
    currentOrgId,
    currentUserRole,
    isOwner,
    isAdmin,
    isManager,
    isAdminOrOwner,
    isAdminOrManager,
    employeeInvoicesHidden,
    switchOrganization,
    refreshOrganizations,
  }), [
    currentOrganization,
    organizationMember,
    organizations,
    loading,
    noOrganization,
    currentOrgId,
    currentUserRole,
    isOwner,
    isAdmin,
    isManager,
    isAdminOrOwner,
    isAdminOrManager,
    employeeInvoicesHidden,
    switchOrganization,
    refreshOrganizations,
  ]);

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}
