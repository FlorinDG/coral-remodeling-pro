/**
 * GRID-REPLACE · a date field's value — ONE rule for both grids (moved out of columns/DateColumn.tsx). Pure, tested
 * (tests/date-cell.test.ts). A date field stores a CALENDAR day 'YYYY-MM-DD' (optionally ' 🔔' = a reminder).
 * Older rows hold other shapes; they are read as the day they mean:
 *   - an ISO instant ('2026-02-20T23:00:00.000Z') → its BUSINESS day (Brussels, kernel zonedParts) — it was the
 *     browser's zone, so the same row showed a different day on a machine elsewhere;
 *   - European 'DD/MM/YYYY' / 'DD.MM.YYYY' / 'DD-MM-YYYY'.
 */
import { zonedParts } from '@/lib/kernel/shift-time';

const BELL = ' 🔔';
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Any stored date → 'YYYY-MM-DD' (+ ' 🔔' kept). Unreadable text is returned unchanged. */
export function normaliseDateValue(raw: string): string {
    if (!raw) return '';
    if (/^\d{4}-\d{2}-\d{2}( 🔔)?$/.test(raw)) return raw;
    const bell = raw.includes('🔔') ? BELL : '';
    const clean = raw.replace(BELL, '').replace('🔔', '').trim();
    if (/^\d{4}-\d{2}-\d{2}T/.test(clean)) {
        const t = Date.parse(clean);
        if (Number.isFinite(t)) return zonedParts(new Date(t)).date + bell;
    }
    const eu = clean.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    if (eu) return `${eu[3]}-${eu[2].padStart(2, '0')}-${eu[1].padStart(2, '0')}${bell}`;
    return raw;
}

/** 'YYYY-MM-DD' → '5 Oct 2026' (no Date, no zone); unreadable values are shown as stored. */
export function formatDisplayDate(raw: string): string {
    if (!raw) return '';
    const n = normaliseDateValue(raw);
    const m = n.replace(BELL, '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return raw;
    const out = `${Number(m[3])} ${MONTHS_SHORT[Number(m[2]) - 1]} ${m[1]}`;
    return n.endsWith(BELL) ? out + BELL : out;
}
