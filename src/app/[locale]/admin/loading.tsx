// Shown during Next.js build transitions and slow server renders.
// Prevents the raw 404 that appears mid-deploy before the new bundle is ready.
export default function AdminLoading() {
    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/60 dark:bg-black/60 backdrop-blur-md transition-all duration-300">
            <div className="flex flex-col items-center gap-6">
                <div className="relative">
                    <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[var(--brand-color,#d35400)] to-orange-600 animate-spin [animation-duration:3s]" />
                    <div className="absolute inset-0 w-16 h-16 rounded-3xl bg-gradient-to-br from-[var(--brand-color,#d35400)] to-orange-600 blur-xl opacity-50 animate-pulse" />
                </div>
                <div className="flex flex-col items-center gap-2">
                    <p className="text-neutral-900 dark:text-white text-base font-bold tracking-tight">CoralOS</p>
                    <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-bounce [animation-delay:-0.3s]" />
                        <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-bounce [animation-delay:-0.15s]" />
                        <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-bounce" />
                    </div>
                </div>
            </div>
        </div>
    );
}
