const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tenantId = 'cmneyas2b0000veqvkgl2luz1';
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { lockedDbIds: true }
  });

  const ids = typeof tenant.lockedDbIds === 'object' && tenant.lockedDbIds !== null ? tenant.lockedDbIds : {};

  // Map the founder's legacy un-suffixed databases
  ids['projects'] = 'db-1';
  ids['tasks'] = 'db-tasks';
  ids['articles'] = 'db-articles';
  ids['crm'] = 'db-crm';
  ids['bobex'] = 'db-bobex';
  ids['bestek'] = 'db-bestek';
  ids['journal-general'] = 'db-journal-general';
  ids['hr'] = 'db-hr';

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { lockedDbIds: ids }
  });

  console.log("Updated lockedDbIds for founder:", ids);

  // Clean up mistakenly auto-created suffixed DBs (which the user saw as "empty")
  const badDbs = [
    'db-1-cmneyas2', 
    'db-tasks-cmneyas2', 
    'db-articles-cmneyas2', 
    'db-crm-cmneyas2', 
    'db-bobex-cmneyas2', 
    'db-bestek-cmneyas2', 
    'db-journal-general-cmneyas2', 
    'db-hr-cmneyas2'
  ];
  
  for (const db of badDbs) {
    try {
      await prisma.globalDatabase.delete({ where: { id: db } });
      console.log(`Deleted empty accidental DB: ${db}`);
    } catch (e) {
      // Ignore if it doesn't exist
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
