"use client";

import React, { createContext, useContext, ReactNode } from "react";
import { getLockedDbId } from "@/lib/lockedDbUtils";

interface TenantContextProps {
    activeModules: string[];
    planType: string;
    lockedDbIds: Record<string, string>;
    /** Resolve a base locked DB name (e.g. 'db-invoices') to the tenant-scoped actual ID */
    resolveDbId: (base: string) => string;
}

const TenantContext = createContext<TenantContextProps>({
    activeModules: [],
    planType: 'FREE',
    lockedDbIds: {},
    resolveDbId: (base) => base, // safe default — falls back to bare ID
});

export const TenantProvider = ({
    children,
    activeModules,
    planType,
    lockedDbIds = {},
}: {
    children: ReactNode;
    activeModules: string[];
    planType: string;
    lockedDbIds?: Record<string, string>;
}) => {
    const resolveDbId = (base: string) => getLockedDbId(base, lockedDbIds);
    return (
        <TenantContext.Provider value={{ activeModules, planType, lockedDbIds, resolveDbId }}>
            {children}
        </TenantContext.Provider>
    );
};

export const useTenant = () => useContext(TenantContext);
