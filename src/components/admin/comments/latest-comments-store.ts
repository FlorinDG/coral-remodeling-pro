'use client';
/**
 * COMMENTS-1 · the "Opmerkingen" field's data: the latest comment per record, per database — loaded once per database
 * when a view shows the field, refreshed after a comment is posted. Not stored on the record (a comment never
 * writes the page, so it never races an edit of it).
 */
import { create } from 'zustand';
import { getLatestComments } from '@/app/actions/comments';
import type { LatestComment } from '@/lib/records/comments';

export type LatestSummary = LatestComment & { authorName: string };

interface State {
    byDb: Record<string, Record<string, LatestSummary>>;
    loading: Record<string, boolean>;
    load: (databaseId: string, force?: boolean) => Promise<void>;
}

export const useLatestComments = create<State>((set, get) => ({
    byDb: {},
    loading: {},
    load: async (databaseId, force = false) => {
        if (!databaseId || get().loading[databaseId] || (!force && get().byDb[databaseId])) return;
        set(s => ({ loading: { ...s.loading, [databaseId]: true } }));
        try {
            const map = await getLatestComments(databaseId);
            set(s => ({ byDb: { ...s.byDb, [databaseId]: map } }));
        } catch (err) {
            console.error('[comments] latest comments not loaded', err);
        } finally {
            set(s => ({ loading: { ...s.loading, [databaseId]: false } }));
        }
    },
}));
