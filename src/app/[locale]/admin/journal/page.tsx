"use client";

import React, { useState, useMemo } from 'react';
import { useDatabaseStore } from '@/components/admin/database/store';
import { Block, Page } from '@/components/admin/database/types';
import { 
    PenLine, Search, Loader2, User, Calendar, Briefcase, 
    Users, Layout, ArrowRight, Table, Plus, X, MessageSquare, 
    Send, ChevronDown, ChevronUp, AlertCircle, Quote, AlignLeft, CheckSquare, List
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Button } from '@/components/time-tracker/components/ui/button';
import { Link } from '@/i18n/routing';
import { useTenant } from '@/context/TenantContext';
import { v4 as uuidv4 } from 'uuid';

type ModuleType = 'projects' | 'clients' | 'crm' | 'all';
type ViewType = 'feed' | 'database';

interface JournalEntry {
    id: string;
    title: string;
    databaseId: string;
    databaseName: string;
    module: ModuleType;
    updatedAt: Date;
    blocks: Block[];
    author?: string;
    page: Page;
}

interface CommentItem {
    id: string;
    author: string;
    text: string;
    createdAt: string;
}

const DEFAULT_REACTIONS = { '👍': 0, '❤️': 0, '🚀': 0, '🎉': 0 };

export default function JournalModulePage() {
    const { databases, updatePageBlocks } = useDatabaseStore();
    const { resolveDbId } = useTenant();
    
    // Core Navigation & View States
    const [viewType, setViewType] = useState<ViewType>('feed');
    const [activeTab, setActiveTab] = useState<ModuleType>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    // Modal creation states
    const [targetModule, setTargetModule] = useState<Exclude<ModuleType, 'all'>>('projects');
    const [selectedPageId, setSelectedPageId] = useState('');
    const [selectedBlockType, setSelectedBlockType] = useState<Block['type']>('paragraph');
    const [newEntryContent, setNewEntryContent] = useState('');
    const [authorName, setAuthorName] = useState('Florin (Manager)');

    const loading = databases.length === 0;

    // Database Mapping
    const moduleMap = useMemo(() => ({
        [resolveDbId('projects') || 'db-1']: 'projects' as ModuleType,
        [resolveDbId('clients') || 'db-clients']: 'clients' as ModuleType,
        [resolveDbId('crm') || 'db-crm']: 'crm' as ModuleType,
    }), [resolveDbId]);

    // Reverse map module to dbId
    const getDbIdFromModule = (mod: Exclude<ModuleType, 'all'>) => {
        if (mod === 'projects') return resolveDbId('projects') || 'db-1';
        if (mod === 'clients') return resolveDbId('clients') || 'db-clients';
        return resolveDbId('crm') || 'db-crm';
    };

    // Extract all entries chronologically (Computed dynamically to satisfy React Compiler)
    const allEntries: JournalEntry[] = [];
    databases.forEach(db => {
        const modType = moduleMap[db.id];
        if (!modType) return;

        db.pages.forEach(page => {
            if (page.blocks && page.blocks.length > 0) {
                const props = page.properties as Record<string, unknown>;
                allEntries.push({
                    id: page.id,
                    title: String(props?.title || props?.name || 'Untitled Record'),
                    databaseId: db.id,
                    databaseName: db.name,
                    module: modType,
                    updatedAt: new Date(page.updatedAt),
                    blocks: page.blocks,
                    author: (props?.['prop-owner'] as string[])?.[0] || 'System',
                    page: page
                });
            }
        });
    });
    allEntries.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    // Available target pages for creation dropdown (Computed dynamically)
    const targetDbId = getDbIdFromModule(targetModule);
    const targetDb = databases.find(d => d.id === targetDbId);
    const availablePages = targetDb 
        ? targetDb.pages.map(p => {
            const props = p.properties as Record<string, unknown>;
            return {
                id: p.id,
                title: String(props?.title || props?.name || 'Untitled Record')
            };
        })
        : [];

    // Filtered entries for render (Computed dynamically)
    const filteredEntries = allEntries.filter(entry => {
        const matchesTab = activeTab === 'all' || entry.module === activeTab;
        
        const searchLower = searchQuery.toLowerCase();
        const matchesSearch = 
            entry.title.toLowerCase().includes(searchLower) || 
            entry.databaseName.toLowerCase().includes(searchLower) ||
            entry.blocks.some(b => b.content?.toLowerCase().includes(searchLower));
        
        return matchesTab && matchesSearch;
    });

    // Handle saving new journal entry block
    const handleSaveNewEntry = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPageId || !newEntryContent.trim()) return;

        const activeDbId = getDbIdFromModule(targetModule);
        const activeDb = databases.find(d => d.id === activeDbId);
        const targetPage = activeDb?.pages.find(p => p.id === selectedPageId);

        if (!targetPage) return;

        // Build the new Notion-inspired progress note block
        const newBlock: Block = {
            id: uuidv4(),
            type: selectedBlockType,
            content: newEntryContent,
            properties: {
                createdAt: new Date().toISOString(),
                author: authorName || 'System',
                reactions: {},
                comments: []
            }
        };

        // Append the new block to existing page blocks
        const existingBlocks = targetPage.blocks || [];
        const nextBlocks = [...existingBlocks, newBlock];

        // Trigger store action
        updatePageBlocks(activeDbId, selectedPageId, nextBlocks);

        // Reset & Close Modal
        setNewEntryContent('');
        setIsAddModalOpen(false);
    };

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
                        <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                            <PenLine className="w-6 h-6 text-orange-500" /> Organization Journal
                        </h1>
                        <p className="text-sm text-neutral-500">A unified Notion-inspired feed of all project logs, client communications, and progress notes.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Search & Filters */}
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

                        {/* View Type Toggle */}
                        <div className="flex items-center bg-neutral-100 dark:bg-white/5 p-1 rounded-xl gap-1">
                            <button 
                                onClick={() => setViewType('feed')}
                                className={`p-2 rounded-lg transition-all ${viewType === 'feed' ? 'bg-white dark:bg-neutral-800 text-orange-500 shadow-sm' : 'text-neutral-500'}`}
                                title="Notion Feed View"
                            >
                                <Layout className="w-4 h-4" />
                            </button>
                            <button 
                                onClick={() => setViewType('database')}
                                className={`p-2 rounded-lg transition-all ${viewType === 'database' ? 'bg-white dark:bg-neutral-800 text-orange-500 shadow-sm' : 'text-neutral-500'}`}
                                title="Database View"
                            >
                                <Table className="w-4 h-4" />
                            </button>
                        </div>

                        {/* "New Entry" Trigger */}
                        <Button 
                            onClick={() => {
                                setIsAddModalOpen(true);
                                // Set initial page selection
                                const initialDbId = getDbIdFromModule(targetModule);
                                const firstDb = databases.find(d => d.id === initialDbId);
                                if (firstDb?.pages?.[0]) setSelectedPageId(firstDb.pages[0].id);
                            }}
                            className="bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl flex items-center gap-1.5 px-4 py-2 uppercase tracking-wider text-xs shadow-sm hover:shadow transition-all"
                        >
                            <Plus className="w-4 h-4" /> New Entry
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
                        {viewType === 'feed' ? (
                            <>
                                {filteredEntries.map(entry => (
                                    <JournalFeedCard 
                                        key={entry.id} 
                                        entry={entry} 
                                        updatePageBlocks={updatePageBlocks}
                                    />
                                ))}

                                {filteredEntries.length === 0 && (
                                    <div className="text-center py-20">
                                        <PenLine className="w-12 h-12 text-neutral-200 mx-auto mb-4" />
                                        <p className="text-neutral-400">No journal entries found for this criteria.</p>
                                    </div>
                                )}
                            </>
                        ) : (
                            <JournalDatabaseView entries={filteredEntries} />
                        )}
                    </div>
                )}
            </main>

            {/* Add Entry sliding drawer / modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-end transition-opacity duration-300">
                    <div className="w-full max-w-lg bg-white dark:bg-neutral-900 h-full p-8 shadow-2xl flex flex-col justify-between transform transition-transform duration-300 animate-in slide-in-from-right">
                        <div className="space-y-6">
                            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-white/5 pb-4">
                                <h2 className="text-lg font-black tracking-tight uppercase flex items-center gap-2">
                                    <Plus className="w-5 h-5 text-orange-500" /> Add Journal Entry
                                </h2>
                                <button 
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="p-1.5 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-lg transition-all"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleSaveNewEntry} className="space-y-4">
                                {/* Target Database Selection */}
                                <div>
                                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5">1. Target Module</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {(['projects', 'clients', 'crm'] as const).map(mod => (
                                            <button
                                                key={mod}
                                                type="button"
                                                onClick={() => {
                                                    setTargetModule(mod);
                                                    const activeDbId = getDbIdFromModule(mod);
                                                    const db = databases.find(d => d.id === activeDbId);
                                                    if (db?.pages?.[0]) {
                                                        setSelectedPageId(db.pages[0].id);
                                                    } else {
                                                        setSelectedPageId('');
                                                    }
                                                }}
                                                className={`py-2 px-3 text-xs font-black uppercase tracking-wider rounded-xl border transition-all ${
                                                    targetModule === mod 
                                                        ? 'bg-orange-500/10 border-orange-500 text-orange-500' 
                                                        : 'border-neutral-200 dark:border-white/10 hover:bg-neutral-50 dark:hover:bg-white/5'
                                                }`}
                                            >
                                                {mod}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Target Page/Record Dropdown */}
                                <div>
                                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5">2. Target Record</label>
                                    <select
                                        value={selectedPageId}
                                        onChange={(e) => setSelectedPageId(e.target.value)}
                                        className="w-full bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none"
                                        required
                                    >
                                        <option value="" disabled>Select a record...</option>
                                        {availablePages.map(p => (
                                            <option key={p.id} value={p.id}>{p.title}</option>
                                        ))}
                                    </select>
                                    {availablePages.length === 0 && (
                                        <p className="text-[10px] text-red-500 mt-1 font-bold">No records found in this module.</p>
                                    )}
                                </div>

                                {/* Entry Style Selector */}
                                <div>
                                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5">3. Style Theme</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {[
                                            { type: 'paragraph',          label: 'Plain',   icon: <AlignLeft className="w-3.5 h-3.5" /> },
                                            { type: 'quote',              label: 'Quote',   icon: <Quote className="w-3.5 h-3.5" /> },
                                            { type: 'callout',            label: 'Callout', icon: <AlertCircle className="w-3.5 h-3.5" /> },
                                            { type: 'bulleted_list_item', label: 'Bullet',  icon: <List className="w-3.5 h-3.5" /> },
                                        ].map(style => (
                                            <button
                                                key={style.type}
                                                type="button"
                                                onClick={() => setSelectedBlockType(style.type as Block['type'])}
                                                className={`py-2 px-1 text-[10px] font-black uppercase tracking-wider rounded-xl border flex flex-col items-center gap-1 transition-all ${
                                                    selectedBlockType === style.type
                                                        ? 'bg-orange-500/10 border-orange-500 text-orange-500'
                                                        : 'border-neutral-200 dark:border-white/10 hover:bg-neutral-50 dark:hover:bg-white/5'
                                                }`}
                                            >
                                                {style.icon}
                                                {style.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Author name */}
                                <div>
                                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5">4. Written By</label>
                                    <input
                                        type="text"
                                        value={authorName}
                                        onChange={(e) => setAuthorName(e.target.value)}
                                        className="w-full bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500/20"
                                        placeholder="Author name..."
                                        required
                                    />
                                </div>

                                {/* Content */}
                                <div>
                                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5">5. Journal Note</label>
                                    <textarea
                                        value={newEntryContent}
                                        onChange={(e) => setNewEntryContent(e.target.value)}
                                        rows={6}
                                        className="w-full bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 resize-none font-serif leading-relaxed italic"
                                        placeholder="Type the progressive updates..."
                                        required
                                    />
                                </div>

                                <div className="pt-4 flex items-center gap-3">
                                    <Button 
                                        type="submit" 
                                        className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 uppercase tracking-wider text-xs rounded-xl"
                                        disabled={!selectedPageId || !newEntryContent.trim()}
                                    >
                                        Publish Entry
                                    </Button>
                                    <Button 
                                        type="button" 
                                        variant="outline" 
                                        onClick={() => setIsAddModalOpen(false)}
                                        className="flex-1 border-neutral-200 dark:border-white/10 py-3 uppercase tracking-wider text-xs rounded-xl"
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </form>
                        </div>
                        <div className="text-center text-[10px] text-neutral-400">
                            Notes are saved directly inside target entity block records.
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
    updatePageBlocks: (dbId: string, pageId: string, blocks: Block[]) => void;
}

function JournalFeedCard({ entry, updatePageBlocks }: JournalFeedCardProps) {
    const [isPropertiesOpen, setIsPropertiesOpen] = useState(false);
    const [isCommentOpen, setIsCommentOpen] = useState(false);
    const [commentText, setCommentText] = useState('');

    const moduleColors: Record<string, string> = {
        projects: '#3b82f6', // Blue
        clients: '#22c55e',  // Green
        crm: '#a855f7',      // Purple
    };

    const cardBorderColor = moduleColors[entry.module] || '#d1d5db';
    
    // Add reaction to the page's last block (or create a general one)
    const handleReact = (emoji: string) => {
        if (!entry.blocks.length) return;
        const lastBlock = entry.blocks[entry.blocks.length - 1];
        const nextBlocks = entry.blocks.map(b => {
            if (b.id !== lastBlock.id) return b;
            const props = b.properties || {};
            const reactions = props.reactions || {};
            reactions[emoji] = (reactions[emoji] || 0) + 1;
            return { ...b, properties: { ...props, reactions } };
        });
        updatePageBlocks(entry.databaseId, entry.id, nextBlocks);
    };

    // Aggregate reactions dynamically (Computed on-the-fly to satisfy React Compiler)
    const aggregatedReactions = { ...DEFAULT_REACTIONS } as Record<string, number>;
    entry.blocks.forEach(b => {
        const rx = b.properties?.reactions as Record<string, number> | undefined;
        if (rx) {
            Object.keys(rx).forEach(key => {
                aggregatedReactions[key] = (aggregatedReactions[key] || 0) + (rx[key] || 0);
            });
        }
    });

    // Handle adding comments to the main log page
    const handleAddComment = (e: React.FormEvent) => {
        e.preventDefault();
        if (!commentText.trim() || !entry.blocks.length) return;

        const lastBlock = entry.blocks[entry.blocks.length - 1];
        const nextBlocks = entry.blocks.map(b => {
            if (b.id !== lastBlock.id) return b;
            const props = b.properties || {};
            const comments = props.comments || [];
            const newComment = {
                id: uuidv4(),
                author: 'Florin (Manager)',
                text: commentText,
                createdAt: new Date().toISOString()
            };
            return { ...b, properties: { ...props, comments: [...comments, newComment] } };
        });

        updatePageBlocks(entry.databaseId, entry.id, nextBlocks);
        setCommentText('');
    };

    // Extract comments dynamically (Computed on-the-fly to satisfy React Compiler)
    const allComments: { id: string; author: string; text: string; createdAt: Date }[] = [];
    entry.blocks.forEach(b => {
        const comments = b.properties?.comments as CommentItem[] | undefined;
        if (comments) {
            comments.forEach(c => {
                allComments.push({
                    id: c.id,
                    author: c.author,
                    text: c.text,
                    createdAt: new Date(c.createdAt)
                });
            });
        }
    });
    allComments.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    return (
        <div 
            className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-2xl shadow-sm hover:shadow-md transition-all group overflow-hidden border-l-[6px]"
            style={{ borderLeftColor: cardBorderColor }}
        >
            {/* Card Main Area */}
            <div className="p-6">
                {/* Author & Profile details */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/10 flex items-center justify-center font-bold text-neutral-600 dark:text-neutral-300">
                            {entry.author ? entry.author.charAt(0) : 'S'}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-black tracking-tight text-neutral-900 dark:text-white uppercase">{entry.author || 'System'}</span>
                                <span className="text-[9px] px-2 py-0.5 bg-neutral-100 dark:bg-white/5 font-extrabold rounded-full text-neutral-400 uppercase tracking-wider">{entry.module}</span>
                            </div>
                            <span className="text-[10px] text-neutral-400 uppercase font-bold tracking-wider">{entry.databaseName}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                        <Calendar className="w-3.5 h-3.5 text-neutral-300" />
                        {formatDistanceToNow(entry.updatedAt, { addSuffix: true, locale: nl })}
                    </div>
                </div>

                {/* Article Header */}
                <div className="mb-4">
                    <h2 className="text-lg font-black tracking-tight text-neutral-900 dark:text-white uppercase hover:text-orange-500 transition-colors">
                        {entry.title}
                    </h2>
                </div>

                {/* Collapsible Properties Tray (Notion-style properties panels) */}
                <div className="mb-4 border-t border-b border-neutral-100 dark:border-white/5 py-2">
                    <button
                        onClick={() => setIsPropertiesOpen(!isPropertiesOpen)}
                        className="flex items-center gap-1 text-[10px] font-bold text-neutral-400 hover:text-neutral-600 uppercase tracking-widest"
                    >
                        {isPropertiesOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        {isPropertiesOpen ? 'Hide' : 'Show'} Notion Properties
                    </button>

                    {isPropertiesOpen && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 text-xs animate-in fade-in duration-200">
                            <div className="space-y-1">
                                <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Owner</span>
                                <div className="font-medium flex items-center gap-1.5">
                                    <User className="w-3.5 h-3.5 text-neutral-300" />
                                    {entry.author || 'System'}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Module Type</span>
                                <div className="font-medium text-orange-500 uppercase tracking-wide font-bold">{entry.module}</div>
                            </div>
                            <div className="space-y-1">
                                <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Total Blocks</span>
                                <div className="font-medium text-neutral-500">{entry.blocks.length} elements</div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Rich Feed Content Area (Native Block Rendering) */}
                <div className="space-y-3.5 text-sm leading-relaxed mb-6 font-serif italic text-neutral-700 dark:text-neutral-300">
                    {entry.blocks.map((block) => {
                        if (block.type === 'paragraph') {
                            return (
                                <p key={block.id} className="pl-2 border-l-2 border-neutral-100 dark:border-white/5">
                                    &quot;{block.content}&quot;
                                </p>
                            );
                        }
                        if (block.type === 'quote') {
                            return (
                                <blockquote key={block.id} className="pl-4 border-l-4 border-orange-500 dark:border-orange-600 italic text-neutral-500 bg-neutral-50 dark:bg-white/5 py-2 pr-2 rounded-r-xl">
                                    &quot;{block.content}&quot;
                                </blockquote>
                            );
                        }
                        if (block.type === 'callout') {
                            return (
                                <div key={block.id} className="flex gap-3 bg-orange-500/5 dark:bg-orange-500/10 border border-orange-500/25 p-4 rounded-2xl">
                                    <AlertCircle className="w-5 h-5 text-orange-500 flex-shrink-0" />
                                    <div className="text-orange-950 dark:text-orange-200">{block.content}</div>
                                </div>
                            );
                        }
                        if (block.type === 'bulleted_list_item') {
                            return (
                                <div key={block.id} className="flex items-center gap-2 pl-4">
                                    <div className="w-1.5 h-1.5 bg-neutral-400 dark:bg-neutral-500 rounded-full" />
                                    <span>{block.content}</span>
                                </div>
                            );
                        }
                        if (block.type === 'todo') {
                            return (
                                <div key={block.id} className="flex items-center gap-2 pl-4 font-bold">
                                    <CheckSquare className="w-4 h-4 text-orange-500" />
                                    <span className="line-through text-neutral-400">{block.content}</span>
                                </div>
                            );
                        }
                        return (
                            <div key={block.id} className="text-xs text-neutral-400">
                                Unsupported block: {block.type}
                            </div>
                        );
                    })}
                </div>

                {/* Reactions Drawer */}
                <div className="flex items-center justify-between pt-4 border-t border-neutral-100 dark:border-white/5">
                    {/* Emoji Interactions */}
                    <div className="flex items-center gap-1.5">
                        {Object.keys(DEFAULT_REACTIONS).map(emoji => {
                            const count = aggregatedReactions[emoji] || 0;
                            return (
                                <button
                                    key={emoji}
                                    onClick={() => handleReact(emoji)}
                                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full border transition-all text-xs ${
                                        count > 0 
                                            ? 'bg-orange-50 dark:bg-orange-500/10 border-orange-500 text-orange-500' 
                                            : 'border-neutral-200 dark:border-white/10 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/5'
                                    }`}
                                >
                                    <span>{emoji}</span>
                                    {count > 0 && <span className="font-bold">{count}</span>}
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Comments Toggle */}
                        <button
                            onClick={() => setIsCommentOpen(!isCommentOpen)}
                            className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-orange-500 transition-colors py-1.5 px-3 rounded-xl hover:bg-neutral-50 dark:hover:bg-white/5 font-bold uppercase tracking-wider text-[10px]"
                        >
                            <MessageSquare className="w-4 h-4" /> 
                            {allComments.length > 0 ? `${allComments.length} Comments` : 'Comment'}
                        </button>

                        <Link href={`/admin/database/${entry.databaseId}/page/${entry.id}`}>
                            <Button variant="ghost" size="sm" className="gap-1.5 text-orange-500 hover:text-orange-600 hover:bg-orange-50 font-bold uppercase tracking-widest text-[10px] rounded-xl">
                                Open Record <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>

            {/* Comment drawer expanded at the bottom */}
            {isCommentOpen && (
                <div className="bg-neutral-50 dark:bg-neutral-900/50 border-t border-neutral-100 dark:border-white/5 p-6 space-y-4">
                    {/* Render existing comments */}
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                        {allComments.map(c => (
                            <div key={c.id} className="bg-white dark:bg-neutral-900 p-3 rounded-2xl border border-neutral-100 dark:border-white/5 space-y-1">
                                <div className="flex items-center justify-between text-[9px] font-bold text-neutral-400 uppercase tracking-wider">
                                    <span className="text-neutral-800 dark:text-neutral-300 font-black">{c.author}</span>
                                    <span>{formatDistanceToNow(c.createdAt, { addSuffix: true, locale: nl })}</span>
                                </div>
                                <p className="text-xs text-neutral-600 dark:text-neutral-400 font-sans italic">{c.text}</p>
                            </div>
                        ))}

                        {allComments.length === 0 && (
                            <p className="text-xs text-neutral-400 text-center py-4 italic">No comments yet. Write one below!</p>
                        )}
                    </div>

                    {/* Add comment form */}
                    <form onSubmit={handleAddComment} className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Add a comment..."
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            className="flex-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none focus:ring-2 focus:ring-orange-500/20"
                            required
                        />
                        <button
                            type="submit"
                            className="bg-orange-500 hover:bg-orange-600 text-white p-2.5 rounded-xl transition-colors"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </form>
                </div>
            )}
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
                            <th className="px-6 py-4 text-[10px] font-extrabold uppercase tracking-wider text-neutral-400">Record Title</th>
                            <th className="px-6 py-4 text-[10px] font-extrabold uppercase tracking-wider text-neutral-400">Module</th>
                            <th className="px-6 py-4 text-[10px] font-extrabold uppercase tracking-wider text-neutral-400">Source DB</th>
                            <th className="px-6 py-4 text-[10px] font-extrabold uppercase tracking-wider text-neutral-400">Author</th>
                            <th className="px-6 py-4 text-[10px] font-extrabold uppercase tracking-wider text-neutral-400">Blocks Count</th>
                            <th className="px-6 py-4 text-[10px] font-extrabold uppercase tracking-wider text-neutral-400">Last Updated</th>
                            <th className="px-6 py-4 text-[10px] font-extrabold uppercase tracking-wider text-neutral-400 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-white/5">
                        {entries.map(entry => (
                            <tr key={entry.id} className="hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="font-black text-xs text-neutral-900 dark:text-white uppercase tracking-tight">
                                        {entry.title}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-[9px] px-2 py-0.5 bg-neutral-100 dark:bg-white/5 font-extrabold rounded-full text-neutral-400 uppercase tracking-wider">
                                        {entry.module}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">
                                        {entry.databaseName}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-xs text-neutral-500 font-bold">
                                        {entry.author || 'System'}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-xs font-bold text-orange-500">
                                        {entry.blocks.length} elements
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">
                                        {format(entry.updatedAt, 'dd MMM yyyy HH:mm', { locale: nl })}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <Link href={`/admin/database/${entry.databaseId}/page/${entry.id}`}>
                                        <button className="text-xs font-black text-orange-500 hover:text-orange-600 uppercase tracking-wider text-[10px] hover:underline">
                                            Open
                                        </button>
                                    </Link>
                                </td>
                            </tr>
                        ))}

                        {entries.length === 0 && (
                            <tr>
                                <td colSpan={7} className="px-6 py-12 text-center text-xs text-neutral-400 italic">
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
