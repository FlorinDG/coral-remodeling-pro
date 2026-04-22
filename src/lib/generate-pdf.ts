/**
 * Generate PDF Blob — with optional stationery merge.
 *
 * 1. Renders the React element to a PDF via @react-pdf/renderer
 * 2. If stationeryUrl is a PDF, merges it as background using pdf-lib
 * 3. If stationeryUrl is an image, the template itself renders it (no merge needed)
 *
 * Returns a Blob ready for download, email, or upload.
 */
import { pdf } from '@react-pdf/renderer';

export async function generatePdfBlob(
    doc: any,
    tenantProfile?: any,
): Promise<Blob> {
    const renderer = pdf(doc);
    const blob = await renderer.toBlob();

    // Check if stationery is a PDF that needs pdf-lib merging
    const { stationeryUrl, documentMode } = tenantProfile || {};
    const isPdfStationery =
        documentMode === 'stationery' &&
        stationeryUrl &&
        stationeryUrl.startsWith('data:application/pdf');

    if (!isPdfStationery) {
        // Image stationery is handled inside the template via <Image> — return as-is
        return blob;
    }

    // Merge the data PDF onto the stationery PDF background
    const { mergeStationery } = await import('@/lib/pdf-stationery');
    const dataBytes = await blob.arrayBuffer();
    const mergedBytes = await mergeStationery(dataBytes, stationeryUrl);
    return new Blob([mergedBytes as BlobPart], { type: 'application/pdf' });
}
