'use client';

import React, { useEffect } from 'react';
import { useMobileScope } from '@/components/mobile/MobileScopeContext';

export default function TasksLayout({ children }: { children: React.ReactNode }) {
    const { setScope } = useMobileScope();

    useEffect(() => {
        setScope('tasks');
        return () => {
            setScope('erp');
        };
    }, [setScope]);

    return <>{children}</>;
}
