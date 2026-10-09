import React from 'react';
import { Text, type Styles } from '@react-pdf/renderer';
import { richTextRuns } from '@/lib/records/rich-text';

/** One @react-pdf style object, as the renderer types it. */
type Style = Styles[string];

/**
 * Rich text on a PDF — a RENDERER only. What the text may be and how it reads is core's rule
 * (lib/records/rich-text: the allowlist + richTextRuns); this draws the runs as @react-pdf Text.
 */
export function renderRichText(html: string | undefined, defaultStyle: Style = {}): React.ReactNode[] {
    return richTextRuns(html).map((r, i) => {
        if ('newline' in r) return '\n';
        const style: Style = { ...defaultStyle };
        if (r.bold) style.fontWeight = 'bold';
        if (r.italic) style.fontStyle = 'italic';
        if (r.underline) style.textDecoration = 'underline';
        if (r.color) style.color = r.color;
        return <Text key={`rt-${i}`} style={style as any}>{r.text}</Text>;
    });
}
