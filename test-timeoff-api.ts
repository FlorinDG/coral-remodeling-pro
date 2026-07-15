import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const model = prisma.timeOffRequest;
  const records = await model.findMany({
      orderBy: { createdAt: 'desc' },
  });
  console.log(JSON.stringify(records[0], null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
