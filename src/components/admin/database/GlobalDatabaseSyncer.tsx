'use client';

import { useEffect, useRef } from 'react';
import { useDatabaseStore } from './store';
import { Database, Page } from './types';
import { toast } from 'sonner';

interface GlobalDatabaseSyncerProps {
    databases: Database[];
    tenantId?: string | null;
    userId?: string | null;
}

export default function GlobalDatabaseSyncer({ databases, tenantId, userId }: GlobalDatabaseSyncerProps) {
    const hasHydrated = useRef(false);
    const serverDbs = useRef(databases);
    
    useEffect(() => {
        serverDbs.current = databases;
    }, [databases]);

    // Update session info in store
    useEffect(() => {
        if (tenantId && userId) {
            useDatabaseStore.getState().setSession(tenantId, userId);
        }
    }, [tenantId, userId]);

    // Setup conflict event listener & online listener
    useEffect(() => {
        const handleConflict = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            const page = detail.page as Page;
            
            // Show toast
            toast.error('Sync Conflict Detected', {
                description: `Someone else edited this page while you were working. We have reloaded the latest version, and a backup of your edits has been saved to your browser downloads.`,
                duration: 10000,
            });

            // Trigger a download of the conflict data (recovery buffer)
            const blob = new Blob([JSON.stringify(page, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `conflict-backup-${page.id}.json`;
            a.click();
            URL.revokeObjectURL(url);
            
            // Reload window to fetch latest server state safely
            setTimeout(() => window.location.reload(), 3000);
        };

        const handleOnline = () => {
            console.log('[GlobalDatabaseSyncer] Online event detected. Flushing sync queue...');
            useDatabaseStore.getState()._processSyncQueue();
        };

        window.addEventListener('coral-sync-conflict', handleConflict);
        window.addEventListener('online', handleOnline);

        return () => {
            window.removeEventListener('coral-sync-conflict', handleConflict);
            window.removeEventListener('online', handleOnline);
        };
    }, []);

    // Single effect: wait for persist to finish, then merge server data.
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
                                }))
                            } : db
                        )
                    };
                });
            }
        }

        if (useDatabaseStore.persist.hasHydrated()) {
            applyServerData();
            // Process queue right after hydration in case there are pending items
            setTimeout(() => useDatabaseStore.getState()._processSyncQueue(), 1000);
            return;
        }

        const unsub = useDatabaseStore.persist.onFinishHydration(() => {
            applyServerData();
            setTimeout(() => useDatabaseStore.getState()._processSyncQueue(), 1000);
        });

        return unsub;
    }, []);

    return null;
}
