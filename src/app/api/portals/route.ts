import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { nanoid } from "nanoid";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { clientName, clientEmail, projectTitle, serviceId, budget, paidAmount, password } = body;

        const slug = nanoid(10);
        let hashedPassword = null;
        if (password) {
            const bcrypt = await import('bcryptjs');
            hashedPassword = await bcrypt.hash(password, 10);
        }

        const portal = await prisma.clientPortal.create({
            data: {
                clientName,
                clientEmail,
                projectTitle,
                serviceId,
                slug,
                budget: budget || 0,
                paidAmount: paidAmount || 0,
                password: hashedPassword
            },
        });

        return NextResponse.json(portal, { status: 201 });
    } catch (error) {
        console.error("Error creating portal:", error);
        return NextResponse.json(
            { error: "Failed to create client portal" },
            { status: 500 }
        );
    }
}

export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { id, budget, paidAmount, status, password } = body;

        const updatedData: any = { budget, paidAmount, status };

        if (password) {
            const bcrypt = await import('bcryptjs');
            updatedData.password = await bcrypt.hash(password, 10);
        }

        const portal = await prisma.clientPortal.update({
            where: { id },
            data: updatedData
        });

        return NextResponse.json(portal);
    } catch (error) {
        return NextResponse.json({ error: "Failed to update portal" }, { status: 500 });
    }
}

export async function GET() {
    try {
        const portals = await prisma.clientPortal.findMany({
            include: { updates: true },
            orderBy: { createdAt: "desc" },
        });
        return NextResponse.json(portals);
    } catch (error) {
        return NextResponse.json(
            { error: "Failed to fetch portals" },
            { status: 500 }
        );
    }
}
