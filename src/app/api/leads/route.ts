import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendLeadNotification } from "@/lib/email";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, email, phone, service, message } = body;

        const lead = await prisma.lead.create({
            data: {
                name,
                email,
                phone,
                service,
                message,
            },
        });

        // Fire and forget email notification to avoid blocking the response
        sendLeadNotification(lead).catch(err => console.error("Email notification failed:", err));

        return NextResponse.json(lead, { status: 201 });
    } catch (error) {
        console.error("Error creating lead:", error);
        return NextResponse.json(
            { error: "Failed to create lead" },
            { status: 500 }
        );
    }
}

export async function GET() {
    try {
        const leads = await prisma.lead.findMany({
            orderBy: { createdAt: "desc" },
        });
        return NextResponse.json(leads);
    } catch (error) {
        return NextResponse.json(
            { error: "Failed to fetch leads" },
            { status: 500 }
        );
    }
}
