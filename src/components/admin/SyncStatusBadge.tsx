"use client";

import { useEffect, useState } from 'react';
import { useDatabaseStore } from '@/components/admin/database/store';
import { Loader2, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

export default function SyncStatusBadge() {
    const syncStatus = useDatabaseStore(s => s.syncStatus);
    const pendingSyncs = useDatabaseStore(s => s.pendingSyncs);
    const [showSaved, setShowSaved] = useState(false);

    useEffect(() => {
        if (syncStatus === 'idle' && showSaved === false) return;
        if (syncStatus === 'idle') {
            // Just transitioned to idle — briefly show "Saved"
            setShowSaved(true);
            const t = setTimeout(() => setShowSaved(false), 2500);
            return () => clearTimeout(t);
        }
    }, [syncStatus]);

    if (syncStatus === 'idle' && !showSaved) return null;

    return (
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all ${
            syncStatus === 'saving'
                ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                : syncStatus === 'error'
                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
        }`}>
            {syncStatus === 'saving' && (
                <><Loader2 className="w-3 h-3 animate-spin" /> Saving…</>
            )}
            {syncStatus === 'error' && (
                <><AlertCircle className="w-3 h-3" /> Sync error</>
            )}
            {syncStatus === 'idle' && showSaved && (
                <><CheckCircle className="w-3 h-3" /> Saved</>
            )}
        </div>
    );
}
