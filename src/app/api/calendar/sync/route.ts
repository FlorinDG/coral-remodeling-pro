import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { getValidAccessToken } from "@/lib/googleToken";

export const POST = auth(async function POST(req: any) {
    try {
        if (!req.auth?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const userId = req.auth.user.id;
        const tenantId = (req.auth.user as any)?.tenantId;
        if (!tenantId) return new NextResponse("Unauthorized", { status: 401 });
        const body = await req.json().catch(() => ({}));

        // Optional parameters to limit sync window
        const timeMin = body.start ? new Date(body.start).toISOString() : new Date(new Date().setMonth(new Date().getMonth() - 2)).toISOString();
        const timeMax = body.end ? new Date(body.end).toISOString() : new Date(new Date().setMonth(new Date().getMonth() + 12)).toISOString();

        // 1. Fetch all connected Google Accounts for this user
        const accounts = await prisma.account.findMany({
            where: { userId, provider: 'google' }
        });

        if (accounts.length === 0) {
            return NextResponse.json({ success: true, message: "No Google accounts connected." });
        }

        let syncedCount = 0;
        const pushedCount = 0;

        for (const account of accounts) {
            const validToken = await getValidAccessToken(account.id);
            if (!validToken) continue;

            // Fetch the user's primary calendar or all calendars they own
            const calendarListRes = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
                headers: { Authorization: `Bearer ${validToken}` }
            });

            if (!calendarListRes.ok) continue;
            const calendarData = await calendarListRes.json();

            // Only sync writable calendars
            const writableCalendars = calendarData.items?.filter((c: any) => c.accessRole === 'owner' || c.accessRole === 'writer') || [];

            for (const cal of writableCalendars) {
                // ==========================================
                // PHASE 1: PULL FROM GOOGLE TO LOCAL PRISMA
                // ==========================================
                const googleUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?singleEvents=true&timeMin=${timeMin}&timeMax=${timeMax}&maxResults=2500`;

                const eventsRes = await fetch(googleUrl, {
                    headers: { Authorization: `Bearer ${validToken}` }
                });

                if (eventsRes.ok) {
                    const eventsData = await eventsRes.json();
                    const googleEvents = eventsData.items || [];

                    for (const gEvent of googleEvents) {
                        if (gEvent.status === 'cancelled') {
                            // Delete local if exists
                            const deleteWhere: any = { googleEventId: gEvent.id, userId };
                            await prisma.event.deleteMany({
                                where: deleteWhere
                            });
                            continue;
                        }

                        const allDay = !!gEvent.start?.date;
                        // For all-day events, Google returns YYYY-MM-DD. We parse that as UTC midnight.
                        const start = gEvent.start?.dateTime ? new Date(gEvent.start.dateTime) : new Date(`${gEvent.start?.date}T00:00:00Z`);
                        let end;

                        if (allDay) {
                            // Google's end date is exclusive (next day). We subtract 1ms to keep it on the same day visually, or just store it as is and let the frontend handle the exclusive end.
                            end = gEvent.end?.date ? new Date(`${gEvent.end.date}T00:00:00Z`) : start;
                        } else {
                            end = gEvent.end?.dateTime ? new Date(gEvent.end.dateTime) : start;
                        }

                        // Upsert into Prisma based on googleEventId
                        const upsertWhere: any = { googleEventId: gEvent.id };
                        const upsertUpdate: any = {
                            title: gEvent.summary || "Busy",
                            start,
                            end,
                            allDay,
                            description: gEvent.description || null,
                            location: gEvent.location || null,
                            googleCalendarId: cal.id,
                        };
                        const upsertCreate: any = {
                            userId,
                            tenantId,
                            googleEventId: gEvent.id,
                            googleCalendarId: cal.id,
                            title: gEvent.summary || "Busy",
                            start,
                            end,
                            allDay,
                            description: gEvent.description || null,
                            location: gEvent.location || null,
                        };

                        await prisma.event.upsert({
                            where: upsertWhere,
                            update: upsertUpdate,
                            create: upsertCreate
                        });
                        syncedCount++;
                    }
                }
            }
        }

        return NextResponse.json({
            success: true,
            message: `Sync complete. Pulled ${syncedCount} external calendar updates.`
        });

    } catch (error) {
        console.error("POST /api/calendar/sync Error:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
});
