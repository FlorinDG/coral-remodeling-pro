import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const quote = await prisma.globalPage.findUnique({
        where: { id: "34959faa-bcad-4af7-a1bb-583edf3d3a8d" }
    });
    console.log("QUOTE PROPERTIES:");
    console.log(JSON.stringify(quote?.properties, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
