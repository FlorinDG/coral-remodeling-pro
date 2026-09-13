'use client';

import React, { createContext, useContext, useState } from 'react';

export type MobileAppScope = 'erp' | 'tasks';

interface MobileScopeContextValue {
    scope: MobileAppScope;
    setScope: (scope: MobileAppScope) => void;
}

const MobileScopeContext = createContext<MobileScopeContextValue>({
    scope: 'erp',
    setScope: () => {},
});

export function MobileScopeProvider({
    scope: initialScope = 'erp',
    children,
}: {
    scope?: MobileAppScope;
    children: React.ReactNode;
}) {
    const [scope, setScope] = useState<MobileAppScope>(initialScope);
    return (
        <MobileScopeContext.Provider value={{ scope, setScope }}>
            {children}
        </MobileScopeContext.Provider>
    );
}

export function useMobileScope() {
    return useContext(MobileScopeContext);
}
