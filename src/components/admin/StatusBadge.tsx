import React from 'react';

interface StatusBadgeProps {
    status: string;
}

const statusColors: Record<string, string> = {
    'NEW': 'bg-blue-500/20 text-blue-200 border-blue-500/30',
    'CONTACTED': 'bg-yellow-500/20 text-yellow-200 border-yellow-500/30',
    'CONVERTED': 'bg-green-500/20 text-green-200 border-green-500/30',
    'ARCHIVED': 'bg-neutral-500/20 text-neutral-400 border-neutral-500/30',
    'PENDING': 'bg-yellow-500/20 text-yellow-200 border-yellow-500/30',
    'CONFIRMED': 'bg-green-500/20 text-green-200 border-green-500/30',
    'CANCELLED': 'bg-red-500/20 text-red-200 border-red-500/30',
    'ACTIVE': 'bg-green-500/20 text-green-200 border-green-500/30',
    'COMPLETED': 'bg-neutral-500/20 text-neutral-400 border-neutral-500/30',
};

export default function StatusBadge({ status }: StatusBadgeProps) {
    const colorClass = statusColors[status] || 'bg-white/10 text-white border-white/20';

    return (
        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border ${colorClass}`}>
            {status}
        </span>
    );
}
