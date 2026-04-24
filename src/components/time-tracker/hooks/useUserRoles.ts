"use client";
import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';

/**
 * Bridge: maps CoralOS roles → WorkHub roles
 * WorkHub expects: 'owner' | 'admin' | 'manager' | 'user'
 */
export type AppRole = 'owner' | 'admin' | 'manager' | 'user';

const ROLE_MAP: Record<string, AppRole> = {
  'SUPERADMIN': 'owner',
  'TENANT_OWNER': 'owner',
  'TENANT_ADMIN': 'admin',
  'TENANT_ENTERPRISE_ADMIN': 'admin',
  'TENANT_ENTERPRISE_MANAGER': 'manager',
  'TENANT_PRO_USER': 'user',
  'TENANT_ENTERPRISE_USER': 'user',
  'TENANT_PRO_WORKFORCE': 'user',
  'TENANT_ENTERPRISE_WORKFORCE': 'user',
  'TENANT_FREE_USER': 'user',
};

export function useUserRoles() {
  const { data: session } = useSession();
  const user = session?.user as unknown as { id?: string; role?: string } | undefined;

  const role = useMemo<AppRole>(() => {
    if (!user?.role) return 'user';
    return ROLE_MAP[user.role] || 'user';
  }, [user?.role]);

  const isAdmin = role === 'owner' || role === 'admin';
  const isManager = isAdmin || role === 'manager';

  return {
    role,
    isAdmin,
    isManager,
    loading: false,
    userId: user?.id || '',
  };
}
