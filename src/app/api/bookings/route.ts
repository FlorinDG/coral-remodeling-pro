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

        console.log("Booking created in DB:", booking.id);
        // Await email to ensure it sends before function termination
        try {
            if (process.env.RESEND_API_KEY) {
                await sendBookingNotification(booking);
                console.log("Booking email sent successfully.");
            } else {
                console.warn("RESEND_API_KEY missing, skipping email.");
            }
        } catch (emailError) {
            console.error("Booking email failed:", emailError);
        }

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
