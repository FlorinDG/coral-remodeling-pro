/**
 * GRID-REPLACE · what a grid cell SHOWS and what typing in it WRITES — pure, tested (tests/grid-cell.test.ts).
 * The new grid edits one field at a time: a cell commits { pageId, field, value } (R2-2) — never a row.
 */
export interface CellProperty { id: string; type: string; config?: { options?: Array<{ id: string; name: string; color?: string }> } }

/** Types the grid edits as text in phase 1 (GRID-REPLACE-1); the others are shown read-only until ported. */
export const TEXT_EDIT_TYPES: ReadonlySet<string> = new Set(['text', 'number', 'url', 'email', 'phone']);

export function isTextEditable(prop: CellProperty): boolean {
    return prop.id === 'title' || TEXT_EDIT_TYPES.has(prop.type);
}

/** Typed text → the value stored. A number accepts "1,5" and "1.5"; an empty number is null; text is kept as typed. */
export function parseCellInput(prop: CellProperty, text: string): { ok: true; value: unknown } | { ok: false; reason: 'not_a_number' } {
    if (prop.type === 'number') {
        const s = text.trim();
        if (!s) return { ok: true, value: null };
        const n = Number(s.replace(/\s/g, '').replace(',', '.'));
        return Number.isFinite(n) ? { ok: true, value: n } : { ok: false, reason: 'not_a_number' };
    }
    return { ok: true, value: text };
}

/** The stored value → the text a cell shows (and starts editing from). */
export function cellText(prop: CellProperty, value: unknown, titleOf?: (id: string) => string | null): string {
    if (value === null || value === undefined) return '';
    switch (prop.type) {
        case 'select': return prop.config?.options?.find(o => o.id === value)?.name ?? String(value);
        case 'multi_select': return (Array.isArray(value) ? value : [value]).map(v => prop.config?.options?.find(o => o.id === v)?.name ?? String(v)).join(', ');
        case 'checkbox': return value === true ? '✓' : '';
        case 'relation': return (Array.isArray(value) ? value : [value]).map(v => (titleOf?.(String(v)) ?? '…')).join(', ');
        case 'number': return typeof value === 'number' ? String(value).replace('.', ',') : String(value);
        default:
            if (typeof value === 'object') return Array.isArray(value) ? value.map(v => String(v)).join(', ') : '';
            return String(value);
    }
}

/** Did typing change the stored value? (No change = no write.) */
export function cellChanged(before: unknown, after: unknown): boolean {
    const norm = (v: unknown) => (v === undefined || v === '' ? null : v);
    return norm(before) !== norm(after);
}
