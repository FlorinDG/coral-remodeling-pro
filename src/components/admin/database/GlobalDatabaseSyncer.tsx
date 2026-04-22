'use client';

import { useEffect, useRef } from 'react';
import { useDatabaseStore } from './store';
import { Database } from './types';

export default function GlobalDatabaseSyncer({ databases }: { databases: Database[] }) {
    const hasHydrated = useRef(false);

    useEffect(() => {
        if (!hasHydrated.current && databases) {
            useDatabaseStore.getState().hydrateDatabases(databases);

            // SECURITY OVERRIDE: 
            // The user's browser is aggressively persisting the v1 obsolete views (Calendar).
            // We forcefully overwrite db-1's structural blueprints with the active codebase.
            const freshDb1 = databases.find(d => d.id === 'db-1');
            if (freshDb1) {
                useDatabaseStore.setState(state => ({
                    databases: state.databases.map(db =>
                        db.id === 'db-1' ? { ...db, views: freshDb1.views, properties: freshDb1.properties } : db
                    )
                }));
            }

            hasHydrated.current = true;
        }
    }, [databases]);

    return null;
}
