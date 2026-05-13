'use server';

import prisma from '@/lib/prisma';
import { auth } from '@/auth';
import { v4 as uuidv4 } from 'uuid';
import { Prisma } from '@prisma/client';
import { Page, PropertyValue } from '@/components/admin/database/types';

// Infer required module from locked DB ID prefix.
// Works for both bare IDs ('db-invoices') and scoped IDs ('db-invoices-abc12345').
const DB_ID_MODULE_MAP: Array<[string, string]> = [
    ['db-invoices',   'INVOICING'],
    ['db-expenses',   'INVOICING'],
    ['db-tickets',    'INVOICING'],
    ['db-quotations', 'CRM'],
    ['db-clients',    'CRM'],
    ['db-suppliers',  'INVOICING'],
];

function requiredModuleForDb(databaseId: string): string | null {
    for (const [prefix, module] of DB_ID_MODULE_MAP) {
        if (databaseId === prefix || databaseId.startsWith(prefix + '-')) return module;
    }
    return null; // Non-locked DBs (projects, articles, etc.) — no module gate
}

/**
 * Server-first page creation.
 * Unlike the store's fire-and-forget syncPage, this awaits the Postgres write
 * and returns the confirmed page so the caller knows it's durable before proceeding.
 */
export async function createPageServerFirst(
    databaseId: string,
    properties: Record<string, PropertyValue>,
    customId?: string
): Promise<{ success: true; page: Page } | { success: false; error: string }> {
    const session = await auth();
    const tenantId = session?.user?.tenantId;
    if (!tenantId) return { success: false, error: 'Not authenticated' };

    // Module-level authorization — enforced server-side regardless of UI state.
    // A FREE tenant calling this directly for a INVOICING/CRM database gets denied.
    const requiredModule = requiredModuleForDb(databaseId);
    if (requiredModule) {
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { activeModules: true, planType: true },
        });
        const role = session?.user?.role;
        const isSuperadmin = role ? ['SUPERADMIN', 'PLATFORM_ADMIN'].includes(role) : false;
        if (!isSuperadmin && !tenant?.activeModules.includes(requiredModule)) {
            return {
                success: false,
                error: `Access denied — module '${requiredModule}' is not active on your plan.`,
            };
        }
    }

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
                properties: properties as Prisma.InputJsonValue,
                order,
                blocks: [],
                createdBy: 'user',
                lastEditedBy: 'user',
            }
        });

        const page: Page = {
            id: saved.id,
            databaseId: saved.databaseId,
            properties: saved.properties as Record<string, PropertyValue>,
            order: saved.order ?? 0,
            blocks: [],
            createdAt: saved.createdAt.toISOString(),
            updatedAt: saved.updatedAt.toISOString(),
            createdBy: saved.createdBy,
            lastEditedBy: saved.lastEditedBy,
        };

        return { success: true, page };
    } catch (e: unknown) {
        const error = e as Error;
        console.error('[createPageServerFirst] Error:', error?.message ?? error);
        return { success: false, error: error?.message || 'Database write failed' };
    }
}

/**
 * Server-first page property update.
 * Updates a single page's properties in Postgres and returns the updated page.
 */
export async function updatePageServerFirst(
    pageId: string,
    properties: Record<string, PropertyValue>
): Promise<{ success: true; page: Page } | { success: false; error: string }> {
    const session = await auth();
    const tenantId = session?.user?.tenantId;
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
                properties: properties as Prisma.InputJsonValue,
                lastEditedBy: 'user',
                updatedAt: new Date(),
            }
        });

        // Automation Trigger: If Quote status changed to ACCEPTED, create Project
        const oldStatus = (existing.properties as Record<string, unknown>)?.status;
        const newStatus = (properties as Record<string, unknown>)?.status;
        const isQuoteDb = existing.databaseId.startsWith('db-quotations');

        if (isQuoteDb && oldStatus !== newStatus && (newStatus === 'opt-accepted' || newStatus === 'ACCEPTED')) {
            try {
                const { autoCreateProjectFromQuote } = await import('@/lib/services/quote-service');
                await autoCreateProjectFromQuote(pageId, tenantId);
            } catch (err) {
                console.error('[Automation] Failed to auto-create project:', err);
            }
        }

        const page: Page = {
            id: saved.id,
            databaseId: saved.databaseId,
            properties: saved.properties as Record<string, PropertyValue>,
            order: saved.order ?? 0,
            blocks: [],
            createdAt: saved.createdAt.toISOString(),
            updatedAt: saved.updatedAt.toISOString(),
            createdBy: saved.createdBy,
            lastEditedBy: saved.lastEditedBy,
        };

        return { success: true, page };
    } catch (e: unknown) {
        const error = e as Error;
        console.error('[updatePageServerFirst] Error:', error?.message ?? error);
        return { success: false, error: error?.message || 'Update failed' };
    }
}
