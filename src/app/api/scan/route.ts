/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { auth } from '@/auth';
import { platformDb, scopeFromSession } from '@/lib/data/scope';
import { saveRecord } from '@/lib/data/records';
import { readableDocument, unreadableMessage } from '@/lib/records/readable-document';
import { quoteScanProperties } from '@/lib/records/quote-scan';
import { purchaseLineBlocks } from '@/lib/records/purchase-lines';
import { isEmptyReading, ticketFields } from '@/lib/records/scan-reading';
import { buildScanUpdateIntent, buildScanCreateData } from '@/lib/records/peppol-scan-intents';
import { v4 as uuidv4 } from 'uuid';
import { type SystemDatabaseRole, SYSTEM_DATABASES, BASE_TO_KEY } from '@/lib/kernel/system-databases';
import { findPurchaseDuplicates } from '@/lib/data/duplicates';
import { duplicateFlag } from '@/lib/records/duplicates';
import { describeError } from '@/lib/describe-error';

export const runtime = 'nodejs';
export const maxDuration = 60; // Increased — pdfjs page render can take longer

// ─── OCR Engine Types ─────────────────────────────────────────────────────────

type OcrEngine = 'GPT4O' | 'MINDEE' | 'VERYFI' | 'TESSERACT';

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
  "structuredCommunication": "string (OGM format e.g. +++xxx/xxxx/xxxxx+++) or null",
  "supplierIban": "string or null",
  "supplierBic": "string or null",
  "documentType": "string (invoice or credit_note)",
  "reverseCharge": boolean (true if reverse charge / medecontractant / btw verlegd is explicitly mentioned),
  "subject": "string or null",
  "orderReference": "string or null",
  "deliveryDate": "YYYY-MM-DD or null",
  "supplierAddress": {
    "street": "string or null",
    "postalCode": "string or null",
    "city": "string or null",
    "country": "string or null"
  },
  "vatBreakdown": [
    {
      "rate": number (e.g. 21, 6, 0),
      "base": number,
      "vat": number
    }
  ],
  "lines": [
    {
      "description": "string",
      "quantity": number,
      "unitCode": "string (e.g. stk, m, m2, uur)",
      "unitPrice": number (the GROSS price per unit, BEFORE any line discount),
      "vatRate": number (e.g. 21, 6, 0),
      "lineTotal": number (the line total AFTER discount, excl. VAT),
      "articleCode": "string or null (the supplier's article / product code)",
      "discountPercent": number or null (the line discount in %, e.g. 25 for 25%)
    }
  ]
}
Rules:
- All monetary values are numbers (no currency symbols).
- Dates must be YYYY-MM-DD. Belgian format is DD/MM/YYYY — convert it.
- If a field is truly absent, use null. Never invent data.
- lines[] may be empty [] if no line items are visible.
- vatBreakdown[] may be empty [] if no per-rate breakdown is visible.`;

const TICKET_SYSTEM_PROMPT = `You are an expert extracting structured data from expense receipts and tickets.
Return ONLY a valid JSON object matching this exact schema (no markdown, no explanation):
{
  "merchant": "string or null",
  "date": "YYYY-MM-DD or null",
  "totalAmount": number or null,
  "category": "one of: cat-fuel, cat-restaurant, cat-office, cat-tools, cat-materials, cat-parking, cat-transport, cat-other — or null",
  "vatDeductiblePct": 0
}
Rules:
- All monetary values are numbers (no currency symbols).
- Dates: Belgian format is DD/MM/YYYY — convert to YYYY-MM-DD.
- For category, use context clues (e.g. restaurant name → cat-restaurant, gas station → cat-fuel).
- CRITICAL: 'totalAmount' must be the FINAL total paid (totaal / te betalen / total, incl VAT). If the ticket shows netto + btw + totaal, take the totaal. NEVER take the netto or a subtotal.
- If a field is absent, use null.`;

// ─── PDF Helpers (pdfjs-dist) ─────────────────────────────────────────────────

/**
 * Extract text layer from a PDF buffer using pdfjs-dist.
 * Returns { text, pageCount, isScanned }
 * isScanned = true when the PDF has pages but no extractable text (image-only).
 */
async function extractPdfText(buffer: Buffer): Promise<{ text: string; pageCount: number; isScanned: boolean }> {
    const { extractText } = await import('unpdf');
    try {
        const { text, totalPages } = await extractText(new Uint8Array(buffer));
        const cleanText = (Array.isArray(text) ? text.join('\n\n') : text) || '';
        return { text: cleanText, pageCount: totalPages, isScanned: cleanText.trim().length === 0 };
    } catch (err: any) {
        if (err?.message?.includes('Password') || err?.name === 'PasswordException') {
            throw Object.assign(new Error('PDF is password-protected'), { code: 'PDF_ENCRYPTED' });
        }
        throw Object.assign(new Error('PDF could not be loaded: ' + (err?.message ?? 'unknown')), { code: 'PDF_LOAD_ERROR' });
    }
}

// ─── GPT-4o Extraction ────────────────────────────────────────────────────────

async function extractViaGpt4o(
    openai: OpenAI,
    input: { type: 'image'; buffer: Buffer; mimeType: string } | { type: 'text'; text: string } | { type: 'pdf'; buffer: Buffer; fileName: string },
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
    } else if (input.type === 'pdf') {
        // SCAN-2: a scanned PDF goes to the reader as a PDF
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            max_tokens: 2000,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: systemPrompt },
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: 'Extract all structured data from this document.' },
                        { type: 'file', file: { filename: input.fileName, file_data: `data:application/pdf;base64,${input.buffer.toString('base64')}` } },
                    ]
                }
            ]
        });
        return response.choices[0].message.content ?? '{}';
    } else {
        // SCAN-2: the mime is the DETECTED one (lib/records/readable-document) — never a guess; JSON mode, like text
        const base64 = input.buffer.toString('base64');
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            max_tokens: 2000,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: systemPrompt },
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: 'Extract all structured data from this document image.' },
                        { type: 'image_url', image_url: { url: `data:${input.mimeType};base64,${base64}`, detail: 'high' } }
                    ]
                }
            ]
        });
        return response.choices[0].message.content ?? '{}';
    }
}

// ─── Engine Stubs (future providers) ─────────────────────────────────────────

async function extractViaMindee(buffer: Buffer, isInvoice: boolean, apiKey?: string): Promise<string> {
    const key = apiKey || process.env.MINDEE_API_KEY;
    if (!key) {
        throw Object.assign(new Error('Mindee OCR is not configured for this account. Provide an API key in tenant settings.'), { code: 'NOT_CONFIGURED' });
    }

    const endpoint = isInvoice ? 'invoices/v4' : 'expense_receipts/v5';
    const url = `https://api.mindee.net/v1/products/mindee/${endpoint}/predict`;

    const formData = new FormData();
    formData.append('document', new Blob([new Uint8Array(buffer)]));

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Token ${key}` },
        body: formData,
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(`Mindee API Error: ${response.statusText} ${JSON.stringify(err)}`);
    }

    const data = await response.json();
    return JSON.stringify(data.document.inference.prediction);
}

async function extractViaVeryfi(buffer: Buffer, isInvoice: boolean, apiKey?: string): Promise<string> {
    const key = apiKey || process.env.VERYFI_API_KEY;
    const clientId = process.env.VERYFI_CLIENT_ID; // Veryfi often needs Client ID too
    
    if (!key) {
        throw Object.assign(new Error('Veryfi OCR is not configured for this account. Provide an API key in tenant settings.'), { code: 'NOT_CONFIGURED' });
    }

    // Veryfi typically uses a different auth pattern (headers: Client-Id, Authorization:apikey <key>)
    const url = `https://api.veryfi.com/api/v8/partner/documents`;
    
    const formData = new FormData();
    formData.append('file', new Blob([new Uint8Array(buffer)]));
    formData.append('auto_delete', 'true');

    const response = await fetch(url, {
        method: 'POST',
        headers: { 
            'Authorization': `apikey ${key}`,
            ...(clientId ? { 'Client-Id': clientId } : {}),
        },
        body: formData,
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(`Veryfi API Error: ${response.statusText} ${JSON.stringify(err)}`);
    }

    const data = await response.json();
    return JSON.stringify(data);
}

