'use client';

import { useEffect, useRef, useState } from 'react';
import { useDatabaseStore } from './store';
import { Database } from './types';

export default function GlobalDatabaseSyncer({ databases }: { databases: Database[] }) {
    const hasHydrated = useRef(false);
    const [persistReady, setPersistReady] = useState(false);

    // ── Wait for IndexedDB rehydration to finish FIRST ──────────────────
    // Zustand's persist middleware loads stale data from IDB asynchronously.
    // If we hydrate with server data BEFORE IDB finishes, IDB will overwrite
    // everything — causing the "good for 500ms then snaps back" bug.
    // By waiting for persist rehydration, we ensure server data always wins.
    useEffect(() => {
        if (useDatabaseStore.persist.hasHydrated()) {
            setPersistReady(true);
            return;
        }
        const unsub = useDatabaseStore.persist.onFinishHydration(() => {
            setPersistReady(true);
        });
        return unsub;
    }, []);

    // ── Merge server data into the store AFTER IDB rehydration ──────────
    useEffect(() => {
        if (!persistReady) return;
        if (hasHydrated.current) return;
        if (!databases || databases.length === 0) return;

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
        console.log(`[GlobalDatabaseSyncer] Hydrated ${databases.length} databases from server (after IDB rehydration)`);
    }, [persistReady, databases]);

    return null;
}
