import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const dbs = await prisma.globalDatabase.findMany({
        select: { id: true, name: true, tenantId: true }
    });
    console.log(JSON.stringify(dbs, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
