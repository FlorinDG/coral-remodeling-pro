import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { portalId, url, caption } = body;

        const media = await prisma.projectMedia.create({
            data: {
                portalId,
                url,
                caption
            }
        });

        return NextResponse.json(media);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to add media' }, { status: 500 });
    }
}
