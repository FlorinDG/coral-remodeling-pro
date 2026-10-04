/**
 * WO-4b · from the FROZEN signing evidence to the PDF's content — pure, tested (tests/werkbon-input.test.ts).
 * Times are printed as Brussels wall-clock (kernel zonedParts); minutes are the ones frozen at signing.
 */
import { zonedParts } from '@/lib/kernel/shift-time';

export interface SignEvidenceEntry { shiftId?: string; userId?: string; in: string; out: string | null; minutes?: number }

/** The order giver's language for the document: the client record's `language` (lang-nl/fr/en), else Dutch. */
export function documentLanguage(clientProps: Record<string, unknown> | null | undefined): 'nl' | 'fr' | 'en' {
    const v = String(clientProps?.language ?? '').toLowerCase();
    if (v.endsWith('fr')) return 'fr';
    if (v.endsWith('en')) return 'en';
    return 'nl';
}

/** A one-line address from a record: its address / postal / city fields, or a location field ({ address } or text). */
export function addressLine(props: Record<string, unknown> | null | undefined): string | null {
    if (!props) return null;
    const loc = props.location ?? props['prop-location'];
    const fromLoc = typeof loc === 'string' ? loc : (loc && typeof loc === 'object' ? (loc as { address?: unknown }).address : null);
    const parts = [props.address, [props.postal, props.city].filter(Boolean).join(' ')].map(x => (typeof x === 'string' ? x.trim() : '')).filter(Boolean);
    const line = parts.join(', ');
    return line || (typeof fromLoc === 'string' && fromLoc.trim() ? fromLoc.trim() : null);
}

/** One printed line per signed entry: worker, Brussels HH:mm in/out, the minutes as signed. Open entries are not printed. */
export function linesFromEvidence(entries: SignEvidenceEntry[], workerName: (userId: string | undefined) => string) {
    return entries
        .filter(e => e.out)
        .map(e => ({
            workerName: workerName(e.userId),
            in: zonedParts(e.in).time,
            out: zonedParts(e.out as string).time,
            minutes: typeof e.minutes === 'number' ? e.minutes : 0,
        }));
}
