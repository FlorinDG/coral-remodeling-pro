import { NextResponse } from "next/server";
import prisma, { dbRetry } from "@/lib/prisma";
import { sendBookingNotification } from "@/lib/email";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { clientName, clientEmail, serviceType, date, timeSlot } = body;

        const booking = await dbRetry(() => prisma.booking.create({
            data: {
                clientName,
                clientEmail,
                serviceType,
                date: new Date(date),
                timeSlot,
            },
        }));

        // Fire and forget email notification to avoid blocking the response
        sendBookingNotification(booking).catch(err => console.error("Email notification failed:", err));

        return NextResponse.json(booking, { status: 201 });
    } catch (error) {
        console.error("Error creating booking:", error);
        return NextResponse.json(
            { error: "Failed to create booking" },
            { status: 500 }
        );
    }
}

export async function GET() {
    try {
        const bookings = await prisma.booking.findMany({
            orderBy: { date: "asc" },
        });
        return NextResponse.json(bookings);
    } catch (error) {
        return NextResponse.json(
            { error: "Failed to fetch bookings" },
            { status: 500 }
        );
    }
}
