/**
 * Client-side OCR utility for expense ticket / invoice scanning.
 * Supports both image files (JPG, PNG, WebP) and PDF files.
 *
 * PDF strategy: use pdf.js to render the first page to a canvas, then OCR that bitmap.
 * Image strategy: convert to grayscale + high-contrast canvas for better Tesseract accuracy.
 */

export interface OCRResult {
    rawText: string;
    extractedAmount: number | null;
    extractedVatAmount: number | null;
    extractedDate: string | null;  // ISO yyyy-mm-dd
    extractedMerchant: string | null;
    confidence: number;
    pageCount?: number; // how many PDF pages were detected
}

let tesseractWorker: any = null;

/**
 * Lazily initializes the Tesseract.js worker.
 */
async function getWorker() {
    if (tesseractWorker) return tesseractWorker;

    const Tesseract = await import('tesseract.js');
    tesseractWorker = await Tesseract.createWorker('nld+fra+eng', undefined, {
        logger: () => {},
    });

    return tesseractWorker;
}

/**
 * Renders the first page of a PDF to a canvas data URL.
 * Uses pdf.js loaded dynamically to avoid SSR issues.
 */
async function renderPdfFirstPage(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();

    // Dynamically import pdf.js — avoid blocking initial page load
    const pdfjsLib = await import('pdfjs-dist');

    // Point the worker at the same version bundled by npm.
    // Using CDN to avoid separate webpack worker bundle complexity.
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);

    // Render at 2x scale for better OCR resolution
    const scale = 2.0;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext('2d')!;
    // pdfjs-dist v5: canvas (HTMLCanvasElement) is the required field; canvasContext is optional
    await page.render({ canvas, canvasContext: ctx, viewport } as any).promise;

    // Store page count on the canvas as a side-channel (returned separately below)
    (canvas as any).__pdfPageCount = pdf.numPages;

    return canvas.toDataURL('image/png');
}

/**
 * Preprocesses an image file for better OCR accuracy.
 * Converts to high-contrast grayscale using Canvas API.
 */
async function preprocessImageFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                URL.revokeObjectURL(url);
                resolve(url);
                return;
            }

            // Upscale small images for better OCR
            const scale = Math.max(1, 2000 / Math.max(img.width, img.height));
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;

            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            for (let i = 0; i < data.length; i += 4) {
                const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                const contrast = 1.5;
                const adjusted = Math.min(255, Math.max(0, ((gray - 128) * contrast) + 128));
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

/**
 * Routes preprocessing based on file type.
 * PDFs are rendered via pdf.js; images are preprocessed via Canvas.
 */
async function prepareForOCR(file: File): Promise<{ dataUrl: string; pageCount?: number }> {
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    if (isPdf) {
        const dataUrl = await renderPdfFirstPage(file);
        return { dataUrl, pageCount: (document.createElement('canvas') as any).__pdfPageCount };
    }

    const dataUrl = await preprocessImageFile(file);
    return { dataUrl };
}

/**
 * Recognizes text from a receipt/invoice file (image or PDF) and extracts structured data.
 */
export async function recognizeReceipt(file: File): Promise<OCRResult> {
    const worker = await getWorker();

    const { dataUrl, pageCount } = await prepareForOCR(file);

    const { data } = await worker.recognize(dataUrl);
    const rawText = data.text;
    const confidence = data.confidence;

    return {
        rawText,
        extractedAmount: extractAmount(rawText),
        extractedVatAmount: extractVatAmount(rawText),
        extractedDate: extractDate(rawText),
        extractedMerchant: extractMerchant(rawText),
        confidence,
        pageCount,
    };
}

// ─── Extraction helpers ──────────────────────────────────────────────────────

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
            if (!isNaN(val) && val > 0 && val < 100000) amounts.push(val);
        }
    }

    return amounts.length > 0 ? Math.max(...amounts) : null;
}

function extractVatAmount(text: string): number | null {
    const patterns = [
        /(?:BTW|TVA|VAT)\s*(?:\d{1,2}%?)?\s*:?\s*€?\s*([\d]+[.,]\d{2})/gi,
    ];

    for (const pattern of patterns) {
        const match = pattern.exec(text);
        if (match) {
            const val = parseFloat(match[1].replace(',', '.'));
            if (!isNaN(val) && val > 0) return val;
        }
    }
    return null;
}

function extractDate(text: string): string | null {
    const datePattern = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/g;
    let match;

    while ((match = datePattern.exec(text)) !== null) {
        let day = parseInt(match[1]);
        let month = parseInt(match[2]);
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

/**
 * Cleanup: terminate the Tesseract worker when no longer needed.
 */
export async function terminateOCR() {
    if (tesseractWorker) {
        await tesseractWorker.terminate();
        tesseractWorker = null;
    }
}
