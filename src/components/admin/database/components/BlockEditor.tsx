"use client";

import React, { useRef, useEffect, useState } from 'react';
import { useDatabaseStore } from '../store';
import { Block } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { GripVertical, Plus } from 'lucide-react';

interface BlockEditorProps {
    databaseId: string;
    pageId: string;
}

export default function BlockEditor({ databaseId, pageId }: BlockEditorProps) {
    const updatePageBlocks = useDatabaseStore(state => state.updatePageBlocks);
    const database = useDatabaseStore(state => state.databases.find(db => db.id === databaseId));
    const page = database?.pages.find(p => p.id === pageId);

    const blocks = page?.blocks || [];

    // Ensure at least one empty block exists
    useEffect(() => {
        if (blocks.length === 0) {
            updatePageBlocks(databaseId, pageId, [{ id: uuidv4(), type: 'paragraph', content: '' }]);
        }
    }, [blocks.length, databaseId, pageId, updatePageBlocks]);

    if (!database || !page) return null;

    const updateBlock = (blockId: string, content: string) => {
        const newBlocks = blocks.map(b => b.id === blockId ? { ...b, content } : b);
        updatePageBlocks(databaseId, pageId, newBlocks);
    };

    const addBlock = (afterId: string, type: Block['type'] = 'paragraph') => {
        const index = blocks.findIndex(b => b.id === afterId);
        const newBlock: Block = { id: uuidv4(), type, content: '' };
        const newBlocks = [...blocks];
        newBlocks.splice(index + 1, 0, newBlock);
        updatePageBlocks(databaseId, pageId, newBlocks);

        // Focus the new block using a small delay to let React render
        setTimeout(() => {
            const el = document.getElementById(`block-${newBlock.id}`);
            if (el) el.focus();
        }, 50);
    };

    const deleteBlock = (blockId: string) => {
        if (blocks.length === 1) {
            updateBlock(blocks[0].id, ''); // Just clear it
            return;
        }

        const index = blocks.findIndex(b => b.id === blockId);
        const previousBlock = blocks[index - 1];

        const newBlocks = blocks.filter(b => b.id !== blockId);
        updatePageBlocks(databaseId, pageId, newBlocks);

        if (previousBlock) {
            setTimeout(() => {
                const el = document.getElementById(`block-${previousBlock.id}`) as HTMLTextAreaElement;
                if (el) {
                    el.focus();
                    el.setSelectionRange(el.value.length, el.value.length);
                }
            }, 50);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, block: Block) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            addBlock(block.id);
        } else if (e.key === 'Backspace' && block.content === '') {
            e.preventDefault();
            deleteBlock(block.id);
        }
    };

    const renderBlockInput = (block: Block) => {
        let className = "w-full outline-none bg-transparent resize-none leading-relaxed transition-colors placeholder:text-neutral-300 dark:placeholder:text-neutral-700 ";

        if (block.type === 'heading_1') className += "text-3xl font-bold mt-6 mb-2";
        else if (block.type === 'heading_2') className += "text-2xl font-semibold mt-5 mb-1";
        else if (block.type === 'heading_3') className += "text-xl font-medium mt-4 mb-1";
        else className += "text-base py-1 text-neutral-800 dark:text-neutral-200";

        return (
            <div key={block.id} className="group relative flex items-start gap-2 -ml-8">
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pt-1.5 w-8">
                    <button className="text-neutral-300 hover:text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded p-0.5">
                        <Plus className="w-3.5 h-3.5" onClick={() => addBlock(block.id)} />
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
                        onChange={(e) => {
                            // Automatically adjust height
                            e.target.style.height = 'auto';
                            e.target.style.height = e.target.scrollHeight + 'px';

                            // Basic markdown detection
                            const val = e.target.value;
                            if (val === '# ' && block.type !== 'heading_1') {
                                const newBlocks = blocks.map(b => b.id === block.id ? { ...b, type: 'heading_1' as const, content: '' } : b);
                                updatePageBlocks(databaseId, pageId, newBlocks);
                                return;
                            } else if (val === '## ' && block.type !== 'heading_2') {
                                const newBlocks = blocks.map(b => b.id === block.id ? { ...b, type: 'heading_2' as const, content: '' } : b);
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
                        }}
                        onKeyDown={(e) => handleKeyDown(e, block)}
                        rows={1}
                        style={{ minHeight: '1.5em' }}
                    />
                </div>
            </div>
        );
    };

    return (
        <div className="w-full flex flex-col gap-0.5 ml-8 pr-8 pb-32">
            {blocks.map(renderBlockInput)}
        </div>
    );
}
