'use server';

import { isWorkforceRole } from '@/lib/roles';
import prisma from '@/lib/prisma';
import { Database, Page, Property, DatabaseView, Block, PageIndexEntry } from '@/components/admin/database/types';
import type { SystemDatabaseRole } from '@/lib/kernel/system-databases';
import { revalidatePath } from 'next/cache';

import { auth } from '@/auth';
import { scopeFromSession } from '@/lib/data/scope';
import { saveRecord, deleteRecord, type SaveRecordResult } from '@/lib/data/records';
import { intentFromPage } from '@/lib/records/record-intent';
import type { DatabaseVersion } from '@/lib/records/database-version';

/**
 * Validates and sanitizes a string ID, preventing undefined/null values from hitting Prisma
 */
const safeId = (id: string | undefined | null) => {
    return id || `temp-${Math.random().toString(36).substring(7)}`;
};

/**
 * Fetches all global databases from Postgres, hydrating their respective pages.
 * Reconstructs them to perfectly match the frontend Zustand signatures.
 */
export async function getGlobalDatabases(): Promise<Database[]> {
    const session = await auth();
    const tenantId = session?.user?.tenantId;
    if (!tenantId) return [];
    // pd.md 4y — workforce reaches the WorkHub and nothing else; the ERP database doors are closed to it
    // (a crew phone held the tenant's database ids and could call these by hand — incl. deleting a database).
    if (isWorkforceRole((session?.user as { role?: string } | undefined)?.role)) return [];

    let allowedProjectIds: string[] | null = null;
    const userId = session?.user?.id;
    if (userId) {
        const dbUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
        if (dbUser?.role === 'TENANT_ENTERPRISE_WORKFORCE') {
            const shifts = await prisma.scheduledShift.findMany({
                where: { userId, tenantId },
                select: { projectId: true }
            });
            allowedProjectIds = Array.from(new Set(shifts.map(s => s.projectId).filter(Boolean))) as string[];
        }
    }

    try {
        const dbs = await prisma.globalDatabase.findMany({
            where: { tenantId },
            include: { pages: true },
            orderBy: { createdAt: 'desc' }
        });

        // Dynamically fetch users to populate db-hr
        const HR_EMPLOYEE_ROLES = [
            'APP_MANAGER', 'TENANT_ADMIN', 'TENANT_FREE', 'TENANT_PRO_OWNER',
            'TENANT_PRO_EMPLOYEE', 'TENANT_ENTERPRISE_OWNER', 'TENANT_ENTERPRISE_MANAGER',
            'TENANT_ENTERPRISE_EMPLOYEE', 'TENANT_ENTERPRISE_WORKFORCE', 'BOOKKEEPING',
            'TEAMLEAD', 'PROJECT_MANAGER', 'HR_OFFICER', 'OFFERTES'
        ];
        const users = await prisma.user.findMany({
            where: { tenantId, role: { in: HR_EMPLOYEE_ROLES } },
            select: { id: true, name: true, email: true, phone: true, role: true, employeeStatus: true, createdAt: true, updatedAt: true }
        });

        return dbs.map(db => {
            let mappedPages = db.pages.map(page => ({
                id: page.id,
                databaseId: page.databaseId,
                coverImage: page.coverImage || null,
                icon: page.icon || null,
                properties: (page.properties as any) || {},
                order: page.order ?? 0,
                blocks: (page.blocks as unknown as Block[]) || [],
                blocksVersion: page.blocksVersion ?? 1,
                driveFolderId: page.driveFolderId || undefined,
                createdBy: page.createdBy,
                lastEditedBy: page.lastEditedBy,
                createdAt: page.createdAt.toISOString(),
                updatedAt: page.updatedAt.toISOString(),
            }));

            // Scope db-1 (projects) for workforce
            if ((db.logicalKey === 'projects' || db.id === 'db-1') && allowedProjectIds !== null) {
                mappedPages = mappedPages.filter(p => allowedProjectIds!.includes(p.id));
            }

            // Auto-sync employees into db-hr as virtual pages
            if (db.logicalKey === 'hr' || db.id === 'db-hr') {
                const virtualPages = users.map(u => ({
                    id: u.id,
                    databaseId: db.id,
                    coverImage: null,
                    icon: 'user',
                    properties: {
                        'title': u.name || 'Untitled',
                        'prop-email': u.email,
                        'prop-phone': u.phone || '',
                        'prop-role': u.role,
                        'status': u.employeeStatus === 'ON_LEAVE' ? 'opt-leave' : (u.employeeStatus === 'INACTIVE' ? 'opt-inactive' : 'opt-active')
                    },
                    order: 0,
                    blocks: [],
                    blocksVersion: 1,
                    driveFolderId: undefined,
                    createdBy: 'system',
                    lastEditedBy: 'system',
                    createdAt: u.createdAt.toISOString(),
                    updatedAt: u.updatedAt.toISOString(),
                }));
                
                // Combine manual pages and virtual pages, favoring virtual pages for duplicates
                const pageMap = new Map();
                mappedPages.forEach(p => pageMap.set(p.id, p));
                virtualPages.forEach(p => pageMap.set(p.id, p));
                mappedPages = Array.from(pageMap.values());
            }

            return {
            id: db.id,
            name: db.name,
            description: db.description || null,
            icon: db.icon || null,
            coverImage: db.coverImage || null,
            logicalKey: (db.logicalKey as SystemDatabaseRole) || null,
            isTemplate: db.isTemplate,
            folderId: db.folderId || undefined,
            properties: (db.properties as unknown as Property[]) || [],
            views: (db.views as unknown as DatabaseView[]) || [],
            activeFilters: (db.activeFilters as any) || [],
            activeSorts: (db.activeSorts as any) || [],
            ownerId: db.ownerId,
            createdAt: db.createdAt.toISOString(),
            updatedAt: db.updatedAt.toISOString(),
            pages: mappedPages
        };
    });
    } catch (e) {
        console.error("Error fetching global databases:", e);
        return [];
    }
}

