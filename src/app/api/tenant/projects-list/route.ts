/**
 * GET /api/tenant/projects-list
 *
 * Returns a lightweight list of project pages (id + name) for the
 * tenant's projects database. Used by the ProjectAssignmentMatrix in
 * Team Settings to populate the project checkbox grid.
 *
 * Projects live in GlobalPage rows inside a GlobalDatabase whose name
 * contains "project" (case-insensitive). Falls back gracefully if not found.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

export async function GET() {
    try {
        const session = await auth();
        const caller = session?.user;
        if (!caller?.tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Find the tenant's projects database(s) — match by name
        const projectDbs = await prisma.globalDatabase.findMany({
            where: {
                tenantId: caller.tenantId,
                name: { contains: 'project', mode: 'insensitive' },
            },
            select: { id: true, name: true },
        });

        if (projectDbs.length === 0) {
            return NextResponse.json({ pages: [] });
        }

        // Collect pages from all matching databases (usually just one)
        const dbIds = projectDbs.map(d => d.id);
        const pages = await prisma.globalPage.findMany({
            where: { databaseId: { in: dbIds } },
            select: {
                id:         true,
                properties: true,
                order:      true,
            },
            orderBy: { order: 'asc' },
        });

        // Extract the project name from the properties JSON
        // CoralOS stores the title in properties.Name or properties.title
        const mapped = pages.map(p => {
            const props = (p.properties as Record<string, unknown>) || {};
            const name = (props['Name'] as string)
                ?? (props['title'] as string)
                ?? (props['name'] as string)
                ?? 'Untitled Project';
            return { id: p.id, name };
        });

        return NextResponse.json({ pages: mapped });
    } catch (error: unknown) {
        console.error('[ProjectsList] GET error:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
