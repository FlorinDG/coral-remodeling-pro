import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyPortalAccess } from "@/lib/portal-auth";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { portalId, title, content, imageUrl } = body;

        if (!portalId) {
            return NextResponse.json({ error: "Portal ID required" }, { status: 400 });
        }

        const authResult = await verifyPortalAccess(request, { portalId });
        if (!authResult.success) {
            return NextResponse.json({ error: authResult.error || "Unauthorized" }, { status: authResult.status || 401 });
        }

        const update = await prisma.projectUpdate.create({
            data: {
                portalId: authResult.portal.id,
                title,
                content,
                imageUrl,
            },
        });

        return NextResponse.json(update, { status: 201 });
    } catch (error) {
        console.error("Error creating project update:", error);
        return NextResponse.json(
            { error: "Failed to create project update" },
            { status: 500 }
        );
    }
}
