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
    const active = await prisma.user.count({ where: { tenantId, role: { in: HR_EMPLOYEE_ROLES }, OR: [{ employeeStatus: 'ACTIVE' }, { employeeStatus: null }] } });
    const onLeave = await prisma.user.count({ where: { tenantId, role: { in: HR_EMPLOYEE_ROLES }, employeeStatus: 'ON_LEAVE' } });
    const inactive = await prisma.user.count({ where: { tenantId, role: { in: HR_EMPLOYEE_ROLES }, employeeStatus: 'INACTIVE' } });
    console.log({ active, onLeave, inactive, total: active + onLeave + inactive });
}

main().catch(console.error).finally(() => prisma.$disconnect());
