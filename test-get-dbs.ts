import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const dbs = await prisma.globalDatabase.findMany({
      where: { tenantId: 'cmneyas2b0000veqvkgl2luz1' },
      include: { pages: true },
      orderBy: { createdAt: 'desc' }
  });

  const db1 = dbs.find(d => d.id === 'db-1');
  console.log('db-1 pages count:', db1?.pages?.length);
}
main().finally(() => prisma.$disconnect());
