const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findUnique({
    where: { id: 'cmneyas2b0000veqvkgl2luz1' },
    select: { lockedDbIds: true }
  });
  console.log(tenant);
}

main().catch(console.error).finally(() => prisma.$disconnect());
