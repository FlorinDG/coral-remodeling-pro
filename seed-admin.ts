import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const tenant = await prisma.tenant.create({
        data: {
            companyName: 'Coral Enterprises',
            planType: 'PRO',
            users: {
                create: {
                    email: 'admin@coral-group.be',
                    name: 'System Admin',
                    password: 'password123',
                    role: 'admin'
                }
            }
        }
    })
    console.log('Successfully seeded Tenant and Admin User:', tenant)
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
