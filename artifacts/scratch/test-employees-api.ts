import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const HR_EMPLOYEE_ROLES = [
    'APP_MANAGER',
    'TENANT_PRO_OWNER',
    'TENANT_PRO_EMPLOYEE',
    'TENANT_ENTERPRISE_OWNER',
    'TENANT_ENTERPRISE_MANAGER',
    'TENANT_ENTERPRISE_EMPLOYEE',
    'TENANT_ENTERPRISE_WORKFORCE',
    'BOOKKEEPING',
    'TEAMLEAD',
    'PROJECT_MANAGER',
    'HR_OFFICER',
    'OFFERTES',
];

async function main() {
    const tenantId = 'cmneyas2b0000veqvkgl2luz1';
    const users = await prisma.user.findMany({
        where: {
            tenantId,
            role: { in: HR_EMPLOYEE_ROLES },
        },
        select: {
            id: true, name: true, email: true, phone: true,
            role: true, hourlyCost: true, hireDate: true,
            employeeStatus: true, image: true,
        },
        orderBy: { name: 'asc' },
    });

    const employees = users.map(u => ({
        id: u.id,
        firstName: u.name?.split(' ')[0] || '',
        lastName: u.name?.split(' ').slice(1).join(' ') || '',
        email: u.email,
        phone: u.phone,
        role: u.role,
        status: u.employeeStatus || 'ACTIVE',
        hourlyCost: u.hourlyCost,
        hireDate: u.hireDate,
    }));

    console.log('--- EMPLOYEES RETURNED BY GET API ---');
    console.log(JSON.stringify(employees, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
