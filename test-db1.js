const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const dbs = await prisma.globalDatabase.findMany({
    where: { id: { startsWith: 'db-1' } },
    include: { _count: { select: { pages: true } } }
  });
  console.log("Projects databases found:", dbs.map(d => ({ id: d.id, tenantId: d.tenantId, pageCount: d._count.pages, ownerId: d.ownerId })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
