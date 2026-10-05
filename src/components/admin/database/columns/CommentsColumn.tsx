import React, { useEffect } from 'react';
import { CellProps, Column } from 'react-datasheet-grid';
import { MessageSquare } from 'lucide-react';
import { useLatestComments } from '@/components/admin/comments/latest-comments-store';
import { zonedParts } from '@/lib/kernel/shift-time';

/**
 * COMMENTS-1 · the "Opmerkingen" cell: the record's latest comment (author · snippet · when) and its count (open
 * comments highlighted). Read-only; clicking opens the record, where the thread is. Built read-only on purpose:
 * the grid is frozen for edits until GRID-REPLACE (coral-r3-grid.md R3-C) — this cell is ported as a renderer there.
 */
function when(iso: string): string {
    const p = zonedParts(iso);
    return `${p.date.slice(8, 10)}/${p.date.slice(5, 7)} ${p.time}`;
}

/** The cell's content, independent of the grid component (used by the old grid and NotionGridV2). */
export function LatestCommentCell({ pageId, databaseId, onOpen }: { pageId: string; databaseId: string; onOpen: (pageId: string) => void }) {
    const load = useLatestComments(s => s.load);
    const latest = useLatestComments(s => s.byDb[databaseId]?.[pageId]);
    useEffect(() => { load(databaseId); }, [databaseId, load]);
    return (
        <div
            className="w-full h-full px-2 flex items-center gap-1.5 text-xs cursor-pointer overflow-hidden"
            // the old grid claims a DOCUMENT mousedown and swaps the cell — act on mousedown and keep it from the grid
            onMouseDown={(e) => { if (e.button !== 0) return; e.preventDefault(); e.stopPropagation(); onOpen(pageId); }}
            title={latest ? `${latest.authorName}: ${latest.body}` : undefined}
        >
            {latest ? (
                <>
                    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full shrink-0 ${latest.open > 0 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' : 'bg-neutral-100 text-neutral-500 dark:bg-white/5'}`}>
                        <MessageSquare className="w-3 h-3" />{latest.count}
                    </span>
                    <span className="truncate text-neutral-700 dark:text-neutral-300"><b className="font-semibold">{latest.authorName}</b> {latest.body}</span>
                    <span className="shrink-0 text-[10px] text-neutral-400">{when(latest.createdAt)}</span>
                </>
            ) : (
                <span className="text-neutral-300 dark:text-neutral-600 inline-flex items-center gap-1"><MessageSquare className="w-3 h-3" /></span>
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
