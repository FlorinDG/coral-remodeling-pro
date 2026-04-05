import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from '@/auth';

export async function POST(request: Request) {
    try {
        const session = await auth();
        const tenantId = (session?.user as any)?.tenantId;
        if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const body = await request.json();
        const { portalId, title, content, imageUrl } = body;

        const update = await prisma.projectUpdate.create({
            data: {
                portalId,
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
