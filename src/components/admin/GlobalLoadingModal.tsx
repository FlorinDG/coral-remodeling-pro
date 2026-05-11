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
                <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/5 dark:bg-black/20 backdrop-blur-[2px] pointer-events-none">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 10 }}
                        transition={{ type: "spring", damping: 20, stiffness: 300 }}
                        className="w-[25vw] h-[25vh] min-w-[280px] min-h-[220px] bg-white dark:bg-neutral-900 rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] border border-neutral-200 dark:border-white/10 flex flex-col items-center justify-center p-8 relative overflow-hidden pointer-events-auto"
                    >
                        {/* Decorative background glow */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-orange-500/10 dark:bg-orange-500/5 blur-[40px] rounded-full pointer-events-none" />
                        
                        <div className="relative mb-6">
                            <div className="w-20 h-20 rounded-[2rem] bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center border border-orange-100 dark:border-orange-900/50">
                                <Loader2 className="w-10 h-10 text-orange-600 dark:text-orange-500 animate-spin" />
                            </div>
                            <motion.div
                                animate={{ 
                                    scale: [1, 1.2, 1],
                                    opacity: [1, 0.8, 1]
                                }}
                                transition={{ repeat: Infinity, duration: 2 }}
                                className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-white dark:bg-neutral-900 shadow-lg border border-neutral-100 dark:border-white/10 flex items-center justify-center"
                            >
                                <Sparkles className="w-5 h-5 text-amber-500" />
                            </motion.div>
                        </div>

                        <div className="text-center relative z-10">
                            <h3 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-tighter">
                                Neural Lexing Logic
                            </h3>
                            <div className="flex flex-col items-center gap-1 mt-2">
                                <div className="flex gap-1">
                                    {[0, 1, 2].map((i) => (
                                        <motion.div
                                            key={i}
                                            animate={{ opacity: [0.3, 1, 0.3] }}
                                            transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.2 }}
                                            className="w-1 h-1 rounded-full bg-orange-500"
                                        />
                                    ))}
                                </div>
                                <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em]">
                                    Synchronizing Clusters
                                </p>
                            </div>
                        </div>

                        {/* Progress bar at the bottom */}
                        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-neutral-100 dark:bg-white/5">
                            <motion.div 
                                className="h-full bg-gradient-to-r from-orange-500 to-amber-500"
                                animate={{ 
                                    x: ["-100%", "100%"],
                                }}
                                transition={{ 
                                    repeat: Infinity, 
                                    duration: 1.5,
                                    ease: "easeInOut"
                                }}
                                style={{ width: "40%" }}
                            />
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
