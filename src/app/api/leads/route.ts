import { NextResponse } from "next/server";
import prisma, { dbRetry } from "@/lib/prisma";
import { sendLeadNotification } from "@/lib/email";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, email, phone, service, message } = body;

        const lead = await dbRetry(() => prisma.lead.create({
            data: {
                name,
                email,
                phone,
                service,
                message,
            },
        }));

        console.log("Lead created in DB:", lead.id);
        console.log("DB Host used:", process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || "Unknown");

        // Await email to ensure it sends before function termination
        try {
            if (process.env.RESEND_API_KEY) {
                await sendLeadNotification(lead);
                console.log("Email notification sent successfully.");
            } else {
                console.warn("RESEND_API_KEY missing, skipping email.");
            }
        } catch (emailError) {
            console.error("Email notification failed:", emailError);
        }

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
