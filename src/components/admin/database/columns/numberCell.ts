/**
 * Number / currency / percent grid cells — what the cell READS and WRITES. Pure, tested
 * (tests/number-cell.test.ts).
 *
 * The cell lives inside `keyColumn(propertyId, …)`: the grid hands it the FIELD's value and stores what
 * it writes as the field's value. It used to write `{ ...rowData, [propertyId]: value }` — spreading a
 * number gives `{}` — so the field was stored as `{ "prop-art-remise": 20 }`: "[object Object]" in the
 * detail pane and a formula that could not compute (Florin 2026-10-02). It now writes the number.
 */

/** The number a stored value stands for. Also unwraps the legacy `{ [propertyId]: v }` the old cell stored. */
export function cellValue(raw: unknown, propertyId: string): unknown {
    if (raw !== null && typeof raw === 'object' && !Array.isArray(raw) && propertyId in (raw as Record<string, unknown>)) {
        return (raw as Record<string, unknown>)[propertyId];
    }
    return raw;
}

/** What typed or pasted text is stored as: a number, or null for empty / not a number. "12,5" → 12.5. */
export function parseCellInput(text: unknown): number | null {
    const str = String(text ?? '').trim().replace(/\s/g, '').replace(/,/g, '.');
    if (str === '') return null;
    const n = Number(str);
    return Number.isFinite(n) ? n : null;
}
