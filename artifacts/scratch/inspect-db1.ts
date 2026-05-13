import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const db = await prisma.globalDatabase.findUnique({
        where: { id: 'db-1' },
        select: { properties: true }
    });
    console.log(JSON.stringify(db?.properties, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
