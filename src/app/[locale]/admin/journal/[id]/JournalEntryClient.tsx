"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useDatabaseStore } from '@/components/admin/database/store';
import { ArrowLeft, PenLine, Calendar, User, Notebook } from 'lucide-react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

const BlockEditor = dynamic(() => import('@/components/admin/database/components/BlockEditor'), { ssr: false });

const GENERAL_DB_ID = 'db-journal-general';

interface JournalEntryPageClientProps {
    entryId: string;
    locale: string;
}

export default function JournalEntryPageClient({ entryId, locale }: JournalEntryPageClientProps) {
    const router = useRouter();
    const [isHydrated, setIsHydrated] = useState(false);

    const updatePageProperty = useDatabaseStore(state => state.updatePageProperty);

    useEffect(() => {
        useDatabaseStore.persist.onFinishHydration(() => setIsHydrated(true));
        setIsHydrated(useDatabaseStore.persist?.hasHydrated() || false);
    }, []);

    const database = useDatabaseStore(state =>
        state.databases.find(db => db.id === GENERAL_DB_ID)
    );
    const page = useDatabaseStore(state =>
        state.databases.find(db => db.id === GENERAL_DB_ID)?.pages.find(p => p.id === entryId)
    );

    if (!isHydrated) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!database || !page) {
        return (
            <div className="flex h-full items-center justify-center flex-col gap-4 text-neutral-500 dark:text-neutral-400">
                <Notebook className="w-10 h-10 opacity-30" />
                <p className="text-sm font-medium">Journal entry not found</p>
                <button
                    onClick={() => router.push(`/${locale}/admin/journal`)}
                    className="text-xs text-orange-500 hover:underline"
                >
                    Back to Journal
                </button>
            </div>
        );
    }

    const title = String(page.properties['title'] || page.properties['name'] || '');
    const author = String(page.properties['author'] || 'System');
    const createdAt = page.createdAt ? new Date(page.createdAt) : new Date(page.updatedAt);

    return (
        <div className="flex flex-col w-full h-full bg-white dark:bg-neutral-950 text-neutral-900 dark:text-white overflow-hidden">

            {/* ── Header ─────────────────────────────────────────────── */}
            <div className="flex items-center gap-3 px-6 py-3 border-b border-neutral-200 dark:border-white/10 flex-shrink-0 bg-white dark:bg-neutral-950">
                <button
                    onClick={() => router.push(`/${locale}/admin/journal`)}
                    className="p-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors text-neutral-500"
                >
                    <ArrowLeft className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-2 text-xs text-neutral-400">
                    <PenLine className="w-3.5 h-3.5 text-orange-500" />
                    <span className="font-bold uppercase tracking-wider text-[10px]">Journal</span>
                </div>

                <div className="flex-1" />

                {/* Metadata chips */}
                <div className="flex items-center gap-3 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                    <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {author}
                    </span>
                    <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {format(createdAt, 'dd MMM yyyy, HH:mm', { locale: nl })}
                    </span>
                </div>
            </div>

            {/* ── Content canvas ────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-3xl mx-auto px-6 lg:px-12 py-10">

                    {/* Title — large, editable */}
                    <input
                        type="text"
                        value={title}
                        onChange={e => updatePageProperty(GENERAL_DB_ID, entryId, 'title', e.target.value)}
                        placeholder="Untitled"
                        className="w-full text-4xl font-black tracking-tight text-neutral-900 dark:text-white bg-transparent outline-none border-none focus:ring-0 placeholder:text-neutral-300 dark:placeholder:text-neutral-700 mb-1"
                    />

                    {/* Subtitle line */}
                    <div className="flex items-center gap-2 text-xs text-neutral-400 mb-10">
                        <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full font-bold text-[9px] uppercase tracking-wider">
                            General
                        </span>
                        <span>·</span>
                        <span>{format(createdAt, 'EEEE, dd MMMM yyyy', { locale: nl })}</span>
                    </div>

                    {/* Block editor — the core note-taking experience */}
                    <BlockEditor databaseId={GENERAL_DB_ID} pageId={entryId} />
                </div>
            </div>
        </div>
    );
}
