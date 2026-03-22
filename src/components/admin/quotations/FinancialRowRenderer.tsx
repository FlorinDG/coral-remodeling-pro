import React, { useMemo, useState } from 'react';
import { Block } from '@/components/admin/database/types';
import { useDatabaseStore } from '@/components/admin/database/store';
import { Database as DatabaseIcon, Check, Search, X } from 'lucide-react';

interface FinancialRowRendererProps {
    block: Block;
    databaseId: 'db-articles' | 'db-bestek';
    onUpdate: (updates: Partial<Block>) => void;
}

const RichTextInput = ({ value, onChange, onSearch, placeholder, className, onBlur, onFocus }: { value: string, onChange: (val: string) => void, onSearch?: (val: string) => void, placeholder?: string, className?: string, onBlur?: () => void, onFocus?: () => void }) => {
    const ref = React.useRef<HTMLDivElement>(null);
    React.useEffect(() => {
        if (ref.current && value !== ref.current.innerHTML) {
            ref.current.innerHTML = value;
        }
    }, [value]);
    return (
        <div
            ref={ref}
            contentEditable
            suppressContentEditableWarning
            onBlur={onBlur}
            onFocus={onFocus}
            onInput={(e) => {
                const html = e.currentTarget.innerHTML;
                onChange(html);
                if (onSearch) onSearch(e.currentTarget.textContent || '');
            }}
            className={className}
            style={{ outline: "none", cursor: "text", minHeight: "24px" }}
            data-placeholder={placeholder}
        />
    );
};

