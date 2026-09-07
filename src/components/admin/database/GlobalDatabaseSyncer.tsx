'use client';

import { useEffect, useRef } from 'react';
import { useDatabaseStore } from './store';
import { Database, Page, PageIndexEntry } from './types';
import { toast } from 'sonner';
import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getGlobalPage } from '@/app/actions/global-databases';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface GlobalDatabaseSyncerProps {
    databases: Database[];
    pageIndex?: PageIndexEntry[];
    tenantId?: string | null;
    userId?: string | null;
}

export default function GlobalDatabaseSyncer({ databases, pageIndex, tenantId, userId }: GlobalDatabaseSyncerProps) {
    const hasHydrated = useRef(false);
    const serverDbs = useRef(databases);
    const serverPageIndex = useRef(pageIndex);
    const [conflict, setConflict] = useState<{ page: Page, lastEditedBy?: string } | null>(null);
    const [serverPage, setServerPage] = useState<any>(null);
    const [isLoadingServerPage, setIsLoadingServerPage] = useState(false);
    
    // keys that actually differ between client and server
    const [conflictFields, setConflictFields] = useState<string[]>([]);
    // true = keep mine, false = keep theirs
    const [fieldResolutions, setFieldResolutions] = useState<Record<string, boolean>>({});
    useEffect(() => {
        serverDbs.current = databases;
        serverPageIndex.current = pageIndex;
    }, [databases, pageIndex]);

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
            
            setConflict({ page, lastEditedBy: detail.lastEditedBy });
            setIsLoadingServerPage(true);
            
            getGlobalPage(page.id).then((sp: any) => {
                if (sp) {
                    setServerPage(sp);
                    const DERIVED_PROPERTY_KEYS = new Set(['totalVat', 'totalExVat', 'totalIncVat', 'margin', 'totalCost', 'totalProfit']);
                    const isDeepEqual = (a: any, b: any): boolean => {
                        if (a === b) return true;
                        if (a && b && typeof a === 'object' && typeof b === 'object') {
                            if (Array.isArray(a)) {
                                if (!Array.isArray(b) || a.length !== b.length) return false;
                                for (let i = 0; i < a.length; i++) {
                                    if (!isDeepEqual(a[i], b[i])) return false;
                                }
                                return true;
                            }
                            const keysA = Object.keys(a);
                            const keysB = Object.keys(b);
                            if (keysA.length !== keysB.length) return false;
                            for (const key of keysA) {
                                if (!keysB.includes(key) || !isDeepEqual(a[key], b[key])) return false;
                            }
                            return true;
                        }
                        return false;
                    };
                    const cFields = Object.keys(page.properties).filter(k => 
                        !DERIVED_PROPERTY_KEYS.has(k) && !isDeepEqual(page.properties[k], sp.properties[k])
                    );
                    setConflictFields(cFields);
                    const defaultRes: Record<string, boolean> = {};
                    cFields.forEach(f => defaultRes[f] = true); // Default to keep mine
                    setFieldResolutions(defaultRes);
                }
                setIsLoadingServerPage(false);
            }).catch(() => {
                setIsLoadingServerPage(false);
                toast.error('Kan de serverversie niet ophalen.');
            });
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
            if (serverPageIndex.current && serverPageIndex.current.length > 0) {
                useDatabaseStore.getState().hydratePageIndex(serverPageIndex.current);
            }

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

    const handleResolve = () => {
        if (!conflict || !serverPage) return;
        
        const mergedProps = { ...serverPage.properties };
        for (const field of conflictFields) {
            if (fieldResolutions[field]) {
                mergedProps[field] = conflict.page.properties[field];
            }
        }
        
        const newPage = {
            ...conflict.page,
            properties: mergedProps,
            // Re-baseline to the server's time and blocksVersion
            baseUpdatedAt: serverPage.updatedAt,
            blocksVersion: serverPage.blocksVersion,
            // Bump local updatedAt so it syncs immediately
            updatedAt: new Date().toISOString()
        };
        
        // Push resolved page back to local store
        useDatabaseStore.getState()._pushUndo({ type: 'updatePage', databaseId: conflict.page.databaseId, page: conflict.page });
        
        useDatabaseStore.setState(state => ({
            databases: state.databases.map(db => {
                if (db.id !== conflict.page.databaseId) return db;
                return {
                    ...db,
                    pages: db.pages.map(p => p.id === newPage.id ? newPage : p)
                }
            }),
            pageIndex: {
                ...state.pageIndex,
                [newPage.id]: {
                    id: newPage.id,
                    databaseId: conflict.page.databaseId,
                    title: (newPage.properties.title || newPage.properties.name || newPage.properties['prop-title'] || 'Untitled') as string,
                    updatedAt: newPage.updatedAt,
                }
            },
            syncQueue: [...state.syncQueue, { 
                type: 'upsert' as const, 
                databaseId: conflict.page.databaseId, 
                pageId: newPage.id, 
                page: newPage as any,
                tenantId: tenantId || '',
                userId: userId || '',
                retryCount: 0
            }]
        }));
        
        useDatabaseStore.getState()._processSyncQueue();
        setConflict(null);
        setServerPage(null);
        toast.success('Conflict succesvol opgelost.');
    };

    const isSystem = conflict?.lastEditedBy?.toUpperCase() === 'SYSTEM' || conflict?.lastEditedBy?.startsWith('system:');

    return (
        <>
            <Dialog open={!!conflict} onOpenChange={(o) => {
                if (!o) {
                    setConflict(null);
                    setServerPage(null);
                }
            }}>
                <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-amber-600">
                            <AlertTriangle className="w-5 h-5" /> Sync Conflict
                        </DialogTitle>
                        <DialogDescription>
                            {isSystem ? 
                                'This record was updated by a background process while you were editing.' :
                                'Someone else edited this page while you were working.'
                            }
                        </DialogDescription>
                    </DialogHeader>
                    
                    {isLoadingServerPage ? (
                        <div className="flex flex-col items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-neutral-400 mb-2" />
                            <p className="text-sm text-neutral-500">Fetching latest changes...</p>
                        </div>
                    ) : (
                        <div className="text-sm py-4 space-y-4">
                            <p className="text-neutral-600 dark:text-neutral-300">
                                We could not automatically merge the changes. Please review the conflicting fields below and choose which version to keep.
                            </p>
                            
                            {conflictFields.length > 0 ? (
                                <div className="space-y-3 border rounded-lg p-3 bg-neutral-50 dark:bg-neutral-900/50">
                                    {conflictFields.map(field => (
                                        <div key={field} className="flex flex-col gap-2 p-3 bg-white dark:bg-neutral-800 rounded shadow-sm border border-neutral-100 dark:border-neutral-700">
                                            <div className="font-semibold text-xs text-neutral-500 uppercase tracking-wider">{field}</div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div 
                                                    className={`p-2 rounded border cursor-pointer transition-colors ${fieldResolutions[field] ? 'border-[var(--brand-color,#d35400)] bg-[var(--brand-color,#d35400)]/10 dark:bg-[var(--brand-color,#d35400)]/20' : 'border-neutral-200 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800'}`}
                                                    onClick={() => setFieldResolutions(prev => ({ ...prev, [field]: true }))}
                                                >
                                                    <div className="text-xs font-medium mb-1">Your Edit</div>
                                                    <div className="text-sm truncate" title={String(conflict?.page?.properties[field])}>{String(conflict?.page?.properties[field]) || '-'}</div>
                                                </div>
                                                <div 
                                                    className={`p-2 rounded border cursor-pointer transition-colors ${!fieldResolutions[field] ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-neutral-200 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800'}`}
                                                    onClick={() => setFieldResolutions(prev => ({ ...prev, [field]: false }))}
                                                >
                                                    <div className="text-xs font-medium mb-1">Latest Version</div>
                                                    <div className="text-sm truncate" title={String(serverPage?.properties[field])}>{String(serverPage?.properties[field]) || '-'}</div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm">
                                    No conflicting fields found! The conflict was likely in document layout or blocks. Click "Resolve & Save" to force your version through.
                                </div>
                            )}
                        </div>
                    )}
                    
                    <DialogFooter>
                        <Button variant="outline" onClick={() => {
                            if (!conflict?.page) return;
                            const blob = new Blob([JSON.stringify(conflict.page, null, 2)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `conflict-backup-${conflict.page.id}.json`;
                            a.click();
                            URL.revokeObjectURL(url);
                        }}>Download Backup</Button>
                        <Button onClick={handleResolve} disabled={isLoadingServerPage} className="bg-[var(--brand-color,#d35400)] hover:opacity-90 text-white">
                            Resolve & Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
