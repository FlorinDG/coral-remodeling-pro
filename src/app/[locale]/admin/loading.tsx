// Non-blocking loading indicator — keeps sidebar and layout visible for UX consistency.
// Shows a thin animated progress bar at the top + subtle centered spinner.
// Non-blocking loading indicator — keeps sidebar and layout visible for UX consistency.
// Shows a compact 25% height/width modal design.
export default function AdminLoading() {
    return (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/5 dark:bg-black/20 backdrop-blur-[2px] pointer-events-none">
            <div 
                className="w-[25vw] h-[25vh] min-w-[280px] min-h-[220px] bg-white dark:bg-neutral-900 rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] border border-neutral-200 dark:border-white/10 flex flex-col items-center justify-center p-8 relative overflow-hidden pointer-events-auto"
            >
                {/* Decorative background glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-orange-500/10 dark:bg-orange-500/5 blur-[40px] rounded-full pointer-events-none" />
                
                <div className="relative mb-6">
                    <div className="w-20 h-20 rounded-[2rem] bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center border border-orange-100 dark:border-orange-900/50">
                        <div className="w-10 h-10 border-4 border-orange-200 dark:border-orange-900/50 border-t-orange-600 dark:border-t-orange-500 rounded-full animate-spin" />
                    </div>
                </div>

                <div className="text-center relative z-10">
                    <h3 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-tighter animate-pulse">
                        Neural Lexing Logic
                    </h3>
                    <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em] mt-2">
                        Loading Neural Clusters...
                    </p>
                </div>

                {/* Progress bar at the bottom */}
                <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-neutral-100 dark:bg-white/5">
                    <div 
                        className="h-full bg-gradient-to-r from-orange-500 to-amber-500 animate-loading-slide"
                        style={{ width: "40%" }}
                    />
                </div>
            </div>

            <style>{`
                @keyframes loading-slide {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(250%); }
                }
                .animate-loading-slide {
                    animation: loading-slide 1.5s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
}
