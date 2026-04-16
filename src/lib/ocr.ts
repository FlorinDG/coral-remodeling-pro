/**
 * Client-side OCR utility for expense ticket scanning.
 * Uses Tesseract.js for text recognition on receipt/ticket images.
 * 
 * Strategy: Extract raw text, then use regex patterns for Belgian receipt formats
 * to pull out amounts (€), dates (dd/mm/yyyy), and merchant names.
 */

export interface OCRResult {
    rawText: string;
    extractedAmount: number | null;
    extractedVatAmount: number | null;
    extractedDate: string | null;  // ISO yyyy-mm-dd
    extractedMerchant: string | null;
    confidence: number;
}

let tesseractWorker: any = null;

/**
 * Lazily initializes the Tesseract.js worker.
 * Only loads the library when first called to avoid blocking page load.
 */
async function getWorker() {
    if (tesseractWorker) return tesseractWorker;

    const Tesseract = await import('tesseract.js');
    tesseractWorker = await Tesseract.createWorker('nld+fra+eng', undefined, {
        // Use CDN for language data
        logger: (m: any) => {
            if (m.status === 'recognizing text') {
                // Progress can be tracked here if needed
            }
        },
    });

    return tesseractWorker;
}

/**
 * Preprocesses an image file for better OCR accuracy.
 * Converts to grayscale and increases contrast using Canvas API.
 */
async function preprocessImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                URL.revokeObjectURL(url);
                resolve(url); // Fallback: return original
                return;
            }

            canvas.width = img.width;
            canvas.height = img.height;

            // Draw original
            ctx.drawImage(img, 0, 0);

            // Get image data for processing
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            // Convert to grayscale and increase contrast
            for (let i = 0; i < data.length; i += 4) {
                // Luminance formula
                const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

                // Increase contrast (stretch histogram)
                const contrast = 1.5;
                const adjusted = Math.min(255, Math.max(0, ((gray - 128) * contrast) + 128));

                // Threshold for cleaner text
                const final = adjusted > 140 ? 255 : 0;

                data[i] = final;
                data[i + 1] = final;
                data[i + 2] = final;
            }

            ctx.putImageData(imageData, 0, 0);

            const processedUrl = canvas.toDataURL('image/png');
            URL.revokeObjectURL(url);
            resolve(processedUrl);
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load image for preprocessing'));
        };

        img.src = url;
    });
}

/**
 * Recognizes text from a receipt/ticket image and extracts structured data.
 * Best-effort extraction: returns null for fields that can't be determined.
 */
export async function recognizeReceipt(file: File): Promise<OCRResult> {
    const worker = await getWorker();

    // Preprocess the image for better accuracy
    const processedImage = await preprocessImage(file);

    const { data } = await worker.recognize(processedImage);

    const rawText = data.text;
    const confidence = data.confidence;

    // Extract amount — look for EUR/€ patterns and take the largest (total)
    const extractedAmount = extractAmount(rawText);
    const extractedVatAmount = extractVatAmount(rawText);
    const extractedDate = extractDate(rawText);
    const extractedMerchant = extractMerchant(rawText);

    return {
        rawText,
        extractedAmount,
        extractedVatAmount,
        extractedDate,
        extractedMerchant,
        confidence,
    };
}

/**
 * Extract the total amount from receipt text.
 * Looks for patterns like: TOTAAL €12,50 / TOTAL: 12.50 EUR / €12,50
 * Returns the largest amount found (usually the grand total).
 */
function extractAmount(text: string): number | null {
    const amounts: number[] = [];

    // Patterns: €12,50 / EUR 12.50 / 12,50 EUR / TOTAL 12.50 / TOTAAL: €12,50
    const patterns = [
        /(?:TOTAA?L|TOTAL|TE BETALEN|BEDRAG|AMOUNT|SUBTOTAL|SOUS-TOTAL)\s*:?\s*€?\s*([\d]+[.,]\d{2})/gi,
        /€\s*([\d]+[.,]\d{2})/g,
        /([\d]+[.,]\d{2})\s*(?:EUR|€)/g,
    ];

    for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
            const val = parseFloat(match[1].replace(',', '.'));
            if (!isNaN(val) && val > 0 && val < 100000) {
                amounts.push(val);
            }
        }
    }

    if (amounts.length === 0) return null;
    // Return the largest amount (usually the total)
    return Math.max(...amounts);
}

/**
 * Extract VAT amount from receipt text.
 * Patterns: BTW 21% €2,63 / TVA: 2.63 / VAT: 2.63
 */
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

/**
 * Extract date from receipt text.
 * Handles Belgian formats: dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy
 * Returns ISO yyyy-mm-dd format.
 */
function extractDate(text: string): string | null {
    // dd/mm/yyyy or dd-mm-yyyy or dd.mm.yyyy
    const datePattern = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/g;
    let match;

    while ((match = datePattern.exec(text)) !== null) {
        let day = parseInt(match[1]);
        let month = parseInt(match[2]);
        let year = parseInt(match[3]);

        // Fix 2-digit year
        if (year < 100) year += 2000;

        // Validate
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2020 && year <= 2030) {
            return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
    }

    return null;
}

/**
 * Extract merchant name from receipt text.
 * Heuristic: The first non-empty, non-numeric line is usually the store name.
 */
function extractMerchant(text: string): string | null {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2);

    for (const line of lines.slice(0, 5)) { // Check first 5 lines
        // Skip lines that are mostly numbers or common receipt headers
        if (/^\d+$/.test(line)) continue;
        if (/^(datum|date|tijd|time|kasbon|receipt|factuur|nr|tel|fax)/i.test(line)) continue;
        if (/^[€$\d\s.,]+$/.test(line)) continue;

        // Clean up and return
        const cleaned = line.replace(/[^\w\s&'.\-àáâãäåæçèéêëìíîïðñòóôõöùúûüý]/gi, '').trim();
        if (cleaned.length >= 3) {
            return cleaned.substring(0, 60); // Cap at 60 chars
        }
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
