/**
 * LIB-SUB-1 · what of a library record becomes the SUBCOMPONENTS of a quote/invoice line. Pure.
 *
 * Florin 2026-10-08: "why the line is by default created with a subcomponent". A record's page body is its NOTES —
 * the page editor even wrote an empty paragraph into every record just by opening it — and the article picker copied
 * the whole body into the line as children. An empty paragraph became a "subcomponent", and a line with children takes
 * its price from them: the line went to €0. Only financial blocks (an article, a line, a bestek) are components.
 */
import type { Block, BlockType } from '../../components/admin/database/types';

const COMPONENT_TYPES: ReadonlySet<BlockType> = new Set<BlockType>(['article', 'line', 'bestek']);

/** The library record's financial blocks, cloned with fresh ids (their own components too). Notes never come along. */
export function libraryComponents(blocks: Block[] | null | undefined, newId: () => string): Block[] {
    return (blocks || [])
        .filter((b): b is Block => !!b && COMPONENT_TYPES.has(b.type))
        .map(b => {
            const children = libraryComponents(b.children, newId);
            return { ...b, id: newId(), children: children.length ? children : undefined };
        });
}
