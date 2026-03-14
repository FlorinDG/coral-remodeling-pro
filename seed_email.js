const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.connectedEmailAccount.upsert({
    where: { email: 'tfo@coral-group.be' },
    update: {
      password: 'F0rtun@F0rt1$!',
      imapHost: 'imap.gmail.com',
      imapPort: 993,
      smtpHost: 'smtp.gmail.com',
      smtpPort: 465,
      isActive: true
    },
    create: {
      email: 'tfo@coral-group.be',
      password: 'F0rtun@F0rt1$!',
      imapHost: 'imap.gmail.com',
      imapPort: 993,
      smtpHost: 'smtp.gmail.com',
      smtpPort: 465,
      isActive: true
    }
  });
  console.log("Seeded successfully");
}

main().catch(console.error).finally(() => prisma.$disconnect());
