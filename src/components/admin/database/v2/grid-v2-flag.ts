'use client';
/**
 * GRID-REPLACE-4 (Florin 2026-10-05: "one grid to rule them all… we only need one") · the new grid (NotionGridV2) is
 * the DEFAULT for everyone. For one week anyone may fall back to the old grid on a database — per viewer, per
 * database, in this browser only. GRID-REPLACE-5 deletes the old grid, this switch with it.
 */
import { useCallback, useEffect, useState } from 'react';

const KEY = 'coral.gridV1.databases';          // databases where this viewer chose the OLD grid
const EVENT = 'coral-grid-v1-changed';

function read(): string[] {
    try { const v = JSON.parse(window.localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}

/** [old grid chosen on this database, choose it / leave it]. Default: false — the new grid. */
export function useOldGrid(databaseId: string | undefined): [boolean, (on: boolean) => void] {
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
        } catch { /* storage unavailable — the choice simply does not stick */ }
        window.dispatchEvent(new Event(EVENT));
    }, [databaseId]);
    return [on, set];
}
