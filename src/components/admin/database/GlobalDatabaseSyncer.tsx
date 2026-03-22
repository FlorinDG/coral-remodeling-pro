'use client';

import { useEffect, useRef } from 'react';
import { useDatabaseStore } from './store';
import { Database } from './types';

export default function GlobalDatabaseSyncer({ databases }: { databases: Database[] }) {
    const hasHydrated = useRef(false);

    useEffect(() => {
        if (!hasHydrated.current && databases && databases.length > 0) {
            useDatabaseStore.getState().hydrateDatabases(databases);
            hasHydrated.current = true;
        }
    }, [databases]);

    return null;
}
