'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertOctagon, RefreshCw, LayoutDashboard, ChevronDown, ChevronUp, Terminal } from 'lucide-react';

export default function AdminError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const router = useRouter();
    const [showDiagnostics, setShowDiagnostics] = useState(false);

    useEffect(() => {
        // Detailed console tracking for administrative audits
        console.error('[CoralOS Admin Exception Boundary]', error);
    }, [error]);

    const handleBackToDashboard = () => {
        router.push('/admin/dashboard');
        // Small delay followed by forced reload to clear memory/state leaks
        setTimeout(() => {
            window.location.reload();
        }, 150);
    };

    return (
        <div className="min-h-screen relative flex items-center justify-center p-6 overflow-hidden bg-neutral-50 dark:bg-neutral-950 transition-colors duration-300">
            
            {/* Soft, beautiful organic ambient glows */}
            <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[35rem] h-[35rem] rounded-full bg-gradient-to-tr from-orange-500/20 to-amber-500/10 blur-[120px] pointer-events-none animate-pulse duration-[10s]" />
            <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[30rem] h-[30rem] rounded-full bg-gradient-to-br from-red-500/10 to-orange-500/15 blur-[100px] pointer-events-none animate-pulse duration-[8s]" />

            {/* Glassmorphic Panel Container */}
            <div className="relative max-w-xl w-full backdrop-blur-xl bg-white/70 dark:bg-neutral-900/70 border border-white/40 dark:border-white/10 rounded-3xl p-8 sm:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex flex-col items-center gap-6 z-10 transition-all duration-300 hover:scale-[1.005] hover:border-orange-500/25">
                
                {/* Glowing Badge Icon */}
                <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-tr from-orange-500 to-red-500 flex items-center justify-center shadow-lg shadow-orange-500/30 dark:shadow-orange-500/10 animate-bounce duration-[3s]">
                    <AlertOctagon className="w-8 h-8 text-white stroke-[2]" />
                    <span className="absolute -inset-1.5 rounded-2xl border border-orange-500/30 animate-ping opacity-60 pointer-events-none" />
                </div>

                {/* Localized Headings */}
                <div className="text-center space-y-3">
                    <h2 className="text-2xl font-black tracking-tight text-neutral-900 dark:text-white bg-clip-text bg-gradient-to-r from-neutral-900 via-orange-950 to-neutral-900 dark:from-white dark:via-orange-200 dark:to-white">
                        Er is iets misgegaan
                    </h2>
                    <p className="text-neutral-600 dark:text-neutral-400 text-sm sm:text-[14.5px] leading-relaxed max-w-md mx-auto">
                        CoralOS heeft een onverwachte fout vastgesteld. Geen zorgen, uw gegevens zijn veilig. 
                        Probeer de pagina opnieuw te laden, of keer direct terug naar het dashboard.
                    </p>
                    {error.digest && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-white/5 border border-neutral-200/50 dark:border-white/5 text-[10px] font-mono text-neutral-500 dark:text-neutral-500">
                            <span>ID:</span>
                            <span className="font-bold">{error.digest}</span>
                        </div>
                    )}
                </div>

                {/* Primary/Secondary CTA Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 w-full mt-2">
                    <button
                        onClick={reset}
                        className="flex-1 inline-flex items-center justify-center gap-2 text-white font-bold text-sm px-6 py-3 rounded-2xl transition-all shadow-md active:scale-[0.98] hover:shadow-lg hover:shadow-orange-500/10"
                        style={{ backgroundColor: 'var(--brand-color, #d35400)' }}
                    >
                        <RefreshCw className="w-4 h-4" />
                        Probeer opnieuw
                    </button>
                    <button
                        onClick={handleBackToDashboard}
                        className="flex-1 inline-flex items-center justify-center gap-2 bg-neutral-200/80 hover:bg-neutral-200 dark:bg-white/5 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-200 font-bold text-sm px-6 py-3 rounded-2xl transition-all border border-neutral-300/30 dark:border-white/5 active:scale-[0.98]"
                    >
                        <LayoutDashboard className="w-4 h-4" />
                        Naar dashboard
                    </button>
                </div>

                {/* Debugging Disclosure Drawer */}
                <div className="w-full border-t border-neutral-200/60 dark:border-white/5 pt-4 mt-2">
                    <button
                        onClick={() => setShowDiagnostics(v => !v)}
                        className="flex items-center justify-between w-full text-xs font-bold text-neutral-500 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-300 transition-colors uppercase tracking-wider"
                    >
                        <span className="flex items-center gap-1.5">
                            <Terminal className="w-3.5 h-3.5 text-neutral-400" />
                            Diagnostische gegevens
                        </span>
                        {showDiagnostics ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    {showDiagnostics && (
                        <div className="mt-3 p-4 rounded-2xl bg-neutral-900 text-neutral-200 font-mono text-[11px] overflow-x-auto max-h-48 border border-neutral-800 animate-in slide-in-from-top-2 duration-200">
                            <p className="text-red-400 font-bold mb-1">
                                {error.name || 'Error'}: {error.message || 'Geen foutmelding beschikbaar'}
                            </p>
                            {error.stack && (
                                <pre className="text-neutral-500 leading-relaxed whitespace-pre-wrap mt-2 overflow-y-auto">
                                    {error.stack}
                                </pre>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
