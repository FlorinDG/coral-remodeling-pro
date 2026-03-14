import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export const GET = auth(async function GET(req: any) {
    try {
        if (!req.auth?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const events = await prisma.event.findMany({
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
                task: e.task.length > 0 ? e.task[0] : null
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
        const { title, start, end, allDay, description, location, createTask } = body;

        const taskId = null;

        const event = await prisma.event.create({
            data: {
                title,
                start: new Date(start),
                end: new Date(end),
                allDay: allDay || false,
                description,
                location,
                userId: req.auth.user.id,
            }
        });

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
        const { id, title, start, end, allDay, description, location } = body;

        if (!id) {
            return new NextResponse("Event ID is required", { status: 400 });
        }

        // Verify ownership
        const existingEvent = await prisma.event.findUnique({
            where: { id }
        });

        if (!existingEvent || existingEvent.userId !== req.auth.user.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const data: any = {};
        if (title !== undefined) data.title = title;
        if (start !== undefined) data.start = new Date(start);
        if (end !== undefined) data.end = new Date(end);
        if (allDay !== undefined) data.allDay = allDay;
        if (description !== undefined) data.description = description;
        if (location !== undefined) data.location = location;

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

        if (!eventId) {
            return new NextResponse("Event ID is required", { status: 400 });
        }

        // Verify ownership
        const existingEvent = await prisma.event.findUnique({
            where: { id: eventId }
        });

        if (!existingEvent || existingEvent.userId !== req.auth.user.id) {
            return new NextResponse("Unauthorized", { status: 401 });
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
