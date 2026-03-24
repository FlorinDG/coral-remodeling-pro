import React, { useMemo, useState } from 'react';
import { Block, BlockType, VariantsConfig } from '@/components/admin/database/types';
import { useDatabaseStore } from '@/components/admin/database/store';
import { Database as DatabaseIcon, Check, Search, X } from 'lucide-react';

interface FinancialRowRendererProps {
    block: Block;
    databaseId: 'db-articles' | 'db-bestek' | string;
    onUpdate: (updates: Partial<Block>) => void;
    childrenTotal?: number;
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

export default function FinancialRowRenderer({ block, databaseId, onUpdate, childrenTotal }: FinancialRowRendererProps) {
    const getDatabase = useDatabaseStore(state => state.getDatabase);
    const [isSaving, setIsSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);

    // Compute active variant pricing deltas specifically for visual UI components
    const variantDeltas = useMemo(() => {
        let deltas = 0;
        if (!block.selectedVariants || !block.articleId) return 0;
        const db = getDatabase('db-articles');
        const page = db?.pages.find(p => p.id === block.articleId);
        const vProp = db?.properties.find(p => p.type === 'variants');
        if (page && vProp) {
            const vConfig = page.properties[vProp.id] as VariantsConfig;
            if (vConfig && Array.isArray(vConfig)) {
                Object.entries(block.selectedVariants).forEach(([axisId, optId]) => {
                    const axis = vConfig.find(a => a.id === axisId);
                    const opt = axis?.options.find(o => o.id === optId);
                    if (opt) deltas += opt.priceDelta;
                });
            }
        }
        return deltas;
    }, [block.selectedVariants, block.articleId, getDatabase]);

    // Fetch and combine target database entities from BOTH databases for global search
    const combinedEntities = useMemo(() => {
        const dbs = [getDatabase('db-articles'), getDatabase('db-bestek')].filter(Boolean);
        const results: any[] = [];

        dbs.forEach(db => {
            if (!db) return;
            const isArticle = db.id === 'db-articles';
            const nameProp = db.properties.find(p => ['naam', 'titel', 'title', 'name', 'artikel', 'code', 'omschrijving'].includes(p.name.toLowerCase()));
            const namePropId = nameProp?.id || 'title';

            db.pages.forEach(page => {
                const titleVal = String(page.properties[namePropId] || 'Untitled');
                const contextValues = Object.entries(page.properties)
                    .filter(([key, val]) => key !== namePropId && val !== null && val !== undefined && String(val).trim() !== '')
                    .map(([key, val]) => String(val));

                const allValues = [titleVal, ...contextValues].map(val => val.toLowerCase()).join(' | ');

                results.push({
                    databaseId: db.id,
                    type: isArticle ? 'article' : 'bestek',
                    id: page.id,
                    title: titleVal,
                    description: contextValues.join(' › '),
                    searchableText: allValues,
                    page: page
                });
            });
        });
        return results;
    }, [getDatabase]);

    // Fast fuzzy filter subset
    const searchResults = useMemo(() => {
        if (!searchQuery || searchQuery.length < 2) return [];
        const lowerQ = searchQuery.toLowerCase();
        return combinedEntities.filter(x => x.searchableText.includes(lowerQ)).slice(0, 50); // Top 50 hits
    }, [searchQuery, combinedEntities]);

    // Metamorphosis function invoked when an item is selected from dropdown
    const handleSelectEntity = (entity: any) => {
        const payload: Partial<Block> = { type: entity.type as BlockType }; // Force form mutation

        const cleanDesc = (entity.description || '').replace(/ › /g, ' - ');
        const constructedName = `${entity.title} — ${cleanDesc}`;
        payload.content = constructedName;

        if (entity.databaseId === 'db-articles') {
            payload.articleId = entity.id;
            payload.bestekId = undefined; // Purge cross-contamination
        } else {
            payload.bestekId = entity.id;
            payload.articleId = undefined;
        }

        const db = getDatabase(entity.databaseId);
        const page = entity.page;
        if (db && page) {
            const getPropVal = (keywords: string[]) => {
                const prop = db.properties.find(p => p.name && keywords.some(k => p.name.toLowerCase().includes(k.toLowerCase())));
                return prop ? page.properties[prop.id] : undefined;
            };

            const parseNumber = (val: any): number | undefined => {
                if (val === undefined || val === null || val === '') return undefined;
                if (typeof val === 'number') return val;
                if (typeof val === 'string') {
                    const cleaned = val.replace(/[^0-9,-.]/g, '').replace(',', '.');
                    const parsed = parseFloat(cleaned);
                    return isNaN(parsed) ? undefined : parsed;
                }
                return undefined;
            };

            const rawBruto = getPropVal(['bruto', 'brutoprijs', 'kost', 'prijs', 'price', 'inkoop']);
            const rawVerkoop = getPropVal(['verkoop', 'selling']);
            const rawMarge = getPropVal(['marge', 'margin', 'marge stanndard', 'marge standard']);
            const rawDiscount = getPropVal(['korting', 'discount', 'disc']);
            const rawUnit = getPropVal(['eenheid', 'unit', 'maat', 'eeh']);
            const rawType = getPropVal(['type', 'calculatietype', 'calculationtype']);

            const numBruto = parseNumber(rawBruto);
            if (numBruto !== undefined) payload.brutoPrice = numBruto;

            const numDiscount = parseNumber(rawDiscount);
            if (numDiscount !== undefined) payload.discountPercent = numDiscount;

            const numMarge = parseNumber(rawMarge);
            if (numMarge !== undefined) payload.margePercent = numMarge;

            if (rawUnit !== undefined && rawUnit !== null) payload.unit = String(rawUnit);

            if (rawType !== undefined && rawType !== null) {
                const lowerType = String(rawType).toLowerCase();
                if (['materieel', 'levering', 'loon', 'indirect'].includes(lowerType)) {
                    payload.calculationType = lowerType as any;
                }
            }

            if (payload.brutoPrice !== undefined || payload.discountPercent !== undefined || payload.margePercent !== undefined) {
                const bPrice = payload.brutoPrice !== undefined ? payload.brutoPrice : (block.brutoPrice || 0);
                const dPerc = payload.discountPercent !== undefined ? payload.discountPercent : (block.discountPercent || 0);
                const mPerc = payload.margePercent !== undefined ? payload.margePercent : (block.margePercent || 0);
                const cCost = bPrice * (1 - dPerc / 100);
                payload.verkoopPrice = cCost * (1 + mPerc / 100);
            } else {
                const numVerkoop = parseNumber(rawVerkoop);
                if (numVerkoop !== undefined) {
                    payload.verkoopPrice = numVerkoop;
                }
            }

            // Morph subcomponents recursively from template library
            if (page.blocks && page.blocks.length > 0) {
                const cloneBlocks = (blocks: Block[]): Block[] => {
                    return blocks.map(b => ({
                        ...b,
                        id: crypto.randomUUID(),
                        children: b.children ? cloneBlocks(b.children) : undefined
                    }));
                };
                payload.children = cloneBlocks(page.blocks);
            } else {
                payload.children = []; // Purge previous structure if switching to empty
            }
        }

        onUpdate(payload);
        setShowDropdown(false);
    };

    // The 5-Pillar Auto-Calculator Math Engine
    const handleMathChange = (field: keyof Block, value: number) => {
        if (childrenTotal !== undefined) return; // Locked by subcomponents

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
        <div className="flex flex-col w-full border-b border-neutral-200 dark:border-neutral-800 bg-transparent group focus-within:bg-neutral-50/50 dark:focus-within:bg-[#111] transition-colors pb-0">
            <div className="flex flex-row items-start w-full pt-1 pb-0.5 px-2 gap-4">

                {/* 1. Item Name & Rich Text Context */}
                <div className="flex flex-col gap-0.5 flex-1 shrink-0 relative mt-0.5 min-w-0">
                    <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest px-1">Item / Description</label>
                    <div className="relative w-full flex flex-col group/search">
                        <RichTextInput
                            placeholder="Type to search DB or enter custom spec..."
                            value={block.content || ''}
                            onChange={(html) => onUpdate({ content: html })}
                            onSearch={(query) => {
                                setSearchQuery(query);
                                setShowDropdown(query.length >= 2);
                            }}
                            onBlur={() => setTimeout(() => setShowDropdown(false), 200)} // Allow click event execution
                            className="w-full bg-transparent border-none text-base text-black dark:text-white focus:outline-none focus:ring-0 font-medium px-2 py-0.5 empty:before:content-[attr(data-placeholder)] empty:before:text-neutral-400 empty:before:font-normal break-words whitespace-pre-wrap leading-relaxed"
                        />

                        {/* Autocomplete Combobox Dropdown */}
                        {showDropdown && searchResults.length > 0 && (
                            <div className="absolute top-full left-0 mt-1 w-full sm:w-[500px] max-w-[90vw] bg-white dark:bg-[#1a1a1a] border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-2xl z-50 max-h-[350px] overflow-y-auto">
                                <div className="px-3 py-2 text-[10px] font-bold tracking-widest uppercase text-neutral-400 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-black/20 backdrop-blur-md sticky top-0">
                                    Search Results
                                </div>
                                {searchResults.map(entity => (
                                    <div
                                        key={entity.id}
                                        onClick={() => handleSelectEntity(entity)}
                                        className="p-3 border-b border-neutral-100 dark:border-neutral-800/50 hover:bg-orange-50 dark:hover:bg-orange-900/10 cursor-pointer flex flex-col gap-1 transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-sm ${entity.type === 'article' ? 'bg-amber-100/50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-purple-100/50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'}`}>
                                                {entity.type}
                                            </span>
                                            <span className="text-sm font-bold text-black dark:text-white line-clamp-1">{entity.title}</span>
                                        </div>
                                        {entity.description && (
                                            <span className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2 pl-[42px] leading-snug">
                                                {entity.description.replace(/ › /g, ' - ')}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Rich Text Toolbar (Static visibility) */}
                    <div className="flex flex-wrap items-center gap-1 mt-0.5 px-2 pb-0 text-neutral-400">
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

                {/* Phase 11: Variants Engine Selectors */}
                {(() => {
                    const activeDbId = block.type === 'article' ? 'db-articles' : block.type === 'bestek' ? 'db-bestek' : null;
                    const sourceId = block.type === 'article' ? block.articleId : block.type === 'bestek' ? block.bestekId : null;
                    if (!activeDbId || !sourceId) return null;

                    const db = useDatabaseStore.getState().getDatabase(activeDbId);
                    const page = db?.pages.find(p => p.id === sourceId);
                    const variantsProp = db?.properties.find(p => p.type === 'variants');
                    if (!page || !variantsProp) return null;

                    const variantsConfig = page.properties[variantsProp.id] as VariantsConfig;
                    if (!variantsConfig || !Array.isArray(variantsConfig) || variantsConfig.length === 0) return null;

                    return (
                        <div className="flex flex-wrap items-center gap-2 mt-2 px-2 pb-1">
                            {variantsConfig.map(axis => (
                                <div key={axis.id} className="flex items-center gap-1.5 bg-neutral-100 dark:bg-black/30 rounded px-2 py-1 border border-neutral-200 dark:border-white/5">
                                    <span className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider ">{axis.name}:</span>
                                    <select
                                        value={block.selectedVariants?.[axis.id] || ''}
                                        onChange={(e) => {
                                            const newSelected = { ...(block.selectedVariants || {}), [axis.id]: e.target.value };
                                            onUpdate({ selectedVariants: newSelected });
                                        }}
                                        className="bg-transparent text-xs font-semibold text-neutral-800 dark:text-neutral-200 outline-none cursor-pointer hover:text-orange-500 transition-colors"
                                    >
                                        <option value="" disabled>Select...</option>
                                        {axis.options.map(opt => (
                                            <option key={opt.id} value={opt.id}>
                                                {opt.name} {opt.priceDelta !== 0 ? `(${opt.priceDelta > 0 ? '+' : ''}€${opt.priceDelta.toFixed(2)})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            ))}
                        </div>
                    );
                })()}

                {/* 1.5 Type / Category Pill (Discrete Rectangle) */}
                <div className="flex flex-col gap-0.5 w-[75px] shrink-0 self-start mt-0.5 text-center">
                    <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest text-center">Type</label>
                    <select
                        className="w-full bg-transparent border border-orange-400 dark:border-orange-600/60 rounded-sm text-sm text-orange-600 dark:text-orange-400 focus:outline-none focus:ring-0 font-medium cursor-pointer appearance-none text-center py-0.5"
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
                        className="w-full bg-transparent border-none text-base text-black dark:text-white text-center focus:outline-none focus:ring-0 font-medium placeholder:text-neutral-300 py-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                </div>

                {/* 3. Unit (UNITÉ) */}
                <div className="flex flex-col gap-0.5 w-[55px] shrink-0 self-start mt-0.5 text-center">
                    <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest text-center">Unit</label>
                    <select
                        value={block.unit || 'stuk'}
                        onChange={(e) => onUpdate({ unit: e.target.value })}
                        className="w-full bg-transparent border-none text-base text-neutral-500 focus:outline-none focus:ring-0 font-medium cursor-pointer appearance-none text-center py-0.5 px-0"
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
                <div className={`flex flex-col gap-0.5 w-[90px] shrink-0 self-start mt-0.5 relative text-right transition-opacity ${childrenTotal !== undefined ? 'opacity-40' : ''}`} title={childrenTotal !== undefined ? 'Price driven by subcomponents' : ''}>
                    <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest text-right pr-4 cursor-default">Bruto</label>
                    <div className="w-full relative">
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={block.brutoPrice || ''}
                            onChange={(e) => handleMathChange('brutoPrice', parseFloat(e.target.value) || 0)}
                            readOnly={childrenTotal !== undefined}
                            className="w-full bg-transparent border-none text-base text-black dark:text-white text-right focus:outline-none focus:ring-0 font-normal placeholder:text-neutral-300 pr-4 py-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none cursor-text disabled:cursor-not-allowed"
                        />
                        <span className="absolute right-0 top-0.5 text-xs text-neutral-400 font-medium font-sans cursor-default">€</span>
                    </div>
                </div>

                {/* 4.5. Discount Percent (Supplier Shortcut) */}
                <div className={`flex flex-col gap-0.5 w-[70px] shrink-0 self-start mt-0.5 relative text-right transition-opacity ${childrenTotal !== undefined ? 'opacity-40' : ''}`} title={childrenTotal !== undefined ? 'Discount handled within subcomponents' : ''}>
                    <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest text-right pr-4 cursor-default">Disc.</label>
                    <div className="w-full relative">
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0"
                            value={block.discountPercent || ''}
                            onChange={(e) => handleMathChange('discountPercent', parseFloat(e.target.value) || 0)}
                            readOnly={childrenTotal !== undefined}
                            className="w-full bg-transparent border-none text-base text-red-500 dark:text-red-400 text-right focus:outline-none focus:ring-0 font-normal placeholder:text-neutral-300 pr-4 py-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none cursor-text disabled:cursor-not-allowed"
                        />
                        <span className="absolute right-0 top-0.5 text-xs text-neutral-400 font-medium font-sans cursor-default">%</span>
                    </div>
                </div>

                {/* 5. Margin / Custom TVA Equivalent */}
                <div className={`flex flex-col gap-0.5 w-[70px] shrink-0 self-start mt-0.5 relative text-right transition-opacity ${childrenTotal !== undefined ? 'opacity-40' : ''}`} title={childrenTotal !== undefined ? 'Margin driven by subcomponents' : ''}>
                    <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest text-right pr-4 cursor-default">Marge</label>
                    <div className="w-full relative">
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="20"
                            value={block.margePercent || ''}
                            onChange={(e) => handleMathChange('margePercent', parseFloat(e.target.value) || 0)}
                            readOnly={childrenTotal !== undefined}
                            className="w-full bg-transparent border-none text-base text-neutral-500 text-right focus:outline-none focus:ring-0 font-normal placeholder:text-neutral-300 pr-4 py-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none cursor-text disabled:cursor-not-allowed"
                        />
                        <span className="absolute right-0 top-0.5 text-xs text-neutral-400 font-medium font-sans cursor-default">%</span>
                    </div>
                </div>

                {/* 6. Total (TOTAL HT) */}
                <div className="flex flex-col gap-0.5 w-[100px] shrink-0 self-start mt-0.5 relative text-right">
                    <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest text-right pr-4 cursor-default">Total</label>
                    <div className="w-full flex justify-end items-center opacity-80 group-focus-within:opacity-100 transition-opacity pr-1 py-0.5">
                        <span className={`font-normal text-lg tracking-tight ${childrenTotal !== undefined ? 'text-orange-600 dark:text-orange-400' : 'text-black dark:text-white tabular-nums'}`}>
                            {childrenTotal !== undefined
                                ? (childrenTotal * (block.quantity || 1)).toFixed(2)
                                : (((block.verkoopPrice || 0) + variantDeltas) * (block.quantity || 1)).toFixed(2)}
                        </span>
                        <span className="ml-1 text-xs text-neutral-400 font-medium font-sans mt-0.5 cursor-default">€</span>
                    </div>
                </div>

                {/* 7. Save / Context Menu (Matched via Image context dots) - MOVED TO ACTION TOOLBAR */}

                {/* Removed Global Search Modal - replaced by sleek inline combobox */}
            </div>
        </div>
    );
}
