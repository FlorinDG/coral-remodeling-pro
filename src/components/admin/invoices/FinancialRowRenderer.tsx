/* eslint-disable @typescript-eslint/no-explicit-any */
import { lineVariantDelta, variantDelta } from '@/lib/records/variant-price';
import { pricingValue, type PricingRole, type PropDef } from '@/lib/article-pricing';
import React, { useMemo, useState } from 'react';
import { Block, BlockType, VariantsConfig } from '@/components/admin/database/types';
import { useDatabaseStore } from '@/components/admin/database/store';
import { Database as DatabaseIcon, Check, Search, X } from 'lucide-react';
import { parseDecimal, formatDecimal } from '@/lib/decimal-parser';
import ClientDiscountInput from '@/components/admin/shared/ClientDiscountInput';
import LineVatRateSelect from '@/components/admin/shared/LineVatRateSelect';
import { lineNet } from '@/lib/records/document-lines';
import RichText from '@/components/editor/RichText';

interface FinancialRowRendererProps {
    /** DOC-LINES-2: the document's VAT regime — a line without its own rate takes it. */
    vatRegime?: string;
    block: Block;
    databaseId: 'db-articles' | 'db-bestek' | string;
    onUpdate: (updates: Partial<Block>) => void;
    childrenTotal?: number;
    hasLibraryAccess?: boolean;
    language?: string;
}

