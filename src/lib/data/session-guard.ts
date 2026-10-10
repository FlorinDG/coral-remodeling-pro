/**
 * STALE-SESSION-1 · the door: does the session's tenant (or the impersonated one) and user still exist?
 * Two primary-key reads through the platform door (a session check is not tenant data). A failed read answers
 * "unknown" and never ends a session (lib/session-guard staleSessionReason).
 */
import { platformDb } from '@/lib/data/scope';
import { staleSessionReason, type StaleReason } from '@/lib/session-guard';

export async function staleSessionOf(tenantId: string | null | undefined, userId: string | null | undefined, impersonating: boolean): Promise<StaleReason | null> {
    if (!tenantId) return null;
    let tenantFound: boolean | null = null, userFound: boolean | null = null;
    try {
        const [t, u] = await Promise.all([
            platformDb().tenant.findUnique({ where: { id: tenantId }, select: { id: true } }),
            userId ? platformDb().user.findUnique({ where: { id: userId }, select: { id: true } }) : Promise.resolve(undefined),
        ]);
        tenantFound = !!t;
        userFound = userId ? !!u : null;
    } catch (e) {
        console.error('[session-guard] read failed — the session is kept:', e);
    }
    return staleSessionReason({ tenantFound, userFound, impersonating });
}
