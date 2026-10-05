"use server";
/**
 * DB-DEF-1 · change a database's definition (fields, views, name) — by operations, on the session's scoped client.
 * Replaces the whole-definition `saveGlobalDatabase` write for existing databases.
 */
import { auth } from '@/auth';
import { isWorkforceRole } from '@/lib/roles';
import { scopeFromSession } from '@/lib/data/scope';
import { applyDatabaseDefinition, type DefinitionResult } from '@/lib/data/database-definition';
import type { DefOp } from '@/lib/records/database-definition';

export async function changeDatabaseDefinition(databaseId: string, ops: DefOp[]): Promise<DefinitionResult | { ok: false; error: 'forbidden' }> {
    const s = await auth();
    const role = (s?.user as { role?: string } | undefined)?.role;
    if (!s?.user?.tenantId || isWorkforceRole(role)) return { ok: false, error: 'forbidden' };
    const db = await scopeFromSession();
    // Superadmin support (also while impersonating a tenant) may retype / delete canonical fields.
    const impersonating = !!(s.user as { isImpersonating?: boolean }).isImpersonating;
    return applyDatabaseDefinition(db, databaseId, ops, { allowSystemEdit: role === 'SUPERADMIN' || role === 'PLATFORM_ADMIN' || impersonating });
}
