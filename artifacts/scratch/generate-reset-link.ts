import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
    const emailInput = process.argv[2] || 'florin.t@coral-group.be';
    const normalizedEmail = emailInput.toLowerCase().trim();

    console.log(`Generating password reset token for: ${normalizedEmail}`);

    const user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: {
            id: true,
            email: true,
            passwordResetToken: true,
            passwordResetExpires: true
        }
    });

    if (!user) {
        console.error(`Error: User with email "${normalizedEmail}" not found in database.`);
        process.exit(1);
    }

    const rawToken = crypto.randomUUID();
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
        where: { id: user.id },
        data: {
            passwordResetToken: hashedToken,
            passwordResetExpires: expires
        },
        select: {
            id: true,
            email: true
        }
    });

    console.log("\nToken successfully set in database!");
    console.log(`Hashed Token: ${hashedToken}`);
    console.log(`Expires: ${expires}`);
    
    console.log("\n--- RESET URLS ---");
    console.log(`Production URL (from env/defaults):`);
    console.log(`https://app.coral-group.be/reset-password?token=${rawToken}&email=${encodeURIComponent(normalizedEmail)}`);
    console.log(`\nLocal Development URL (Port 3000):`);
    console.log(`http://localhost:3000/reset-password?token=${rawToken}&email=${encodeURIComponent(normalizedEmail)}`);
    console.log(`\nLocal Development URL (Port 3001):`);
    console.log(`http://localhost:3001/reset-password?token=${rawToken}&email=${encodeURIComponent(normalizedEmail)}`);
    console.log("------------------\n");
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
