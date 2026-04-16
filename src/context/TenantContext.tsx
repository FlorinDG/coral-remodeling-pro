"use client";

import React, { createContext, useContext, ReactNode } from "react";

interface TenantContextProps {
    activeModules: string[];
    planType: string;
}

const TenantContext = createContext<TenantContextProps>({
    activeModules: [],
    planType: 'FREE',   // safe default — most restrictive
});

export const TenantProvider = ({
    children,
    activeModules,
    planType,
}: {
    children: ReactNode;
    activeModules: string[];
    planType: string;
}) => {
    return (
        <TenantContext.Provider value={{ activeModules, planType }}>
            {children}
        </TenantContext.Provider>
    );
};

export const useTenant = () => useContext(TenantContext);
