/**
 * EDITOR-1 · E1 — what rich text may be, the ONE rule (Florin 2026-10-09: TipTap "will have to comply to the canonical
 * legislation governing our multi tenant erp"). Pure, no DOM: it runs in the record door (server), the portal viewers
 * and the tests alike.
 *
 * The allowlist is what a document can print (lib … pdfRichText): paragraphs, line breaks, bold, italic, underline,
 * lists, and a text colour. Everything else is stripped — tags, attributes, event handlers, javascript:/data: URLs —
 * keeping the text. A block's text is shown to the tenant's CUSTOMERS on the portal (/quote, /invoice); whatever wrote
 * it (an editor, the phone, a PDF import, a scan, the API), only this set is stored and only this set is rendered.
 */

/** Tags kept as they are. `div` (legacy contentEditable) prints as a paragraph. */
export const RICH_TEXT_TAGS = ['p', 'div', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'span'] as const;
const KEEP = new Set<string>(RICH_TEXT_TAGS);
const VOID = new Set(['br']);
/** Containers dropped WITH their content (their text is code, not prose). */
const DROP_WITH_CONTENT = ['script', 'style', 'template', 'noscript', 'iframe', 'object', 'embed', 'svg', 'math', 'title', 'textarea', 'select'];

/** A colour value safe in a style attribute: #hex, rgb()/rgba(), or a plain colour name. */
const SAFE_COLOR = /^(#[0-9a-f]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\)|[a-z]{3,20})$/i;

function colorOf(attrs: string): string | null {
    const style = attrs.match(/style\s*=\s*(["'])(.*?)\1/i)?.[2] ?? '';
    const fromStyle = style.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i)?.[1]?.trim();
    const fromAttr = attrs.match(/\bcolor\s*=\s*(["'])(.*?)\1/i)?.[2]?.trim();
    const c = fromStyle || fromAttr;
    return c && SAFE_COLOR.test(c) ? c : null;
}

const escapeText = (t: string) => t.replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Rich text reduced to the allowlist. Plain text passes unchanged (except stray < and >, escaped). */
export function sanitizeRichText(html: unknown): string {
    if (typeof html !== 'string' || !html) return typeof html === 'string' ? html : '';
    let s = html.replace(/<!--[\s\S]*?(-->|$)/g, '');
    for (const tag of DROP_WITH_CONTENT) {
        s = s.replace(new RegExp(`<${tag}\\b[\\s\\S]*?(<\\/${tag}\\s*>|$)`, 'gi'), '');
    }
    const out: string[] = [];
    const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g;
    let last = 0;
    for (let m = TAG.exec(s); m; m = TAG.exec(s)) {
        out.push(escapeText(s.slice(last, m.index)));
        last = TAG.lastIndex;
        const closing = m[1] === '/';
        let name = m[2].toLowerCase();
        const attrs = m[3] || '';
        if (name === 'font') name = 'span';   // legacy <font color> → <span style="color">
        if (!KEEP.has(name)) continue;        // a foreign tag: dropped, its text stays
        if (closing) { if (!VOID.has(name)) out.push(`</${name}>`); continue; }
        if (name === 'span') {
            const c = colorOf(attrs);
            out.push(c ? `<span style="color: ${c}">` : '<span>');
        } else {
            out.push(`<${name}>`);
        }
    }
    out.push(escapeText(s.slice(last)));
    return out.join('');
}

/** A block tree with every block's `content` reduced to the allowlist (children too). Other fields untouched. */
export function sanitizeBlocks<T>(blocks: T): T {
    if (!Array.isArray(blocks)) return blocks;
    return blocks.map(b => {
        if (!b || typeof b !== 'object') return b;
        const block = b as Record<string, unknown>;
        const next: Record<string, unknown> = { ...block };
        if (typeof block.content === 'string' && !isMediaBlock(block)) next.content = sanitizeRichText(block.content);
        if (Array.isArray(block.children)) next.children = sanitizeBlocks(block.children);
        return next;
    }) as T;
}

/** An image / file / video block holds a URL in `content`, not text — the media door validates it, not this rule. */
function isMediaBlock(b: Record<string, unknown>): boolean {
    return b.type === 'image' || b.type === 'video' || b.type === 'file';
}

/** A styled piece of text, or a line break — what a renderer (the PDF) draws. */
export type RichRun = { text: string; bold?: boolean; italic?: boolean; underline?: boolean; color?: string } | { newline: true };

const ENTITIES: Array<[RegExp, string]> = [
    [/&nbsp;/g, ' '], [/&lt;/g, '<'], [/&gt;/g, '>'], [/&quot;/g, '"'], [/&#39;/g, "'"],
    [/&ldquo;/g, '“'], [/&rdquo;/g, '”'], [/&lsquo;/g, '‘'], [/&rsquo;/g, '’'], [/&mdash;/g, '—'], [/&ndash;/g, '–'],
    [/&amp;/g, '&'],
];
const decode = (t: string) => ENTITIES.reduce((s, [re, ch]) => s.replace(re, ch), t);

/**
 * Rich text read into runs — the ONE reader (the PDF renders these; it no longer parses HTML itself). The text is
 * reduced to the allowlist first, so a legacy row written before the door sanitized prints only what it may.
 * Paragraphs and line breaks become newlines; a list item starts on a new line with "• " or "n. ", and TipTap's
 * <li><p>…</p></li> keeps its text on the bullet's line.
 */
export function richTextRuns(html: string | null | undefined): RichRun[] {
    const clean = sanitizeRichText(html ?? '');
    if (!clean) return [];
    const runs: RichRun[] = [];
    const stack: Array<{ tag: string; bold?: boolean; italic?: boolean; underline?: boolean; color?: string }> = [];
    const lists: Array<{ type: 'ul' | 'ol'; index: number }> = [];
    let afterBullet = false;
    const style = () => stack.reduce<Omit<Extract<RichRun, { text: string }>, 'text'>>((s, e) => ({
        ...s,
        ...(e.bold ? { bold: true } : {}), ...(e.italic ? { italic: true } : {}),
        ...(e.underline ? { underline: true } : {}), ...(e.color ? { color: e.color } : {}),
    }), {});
    const newline = () => { if (runs.length) runs.push({ newline: true }); };
    const TAG = /<(\/?)([a-z]+)([^>]*)>/g;
    let last = 0;
    const text = (t: string) => { const d = decode(t); if (d) { runs.push({ text: d, ...style() }); afterBullet = false; } };
    for (let m = TAG.exec(clean); m; m = TAG.exec(clean)) {
        text(clean.slice(last, m.index));
        last = TAG.lastIndex;
        const [, slash, tag, attrs] = m;
        if (slash) {
            const i = stack.map(e => e.tag).lastIndexOf(tag);
            if (i !== -1) stack.splice(i, 1);
            if (tag === 'ul' || tag === 'ol') lists.pop();
            continue;
        }
        if (tag === 'br') { runs.push({ newline: true }); continue; }
        const entry: (typeof stack)[number] = { tag };
        if (tag === 'strong' || tag === 'b') entry.bold = true;
        else if (tag === 'em' || tag === 'i') entry.italic = true;
        else if (tag === 'u') entry.underline = true;
        else if (tag === 'span') { const c = attrs.match(/color:\s*([^"]+)/)?.[1]; if (c) entry.color = c.trim(); }
        else if (tag === 'ul' || tag === 'ol') lists.push({ type: tag, index: 1 });
        else if (tag === 'li') {
            newline();
            const list = lists[lists.length - 1];
            runs.push({ text: list?.type === 'ol' ? `${list.index++}. ` : '• ', ...style() });
            afterBullet = true;
        } else if ((tag === 'p' || tag === 'div') && !afterBullet) newline();
        stack.push(entry);
    }
    text(clean.slice(last));
    return runs;
}
