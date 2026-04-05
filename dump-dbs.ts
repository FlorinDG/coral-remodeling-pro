import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function main() {
    const dbs = await prisma.globalDatabase.findMany({
        where: { tenantId: 'cmneyas2b0000veqvkgl2luz1' }
    });

    fs.writeFileSync('blueprint.json', JSON.stringify(dbs, null, 2));
    console.log(`Dumped ${dbs.length} master databases to blueprint.json`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
