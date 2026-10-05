"use server";
/**
 * WO-4b · the office reads a signed work order's status (number, signer, PDF, sends) — for the shift editor and the
 * hours print. Tenant HR roles only; on the session's scoped client.
 */
import { auth } from '@/auth';
import { isTenantHrRole } from '@/lib/roles';
import { scopeFromSession } from '@/lib/data/scope';
import { readWerkbonStatus } from '@/lib/data/werkbon';
import type { WerkbonStatus } from '@/lib/records/werkbon-status';

export async function getWerkbonStatus(shiftId: string): Promise<{ ok: true; status: WerkbonStatus | null } | { ok: false; error: string }> {
    const s = await auth();
    const tenantId = s?.user?.tenantId;
    if (!tenantId || !isTenantHrRole((s?.user as { role?: string } | undefined)?.role)) return { ok: false, error: 'forbidden' };
    if (!shiftId) return { ok: true, status: null };
    const db = await scopeFromSession();
    return { ok: true, status: await readWerkbonStatus(db, tenantId, shiftId) };
}
