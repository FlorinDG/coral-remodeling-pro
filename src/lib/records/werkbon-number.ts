/**
 * WO-4b · the work order number — `WB-YYYY-NNNN`, per tenant and year (Florin 2026-10-04). Pure, tested
 * (tests/werkbon-number.test.ts). Assigned AT SIGNING inside the serializable signing transaction and frozen
 * in the signing evidence; the year is the Brussels year of the signature.
 */
const PATTERN = /^WB-(\d{4})-(\d{4,})$/;

/** The next number after the ones already issued (any order, any noise); never reuses one, even after gaps. */
export function nextWerkbonNumber(issued: Array<string | null | undefined>, year: string): string {
    let max = 0;
    for (const n of issued) {
        const m = typeof n === 'string' ? PATTERN.exec(n) : null;
        if (m && m[1] === year) max = Math.max(max, Number(m[2]));
    }
    return `WB-${year}-${String(max + 1).padStart(4, '0')}`;
}

/** The PDF's file name: the localised "Werkbon" + number + date (Florin 2026-10-03). */
export function werkbonFileName(number: string, dateYmd: string, language: 'nl' | 'fr' | 'en'): string {
    const word = language === 'fr' ? 'Bon de travail' : language === 'en' ? 'Work order' : 'Werkbon';
    return `${word} ${number} ${dateYmd}.pdf`;
}

/** Is this attachment the signed work order PDF? (Its name as werkbonFileName makes it, in any language.) */
export function isWerkbonFile(name: string | null | undefined): boolean {
    return typeof name === 'string' && /^(Werkbon|Bon de travail|Work order) WB-\d{4}-\d{4,} \d{4}-\d{2}-\d{2}\.pdf$/.test(name);
}
