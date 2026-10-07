/**
 * Shared color styling mapping for single-select and multi-select option badges.
 */
export const COLOR_STYLES: Record<string, { badge: string; dot: string }> = {
    yellow:   { badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',   dot: 'bg-amber-400' },
    blue:     { badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',       dot: 'bg-blue-500' },
    green:    { badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200', dot: 'bg-emerald-500' },
    red:      { badge: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',           dot: 'bg-red-500' },
    gray:     { badge: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400', dot: 'bg-neutral-400' },
    purple:   { badge: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200', dot: 'bg-purple-500' },
    pink:     { badge: 'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-200',       dot: 'bg-pink-500' },
    orange:   { badge: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200', dot: 'bg-orange-400' },
    brown:    { badge: 'bg-amber-900/10 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200', dot: 'bg-amber-800' },
    charcoal: { badge: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-200',      dot: 'bg-zinc-500' },
    default:  { badge: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400', dot: 'bg-neutral-400' },
};
