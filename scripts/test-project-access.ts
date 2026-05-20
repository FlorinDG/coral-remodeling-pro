import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testProjectAccess() {
    console.log('🏁 Starting Project Access database validation test...');

    // We will use user: 'cmp2iaw2g0002l104kmy5sky6' and tenantId: 'cmp2iavx50000l104clo7gv3n' for testing
    const testUserId = 'cmp2iaw2g0002l104kmy5sky6';
    const testTenantId = 'cmp2iavx50000l104clo7gv3n';

    // Verify the user and tenant exist in the database
    const user = await prisma.user.findFirst({
        where: { id: testUserId, tenantId: testTenantId }
    });

    if (!user) {
        throw new Error(`Test user ${testUserId} with tenant ${testTenantId} does not exist in the database.`);
    }
    console.log(`✅ Test user verified: ${user.email} (${user.role})`);

    const dummyProjectIds = ['proj-e2e-1', 'proj-e2e-2'];

    // 1. Perform atomic update (mirroring PUT handler in /api/tenant/project-access/route.ts)
    console.log('1. Simulating PUT request to update project access...');
    await prisma.$transaction([
        prisma.userProjectAccess.deleteMany({
            where: { tenantId: testTenantId, userId: testUserId },
        }),
        prisma.userProjectAccess.createMany({
            data: dummyProjectIds.map(pid => ({
                tenantId: testTenantId,
                userId: testUserId,
                projectId: pid,
            })),
            skipDuplicates: true,
        }),
    ]);
    console.log('   ✓ PUT simulation transaction completed');

    // 2. Fetch the records (mirroring GET handler in /api/tenant/project-access/route.ts)
    console.log('2. Simulating GET request to read project access...');
    const rows = await prisma.userProjectAccess.findMany({
        where: { tenantId: testTenantId, userId: testUserId },
        select: { projectId: true },
    });
    const fetchedProjectIds = rows.map((r: { projectId: string }) => r.projectId);
    console.log(`   ✓ Fetched project IDs: ${JSON.stringify(fetchedProjectIds)}`);

    // Assert that the written IDs match the expected IDs
    const allMatched = dummyProjectIds.every(id => fetchedProjectIds.includes(id)) && 
                       fetchedProjectIds.length === dummyProjectIds.length;
    
    if (!allMatched) {
        throw new Error(`Data mismatch! Expected ${JSON.stringify(dummyProjectIds)}, got ${JSON.stringify(fetchedProjectIds)}`);
    }
    console.log('✅ Assertion passed: Written and read project IDs match exactly.');

    // 3. Clean up the database
    console.log('3. Cleaning up test data...');
    const deleteResult = await prisma.userProjectAccess.deleteMany({
        where: { tenantId: testTenantId, userId: testUserId }
    });
    console.log(`   ✓ Cleanup completed. Deleted ${deleteResult.count} rows.`);

    // 4. Verify clean up
    const finalCheck = await prisma.userProjectAccess.count({
        where: { tenantId: testTenantId, userId: testUserId }
    });
    if (finalCheck !== 0) {
        throw new Error(`Cleanup failed! User still has ${finalCheck} assigned projects.`);
    }
    console.log('✅ Final validation: User has 0 assigned projects. DB state is clean.');
    console.log('🎉 All project assignment database transaction tests PASSED successfully!');
}

testProjectAccess()
    .catch((error) => {
        console.error('❌ Test failed:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
