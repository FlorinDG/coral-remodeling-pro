import React from 'react';
import { Text } from '@react-pdf/renderer';

interface StyleOverride {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    color?: string;
}

interface StackEntry {
    tag: string;
    override: StyleOverride;
}

interface ListState {
    type: 'ul' | 'ol';
    index: number;
}

/**
 * Parses a basic HTML string and converts it to an array of @react-pdf/renderer Text elements.
 * Supports standard contenteditable tags: b, strong, i, em, u, br, p, div, ul, ol, li, and span/font color.
 */
export function renderRichText(html: string | undefined, defaultStyle: Record<string, string | number | undefined> = {}): React.ReactNode[] {
    if (!html) return [];

    // Split HTML into text segments and tags
    const tagRegex = /(<\/?[a-zA-Z0-9]+(?:\s+[^>]*)?>)/g;
    const tokens = html.split(tagRegex);

    const stack: StackEntry[] = [];
    const listStack: ListState[] = [];
    const elements: React.ReactNode[] = [];
    let keyCounter = 0;

    const decodeEntities = (str: string): string => {
        return str
            .replace(/&amp;/g, '&')
            .replace(/&nbsp;/g, ' ')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&ldquo;/g, '“')
            .replace(/&rdquo;/g, '”')
            .replace(/&lsquo;/g, '‘')
            .replace(/&rsquo;/g, '’')
            .replace(/&mdash;/g, '—')
            .replace(/&ndash;/g, '–');
    };

    const getResolvedStyle = () => {
        const style: Record<string, string | number | undefined> = {};
        for (const entry of stack) {
            const override = entry.override;
            if (override.bold !== undefined) style.fontWeight = override.bold ? 'bold' : 'normal';
            if (override.italic !== undefined) style.fontStyle = override.italic ? 'italic' : 'normal';
            if (override.underline !== undefined) style.textDecoration = override.underline ? 'underline' : 'none';
            if (override.color !== undefined) style.color = override.color;
        }
        return style;
    };

    const addNewline = (resolvedStyle?: Record<string, string | number | undefined>) => {
        elements.push("\n");
    };

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (!token) continue;

        if (i % 2 === 1) {
            // HTML Tag
            const tagMatch = token.match(/^<\/?([a-zA-Z0-9]+)/);
            if (!tagMatch) continue;

            const tagName = tagMatch[1].toLowerCase();
            const isClosing = token.startsWith('</');

            if (isClosing) {
                // Remove the tag from stack
                const idx = stack.map(e => e.tag).lastIndexOf(tagName);
                if (idx !== -1) {
                    stack.splice(idx, 1);
                }

                // List end
                if (tagName === 'ul' || tagName === 'ol') {
                    listStack.pop();
                }
            } else {
                // Opening tag
                const override: StyleOverride = {};

                if (tagName === 'b' || tagName === 'strong') {
                    override.bold = true;
                } else if (tagName === 'i' || tagName === 'em') {
                    override.italic = true;
                } else if (tagName === 'u') {
                    override.underline = true;
                } else if (tagName === 'span' || tagName === 'font') {
                    // Try to parse color style or attribute
                    const styleMatch = token.match(/style\s*=\s*["']([^"']+)["']/i);
                    if (styleMatch) {
                        const colorMatch = styleMatch[1].match(/color\s*:\s*([^;'">\s]+)/i);
                        if (colorMatch) {
                            override.color = colorMatch[1].trim();
                        }
                    } else {
                        const colorAttr = token.match(/color\s*=\s*["']([^"']+)["']/i);
                        if (colorAttr) {
                            override.color = colorAttr[1].trim();
                        }
                    }
                } else if (tagName === 'ul') {
                    listStack.push({ type: 'ul', index: 0 });
                } else if (tagName === 'ol') {
                    listStack.push({ type: 'ol', index: 1 });
                } else if (tagName === 'li') {
                    const resolvedStyle = getResolvedStyle();
                    if (elements.length > 0) {
                        addNewline(resolvedStyle);
                    }
                    const activeList = listStack[listStack.length - 1];
                    let prefix = '• ';
                    if (activeList) {
                        if (activeList.type === 'ol') {
                            prefix = `${activeList.index}. `;
                            activeList.index++;
                        } else {
                            prefix = '• ';
                        }
                    }
                    elements.push(
                        <Text key={`li-prefix-${keyCounter++}`} style={{ ...defaultStyle, ...resolvedStyle }}>
                            {prefix}
                        </Text>
                    );
                } else if (tagName === 'br') {
                    addNewline(getResolvedStyle());
                } else if (tagName === 'p' || tagName === 'div') {
                    if (elements.length > 0) {
                        addNewline(getResolvedStyle());
                    }
                }

                stack.push({ tag: tagName, override });
            }
        } else {
            // Text segment
            const decoded = decodeEntities(token);
            if (decoded) {
                const resolvedStyle = getResolvedStyle();
                elements.push(
                    <Text key={`txt-${keyCounter++}`} style={{ ...defaultStyle, ...resolvedStyle }}>
                        {decoded}
                    </Text>
                );
            }
        }
    }

    return elements;
}
