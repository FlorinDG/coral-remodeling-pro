/**
 * GEO-1 · barebone geofencing — server-only (Florin 2026-10-01, plan: coral-work-order-tabs.md).
 *
 * RECORD, NEVER BLOCK: after a clock-in / clock-out is saved, the server turns the phone's
 * coordinates into a street address and measures the distance to the work site. Hours are always
 * recorded; the office sees "clocked 1.2 km from site". Position is read only at clock events.
 *
 * Google Geocoding with a SERVER key (`GOOGLE_GEOCODING_API_KEY`, never NEXT_PUBLIC). No key, a
 * timeout or a Google error → nothing is recorded and the reason is logged; the clock event itself
 * is never affected.
 */
import prisma from '@/lib/prisma';
import { resolveProjects } from '@/lib/data/projects';

const KEY = () => process.env.GOOGLE_GEOCODING_API_KEY || '';
const ENDPOINT = 'https://maps.googleapis.com/maps/api/geocode/json';

/** Great-circle distance in metres (haversine). */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
    const R = 6_371_000;
    const rad = (d: number) => (d * Math.PI) / 180;
    const dLat = rad(b.lat - a.lat);
    const dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

async function google(params: Record<string, string>): Promise<{ address: string; lat: number; lng: number } | null> {
    const key = KEY();
    if (!key) { console.warn('[geo] GOOGLE_GEOCODING_API_KEY not set — skipped'); return null; }
    const qs = new URLSearchParams({ ...params, key, language: 'nl', region: 'be' });
    const res = await fetch(`${ENDPOINT}?${qs}`, { signal: AbortSignal.timeout(4000), cache: 'no-store' });
    const body = await res.json().catch(() => null) as { status?: string; error_message?: string; results?: Array<{ formatted_address: string; geometry: { location: { lat: number; lng: number } } }> } | null;
    if (!res.ok || !body || (body.status !== 'OK' && body.status !== 'ZERO_RESULTS')) {
        console.error('[geo] Google geocoding refused:', res.status, body?.status, body?.error_message);
        return null;
    }
    const r = body.results?.[0];
    return r ? { address: r.formatted_address, lat: r.geometry.location.lat, lng: r.geometry.location.lng } : null;
}

export const reverseGeocode = (lat: number, lng: number) => google({ latlng: `${lat},${lng}` });
export const geocode = (address: string) => google({ address });

/** The work site of a shift: siteAddress (geocoded, kept) ?? project coordinates ?? project address (geocoded, kept). */
export async function siteOf(tenantId: string, shiftId: string): Promise<{ lat: number; lng: number } | null> {
    const shift = await prisma.scheduledShift.findFirst({
        where: { id: shiftId, tenantId },
        select: { id: true, projectId: true, siteAddress: true, siteLat: true, siteLng: true, siteGeocodedFrom: true },
    });
    if (!shift) return null;

    let address = shift.siteAddress?.trim() || null;
    if (!address && shift.projectId) {
        const [p] = await resolveProjects(tenantId, { onlyIds: [shift.projectId] });
        if (p?.latitude != null && p?.longitude != null) return { lat: p.latitude, lng: p.longitude };
        address = p?.address?.trim() || null;
    }
    if (!address) return null;
    if (shift.siteGeocodedFrom === address && shift.siteLat != null && shift.siteLng != null) {
        return { lat: shift.siteLat, lng: shift.siteLng };
    }
    const g = await geocode(address);
    if (!g) return null;
    await prisma.scheduledShift.update({ where: { id: shift.id }, data: { siteLat: g.lat, siteLng: g.lng, siteGeocodedFrom: address } });
    return { lat: g.lat, lng: g.lng };
}

/** After a clock event is saved: its street address + distance to the site. Never throws. */
export async function recordClockPlace(tenantId: string, entryId: string, moment: 'in' | 'out'): Promise<void> {
    try {
        const e = await prisma.clockEntry.findFirst({
            where: { id: entryId, tenantId },
            select: { id: true, shiftId: true, clockInLatitude: true, clockInLongitude: true, clockOutLatitude: true, clockOutLongitude: true },
        });
        if (!e) return;
        const lat = moment === 'in' ? e.clockInLatitude : e.clockOutLatitude;
        const lng = moment === 'in' ? e.clockInLongitude : e.clockOutLongitude;
        if (lat == null || lng == null) return;

        const [place, site] = await Promise.all([
            reverseGeocode(lat, lng),
            e.shiftId ? siteOf(tenantId, e.shiftId) : Promise.resolve(null),
        ]);
        const distance = site ? distanceMeters({ lat, lng }, site) : null;
        if (!place && distance == null) return;
        await prisma.clockEntry.update({
            where: { id: e.id },
            data: moment === 'in'
                ? { clockInAddress: place?.address ?? undefined, clockInDistanceM: distance ?? undefined }
                : { clockOutAddress: place?.address ?? undefined, clockOutDistanceM: distance ?? undefined },
        });
    } catch (err) {
        console.error('[geo] recordClockPlace failed:', err);
    }
}
