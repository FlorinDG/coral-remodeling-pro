"use client";

import React, { useState, useMemo } from 'react';
import { useDatabaseStore } from '@/components/admin/database/store';
import { Block } from '@/components/admin/database/types';
import { PenLine, Search, Filter, Loader2, User, Calendar, Briefcase, Users, Layout, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Button } from '@/components/time-tracker/components/ui/button';
import { Link } from '@/i18n/routing';
import { useTenant } from '@/context/TenantContext';

type ModuleType = 'projects' | 'clients' | 'crm' | 'all';

interface JournalEntry {
    id: string;
    title: string;
    databaseId: string;
    databaseName: string;
    module: ModuleType;
    updatedAt: Date;
    blocks: Block[];
    author?: string;
}

export default function JournalModulePage() {
    const { databases } = useDatabaseStore();
    const { resolveDbId } = useTenant();
    const [activeTab, setActiveTab] = useState<ModuleType>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const loading = databases.length === 0;

    // Database Mapping
    const moduleMap = useMemo(() => ({
        [resolveDbId('projects') || 'db-1']: 'projects' as ModuleType,
        [resolveDbId('clients') || 'db-clients']: 'clients' as ModuleType,
        [resolveDbId('crm') || 'db-crm']: 'crm' as ModuleType,
    }), [resolveDbId]);


    const allEntries = useMemo(() => {
        const entries: JournalEntry[] = [];
        databases.forEach(db => {
            const modType = moduleMap[db.id];
            if (!modType) return;

            db.pages.forEach(page => {
                if (page.blocks && page.blocks.length > 0) {
                    const props = page.properties as Record<string, unknown>;
                    entries.push({
                        id: page.id,
                        title: String(props?.title || props?.name || 'Untitled Record'),
                        databaseId: db.id,
                        databaseName: db.name,
                        module: modType,
                        updatedAt: new Date(page.updatedAt),
                        blocks: page.blocks,
                        author: (props?.['prop-owner'] as string[])?.[0] || 'System'
                    });
                }
            });
        });
        return entries.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    }, [databases, moduleMap]);

    const filteredEntries = useMemo(() => {
        return allEntries.filter(entry => {
            const matchesTab = activeTab === 'all' || entry.module === activeTab;
            const matchesSearch = entry.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                 entry.blocks.some(b => b.content?.toLowerCase().includes(searchQuery.toLowerCase()));
            return matchesTab && matchesSearch;
        });
    }, [allEntries, activeTab, searchQuery]);

    const tabs: { id: ModuleType; label: string; icon: React.ReactNode }[] = [
        { id: 'all',      label: 'All Updates', icon: <Layout className="w-4 h-4" /> },
        { id: 'projects', label: 'Projects',    icon: <Briefcase className="w-4 h-4" /> },
        { id: 'clients',  label: 'Clients',     icon: <Users className="w-4 h-4" /> },
        { id: 'crm',      label: 'CRM / Leads', icon: <PenLine className="w-4 h-4" /> },
    ];

    return (
        <div className="flex flex-col h-full bg-neutral-50 dark:bg-black overflow-hidden">
            {/* Header */}
            <header className="flex-shrink-0 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-white/10 px-8 py-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-black tracking-tight">Organization Journal</h1>
                        <p className="text-sm text-neutral-500">A unified feed of all record documentation and progress notes.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                            <input 
                                type="text"
                                placeholder="Search journal..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 pr-4 py-2 bg-neutral-100 dark:bg-white/5 border-none rounded-xl text-sm focus:ring-2 focus:ring-orange-500/20 transition-all w-64"
                            />
                        </div>
                        <Button variant="outline" size="icon" className="rounded-xl">
                            <Filter className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-1 p-1 bg-neutral-100 dark:bg-white/5 rounded-xl w-fit">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                                activeTab === tab.id 
                                    ? 'bg-white dark:bg-neutral-800 text-orange-500 shadow-sm' 
                                    : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                            }`}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>
            </header>

            {/* Content Feed */}
            <main className="flex-1 overflow-y-auto p-8">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-64">
                        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                    </div>
                ) : (
                    <div className="max-w-4xl mx-auto space-y-6 pb-20">
                        {filteredEntries.map(entry => (
                            <JournalCard key={entry.id} entry={entry} />
                        ))}

                        {filteredEntries.length === 0 && (
                            <div className="text-center py-20">
                                <PenLine className="w-12 h-12 text-neutral-200 mx-auto mb-4" />
                                <p className="text-neutral-400">No journal entries found for this criteria.</p>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}

function JournalCard({ entry }: { entry: JournalEntry }) {
    // Extract a preview of the content
    const previewText = entry.blocks
        .filter(b => b.type === 'paragraph' || b.type.startsWith('heading'))
        .map(b => b.content)
        .join(' ')
        .slice(0, 200) + '...';

    const moduleColors: Record<string, string> = {
        projects: 'bg-blue-500',
        clients: 'bg-green-500',
        crm: 'bg-purple-500',
    };

    return (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all group border-l-4" style={{ borderLeftColor: moduleColors[entry.module] ? undefined : '#d1d5db' }}>
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white ${moduleColors[entry.module] || 'bg-neutral-400'}`}>
                        {entry.module === 'projects' ? <Briefcase className="w-4 h-4" /> : 
                         entry.module === 'clients' ? <Users className="w-4 h-4" /> : 
                         <PenLine className="w-4 h-4" />}
                    </div>
                    <div>
                        <h3 className="text-sm font-black tracking-tight text-neutral-900 dark:text-white uppercase">{entry.title}</h3>
                        <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">{entry.databaseName}</p>
                    </div>
                </div>
                <div className="text-right">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">
                        <Calendar className="w-3 h-3" />
                        {format(entry.updatedAt, 'dd MMM yyyy HH:mm', { locale: nl })}
                    </div>
                    <div className="flex items-center justify-end gap-1.5 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                        <User className="w-3 h-3" />
                        {entry.author}
                    </div>
                </div>
            </div>

            <div className="prose prose-sm dark:prose-invert max-w-none mb-6">
                <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed italic">
                    &quot;{previewText}&quot;
                </p>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-neutral-100 dark:border-white/5">
                <div className="flex gap-2">
                    {entry.blocks.slice(0, 3).map((b, i) => (
                        <div key={i} className="px-2 py-1 bg-neutral-100 dark:bg-white/5 rounded text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                            {b.type.replace('_', ' ')}
                        </div>
                    ))}
                    {entry.blocks.length > 3 && (
                        <div className="px-2 py-1 text-[10px] font-bold text-neutral-300 uppercase tracking-wider">
                            +{entry.blocks.length - 3} more
                        </div>
                    )}
                </div>
                <Link href={`/admin/database/${entry.databaseId}/page/${entry.id}`}>
                    <Button variant="ghost" size="sm" className="gap-2 text-orange-500 hover:text-orange-600 hover:bg-orange-50 transition-all font-bold uppercase tracking-widest text-[10px]">
                        Open Record <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
                    </Button>
                </Link>
            </div>
        </div>
    );
}
