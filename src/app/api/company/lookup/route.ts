import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const vat = searchParams.get('vat');

    if (!vat) {
        return NextResponse.json({ error: 'VAT number is required' }, { status: 400 });
    }

    try {
        // Strip non-alphanumeric characters like spaces, dots, dashes
        const cleanVat = vat.replace(/[^A-Za-z0-9]/g, '');

        let countryCode = cleanVat.substring(0, 2).toUpperCase();
        let vatNumber = cleanVat.substring(2);

        // Fallback to Belgium if no explicit country code (e.g. they type "0848970428")
        if (!isNaN(Number(countryCode)) || countryCode.startsWith('0')) {
            countryCode = 'BE';
            vatNumber = cleanVat;
        }

        // EU VIES REST API
        const response = await fetch(`https://ec.europa.eu/taxation_customs/vies/rest-api/ms/${countryCode}/vat/${vatNumber}`);

        if (!response.ok) {
            return NextResponse.json({ error: 'Failed to access VIES registry' }, { status: response.status });
        }

        const data = await response.json();

        return NextResponse.json(data);
    } catch (e) {
        console.error('VAT lookup error', e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
