import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export const maxDuration = 60; // Allow longer execution for LLM

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        if (!file) {
            return NextResponse.json({ success: false, error: 'No file uploaded' }, { status: 400 });
        }

        // Optional: target database property names for schema-aware extraction
        const schemaHint = formData.get('schemaHint') as string | null;

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

        // Initialize OpenAI
        if (!process.env.OPENAI_API_KEY) {
            return NextResponse.json({ success: false, error: 'OPENAI_API_KEY is not configured.' }, { status: 500 });
        }

        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        // ── Construct the extraction prompt ──────────────────────────────────
        const schemaContext = schemaHint
            ? `\nThe target database has these columns: [${schemaHint}]. Use these EXACT names as JSON keys where they match your extracted data. For any data that doesn't match an existing column, use a descriptive key.`
            : '';

        const prompt = `You are an expert document data extraction engine for Belgian construction and remodeling businesses.

TASK: Extract all structured data from the document text below.

STEP 1 — CLASSIFY the document. Set "documentType" to one of:
  • "CATALOG" — a pricelist or product catalog with many items in columns/rows
  • "QUOTATION" — a quote/offerte from a contractor, with sections and priced line items
  • "INVOICE" — a bill/factuur with line items and totals
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
