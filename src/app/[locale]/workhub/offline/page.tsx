"use client";

export default function OfflinePage() {
    return (
        <div className="min-h-screen bg-neutral-50 dark:bg-black flex items-center justify-center p-6">
            <div className="text-center max-w-md space-y-6">
                <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                    <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728M5.636 18.364a9 9 0 010-12.728" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M8.464 15.536a5 5 0 010-7.072" />
                        <line x1="2" y1="2" x2="22" y2="22" strokeLinecap="round" />
                    </svg>
                </div>
                <h1 className="text-2xl font-black text-neutral-900 dark:text-white">
                    You&apos;re Offline
                </h1>
                <p className="text-neutral-500 dark:text-neutral-400 text-sm">
                    WorkHub needs an internet connection to load your schedule and tasks. 
                    Please check your connection and try again.
                </p>
                <button
                    onClick={() => window.location.reload()}
                    className="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all active:scale-95"
                >
                    Try Again
                </button>
            </div>
        </div>
    );
}
