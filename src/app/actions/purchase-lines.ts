"use server";
/**
 * LINE-SEARCH-1 · the doors of the purchase-line search: find a material in the lines of purchase invoices and supplier
 * quotes, and take a line into the library. Session → scoped client → the rule (lib/records/purchase-line-search) →
 * the record door (saveRecord). The line is re-read HERE — the browser never supplies the prices written.
 */
import { v4 as uuidv4 } from 'uuid';
import { auth } from '@/auth';
import { isWorkforceRole } from '@/lib/roles';
import { scopeFromSession, platformDb } from '@/lib/data/scope';
import { saveRecord } from '@/lib/data/records';
import { systemDatabaseId } from '@/lib/data/system-databases';
import { systemDatabaseEntitled } from '@/lib/kernel/system-schema-entitlement';
import {
    searchLines, linesOf, matchArticle, articleFieldsFromLine, libraryUnitOf, ARTICLE_SUPPLIER_CODE,
    type LineHit, type PurchaseDocument,
} from '@/lib/records/purchase-line-search';

const SEARCHED_ROLES = ['expenses', 'purchase-quotes'] as const;

async function officeSession() {
    const session = await auth();
    const user = session?.user as { id?: string; tenantId?: string; role?: string } | undefined;
    if (!user?.tenantId || !user.id || isWorkforceRole(user.role)) return null;
    return { userId: user.id, tenantId: user.tenantId };
}

/** The lines of this tenant's purchase invoices and supplier quotes that match every word of the query. */
export async function searchPurchaseLines(query: string): Promise<{ ok: true; hits: LineHit[] } | { ok: false; error: 'forbidden' }> {
    const who = await officeSession();
    if (!who) return { ok: false, error: 'forbidden' };
    if (!query.trim()) return { ok: true, hits: [] };
    const db = await scopeFromSession();
    const dbs = await db.globalDatabase.findMany({ where: { logicalKey: { in: [...SEARCHED_ROLES] } }, select: { id: true, logicalKey: true } });
    if (!dbs.length) return { ok: true, hits: [] };
    const roleOf = new Map(dbs.map(d => [d.id, String(d.logicalKey)]));
    const pages = await db.globalPage.findMany({
        where: { databaseId: { in: dbs.map(d => d.id) } },
        select: { id: true, databaseId: true, properties: true, blocks: true },
    });
    const docs: PurchaseDocument[] = pages.map(p => ({
        id: p.id, databaseId: p.databaseId, role: roleOf.get(p.databaseId) || '',
        properties: (p.properties || {}) as Record<string, unknown>, blocks: p.blocks,
    }));
    return { ok: true, hits: searchLines(docs, query) };
}

export type AddToLibraryAnswer =
    | { ok: true; articleId: string; created: boolean }
    | { ok: false; error: 'forbidden' | 'not_entitled' | 'not_found' | 'failed' };

/** One purchase line → the library: a new article, or the matching one (same supplier + code) with its new price. */
export async function addPurchaseLineToLibrary(documentId: string, lineId: string, unit?: string): Promise<AddToLibraryAnswer> {
    const who = await officeSession();
    if (!who) return { ok: false, error: 'forbidden' };
    const tenant = await platformDb().tenant.findUnique({ where: { id: who.tenantId }, select: { planType: true, activeModules: true } });
    if (!systemDatabaseEntitled('articles', tenant?.planType, tenant?.activeModules ?? [])) return { ok: false, error: 'not_entitled' };

    const db = await scopeFromSession();
    const doc = await db.globalPage.findFirst({
        where: { id: documentId, database: { logicalKey: { in: [...SEARCHED_ROLES] } } },
        select: { id: true, databaseId: true, properties: true, blocks: true, database: { select: { logicalKey: true } } },
    });
    if (!doc) return { ok: false, error: 'not_found' };
    const hit = linesOf({
        id: doc.id, databaseId: doc.databaseId, role: String(doc.database?.logicalKey || ''),
        properties: (doc.properties || {}) as Record<string, unknown>, blocks: doc.blocks,
    }).find(h => h.lineId === lineId);
    if (!hit) return { ok: false, error: 'not_found' };

    const articlesDbId = await systemDatabaseId(who.tenantId, 'articles');
    const candidates = hit.articleCode
        ? await db.globalPage.findMany({
            where: {
                databaseId: articlesDbId,
                // the code as typed, upper and lower — the rule then compares ignoring case
                OR: [...new Set([hit.articleCode, hit.articleCode.toUpperCase(), hit.articleCode.toLowerCase()])]
                    .map(code => ({ properties: { path: [ARTICLE_SUPPLIER_CODE], equals: code } })),
            },
            select: { id: true, properties: true },
        })
        : [];
    const existingId = matchArticle(hit, candidates.map(c => ({ id: c.id, properties: (c.properties || {}) as Record<string, unknown> })));
    const existing = existingId ? (candidates.find(c => c.id === existingId)!.properties as Record<string, unknown>) : null;
    const fields = articleFieldsFromLine(hit, unit || libraryUnitOf(hit.unitCode), existing);
    const articleId = existingId || uuidv4();
    const saved = await saveRecord(db, { pageId: articleId, fields }, {
        by: who.userId,
        ...(existingId ? {} : { createIfMissing: { databaseId: articlesDbId, properties: fields, createdBy: who.userId } }),
    });
    if (!saved.ok) {
        console.error('[addPurchaseLineToLibrary] the record door refused:', saved.refusal);
        return { ok: false, error: 'failed' };
    }
    return { ok: true, articleId, created: !existingId };
}
