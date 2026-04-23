import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/time-tracker/components/ui/dialog';
import { Save, AlertTriangle, ArrowRight, Check } from 'lucide-react';
import { Block, Database } from '@/components/admin/database/types';
import { useDatabaseStore } from '@/components/admin/database/store';

interface SaveToLibraryModalProps {
    isOpen: boolean;
    onClose: () => void;
    block: Block;
    onSaveSuccess: (articleId: string) => void;
}

export default function SaveToLibraryModal({ isOpen, onClose, block, onSaveSuccess }: SaveToLibraryModalProps) {
    const [db, setDb] = useState<Database | undefined>();
    const [existingArticle, setExistingArticle] = useState<any>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [propMap, setPropMap] = useState<Record<string, string>>({});

    useEffect(() => {
        if (!isOpen) return;

        const articleDb = useDatabaseStore.getState().getDatabase('db-articles');
        if (!articleDb) return;
        setDb(articleDb);

        const findPropId = (keywords: string[]) => {
            return articleDb.properties.find(p => p.name && keywords.some(k => p.name.toLowerCase().includes(k.toLowerCase())))?.id;
        };

        const map = {
            title: findPropId(['naam', 'titel', 'title', 'name', 'artikel', 'code', 'omschrijving']) || 'title',
            bruto: findPropId(['bruto', 'brutoprijs', 'kost', 'prijs', 'price', 'inkoop']) || '',
            verkoop: findPropId(['verkoop', 'selling']) || '',
            marge: findPropId(['marge', 'margin']) || '',
            discount: findPropId(['korting', 'remise', 'discount', 'disc', 'lever']) || '',
            unit: findPropId(['eenheid', 'unit', 'maat', 'eeh']) || '',
            type: findPropId(['type', 'calculatietype', 'calculationtype']) || ''
        };
        setPropMap(map);

        if (block.articleId) {
            const page = articleDb.pages.find(p => p.id === block.articleId);
            setExistingArticle(page || null);
        } else {
            setExistingArticle(null);
        }
    }, [isOpen, block.articleId]);

    const handleConfirm = () => {
        if (!db) return;
        setIsSaving(true);

        const cleanHtml = (html: string | undefined) => {
            if (!html) return '';
            return html.replace(/<[^>]*>?/gm, '').trim() || 'Nieuw Artikel';
        };

        const updates: Record<string, any> = {};
        updates[propMap.title] = cleanHtml(block.content);
        if (propMap.bruto && block.brutoPrice !== undefined) updates[propMap.bruto] = block.brutoPrice;
        if (propMap.verkoop && block.verkoopPrice !== undefined) updates[propMap.verkoop] = block.verkoopPrice;
        if (propMap.marge && block.margePercent !== undefined) updates[propMap.marge] = block.margePercent;
        if (propMap.discount && block.discountPercent !== undefined) updates[propMap.discount] = block.discountPercent;
        if (propMap.unit && block.unit !== undefined) updates[propMap.unit] = block.unit;
        if (propMap.type && block.calculationType !== undefined) updates[propMap.type] = block.calculationType;

        const store = useDatabaseStore.getState();
        let targetId = block.articleId;

        if (existingArticle) {
            // Overwrite existing article in global DB
            Object.entries(updates).forEach(([prodId, val]) => {
                store.updatePageProperty('db-articles', existingArticle.id, prodId, val);
            });
            targetId = existingArticle.id;
        } else {
            // Create new article
            const newPage = store.createPage('db-articles', updates);
            targetId = newPage.id;
        }

        setTimeout(() => {
            setIsSaving(false);
            onSaveSuccess(targetId as string);
            onClose();
        }, 600); // UI feedback delay
    };

    if (!isOpen || !db) return null;

    const rowName = block.content ? block.content.replace(/<[^>]*>?/gm, '') : 'Nieuw Artikel';
    const isEdit = !!existingArticle;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px] border-none bg-white dark:bg-[#0a0a0a] text-black dark:text-white shadow-2xl p-0">
                <DialogHeader className="p-6 pb-4 border-b border-neutral-100 dark:border-white/10">
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        {isEdit ? <AlertTriangle className="w-5 h-5 text-orange-500" /> : <Save className="w-5 h-5 text-blue-500" />}
                        {isEdit ? 'Update Global Article' : 'Save New Article'}
                    </DialogTitle>
                    <DialogDescription className="text-sm text-neutral-500 mt-1">
                        {isEdit
                            ? "This item is already linked to the Article Library. Saving will permanently overwrite the global database entry for all future uses."
                            : "Saving this custom row will inject it directly into your global Article Library so you can search and reuse it everywhere."}
                    </DialogDescription>
                </DialogHeader>

                <div className="px-6 py-4 flex flex-col gap-4 bg-neutral-50/50 dark:bg-black/20">

                    {isEdit && (
                        <div className="flex flex-col gap-2 p-3 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-lg">
                            <h4 className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">Warning: Global Overwrite</h4>
                            <p className="text-xs text-red-800 dark:text-red-200">
                                This action will modify the base article <strong>{existingArticle.properties?.[propMap.title] || 'Unknown'}</strong>. Any future quotations or variants using this article will pull the new values.
                            </p>
                        </div>
                    )}

                    <div className="flex flex-col gap-3">
                        <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Data to Save</h4>

                        <div className="border border-neutral-200 dark:border-white/10 rounded-lg overflow-hidden text-sm">
                            <div className="grid grid-cols-3 p-3 bg-white dark:bg-[#111] border-b border-neutral-100 dark:border-white/5">
                                <span className="text-neutral-500 font-medium">Name:</span>
                                <span className="col-span-2 font-bold line-clamp-2">{rowName}</span>
                            </div>
                            <div className="grid grid-cols-3 p-3 bg-neutral-50 dark:bg-black/40 border-b border-neutral-100 dark:border-white/5">
                                <span className="text-neutral-500 font-medium">Bruto / Gross:</span>
                                <span className="col-span-2">€{block.brutoPrice?.toFixed(2) || '0.00'}</span>
                            </div>
                            <div className="grid grid-cols-3 p-3 bg-white dark:bg-[#111] border-b border-neutral-100 dark:border-white/5">
                                <span className="text-neutral-500 font-medium">Shop Discount:</span>
                                <span className="col-span-2 font-bold text-red-500">{block.discountPercent || 0}%</span>
                            </div>
                            <div className="grid grid-cols-3 p-3 bg-neutral-50 dark:bg-black/40 border-b border-neutral-100 dark:border-white/5">
                                <span className="text-neutral-500 font-medium">Margin:</span>
                                <span className="col-span-2">{block.margePercent || 0}%</span>
                            </div>
                            <div className="grid grid-cols-3 p-3 bg-white dark:bg-[#111]">
                                <span className="text-neutral-500 font-medium">Unit:</span>
                                <span className="col-span-2">{block.unit || 'stk'} <span className="text-neutral-400 ml-2">({block.calculationType || 'materieel'})</span></span>
                            </div>
                        </div>
                    </div>

                </div>

                <DialogFooter className="p-6 pt-4 border-t border-neutral-100 dark:border-white/10 flex items-center justify-between">
                    <button
                        onClick={onClose}
                        className="text-sm font-semibold text-neutral-500 hover:text-black dark:hover:text-white transition-colors"
                        disabled={isSaving}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isSaving}
                        className={`text-sm font-bold flex items-center gap-2 py-2 px-5 rounded-lg transition-colors ${isEdit
                                ? 'bg-orange-600 hover:bg-orange-700 text-white'
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                            }`}
                    >
                        {isSaving ? (
                            <><Check className="w-4 h-4" /> Saving...</>
                        ) : (
                            <>{isEdit ? 'Confirm Overwrite' : 'Save as New Article'} <ArrowRight className="w-4 h-4" /></>
                        )}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
