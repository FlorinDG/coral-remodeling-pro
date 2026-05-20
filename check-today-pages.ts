import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('--- ALL QUOTE PAGES IN DB ---')
    const pages = await prisma.globalPage.findMany({
        where: {
            databaseId: {
                startsWith: 'db-quotations'
            }
        },
        orderBy: {
            createdAt: 'desc'
        }
    })
    for (const p of pages) {
        console.log(`ID: ${p.id}`)
        console.log(`Created: ${p.createdAt.toISOString()}`)
        console.log(`Properties: ${JSON.stringify(p.properties)}`)
        console.log(`Blocks Count: ${Array.isArray(p.blocks) ? p.blocks.length : 'Not an array'}`)
        console.log('------------------------')
    }
}

main().catch(console.error).finally(() => prisma.$disconnect())