export default function FinancialRowRenderer({ block, databaseId, onUpdate, childrenTotal, hasLibraryAccess = true, language = 'nl', vatRegime = '21' }: FinancialRowRendererProps) {
    const getDatabase = useDatabaseStore(state => state.getDatabase);
    const [isSaving, setIsSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);

    // Local text state for Qty and Price inputs (allows free typing with commas)
    const [qtyText, setQtyText] = useState(() => block.quantity ? formatDecimal(block.quantity, 2).replace(/,00$/, '') : '');
    const [priceText, setPriceText] = useState(() => block.unitPrice ? formatDecimal(block.unitPrice) : '');

    // Sync local text when block changes externally (e.g. article selection)
    React.useEffect(() => {
        const formatted = block.quantity ? formatDecimal(block.quantity, 2).replace(/,00$/, '') : '';
        setQtyText((prev: any) => {
            const parsed = parseDecimal(prev);
            return parsed === (block.quantity || 0) ? prev : formatted;
        });
    }, [block.quantity]);
    React.useEffect(() => {
        const formatted = block.unitPrice ? formatDecimal(block.unitPrice) : '';
        setPriceText((prev: any) => {
            const parsed = parseDecimal(prev);
            return parsed === (block.unitPrice || 0) ? prev : formatted;
        });
    }, [block.unitPrice]);

    // Compute active variant pricing deltas specifically for visual UI components
    // VARIANT-1: the surcharge frozen on the line when the variant was picked (lib/records/variant-price)
    const variantDeltas = lineVariantDelta(block);

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
        return combinedEntities.filter((x: any) => x.searchableText.includes(lowerQ)).slice(0, 50); // Top 50 hits
    }, [searchQuery, combinedEntities]);

    // Metamorphosis function invoked when an item is selected from dropdown
    const handleSelectEntity = (entity: any) => {
        const payload: Partial<Block> = { type: entity.type as BlockType }; // Force form mutation

        // QUOTE-7: block content = CLEAN article name ONLY. The financial schema
        // (bruto/marge/discount/…) lives in its own columns — never concatenate it into
        // the name. Doing so polluted the library title on Save-to-Library and compounded
        // on every round-trip. Strip any pre-existing "— …" suffix so the fix is idempotent
        // even for already-polluted titles.
        const cleanName = String(entity.title || '').split(' — ')[0].trim();
        payload.content = cleanName;

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
            // ONE answer for quote + invoice lines (lib/article-pricing.ts): fixed ids for the articles
            // database, else typed name matching — the old first-substring guess read LEVERANCIER as the discount.
            const getPropVal = (role: PricingRole) => pricingValue(db.properties as PropDef[], page.properties as Record<string, unknown>, role);

            const parseNumber = (val: any): number | undefined => {
                if (Array.isArray(val) && val.length > 0) return parseDecimal(val[0]);
                return parseDecimal(val);
            };

            const rawBruto = getPropVal('bruto');
            const rawVerkoop = getPropVal('verkoop');
            const rawMarge = getPropVal('marge');
            const rawDiscount = getPropVal('discount');
            const rawUnit = getPropVal('unit');
            const rawType = getPropVal('type');

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
                const nettokost = bPrice * (1 - dPerc / 100);
                payload.costPrice = nettokost; // Derived Nettokost (nettokost = brutoPrice * (1 - discountPercent / 100))
                const margeEuro = nettokost * (mPerc / 100); // margeEuro = nettokost * (margePercent / 100)
                payload.verkoopPrice = Math.round((nettokost + margeEuro) * 100) / 100; // verkoopPrice = nettokost + margeEuro
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
        const nettokost = currentBruto * (1 - currentDiscount / 100);
        payload.costPrice = nettokost; // Derived Nettokost (nettokost = brutoPrice * (1 - discountPercent / 100))

        if (field === 'verkoopPrice') {
            // Backwards engineering: User explicitly overwrites Verkoop, derive Marge explicitly
            const manualVerkoop = value;
            if (nettokost > 0) {
                payload.margePercent = Math.round(((manualVerkoop - nettokost) / nettokost) * 10000) / 100;
            } else {
                payload.margePercent = 100; // Infinity edge case lock
            }
        } else {
            // Standard Propagation: Parent variable shifted, compute resulting Verkoop
            const currentMarge = b.margePercent || 0;
            const margeEuro = nettokost * (currentMarge / 100); // margeEuro = nettokost * (margePercent / 100)
            const computedVerkoop = Math.round((nettokost + margeEuro) * 100) / 100; // verkoopPrice = nettokost + margeEuro
            payload.verkoopPrice = computedVerkoop;
        }

        onUpdate(payload);
    };

    return (
        <div className="@container flex flex-col w-full border-b border-neutral-200 dark:border-neutral-800 bg-transparent group focus-within:bg-neutral-50/50 dark:focus-within:bg-[#111] transition-colors pb-0">
            <div className="flex flex-col @[980px]:flex-row items-stretch @[980px]:items-start w-full pt-1 pb-0.5 px-2 gap-4">

                {/* 1. Item Name & Rich Text Context */}
                <div className="flex flex-col gap-0.5 flex-1 shrink relative mt-0.5 min-w-[280px] w-full">
                    <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest px-1">Item / Description</label>
                    <div className="relative w-full flex flex-col group/search">
                        <RichText
                            placeholder="Type to search DB or enter custom spec..."
                            value={block.content || ''}
                            onChange={(html) => onUpdate({ content: html })}
                            onTextChange={(query) => {
                                setSearchQuery(query);
                                setShowDropdown(query.length >= 2);
                            }}
                            onBlur={() => setTimeout(() => setShowDropdown(false), 200)} // Allow click event execution
                            className="w-full bg-transparent border-none text-base text-black dark:text-white focus:outline-none focus:ring-0 font-medium px-2 py-0.5 break-words whitespace-pre-wrap leading-relaxed"
                            toolbar="below"
                        />

                        {/* Autocomplete Combobox Dropdown */}
                        {showDropdown && searchResults.length > 0 && (
                            <div className="absolute top-full left-0 mt-1 w-full sm:w-[500px] max-w-[90vw] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700/80 rounded-xl shadow-2xl z-50 max-h-[350px] overflow-y-auto">
                                <div className="px-3 py-2 text-[10px] font-bold tracking-widest uppercase text-neutral-400 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-black/20 backdrop-blur-md sticky top-0">
                                    Search Results
                                </div>
                                {searchResults.map((entity: any) => (
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
                                            // VARIANT-1: freeze the surcharge now — later library changes never rewrite this line
                                            onUpdate({ selectedVariants: newSelected, variantPriceDelta: variantDelta(newSelected, variantsConfig) });
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
                {/* Metric columns group that wraps on narrow screens */}
                <div className="flex flex-col @[600px]:flex-row items-stretch @[600px]:items-center gap-2 @[600px]:gap-3 w-full @[980px]:w-auto mt-2.5 @[980px]:mt-0">
                    {/* 2. Quantity (Qty) */}
                    <div className="flex flex-row items-center justify-between w-full @[600px]:flex-col @[600px]:gap-0.5 @[600px]:w-[65px] shrink-0 self-start mt-0.5 relative group/input border-b border-neutral-200/60 dark:border-neutral-850 @[600px]:border-b-0 py-1.5 @[600px]:py-0">
                        <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest text-left @[600px]:text-center">Qty</label>
                        <input
                            type="text"
                            inputMode="decimal"
                            placeholder="1"
                            value={qtyText}
                            onChange={(e) => {
                                const v = e.target.value;
                                if (/^-?[\d.,]*$/.test(v) || v === '') {
                                    setQtyText(v);
                                    const parsed = parseDecimal(v);
                                    onUpdate({ quantity: parsed });
                                }
                            }}
                            onBlur={() => {
                                const parsed = parseDecimal(qtyText);
                                if (parsed !== 0) {
                                    setQtyText(formatDecimal(parsed, 2).replace(/,00$/, ''));
                                } else {
                                    setQtyText('');
                                }
                            }}
                            className="bg-transparent border-none text-base text-black dark:text-white text-right @[600px]:text-center focus:outline-none focus:ring-0 font-medium placeholder:text-neutral-300 py-0.5 pr-1 w-24 @[600px]:w-full"
                        />
                    </div>

                    {/* 3. Unit (EENHEID) */}
                    <div className="flex flex-row items-center justify-between w-full @[600px]:flex-col @[600px]:gap-0.5 @[600px]:w-[55px] shrink-0 self-start mt-0.5 border-b border-neutral-200/60 dark:border-neutral-850 @[600px]:border-b-0 py-1.5 @[600px]:py-0">
                        <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest text-left @[600px]:text-center">Unit</label>
                        <select
                            value={block.unit || 'stuk'}
                            onChange={(e) => onUpdate({ unit: e.target.value })}
                            className="bg-transparent border-none text-base text-neutral-500 focus:outline-none focus:ring-0 font-medium cursor-pointer appearance-none text-right @[600px]:text-center py-0.5 pr-1 pl-0 w-24 @[600px]:w-full"
                            style={{ textAlign: 'right', textAlignLast: 'right' }}
                        >
                            <option value="u">u</option>
                            <option value="stuk">stuk</option>
                            <option value="m">m</option>
                            <option value="m2">m²</option>
                            <option value="m3">m³</option>
                            <option value="L">L</option>
                            <option value="uur">h</option>
                            <option value="dag">j</option>
                            <option value="kg">kg</option>
                            <option value="vfp">forfait</option>
                        </select>
                    </div>

                    {/* 4. Unit Price excl. VAT (EENHEIDSPRIJS) */}
                    <div className={`flex flex-row items-center justify-between w-full @[600px]:flex-col @[600px]:gap-0.5 @[600px]:w-[100px] shrink-0 self-start mt-0.5 relative transition-opacity ${childrenTotal !== undefined ? 'opacity-40' : ''} border-b border-neutral-200/60 dark:border-neutral-850 @[600px]:border-b-0 py-1.5 @[600px]:py-0`}>
                        <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest text-left @[600px]:text-right @[600px]:pr-4 cursor-default">Price</label>
                        <div className="relative w-24 @[600px]:w-full flex justify-end items-center">
                            <span className="absolute left-0 top-[3px] text-xs font-semibold text-neutral-400 pointer-events-none select-none">€</span>
                            <input
                                type="text"
                                inputMode="decimal"
                                placeholder="0,00"
                                value={priceText}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    if (/^-?[\d.,]*$/.test(v) || v === '') {
                                        setPriceText(v);
                                        const newUnitPrice = parseDecimal(v);
                                        onUpdate({ unitPrice: newUnitPrice, verkoopPrice: newUnitPrice });
                                    }
                                }}
                                onBlur={() => {
                                    const parsed = parseDecimal(priceText);
                                    if (parsed !== 0) {
                                        setPriceText(formatDecimal(parsed));
                                    } else {
                                        setPriceText('');
                                    }
                                }}
                                readOnly={childrenTotal !== undefined}
                                className="bg-transparent border-none text-base text-black dark:text-white text-right focus:outline-none focus:ring-0 font-normal placeholder:text-neutral-300 pr-4 py-0.5 cursor-text w-full"
                            />
                            <span className="absolute right-0 top-0.5 text-xs text-neutral-400 font-medium font-sans cursor-default">€</span>
                        </div>
                    </div>

                    {/* DOC-LINES-2 · the line's VAT rate — empty = the document's */}
                    <div className="flex flex-row items-center justify-between w-full @[600px]:flex-col @[600px]:gap-0.5 @[600px]:w-[80px] shrink-0 self-start mt-0.5 relative border-b border-neutral-200/60 dark:border-neutral-850 @[600px]:border-b-0 py-1.5 @[600px]:py-0">
                        <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest text-left @[600px]:text-right @[600px]:pr-4 cursor-default">BTW</label>
                        <LineVatRateSelect className="w-24 @[600px]:w-full pr-1" value={block.vatRateOverride} vatRegime={vatRegime} onChange={r => onUpdate({ vatRateOverride: r ?? undefined })} />
                    </div>

                    {/* DOC-LINES-1 · the customer discount on this line — a percentage or a fixed amount */}
                    <div className="flex flex-row items-center justify-between w-full @[600px]:flex-col @[600px]:gap-0.5 @[600px]:w-[110px] shrink-0 self-start mt-0.5 relative border-b border-neutral-200/60 dark:border-neutral-850 @[600px]:border-b-0 py-1.5 @[600px]:py-0">
                        <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest text-left @[600px]:text-right @[600px]:pr-4 cursor-default">Korting</label>
                        <ClientDiscountInput className="w-28 @[600px]:w-full pr-1" value={block.clientDiscount} onChange={d => onUpdate({ clientDiscount: d })} />
                    </div>

                    {/* 6. Total excl. VAT = Qty × Unit Price */}
                    <div className="flex flex-row items-center justify-between w-full @[600px]:flex-col @[600px]:gap-0.5 @[600px]:w-[110px] shrink-0 self-start mt-0.5 relative py-1.5 @[600px]:py-0">
                        <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest text-right @[600px]:pr-4 cursor-default">Totaal</label>
                        <div className="w-24 @[600px]:w-full flex justify-end items-center pr-1 py-0.5">
                            <span className={`font-medium text-lg tracking-tight tabular-nums ${
                                (() => {
                                    const total = lineNet(block);
                                    return total < 0 ? 'text-red-500 dark:text-red-400' : 'text-black dark:text-white';
                                })()
                            }`}>
                                {/* DOC-LINES-1: the line's value after its customer discount — the one line rule */}
                                {new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(lineNet(block))}
                            </span>
                        </div>
                    </div>
                </div>
                {/* 7. Save / Context Menu (Matched via Image context dots) - MOVED TO ACTION TOOLBAR */}

                {/* Removed Global Search Modal - replaced by sleek inline combobox */}
            </div>
        </div>
    );
}
