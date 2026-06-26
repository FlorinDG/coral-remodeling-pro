"use client";

import React, { useState } from 'react';
import { useDatabaseStore } from '../store';
import { Block, BlockType } from '../types';
import {
    PenLine, Plus, Clock, User, ChevronDown, Trash2,
    Type, Heading1, Heading2, Heading3, List, ListOrdered,
    CheckSquare, Quote, AlertCircle, Code, Minus
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface JournalCardProps {
    databaseId: string;
    pageId: string;
    /** Optional minimum height. Default: 360px */
    minHeight?: string;
}

// ── Block type selector options ───────────────────────────────────────────
const BLOCK_TYPES: { type: BlockType; label: string; icon: React.ReactNode }[] = [
    { type: 'paragraph',          label: 'Text',   icon: <Type className="w-3 h-3" /> },
    { type: 'heading_1',          label: 'H1',     icon: <Heading1 className="w-3 h-3" /> },
    { type: 'heading_2',          label: 'H2',     icon: <Heading2 className="w-3 h-3" /> },
    { type: 'heading_3',          label: 'H3',     icon: <Heading3 className="w-3 h-3" /> },
    { type: 'bulleted_list_item', label: 'Bullet', icon: <List className="w-3 h-3" /> },
    { type: 'numbered_list_item', label: 'Number', icon: <ListOrdered className="w-3 h-3" /> },
    { type: 'todo',               label: 'Todo',   icon: <CheckSquare className="w-3 h-3" /> },
    { type: 'quote',              label: 'Quote',  icon: <Quote className="w-3 h-3" /> },
    { type: 'callout',            label: 'Callout', icon: <AlertCircle className="w-3 h-3" /> },
    { type: 'code',               label: 'Code',   icon: <Code className="w-3 h-3" /> },
    { type: 'divider',            label: 'Line',   icon: <Minus className="w-3 h-3" /> },
];

function htmlToText(html: string): string {
    if (!html) return '';
    return html
        .replace(/<[^>]*>?/gm, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// ── Rich block renderer ──────────────────────────────────────────────────
function RichBlock({ block, onToggleTodo }: { block: Block; onToggleTodo?: (blockId: string) => void }) {
    const text = block.type === 'code' ? block.content : htmlToText(block.content);

    switch (block.type) {
        case 'heading_1':
            return <h2 className="text-base font-black tracking-tight text-neutral-900 dark:text-white">{text}</h2>;
        case 'heading_2':
            return <h3 className="text-sm font-bold text-neutral-800 dark:text-neutral-100">{text}</h3>;
        case 'heading_3':
            return <h4 className="text-xs font-bold text-neutral-700 dark:text-neutral-200">{text}</h4>;
        case 'bulleted_list_item':
            return (
                <div className="flex items-start gap-2">
                    <span className="text-neutral-400 mt-0.5 text-xs">•</span>
                    <span className="text-xs leading-relaxed">{text}</span>
                </div>
            );
        case 'numbered_list_item':
            return (
                <div className="flex items-start gap-2">
                    <span className="text-neutral-400 mt-0.5 text-xs font-mono">#</span>
                    <span className="text-xs leading-relaxed">{text}</span>
                </div>
            );
        case 'todo':
            return (
                <div className="flex items-start gap-2">
                    <input
                        type="checkbox"
                        checked={!!block.properties?.checked}
                        onChange={() => onToggleTodo?.(block.id)}
                        className="mt-0.5 w-3.5 h-3.5 cursor-pointer accent-orange-500 rounded flex-shrink-0"
                    />
                    <span className={`text-xs leading-relaxed ${block.properties?.checked ? 'line-through text-neutral-400' : ''}`}>
                        {text}
                    </span>
                </div>
            );
        case 'quote':
            return (
                <blockquote className="pl-3 border-l-2 border-orange-400 italic text-xs text-neutral-500 dark:text-neutral-400">
                    {text}
                </blockquote>
            );
        case 'callout':
            return (
                <div className="flex gap-2 bg-orange-500/5 dark:bg-orange-500/10 border border-orange-500/20 p-2 rounded-lg">
                    <AlertCircle className="w-3.5 h-3.5 text-orange-500 flex-shrink-0 mt-0.5" />
                    <span className="text-xs text-orange-950 dark:text-orange-200">{text}</span>
                </div>
            );
        case 'code':
            return (
                <pre className="bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg px-3 py-2 text-[11px] font-mono text-neutral-700 dark:text-neutral-300 overflow-x-auto whitespace-pre-wrap">
                    {text}
                </pre>
            );
        case 'divider':
            return <hr className="border-neutral-200 dark:border-white/10 my-1" />;
        default:
            return <p className="text-xs leading-relaxed">{text}</p>;
    }
}

// ── Block type pill selector ─────────────────────────────────────────────
function BlockTypePills({ selected, onChange }: { selected: BlockType; onChange: (t: BlockType) => void }) {
    return (
        <div className="flex flex-wrap gap-1 mb-2">
            {BLOCK_TYPES.map(bt => (
                <button
                    key={bt.type}
                    type="button"
                    onClick={() => onChange(bt.type)}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all border ${
                        selected === bt.type
                            ? 'bg-orange-500/10 border-orange-500 text-orange-600 dark:text-orange-400'
                            : 'border-neutral-200 dark:border-white/10 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5'
                    }`}
                >
                    {bt.icon}
                    {bt.label}
                </button>
            ))}
        </div>
    );
}

/**
 * JournalCard — reusable journal component used in RecordDetailPage and ProjectDetailView.
 * Shows a header with "+ New Entry" button and a chronological list of journal entries.
 * Entries are editable inline: click to edit, blur/Enter to save, Escape to cancel.
 * Supports all Notion-style block types: headings, bullets, todos, quotes, callout, code, divider.
 */
export default function JournalCard({ databaseId, pageId, minHeight = '360px' }: JournalCardProps) {
    const page = useDatabaseStore(state =>
        state.databases.find(db => db.id === databaseId)?.pages.find(p => p.id === pageId)
    );
    const updatePageBlocks = useDatabaseStore(state => state.updatePageBlocks);
    const createPage = useDatabaseStore(state => state.createPage);

    // ── Linked journal entries from db-journal-general ──
    const journalDbPages = useDatabaseStore(state =>
        state.databases.find(db => db.id === 'db-journal-general')?.pages
    );

    const linkedJournalEntries = React.useMemo(() => {
        if (!journalDbPages) return [];
        return journalDbPages.filter(p =>
            p.properties?.['linkedRecordId'] === pageId && p.properties?.['linkedDatabaseId'] === databaseId
        );
    }, [journalDbPages, pageId, databaseId]);

    const [showQuickEntry, setShowQuickEntry] = useState(false);
    const [quickContent, setQuickContent] = useState('');
    const [quickBlockType, setQuickBlockType] = useState<BlockType>('paragraph');
    const [showEntries, setShowEntries] = useState(true);
    const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
    const [editDraft, setEditDraft] = useState('');
    const [editBlockType, setEditBlockType] = useState<BlockType>('paragraph');

    // Merge linked journal entries as virtual blocks for display
    const linkedBlocks: (Block & { isLinked?: boolean; linkedPageId?: string })[] = linkedJournalEntries.flatMap(entry =>
        (entry.blocks || [])
            .filter(b => b.type === 'divider' || (b.content && b.content.trim() !== ''))
            .map(b => ({ ...b, isLinked: true, linkedPageId: entry.id }))
    );

    const allDisplayBlocks = linkedBlocks;

    const handleAddQuickEntry = () => {
        if (quickBlockType !== 'divider' && !quickContent.trim()) return;

        const newBlock: Block = {
            id: uuidv4(),
            type: quickBlockType,
            content: quickBlockType === 'divider' ? '' : quickContent.trim(),
            properties: {
                createdAt: new Date().toISOString(),
                author: 'System',
            }
        };

        createPage('db-journal-general', {
            linkedRecordId: pageId,
            linkedDatabaseId: databaseId,
            author: 'System',
            createdAt: new Date().toISOString()
        }, undefined, [newBlock]);

        setQuickContent('');
        setQuickBlockType('paragraph');
        setShowQuickEntry(false);
    };

    // ── Inline edit handlers ──
    const startEditing = (block: Block) => {
        if (block.type === 'divider') return; // dividers aren't editable
        setEditingBlockId(block.id);
        setEditDraft(block.content || '');
        setEditBlockType(block.type);
    };

    const saveEdit = () => {
        if (!editingBlockId) return;
        const targetBlock = linkedBlocks.find(b => b.id === editingBlockId);
        if (!targetBlock || !targetBlock.linkedPageId) return;

        const linkedPage = journalDbPages?.find(p => p.id === targetBlock.linkedPageId);
        if (!linkedPage) return;
        const linkedPageBlocks = linkedPage.blocks || [];

        const trimmed = editDraft.trim();
        if (!trimmed && editBlockType !== 'divider') {
            const updatedBlocks = linkedPageBlocks.filter(b => b.id !== editingBlockId);
            updatePageBlocks('db-journal-general', targetBlock.linkedPageId, updatedBlocks);
        } else {
            const updatedBlocks = linkedPageBlocks.map(b =>
                b.id === editingBlockId ? { ...b, content: trimmed, type: editBlockType } : b
            );
            updatePageBlocks('db-journal-general', targetBlock.linkedPageId, updatedBlocks);
        }
        setEditingBlockId(null);
        setEditDraft('');
    };

    const cancelEdit = () => {
        setEditingBlockId(null);
        setEditDraft('');
    };

    const deleteBlock = (blockId: string) => {
        const targetBlock = linkedBlocks.find(b => b.id === blockId);
        if (!targetBlock || !targetBlock.linkedPageId) return;
        
        const linkedPage = journalDbPages?.find(p => p.id === targetBlock.linkedPageId);
        if (!linkedPage) return;
        const linkedPageBlocks = linkedPage.blocks || [];

        const updatedBlocks = linkedPageBlocks.filter(b => b.id !== blockId);
        updatePageBlocks('db-journal-general', targetBlock.linkedPageId, updatedBlocks);
    };

    const toggleTodo = (blockId: string) => {
        const targetBlock = linkedBlocks.find(b => b.id === blockId);
        if (!targetBlock || !targetBlock.linkedPageId) return;
        
        const linkedPage = journalDbPages?.find(p => p.id === targetBlock.linkedPageId);
        if (!linkedPage) return;
        const linkedPageBlocks = linkedPage.blocks || [];

        const updatedBlocks = linkedPageBlocks.map(b =>
            b.id === blockId ? { ...b, properties: { ...b.properties, checked: !b.properties?.checked } } : b
        );
        updatePageBlocks('db-journal-general', targetBlock.linkedPageId, updatedBlocks);
    };

    // Format created timestamp
    const formatEntryDate = (block: Block) => {
        const created = block.properties?.createdAt;
        if (!created) return null;
        try {
            const d = new Date(created as string);
            return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        } catch { return null; }
    };

    const totalEntries = allDisplayBlocks.length;

    return (
        <div
            className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-2xl flex flex-col shadow-sm"
            style={{ minHeight }}
        >
            {/* Header */}
            <div className="px-5 py-3 border-b border-neutral-200 dark:border-white/10 bg-neutral-50/80 dark:bg-white/5 flex items-center gap-2 font-bold text-[11px] uppercase tracking-widest text-neutral-600 dark:text-neutral-400">
                <PenLine className="w-4 h-4 text-orange-500" /> Journal
                {linkedBlocks.length > 0 && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold normal-case">
                        +{linkedBlocks.length} linked
                    </span>
                )}
                <div className="flex-1" />
                <button
                    onClick={() => setShowQuickEntry(!showQuickEntry)}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors hover:bg-neutral-200 dark:hover:bg-white/10"
                    style={{ color: 'var(--brand-color, #d35400)' }}
                >
                    <Plus className="w-3 h-3" /> New Entry
                </button>
            </div>

            {/* Quick Entry Form */}
            {showQuickEntry && (
                <div className="px-5 py-3 border-b border-neutral-200 dark:border-white/10 bg-orange-50/50 dark:bg-orange-500/5 animate-in fade-in slide-in-from-top-1 duration-150">
                    <BlockTypePills selected={quickBlockType} onChange={setQuickBlockType} />
                    {quickBlockType !== 'divider' ? (
                        <textarea
                            autoFocus
                            value={quickContent}
                            onChange={(e) => setQuickContent(e.target.value)}
                            placeholder={quickBlockType === 'code' ? 'Write code...' : quickBlockType === 'quote' ? 'Write a quote...' : 'Write a quick note...'}
                            rows={quickBlockType === 'code' ? 5 : 3}
                            className={`w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--brand-color,#d35400)]/30 resize-none ${quickBlockType === 'code' ? 'font-mono text-xs' : 'font-medium'}`}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAddQuickEntry();
                                if (e.key === 'Escape') setShowQuickEntry(false);
                            }}
                        />
                    ) : (
                        <p className="text-[10px] text-neutral-400 italic mb-1">Inserts a horizontal divider line.</p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-neutral-400">⌘+Enter to save</span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => { setShowQuickEntry(false); setQuickBlockType('paragraph'); }}
                                className="px-3 py-1 rounded-lg text-xs font-bold text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddQuickEntry}
                                disabled={quickBlockType !== 'divider' && !quickContent.trim()}
                                className="px-3 py-1 rounded-lg text-xs font-bold text-white transition-colors disabled:opacity-40"
                                style={{ backgroundColor: 'var(--brand-color, #d35400)' }}
                            >
                                Save Entry
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Entry List */}
            {totalEntries > 0 ? (
                <div className="flex-1">
                    <button
                        onClick={() => setShowEntries(!showEntries)}
                        className="w-full flex items-center gap-2 px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                    >
                        <ChevronDown className={`w-3 h-3 transition-transform ${showEntries ? '' : '-rotate-90'}`} />
                        {totalEntries} {totalEntries === 1 ? 'entry' : 'entries'}
                    </button>

                    {showEntries && (
                        <div className="divide-y divide-neutral-100 dark:divide-white/5">
                            {allDisplayBlocks.map(block => {
                                const dateStr = formatEntryDate(block);
                                const author = block.properties?.author as string | undefined;
                                const isEditing = editingBlockId === block.id;
                                const isLinked = (block as Block & { isLinked?: boolean }).isLinked;

                                return (
                                    <div key={block.id} className={`group px-5 py-2.5 flex gap-3 text-sm hover:bg-neutral-50 dark:hover:bg-white/[0.02] transition-colors ${isLinked ? 'bg-blue-50/30 dark:bg-blue-900/5' : ''}`}>
                                        <div className={`w-1 rounded-full flex-shrink-0 ${isLinked ? 'bg-blue-400/40' : 'bg-orange-400/40'}`} />
                                        <div className="flex-1 min-w-0">
                                            {isEditing ? (
                                                <div>
                                                    <BlockTypePills selected={editBlockType} onChange={setEditBlockType} />
                                                    <textarea
                                                        autoFocus
                                                        value={editDraft}
                                                        onChange={(e) => setEditDraft(e.target.value)}
                                                        onBlur={saveEdit}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); saveEdit(); }
                                                            if (e.key === 'Escape') cancelEdit();
                                                        }}
                                                        className={`w-full bg-white dark:bg-neutral-800 border border-orange-300 dark:border-orange-700 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-orange-500/20 resize-none ${editBlockType === 'code' ? 'font-mono' : ''}`}
                                                        rows={3}
                                                    />
                                                </div>
                                            ) : (
                                                <div
                                                    className="text-neutral-700 dark:text-neutral-300 cursor-pointer hover:text-neutral-900 dark:hover:text-white transition-colors"
                                                    onClick={() => !isLinked && startEditing(block)}
                                                    title={isLinked ? 'Linked entry (read-only)' : 'Click to edit'}
                                                >
                                                    <RichBlock block={block} onToggleTodo={!isLinked ? toggleTodo : undefined} />
                                                </div>
                                            )}
                                            <div className="flex items-center gap-3 mt-1">
                                                {isLinked && (
                                                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold">
                                                        Linked
                                                    </span>
                                                )}
                                                {dateStr && (
                                                    <span className="flex items-center gap-1 text-[10px] text-neutral-400">
                                                        <Clock className="w-3 h-3" /> {dateStr}
                                                    </span>
                                                )}
                                                {author && author !== 'System' && (
                                                    <span className="flex items-center gap-1 text-[10px] text-neutral-400">
                                                        <User className="w-3 h-3" /> {author}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        {/* Delete button — visible on hover, only for own blocks */}
                                        {!isEditing && !isLinked && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (window.confirm('Delete this journal entry?')) deleteBlock(block.id);
                                                }}
                                                className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-1 text-neutral-300 hover:text-red-500 transition-all"
                                                title="Delete entry"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex-1 flex items-center justify-center p-8">
                    <div className="text-center">
                        <PenLine className="w-8 h-8 text-neutral-300 dark:text-neutral-600 mx-auto mb-2" />
                        <p className="text-xs text-neutral-400">No entries yet</p>
                        <button
                            onClick={() => setShowQuickEntry(true)}
                            className="mt-2 text-[10px] font-bold uppercase tracking-wider transition-colors hover:opacity-80"
                            style={{ color: 'var(--brand-color, #d35400)' }}
                        >
                            + Add your first note
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
