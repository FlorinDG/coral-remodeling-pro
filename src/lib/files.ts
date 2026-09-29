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
