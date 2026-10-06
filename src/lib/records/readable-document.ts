/**
 * SCAN-2 · which files the document reader can read — decided from the file's FIRST BYTES, never its label
 * (Florin 2026-10-06: "work root to leaf, fix it at the deepest level"). Pure, tested (tests/readable-document.test.ts).
 *
 * Found: the scan sent any unknown image type to the AI labelled "image/jpeg" — an iPhone HEIC photo arrived as bytes
 * the reader cannot decode, and came back empty ("Expense", €0). Now: the real format is detected; JPEG / PNG / WebP /
 * GIF / PDF are read; HEIC and anything else is REFUSED with its reason, before any reading (or quota) is spent.
 * At the source, `READABLE_ACCEPT` on every upload input makes iOS convert a HEIC photo to JPEG itself.
 */
export const READABLE_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';

export type Readable =
    | { ok: true; kind: 'pdf' }
    | { ok: true; kind: 'image'; mime: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' }
    | { ok: false; reason: 'heic' | 'unsupported' | 'empty' };

const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.subarray(from, to));

export function readableDocument(bytes: Uint8Array): Readable {
    if (!bytes || bytes.length < 12) return { ok: false, reason: 'empty' };
    if (ascii(bytes, 0, 5) === '%PDF-') return { ok: true, kind: 'pdf' };
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { ok: true, kind: 'image', mime: 'image/jpeg' };
    if (bytes[0] === 0x89 && ascii(bytes, 1, 4) === 'PNG') return { ok: true, kind: 'image', mime: 'image/png' };
    if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return { ok: true, kind: 'image', mime: 'image/webp' };
    if (ascii(bytes, 0, 4) === 'GIF8') return { ok: true, kind: 'image', mime: 'image/gif' };
    if (ascii(bytes, 4, 8) === 'ftyp' && /^(heic|heix|hevc|hevx|heim|heis|mif1|msf1|avif)$/.test(ascii(bytes, 8, 12))) return { ok: false, reason: 'heic' };
    return { ok: false, reason: 'unsupported' };
}

/** The refusal the person reads (Dutch, like the review reasons). */
export function unreadableMessage(reason: 'heic' | 'unsupported' | 'empty'): string {
    if (reason === 'heic') return 'HEIC-foto (iPhone) kan niet gelezen worden — kies JPEG ("Meest compatibel" in de camera-instellingen) of laad hem opnieuw op via de knop, dan zet de iPhone hem zelf om.';
    if (reason === 'empty') return 'Leeg of onvolledig bestand.';
    return 'Dit bestandsformaat kan niet gelezen worden — gebruik PDF, JPEG, PNG of WebP.';
}
