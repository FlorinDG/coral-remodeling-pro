"use client";

import React, { createContext, useContext, ReactNode, useMemo } from "react";
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
}

const TenantContext = createContext<TenantContextProps>({
    activeModules: [],
    planType: 'FREE',
    lockedDbIds: {},
    tenant: null,
    resolveDbId: (base) => base, // safe default — falls back to bare ID
    isPro: false,
    isEnterprise: false,
});

export const TenantProvider = ({
    children,
    activeModules,
    planType,
    lockedDbIds = {},
    tenant = null,
}: {
    children: ReactNode;
    activeModules: string[];
    planType: string;
    lockedDbIds?: Record<string, string>;
    tenant?: any;
}) => {
    const resolveDbId = (base: string) => getLockedDbId(base, lockedDbIds);
    const isPro = useMemo(() => ['PRO', 'ENTERPRISE', 'FOUNDER', 'CUSTOM'].includes(planType), [planType]);
    const isEnterprise = useMemo(() => ['ENTERPRISE', 'FOUNDER', 'CUSTOM'].includes(planType), [planType]);
    return (
        <TenantContext.Provider value={{ activeModules, planType, lockedDbIds, tenant, resolveDbId, isPro, isEnterprise }}>
            {children}
        </TenantContext.Provider>
    );
};

export const useTenant = () => useContext(TenantContext);
