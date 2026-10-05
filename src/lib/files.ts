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

/**
 * The href of a URL-type field. A stored FILE (a storage key 't_…' — e.g. "Bonnetje" / receiptUrl, written by the
 * scan and the bulk import) opens through the file route; a web address as is; a bare domain gets https://.
 * Before: every value got "https://" prepended, so a storage key became a host name ("Safari can't find the
 * server t_cmn…", Florin 2026-10-05).
 */
export function urlFieldHref(value: unknown): string {
    const v = String(value ?? '').trim();
    if (!v) return '';
    if (v.startsWith('t_') || v.startsWith('/api/files/')) return resolveFileUrl(v);
    if (/^(https?:|mailto:|tel:|data:)/i.test(v)) return v;
    return `https://${v}`;
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