/**
 * MEM-3b: Fetches all database schemas for the tenant WITHOUT page content.
 * Returns empty pages arrays, reducing server memory and network payload by 95%+.
 */
export async function getGlobalDatabaseSchemas(): Promise<Database[]> {
    const session = await auth();
    const tenantId = session?.user?.tenantId;
    if (!tenantId) return [];
    // pd.md 4y — workforce reaches the WorkHub and nothing else; the ERP database doors are closed to it
    // (a crew phone held the tenant's database ids and could call these by hand — incl. deleting a database).
    if (isWorkforceRole((session?.user as { role?: string } | undefined)?.role)) return [];

    try {
        const dbs = await prisma.globalDatabase.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' }
        });

        return dbs.map(db => ({
            id: db.id,
            name: db.name,
            description: db.description || null,
            icon: db.icon || null,
            coverImage: db.coverImage || null,
            logicalKey: (db.logicalKey as SystemDatabaseRole) || null,
            isTemplate: db.isTemplate,
            folderId: db.folderId || undefined,
            properties: (db.properties as unknown as Property[]) || [],
            views: (db.views as unknown as DatabaseView[]) || [],
            activeFilters: (db.activeFilters as any) || [],
            activeSorts: (db.activeSorts as any) || [],
            ownerId: db.ownerId,
            createdAt: db.createdAt.toISOString(),
            updatedAt: db.updatedAt.toISOString(),
            pages: []
        }));
    } catch (e) {
        console.error("Error fetching global database schemas:", e);
        throw e;
    }
}

/**
 * LIVE-1 · the database's version (count + newest change) for the CALLER's tenant — a screen compares it with what it
 * holds and re-reads on a difference (lib/records/database-version). One aggregate on the scoped client.
 */
export async function getDatabaseVersion(databaseId: string): Promise<DatabaseVersion> {
    const session = await auth();
    if (!session?.user?.tenantId) throw new Error('Unauthorized');
    if (isWorkforceRole((session.user as { role?: string }).role)) throw new Error('Forbidden: workforce');
    const db = await scopeFromSession();
    const agg = await db.globalPage.aggregate({ where: { databaseId }, _count: { _all: true }, _max: { updatedAt: true } });
    return { count: agg._count._all, lastUpdatedAt: agg._max.updatedAt ? agg._max.updatedAt.toISOString() : null };
}