export default function FinancialRowRenderer({ block, databaseId, onUpdate }: FinancialRowRendererProps) {
    const getDatabase = useDatabaseStore(state => state.getDatabase);
    const [isSaving, setIsSaving] = useState(false);
    const [showSearchModal, setShowSearchModal] = useState(false);
    const [searchState, setSearchState] = useState<{ query: string, show: boolean }>({ query: '', show: false });

    // Fetch target database entities for the select dropdown
    const entities = useMemo(() => {
        const db = getDatabase(databaseId);
        if (!db) return [];

        const nameProp = db.properties.find(p => ['naam', 'titel', 'title', 'name'].includes(p.name.toLowerCase()));
        const namePropId = nameProp?.id || 'title';

        return db.pages.map(page => {
            const titleVal = String(page.properties[namePropId] || 'Untitled');

            // Aggregates structural columns (e.g., Kop1, Omschrijving) dynamically skipping the numerical title slot
            const contextValues = Object.entries(page.properties)
                .filter(([key, val]) => key !== namePropId && val !== null && val !== undefined && String(val).trim() !== '')
                .map(([key, val]) => String(val));

            const allValues = [titleVal, ...contextValues].map(val => val.toLowerCase()).join(' | ');

            return {
                id: page.id,
                title: titleVal,
                description: contextValues.join(' › '),
                searchableText: allValues
            };
        });
    }, [databaseId, getDatabase]);

    const activeEntityId = databaseId === 'db-articles' ? block.articleId : block.bestekId;

    // The 5-Pillar Auto-Calculator Math Engine
    const handleMathChange = (field: keyof Block, value: number) => {
        const payload: Partial<Block> = { [field]: value };

        // Auto-compute derived fields
        const b = { ...block, ...payload };

        const currentBruto = b.brutoPrice || 0;
        const currentDiscount = b.discountPercent || 0;
        const currentCost = currentBruto * (1 - currentDiscount / 100);

        if (field === 'verkoopPrice') {
            // Backwards engineering: User explicitly overwrites Verkoop, derive Marge explicitly
            const manualVerkoop = value;
            if (currentCost > 0) {
                payload.margePercent = ((manualVerkoop / currentCost) - 1) * 100;
            } else {
                payload.margePercent = 100; // Infinity edge case lock
            }
        } else {
            // Standard Propagation: Parent variable shifted, compute resulting Verkoop
            const currentMarge = b.margePercent || 0;
            const computedVerkoop = currentCost * (1 + currentMarge / 100);
            payload.verkoopPrice = computedVerkoop;
        }

        onUpdate(payload);
    };

    return (
        <div className="flex flex-col w-full border-b border-neutral-200 dark:border-neutral-800 bg-transparent group focus-within:bg-neutral-50/50 dark:focus-within:bg-[#111] transition-colors pb-1">
            <div className="flex flex-row items-start w-full py-2 px-2 gap-4">

                {/* 1. Item Name & Rich Text Context */}
                <div className="flex flex-col gap-0.5 flex-1 shrink-0 relative mt-0.5">
                    <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest px-1">Item</label>
                    {block.type === 'line' ? (
                        <RichTextInput
                            placeholder="Description..."
                            value={block.content || ''}
                            onChange={(html) => onUpdate({ content: html })}
                            className="w-full bg-transparent border-none text-sm text-black dark:text-white focus:outline-none focus:ring-0 font-medium px-2 py-0.5 empty:before:content-[attr(data-placeholder)] empty:before:text-neutral-400 empty:before:font-normal"
                        />
                    ) : (
                        <div className="relative w-full flex items-start gap-2 group/search">
                            <RichTextInput
                                placeholder="Item Description..."
                                value={block.content || ''}
                                onChange={(html) => onUpdate({ content: html })}
                                className="flex-1 min-w-0 w-full bg-transparent border-none text-sm text-black dark:text-white focus:outline-none focus:ring-0 font-medium px-2 py-0.5 empty:before:content-[attr(data-placeholder)] empty:before:text-neutral-400 empty:before:font-normal break-words whitespace-pre-wrap leading-relaxed"
                            />
                            <button
                                onClick={() => setShowSearchModal(true)}
                                className="opacity-0 group-focus-within/search:opacity-100 group-hover/search:opacity-100 p-1.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#222] dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-md text-neutral-500 hover:text-black dark:hover:text-white transition-all shadow-sm shrink-0 flex items-center gap-1.5 px-2.5 mt-0.5"
                            >
                                <Search className="w-3.5 h-3.5 opacity-70" />
                                <span className="text-[10px] uppercase font-bold tracking-widest">Browse DB</span>
                            </button>
                        </div>
                    )}

                    {/* Rich Text Toolbar (Static visibility) */}
                    <div className="flex flex-wrap items-center gap-1 mt-1.5 px-2 pb-1 text-neutral-400">
                        <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('bold', false); }} className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded text-neutral-400 hover:text-black dark:hover:text-white transition-colors" title="Bold">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 12a4 4 0 0 0 0-8H6v8" /><path d="M15 20a4 4 0 0 0 0-8H6v8Zm-9-8h8Zm0-4h7" /></svg>
                        </button>
                        <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('italic', false); }} className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded text-neutral-400 hover:text-black dark:hover:text-white transition-colors" title="Italic">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" x2="10" y1="4" y2="4" /><line x1="14" x2="5" y1="20" y2="20" /><line x1="15" x2="9" y1="4" y2="20" /></svg>
                        </button>
                        <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('underline', false); }} className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded text-neutral-400 hover:text-black dark:hover:text-white transition-colors" title="Underline">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4v6a6 6 0 0 0 12 0V4" /><line x1="4" x2="20" y1="20" y2="20" /></svg>
                        </button>
                        <div className="w-px h-3.5 bg-neutral-300 dark:bg-neutral-700 mx-0.5" />
                        <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('justifyLeft', false); }} className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded text-neutral-400 hover:text-black dark:hover:text-white transition-colors" title="Align Left">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="21" x2="3" y1="6" y2="6" /><line x1="15" x2="3" y1="12" y2="12" /><line x1="17" x2="3" y1="18" y2="18" /></svg>
                        </button>
                        <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('justifyCenter', false); }} className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded text-neutral-400 hover:text-black dark:hover:text-white transition-colors" title="Align Center">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="21" x2="3" y1="6" y2="6" /><line x1="17" x2="7" y1="12" y2="12" /><line x1="19" x2="5" y1="18" y2="18" /></svg>
                        </button>
                        <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('justifyRight', false); }} className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded text-neutral-400 hover:text-black dark:hover:text-white transition-colors" title="Align Right">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="21" x2="3" y1="6" y2="6" /><line x1="21" x2="9" y1="12" y2="12" /><line x1="21" x2="7" y1="18" y2="18" /></svg>
                        </button>
                        <div className="w-px h-3.5 bg-neutral-300 dark:bg-neutral-700 mx-0.5" />
                        <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('insertUnorderedList', false); }} className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded text-neutral-400 hover:text-black dark:hover:text-white transition-colors" title="List (Bullets)">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" x2="21" y1="6" y2="6" /><line x1="8" x2="21" y1="12" y2="12" /><line x1="8" x2="21" y1="18" y2="18" /><line x1="3" x2="3.01" y1="6" y2="6" /><line x1="3" x2="3.01" y1="12" y2="12" /><line x1="3" x2="3.01" y1="18" y2="18" /></svg>
                        </button>
                        <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('insertOrderedList', false); }} className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded text-neutral-400 hover:text-black dark:hover:text-white transition-colors" title="List (Numbers)">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="10" x2="21" y1="6" y2="6" /><line x1="10" x2="21" y1="12" y2="12" /><line x1="10" x2="21" y1="18" y2="18" /><path d="M4 6h1v4" /><path d="M4 10h2" /><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" /></svg>
                        </button>
                        <div className="w-px h-3.5 bg-neutral-300 dark:bg-neutral-700 mx-0.5" />
                        <button onMouseDown={(e) => { e.preventDefault(); const url = prompt('Image URL:'); if (url) document.execCommand('insertImage', false, url); }} className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded text-neutral-400 hover:text-black dark:hover:text-white transition-colors" title="Image">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
                        </button>
                        <button onMouseDown={(e) => { e.preventDefault(); const url = prompt('Link URL:'); if (url) document.execCommand('createLink', false, url); }} className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded text-neutral-400 hover:text-black dark:hover:text-white transition-colors" title="Links">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                        </button>
                    </div>
                </div>

                {/* 1.5 Type / Category Pill (Discrete Rectangle) */}
                <div className="flex flex-col gap-0.5 w-[75px] shrink-0 self-start mt-0.5 text-center">
                    <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest text-center">Type</label>
                    <select
                        className="w-full bg-transparent border border-orange-400 dark:border-orange-600/60 rounded-sm text-xs text-orange-600 dark:text-orange-400 focus:outline-none focus:ring-0 font-medium cursor-pointer appearance-none text-center py-0.5"
                        value={block.calculationType || 'loon'}
                        onChange={(e) => onUpdate({ calculationType: e.target.value as any })}
                    >
                        <option value="materieel" className="text-black bg-white dark:text-white dark:bg-[#111]">Matériel</option>
                        <option value="levering" className="text-black bg-white dark:text-white dark:bg-[#111]">Levering</option>
                        <option value="loon" className="text-black bg-white dark:text-white dark:bg-[#111]">Loon</option>
                        <option value="indirect" className="text-black bg-white dark:text-white dark:bg-[#111]">Indirect</option>
                    </select>
                </div>

                {/* 2. Quantity (QTÉ) */}
                <div className="flex flex-col gap-0.5 w-[65px] shrink-0 self-start mt-0.5 relative group/input text-center">
                    <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest text-center">Qty</label>
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="1"
                        value={block.quantity || ''}
                        onChange={(e) => onUpdate({ quantity: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-transparent border-none text-sm text-black dark:text-white text-center focus:outline-none focus:ring-0 font-medium placeholder:text-neutral-300 py-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                </div>

                {/* 3. Unit (UNITÉ) */}
                <div className="flex flex-col gap-0.5 w-[55px] shrink-0 self-start mt-0.5 text-center">
                    <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest text-center">Unit</label>
                    <select
                        value={block.unit || 'stuk'}
                        onChange={(e) => onUpdate({ unit: e.target.value })}
                        className="w-full bg-transparent border-none text-sm text-neutral-500 focus:outline-none focus:ring-0 font-medium cursor-pointer appearance-none text-center py-0.5 px-0"
                    >
                        <option value="u">u</option>
                        <option value="stuk">stuk</option>
                        <option value="m">m</option>
                        <option value="m2">m²</option>
                        <option value="m3">m³</option>
                        <option value="L">L</option>
                        <option value="uur">h</option>
                        <option value="dag">j</option>
                    </select>
                </div>

                {/* 4. Bruto Price (PRIX U. HT) */}
                <div className="flex flex-col gap-0.5 w-[90px] shrink-0 self-start mt-0.5 relative text-right">
                    <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest text-right pr-4">Bruto</label>
                    <div className="w-full relative">
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={block.brutoPrice || ''}
                            onChange={(e) => handleMathChange('brutoPrice', parseFloat(e.target.value) || 0)}
                            className="w-full bg-transparent border-none text-sm text-black dark:text-white text-right focus:outline-none focus:ring-0 font-medium placeholder:text-neutral-300 pr-4 py-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="absolute right-0 top-0.5 text-xs text-neutral-400 font-medium font-sans">€</span>
                    </div>
                </div>

                {/* 4.5. Discount Percent (Supplier Shortcut) */}
                <div className="flex flex-col gap-0.5 w-[70px] shrink-0 self-start mt-0.5 relative text-right">
                    <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest text-right pr-4">Disc.</label>
                    <div className="w-full relative">
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0"
                            value={block.discountPercent || ''}
                            onChange={(e) => handleMathChange('discountPercent', parseFloat(e.target.value) || 0)}
                            className="w-full bg-transparent border-none text-sm text-red-500 dark:text-red-400 text-right focus:outline-none focus:ring-0 font-medium placeholder:text-neutral-300 pr-4 py-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="absolute right-0 top-0.5 text-xs text-neutral-400 font-medium font-sans">%</span>
                    </div>
                </div>

                {/* 5. Margin / Custom TVA Equivalent */}
                <div className="flex flex-col gap-0.5 w-[70px] shrink-0 self-start mt-0.5 relative text-right">
                    <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest text-right pr-4">Marge</label>
                    <div className="w-full relative">
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="20"
                            value={block.margePercent || ''}
                            onChange={(e) => handleMathChange('margePercent', parseFloat(e.target.value) || 0)}
                            className="w-full bg-transparent border-none text-sm text-neutral-500 text-right focus:outline-none focus:ring-0 font-medium placeholder:text-neutral-300 pr-4 py-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="absolute right-0 top-0.5 text-xs text-neutral-400 font-medium font-sans">%</span>
                    </div>
                </div>

                {/* 6. Total (TOTAL HT) */}
                <div className="flex flex-col gap-0.5 w-[100px] shrink-0 self-start mt-0.5 relative text-right">
                    <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest text-right pr-4">Total</label>
                    <div className="w-full flex justify-end items-center opacity-80 group-focus-within:opacity-100 transition-opacity pr-1 py-0.5">
                        <span className="font-medium text-sm text-black dark:text-white tabular-nums tracking-tight">
                            {((block.verkoopPrice || 0) * (block.quantity || 1)).toFixed(2)}
                        </span>
                        <span className="ml-1 text-xs text-neutral-400 font-medium font-sans mt-0.5">€</span>
                    </div>
                </div>

                {/* 7. Save / Context Menu (Matched via Image context dots) */}
                <div className="w-[30px] shrink-0 self-start mt-6 flex justify-center opacity-0 group-focus-within:opacity-100 transition-opacity">
                    <button
                        type="button"
                        onClick={() => {
                            setIsSaving(true);
                            const db = useDatabaseStore.getState().getDatabase(databaseId);
                            if (db) {
                                const newId = crypto.randomUUID();
                                const props: Record<string, any> = {};

                                const findProp = (keys: string[]) => db.properties.find(p => keys.some(k => p.name.toLowerCase().includes(k)))?.id;

                                props[findProp(['naam', 'titel', 'title', 'name']) || 'title'] = block.content || 'Nieuw Item';

                                const bProp = findProp(['bruto', 'kost', 'prijs', 'price', 'inkoop']);
                                if (bProp && block.brutoPrice) props[bProp] = block.brutoPrice;

                                const vProp = findProp(['verkoop', 'selling']);
                                if (vProp && block.verkoopPrice) props[vProp] = block.verkoopPrice;

                                const mProp = findProp(['marge', 'margin']);
                                if (mProp && block.margePercent) props[mProp] = block.margePercent;

                                const kProp = findProp(['korting', 'discount']);
                                if (kProp && block.discountPercent) props[kProp] = block.discountPercent;

                                const uProp = findProp(['eenheid', 'unit', 'maat']);
                                if (uProp && block.unit) props[uProp] = block.unit;

                                const newPage = useDatabaseStore.getState().createPage(databaseId, props);

                                onUpdate(databaseId === 'db-articles' ? { articleId: newPage.id } : { bestekId: newPage.id });
                            }
                            setTimeout(() => setIsSaving(false), 2000);
                        }}
                        disabled={isSaving}
                        title="Save to Database"
                        className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-[#1a1a1a] text-neutral-400 hover:text-orange-500 transition-colors"
                    >
                        {isSaving ? <Check className="w-4 h-4 text-emerald-500" /> : <DatabaseIcon className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            {/* Massive Full-Scale Database Search Modal Overlay */}
            {showSearchModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-8 md:p-12 animate-in fade-in duration-200">
                    <div className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm" onClick={() => setShowSearchModal(false)} />
                    <div className="relative w-full max-w-5xl md:h-[80vh] h-[90vh] bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-2xl flex flex-col overflow-hidden">

                        {/* Header & Sticky Search Bar */}
                        <div className="flex-none p-4 pb-0 bg-neutral-50 dark:bg-[#151515] border-b border-neutral-200 dark:border-neutral-800">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <DatabaseIcon className="w-5 h-5 text-orange-500" />
                                    <h2 className="text-sm font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-widest">{databaseId === 'db-articles' ? 'Articles DB' : 'Bestek Source'}</h2>
                                </div>
                                <button onClick={() => setShowSearchModal(false)} className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-md transition-colors text-neutral-500">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="relative w-full mb-4">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Search className="h-5 w-5 text-neutral-400" />
                                </div>
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder="Filter godforsaken table by any property matching..."
                                    className="w-full pl-10 pr-4 py-3 bg-white dark:bg-[#1a1a1a] border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm text-black dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 shadow-sm"
                                    value={searchState.query}
                                    onChange={(e) => setSearchState({ ...searchState, query: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Configurable Hybrid Flex-Grid Header */}
                        <div className="flex-none grid grid-cols-[100px_1fr] md:grid-cols-[120px_1fr] gap-4 px-6 py-2.5 bg-neutral-100 dark:bg-[#0a0a0a] border-b border-neutral-200 dark:border-neutral-900/50 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                            <div>{databaseId === 'db-bestek' ? 'Artikel' : 'Code'}</div>
                            <div>Context / Description Pipeline</div>
                        </div>

                        {/* Render Matrix */}
                        <div className="flex-1 overflow-y-auto w-full custom-scrollbar p-2">
                            <div className="flex flex-col gap-1 w-full pb-4">
                                {entities.filter(x => !searchState.query || x.searchableText.includes(searchState.query.toLowerCase())).map(entity => (
                                    <div
                                        key={entity.id}
                                        onClick={() => {
                                            const payload: Partial<Block> = {};
                                            const cleanDesc = (entity.description || '').replace(/ › /g, ' - ');
                                            const constructedName = `${entity.title} — ${cleanDesc}`;
                                            payload.content = constructedName; // Inject entire context string into Editor!

                                            if (databaseId === 'db-articles') payload.articleId = entity.id;
                                            else payload.bestekId = entity.id;

                                            const db = getDatabase(databaseId);
                                            const page = db?.pages.find(p => p.id === entity.id);
                                            if (db && page) {
                                                const getPropVal = (keywords: string[]) => {
                                                    const prop = db.properties.find(p => p.name && keywords.some(k => p.name.toLowerCase().includes(k)));
                                                    return prop ? page.properties[prop.id] : undefined;
                                                };

                                                const rawBruto = getPropVal(['bruto', 'kost', 'prijs', 'price', 'inkoop']);
                                                const rawVerkoop = getPropVal(['verkoop', 'selling']);
                                                const rawMarge = getPropVal(['marge', 'margin']);
                                                const rawDiscount = getPropVal(['korting', 'discount']);
                                                const rawUnit = getPropVal(['eenheid', 'unit', 'maat']);

                                                if (rawBruto !== undefined && rawBruto !== null) payload.brutoPrice = Number(rawBruto) || 0;
                                                if (rawDiscount !== undefined && rawDiscount !== null) payload.discountPercent = Number(rawDiscount) || 0;
                                                if (rawMarge !== undefined && rawMarge !== null) payload.margePercent = Number(rawMarge) || 0;
                                                if (rawUnit !== undefined && rawUnit !== null) payload.unit = String(rawUnit);

                                                if (payload.brutoPrice !== undefined || payload.discountPercent !== undefined || payload.margePercent !== undefined) {
                                                    const bPrice = payload.brutoPrice !== undefined ? payload.brutoPrice : (block.brutoPrice || 0);
                                                    const dPerc = payload.discountPercent !== undefined ? payload.discountPercent : (block.discountPercent || 0);
                                                    const mPerc = payload.margePercent !== undefined ? payload.margePercent : (block.margePercent || 0);
                                                    const cCost = bPrice * (1 - dPerc / 100);
                                                    payload.verkoopPrice = cCost * (1 + mPerc / 100);
                                                } else if (rawVerkoop !== undefined && rawVerkoop !== null) {
                                                    payload.verkoopPrice = Number(rawVerkoop) || 0;
                                                }
                                            }

                                            onUpdate(payload);
                                            setShowSearchModal(false);
                                            setSearchState({ query: '', show: false });
                                        }}
                                        className="grid grid-cols-[100px_1fr] md:grid-cols-[120px_1fr] gap-4 px-4 py-3 bg-white dark:bg-[#151515] hover:bg-neutral-50 dark:hover:bg-[#1a1a1a] border border-neutral-100 dark:border-neutral-800/60 rounded-md cursor-pointer transition-colors group/row items-center"
                                    >
                                        <div className="font-mono text-xs text-orange-600 dark:text-orange-400/80 font-semibold align-middle mt-0.5">
                                            {entity.title}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-y-1 gap-x-2 w-full pr-4">
                                            {(entity.description || 'No Context Provided').split(' › ').map((stringFrag, i, arr) => (
                                                <React.Fragment key={i}>
                                                    <span className={`text-sm tracking-tight ${i === arr.length - 1 ? 'font-bold text-black dark:text-white' : 'font-medium text-neutral-500 dark:text-neutral-400'}`}>
                                                        {stringFrag}
                                                    </span>
                                                    {i < arr.length - 1 && (
                                                        <span className="text-neutral-300 dark:text-neutral-700 mx-0.5 shrink-0 text-[10px]">▶</span>
                                                    )}
                                                </React.Fragment>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                                {entities.filter(x => !searchState.query || x.searchableText.includes(searchState.query.toLowerCase())).length === 0 && (
                                    <div className="text-center py-20 text-neutral-400 text-sm">
                                        No database rows match your query.
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}
