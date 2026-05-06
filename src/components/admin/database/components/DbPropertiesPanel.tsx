"use client";

import React, { useState, useEffect } from 'react';
import { useDatabaseStore } from '../store';
import { Property, PropertyValue, SelectOption } from '../types';
import {
    Type, Hash, Calendar, CheckSquare, Link2, List, Tag,
    Lock, Search, ChevronDown, ChevronRight, X,
} from 'lucide-react';
import { COLOR_STYLES } from '../columns/SelectColumn';
import SelectDropdown from './SelectDropdown';

// ─── Type icon map ────────────────────────────────────────────────────────
const TYPE_ICONS: Record<string, React.ReactNode> = {
    title:          <Type className="w-3.5 h-3.5" />,
    text:           <Type className="w-3.5 h-3.5" />,
    number:         <Hash className="w-3.5 h-3.5" />,
    currency:       <Hash className="w-3.5 h-3.5" />,
    percent:        <Hash className="w-3.5 h-3.5" />,
    url:            <Link2 className="w-3.5 h-3.5" />,
    email:          <Link2 className="w-3.5 h-3.5" />,
    phone:          <Link2 className="w-3.5 h-3.5" />,
    date:           <Calendar className="w-3.5 h-3.5" />,
    checkbox:       <CheckSquare className="w-3.5 h-3.5" />,
    select:         <List className="w-3.5 h-3.5" />,
    multi_select:   <Tag className="w-3.5 h-3.5" />,
    relation:       <Search className="w-3.5 h-3.5" />,
    rollup:         <Hash className="w-3.5 h-3.5" />,
    formula:        <Lock className="w-3.5 h-3.5" />,
    created_time:   <Calendar className="w-3.5 h-3.5" />,
    created_by:     <Type className="w-3.5 h-3.5" />,
    last_edited_time: <Calendar className="w-3.5 h-3.5" />,
    last_edited_by: <Type className="w-3.5 h-3.5" />,
};

const READ_ONLY_TYPES = new Set(['formula', 'rollup', 'created_time', 'created_by', 'last_edited_time', 'last_edited_by']);

