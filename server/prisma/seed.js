const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Start seeding ...');

    // 1. Create Categories & Items (ÖNORM B 1300 Simplified)
    const categories = [
        {
            name: 'Gebäudehülle (Außen)',
            items: [
                'Sind die Dacheindeckungen intakt (keine lockeren Ziegel)?',
                'Gibt es sichtbare Risse an der Fassade?',
                'Sind die Kamineinfassungen dicht und fest?',
                'Sind Schneefanggitter vorhanden und intakt?'
            ]
        },
        {
            name: 'Stiegenhaus & Allgemeinbereiche',
            items: [
                'Sind das Geländer und der Handlauf fest verankert?',
                'Ist die Beleuchtung im Stiegenhaus funktionstüchtig?',
                'Sind Fluchtwege frei von Lagerungen (Kinderwagen, Schuhe)?',
                'Sind die Bodenbeläge stolperfrei?'
            ]
        },
        {
            name: 'Technische Anlagen',
            items: [
                'Ist der Lift funktionstüchtig (Notruf prüfen)?',
                'Sind Feuerlöscher überprüft (Prüfplakette aktuell)?',
                'Ist die Notbeleuchtung funktionstüchtig?'
            ]
        },
        {
            name: 'Außenanlagen',
            items: [
                'Sind Gehwege frei von Beschädigungen (Stolperfallen)?',
                'Ist die Zufahrt für Einsatzfahrzeuge frei?',
                'Sind Müllplätze sauber und zugänglich?'
            ]
        }
    ];

    for (const cat of categories) {
        const category = await prisma.checklistCategory.create({
            data: {
                name: cat.name,
                items: {
                    create: cat.items.map(text => ({ text }))
                }
            }
        });
        console.log(`Created category: ${category.name}`);
    }

    // 2. Create Demo Properties
    const properties = [
        {
            address: 'Musterstraße 1, 1010 Wien',
            owner_name: 'ImmoTrust GmbH',
            units_count: 12
        },
        {
            address: 'Mozartgasse 5, 5020 Salzburg',
            owner_name: 'Privatstiftung Müller',
            units_count: 8
        }
    ];

    for (const prop of properties) {
        const property = await prisma.property.create({
            data: prop
        });
        console.log(`Created property: ${property.address}`);
    }

    console.log('Seeding finished.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
