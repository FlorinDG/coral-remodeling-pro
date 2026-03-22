import React, { useState } from 'react';
import { Block, BlockType } from '@/components/admin/database/types';
import { MoreVertical, Folder, FolderOpen, AlertCircle, PlaySquare, Calculator, Search, AlignLeft, Text, Box, Tag, Zap, Database, Layers, CheckSquare, ListTodo, Plus, ChevronDown, ChevronRight, FileMinus, FileText, Settings, Image as ImageIcon, Video, File, Hash, MousePointerClick, Calendar, User, ToggleLeft, ArrowRightSquare, Table, Ban, CircleDollarSign, Percent, Grid, ArrowDownToLine, ArrowUpToLine, Wand2, Copy, Link, Shield, Lock, FileBox, GripVertical, Type, Maximize2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/time-tracker/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/time-tracker/components/ui/dialog';
import FinancialRowRenderer from './FinancialRowRenderer';
import { Draggable, Droppable } from '@hello-pangea/dnd';
import { useDatabaseStore } from '@/components/admin/database/store';

interface QuotationRowProps {
    block: Block;
    index: number;
    onUpdate: (id: string, updates: Partial<Block>) => void;
    onDelete: (id: string) => void;
    onDuplicate: (id: string) => void;
}

export default function QuotationRow({ block, index, onUpdate, onDelete, onDuplicate }: QuotationRowProps) {
    const [isExpanded, setIsExpanded] = useState(true);
    const [isPostModalOpen, setIsPostModalOpen] = useState(false);

    const getTypeIcon = (type: BlockType) => {
        switch (type) {
            case 'text': return <Type className="w-4 h-4 text-blue-500" />;
            case 'image': return <ImageIcon className="w-4 h-4 text-emerald-500" />;
            case 'article': return <Box className="w-4 h-4 text-amber-500" />;
            case 'bestek': return <Layers className="w-4 h-4 text-purple-500" />;
            case 'section': return <Folder className="w-4 h-4 text-blue-600" />;
            case 'subsection': return <FolderOpen className="w-4 h-4 text-blue-400" />;
            case 'line': return <FileMinus className="w-4 h-4 text-amber-600" />;
            case 'post': return <AlignLeft className="w-4 h-4 text-rose-500" />;
            default: return <Type className="w-4 h-4 text-neutral-400" />;
        }
    };

    const getTypeLabel = (type: BlockType) => {
        switch (type) {
            case 'text': return 'Text Block';
            case 'image': return 'Image Insert';
            case 'article': return 'Single Article';
            case 'bestek': return 'Single Bestek';
            case 'section': return 'Section Container';
            case 'subsection': return 'Subsection Engine';
            case 'line': return 'Calculation Line';
            case 'post': return 'Post (Phase)';
            default: return 'Text Block';
        }
    };

    // Recursive calculation for nested Phase (Post/Section) totals
    const calculateBlockTotal = (b: Block): number => {
        if (b.isOptional) return 0; // Phase 10: Globally drop any optional value
        if (b.type === 'post' || b.type === 'section' || b.type === 'subsection') {
            return (b.children || []).reduce((sum, child) => sum + calculateBlockTotal(child), 0);
        }
        return (b.verkoopPrice || 0) * (b.quantity || 1);
    };

    // Handlers for recursively nested children updates (preventing root pollution)
    const handleChildUpdate = (childId: string, updates: Partial<Block>) => {
        const newChildren = (block.children || []).map(c => c.id === childId ? { ...c, ...updates } : c);
        onUpdate(block.id, { children: newChildren });
    };

    const handleChildDelete = (childId: string) => {
        const newChildren = (block.children || []).filter(c => c.id !== childId);
        onUpdate(block.id, { children: newChildren });
    };

    const handleChildDuplicate = (childId: string) => {
        const children = block.children || [];
        const index = children.findIndex(c => c.id === childId);
        if (index === -1) return;
        const newChild = { ...children[index], id: crypto.randomUUID() };
        const newChildren = [...children];
        newChildren.splice(index + 1, 0, newChild);
        onUpdate(block.id, { children: newChildren });
    };

    const handleAddChild = (forcedType: BlockType = 'line') => {
        const newChild: Block = { id: crypto.randomUUID(), type: forcedType, content: '' };
        onUpdate(block.id, { children: [...(block.children || []), newChild] });
        if (!isExpanded) setIsExpanded(true); // Auto-expand when pushing new children
    };

    const isContainer = block.type === 'section' || block.type === 'subsection' || block.type === 'post';
    const sectionHeaderColor = block.type === 'section' ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10' : block.type === 'subsection' ? 'border-purple-400 bg-purple-50/30 dark:bg-purple-900/10' : 'border-neutral-300 dark:border-neutral-700 bg-black/5 dark:bg-white/5';

    return (
        <>
            <Draggable draggableId={block.id} index={index}>
                {(provided, snapshot) => (
                    <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`group relative flex items-start w-full transition-all p-2 rounded-lg -mx-2 
                        ${block.isOptional ? 'opacity-50 grayscale' : ''} 
                        ${!isContainer ? 'even:bg-neutral-50/80 dark:even:bg-white/5 odd:bg-transparent' : ''}
                        ${snapshot.isDragging ? 'z-50 shadow-2xl bg-white dark:bg-neutral-900 border border-orange-500' : ''}
                    `}
                    >

                        {/* Type Icon & Operations Column */}
                        <div className="flex-shrink-0 w-8 flex flex-col items-center pt-1.5 gap-2" title={getTypeLabel(block.type)}>
                            {getTypeIcon(block.type)}
                            <div className="flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pb-2">
                                <div
                                    {...provided.dragHandleProps}
                                    className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-grab active:cursor-grabbing hover:bg-black/5 dark:hover:bg-white/5 rounded"
                                >
                                    <GripVertical className="w-4 h-4" />
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-black/5 dark:hover:bg-white/5 rounded">
                                            <MoreVertical className="w-4 h-4" />
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="w-56 z-[100]">
                                        <div className="px-2 py-1.5 text-xs font-semibold text-neutral-500">Transform Matrix Target</div>

                                        <DropdownMenuItem onClick={() => onUpdate(block.id, { type: 'section' })}>
                                            <Folder className="w-4 h-4 mr-2" /> Section Parent
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onUpdate(block.id, { type: 'subsection' })}>
                                            <FolderOpen className="w-4 h-4 mr-2" /> Subsection Parent
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />

                                        <DropdownMenuItem onClick={() => onUpdate(block.id, { type: 'post' })}>
                                            <AlignLeft className="w-4 h-4 mr-2" /> Bestek Post (Container)
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onUpdate(block.id, { type: 'article' })}>
                                            <Box className="w-4 h-4 mr-2" /> Calculator Article
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onUpdate(block.id, { type: 'text' })}>
                                            <Text className="w-4 h-4 mr-2" /> Rich Text Notes
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onUpdate(block.id, { type: 'image' })}>
                                            <ImageIcon className="w-4 h-4 mr-2" /> Image Attachment
                                        </DropdownMenuItem>

                                        <DropdownMenuSeparator />

                                        {/* Optional Matrix Override */}
                                        <DropdownMenuItem onClick={() => onUpdate(block.id, { isOptional: !block.isOptional })}>
                                            <Ban className={`w-4 h-4 mr-2 ${block.isOptional ? 'text-blue-500' : ''}`} />
                                            {block.isOptional ? 'Mark as Required' : 'Mark as Optional'}
                                        </DropdownMenuItem>

                                        <DropdownMenuSeparator />

                                        <DropdownMenuItem onClick={() => onDuplicate(block.id)}>Duplicate Block</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onDelete(block.id)} className="text-red-500">Delete Block</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>

                        {/* Main Content Area */}
                        <div className="flex-1 min-w-0">
                            {block.type === 'text' && (
                                <input
                                    type="text"
                                    placeholder="Type anything..."
                                    value={block.content || ''}
                                    onChange={(e) => onUpdate(block.id, { content: e.target.value })}
                                    className="w-full bg-transparent border-none outline-none focus:ring-0 text-base py-1 placeholder:text-neutral-400"
                                />
                            )}

                            {/* --- Block Container / Header --- */}
                            {isContainer && (
                                <div
                                    className={`flex items-center justify-between transition-colors w-full
                        ${block.type === 'section' ? 'p-2 bg-orange-50/50 dark:bg-orange-900/10 border-b border-orange-200 dark:border-orange-800 hover:bg-orange-100/50 dark:hover:bg-orange-900/20' : ''}
                        ${block.type === 'subsection' ? 'p-1.5 bg-orange-50/20 dark:bg-orange-900/5 border-b border-orange-100 dark:border-orange-800/50 hover:bg-orange-100/30' : ''}
                        ${block.type === 'post' ? 'p-1.5 bg-neutral-50 dark:bg-white/5 border-b border-neutral-100 dark:border-neutral-800' : ''}
                    `}
                                >
                                    <div className="flex items-center gap-2 flex-1">
                                        <button
                                            onClick={() => block.type === 'post' ? setIsPostModalOpen(true) : setIsExpanded(!isExpanded)}
                                            title={block.type === 'post' ? 'Open Post Editor Modal' : 'Toggle Expand'}
                                            className={`p-1 rounded transition-colors ${block.type === 'post' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 hover:bg-orange-200 shadow-sm' : 'hover:bg-black/5 dark:hover:bg-white/10'}`}
                                        >
                                            {block.type === 'post' ? (
                                                <Maximize2 className="w-4 h-4" />
                                            ) : (
                                                isExpanded ? <ChevronDown className="w-4 h-4 text-neutral-500" /> : <ChevronRight className="w-4 h-4 text-neutral-500" />
                                            )}
                                        </button>

                                        {block.type === 'post' ? (
                                            <div className="flex-1 max-w-2xl relative">
                                                {/* Bestek Post search input directly querying dynamic db-bestek names */}
                                                <input
                                                    type="text"
                                                    list={`list-post-${block.id}`}
                                                    placeholder="Search Bestek Data..."
                                                    value={block.content || ''}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        const db = useDatabaseStore.getState().getDatabase('db-bestek');
                                                        if (db) {
                                                            const nameProp = db.properties.find((p: any) => ['naam', 'titel', 'title', 'name'].includes(p.name.toLowerCase()));
                                                            const namePropId = nameProp?.id || 'title';
                                                            const matched = db.pages.find((p: any) => String(p.properties[namePropId]) === val);
                                                            onUpdate(block.id, { content: val, bestekId: matched?.id });
                                                        } else {
                                                            onUpdate(block.id, { content: val });
                                                        }
                                                    }}
                                                    className={`bg-transparent border-none outline-none w-full font-semibold placeholder:font-normal placeholder:opacity-50 text-black dark:text-white text-sm`}
                                                />
                                                <datalist id={`list-post-${block.id}`}>
                                                    {(() => {
                                                        const db = useDatabaseStore.getState().getDatabase('db-bestek');
                                                        if (!db) return null;
                                                        const nameProp = db.properties.find((p: any) => ['naam', 'titel', 'title', 'name'].includes(p.name.toLowerCase()));
                                                        const namePropId = nameProp?.id || 'title';
                                                        return db.pages.map((p: any) => <option key={p.id} value={String(p.properties[namePropId] || 'Untitled')} />);
                                                    })()}
                                                </datalist>
                                            </div>
                                        ) : (
                                            <input
                                                type="text"
                                                placeholder={`${block.type.charAt(0).toUpperCase() + block.type.slice(1)} Title...`}
                                                value={block.content || ''}
                                                onChange={(e) => onUpdate(block.id, { content: e.target.value })}
                                                className={`bg-transparent border-none outline-none flex-1 font-semibold placeholder:font-normal placeholder:opacity-50 text-black dark:text-white
                                        ${block.type === 'section' ? 'text-lg' : ''}
                                        ${block.type === 'subsection' ? 'text-base' : ''}
                                    `}
                                            />
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        {/* Recursive Line Margin Mapping Engine */}
                                        <div className="flex flex-col items-end px-4">
                                            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest leading-none mb-1">Total Limit</span>
                                            <span className={`font-bold tabular-nums leading-none ${block.isOptional ? 'line-through text-neutral-400' : 'text-neutral-900 dark:text-white'}`}>
                                                €{calculateBlockTotal(block).toFixed(2)}
                                            </span>
                                        </div>
                                        {/* Context menu is now in the left gutter */}
                                    </div>
                                </div>
                            )}

                            {/* --- Accordion Children Injection (Excluding Post Modal) --- */}
                            {isContainer && isExpanded && block.type !== 'post' && (
                                <Droppable droppableId={block.id} type="block">
                                    {(providedDroppable) => (
                                        <div
                                            {...providedDroppable.droppableProps}
                                            ref={providedDroppable.innerRef}
                                            className={`flex flex-col ${block.type === 'section' ? 'p-1.5 gap-1.5' : 'p-1 gap-1 border-l-2 border-orange-100 dark:border-orange-900/30 ml-2'}`}
                                        >

                                            {/* Recursive Child Mounting */}
                                            {(block.children || []).map((child, childIndex) => (
                                                <QuotationRow
                                                    key={child.id}
                                                    block={child}
                                                    index={childIndex}
                                                    onUpdate={handleChildUpdate}
                                                    onDelete={handleChildDelete}
                                                    onDuplicate={handleChildDuplicate}
                                                />
                                            ))}
                                            {providedDroppable.placeholder}

                                            {/* Contextual Spawners for deep depths */}
                                            <div className="flex items-center gap-2 mt-1 ml-4 py-1">
                                                {block.type === 'section' && (
                                                    <button
                                                        onClick={() => handleAddChild('subsection')}
                                                        className="text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 text-xs font-semibold flex items-center gap-1 transition-colors px-2 py-1 rounded hover:bg-orange-50 dark:hover:bg-orange-900/20 shadow-sm border border-transparent hover:border-orange-200"
                                                    >
                                                        <Folder className="w-3 h-3" /> Add Subsection
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleAddChild('line')}
                                                    className="text-neutral-600 hover:text-neutral-800 dark:text-neutral-300 dark:hover:text-neutral-100 text-xs font-medium flex items-center gap-1 transition-colors px-2 py-1 rounded hover:bg-neutral-100 dark:hover:bg-white/5 border border-transparent hover:border-neutral-200 dark:hover:border-neutral-700"
                                                >
                                                    <Plus className="w-3 h-3" /> Add Line
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </Droppable>
                            )}

                            {/* --- Raw Base-Level Rows (Line/Article/Bestek) --- */}
                            {!isContainer && (
                                <div className="w-full flex items-start gap-2 p-1.5 bg-white dark:bg-[#111] even:bg-neutral-50 dark:even:bg-[#1a1a1a] transition-colors rounded-sm border border-transparent hover:border-neutral-200 dark:hover:border-neutral-800 group relative">
                                    <div className="flex-1 min-w-0 pr-8">
                                        {(block.type === 'article' || block.type === 'bestek' || block.type === 'line') && (
                                            <FinancialRowRenderer
                                                block={block}
                                                databaseId={block.type === 'article' ? 'db-articles' : 'db-bestek'}
                                                onUpdate={(updates) => onUpdate(block.id, updates)}
                                            />
                                        )}

                                        {block.type === 'text' && (
                                            <div className="flex flex-col gap-2 w-full pt-2">
                                                <textarea
                                                    placeholder="Enter formatted text here..."
                                                    value={block.content || ''}
                                                    onChange={(e) => onUpdate(block.id, { content: e.target.value })}
                                                    className="w-full min-h-[80px] bg-neutral-100/50 dark:bg-black/30 border border-neutral-200 dark:border-neutral-800 rounded p-3 text-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 resize-y"
                                                />
                                            </div>
                                        )}

                                        {block.type === 'image' && (
                                            <div className="flex flex-col gap-2 w-full pt-2">
                                                <div className="flex items-center gap-2">
                                                    <ImageIcon className="w-4 h-4 text-neutral-400" />
                                                    <input
                                                        type="url"
                                                        placeholder="Paste Image URL here (https://...)"
                                                        value={block.content || ''}
                                                        onChange={(e) => onUpdate(block.id, { content: e.target.value })}
                                                        className="w-full bg-transparent border-b border-neutral-200 dark:border-neutral-800 outline-none pb-1 text-sm focus:border-orange-500 text-blue-500"
                                                    />
                                                </div>
                                                {block.content && block.content.startsWith('http') && (
                                                    <div className="mt-2 relative w-full max-w-md rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-white/5">
                                                        <img src={block.content} alt="Media Attachment" className="w-full h-auto object-cover" />
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {/* Context menu is now in the left gutter */}
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                )}
            </Draggable>

            {/* --- Dedicated Modal Editor for Bestek Post Constraints --- */}
            {
                block.type === 'post' && (
                    <Dialog open={isPostModalOpen} onOpenChange={setIsPostModalOpen}>
                        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
                            <DialogHeader className="mb-4">
                                <DialogTitle className="text-xl flex items-center gap-2">
                                    <Layers className="w-5 h-5 text-orange-500" />
                                    Bewerk Post: {block.content || 'Nieuwe Bestek Post'}
                                </DialogTitle>
                            </DialogHeader>

                            <div className="flex flex-col gap-4 w-full">
                                <Droppable droppableId={`modal-${block.id}`} type="block">
                                    {(providedDroppable) => (
                                        <div
                                            {...providedDroppable.droppableProps}
                                            ref={providedDroppable.innerRef}
                                            className="flex flex-col p-2 gap-2 border-l-4 border-orange-200 dark:border-orange-900/40 ml-1 rounded-sm min-h-[150px] bg-neutral-50 dark:bg-[#151515]"
                                        >
                                            {(block.children || []).map((child, childIndex) => (
                                                <QuotationRow
                                                    key={child.id}
                                                    block={child}
                                                    index={childIndex}
                                                    onUpdate={handleChildUpdate}
                                                    onDelete={handleChildDelete}
                                                    onDuplicate={handleChildDuplicate}
                                                />
                                            ))}
                                            {providedDroppable.placeholder}

                                            {/* Modal Spawners */}
                                            <div className="flex items-center gap-2 mt-4 ml-2 py-2 border-t border-neutral-200 dark:border-neutral-800">
                                                <button onClick={() => handleAddChild('article')} className="text-neutral-600 hover:text-black dark:text-neutral-400 dark:hover:text-white text-xs font-semibold flex items-center gap-1 transition-colors px-3 py-1.5 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-sm">
                                                    <Box className="w-3.5 h-3.5" /> Calculator Article
                                                </button>
                                                <button onClick={() => handleAddChild('text')} className="text-neutral-600 hover:text-black dark:text-neutral-400 dark:hover:text-white text-xs font-semibold flex items-center gap-1 transition-colors px-3 py-1.5 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-sm">
                                                    <Text className="w-3.5 h-3.5" /> Rich Text Notes
                                                </button>
                                                <button onClick={() => handleAddChild('image')} className="text-neutral-600 hover:text-black dark:text-neutral-400 dark:hover:text-white text-xs font-semibold flex items-center gap-1 transition-colors px-3 py-1.5 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-sm">
                                                    <ImageIcon className="w-3.5 h-3.5" /> Image Attachment
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </Droppable>

                                {/* Aggregated Total Metric Output for Context Header Sync */}
                                <div className="flex justify-end mt-4 px-6 border-t border-neutral-200 dark:border-neutral-800 pt-4">
                                    <div className="flex flex-col items-end">
                                        <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-widest mb-1">Post Total Cost</span>
                                        <span className="text-2xl font-bold">€{calculateBlockTotal(block).toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                )}
        </>
    );
}