/**
 * MEM-3b: Fetches pages on-demand for a single database.
 * Strict security verification: refuses untrusted databaseId if tenantId does not match.
 * Never swallows errors with silent empty array to avoid false grid wipeouts.
 */
export async function getDatabasePages(databaseId: string): Promise<Page[]> {
    const session = await auth();
    const tenantId = session?.user?.tenantId;
    if (!tenantId) {
        throw new Error('Unauthorized');
    }
    // pd.md 4y — workforce reaches the WorkHub and nothing else; the ERP database doors are closed to it
    // (a crew phone held the tenant's database ids and could call these by hand — incl. deleting a database).
    if (isWorkforceRole((session?.user as { role?: string } | undefined)?.role)) throw new Error('Forbidden: workforce');

    // Security: verify database ownership before querying its pages
    const parentDb = await prisma.globalDatabase.findUnique({
        where: { id: databaseId },
        select: { tenantId: true, logicalKey: true }
    });

    if (!parentDb || parentDb.tenantId !== tenantId) {
        console.error(`[getDatabasePages] Security refusal: databaseId ${databaseId} owned by ${parentDb?.tenantId}, requested by tenant ${tenantId}`);
        throw new Error('Unauthorized database access');
    }

    let allowedProjectIds: string[] | null = null;
    const userId = session?.user?.id;
    if (userId) {
        const dbUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
        if (dbUser?.role === 'TENANT_ENTERPRISE_WORKFORCE') {
            const shifts = await prisma.scheduledShift.findMany({
                where: { userId, tenantId },
                select: { projectId: true }
            });
            allowedProjectIds = Array.from(new Set(shifts.map(s => s.projectId).filter(Boolean))) as string[];
        }
    }

    try {
        const pages = await prisma.globalPage.findMany({
            where: { databaseId },
            orderBy: { order: 'asc' }
        });

        let mappedPages: Page[] = pages.map(page => ({
            id: page.id,
            databaseId: page.databaseId,
            coverImage: page.coverImage || null,
            icon: page.icon || null,
            properties: (page.properties as any) || {},
            order: page.order ?? 0,
            blocks: (page.blocks as unknown as Block[]) || [],
            blocksVersion: page.blocksVersion ?? 1,
            driveFolderId: page.driveFolderId || undefined,
            createdBy: page.createdBy,
            lastEditedBy: page.lastEditedBy,
            createdAt: page.createdAt.toISOString(),
            updatedAt: page.updatedAt.toISOString(),
        }));

        // Scope db-1 (projects) for workforce
        if ((parentDb?.logicalKey === 'projects' || databaseId === 'db-1') && allowedProjectIds !== null) {
            mappedPages = mappedPages.filter(p => allowedProjectIds!.includes(p.id));
        }

        // Auto-sync employees into db-hr as virtual pages
        if (parentDb?.logicalKey === 'hr' || databaseId === 'db-hr') {
            const HR_EMPLOYEE_ROLES = [
                'APP_MANAGER', 'TENANT_ADMIN', 'TENANT_FREE', 'TENANT_PRO_OWNER',
                'TENANT_PRO_EMPLOYEE', 'TENANT_ENTERPRISE_OWNER', 'TENANT_ENTERPRISE_MANAGER',
                'TENANT_ENTERPRISE_EMPLOYEE', 'TENANT_ENTERPRISE_WORKFORCE', 'BOOKKEEPING',
                'TEAMLEAD', 'PROJECT_MANAGER', 'HR_OFFICER', 'OFFERTES'
            ];
            const users = await prisma.user.findMany({
                where: { tenantId, role: { in: HR_EMPLOYEE_ROLES } },
                select: { id: true, name: true, email: true, phone: true, role: true, employeeStatus: true, createdAt: true, updatedAt: true }
            });

            const virtualPages: Page[] = users.map(u => ({
                id: u.id,
                databaseId,
                coverImage: null,
                icon: 'user',
                properties: {
                    'title': u.name || 'Untitled',
                    'prop-email': u.email,
                    'prop-phone': u.phone || '',
                    'prop-role': u.role,
                    'status': u.employeeStatus === 'ON_LEAVE' ? 'opt-leave' : (u.employeeStatus === 'INACTIVE' ? 'opt-inactive' : 'opt-active')
                },
                order: 0,
                blocks: [],
                blocksVersion: 1,
                driveFolderId: undefined,
                createdBy: 'system',
                lastEditedBy: 'system',
                createdAt: u.createdAt.toISOString(),
                updatedAt: u.updatedAt.toISOString(),
            }));

            const pageMap = new Map<string, Page>();
            mappedPages.forEach(p => pageMap.set(p.id, p));
            virtualPages.forEach(p => pageMap.set(p.id, p));
            mappedPages = Array.from(pageMap.values());
        }

        return mappedPages;
    } catch (e) {
        console.error(`[getDatabasePages] Error fetching pages for ${databaseId}:`, e);
        throw e;
    }
}

