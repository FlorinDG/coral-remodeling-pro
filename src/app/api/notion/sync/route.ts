import { NextResponse } from "next/server";
import { getServicesFromNotion } from "@/lib/notion"; // I need to add this to lib/notion
import prisma from "@/lib/prisma";

export async function POST() {
    try {
        // This is a simplified version of the sync logic
        const notionServices = await getServicesFromNotion();
        let updatedCount = 0;

        for (const nService of notionServices) {
            if (!nService.slug) continue;
            await prisma.cMS_Service.upsert({
                where: { slug: nService.slug },
                update: {
                    titleEn: nService.titleEn,
                    titleNl: nService.titleNl,
                    descriptionEn: nService.descriptionEn,
                    fullDescriptionEn: nService.fullDescriptionEn,
                    order: nService.order,
                },
                create: {
                    slug: nService.slug,
                    titleEn: nService.titleEn || "",
                    descriptionEn: nService.descriptionEn || "",
                    fullDescriptionEn: nService.fullDescriptionEn || "",
                    image: "",
                    icon: "",
                    order: nService.order || 0,
                },
            });
            updatedCount++;
        }

        return NextResponse.json({
            success: true,
            message: `Successfully updated ${updatedCount} services from Notion.`
        });
    } catch (error: any) {
        console.error("Notion sync error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