// ─── Quota Helpers ────────────────────────────────────────────────────────────

async function checkAndIncrementQuota(tenantId: string, increment: boolean = true): Promise<{ allowed: boolean; remaining: number }> {
    const tenant = await platformDb().tenant.findUnique({
        where: { id: tenantId },
        select: { scanCount: true, scanQuota: true, scanCountResetAt: true }
    });
    if (!tenant) return { allowed: false, remaining: 0 };

    // Auto-reset if we've rolled into a new calendar month
    const now = new Date();
    const resetAt = new Date(tenant.scanCountResetAt);
    const needsReset = now.getMonth() !== resetAt.getMonth() || now.getFullYear() !== resetAt.getFullYear();

    const currentCount = needsReset ? 0 : tenant.scanCount;
    const quota = tenant.scanQuota;
    const isUnlimited = quota === -1;

    if (!isUnlimited && currentCount >= quota) {
        return { allowed: false, remaining: 0 };
    }

    if (increment) {
        // Increment atomically
        await platformDb().tenant.update({
            where: { id: tenantId },
            data: {
                scanCount: currentCount + 1,
                ...(needsReset ? { scanCountResetAt: now } : {}),
            }
        });
        return { allowed: true, remaining: isUnlimited ? 9999 : quota - currentCount - 1 };
    }

    return { allowed: true, remaining: isUnlimited ? 9999 : quota - currentCount };
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
    const session = await auth();
    const tenantId = session?.user?.tenantId;
    if (!tenantId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const db = await scopeFromSession();

        // ── Load tenant config (engine + quota) ───────────────────────────────
        const tenant = await platformDb().tenant.findUnique({
            where: { id: tenantId },
            select: { planType: true, ocrEngine: true, scanCount: true, scanQuota: true, scanCountResetAt: true, mindeeApiKey: true, veryfiApiKey: true }
        });

        const planType = tenant?.planType ?? 'FREE';
        const isFree = planType === 'FREE';
        const ocrEngine = isFree ? 'TESSERACT' : ((tenant?.ocrEngine ?? 'GPT4O') as OcrEngine);

        // ── Parse form data ───────────────────────────────────────────────────
        const formData = await req.formData();
        const file = formData.get('file') as File;
        let targetDb = formData.get('targetDb') as string || 'db-tickets';
        const existingPageId = formData.get('pageId') as string | null;

        if (!file && !existingPageId) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }
        let role: SystemDatabaseRole | null = targetDb in SYSTEM_DATABASES
            ? (targetDb as SystemDatabaseRole)
            : (targetDb in BASE_TO_KEY ? BASE_TO_KEY[targetDb] : null);

        if (!role) {
            const dbRec = await db.globalDatabase.findFirst({
                where: { id: targetDb },
                select: { logicalKey: true },
            });
            if (dbRec?.logicalKey) {
                role = dbRec.logicalKey as SystemDatabaseRole;
            }
        }

        // A supplier quote (QUOTE-IN-1) is READ like an invoice — supplier, number, date, totals, lines — and mapped to its
        // own fields (lib/records/quote-scan). `isInvoice` here means "read as an invoice".
        const isQuote = role === 'purchase-quotes';
        const isInvoice = role === 'expenses' || isQuote;

        // SCHEMA-1a: Resolve system DB to the tenant's canonical scoped ID
        if (role) {
            const tenantData = await platformDb().tenant.findUnique({
                where: { id: tenantId },
                select: { lockedDbIds: true },
            });
            const lockedDbIds = (tenantData?.lockedDbIds as Record<string, string>) || {};
            targetDb = lockedDbIds[role] || targetDb;
        }

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // SCAN-2: the REAL format, from the first bytes — HEIC / unknown formats are refused with their reason before
        // any reading or quota is spent (they used to reach the reader labelled "image/jpeg" and come back empty)
        const fileBytes = new Uint8Array(await file.arrayBuffer());
        const readable = readableDocument(fileBytes);
        if (!readable.ok) {
            return NextResponse.json({ success: false, code: 'UNREADABLE_FORMAT', reason: readable.reason, error: unreadableMessage(readable.reason) }, { status: 422 });
        }

        const clientExtractedStr = formData.get('clientExtracted') as string | null;

        if (isFree && !clientExtractedStr) {
            return NextResponse.json({ error: 'Free plan requires client-side Tesseract extraction.' }, { status: 400 });
        }

        // ── Quota gate ────────────────────────────────────────────────────────
        let { allowed, remaining } = await checkAndIncrementQuota(tenantId, false);
        if (!allowed) {
            return NextResponse.json({
                error: `You have reached your monthly scan limit (${tenant?.scanQuota} scans). Upgrade your plan for more.`,
                code: 'QUOTA_EXCEEDED',
                quota: tenant?.scanQuota,
                remaining: 0,
            }, { status: 429 });
        }

        // ── Extract structured data ───────────────────────────────────────────
        let extracted: Record<string, any> = {};

        if (isFree && clientExtractedStr) {
            try {
                extracted = JSON.parse(clientExtractedStr);
            } catch {
                return NextResponse.json({ error: 'Invalid client-side OCR payload.' }, { status: 400 });
            }
        } else {
            const buffer = Buffer.from(fileBytes);
            const isPdf = readable.kind === 'pdf';   // SCAN-2: from the bytes, not the name or the label

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
                        rawJson = await extractViaMindee(buffer, isInvoice, tenant?.mindeeApiKey || undefined);
                    } else {
                        rawJson = await extractViaVeryfi(buffer, isInvoice, tenant?.veryfiApiKey || undefined);
                    }
                } else {
                    // Scanned PDF — no text layer. SCAN-2: the reader takes the PDF itself (it used to be rendered to an
                    // image with the `canvas` package, which is not installed — every scanned PDF failed "no text layer").
                    if (ocrEngine === 'GPT4O') {
                        rawJson = await extractViaGpt4o(openai!, { type: 'pdf', buffer, fileName: file.name || 'document.pdf' }, isInvoice);
                    } else if (ocrEngine === 'MINDEE') {
                        rawJson = await extractViaMindee(buffer, isInvoice, tenant?.mindeeApiKey || undefined);
                    } else {
                        rawJson = await extractViaVeryfi(buffer, isInvoice, tenant?.veryfiApiKey || undefined);
                    }
                }
            } else {
                // Image file (JPEG, PNG, WEBP, etc.)
                if (ocrEngine === 'GPT4O') {
                    rawJson = await extractViaGpt4o(openai!, { type: 'image', buffer, mimeType: readable.kind === 'image' ? readable.mime : 'image/jpeg' }, isInvoice);
                } else if (ocrEngine === 'MINDEE') {
                    rawJson = await extractViaMindee(buffer, isInvoice, tenant?.mindeeApiKey || undefined);
                } else {
                    rawJson = await extractViaVeryfi(buffer, isInvoice, tenant?.veryfiApiKey || undefined);
                }
            }

            // ── Parse extraction result ───────────────────────────────────────────
            try {
                // GPT-4o sometimes wraps JSON in ```json ... ``` — strip it
                const clean = rawJson.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
                extracted = JSON.parse(clean);
            } catch {
                // SCAN-2: an unusable answer is a FAILED reading, named as such (it used to continue as an empty one)
                console.warn('[/api/scan] OCR returned non-JSON:', rawJson.slice(0, 200));
                return NextResponse.json({ success: false, code: 'READ_FAILED', error: 'Het lezen gaf geen bruikbaar resultaat — probeer opnieuw of vul het handmatig in.' }, { status: 502 });
            }
        }

        // SCAN-1: nothing read = the reading FAILED — never a record claiming "Expense", €0 and today's date.
        // The caller keeps the record (its file name) for a person; the bulk import marks it "Na te kijken".
        if (isEmptyReading(extracted, isInvoice)) {
            return NextResponse.json({
                success: false,
                code: 'EMPTY_READING',
                error: 'Niets gelezen uit dit document (een foto in HEIC-formaat of een onleesbare scan?) — vul het handmatig in.',
            }, { status: 422 });
        }

        // ── Ensure parent DB exists ───────────────────────────────────────────
        const existingDb = await db.globalDatabase.findFirst({
            where: { id: targetDb },
            select: { id: true, tenantId: true }
        });

        if (!existingDb) {
            await db.globalDatabase.create({
                data: {
                    id: targetDb,
                    tenantId,
                    name: isQuote ? 'Supplier Quotes' : isInvoice ? 'Purchase Invoices' : 'Expense Tickets',
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
        let properties: Record<string, any>;
        
        let reviewStatus = 'Na te kijken';
        let reviewReason = '';
        let ocrConfidence = 1.0; // Todo: map engine confidence

        if (isQuote) {
            properties = quoteScanProperties(extracted, { fileName: file.name, isNew: !existingPageId });
        } else if (isInvoice) {
            const amountsReconcile = 
                extracted.totalExVat != null && 
                extracted.totalVat != null && 
                extracted.totalIncVat != null &&
                Math.abs((extracted.totalExVat + extracted.totalVat) - extracted.totalIncVat) < 0.05;

            const hasRequiredFields = !!(extracted.supplierName && extracted.issueDate && extracted.totalIncVat != null);

            if (amountsReconcile && hasRequiredFields && extracted.supplierVat) {
                reviewStatus = 'Klaar';
            } else {
                if (!amountsReconcile) reviewReason = 'Bedragen komen niet overeen';
                else if (!hasRequiredFields) reviewReason = 'Ontbrekende velden';
            }

            properties = {
                // SCAN-1: no invented title — the invoice number read, else the record keeps its own (file name)
                ...(extracted.invoiceNumber ? { title: extracted.invoiceNumber } : existingPageId ? {} : { title: file.name || 'Aankoopfactuur' }),
                supplierName: extracted.supplierName || '',
                supplierVat: extracted.supplierVat || '',
                source: 'src-scan',
                status: 'opt-draft',
                reviewStatus,
                reviewReason,
                ocrConfidence,
                invoiceDate: extracted.issueDate || '',
                dueDate: extracted.dueDate || '',
                totalExVat: extracted.totalExVat ?? 0,
                totalVat: extracted.totalVat ?? 0,
                totalIncVat: extracted.totalIncVat ?? 0,
                invoiceLines: JSON.stringify(extracted.lines ?? []),
                betreft: extracted.lines?.[0]?.description || '',
                // OGM-1: the structured communication the reading found (it was asked for and never written);
                // the schema's own field id — kernel db-expenses `structuredCommunication`
                ...(extracted.structuredCommunication ? { structuredCommunication: String(extracted.structuredCommunication).trim() } : {}),
                peppolDocId: '',
                supplier: [],
            };
        } else {
            // SCAN-1: only what was read (lib/records/scan-reading); the defaults only on a NEW record — a re-scan
            // never resets what a person set (payment method, notes)
            properties = {
                ...(existingPageId ? {} : {
                    title: file.name || 'Ticket',
                    currency: 'cur-eur',
                    paymentMethod: 'pm-card',
                    notes: '',
                    vatDeductiblePct: 0, // RECEIPTS ARE NOT VAT DEDUCTIBLE
                }),
                source: 'src-scan',
                ...ticketFields(extracted),
            };
        }

        // ── DUP-1 · duplicates: FLAGGED, never refused (Florin 2026-10-08: "duplicate scanning / warning / handling —
        // this one is manual"). The record is saved; a possible duplicate carries `duplicateOf` + the reason and waits
        // in "Te valideren" for a person (keep / delete); approval is refused while the flag stands.
        let dedupResult: { status: 'duplicate' | 'possible' | 'none'; matchedId?: string; matchedFields?: string[] } = { status: 'none' };
        if (role === 'tickets' || role === 'expenses') {
            const matches = await findPurchaseDuplicates(db, targetDb, role, { id: existingPageId || undefined, properties });
            if (matches.length) {
                properties = { ...properties, ...duplicateFlag(matches) };
                dedupResult = { status: matches[0].strength, matchedId: matches[0].id, matchedFields: matches[0].fields };
            }
        }

        // ── Save or Update via saveRecord ─────────────────────────────────────
        let savedPageId = existingPageId;
        let savedProperties: Record<string, unknown>;
        let savedUpdatedAt: string;

        if (existingPageId) {
            // LINES-1: the read lines become ROWS — only when the record has none yet (a re-scan never duplicates or
            // overwrites lines a person corrected)
            const current = await db.globalPage.findFirst({ where: { id: existingPageId }, select: { blocks: true } });
            const currentBlocks = Array.isArray(current?.blocks) ? (current!.blocks as Array<{ type?: string }>) : [];
            const readRows = isInvoice && !currentBlocks.some(b => b?.type === 'financial-row') ? purchaseLineBlocks(extracted.lines, uuidv4) : [];
            const { intent, opts } = buildScanUpdateIntent(existingPageId, properties, null, readRows.length ? [...currentBlocks, ...readRows] : undefined);
            const res = await saveRecord(db, intent, opts);
            if (!res.ok) {
                if (res.refusal.code === 'NOT_FOUND') return NextResponse.json({ error: 'Not found' }, { status: 404 });
                return NextResponse.json({ error: `Record save refused: ${res.refusal.code}` }, { status: 422 });
            }
            savedProperties = res.properties;
            savedUpdatedAt = res.updatedAt;
        } else {
            savedPageId = uuidv4();
            const { intent, opts } = buildScanCreateData(savedPageId, targetDb, properties, 0, isInvoice ? purchaseLineBlocks(extracted.lines, uuidv4) : []);   // LINES-1
            const res = await saveRecord(db, intent, opts);
            if (!res.ok) {
                return NextResponse.json({ error: `Record save refused: ${res.refusal.code}` }, { status: 422 });
            }
            savedProperties = res.properties;
            savedUpdatedAt = res.updatedAt;
        }

        // ── Consume Quota ─────────────────────────────────────────────────────
        const finalQuota = await checkAndIncrementQuota(tenantId, true);
        remaining = finalQuota.remaining;

        return NextResponse.json({
            success: true,
            engine: ocrEngine,
            remaining,
            page: {
                id: savedPageId,
                databaseId: targetDb,
                properties: savedProperties,
                order: 0,
                blocks: [],
                createdAt: savedUpdatedAt,
                updatedAt: savedUpdatedAt,
                createdBy: 'system:scan',
                lastEditedBy: 'system:scan',
            },
            extracted,
            dedupResult,
        });

    } catch (e: any) {
        // Surface structured errors with explicit codes
        if (e.status) {
            return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
        }
        console.error('[/api/scan] Error:', e);
        return NextResponse.json({ error: `Scan failed — ${describeError(e)}` }, { status: 500 });
    }
}
