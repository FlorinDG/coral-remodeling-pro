import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';

export const runtime = 'nodejs';
export const maxDuration = 60; // Increased — pdfjs page render can take longer

// ─── OCR Engine Types ─────────────────────────────────────────────────────────

type OcrEngine = 'GPT4O' | 'MINDEE' | 'VERYFI';

// ─── Prompts ──────────────────────────────────────────────────────────────────

const INVOICE_SYSTEM_PROMPT = `You are an expert Belgian accountant extracting structured data from purchase invoice documents.
Return ONLY a valid JSON object matching this exact schema (no markdown, no explanation):
{
  "invoiceNumber": "string or null",
  "supplierName": "string or null",
  "supplierVat": "string (Belgian BE0xxx format) or null",
  "issueDate": "YYYY-MM-DD or null",
  "dueDate": "YYYY-MM-DD or null",
  "currency": "EUR",
  "totalExVat": number or null,
  "totalVat": number or null,
  "totalIncVat": number or null,
  "lines": [
    {
      "description": "string",
      "quantity": number,
      "unitCode": "string (e.g. stk, m, m2, uur)",
      "unitPrice": number,
      "vatRate": number (e.g. 21, 6, 0),
      "lineTotal": number
    }
  ]
}
Rules:
- All monetary values are numbers (no currency symbols).
- Dates must be YYYY-MM-DD. Belgian format is DD/MM/YYYY — convert it.
- If a field is truly absent, use null. Never invent data.
- lines[] may be empty [] if no line items are visible.`;

const TICKET_SYSTEM_PROMPT = `You are an expert extracting structured data from expense receipts and tickets.
Return ONLY a valid JSON object matching this exact schema (no markdown, no explanation):
{
  "merchant": "string or null",
  "date": "YYYY-MM-DD or null",
  "totalAmount": number or null,
  "vatAmount": number or null,
  "category": "one of: cat-fuel, cat-restaurant, cat-office, cat-tools, cat-materials, cat-parking, cat-transport, cat-other — or null"
}
Rules:
- All monetary values are numbers (no currency symbols).
- Dates: Belgian format is DD/MM/YYYY — convert to YYYY-MM-DD.
- For category, use context clues (e.g. restaurant name → cat-restaurant, gas station → cat-fuel).
- If a field is absent, use null.`;

// ─── PDF Helpers (pdfjs-dist) ─────────────────────────────────────────────────

/**
 * Extract text layer from a PDF buffer using pdfjs-dist.
 * Returns { text, pageCount, isScanned }
 * isScanned = true when the PDF has pages but no extractable text (image-only).
 */
async function extractPdfText(buffer: Buffer): Promise<{ text: string; pageCount: number; isScanned: boolean }> {
    // Dynamic import — pdfjs-dist is large and server-side only
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs' as any);

    // Suppress pdfjs worker warning in Node (no worker needed server-side)
    pdfjsLib.GlobalWorkerOptions = pdfjsLib.GlobalWorkerOptions ?? {};
    pdfjsLib.GlobalWorkerOptions.workerSrc = '';

    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
    let pdf: any;
    try {
        pdf = await loadingTask.promise;
    } catch (err: any) {
        if (err?.message?.includes('Password') || err?.name === 'PasswordException') {
            throw Object.assign(new Error('PDF is password-protected'), { code: 'PDF_ENCRYPTED' });
        }
        throw Object.assign(new Error('PDF could not be loaded: ' + (err?.message ?? 'unknown')), { code: 'PDF_LOAD_ERROR' });
    }

    const pageCount = pdf.numPages;
    const textParts: string[] = [];

    for (let i = 1; i <= Math.min(pageCount, 10); i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map((item: any) => item.str ?? '').join(' ').trim();
        if (pageText) textParts.push(pageText);
    }

    const text = textParts.join('\n\n').trim();
    return { text, pageCount, isScanned: text.length === 0 };
}

