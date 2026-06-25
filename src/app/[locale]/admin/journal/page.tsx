"use client";

import React, { useState, useMemo } from 'react';
import { useDatabaseStore } from '@/components/admin/database/store';
import { Block, Block } from '@/components/admin/database/types';
import { 
    PenLine, Search, Loader2, User, Calendar, Briefcase, 
    Users, Layout, Table, Plus, X,
    ChevronDown, ChevronUp, AlertCircle,
    CheckSquare, BookOpen, Globe, Notebook,
    Link2, ExternalLink, 
} from 'lucide-react';
import { format, formatDistanceToNow, isToday, isYesterday, isThisWeek, isThisMonth } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/routing';
import { useTenant } from '@/context/TenantContext';
import { v4 as uuidv4 } from 'uuid';
import SearchableSelect from '@/components/ui/SearchableSelect';
import BlockEditor from '@/components/admin/database/components/BlockEditor';

type Module = 'projects' | 'clients' | 'crm' | 'general' | 'all';
type View = 'feed' | 'database';

interface JournalEntry {
    id: string;
    title: string;
    databaseId: string;
    databaseName: string;
    module: Module;
    updatedAt: Date;
    blocks: Block[];
    author?: string;
    page: any;
    // Cross-database link
    linkedDatabaseId?: string;
    linkedRecordId?: string;
    linkedRecordTitle?: string;
}



// Notion-style relative date labels
function getDateGroupLabel(date: Date): string {
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    if (isThisWeek(date, { weekStartsOn: 1 })) return 'This Week';
    if (isThisMonth(date)) return 'This Month';
    return format(date, 'MMMM yyyy', { locale: nl });
}

function groupEntriesByDate(entries: JournalEntry[]): { label: string; entries: JournalEntry[] }[] {
    const groups: Map<string, JournalEntry[]> = new Map();
    for (const entry of entries) {
        const label = getDateGroupLabel(entry.updatedAt);
        if (!groups.has(label)) groups.set(label, []);
        groups.get(label)!.push(entry);
    }
    return Array.from(groups.entries()).map(([label, entries]) => ({ label, entries }));
}

const GENERAL_DB_ID = 'db-journal-general';



// ── Linkable databases (all user-facing) ─────────────────────────────────
const LINKABLE_DB_IDS = [
    'db-1',           // Projects
    'db-clients',     // Clients
    'db-crm',         // CRM
    'db-tasks',       // Tasks
    'db-quotations',  // Quotations
    'db-invoices',    // Invoices
    'db-suppliers',   // Suppliers
    'db-bobex',       // Bobex Pipeline
];

