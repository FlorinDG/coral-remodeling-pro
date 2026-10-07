/**
 * MOBILE-SCAN-1 · a photo is made fit to travel IN THE BROWSER before it is sent (rules: upload-size). Every upload
 * path of a purchase document uses this — the ticket capture (camera), the bulk import, the editor's file replace.
 */
import { shouldShrink, targetSize } from './upload-size';

async function decode(file: File): Promise<{ draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void; width: number; height: number } | null> {
    try {
        // honours the photo's EXIF orientation (a portrait receipt stays upright)
        const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
        return { draw: (ctx, w, h) => ctx.drawImage(bmp, 0, 0, w, h), width: bmp.width, height: bmp.height };
    } catch {
        const url = URL.createObjectURL(file);
        try {
            const img = await new Promise<HTMLImageElement>((resolve, reject) => {
                const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = url;
            });
            return { draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h), width: img.naturalWidth, height: img.naturalHeight };
        } catch { return null; } finally { URL.revokeObjectURL(url); }
    }
}

/** The file as it should travel: a large photo re-encoded as JPEG at a readable size; anything else unchanged. */
export async function prepareUpload(file: File): Promise<File> {
    if (typeof document === 'undefined' || !shouldShrink(file.type, file.size)) return file;
    const img = await decode(file);
    if (!img) return file;
    const { width, height } = targetSize(img.width, img.height);
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height);   // a transparent PNG gets a white page, not black
    img.draw(ctx, width, height);
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg', lastModified: file.lastModified });
}
