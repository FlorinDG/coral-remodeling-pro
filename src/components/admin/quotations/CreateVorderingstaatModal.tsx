import React, { useState, useMemo } from 'react';
import { X, ClipboardCheck, Percent, HelpCircle, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Block, Page } from '../database/types';

interface CreateVorderingstaatModalProps {
    isOpen: boolean;
    onClose: () => void;
    blocks: Block[];
    projectId: string;
    project: Page;
    updatePageProperty: (dbId: string, pageId: string, key: string, value: any) => void;
    projectDbId: string;
    quotationId: string;
    quotationTitle: string;
    locale: string;
}

interface VorderingstaatItem {
    id: string;
    content: string;
    quantity: number;
    verkoopPrice: number;
    previousProgress: number; // 0-100
    currentProgress: number;  // 0-100 (entered by user)
}

export default function CreateVorderingstaatModal({
    isOpen,
    onClose,
    blocks,
    projectId,
    project,
    updatePageProperty,
    projectDbId,
    quotationId,
    quotationTitle,
    locale
}: CreateVorderingstaatModalProps) {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});
    const [progressInputs, setProgressInputs] = useState<Record<string, number>>({});

    // Linearize all line items from the quotation tree
    const quotationLines = useMemo(() => {
        const lines: Block[] = [];
        const traverse = (nodes: Block[]) => {
            nodes.forEach(node => {
                if ((node.type === 'line' || node.type === 'post') && !node.isOptional) {
                    lines.push(node);
                }
                if (node.children) {
                    traverse(node.children);
                }
            });
        };
        traverse(blocks);
        return lines;
    }, [blocks]);

    // Retrieve existing vorderingenstaten from the project properties
    const existingStates = useMemo(() => {
        return (project?.properties?.['vorderingenstaten'] as any[]) || [];
    }, [project]);

    // Compute previous progress (%) for each item
    const computedPreviousProgress = useMemo(() => {
        const progressMap: Record<string, number> = {};
        quotationLines.forEach(line => {
            let totalPrev = 0;
            existingStates.forEach(state => {
                const item = state.items?.find((i: any) => i.id === line.id);
                if (item) {
                    totalPrev += Number(item.currentProgress || 0);
                }
            });
            progressMap[line.id] = Math.min(100, Math.max(0, totalPrev));
        });
        return progressMap;
    }, [quotationLines, existingStates]);

    // Generate Vorderingstaat Number (e.g. VS-01, VS-02...)
    const stateNumber = useMemo(() => {
        const count = existingStates.length + 1;
        return `VS-${String(count).padStart(2, '0')}`;
    }, [existingStates]);

    if (!isOpen) return null;

    const handleToggleItem = (id: string) => {
        setSelectedItems(prev => ({ ...prev, [id]: !prev[id] }));
        if (!selectedItems[id]) {
            // Set default progress to the remaining percentage
            const remaining = 100 - (computedPreviousProgress[id] || 0);
            setProgressInputs(prev => ({ ...prev, [id]: Math.max(0, remaining) }));
        }
    };

    const handleProgressChange = (id: string, value: number) => {
        const prevProgress = computedPreviousProgress[id] || 0;
        const maxAllowed = 100 - prevProgress;
        const boundedValue = Math.min(maxAllowed, Math.max(0, value));
        setProgressInputs(prev => ({ ...prev, [id]: boundedValue }));
    };

    const handleSave = () => {
        const itemsToSave: any[] = [];
        let subtotal = 0;

        quotationLines.forEach(line => {
            if (selectedItems[line.id]) {
                const prev = computedPreviousProgress[line.id] || 0;
                const current = progressInputs[line.id] || 0;
                
                if (current > 0) {
                    const itemAmount = (line.quantity || 1) * (line.verkoopPrice || 0) * (current / 100);
                    subtotal += itemAmount;

                    itemsToSave.push({
                        id: line.id,
                        content: line.content || 'Onbenoemd item',
                        quantity: line.quantity || 1,
                        verkoopPrice: line.verkoopPrice || 0,
                        previousProgress: prev,
                        currentProgress: current,
                        amount: itemAmount
                    });
                }
            }
        });

        if (itemsToSave.length === 0) {
            toast.warning('Selecteer ten minste één item met een voortgang groter dan 0%.');
            return;
        }

        const vatRate = 0.21; // 21% default VAT
        const vatAmount = subtotal * vatRate;
        const total = subtotal + vatAmount;

        const newState = {
            id: `vs-${crypto.randomUUID()}`,
            number: stateNumber,
            date: selectedDate,
            quotationId,
            quotationTitle,
            status: 'draft',
            items: itemsToSave,
            totalExVat: Math.round(subtotal * 100) / 100,
            vatAmount: Math.round(vatAmount * 100) / 100,
            totalIncVat: Math.round(total * 100) / 100,
            createdAt: new Date().toISOString()
        };

        const updatedStates = [...existingStates, newState];
        updatePageProperty(projectDbId, projectId, 'vorderingenstaten', updatedStates);

        toast.success(`Vorderingstaat ${stateNumber} succesvol gegenereerd!`);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 transition-opacity">
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in zoom-in duration-200">
                
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-white/10 bg-neutral-50/80 dark:bg-neutral-800/40">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                            <ClipboardCheck className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold tracking-tight text-neutral-900 dark:text-white">
                                Vorderingstaat Aanmaken — {stateNumber}
                            </h2>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                Project: {String(project.properties['title'] || project.properties['name'] || 'Huidig Project')}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 dark:hover:bg-white/5 transition-all"
                        id="close-vs-modal"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form controls */}
                <div className="flex gap-4 p-6 bg-neutral-50/50 dark:bg-neutral-950/20 border-b border-neutral-200 dark:border-white/10 flex-wrap">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Status Datum</label>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-white/10 rounded-lg text-xs font-semibold px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-neutral-800 dark:text-white"
                            id="vs-date-picker"
                        />
                    </div>
                </div>

                {/* Main Table Area */}
                <div className="flex-1 overflow-y-auto p-6">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-neutral-200 dark:border-white/10 text-neutral-400 font-bold text-[10px] uppercase tracking-wider">
                                <th className="py-3 px-2 w-10">Select</th>
                                <th className="py-3 px-3">Beschrijving</th>
                                <th className="py-3 px-3 text-right">Prijs (ex)</th>
                                <th className="py-3 px-3 text-right w-24">Cumul. Vor.</th>
                                <th className="py-3 px-3 text-right w-28">Nieuwe Vor.</th>
                                <th className="py-3 px-3 text-right w-32">Bedrag Periode</th>
                            </tr>
                        </thead>
                        <tbody>
                            {quotationLines.map(line => {
                                const isSelected = !!selectedItems[line.id];
                                const prev = computedPreviousProgress[line.id] || 0;
                                const current = progressInputs[line.id] || 0;
                                const isFullyInvoiced = prev >= 100;
                                const amount = (line.quantity || 1) * (line.verkoopPrice || 0) * (current / 100);

                                return (
                                    <tr 
                                        key={line.id}
                                        className={`border-b border-neutral-100 dark:border-white/5 transition-colors group ${
                                            isFullyInvoiced ? 'opacity-40' : 'hover:bg-neutral-50 dark:hover:bg-white/5'
                                        }`}
                                    >
                                        <td className="py-4 px-2">
                                            <button
                                                onClick={() => !isFullyInvoiced && handleToggleItem(line.id)}
                                                disabled={isFullyInvoiced}
                                                className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                                                    isSelected
                                                        ? 'bg-indigo-600 border-indigo-600 text-white'
                                                        : 'border-neutral-300 dark:border-neutral-700 hover:border-neutral-400'
                                                } disabled:cursor-not-allowed`}
                                                id={`vs-check-${line.id}`}
                                            >
                                                {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                            </button>
                                        </td>
                                        <td className="py-4 px-3">
                                            <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 leading-tight">
                                                {line.content || 'Onbenoemd item'}
                                            </p>
                                            <p className="text-[10px] text-neutral-400 mt-0.5">
                                                Aantal: {line.quantity || 1} {line.unit || 'st'} × €{(line.verkoopPrice || 0).toFixed(2)}
                                            </p>
                                        </td>
                                        <td className="py-4 px-3 text-right font-medium text-xs text-neutral-600 dark:text-neutral-400">
                                            €{((line.quantity || 1) * (line.verkoopPrice || 0)).toFixed(2)}
                                        </td>
                                        <td className="py-4 px-3 text-right">
                                            <span className="inline-flex items-center gap-0.5 text-xs font-bold text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-white/5 px-2 py-0.5 rounded-full">
                                                {prev}%
                                            </span>
                                        </td>
                                        <td className="py-4 px-3">
                                            {isSelected ? (
                                                <div className="flex items-center bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg px-2 py-1 max-w-[90px] ml-auto">
                                                    <input
                                                        type="number"
                                                        value={current}
                                                        onChange={(e) => handleProgressChange(line.id, parseFloat(e.target.value) || 0)}
                                                        className="w-full text-right bg-transparent text-xs font-bold focus:outline-none text-neutral-800 dark:text-white"
                                                        min={0}
                                                        max={100 - prev}
                                                        id={`vs-input-${line.id}`}
                                                    />
                                                    <Percent className="w-3 h-3 text-neutral-400 ml-1 flex-shrink-0" />
                                                </div>
                                            ) : (
                                                <span className="text-xs text-neutral-400 italic flex justify-end pr-2">-</span>
                                            )}
                                        </td>
                                        <td className="py-4 px-3 text-right font-mono text-xs font-bold text-neutral-900 dark:text-white">
                                            {isSelected && current > 0 ? `€${amount.toFixed(2)}` : '€0.00'}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Footer and Summary */}
                <div className="px-6 py-4 border-t border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-neutral-800/20 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold">Totaal deze periode</p>
                        <p className="text-lg font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
                            €{quotationLines.reduce((sum, line) => {
                                if (selectedItems[line.id]) {
                                    const current = progressInputs[line.id] || 0;
                                    return sum + ((line.quantity || 1) * (line.verkoopPrice || 0) * (current / 100));
                                }
                                return sum;
                            }, 0).toFixed(2)} <span className="text-[10px] font-normal text-neutral-400">(excl. BTW)</span>
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 border border-neutral-200 dark:border-white/10 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-xl text-xs font-bold text-neutral-600 dark:text-neutral-300 transition-colors"
                        >
                            Annuleren
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20"
                            id="submit-vorderingstaat"
                        >
                            Vorderingstaat Genereren
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
