// Shown during Next.js build transitions and slow server renders.
// Prevents the raw 404 that appears mid-deploy before the new bundle is ready.
export default function AdminLoading() {
    return (
        <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 animate-pulse" />
                <p className="text-neutral-400 text-sm font-medium tracking-wide">Loading CoralOS…</p>
            </div>
        </div>
    );
}
