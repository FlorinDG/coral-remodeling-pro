/**
 * Shared utility for parsing and formatting decimals supporting both
 * European (1.234,56) and standard (1234.56) decimal inputs.
 */

export function parseDecimal(raw: string): number {
    if (!raw || raw.trim() === '') return 0;
    let cleaned = raw.trim();
    if (cleaned.includes(',') && cleaned.includes('.')) {
        // Assume dot is thousands, comma is decimal (e.g. 1.234,56)
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (cleaned.includes(',')) {
        // e.g. 12,34 or 1,5
        cleaned = cleaned.replace(',', '.');
    }
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
}

export function formatDecimal(n: number | undefined | null, decimals = 2): string {
    if (n === undefined || n === null || n === 0) return '';
    return n.toLocaleString('nl-BE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
