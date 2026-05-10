// Non-blocking loading indicator — keeps sidebar and layout visible for UX consistency.
// Shows a thin animated progress bar at the top + subtle centered spinner.
export default function AdminLoading() {
    return (
        <>
            {/* Top progress bar */}
            <div className="fixed top-0 left-0 right-0 z-50 h-1 overflow-hidden">
                <div
                    className="h-full rounded-r-full animate-pulse"
                    style={{
                        background: 'linear-gradient(90deg, transparent, var(--brand-color, #d35400), transparent)',
                        animation: 'loading-slide 1.5s ease-in-out infinite',
                    }}
                />
            </div>

            {/* Centered subtle spinner — no backdrop, no blocking */}
            <div className="flex items-center justify-center w-full h-[60vh] pointer-events-none">
                <div className="flex flex-col items-center gap-3 opacity-60">
                    <div
                        className="w-8 h-8 rounded-full border-2 border-neutral-300 dark:border-neutral-700 animate-spin"
                        style={{ borderTopColor: 'var(--brand-color, #d35400)' }}
                    />
                </div>
            </div>

            <style>{`
                @keyframes loading-slide {
                    0% { transform: translateX(-100%); width: 40%; }
                    50% { transform: translateX(60%); width: 60%; }
                    100% { transform: translateX(200%); width: 40%; }
                }
            `}</style>
        </>
    );
}
