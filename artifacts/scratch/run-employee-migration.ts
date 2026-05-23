import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const ROLE_MAP: Record<string, string> = {
    'Admin': 'APP_MANAGER',
    'Manager': 'TENANT_ENTERPRISE_MANAGER',
    'Foreman': 'TEAMLEAD',
    'Project Manager': 'PROJECT_MANAGER',
    'Electrician': 'TENANT_ENTERPRISE_WORKFORCE',
    'Painter': 'TENANT_ENTERPRISE_WORKFORCE',
    'Laborer': 'TENANT_ENTERPRISE_WORKFORCE',
};

async function main() {
    console.log('--- STARTING EMPLOYEE TO USER MIGRATION ---');

    // Fetch all Employee records from the legacy Employee table
    const employees = await prisma.employee.findMany();
    console.log(`Found ${employees.length} legacy employee records.`);

    for (const emp of employees) {
        console.log(`\nProcessing employee: ${emp.firstName} ${emp.lastName} (${emp.email})`);
        
        // Map legacy role to standard role
        const standardRole = ROLE_MAP[emp.role] || 'TENANT_ENTERPRISE_WORKFORCE';
        console.log(`Mapped legacy role "${emp.role}" to standard role "${standardRole}"`);

        // Check if a User already exists with this email
        const existingUser = await prisma.user.findUnique({
            where: { email: emp.email },
        });

        let targetUserId: string;

        if (existingUser) {
            console.log(`Found existing User record (ID: ${existingUser.id}, Role: ${existingUser.role})`);
            
            // Link: copy HR fields and update role to standard role if it was a legacy/incorrect role (like "Admin")
            const updatedUser = await prisma.user.update({
                where: { id: existingUser.id },
                data: {
                    phone: existingUser.phone || emp.phone || null,
                    hourlyCost: existingUser.hourlyCost ?? emp.hourlyCost ?? null,
                    hireDate: existingUser.hireDate || emp.hireDate || null,
                    employeeStatus: existingUser.employeeStatus || emp.status || 'ACTIVE',
                    role: existingUser.role === 'Admin' || existingUser.role === 'SUPERADMIN' ? standardRole : existingUser.role, // Keep existing unless it was "Admin" or similar
                },
            });
            console.log(`Linked to existing User. Final role: ${updatedUser.role}`);
            targetUserId = existingUser.id;
        } else {
            // Create: new User from Employee data
            const newUser = await prisma.user.create({
                data: {
                    tenantId: emp.tenantId,
                    name: `${emp.firstName} ${emp.lastName}`.trim(),
                    email: emp.email,
                    phone: emp.phone || null,
                    role: standardRole,
                    hourlyCost: emp.hourlyCost,
                    hireDate: emp.hireDate,
                    employeeStatus: emp.status || 'ACTIVE',
                    invitedBy: null,
                    invitedAt: new Date(),
                    inviteAccepted: true, // Legacy employees are already active
                },
            });
            console.log(`Created new User record (ID: ${newUser.id}, Role: ${newUser.role})`);
            targetUserId = newUser.id;
        }

        // Remap ScheduledShift.userId
        const shifts = await prisma.scheduledShift.updateMany({
            where: { userId: emp.id },
            data: { userId: targetUserId },
        });
        if (shifts.count > 0) console.log(`Remapped ${shifts.count} ScheduledShifts`);

        // Remap ClockEntry.userId
        const clocks = await prisma.clockEntry.updateMany({
            where: { userId: emp.id },
            data: { userId: targetUserId },
        });
        if (clocks.count > 0) console.log(`Remapped ${clocks.count} ClockEntries`);

        // Remap TimeOffRequest.userId
        const pto = await prisma.timeOffRequest.updateMany({
            where: { userId: emp.id },
            data: { userId: targetUserId },
        });
        if (pto.count > 0) console.log(`Remapped ${pto.count} TimeOffRequests`);

        // Remap HrTeamMember.userId
        const members = await prisma.hrTeamMember.updateMany({
            where: { userId: emp.id },
            data: { userId: targetUserId },
        });
        if (members.count > 0) console.log(`Remapped ${members.count} HrTeamMembers`);
    }

    console.log('\n--- MIGRATION COMPLETED SUCCESSFULLY ---');
}

main().catch(console.error).finally(() => prisma.$disconnect());
