/**
 * The VAT lookup on a contact / supplier record — pure, tested (tests/vat-lookup.test.ts). The FIELDS are the
 * kernel schema's ids (clients and suppliers both carry vat / company / address / postal / city, system-schemas.ts)
 * — the old grid's hook guessed them from field NAMES in five languages, and found the VAT column through the grid
 * library's CSS classes.
 */
export const VAT_LOOKUP_ROLES: ReadonlySet<string> = new Set(['clients', 'suppliers']);
export const VAT_FIELD = 'vat';

/** Typed VAT → the number to look up ('BE0123456789'), or null while it cannot be one. A bare 9/10-digit number is Belgian. */
export function normaliseVat(text: string): string | null {
    const clean = String(text || '').replace(/[\s.\-]/g, '').toUpperCase();
    const v = /^\d{9,10}$/.test(clean) ? 'BE' + (clean.length === 9 ? '0' + clean : clean) : clean;
    return /^[A-Z]{2}\d{8,12}$/.test(v) ? v : null;
}

export interface CompanyFound { name: string | null; street: string | null; postalCode: string | null; city: string | null; peppolActive: boolean }

/** The lookup route's answer (/api/company/lookup) → what was found, or null when the number is not valid. */
export function parseCompanyLookup(data: { isValid?: boolean; name?: string; address?: string; peppolActive?: boolean } | null | undefined): CompanyFound | null {
    if (!data?.isValid) return null;
    const name = data.name && data.name !== '---' ? data.name : null;
    const lines = data.address && data.address !== '---' ? data.address.split('\n') : [];
    const m = (lines[1] || '').match(/^(\d{4,5})\s+(.+)/);
    return { name, street: lines[0] || null, postalCode: m?.[1] || null, city: m?.[2] || null, peppolActive: !!data.peppolActive };
}

/** The fields to fill from a found company — only those with a value, only those the database has. */
export function vatLookupPatch(found: CompanyFound, fieldIds: Iterable<string>): Record<string, unknown> {
    const have = new Set(fieldIds);
    const patch: Record<string, unknown> = {};
    const put = (k: string, v: unknown) => { if (have.has(k) && v !== null && v !== undefined && v !== '') patch[k] = v; };
    put('company', found.name);
    put('address', found.street);
    put('postal', found.postalCode);
    put('city', found.city);
    patch.peppol_active = found.peppolActive;
    return patch;
}
