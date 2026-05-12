"use client";

import { useDatabaseStore } from "@/components/admin/database/store";
import { Loader2, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * GlobalLoadingModal - A compact, non-intrusive loading modal that provides
 * visual feedback during background processes (like DB synchronization).
 * Occupies 25% of screen height and width as requested.
 */
export default function GlobalLoadingModal() {
    const syncStatus = useDatabaseStore(s => s.syncStatus);
    // Only show for 'saving' state. 'idle' and 'error' handled by SyncStatusBadge.
    const isLoading = syncStatus === 'saving';

    return (
        <AnimatePresence>
            {isLoading && (
                <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/5 dark:bg-black/20 pointer-events-none">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 10 }}
                        transition={{ type: "spring", damping: 20, stiffness: 300 }}
                        className="w-[25vw] h-[25vh] min-w-[280px] min-h-[220px] bg-white dark:bg-neutral-900 rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] border border-neutral-200 dark:border-white/10 flex flex-col items-center justify-center p-8 relative overflow-hidden pointer-events-auto"
                    >
                        <Loader2 className="w-12 h-12 text-orange-600 dark:text-orange-500 animate-spin mb-6" />

                        <motion.h3 
                            animate={{ opacity: [0.5, 1, 0.5] }}
                            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                            className="text-lg font-black text-neutral-900 dark:text-white uppercase tracking-widest"
                        >
                            CoralOS
                        </motion.h3>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