// ─── Single select badge ──────────────────────────────────────────────────
function SelectBadge({ option }: { option: SelectOption }) {
    const c = COLOR_STYLES[option.color as keyof typeof COLOR_STYLES] || COLOR_STYLES['gray'];
    return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold ${c.badge}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${c.dot} flex-shrink-0`} />
            {option.name}
        </span>
    );
}

// ─── Relation display: resolves page IDs → titles ─────────────────────────
function RelationValue({ ids }: { ids: string[] }) {
    const databases = useDatabaseStore(state => state.databases);
    const resolved = ids.map(id => {
        for (const db of databases) {
            const page = db.pages.find(p => p.id === id);
            if (page) return String(page.properties['title'] || page.properties['name'] || id.slice(0, 8));
        }
        return id.slice(0, 8) + '…';
    });
    if (!resolved.length) return <span className="text-neutral-400 text-xs italic">—</span>;
    return (
        <div className="flex flex-wrap gap-1">
            {resolved.map((t, i) => (
                <span key={i} className="inline-flex items-center px-2 py-0.5 bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded text-xs text-neutral-700 dark:text-neutral-300">
                    {t}
                </span>
            ))}
        </div>
    );
}

// ─── Debounced input to fix 'one character' focus bug ────────────────────
function DebouncedInput({ 
    value, 
    onChange, 
    isReadOnly, 
    inputBase, 
    type = 'text',
    step,
    placeholder = '—'
}: { 
    value: any; 
    onChange: (val: string) => void; 
    isReadOnly: boolean; 
    inputBase: string; 
    type?: string;
    step?: string;
    placeholder?: string;
}) {
    const [localValue, setLocalValue] = useState(String(value ?? ''));

    useEffect(() => {
        setLocalValue(String(value ?? ''));
    }, [value]);

    return (
        <input
            type={type}
            value={localValue}
            readOnly={isReadOnly}
            step={step}
            onChange={e => setLocalValue(e.target.value)}
            onBlur={() => {
                if (localValue !== String(value ?? '')) {
                    onChange(localValue);
                }
            }}
            className={inputBase}
            placeholder={placeholder}
        />
    );
}

// ─── Individual property row ──────────────────────────────────────────────
function PropertyRow({
    property,
    value,
    onChange,
}: {
    property: Property;
    value: PropertyValue;
    onChange: (propId: string, newVal: PropertyValue) => void;
}) {
    const isReadOnly = READ_ONLY_TYPES.has(property.type);
    const icon = TYPE_ICONS[property.type] ?? <Type className="w-3.5 h-3.5" />;
    const inputBase = "w-full text-xs bg-transparent outline-none focus:ring-0 text-neutral-900 dark:text-white placeholder:text-neutral-400";

    let valueEl: React.ReactNode;

    if (property.type === 'checkbox') {
        valueEl = (
            <input
                type="checkbox"
                checked={!!value}
                disabled={isReadOnly}
                onChange={e => onChange(property.id, e.target.checked)}
                className="w-4 h-4 accent-orange-500 cursor-pointer disabled:cursor-default"
            />
        );
    } else if ((property.type === 'select') && property.config?.options) {
        const opts = property.config.options;
        const strVal = String(value || '');
        const selected = opts.find(o => o.id === strVal || o.name === strVal);
        valueEl = (
            <SelectDropdown
                value={strVal || null}
                options={opts}
                onChange={(v) => onChange(property.id, v ?? '')}
                placeholder="—"
                disabled={isReadOnly}
            />
        );
    } else if (property.type === 'multi_select' && property.config?.options) {
        const opts = property.config.options;
        const selectedIds: string[] = Array.isArray(value) ? (value as string[]) : [];
        const unselected = opts.filter(o => !selectedIds.includes(o.id));
        valueEl = (
            <div className="flex flex-col gap-1 w-full">
                <div className="flex flex-wrap gap-1">
                    {selectedIds.map(sid => {
                        const opt = opts.find(o => o.id === sid);
                        if (!opt) return null;
                        return (
                            <div key={sid} className="flex items-center gap-0.5">
                                <SelectBadge option={opt} />
                                {!isReadOnly && (
                                    <button onClick={() => onChange(property.id, selectedIds.filter(x => x !== sid))} className="hover:text-red-500 transition-colors">
                                        <X className="w-2.5 h-2.5" />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
                {!isReadOnly && unselected.length > 0 && (
                    <select
                        value=""
                        onChange={e => { if (e.target.value) onChange(property.id, [...selectedIds, e.target.value]); }}
                        className={`${inputBase} text-neutral-400 cursor-pointer`}
                    >
                        <option value="">+ add…</option>
                        {unselected.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                )}
            </div>
        );
    } else if (property.type === 'relation') {
        const ids: string[] = Array.isArray(value) ? (value as string[]) : [];
        valueEl = <RelationValue ids={ids} />;
    } else if (property.type === 'date') {
        const strVal = String(value || '').slice(0, 10); // ISO date
        valueEl = (
            <input
                type="date"
                value={strVal}
                readOnly={isReadOnly}
                onChange={e => onChange(property.id, e.target.value)}
                className={`${inputBase} cursor-pointer`}
            />
        );
    } else if (property.type === 'formula' || property.type === 'rollup') {
        // Display computed value (read-only)
        const display = value !== null && value !== undefined && String(value) !== '' ? String(value) : '—';
        valueEl = <span className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">{display}</span>;
    } else if (property.type === 'number' || property.type === 'currency' || property.type === 'percent') {
        const numVal = value !== null && value !== undefined && String(value) !== '' ? Number(value) : '';
        valueEl = (
            <DebouncedInput 
                type="number"
                value={value} 
                onChange={val => onChange(property.id, val === '' ? null : Number(val))} 
                isReadOnly={isReadOnly} 
                inputBase={inputBase} 
                step="any"
            />
        );
    } else {
        // text, title, url, email, phone, etc.
        return <DebouncedInput value={value} onChange={val => onChange(property.id, val)} isReadOnly={isReadOnly} inputBase={inputBase} />;
    }

    return (
        <div className="flex flex-col gap-1 py-2.5 border-b border-neutral-100 dark:border-white/5 last:border-0">
            {/* Label */}
            <div className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400">
                <span className="flex-shrink-0">{icon}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider truncate">{property.name}</span>
                {isReadOnly && <Lock className="w-2.5 h-2.5 ml-auto flex-shrink-0 opacity-50" />}
            </div>
            {/* Value */}
            <div className="min-h-[22px] flex items-center">
                {valueEl}
            </div>
        </div>
    );
}

// ─── Section helper ───────────────────────────────────────────────────────
function Section({ 
    id, 
    label, 
    props, 
    collapsed, 
    onToggle, 
    pageProperties, 
    onChange 
}: { 
    id: string; 
    label: string; 
    props: Property[]; 
    collapsed: Set<string>; 
    onToggle: (id: string) => void; 
    pageProperties: Record<string, any>; 
    onChange: (propId: string, newVal: PropertyValue) => void; 
}) {
    if (!props.length) return null;
    const open = !collapsed.has(id);
    return (
        <div className="mb-1">
            <button
                onClick={() => onToggle(id)}
                className="w-full flex items-center gap-1 py-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
            >
                {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                {label}
                <span className="ml-auto font-normal normal-case tracking-normal">{props.length}</span>
            </button>
            {open && props.map(prop => (
                <PropertyRow
                    key={prop.id}
                    property={prop}
                    value={pageProperties[prop.id] ?? null}
                    onChange={onChange}
                />
            ))}
        </div>
    );
}

interface DbPropertiesPanelProps {
    databaseId: string;
    pageId: string;
    skipIds?: string[];
    title?: string;
}

export default function DbPropertiesPanel({ databaseId, pageId, skipIds = [], title = 'Properties' }: DbPropertiesPanelProps) {
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

    const database = useDatabaseStore(state => state.databases.find(db => db.id === databaseId));
    const page = useDatabaseStore(state => state.databases.find(db => db.id === databaseId)?.pages.find(p => p.id === pageId));
    const updatePageProperty = useDatabaseStore(state => state.updatePageProperty);

    if (!database || !page) {
        return (
            <div className="flex h-full items-center justify-center text-neutral-400 text-xs italic p-4 text-center">
                No properties found
            </div>
        );
    }

    const properties = database.properties.filter(p => !skipIds.includes(p.id));

    // Partition: standard editable vs computed
    const editable  = properties.filter(p => !READ_ONLY_TYPES.has(p.type));
    const computed  = properties.filter(p =>  READ_ONLY_TYPES.has(p.type));

    const handleChange = (propId: string, newVal: PropertyValue) => {
        updatePageProperty(databaseId, pageId, propId, newVal);
    };

    const toggle = (section: string) => {
        setCollapsed(prev => {
            const next = new Set(prev);
            next.has(section) ? next.delete(section) : next.add(section);
            return next;
        });
    };

    return (
        <div className="flex flex-col h-full overflow-hidden bg-neutral-50/70 dark:bg-black/40">
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-white/10 flex-shrink-0">
                <span className="text-xs font-bold text-neutral-700 dark:text-neutral-200 uppercase tracking-wider">{title}</span>
                <span className="text-[10px] text-neutral-400">{properties.length} fields</span>
            </div>

            {/* Property list */}
            <div className="flex-1 overflow-y-auto px-4 py-0">
                <Section 
                    id="editable" 
                    label="Fields" 
                    props={editable} 
                    collapsed={collapsed} 
                    onToggle={toggle} 
                    pageProperties={page.properties} 
                    onChange={handleChange} 
                />
                <Section 
                    id="computed" 
                    label="Computed" 
                    props={computed} 
                    collapsed={collapsed} 
                    onToggle={toggle} 
                    pageProperties={page.properties} 
                    onChange={handleChange} 
                />
            </div>
        </div>
    );
}
