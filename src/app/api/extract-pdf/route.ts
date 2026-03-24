import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import * as pdfParseModule from 'pdf-parse';
const pdfParse = (pdfParseModule as any).default || pdfParseModule;

// Node.js runtime is required for pdf-parse Buffer manipulation
export const runtime = 'nodejs';

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // 1. Process PDF into Raw Text
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Use basic pdf-parse to extract raw unformatted text
        const data = await pdfParse(buffer);
        const rawText = data.text;

        if (!rawText || rawText.trim() === '') {
            return NextResponse.json({ error: 'Could not extract readable text from PDF. It might be an image-only scan.' }, { status: 400 });
        }

        // If the text is massive, we might want to truncate it to the first 100k chars to fit context limits (though gpt-4o-mini handles 128k)
        const safeText = rawText.slice(0, 100000);

        // 2. Query OpenAI for Schema Extraction
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini", // Fast, incredibly cheap, and perfect for structured data extraction
            response_format: { type: "json_object" },
            messages: [
                {
                    role: "system",
                    content: `You are an expert construction estimator. You extract line items (materials, labor, articles) from supplier PDF quotes (like Facq, Desco, or contractor invoices).
Your output MUST be a strict JSON object with a single array key "articles". 
Each object in the "articles" array MUST adhere to this exact schema matching our global database:
{
  "title": "string (the name/description of the product or service)",
  "brutoPrice": "number (the standard unit monetary price without currency symbols. Default to 0 if none)",
  "discountPercent": "number (the discount percentage if visible. Strip the % sign. Default to 0 if none)",
  "quantity": "number (the quantity specified. Default to 1)",
  "unit": "string (the unit of measurement, e.g. 'stk', 'm', 'uur', 'm2', 'L'. Translate abbreviations to short Dutch units if needed, default to 'stk')",
  "calculationType": "string (MUST be one of: 'materieel', 'levering', 'loon', 'indirect'. If it is a physical product from a supplier, use 'materieel')"
}
Ignore boilerplate text, page numbers, addresses, table of contents, and aggregate totals. Only extract the specific distinct line items/products. Double check the prices to ensure accuracy.`
                },
                {
                    role: "user",
                    content: `Extract all line items from the following raw PDF text:\n\n${safeText}`
                }
            ]
        });

        const jsonContent = response.choices[0].message.content;
        if (!jsonContent) throw new Error("OpenAI returned an empty extraction string.");

        const parsed = JSON.parse(jsonContent);

        return NextResponse.json({ articles: parsed.articles || [] });

    } catch (e: any) {
        console.error("PDF Extraction API Error:", e);
        return NextResponse.json({ error: e.message || 'Error processing PDF stream' }, { status: 500 });
    }
}
