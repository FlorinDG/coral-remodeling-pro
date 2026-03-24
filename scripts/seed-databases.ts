import { PrismaClient } from '@prisma/client';
import { mockDatabases } from '../src/components/admin/database/mockData';

const prisma = new PrismaClient();

async function main() {
    console.log("Seeding missing mock databases...");

    for (const db of mockDatabases) {
        const existing = await prisma.globalDatabase.findUnique({
            where: { id: db.id }
        });

        if (!existing) {
            console.log(`Inserting missing database: ${db.id} (${db.name})`);

            await prisma.globalDatabase.create({
                data: {
                    id: db.id,
                    name: db.name,
                    description: db.description,
                    icon: db.icon,
                    properties: db.properties as any,
                    views: db.views as any,
                    activeFilters: db.activeFilters as any,
                    ownerId: db.ownerId || 'admin'
                }
            });

            // Also seed the mock pages if any exist
            if (db.pages && db.pages.length > 0) {
                console.log(`  -> Seeding ${db.pages.length} initial pages for ${db.id}`);
                for (const page of db.pages) {
                    await prisma.globalPage.upsert({
                        where: { id: page.id },
                        update: {},
                        create: {
                            id: page.id,
                            databaseId: page.databaseId,
                            properties: page.properties as any,
                            blocks: page.blocks as any,
                            order: page.order || 0,
                            createdBy: 'admin',
                            lastEditedBy: 'admin'
                        }
                    });
                }
            }
        } else {
            console.log(`Database ${db.id} already exists, skipping.`);
        }
    }

    console.log("Seeding complete!");
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
