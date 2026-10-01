"use client";
/**
 * WH-LEAN-1 · once per crew phone: drop the ERP database copy older versions saved in the browser
 * (IndexedDB 'coral-database-storage-v4'). The crew app no longer reads it, but it stayed on the
 * device. Removed only when it holds NO unsynced edits (syncQueue empty) — a shared phone that an
 * office user edited on keeps its copy until those edits reach the server.
 */
import { useEffect } from 'react';
import { get, del } from 'idb-keyval';

const KEY = 'coral-database-storage-v4';
const DONE = 'coral-wh-lean-1-cleaned';

export default function CrewStoreCleanup() {
    useEffect(() => {
        (async () => {
            try {
                if (localStorage.getItem(DONE)) return;
                const raw = (await get(KEY)) ?? localStorage.getItem(KEY);
                if (raw) {
                    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
                    const queue = parsed?.state?.syncQueue;
                    if (Array.isArray(queue) && queue.length > 0) return;   // unsynced edits: leave it
                    await del(KEY);
                    localStorage.removeItem(KEY);
                }
                localStorage.setItem(DONE, '1');
            } catch (err) {
                console.warn('[WH-LEAN-1] crew store cleanup skipped:', err);
            }
        })();
    }, []);
    return null;
}
