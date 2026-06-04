import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
})

async function main() {
    console.log('Connecting to database...')
    const count = await prisma.user.count()
    console.log(`Success! Users in DB: ${count}`)
}

main()
    .catch((e) => {
        console.error('Error connecting:', e.message)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
