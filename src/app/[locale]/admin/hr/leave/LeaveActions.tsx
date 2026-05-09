"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function LeaveActions({ requestId }: { requestId: string }) {
    const router = useRouter();
    const [loading, setLoading] = useState<'approve' | 'deny' | null>(null);

    const handleAction = async (action: 'approve' | 'deny') => {
        setLoading(action);
        try {
            const status = action === 'approve' ? 'approved' : 'denied';
            const res = await fetch(`/api/hr/time-off?id=${requestId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(err.error || `Failed to ${action} request`);
            }

            toast.success(`Leave request ${status}`);
            router.refresh(); // Re-fetch server data
        } catch (err: any) {
            toast.error(err.message || `Failed to ${action} request`);
        } finally {
            setLoading(null);
        }
    };

    return (
        <div className="flex items-center gap-2 justify-end">
            <button
                onClick={() => handleAction('approve')}
                disabled={loading !== null}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-500/30 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors disabled:opacity-50"
            >
                {loading === 'approve' ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                Approve
            </button>
            <button
                onClick={() => handleAction('deny')}
                disabled={loading !== null}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-50"
            >
                {loading === 'deny' ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                Deny
            </button>
        </div>
    );
}
