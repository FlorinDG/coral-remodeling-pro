import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const allReqs = await prisma.timeOffRequest.findMany();
  console.log("All requests:");
  allReqs.forEach(r => console.log(r.id, r.startDate, r.endDate));
}
main().catch(console.error).finally(() => prisma.$disconnect());
