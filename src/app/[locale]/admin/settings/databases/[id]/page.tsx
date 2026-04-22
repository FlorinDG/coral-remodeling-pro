'use client';

import React, { useEffect, useState } from 'react';
import { useDatabaseStore } from '@/components/admin/database/store';
import { Property, PropertyType } from '@/components/admin/database/types';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Database as DatabaseIcon, Plus, Save, Trash, Type, Hash, Link as LinkIcon, Calculator, CheckSquare, Calendar, Euro, Percent, Edit3, Settings2, GripVertical, X } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import FormulaEditorModal from '@/components/admin/database/components/FormulaEditorModal';

const PROPERTY_TYPES: { id: PropertyType; label: string; icon: React.FC<any> }[] = [
    { id: 'text', label: 'Text', icon: Type },
    { id: 'number', label: 'Number', icon: Hash },
    { id: 'currency', label: 'Currency (€/$)', icon: Euro },
    { id: 'percent', label: 'Percentage', icon: Percent },
    { id: 'checkbox', label: 'Checkbox', icon: CheckSquare },
    { id: 'date', label: 'Date', icon: Calendar },
    { id: 'select', label: 'Select', icon: Edit3 },
    { id: 'multi_select', label: 'Multi-Select', icon: Edit3 },
    { id: 'relation', label: 'Relation Link', icon: LinkIcon },
    { id: 'rollup', label: 'Rollup Lookup', icon: LinkIcon },
    { id: 'formula', label: 'Calculation Formula', icon: Calculator },
    { id: 'variants', label: 'Product Variants', icon: Settings2 },
];

