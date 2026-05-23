import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log("Checking passwords of all users...");
    const users = await prisma.user.findMany({
        select: {
            id: true,
            email: true,
            name: true,
            password: true,
        }
    });

    users.forEach(u => {
        const hasPassword = u.password !== null && u.password !== undefined && u.password !== '';
        console.log(`- Email: ${u.email}`);
        console.log(`  Name: ${u.name}`);
        console.log(`  Has Password field set: ${hasPassword}`);
        if (hasPassword) {
            console.log(`  Password hash: ${u.password?.substring(0, 15)}...`);
        }
    });
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
