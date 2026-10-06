/**
 * The accountant export ("boekhouder export") — which documents go, as what, with which sign. Pure, tested
 * (tests/accountant-export.test.ts). The route (api/financials/export) only reads and writes through the seraph.
 *
 * Florin 2026-10-05: invoices include the credit notes, expenses include the tickets. Found while moving it:
 *   - credit notes were exported as positive amounts with no document type (booked as sales by the accountant);
 *   - proformas went along — a proforma is not a fiscal document;
 *   - a ticket was recognised by parsing its database id (`includes('ticket')`), and tickets were never read.
 */

type Props = Record<string, unknown>;

import { isValidated } from './validation';
export type ExportKind = 'invoice' | 'credit-note' | 'ticket';
export type ExportSource = 'invoices' | 'expenses' | 'tickets';

/** What a document is for the accountant; null = not exported (a proforma). Read from its role and docType. */
export function exportKind(source: ExportSource, props: Props | null | undefined): ExportKind | null {
    if (source === 'tickets') return 'ticket';
    const docType = String(props?.docType ?? '');
    if (docType === 'opt-proforma') return null;
    if (docType === 'opt-credit-note') return 'credit-note';
    return 'invoice';
}

export const KIND_LABEL: Record<ExportKind, string> = { invoice: 'Factuur', 'credit-note': 'Creditnota', ticket: 'Ticket' };

/** A credit note lowers the journal: its amounts are exported NEGATIVE, whatever sign they were stored with. */
export function signed(kind: ExportKind, n: number): number {
    const v = Number.isFinite(n) ? n : 0;
    return kind === 'credit-note' ? -Math.abs(v) : v;
}

/** The document date as YYYY-MM-DD (the stored calendar date — never re-zoned). */
export function docDate(props: Props | null | undefined): string {
    const d = props?.invoiceDate || props?.date;
    return typeof d === 'string' ? d.split('T')[0] : '';
}

export function isDraft(props: Props | null | undefined): boolean {
    const s = String(props?.status ?? '').toLowerCase();
    return s === 'opt-draft' || s === 'draft';
}

export interface ExportDoc { id: string; source: ExportSource; properties: Props }

export interface ExportSelection<T extends ExportDoc> {
    /** VALIDATE-1: a scan nobody validated yet — reported, never exported */
    unvalidated: T[];
    undated: T[];
    drafts: T[];
    alreadyExported: T[];
    /** what goes in the ZIP */
    toExport: Array<T & { kind: ExportKind }>;
}

/**
 * The selection for a period: dated within [start, end], not draft, not a proforma; already-exported documents
 * only when asked. Undated documents are reported, never exported.
 */
export function selectForExport<T extends ExportDoc>(docs: T[], opts: { startDate: string; endDate: string; includeAlreadyExported: boolean }): ExportSelection<T> {
    const out: ExportSelection<T> = { unvalidated: [], undated: [], drafts: [], alreadyExported: [], toExport: [] };
    for (const d of docs) {
        const kind = exportKind(d.source, d.properties);
        if (!kind) continue;
        if (!isValidated(d.properties)) { out.unvalidated.push(d); continue; }   // its date / amount may be unread
        const date = docDate(d.properties);
        if (!date) { out.undated.push(d); continue; }
        if (date < opts.startDate || date > opts.endDate) continue;
        if (isDraft(d.properties)) { out.drafts.push(d); continue; }
        const already = d.properties?.accountantExportedAt === true;
        if (already) out.alreadyExported.push(d);
        if (already && !opts.includeAlreadyExported) continue;
        out.toExport.push({ ...d, kind });
    }
    return out;
}

export interface VatSplit { base21: number; vat21: number; base12: number; vat12: number; base6: number; vat6: number; base0: number; vat0: number }

