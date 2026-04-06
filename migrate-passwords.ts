import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🔐 Migrating plaintext passwords to bcrypt...');

    // Find all users with plaintext passwords (not starting with $2)
    const users = await prisma.user.findMany({
        where: {
            password: { not: null }
        },
        select: { id: true, email: true, password: true, emailVerified: true }
    });

    let migrated = 0;
    for (const user of users) {
        if (user.password && !user.password.startsWith('$2')) {
            const hashed = await bcrypt.hash(user.password, 12);
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    password: hashed,
                    // Also mark as verified since these are existing users
                    emailVerified: user.emailVerified || new Date(),
                }
            });
            console.log(`  ✅ Migrated: ${user.email}`);
            migrated++;
        } else {
            console.log(`  ⏭️  Skipped (already hashed): ${user.email}`);
        }
    }

    console.log(`\n🔐 Done. Migrated ${migrated} passwords.`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
