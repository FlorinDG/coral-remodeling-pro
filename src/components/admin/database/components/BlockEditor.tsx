"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useDatabaseStore } from '../store';
import { Block } from '../types';
import { v4 as uuidv4 } from 'uuid';
import {
    GripVertical, Plus, PenLine,
    Heading1, Heading2, Heading3, List, CheckSquare, Type
} from 'lucide-react';

// ── Slash command menu items ──────────────────────────────────────────────────
const SLASH_COMMANDS: { type: Block['type']; label: string; description: string; icon: React.ReactNode }[] = [
    { type: 'paragraph',          label: 'Text',           description: 'Plain text block',   icon: <Type className="w-4 h-4" /> },
    { type: 'heading_1',          label: 'Heading 1',      description: 'Large section heading', icon: <Heading1 className="w-4 h-4" /> },
    { type: 'heading_2',          label: 'Heading 2',      description: 'Medium heading',     icon: <Heading2 className="w-4 h-4" /> },
    { type: 'heading_3',          label: 'Heading 3',      description: 'Small heading',      icon: <Heading3 className="w-4 h-4" /> },
    { type: 'bulleted_list_item', label: 'Bulleted List',  description: 'Unordered list item', icon: <List className="w-4 h-4" /> },
    { type: 'todo',               label: 'To-do',          description: 'Checkbox item',      icon: <CheckSquare className="w-4 h-4" /> },
];

interface BlockEditorProps {
    databaseId: string;
    pageId: string;
}

