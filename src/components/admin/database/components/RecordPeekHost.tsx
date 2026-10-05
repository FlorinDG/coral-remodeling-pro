'use client';
/** CROSS-LINK-1 · renders the linked-record side modals, stacked (lib/record-peek). Mounted once, in AdminLayout. */
import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useRecordPeek } from '@/lib/record-peek';

const PageModal = dynamic(() => import('./PageModal'), { ssr: false });

export default function RecordPeekHost() {
    const stack = useRecordPeek(s => s.stack);
    const close = useRecordPeek(s => s.close);
    const clear = useRecordPeek(s => s.clear);
    const pathname = usePathname();

    // Leaving the page closes every peek (they belong to the screen they were opened on).
    useEffect(() => { clear(); }, [pathname, clear]);

    // Only the top record renders (edits save as they are made); closing it brings back the one under it.
    // One modal at a time also keeps Escape / outside-click to ONE close, not one per layer.
    const top = stack[stack.length - 1];
    if (!top) return null;
    return <PageModal key={`${stack.length}:${top.databaseId}:${top.pageId}`} databaseId={top.databaseId} pageId={top.pageId} onClose={close} />;
}
