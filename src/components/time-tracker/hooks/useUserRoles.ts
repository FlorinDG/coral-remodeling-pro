"use client";
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/components/time-tracker/integrations/supabase/client';
import { useAuth } from '@/components/time-tracker/contexts/AuthContext';

export type AppRole = 'owner' | 'admin' | 'manager' | 'user';

export function useUserRoles() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRoles([]);
      setLoading(false);
      return;
    }

    if (user.id === '00000000-0000-0000-0000-000000000000') {
      // Mock user from AuthContext is treated as admin
      setRoles(['admin', 'manager', 'owner']);
      setLoading(false);
      return;
    }

    const fetchRoles = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      if (!error && data) {
        setRoles(data.map(r => r.role as AppRole));
      }
      setLoading(false);
    };

    fetchRoles();
  }, [user?.id]); // Only depend on user.id, not the entire user object

  const isOwner = roles.includes('owner');
  const isManager = roles.includes('manager') || roles.includes('admin') || roles.includes('owner');
  const isAdmin = roles.includes('admin') || roles.includes('owner');

  return useMemo(() => ({
    roles,
    loading,
    isOwner,
    isManager,
    isAdmin,
  }), [roles, loading, isOwner, isManager, isAdmin]);
}
