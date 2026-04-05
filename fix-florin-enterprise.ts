import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Starting Florin Enterprise Environment Fix...");

    // 1. Identify Florin's Users
    const users = await prisma.user.findMany({
        where: {
            OR: [
                { email: { contains: 'florin' } },
                { email: { contains: 'tfo@coral-group.be' } },
                { email: { contains: 'admin' } }
            ]
        }
    });

    console.log("Found related users:", users.map(u => ({ email: u.email, role: u.role, tenantId: u.tenantId })));

    let targetTenantId = '';

    // 2. See if there's a Coral Enterprises tenant
    let coralTenant = await prisma.tenant.findFirst({
        where: { companyName: { contains: 'Coral' } },
        orderBy: { createdAt: 'asc' }
    });

    if (!coralTenant) {
        console.log("No Coral tenant found, creating one...");
        coralTenant = await prisma.tenant.create({
            data: {
                companyName: 'Coral Enterprises',
                planType: 'ENTERPRISE',
                subscriptionStatus: 'ACTIVE',
                activeModules: ["INVOICING", "CRM", "PROJECTS", "DATABASES", "CALENDAR", "HR"]
            }
        });
    } else {
        console.log("Found Coral tenant:", coralTenant.id, coralTenant.companyName);
        // Ensure it has everything enabled
        coralTenant = await prisma.tenant.update({
            where: { id: coralTenant.id },
            data: {
                companyName: 'Coral Enterprises',
                planType: 'ENTERPRISE',
                subscriptionStatus: 'ACTIVE',
                activeModules: ["INVOICING", "CRM", "PROJECTS", "DATABASES", "CALENDAR", "HR"]
            }
        });
    }

    targetTenantId = coralTenant.id;

    // 3. Connect Florin's accounts to this tenant
    for (const u of users) {
        await prisma.user.update({
            where: { id: u.id },
            data: {
                tenantId: targetTenantId,
                role: 'SUPERADMIN'
            }
        });
        console.log(`Updated user ${u.email} -> Tenant ${targetTenantId}`);
    }

    // 4. Also ensure 'florin.t@coral-group.be' exists, as he might login with it
    const myEmail = 'florin.t@coral-group.be';
    const florin = await prisma.user.upsert({
        where: { email: myEmail },
        update: {
            tenantId: targetTenantId,
            role: 'SUPERADMIN'
        },
        create: {
            email: myEmail,
            name: 'Florin',
            role: 'SUPERADMIN',
            tenantId: targetTenantId
        }
    });
    console.log(`Ensured $` + `{myEmail} is linked to $` + `{targetTenantId}`);

    // 5. Port all existing GlobalDatabases to this Tenant
    const updatedDBs = await prisma.globalDatabase.updateMany({
        where: { tenantId: { not: targetTenantId } },
        data: { tenantId: targetTenantId }
    });
    console.log(`Migrated ${updatedDBs.count} global databases to Coral Enterprises`);

    // Port all existing contacts, suppliers, leads, etc to ensure he sees data
    await prisma.contact.updateMany({
        where: { tenantId: { not: targetTenantId } },
        data: { tenantId: targetTenantId }
    });
    await prisma.supplier.updateMany({
        where: { tenantId: { not: targetTenantId } },
        data: { tenantId: targetTenantId }
    });
    await prisma.quotation.updateMany({
        where: { tenantId: { not: targetTenantId } },
        data: { tenantId: targetTenantId }
    });

    console.log("Successfully prepared Coral Enterprises environment!");
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
