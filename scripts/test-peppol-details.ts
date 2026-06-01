import dotenv from 'dotenv';
dotenv.config();

async function main() {
    const orgKey = process.env.E_INVOICE_ORG_API_KEY;
    const baseUrl = process.env.E_INVOICE_BASE_URL || 'https://api.e-invoice.be';

    console.log('Using Org Key:', orgKey ? 'PRESENT' : 'MISSING');
    console.log('Base URL:', baseUrl);

    // Let's lookup Coral's tenant details
    const tenantId = 'ten-hgwrzj0coqkqytib';
    const res = await fetch(`${baseUrl}/api/admin/tenants/${tenantId}`, {
        headers: {
            'Authorization': `Bearer ${orgKey}`,
            'Content-Type': 'application/json',
        }
    });

    if (res.ok) {
        const data = await res.json();
        console.log('Tenant details:', JSON.stringify(data, null, 2));
    } else {
        console.error('Failed to get tenant details:', res.status, await res.text());
    }

    // Let's lookup Peppol participant
    const peppolId = '0208:1018865828';
    const apiKey = 'api-kpwthzt90fxlnfykyvncgivrb9t09tib';
    const lookupRes = await fetch(`${baseUrl}/api/validate/peppol-id?peppol_id=${encodeURIComponent(peppolId)}`, {
        headers: {
            'Authorization': `Bearer ${apiKey}`,
        }
    });

    if (lookupRes.ok) {
        const data = await lookupRes.json();
        console.log('Participant lookup result:', JSON.stringify(data, null, 2));
    } else {
        console.error('Failed to lookup participant:', lookupRes.status, await lookupRes.text());
    }
}

main().catch(console.error);
