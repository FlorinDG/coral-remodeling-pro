/**
 * prisma/scripts/migrate-roles.ts
 * ─────────────────────────────────────────────────────────────────
 * One-time migration: TENANT_ADMIN → APP_MANAGER
 *
 * Usage:
 *   Dry run (safe, no writes):  npx tsx prisma/scripts/migrate-roles.ts
 *   Apply:                      npx tsx prisma/scripts/migrate-roles.ts --execute
 *   Rollback:                   npx tsx prisma/scripts/migrate-roles.ts --rollback
 * ─────────────────────────────────────────────────────────────────
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const args   = process.argv.slice(2);
const DRY    = !args.includes('--execute') && !args.includes('--rollback');
const ROLL   = args.includes('--rollback');

async function main() {
    const FROM = ROLL ? 'APP_MANAGER'  : 'TENANT_ADMIN';
    const TO   = ROLL ? 'TENANT_ADMIN' : 'APP_MANAGER';

    // Count affected rows first
    const affected = await prisma.user.count({ where: { role: FROM } });

    console.log(`\n── CoralOS Role Migration ──────────────────────`);
    console.log(`  ${FROM} → ${TO}`);
    console.log(`  Affected rows: ${affected}`);

    if (affected === 0) {
        console.log(`  Nothing to migrate. Exiting.\n`);
        return;
    }

    if (DRY) {
        console.log(`\n  DRY RUN — no changes made.`);
        console.log(`  Run with --execute to apply.\n`);
        return;
    }

    const result = await prisma.user.updateMany({
        where: { role: FROM },
        data:  { role: TO   },
    });

    console.log(`\n  ✓ Updated ${result.count} rows: ${FROM} → ${TO}`);

    // Verify
    const verify = await prisma.user.groupBy({ by: ['role'], _count: { role: true } });
    console.log(`  Roles after migration:`, JSON.stringify(verify));
    console.log();
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
