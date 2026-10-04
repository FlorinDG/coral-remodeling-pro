"use client";
/**
 * WH-LEAN-1 · the ONE WorkHub screen that writes ERP records (office roles only).
 *
 * The WorkHub no longer loads the ERP database store at start-up — the layout used to ship every
 * database (with every page, while the lazy flag is off) to open a phone app that shows shifts.
 * This launcher is loaded on demand (next/dynamic from Index), and only when it opens does it fetch
 * the database schemas and the clients list the Site Visit form needs.
 *
 * A failed load is shown, never an empty client list (no `.catch(() => [])`).
 */
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useDatabaseStore } from '@/components/admin/database/store';
import { getGlobalDatabaseSchemas } from '@/app/actions/global-databases';
import { useTenant } from '@/context/TenantContext';
import { useUserRoles } from '@/components/time-tracker/hooks/useUserRoles';
import { describeError } from '@/lib/describe-error';
import { SiteVisitModal } from './SiteVisitModal';

let schemasLoaded = false;   // once per app session

/** The store restores itself from IndexedDB asynchronously; merging server data before that finishes
 *  would be overwritten by the restore (GlobalDatabaseSyncer waits for the same thing). */
function storeRestored(): Promise<void> {
    const p = useDatabaseStore.persist;
    if (p.hasHydrated()) return Promise.resolve();
    return new Promise(resolve => { const off = p.onFinishHydration(() => { off(); resolve(); }); });
}

export default function SiteVisitLauncher({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { tenant, resolveDbId } = useTenant();
    const { userId } = useUserRoles();
    const [state, setState] = useState<'loading' | 'ready' | 'error'>(schemasLoaded ? 'ready' : 'loading');
    const [error, setError] = useState<string | null>(null);
    const [attempt, setAttempt] = useState(0);
    const clientsDbId = resolveDbId('db-clients');

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        (async () => {
            try {
                await storeRestored();
                const store = useDatabaseStore.getState();
                if (tenant?.id && userId) store.setSession(tenant.id, userId);
                if (!schemasLoaded) {
                    store.hydrateDatabases(await getGlobalDatabaseSchemas());
                    schemasLoaded = true;
                }
                await store.loadDatabasePages(clientsDbId);
                if (!cancelled) setState('ready');
            } catch (err) {
                if (!cancelled) { setError(describeError(err)); setState('error'); }
            }
        })();
        return () => { cancelled = true; };
    }, [open, attempt, tenant?.id, userId, clientsDbId]);

    if (state === 'ready') return <SiteVisitModal open={open} onClose={onClose} />;

    return (
        <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Site visit</DialogTitle>
                    <DialogDescription>
                        {state === 'error' ? `Could not load the clients list — ${error}` : 'Loading clients…'}
                    </DialogDescription>
                </DialogHeader>
                {state === 'loading'
                    ? <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin" /></div>
                    : <Button onClick={() => { setState('loading'); setAttempt(a => a + 1); }}>Retry</Button>}
            </DialogContent>
        </Dialog>
    );
}
