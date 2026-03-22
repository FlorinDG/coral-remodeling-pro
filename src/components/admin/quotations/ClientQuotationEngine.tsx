"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDatabaseStore } from '@/components/admin/database/store';
import { ArrowLeft, User, Briefcase, FileText } from 'lucide-react';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import { Page, Block, BlockType } from '@/components/admin/database/types';
import QuotationRow from './QuotationRow'; // Assuming QuotationRow is a sibling component
import QuotationFooterReport from './QuotationFooterReport';

export default function ClientQuotationEngine({ id, locale }: { id: string, locale: string }) {
    const router = useRouter();
    const getDatabase = useDatabaseStore(state => state.getDatabase);
    const updatePageBlocks = useDatabaseStore(state => state.updatePageBlocks);
    const updatePageProperty = useDatabaseStore(state => state.updatePageProperty);

    const [isHydrated, setIsHydrated] = useState(false);

    useEffect(() => {
        useDatabaseStore.persist.onFinishHydration(() => setIsHydrated(true));
        setIsHydrated(useDatabaseStore.persist?.hasHydrated() || false);
    }, []);

    // Reactive subscription to the specific quotation page directly in Zustand
    const quotation = useDatabaseStore(state => {
        const db = state.databases.find(d => d.id === 'db-quotations');
        return db?.pages.find(p => p.id === id) || null;
    });

    if (!isHydrated) return <div className="flex h-screen items-center justify-center">Loading Engine...</div>;
    if (!quotation) return <div className="flex h-screen items-center justify-center flex-col gap-4"><h1>Quotation Not Found</h1><button onClick={() => router.back()} className="text-blue-500">Go Back</button></div>;

    const quotationTitle = quotation.properties?.['title'] || 'Draft Quotation';
    const clientId = (quotation.properties?.['client'] as string) || '';
    const projectId = (quotation.properties?.['project'] as string) || '';
    const betreft = (quotation.properties?.['betreft'] as string) || '';

    const blocks = quotation.blocks || [];

    const handleUpdateBlock = (blockId: string, updates: Partial<Block>) => {
        const newBlocks = blocks.map(b => b.id === blockId ? { ...b, ...updates } : b);
        updatePageBlocks('db-quotations', id, newBlocks);
    };

    const handleDragEnd = (result: any) => {
        if (!result.destination) return;

        const { source, destination, draggableId } = result;

        if (source.droppableId === destination.droppableId && source.index === destination.index) {
            return;
        }

        // Deep clone tree to execute physical refactoring
        const newBlocks = JSON.parse(JSON.stringify(blocks)) as Block[];

        // Phase 11: Recursive Extractor
        let movedBlock: Block | null = null;
        const extractNode = (nodes: Block[]) => {
            for (let i = 0; i < nodes.length; i++) {
                if (nodes[i].id === draggableId) {
                    movedBlock = nodes.splice(i, 1)[0];
                    return true;
                }
                if (nodes[i].children && extractNode(nodes[i].children!)) return true;
            }
            return false;
        };

        // Phase 11: Recursive Injector
        const insertNode = (nodes: Block[], parentId: string) => {
            if (parentId === 'root') {
                nodes.splice(destination.index, 0, movedBlock!);
                return true;
            }
            for (let i = 0; i < nodes.length; i++) {
                if (nodes[i].id === parentId) {
                    nodes[i].children = nodes[i].children || [];
                    nodes[i].children!.splice(destination.index, 0, movedBlock!);
                    return true;
                }
                if (nodes[i].children && insertNode(nodes[i].children!, parentId)) return true;
            }
            return false;
        };

        extractNode(newBlocks);
        if (movedBlock) {
            insertNode(newBlocks, destination.droppableId);
            updatePageBlocks('db-quotations', id, newBlocks);
        }
    };

    const handleDeleteBlock = (blockId: string) => {
        const newBlocks = blocks.filter(b => b.id !== blockId);
        updatePageBlocks('db-quotations', id, newBlocks);
    };

    const handleDuplicateBlock = (blockId: string) => {
        const blockToDuplicate = blocks.find(b => b.id === blockId);
        if (!blockToDuplicate) return;

        const newBlock: Block = { ...blockToDuplicate, id: crypto.randomUUID() };
        const index = blocks.findIndex(b => b.id === blockId);

        const newBlocks = [...blocks];
        newBlocks.splice(index + 1, 0, newBlock);

        updatePageBlocks('db-quotations', id, newBlocks);
    };

    const handleAddBlock = (type: Block['type'] = 'line') => {
        const newBlock: Block = { id: crypto.randomUUID(), type, content: '' };
        updatePageBlocks('db-quotations', id, [...blocks, newBlock]);
    };

    const handleUpdateProperty = (key: string, value: any) => {
        if (!quotation) return;
        updatePageProperty('db-quotations', quotation.id, key, value);
    };

    // Deep recursive total calculation mapping for all mathematical block mutations
    const calculateGrandTotal = (nodes: Block[]): number => {
        return nodes.reduce((sum, block) => {
            if (block.isOptional) return sum; // Phase 10: Ignore optional blocks globally

            if (block.type === 'section' || block.type === 'subsection' || block.type === 'post') {
                return sum + calculateGrandTotal(block.children || []);
            }
            return sum + ((block.verkoopPrice || 0) * (block.quantity || 1));
        }, 0);
    };

    const grandTotal = calculateGrandTotal(blocks);

    return (
        <div className="flex flex-col w-full h-full bg-white dark:bg-[#0p0p0p] text-neutral-900 dark:text-white">
            {/* Header Controls */}
            <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-white/10 shrink-0">
                <div className="flex items-center gap-4 min-w-0">
                    <button
                        onClick={() => router.back()}
                        className="p-2 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-md transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-neutral-500" />
                    </button>
                    <div className="flex flex-col">
                        <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white line-clamp-1">{betreft || 'Draft Quotation'}</h1>
                        <p className="text-xs text-neutral-500 font-mono tracking-wider">
                            OFFERTE {quotationTitle}
                        </p>
                    </div>
                </div>

                {/* Central Selectors */}
                <div className="flex-1 flex items-center justify-center gap-3 px-4">
                    {/* Placeholder for Client Selection */}
                    <div className="flex items-center gap-1.5 bg-neutral-100 dark:bg-white/5 px-3 py-1.5 rounded-md cursor-pointer hover:bg-neutral-200 dark:hover:bg-white/10 transition-colors border border-transparent dark:border-white/5">
                        <User className="w-4 h-4 text-neutral-500" />
                        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                            {clientId ? 'Client Relation Linked' : 'Selecteer Klant (Client)...'}
                        </span>
                    </div>

                    {/* Placeholder for Project Selection */}
                    <div className="flex items-center gap-1.5 bg-neutral-100 dark:bg-white/5 px-3 py-1.5 rounded-md cursor-pointer hover:bg-neutral-200 dark:hover:bg-white/10 transition-colors border border-transparent dark:border-white/5">
                        <Briefcase className="w-4 h-4 text-neutral-500" />
                        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                            {projectId ? 'Project Linked' : 'Koppel Project (Optioneel)'}
                        </span>
                    </div>
                </div>

                {/* Mathematical Global Output Frame */}
                <div className="flex flex-col items-end px-4 min-w-max">
                    <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-0.5">Grand Total</span>
                    <span className="text-2xl font-black tracking-tighter text-blue-600 dark:text-blue-400 leading-none">
                        €{grandTotal.toFixed(2)}
                    </span>
                </div>
            </div>

            {/* Main Canvas Workspace */}
            <div className="flex-1 overflow-y-auto p-2 sm:p-4 relative bg-neutral-50/50 dark:bg-[#0p0p0p]">
                <div className="w-full max-w-[1400px] mx-auto flex flex-col gap-1 pb-32">

                    {/* Betreft (Subject) Input */}
                    <div className="w-full mb-6 mt-2 flex flex-col gap-2 p-6 bg-white dark:bg-[#111] rounded-xl border border-neutral-200 dark:border-white/10 shadow-sm shrink-0">
                        <label className="text-xs uppercase tracking-widest font-bold text-neutral-400">Betreft / Object</label>
                        <input
                            type="text"
                            value={betreft}
                            onChange={(e) => handleUpdateProperty('betreft', e.target.value)}
                            placeholder="e.g. Volledig badkamer renovatie incl. sanitair..."
                            className="w-full text-2xl md:text-3xl font-bold bg-transparent border-none outline-none focus:ring-0 placeholder:text-neutral-300 dark:placeholder:text-neutral-700 py-2 border-b-2 border-transparent focus:border-blue-500 transition-colors"
                        />
                    </div>

                    {/* Mathematical Blocks */}
                    <DragDropContext onDragEnd={handleDragEnd}>
                        <Droppable droppableId="root" type="block">
                            {(provided) => (
                                <div
                                    {...provided.droppableProps}
                                    ref={provided.innerRef}
                                    className="flex flex-col gap-1 w-full"
                                >
                                    {blocks.map((block, index) => (
                                        <QuotationRow
                                            key={block.id}
                                            block={block}
                                            index={index}
                                            onUpdate={handleUpdateBlock}
                                            onDelete={handleDeleteBlock}
                                            onDuplicate={handleDuplicateBlock}
                                        />
                                    ))}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    </DragDropContext>

                    <div className="flex items-center gap-2 mt-2">
                        <button
                            onClick={() => handleAddBlock('section')}
                            className="text-white bg-orange-600 hover:bg-orange-700 dark:bg-orange-600 dark:hover:bg-orange-500 text-xs font-semibold flex items-center gap-1 transition-colors py-1.5 px-3 rounded shadow-sm"
                        >
                            <span className="text-sm leading-none">+</span> Add Section
                        </button>
                        <button
                            onClick={() => handleAddBlock('line')}
                            className="text-neutral-700 bg-white border border-neutral-200 hover:bg-neutral-50 dark:bg-[#222] dark:border-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-800 text-xs font-semibold flex items-center gap-1 transition-colors py-1.5 px-3 rounded shadow-sm"
                        >
                            <span className="text-sm leading-none">+</span> Add Line
                        </button>
                    </div>

                    {/* Phase 10: Profitability Engine & Signature Block */}
                    <QuotationFooterReport blocks={blocks} />

                </div>
            </div>
        </div>
    );
}