/**
 * MEM-3a: Fetches lightweight index of all pages across databases.
 * Uses queryRaw for GlobalPage to extract only id, databaseId, title, updatedAt
 * without pulling megabytes of properties/blocks JSON.
 */
export async function getGlobalPageIndex(): Promise<PageIndexEntry[]> {
    const session = await auth();
    const tenantId = session?.user?.tenantId;
    if (!tenantId) return [];
    // pd.md 4y — workforce reaches the WorkHub and nothing else; the ERP database doors are closed to it
    // (a crew phone held the tenant's database ids and could call these by hand — incl. deleting a database).
    if (isWorkforceRole((session?.user as { role?: string } | undefined)?.role)) return [];

    try {
        const rows = await prisma.$queryRaw<Array<{ id: string; databaseId: string; title: string | null; updatedAt: Date }>>`
            SELECT p.id, p."databaseId",
                   COALESCE(p.properties->>'title', p.properties->>'name', p.properties->>'prop-title', 'Untitled') AS title,
                   p."updatedAt"
            FROM "GlobalPage" p
            JOIN "GlobalDatabase" d ON d.id = p."databaseId"
            WHERE d."tenantId" = ${tenantId}
        `;

        const indexEntries: PageIndexEntry[] = rows.map(r => ({
            id: r.id,
            databaseId: r.databaseId,
            title: r.title || 'Untitled',
            updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : String(r.updatedAt),
        }));

        // Include virtual users for db-hr so employee relation chips resolve
        const HR_EMPLOYEE_ROLES = [
            'APP_MANAGER', 'TENANT_ADMIN', 'TENANT_FREE', 'TENANT_PRO_OWNER',
            'TENANT_PRO_EMPLOYEE', 'TENANT_ENTERPRISE_OWNER', 'TENANT_ENTERPRISE_MANAGER',
            'TENANT_ENTERPRISE_EMPLOYEE', 'TENANT_ENTERPRISE_WORKFORCE', 'BOOKKEEPING',
            'TEAMLEAD', 'PROJECT_MANAGER', 'HR_OFFICER', 'OFFERTES'
        ];
        const users = await prisma.user.findMany({
            where: { tenantId, role: { in: HR_EMPLOYEE_ROLES } },
            select: { id: true, name: true, email: true, updatedAt: true }
        });

        const hrDb = await prisma.globalDatabase.findFirst({
            where: { tenantId, logicalKey: 'hr' },
            select: { id: true }
        });
        const hrDatabaseId = hrDb?.id || 'db-hr';

        users.forEach(u => {
            indexEntries.push({
                id: u.id,
                databaseId: hrDatabaseId,
                title: u.name || u.email || 'Untitled',
                updatedAt: u.updatedAt.toISOString(),
            });
        });

        return indexEntries;
    } catch (e) {
        console.error('[getGlobalPageIndex] Failed to fetch page index:', e);
        return [];
    }
}


/**
 * Creates a database (its schema, properties, views) when it does not exist yet. CREATE-ONLY since DB-DEF-1:
 * an existing database is never overwritten here. Does not mutate pages.
 */
