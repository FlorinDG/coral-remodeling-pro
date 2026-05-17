'use client';

import { useEffect, useRef } from 'react';
import { Page } from '@/components/admin/database/types';

interface MenuItem {
    label: string;
    icon?: string;
    action: () => void;
    danger?: boolean;
    divider?: boolean;
}

interface TaskContextMenuProps {
    page: Page;
    x: number;
    y: number;
    onClose: () => void;
    onSetPriority: (page: Page, p: string) => void;
    onSetDue: (page: Page) => void;
    onSetDefer: (page: Page) => void;
    onToggleMyDay: (page: Page) => void;
    onToggleFlag: (page: Page) => void;
    onDuplicate: (page: Page) => void;
    onDelete: (page: Page) => void;
}

export function TaskContextMenu({
    page, x, y, onClose,
    onSetPriority, onSetDue, onSetDefer,
    onToggleMyDay, onToggleFlag,
    onDuplicate, onDelete,
}: TaskContextMenuProps) {
    const ref = useRef<HTMLDivElement>(null);
    const myDay   = page.properties['prop-task-my-day']  as boolean;
    const flagged  = page.properties['prop-task-flagged'] as boolean;

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('mousedown', handler);
        document.addEventListener('keydown', keyHandler);
        return () => {
            document.removeEventListener('mousedown', handler);
            document.removeEventListener('keydown', keyHandler);
        };
    }, [onClose]);

    // Adjust position if too close to edge
    const style: React.CSSProperties = {
        position: 'fixed',
        zIndex: 9999,
        top: Math.min(y, window.innerHeight - 320),
        left: Math.min(x, window.innerWidth - 220),
    };

    const Item = ({ label, icon, action, danger, divider }: MenuItem) => (
        <>
            {divider && <div className="my-1 border-t border-neutral-100 dark:border-white/10" />}
            <button
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left rounded transition-colors
                    ${danger
                        ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
                        : 'text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-white/10'
                    }`}
                onClick={() => { action(); onClose(); }}
            >
                {icon && <span className="w-4 text-center text-xs">{icon}</span>}
                {label}
            </button>
        </>
    );

    return (
        <div
            ref={ref}
            style={style}
            className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-xl shadow-xl p-1.5 min-w-[200px]"
        >
            {/* Priority */}
            <div className="px-3 py-1 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Priority</div>
            {[
                { id: 'opt-p1', label: 'P1 — Urgent',  color: '#ef4444' },
                { id: 'opt-p2', label: 'P2 — High',    color: '#f97316' },
                { id: 'opt-p3', label: 'P3 — Medium',  color: '#eab308' },
                { id: 'opt-p4', label: 'P4 — Low',     color: '#9ca3af' },
            ].map(p => (
                <button
                    key={p.id}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left rounded hover:bg-neutral-100 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-200 transition-colors"
                    onClick={() => { onSetPriority(page, p.id); onClose(); }}
                >
                    <span className="text-xs font-bold" style={{ color: p.color }}>●</span>
                    {p.label}
                </button>
            ))}

            <Item label="Set Due Date" icon="📅" action={() => onSetDue(page)} divider />
            <Item label="Defer Until…"  icon="💤" action={() => onSetDefer(page)} />
            <Item label={myDay   ? 'Remove from My Day' : 'Add to My Day'} icon="☀" action={() => onToggleMyDay(page)}  divider />
            <Item label={flagged ? 'Unflag'              : 'Flag'}          icon="🚩" action={() => onToggleFlag(page)}  />
            <Item label="Duplicate" icon="⎘" action={() => onDuplicate(page)} divider />
            <Item label="Delete"    icon="🗑" action={() => onDelete(page)}    danger />
        </div>
    );
}
