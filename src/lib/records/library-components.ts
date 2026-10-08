/**
 * LIB-SUB-1 · what of a library record becomes the SUBCOMPONENTS of a quote/invoice line. Pure.
 *
 * Florin 2026-10-08: "why the line is by default created with a subcomponent". A record's page body is its NOTES —
 * the page editor even wrote an empty paragraph into every record just by opening it — and the article picker copied
 * the whole body into the line as children. An empty paragraph became a "subcomponent", and a line with children takes
 * its price from them: the line went to €0. Only financial blocks (an article, a line, a bestek) are components.
 */
/** The shape this rule reads — structural, so core never imports the UI layer's Block type. */
export interface LibraryBlock { id: string; type: string; children?: LibraryBlock[] }

const COMPONENT_TYPES: ReadonlySet<string> = new Set(['article', 'line', 'bestek']);

/** The library record's financial blocks, cloned with fresh ids (their own components too). Notes never come along. */
export function libraryComponents<B extends LibraryBlock>(blocks: B[] | null | undefined, newId: () => string): B[] {
    return (blocks || [])
        .filter((b): b is B => !!b && COMPONENT_TYPES.has(b.type))
        .map(b => {
            const children = libraryComponents(b.children as B[] | undefined, newId);
            return { ...b, id: newId(), children: children.length ? children : undefined };
        });
}
