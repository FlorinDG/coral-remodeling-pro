'use server';

import prisma from '@/lib/prisma';
import { auth } from '@/auth';
import { v4 as uuidv4 } from 'uuid';
import { Page } from '@/components/admin/database/types';

/**
 * Server-first page creation.
 * Unlike the store's fire-and-forget syncPage, this awaits the Postgres write
 * and returns the confirmed page so the caller knows it's durable before proceeding.
 */
export async function createPageServerFirst(
    databaseId: string,
    properties: Record<string, any>,
    customId?: string
): Promise<{ success: true; page: Page } | { success: false; error: string }> {
    const session = await auth();
    const tenantId = (session?.user as any)?.tenantId;
    if (!tenantId) return { success: false, error: 'Not authenticated' };

    try {
        // Ensure parent DB exists — upsert a stub if it's a first-session locked DB
        const existingDb = await prisma.globalDatabase.findUnique({
            where: { id: databaseId },
            select: { id: true, tenantId: true }
        });

        if (existingDb && existingDb.tenantId !== tenantId) {
            return { success: false, error: 'Unauthorized' };
        }

        if (!existingDb) {
            // Locked DB not yet in Postgres — create a minimal stub
            await prisma.globalDatabase.create({
                data: {
                    id: databaseId,
                    tenantId,
                    name: databaseId,
                    properties: [],
                    views: [],
                    activeFilters: [],
                    activeSorts: [],
                    isTemplate: false,
                    ownerId: 'system',
                }
            });
        }

        const pageId = customId || uuidv4();

        // Get current max order
        const maxOrderRow = await prisma.globalPage.findFirst({
            where: { databaseId },
            orderBy: { order: 'desc' },
            select: { order: true }
        });
        const order = (maxOrderRow?.order ?? -1) + 1;

        const saved = await prisma.globalPage.create({
            data: {
                id: pageId,
                databaseId,
                properties,
                order,
                blocks: [],
                createdBy: 'user',
                lastEditedBy: 'user',
            }
        });

        const page: Page = {
            id: saved.id,
            databaseId: saved.databaseId,
            properties: saved.properties as Record<string, any>,
            order: saved.order ?? 0,
            blocks: [],
            createdAt: saved.createdAt.toISOString(),
            updatedAt: saved.updatedAt.toISOString(),
            createdBy: saved.createdBy,
            lastEditedBy: saved.lastEditedBy,
        };

        return { success: true, page };
    } catch (e: any) {
        console.error('[createPageServerFirst] Error:', e?.message ?? e);
        return { success: false, error: e?.message || 'Database write failed' };
    }
}

/**
 * Server-first page property update.
 * Updates a single page's properties in Postgres and returns the updated page.
 */
export async function updatePageServerFirst(
    pageId: string,
    properties: Record<string, any>
): Promise<{ success: true; page: Page } | { success: false; error: string }> {
    const session = await auth();
    const tenantId = (session?.user as any)?.tenantId;
    if (!tenantId) return { success: false, error: 'Not authenticated' };

    try {
        // Auth: confirm the page's DB belongs to this tenant
        const existing = await prisma.globalPage.findUnique({
            where: { id: pageId },
            include: { database: { select: { tenantId: true } } }
        });

        if (!existing) return { success: false, error: 'Page not found' };
        if (existing.database.tenantId !== tenantId) return { success: false, error: 'Unauthorized' };

        const saved = await prisma.globalPage.update({
            where: { id: pageId },
            data: {
                properties,
                lastEditedBy: 'user',
                updatedAt: new Date(),
            }
        });

        const page: Page = {
            id: saved.id,
            databaseId: saved.databaseId,
            properties: saved.properties as Record<string, any>,
            order: saved.order ?? 0,
            blocks: [],
            createdAt: saved.createdAt.toISOString(),
            updatedAt: saved.updatedAt.toISOString(),
            createdBy: saved.createdBy,
            lastEditedBy: saved.lastEditedBy,
        };

        return { success: true, page };
    } catch (e: any) {
        console.error('[updatePageServerFirst] Error:', e?.message ?? e);
        return { success: false, error: e?.message || 'Update failed' };
    }
}
