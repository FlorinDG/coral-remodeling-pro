'use client';

import { useEffect, RefObject } from 'react';

// Events shielded at the overlay root in the bubble phase.
// mousemove is excluded (C8): DSG mousemove is harmless without mousedown and costs a contains check on every move.
const BUBBLE_SHIELDED_EVENTS = [
    'paste',
    'copy',
    'cut',
    'keydown',
    'contextmenu',
    'mousedown',
    'mouseup'
] as const;

// Events guarded on document in the capture phase.
// Strictly narrowed to clipboard events (C6): these misroute to DSG's active cell when focus
// is momentarily astray on body. Mouse and keyboard strays outside the overlay are left untouched
// so external clicks, shortcuts, and click-away handlers descend normally to their targets.
const CAPTURE_GUARDED_EVENTS = [
    'paste',
    'copy',
    'cut'
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
 * 3. Document capture guard handles clipboard events only (paste/copy/cut) when focus is outside overlay.
 * 4. Stops events inside the overlay at the root boundary in bubble phase.
 * 5. Rule: An overlay that adopts this shield MUST register its own document listeners in capture phase (useCapture = true).
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

        // 2. Capture-phase guard on document for clipboard events originating outside the overlay:
        // (e.g. focus momentarily astray on body).
        // If event originates inside root, do NOT stop it here (capture runs before descent).
        const handleCapture = (e: Event) => {
            if (root.contains(e.target as Node)) return;
            e.stopPropagation();
        };

        for (const type of BUBBLE_SHIELDED_EVENTS) {
            root.addEventListener(type, handleBubble);
        }
        for (const type of CAPTURE_GUARDED_EVENTS) {
            document.addEventListener(type, handleCapture, true);
        }

        return () => {
            for (const type of BUBBLE_SHIELDED_EVENTS) {
                root.removeEventListener(type, handleBubble);
            }
            for (const type of CAPTURE_GUARDED_EVENTS) {
                document.removeEventListener(type, handleCapture, true);
            }
        };
    }, [rootRef, enabled]);
}
