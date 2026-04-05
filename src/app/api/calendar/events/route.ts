import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { getValidAccessToken } from "@/lib/googleToken";

export const GET = auth(async function GET(req: any) {
    try {
        if (!req.auth?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const events: any = await prisma.event.findMany({
            where: {
                userId: req.auth.user.id
            },
            include: {
                task: true
            }
        });

        // Map to FullCalendar format
        const formattedEvents = events.map((e: any) => ({
            id: e.id,
            title: e.title,
            start: e.start.toISOString(),
            end: e.end.toISOString(),
            allDay: e.allDay,
            extendedProps: {
                description: e.description,
                location: e.location,
                task: e.task.length > 0 ? e.task[0] : null,
                googleCalendarId: e.googleCalendarId,
                googleEventId: e.googleEventId,
                accountId: e.accountId // if we had one
            }
        }));

        return NextResponse.json(formattedEvents);
    } catch (error) {
        console.error("GET /api/calendar/events Error:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
});

export const POST = auth(async function POST(req: any) {
    try {
        if (!req.auth?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const body = await req.json();
        const { title, start, end, allDay, description, location, createTask, calendarId, accountId } = body;

        let googleEventId = null;

        // If a Google Calendar is selected, push it to Google first
        if (calendarId && calendarId !== 'local' && accountId) {
            const validToken = await getValidAccessToken(accountId);
            if (validToken) {
                const googleEvent: any = {
                    summary: title,
                    description,
                    location,
                };

                if (allDay) {
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

                if (response.ok) {
                    const data = await response.json();
                    googleEventId = data.id;
                }
            }
        }

        const taskId = null;

        const eventData: any = {
            title,
            start: new Date(start),
            end: new Date(end),
            allDay: allDay || false,
            description,
            location,
            userId: req.auth.user.id,
            tenantId: (req.auth.user as any)?.tenantId,
            googleEventId,
            googleCalendarId: calendarId && calendarId !== 'local' ? calendarId : null
        };

        const event: any = await prisma.event.create({
            data: eventData
        });

        // If they checked the box AND selected a portal, link a portal-specific task
        // (Note: standalone generic tasks are handled client-side via useDatabaseStore)
        if (createTask && body.portalId) {
            const task = await prisma.task.create({
                data: {
                    portalId: body.portalId,
                    eventId: event.id,
                    title: `Task: ${title}`,
                    dueDate: new Date(start),
                    status: "TODO"
                }
            });
            await prisma.event.update({
                where: { id: event.id },
                data: { taskId: task.id }
            });
        }

        return NextResponse.json({ ...event, id: event.id });
    } catch (error) {
        console.error("POST /api/calendar/events Error:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
});

export const PATCH = auth(async function PATCH(req: any) {
    try {
        if (!req.auth?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const body = await req.json();
        const { id, title, start, end, allDay, description, location, calendarId, accountId, oldCalendarId, oldAccountId } = body;

        if (!id) {
            return new NextResponse("Event ID is required", { status: 400 });
        }

        // Verify ownership
        const existingEvent: any = await prisma.event.findUnique({
            where: { id }
        });

        if (!existingEvent || existingEvent.userId !== req.auth.user.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        let finalGoogleEventId = existingEvent.googleEventId;
        let finalGoogleCalendarId = existingEvent.googleCalendarId;

        const oldIsLocal = !existingEvent.googleCalendarId;
        const newIsLocal = calendarId === 'local' || !calendarId;

        const isMoving = (!oldIsLocal && newIsLocal) ||
            (oldIsLocal && !newIsLocal) ||
            (!oldIsLocal && !newIsLocal && existingEvent.googleCalendarId !== calendarId);

        if (isMoving) {
            // 1. Delete from old Google Calendar if it was there
            if (!oldIsLocal && existingEvent.googleEventId && oldAccountId) {
                const oldToken = await getValidAccessToken(oldAccountId);
                if (oldToken) {
                    await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(existingEvent.googleCalendarId)}/events/${encodeURIComponent(existingEvent.googleEventId)}`, {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${oldToken}` }
                    });
                }
            }

            // 2. Create in new Google Calendar if it's not local
            if (!newIsLocal && accountId) {
                const newToken = await getValidAccessToken(accountId);
                if (newToken) {
                    const googleEvent: any = {
                        summary: title !== undefined ? title : existingEvent.title,
                        description: description !== undefined ? description : existingEvent.description,
                        location: location !== undefined ? location : existingEvent.location
                    };

                    const pStart = start || existingEvent.start;
                    const pEnd = end || existingEvent.end;
                    const pAllDay = allDay !== undefined ? allDay : existingEvent.allDay;

                    if (pAllDay) {
                        const startDateStr = new Date(pStart).toISOString().split('T')[0];
                        let endDateStr = new Date(pEnd).toISOString().split('T')[0];
                        if (startDateStr === endDateStr) {
                            const nextDay = new Date(startDateStr);
                            nextDay.setDate(nextDay.getDate() + 1);
                            endDateStr = nextDay.toISOString().split('T')[0];
                        }
                        googleEvent.start = { date: startDateStr };
                        googleEvent.end = { date: endDateStr };
                    } else {
                        googleEvent.start = { dateTime: pStart };
                        googleEvent.end = { dateTime: pEnd };
                    }

                    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${newToken}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify(googleEvent)
                    });

                    if (response.ok) {
                        const newGEvent = await response.json();
                        finalGoogleEventId = newGEvent.id;
                        finalGoogleCalendarId = calendarId;
                    } else {
                        finalGoogleEventId = null;
                        finalGoogleCalendarId = null;
                    }
                } else {
                    finalGoogleEventId = null;
                    finalGoogleCalendarId = null;
                }
            } else {
                finalGoogleEventId = null;
                finalGoogleCalendarId = null;
            }
        } else {
            // Not moving, just push update to Google if it's connected
            if (!oldIsLocal && existingEvent.googleEventId && accountId) {
                const validToken = await getValidAccessToken(accountId);
                if (validToken) {
                    const googleEvent: any = {};
                    if (title !== undefined) googleEvent.summary = title;
                    if (description !== undefined) googleEvent.description = description;
                    if (location !== undefined) googleEvent.location = location;

                    if (start || end || allDay !== undefined) {
                        const isAllDay = allDay !== undefined ? allDay : existingEvent.allDay;
                        if (isAllDay) {
                            const startDateStr = (start ? new Date(start) : existingEvent.start).toISOString().split('T')[0];
                            googleEvent.start = { date: startDateStr };

                            let endDateStr = (end ? new Date(end) : existingEvent.end).toISOString().split('T')[0];
                            if (startDateStr === endDateStr) {
                                const nextDay = new Date(startDateStr);
                                nextDay.setDate(nextDay.getDate() + 1);
                                endDateStr = nextDay.toISOString().split('T')[0];
                            }
                            googleEvent.end = { date: endDateStr };
                        } else {
                            if (start) googleEvent.start = { dateTime: start };
                            if (end) googleEvent.end = { dateTime: end };
                        }
                    }

                    await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(existingEvent.googleCalendarId)}/events/${encodeURIComponent(existingEvent.googleEventId)}`, {
                        method: 'PATCH',
                        headers: {
                            Authorization: `Bearer ${validToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(googleEvent)
                    });
                }
            }
        }

        const data: any = {};
        if (title !== undefined) data.title = title;
        if (start !== undefined) data.start = new Date(start);
        if (end !== undefined) data.end = new Date(end);
        if (allDay !== undefined) data.allDay = allDay;
        if (description !== undefined) data.description = description;
        if (location !== undefined) data.location = location;

        if (isMoving) {
            data.googleEventId = finalGoogleEventId;
            data.googleCalendarId = finalGoogleCalendarId;
        }

        const updatedEvent = await prisma.event.update({
            where: { id },
            data
        });

        return NextResponse.json(updatedEvent);
    } catch (error) {
        console.error("PATCH /api/calendar/events Error:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
});

export const DELETE = auth(async function DELETE(req: any) {
    try {
        if (!req.auth?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const url = new URL(req.url);
        const eventId = url.searchParams.get("id");
        const accountId = url.searchParams.get("accountId");

        if (!eventId) {
            return new NextResponse("Event ID is required", { status: 400 });
        }

        // Verify ownership
        const existingEvent: any = await prisma.event.findUnique({
            where: { id: eventId }
        });

        if (!existingEvent || existingEvent.userId !== req.auth.user.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        // Delete from Google if linked
        if (existingEvent.googleEventId && existingEvent.googleCalendarId && accountId) {
            const validToken = await getValidAccessToken(accountId);
            if (validToken) {
                await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(existingEvent.googleCalendarId)}/events/${encodeURIComponent(existingEvent.googleEventId)}`, {
                    method: 'DELETE',
                    headers: {
                        Authorization: `Bearer ${validToken}`
                    }
                });
            }
        }

        await prisma.event.delete({
            where: { id: eventId }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/calendar/events Error:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
});
