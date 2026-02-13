import { NextResponse } from "next/server";
import prisma, { dbRetry } from "@/lib/prisma";
import { sendLeadNotification } from "@/lib/email";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, email, phone, service, message } = body;

        console.log(`Processing lead for: ${name} (${email})`);

        let lead;
        try {
            lead = await dbRetry(() => prisma.lead.create({
                data: {
                    name,
                    email,
                    phone,
                    service,
                    message,
                },
            }));
            console.log("Lead created in DB:", lead.id);
        } catch (dbError: any) {
            console.error("Database error while creating booking:", dbError);
            return NextResponse.json(
                { error: `Database error: ${dbError.message || 'Unknown database error'}` },
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
