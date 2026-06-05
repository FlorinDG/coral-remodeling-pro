'use client';

import { useEffect, useRef } from 'react';
import { useDatabaseStore } from './store';
import { Database } from './types';

export default function GlobalDatabaseSyncer({ databases }: { databases: Database[] }) {
    const hasHydrated = useRef(false);
    const serverDbs = useRef(databases);
    serverDbs.current = databases;

    // Single effect: wait for persist to finish, then merge server data.
    // Uses a ref to avoid re-running when databases prop changes (it shouldn't).
    useEffect(() => {
        function applyServerData() {
            if (hasHydrated.current) return;
            const dbs = serverDbs.current;
            if (!dbs || dbs.length === 0) {
                console.warn('[GlobalDatabaseSyncer] No databases from server — skipping hydration');
                return;
            }

            hasHydrated.current = true;
            console.log(`[GlobalDatabaseSyncer] Hydrating ${dbs.length} databases: ${dbs.map(d => d.id).join(', ')}`);
            useDatabaseStore.getState().hydrateDatabases(dbs);

            // SECURITY OVERRIDE: 
            // Forcefully overwrite db-1's and db-tasks' structural blueprints
            // from the server, but preserve user-set column widths.
            for (const targetId of ['db-1', 'db-tasks']) {
                const freshDb = dbs.find(d => d.id === targetId);
                if (!freshDb) continue;
                useDatabaseStore.setState(state => {
                    const localDb = state.databases.find(db => db.id === targetId);
                    const localViewStateMap = new Map(
                        (localDb?.views || []).map(v => [v.id, v.propertiesState])
                    );
                    return {
                        databases: state.databases.map(db =>
                            db.id === targetId ? {
                                ...db,
                                properties: freshDb.properties,
                                views: freshDb.views.map(v => ({
                                    ...v,
                                    propertiesState: localViewStateMap.get(v.id) || v.propertiesState,
                                })),
                            } : db
                        )
                    };
                });
            }
        }

        // If persist already rehydrated (fast IDB), apply immediately
        if (useDatabaseStore.persist.hasHydrated()) {
            applyServerData();
            return;
        }

        // Otherwise wait for persist to finish
        const unsub = useDatabaseStore.persist.onFinishHydration(() => {
            applyServerData();
        });

        return unsub;
    }, []); // Empty deps — runs once, uses refs for current data

    return null;
}
