"use client";

import React, { useState, useCallback } from 'react';
import { useDatabaseStore } from '../store';
import { Block } from '../types';
import { PenLine, Plus, Clock, User, ChevronDown, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface JournalCardProps {
    databaseId: string;
    pageId: string;
    /** Optional minimum height. Default: 360px */
    minHeight?: string;
}

/**
 * JournalCard — reusable journal component used in RecordDetailPage and ProjectDetailView.
 * Shows a header with "+ New Entry" button and a chronological list of journal entries.
 * Entries are editable inline: click to edit, blur/Enter to save, Escape to cancel.
 */
export default function JournalCard({ databaseId, pageId, minHeight = '360px' }: JournalCardProps) {
    const page = useDatabaseStore(state =>
        state.databases.find(db => db.id === databaseId)?.pages.find(p => p.id === pageId)
    );
    const updatePageBlocks = useDatabaseStore(state => state.updatePageBlocks);

    const [showQuickEntry, setShowQuickEntry] = useState(false);
    const [quickContent, setQuickContent] = useState('');
    const [showEntries, setShowEntries] = useState(true);
    const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
    const [editDraft, setEditDraft] = useState('');

    const blocks = page?.blocks || [];

    // Get entries that have content (filter out empty paragraphs)
    const contentBlocks = blocks.filter(b => b.content && b.content.trim() !== '');

    const handleAddQuickEntry = useCallback(() => {
        if (!quickContent.trim()) return;

        const newBlock: Block = {
            id: uuidv4(),
            type: 'paragraph',
            content: quickContent.trim(),
            properties: {
                createdAt: new Date().toISOString(),
                author: 'System',
            }
        };

        const existingBlocks = page?.blocks || [];
        // Prepend new entries at the top so newest shows first
        updatePageBlocks(databaseId, pageId, [newBlock, ...existingBlocks]);

        setQuickContent('');
        setShowQuickEntry(false);
    }, [quickContent, page?.blocks, databaseId, pageId, updatePageBlocks]);

    // ── Inline edit handlers ──
    const startEditing = (block: Block) => {
        setEditingBlockId(block.id);
        setEditDraft(block.content || '');
    };

    const saveEdit = useCallback(() => {
        if (!editingBlockId || !page) return;
        const trimmed = editDraft.trim();
        if (!trimmed) {
            // Empty content → delete the block
            const updatedBlocks = blocks.filter(b => b.id !== editingBlockId);
            updatePageBlocks(databaseId, pageId, updatedBlocks);
        } else {
            const updatedBlocks = blocks.map(b =>
                b.id === editingBlockId ? { ...b, content: trimmed } : b
            );
            updatePageBlocks(databaseId, pageId, updatedBlocks);
        }
        setEditingBlockId(null);
        setEditDraft('');
    }, [editingBlockId, editDraft, blocks, databaseId, pageId, updatePageBlocks, page]);

    const cancelEdit = () => {
        setEditingBlockId(null);
        setEditDraft('');
    };

    const deleteBlock = useCallback((blockId: string) => {
        const updatedBlocks = blocks.filter(b => b.id !== blockId);
        updatePageBlocks(databaseId, pageId, updatedBlocks);
    }, [blocks, databaseId, pageId, updatePageBlocks]);

    // Format created timestamp
    const formatEntryDate = (block: Block) => {
        const created = block.properties?.createdAt;
        if (!created) return null;
        try {
            const d = new Date(created as string);
            return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        } catch { return null; }
    };

    return (
        <div
            className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-2xl overflow-hidden flex flex-col shadow-sm"
            style={{ minHeight }}
        >
            {/* Header */}
            <div className="px-5 py-3 border-b border-neutral-200 dark:border-white/10 bg-neutral-50/80 dark:bg-white/5 flex items-center gap-2 font-bold text-[11px] uppercase tracking-widest text-neutral-600 dark:text-neutral-400">
                <PenLine className="w-4 h-4 text-orange-500" /> Journal
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
                    <textarea
                        autoFocus
                        value={quickContent}
                        onChange={(e) => setQuickContent(e.target.value)}
                        placeholder="Write a quick note..."
                        rows={3}
                        className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--brand-color,#d35400)]/30 resize-none font-medium"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAddQuickEntry();
                            if (e.key === 'Escape') setShowQuickEntry(false);
                        }}
                    />
                    <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-neutral-400">⌘+Enter to save</span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowQuickEntry(false)}
                                className="px-3 py-1 rounded-lg text-xs font-bold text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddQuickEntry}
                                disabled={!quickContent.trim()}
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
            {contentBlocks.length > 0 ? (
                <div className="flex-1 overflow-hidden">
                    <button
                        onClick={() => setShowEntries(!showEntries)}
                        className="w-full flex items-center gap-2 px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                    >
                        <ChevronDown className={`w-3 h-3 transition-transform ${showEntries ? '' : '-rotate-90'}`} />
                        {contentBlocks.length} {contentBlocks.length === 1 ? 'entry' : 'entries'}
                    </button>

                    {showEntries && (
                        <div className="max-h-[300px] overflow-y-auto divide-y divide-neutral-100 dark:divide-white/5">
                            {contentBlocks.map(block => {
                                const dateStr = formatEntryDate(block);
                                const author = block.properties?.author as string | undefined;
                                const isEditing = editingBlockId === block.id;

                                return (
                                    <div key={block.id} className="group px-5 py-2.5 flex gap-3 text-sm hover:bg-neutral-50 dark:hover:bg-white/[0.02] transition-colors">
                                        <div className="w-1 rounded-full bg-orange-400/40 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            {isEditing ? (
                                                <textarea
                                                    autoFocus
                                                    value={editDraft}
                                                    onChange={(e) => setEditDraft(e.target.value)}
                                                    onBlur={saveEdit}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); saveEdit(); }
                                                        if (e.key === 'Escape') cancelEdit();
                                                    }}
                                                    className="w-full bg-white dark:bg-neutral-800 border border-orange-300 dark:border-orange-700 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-orange-500/20 resize-none"
                                                    rows={3}
                                                />
                                            ) : (
                                                <p
                                                    className="text-neutral-700 dark:text-neutral-300 text-xs leading-relaxed cursor-pointer hover:text-neutral-900 dark:hover:text-white transition-colors"
                                                    onClick={() => startEditing(block)}
                                                    title="Click to edit"
                                                >
                                                    {block.content}
                                                </p>
                                            )}
                                            <div className="flex items-center gap-3 mt-1">
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
                                        {/* Delete button — visible on hover */}
                                        {!isEditing && (
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

