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

        const prompt = `
You are an expert data extraction engine parsing a PDF catalog, invoice, or quote.
Extract all article, product, service, or line-item data from the text below.
Return a JSON object with a single key "articles" containing an array of objects.
Flatten the structure so each object represents one row/item.
Infer logical column headers based on the content (e.g. "Title", "SKU", "Price", "Unit", "Brand", "Category", "VatRate").
Ensure all prices are returned as strings or numbers without currency symbols (e.g. 5.40 instead of €5.40).

Text to parse:
${text.substring(0, 120000)}
`;

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
        
        return NextResponse.json({
            success: true,
            data: parsed.articles || []
        });

    } catch (error: any) {
        console.error('PDF Parsing Error:', error);
        return NextResponse.json({ success: false, error: error.message || 'Failed to parse PDF' }, { status: 500 });
    }
}
