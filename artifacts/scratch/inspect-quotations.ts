import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const db = await prisma.globalDatabase.findFirst({
        where: { id: { startsWith: 'db-quotations' } },
        select: { id: true, properties: true }
    });
    console.log(JSON.stringify(db, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
