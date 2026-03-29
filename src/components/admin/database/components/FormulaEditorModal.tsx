import React, { useState, useEffect } from 'react';
import { Database, Property } from '../types';
import { X, Calculator, HelpCircle, Check, Info } from 'lucide-react';

interface FormulaEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    property: Property;
    database: Database;
    onSave: (expression: string) => void;
}

export default function FormulaEditorModal({ isOpen, onClose, property, database, onSave }: FormulaEditorModalProps) {
    const [expression, setExpression] = useState(property.config?.formulaExpression || '');

    useEffect(() => {
        if (isOpen) {
            setExpression(property.config?.formulaExpression || '');
        }
    }, [isOpen, property]);

    if (!isOpen) return null;

    const insertProp = (propName: string) => {
        setExpression(prev => prev + `prop("${propName}")`);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-neutral-900 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-neutral-200 dark:border-white/10">
                <div className="flex items-center justify-between p-4 border-b border-neutral-100 dark:border-white/5">
                    <div className="flex items-center gap-2 text-neutral-900 dark:text-white font-medium">
                        <Calculator className="w-5 h-5 text-blue-500" />
                        Formula Editor: {property.name}
                    </div>
                    <button onClick={onClose} className="p-1.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/5 transition">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Expression</label>
                        <textarea
                            value={expression}
                            onChange={(e) => setExpression(e.target.value)}
                            className="w-full h-32 p-3 bg-neutral-50 dark:bg-black border border-neutral-200 dark:border-white/10 rounded-xl font-mono text-sm leading-relaxed outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
                            placeholder='e.g., prop("Netto kostprijs") + prop("Marge€")'
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider flex items-center justify-between">
                            Available Properties
                            <div className="flex gap-1 text-[10px] lowercase items-center text-blue-500/80 bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 rounded-full">
                                <Info className="w-3 h-3" /> Click to insert
                            </div>
                        </label>
                        <div className="h-40 overflow-y-auto custom-scrollbar border border-neutral-100 dark:border-white/5 rounded-xl bg-neutral-50/50 dark:bg-black/20 p-2 flex flex-wrap gap-2 content-start">
                            {database.properties.filter(p => p.id !== property.id).map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => insertProp(p.name)}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-white/10 hover:border-blue-400 dark:hover:border-blue-500 rounded-lg text-xs font-medium text-neutral-700 dark:text-neutral-300 transition shadow-sm"
                                >
                                    <span className="opacity-60 font-mono text-[10px]">prop(</span>
                                    {p.name}
                                    <span className="opacity-60 font-mono text-[10px]">)</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-neutral-50 dark:bg-black/20 border-t border-neutral-100 dark:border-white/5 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-lg transition">
                        Cancel
                    </button>
                    <button onClick={() => { onSave(expression); onClose(); }} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition flex items-center gap-2">
                        <Check className="w-4 h-4" /> Save Formula
                    </button>
                </div>
            </div>
        </div>
    );
}
