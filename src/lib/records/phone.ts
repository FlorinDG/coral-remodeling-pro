/**
 * A phone number written the Belgian way (Florin 2026-10-05: "phone field needs uniform formatting — respect belgian
 * style"). Pure, tested (tests/phone.test.ts). ONE rule for what a phone cell stores and shows.
 *   mobile    0470 12 34 56      +32 470 12 34 56
 *   02/03/04/09 (one-digit zones)  02 123 45 67   +32 2 123 45 67
 *   other zones                    050 12 34 56   +32 50 12 34 56
 * The form typed is kept (national stays national, +32 / 0032 stays international). A number that is not Belgian
 * (another +country) is kept as typed, only trimmed; text that is no number at all is returned unchanged.
 */
const ONE_DIGIT_ZONES = new Set(['2', '3', '4', '9']);

/** The Belgian subscriber digits after the leading 0 / +32, grouped; null when not a Belgian number. */
function groupBelgian(n: string): string | null {
    if (/^4\d{8}$/.test(n)) return `${n.slice(0, 3)} ${n.slice(3, 5)} ${n.slice(5, 7)} ${n.slice(7)}`;            // mobile
    if (/^\d{8}$/.test(n)) {
        return ONE_DIGIT_ZONES.has(n[0])
            ? `${n[0]} ${n.slice(1, 4)} ${n.slice(4, 6)} ${n.slice(6)}`
            : `${n.slice(0, 2)} ${n.slice(2, 4)} ${n.slice(4, 6)} ${n.slice(6)}`;
    }
    return null;
}

export function formatPhone(raw: string): string {
    const typed = (raw ?? '').trim();
    if (!typed) return '';
    const compact = typed.replace(/[\s./()-]/g, '');
    if (!/^(\+|00)?\d+$/.test(compact)) return typed;
    const intl = compact.startsWith('+') ? compact.slice(1) : compact.startsWith('00') ? compact.slice(2) : null;
    if (intl !== null) {
        if (!intl.startsWith('32')) return typed;                          // another country — as typed
        const g = groupBelgian(intl.slice(2).replace(/^0/, ''));
        return g ? `+32 ${g}` : typed;
    }
    if (!compact.startsWith('0')) return typed;
    const g = groupBelgian(compact.slice(1));
    return g ? `0${g}` : typed;
}

/** An email address that can be written to (empty is allowed — the field is cleared). */
export function isEmailAddress(raw: string): boolean {
    const t = (raw ?? '').trim();
    return t === '' || /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[A-Za-z]{2,}$/.test(t);
}
