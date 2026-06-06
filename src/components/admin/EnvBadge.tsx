"use client";

/**
 * EnvBadge — shows environment + short SHA in a small fixed badge.
 * Visible only to superadmin role or non-production environments.
 * Helps answer "which build am I on?" at a glance.
 */

import { useSession } from "next-auth/react";

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "dev";
const ENVIRONMENT = process.env.NODE_ENV;

export default function EnvBadge() {
    const { data: session } = useSession();
    const userRole = (session?.user as any)?.role;

    // Only show for superadmin or non-production
    const isSuperadmin = userRole === "SUPERADMIN" || userRole === "TENANT_MANAGER";
    const isProduction = ENVIRONMENT === "production";

    if (isProduction && !isSuperadmin) return null;

    const shortSha = APP_VERSION === "dev" ? "dev" : APP_VERSION.slice(0, 7);
    const envLabel = isProduction ? "prod" : ENVIRONMENT === "development" ? "local" : "preview";

    return (
        <div
            className="fixed bottom-2 left-2 z-[9999] px-2 py-0.5 rounded-md text-[9px] font-mono font-bold tracking-wider opacity-30 hover:opacity-90 transition-opacity select-none pointer-events-auto cursor-default bg-neutral-900 dark:bg-white text-white dark:text-black border border-neutral-700 dark:border-neutral-300"
            title={`Build: ${APP_VERSION}\nEnvironment: ${ENVIRONMENT}`}
        >
            {envLabel} · {shortSha}
        </div>
    );
}
