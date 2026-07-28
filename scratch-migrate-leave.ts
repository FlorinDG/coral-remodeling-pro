import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting migration of ScheduledShift{status:"leave"} to TimeOffRequest...');

  const leaveShifts = await prisma.scheduledShift.findMany({
    where: { status: 'leave' },
  });

  console.log(`Found ${leaveShifts.length} leave shifts to migrate.`);

  let migratedCount = 0;
  let errorCount = 0;

  for (const shift of leaveShifts) {
    try {
      // Create TimeOffRequest
      const req = await prisma.timeOffRequest.create({
        data: {
          tenantId: shift.tenantId,
          userId: shift.userId,
          requestType: shift.shiftName || 'vacation',
          startDate: shift.shiftDate,
          endDate: shift.shiftDate, // Assuming single day for legacy shifts
          status: 'approved', // Treat legacy leave blocks as approved
          notes: shift.notes,
          createdAt: shift.createdAt,
          updatedAt: shift.updatedAt,
        },
      });

      // Delete the legacy shift
      await prisma.scheduledShift.delete({
        where: { id: shift.id },
      });
      migratedCount++;
    } catch (error) {
      console.error(`Failed to migrate shift ${shift.id}:`, error);
      errorCount++;
    }
  }

  console.log(`Migration complete. Migrated: ${migratedCount}, Errors: ${errorCount}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
