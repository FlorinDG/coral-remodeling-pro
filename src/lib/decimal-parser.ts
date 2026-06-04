/**
 * Shared utility for parsing and formatting decimals supporting both
 * European (1.234,56) and standard (1234.56) decimal inputs.
 */

export function parseDecimal(raw: string | number | null | undefined): number | undefined {
    if (raw === null || raw === undefined || raw === '') return undefined;
    if (typeof raw === 'number') return raw;
    
    let str = String(raw).trim();
    if (str === '') return undefined;
    
    str = str.replace(/[^0-9.,-]/g, '');
    
    const separatorMatches = [...str.matchAll(/[.,]/g)];
    if (separatorMatches.length > 0) {
        const lastMatch = separatorMatches[separatorMatches.length - 1];
        const lastIndex = lastMatch.index!;
        const before = str.substring(0, lastIndex).replace(/[.,]/g, '');
        const after = str.substring(lastIndex + 1);
        str = before + '.' + after;
    }
    
    const num = parseFloat(str);
    return isNaN(num) ? undefined : num;
}

export function formatDecimal(n: number | undefined | null, decimals = 2): string {
    if (n === undefined || n === null || n === 0) return '';
    return n.toLocaleString('nl-BE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
