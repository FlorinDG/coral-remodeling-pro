"use server";
/**
 * COMMENTS-1 · the office's thread on a record. Not for the crew (workforce reaches the WorkHub only) and never
 * for a client portal. Session → scoped client → lib/data/comments.ts.
 */
import { auth } from '@/auth';
import { isWorkforceRole, isTenantHrRole } from '@/lib/roles';
import { scopeFromSession } from '@/lib/data/scope';
import { listComments, addComment, changeComment, latestCommentsOf, type CommentView } from '@/lib/data/comments';
import type { LatestComment } from '@/lib/records/comments';

async function ctx() {
    const s = await auth();
    const tenantId = s?.user?.tenantId;
    const userId = s?.user?.id;
    const role = (s?.user as { role?: string } | undefined)?.role;
    if (!tenantId || !userId || isWorkforceRole(role)) return null;
    return { db: await scopeFromSession(), tenantId, actor: { userId, isAdmin: isTenantHrRole(role) } };
}

export async function getComments(pageId: string): Promise<{ ok: true; comments: CommentView[] } | { ok: false; error: string }> {
    const c = await ctx(); if (!c) return { ok: false, error: 'forbidden' };
    const list = await listComments(c, pageId);
    return list ? { ok: true, comments: list } : { ok: false, error: 'not_found' };
}

export async function postComment(pageId: string, body: string) {
    const c = await ctx(); if (!c) return { ok: false as const, error: 'forbidden' };
    return addComment(c, pageId, body);
}

export async function editComment(id: string, body: string) {
    const c = await ctx(); if (!c) return { ok: false as const, error: 'forbidden' };
    return changeComment(c, id, { kind: 'edit', body });
}

export async function deleteComment(id: string) {
    const c = await ctx(); if (!c) return { ok: false as const, error: 'forbidden' };
    return changeComment(c, id, { kind: 'delete' });
}

export async function resolveComment(id: string, resolved: boolean) {
    const c = await ctx(); if (!c) return { ok: false as const, error: 'forbidden' };
    return changeComment(c, id, { kind: 'resolve', resolved });
}

export async function getLatestComments(databaseId: string): Promise<Record<string, LatestComment & { authorName: string }>> {
    const c = await ctx(); if (!c) return {};
    return latestCommentsOf(c, databaseId);
}

/** The tenant's people, for @mentions in the composer. */
export async function getMentionableUsers(): Promise<Array<{ id: string; name: string }>> {
    const c = await ctx(); if (!c) return [];
    const users = await c.db.user.findMany({ select: { id: true, name: true, email: true, role: true }, orderBy: { name: 'asc' } });
    // The crew does not see comments (office only) — so it cannot be mentioned either.
    return users.filter(u => !isWorkforceRole(u.role)).map(u => ({ id: u.id, name: u.name || u.email || '—' }));
}
