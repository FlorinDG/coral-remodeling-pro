/**
 * SCHEMA-1b: Data-safe merge of duplicate system databases.
 *
 * GET  ?mode=dry-run  → JSON report of duplicates + planned actions (no mutations)
 * POST ?mode=execute  → performs the merge (SuperAdmin only, after dry-run reviewed)
 *
 * Safety constraints:
 * 1. NEVER delete a GlobalDatabase that still has pages
 * 2. Page count before == page count after (verified per tenant)
 * 3. SuperAdmin-only
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';
import { PLATFORM_ADMIN_ROLES } from '@/lib/roles';
import { getBaseDbId, isSystemDatabase } from '@/lib/systemDatabases';
import { provisionLockedDatabases, LOCKED_DB_BASES } from '@/lib/provisionTenantDbs';
import { BASE_TO_KEY } from '@/lib/lockedDbUtils';

export const dynamic = 'force-dynamic';

// Garbage database names to clean up (only if they have 0 pages)
const GARBAGE_NAMES = ['New Workspace', 'New Database'];

interface DuplicateGroup {
    basePrefix: string;
    canonical: { id: string; name: string; pageCount: number };
    duplicates: { id: string; name: string; pageCount: number; pagesToMigrate: number }[];
    totalPagesMigrating: number;
}

interface GarbageDb {
    id: string;
    name: string;
    pageCount: number;
    safe: boolean; // true = can delete (0 pages)
}

interface TenantReport {
    tenantId: string;
    companyName: string;
    totalDbsBefore: number;
    totalDbsAfter: number;
    totalPagesBefore: number;
    totalPagesAfter: number;
    duplicateGroups: DuplicateGroup[];
    garbageDbs: GarbageDb[];
    lockedDbIdsFixes: { key: string; oldValue: string; newValue: string }[];
    provisionedMissing: string[];
    errors: string[];
}

interface FullReport {
    mode: 'dry-run' | 'execute';
    timestamp: string;
    tenantsScanned: number;
    tenantsWithIssues: number;
    totalDuplicateGroups: number;
    totalPagesMigrated: number;
    totalDbsRemoved: number;
    totalGarbageRemoved: number;
    tenants: TenantReport[];
}

async function buildReport(): Promise<FullReport> {
    const tenants = await prisma.tenant.findMany({
        select: {
            id: true,
            companyName: true,
            lockedDbIds: true,
        },
    });

    const report: FullReport = {
        mode: 'dry-run',
        timestamp: new Date().toISOString(),
        tenantsScanned: tenants.length,
        tenantsWithIssues: 0,
        totalDuplicateGroups: 0,
        totalPagesMigrated: 0,
        totalDbsRemoved: 0,
        totalGarbageRemoved: 0,
        tenants: [],
    };

    for (const tenant of tenants) {
        const lockedDbIds = (tenant.lockedDbIds as Record<string, string>) || {};
        const suffix = tenant.id.slice(0, 8);

        // Fetch all GlobalDatabases for this tenant with page counts
        const dbs = await prisma.globalDatabase.findMany({
            where: { tenantId: tenant.id },
            select: {
                id: true,
                name: true,
                _count: { select: { pages: true } },
            },
        });

        const totalPagesBefore = dbs.reduce((sum, db) => sum + db._count.pages, 0);

        const tenantReport: TenantReport = {
            tenantId: tenant.id,
            companyName: tenant.companyName || 'Unknown',
            totalDbsBefore: dbs.length,
            totalDbsAfter: dbs.length, // decremented as we find removals
            totalPagesBefore,
            totalPagesAfter: totalPagesBefore, // must stay equal
            duplicateGroups: [],
            garbageDbs: [],
            lockedDbIdsFixes: [],
            provisionedMissing: [],
            errors: [],
        };

        // ── 1. Classify databases ──

        // Group system DBs by base prefix
        const systemGroups = new Map<string, typeof dbs>();
        const garbageCandidates: typeof dbs = [];

        for (const db of dbs) {
            if (isSystemDatabase(db.id)) {
                const base = getBaseDbId(db.id);
                const group = systemGroups.get(base) || [];
                group.push(db);
                systemGroups.set(base, group);
            } else if (GARBAGE_NAMES.includes(db.name)) {
                garbageCandidates.push(db);
            }
            // else: user-created custom DB, leave alone
        }

        // ── 2. Check for missing canonicals that need provisioning ──
        // If a provisioned base (e.g. db-payments-in) exists as a duplicate
        // but the proper scoped ID (db-payments-in-{suffix}) doesn't exist yet,
        // we'll need to provision it first during execute.

        for (const base of LOCKED_DB_BASES) {
            const scopedId = `${base}-${suffix}`;
            const key = BASE_TO_KEY[base];
            const group = systemGroups.get(base);

            if (group && group.length > 0) {
                // There's at least one DB for this base — check if the canonical scoped ID exists
                const hasCanonical = group.some(db => db.id === scopedId) || lockedDbIds[key] === scopedId;
                if (!hasCanonical && !group.some(db => db.id === lockedDbIds[key])) {
                    // Neither the scoped ID nor the locked ID exists in the group
                    // We'll need to provision it during execute
                    tenantReport.provisionedMissing.push(scopedId);
                }
            }
        }

        // ── 3. Detect duplicate system DB groups ──

        for (const [base, group] of systemGroups.entries()) {
            if (group.length <= 1) continue; // no duplicate

            // Pick canonical: prefer the one in lockedDbIds
            const lockedId = Object.values(lockedDbIds).find(v => getBaseDbId(v) === base);
            let canonical = group.find(db => db.id === lockedId);

            if (!canonical) {
                // Prefer the properly-suffixed one (e.g. db-invoices-cmneyas2)
                const scopedId = `${base}-${suffix}`;
                canonical = group.find(db => db.id === scopedId);
            }

            if (!canonical) {
                // Fallback: the one with the most pages
                canonical = [...group].sort((a, b) => b._count.pages - a._count.pages)[0];
            }

            const duplicates = group.filter(db => db.id !== canonical!.id);
            const totalMigrating = duplicates.reduce((sum, db) => sum + db._count.pages, 0);

            tenantReport.duplicateGroups.push({
                basePrefix: base,
                canonical: {
                    id: canonical!.id,
                    name: canonical!.name,
                    pageCount: canonical!._count.pages,
                },
                duplicates: duplicates.map(db => ({
                    id: db.id,
                    name: db.name,
                    pageCount: db._count.pages,
                    pagesToMigrate: db._count.pages,
                })),
                totalPagesMigrating: totalMigrating,
            });

            tenantReport.totalDbsAfter -= duplicates.length;
            report.totalDuplicateGroups++;
            report.totalPagesMigrated += totalMigrating;
            report.totalDbsRemoved += duplicates.length;
        }

        // ── 4. Detect lockedDbIds that need fixing ──

        for (const [key, value] of Object.entries(lockedDbIds)) {
            const base = getBaseDbId(value);
            const group = systemGroups.get(base);
            if (!group) continue;

            // Find the canonical for this base
            const dupGroup = tenantReport.duplicateGroups.find(g => g.basePrefix === base);
            if (dupGroup && value !== dupGroup.canonical.id) {
                tenantReport.lockedDbIdsFixes.push({
                    key,
                    oldValue: value,
                    newValue: dupGroup.canonical.id,
                });
            }
        }

        // ── 5. Detect garbage databases ──

        for (const db of garbageCandidates) {
            const isSafe = db._count.pages === 0;
            tenantReport.garbageDbs.push({
                id: db.id,
                name: db.name,
                pageCount: db._count.pages,
                safe: isSafe,
            });
            if (isSafe) {
                tenantReport.totalDbsAfter--;
                report.totalGarbageRemoved++;
            }
        }

        // Only include tenants with issues in the report
        const hasIssues = tenantReport.duplicateGroups.length > 0
            || tenantReport.garbageDbs.length > 0
            || tenantReport.provisionedMissing.length > 0;
        if (hasIssues) {
            report.tenantsWithIssues++;
            report.tenants.push(tenantReport);
        }
    }

    return report;
}

async function executeCleanup(): Promise<FullReport> {
    // ── Phase 1: Preliminary scan — find tenants that need provisioning ──
    const prelimReport = await buildReport();

    // ── Phase 2: Provision missing canonicals BEFORE re-scanning ──
    // Creates proper scoped IDs (e.g. db-payments-in-cmneyas2) so the
    // canonical selection in Phase 3 will find them.
    for (const tenantReport of prelimReport.tenants) {
        if (tenantReport.provisionedMissing.length > 0) {
            try {
                await provisionLockedDatabases(tenantReport.tenantId, prisma);
            } catch (e) {
                console.error(`[SCHEMA-1b] Provision failed for ${tenantReport.tenantId}:`, e);
            }
        }
    }

    // ── Phase 3: Rebuild report with fresh state and execute ──
    const report = await buildReport();
    report.mode = 'execute';

    for (const tenantReport of report.tenants) {
        try {
            // ── Migrate pages from duplicates → canonical ──
            for (const group of tenantReport.duplicateGroups) {
                // Verify canonical exists
                const canonicalExists = await prisma.globalDatabase.findUnique({
                    where: { id: group.canonical.id },
                    select: { id: true },
                });

                if (!canonicalExists) {
                    tenantReport.errors.push(
                        `SAFETY ABORT: Canonical ${group.canonical.id} does not exist — cannot migrate`
                    );
                    continue;
                }

                for (const dup of group.duplicates) {
                    if (dup.pagesToMigrate > 0) {
                        const result = await prisma.globalPage.updateMany({
                            where: { databaseId: dup.id },
                            data: { databaseId: group.canonical.id },
                        });

                        if (result.count !== dup.pagesToMigrate) {
                            tenantReport.errors.push(
                                `MIGRATION MISMATCH: ${dup.id} → ${group.canonical.id}: expected ${dup.pagesToMigrate}, migrated ${result.count}`
                            );
                        }
                    }

                    // Verify empty before deleting
                    const remaining = await prisma.globalPage.count({
                        where: { databaseId: dup.id },
                    });

                    if (remaining > 0) {
                        tenantReport.errors.push(
                            `SAFETY ABORT: ${dup.id} still has ${remaining} pages — NOT deleting`
                        );
                        continue;
                    }

                    await prisma.globalDatabase.delete({ where: { id: dup.id } });
                }
            }

            // ── Fix lockedDbIds ──
            if (tenantReport.lockedDbIdsFixes.length > 0) {
                const currentTenant = await prisma.tenant.findUnique({
                    where: { id: tenantReport.tenantId },
                    select: { lockedDbIds: true },
                });
                const lockedDbIds = (currentTenant?.lockedDbIds as Record<string, string>) || {};

                for (const fix of tenantReport.lockedDbIdsFixes) {
                    lockedDbIds[fix.key] = fix.newValue;
                }

                await prisma.tenant.update({
                    where: { id: tenantReport.tenantId },
                    data: { lockedDbIds },
                });
            }

            // ── Delete garbage DBs (only if empty) ──
            for (const garbage of tenantReport.garbageDbs) {
                if (!garbage.safe) {
                    tenantReport.errors.push(
                        `SAFETY: Garbage DB ${garbage.id} ("${garbage.name}") has ${garbage.pageCount} pages — NOT deleting`
                    );
                    continue;
                }

                await prisma.globalDatabase.delete({ where: { id: garbage.id } });
            }

            // ── Verify page count integrity ──
            const totalPagesAfter = await prisma.globalPage.count({
                where: { database: { tenantId: tenantReport.tenantId } },
            });

            tenantReport.totalPagesAfter = totalPagesAfter;

            if (totalPagesAfter !== tenantReport.totalPagesBefore) {
                tenantReport.errors.push(
                    `PAGE COUNT MISMATCH: before=${tenantReport.totalPagesBefore}, after=${totalPagesAfter} — DATA LOSS RISK`
                );
            }
        } catch (error) {
            tenantReport.errors.push(
                `EXECUTION ERROR: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    return report;
}

export async function GET(request: Request) {
    const session = await auth();
    const role = session?.user?.role;
    if (!role || !PLATFORM_ADMIN_ROLES.includes(role as any)) {
        return NextResponse.json({ error: 'Forbidden — SuperAdmin only' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode');

    if (mode !== 'dry-run') {
        return NextResponse.json({ error: 'GET requires ?mode=dry-run' }, { status: 400 });
    }

    const report = await buildReport();
    return NextResponse.json(report, { status: 200 });
}

export async function POST(request: Request) {
    const session = await auth();
    const role = session?.user?.role;
    if (!role || !PLATFORM_ADMIN_ROLES.includes(role as any)) {
        return NextResponse.json({ error: 'Forbidden — SuperAdmin only' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode');

    if (mode !== 'execute') {
        return NextResponse.json({ error: 'POST requires ?mode=execute' }, { status: 400 });
    }

    const report = await executeCleanup();
    return NextResponse.json(report, { status: 200 });
}
