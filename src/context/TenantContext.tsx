"use client";

import React, { createContext, useContext, ReactNode } from "react";

interface TenantContextProps {
    activeModules: string[];
}

const TenantContext = createContext<TenantContextProps>({ activeModules: [] });

export const TenantProvider = ({ children, activeModules }: { children: ReactNode, activeModules: string[] }) => {
    return (
        <TenantContext.Provider value={{ activeModules }}>
            {children}
        </TenantContext.Provider>
    );
};

export const useTenant = () => useContext(TenantContext);
