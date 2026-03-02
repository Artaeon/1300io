require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Seeding demo inspection data...');

    // Get existing data
    const properties = await prisma.property.findMany();
    const categories = await prisma.checklistCategory.findMany({ include: { items: true } });

    if (properties.length === 0 || categories.length === 0) {
        console.error('Please run prisma/seed.js first to create base data.');
        process.exit(1);
    }

    const allItems = categories.flatMap(c => c.items);

    // Create a completed inspection for the first property
    const inspection1 = await prisma.inspection.create({
        data: {
            property_id: properties[0].id,
            inspector_name: 'Max Mustermann',
            status: 'COMPLETED',
            ended_at: new Date('2026-02-28T14:30:00'),
        }
    });

    // Add results for all checklist items
    for (const item of allItems) {
        const statuses = ['OK', 'OK', 'OK', 'DEFECT', 'OK', 'NOT_APPLICABLE'];
        const status = statuses[item.id % statuses.length];

        await prisma.inspectionResult.create({
            data: {
                inspection_id: inspection1.id,
                checklist_item_id: item.id,
                status,
                comment: status === 'DEFECT' ? 'Reparatur erforderlich - sichtbarer Schaden festgestellt.' : null,
            }
        });
    }

    console.log(`Created completed inspection #${inspection1.id} for ${properties[0].address}`);

    // Create a second completed inspection for the second property
    const inspection2 = await prisma.inspection.create({
        data: {
            property_id: properties[1].id,
            inspector_name: 'Anna Huber',
            status: 'COMPLETED',
            ended_at: new Date('2026-02-20T10:15:00'),
        }
    });

    for (const item of allItems) {
        await prisma.inspectionResult.create({
            data: {
                inspection_id: inspection2.id,
                checklist_item_id: item.id,
                status: 'OK',
            }
        });
    }

    console.log(`Created completed inspection #${inspection2.id} for ${properties[1].address}`);

    // Create a draft inspection (in progress)
    const inspection3 = await prisma.inspection.create({
        data: {
            property_id: properties[0].id,
            inspector_name: 'Max Mustermann',
            status: 'DRAFT',
        }
    });

    // Add partial results
    for (let i = 0; i < Math.min(5, allItems.length); i++) {
        await prisma.inspectionResult.create({
            data: {
                inspection_id: inspection3.id,
                checklist_item_id: allItems[i].id,
                status: i % 3 === 0 ? 'DEFECT' : 'OK',
                comment: i % 3 === 0 ? 'Mangel dokumentiert' : null,
            }
        });
    }

    console.log(`Created draft inspection #${inspection3.id} for ${properties[0].address}`);
    console.log('Demo data seeding complete.');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