/**
 * Render first page of a PDF to a JPEG Buffer using pdfjs-dist canvas.
 * Used as fallback when the PDF has no text layer (scanned invoice image).
 */
async function renderPdfPageToImage(buffer: Buffer): Promise<Buffer | null> {
    try {
        // pdfjs canvas rendering requires the 'canvas' npm package on Node
        const { createCanvas } = await import('canvas' as any);
        const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs' as any);
        pdfjsLib.GlobalWorkerOptions = pdfjsLib.GlobalWorkerOptions ?? {};
        pdfjsLib.GlobalWorkerOptions.workerSrc = '';

        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);

        const scale = 2.0; // High-res for better OCR accuracy
        const viewport = page.getViewport({ scale });
        const canvas = createCanvas(viewport.width, viewport.height);
        const context = canvas.getContext('2d');

        await page.render({ canvasContext: context, viewport }).promise;
        return canvas.toBuffer('image/jpeg', { quality: 0.92 });
    } catch {
        // canvas package not installed — can't render. Return null, caller handles gracefully.
        return null;
    }
}

// ─── GPT-4o Extraction ────────────────────────────────────────────────────────

async function extractViaGpt4o(
    openai: OpenAI,
    input: { type: 'image'; buffer: Buffer; mimeType: string } | { type: 'text'; text: string },
    isInvoice: boolean
): Promise<string> {
    const systemPrompt = isInvoice ? INVOICE_SYSTEM_PROMPT : TICKET_SYSTEM_PROMPT;

    if (input.type === 'text') {
        const safeText = input.text.slice(0, 100_000);
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            max_tokens: 2000,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Extract all structured data from this document text:\n\n${safeText}` }
            ]
        });
        return response.choices[0].message.content ?? '{}';
    } else {
        const safeMime = (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(input.mimeType))
            ? input.mimeType : 'image/jpeg';
        const base64 = input.buffer.toString('base64');
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            max_tokens: 2000,
            messages: [
                { role: 'system', content: systemPrompt },
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: 'Extract all structured data from this document image.' },
                        { type: 'image_url', image_url: { url: `data:${safeMime};base64,${base64}`, detail: 'high' } }
                    ]
                }
            ]
        });
        return response.choices[0].message.content ?? '{}';
    }
}

// ─── Engine Stubs (future providers) ─────────────────────────────────────────

async function extractViaMindee(_buffer: Buffer, _isInvoice: boolean): Promise<string> {
    // TODO: Implement when MINDEE_API_KEY is configured for this tenant
    throw Object.assign(new Error('Mindee OCR is not yet configured for this account. Contact support.'), { code: 'NOT_CONFIGURED' });
}

async function extractViaVeryfi(_buffer: Buffer, _isInvoice: boolean): Promise<string> {
    // TODO: Implement when VERYFI credentials are configured for this tenant
    throw Object.assign(new Error('Veryfi OCR is not yet configured for this account. Contact support.'), { code: 'NOT_CONFIGURED' });
}

// ─── Quota Helpers ────────────────────────────────────────────────────────────

async function checkAndIncrementQuota(tenantId: string): Promise<{ allowed: boolean; remaining: number }> {
    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { scanCount: true, scanQuota: true, scanCountResetAt: true }
    });
    if (!tenant) return { allowed: false, remaining: 0 };

    // Auto-reset if we've rolled into a new calendar month
    const now = new Date();
    const resetAt = new Date(tenant.scanCountResetAt);
    const needsReset = now.getMonth() !== resetAt.getMonth() || now.getFullYear() !== resetAt.getFullYear();

    let currentCount = needsReset ? 0 : tenant.scanCount;
    const quota = tenant.scanQuota;
    const isUnlimited = quota === -1;

    if (!isUnlimited && currentCount >= quota) {
        return { allowed: false, remaining: 0 };
    }

    // Increment atomically
    await prisma.tenant.update({
        where: { id: tenantId },
        data: {
            scanCount: currentCount + 1,
            ...(needsReset ? { scanCountResetAt: now } : {}),
        }
    });

    return { allowed: true, remaining: isUnlimited ? 9999 : quota - currentCount - 1 };
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
    const session = await auth();
    const tenantId = (session?.user as any)?.tenantId;
    if (!tenantId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // ── Load tenant config (engine + quota) ───────────────────────────────
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { ocrEngine: true, scanCount: true, scanQuota: true, scanCountResetAt: true }
        });

        const ocrEngine = (tenant?.ocrEngine ?? 'GPT4O') as OcrEngine;

        // ── Quota gate ────────────────────────────────────────────────────────
        const { allowed, remaining } = await checkAndIncrementQuota(tenantId);
        if (!allowed) {
            return NextResponse.json({
                error: `You have reached your monthly scan limit (${tenant?.scanQuota} scans). Upgrade your plan for more.`,
                code: 'QUOTA_EXCEEDED',
                quota: tenant?.scanQuota,
                remaining: 0,
            }, { status: 429 });
        }

        // ── Parse form data ───────────────────────────────────────────────────
        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        const targetDb = (formData.get('targetDb') as string) || 'db-tickets';
        const isInvoice = targetDb === 'db-expenses';

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        const buffer = Buffer.from(await file.arrayBuffer());

        // ── Validate engine-specific API key ──────────────────────────────────
        if (ocrEngine === 'GPT4O' && !process.env.OPENAI_API_KEY) {
            return NextResponse.json({
                error: 'OCR service not configured. Please contact support.',
                code: 'NO_API_KEY'
            }, { status: 503 });
        }

        const openai = ocrEngine === 'GPT4O'
            ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
            : null;

        // ── Extract structured data ───────────────────────────────────────────
        let rawJson: string;

        if (isPdf) {
            // ── pdfjs-dist: attempt text extraction first ──────────────────
            const { text, isScanned } = await extractPdfText(buffer).catch((err: any) => {
                // Surface encrypted/load errors immediately
                if (err.code === 'PDF_ENCRYPTED') {
                    throw Object.assign(new Error(
                        'This PDF is password-protected. Please remove the password and try again.'
                    ), { code: 'PDF_ENCRYPTED', status: 422 });
                }
                throw Object.assign(new Error(
                    'This PDF could not be opened. It may be corrupted. Try uploading a photo instead.'
                ), { code: 'PDF_LOAD_ERROR', status: 422 });
            });

            if (!isScanned && text.length > 0) {
                // Digital PDF — text layer present → cheaper text-based extraction
                if (ocrEngine === 'GPT4O') {
                    rawJson = await extractViaGpt4o(openai!, { type: 'text', text }, isInvoice);
                } else if (ocrEngine === 'MINDEE') {
                    rawJson = await extractViaMindee(buffer, isInvoice);
                } else {
                    rawJson = await extractViaVeryfi(buffer, isInvoice);
                }
            } else {
                // Scanned PDF — no text layer. Try rendering page 1 to image.
                const pageImage = await renderPdfPageToImage(buffer);
                if (pageImage) {
                    if (ocrEngine === 'GPT4O') {
                        rawJson = await extractViaGpt4o(openai!, { type: 'image', buffer: pageImage, mimeType: 'image/jpeg' }, isInvoice);
                    } else if (ocrEngine === 'MINDEE') {
                        rawJson = await extractViaMindee(pageImage, isInvoice);
                    } else {
                        rawJson = await extractViaVeryfi(pageImage, isInvoice);
                    }
                } else {
                    return NextResponse.json({
                        error: 'This PDF is a scanned image with no text layer and could not be rendered. Please upload a photo of the document instead.',
                        code: 'NO_TEXT_LAYER',
                        remaining,
                    }, { status: 422 });
                }
            }
        } else {
            // Image file (JPEG, PNG, WEBP, etc.)
            if (ocrEngine === 'GPT4O') {
                rawJson = await extractViaGpt4o(openai!, { type: 'image', buffer, mimeType: file.type || 'image/jpeg' }, isInvoice);
            } else if (ocrEngine === 'MINDEE') {
                rawJson = await extractViaMindee(buffer, isInvoice);
            } else {
                rawJson = await extractViaVeryfi(buffer, isInvoice);
            }
        }

        // ── Parse extraction result ───────────────────────────────────────────
        let extracted: Record<string, any> = {};
        try {
            // GPT-4o sometimes wraps JSON in ```json ... ``` — strip it
            const clean = rawJson.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
            extracted = JSON.parse(clean);
        } catch {
            console.warn('[/api/scan] OCR returned non-JSON:', rawJson.slice(0, 200));
        }

        // ── Ensure parent DB exists ───────────────────────────────────────────
        const existingDb = await prisma.globalDatabase.findUnique({
            where: { id: targetDb },
            select: { id: true, tenantId: true }
        });

        if (!existingDb) {
            await prisma.globalDatabase.create({
                data: {
                    id: targetDb,
                    tenantId,
                    name: isInvoice ? 'Purchase Invoices' : 'Expense Tickets',
                    properties: [],
                    views: [],
                    activeFilters: [],
                    activeSorts: [],
                    isTemplate: false,
                    ownerId: 'system',
                }
            });
        } else if (existingDb.tenantId !== tenantId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        // ── Build page properties ─────────────────────────────────────────────
        const pageId = uuidv4();
        let properties: Record<string, any>;

        if (isInvoice) {
            properties = {
                title: extracted.invoiceNumber || `INV-${new Date().toISOString().slice(0, 10)}`,
                supplierName: extracted.supplierName || '',
                supplierVat: extracted.supplierVat || '',
                source: 'src-pdf',
                status: 'opt-draft',
                invoiceDate: extracted.issueDate || '',
                dueDate: extracted.dueDate || '',
                totalExVat: extracted.totalExVat ?? 0,
                totalVat: extracted.totalVat ?? 0,
                totalIncVat: extracted.totalIncVat ?? 0,
                invoiceLines: JSON.stringify(extracted.lines ?? []),
                betreft: extracted.lines?.[0]?.description || '',
                peppolDocId: '',
                supplier: [],
            };
        } else {
            properties = {
                title: extracted.merchant || 'Expense',
                date: extracted.date || new Date().toISOString().split('T')[0],
                amount: extracted.totalAmount ?? 0,
                vatAmount: extracted.vatAmount ?? 0,
                category: extracted.category || '',
                currency: 'cur-eur',
                paymentMethod: 'pm-card',
                notes: '',
                receiptUrl: '',
            };
        }

        // ── Save to Postgres ──────────────────────────────────────────────────
        const savedPage = await prisma.globalPage.create({
            data: {
                id: pageId,
                databaseId: targetDb,
                properties,
                order: 0,
                blocks: [],
                createdBy: 'scan',
                lastEditedBy: 'scan',
            }
        });

        return NextResponse.json({
            success: true,
            engine: ocrEngine,
            remaining,
            page: {
                id: savedPage.id,
                databaseId: savedPage.databaseId,
                properties: savedPage.properties,
                order: savedPage.order,
                blocks: [],
                createdAt: savedPage.createdAt.toISOString(),
                updatedAt: savedPage.updatedAt.toISOString(),
                createdBy: savedPage.createdBy,
                lastEditedBy: savedPage.lastEditedBy,
            },
            extracted,
        });

    } catch (e: any) {
        // Surface structured errors with explicit codes
        if (e.status) {
            return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
        }
        console.error('[/api/scan] Error:', e?.message ?? e);
        return NextResponse.json({ error: e?.message || 'Scan failed' }, { status: 500 });
    }
}