export async function saveGlobalDatabase(db: Database) {
    const session = await auth();
    const tenantId = session?.user?.tenantId;
    if (!tenantId) return { success: false, error: 'Unauthorized' };
    // pd.md 4y — workforce reaches the WorkHub and nothing else; the ERP database doors are closed to it
    // (a crew phone held the tenant's database ids and could call these by hand — incl. deleting a database).
    if (isWorkforceRole((session?.user as { role?: string } | undefined)?.role)) return { success: false, error: 'Forbidden: workforce' };

    try {
        const existing = await prisma.globalDatabase.findUnique({ where: { id: safeId(db.id) } });
        if (existing && existing.tenantId !== tenantId) {
            return { success: false, error: 'Unauthorized' };
        }
        // DB-DEF-1 (2026-10-05): CREATE-ONLY. An existing database's definition changes by operations
        // (app/actions/database-definition.ts) — this whole-definition write let any stale screen undo newer edits.
        if (existing) return { success: true, created: false };

        await prisma.globalDatabase.upsert({
            where: { id: safeId(db.id) },
            update: {
                name: db.name,
                description: db.description,
                icon: db.icon,
                coverImage: db.coverImage,
                isTemplate: db.isTemplate,
                folderId: db.folderId,
                properties: db.properties as any,
                views: db.views as any,
                activeFilters: db.activeFilters as any,
                activeSorts: db.activeSorts as any,
                ownerId: db.ownerId || 'admin',
                updatedAt: new Date(),
            },
            create: {
                id: safeId(db.id),
                tenantId,
                name: (db.name && db.name !== 'GlobalDatabase') ? db.name : 'Untitled Database',
                description: db.description,
                icon: db.icon,
                coverImage: db.coverImage,
                isTemplate: db.isTemplate || false,
                folderId: db.folderId,
                properties: db.properties as any,
                views: db.views as any,
                activeFilters: db.activeFilters as any,
                activeSorts: db.activeSorts as any,
                ownerId: db.ownerId || 'admin',
            }
        });

        revalidatePath('/admin', 'layout');
        return { success: true };
    } catch (e) {
        console.error("Error saving global database:", e);
        return { success: false, error: e };
    }
}

/**
 * Upserts a specific Row/Page within a database, including its dynamic property cell values and underlying rich-text blocks.
 */
/**
 * R2-1 · the store's answer for one saved page — the same shape the sync queue has always read
 * (success + persisted updatedAt / blocksVersion / keptServer, or a refusal with the server's row to revert to).
 */
export interface StoreSaveAnswer {
    success: boolean; error?: string; errorCode?: string; changed?: boolean;
    updatedAt?: string; blocksVersion?: number; keptServer?: Record<string, unknown>;
    lastEditedBy?: string; serverUpdatedAt?: string; serverBlocksVersion?: number;
    serverProperties?: Record<string, unknown>; serverBlocks?: unknown;
    blockedFields?: string[]; docTitle?: string; propertyLabels?: Record<string, string>;
}

function storeAnswer(r: SaveRecordResult, page: Page): StoreSaveAnswer {
    if (r.ok) {
        if (r.ignored.length) console.info(`[record] computed fields not written for ${page.id}: ${r.ignored.join(', ')}`);
        return { success: true as const, updatedAt: r.updatedAt, blocksVersion: r.blocksVersion, keptServer: Object.keys(r.keptServer).length ? r.keptServer : undefined, changed: r.changed };
    }
    const code = r.refusal.code;
    if (code === 'NOT_FOUND') return { success: false as const, error: 'Unauthorized DB access' };
    if (code === 'EMPTY_BLOCKS_PROTECTION') {
        return { success: false as const, error: 'EMPTY_BLOCKS_PROTECTION: Refused to overwrite existing document lines with empty array.', errorCode: 'EMPTY_BLOCKS_PROTECTION' };
    }
    if (code === 'STALE_WRITE') {
        console.warn(`[record] STALE_WRITE (Conflict) for page ${page.id}`);
        return { success: false as const, error: 'STALE_WRITE', errorCode: 'STALE_WRITE', lastEditedBy: r.server?.lastEditedBy, serverUpdatedAt: r.server?.updatedAt, serverBlocksVersion: r.server?.blocksVersion };
    }
    // EXPORT_LOCKED / DOCUMENT_LOCKED — the store reverts to the server version and says why.
    const propertyLabels: Record<string, string> = {};
    for (const prop of r.dbProperties || []) if (prop.id && prop.name) propertyLabels[prop.id] = prop.name;
    return {
        success: false as const,
        error: code === 'DOCUMENT_LOCKED' ? '[DocumentLocked]' : '[ExportLocked]',
        errorCode: code,
        blockedFields: 'blockedFields' in r.refusal ? r.refusal.blockedFields : [],
        docTitle: String(r.server?.properties?.title || (page.properties as Record<string, unknown>)?.title || ''),
        propertyLabels,
        serverProperties: r.server?.properties,
        serverBlocks: r.server?.blocks,
        serverUpdatedAt: r.server?.updatedAt,
        serverBlocksVersion: r.server?.blocksVersion,
    };
}