export default function JournalModulePage() {
    const { databases } = useDatabaseStore();
    const { resolveDbId } = useTenant();
    
    // Core Navigation & View States
    const [view, setView] = useState<View>('feed');
    const [activeTab, setActiveTab] = useState<Module>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    // Modal creation states
    const [newEntryTitle, setNewEntryTitle] = useState('');
    const [authorName, setAuthorName] = useState('');
    // Link states
    const [linkDatabaseId, setLinkDatabaseId] = useState('');
    const [linkRecordId, setLinkRecordId] = useState('');
    const [draftId, setDraftId] = useState<string | null>(null);

    const loading = databases.length === 0;

    // Ensure the general journal DB exists (create on first access if missing)
    const generalDb = databases.find(d => d.id === GENERAL_DB_ID);

    // Database Mapping for module tabs
    const moduleMap = useMemo(() => ({
        [resolveDbId('db-1') || 'db-1']: 'projects' as Module,
        [resolveDbId('db-clients') || 'db-clients']: 'clients' as Module,
        [resolveDbId('db-crm') || 'db-crm']: 'crm' as Module,
        [GENERAL_DB_ID]: 'general' as Module,
    }), [resolveDbId]);

    // Resolve linkable DBs for the modal
    const linkableDatabases = useMemo(() => {
        return LINKABLE_DB_IDS.map(baseId => {
            const resolved = resolveDbId(baseId) || baseId;
            const db = databases.find(d => d.id === resolved);
            if (!db) return null;
            return { id: resolved, name: db.name };
        }).filter(Boolean) as { id: string; name: string }[];
    }, [databases, resolveDbId]);

    // Records for the selected link database
    const linkableRecords = useMemo(() => {
        if (!linkDatabaseId) return [];
        const db = databases.find(d => d.id === linkDatabaseId);
        if (!db) return [];
        return db.pages.map(p => {
            const props = p.properties as Record<string, unknown>;
            return {
                id: p.id,
                title: String(props?.title || props?.name || 'Untitled Record')
            };
        });
    }, [databases, linkDatabaseId]);

    // Extract all entries — from module DBs (block-based) AND journal DB (standalone)
    const allEntries: JournalEntry[] = [];
    
    // 1. Entries from module DBs (legacy: blocks embedded in pages)
    databases.forEach(db => {
        const mod = moduleMap[db.id];
        if (!mod) return;
        if (db.id === GENERAL_DB_ID) return; // Handle journal DB separately below

        db.pages.forEach(page => {
            if (page.blocks && page.blocks.length > 0) {
                const props = page.properties as Record<string, unknown>;
                allEntries.push({
                    id: page.id,
                    title: String(props?.title || props?.name || 'Untitled Record'),
                    databaseId: db.id,
                    databaseName: db.name,
                    module: mod,
                    updatedAt: new Date(page.updatedAt),
                    blocks: page.blocks,
                    author: (props?.['prop-owner'] as string[])?.[0] || (props?.['author'] as string) || 'System',
                    page: page
                });
            }
        });
    });

    // 2. Entries from journal DB (standalone journal pages — may have cross-refs)
    if (generalDb) {
        generalDb.pages.forEach(page => {
            const props = page.properties as Record<string, unknown>;
            const linkedDbId = props?.linkedDatabaseId as string | undefined;
            const linkedRecId = props?.linkedRecordId as string | undefined;
            let linkedRecTitle = props?.linkedRecordTitle as string | undefined;
            let resolvedModule: Module = 'general';

            // Resolve module from linked database
            if (linkedDbId && moduleMap[linkedDbId]) {
                resolvedModule = moduleMap[linkedDbId];
            }

            // Resolve linked record title if missing
            if (linkedDbId && linkedRecId && !linkedRecTitle) {
                const targetDb = databases.find(d => d.id === linkedDbId);
                const targetPage = targetDb?.pages.find(p => p.id === linkedRecId);
                if (targetPage) {
                    const targetProps = targetPage.properties as Record<string, unknown>;
                    linkedRecTitle = String(targetProps?.title || targetProps?.name || 'Untitled');
                }
            }

            allEntries.push({
                id: page.id,
                title: String(props?.title || props?.name || 'Untitled Note'),
                databaseId: GENERAL_DB_ID,
                databaseName: 'General Journal',
                module: resolvedModule,
                updatedAt: new Date(page.updatedAt),
                blocks: page.blocks || [],
                author: String(props?.author || 'System'),
                page: page,
                linkedDatabaseId: linkedDbId,
                linkedRecordId: linkedRecId,
                linkedRecordTitle: linkedRecTitle,
            });
        });
    }

    allEntries.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    // Filtered entries
    const filteredEntries = allEntries.filter(entry => {
        const matchesTab = activeTab === 'all' || entry.module === activeTab;
        const searchLower = searchQuery.toLowerCase();
        const matchesSearch = 
            entry.title.toLowerCase().includes(searchLower) || 
            entry.databaseName.toLowerCase().includes(searchLower) ||
            entry.blocks.some(b => b.content?.toLowerCase().includes(searchLower));
        return matchesTab && matchesSearch;
    });

    const dateGroupedEntries = groupEntriesByDate(filteredEntries);

    // Handle saving new journal entry — always creates in journal DB with optional link
    const handleSaveNewEntry = (e: React.FormEvent) => {
        e.preventDefault();
        if (!draftId) return;

        // Build page properties
        const pageProps: Record<string, any> = {
            title: newEntryTitle || `Note — ${format(new Date(), 'dd MMM yyyy, HH:mm')}`,
            author: authorName || 'System',
        };

        // Add cross-reference if a record was selected
        if (linkDatabaseId && linkRecordId) {
            const linkedDb = databases.find(d => d.id === linkDatabaseId);
            const linkedPage = linkedDb?.pages.find(p => p.id === linkRecordId);
            const linkedProps = linkedPage?.properties as Record<string, unknown> | undefined;
            pageProps.linkedDatabaseId = linkDatabaseId;
            pageProps.linkedRecordId = linkRecordId;
            pageProps.linkedRecordTitle = String(linkedProps?.title || linkedProps?.name || 'Untitled');
        }

        // Update the page with the final properties
        for (const [k, v] of Object.entries(pageProps)) {
            useDatabaseStore.getState().updatePageProperty(GENERAL_DB_ID, draftId, k, v);
        }

        // Reset & Close Modal
        setDraftId(null);
        setNewEntryTitle('');
        setLinkDatabaseId('');
        setLinkRecordId('');
        setIsAddModalOpen(false);
    };
    
    const handleCancelEntry = () => {
        if (draftId) {
            useDatabaseStore.getState().deletePage(GENERAL_DB_ID, draftId);
            setDraftId(null);
        }
        setIsAddModalOpen(false);
    };

    const tabs: { id: Module; label: string; icon: React.ReactNode }[] = [
        { id: 'all',      label: 'All',       icon: <Layout className="w-4 h-4" /> },
        { id: 'general',  label: 'General',   icon: <Notebook className="w-4 h-4" /> },
        { id: 'projects', label: 'Projects',  icon: <Briefcase className="w-4 h-4" /> },
        { id: 'clients',  label: 'Clients',   icon: <Users className="w-4 h-4" /> },
        { id: 'crm',      label: 'CRM',       icon: <PenLine className="w-4 h-4" /> },
    ];

    const journalContextLinks = [
        { label: 'Projects', href: '/admin/database/db-1', icon: <Briefcase className="w-3.5 h-3.5" /> },
        { label: 'Clients',  href: '/admin/database/db-clients', icon: <Users className="w-3.5 h-3.5" /> },
        { label: 'CRM',      href: '/admin/database/db-crm', icon: <Globe className="w-3.5 h-3.5" /> },
    ];

    return (
        <div className="flex flex-col h-full bg-neutral-50 dark:bg-black overflow-hidden">
            {/* Header */}
            <header className="flex-shrink-0 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-white/10 px-6 lg:px-8 py-5">
                <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
                    <div className="min-w-0">
                        <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                            <PenLine className="w-6 h-6 text-orange-500 flex-shrink-0" /> Organization Journal
                        </h1>
                        <p className="text-sm text-neutral-500 mt-0.5">A Notion-style feed of project logs, client communications, and personal notes.</p>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        {/* Journal context links */}
                        <div className="hidden lg:flex items-center gap-1.5 bg-neutral-100 dark:bg-white/5 rounded-xl px-3 py-1.5">
                            <BookOpen className="w-3.5 h-3.5 text-neutral-400" />
                            {journalContextLinks.map(link => (
                                <Link
                                    key={link.href}
                                    href={link.href as `/${string}`}
                                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider text-neutral-500 hover:text-orange-500 hover:bg-white dark:hover:bg-white/5 transition-all"
                                >
                                    {link.icon}
                                    {link.label}
                                </Link>
                            ))}
                        </div>

                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                            <input 
                                type="text"
                                placeholder="Search journal..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 pr-4 py-2 bg-neutral-100 dark:bg-white/5 border-none rounded-xl text-sm focus:ring-2 focus:ring-orange-500/20 transition-all w-56"
                            />
                        </div>

                        {/* View  Toggle */}
                        <div className="flex items-center bg-neutral-100 dark:bg-white/5 p-1 rounded-xl gap-1">
                            <button 
                                onClick={() => setView('feed')}
                                className={`p-2 rounded-lg transition-all ${view === 'feed' ? 'bg-white dark:bg-neutral-800 text-orange-500 shadow-sm' : 'text-neutral-500'}`}
                                title="Notion Feed View"
                            >
                                <Layout className="w-4 h-4" />
                            </button>
                            <button 
                                onClick={() => setView('database')}
                                className={`p-2 rounded-lg transition-all ${view === 'database' ? 'bg-white dark:bg-neutral-800 text-orange-500 shadow-sm' : 'text-neutral-500'}`}
                                title="Database View"
                            >
                                <Table className="w-4 h-4" />
                            </button>
                        </div>

                        {/* "New Entry" Trigger */}
                        <Button 
                            onClick={() => {
                                const newDraftId = uuidv4();
                                setDraftId(newDraftId);
                                setIsAddModalOpen(true);
                                setLinkDatabaseId('');
                                setLinkRecordId('');
                                setNewEntryTitle('');
                                
                                // Ensure journal DB exists
                                let db = useDatabaseStore.getState().databases.find(d => d.id === GENERAL_DB_ID);
                                if (!db) {
                                    db = useDatabaseStore.getState().createDatabase('General Journal', 'Free-form internal notes and journal entries', GENERAL_DB_ID, [
                                        { id: 'title', name: 'Title', type: 'text' },
                                        { id: 'author', name: 'Author', type: 'text' },
                                        { id: 'created', name: 'Created', type: 'created_time' },
                                    ]);
                                }

                                // Create the draft page so BlockEditor can attach to it
                                useDatabaseStore.getState().createPage(GENERAL_DB_ID, {
                                    title: `Note — ${format(new Date(), 'dd MMM yyyy, HH:mm')}`,
                                    author: authorName || 'System',
                                }, undefined, undefined, newDraftId);
                            }}
                            className="bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl flex items-center gap-1.5 px-4 py-2 uppercase tracking-wider text-xs shadow-sm hover:shadow transition-all"
                        >
                            <Plus className="w-4 h-4" /> New Entry
                        </Button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-1 p-1 bg-neutral-100 dark:bg-white/5 rounded-xl w-fit flex-wrap">
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
            <main className="flex-1 overflow-y-auto p-6 lg:p-8">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-64">
                        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                    </div>
                ) : (
                    <div className="max-w-4xl mx-auto pb-20">
                        {view === 'feed' ? (
                            <>
                                {dateGroupedEntries.length === 0 && (
                                    <div className="text-center py-20">
                                        <PenLine className="w-12 h-12 text-neutral-200 dark:text-neutral-700 mx-auto mb-4" />
                                        <p className="text-neutral-400 mb-4">No journal entries found for this criteria.</p>
                                        <button
                                            onClick={() => setIsAddModalOpen(true)}
                                            className="flex items-center gap-2 mx-auto px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-bold transition-colors"
                                        >
                                            <Plus className="w-4 h-4" /> Create your first note
                                        </button>
                                    </div>
                                )}
                                {dateGroupedEntries.map(group => (
                                    <div key={group.label} className="mb-8">
                                        {/* Date Group Header */}
                                        <div className="flex items-center gap-3 mb-4">
                                            <span className="text-xs font-black uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
                                                {group.label}
                                            </span>
                                            <div className="flex-1 h-px bg-neutral-200 dark:bg-white/10" />
                                            <span className="text-[10px] font-bold text-neutral-300 dark:text-neutral-600">
                                                {group.entries.length} {group.entries.length === 1 ? 'entry' : 'entries'}
                                            </span>
                                        </div>

                                        {/* Entries */}
                                        <div className="space-y-4">
                                            {group.entries.map(entry => (
                                                <JournalFeedCard 
                                                    key={entry.id} 
                                                    entry={entry} 
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </>
                        ) : (
                            <JournalDatabaseView entries={filteredEntries} />
                        )}
                    </div>
                )}
            </main>

            {/* ── New Entry Modal (centered) ── */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-opacity duration-200">
                    <div className="w-full max-w-3xl bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-white/10 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 dark:border-white/5">
                            <h2 className="text-base font-black tracking-tight uppercase flex items-center gap-2">
                                <Plus className="w-5 h-5 text-orange-500" /> New Journal Entry
                            </h2>
                            <button 
                                onClick={handleCancelEntry}
                                className="p-1.5 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-lg transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="overflow-y-auto flex-1">
                            <form onSubmit={handleSaveNewEntry} className="p-6 space-y-5">
                                {/* Title */}
                                <div>
                                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5">Title</label>
                                    <input
                                        type="text"
                                        value={newEntryTitle}
                                        onChange={(e) => setNewEntryTitle(e.target.value)}
                                        placeholder={`Note — ${format(new Date(), 'dd MMM yyyy')}`}
                                        className="w-full bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-500/20"
                                    />
                                </div>

                                {/* ── Link to Record (optional) ── */}
                                <div className="bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200 dark:border-white/10 rounded-xl p-4 space-y-3">
                                    <label className="flex items-center gap-2 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                                        <Link2 className="w-3.5 h-3.5" /> Link to Record <span className="text-neutral-300 normal-case font-normal">(optional)</span>
                                    </label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <SearchableSelect
                                            options={[
                                                { value: '', label: 'No database' },
                                                ...linkableDatabases.map(db => ({ value: db.id, label: db.name }))
                                            ]}
                                            value={linkDatabaseId}
                                            onChange={(v) => { setLinkDatabaseId(v); setLinkRecordId(''); }}
                                            placeholder="Select database..."
                                            searchPlaceholder="Search databases..."
                                        />
                                        {linkDatabaseId && (
                                            <SearchableSelect
                                                options={[
                                                    { value: '', label: 'No record' },
                                                    ...linkableRecords.map(r => ({ value: r.id, label: r.title }))
                                                ]}
                                                value={linkRecordId}
                                                onChange={setLinkRecordId}
                                                placeholder="Select record..."
                                                searchPlaceholder="Search records..."
                                            />
                                        )}
                                    </div>
                                    {linkDatabaseId && linkRecordId && (
                                        <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                                            <Link2 className="w-3 h-3" />
                                            <span>Will be linked to: <strong>{linkableRecords.find(r => r.id === linkRecordId)?.title}</strong></span>
                                        </div>
                                    )}
                                </div>

                                {/* Author name */}
                                <div>
                                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5">Author</label>
                                    <input
                                        type="text"
                                        value={authorName}
                                        onChange={(e) => setAuthorName(e.target.value)}
                                        className="w-full bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500/20"
                                        placeholder="Your name..."
                                    />
                                </div>

                                {/* BlockEditor */}
                                {draftId && (
                                    <div className="border border-neutral-200 dark:border-white/10 rounded-xl overflow-hidden mt-4">
                                        <div className="bg-white dark:bg-[#191919] min-h-[300px] overflow-y-auto max-h-[50vh]">
                                            <BlockEditor databaseId={GENERAL_DB_ID} pageId={draftId} />
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center gap-3 pt-2">
                                    <Button 
                                        type="submit" 
                                        className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-2.5 uppercase tracking-wider text-xs rounded-xl"
                                    >
                                        Publish Entry
                                    </Button>
                                    <Button 
                                        type="button" 
                                        variant="outline" 
                                        onClick={handleCancelEntry}
                                        className="flex-1 border-neutral-200 dark:border-white/10 py-2.5 uppercase tracking-wider text-xs rounded-xl"
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Notion Feed Card Component ───────────────────────────────────────────
interface JournalFeedCardProps {
    entry: JournalEntry;
}

function JournalFeedCard({ entry }: JournalFeedCardProps) {
    const [isPropertiesOpen, setIsPropertiesOpen] = useState(false);

    const moduleColors: Record<string, { accent: string; badge: string }> = {
        projects: { accent: '#d97706', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
        clients:  { accent: '#16a34a', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
        crm:      { accent: '#78716c', badge: 'bg-stone-100 text-stone-700 dark:bg-stone-900/30 dark:text-stone-400' },
        general:  { accent: '#d35400', badge: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' },
    };

    const mc = moduleColors[entry.module] || moduleColors.general;

    // Determine the correct href: journal entries go to /journal/[id], others go to database record
    const entryHref = entry.databaseId === GENERAL_DB_ID
        ? `/admin/journal/${entry.id}` as `/${string}`
        : `/admin/database/${entry.databaseId}/${entry.id}` as `/${string}`;
    
    // Linked record href
    const linkedHref = entry.linkedDatabaseId && entry.linkedRecordId
        ? `/admin/database/${entry.linkedDatabaseId}/${entry.linkedRecordId}` as `/${string}`
        : null;

    return (
        <div 
            className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden border-l-[4px]"
            style={{ borderLeftColor: mc.accent }}
        >
            <div className="p-5">
                {/* Author & meta */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                        <div 
                            className="w-8 h-8 rounded-full flex items-center justify-center font-black text-sm text-white select-none"
                            style={{ backgroundColor: mc.accent }}
                        >
                            {(entry.author || 'S').charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs font-black text-neutral-900 dark:text-white">{entry.author || 'System'}</span>
                                <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${mc.badge}`}>{entry.module}</span>
                            </div>
                            <span className="text-[10px] text-neutral-400 font-medium">{entry.databaseName}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                        <Calendar className="w-3 h-3" />
                        {formatDistanceToNow(entry.updatedAt, { addSuffix: true, locale: nl })}
                    </div>
                </div>

                {/* Title — clickable to open */}
                <Link href={entryHref}>
                    <h2 className="text-sm font-black tracking-tight text-neutral-900 dark:text-white uppercase mb-2 hover:text-orange-500 transition-colors cursor-pointer">
                        {entry.title}
                    </h2>
                </Link>

                {/* Linked record chip */}
                {linkedHref && entry.linkedRecordTitle && (
                    <Link href={linkedHref}>
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30 rounded-lg text-[10px] font-bold text-blue-600 dark:text-blue-400 mb-3 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors cursor-pointer">
                            <Link2 className="w-3 h-3" />
                            Linked to: {entry.linkedRecordTitle}
                            <ExternalLink className="w-2.5 h-2.5 opacity-50" />
                        </div>
                    </Link>
                )}

                {/* Collapsible Properties */}
                <div className="mb-3 border-t border-b border-neutral-100 dark:border-white/5 py-1.5">
                    <button
                        onClick={() => setIsPropertiesOpen(!isPropertiesOpen)}
                        className="flex items-center gap-1 text-[10px] font-bold text-neutral-400 hover:text-neutral-600 uppercase tracking-widest"
                    >
                        {isPropertiesOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        {isPropertiesOpen ? 'Hide' : 'Show'} Properties
                    </button>

                    {isPropertiesOpen && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2.5 text-xs animate-in fade-in duration-200">
                            <div className="space-y-0.5">
                                <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Author</span>
                                <div className="font-medium flex items-center gap-1.5">
                                    <User className="w-3.5 h-3.5 text-neutral-300" />
                                    {entry.author || 'System'}
                                </div>
                            </div>
                            <div className="space-y-0.5">
                                <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Module</span>
                                <div className="font-bold text-orange-500 uppercase tracking-wide">{entry.module}</div>
                            </div>
                            <div className="space-y-0.5">
                                <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Blocks</span>
                                <div className="font-medium text-neutral-500">{entry.blocks.length} elements</div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Rich Feed Content */}
                <div className="space-y-2.5 text-sm leading-relaxed mb-4 text-neutral-700 dark:text-neutral-300">
                    {entry.blocks.map((block) => {
                        if (block.type === 'heading_1') {
                            return <h2 key={block.id} className="text-lg font-black tracking-tight text-neutral-900 dark:text-white">{block.content}</h2>;
                        }
                        if (block.type === 'heading_2') {
                            return <h3 key={block.id} className="text-base font-bold text-neutral-800 dark:text-neutral-100">{block.content}</h3>;
                        }
                        if (block.type === 'heading_3') {
                            return <h4 key={block.id} className="text-sm font-bold text-neutral-700 dark:text-neutral-200">{block.content}</h4>;
                        }
                        if (block.type === 'paragraph') {
                            return <p key={block.id} className="pl-2 border-l-2 border-neutral-100 dark:border-white/10 font-serif italic">{block.content}</p>;
                        }
                        if (block.type === 'quote') {
                            return (
                                <blockquote key={block.id} className="pl-4 border-l-4 border-orange-500 italic text-neutral-500 bg-neutral-50 dark:bg-white/5 py-2 pr-2 rounded-r-xl">
                                    &quot;{block.content}&quot;
                                </blockquote>
                            );
                        }
                        if (block.type === 'callout') {
                            return (
                                <div key={block.id} className="flex gap-3 bg-orange-500/5 dark:bg-orange-500/10 border border-orange-500/25 p-3.5 rounded-2xl">
                                    <AlertCircle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                                    <div className="text-orange-950 dark:text-orange-200 text-sm">{block.content}</div>
                                </div>
                            );
                        }
                        if (block.type === 'bulleted_list_item') {
                            return (
                                <div key={block.id} className="flex items-start gap-2 pl-3">
                                    <div className="w-1.5 h-1.5 bg-neutral-400 dark:bg-neutral-500 rounded-full mt-1.5 flex-shrink-0" />
                                    <span>{block.content}</span>
                                </div>
                            );
                        }
                        if (block.type === 'numbered_list_item') {
                            return (
                                <div key={block.id} className="flex items-start gap-2 pl-3">
                                    <span className="text-neutral-400 font-mono text-xs mt-0.5">#</span>
                                    <span>{block.content}</span>
                                </div>
                            );
                        }
                        if (block.type === 'todo') {
                            return (
                                <div key={block.id} className="flex items-center gap-2 pl-3">
                                    <CheckSquare className="w-4 h-4 text-orange-500 flex-shrink-0" />
                                    <span className={block.properties?.checked ? 'line-through text-neutral-400' : ''}>{block.content}</span>
                                </div>
                            );
                        }
                        if (block.type === 'code') {
                            return (
                                <pre key={block.id} className="bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg px-4 py-3 text-xs font-mono text-neutral-700 dark:text-neutral-300 overflow-x-auto whitespace-pre-wrap">
                                    {block.content}
                                </pre>
                            );
                        }
                        if (block.type === 'divider') {
                            return <hr key={block.id} className="border-neutral-200 dark:border-white/10" />;
                        }
                        // Render any other known block types as plain text
                        if (block.content) {
                            return <p key={block.id} className="text-sm text-neutral-600 dark:text-neutral-400">{block.content}</p>;
                        }
                        return null;
                    })}
                </div>

            </div>
        </div>
    );
}

// ── Database Grid View Component ──────────────────────────────────────────
function JournalDatabaseView({ entries }: { entries: JournalEntry[] }) {
    return (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-neutral-50 dark:bg-white/5 border-b border-neutral-200 dark:border-white/10">
                            <th className="px-5 py-3.5 text-[10px] font-extrabold uppercase tracking-wider text-neutral-400">Title</th>
                            <th className="px-5 py-3.5 text-[10px] font-extrabold uppercase tracking-wider text-neutral-400">Module</th>
                            <th className="px-5 py-3.5 text-[10px] font-extrabold uppercase tracking-wider text-neutral-400">Linked To</th>
                            <th className="px-5 py-3.5 text-[10px] font-extrabold uppercase tracking-wider text-neutral-400">Author</th>
                            <th className="px-5 py-3.5 text-[10px] font-extrabold uppercase tracking-wider text-neutral-400">Last Updated</th>
                            <th className="px-5 py-3.5 text-[10px] font-extrabold uppercase tracking-wider text-neutral-400 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-white/5">
                        {entries.map(entry => (
                            <tr key={entry.id} className="hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors">
                                <td className="px-5 py-3.5">
                                    <div className="font-black text-xs text-neutral-900 dark:text-white uppercase tracking-tight">{entry.title}</div>
                                </td>
                                <td className="px-5 py-3.5">
                                    <span className="text-[9px] px-2 py-0.5 bg-neutral-100 dark:bg-white/5 font-extrabold rounded-full text-neutral-400 uppercase tracking-wider">{entry.module}</span>
                                </td>
                                <td className="px-5 py-3.5">
                                    {entry.linkedRecordTitle ? (
                                        <Link href={`/admin/database/${entry.linkedDatabaseId}/${entry.linkedRecordId}` as `/${string}`}>
                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-500 hover:text-blue-600 transition-colors cursor-pointer">
                                                <Link2 className="w-3 h-3" />
                                                {entry.linkedRecordTitle}
                                            </span>
                                        </Link>
                                    ) : (
                                        <span className="text-[10px] text-neutral-300">—</span>
                                    )}
                                </td>
                                <td className="px-5 py-3.5">
                                    <span className="text-xs text-neutral-500 font-bold">{entry.author || 'System'}</span>
                                </td>
                                <td className="px-5 py-3.5">
                                    <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">
                                        {format(entry.updatedAt, 'dd MMM yyyy HH:mm', { locale: nl })}
                                    </span>
                                </td>
                                <td className="px-5 py-3.5 text-right">
                                    <Link href={
                                        entry.databaseId === GENERAL_DB_ID
                                            ? `/admin/journal/${entry.id}` as `/${string}`
                                            : `/admin/database/${entry.databaseId}/${entry.id}` as `/${string}`
                                    }>
                                        <button className="text-xs font-black text-orange-500 hover:text-orange-600 uppercase tracking-wider text-[10px] hover:underline">
                                            Open
                                        </button>
                                    </Link>
                                </td>
                            </tr>
                        ))}

                        {entries.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-5 py-12 text-center text-xs text-neutral-400 italic">
                                    No records matching active query.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
