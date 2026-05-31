/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { canAccess } from '@/lib/feature-flags';

export const maxDuration = 60; // Allow longer execution for LLM

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

    const currentCount = needsReset ? 0 : tenant.scanCount;
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

export async function POST(req: Request) {
    const session = await auth();
    const tenantId = session?.user?.tenantId;
    if (!tenantId) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Fetch tenant details to verify plan level and quota settings
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { planType: true, scanQuota: true }
        });

        if (!tenant) {
            return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 });
        }

        // PDF Import features are gated behind PRO+ tiers
        if (!canAccess('QUOTATION_PDF_IMPORT_LIBRARY', tenant.planType)) {
            return NextResponse.json({
                success: false,
                error: 'PDF Import is only available on PRO and ENTERPRISE plans.',
                code: 'PLAN_GATED'
            }, { status: 403 });
        }

        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        if (!file) {
            return NextResponse.json({ success: false, error: 'No file uploaded' }, { status: 400 });
        }

        // Optional: target database property names for schema-aware extraction
        const schemaHint = formData.get('schemaHint') as string | null;
        const docType = (formData.get('docType') as string) || 'supplier';

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Dynamically import pdf-parse to bypass Next.js build-time static evaluation
        // which attempts to read './test/data' files and causes ENOENT errors in Vercel.
        const pdfParseModule = await import('pdf-parse/lib/pdf-parse.js');
        const pdf = pdfParseModule.default || pdfParseModule;

        // Parse PDF text
        const pdfData = await pdf(buffer);
        const text = pdfData.text;

        if (!text || text.trim().length === 0) {
            return NextResponse.json({ success: false, error: 'PDF contains no extractable text. It may be a scanned image without OCR.' }, { status: 400 });
        }

        // Quota check and metering
        const { allowed, remaining } = await checkAndIncrementQuota(tenantId);
        if (!allowed) {
            return NextResponse.json({
                success: false,
                error: `You have reached your monthly document scan limit (${tenant.scanQuota} scans). Upgrade your plan for more.`,
                code: 'QUOTA_EXCEEDED',
                quota: tenant.scanQuota,
                remaining: 0,
            }, { status: 429 });
        }

        // Initialize OpenAI
        if (!process.env.OPENAI_API_KEY) {
            return NextResponse.json({ success: false, error: 'OPENAI_API_KEY is not configured.', remaining }, { status: 500 });
        }

        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        // ── Construct the extraction prompt ──────────────────────────────────
        const schemaContext = schemaHint
            ? `\nThe target database has these columns: [${schemaHint}]. Use these EXACT names as JSON keys where they match your extracted data. For any data that doesn't match an existing column, use a descriptive key.`
            : '';

        // ── Meetstaat-specific prompt ─────────────────────────────────────────
        const meetstaatPrompt = `You are an expert Belgian construction document parser, specializing in meetstaten (Bills of Quantities / BoQ).

TASK: Extract all line items from this meetstaat document.

A meetstaat is a structured quantity survey document used in Belgian construction. It lists:
- Post numbers (article/line identifiers like 01.01, 02.03, etc.)
- Work categories/sections (e.g. Grondwerken, Ruwbouw, Dakwerken, Afwerking, Elektriciteit, Sanitair, HVAC, Buitenaanleg)
- Detailed work descriptions
- Measurement units (m², m³, m, lm, stk, kg, l, uur, forfait, PM — pro memorie)
- Quantities (calculated from architectural plans)
- Unit prices (may be blank — to be filled by the contractor)
- Total prices (may be blank)

EXTRACTION RULES:
1. Extract EVERY post/line item. Do NOT skip any.
2. Section headers (Hoofdstuk, Afdeling) are NOT line items — use them as the "Section" field.
3. "PM" (pro memorie) or "VH" (voorbehouden hoeveelheid) means the quantity is provisional — set quantity to 1 and note "PM" in Notes.
4. If unit price is blank (contractor fills it in), set UnitPrice to 0.
5. Merge multi-line descriptions into one Title.
6. European number format: 1.250,00 → convert to 1250.00
7. Common units: m² (vierkante meter), m³ (kubieke meter), lm (lopende meter), stk (stuks), kg, l (liter), uur, forfait, PM

Return a single JSON object:
{
  "documentType": "MEETSTAAT",
  "metadata": {
    "projectName": "...",
    "architect": "...",
    "documentRef": "...",
    "documentDate": "YYYY-MM-DD",
    "norm": "NBN B 06-001 if referenced"
  },
  "articles": [
    {
      "Title": "Work description",
      "Quantity": 1,
      "Unit": "m²",
      "UnitPrice": 0,
      "TotalPrice": 0,
      "Section": "Parent section name",
      "Subsection": "Sub-section if any",
      "PostNumber": "01.01",
      "Notes": "extra specs, dimensions, material"
    }
  ]
}

TEXT TO PARSE:
${text.substring(0, 120000)}`;

        // ── Standard prompt (supplier/other) ─────────────────────────────────
        const standardPrompt = `You are an expert document data extraction engine for Belgian construction and remodeling businesses.

TASK: Extract all structured data from the document text below.

STEP 1 — CLASSIFY the document. Set "documentType" to one of:
  • "CATALOG" — a pricelist or product catalog with many items in columns/rows
  • "QUOTATION" — a quote/offerte from a contractor, with sections and priced line items
  • "INVOICE" — a bill/factuur with line items and totals
  • "MEETSTAAT" — a bill of quantities (meetstaat/bestek) with posts, quantities, and units
  • "INFORMAL" — free-form text (email, letter) with prices or quantities embedded in prose
  • "MIXED" — multiple types or unclear format

STEP 2 — EXTRACT DOCUMENT METADATA into "metadata":
  • vendorName — company that issued the document
  • vendorVat — VAT/BTW/KBO number of vendor (e.g. "BE0XXX.XXX.XXX")
  • vendorAddress — address if available
  • customerName — recipient/client name
  • customerVat — VAT of customer if available
  • documentRef — reference number (invoice #, offerte #, etc.)
  • documentDate — date of the document (ISO format YYYY-MM-DD)
  • grandTotalExcl — total excl. VAT as a number
  • grandTotalIncl — total incl. VAT as a number
  • vatAmount — VAT amount as a number
  • vatRate — VAT percentage (e.g. 21, 6) if uniform
  • currency — currency code (default "EUR")
  Only include fields you can actually find. Omit fields that are absent.

STEP 3 — EXTRACT ALL LINE ITEMS into "articles" array. Each item MUST have:
  • Title — article name, service description, or product name. Be descriptive.
  • Quantity — numeric, default 1 if not stated
  • Unit — measurement unit (m², m, stk, u, kg, l, set, forfait, etc.), default "stk"
  • UnitPrice — unit price EXCLUDING VAT, as a number without currency symbol
  • TotalPrice — line total excl. VAT (Quantity × UnitPrice), as a number

  Also include when available:
  • Section — parent section/category name (e.g. "Ruwbouw", "Elektriciteit", "Afwerking")
  • Subsection — sub-grouping within the section
  • SKU — article reference, product code, or catalog number
  • Brand — manufacturer or brand name
  • VatRate — VAT % for this line if it differs from the document default
  • Notes — extra specs, dimensions, color, material, or conditions
  • Discount — discount percentage or amount if applicable

CRITICAL RULES:
  1. NEVER skip items. Extract every single priced item, even if formatting is messy.
  2. If a section header has no price, DON'T create a line item for it — use it as the "Section" value for its children.
  3. For hierarchical documents (sections → subsections → items), flatten the structure. Every item gets its parent Section and Subsection as fields.
  4. If a line item description spans multiple lines in the PDF, merge them into one Title.
  5. All prices must be plain numbers without currency symbols (5.40 not €5.40).
  6. If the document uses commas as decimal separators (European format: 1.250,00), convert to dot notation (1250.00).
  7. If you see "Korting", "Remise", or "Discount" as a separate line, apply it as a negative-price line item or note it in the Discount field of the relevant items.
  8. Sub-totals and grand-total lines should NOT be extracted as articles.${schemaContext}

Return a single JSON object: { "documentType": "...", "metadata": {...}, "articles": [...] }

TEXT TO PARSE:
${text.substring(0, 120000)}`;

        const prompt = docType === 'meetstaat' ? meetstaatPrompt : standardPrompt;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: 'system', content: prompt }],
            temperature: 0,
            response_format: { type: 'json_object' }
        });

        const resultText = response.choices[0]?.message?.content;
        if (!resultText) {
            throw new Error("Empty response from AI");
        }

        const parsed = JSON.parse(resultText);
        const articles = parsed.articles || [];

        // If no articles found, provide a clear message
        if (articles.length === 0) {
            return NextResponse.json({
                success: true,
                data: [],
                metadata: parsed.metadata || null,
                documentType: parsed.documentType || 'UNKNOWN',
                warning: 'No line items could be extracted from this document. It may contain only text without priced items.'
            });
        }

        return NextResponse.json({
            success: true,
            data: articles,
            metadata: parsed.metadata || null,
            documentType: parsed.documentType || 'UNKNOWN',
        });

    } catch (error: any) {
        console.error('PDF Parsing Error:', error);
        return NextResponse.json({ success: false, error: error.message || 'Failed to parse PDF' }, { status: 500 });
    }
}