/** The store page's create-if-missing and meta (one place for both adapters). */
/**
 * SYNC-AUTHOR-1 (2026-10-09): the write is labelled with WHO made it — the session's user. It used the page's own stored
 * lastEditedBy, so a person's edit of a scanned record was recorded as 'system:scan' (it sent the investigation of lost
 * ticket values after the scanner).
 */
function actorOf(session: { user?: { id?: string | null } | null } | null): string {
    return session?.user?.id || 'unknown-user';
}

function storePageWrite(page: Page, actorId: string) {
    return {
        by: actorId,
        meta: { coverImage: page.coverImage, icon: page.icon, order: page.order, driveFolderId: page.driveFolderId },
        createIfMissing: { databaseId: page.databaseId, properties: (page.properties || {}) as Record<string, unknown>, blocks: (page.blocks as unknown[]) ?? [], createdBy: page.createdBy || 'admin' },
    };
}

export async function saveGlobalPage(page: Page): Promise<StoreSaveAnswer> {
    const session = await auth();
    const tenantId = session?.user?.tenantId;
    if (!tenantId) return { success: false, error: 'Unauthorized' };
    // pd.md 4y — workforce reaches the WorkHub and nothing else; the ERP database doors are closed to it
    // (a crew phone held the tenant's database ids and could call these by hand — incl. deleting a database).
    if (isWorkforceRole((session?.user as { role?: string } | undefined)?.role)) return { success: false, error: 'Forbidden: workforce' };

    try {
        // R2-1 · ADAPTER over the one record door (lib/data/records.ts saveRecord): the store's page becomes an
        // INTENT for the fields this client changed (against its dirtyBase), applied to the CURRENT row inside one
        // serializable transaction on the session's scoped client. Same answers as before, so the store's sync
        // queue is unchanged. Before: tenant check (partial — a missing database let the write through),
        // read, merge and write were separate steps, and the whole properties object was written back.
        const db = await scopeFromSession();
        const r = await saveRecord(db, intentFromPage(page), storePageWrite(page, actorOf(session)));
        const answer = storeAnswer(r, page);
        if (answer.success && answer.changed) revalidatePath('/admin', 'layout');
        return answer;
    } catch (e: any) {
        console.error(`[saveGlobalPage] Failed to save page ${page.id} (db: ${page.databaseId}):`, e?.message ?? e);
        return { success: false, error: e?.message ?? String(e) };
    }
}

/**
 * Batch upserts multiple pages in a single server action call.
 * Uses prisma.$transaction to guarantee atomicity per batch.
 * Designed for the CSV import engine — avoids 2000+ individual server action calls.
 */
