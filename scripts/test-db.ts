import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    try {
        console.log('Testing database connection...')
        const leadsCount = await prisma.lead.count()
        console.log(`Connection successful! Total leads in DB: ${leadsCount}`)
    } catch (error) {
        console.error('Database connection failed:', error)
    } finally {
        await prisma.$disconnect()
    }
}

main()
