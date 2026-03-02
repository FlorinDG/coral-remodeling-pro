"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

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
    const keys = Object.keys(formData);

    for (const key of keys) {
        const item = formData[key];
        await prisma.siteContent.upsert({
            where: { key: key },
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
            }
        });
    }

    revalidatePath("/[locale]", "layout");
    return { success: true };
}

export async function updateService(id: string, data: Partial<import("@prisma/client").CMS_Service>) {
    await prisma.cMS_Service.update({
        where: { id },
        data: data
    });
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
            }
        }
    });
    revalidatePath("/[locale]", "layout");
    return { success: true };
}

export async function updateProject(id: string, data: ProjectData) {
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
    await prisma.cMS_Project.delete({
        where: { id }
    });
    revalidatePath("/[locale]", "layout");
    return { success: true };
}
