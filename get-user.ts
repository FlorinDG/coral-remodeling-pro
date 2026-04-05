import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    let user = await prisma.user.findFirst({ where: { role: 'admin' } });
    if (!user) {
        user = await prisma.user.findFirst();
    }
    if (!user) {
        console.log("No users found. Creating one...");
        user = await prisma.user.create({
            data: {
                email: 'test@example.com',
                name: 'Test Admin',
                password: 'password123',
                role: 'admin',
            }
        });
    }
    console.log("TEST_USER_EMAIL=" + user.email);
    console.log("TEST_USER_PASSWORD=" + user.password);
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
