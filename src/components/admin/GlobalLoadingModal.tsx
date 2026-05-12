"use client";

import { useDatabaseStore } from "@/components/admin/database/store";
import { Loader2, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * GlobalLoadingModal - A minimal, non-intrusive sync indicator in the corner.
 * Replaces the intrusive full-screen modal that triggered on every DB update.
 */
export default function GlobalLoadingModal() {
    const syncStatus = useDatabaseStore(s => s.syncStatus);
    const isLoading = syncStatus === 'saving';

    return (
        <AnimatePresence>
            {isLoading && (
                <motion.div 
                    initial={{ opacity: 0, y: 20, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.9 }}
                    className="fixed bottom-6 right-6 z-[100000] pointer-events-none"
                >
                    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 shadow-2xl rounded-2xl px-4 py-2.5 flex items-center gap-3 backdrop-blur-xl">
                        <Loader2 className="w-4 h-4 text-orange-600 dark:text-orange-500 animate-spin" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-neutral-900 dark:text-white">
                            Syncing...
                        </span>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
