import { PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';

/**
 * Shared dnd-kit sensors configuration for the entire app.
 * This fixes mobile drag-and-drop by using a long-press TouchSensor
 * so that normal swipes/scrolls are not intercepted by the draggables.
 */
export function useAppDndSensors() {
    const pointerSensor = useSensor(PointerSensor, {
        activationConstraint: {
            distance: 5, // 5px drag distance to activate pointer drag
        },
    });
    
    const touchSensor = useSensor(TouchSensor, {
        activationConstraint: {
            delay: 200,      // 200ms long press to activate
            tolerance: 8,    // 8px movement tolerance during long press
        },
    });

    const keyboardSensor = useSensor(KeyboardSensor);

    return useSensors(pointerSensor, touchSensor, keyboardSensor);
}
