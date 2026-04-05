import { NextResponse } from "next/server";
import prisma, { dbRetry } from "@/lib/prisma";
import { sendLeadNotification } from "@/lib/email";
import { auth } from '@/auth';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, email, phone, service, message, tenantId } = body;

        if (!tenantId) {
            return NextResponse.json({ error: "Missing tenant ID for routing." }, { status: 400 });
        }

        console.log(`Processing lead for: ${name} (${email})`);

        let lead;
        try {
            lead = await dbRetry(() => prisma.lead.create({
                data: {
                    tenantId,
                    name,
                    email,
                    phone,
                    service,
                    message,
                },
            }));
            console.log("Lead created in DB:", lead.id);
        } catch (dbError) {
            console.error("Database error while creating lead:", dbError);
            return NextResponse.json(
                { error: "Failed to save lead to database. Please try again later." },
                { status: 500 }
            );
        }

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
            // We don't return 500 here because the lead WAS saved to DB
        }

        // Return success response

        return NextResponse.json(lead, { status: 201 });
    } catch (error) {
        console.error("Critical error in POST /api/leads:", error);
        return NextResponse.json(
            { error: "A server error occurred. Please try again." },
            { status: 500 }
        );
    }
}

export async function GET() {
    try {
        const session = await auth();
        const tenantId = (session?.user as any)?.tenantId;
        if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const leads = await prisma.lead.findMany({
            where: { tenantId },
            orderBy: { createdAt: "desc" },
        });
        return NextResponse.json(leads);
    } catch {
        return NextResponse.json(
            { error: "Failed to fetch leads" },
            { status: 500 }
        );
    }
}
