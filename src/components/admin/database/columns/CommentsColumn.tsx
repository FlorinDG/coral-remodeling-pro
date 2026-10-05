import React, { useEffect, useRef, useState } from 'react';
import { CellProps, Column } from 'react-datasheet-grid';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useLatestComments } from '@/components/admin/comments/latest-comments-store';
import { postComment, editComment } from '@/app/actions/comments';
import { inPlaceEdit, type InPlaceEdit } from '@/lib/records/comments';
import { zonedParts } from '@/lib/kernel/shift-time';

/**
 * COMMENTS-1 · the "Opmerkingen" cell: the record's latest comment, TEXT ONLY (Florin 2026-10-05: "keep the column
 * clean") — who, when and how many are in the tooltip. `editable` (the new grid): a click edits in place by the ONE
 * rule (lib/records/comments inPlaceEdit) — your own latest comment is edited, anything else becomes a new comment.
 * The old grid (frozen, R3-C) keeps click-to-open.
 */
function when(iso: string): string {
    const p = zonedParts(iso);
    return `${p.date.slice(8, 10)}/${p.date.slice(5, 7)}/${p.date.slice(0, 4)} ${p.time}`;
}

/** The cell's content, independent of the grid component (used by the old grid and NotionGridV2). */
export function LatestCommentCell({ pageId, databaseId, onOpen, editable = false, wrap = false }: {
    pageId: string; databaseId: string; onOpen: (pageId: string) => void; editable?: boolean; wrap?: boolean;
}) {
    const t = useTranslations('Admin');
    const { data: session } = useSession();
    const load = useLatestComments(s => s.load);
    const latest = useLatestComments(s => s.byDb[databaseId]?.[pageId]);
    useEffect(() => { load(databaseId); }, [databaseId, load]);
    const [edit, setEdit] = useState<InPlaceEdit | null>(null);
    const [text, setText] = useState('');
    const [pending, setPending] = useState<string | null>(null);   // shown until the reload lands
    const done = useRef(false);

    const tooltip = latest ? `${latest.authorName} · ${when(latest.createdAt)} · ${t('comments.summary', { count: latest.count, open: latest.open })}` : undefined;

    const start = () => {
        const e = inPlaceEdit(latest, session?.user?.id);
        done.current = false; setEdit(e); setText(e.text);
    };
    const save = async () => {
        if (!edit || done.current) return;
        done.current = true;
        const body = text.trim(), e = edit;
        setEdit(null);
        if (!body || (e.kind === 'edit' && body === e.text)) return;   // nothing typed — never a delete from a cell
        setPending(body);
        const res = e.kind === 'edit' ? await editComment(e.id, body) : await postComment(pageId, body);
        if (!res?.ok) toast.error(t('comments.failed'));
        await load(databaseId, true);
        setPending(null);
    };

    if (edit) {
        return (
            <input
                autoFocus
                value={text}
                placeholder={edit.kind === 'add' ? t('comments.newPlaceholder') : undefined}
                onChange={ev => setText(ev.target.value)}
                onBlur={save}
                onKeyDown={ev => {
                    ev.stopPropagation();   // the grid's keys (arrows, type-to-replace) stay out of the comment
                    if (ev.key === 'Enter') { ev.preventDefault(); void save(); }
                    else if (ev.key === 'Escape') { ev.preventDefault(); done.current = true; setEdit(null); }
                }}
                onMouseDown={ev => ev.stopPropagation()}
                className="w-full h-full px-2 text-sm bg-white dark:bg-neutral-900 outline-none ring-2 ring-inset ring-orange-400"
            />
        );
    }

    const shown = pending ?? latest?.body ?? '';
    return (
        <div
            className={`w-full h-full px-2 flex text-sm ${editable ? 'cursor-text' : 'cursor-pointer'} overflow-hidden ${wrap ? 'items-start py-2' : 'items-center'}`}
            title={tooltip}
            // the old grid claims a DOCUMENT mousedown and swaps the cell — act on mousedown and keep it from the grid
            onMouseDown={(e) => {
                if (editable || e.button !== 0) return;
                e.preventDefault(); e.stopPropagation(); onOpen(pageId);
            }}
            onClick={() => { if (editable) start(); }}
        >
            <span className={`${wrap ? 'whitespace-pre-wrap break-words min-w-0' : 'truncate'} text-neutral-700 dark:text-neutral-300 ${pending ? 'opacity-60' : ''}`}>{shown}</span>
        </div>
    );
}

interface Props extends CellProps<any, any> { databaseId: string; onOpen: (pageId: string) => void }

function CommentsCell({ rowData, databaseId, onOpen }: Props) {
    return <LatestCommentCell pageId={rowData?.id} databaseId={databaseId} onOpen={onOpen} />;
}

export const commentsColumn = (databaseId: string, onOpen: (pageId: string) => void): Column<any, any> => ({
    component: (props) => <CommentsCell {...props} databaseId={databaseId} onOpen={onOpen} />,
    keepFocus: false,
    disabled: true,
    deleteValue: ({ rowData }) => rowData,
    copyValue: () => '',
    pasteValue: ({ rowData }) => rowData,
    isCellEmpty: () => false,
});
