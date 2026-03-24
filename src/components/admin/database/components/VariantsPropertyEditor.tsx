"use client";

import React, { useState } from 'react';
import { useDatabaseStore } from '../store';
import { VariantsConfig, VariantAxis, VariantOption } from '../types';
import { Settings2, Plus, Trash2, X } from 'lucide-react';

interface Props {
    databaseId: string;
    pageId: string;
    propertyId: string;
    initialConfig: VariantsConfig;
}

export default function VariantsPropertyEditor({ databaseId, pageId, propertyId, initialConfig }: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const updatePageProperty = useDatabaseStore(state => state.updatePageProperty);
    const config: VariantsConfig = Array.isArray(initialConfig) ? initialConfig : [];

    const handleSave = (newConfig: VariantsConfig) => {
        updatePageProperty(databaseId, pageId, propertyId, newConfig);
    };

    const addAxis = () => {
        const newAxis: VariantAxis = {
            id: `axis-${Math.random().toString(36).substring(7)}`,
            name: 'New Axis',
            options: []
        };
        handleSave([...config, newAxis]);
    };

    const updateAxisName = (axisId: string, name: string) => {
        handleSave(config.map(a => a.id === axisId ? { ...a, name } : a));
    };

    const deleteAxis = (axisId: string) => {
        handleSave(config.filter(a => a.id !== axisId));
    };

    const addOption = (axisId: string) => {
        handleSave(config.map(a => {
            if (a.id === axisId) {
                return {
                    ...a,
                    options: [...a.options, { id: `opt-${Math.random().toString(36).substring(7)}`, name: 'New Option', priceDelta: 0 }]
                };
            }
            return a;
        }));
    };

    const updateOption = (axisId: string, optId: string, updates: Partial<VariantOption>) => {
        handleSave(config.map(a => {
            if (a.id === axisId) {
                return {
                    ...a,
                    options: a.options.map(o => o.id === optId ? { ...o, ...updates } : o)
                };
            }
            return a;
        }));
    };

    const deleteOption = (axisId: string, optId: string) => {
        handleSave(config.map(a => {
            if (a.id === axisId) {
                return { ...a, options: a.options.filter(o => o.id !== optId) };
            }
            return a;
        }));
    };

    return (
        <div className="relative w-full h-full">
            <button
                onClick={() => setIsOpen(true)}
                className="w-full h-full flex items-center justify-between px-2 bg-neutral-100 dark:bg-black/40 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors text-xs font-medium text-neutral-700 dark:text-neutral-300"
            >
                <div className="flex items-center gap-1.5">
                    <Settings2 className="w-3.5 h-3.5 opacity-70" />
                    <span>{config.length > 0 ? `${config.length} Axes` : 'Configure'}</span>
                </div>
                <div className="text-[10px] text-neutral-400">
                    {config.reduce((acc, ax) => acc + ax.options.length, 0)} Options
                </div>
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-[#1a1a1a] border border-neutral-200 dark:border-white/10 w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-xl shadow-2xl flex flex-col">
                        <div className="sticky top-0 bg-white/90 dark:bg-[#1a1a1a]/90 backdrop-blur border-b border-neutral-200 dark:border-white/10 p-4 flex items-center justify-between z-10">
                            <div>
                                <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Product Variants</h3>
                                <p className="text-xs text-neutral-500">Configure multi-axis dimensions like Color, Size, and corresponding price adjustments.</p>
                            </div>
                            <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md transition-colors">
                                <X className="w-5 h-5 text-neutral-500" />
                            </button>
                        </div>

                        <div className="p-4 flex flex-col gap-6">
                            {config.map(axis => (
                                <div key={axis.id} className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden bg-neutral-50 dark:bg-black/20">
                                    <div className="bg-neutral-100 dark:bg-neutral-800/50 p-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                                        <input
                                            value={axis.name}
                                            onChange={(e) => updateAxisName(axis.id, e.target.value)}
                                            className="bg-transparent font-bold text-sm text-neutral-900 dark:text-white outline-none w-[200px]"
                                            placeholder="Axis Name (e.g. Color)"
                                        />
                                        <button onClick={() => deleteAxis(axis.id)} className="text-red-500 hover:text-red-600 p-1">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="p-3 flex flex-col gap-2">
                                        {axis.options.map(opt => (
                                            <div key={opt.id} className="flex items-center gap-3">
                                                <input
                                                    value={opt.name}
                                                    onChange={(e) => updateOption(axis.id, opt.id, { name: e.target.value })}
                                                    className="flex-1 bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded px-2 py-1 text-sm outline-none focus:border-orange-500"
                                                    placeholder="Option Name (e.g. Matte Black)"
                                                />
                                                <div className="flex items-center gap-1 w-[120px]">
                                                    <span className="text-xs text-neutral-500">€</span>
                                                    <input
                                                        type="number"
                                                        value={opt.priceDelta}
                                                        onChange={(e) => updateOption(axis.id, opt.id, { priceDelta: parseFloat(e.target.value) || 0 })}
                                                        className="w-full bg-white dark:bg-[#111] border border-neutral-200 dark:border-neutral-800 rounded px-2 py-1 text-sm outline-none focus:border-orange-500"
                                                        placeholder="Delta (+20)"
                                                    />
                                                </div>
                                                <button onClick={() => deleteOption(axis.id, opt.id)} className="p-1.5 text-neutral-400 hover:text-red-500 transition-colors rounded">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                        <button
                                            onClick={() => addOption(axis.id)}
                                            className="flex items-center gap-1.5 text-xs font-semibold text-orange-600 dark:text-orange-400 mt-2 hover:opacity-80 transition-opacity w-fit"
                                        >
                                            <Plus className="w-3.5 h-3.5" /> Add Option
                                        </button>
                                    </div>
                                </div>
                            ))}

                            <button
                                onClick={addAxis}
                                className="w-full py-3 border-2 border-dashed border-neutral-300 dark:border-neutral-700 rounded-lg flex items-center justify-center gap-2 text-sm font-semibold text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:border-neutral-400 dark:hover:border-neutral-500 transition-colors"
                            >
                                <Plus className="w-4 h-4" /> Add Configuration Axis
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
