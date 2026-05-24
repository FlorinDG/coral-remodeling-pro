'use client';

import { useState } from 'react';
import { Database, FilterRule, Property } from '@/components/admin/database/types';
import { X, Plus, Trash2, Layers } from 'lucide-react';
import SearchableSelect from '@/components/ui/SearchableSelect';

interface PerspectiveBuilderProps {
    database: Database;
    onClose: () => void;
    onSave: (name: string, filters: FilterRule[]) => void;
}

export function PerspectiveBuilder({ database, onClose, onSave }: PerspectiveBuilderProps) {
    const [name, setName] = useState('');
    const [rules, setRules] = useState<Omit<FilterRule, 'id'>[]>([]);

    // Allow filtering on standard select/checkbox/date properties for task manager simplicity
    const filterableProperties = database.properties.filter(p =>
        ['select', 'checkbox', 'date', 'multi_select', 'text'].includes(p.type)
    );

    const handleAddRule = () => {
        const firstProp = filterableProperties[0];
        if (!firstProp) return;
        setRules(prev => [
            ...prev,
            {
                propertyId: firstProp.id,
                operator: 'equals',
                value: firstProp.type === 'checkbox' ? 'true' : '',
            },
        ]);
    };

    const handleRemoveRule = (index: number) => {
        setRules(prev => prev.filter((_, i) => i !== index));
    };

    const handleRuleChange = (index: number, updates: Partial<Omit<FilterRule, 'id'>>) => {
        setRules(prev =>
            prev.map((r, i) => {
                if (i !== index) return r;
                const nextRule = { ...r, ...updates };
                // Reset value when property changes to match the new type's defaults
                if (updates.propertyId) {
                    const newProp = filterableProperties.find(p => p.id === updates.propertyId);
                    if (newProp) {
                        nextRule.value = newProp.type === 'checkbox' ? 'true' : '';
                        nextRule.operator = 'equals';
                    }
                }
                return nextRule;
            })
        );
    };

    const handleSave = () => {
        if (!name.trim()) return;
        // Generate rules with stable IDs
        const finalRules: FilterRule[] = rules.map((r, i) => ({
            ...r,
            id: `rule-${Date.now()}-${i}`,
        })) as FilterRule[];

        onSave(name.trim(), finalRules);
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col select-none animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="p-4 border-b border-neutral-200 dark:border-white/10 flex items-center justify-between bg-neutral-50 dark:bg-white/[0.02]">
                    <div className="flex items-center gap-2">
                        <Layers className="w-5 h-5 text-orange-500" />
                        <span className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
                            Create Smart Perspective
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-neutral-200 dark:hover:bg-white/10 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Form Body */}
                <div className="p-5 flex-1 overflow-y-auto space-y-4">
                    {/* Name */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                            Perspective Name
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="e.g. Urgent Office Projects"
                            className="w-full px-3.5 py-2.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-xl text-sm text-neutral-900 dark:text-white outline-none focus:border-orange-500 transition-colors"
                        />
                    </div>

                    {/* Filter Rules List */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                                Filter Rules (Matching ALL)
                            </span>
                            <button
                                onClick={handleAddRule}
                                className="text-xs font-semibold text-orange-500 hover:text-orange-600 flex items-center gap-1 transition-colors"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                Add Rule
                            </button>
                        </div>

                        {rules.length > 0 ? (
                            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                                {rules.map((rule, idx) => {
                                    const propDef = filterableProperties.find(p => p.id === rule.propertyId);

                                    return (
                                        <div
                                            key={idx}
                                            className="flex items-center gap-2 bg-neutral-50 dark:bg-neutral-900/50 p-2 border border-neutral-200 dark:border-white/5 rounded-xl"
                                        >
                                            {/* Property Select */}
                                            <SearchableSelect
                                                options={filterableProperties.map(p => ({ value: p.id, label: p.name }))}
                                                value={rule.propertyId}
                                                onChange={(v) => handleRuleChange(idx, { propertyId: v })}
                                                placeholder="Property"
                                                searchPlaceholder="Search properties..."
                                            />

                                            {/* Operator Select */}
                                            <SearchableSelect
                                                options={[
                                                    { value: 'equals', label: 'equals' },
                                                    { value: 'does_not_equal', label: 'does not equal' },
                                                    ...(propDef?.type === 'text' ? [{ value: 'contains', label: 'contains' }] : []),
                                                    { value: 'is_empty', label: 'is empty' },
                                                    { value: 'is_not_empty', label: 'is not empty' },
                                                ]}
                                                value={rule.operator}
                                                onChange={(v) => handleRuleChange(idx, { operator: v as any })}
                                                placeholder="Operator"
                                            />

                                            {/* Value inputs based on type */}
                                            {rule.operator !== 'is_empty' && rule.operator !== 'is_not_empty' && (
                                                <div className="flex-1 min-w-[120px]">
                                                    {propDef?.type === 'select' && (
                                                        <SearchableSelect
                                                            options={[
                                                                { value: '', label: 'Select option...' },
                                                                ...(propDef.config?.options?.map(o => ({ value: o.id, label: o.name })) || []),
                                                            ]}
                                                            value={String(rule.value ?? '')}
                                                            onChange={(v) => handleRuleChange(idx, { value: v })}
                                                            placeholder="Select option..."
                                                            searchPlaceholder="Search options..."
                                                        />
                                                    )}

                                                    {propDef?.type === 'checkbox' && (
                                                        <SearchableSelect
                                                            options={[
                                                                { value: 'true', label: 'Checked (True)' },
                                                                { value: 'false', label: 'Unchecked (False)' },
                                                            ]}
                                                            value={String(rule.value ?? '')}
                                                            onChange={(v) => handleRuleChange(idx, { value: v })}
                                                            placeholder="Value"
                                                        />
                                                    )}

                                                    {propDef?.type === 'date' && (
                                                        <input
                                                            type="date"
                                                            value={String(rule.value ?? '')}
                                                            onChange={e => handleRuleChange(idx, { value: e.target.value })}
                                                            className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-neutral-800 dark:text-neutral-200 outline-none"
                                                        />
                                                    )}

                                                    {propDef?.type !== 'select' && propDef?.type !== 'checkbox' && propDef?.type !== 'date' && (
                                                        <input
                                                            type="text"
                                                            value={String(rule.value ?? '')}
                                                            onChange={e => handleRuleChange(idx, { value: e.target.value })}
                                                            placeholder="Value..."
                                                            className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-neutral-800 dark:text-neutral-200 outline-none"
                                                        />
                                                    )}
                                                </div>
                                            )}

                                            {/* Trash button */}
                                            <button
                                                onClick={() => handleRemoveRule(idx)}
                                                className="p-1 text-neutral-400 hover:text-red-500 transition-colors"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="h-28 border border-dashed border-neutral-200 dark:border-white/10 rounded-2xl flex flex-col items-center justify-center text-xs text-neutral-400 select-none">
                                No filters defined. This perspective will show all active tasks.
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-neutral-200 dark:border-white/10 flex items-center justify-end gap-2 bg-neutral-50 dark:bg-white/[0.02]">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-semibold border border-neutral-200 dark:border-white/10 text-neutral-600 dark:text-neutral-300 rounded-lg hover:bg-neutral-150/40 dark:hover:bg-white/5 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!name.trim()}
                        className="px-4 py-2 text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        Save Perspective
                    </button>
                </div>
            </div>
        </div>
    );
}