/** VAT per rate, from the financial rows; else from the totals' ratio. Rounded to cents. (Moved unchanged.) */
export function vatSplit(page: { blocks?: unknown; properties?: Props | null }): VatSplit {
    const split: VatSplit = { base21: 0, vat21: 0, base12: 0, vat12: 0, base6: 0, vat6: 0, base0: 0, vat0: 0 };
    const blocks = Array.isArray(page.blocks) ? page.blocks as Array<{ type?: string; properties?: Props }> : [];
    const lines = blocks.filter(b => b.type === 'financial-row');
    if (lines.length > 0) {
        for (const line of lines) {
            const base = parseFloat(String(line.properties?.lineTotal || 0));
            const rate = parseFloat(String(line.properties?.vatRate || 0));
            const vat = base * (rate / 100);
            if (Math.abs(rate - 21) < 0.5) { split.base21 += base; split.vat21 += vat; }
            else if (Math.abs(rate - 12) < 0.5) { split.base12 += base; split.vat12 += vat; }
            else if (Math.abs(rate - 6) < 0.5) { split.base6 += base; split.vat6 += vat; }
            else if (rate === 0) { split.base0 += base; split.vat0 += vat; }
            else { split.base21 += base; split.vat21 += vat; }
        }
    } else {
        const totalEx = parseFloat(String(page.properties?.totalExVat || 0));
        const totalVat = parseFloat(String(page.properties?.totalVat || 0));
        if (totalEx !== 0) {
            const ratio = totalVat / totalEx;
            if (Math.abs(ratio - 0.21) < 0.05) { split.base21 = totalEx; split.vat21 = totalVat; }
            else if (Math.abs(ratio - 0.12) < 0.05) { split.base12 = totalEx; split.vat12 = totalVat; }
            else if (Math.abs(ratio - 0.06) < 0.05) { split.base6 = totalEx; split.vat6 = totalVat; }
            else if (totalVat === 0) { split.base0 = totalEx; split.vat0 = 0; }
            else { split.base21 = totalEx; split.vat21 = totalVat; }
        }
    }
    for (const k of Object.keys(split) as Array<keyof VatSplit>) split[k] = Math.round(split[k] * 100) / 100;
    return split;
}

/** The split with the document's sign applied (a credit note's split is negative too). */
export function signedSplit(kind: ExportKind, s: VatSplit): VatSplit {
    const out = { ...s };
    for (const k of Object.keys(out) as Array<keyof VatSplit>) out[k] = signed(kind, out[k]);
    return out;
}

export type PeriodPreset = 'last-month' | 'last-trimester' | 'last-semester' | 'this-year' | 'last-year' | 'last-calendar-year';

const pad = (n: number) => String(n).padStart(2, '0');
/** Last day of a month (1-12), pure calendar arithmetic. */
function lastDay(y: number, m: number): number {
    return [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}

/**
 * The period of a preset, from today's BUSINESS date (YYYY-MM-DD, Brussels — kernel zonedParts). Calendar strings
 * only: the old dialog built local midnights and printed them with toISOString(), which in Brussels shifted every
 * boundary one day back (a document dated the 30th of the month fell out; the previous month's last day came in).
 */
export function exportPeriod(preset: PeriodPreset, todayYmd: string): { from: string; to: string } {
    const [y, m] = todayYmd.split('-').map(Number);
    switch (preset) {
        case 'last-month': {
            const py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1;
            return { from: `${py}-${pad(pm)}-01`, to: `${py}-${pad(pm)}-${pad(lastDay(py, pm))}` };
        }
        case 'last-trimester': {
            const q = Math.floor((m - 1) / 3);              // 0..3, the current quarter
            const qy = q === 0 ? y - 1 : y, qs = q === 0 ? 10 : (q - 1) * 3 + 1;
            return { from: `${qy}-${pad(qs)}-01`, to: `${qy}-${pad(qs + 2)}-${pad(lastDay(qy, qs + 2))}` };
        }
        case 'last-semester':
            return m <= 6 ? { from: `${y - 1}-07-01`, to: `${y - 1}-12-31` } : { from: `${y}-01-01`, to: `${y}-06-30` };
        case 'this-year':
            return { from: `${y}-01-01`, to: todayYmd };
        case 'last-year':
        case 'last-calendar-year':
            return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
    }
}
