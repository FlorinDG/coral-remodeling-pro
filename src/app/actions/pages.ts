'use server';

import { isWorkforceRole } from '@/lib/roles';
import { auth } from '@/auth';
import { v4 as uuidv4 } from 'uuid';
import { Prisma } from '@prisma/client';
import { Page, PropertyValue } from '@/components/admin/database/types';
import { generateOGM } from '@/lib/ogm';
import { SYSTEM_DATABASES, BASE_TO_KEY, SystemDatabaseRole } from '@/lib/kernel/system-databases';
import { systemDatabaseEntitled } from '@/lib/kernel/system-schema-entitlement';
import { scopeFromSession, platformDb } from '@/lib/data/scope';
import { saveRecord } from '@/lib/data/records';
import { syncInvoicePaymentStatus } from '@/lib/data/invoice-payments';
import { systemDatabaseId } from '@/lib/data/system-databases';
import { describeError } from '@/lib/describe-error';

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
    // pd.md 4y — workforce reaches the WorkHub and nothing else; the ERP database doors are closed to it
    // (a crew phone held the tenant's database ids and could call these by hand — incl. deleting a database).
    if (isWorkforceRole((session?.user as { role?: string } | undefined)?.role)) return { success: false, error: 'Forbidden: workforce' };

    // The database: a system base / role resolves through the tenant's binding (fail-closed); any other id must be
    // a database of THIS tenant (scoped client). R2-1: no stub database is ever created here — provisioning is the
    // only creator of databases (R1); a missing binding is a provisioning defect and says so.
    const db = await scopeFromSession();
    let role: SystemDatabaseRole | null = null;
    let resolvedDbId = databaseId;
    if (databaseId in SYSTEM_DATABASES || databaseId in BASE_TO_KEY) {
        role = databaseId in SYSTEM_DATABASES ? (databaseId as SystemDatabaseRole) : BASE_TO_KEY[databaseId];
        try { resolvedDbId = await systemDatabaseId(tenantId, role); }
        catch { return { success: false, error: `Database '${role}' is not provisioned for this workspace` }; }
    } else {
        const own = await db.globalDatabase.findFirst({ where: { id: databaseId }, select: { id: true, logicalKey: true } });
        if (!own) return { success: false, error: 'Database not found' };
        role = (own.logicalKey as SystemDatabaseRole) || null;
    }

    // Module-level authorization — enforced server-side regardless of UI state. ONE rule for every system
    // database (systemDatabaseEntitled — the same the column reconcile reads). ENT-6: before 2026-10-04 eight
    // roles had no gate, so a FREE tenant could create projects, tasks, articles, CRM, bestek and HR rows.
    const requiredModule = role ? SYSTEM_DATABASES[role]?.module : null;
    if (role && requiredModule) {
        const tenant = await platformDb().tenant.findUnique({
            where: { id: tenantId },
            select: { activeModules: true, planType: true },
        });
        const sessionRole = session?.user?.role;
        const isSuperadmin = sessionRole ? ['SUPERADMIN', 'PLATFORM_ADMIN'].includes(sessionRole) : false;
        if (!isSuperadmin && !systemDatabaseEntitled(role, tenant?.planType, tenant?.activeModules ?? [])) {
            return {
                success: false,
                error: `Access denied — module '${requiredModule}' is not active on your plan.`,
            };
        }
    }

    try {
        databaseId = resolvedDbId;
        const pageId = customId || uuidv4();

        // --- OGM Generation for Invoices ---
        if (role === 'invoices' && !properties['structuredComm']) {
            properties['structuredComm'] = generateOGM(properties['title'] as string);
        }

        // Next order in this database
        const maxOrderRow = await db.globalPage.findFirst({
            where: { databaseId },
            orderBy: { order: 'desc' },
            select: { order: true }
        });
        const order = (maxOrderRow?.order ?? -1) + 1;

        // R2-1: through the one record door — created in a database of this tenant, persisted state returned.
        const r = await saveRecord(db, { pageId }, {
            by: 'user',
            meta: { order },
            createIfMissing: { databaseId, properties: properties as Record<string, unknown>, blocks: [], createdBy: 'user' },
        });
        if (!r.ok) return { success: false, error: r.refusal.code === 'NOT_FOUND' ? 'Database not found' : r.refusal.code };
        if (!r.created) return { success: false, error: 'A record with this id already exists' };

        const page: Page = {
            id: pageId,
            databaseId,
            properties: r.properties as Record<string, PropertyValue>,
            order,
            blocks: [],
            blocksVersion: r.blocksVersion,
            createdAt: r.updatedAt,
            updatedAt: r.updatedAt,
            createdBy: 'user',
            lastEditedBy: 'user',
        };

        // --- Matching Logic for Incoming Payments ---
        if (role === 'payments-in') {
            await handlePaymentMatching(tenantId, page);
        }

        return { success: true, page };
    } catch (e: unknown) {
        console.error('[pages] createPageServerFirst failed:', e);
        return { success: false, error: `Database write failed — ${describeError(e)}` };
    }
}

