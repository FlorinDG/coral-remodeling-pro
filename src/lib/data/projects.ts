/**
 * PROJ-SSOT-1 phase 1 · ONE project resolver (coder-directive-proj-ssot-1-retire-hrproject.md).
 *
 * Four readers resolved project names from `HrProject` — a table with zero rows — so the accountant
 * export printed "Unknown Project", the by-project report grouped nothing, and the shift list and
 * brief could not name a project. They all read this now.
 *
 * Sources (PROJ-0 decides between them; this does NOT unify them — the split is narrowed, not closed):
 *   - pages of the tenant's projects database
 *   - InternalProject
 *
 * The projects database is the tenant's BOUND one (R1-2, census 32/32 OK 2026-10-04): no binding → no
 * dynamic projects (the old `|| 'db-1'` named BV Coral's database). The query stays constrained to
 * `database.tenantId`.
 */
import prisma from '@/lib/prisma';

export interface ProjectRef {
    id: string;
    name: string;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
    source: 'dynamic' | 'internal';
    createdAt: Date;
}

/** All projects of a tenant — or only `onlyIds` (the non-admin reach filter is the CALLER's decision). */
export async function resolveProjects(tenantId: string, opts?: { onlyIds?: string[] }): Promise<ProjectRef[]> {
    if (!tenantId) throw new Error('resolveProjects: no tenant');
    if (opts?.onlyIds && opts.onlyIds.length === 0) return [];

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { lockedDbIds: true } });
    const locked = (tenant?.lockedDbIds as Record<string, string> | null) || {};
    const projectDbId = locked['projects'] || null;
    const idFilter = opts?.onlyIds ? { id: { in: opts.onlyIds } } : {};

    const [pages, internal] = await Promise.all([
        projectDbId
            ? prisma.globalPage.findMany({
                where: { databaseId: projectDbId, database: { tenantId }, ...idFilter },
                select: { id: true, properties: true, createdAt: true },
            })
            : Promise.resolve([]),
        prisma.internalProject.findMany({
            where: { tenantId, ...idFilter },
            select: { id: true, name: true, projectCode: true, createdAt: true },
        }),
    ]);

    return [
        ...pages.map(p => {
            const props = (p.properties || {}) as Record<string, unknown>;
            const loc = props['location'] as { address?: string; lat?: number; lng?: number } | undefined;
            return {
                id: p.id,
                name: String(props.title || props.name || 'Untitled').replace(/^\[ERP\]\s*/i, '').trim() || 'Untitled',
                address: loc?.address || (typeof props.address === 'string' ? props.address : null) || null,
                latitude: loc?.lat ?? null,
                longitude: loc?.lng ?? null,
                source: 'dynamic' as const,
                createdAt: p.createdAt,
            };
        }),
        ...internal.map(p => ({
            id: p.id,
            name: `${p.projectCode}: ${p.name}`,
            address: null,
            latitude: null,
            longitude: null,
            source: 'internal' as const,
            createdAt: p.createdAt,
        })),
    ];
}

/** id → display name, for readers that only need the label. */
export async function projectNameMap(tenantId: string, ids?: string[]): Promise<Map<string, string>> {
    const list = await resolveProjects(tenantId, ids ? { onlyIds: Array.from(new Set(ids)) } : undefined);
    return new Map(list.map(p => [p.id, p.name]));
}
