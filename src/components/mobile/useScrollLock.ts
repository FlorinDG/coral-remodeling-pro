'use client';

import { useEffect } from 'react';

/**
 * Resolves the nearest scrollable ancestor for a given element,
 * walking up until an element with overflow-y 'auto' or 'scroll' is found.
 * Falls back to document.body if none is found.
 */
function getNearestScrollableAncestor(el: HTMLElement | null): HTMLElement {
    if (typeof window === 'undefined') return {} as HTMLElement;

    let current: HTMLElement | null = el?.parentElement || null;
    while (current && current !== document.body && current !== document.documentElement) {
        const style = window.getComputedStyle(current);
        const overflowY = style.overflowY;
        if (overflowY === 'auto' || overflowY === 'scroll') {
            return current;
        }
        current = current.parentElement;
    }

    // Fallback search for <main> if element is rendered directly or detached
    const mainEl = document.querySelector('main');
    if (mainEl) {
        const style = window.getComputedStyle(mainEl);
        if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
            return mainEl as HTMLElement;
        }
    }

    return document.body;
}

/**
 * TASK-M16: Single canonical scroll lock hook for the mobile app.
 * - Locks the nearest scrollable ancestor (e.g. <main>), not document.body by assumption.
 * - Saves and restores exact previous inline overflow styles.
 * - Preserves scroll position without jumping to top.
 * - Reference-counted for nested/sequential sheets.
 * - Never sets touch-action: none.
 */
export function useScrollLock(
    isOpen: boolean,
    targetRef?: React.RefObject<HTMLElement | null>
) {
    useEffect(() => {
        if (!isOpen || typeof document === 'undefined') return;

        const target = getNearestScrollableAncestor(targetRef?.current || null);
        if (!target) return;

        const currentLocks = parseInt(target.dataset.scrollLocks || '0', 10);
        if (currentLocks === 0) {
            // Save exact previous inline styles and scroll position
            target.dataset.prevOverflow = target.style.overflow;
            target.dataset.prevOverflowY = target.style.overflowY;
            target.dataset.prevScrollTop = String(target.scrollTop);

            target.style.overflow = 'hidden';
        }
        target.dataset.scrollLocks = String(currentLocks + 1);

        return () => {
            const count = parseInt(target.dataset.scrollLocks || '1', 10) - 1;
            if (count <= 0) {
                // Restore exact previous inline values
                target.style.overflow = target.dataset.prevOverflow || '';
                target.style.overflowY = target.dataset.prevOverflowY || '';

                const savedScrollTop = parseInt(target.dataset.prevScrollTop || '0', 10);
                if (!isNaN(savedScrollTop)) {
                    target.scrollTop = savedScrollTop;
                }

                delete target.dataset.scrollLocks;
                delete target.dataset.prevOverflow;
                delete target.dataset.prevOverflowY;
                delete target.dataset.prevScrollTop;
            } else {
                target.dataset.scrollLocks = String(count);
            }
        };
    }, [isOpen, targetRef]);
}
