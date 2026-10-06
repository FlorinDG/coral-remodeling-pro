/**
 * Generate PDF Blob — with optional stationery merge.
 *
 * 1. Renders the React element to a PDF via @react-pdf/renderer
 * 2. If stationeryUrl is a PDF, merges it as background using pdf-lib
 * 3. If stationeryUrl is an image, the template itself renders it (no merge needed)
 *
 * Returns a Blob ready for download, email, or upload.
 */
import { cloneElement, isValidElement } from 'react';
import { pdf } from '@react-pdf/renderer';
import { measureStationery } from '@/lib/documents/measure-stationery';

export async function generatePdfBlob(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    doc: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tenantProfile?: any,
): Promise<Blob> {
    // PDF-FIT-1: an image letterhead is measured — the content uses the page between its header and footer
    const area = await measureStationery(tenantProfile);
    if (area && isValidElement(doc) && (doc.props as { contentArea?: unknown }).contentArea === undefined) {
        doc = cloneElement(doc as React.ReactElement<{ contentArea?: unknown }>, { contentArea: area });
    }
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
