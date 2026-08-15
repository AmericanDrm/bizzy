import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';

type UserRole = 'owner' | 'admin' | 'manager' | 'member';

interface UseUserRoleResult {
  role: UserRole;
  loading: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isAdminOrManager: boolean;
  isBasicUser: boolean;
  isEmployee: boolean;
  refetch: () => Promise<void>;
}

export function useUserRole(): UseUserRoleResult {
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const [role, setRole] = useState<UserRole>('member');
  const [loading, setLoading] = useState(true);

  const fetchRole = async () => {
    if (!user || !currentOrganization) {
      setRole('member');
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('organization_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('organization_id', currentOrganization.id)
        .maybeSingle();

      if (error) throw error;

      setRole((data?.role as UserRole) || 'member');
    } catch (error) {
      console.error('Error fetching user role:', error);
      setRole('member');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRole();
  }, [user?.id, currentOrganization?.id]);

  return {
    role,
    loading,
    isOwner: role === 'owner',
    isAdmin: role === 'admin',
    isManager: role === 'manager',
    isAdminOrManager: role === 'owner' || role === 'admin' || role === 'manager',
    isBasicUser: role === 'member',
    isEmployee: role === 'member',
    refetch: fetchRole,
  };
}