/**
 * Server-first page property update.
 * Updates a single page's properties in Postgres and returns the updated page.
 */
export async function updatePageServerFirst(
    pageId: string,
    properties: Record<string, PropertyValue>
): Promise<{ success: true; page: Page } | { success: false; error: string; errorCode?: string; blockedFields?: string[]; docTitle?: string; propertyLabels?: Record<string, string> }> {
    const session = await auth();
    const tenantId = session?.user?.tenantId;
    if (!tenantId) return { success: false, error: 'Not authenticated' };
    // pd.md 4y — workforce reaches the WorkHub and nothing else; the ERP database doors are closed to it
    // (a crew phone held the tenant's database ids and could call these by hand — incl. deleting a database).
    if (isWorkforceRole((session?.user as { role?: string } | undefined)?.role)) return { success: false, error: 'Forbidden: workforce' };

    try {
        // R2-1: through the one record door, on the session's scoped client — the given fields are written onto the
        // CURRENT row (the others stay as they are); the locks are the door's; the persisted row is returned.
        const db = await scopeFromSession();
        const before = await db.globalPage.findFirst({ where: { id: pageId }, select: { properties: true, database: { select: { logicalKey: true } } } });
        if (!before) return { success: false, error: 'Page not found' };

        const r = await saveRecord(db, { pageId, fields: properties as Record<string, unknown> }, { by: 'user' });
        if (!r.ok) {
            const code = r.refusal.code;
            if (code === 'EXPORT_LOCKED' || code === 'DOCUMENT_LOCKED') {
                const propertyLabels: Record<string, string> = {};
                for (const prop of r.dbProperties || []) if (prop.id && prop.name) propertyLabels[prop.id] = prop.name;
                return {
                    success: false,
                    error: code === 'DOCUMENT_LOCKED' ? '[DocumentLocked]' : '[ExportLocked]',
                    errorCode: code,
                    blockedFields: 'blockedFields' in r.refusal ? r.refusal.blockedFields : [],
                    docTitle: String(r.server?.properties?.title || (properties as Record<string, unknown>).title || ''),
                    propertyLabels,
                };
            }
            return { success: false, error: code === 'NOT_FOUND' ? 'Page not found' : code, errorCode: code };
        }

        const saved = await db.globalPage.findFirst({ where: { id: pageId } });
        if (!saved) return { success: false, error: 'Page not found' };
        const role = (before.database?.logicalKey as SystemDatabaseRole) || null;

        // Automation Trigger: If Quote status changed to ACCEPTED, create Project
        const oldStatus = (before.properties as Record<string, unknown>)?.status;
        const newStatus = (saved.properties as Record<string, unknown>)?.status;
        const isQuoteDb = role === 'quotations';

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
            // R2-1-FABRICATED-PAGE: the row's REAL blocks and version — a hard-coded [] / 1 here wiped the
            // document's lines in any store that adopted this page (Peppol send, receipt scan) and reset OCC.
            blocks: (Array.isArray(saved.blocks) ? saved.blocks : []) as unknown as Page['blocks'],
            blocksVersion: saved.blocksVersion,
            createdAt: saved.createdAt.toISOString(),
            updatedAt: saved.updatedAt.toISOString(),
            createdBy: saved.createdBy,
            lastEditedBy: saved.lastEditedBy,
        };

        // --- Matching Logic for Incoming Payments ---
        if (role === 'payments-in') {
            await handlePaymentMatching(tenantId, page);
        }

        return { success: true, page };
    } catch (e: unknown) {
        console.error('[pages] updatePageServerFirst failed:', e);
        return { success: false, error: `Update failed — ${describeError(e)}` };
    }
}

