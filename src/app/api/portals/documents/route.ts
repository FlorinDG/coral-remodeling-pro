import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { portalId, name, url, type } = body;

        const document = await prisma.document.create({
            data: {
                portalId,
                name,
                url,
                type
            }
        });

        return NextResponse.json(document);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to add document' }, { status: 500 });
    }
}
