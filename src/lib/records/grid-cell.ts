/**
 * GRID-REPLACE · what a grid cell SHOWS and what typing in it WRITES — pure, tested (tests/grid-cell.test.ts).
 * The new grid edits one field at a time: a cell commits { pageId, field, value } (R2-2) — never a row.
 */
import { parseCellInput as parseNumberText, cellValue as numberValue } from './number-cell';
import { formatDisplayDate, normaliseDateValue } from './date-cell';
import { formatPhone, isEmailAddress } from './phone';
import { zonedParts } from '@/lib/kernel/shift-time';

export interface CellProperty { id: string; type: string; config?: { options?: Array<{ id: string; name: string; color?: string }> } }

/** Types the grid edits as text in phase 1 (GRID-REPLACE-1); the others are shown read-only until ported. */
export const TEXT_EDIT_TYPES: ReadonlySet<string> = new Set(['text', 'number', 'currency', 'percent', 'url', 'email', 'phone']);

/** Types the grid edits with their own control (GRID-REPLACE-2): a pick-list, a tick, a calendar day. */
export const CONTROL_EDIT_TYPES: ReadonlySet<string> = new Set(['select', 'multi_select', 'checkbox', 'date']);

export function isTextEditable(prop: CellProperty): boolean {
    return prop.id === 'title' || TEXT_EDIT_TYPES.has(prop.type);
}

/**
 * Typed text → the value stored. A number accepts "1,5" and "1.5"; an empty number is null; a phone is written the
 * Belgian way (lib/records/phone); an email must be an address; other text is kept as typed.
 */
export type CellRefusal = 'not_a_number' | 'not_an_email';
export function parseCellInput(prop: CellProperty, text: string): { ok: true; value: unknown } | { ok: false; reason: CellRefusal } {
    if (prop.type === 'number' || prop.type === 'currency' || prop.type === 'percent') {
        // the one number reading (columns/numberCell.ts); empty → null, letters REFUSE (never a silent empty)
        const n = parseNumberText(text);
        return n === null && text.trim() !== '' ? { ok: false, reason: 'not_a_number' } : { ok: true, value: n };
    }
    if (prop.type === 'phone') return { ok: true, value: formatPhone(text) };
    if (prop.type === 'email') return isEmailAddress(text) ? { ok: true, value: text.trim() } : { ok: false, reason: 'not_an_email' };
    return { ok: true, value: text };
}

const AMOUNT = new Intl.NumberFormat('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const DECIMAL = new Intl.NumberFormat('nl-BE', { maximumFractionDigits: 10 });

/** Types shown right-aligned (amounts and numbers line up). */
export const NUMERIC_TYPES: ReadonlySet<string> = new Set(['number', 'currency', 'percent']);

/**
 * What a cell SHOWS when it is not being edited — the Belgian way: "€ 1.234,56", "21 %", "1.250,5", phones grouped,
 * timestamps on the business clock "05/10/2026 18:44". Editing starts from `cellText` (the plain value).
 */
export function cellDisplay(prop: CellProperty, value: unknown, titleOf?: (id: string) => string | null): string {
    if (value === null || value === undefined || value === '') return '';
    switch (prop.type) {
        case 'number': case 'currency': case 'percent': {
            const v = numberValue(value, prop.id);
            const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.'));
            if (v === null || v === undefined || v === '' || !Number.isFinite(n)) return cellText(prop, value, titleOf);
            if (prop.type === 'currency') return `€ ${AMOUNT.format(n)}`;
            if (prop.type === 'percent') return `${DECIMAL.format(n)} %`;
            return DECIMAL.format(n);
        }
        case 'phone': return typeof value === 'string' ? formatPhone(value) : cellText(prop, value, titleOf);
        case 'created_time': case 'last_edited_time': {
            const t = typeof value === 'string' || typeof value === 'number' ? Date.parse(String(value)) : NaN;
            if (!Number.isFinite(t)) return cellText(prop, value, titleOf);
            const p = zonedParts(new Date(t));
            return `${p.date.slice(8, 10)}/${p.date.slice(5, 7)}/${p.date.slice(0, 4)} ${p.time}`;
        }
        default: return cellText(prop, value, titleOf);
    }
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

// ── Copy / paste (GRID-REPLACE-3) ────────────────────────────────────────────────────────────────────────────

/** Clipboard text (Excel / Sheets / the grid: tab-separated, one line per row) → rows of cells. Quotes respected. */
export function parseClipboardGrid(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [], cell = '', quoted = false;
    const t = text.replace(/\r\n/g, '\n').replace(/\n$/, '');
    for (let i = 0; i < t.length; i++) {
        const ch = t[i];
        if (quoted) {
            if (ch === '"' && t[i + 1] === '"') { cell += '"'; i++; }
            else if (ch === '"') quoted = false;
            else cell += ch;
        } else if (ch === '"' && cell === '') quoted = true;
        else if (ch === '\t') { row.push(cell); cell = ''; }
        else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
        else cell += ch;
    }
    row.push(cell); rows.push(row);
    return rows;
}

const TRUE_WORDS = new Set(['true', '1', 'x', '✓', 'ja', 'yes', 'oui', 'da', 'waar']);

/**
 * What a pasted text becomes in a field — or a refusal (never a guessed value): text / numbers as typed
 * (numbers through the one reading); a select by its option NAME; a multi-select by names separated by ","; a
 * checkbox from yes-words; a date in any readable form → the calendar day. Computed fields refuse.
 */
export function pasteValue(prop: CellProperty, text: string): { ok: true; value: unknown } | { ok: false; reason: string } {
    const s = text.trim();
    if (isTextEditable(prop)) {
        const r = parseCellInput(prop, prop.type === 'text' || prop.id === 'title' ? text : s);
        return r.ok ? r : { ok: false, reason: r.reason };
    }
    const byName = (n: string) => prop.config?.options?.find(o => o.name.trim().toLowerCase() === n.trim().toLowerCase())?.id;
    switch (prop.type) {
        case 'select': {
            if (!s) return { ok: true, value: null };
            const id = byName(s);
            return id ? { ok: true, value: id } : { ok: false, reason: 'unknown_option' };
        }
        case 'multi_select': {
            if (!s) return { ok: true, value: [] };
            const ids = s.split(',').map(n => byName(n));
            return ids.every(Boolean) ? { ok: true, value: ids as string[] } : { ok: false, reason: 'unknown_option' };
        }
        case 'checkbox': return { ok: true, value: TRUE_WORDS.has(s.toLowerCase()) };
        case 'date': {
            if (!s) return { ok: true, value: null };
            const d = normaliseDateValue(s);
            return /^\d{4}-\d{2}-\d{2}( 🔔)?$/.test(d) ? { ok: true, value: d } : { ok: false, reason: 'not_a_date' };
        }
        default: return { ok: false, reason: 'not_pastable' };
    }
}
