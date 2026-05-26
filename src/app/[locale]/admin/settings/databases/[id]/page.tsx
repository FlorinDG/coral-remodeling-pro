"use client";

import React, { useState } from 'react';
import { useDatabaseStore } from '@/components/admin/database/store';
import { PropertyType } from '@/components/admin/database/types';
import { 
    Calculator, Trash2, GripVertical, Settings2, Database, Lock,
    Type, Hash, Calendar, CheckSquare, Link2, List, Tag, X,
    Plus, ChevronLeft, Save, Sparkles
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import FormulaEditorModal from '@/components/admin/database/components/FormulaEditorModal';
import { isSystemDatabase } from '@/lib/systemDatabases';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { useSession } from 'next-auth/react';

const PROPERTY_TYPES: { id: PropertyType; label: string; icon: any }[] = [
    { id: 'text', label: 'Text', icon: Type },
    { id: 'number', label: 'Number', icon: Hash },
    { id: 'select', label: 'Select', icon: List },
    { id: 'multi_select', label: 'Multi-select', icon: Tag },
    { id: 'date', label: 'Date', icon: Calendar },
    { id: 'checkbox', label: 'Checkbox', icon: CheckSquare },
    { id: 'url', label: 'URL', icon: Link2 },
    { id: 'email', label: 'Email', icon: Type },
    { id: 'phone', label: 'Phone', icon: Type },
    { id: 'relation', label: 'Relation Link', icon: Link2 },
    { id: 'formula', label: 'Formula', icon: Calculator },
    { id: 'rollup', label: 'Rollup', icon: Sparkles },
    { id: 'created_time', label: 'Created Time', icon: Calendar },
    { id: 'created_by', label: 'Created By', icon: Type },
    { id: 'last_edited_time', label: 'Last Edited Time', icon: Calendar },
    { id: 'last_edited_by', label: 'Last Edited By', icon: Type },
];

export default function DatabaseConfigurator() {
    const params = useParams();
    const router = useRouter();
    const databaseId = params.id as string;
    
    const database = useDatabaseStore(state => state.databases.find(db => db.id === databaseId));
    const allDatabases = useDatabaseStore(state => state.databases);
    const updateProperty = useDatabaseStore(state => state.updateProperty);
    const deleteProperty = useDatabaseStore(state => state.deleteProperty);
    const addProperty = useDatabaseStore(state => state.addProperty);
    const updatePropertyOrder = useDatabaseStore(state => state.updatePropertyOrder);
    const toggleSchemaUngating = useDatabaseStore(state => state.toggleSchemaUngating);
    const { data: session } = useSession();
    const isSuperadmin = session?.user?.role === 'SUPERADMIN' || session?.user?.role === 'TENANT_MANAGER' || (session?.user as any)?.isImpersonating;
    
    const [newPropName, setNewPropName] = useState('');
    const [formulaEditingProp, setFormulaEditingProp] = useState<any>(null);

    // System database schemas are immutable for all users (core platform functionality).
    const isSchemaLocked = isSystemDatabase(databaseId);
    const isStoreUngated = useDatabaseStore(state => state.isSchemaUngated(databaseId));
    const isUngated = isStoreUngated || isSuperadmin;

    // In ungated mode: system properties are those originally defined in the canonical schema.
    // We detect them by checking if they appear before any custom property was added.
    // For simplicity: if the DB is system & ungated, all properties known to DEFAULT_PROPERTIES_MAP
    // in DatabaseClone are "canonical". We approximate by storing canonical IDs at first access.
    const canonicalPropertyIds = React.useMemo(() => {
        if (!isSchemaLocked || !isUngated || !database) return new Set<string>();
        // All property IDs that are NOT uuid-formatted (user-generated via addProperty) are canonical
        // This works because addProperty generates uuid v4 IDs, while system properties use
        // readable IDs like 'title', 'status', 'prop-inv-amount', etc.
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return new Set(database.properties.filter(p => !uuidPattern.test(p.id)).map(p => p.id));
    }, [isSchemaLocked, isUngated, database]);

    if (!database) {
        return (
            <div className="p-8 text-center">
                <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Database not found</h1>
                <Link href="/admin/settings/databases" className="text-orange-500 hover:underline mt-4 inline-block">Back to databases</Link>
            </div>
        );
    }

    const handleDragEnd = (result: DropResult) => {
        if (!result.destination) return;
        if (result.source.index === result.destination.index) return;
        
        // Offset by 1 because the 'title' property is always index 0 and not draggable
        updatePropertyOrder(databaseId, result.source.index + 1, result.destination.index + 1);
    };

    const handleAddProperty = () => {
        if (!newPropName.trim()) return;
        addProperty(databaseId, newPropName, 'text');
        setNewPropName('');
    };

    return (
        <div className="flex flex-col h-full bg-neutral-50/50 dark:bg-[#0A0A0A]">
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-6 border-b border-neutral-200 dark:border-white/5 bg-white dark:bg-[#0F0F0F]">
                <div className="flex items-center gap-4">
                    <Link href="/admin/settings/databases" className="p-2 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-full transition-colors">
                        <ChevronLeft className="w-5 h-5 text-neutral-500" />
                    </Link>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Database className="w-5 h-5 text-neutral-400" />
                            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">{database.name} Schema</h1>
                        </div>
                        <p className="text-sm text-neutral-500">Configure columns, strict types, and logic for this database.</p>
                    </div>
                    {isSchemaLocked && !isUngated && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/30 rounded-lg">
                            <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            <span className="text-xs font-bold text-amber-700 dark:text-amber-300">System Schema — Columns are managed by the platform</span>
                        </div>
                    )}
                    {isSchemaLocked && isUngated && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/30 rounded-lg">
                            <Settings2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Ungated — Add custom properties (system fields are locked)</span>
                        </div>
                    )}

                    {/* Superadmin badge */}
                    {isSchemaLocked && isSuperadmin && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-purple-500 border-purple-600 text-white text-xs font-bold shadow-sm">
                            <Settings2 className="w-3.5 h-3.5" />
                            Superadmin Schema Edit
                        </div>
                    )}
                </div>
                
                {(!isSchemaLocked || isUngated) && (
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-neutral-100 dark:bg-white/5 p-1 rounded-xl border border-neutral-200 dark:border-white/5">
                            <input
                                placeholder="New Column Name..."
                                value={newPropName}
                                onChange={(e) => setNewPropName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddProperty()}
                                className="bg-transparent px-4 py-2 text-sm outline-none w-[200px] text-neutral-900 dark:text-white"
                            />
                            <button
                                onClick={handleAddProperty}
                                className="bg-neutral-900 dark:bg-white text-white dark:text-black px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:opacity-90 transition-opacity"
                            >
                                <Plus className="w-4 h-4" /> Add Column
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Configurator Table */}
            <div className="flex-1 overflow-auto p-8">
                <DragDropContext onDragEnd={handleDragEnd}>
                    <Droppable droppableId="properties">
                        {(provided) => (
                            <div className="bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="border-b border-neutral-100 dark:border-white/5 bg-neutral-50/50 dark:bg-white/[0.02]">
                                            <th className="w-10"></th>
                                            <th className="w-8"></th>
                                            <th className="px-4 py-3 text-left text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Property Name</th>
                                            <th className="px-4 py-3 text-left text-[10px] font-bold text-neutral-400 uppercase tracking-widest w-[180px]">Column Type</th>
                                            <th className="px-4 py-3 text-left text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Configuration</th>
                                            <th className="w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody {...provided.droppableProps} ref={provided.innerRef}>
                                        {database.properties.map((prop, index) => {
                                            const isTitle = prop.id === 'title';
                                            const isCanonical = canonicalPropertyIds.has(prop.id);
                                            // Superadmins can fully edit any property. Otherwise, canonical properties remain locked even when ungated.
                                            const isLocked = isSuperadmin ? false : (isSchemaLocked && !isUngated ? true : (isUngated && isCanonical));
                                            const propType = PROPERTY_TYPES.find(t => t.id === prop.type) || PROPERTY_TYPES[0];
                                            const Icon = propType.icon;

                                            // Title row is rendered as a static (non-draggable) row
                                            if (isTitle) {
                                                return (
                                                    <tr key={prop.id} className="hover:bg-neutral-50 dark:hover:bg-white/[0.02]">
                                                        <td className="w-10 px-2 py-1.5 align-middle text-center">
                                                            <div className="flex items-center justify-center p-1 rounded text-neutral-300 dark:text-neutral-700 opacity-0 cursor-default">
                                                                <GripVertical className="w-4 h-4" />
                                                            </div>
                                                        </td>
                                                        <td className="w-8 py-1.5 align-middle text-center">
                                                            <Icon className="w-4 h-4 text-neutral-400" />
                                                        </td>
                                                        <td className="px-2 py-1.5 align-middle">
                                                            <div className="flex items-center gap-3 group/name">
                                                                <div className="flex-1">
                                                                    <div className="flex items-center gap-2">
                                                                        <input
                                                                            value={prop.name}
                                                                            readOnly
                                                                            className="bg-transparent text-sm font-bold text-neutral-900 dark:text-neutral-100 border-b border-transparent outline-none px-1 transition w-full cursor-default"
                                                                        />
                                                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 font-bold uppercase tracking-wider whitespace-nowrap">Primary</span>
                                                                    </div>
                                                                    <span className="text-[9px] text-neutral-400 font-mono pl-1">ID: {prop.id}</span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-2 py-1.5 align-middle w-[180px]">
                                                            <select value="text" disabled className="w-full bg-neutral-100/50 dark:bg-white/5 border border-transparent rounded-md px-2 py-1 text-xs font-medium outline-none opacity-60 cursor-not-allowed">
                                                                <option value="text">Primary Text</option>
                                                            </select>
                                                        </td>
                                                        <td className="px-2 py-1.5 align-middle" />
                                                        <td className="w-10 px-2 py-1.5 align-middle" />
                                                    </tr>
                                                );
                                            }

                                            // Draggable index must be sequential starting from 0 for non-title rows
                                            const draggableIndex = index - 1;

                                            return (
                                                <Draggable key={prop.id} draggableId={prop.id} index={draggableIndex} isDragDisabled={isLocked}>
                                                    {(provided, snapshot) => (
                                                        <tr
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            className={`transition-colors ${snapshot.isDragging ? 'bg-white dark:bg-neutral-800 shadow-xl ring-1 ring-neutral-200 dark:ring-white/20 rounded-xl z-50' : 'hover:bg-neutral-50 dark:hover:bg-white/[0.02]'}`}
                                                            style={{
                                                                ...provided.draggableProps.style,
                                                                display: snapshot.isDragging ? 'table' : 'table-row'
                                                            }}
                                                        >
                                                            <td className="w-10 px-2 py-1.5 align-middle text-center">
                                                                <div
                                                                    {...provided.dragHandleProps}
                                                                    className={`flex items-center justify-center p-1 rounded text-neutral-300 dark:text-neutral-700 ${isLocked ? 'opacity-30 cursor-default' : 'hover:text-neutral-600 dark:hover:text-neutral-200 cursor-grab active:cursor-grabbing transition-colors'}`}
                                                                >
                                                                    <GripVertical className="w-4 h-4" />
                                                                </div>
                                                            </td>
                                                            <td className="w-8 py-1.5 align-middle text-center">
                                                                <Icon className="w-4 h-4 text-neutral-400" />
                                                            </td>
                                                            <td className="px-2 py-1.5 align-middle">
                                                                <div className="flex items-center gap-3 group/name">
                                                                    <div className="flex-1">
                                                                        <div className="flex items-center gap-2">
                                                                            <input
                                                                                value={prop.name}
                                                                                readOnly={isLocked}
                                                                                onChange={(e) => updateProperty(databaseId, prop.id, { name: e.target.value })}
                                                                                className={`bg-transparent text-sm font-bold text-neutral-900 dark:text-neutral-100 border-b border-transparent outline-none px-1 transition w-full ${isLocked ? 'cursor-default' : 'hover:border-neutral-300 focus:border-orange-500'}`}
                                                                            />
                                                                            {isCanonical && <span className="text-[9px] px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-500 dark:bg-white/5 dark:text-neutral-400 font-bold uppercase tracking-wider whitespace-nowrap flex items-center gap-0.5"><Lock className="w-2.5 h-2.5" /> System</span>}
                                                                        </div>
                                                                        <span className="text-[9px] text-neutral-400 font-mono pl-1">ID: {prop.id}</span>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-2 py-1.5 align-middle w-[180px]">
                                                                <SearchableSelect
                                                                    options={PROPERTY_TYPES.map(t => ({ value: t.id, label: t.label }))}
                                                                    value={prop.type}
                                                                    onChange={(v) => updateProperty(databaseId, prop.id, { type: v as PropertyType })}
                                                                    placeholder="Type"
                                                                    disabled={isLocked}
                                                                />
                                                            </td>
                                                            <td className="px-2 py-1.5 align-middle">
                                                                <div className="flex items-center gap-2">
                                                                    {/* Type Contextual Configurations */}
                                                                    {(prop.type === 'select' || prop.type === 'multi_select') && (
                                                                        <div className="flex flex-wrap gap-1 items-center bg-neutral-100/50 dark:bg-white/5 p-1 rounded-md border border-transparent min-h-[30px] w-full">
                                                                            {prop.config?.options?.map(opt => (
                                                                                <div key={opt.id} className="flex items-center gap-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-white/10 px-1.5 py-0.5 rounded text-[10px]">
                                                                                    <span>{opt.name}</span>
                                                                                    {!isLocked && (
                                                                                        <button
                                                                                            onClick={() => updateProperty(databaseId, prop.id, { config: { ...prop.config, options: prop.config?.options?.filter(o => o.id !== opt.id) || [] } })}
                                                                                            className="text-neutral-400 hover:text-red-500 transition-colors"
                                                                                        >
                                                                                            <X className="w-2.5 h-2.5" />
                                                                                        </button>
                                                                                    )}
                                                                                </div>
                                                                            ))}
                                                                            {!isLocked && (
                                                                                <button
                                                                                    onClick={() => {
                                                                                        const name = prompt('New option name:');
                                                                                        if (name) updateProperty(databaseId, prop.id, { config: { ...prop.config, options: [...(prop.config?.options || []), { id: `opt-${Date.now()}`, name, color: 'gray' }] } });
                                                                                    }}
                                                                                    className="text-[10px] text-orange-500 hover:text-orange-600 dark:text-orange-400 px-1.5 font-bold uppercase tracking-tight"
                                                                                >
                                                                                    + Add
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    )}

                                                                    {prop.type === 'currency' && (
                                                                        <SearchableSelect
                                                                            options={[
                                                                                { value: 'euro', label: 'Euro (€)' },
                                                                                { value: 'dollar', label: 'Dollar ($)' },
                                                                            ]}
                                                                            value={prop.config?.format || 'euro'}
                                                                            onChange={(v) => updateProperty(databaseId, prop.id, { config: { ...prop.config, format: v as 'euro' | 'dollar' } })}
                                                                            placeholder="Currency"
                                                                        />
                                                                    )}

                                                                    {prop.type === 'relation' && (
                                                                        <div className="flex gap-1 items-center w-full max-w-[400px]">
                                                                            <SearchableSelect
                                                                                options={[
                                                                                    { value: '', label: '-- Database --' },
                                                                                    ...allDatabases.filter(d => d.id !== databaseId).map(d => ({ value: d.id, label: d.name })),
                                                                                ]}
                                                                                value={prop.config?.relationDatabaseId || ''}
                                                                                onChange={(v) => updateProperty(databaseId, prop.id, { config: { ...prop.config, relationDatabaseId: v, relationDisplayPropertyId: '' } })}
                                                                                placeholder="-- Database --"
                                                                                searchPlaceholder="Search databases..."
                                                                            />
                                                                            {prop.config?.relationDatabaseId && (
                                                                                <SearchableSelect
                                                                                    options={[
                                                                                        { value: '', label: '-- Default (Title) --' },
                                                                                        ...(allDatabases.find(d => d.id === prop.config!.relationDatabaseId)?.properties.map(p => ({ value: p.id, label: p.name })) || []),
                                                                                    ]}
                                                                                    value={prop.config.relationDisplayPropertyId || ''}
                                                                                    onChange={(v) => updateProperty(databaseId, prop.id, { config: { ...prop.config, relationDisplayPropertyId: v } })}
                                                                                    placeholder="-- Default (Title) --"
                                                                                    searchPlaceholder="Search properties..."
                                                                                />
                                                                            )}
                                                                        </div>
                                                                    )}

                                                                    {prop.type === 'formula' && (
                                                                        <div className="flex gap-1 items-center w-full">
                                                                            <input
                                                                                type="text"
                                                                                value={prop.config?.formulaExpression || ''}
                                                                                readOnly
                                                                                className="flex-1 font-mono bg-neutral-100/50 dark:bg-white/5 border border-transparent rounded-md px-2 py-1 text-xs outline-none text-neutral-500 truncate"
                                                                            />
                                                                            <button
                                                                                onClick={() => setFormulaEditingProp(prop)}
                                                                                className="p-1 text-orange-500 hover:text-orange-600 transition-colors"
                                                                            >
                                                                                <Calculator className="w-3.5 h-3.5" />
                                                                            </button>
                                                                        </div>
                                                                    )}

                                                                    {prop.type === 'rollup' && (
                                                                        <div className="flex gap-1 items-center w-full flex-wrap xl:flex-nowrap">
                                                                            <SearchableSelect
                                                                                options={[
                                                                                    { value: '', label: '-- Relation --' },
                                                                                    ...database.properties.filter(p => p.type === 'relation').map(p => ({ value: p.id, label: p.name })),
                                                                                ]}
                                                                                value={prop.config?.rollupPropertyId || ''}
                                                                                onChange={(v) => updateProperty(databaseId, prop.id, { config: { ...prop.config, rollupPropertyId: v, rollupTargetPropertyId: '', rollupAggregation: 'show_original' } })}
                                                                                placeholder="-- Relation --"
                                                                            />
                                                                            {prop.config?.rollupPropertyId && (
                                                                                <SearchableSelect
                                                                                    options={[
                                                                                        { value: '', label: '-- Property --' },
                                                                                        ...(() => {
                                                                                            const relationProp = database.properties.find(p => p.id === prop.config!.rollupPropertyId);
                                                                                            const targetDbId = relationProp?.config?.relationDatabaseId;
                                                                                            const targetDb = allDatabases.find(d => d.id === targetDbId);
                                                                                            return targetDb?.properties.map(p => ({ value: p.id, label: p.name })) || [];
                                                                                        })(),
                                                                                    ]}
                                                                                    value={prop.config.rollupTargetPropertyId || ''}
                                                                                    onChange={(v) => updateProperty(databaseId, prop.id, { config: { ...prop.config, rollupTargetPropertyId: v } })}
                                                                                    placeholder="-- Property --"
                                                                                    searchPlaceholder="Search properties..."
                                                                                />
                                                                            )}

                                                                            {prop.config?.rollupTargetPropertyId && (
                                                                                <SearchableSelect
                                                                                    options={[
                                                                                        { value: 'show_original', label: 'Original' },
                                                                                        { value: 'extract_numbers', label: 'Numbers' },
                                                                                        { value: 'sum', label: 'Sum' },
                                                                                        { value: 'average', label: 'Avg' },
                                                                                        { value: 'count', label: 'Count' },
                                                                                    ]}
                                                                                    value={prop.config.rollupAggregation || 'show_original'}
                                                                                    onChange={(v) => updateProperty(databaseId, prop.id, { config: { ...prop.config, rollupAggregation: v as any } })}
                                                                                    placeholder="Aggregation"
                                                                                />
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="w-10 px-2 py-1.5 align-middle text-right">
                                                                {!isLocked && (
                                                                    <button
                                                                        onClick={() => { if (window.confirm(`Delete property "${prop.name}"?`)) deleteProperty(databaseId, prop.id); }}
                                                                        className="p-1.5 text-neutral-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all"
                                                                    >
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    )}
                                                </Draggable>
                                            );
                                        })}
                                        {provided.placeholder}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Droppable>
                </DragDropContext>
            </div>

            {formulaEditingProp && (
                <FormulaEditorModal
                    databaseId={databaseId}
                    propertyId={formulaEditingProp.id}
                    currentExpression={formulaEditingProp.config?.formulaExpression || ''}
                    onSave={(expression) => {
                        updateProperty(databaseId, formulaEditingProp.id, {
                            config: { ...formulaEditingProp.config, formulaExpression: expression }
                        });
                    }}
                    onClose={() => setFormulaEditingProp(null)}
                />
            )}
        </div>
    );
}
