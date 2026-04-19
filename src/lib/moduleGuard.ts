/**
 * moduleGuard.ts — SERVER ONLY
 *
 * Enforces module-level access control in server actions.
 * Reads activeModules directly from DB (not JWT) to avoid stale-token window.
 *
 * Usage at the top of any server action:
 *   const tenantId = await verifyModuleAccess('INVOICING');
 *
 * Returns tenantId on success, throws on unauthorized or missing module.
 */

import { auth } from '@/auth';
import prisma from '@/lib/prisma';

export const MODULE_ROUTE_MAP: Record<string, string> = {
    'financials': 'INVOICING',
    'quotations': 'INVOICING',
    'suppliers':  'INVOICING',
    'contacts':   'CRM',
    'projects-management': 'PROJECTS',
    'hr':         'HR',
    'databases':  'DATABASES',
    'calendar':   'CALENDAR',
    'websites':   'WEBSITES',
    'library':    'INVOICING',
};

/**
 * Verify that the current session's tenant has the given module active.
 * Returns tenantId on success.
 * Throws with a clear message on unauthorized or module-not-active.
 */
export async function verifyModuleAccess(requiredModule: string): Promise<string> {
    const session = await auth();
    const tenantId = (session?.user as any)?.tenantId as string | undefined;

    if (!tenantId) {
        throw new Error('Unauthorized — no active session');
    }

    const tenant = await prisma.tenant.findUnique({
        where:  { id: tenantId },
        select: { activeModules: true, planType: true },
    });

    if (!tenant) {
        throw new Error('Unauthorized — tenant not found');
    }

    // SUPERADMIN / PLATFORM_ADMIN bypass — they can do everything
    const role = (session?.user as any)?.role as string;
    if (['SUPERADMIN', 'PLATFORM_ADMIN'].includes(role)) {
        return tenantId;
    }

    if (!tenant.activeModules.includes(requiredModule)) {
        throw new Error(
            `Access denied — module '${requiredModule}' is not active on your ${tenant.planType} plan. ` +
            `Upgrade to enable this feature.`
        );
    }

    return tenantId;
}

/**
 * Lightweight version for actions that only need tenantId + auth check,
 * no module requirement.
 */
export async function verifyAuth(): Promise<string> {
    const session = await auth();
    const tenantId = (session?.user as any)?.tenantId as string | undefined;
    if (!tenantId) throw new Error('Unauthorized — no active session');
    return tenantId;
}