export default function DatabaseSchemaConfigurator() {
    const params = useParams();
    const router = useRouter();
    const databaseId = params.id as string;

    const database = useDatabaseStore(state => state.getDatabase(databaseId));
    const allDatabases = useDatabaseStore(state => state.databases);

    const updateProperty = useDatabaseStore(state => state.updateProperty);
    const deleteProperty = useDatabaseStore(state => state.deleteProperty);
    const addProperty = useDatabaseStore(state => state.addProperty);
    const updatePropertyOrder = useDatabaseStore(state => state.updatePropertyOrder);

    const [isHydrated, setIsHydrated] = useState(false);
    const [editingPropId, setEditingPropId] = useState<string | null>(null);
    const [newPropName, setNewPropName] = useState('');
    const [formulaEditingProp, setFormulaEditingProp] = useState<Property | null>(null);

    const handleDragEnd = (result: DropResult) => {
        if (!result.destination || result.source.index === result.destination.index) return;
        updatePropertyOrder(databaseId, result.source.index, result.destination.index);
    };

    useEffect(() => {
        // Wait for Zustand persist to finish hydrating from IndexedDB
        if (useDatabaseStore.persist.hasHydrated()) {
            setIsHydrated(true);
        } else {
            const unsub = useDatabaseStore.persist.onFinishHydration(() => {
                setIsHydrated(true);
            });
            return unsub;
        }
    }, []);

    if (!isHydrated) return <div className="p-8"><div className="w-full h-32 bg-neutral-100 dark:bg-white/5 animate-pulse rounded-xl" /></div>;
    if (!database) return <div className="p-8 text-neutral-500">Database not found.</div>;

    const handleCreateProperty = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPropName.trim()) return;
        addProperty(databaseId, newPropName.trim(), 'text');
        setNewPropName('');
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6 pb-24">
            <button
                onClick={() => router.push('/admin/settings/databases')}
                className="flex items-center text-sm font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition group"
            >
                <ChevronLeft className="w-4 h-4 mr-1 transition-transform group-hover:-translate-x-1" />
                Back to Databases
            </button>

            <div className="flex flex-col gap-2 p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-2xl">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-blue-50/50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xl">
                        {database.icon || <DatabaseIcon className="w-6 h-6" />}
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">{database.name}</h1>
                        <p className="text-sm text-neutral-500">Schema Management Dashboard</p>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-neutral-200 dark:border-white/10 bg-neutral-50/50 dark:bg-black/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-base font-semibold text-neutral-900 dark:text-white">Properties Database Schema</h2>
                        <p className="text-xs text-neutral-500 mt-0.5">Define the strict types and column variables for every row.</p>
                    </div>

                    <form onSubmit={handleCreateProperty} className="flex items-center gap-2">
                        <input
                            type="text"
                            placeholder="New Column Name..."
                            value={newPropName}
                            onChange={e => setNewPropName(e.target.value)}
                            className="bg-white dark:bg-black border border-neutral-300 dark:border-white/20 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[200px]"
                        />
                        <button
                            type="submit"
                            disabled={!newPropName.trim()}
                            className="px-3 py-1.5 bg-neutral-900 dark:bg-white text-white dark:text-black rounded-lg text-sm font-medium hover:bg-neutral-800 dark:hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-1.5"
                        >
                            <Plus className="w-4 h-4" />
                            Add Column
                        </button>
                    </form>
                </div>

                <DragDropContext onDragEnd={handleDragEnd}>
                    <Droppable droppableId="schema-properties-list">
                        {(provided) => (
                            <div
                                {...provided.droppableProps}
                                ref={provided.innerRef}
                                className="divide-y divide-neutral-100 dark:divide-white/5"
                            >
                                {database.properties.map((prop, index) => {
                                    const isTitle = prop.id === 'title';
                                    const Icon = PROPERTY_TYPES.find(t => t.id === prop.type)?.icon || Type;

                                    return (
                                        <Draggable key={prop.id} draggableId={prop.id} index={index} isDragDisabled={isTitle}>
                                            {(provided, snapshot) => (
                                                <div
                                                    ref={provided.innerRef}
                                                    {...provided.draggableProps}
                                                    className={`p-4 transition-colors flex flex-col md:flex-row md:items-start gap-4 ${snapshot.isDragging ? 'bg-white dark:bg-neutral-800 shadow-xl ring-1 ring-neutral-200 dark:ring-white/20 rounded-xl z-50' : 'hover:bg-neutral-50 dark:hover:bg-white/[0.02]'}`}
                                                >
                                                    <div className="flex-1 flex flex-col gap-1 min-w-[250px]">
                                                        <div className="flex items-center gap-2">
                                                            <div
                                                                {...provided.dragHandleProps}
                                                                className={`p-1 rounded text-neutral-400 ${isTitle ? 'opacity-0 cursor-default' : 'hover:text-neutral-600 dark:hover:text-neutral-200 cursor-grab active:cursor-grabbing'}`}
                                                            >
                                                                <GripVertical className="w-4 h-4" />
                                                            </div>
                                                            <Icon className="w-4 h-4 text-neutral-400" />
                                                            <input
                                                                value={prop.name}
                                                                onChange={(e) => updateProperty(databaseId, prop.id, { name: e.target.value })}
                                                                className="bg-transparent text-sm font-semibold text-neutral-900 dark:text-neutral-100 border-b border-transparent hover:border-neutral-300 focus:border-blue-500 outline-none px-1 py-0.5 transition w-full max-w-[200px]"
                                                            />
                                                            {isTitle && <span className="text-[10px] px-2 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-bold uppercase tracking-wider">Primary Key</span>}
                                                        </div>
                                                        <span className="text-xs text-neutral-500 ml-7 font-mono opacity-60">ID: {prop.id}</span>
                                                    </div>

                                                    <div className="flex-[2] flex flex-wrap items-center gap-4">
                                                        <div className="flex flex-col gap-1 w-[180px]">
                                                            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 px-1">Column Type</span>
                                                            <select
                                                                value={prop.type}
                                                                disabled={isTitle}
                                                                onChange={(e) => updateProperty(databaseId, prop.id, { type: e.target.value as PropertyType })}
                                                                className="w-full bg-white dark:bg-black border border-neutral-300 dark:border-white/20 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                                            >
                                                                {PROPERTY_TYPES.map(t => (
                                                                    <option key={t.id} value={t.id}>{t.label}</option>
                                                                ))}
                                                                {/* Specialized unlisted types */}
                                                                {isTitle && <option value="text">Primary Text</option>}
                                                            </select>
                                                        </div>

                                                        {/* Type Contextual Configurations */}
                                                        {(prop.type === 'select' || prop.type === 'multi_select') && (
                                                            <div className="flex flex-col gap-1 w-full min-w-[200px] mt-2 xl:mt-0 xl:w-auto xl:flex-1">
                                                                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 px-1">Options Editor</span>
                                                                <div className="flex flex-wrap gap-1.5 p-1 bg-neutral-50 dark:bg-black/20 border border-neutral-200 dark:border-white/10 rounded-lg min-h-[34px] items-center">
                                                                    {prop.config?.options?.map(opt => (
                                                                        <div key={opt.id} className="flex items-center gap-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-white/20 px-1.5 py-0.5 rounded text-xs">
                                                                            <span>{opt.name}</span>
                                                                            <button
                                                                                onClick={() => updateProperty(databaseId, prop.id, { config: { ...prop.config, options: prop.config?.options?.filter(o => o.id !== opt.id) || [] } })}
                                                                                className="text-neutral-400 hover:text-red-500 rounded p-0.5 translate-x-1"
                                                                                title="Remove Option"
                                                                            >
                                                                                <X className="w-3 h-3" />
                                                                            </button>
                                                                        </div>
                                                                    ))}
                                                                    <button
                                                                        onClick={() => {
                                                                            const name = prompt('New option name:');
                                                                            if (name) updateProperty(databaseId, prop.id, { config: { ...prop.config, options: [...(prop.config?.options || []), { id: `opt-${Date.now()}`, name, color: 'gray' }] } });
                                                                        }}
                                                                        className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded font-medium hover:bg-blue-50 dark:hover:bg-blue-500/10 transition"
                                                                    >
                                                                        + Add Option
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {prop.type === 'currency' && (
                                                            <div className="flex flex-col gap-1 w-[120px]">
                                                                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 px-1">Format</span>
                                                                <select
                                                                    value={prop.config?.format || 'euro'}
                                                                    onChange={(e) => updateProperty(databaseId, prop.id, { config: { ...prop.config, format: e.target.value as any } })}
                                                                    className="w-full bg-white dark:bg-black border border-neutral-300 dark:border-white/20 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                                                >
                                                                    <option value="euro">Euro (€)</option>
                                                                    <option value="dollar">Dollar ($)</option>
                                                                </select>
                                                            </div>
                                                        )}

                                                        {prop.type === 'relation' && (
                                                            <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                                                                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 px-1">Target Database</span>
                                                                <div className="flex gap-2">
                                                                    <select
                                                                        value={prop.config?.relationDatabaseId || ''}
                                                                        onChange={(e) => updateProperty(databaseId, prop.id, { config: { ...prop.config, relationDatabaseId: e.target.value, relationDisplayPropertyId: '' } })}
                                                                        className="w-1/2 bg-white dark:bg-black border border-neutral-300 dark:border-white/20 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                                                    >
                                                                        <option value="">-- Choose Database --</option>
                                                                        {allDatabases.filter(d => d.id !== databaseId && d.name !== 'New Workspace').map(d => (
                                                                            <option key={d.id} value={d.id}>{d.icon} {d.name}</option>
                                                                        ))}
                                                                    </select>
                                                                    {prop.config?.relationDatabaseId && (
                                                                        <select
                                                                            value={prop.config.relationDisplayPropertyId || ''}
                                                                            onChange={(e) => updateProperty(databaseId, prop.id, { config: { ...prop.config, relationDisplayPropertyId: e.target.value } })}
                                                                            className="w-1/2 bg-white dark:bg-black border border-neutral-300 dark:border-white/20 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                                                        >
                                                                            <option value="">-- Default (Title) --</option>
                                                                            {allDatabases.find(d => d.id === prop.config!.relationDatabaseId)?.properties.map(p => (
                                                                                <option key={p.id} value={p.id}>{p.name}</option>
                                                                            ))}
                                                                        </select>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {prop.type === 'formula' && (
                                                            <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                                                                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 px-1">Calculation Expression</span>
                                                                <div className="flex gap-2">
                                                                    <input
                                                                        type="text"
                                                                        placeholder="e.g.: prop('Stuksprijs') * prop('Aantal')"
                                                                        value={prop.config?.formulaExpression || ''}
                                                                        readOnly
                                                                        className="flex-1 font-mono bg-white dark:bg-black border border-neutral-300 dark:border-white/20 rounded-lg px-3 py-1.5 text-sm outline-none bg-neutral-50 dark:bg-white/5 cursor-not-allowed text-neutral-500 truncate"
                                                                    />
                                                                    <button
                                                                        onClick={() => setFormulaEditingProp(prop)}
                                                                        className="px-3 py-1.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/20 transition whitespace-nowrap text-sm font-medium border border-blue-200 dark:border-blue-500/20 flex items-center gap-1.5"
                                                                    >
                                                                        <Calculator className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {prop.type === 'rollup' && (
                                                            <div className="flex flex-col gap-1 w-full mt-2">
                                                                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 px-1">Rollup Configuration & Aggregation</span>
                                                                <div className="flex gap-2 w-full flex-wrap sm:flex-nowrap">
                                                                    <select
                                                                        value={prop.config?.rollupPropertyId || ''}
                                                                        onChange={(e) => updateProperty(databaseId, prop.id, { config: { ...prop.config, rollupPropertyId: e.target.value, rollupTargetPropertyId: '' } })}
                                                                        className="flex-1 min-w-[120px] bg-white dark:bg-black border border-neutral-300 dark:border-white/20 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                                                    >
                                                                        <option value="">-- Relation --</option>
                                                                        {database.properties.filter(p => p.type === 'relation').map(p => (
                                                                            <option key={p.id} value={p.id}>{p.name}</option>
                                                                        ))}
                                                                    </select>

                                                                    {prop.config?.rollupPropertyId && (
                                                                        <select
                                                                            value={prop.config.rollupTargetPropertyId || ''}
                                                                            onChange={(e) => updateProperty(databaseId, prop.id, { config: { ...prop.config, rollupTargetPropertyId: e.target.value } })}
                                                                            className="flex-1 min-w-[120px] bg-white dark:bg-black border border-neutral-300 dark:border-white/20 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                                                        >
                                                                            <option value="">-- Target Property --</option>
                                                                            {(() => {
                                                                                const relationProp = database.properties.find(p => p.id === prop.config!.rollupPropertyId);
                                                                                const targetDbId = relationProp?.config?.relationDatabaseId;
                                                                                const targetDb = allDatabases.find(d => d.id === targetDbId);
                                                                                if (!targetDb) return null;
                                                                                return targetDb.properties.map(p => (
                                                                                    <option key={p.id} value={p.id}>{p.name}</option>
                                                                                ));
                                                                            })()}
                                                                        </select>
                                                                    )}

                                                                    {prop.config?.rollupTargetPropertyId && (
                                                                        <select
                                                                            value={prop.config.rollupAggregation || 'show_original'}
                                                                            onChange={(e) => updateProperty(databaseId, prop.id, { config: { ...prop.config, rollupAggregation: e.target.value as any } })}
                                                                            className="flex-1 min-w-[120px] bg-neutral-100 dark:bg-neutral-800 border bg-transparent border-neutral-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-neutral-700 dark:text-neutral-300 font-medium"
                                                                        >
                                                                            <option value="show_original">Show Original</option>
                                                                            <option value="extract_numbers">Extract Numbers</option>
                                                                            <option value="sum">Sum</option>
                                                                            <option value="average">Average</option>
                                                                            <option value="count">Count</option>
                                                                        </select>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {!isTitle && (
                                                        <button
                                                            onClick={() => {
                                                                if (window.confirm(`Are you sure you want to completely destroy the "${prop.name}" column across all rows?`)) {
                                                                    deleteProperty(databaseId, prop.id);
                                                                }
                                                            }}
                                                            className="ml-auto w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
                                                            title="Delete Column Permanently"
                                                        >
                                                            <Trash className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </Draggable>
                                    );
                                })}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                </DragDropContext>
            </div>

            {formulaEditingProp && (
                <FormulaEditorModal
                    isOpen={!!formulaEditingProp}
                    onClose={() => setFormulaEditingProp(null)}
                    property={formulaEditingProp}
                    database={database}
                    onSave={(expression) => {
                        updateProperty(databaseId, formulaEditingProp.id, { config: { ...formulaEditingProp.config, formulaExpression: expression } });
                    }}
                />
            )}
        </div>
    );
}
