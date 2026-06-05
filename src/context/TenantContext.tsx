"use client";

import React, { createContext, useContext, ReactNode, useMemo, useState, useCallback, useEffect } from "react";
import { getLockedDbId } from "@/lib/lockedDbUtils";

interface TenantContextProps {
    activeModules: string[];
    planType: string;
    lockedDbIds: Record<string, string>;
    tenant: any; // Full tenant profile
    /** Resolve a base locked DB name (e.g. 'db-invoices') to the tenant-scoped actual ID */
    resolveDbId: (base: string) => string;
    /** true if plan is PRO, ENTERPRISE, FOUNDER, or CUSTOM */
    isPro: boolean;
    /** true if plan is ENTERPRISE, FOUNDER, or CUSTOM */
    isEnterprise: boolean;
    /** Fetch fresh tenant profile from the server and update context */
    refreshTenant: () => Promise<void>;
}

const TenantContext = createContext<TenantContextProps>({
    activeModules: [],
    planType: 'FREE',
    lockedDbIds: {},
    tenant: null,
    resolveDbId: (base) => base, // safe default — falls back to bare ID
    isPro: false,
    isEnterprise: false,
    refreshTenant: async () => {},
});

export const TenantProvider = ({
    children,
    activeModules,
    planType,
    lockedDbIds = {},
    tenant: initialTenant = null,
}: {
    children: ReactNode;
    activeModules: string[];
    planType: string;
    lockedDbIds?: Record<string, string>;
    tenant?: any;
}) => {
    // PROFILE-1: Tenant is now STATE, not a pass-through prop.
    // This allows refreshTenant() to update all consumers without a full page reload.
    const [tenant, setTenant] = useState<any>(initialTenant);

    // Sync with server-side prop updates (e.g., from router.refresh())
    useEffect(() => {
        if (initialTenant) setTenant(initialTenant);
    }, [initialTenant]);

    const resolveDbId = (base: string) => getLockedDbId(base, lockedDbIds);
    const isPro = useMemo(() => ['PRO', 'ENTERPRISE', 'FOUNDER', 'CUSTOM'].includes(planType), [planType]);
    const isEnterprise = useMemo(() => ['ENTERPRISE', 'FOUNDER', 'CUSTOM'].includes(planType), [planType]);

    const refreshTenant = useCallback(async () => {
        try {
            const res = await fetch('/api/tenant/profile', {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-store' },
            });
            if (res.ok) {
                const fresh = await res.json();
                setTenant(fresh);
                // Dispatch event so components outside React tree (e.g., AdminLayout branding) can react
                window.dispatchEvent(new CustomEvent('tenantProfileUpdated', { detail: fresh }));
            }
        } catch (e) {
            console.error('[TenantContext] refreshTenant failed:', e);
        }
    }, []);

    // Listen for tenantProfileUpdated events from settings saves in other components
    useEffect(() => {
        const handler = (e: Event) => {
            const fresh = (e as CustomEvent).detail;
            if (fresh) setTenant(fresh);
        };
        window.addEventListener('tenantProfileUpdated', handler);
        return () => window.removeEventListener('tenantProfileUpdated', handler);
    }, []);

    return (
        <TenantContext.Provider value={{ activeModules, planType, lockedDbIds, tenant, resolveDbId, isPro, isEnterprise, refreshTenant }}>
            {children}
        </TenantContext.Provider>
    );
};

export const useTenant = () => useContext(TenantContext);

