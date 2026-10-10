"use client";
/**
 * EDITOR-1 · the ONE rich-text field (Florin 2026-10-09: TipTap, "will have to comply to the canonical legislation
 * governing our multi tenant erp"). Plan + bindings: .agents/plans/EDITOR-1.md.
 *
 * - E1: what it can make is exactly core's allowlist (lib/records/rich-text): paragraphs, line breaks, bold, italic,
 *   underline, bullet / numbered lists, a text colour (kept from older text). Nothing it emits falls outside it, and
 *   whatever it emits is passed through sanitizeRichText anyway.
 * - E5: it NEVER persists. It hands `onChange(html)` to its caller after a pause (~500 ms) and on blur; the caller
 *   writes the block through the store → sync queue → record door like every edit. While focused it is
 *   uncontrolled: a stale value coming back from a re-render (autosave, sync) never clobbers what is being typed
 *   (VRIJETEKST-EDITOR-RESET's root). A NEW value from outside (a library article picked) is applied.
 * - E4: no cloud, collaboration or AI extension — only the open-source packages.
 * - E6: its toolbar offers only what the PDF prints; labels from i18n.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle, Color } from '@tiptap/extension-text-style';
import { Placeholder } from '@tiptap/extensions';
import { useTranslations } from 'next-intl';
import { Bold, Italic, Underline, List, ListOrdered } from 'lucide-react';
import { sanitizeRichText } from '@/lib/records/rich-text';

const COMMIT_IDLE_MS = 500;

export interface RichTextProps {
    value: string | null | undefined;
    onChange: (html: string) => void;
    /** The plain text on every keystroke (e.g. the library search) — not a save. */
    onTextChange?: (text: string) => void;
    onFocus?: () => void;
    onBlur?: () => void;
    placeholder?: string;
    /** Classes of the editable area. */
    className?: string;
    toolbar?: 'above' | 'below' | 'none';
    readOnly?: boolean;
}

/** The editor's HTML as the field's value: '' when empty, the allowlist otherwise. */
function htmlOf(editor: Editor): string {
    return editor.isEmpty ? '' : sanitizeRichText(editor.getHTML());
}

export default function RichText({ value, onChange, onTextChange, onFocus, onBlur, placeholder, className = '', toolbar = 'below', readOnly }: RichTextProps) {
    const t = useTranslations('Admin');
    const [initial] = useState(() => sanitizeRichText(value ?? ''));
    const lastEmitted = useRef<string>(initial);
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const onChangeRef = useRef(onChange);
    useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

    const flush = (editor: Editor) => {
        if (timer.current) { clearTimeout(timer.current); timer.current = undefined; }
        const html = htmlOf(editor);
        if (html !== lastEmitted.current) { lastEmitted.current = html; onChangeRef.current(html); }
    };

    const editor = useEditor({
        immediatelyRender: false,
        editable: !readOnly,
        extensions: [
            StarterKit.configure({
                heading: false, code: false, codeBlock: false, blockquote: false, horizontalRule: false,
                strike: false, link: false,
            }),
            TextStyle,
            Color,
            Placeholder.configure({ placeholder: placeholder ?? '' }),
        ],
        content: initial,
        editorProps: { attributes: { class: className } },
        onUpdate: ({ editor }) => {
            onTextChange?.(editor.getText());
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => flush(editor), COMMIT_IDLE_MS);
        },
        onFocus: () => onFocus?.(),
        onBlur: ({ editor }) => { flush(editor); onBlur?.(); },
    });

    // A value from OUTSIDE (a library pick, another device's save) replaces the content; the echo of our own last
    // emit — or a stale re-render while typing — does not.
    useEffect(() => {
        if (!editor) return;
        const next = sanitizeRichText(value ?? '');
        if (next === lastEmitted.current) return;
        if (editor.isFocused && timer.current) return;   // the user is mid-edit: their text wins until it is committed
        lastEmitted.current = next;
        editor.commands.setContent(next, { emitUpdate: false });
    }, [value, editor]);

    useEffect(() => { editor?.setEditable(!readOnly); }, [editor, readOnly]);
    useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

    const bar = toolbar !== 'none' && !readOnly && editor ? (
        <div className="flex items-center gap-0.5 px-1 text-neutral-400" role="toolbar" aria-label={t('editor.toolbar')}>
            {([
                ['bold', Bold, () => editor.chain().focus().toggleBold().run(), editor.isActive('bold')],
                ['italic', Italic, () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic')],
                ['underline', Underline, () => editor.chain().focus().toggleUnderline().run(), editor.isActive('underline')],
                ['bulletList', List, () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList')],
                ['orderedList', ListOrdered, () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList')],
            ] as const).map(([key, Icon, run, active]) => (
                <button
                    key={key}
                    type="button"
                    onMouseDown={e => { e.preventDefault(); run(); }}
                    aria-label={t(`editor.${key}`)}
                    title={t(`editor.${key}`)}
                    aria-pressed={active}
                    className={`p-1 rounded transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-black dark:hover:text-white ${active ? 'text-black dark:text-white bg-neutral-200/70 dark:bg-neutral-800' : ''}`}
                >
                    <Icon className="w-3.5 h-3.5" />
                </button>
            ))}
        </div>
    ) : null;

    return (
        <div className="flex flex-col gap-1 w-full [&_.ProseMirror]:outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)] [&_p.is-editor-empty:first-child]:before:text-neutral-400 [&_p.is-editor-empty:first-child]:before:float-left [&_p.is-editor-empty:first-child]:before:h-0 [&_p.is-editor-empty:first-child]:before:pointer-events-none">
            {toolbar === 'above' && bar}
            <EditorContent editor={editor} />
            {toolbar === 'below' && bar}
        </div>
    );
}
