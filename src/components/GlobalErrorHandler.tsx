'use client';

import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslations } from 'next-intl';

export function GlobalErrorHandler() {
    const t = useTranslations('Errors');
    const [isRetrying, setIsRetrying] = useState(false);
    const [toastId, setToastId] = useState<string | null>(null);

    useEffect(() => {
        const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
            const error = event.reason;
            
            // Only intercept transient network errors
            const isNetworkError = 
                error?.name === 'TypeError' || 
                error?.message?.toLowerCase().includes('fetch') || 
                error?.message?.toLowerCase().includes('load failed') ||
                error?.name === 'NetworkError' ||
                error?.name === 'AbortError';

            if (isNetworkError) {
                // Prevent crash
                event.preventDefault();

                if (!isRetrying) {
                    setIsRetrying(true);
                    const id = toast.loading(t('connectionLostRetrying', { fallback: 'Connection lost — retrying...' }));
                    setToastId(id);
                    
                    // Clear state after a reasonable retry window (e.g. 5 seconds)
                    setTimeout(() => {
                        toast.dismiss(id);
                        setIsRetrying(false);
                        setToastId(null);
                    }, 5000);
                }
            } else {
                // Let other unhandled rejections propagate and log them loudly
                console.error('[GlobalErrorHandler] Unhandled Promise Rejection:', error);
            }
        };

        window.addEventListener('unhandledrejection', handleUnhandledRejection);

        return () => {
            window.removeEventListener('unhandledrejection', handleUnhandledRejection);
            if (toastId) toast.dismiss(toastId);
        };
    }, [t, isRetrying, toastId]);

    return null;
}
