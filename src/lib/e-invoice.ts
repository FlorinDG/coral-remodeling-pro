/**
 * e-invoice.be API Client
 * Centralizes all communication with the e-invoice.be Admin API and Tenant API.
 * 
 * Admin API: Uses the organization-level API key (E_INVOICE_ORG_API_KEY)
 *   - Tenant management (create, list, get, delete)
 *   - API key provisioning per tenant
 *   - Peppol registration
 *
 * Tenant API: Uses per-tenant API keys (stored in Prisma Tenant.eInvoiceApiKey)
 *   - Validate invoices
 *   - Create documents
 *   - Send documents via Peppol
 */

const BASE_URL = process.env.E_INVOICE_BASE_URL || 'https://api.e-invoice.be';
const ORG_API_KEY = process.env.E_INVOICE_ORG_API_KEY || '';

// ── Admin API (Organization-level) ──────────────────────────

function adminHeaders() {
    if (!ORG_API_KEY) throw new Error('E_INVOICE_ORG_API_KEY is not configured');
    return {
        'Authorization': `Bearer ${ORG_API_KEY}`,
        'Content-Type': 'application/json',
    };
}

export interface EInvoiceTenant {
    id: string;
    name: string;
    description?: string;
    company_number?: string;
    company_tax_id?: string;
    peppol_ids?: string[];
    created_at: string;
    updated_at: string;
    is_deleted: boolean;
}

export interface EInvoiceApiKey {
    id: string;
    tenant_id: string;
    name: string;
    description?: string;
    key?: string; // Only returned on creation
    created_at: string;
    updated_at: string;
    is_deleted: boolean;
}

export interface PeppolStatus {
    registered: boolean;
    peppol_id?: string;
    status?: string;
    registered_at?: string;
}

// ── Tenant Management ──

export async function listTenants(): Promise<{ tenants: EInvoiceTenant[]; total: number }> {
    const res = await fetch(`${BASE_URL}/api/admin/tenants?skip=0&limit=100`, {
        headers: adminHeaders(),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`List tenants failed: ${JSON.stringify(err)}`);
    }
    return res.json();
}

