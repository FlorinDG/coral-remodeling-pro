import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function hashPw(plain: string): Promise<string> {
    return bcrypt.hash(plain, 12);
}

function readJsonFile(relativePath: string) {
    const filePath = path.join(__dirname, relativePath);
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
}

async function main() {
    console.log('🌱 Seeding database...');

    // Clean up existing CMS data to avoid duplicates
    await prisma.siteContent.deleteMany();
    await prisma.cMS_ProjectImage.deleteMany();
    await prisma.cMS_Project.deleteMany();
    await prisma.cMS_Service.deleteMany();
    console.log('🧹 Cleaned up existing CMS data');

    // Create Default Core Workspace Tenant
    const tenant = await prisma.tenant.create({
        data: {
            companyName: 'Coral Group Main Platform',
            planType: 'ENTERPRISE',
        }
    });
    const tenantId = tenant.id;
    console.log('✅ Default SaaS Tenant Vault mounted:', tenantId);

    // Create Admin User
    await prisma.user.upsert({
        where: { email: 'tfo@coral-group.be' },
        update: {},
        create: {
            email: 'tfo@coral-group.be',
            name: 'SuperAdmin',
            password: await hashPw('admin'),
            role: 'SUPERADMIN',
            tenantId,
            emailVerified: new Date(),
        },
    });
    console.log('✅ Superadmin master account created');

    // Create Mock: Free Tier Startup
    const freeTenant = await prisma.tenant.create({
        data: {
            companyName: 'Bootstrap Remodeling (Free Tier)',
            planType: 'FREE',
            subscriptionStatus: 'ACTIVE',
            activeModules: ["INVOICING"]
        }
    });

    await prisma.user.upsert({
        where: { email: 'free@coral-group.be' },
        update: {},
        create: {
            email: 'free@coral-group.be',
            name: 'Free Tier Admin',
            password: await hashPw('admin'),
            role: 'TENANT_ADMIN',
            tenantId: freeTenant.id,
            emailVerified: new Date(),
        },
    });

    // Create Mock: Pro Tier Agency
    const proTenant = await prisma.tenant.create({
        data: {
            companyName: 'Elevate Designers (Pro Tier)',
            planType: 'PRO',
            subscriptionStatus: 'ACTIVE',
            activeModules: ["INVOICING", "CRM", "PROJECTS", "DATABASES"]
        }
    });

    await prisma.user.upsert({
        where: { email: 'pro@coral-group.be' },
        update: {},
        create: {
            email: 'pro@coral-group.be',
            name: 'Pro Tier Admin',
            password: await hashPw('admin'),
            role: 'TENANT_ADMIN',
            tenantId: proTenant.id,
            emailVerified: new Date(),
        },
    });

    // Create Mock: Enterprise Corporation
    const enterpriseTenant = await prisma.tenant.create({
        data: {
            companyName: 'Apex Construction Group (EnterpriseTier)',
            planType: 'ENTERPRISE',
            subscriptionStatus: 'ACTIVE',
            activeModules: ["INVOICING", "CRM", "PROJECTS", "DATABASES", "CALENDAR", "HR"]
        }
    });

    await prisma.user.upsert({
        where: { email: 'enterprise@coral-group.be' },
        update: {},
        create: {
            email: 'enterprise@coral-group.be',
            name: 'Enterprise Admin',
            password: await hashPw('admin'),
            role: 'TENANT_ADMIN',
            tenantId: enterpriseTenant.id,
            emailVerified: new Date(),
        },
    });

    console.log('✅ Three functional SaaS mockup tiers explicitly configured and sealed');
    console.log('✅ Admin user created');

    // Load translations to seed SiteContent
    const heroKeys = [
        'Hero.title',
        'Hero.description',
        'Hero.stats.projects',
        'Hero.stats.experience',
        'Hero.stats.projectsCount',
        'Hero.stats.experienceCount'
    ];

    const messages = {
        en: readJsonFile('../src/messages/en.json'),
        nl: readJsonFile('../src/messages/nl.json'),
        fr: readJsonFile('../src/messages/fr.json'),
        ro: readJsonFile('../src/messages/ro.json'),
    };

    for (const key of heroKeys) {
        const parts = key.split('.');
        const valEn = getNestedValue(messages.en, parts);
        const valNl = getNestedValue(messages.nl, parts);
        const valFr = getNestedValue(messages.fr, parts);
        const valRo = getNestedValue(messages.ro, parts);

        await prisma.siteContent.upsert({
            where: { tenantId_key: { tenantId, key } },
            update: {},
            create: {
                key,
                valueEn: (valEn as string) || '',
                valueNl: valNl as string,
                valueFr: valFr as string,
                valueRo: valRo as string,
                tenantId,
            },
        });
    }
    console.log('✅ Site content seeded');

    // Seed Services
    const services = [
        { slug: 'kitchen-design', key: 'kitchen', icon: '🍳', image: '/images/kitchen-hero.png', order: 1 },
        { slug: 'bath-restoration', key: 'bath', icon: '🛁', image: '/images/bathroom-hero.png', order: 2 },
        { slug: 'custom-additions', key: 'additions', icon: '🏠', image: '/images/kitchen-portfolio-2.png', order: 3 },
        { slug: 'whole-home', key: 'wholeHome', icon: '✨', image: '/images/bathroom-portfolio-2.png', order: 4 },
    ];

    for (const s of services) {
        const tEn = messages.en.Services[s.key];
        const tNl = messages.nl.Services[s.key];
        const tFr = messages.fr.Services[s.key];
        const tRo = messages.ro.Services[s.key];

        await prisma.cMS_Service.upsert({
            where: { tenantId_slug: { tenantId, slug: s.slug } },
            update: {},
            create: {
                slug: s.slug,
                icon: s.icon,
                image: s.image,
                order: s.order,
                titleEn: tEn.title,
                titleNl: tNl.title,
                titleFr: tFr.title,
                titleRo: tRo.title,
                subtitleEn: tEn.subtitle,
                subtitleNl: tNl.subtitle,
                subtitleFr: tFr.subtitle,
                subtitleRo: tRo.subtitle,
                descriptionEn: tEn.description,
                descriptionNl: tNl.description,
                descriptionFr: tFr.description,
                descriptionRo: tRo.description,
                fullDescriptionEn: tEn.fullDescription || '',
                fullDescriptionNl: tNl.fullDescription || '',
                fullDescriptionFr: tFr.fullDescription || '',
                fullDescriptionRo: tRo.fullDescription || '',
                featuresEn: tEn.features || [],
                featuresNl: tNl.features || [],
                featuresFr: tFr.features || [],
                featuresRo: tRo.features || [],
                tenantId,
            },
        });
    }
    console.log('✅ Services seeded');

    // Seed Projects
    const projectKeys = ['kitchenLoft', 'masterBath', 'contemporaryKitchen', 'masterSuite'];
    const projectImages: Record<string, string> = {
        kitchenLoft: '/images/project-loft-kitchen.png',
        masterBath: '/images/project-serenity-bath.png',
        contemporaryKitchen: '/images/project-chef-kitchen.png',
        masterSuite: '/images/project-oasis-suite.png',
    };

    for (let i = 0; i < projectKeys.length; i++) {
        const key = projectKeys[i];
        const tEn = messages.en.Projects[key];
        const tNl = messages.nl.Projects[key];
        const tFr = messages.fr.Projects[key];
        const tRo = messages.ro.Projects[key];

        const imageUrl = projectImages[key];

        await prisma.cMS_Project.create({
            data: {
                titleEn: tEn.title,
                titleNl: tNl.title,
                titleFr: tFr.title,
                titleRo: tRo.title,
                locationEn: tEn.location,
                locationNl: tNl.location,
                locationFr: tFr.location,
                locationRo: tRo.location,
                order: i + 1,
                tenantId,
                images: {
                    create: [
                        { url: imageUrl, captionEn: tEn.caption1, captionNl: tNl.caption1, captionFr: tFr.caption1, captionRo: tRo.caption1, order: 1 },
                        { url: imageUrl.replace('.png', '-angle2.png'), captionEn: tEn.caption2, captionNl: tNl.caption2, captionFr: tFr.caption2, captionRo: tRo.caption2, order: 2 },
                        { url: imageUrl.replace('.png', '-before.png'), captionEn: tEn.captionBefore, captionNl: tNl.captionBefore, captionFr: tFr.captionBefore, captionRo: tRo.captionBefore, isBefore: true, order: 3 },
                    ]
                }
            }
        });
    }
    console.log('✅ Projects seeded');

    console.log('✨ Seeding completed!');
}

function getNestedValue(obj: Record<string, unknown>, path: string[]): string | undefined {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return path.reduce((prev: any, curr) => prev && prev[curr], obj) as string | undefined;
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