/**
 * Auto-matches payments to invoices.
 */
async function handlePaymentMatching(tenantId: string, paymentPage: Page) {
    try {
        // PAY-1: through the seraph's session scope — a payment can only link to, and change the status of,
        // an invoice of THIS tenant, whatever id its properties carry (R2-1-CENSUS #6/#7/#8).
        const db = await scopeFromSession();
        const props = paymentPage.properties;
        const ogm = typeof props.structuredComm === 'string' ? props.structuredComm.trim() : null;
        const amount = typeof props.amount === 'number' ? props.amount : null;
        const clientId = typeof props.client === 'string' ? props.client : (Array.isArray(props.client) && props.client.length > 0 ? props.client[0] : null);
        const paymentInvoiceId = Array.isArray(props.invoice) && props.invoice.length > 0 ? props.invoice[0] : (typeof props.invoice === 'string' ? props.invoice : null);

        // If it's already explicitly linked to an invoice by the user, we should recalculate the invoice totals
        if (paymentInvoiceId) {
            await syncInvoicePaymentStatus(db, tenantId, paymentInvoiceId, 'system:payment-match');
            return;
        }

        const allInvoices = await db.globalPage.findMany({
            where: { database: { logicalKey: 'invoices' } }
        });

        if (ogm) {
            // Exact OGM match
            const matchedInvoice = allInvoices.find(inv => {
                const invProps = inv.properties as Record<string, unknown>;
                return typeof invProps.structuredComm === 'string' && invProps.structuredComm.replace(/\\s/g, '') === ogm.replace(/\\s/g, '');
            });

            if (matchedInvoice) {
                // Link payment to invoice
                const newProps = { ...paymentPage.properties, invoice: [matchedInvoice.id] };
                await db.globalPage.update({
                    where: { id: paymentPage.id },
                    data: { 
                        properties: newProps as Prisma.InputJsonValue,
                        lastEditedBy: 'system:payment-match'
                    }
                });
                await syncInvoicePaymentStatus(db, tenantId, matchedInvoice.id, 'system:payment-match');
                return;
            }
        }

        // Fallback: Suggest match by amount + client
        if (amount && clientId) {
            const suggestedInvoice = allInvoices.find(inv => {
                const invProps = inv.properties as Record<string, unknown>;
                const invStatus = invProps.status;
                if (invStatus === 'opt-paid') return false; // Ignore paid invoices
                
                const invAmount = Number(invProps.totalIncVat) || 0;
                const invClientId = Array.isArray(invProps.client) ? invProps.client[0] : invProps.client;

                // Match if amount is within 1 cent and client matches
                return invClientId === clientId && Math.abs(invAmount - amount) < 0.01;
            });

            if (suggestedInvoice) {
                // Set suggestedInvoice field
                const newProps = { ...paymentPage.properties, suggestedInvoice: [suggestedInvoice.id] };
                await db.globalPage.update({
                    where: { id: paymentPage.id },
                    data: { 
                        properties: newProps as Prisma.InputJsonValue,
                        lastEditedBy: 'system:payment-match'
                    }
                });
            }
        }
    } catch (e) {
        console.error('[handlePaymentMatching] Error:', e);
    }
}

// recalculateInvoiceStatus → lib/data/invoice-payments.ts syncInvoicePaymentStatus (PAY-1: one rule, scoped).

