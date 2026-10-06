/**
 * PDF-FIT-1 · measure a letterhead IMAGE in the browser (documents are rendered there): draw it at page height,
 * count the inked pixels per row, and let the pure rule (stationery-area) find the writing band. Cached per letterhead.
 * A PDF letterhead (merged under the content by pdf-lib) cannot be rasterised without a PDF renderer — it keeps the
 * fixed margins (null). An image the browser may not read (cross-origin) → null → the fixed margins.
 */
import { contentAreaFromRows, A4_HEIGHT_PT, type ContentArea } from './stationery-area';

const cache = new Map<string, Promise<ContentArea | null>>();
const SAMPLE_W = 120;

function measure(url: string): Promise<ContentArea | null> {
    return new Promise(resolve => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = SAMPLE_W;
                canvas.height = A4_HEIGHT_PT;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                if (!ctx) return resolve(null);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, SAMPLE_W, A4_HEIGHT_PT);
                ctx.drawImage(img, 0, 0, SAMPLE_W, A4_HEIGHT_PT);   // as the template draws it: stretched over the page
                const data = ctx.getImageData(0, 0, SAMPLE_W, A4_HEIGHT_PT).data;
                const rows = new Float32Array(A4_HEIGHT_PT);
                for (let y = 0; y < A4_HEIGHT_PT; y++) {
                    let ink = 0;
                    for (let x = 0; x < SAMPLE_W; x++) {
                        const i = (y * SAMPLE_W + x) * 4;
                        if (Math.min(data[i], data[i + 1], data[i + 2]) < 235) ink++;   // anything visibly not paper
                    }
                    rows[y] = ink / SAMPLE_W;
                }
                resolve(contentAreaFromRows(rows));
            } catch {
                resolve(null);   // a tainted canvas (cross-origin image)
            }
        };
        img.onerror = () => resolve(null);
        img.src = url;
    });
}

/** The writing area on this tenant's letterhead, or null (= the template's fixed margins). */
export function measureStationery(profile: { documentMode?: string | null; stationeryUrl?: string | null } | null | undefined): Promise<ContentArea | null> {
    const url = profile?.documentMode === 'stationery' ? profile?.stationeryUrl : null;
    if (!url || url.startsWith('data:application/pdf') || typeof document === 'undefined') return Promise.resolve(null);
    if (!cache.has(url)) cache.set(url, measure(url));
    return cache.get(url)!;
}
