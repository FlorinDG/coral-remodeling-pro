'use client';
/**
 * CROSS-LINK-1 · the side-modal stack for linked records. A linked record opens ON TOP of where the user is
 * (grid, side panel, another record's modal); closing returns to what was under it. One host renders it
 * (RecordPeekHost, mounted once in AdminLayout). The rule which records open here: databaseRoute.opensInSideModal.
 */
import { create } from 'zustand';

export interface PeekEntry { databaseId: string; pageId: string }

interface RecordPeekState {
    stack: PeekEntry[];
    open: (databaseId: string, pageId: string) => void;
    close: () => void;
    clear: () => void;
}

export const useRecordPeek = create<RecordPeekState>((set) => ({
    stack: [],
    open: (databaseId, pageId) => set(s => {
        const top = s.stack[s.stack.length - 1];
        if (top && top.databaseId === databaseId && top.pageId === pageId) return s;   // same record: no double layer
        return { stack: [...s.stack, { databaseId, pageId }] };
    }),
    close: () => set(s => ({ stack: s.stack.slice(0, -1) })),
    clear: () => set({ stack: [] }),
}));
