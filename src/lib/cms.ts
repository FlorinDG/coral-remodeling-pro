import prisma from "@/lib/prisma";

export interface SiteContentMap {
    [key: string]: {
        en: string;
        nl: string | null;
        fr: string | null;
        ro: string | null;
    };
}

export async function getCMSContent(): Promise<SiteContentMap> {
    const contents = await prisma.siteContent.findMany();
    return contents.reduce((acc: SiteContentMap, curr) => {
        acc[curr.key] = {
            en: curr.valueEn,
            nl: curr.valueNl,
            fr: curr.valueFr,
            ro: curr.valueRo
        };
        return acc;
    }, {});
}

export async function getCMSServices() {
    return await prisma.cMS_Service.findMany({
        orderBy: { order: 'asc' }
    });
}

export async function getCMSProjects() {
    return await prisma.cMS_Project.findMany({
        orderBy: { order: 'asc' },
        include: { images: { orderBy: { order: 'asc' } } }
    });
}