export async function createTenant(data: {
    name: string;
    description?: string;
    company_number?: string;
    company_tax_id?: string;
    company_name?: string;
    company_email?: string;
    company_address?: string;
    company_zip?: string;
    company_city?: string;
    company_country?: string;
    peppol_ids?: string[];
}): Promise<EInvoiceTenant> {
    const res = await fetch(`${BASE_URL}/api/admin/tenants`, {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        // 409 = tenant already exists
        if (res.status === 409) {
            // Find existing tenant by name
            const list = await listTenants();
            const existing = list.tenants.find(t => t.name === data.name);
            if (existing) return existing;
        }
        throw new Error(`Create tenant failed (${res.status}): ${JSON.stringify(err)}`);
    }
    return res.json();
}

export async function getTenant(tenantId: string): Promise<EInvoiceTenant> {
    const res = await fetch(`${BASE_URL}/api/admin/tenants/${tenantId}`, {
        headers: adminHeaders(),
    });
    if (!res.ok) throw new Error(`Get tenant failed: ${res.status}`);
    return res.json();
}

// ── API Key Management ──

export async function createApiKey(tenantId: string, name: string, description?: string): Promise<EInvoiceApiKey> {
    const res = await fetch(`${BASE_URL}/api/admin/tenants/${tenantId}/api-keys`, {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ name, description }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        // If key name already exists, try with a unique suffix
        if (res.status === 409 || (err.detail && String(err.detail).includes('already exists'))) {
            const uniqueName = `${name}-${Date.now()}`;
            console.log(`[e-invoice.be] API key name conflict, retrying with: ${uniqueName}`);
            const retry = await fetch(`${BASE_URL}/api/admin/tenants/${tenantId}/api-keys`, {
                method: 'POST',
                headers: adminHeaders(),
                body: JSON.stringify({ name: uniqueName, description }),
            });
            if (retry.ok) return retry.json();
            // If still failing, try to get the latest existing key
            const latest = await getLatestApiKey(tenantId);
            if (latest) return latest;
        }
        throw new Error(`Create API key failed: ${JSON.stringify(err)}`);
    }
    return res.json();
}

export async function getLatestApiKey(tenantId: string): Promise<EInvoiceApiKey | null> {
    const res = await fetch(`${BASE_URL}/api/admin/tenants/${tenantId}/api-keys/latest`, {
        headers: adminHeaders(),
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Get latest API key failed: ${res.status}`);
    return res.json();
}

// ── Peppol Registration ──

export async function getPeppolStatus(tenantId: string): Promise<PeppolStatus> {
    try {
        const tenant = await getTenant(tenantId);
        return {
            registered: tenant.smp_registration,
            peppol_id: tenant.peppol_ids?.[0],
            status: tenant.smp_registration ? 'ACTIVE' : 'INACTIVE',
            registered_at: tenant.smp_registration_date || undefined
        };
    } catch (err) {
        return { registered: false };
    }
}

export async function registerPeppol(tenantId: string, peppolId: string, companyName?: string): Promise<any> {
    const body: any = { peppol_id: peppolId };
    if (companyName) body.company_name = companyName;

    const res = await fetch(`${BASE_URL}/api/admin/tenants/${tenantId}/peppol/register`, {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`Peppol registration failed: ${JSON.stringify(err)}`);
    }
    return res.json();
}

// ── Peppol Lookup ──

export async function lookupPeppolParticipant(peppolId: string, tenantApiKey: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/api/validate/peppol-id?peppol_id=${encodeURIComponent(peppolId)}`, {
        headers: {
            'Authorization': `Bearer ${tenantApiKey}`,
        },
    });
    if (!res.ok) return null;
    return res.json();
}

// ── Tenant API (Document Operations) ──

function tenantHeaders(apiKey: string) {
    return {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
    };
}

export async function validateInvoice(apiKey: string, invoiceData: Record<string, any>): Promise<{ is_valid: boolean; issues?: any[]; ubl_document?: string; message?: string }> {
    const res = await fetch(`${BASE_URL}/api/validate/json`, {
        method: 'POST',
        headers: tenantHeaders(apiKey),
        body: JSON.stringify(invoiceData),
    });
    return res.json();
}

export async function createDocument(apiKey: string, invoiceData: Record<string, any>): Promise<{ id: string; state: string; invoice_id: string; invoice_total?: number; total_tax?: number }> {
    const res = await fetch(`${BASE_URL}/api/documents/`, {
        method: 'POST',
        headers: tenantHeaders(apiKey),
        body: JSON.stringify(invoiceData),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`Create document failed: ${JSON.stringify(err)}`);
    }
    return res.json();
}

export async function sendDocument(
    apiKey: string,
    documentId: string,
    senderPeppolScheme?: string,
    senderPeppolId?: string,
    receiverPeppolScheme?: string,
    receiverPeppolId?: string,
): Promise<{ id: string; state: string; message?: string }> {
    let url = `${BASE_URL}/api/documents/${documentId}/send`;
    const params = new URLSearchParams();
    if (senderPeppolScheme) params.set('sender_peppol_scheme', senderPeppolScheme);
    if (senderPeppolId) params.set('sender_peppol_id', senderPeppolId);
    if (receiverPeppolScheme) params.set('receiver_peppol_scheme', receiverPeppolScheme);
    if (receiverPeppolId) params.set('receiver_peppol_id', receiverPeppolId);
    if (params.toString()) url += `?${params.toString()}`;

    const res = await fetch(url, {
        method: 'POST',
        headers: tenantHeaders(apiKey),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`Send document failed: ${JSON.stringify(err)}`);
    }
    return res.json();
}

/**
 * Full onboarding flow: Creates a tenant on e-invoice.be,
 * provisions an API key, and optionally registers on Peppol.
 * 
 * NOTE: The e-invoice.be Admin API currently does not return the `key` value
 * on API key creation (despite documentation stating otherwise). The tenant
 * is still created and registered on Peppol. The API key ID is stored for
 * reference. Once this is resolved by e-invoice.be, the key value will be
 * automatically captured and stored.
 */
export async function onboardTenant(opts: {
    slug: string;
    companyName: string;
    companyNumber?: string;  // CBE/KBO number (e.g., 0123456789)
    vatNumber?: string;      // Full VAT number (e.g., BE0123456789)
    peppolId?: string;       // e.g., 0208:0123456789
    companyEmail?: string;   // Required for test mode (UBL email delivery)
    companyAddress?: string;
    companyZip?: string;
    companyCity?: string;
    companyCountry?: string;
}): Promise<{
    tenantId: string;
    apiKey: string | null;
    apiKeyId: string | null;
    peppolRegistered: boolean;
}> {
    console.log(`[e-invoice.be] Onboarding tenant: ${opts.slug} (${opts.companyName})`);

    // 1. Create the tenant (company_email is required for test mode)
    const tenant = await createTenant({
        name: opts.slug,
        description: `${opts.companyName} - CoralOS Integration`,
        company_number: opts.companyNumber,
        company_tax_id: opts.vatNumber,
        company_name: opts.companyName,
        company_email: opts.companyEmail,
        company_address: opts.companyAddress,
        company_zip: opts.companyZip,
        company_city: opts.companyCity,
        company_country: opts.companyCountry || 'Belgium',
        peppol_ids: opts.peppolId ? [opts.peppolId] : undefined,
    });
    console.log(`[e-invoice.be] ✓ Tenant created: ${tenant.id}`);

    // 2. Create an API key for the tenant
    // IMPORTANT: The e-invoice.be API returns an `id` field (format: api-xxxx...)
    // which IS the bearer token for all Document API calls. The `key` field in the
    // docs is NOT returned. The `id` is both the key identifier AND the auth token.
    let apiKeyValue: string | null = null;
    let apiKeyId: string | null = null;
    try {
        const apiKeyResult = await createApiKey(
            tenant.id,
            `coralos-${Date.now()}`,
            `CoralOS integration key for ${opts.companyName}`,
        );
        apiKeyId = apiKeyResult.id;
        // The id IS the bearer token — use it directly
        apiKeyValue = apiKeyResult.id;
        console.log(`[e-invoice.be] ✓ API key created: ${apiKeyResult.id} → stored as bearer token`);
    } catch (err) {
        console.warn('[e-invoice.be] ⚠ API key creation failed (non-blocking):', err);
    }

    // 3. Register on Peppol if peppolId is provided
    let peppolRegistered = false;
    if (opts.peppolId) {
        try {
            await registerPeppol(tenant.id, opts.peppolId, opts.companyName);
            peppolRegistered = true;
            console.log(`[e-invoice.be] ✓ Peppol registration complete: ${opts.peppolId}`);
        } catch (err) {
            console.warn(`[e-invoice.be] ⚠ Peppol registration failed (non-blocking):`, err);
        }
    }

    return {
        tenantId: tenant.id,
        apiKey: apiKeyValue,
        apiKeyId,
        peppolRegistered,
    };
}
