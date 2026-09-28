"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { computeWorkedDuration } from "@/lib/computeWorkedDuration";

export interface ShiftBriefScope {
    tenantId?: string | null;
}

export interface ShiftBriefResult {
    title: string;              // 3-step fallback, already resolved
    address: string | null;       // project Location.address
    mapUrl: string | null;       // built server-side from the address
    contactName: string | null;   // project → Klant → Naam
    contactPhone: string | null;  // project → Klant → Telefoon
    scheduled: { start: string; end: string; date: string };
    worked: { in: string; out: string | null; minutes: number } | null;
    photos: { key: string; name: string; type: string }[];
    files: { id: string; name: string; url: string; type: string }[];
}

/**
 * Server accessor for the Shift Brief modal (WH-UI-1 §8.1).
 * Resolves shift, project location, customer contact, clock entries, and attachments in one server round trip.
 */
export async function shiftBrief(
    scopeOrShiftId: ShiftBriefScope | string,
    maybeShiftId?: string
): Promise<ShiftBriefResult> {
    let tenantId: string | undefined;
    let shiftId: string;

    if (typeof scopeOrShiftId === 'string') {
        shiftId = scopeOrShiftId;
        const session = await auth();
        tenantId = session?.user?.tenantId || undefined;
    } else {
        tenantId = scopeOrShiftId?.tenantId || undefined;
        if (!tenantId) {
            const session = await auth();
            tenantId = session?.user?.tenantId || undefined;
        }
        shiftId = maybeShiftId!;
    }

    if (!tenantId) {
        throw new Error('Unauthorized: Tenant context missing');
    }

    if (!shiftId) {
        throw new Error('Shift ID is required');
    }

    const shift = await prisma.scheduledShift.findFirst({
        where: { id: shiftId, tenantId },
        include: {
            attachments: true,
            clockEntries: {
                orderBy: { clockInTime: 'desc' },
            },
        },
    });

    if (!shift) {
        throw new Error(`Shift not found: ${shiftId}`);
    }

    let projectName: string | null = null;
    let address: string | null = null;
    let contactName: string | null = null;
    let contactPhone: string | null = null;

    if (shift.projectId) {
        // Try GlobalPage first (Dynamic DB project)
        const projectPage = await prisma.globalPage.findFirst({
            where: { id: shift.projectId, database: { tenantId } },
            select: { properties: true },
        });

        if (projectPage?.properties) {
            const props = projectPage.properties as Record<string, any>;
            projectName = (props.title || props.name || '').replace(/^\[ERP\]\s*/i, '').trim() || null;

            const loc = props.location;
            if (typeof loc === 'object' && loc && loc.address) {
                address = String(loc.address).trim();
            } else if (typeof props.address === 'string' && props.address.trim()) {
                address = props.address.trim();
            }

            const clientRel = props.client || props['prop-client'];
            const clientId = Array.isArray(clientRel) ? clientRel[0] : (typeof clientRel === 'string' ? clientRel : null);
            if (clientId) {
                const clientPage = await prisma.globalPage.findFirst({
                    where: { id: clientId, database: { tenantId } },
                    select: { properties: true },
                });
                if (clientPage?.properties) {
                    const cProps = clientPage.properties as Record<string, any>;
                    contactName = (cProps.title || cProps.name || cProps.Naam || '').trim() || null;
                    contactPhone = (cProps.phone || cProps.telefoon || cProps.Telefoon || '').trim() || null;
                }
            }
        } else {
            // Fallback to HrProject
            const hrProj = await prisma.hrProject.findFirst({
                where: { id: shift.projectId, tenantId },
                select: { name: true, address: true },
            });
            if (hrProj) {
                projectName = hrProj.name.replace(/^\[ERP\]\s*/i, '').trim() || null;
                address = hrProj.address?.trim() || null;
            }
        }
    }

    const title = projectName 
        || shift.shiftName?.trim() 
        || shift.notes?.trim() 
        || '';

    const mapUrl = address ? `https://maps.google.com/?q=${encodeURIComponent(address)}` : null;

    let worked: { in: string; out: string | null; minutes: number } | null = null;
    let photos: { key: string; name: string; type: string }[] = [];

    const activeClockEntry = shift.clockEntries.find(e => e.clockOutTime == null) || shift.clockEntries[0];
    if (activeClockEntry) {
        const duration = computeWorkedDuration(
            activeClockEntry.clockInTime,
            activeClockEntry.clockOutTime,
            activeClockEntry.noBreak
        );

        const inIso = activeClockEntry.clockInTime instanceof Date 
            ? activeClockEntry.clockInTime.toISOString()
            : String(activeClockEntry.clockInTime);
        const outIso = activeClockEntry.clockOutTime 
            ? (activeClockEntry.clockOutTime instanceof Date ? activeClockEntry.clockOutTime.toISOString() : String(activeClockEntry.clockOutTime))
            : null;

        worked = {
            in: inIso,
            out: outIso,
            minutes: duration.totalMinutes,
        };

        if (activeClockEntry.photos && Array.isArray(activeClockEntry.photos)) {
            photos = (activeClockEntry.photos as any[]).map(p => ({
                key: p.key || p.url || '',
                name: p.name || 'Photo',
                type: p.type || 'image/jpeg',
            }));
        }
    }

    const files = shift.attachments.map(a => ({
        id: a.id,
        name: a.name || 'Attachment',
        url: a.url || '',
        type: a.type || 'application/octet-stream',
    }));

    return {
        title,
        address,
        mapUrl,
        contactName,
        contactPhone,
        scheduled: {
            start: shift.shiftStart,
            end: shift.shiftEnd,
            date: shift.shiftDate,
        },
        worked,
        photos,
        files,
    };
}
