/**
 * The ONE cross-tenant identity question (R1-7-B1 STOP 1, decided by the Planner 2026-10-05): a login e-mail is
 * unique across the whole platform, so "is this e-mail already used?" must see every tenant. It goes through the
 * named platform door (D4) and answers with the user id ONLY — never the row (no other tenant's data leaves here).
 * Everything else about users is asked on the session's scoped client.
 */
import { platformDb } from '@/lib/data/scope';

export async function emailOwner(email: string): Promise<{ id: string } | null> {
    if (!email) return null;
    return platformDb().user.findUnique({ where: { email }, select: { id: true } });
}
