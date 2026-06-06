"use client";

import { useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";

/**
 * VersionWatcher — detects when a newer deployment is live and prompts the user to reload.
 *
 * How it works:
 * 1. At build time, NEXT_PUBLIC_APP_VERSION is baked into the client bundle (= VERCEL_GIT_COMMIT_SHA).
 * 2. This component periodically fetches GET /api/version (force-dynamic, no-store) to get the
 *    CURRENTLY-deployed server's SHA.
 * 3. On mismatch → shows a persistent toast: "New version available — Reload".
 *
 * Triggers: every 3 minutes, on window focus, and on route change.
 * Throttle: skips check if last check was <60s ago.
 */

const BAKED_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "dev";
const CHECK_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes
const THROTTLE_MS = 60 * 1000; // 60 seconds

export default function VersionWatcher() {
    const pathname = usePathname();
    const lastCheckRef = useRef(0);
    const mismatchDetectedRef = useRef(false);
    const toastIdRef = useRef<string | number | undefined>(undefined);

    const checkVersion = useCallback(async () => {
        // Don't re-check if already detected mismatch (toast is showing)
        if (mismatchDetectedRef.current) return;

        // Throttle: skip if checked recently
        const now = Date.now();
        if (now - lastCheckRef.current < THROTTLE_MS) return;
        lastCheckRef.current = now;

        // In dev mode, skip (both sides are 'dev')
        if (BAKED_VERSION === "dev") return;

        try {
            const res = await fetch("/api/version", {
                cache: "no-store",
                headers: { "Cache-Control": "no-cache" },
            });
            if (!res.ok) return;

            const data = await res.json();
            const serverVersion = data.version;

            if (serverVersion && serverVersion !== BAKED_VERSION) {
                mismatchDetectedRef.current = true;
                console.log(
                    `[VersionWatcher] Stale client detected: client=${BAKED_VERSION.slice(0, 7)} server=${serverVersion.slice(0, 7)}`
                );

                toastIdRef.current = toast("Nieuwe versie beschikbaar", {
                    description: "Herlaad om de laatste versie te gebruiken.",
                    duration: Infinity,
                    action: {
                        label: "Herladen",
                        onClick: () => window.location.reload(),
                    },
                    // Keep it persistent — don't auto-dismiss
                    dismissible: false,
                });
            }
        } catch {
            // Network error — silently skip
        }
    }, []);

    // Interval check (every 3 min)
    useEffect(() => {
        const interval = setInterval(checkVersion, CHECK_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [checkVersion]);

    // Check on window focus
    useEffect(() => {
        const handleFocus = () => checkVersion();
        window.addEventListener("focus", handleFocus);
        return () => window.removeEventListener("focus", handleFocus);
    }, [checkVersion]);

    // Check on route change
    useEffect(() => {
        checkVersion();
    }, [pathname, checkVersion]);

    // Initial check on mount (after a short delay to not block render)
    useEffect(() => {
        const timer = setTimeout(checkVersion, 5000);
        return () => clearTimeout(timer);
    }, [checkVersion]);

    return null; // Invisible component
}
