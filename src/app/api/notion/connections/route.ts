import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
    try {
        const connections = await prisma.notionConnection.findMany({
            include: { _count: { select: { entries: true } } }
        });
        return NextResponse.json(connections);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch connections" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { name, databaseId, token } = await request.json();
        const connection = await prisma.notionConnection.create({
            data: { name, databaseId, token }
        });
        return NextResponse.json(connection);
    } catch (error) {
        return NextResponse.json({ error: "Failed to create connection" }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { id } = await request.json();
        await prisma.notionConnection.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: "Failed to delete connection" }, { status: 500 });
    }
}
