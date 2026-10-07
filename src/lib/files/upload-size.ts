/**
 * MOBILE-SCAN-1 · how big a file may travel to the server (Florin 2026-10-07: "I have no way, from the mobile version
 * of our ERP, to take a photo of a receipt and send it in the system"). Pure, tested (tests/upload-size.test.ts).
 *
 * Found: a phone photo (3–12 MB) was sent as is to /api/scan and to the file upload. Vercel refuses a function request
 * body above ~4.5 MB (the Next `bodySizeLimit: '20mb'` does not lift the platform's cap) — the photo never arrived:
 * no reading, no record, no file. Now a photo is shrunk on the phone first (prepare-upload): its long side to
 * MAX_IMAGE_SIDE px as JPEG — sharp enough to read, well under the cap. What is still too big is refused with a reason.
 */
export const MAX_UPLOAD_BYTES = 4_000_000;   // under the platform's ~4.5 MB, leaving room for the form fields
export const MAX_IMAGE_SIDE = 2000;           // px — a receipt stays readable for the AI and for a person
export const SHRINK_ABOVE_BYTES = 1_200_000;  // smaller photos travel as they are

/** The size an image is re-encoded at: the long side capped, the proportions kept; never enlarged. */
export function targetSize(width: number, height: number, maxSide = MAX_IMAGE_SIDE): { width: number; height: number } {
    const long = Math.max(width, height);
    if (!long || long <= maxSide) return { width, height };
    const k = maxSide / long;
    return { width: Math.round(width * k), height: Math.round(height * k) };
}

/** Should this file be shrunk before it travels? (Only readable photo formats; PDFs travel as they are.) */
export function shouldShrink(type: string, bytes: number, width?: number, height?: number): boolean {
    if (!/^image\/(jpeg|png|webp)$/.test(type)) return false;
    return bytes > SHRINK_ABOVE_BYTES || Math.max(width ?? 0, height ?? 0) > MAX_IMAGE_SIDE;
}

export function tooLargeMessage(bytes: number): string {
    return `Bestand te groot (${(bytes / 1_000_000).toFixed(1)} MB, max ${(MAX_UPLOAD_BYTES / 1_000_000).toFixed(0)} MB) — maak een foto of exporteer de PDF kleiner.`;
}