export async function saveGlobalPagesBatch(pages: Page[]) {
    const session = await auth();
    const tenantId = session?.user?.tenantId;
    if (!tenantId) return { success: false, error: 'Unauthorized' };
    // pd.md 4y — workforce reaches the WorkHub and nothing else; the ERP database doors are closed to it
    // (a crew phone held the tenant's database ids and could call these by hand — incl. deleting a database).
    if (isWorkforceRole((session?.user as { role?: string } | undefined)?.role)) return { success: false, error: 'Forbidden: workforce' };
    if (!pages.length) return { success: true, count: 0, results: [] };

    try {
        // R2-1 · ADAPTER: the CSV-import batch — every page through the one record door (scoped, one serializable
        // transaction each, partial success per page), same per-page answers as before.
        const db = await scopeFromSession();
        const results: Array<Record<string, unknown> & { id: string; success: boolean }> = [];
        for (const page of pages) {
            try {
                const r = await saveRecord(db, intentFromPage(page), storePageWrite(page, actorOf(session)));
                results.push({ id: page.id, ...storeAnswer(r, page) });
            } catch (pageError: any) {
                console.error(`[saveGlobalPagesBatch] Failed for page ${page.id}:`, pageError);
                results.push({ id: page.id, success: false, error: pageError?.message ?? String(pageError) });
            }
        }
        revalidatePath('/admin', 'layout');
        return { success: true, count: results.filter(r => r.success).length, results };
    } catch (e: any) {
        console.error(`[saveGlobalPagesBatch] Failed batch completely:`, e?.message ?? e);
        return { success: false, error: e?.message ?? String(e) };
    }
}

export async function deleteGlobalPage(pageId: string) {
    const session = await auth();
    const tenantId = session?.user?.tenantId;
    if (!tenantId) return { success: false, error: 'Unauthorized' };
    // pd.md 4y — workforce reaches the WorkHub and nothing else; the ERP database doors are closed to it
    // (a crew phone held the tenant's database ids and could call these by hand — incl. deleting a database).
    if (isWorkforceRole((session?.user as { role?: string } | undefined)?.role)) return { success: false, error: 'Forbidden: workforce' };

    try {
        // R2-1: through the one record door — a record of THIS tenant, never an issued document.
        const db = await scopeFromSession();
        const r = await deleteRecord(db, pageId);
        if (r.ok) return { success: true };
        if (r.refusal === 'NOT_FOUND') return { success: false, error: 'Unauthorized' };
        return { success: false, error: r.refusal === 'DOCUMENT_LOCKED' ? 'Een verzonden document kan niet verwijderd worden' : 'Een geëxporteerd document kan niet verwijderd worden', errorCode: r.refusal };
    } catch (e) {
        console.error("Error deleting global page:", e);
        return { success: false, error: e };
    }
}

export async function deleteGlobalDatabase(dbId: string) {
    const session = await auth();
    const tenantId = session?.user?.tenantId;
    if (!tenantId) return { success: false, error: 'Unauthorized' };
    // pd.md 4y — workforce reaches the WorkHub and nothing else; the ERP database doors are closed to it
    // (a crew phone held the tenant's database ids and could call these by hand — incl. deleting a database).
    if (isWorkforceRole((session?.user as { role?: string } | undefined)?.role)) return { success: false, error: 'Forbidden: workforce' };

    try {
        const existing = await prisma.globalDatabase.findUnique({ where: { id: dbId } });
        if (!existing || existing.tenantId !== tenantId) {
            return { success: false, error: 'Unauthorized' };
        }

        // Cascade handles page deletion
        await prisma.globalDatabase.delete({ where: { id: dbId } });
        return { success: true };
    } catch (e) {
        console.error("Error deleting global database:", e);
        return { success: false, error: e };
    }
}

export async function getGlobalPage(pageId: string) {
    const session = await auth();
    const tenantId = session?.user?.tenantId;
    if (!tenantId) return null;
    // pd.md 4y — workforce reaches the WorkHub and nothing else; the ERP database doors are closed to it
    // (a crew phone held the tenant's database ids and could call these by hand — incl. deleting a database).
    if (isWorkforceRole((session?.user as { role?: string } | undefined)?.role)) return null;
    const page = await prisma.globalPage.findUnique({ 
        where: { id: pageId },
        include: { database: { select: { tenantId: true } } }
    });
    if (!page || page.database?.tenantId !== tenantId) return null;
    return {
        id: page.id,
        databaseId: page.databaseId,
        properties: page.properties,
        blocks: page.blocks,
        updatedAt: page.updatedAt,
        lastEditedBy: page.lastEditedBy
    };
}
