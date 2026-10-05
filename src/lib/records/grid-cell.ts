/**
 * GRID-REPLACE · what a grid cell SHOWS and what typing in it WRITES — pure, tested (tests/grid-cell.test.ts).
 * The new grid edits one field at a time: a cell commits { pageId, field, value } (R2-2) — never a row.
 */
import { parseCellInput as parseNumberText, cellValue as numberValue } from '@/components/admin/database/columns/numberCell';
import { formatDisplayDate } from './date-cell';

export interface CellProperty { id: string; type: string; config?: { options?: Array<{ id: string; name: string; color?: string }> } }

/** Types the grid edits as text in phase 1 (GRID-REPLACE-1); the others are shown read-only until ported. */
export const TEXT_EDIT_TYPES: ReadonlySet<string> = new Set(['text', 'number', 'currency', 'percent', 'url', 'email', 'phone']);

/** Types the grid edits with their own control (GRID-REPLACE-2): a pick-list, a tick, a calendar day. */
export const CONTROL_EDIT_TYPES: ReadonlySet<string> = new Set(['select', 'multi_select', 'checkbox', 'date']);

export function isTextEditable(prop: CellProperty): boolean {
    return prop.id === 'title' || TEXT_EDIT_TYPES.has(prop.type);
}

/** Typed text → the value stored. A number accepts "1,5" and "1.5"; an empty number is null; text is kept as typed. */
export function parseCellInput(prop: CellProperty, text: string): { ok: true; value: unknown } | { ok: false; reason: 'not_a_number' } {
    if (prop.type === 'number' || prop.type === 'currency' || prop.type === 'percent') {
        // the one number reading (columns/numberCell.ts); empty → null, letters REFUSE (never a silent empty)
        const n = parseNumberText(text);
        return n === null && text.trim() !== '' ? { ok: false, reason: 'not_a_number' } : { ok: true, value: n };
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
        case 'number': case 'currency': case 'percent': {
            const v = numberValue(value, prop.id);   // also unwraps the legacy { [propertyId]: v } shape
            return v === null || v === undefined || v === '' ? '' : String(v).replace('.', ',');
        }
        case 'date': return typeof value === 'string' ? formatDisplayDate(value) : '';
        default:
            if (typeof value === 'object') return Array.isArray(value) ? value.map(v => String(v)).join(', ') : '';
            return String(value);
    }
}

/** Did typing change the stored value? (No change = no write.) */
export function cellChanged(before: unknown, after: unknown): boolean {
    const norm = (v: unknown) => (v === undefined || v === '' || (Array.isArray(v) && v.length === 0) ? null : v);
    return JSON.stringify(norm(before)) !== JSON.stringify(norm(after));
}

/** A multi-select after toggling one option (order kept, toggled one appended). */
export function toggleOption(current: unknown, optionId: string): string[] {
    const list = Array.isArray(current) ? current.map(String) : (typeof current === 'string' && current ? [current] : []);
    return list.includes(optionId) ? list.filter(x => x !== optionId) : [...list, optionId];
}
