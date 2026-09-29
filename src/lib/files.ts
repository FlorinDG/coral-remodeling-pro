/**
 * src/lib/files.ts
 * Single source of truth for resolving storage URLs across client and server (HR-TS-3).
 */

export function resolveFileUrl(url: string | null | undefined): string {
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/api/files/')) {
        return url;
    }
    if (url.startsWith('t_')) {
        return `/api/files/${url}`;
    }
    return url;
}

export interface StoredPhoto { key: string; name: string; type: string }

/**
 * ClockEntry.photos is `Json?`. Production holds three shapes: plain storage-key strings
 * (useClockEntries uploads), objects `{ key | url, name?, type? }`, or the array serialised
 * as a JSON string. One reader for all of them — never three.
 */
export function normalizeStoredPhotos(raw: unknown): StoredPhoto[] {
    let value = raw;
    if (typeof value === 'string') {
        try { value = JSON.parse(value); } catch { value = [value]; }
    }
    if (!Array.isArray(value)) return [];
    return value.flatMap((p): StoredPhoto[] => {
        if (typeof p === 'string') {
            const key = p.trim();
            return key ? [{ key, name: key.split('/').pop() || 'Photo', type: 'image/jpeg' }] : [];
        }
        if (p && typeof p === 'object') {
            const o = p as Record<string, unknown>;
            const key = String(o.key || o.url || '').trim();
            return key ? [{ key, name: String(o.name || key.split('/').pop() || 'Photo'), type: String(o.type || 'image/jpeg') }] : [];
        }
        return [];
    });
}
