"use server";
/**
 * DOC-LOCK-1 · Revise a LOCKED quote: a new DRAFT version with the same number (-v2, -v3 …), its lines
 * copied; the original stays exactly as sent and gains a link to the revision (`revisedTo`, writable on a
 * locked quote). Office roles only (the workforce never reaches quotations).
 */
import prisma from '@/lib/prisma';
import { auth } from '@/auth';
import { isWorkforceRole } from '@/lib/roles';
import { createPageServerFirst } from '@/app/actions/pages';
import { isQuoteLocked } from '@/lib/records/document-lock';
import { baseNumber, nextVersion } from '@/lib/records/quote-version';
import { zonedParts } from '@/lib/kernel/shift-time';
import type { Page } from '@/components/admin/database/types';

/** Facts of the SENT document that a new version must not inherit. */
const NOT_CARRIED = ['status', 'receiptUrl', 'documentReconstructed', 'documentReconstructedAt', 'clientSignature',
    'signatureMethod', 'consentName', 'signedAt', 'acceptedAt', 'rejectedAt', 'sentAt', 'lastSentAt', 'revisedTo',
    'structuredComm'];

export async function reviseQuotation(quoteId: string): Promise<{ ok: true; page: Page } | { ok: false; error: string; detail?: string }> {
    const s = await auth();
    const tenantId = s?.user?.tenantId;
    if (!tenantId) return { ok: false, error: 'unauthorized' };
    if (isWorkforceRole((s?.user as { role?: string } | undefined)?.role)) return { ok: false, error: 'forbidden' };

    const original = await prisma.globalPage.findFirst({
        where: { id: quoteId, database: { tenantId, logicalKey: 'quotations' } },
        select: { id: true, databaseId: true, properties: true, blocks: true },
    });
    if (!original) return { ok: false, error: 'not_found' };
    const props = (original.properties || {}) as Record<string, unknown>;
    if (!isQuoteLocked(props)) return { ok: false, error: 'not_locked' };   // a draft is edited directly

    const base = baseNumber(String(props.title || ''));
    const siblings = await prisma.globalPage.findMany({
        where: { databaseId: original.databaseId, properties: { path: ['title'], string_starts_with: base } },
        select: { properties: true },
    });
    const version = nextVersion(base, siblings.map(p => String(((p.properties || {}) as Record<string, unknown>).title || '')));

    const carried: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(props)) if (!NOT_CARRIED.includes(k)) carried[k] = v;
    const created = await createPageServerFirst(original.databaseId, {
        ...carried,
        title: `${base}-v${version}`,
        status: 'opt-draft',
        date: zonedParts(new Date()).date,
        revisedFrom: [original.id],
        version,
    } as never);
    if (!created.success) return { ok: false, error: 'create_failed', detail: created.error };

    const blocks = Array.isArray(original.blocks) ? original.blocks : [];
    const prevLinks = Array.isArray(props.revisedTo) ? (props.revisedTo as string[]) : [];
    const [saved] = await prisma.$transaction([
        prisma.globalPage.update({ where: { id: created.page.id }, data: { blocks: blocks as never, blocksVersion: 2 }, select: { updatedAt: true } }),
        prisma.globalPage.update({
            where: { id: original.id },
            data: { properties: { ...props, revisedTo: [...prevLinks, created.page.id] } as never, lastEditedBy: 'system:revise' },
        }),
    ]);
    return { ok: true, page: { ...created.page, blocks: blocks as never, blocksVersion: 2, updatedAt: saved.updatedAt.toISOString() } };
}
