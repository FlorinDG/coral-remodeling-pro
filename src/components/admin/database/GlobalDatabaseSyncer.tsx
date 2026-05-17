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
            // We forcefully overwrite db-1's structural blueprints with the active codebase,
            // but preserve user-set column widths (propertiesState).
            const freshDb1 = databases.find(d => d.id === 'db-1');
            if (freshDb1) {
                useDatabaseStore.setState(state => {
                    const localDb1 = state.databases.find(db => db.id === 'db-1');
                    const localViewStateMap = new Map(
                        (localDb1?.views || []).map(v => [v.id, v.propertiesState])
                    );
                    return {
                        databases: state.databases.map(db =>
                            db.id === 'db-1' ? {
                                ...db,
                                properties: freshDb1.properties,
                                views: freshDb1.views.map(v => ({
                                    ...v,
                                    propertiesState: localViewStateMap.get(v.id) || v.propertiesState,
                                })),
                            } : db
                        )
                    };
                });
            }

            const freshDbTasks = databases.find(d => d.id === 'db-tasks');
            if (freshDbTasks) {
                useDatabaseStore.setState(state => {
                    const localDbTasks = state.databases.find(db => db.id === 'db-tasks');
                    const localViewStateMap = new Map(
                        (localDbTasks?.views || []).map(v => [v.id, v.propertiesState])
                    );
                    return {
                        databases: state.databases.map(db =>
                            db.id === 'db-tasks' ? {
                                ...db,
                                properties: freshDbTasks.properties,
                                views: freshDbTasks.views.map(v => ({
                                    ...v,
                                    propertiesState: localViewStateMap.get(v.id) || v.propertiesState,
                                })),
                            } : db
                        )
                    };
                });
            }

            hasHydrated.current = true;
        }
    }, [databases]);

    return null;
}
