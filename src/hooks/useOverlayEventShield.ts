'use client';

import { useEffect, RefObject } from 'react';

const SHIELDED_EVENTS = [
    'paste',
    'copy',
    'cut',
    'keydown',
    'contextmenu',
    'mousedown',
    'mousemove',
    'mouseup'
] as const;

/**
 * useOverlayEventShield
 * 
 * Prevents third-party global document listeners (specifically react-datasheet-grid's
 * useDocumentEventListener) from intercepting clipboard, keyboard, and mouse events
 * while a modal overlay is mounted.
 * 
 * Invariants:
 * 1. Never calls preventDefault() — native browser clipboard and input behavior must work.
 * 2. Never calls stopPropagation() in capture phase if target is inside the overlay.
 * 3. Stops stray events outside the overlay in capture phase before reaching document bubble listeners.
 * 4. Stops events inside the overlay at the root boundary in bubble phase.
 */
export function useOverlayEventShield(
    rootRef: RefObject<HTMLElement | null>,
    enabled: boolean = true
) {
    useEffect(() => {
        if (!enabled) return;
        const root = rootRef.current;
        if (!root) return;

        // 1. Bubble-phase stopPropagation on the overlay root:
        // The event reaches its real target inside the overlay (focused input),
        // then stops at the overlay root boundary so it never bubbles to document.
        const handleBubble = (e: Event) => {
            e.stopPropagation();
        };

        // 2. Capture-phase guard on document for events originating outside the overlay:
        // (e.g. focus momentarily on body).
        // If event originates inside root, do NOT stop it here (capture runs before descent).
        const handleCapture = (e: Event) => {
            if (root.contains(e.target as Node)) return;
            e.stopPropagation();
        };

        for (const type of SHIELDED_EVENTS) {
            root.addEventListener(type, handleBubble);
            document.addEventListener(type, handleCapture, true);
        }

        return () => {
            for (const type of SHIELDED_EVENTS) {
                root.removeEventListener(type, handleBubble);
                document.removeEventListener(type, handleCapture, true);
            }
        };
    }, [rootRef, enabled]);
}
