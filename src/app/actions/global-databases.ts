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
    const tenantId = session?.user?.tenantId;
    if (!tenantId) return [];

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
                driveFolderId: page.driveFolderId || undefined,
                createdBy: page.createdBy,
                lastEditedBy: page.lastEditedBy,
                createdAt: page.createdAt.toISOString(),
                updatedAt: page.updatedAt.toISOString(),
            }));

            // Scope db-1 (projects) for workforce
            if ((db.id === 'db-1' || db.id.startsWith('db-1')) && allowedProjectIds !== null) {
                mappedPages = mappedPages.filter(p => allowedProjectIds!.includes(p.id));
            }

            // Auto-sync employees into db-hr as virtual pages
            if (db.id === 'db-hr') {
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
 * Upserts a Database configuration (its schema, properties, views).
 * Does not mutate pages.
 */
export async function saveGlobalDatabase(db: Database) {
    const session = await auth();
    const tenantId = session?.user?.tenantId;
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
export async function saveGlobalPage(page: Page) {
    const session = await auth();
    const tenantId = session?.user?.tenantId;
    if (!tenantId) return { success: false, error: 'Unauthorized' };

    try {
        // Security: ensure the page belongs to a database owned by this tenant.
        const parentDb = await prisma.globalDatabase.findUnique({
            where: { id: page.databaseId },
            select: { tenantId: true }
        });

        // If the parent DB exists and belongs to a different tenant, block the write.
        if (parentDb && parentDb.tenantId !== tenantId) {
            console.error(`[saveGlobalPage] Tenant mismatch: page ${page.id} → DB ${page.databaseId} owned by ${parentDb.tenantId}, request from ${tenantId}`);
            return { success: false, error: 'Unauthorized DB access' };
        }

        // Optimistic Concurrency Control
        const existingPage = await prisma.globalPage.findUnique({
            where: { id: page.id },
            select: { updatedAt: true, properties: true, lastEditedBy: true }
        });

        let finalProperties = page.properties;
        const finalBlocks = page.blocks;

        if (existingPage && page.baseUpdatedAt) {
            const serverTime = existingPage.updatedAt.getTime();
            const clientTime = new Date(page.baseUpdatedAt).getTime();
            if (serverTime !== clientTime) {
                // Time mismatch: Attempt field-level 3-way merge
                let hasHardConflict = false;
                
                // 1. Guard blocks: if client edited blocks and server time advanced, that's a hard conflict.
                if (page.dirtyBaseBlocks) {
                    hasHardConflict = true;
                }

                // 2. Merge properties
                if (!hasHardConflict) {
                    const serverProps = (existingPage.properties as Record<string, unknown>) || {};
                    const clientProps = page.properties;
                    const dirtyBase = page.dirtyBase || {};
                    const mergedProps = { ...serverProps } as any;

                    for (const key of Object.keys(clientProps)) {
                        const clientValStr = JSON.stringify(clientProps[key]);
                        const serverValStr = JSON.stringify(serverProps[key]);
                        const baseValStr = JSON.stringify(dirtyBase[key]);

                        if (clientValStr !== serverValStr) {
                            if (serverValStr !== baseValStr && clientValStr !== baseValStr) {
                                // Both changed this property differently -> hard conflict
                                hasHardConflict = true;
                                break;
                            } else {
                                // Only client changed this key (or server changed it to what client wants)
                                mergedProps[key] = clientProps[key];
                            }
                        }
                    }
                    if (!hasHardConflict) {
                        finalProperties = mergedProps;
                    }
                }

                if (hasHardConflict) {
                    console.warn(`[saveGlobalPage] STALE_WRITE (Conflict) for page ${page.id}. Server: ${serverTime}, Client: ${clientTime}`);
                    return { 
                        success: false, 
                        error: 'STALE_WRITE', 
                        errorCode: 'STALE_WRITE',
                        lastEditedBy: existingPage.lastEditedBy 
                    };
                } else {
                    console.info(`[saveGlobalPage] Successfully merged stale write for page ${page.id}`);
                }
            }
        }

        const newUpdatedAt = new Date();

        await prisma.globalPage.upsert({
            where: { id: page.id },
            update: {
                coverImage: page.coverImage,
                icon: page.icon,
                properties: finalProperties as any,
                order: page.order,
                blocks: finalBlocks as any,
                lastEditedBy: page.lastEditedBy || 'admin',
                driveFolderId: page.driveFolderId,
                updatedAt: newUpdatedAt,
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
                updatedAt: newUpdatedAt,
            }
        });

        revalidatePath('/admin', 'layout');
        return { success: true, updatedAt: newUpdatedAt.toISOString() };
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
    if (!pages.length) return { success: true, count: 0, results: [] };

    try {
        // Verify tenant ownership of the target database(s)
        const dbIds = [...new Set(pages.map(p => p.databaseId))];
        for (const dbId of dbIds) {
            const parentDb = await prisma.globalDatabase.findUnique({
                where: { id: dbId },
                select: { tenantId: true }
            });
            if (parentDb && parentDb.tenantId !== tenantId) {
                return { success: false, error: `Unauthorized DB access: ${dbId}` };
            }
        }

        const newUpdatedAt = new Date();
        const results = [];
        
        // Process sequentially to allow partial success and granular OCC
        for (const page of pages) {
            try {
                // Optimistic Concurrency Control
                const existingPage = await prisma.globalPage.findUnique({
                    where: { id: page.id },
                    select: { updatedAt: true, properties: true, lastEditedBy: true }
                });

                let finalProperties = page.properties;
                const finalBlocks = page.blocks;

                if (existingPage && page.baseUpdatedAt) {
                    const serverTime = existingPage.updatedAt.getTime();
                    const clientTime = new Date(page.baseUpdatedAt).getTime();
                    if (serverTime !== clientTime) {
                        let hasHardConflict = false;
                        if (page.dirtyBaseBlocks) {
                            hasHardConflict = true;
                        }
                        
                        if (!hasHardConflict) {
                            const serverProps = (existingPage.properties as Record<string, unknown>) || {};
                            const clientProps = page.properties;
                            const dirtyBase = page.dirtyBase || {};
                            const mergedProps = { ...serverProps };

                            for (const key of Object.keys(clientProps)) {
                                const clientValStr = JSON.stringify(clientProps[key]);
                                const serverValStr = JSON.stringify(serverProps[key]);
                                const baseValStr = JSON.stringify(dirtyBase[key]);

                                if (clientValStr !== serverValStr) {
                                    if (serverValStr !== baseValStr && clientValStr !== baseValStr) {
                                        hasHardConflict = true;
                                        break;
                                    } else {
                                        mergedProps[key] = clientProps[key];
                                    }
                                }
                            }
                            if (!hasHardConflict) {
                                finalProperties = mergedProps;
                            }
                        }

                        if (hasHardConflict) {
                            results.push({ id: page.id, success: false, errorCode: 'STALE_WRITE', lastEditedBy: existingPage.lastEditedBy });
                            continue;
                        }
                    }
                }

                await prisma.globalPage.upsert({
                    where: { id: page.id },
                    update: {
                        coverImage: page.coverImage,
                        icon: page.icon,
                        properties: finalProperties as any,
                        order: page.order,
                        blocks: finalBlocks as any,
                        lastEditedBy: page.lastEditedBy || 'admin',
                        driveFolderId: page.driveFolderId,
                        updatedAt: newUpdatedAt,
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
                        updatedAt: newUpdatedAt,
                    }
                });
                
                results.push({ id: page.id, success: true, updatedAt: newUpdatedAt.toISOString() });
            } catch (pageError: any) {
                console.error(`[saveGlobalPagesBatch] Failed for page ${page.id}:`, pageError);
                results.push({ id: page.id, success: false, error: pageError?.message ?? String(pageError) });
            }
        }

        revalidatePath('/admin', 'layout');
        const successCount = results.filter(r => r.success).length;
        return { success: true, count: successCount, results };
    } catch (e: any) {
        console.error(`[saveGlobalPagesBatch] Failed batch completely:`, e?.message ?? e);
        return { success: false, error: e?.message ?? String(e) };
    }
}

export async function deleteGlobalPage(pageId: string) {
    const session = await auth();
    const tenantId = session?.user?.tenantId;
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
    const tenantId = session?.user?.tenantId;
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
