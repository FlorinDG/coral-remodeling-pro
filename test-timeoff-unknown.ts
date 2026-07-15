import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const reqs = await prisma.timeOffRequest.findMany({
    where: { startDate: 'Unknown Date' }
  });
  console.log("Unknown Date count:", reqs.length);
}
main().catch(console.error).finally(() => prisma.$disconnect());
