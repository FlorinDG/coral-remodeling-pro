import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const reqs = await prisma.timeOffRequest.findMany({ take: 1 });
  console.log(reqs);
}
main().catch(console.error).finally(() => prisma.$disconnect());
