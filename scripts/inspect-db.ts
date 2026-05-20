import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('--- USERS ---')
    const users = await prisma.user.findMany({
        select: {
            id: true,
            email: true,
            role: true,
            tenantId: true,
            tenant: {
                select: {
                    id: true,
                    commercialName: true,
                    planType: true,
                }
            }
        }
    })
    console.log(JSON.stringify(users, null, 2))

    console.log('\n--- PROJECTS ---')
    try {
        const pagesCount = await prisma.globalPage.count()
        console.log(`GlobalPages in DB: ${pagesCount}`)
        const pages = await prisma.globalPage.findMany({
            take: 5,
            select: {
                id: true,
                tenantId: true,
                databaseId: true,
                properties: true,
            }
        })
        console.log(JSON.stringify(pages, null, 2))
    } catch (e: any) {
        console.log('Error listing GlobalPages:', e.message)
    }

    console.log('\n--- USER PROJECT ACCESS ---')
    const access = await prisma.userProjectAccess.findMany()
    console.log(JSON.stringify(access, null, 2))
}

main()
    .catch((e) => {
        console.error(e)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