export default function BlockEditor({ databaseId, pageId }: BlockEditorProps) {
    const updatePageBlocks = useDatabaseStore(state => state.updatePageBlocks);
    const database = useDatabaseStore(state => state.databases.find(db => db.id === databaseId));
    const page = database?.pages.find(p => p.id === pageId);

    const blocks = page?.blocks || [];

    // ── Slash command state ───────────────────────────────────────────────────
    const [slashMenu, setSlashMenu] = useState<{ blockId: string; filter: string; top: number; left: number } | null>(null);
    const [slashIndex, setSlashIndex] = useState(0);
    const [showOnboarding, setShowOnboarding] = useState(true);

    // Filtered slash commands based on typed filter
    const filteredCommands = slashMenu
        ? SLASH_COMMANDS.filter(c => c.label.toLowerCase().includes(slashMenu.filter.toLowerCase()))
        : [];

    // Reset index when filter changes
    useEffect(() => { setSlashIndex(0); }, [slashMenu?.filter]);

    // Close slash menu on outside click
    useEffect(() => {
        if (!slashMenu) return;
        const handler = () => setSlashMenu(null);
        document.addEventListener('click', handler);
        return () => document.removeEventListener('click', handler);
    }, [slashMenu]);

    // Ensure at least one empty block exists
    useEffect(() => {
        if (blocks.length === 0 && !showOnboarding) {
            updatePageBlocks(databaseId, pageId, [{ id: uuidv4(), type: 'paragraph', content: '' }]);
        }
    }, [blocks.length, databaseId, pageId, updatePageBlocks, showOnboarding]);

    if (!database || !page) return null;

    const updateBlock = (blockId: string, content: string) => {
        const newBlocks = blocks.map(b => b.id === blockId ? { ...b, content } : b);
        updatePageBlocks(databaseId, pageId, newBlocks);
    };

    const changeBlockType = (blockId: string, type: Block['type']) => {
        const newBlocks = blocks.map(b => b.id === blockId ? { ...b, type, content: '' } : b);
        updatePageBlocks(databaseId, pageId, newBlocks);
        setSlashMenu(null);
        // Refocus the block
        setTimeout(() => {
            const el = document.getElementById(`block-${blockId}`);
            if (el) el.focus();
        }, 50);
    };

    const addBlock = (afterId: string, type: Block['type'] = 'paragraph') => {
        const index = blocks.findIndex(b => b.id === afterId);
        const newBlock: Block = { id: uuidv4(), type, content: '' };
        const newBlocks = [...blocks];
        newBlocks.splice(index + 1, 0, newBlock);
        updatePageBlocks(databaseId, pageId, newBlocks);
        setTimeout(() => {
            const el = document.getElementById(`block-${newBlock.id}`);
            if (el) el.focus();
        }, 50);
    };

    const deleteBlock = (blockId: string) => {
        if (blocks.length === 1) {
            updateBlock(blocks[0].id, '');
            return;
        }
        const index = blocks.findIndex(b => b.id === blockId);
        const previousBlock = blocks[index - 1];
        const newBlocks = blocks.filter(b => b.id !== blockId);
        updatePageBlocks(databaseId, pageId, newBlocks);
        if (previousBlock) {
            setTimeout(() => {
                const el = document.getElementById(`block-${previousBlock.id}`) as HTMLTextAreaElement;
                if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
            }, 50);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, block: Block) => {
        // Slash menu keyboard navigation
        if (slashMenu && slashMenu.blockId === block.id) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSlashIndex(i => Math.min(i + 1, filteredCommands.length - 1));
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSlashIndex(i => Math.max(i - 1, 0));
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                if (filteredCommands[slashIndex]) {
                    changeBlockType(block.id, filteredCommands[slashIndex].type);
                }
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                setSlashMenu(null);
                return;
            }
        }

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            // Lists and todos: if content is empty, revert to paragraph (exit list)
            // Otherwise, create next item of the same type
            const continuableTypes: Block['type'][] = ['bulleted_list_item', 'todo'];
            if (continuableTypes.includes(block.type)) {
                if (block.content === '') {
                    // Empty list item → revert to paragraph (exit the list)
                    const newBlocks = blocks.map(b => b.id === block.id ? { ...b, type: 'paragraph' as const } : b);
                    updatePageBlocks(databaseId, pageId, newBlocks);
                } else {
                    addBlock(block.id, block.type);
                }
            } else {
                addBlock(block.id);
            }
        } else if (e.key === 'Backspace' && block.content === '') {
            e.preventDefault();
            deleteBlock(block.id);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>, block: Block) => {
        // Automatically adjust height
        e.target.style.height = 'auto';
        e.target.style.height = e.target.scrollHeight + 'px';

        const val = e.target.value;

        // ── Slash command detection ──
        // Check if value starts with "/" (user just typed slash)
        if (val === '/') {
            const rect = e.target.getBoundingClientRect();
            setSlashMenu({ blockId: block.id, filter: '', top: rect.bottom + 4, left: rect.left });
            updateBlock(block.id, val);
            return;
        }
        // If slash menu is open and typing continues after "/"
        if (slashMenu && slashMenu.blockId === block.id && val.startsWith('/')) {
            setSlashMenu({ ...slashMenu, filter: val.slice(1) });
            updateBlock(block.id, val);
            return;
        }
        // Close slash menu if "/" was removed
        if (slashMenu && slashMenu.blockId === block.id && !val.startsWith('/')) {
            setSlashMenu(null);
        }

        // Basic markdown shortcuts
        if (val === '# ' && block.type !== 'heading_1') {
            const newBlocks = blocks.map(b => b.id === block.id ? { ...b, type: 'heading_1' as const, content: '' } : b);
            updatePageBlocks(databaseId, pageId, newBlocks);
            return;
        } else if (val === '## ' && block.type !== 'heading_2') {
            const newBlocks = blocks.map(b => b.id === block.id ? { ...b, type: 'heading_2' as const, content: '' } : b);
            updatePageBlocks(databaseId, pageId, newBlocks);
            return;
        } else if (val === '### ' && block.type !== 'heading_3') {
            const newBlocks = blocks.map(b => b.id === block.id ? { ...b, type: 'heading_3' as const, content: '' } : b);
            updatePageBlocks(databaseId, pageId, newBlocks);
            return;
        } else if (val === '- ' || val === '* ') {
            const newBlocks = blocks.map(b => b.id === block.id ? { ...b, type: 'bulleted_list_item' as const, content: '' } : b);
            updatePageBlocks(databaseId, pageId, newBlocks);
            return;
        } else if (val === '[] ') {
            const newBlocks = blocks.map(b => b.id === block.id ? { ...b, type: 'todo' as const, content: '' } : b);
            updatePageBlocks(databaseId, pageId, newBlocks);
            return;
        }

        updateBlock(block.id, val);
    };

    const startJournal = () => {
        setShowOnboarding(false);
        updatePageBlocks(databaseId, pageId, [{ id: uuidv4(), type: 'paragraph', content: '' }]);
        setTimeout(() => {
            const firstBlock = document.querySelector<HTMLTextAreaElement>('[id^="block-"]');
            if (firstBlock) firstBlock.focus();
        }, 100);
    };

    // ── Journal onboarding placeholder ────────────────────────────────────────
    if (blocks.length === 0 && showOnboarding) {
        return (
            <div className="w-full flex flex-col items-center justify-center py-20 px-8">
                <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
                    style={{
                        backgroundColor: 'color-mix(in srgb, var(--brand-color, #d35400) 10%, transparent)',
                        border: '1px solid color-mix(in srgb, var(--brand-color, #d35400) 25%, transparent)',
                    }}
                >
                    <PenLine className="w-8 h-8" style={{ color: 'var(--brand-color, #d35400)' }} />
                </div>
                <h3 className="text-xl font-bold tracking-tight mb-2 text-neutral-900 dark:text-white">
                    Start your project journal
                </h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-sm text-center mb-6 leading-relaxed">
                    Add notes, checklists, and documentation for this record. Use it to track progress, decisions, and ideas.
                </p>
                <ul className="text-xs text-neutral-400 dark:text-neutral-500 space-y-2 mb-8">
                    <li className="flex items-center gap-2"><span className="text-neutral-300">📝</span> Progress notes &amp; meeting summaries</li>
                    <li className="flex items-center gap-2"><span className="text-neutral-300">✅</span> Task checklists &amp; action items</li>
                    <li className="flex items-center gap-2"><span className="text-neutral-300">💡</span> Key decisions &amp; design rationale</li>
                </ul>
                <button
                    onClick={startJournal}
                    className="px-5 py-2.5 rounded-lg text-white text-sm font-bold hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: 'var(--brand-color, #d35400)' }}
                >
                    Start Writing
                </button>
            </div>
        );
    }

    const renderBlockInput = (block: Block) => {
        let className = "w-full outline-none bg-transparent resize-none leading-relaxed transition-colors placeholder:text-neutral-300 dark:placeholder:text-neutral-700 ";

        if (block.type === 'heading_1') className += "text-3xl font-bold mt-6 mb-2";
        else if (block.type === 'heading_2') className += "text-2xl font-semibold mt-5 mb-1";
        else if (block.type === 'heading_3') className += "text-xl font-medium mt-4 mb-1";
        else className += "text-base py-1 text-neutral-800 dark:text-neutral-200";

        return (
            <div key={block.id} className="group relative flex items-start gap-2 -ml-8">
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pt-1.5 w-8">
                    <button
                        onClick={() => addBlock(block.id)}
                        className="text-neutral-300 hover:text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded p-0.5"
                    >
                        <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button className="text-neutral-300 hover:text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded p-0.5 cursor-grab active:cursor-grabbing">
                        <GripVertical className="w-3.5 h-3.5" />
                    </button>
                </div>

                <div className="flex-1 relative">
                    {/* Prefix for lists/todos */}
                    {block.type === 'bulleted_list_item' && <span className="absolute left-[-16px] top-[4px] text-neutral-500">•</span>}
                    {block.type === 'todo' && <input type="checkbox" className="absolute left-[-20px] top-[7px]" />}

                    <textarea
                        id={`block-${block.id}`}
                        className={className}
                        value={block.content}
                        placeholder={block.type === 'heading_1' ? "Heading 1" : "Type '/' for commands"}
                        onChange={(e) => handleChange(e, block)}
                        onKeyDown={(e) => handleKeyDown(e, block)}
                        rows={1}
                        style={{ minHeight: '1.5em' }}
                    />
                </div>
            </div>
        );
    };

    return (
        <div className="w-full flex flex-col gap-0.5 ml-8 pr-8 pb-32 relative">
            {blocks.map(renderBlockInput)}

            {/* ── Slash command floating menu ─────────────────────────────── */}
            {slashMenu && filteredCommands.length > 0 && (
                <div
                    className="fixed z-50 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-xl shadow-xl py-1.5 w-64 max-h-72 overflow-y-auto"
                    style={{ top: slashMenu.top, left: slashMenu.left }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                        Blocks
                    </div>
                    {filteredCommands.map((cmd, i) => (
                        <button
                            key={cmd.type}
                            onMouseDown={(e) => {
                                e.preventDefault();
                                changeBlockType(slashMenu.blockId, cmd.type);
                            }}
                            onMouseEnter={() => setSlashIndex(i)}
                            className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                                i === slashIndex
                                    ? 'bg-neutral-100 dark:bg-white/10'
                                    : 'hover:bg-neutral-50 dark:hover:bg-white/5'
                            }`}
                        >
                            <div className="w-8 h-8 rounded-lg border border-neutral-200 dark:border-white/10 flex items-center justify-center text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-white/5">
                                {cmd.icon}
                            </div>
                            <div>
                                <p className="text-sm font-medium text-neutral-900 dark:text-white">{cmd.label}</p>
                                <p className="text-[11px] text-neutral-400">{cmd.description}</p>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
