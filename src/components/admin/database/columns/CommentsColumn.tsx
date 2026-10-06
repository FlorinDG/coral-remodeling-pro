import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CellProps, Column } from 'react-datasheet-grid';
import { useTranslations } from 'next-intl';
import { useLatestComments } from '@/components/admin/comments/latest-comments-store';
import CommentThread from '@/components/admin/comments/CommentThread';
import { zonedParts } from '@/lib/kernel/shift-time';

/**
 * COMMENTS-1 · the "Opmerkingen" cell: the record's latest comment, TEXT ONLY (Florin 2026-10-05: "keep the column
 * clean") — who, when and how many are in the tooltip. `flyout` (the new grid): a click opens the record's thread in a
 * small flyout at the cell — the SAME thread as in the record (CommentThread compact): read, post, @mention, resolve.
 * The old grid (frozen, R3-C) keeps click-to-open the record.
 */
function when(iso: string): string {
    const p = zonedParts(iso);
    return `${p.date.slice(8, 10)}/${p.date.slice(5, 7)}/${p.date.slice(0, 4)} ${p.time}`;
}

const FLYOUT_W = 380, FLYOUT_H = 460;

/** The cell's content, independent of the grid component (used by the old grid and NotionGridV2). */
export function LatestCommentCell({ pageId, databaseId, onOpen, flyout = false, wrap = false }: {
    pageId: string; databaseId: string; onOpen: (pageId: string) => void; flyout?: boolean; wrap?: boolean;
}) {
    const t = useTranslations('Admin');
    const load = useLatestComments(s => s.load);
    const latest = useLatestComments(s => s.byDb[databaseId]?.[pageId]);
    useEffect(() => { load(databaseId); }, [databaseId, load]);
    const ref = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

    useLayoutEffect(() => {
        if (!open || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        const top = window.innerHeight - r.bottom < FLYOUT_H && r.top > FLYOUT_H ? r.top - FLYOUT_H - 4 : r.bottom + 4;
        const left = Math.max(8, Math.min(r.left, window.innerWidth - FLYOUT_W - 8));
        setPos({ top: Math.max(8, top), left });
    }, [open]);

    const tooltip = latest ? `${latest.authorName} · ${when(latest.createdAt)} · ${t('comments.summary', { count: latest.count, open: latest.open })}` : undefined;
    return (
        <div
            ref={ref}
            className={`w-full h-full px-2 flex text-sm cursor-pointer overflow-hidden ${wrap ? 'items-start py-2' : 'items-center'}`}
            title={open ? undefined : tooltip}
            // the old grid claims a DOCUMENT mousedown and swaps the cell — act on mousedown and keep it from the grid
            onMouseDown={(e) => {
                if (flyout || e.button !== 0) return;
                e.preventDefault(); e.stopPropagation(); onOpen(pageId);
            }}
            onClick={() => { if (flyout) setOpen(true); }}
        >
            <span className={`${wrap ? 'whitespace-pre-wrap break-words min-w-0' : 'truncate'} text-neutral-700 dark:text-neutral-300`}>{latest?.body ?? ''}</span>
            {open && pos && typeof document !== 'undefined' && createPortal(
                // a portal's events still bubble to the cell in React — stopped here (clicks, the grid's keys)
                <div className="fixed inset-0 z-[99998]" onMouseDown={() => setOpen(false)} onClick={e => e.stopPropagation()}
                     onKeyDown={e => { e.stopPropagation(); if (e.key === 'Escape') setOpen(false); }}>
                    <div className="fixed flex flex-col rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-900 shadow-2xl p-3 overflow-y-auto"
                         style={{ top: pos.top, left: pos.left, width: FLYOUT_W, maxHeight: FLYOUT_H }}
                         onMouseDown={e => e.stopPropagation()}>
                        <CommentThread pageId={pageId} databaseId={databaseId} compact />
                    </div>
                </div>,
                document.body,
            )}
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
