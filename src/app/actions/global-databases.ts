'use server';

import prisma from '@/lib/prisma';
import { Database, Page, Property, DatabaseView, Block } from '@/components/admin/database/types';
import { revalidatePath } from 'next/cache';

import { auth } from '@/auth';

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
    const tenantId = (session?.user as any)?.tenantId;
    if (!tenantId) return [];

    try {
        const dbs = await prisma.globalDatabase.findMany({
            where: { tenantId },
            include: { pages: true },
            orderBy: { createdAt: 'desc' }
        });

        return dbs.map(db => ({
            id: db.id,
            name: db.name,
            description: db.description || null,
            icon: db.icon || null,
            coverImage: db.coverImage || null,
            isTemplate: db.isTemplate,
            folderId: db.folderId || undefined,
            properties: (db.properties as unknown as Property[]) || [],
            views: (db.views as unknown as DatabaseView[]) || [],
            activeFilters: (db.activeFilters as any) || [],
            activeSorts: (db.activeSorts as any) || [],
            ownerId: db.ownerId,
            createdAt: db.createdAt.toISOString(),
            updatedAt: db.updatedAt.toISOString(),
            pages: db.pages.map(page => ({
                id: page.id,
                databaseId: page.databaseId,
                coverImage: page.coverImage || null,
                icon: page.icon || null,
                properties: (page.properties as any) || {},
                order: page.order ?? 0,
                blocks: (page.blocks as unknown as Block[]) || [],
                driveFolderId: page.driveFolderId || undefined,
                createdBy: page.createdBy,
                lastEditedBy: page.lastEditedBy,
                createdAt: page.createdAt.toISOString(),
                updatedAt: page.updatedAt.toISOString(),
            }))
        }));
    } catch (e) {
        console.error("Error fetching global databases:", e);
        return [];
    }
}

/**
 * Upserts a Database configuration (its schema, properties, views).
 * Does not mutate pages.
 */
export async function saveGlobalDatabase(db: Database) {
    const session = await auth();
    const tenantId = (session?.user as any)?.tenantId;
    if (!tenantId) return { success: false, error: 'Unauthorized' };

    try {
        const existing = await prisma.globalDatabase.findUnique({ where: { id: safeId(db.id) } });
        if (existing && existing.tenantId !== tenantId) {
            return { success: false, error: 'Unauthorized' };
        }

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
                name: db.name,
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
export async function saveGlobalPage(page: Page) {
    const session = await auth();
    const tenantId = (session?.user as any)?.tenantId;
    if (!tenantId) return { success: false, error: 'Unauthorized' };

    try {
        // Security: ensure the page belongs to a database owned by this tenant.
        // If the database isn't in Postgres yet (race condition on first session),
        // we allow the write — the DB will be created shortly after by syncDb.
        // We do NOT block on DB existence: the tenantId session is the real auth boundary.
        const parentDb = await prisma.globalDatabase.findUnique({
            where: { id: page.databaseId },
            select: { tenantId: true }
        });

        // If the parent DB exists and belongs to a different tenant, block the write.
        if (parentDb && parentDb.tenantId !== tenantId) {
            console.error(`[saveGlobalPage] Tenant mismatch: page ${page.id} → DB ${page.databaseId} owned by ${parentDb.tenantId}, request from ${tenantId}`);
            return { success: false, error: 'Unauthorized DB access' };
        }

        // If parentDb is null, the DB hasn't been written yet (first-session race).
        // We still proceed — the DB upsert from syncDb will land shortly after.

        await prisma.globalPage.upsert({
            where: { id: page.id },
            update: {
                coverImage: page.coverImage,
                icon: page.icon,
                properties: page.properties as any,
                order: page.order,
                blocks: page.blocks as any,
                lastEditedBy: page.lastEditedBy || 'admin',
                driveFolderId: page.driveFolderId,
                updatedAt: new Date(),
            },
            create: {
                id: page.id,
                databaseId: page.databaseId,
                coverImage: page.coverImage,
                icon: page.icon,
                properties: page.properties as any,
                order: page.order,
                blocks: page.blocks as any,
                createdBy: page.createdBy || 'admin',
                lastEditedBy: page.lastEditedBy || 'admin',
                driveFolderId: page.driveFolderId,
            }
        });

        revalidatePath('/admin', 'layout');
        return { success: true };
    } catch (e: any) {
        // Surface the full error in Vercel logs so sync failures are visible
        console.error(`[saveGlobalPage] Failed to save page ${page.id} (db: ${page.databaseId}):`, e?.message ?? e);
        return { success: false, error: e?.message ?? String(e) };
    }
}

export async function deleteGlobalPage(pageId: string) {
    const session = await auth();
    const tenantId = (session?.user as any)?.tenantId;
    if (!tenantId) return { success: false, error: 'Unauthorized' };

    try {
        const page = await prisma.globalPage.findUnique({
            where: { id: pageId },
            include: { database: true }
        });
        if (!page || page.database.tenantId !== tenantId) {
            return { success: false, error: 'Unauthorized' };
        }

        await prisma.globalPage.delete({ where: { id: pageId } });
        return { success: true };
    } catch (e) {
        console.error("Error deleting global page:", e);
        return { success: false, error: e };
    }
}

export async function deleteGlobalDatabase(dbId: string) {
    const session = await auth();
    const tenantId = (session?.user as any)?.tenantId;
    if (!tenantId) return { success: false, error: 'Unauthorized' };

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
