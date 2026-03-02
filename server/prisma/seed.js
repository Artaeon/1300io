const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Start seeding ...');

    // ÖNORM B 1300 — Comprehensive checklist (55 items, 11 categories)
    const categories = [
        {
            name: 'Dachkonstruktion & Dacheindeckung',
            items: [
                'Sind die Dacheindeckungen intakt (keine lockeren Ziegel, Platten)?',
                'Sind Kamineinfassungen dicht und fest?',
                'Sind Schneefanggitter vorhanden und intakt?',
                'Sind Dachrinnen und Fallrohre frei und funktionstüchtig?',
                'Ist die Dachdämmung intakt (keine Feuchtigkeitsschäden)?',
            ]
        },
        {
            name: 'Fassade & Außenwände',
            items: [
                'Gibt es sichtbare Risse an der Fassade?',
                'Sind Wärmedämmverbundsysteme intakt?',
                'Sind Fassadenverkleidungen sicher befestigt?',
                'Gibt es Anzeichen von Feuchtigkeitseintritt?',
                'Sind Balkone und Loggien standsicher?',
            ]
        },
        {
            name: 'Fenster, Türen & Tore',
            items: [
                'Sind alle Fenster funktionstüchtig (Öffnen/Schließen)?',
                'Sind Hauseingangstüren sicher und funktionstüchtig?',
                'Sind Kellertüren und -fenster einbruchsicher?',
                'Sind Garagentore funktionstüchtig und sicher?',
            ]
        },
        {
            name: 'Kellerräume & Fundamente',
            items: [
                'Gibt es Anzeichen von Feuchtigkeit im Keller?',
                'Sind tragende Wände rissfrei?',
                'Sind Kellerabgänge sicher (Geländer, Beleuchtung)?',
                'Ist die Kellerbelüftung ausreichend?',
                'Sind Lagerungen im Keller ordnungsgemäß (kein Brandrisiko)?',
            ]
        },
        {
            name: 'Stiegenhaus & Allgemeinbereiche',
            items: [
                'Sind Geländer und Handläufe fest verankert?',
                'Ist die Beleuchtung im Stiegenhaus funktionstüchtig?',
                'Sind Fluchtwege frei von Lagerungen?',
                'Sind die Bodenbeläge stolperfrei?',
                'Sind Stufenkanten markiert oder rutschfest?',
                'Sind Briefkastenanlagen intakt?',
            ]
        },
        {
            name: 'Aufzugsanlagen',
            items: [
                'Ist der Aufzug funktionstüchtig?',
                'Ist der Notruf im Aufzug funktionsfähig?',
                'Sind die Überprüfungsplaketten aktuell?',
                'Sind die Aufzugstüren sicher schließend?',
            ]
        },
        {
            name: 'Heizung & Sanitäranlagen',
            items: [
                'Ist die Heizungsanlage funktionstüchtig?',
                'Sind Rohrleitungen in Allgemeinbereichen dicht?',
                'Ist die Warmwasserversorgung funktionstüchtig?',
                'Sind Heizkörper in Allgemeinbereichen intakt?',
                'Ist der Heizraum ordnungsgemäß gesichert?',
            ]
        },
        {
            name: 'Elektroinstallationen',
            items: [
                'Sind Elektroverteilerkästen verschlossen?',
                'Sind Kabelführungen in Allgemeinbereichen intakt?',
                'Sind Steckdosen und Schalter in Allgemeinbereichen funktionsfähig?',
                'Ist die Blitzschutzanlage vorhanden und geprüft?',
                'Sind FI-Schutzschalter vorhanden und geprüft?',
            ]
        },
        {
            name: 'Brandschutz',
            items: [
                'Sind Feuerlöscher vorhanden und überprüft (Prüfplakette)?',
                'Ist die Notbeleuchtung funktionstüchtig?',
                'Sind Brandschutztüren vorhanden und schließen selbsttätig?',
                'Sind Rauchmelder in Allgemeinbereichen installiert und funktionsfähig?',
                'Sind Fluchtpläne vorhanden und aktuell?',
                'Sind Brandabschottungen in Durchbrüchen intakt?',
            ]
        },
        {
            name: 'Außenanlagen & Zugänge',
            items: [
                'Sind Gehwege frei von Beschädigungen (Stolperfallen)?',
                'Ist die Zufahrt für Einsatzfahrzeuge frei?',
                'Sind Müllplätze sauber und zugänglich?',
                'Ist die Außenbeleuchtung funktionstüchtig?',
                'Sind Zäune und Einfriedungen intakt?',
            ]
        },
        {
            name: 'Spielplätze & Gemeinschaftsanlagen',
            items: [
                'Sind Spielgeräte standsicher und in gutem Zustand?',
                'Ist der Fallschutz unter Spielgeräten ausreichend?',
                'Sind Gemeinschaftsräume (Waschküche etc.) sicher und funktionstüchtig?',
                'Sind Fahrradabstellräume zugänglich und sicher?',
                'Sind Garagen und Stellplätze sicher (Beleuchtung, Belüftung)?',
            ]
        },
    ];

    let totalItems = 0;
    for (let i = 0; i < categories.length; i++) {
        const cat = categories[i];
        const category = await prisma.checklistCategory.create({
            data: {
                name: cat.name,
                sort_order: i,
                items: {
                    create: cat.items.map((text, j) => ({ text, sort_order: j }))
                }
            }
        });
        totalItems += cat.items.length;
        console.log(`Created category: ${category.name} (${cat.items.length} items)`);
    }

    console.log(`Total: ${categories.length} categories, ${totalItems} checklist items`);

    // Demo Properties
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
