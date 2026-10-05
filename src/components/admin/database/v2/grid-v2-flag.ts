'use client';
/**
 * GRID-REPLACE-1 · the switch: which databases show the new grid (NotionGridV2) — per viewer, per database, in this
 * browser only (a beta convenience; the old grid stays the default everywhere until GRID-REPLACE-4 flips it).
 */
import { useCallback, useEffect, useState } from 'react';

const KEY = 'coral.gridV2.databases';
const EVENT = 'coral-grid-v2-changed';

function read(): string[] {
    try { const v = JSON.parse(window.localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}

export function useGridV2(databaseId: string | undefined): [boolean, (on: boolean) => void] {
    const [on, setOn] = useState(false);
    useEffect(() => {
        const sync = () => setOn(!!databaseId && read().includes(databaseId));
        sync();
        window.addEventListener(EVENT, sync);
        return () => window.removeEventListener(EVENT, sync);
    }, [databaseId]);
    const set = useCallback((next: boolean) => {
        if (!databaseId) return;
        try {
            const ids = new Set(read());
            if (next) ids.add(databaseId); else ids.delete(databaseId);
            window.localStorage.setItem(KEY, JSON.stringify([...ids]));
        } catch { /* storage unavailable — the switch simply does not stick */ }
        window.dispatchEvent(new Event(EVENT));
    }, [databaseId]);
    return [on, set];
}
