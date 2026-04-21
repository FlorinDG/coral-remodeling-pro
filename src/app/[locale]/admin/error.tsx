'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function AdminError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log to console — replace with your error tracking service (Sentry etc.) here
        console.error('[AdminError boundary]', error);
    }, [error]);

    return (
        <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-2xl p-8 flex flex-col items-center gap-5 shadow-2xl">
                <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    </svg>
                </div>
                <div className="text-center">
                    <h2 className="text-white font-bold text-lg mb-1">Something went wrong</h2>
                    <p className="text-neutral-400 text-sm leading-relaxed">
                        CoralOS encountered an unexpected error. Your data is safe.
                        Try refreshing — if the issue persists, contact support.
                    </p>
                    {error.digest && (
                        <p className="text-neutral-600 text-xs mt-2 font-mono">ref: {error.digest}</p>
                    )}
                </div>
                <div className="flex gap-3 w-full">
                    <button
                        onClick={reset}
                        className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
                    >
                        Try again
                    </button>
                    <Link
                        href="/admin/dashboard"
                        className="flex-1 text-center bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-sm font-semibold py-2.5 rounded-xl transition-colors"
                    >
                        Go to dashboard
                    </Link>
                </div>
            </div>
        </div>
    );
}
