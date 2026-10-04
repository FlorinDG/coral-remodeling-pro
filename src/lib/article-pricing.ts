/**
 * Which property of a library record (article, bestek, …) holds the gross cost, discount, margin, unit —
 * ONE answer for the quote and the invoice line editors (they each had a copy of a name guess).
 *
 * Found 2026-10-02 (Florin): the guess took the FIRST property whose name contained any keyword, and
 * the discount keywords include "lever" (for "Lever.%") — so the articles' LEVERANCIER relation was read
 * as the discount, never a number, and the article's discount never reached the line.
 *
 * Rules: the system articles database is read by its fixed property ids; any other database by name,
 * keywords in priority order, and only properties whose TYPE can hold the value (a relation is never a
 * price).
 */
export interface PropDef { id: string; name?: string; type?: string }

export type PricingRole = 'bruto' | 'verkoop' | 'marge' | 'discount' | 'unit' | 'type';

/** The articles database's fixed ids (DatabaseClone canonical schema). */
const ARTICLE_IDS: Record<PricingRole, string> = {
    bruto: 'prop-art-bruto',
    verkoop: 'prop-art-verkoop',
    marge: 'prop-art-margin',
    discount: 'prop-art-remise',
    unit: 'prop-art-unit',
    type: 'prop-art-type',
};

const KEYWORDS: Record<PricingRole, string[]> = {
    bruto: ['bruto', 'brutto', 'brutoprijs', 'inkoop', 'kost', 'prijs', 'price'],
    verkoop: ['verkoop', 'selling'],
    marge: ['marge standard', 'marge stanndard', 'marge', 'margin'],
    discount: ['korting', 'discount', 'remise', 'disc', 'lever.%', 'lever %'],
    unit: ['eenheid', 'unit', 'eeh', 'maat'],
    type: ['calculatietype', 'calculationtype', 'type'],
};

const NUMERIC = new Set(['number', 'currency', 'percent', 'formula']);
const TEXTUAL = new Set(['select', 'text', 'status', 'multi_select']);

/** The property id that plays `role` in this schema, or null. */
export function pricingPropId(schema: PropDef[], role: PricingRole): string | null {
    const fixed = ARTICLE_IDS[role];
    if (schema.some(p => p.id === fixed)) return fixed;
    const allowed = role === 'unit' || role === 'type' ? TEXTUAL : NUMERIC;
    for (const k of KEYWORDS[role]) {                       // priority: the first KEYWORD that matches wins
        const hit = schema.find(p => p.name && (!p.type || allowed.has(p.type)) && p.name.toLowerCase().includes(k));
        if (hit) return hit.id;
    }
    return null;
}

/** Read the record's value for a role (undefined when the schema has no such property). */
export function pricingValue(schema: PropDef[], properties: Record<string, unknown>, role: PricingRole): unknown {
    const id = pricingPropId(schema, role);
    return id ? properties[id] : undefined;
}
