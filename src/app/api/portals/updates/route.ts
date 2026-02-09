import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(request: Request) {
    try {
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
