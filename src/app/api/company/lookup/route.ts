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

        // Check Peppol Directory
        let peppolActive = false;
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            const peppolRes = await fetch(`https://directory.peppol.eu/search/1.0/json?q=${countryCode}${vatNumber}`, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (peppolRes.ok) {
                const peppolData = await peppolRes.json();
                if (peppolData['total-result-count'] > 0) {
                    peppolActive = true;
                }
            }
        } catch (err) {
            console.log('Peppol check failed (non-blocking)', err);
        }

        // Parse multi-line address into street, postalCode, and city fields for automatic client creation import
        let street = '';
        let postalCode = '';
        let city = '';

        if (data.address) {
            const lines = data.address.split('\n').map((l: string) => l.trim()).filter(Boolean);
            if (lines.length > 0) {
                street = lines[0];
            }
            if (lines.length > 1) {
                const secondLine = lines[1];
                const postalMatch = secondLine.match(/^([A-Za-z0-9-]{3,10})\s+(.+)$/);
                if (postalMatch) {
                    postalCode = postalMatch[1];
                    city = postalMatch[2];
                } else {
                    city = secondLine;
                }
            }
        }

        return NextResponse.json({
            ...data,
            street,
            postalCode,
            city,
            peppolActive
        });
    } catch (e) {
        console.error('VAT lookup error', e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
