"use client";

import { useLayoutEffect } from "react";
import { useDatabaseStore } from "./store";

/**
 * CACHE-OWNER-1 · tells the store WHO is signed in, before any screen reads it or fetches through it.
 * Rendered by the shell outside <Suspense>, ahead of the screens: its layout effect runs before theirs and before
 * any passive effect (a fetch). The streamed loader (DatabaseBootstrap) arrives later; until this ran, a browser copy
 * restored from storage waits (store.ts deferredCopy) and is applied only to its own tenant and user.
 */
export default function StoreSession({ tenantId, userId }: { tenantId: string; userId: string | null | undefined }) {
    useLayoutEffect(() => {
        if (tenantId && userId) useDatabaseStore.getState().setSession(tenantId, userId);
    }, [tenantId, userId]);
    return null;
}
