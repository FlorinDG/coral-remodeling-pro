import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const user = await prisma.user.findUnique({
        where: { email: 'free@coral-group.be' }
    });
    if (user && user.tenantId) {
        await prisma.tenant.update({
            where: { id: user.tenantId },
            data: { activeModules: ['INVOICING'] }
        });
        console.log('✅ Forcefully reset Free Tier tenant activeModules to ONLY ["INVOICING"]');
    } else {
        console.log('User free@coral-group.be not found');
    }
}
main().finally(() => prisma.$disconnect());
