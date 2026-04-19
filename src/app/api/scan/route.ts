import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';

export const runtime = 'nodejs';
// Allow up to 30 seconds for GPT-4o vision on large images
export const maxDuration = 30;

// DO NOT instantiate OpenAI at module level — the key is not available at build time.
// It is instantiated inside the POST handler at runtime.

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function extractFromImage(openai: OpenAI, buffer: Buffer, mimeType: string, isInvoice: boolean) {
    // Mobile camera images often arrive with empty or incorrect MIME type
    const safeMime = (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mimeType))
        ? mimeType
        : 'image/jpeg';
    const base64 = buffer.toString('base64');

    const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 2000,
        messages: [
            { role: 'system', content: isInvoice ? INVOICE_SYSTEM_PROMPT : TICKET_SYSTEM_PROMPT },
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

async function extractFromPdfText(openai: OpenAI, text: string, isInvoice: boolean) {
    const safeText = text.slice(0, 100_000);
    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 2000,
        response_format: { type: 'json_object' },
        messages: [
            { role: 'system', content: isInvoice ? INVOICE_SYSTEM_PROMPT : TICKET_SYSTEM_PROMPT },
            { role: 'user', content: `Extract all structured data from this document text:\n\n${safeText}` }
        ]
    });
    return response.choices[0].message.content ?? '{}';
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
    const session = await auth();
    const tenantId = (session?.user as any)?.tenantId;
    if (!tenantId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Instantiate at runtime — OPENAI_API_KEY is not available during build
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    try {
        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        const targetDb = (formData.get('targetDb') as string) || 'db-tickets';

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const isInvoice = targetDb === 'db-expenses';
        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        const buffer = Buffer.from(await file.arrayBuffer());

        // ── Validate API key ─────────────────────────────────────────────────
        if (!process.env.OPENAI_API_KEY) {
            return NextResponse.json({
                error: 'OCR service not configured. Please contact support.',
                code: 'NO_API_KEY'
            }, { status: 503 });
        }

        // ── Extract structured data ──────────────────────────────────────────
        let rawJson: string;

        if (isPdf) {
            let pdfText: string;
            try {
                const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
                const parsed = await pdfParse(buffer);
                pdfText = parsed.text?.trim() ?? '';
            } catch (pdfErr: any) {
                // pdf-parse throws "The string did not match the expected pattern"
                // on malformed/encrypted PDFs — surface a clear message
                console.warn('[/api/scan] pdf-parse failed:', pdfErr?.message);
                return NextResponse.json({
                    error: 'This PDF could not be read. It may be encrypted, corrupted, or password-protected. Try uploading a photo of the document instead.',
                    code: 'PDF_PARSE_ERROR'
                }, { status: 422 });
            }

            if (!pdfText) {
                return NextResponse.json({
                    error: 'This PDF appears to be a scanned image with no text layer. Please upload a photo instead.',
                    code: 'NO_TEXT_LAYER'
                }, { status: 422 });
            }
            rawJson = await extractFromPdfText(openai, pdfText, isInvoice);
        } else {
            rawJson = await extractFromImage(openai, buffer, file.type || 'image/jpeg', isInvoice);
        }

        // Parse the GPT response
        let extracted: Record<string, any> = {};
        try {
            extracted = JSON.parse(rawJson);
        } catch {
            console.warn('[/api/scan] GPT returned non-JSON:', rawJson.slice(0, 200));
        }

        // ── Ensure the parent database exists in Postgres ────────────────────
        const existingDb = await prisma.globalDatabase.findUnique({
            where: { id: targetDb },
            select: { id: true, tenantId: true }
        });

        if (!existingDb) {
            // The locked DB hasn't been written yet (first session race).
            // We don't have the full schema here, so we create a minimal stub.
            // DatabaseClone will fill in the real schema on next load.
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

        // ── Build page properties from extracted data ─────────────────────────
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

        // ── Save the page directly to Postgres ───────────────────────────────
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

        // Return the confirmed page + the raw extracted fields for the form
        return NextResponse.json({
            success: true,
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
            extracted,  // Raw fields so the modal can pre-fill edit form
        });

    } catch (e: any) {
        console.error('[/api/scan] Error:', e?.message ?? e);
        return NextResponse.json({ error: e?.message || 'Scan failed' }, { status: 500 });
    }
}
