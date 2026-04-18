/**
 * Client-side OCR utility for expense ticket / invoice scanning.
 * Supports image files (JPG, PNG, WebP) and multi-page PDFs.
 *
 * PDF strategy:
 *   - Render each page to a high-resolution canvas (2× scale) via pdf.js
 *   - OCR each page separately via Tesseract.js
 *   - Concatenate full text; surface page count so caller can ask
 *     "import as one document or split into N separate invoices?"
 *
 * Image strategy:
 *   - Convert to high-contrast grayscale bitmap via Canvas API for Tesseract
 */

export interface OCRResult {
    rawText: string;
    extractedAmount: number | null;
    extractedVatAmount: number | null;
    extractedDate: string | null;   // ISO yyyy-mm-dd
    extractedMerchant: string | null;
    confidence: number;
    pageCount: number;              // 1 for images; N for PDFs
    /** Raw text per page — only populated for multi-page PDFs */
    pageTexts?: string[];
}

let tesseractWorker: any = null;

// ─── Tesseract ───────────────────────────────────────────────────────────────

async function getWorker() {
    if (tesseractWorker) return tesseractWorker;
    const Tesseract = await import('tesseract.js');
    tesseractWorker = await Tesseract.createWorker('nld+fra+eng', undefined, {
        logger: () => {},
    });
    return tesseractWorker;
}

// ─── PDF rendering ────────────────────────────────────────────────────────────

/**
 * Renders every page of a PDF to an array of PNG data URLs.
 * Uses the legacy CJS build (aliased in next.config.ts) to avoid Webpack conflicts.
 */
async function renderPdfPages(file: File): Promise<string[]> {
    const arrayBuffer = await file.arrayBuffer();
    const pdfjsLib = await import('pdfjs-dist');

    // Worker script: point to the matching CDN version so we don't need a separate webpack worker
    const version = (pdfjsLib as any).version ?? '5.0.0';
    pdfjsLib.GlobalWorkerOptions.workerSrc =
        `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.mjs`;

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pageCount = pdf.numPages;
    const dataUrls: string[] = [];

    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
        const page = await pdf.getPage(pageNum);

        // 2× scale = better OCR resolution
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const ctx = canvas.getContext('2d')!;
        // pdfjs-dist v5: `canvas` is the primary param; `canvasContext` is legacy-supported
        await page.render({ canvas, canvasContext: ctx as any, viewport } as any).promise;

        dataUrls.push(canvas.toDataURL('image/png'));
        canvas.remove();
    }

    return dataUrls;
}

// ─── Image preprocessing ──────────────────────────────────────────────────────

async function preprocessImageFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            // Upscale small images for better OCR
            const scale = Math.max(1, 2000 / Math.max(img.width, img.height));
            const canvas = document.createElement('canvas');
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;

            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            for (let i = 0; i < data.length; i += 4) {
                const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                const adjusted = Math.min(255, Math.max(0, ((gray - 128) * 1.5) + 128));
                const final = adjusted > 140 ? 255 : 0;
                data[i] = final;
                data[i + 1] = final;
                data[i + 2] = final;
            }

            ctx.putImageData(imageData, 0, 0);
            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL('image/png'));
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load image for preprocessing'));
        };

        img.src = url;
    });
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Recognizes text from a file (image or PDF) and extracts structured data.
 *
 * For multi-page PDFs:
 *   - All pages are OCR'd and the full text is concatenated.
 *   - `pageTexts` contains per-page raw text.
 *   - `pageCount` > 1 so the caller can ask the user whether to split.
 */
export async function recognizeReceipt(file: File): Promise<OCRResult> {
    const worker = await getWorker();
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    if (isPdf) {
        const pageDataUrls = await renderPdfPages(file);
        const pageCount = pageDataUrls.length;

        const pageTexts: string[] = [];
        let totalConfidence = 0;

        for (const dataUrl of pageDataUrls) {
            const { data } = await worker.recognize(dataUrl);
            pageTexts.push(data.text);
            totalConfidence += data.confidence;
        }

        const rawText = pageTexts.join('\n\n--- PAGE BREAK ---\n\n');
        const confidence = totalConfidence / pageCount;

        return {
            rawText,
            extractedAmount: extractAmount(rawText),
            extractedVatAmount: extractVatAmount(rawText),
            extractedDate: extractDate(rawText),
            extractedMerchant: extractMerchant(rawText),
            confidence,
            pageCount,
            pageTexts: pageCount > 1 ? pageTexts : undefined,
        };
    }

    // Image path
    const dataUrl = await preprocessImageFile(file);
    const { data } = await worker.recognize(dataUrl);

    return {
        rawText: data.text,
        extractedAmount: extractAmount(data.text),
        extractedVatAmount: extractVatAmount(data.text),
        extractedDate: extractDate(data.text),
        extractedMerchant: extractMerchant(data.text),
        confidence: data.confidence,
        pageCount: 1,
    };
}

// ─── Extraction helpers ───────────────────────────────────────────────────────

function extractAmount(text: string): number | null {
    const amounts: number[] = [];
    const patterns = [
        /(?:TOTAA?L|TOTAL|TE BETALEN|BEDRAG|AMOUNT|SUBTOTAL|SOUS-TOTAL)\s*:?\s*€?\s*([\d]+[.,]\d{2})/gi,
        /€\s*([\d]+[.,]\d{2})/g,
        /([\d]+[.,]\d{2})\s*(?:EUR|€)/g,
    ];
    for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
            const val = parseFloat(match[1].replace(',', '.'));
            if (!isNaN(val) && val > 0 && val < 100_000) amounts.push(val);
        }
    }
    return amounts.length > 0 ? Math.max(...amounts) : null;
}

function extractVatAmount(text: string): number | null {
    const pattern = /(?:BTW|TVA|VAT)\s*(?:\d{1,2}%?)?\s*:?\s*€?\s*([\d]+[.,]\d{2})/gi;
    const match = pattern.exec(text);
    if (match) {
        const val = parseFloat(match[1].replace(',', '.'));
        if (!isNaN(val) && val > 0) return val;
    }
    return null;
}

function extractDate(text: string): string | null {
    const datePattern = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/g;
    let match;
    while ((match = datePattern.exec(text)) !== null) {
        const day = parseInt(match[1]);
        const month = parseInt(match[2]);
        let year = parseInt(match[3]);
        if (year < 100) year += 2000;
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2020 && year <= 2030) {
            return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
    }
    return null;
}

function extractMerchant(text: string): string | null {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2);
    for (const line of lines.slice(0, 5)) {
        if (/^\d+$/.test(line)) continue;
        if (/^(datum|date|tijd|time|kasbon|receipt|factuur|nr|tel|fax)/i.test(line)) continue;
        if (/^[€$\d\s.,]+$/.test(line)) continue;
        const cleaned = line.replace(/[^\w\s&'.\-àáâãäåæçèéêëìíîïðñòóôõöùúûüý]/gi, '').trim();
        if (cleaned.length >= 3) return cleaned.substring(0, 60);
    }
    return null;
}

export async function terminateOCR() {
    if (tesseractWorker) {
        await tesseractWorker.terminate();
        tesseractWorker = null;
    }
}
