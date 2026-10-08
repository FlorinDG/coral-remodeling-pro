/**
 * SCHED-STATUS-1 · how a shift status LOOKS — one place for the table, the matrix and the editor.
 * The status itself is the kernel's (lib/kernel/shift-status.ts); this file only names and colours it.
 */
import type { ShiftStatus } from '@/lib/kernel/shift-status';

export const SHIFT_STATUS_LABEL: Record<ShiftStatus, string> = {
    scheduled: 'Gepland',
    late: 'Te laat',
    'in-progress': 'Bezig',
    completed: 'Voltooid',
    cancelled: 'Geannuleerd',
};

/** Pill colours (select trigger, badge). */
export const SHIFT_STATUS_PILL: Record<ShiftStatus, string> = {
    scheduled: 'bg-neutral-100 text-neutral-700 dark:bg-white/10 dark:text-neutral-300',
    late: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
    'in-progress': 'bg-[var(--brand-color,#d35400)]/15 text-[var(--brand-color,#d35400)]',
    completed: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
    cancelled: 'bg-neutral-200 text-neutral-500 line-through dark:bg-white/5',
};

/** The matrix card's status dot. */
export const SHIFT_STATUS_DOT: Record<ShiftStatus, string> = {
    scheduled: 'bg-neutral-400',
    late: 'bg-red-500',
    'in-progress': 'bg-[var(--brand-color,#d35400)]',
    completed: 'bg-blue-400',
    cancelled: 'bg-neutral-300',
};
