/**
 * Canonical Z-Index Scale for Mobile Surfaces
 * 
 * Hierarchy:
 * - Base content: z-0
 * - Shell chrome (sticky header, fixed bottom nav): z-40
 * - Modals / Overlays / BottomSheets / FileViewers: z-60
 * - Toasts / Alerts / Floating notifications: z-80
 */
export const Z_INDEX = {
    CHROME: 'z-40',
    OVERLAY: 'z-60',
    TOAST: 'z-80',
} as const;
