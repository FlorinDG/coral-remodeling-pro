import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Testing clock-entries fetch...");
    // Grab the first clock entry to get the tenantId
    const firstEntry = await prisma.clockEntry.findFirst();
    if (!firstEntry) {
        console.log("No clock entries at all.");
        return;
    }
    const tenantId = firstEntry.tenantId;

    const where: any = { tenantId };

    const records = await prisma.clockEntry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
    });

    console.log(`Found ${records.length} records in tenant ${tenantId}.`);
    
    // Test the enrichment logic
    const userIds = [...new Set(records.map((r: any) => r.userId).filter(Boolean))] as string[];
    console.log("User IDs extracted:", userIds);
    
    if (userIds.length > 0) {
        const users = await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, email: true }
        });
        const employees = await prisma.employee.findMany({
            where: { userId: { in: userIds } },
            select: { userId: true, firstName: true, lastName: true }
        });
        
        console.log(`Found ${users.length} users and ${employees.length} employees matching.`);
    }

}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
