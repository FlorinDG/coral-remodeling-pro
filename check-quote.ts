import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('--- LATEST 10 QUOTE PAGES ---')
    const quotes = await prisma.globalPage.findMany({
        where: {
            databaseId: {
                startsWith: 'db-quotations'
            }
        },
        orderBy: {
            createdAt: 'desc'
        },
        take: 10
    })
    for (const q of quotes) {
        console.log(`Quote ID: ${q.id}`)
        console.log(`Created: ${q.createdAt.toISOString()}`)
        console.log(`Properties: ${JSON.stringify(q.properties)}`)
        console.log(`Blocks Count: ${Array.isArray(q.blocks) ? q.blocks.length : 'Not an array'}`)
        if (Array.isArray(q.blocks)) {
            console.log(`Blocks Sample: ${JSON.stringify(q.blocks.slice(0, 1))}`)
        }
        console.log('------------------------')
    }
}

main().catch(console.error).finally(() => prisma.$disconnect())
