"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { isWorkforceRole } from "@/lib/roles";

/**
 * CMS-SCOPE-1 (Planner, unattended 2026-10-10): updateService, updateProject, deleteProject and deleteService had NO
 * session check and wrote by id — anyone could change or delete any tenant's website content. Every write now names
 * the session's tenant; the workforce role is refused (pd.md 4y).
 */
async function cmsTenant(): Promise<string> {
    const session = await auth();
    const tenantId = session?.user?.tenantId;
    if (!tenantId || isWorkforceRole((session?.user as { role?: string } | undefined)?.role)) {
        throw new Error("Unauthorized: Workspace context missing.");
    }
    return tenantId;
}

interface ContentUpdate {
    en: string;
    nl?: string | null;
    fr?: string | null;
    ro?: string | null;
}

interface SiteContentData {
    [key: string]: ContentUpdate;
}

export async function updateSiteContent(formData: SiteContentData) {
    const session = await auth();
    const tenantId = session?.user?.tenantId;
    if (!tenantId) throw new Error("Unauthorized: Workspace context missing.");

    const keys = Object.keys(formData);

    for (const key of keys) {
        const item = formData[key];
        await prisma.siteContent.upsert({
            where: { tenantId_key: { tenantId, key } },
            update: {
                valueEn: item.en,
                valueNl: item.nl,
                valueFr: item.fr,
                valueRo: item.ro,
            },
            create: {
                key: key,
                valueEn: item.en,
                valueNl: item.nl,
                valueFr: item.fr,
                valueRo: item.ro,
                tenantId
            }
        });
    }

    revalidatePath("/[locale]", "layout");
    return { success: true };
}

export async function updateService(id: string, data: Partial<import("@prisma/client").CMS_Service>) {
    const tenantId = await cmsTenant();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, tenantId: _tenant, ...fields } = data;   // a row never changes its id or its tenant
    const res = await prisma.cMS_Service.updateMany({ where: { id, tenantId }, data: fields });
    if (res.count === 0) throw new Error("Not found");
    revalidatePath("/[locale]", "layout");
    return { success: true };
}

interface ProjectImageData {
    url: string;
    captionEn?: string | null;
    captionNl?: string | null;
    captionFr?: string | null;
    captionRo?: string | null;
    isBefore?: boolean;
    order?: number;
}

interface ProjectData {
    titleEn: string;
    titleNl?: string | null;
    titleFr?: string | null;
    titleRo?: string | null;
    locationEn: string;
    locationNl?: string | null;
    locationFr?: string | null;
    locationRo?: string | null;
    order?: number;
    images: ProjectImageData[];
}

export async function createProject(data: ProjectData) {
    const session = await auth();
    const tenantId = session?.user?.tenantId;
    if (!tenantId) throw new Error("Unauthorized: Workspace context missing.");

    await prisma.cMS_Project.create({
        data: {
            titleEn: data.titleEn,
            titleNl: data.titleNl,
            titleFr: data.titleFr,
            titleRo: data.titleRo,
            locationEn: data.locationEn,
            locationNl: data.locationNl,
            locationFr: data.locationFr,
            locationRo: data.locationRo,
            order: data.order || 0,
            images: {
                create: data.images.map((img) => ({
                    url: img.url,
                    captionEn: img.captionEn,
                    captionNl: img.captionNl,
                    captionFr: img.captionFr,
                    captionRo: img.captionRo,
                    isBefore: img.isBefore || false,
                    order: img.order || 0
                }))
            },
            tenantId
        }
    });
    revalidatePath("/[locale]", "layout");
    return { success: true };
}

export async function updateProject(id: string, data: ProjectData) {
    const tenantId = await cmsTenant();
    const own = await prisma.cMS_Project.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!own) throw new Error("Not found");
    // Delete existing images and recreate (simpler for now)
    await prisma.$transaction([
        prisma.cMS_ProjectImage.deleteMany({ where: { projectId: id } }),
        prisma.cMS_Project.update({
            where: { id },
            data: {
                titleEn: data.titleEn,
                titleNl: data.titleNl,
                titleFr: data.titleFr,
                titleRo: data.titleRo,
                locationEn: data.locationEn,
                locationNl: data.locationNl,
                locationFr: data.locationFr,
                locationRo: data.locationRo,
                order: data.order || 0,
                images: {
                    create: data.images.map((img) => ({
                        url: img.url,
                        captionEn: img.captionEn,
                        captionNl: img.captionNl,
                        captionFr: img.captionFr,
                        captionRo: img.captionRo,
                        isBefore: img.isBefore || false,
                        order: img.order || 0
                    }))
                }
            }
        })
    ]);
    revalidatePath("/[locale]", "layout");
    return { success: true };
}

export async function deleteProject(id: string) {
    const tenantId = await cmsTenant();
    const res = await prisma.cMS_Project.deleteMany({ where: { id, tenantId } });
    if (res.count === 0) throw new Error("Not found");
    revalidatePath("/[locale]", "layout");
    return { success: true };
}

export async function updateBanner(data: { textEn: string; textNl?: string | null; isActive: boolean }) {
    const session = await auth();
    const tenantId = session?.user?.tenantId;
    if (!tenantId) throw new Error("Unauthorized: Workspace context missing.");

    const banner = await prisma.promotionalBanner.findFirst({ where: { tenantId } });
    if (banner) {
        await prisma.promotionalBanner.update({
            where: { id: banner.id },
            data
        });
    } else {
        await prisma.promotionalBanner.create({
            data: {
                ...data,
                id: `banner_1_${tenantId}`,
                tenantId
            }
        });
    }
    revalidatePath("/[locale]", "layout");
    return { success: true };
}

export async function createService(data: any) {
    const session = await auth();
    const tenantId = session?.user?.tenantId;
    if (!tenantId) throw new Error("Unauthorized: Workspace context missing.");

    const service = await prisma.cMS_Service.create({
        data: { ...data, tenantId }
    });
    revalidatePath("/[locale]/admin/services");
    return { success: true, service };
}

export async function deleteService(id: string) {
    const tenantId = await cmsTenant();
    const res = await prisma.cMS_Service.deleteMany({ where: { id, tenantId } });
    if (res.count === 0) throw new Error("Not found");
    revalidatePath("/[locale]/admin/services");
    return { success: true };
}
