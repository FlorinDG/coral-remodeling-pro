import { useEffect } from 'react';

const RESET_KEY = 'tasks-my-day-reset-date';

/**
 * On mount, checks if we have passed midnight since the last My Day reset.
 * If so, calls the provided reset callback (which should clear My Day flags
 * on all completed tasks via the database store).
 */
export function useMyDayReset(onReset: () => void) {
    useEffect(() => {
        const today = new Date().toISOString().slice(0, 10);
        const last = localStorage.getItem(RESET_KEY);
        if (last !== today) {
            localStorage.setItem(RESET_KEY, today);
            onReset();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // intentionally run once on mount only
}
