import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { getValidAccessToken } from "@/lib/googleToken";

export const GET = auth(async function GET(req: any) {
    try {
        if (!req.auth?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const url = new URL(req.url);
        const calendarId = url.searchParams.get("calendarId");
        const accountId = url.searchParams.get("accountId");
        const timeMin = url.searchParams.get("start");
        const timeMax = url.searchParams.get("end");

        if (!calendarId || !accountId) {
            return new NextResponse("Missing parameters", { status: 400 });
        }

        const account = await prisma.account.findUnique({
            where: {
                id: accountId
            }
        });

        if (!account || account.userId !== req.auth.user.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const validToken = await getValidAccessToken(accountId);
        if (!validToken) {
            return new NextResponse("Unauthorized or Token expired", { status: 401 });
        }

        let googleUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?singleEvents=true`;
        if (timeMin) googleUrl += `&timeMin=${new Date(timeMin).toISOString()}`;
        if (timeMax) googleUrl += `&timeMax=${new Date(timeMax).toISOString()}`;

        const response = await fetch(googleUrl, {
            headers: {
                Authorization: `Bearer ${validToken}`
            }
        });

        if (!response.ok) {
            return new NextResponse("Failed to fetch Google events", { status: response.status });
        }

        const data = await response.json();

        // Map to FullCalendar format
        const formattedEvents = data.items.map((e: any) => ({
            id: e.id,
            title: e.summary || "Busy",
            start: e.start?.dateTime || e.start?.date,
            end: e.end?.dateTime || e.end?.date,
            allDay: !!e.start?.date,
            url: e.htmlLink,
            extendedProps: {
                description: e.description,
                location: e.location
            }
        }));

        return NextResponse.json(formattedEvents);
    } catch (error) {
        console.error("GET /api/calendar/google/events Error:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
});

export const POST = auth(async function POST(req: any) {
    try {
        if (!req.auth?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const body = await req.json();
        const { title, start, end, allDay, description, location, calendarId, accountId, createTask, portalId } = body;

        if (!calendarId || !accountId || !title || !start) {
            return new NextResponse("Missing required fields", { status: 400 });
        }

        // Verify account ownership
        const account = await prisma.account.findUnique({
            where: { id: accountId }
        });

        if (!account || account.userId !== req.auth.user.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const validToken = await getValidAccessToken(accountId);
        if (!validToken) {
            return new NextResponse("Unauthorized or Token expired", { status: 401 });
        }

        const googleEvent: any = {
            summary: title,
            description,
            location,
        };

        if (allDay) {
            // Google Calendar requires 'date' in YYYY-MM-DD format for all-day events and expects the end date to be exclusive.
            const startDateStr = start.split('T')[0];
            let endDateStr = end ? end.split('T')[0] : startDateStr;

            if (startDateStr === endDateStr) {
                const nextDay = new Date(startDateStr);
                nextDay.setDate(nextDay.getDate() + 1);
                endDateStr = nextDay.toISOString().split('T')[0];
            }

            googleEvent.start = { date: startDateStr };
            googleEvent.end = { date: endDateStr };
        } else {
            googleEvent.start = { dateTime: start };
            googleEvent.end = { dateTime: end || start };
        }

        const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${validToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(googleEvent)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Google API Create Error:", errorText);
            return new NextResponse("Failed to create Google event", { status: response.status });
        }

        const data = await response.json();

        if (createTask && portalId) {
            await prisma.task.create({
                data: {
                    portalId: portalId,
                    title: `Task: ${title}`,
                    dueDate: new Date(start),
                    status: "TODO"
                }
            });
        }

        return NextResponse.json(data);

    } catch (error) {
        console.error("POST /api/calendar/google/events Error:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
});

export const PATCH = auth(async function PATCH(req: any) {
    try {
        if (!req.auth?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

        const body = await req.json();
        const { eventId, title, start, end, allDay, description, location, calendarId, accountId } = body;

        if (!calendarId || !accountId || !eventId) {
            return new NextResponse("Missing required fields", { status: 400 });
        }

        const account = await prisma.account.findUnique({ where: { id: accountId } });
        if (!account || account.userId !== req.auth.user.id) return new NextResponse("Unauthorized", { status: 401 });

        const validToken = await getValidAccessToken(accountId);
        if (!validToken) return new NextResponse("Unauthorized or Token expired", { status: 401 });

        const googleEvent: any = {};
        if (title !== undefined) googleEvent.summary = title;
        if (description !== undefined) googleEvent.description = description;
        if (location !== undefined) googleEvent.location = location;

        if (start || end || allDay !== undefined) {
            if (allDay) {
                if (start) {
                    const startDateStr = start.split('T')[0];
                    googleEvent.start = { date: startDateStr };

                    if (!end) {
                        const nextDay = new Date(startDateStr);
                        nextDay.setDate(nextDay.getDate() + 1);
                        googleEvent.end = { date: nextDay.toISOString().split('T')[0] };
                    }
                }
                if (end) {
                    let endDateStr = end.split('T')[0];
                    if (start && start.split('T')[0] === endDateStr) {
                        const nextDay = new Date(endDateStr);
                        nextDay.setDate(nextDay.getDate() + 1);
                        endDateStr = nextDay.toISOString().split('T')[0];
                    }
                    googleEvent.end = { date: endDateStr };
                }
            } else {
                if (start) googleEvent.start = { dateTime: start };
                if (end) googleEvent.end = { dateTime: end };
            }
        }

        const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${validToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(googleEvent)
        });

        if (!response.ok) return new NextResponse("Failed to update Google event", { status: response.status });
        return NextResponse.json(await response.json());
    } catch (error) {
        console.error("PATCH /api/calendar/google/events Error:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
});

export const DELETE = auth(async function DELETE(req: any) {
    try {
        if (!req.auth?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

        const url = new URL(req.url);
        const calendarId = url.searchParams.get("calendarId");
        const accountId = url.searchParams.get("accountId");
        const eventId = url.searchParams.get("eventId");

        if (!calendarId || !accountId || !eventId) {
            return new NextResponse("Missing required fields", { status: 400 });
        }

        const account = await prisma.account.findUnique({ where: { id: accountId } });
        if (!account || account.userId !== req.auth.user.id) return new NextResponse("Unauthorized", { status: 401 });

        const validToken = await getValidAccessToken(accountId);
        if (!validToken) return new NextResponse("Unauthorized or Token expired", { status: 401 });

        const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${validToken}`
            }
        });

        if (!response.ok) return new NextResponse("Failed to delete Google event", { status: response.status });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/calendar/google/events Error:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
});
