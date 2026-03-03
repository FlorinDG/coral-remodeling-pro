const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const contents = await prisma.siteContent.findMany();
    console.log(JSON.stringify(contents, null, 2));

    const services = await prisma.cMS_Service.findMany();
    console.log(JSON.stringify(services, null, 2));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
