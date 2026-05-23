import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany();
    for (const u of users) {
        if (u.name && u.name.includes('  ')) {
            const cleanName = u.name.replace(/\s+/g, ' ').trim();
            await prisma.user.update({
                where: { id: u.id },
                data: { name: cleanName },
            });
            console.log(`Cleaned up name for user ${u.id}: "${u.name}" -> "${cleanName}"`);
        }
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
