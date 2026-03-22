import React, { useState, useRef } from 'react';
import { Block, BlockType } from '@/components/admin/database/types';
import { MoreVertical, Folder, FolderOpen, AlertCircle, PlaySquare, Calculator, Search, AlignLeft, Text, Box, Tag, Zap, Database, Layers, CheckSquare, ListTodo, Plus, ChevronDown, ChevronRight, FileMinus, FileText, Settings, Image as ImageIcon, Video, File, Hash, MousePointerClick, Calendar, User, ToggleLeft, ArrowRightSquare, Table, Ban, CircleDollarSign, Percent, Grid, ArrowDownToLine, ArrowUpToLine, Wand2, Copy, Link, Shield, Lock, FileBox, GripVertical, Type, Maximize2, Trash, ExternalLink } from 'lucide-react';
import PageModal from '@/components/admin/database/components/PageModal';
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
    const [isReferenceModalOpen, setIsReferenceModalOpen] = useState(false);
    const contextTriggerRef = useRef<HTMLButtonElement>(null);

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

    // Recursive calculation for nested Phase (Post/Section) totals + Subcomponents
    const calculateBlockTotal = (b: Block): number => {
        if (b.isOptional) return 0; // Phase 10: Globally drop any optional value

        // Strict Containers (No quantity multiplier)
        if (b.type === 'post' || b.type === 'section' || b.type === 'subsection') {
            return (b.children || []).reduce((sum, child) => sum + calculateBlockTotal(child), 0);
        }

        // Base Items (Multiply by Quantity)
        let unitTotal = 0;
        if (b.children && b.children.length > 0) {
            // Aggregate all subcomponents to form the new base price
            unitTotal = b.children.reduce((sum, child) => sum + calculateBlockTotal(child), 0);
        } else {
            unitTotal = b.verkoopPrice || 0;
        }

        return unitTotal * (b.quantity || 1);
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
    const sectionHeaderColor = block.type === 'section' ? 'border-orange-500 bg-orange-100/50 dark:bg-orange-900/20' : block.type === 'subsection' ? 'border-orange-400 bg-orange-50/50 dark:bg-orange-900/10' : 'border-neutral-300 dark:border-neutral-700 bg-black/5 dark:bg-white/5';

    const renderContextMenu = (provided: any) => (
        <div
            {...provided.dragHandleProps}
            onClick={(e) => {
                e.stopPropagation();
                // Imperatively fire Radix only on pure click (drag gestures swallow click events natively)
                contextTriggerRef.current?.click();
            }}
            className="p-1 rounded cursor-grab active:cursor-grabbing hover:bg-black/10 dark:hover:bg-white/10 transition-colors group/icon relative flex items-center justify-center shrink-0 w-7 h-7"
            title={getTypeLabel(block.type)}
        >
            <div className="opacity-100 group-hover/icon:opacity-0 transition-opacity absolute flex items-center justify-center pointer-events-none">
                {getTypeIcon(block.type)}
            </div>
            <div className="opacity-0 group-hover/icon:opacity-100 transition-opacity absolute flex items-center justify-center pointer-events-none">
                <GripVertical className="w-4 h-4 text-neutral-500" />
            </div>

            <DropdownMenu modal={false}>
                <DropdownMenuTrigger ref={contextTriggerRef} className="absolute inset-0 opacity-0 pointer-events-none hidden" />
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

                    {!isContainer && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleAddChild('article')} className="text-orange-600">
                                <Plus className="w-4 h-4 mr-2" /> Add Subcomponent
                            </DropdownMenuItem>
                        </>
                    )}

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
    );

    return (
        <>
            {isReferenceModalOpen && (block.articleId || block.bestekId) && (
                <PageModal
                    databaseId={block.articleId ? 'db-articles' : 'db-bestek'}
                    pageId={block.articleId || block.bestekId || ''}
                    onClose={() => setIsReferenceModalOpen(false)}
                />
            )}
            <Draggable draggableId={block.id} index={index}>
                {(provided, snapshot) => (
                    <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`group relative w-full transition-all py-1.5 rounded flex flex-col 
                        ${block.isOptional ? 'opacity-50 grayscale' : ''} 
                        ${!isContainer ? 'even:bg-neutral-50/80 dark:even:bg-white/5 odd:bg-transparent' : ''}
                        ${snapshot.isDragging ? 'z-50 shadow-2xl bg-white dark:bg-neutral-900 border border-orange-500' : ''}
                    `}
                    >

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
                                    <div className="flex items-center gap-1.5 flex-1">
                                        {/* The Dynamic Icon / Drag Handle */}
                                        {renderContextMenu(provided)}

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
                                        <div className="flex flex-col items-end w-[160px] pr-[56px]">
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
                                            className="flex flex-col w-full gap-1 mt-1"
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
                                            <div className="flex items-center gap-2 mt-1 py-1">
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
                                <div className="w-full flex items-start gap-1 p-1 bg-white dark:bg-[#111] even:bg-neutral-50 dark:even:bg-[#1a1a1a] transition-colors rounded-sm border border-transparent hover:border-neutral-200 dark:hover:border-neutral-800 group relative">
                                    <div className="pt-2 pl-1 shrink-0">
                                        {/* Render context menu right at the start of the row */}
                                        {renderContextMenu(provided)}
                                    </div>
                                    <div className="flex-1 min-w-0 pr-1">
                                        {(block.type === 'article' || block.type === 'bestek' || block.type === 'line') && (
                                            <>
                                                <FinancialRowRenderer
                                                    block={block}
                                                    databaseId={block.type === 'article' ? 'db-articles' : 'db-bestek'}
                                                    onUpdate={(updates) => onUpdate(block.id, updates)}
                                                    childrenTotal={block.children && block.children.length > 0 ? block.children.reduce((sum, c) => sum + calculateBlockTotal(c), 0) : undefined}
                                                />

                                                {/* Action Toolbar */}
                                                <div className="flex justify-end pr-2 overflow-hidden h-0 group-hover:h-auto opacity-0 group-hover:opacity-100 focus-within:h-auto focus-within:opacity-100 transition-all duration-200">
                                                    <div className="flex items-center gap-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                                                        {(block.articleId || block.bestekId) && (
                                                            <button onClick={() => setIsReferenceModalOpen(true)} className="flex items-center hover:text-blue-500 transition-colors">
                                                                <ExternalLink className="w-3 h-3 mr-1" /> View Source
                                                            </button>
                                                        )}
                                                        <button onClick={() => handleAddChild('article')} className="flex items-center hover:text-orange-500 transition-colors text-orange-600/80">
                                                            <Plus className="w-3 h-3 mr-1" /> Subcomponent
                                                        </button>
                                                        <button onClick={() => onDuplicate(block.id)} className="flex items-center hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors">
                                                            <Copy className="w-3 h-3 mr-1" /> Duplicate
                                                        </button>
                                                        <button onClick={() => onDelete(block.id)} className="flex items-center hover:text-red-500 transition-colors text-red-500/80">
                                                            <Trash className="w-3 h-3 mr-1" /> Delete
                                                        </button>
                                                    </div>
                                                </div>
                                            </>
                                        )}

                                        {/* Dynamic Subcomponents Rendering Block */}
                                        {block.children && block.children.length > 0 && (
                                            <div className="mt-2 w-full flex flex-col relative pt-2 border-t border-neutral-100 dark:border-neutral-800/50">
                                                <div className="text-[10px] font-bold text-orange-600 dark:text-orange-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                                                    <Layers className="w-3 h-3" /> Subcomponents
                                                </div>
                                                <Droppable droppableId={`sub-${block.id}`} type="block">
                                                    {(provided) => (
                                                        <div ref={provided.innerRef} {...provided.droppableProps} className="flex flex-col gap-1">
                                                            {block.children!.map((child, idx) => (
                                                                <QuotationRow
                                                                    key={child.id}
                                                                    block={child}
                                                                    index={idx}
                                                                    onUpdate={handleChildUpdate}
                                                                    onDelete={handleChildDelete}
                                                                    onDuplicate={handleChildDuplicate}
                                                                />
                                                            ))}
                                                            {provided.placeholder}
                                                        </div>
                                                    )}
                                                </Droppable>
                                            </div>
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
