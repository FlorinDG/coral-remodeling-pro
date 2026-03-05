import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { portalId, title, dueDate, fileUrl } = body;

        const task = await prisma.task.create({
            data: {
                portalId,
                title,
                status: 'TODO',
                dueDate: dueDate ? new Date(dueDate) : null,
                fileUrl
            }
        });

        return NextResponse.json(task);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, title, status, dueDate, fileUrl } = body;

        const task = await prisma.task.update({
            where: { id },
            data: {
                title,
                status,
                dueDate: dueDate ? new Date(dueDate) : undefined,
                fileUrl
            }
        });

        return NextResponse.json(task);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
    }
}
