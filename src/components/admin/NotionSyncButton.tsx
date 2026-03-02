'use client';

import { useState } from 'react';
import { RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

export default function NotionSyncButton({
    endpoint = '/api/notion/sync',
    label = 'Sync Now'
}: {
    endpoint?: string;
    label?: string;
}) {
    const [status, setStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');

    const handleSync = async () => {
        setStatus('syncing');
        try {
            const response = await fetch(endpoint, { method: 'POST' });
            const data = await response.json();

            if (data.success) {
                setStatus('success');
                setMessage(data.message);
                setTimeout(() => setStatus('idle'), 5000);
            } else {
                setStatus('error');
                setMessage(data.error || 'Failed to sync');
            }
        } catch (err) {
            setStatus('error');
            setMessage('Network error');
        }
    };

    return (
        <div className="flex flex-col items-center gap-2">
            <button
                onClick={handleSync}
                disabled={status === 'syncing'}
                className={`flex items-center gap-2 px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${status === 'syncing'
                    ? 'bg-neutral-400 cursor-not-allowed'
                    : status === 'success'
                        ? 'bg-green-500 text-white'
                        : status === 'error'
                            ? 'bg-red-500 text-white'
                            : 'bg-neutral-900 dark:bg-white dark:text-black hover:bg-[#d35400] dark:hover:bg-[#d35400] dark:hover:text-white'
                    }`}
            >
                {status === 'syncing' ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                ) : status === 'success' ? (
                    <CheckCircle2 className="w-3 h-3" />
                ) : status === 'error' ? (
                    <AlertCircle className="w-3 h-3" />
                ) : (
                    <RefreshCw className="w-3 h-3" />
                )}
                {status === 'syncing' ? 'Syncing...' : status === 'success' ? 'Synced!' : status === 'error' ? 'Error' : label}
            </button>
            {message && (
                <p className={`text-[10px] font-medium ${status === 'error' ? 'text-red-500' : 'text-green-500'}`}>
                    {message}
                </p>
            )}
        </div>
    );
}
