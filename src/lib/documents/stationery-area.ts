/**
 * PDF-FIT-1 · where a document's content may go on a letterhead (Florin 2026-10-06: "whatever can fit in a page should
 * fit in a page. there are still clients who print"). Pure, tested (tests/stationery-area.test.ts).
 *
 * The content is a layer printed OVER the letterhead (an image drawn by the template, or a PDF merged under it). The
 * template used to reserve a fixed 180pt top / 150pt bottom for every letterhead — on Coral's, ~130pt of a page
 * stayed empty and the totals block went alone to page 2. Now the letterhead is MEASURED: the longest band of blank
 * rows between its header and its footer is the writing area, with a safety gap. A letterhead that is not mostly
 * blank in the middle (a full-page design) keeps the fixed margins.
 */
export const A4_HEIGHT_PT = 842;
export const DEFAULT_AREA = { top: 180, bottom: 150 } as const;
export interface ContentArea { top: number; bottom: number }

const GAP_PT = 14;                // clearance from the letterhead's ink
const MIN_MARGIN_PT = 36;         // never closer to the paper edge than a printer can print
const MIN_BLANK_SHARE = 0.4;      // the blank band must be at least 40% of the page, or it is not a letterhead layout

/**
 * `rowInk[i]` = the share of non-blank pixels in row i of the letterhead, rows spread over the page height.
 * Returns the content area in points, or the defaults.
 */
export function contentAreaFromRows(rowInk: ArrayLike<number>, inkThreshold = 0.002): ContentArea {
    const n = rowInk.length;
    if (n < 10) return { ...DEFAULT_AREA };
    let bestStart = -1, bestLen = 0, runStart = -1;
    for (let i = 0; i <= n; i++) {
        const blank = i < n && rowInk[i] <= inkThreshold;
        if (blank && runStart < 0) runStart = i;
        if (!blank && runStart >= 0) {
            if (i - runStart > bestLen) { bestLen = i - runStart; bestStart = runStart; }
            runStart = -1;
        }
    }
    if (bestLen < n * MIN_BLANK_SHARE) return { ...DEFAULT_AREA };
    const pt = A4_HEIGHT_PT / n;
    // A blank band touching the top / bottom edge = no header / footer there: only the printer margin.
    const top = bestStart === 0 ? MIN_MARGIN_PT : Math.max(MIN_MARGIN_PT, Math.round(bestStart * pt + GAP_PT));
    const end = bestStart + bestLen;
    const bottom = end === n ? MIN_MARGIN_PT : Math.max(MIN_MARGIN_PT, Math.round((n - end) * pt + GAP_PT));
    return { top, bottom };
}
