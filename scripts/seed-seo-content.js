const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Cleaning up existing projects and services...');
    // Delete projects first (and their images due to Cascade)
    await prisma.cMS_Project.deleteMany({});
    // Delete services
    await prisma.cMS_Service.deleteMany({});

    console.log('Seeding fresh localized services with ROOT-RELATIVE image URLs and Coral Enterprises branding...');

    // 1. Whole Home
    await prisma.cMS_Service.create({
        data: {
            slug: 'whole-home',
            image: '/images/kitchen-hero.png',
            icon: 'Home',
            titleEn: 'Whole Home Transformation',
            titleNl: 'Exclusieve Totaalrenovatie',
            titleFr: 'Rénovation Complète',
            titleRo: 'Renovare Completă',
            descriptionEn: 'Your total partner for luxury renovations across Belgium.',
            descriptionNl: 'Uw totaalpartner voor luxueuze verbouwingen van A tot Z in heel België.',
            descriptionFr: 'Votre partenaire total pour des rénovations de luxe dans toute la Belgique.',
            fullDescriptionEn: 'At Coral Enterprises, we specialize in complete home transformations...',
            fullDescriptionNl: 'Bij Coral Enterprises zijn we gespecialiseerd in volledige woningtransformaties...',
            featuresEn: ['End-to-end renovation', 'Structural changes'],
            featuresNl: ['Totaalrenovatie van A tot Z', 'Structurele verbouwingen'],
            order: 1,
            descriptionRo: 'Partenerul tău total pentru renovări de lux în toată Belgia.',
            fullDescriptionFr: 'Chez Coral Enterprises, nous nous spécialisons dans les transformations complètes...',
            fullDescriptionRo: 'La Coral Enterprises, suntem specializați în transformări complete de locuințe...',
            featuresFr: ['Rénovation de bout en bout', 'Changements structurels'],
            featuresRo: ['Renovare cap-la-cap', 'Modificări structurale']
        }
    });

    // 2. Kitchen Design
    await prisma.cMS_Service.create({
        data: {
            slug: 'kitchen-design',
            image: '/images/kitchen-portfolio-2.png',
            icon: 'ChefHat',
            titleEn: 'Luxury Kitchen Design',
            titleNl: 'Luxueuze Keukens op Maat',
            titleFr: 'Cuisines de Luxe sur Mesure',
            titleRo: 'Bucătării de Lux la Comandă',
            descriptionEn: 'High-end kitchen design where aesthetics meets functionality.',
            descriptionNl: 'Hoogwaardig keukenontwerp waarbij esthetiek en functionaliteit harmonieus samenkomen.',
            descriptionFr: 'Conception de cuisines haut de gamme alliant esthétique et fonctionnalité.',
            fullDescriptionEn: 'Experience the ultimate culinary experience...',
            fullDescriptionNl: 'Beleef de ultieme culinaire ervaring...',
            featuresEn: ['Custom cabinetry', 'High-end appliances'],
            featuresNl: ['Maatwerk kasten', 'Hoogwaardige apparatuur'],
            order: 2,
            descriptionRo: 'Design de bucătărie high-end unde estetica întâlnește funcționalitatea.',
            fullDescriptionFr: 'Vivez l\'expérience culinaire ultime...',
            fullDescriptionRo: 'Experimentați experiența culinară supremă...',
            featuresFr: ['Armoires sur mesure', 'Appareils haut de gamme'],
            featuresRo: ['Dulapuri la comandă', 'Electrocasnice de lux']
        }
    });

    // 3. Bath Restoration
    await prisma.cMS_Service.create({
        data: {
            slug: 'bath-restoration',
            image: '/images/bathroom-portfolio-2.png',
            icon: 'Bath',
            titleEn: 'Wellness Bathrooms',
            titleNl: 'Wellness Badkamers',
            titleFr: 'Salles de Bains Bien-être',
            titleRo: 'Băi Wellness',
            descriptionEn: 'Transform your bathroom into an oasis of peace.',
            descriptionNl: 'Transformeer uw badkamer in een oase van rust en ontspanning.',
            descriptionFr: 'Transformez votre salle de bain en une oasis de paix.',
            fullDescriptionEn: 'Our wellness bathroom renovations focus on creating a personal spa experience...',
            fullDescriptionNl: 'Onze wellness badkamer renovaties zijn gericht op het creëren van een persoonlijke spa-ervaring...',
            featuresEn: ['Freestanding tubs', 'Rain showers'],
            featuresNl: ['Vrijstaande baden', 'Regendouches'],
            order: 3,
            descriptionRo: 'Transformă-ți baia într-o oază de liniște.',
            fullDescriptionFr: 'Nos rénovations de salles de bains bien-être se concentrent...',
            fullDescriptionRo: 'Renovările noastre de băi wellness se concentrează pe crearea unei experiențe spa...',
            featuresFr: ['Baignoires îlot', 'Douches de pluie'],
            featuresRo: ['Căzi de sine stătătoare', 'Dușuri tip ploaie']
        }
    });

    // 4. Custom Additions
    await prisma.cMS_Service.create({
        data: {
            slug: 'custom-additions',
            image: '/images/bathroom-hero.png',
            icon: 'Maximize',
            titleEn: 'Custom Home Additions',
            titleNl: 'Aanbouw op Maat',
            titleFr: 'Extensions de Maison sur Mesure',
            titleRo: 'Extinderi de Locuințe la Comandă',
            descriptionEn: 'Expand your living space with a seamless and stylish addition.',
            descriptionNl: 'Vergroot uw leefruimte met een naadloze en stijlvolle aanbouw.',
            descriptionFr: 'Agrandissez votre espace de vie with une extension harmonieuse.',
            fullDescriptionEn: 'Need more space? Our addition service offers a seamless extension...',
            fullDescriptionNl: 'Heeft u meer ruimte nodig? Onze aanbouw service biedt een naadloze uitbreiding...',
            featuresEn: ['Seamless architecture', 'Modern extensions'],
            featuresNl: ['Naadloze architectuur', 'Moderne uitbreidingen'],
            order: 4,
            descriptionRo: 'Extinde-ți spațiul de locuit cu o adăugire armonioasă și elegantă.',
            fullDescriptionFr: 'Besoin de plus d\'espace ? Notre service d\'extension...',
            fullDescriptionRo: 'Ai nevoie de mai mult spațiu? Serviciul nostru de extinderi...',
            featuresFr: ['Architecture harmonieuse', 'Extensions modernes'],
            featuresRo: ['Arhitectură armonioasă', 'Extinderi moderne']
        }
    });

    console.log('Seeding fresh projects with root-relative image URLs...');

    // Project 1
    await prisma.cMS_Project.create({
        data: {
            titleEn: 'Minimalist Penthouse Knokke',
            titleNl: 'Minimalistisch Penthouse Knokke-Heist',
            locationEn: 'Knokke-Heist, Belgium',
            locationNl: 'Knokke-Heist, België',
            order: 1,
            images: {
                create: [
                    { url: '/images/project-oasis-suite.png', order: 1, captionEn: 'Primary View' },
                    { url: '/images/project-serenity-bath.png', order: 2, captionEn: 'Secondary View' }
                ]
            }
        }
    });

    // Project 2
    await prisma.cMS_Project.create({
        data: {
            titleEn: 'Heritage Farmhouse Gent',
            titleNl: 'Historische Hoeve Renovatie Gent',
            locationEn: 'Ghent, Belgium',
            locationNl: 'Gent, België',
            order: 2,
            images: {
                create: [
                    { url: '/images/project-chef-kitchen.png', order: 1, captionEn: 'Primary View' },
                    { url: '/images/project-loft-kitchen.png', order: 2, captionEn: 'Secondary View' }
                ]
            }
        }
    });

    console.log('Full Database Clean Refresh with ROOT-RELATIVE URLs and Correct Branding Completed Successfully');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
