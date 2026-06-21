"use client";
/* eslint-disable */

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useDatabaseStore } from '../store';
import { Property, PropertyValue, SelectOption } from '../types';
import {
    Type, Hash, Calendar, CheckSquare, Link2, List, Tag,
    Lock, Search, ChevronDown, ChevronRight, X, GripVertical,
    Mail, Phone, MapPin, ExternalLink
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { COLOR_STYLES } from '../columns/SelectColumn';
import SelectDropdown from './SelectDropdown';
import { RecurrenceSelector } from '../../tasks/RecurrenceSelector';
import postcodesData from '@/lib/belgian-postcodes.json';

const isPostalField = (name: string, id: string) => {
    const n = name.toLowerCase();
    const i = id.toLowerCase();
    return n.includes('postal') || n.includes('zip') || n.includes('postcode') || i.includes('postal') || i.includes('zip') || i.includes('postcode');
};

const isCityField = (name: string, id: string) => {
    const n = name.toLowerCase();
    const i = id.toLowerCase();
    return n.includes('city') || n.includes('stad') || n.includes('gemeente') || i.includes('city') || i.includes('stad') || i.includes('gemeente');
};

// ─── Type icon map ────────────────────────────────────────────────────────
const TYPE_ICONS: Record<string, React.ReactNode> = {
    title:          <Type className="w-3.5 h-3.5" />,
    text:           <Type className="w-3.5 h-3.5" />,
    number:         <Hash className="w-3.5 h-3.5" />,
    currency:       <Hash className="w-3.5 h-3.5" />,
    percent:        <Hash className="w-3.5 h-3.5" />,
    url:            <ExternalLink className="w-3.5 h-3.5" />,
    email:          <Mail className="w-3.5 h-3.5" />,
    phone:          <Phone className="w-3.5 h-3.5" />,
    places:         <MapPin className="w-3.5 h-3.5" />,
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
    const router = useRouter();
    const params = useParams();
    const locale = (params.locale as string) || 'nl';
    const databases = useDatabaseStore(state => state.databases);

    const resolved = ids.map(id => {
        const safeId = String(id || '');
        for (const db of databases) {
            const page = db.pages.find(p => p.id === id);
            if (page) return { 
                title: String(page.properties?.['title'] || page.properties?.['name'] || safeId.slice(0, 8)),
                dbId: db.id,
                pageId: page.id
            };
        }
        return { title: safeId.slice(0, 8) + '…', dbId: null, pageId: id };
    });

    if (!resolved.length) return <span className="text-neutral-400 text-xs italic">—</span>;

    return (
        <div className="flex flex-wrap gap-1">
            {resolved.map((item, i) => (
                <button
                    key={i}
                    onClick={() => {
                        if (item.dbId) {
                            router.push(`/${locale}/admin/database/${item.dbId}/${item.pageId}`);
                        }
                    }}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded text-xs text-neutral-700 dark:text-neutral-300 hover:border-orange-500/50 hover:bg-neutral-200 dark:hover:bg-white/10 transition-all group/rel"
                >
                    <Link2 className="w-2.5 h-2.5 opacity-50" />
                    {item.title}
                    <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover/rel:opacity-100 transition-opacity ml-0.5" />
                </button>
            ))}
        </div>
    );
}

interface SearchableSelectDropdownProps<T> {
    options: T[];
    onSelect: (option: T) => void;
    getLabel: (option: T) => string;
    getId: (option: T) => string;
    placeholder?: string;
}

function SearchableSelectDropdown<T>({
    options,
    onSelect,
    getLabel,
    getId,
    placeholder = "+ add..."
}: SearchableSelectDropdownProps<T>) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const clickAway = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', clickAway);
        return () => document.removeEventListener('mousedown', clickAway);
    }, [open]);

    const filtered = options.filter(opt =>
        getLabel(opt).toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div ref={ref} className="relative w-full">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="w-full text-left text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 text-xs font-semibold border border-neutral-200 dark:border-white/10 rounded px-2 py-1 bg-white dark:bg-neutral-900 transition-colors flex items-center justify-between shadow-sm"
            >
                <span>{placeholder}</span>
                <ChevronDown className="w-3 h-3 opacity-55" />
            </button>
            {open && (
                <div
                    className="absolute top-full left-0 z-[100] mt-1 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-white/15 rounded-xl shadow-2xl p-2 flex flex-col gap-2 w-64 max-h-60 overflow-hidden"
                >
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-neutral-105 dark:bg-white/5 rounded-lg border border-neutral-200 dark:border-white/5 flex-shrink-0">
                        <Search className="w-3.5 h-3.5 text-neutral-400" />
                        <input
                            type="text"
                            autoFocus
                            placeholder="Search..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="bg-transparent border-none text-xs outline-none w-full text-neutral-900 dark:text-white placeholder:text-neutral-400 font-semibold"
                        />
                        {search && (
                            <button type="button" onClick={() => setSearch('')} className="text-neutral-400 hover:text-neutral-600">
                                <X className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                    <div className="flex-1 overflow-y-auto divide-y divide-neutral-100 dark:divide-white/5 max-h-[160px] pr-0.5">
                        {filtered.length === 0 ? (
                            <p className="text-[11px] text-neutral-400 italic text-center py-4">No records found</p>
                        ) : (
                            filtered.map(opt => (
                                <button
                                    key={getId(opt)}
                                    type="button"
                                    onClick={() => {
                                        onSelect(opt);
                                        setSearch('');
                                        setOpen(false);
                                    }}
                                    className="w-full text-left px-2 py-1.5 hover:bg-neutral-50 dark:hover:bg-white/5 rounded-lg text-xs font-semibold text-neutral-850 dark:text-neutral-200 transition-colors"
                                >
                                    {getLabel(opt)}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
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
    value: PropertyValue; 
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

function PostcodeCityInput({
    property,
    value,
    onChange,
    isReadOnly,
    inputBase,
    allPropertyDefs = [],
}: {
    property: Property;
    value: PropertyValue;
    onChange: (propId: string, newVal: PropertyValue) => void;
    isReadOnly: boolean;
    inputBase: string;
    allPropertyDefs: Property[];
}) {
    const [localValue, setLocalValue] = useState(String(value ?? ''));
    const [suggestions, setSuggestions] = useState<{ zip: string; city: string }[]>([]);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        setLocalValue(String(value ?? ''));
    }, [value]);

    const isPostal = isPostalField(property.name, property.id);

    return (
        <div className="relative w-full">
            <input
                type="text"
                value={localValue}
                readOnly={isReadOnly}
                onChange={e => {
                    const val = e.target.value;
                    setLocalValue(val);
                    if (isReadOnly) return;

                    if (isPostal) {
                        if (val.trim()) {
                            const matches = (postcodesData as { zip: string; city: string }[])
                                .filter(p => p.zip.startsWith(val.trim()))
                                .slice(0, 8);
                            setSuggestions(matches);
                            setIsOpen(true);
                        } else {
                            setSuggestions([]);
                        }
                    } else {
                        if (val.trim().length >= 2) {
                            const term = val.toLowerCase().trim();
                            const matches = (postcodesData as { zip: string; city: string }[])
                                .filter(p => p.city.toLowerCase().includes(term))
                                .slice(0, 8);
                            setSuggestions(matches);
                            setIsOpen(true);
                        } else {
                            setSuggestions([]);
                        }
                    }
                }}
                onFocus={() => {
                    if (!isReadOnly) setIsOpen(true);
                }}
                onBlur={() => {
                    if (localValue !== String(value ?? '')) {
                        onChange(property.id, localValue);
                    }
                    setTimeout(() => {
                        setSuggestions([]);
                        setIsOpen(false);
                    }, 200);
                }}
                className={inputBase}
                placeholder="—"
            />
            {isOpen && suggestions.length > 0 && (
                <div className="absolute left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-lg shadow-xl divide-y divide-neutral-100 dark:divide-white/5">
                    {suggestions.map((s, idx) => (
                        <button
                            key={idx}
                            type="button"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                onChange(property.id, isPostal ? s.zip : s.city);
                                const sibling = allPropertyDefs.find(p => 
                                    isPostal ? isCityField(p.name, p.id) : isPostalField(p.name, p.id)
                                );
                                if (sibling) {
                                    onChange(sibling.id, isPostal ? s.city : s.zip);
                                }
                                setLocalValue(isPostal ? s.zip : s.city);
                                setSuggestions([]);
                                setIsOpen(false);
                            }}
                            className="w-full text-left px-3 py-2 text-xs text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5 font-semibold transition-colors"
                        >
                            {s.zip} {s.city}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Individual property row ──────────────────────────────────────────────
function PropertyRow({
    property,
    value,
    onChange,
    dragHandleProps,
    forceReadOnly = false,
    allPropertyDefs = [],
}: {
    property: Property;
    value: PropertyValue;
    onChange: (propId: string, newVal: PropertyValue) => void;
    dragHandleProps?: any;
    forceReadOnly?: boolean;
    allPropertyDefs?: Property[];
}) {
    const isReadOnly = READ_ONLY_TYPES.has(property.type) || forceReadOnly;
    const icon = TYPE_ICONS[property.type] ?? <Type className="w-3.5 h-3.5" />;
    const inputBase = "w-full text-sm font-medium bg-transparent outline-none focus:ring-0 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-300 dark:placeholder:text-neutral-700";

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
                    <SearchableSelectDropdown
                        options={unselected}
                        getId={(o) => o.id}
                        getLabel={(o) => o.name}
                        onSelect={(o) => onChange(property.id, [...selectedIds, o.id])}
                        placeholder="+ add..."
                    />
                )}
            </div>
        );
    } else if (property.type === 'relation') {
        const ids: string[] = Array.isArray(value) ? (value as unknown[]).map(v => String(v ?? '')) : [];
        const relationDatabaseId = property.config?.relationDatabaseId;
        const targetDb = useDatabaseStore.getState().databases.find(db => db.id === relationDatabaseId);
        const unselected = targetDb 
            ? targetDb.pages.filter(p => !ids.includes(p.id)) 
            : [];
        valueEl = (
            <div className="flex flex-col gap-1.5 w-full">
                <div className="flex flex-wrap gap-1">
                    {ids.map(sid => {
                        const safeSid = String(sid || '');
                        let title = safeSid.slice(0, 8) + '…';
                        if (targetDb) {
                            const page = targetDb.pages.find(p => p.id === sid);
                            if (page) {
                                title = String(page.properties?.['title'] || page.properties?.['name'] || safeSid.slice(0, 8));
                            }
                        }
                        return (
                            <div key={sid} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded text-[11px] text-neutral-700 dark:text-neutral-300">
                                <span className="truncate max-w-[120px]">{title}</span>
                                {!isReadOnly && (
                                    <button onClick={() => onChange(property.id, ids.filter(x => x !== sid))} className="hover:text-red-500 transition-colors ml-1">
                                        <X className="w-2.5 h-2.5" />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
                {!isReadOnly && unselected.length > 0 && (
                    <SearchableSelectDropdown
                        options={unselected}
                        getId={(p) => p.id}
                        getLabel={(p) => String(p.properties?.['title'] || p.properties?.['name'] || String(p.id || '').slice(0, 8))}
                        onSelect={(p) => onChange(property.id, [...ids, p.id])}
                        placeholder="+ link record..."
                    />
                )}
                {ids.length === 0 && isReadOnly && <span className="text-neutral-400 text-xs italic">—</span>}
            </div>
        );
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
        valueEl = <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400 font-mono">{display}</span>;
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
    } else if (property.type === 'email') {
        const strVal = String(value || '');
        valueEl = (
            <div className="flex items-center gap-1 w-full">
                <DebouncedInput value={value} onChange={val => onChange(property.id, val)} isReadOnly={isReadOnly} inputBase={inputBase} placeholder="email@example.com" />
                {strVal && (
                    <a
                        href={`mailto:${strVal}`}
                        className="flex-shrink-0 p-1 rounded hover:bg-orange-100 dark:hover:bg-orange-900/30 text-neutral-400 hover:text-orange-600 dark:hover:text-orange-400 transition-colors opacity-0 group-hover:opacity-100"
                        title={`Send email to ${strVal}`}
                    >
                        <Mail className="w-3.5 h-3.5" />
                    </a>
                )}
            </div>
        );
    } else if (property.type === 'phone') {
        const strVal = String(value || '');
        valueEl = (
            <div className="flex items-center gap-1 w-full">
                <DebouncedInput value={value} onChange={val => onChange(property.id, val)} isReadOnly={isReadOnly} inputBase={inputBase} placeholder="+32 ..." />
                {strVal && (
                    <a
                        href={`tel:${strVal.replace(/\s/g, '')}`}
                        className="flex-shrink-0 p-1 rounded hover:bg-green-100 dark:hover:bg-green-900/30 text-neutral-400 hover:text-green-600 dark:hover:text-green-400 transition-colors opacity-0 group-hover:opacity-100"
                        title={`Call ${strVal}`}
                    >
                        <Phone className="w-3.5 h-3.5" />
                    </a>
                )}
            </div>
        );
    } else if (property.type === 'places') {
        const strVal = String(value || '');
        valueEl = (
            <div className="flex items-center gap-1 w-full">
                <DebouncedInput value={value} onChange={val => onChange(property.id, val)} isReadOnly={isReadOnly} inputBase={inputBase} placeholder="Address..." />
                {strVal && (
                    <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(strVal)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-neutral-400 hover:text-red-600 dark:hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                        title={`Open ${strVal} in Maps`}
                    >
                        <MapPin className="w-3.5 h-3.5" />
                    </a>
                )}
            </div>
        );
    } else if (property.type === 'url') {
        const strVal = String(value || '');
        const href = strVal && !strVal.startsWith('http') ? `https://${strVal}` : strVal;
        valueEl = (
            <div className="flex items-center gap-1 w-full">
                <DebouncedInput value={value} onChange={val => onChange(property.id, val)} isReadOnly={isReadOnly} inputBase={inputBase} placeholder="https://..." />
                {strVal && (
                    <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 p-1 rounded hover:bg-orange-100 dark:hover:bg-orange-900/30 text-neutral-400 hover:text-orange-600 dark:hover:text-orange-400 transition-colors opacity-0 group-hover:opacity-100"
                        title={`Open ${strVal}`}
                    >
                        <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                )}
            </div>
        );
    } else if (property.id === 'prop-task-recurrence') {
        valueEl = (
            <RecurrenceSelector
                value={String(value || '')}
                onChange={v => onChange(property.id, v)}
            />
        );
    } else if (property.type === 'text' && (isPostalField(property.name, property.id) || isCityField(property.name, property.id))) {
        valueEl = (
            <PostcodeCityInput
                property={property}
                value={value}
                onChange={onChange}
                isReadOnly={isReadOnly}
                inputBase={inputBase}
                allPropertyDefs={allPropertyDefs}
            />
        );
    } else {
        // text, title, etc.
        valueEl = <DebouncedInput value={value} onChange={val => onChange(property.id, val)} isReadOnly={isReadOnly} inputBase={inputBase} />;
    }

    return (
        <div className="group flex items-center gap-2 py-1 hover:bg-neutral-100 dark:hover:bg-white/[0.03] transition-colors -mx-4 px-4 border-b border-neutral-100/50 dark:border-white/5 last:border-0">
            {/* Grip (always rendered to prevent hello-pangea/dnd invariant crashes, but visually hidden if read-only) */}
            <div 
                {...dragHandleProps} 
                className={`w-4 flex-shrink-0 text-neutral-300 dark:text-neutral-700 cursor-grab active:cursor-grabbing transition-all ${
                    isReadOnly 
                        ? 'opacity-0 pointer-events-none w-0 h-0 overflow-hidden invisible' 
                        : 'opacity-0 group-hover:opacity-100'
                }`}
            >
                {!isReadOnly && <GripVertical className="w-3.5 h-3.5" />}
            </div>
            
            {/* Label Column */}
            <div className="w-[160px] flex-shrink-0 flex items-start gap-1.5 py-1">
                <div className="flex flex-col gap-0.5 mt-0.5">
                    <span className="text-[10px] text-neutral-500 dark:text-neutral-500 font-bold uppercase tracking-wider truncate">
                        {property.name}
                    </span>
                    <span className="text-[9px] text-neutral-400 opacity-50 font-mono truncate">{property.type}</span>
                </div>
            </div>

            {/* Value Column */}
            <div className="flex-1 min-w-0 min-h-[32px] flex items-center pr-2">
                {valueEl}
                {isReadOnly && <Lock className="w-2.5 h-2.5 ml-auto flex-shrink-0 opacity-30" />}
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
    onChange,
    forceReadOnly = false,
    allPropertyDefs = []
}: { 
    id: string; 
    label: string; 
    props: Property[]; 
    collapsed: Set<string>; 
    onToggle: (id: string) => void; 
    pageProperties: Record<string, PropertyValue>; 
    onChange: (propId: string, newVal: PropertyValue) => void; 
    forceReadOnly?: boolean;
    allPropertyDefs?: Property[];
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
            {open && (
                <Droppable droppableId={id}>
                    {(provided) => (
                        <div {...provided.droppableProps} ref={provided.innerRef}>
                            {props.map((prop, index) => (
                                <Draggable key={prop.id} draggableId={prop.id} index={index} isDragDisabled={id === 'computed' || forceReadOnly}>
                                    {(provided, snapshot) => (
                                        <div
                                            ref={provided.innerRef}
                                            {...provided.draggableProps}
                                            className={snapshot.isDragging ? 'bg-white dark:bg-neutral-800 shadow-xl ring-1 ring-neutral-200 dark:ring-white/20 rounded z-50' : ''}
                                            style={provided.draggableProps.style}
                                        >
                                            <PropertyRow
                                                property={prop}
                                                value={pageProperties[prop.id] ?? null}
                                                onChange={onChange}
                                                dragHandleProps={provided.dragHandleProps}
                                                forceReadOnly={forceReadOnly}
                                                allPropertyDefs={allPropertyDefs}
                                            />
                                        </div>
                                    )}
                                </Draggable>
                            ))}
                            {provided.placeholder}
                        </div>
                    )}
                </Droppable>
            )}
        </div>
    );
}

interface DbPropertiesPanelProps {
    databaseId: string;
    pageId: string;
    skipIds?: string[];
    title?: string;
    readOnly?: boolean;
    liveProperties?: Record<string, any>;
    onChange?: (propId: string, newVal: any) => void;
}

export default function DbPropertiesPanel({ 
    databaseId, 
    pageId, 
    skipIds = [], 
    title = 'Properties', 
    readOnly = false,
    liveProperties,
    onChange
}: DbPropertiesPanelProps) {
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

    const properties = (database.properties || []).filter(p => !skipIds.includes(p.id));

    // Partition: standard editable vs computed
    const editable  = properties.filter(p => !READ_ONLY_TYPES.has(p.type));
    const computed  = properties.filter(p =>  READ_ONLY_TYPES.has(p.type));

    const pageProperties = liveProperties || page.properties || {};

    const handleChange = (propId: string, newVal: PropertyValue) => {
        if (onChange) {
            onChange(propId, newVal);
        } else {
            updatePageProperty(databaseId, pageId, propId, newVal);
        }
    };

    const toggle = (section: string) => {
        setCollapsed(prev => {
            const next = new Set(prev);
            next.has(section) ? next.delete(section) : next.add(section);
            return next;
        });
    };

    const handleDragEnd = (result: DropResult) => {
        if (!result.destination || result.source.index === result.destination.index) return;
        if (result.source.droppableId !== 'editable') return;
        
        // Find index of title if it exists to offset correctly
        const titleIndex = (database.properties || []).findIndex(p => p.id === 'title');
        const offset = titleIndex !== -1 ? titleIndex + 1 : 0;
        
        useDatabaseStore.getState().updatePropertyOrder(databaseId, result.source.index + offset, result.destination.index + offset);
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
                <DragDropContext onDragEnd={readOnly ? () => {} : handleDragEnd}>
                    <Section 
                        id="editable" 
                        label="Fields" 
                        props={editable} 
                        collapsed={collapsed} 
                        onToggle={toggle} 
                        pageProperties={pageProperties} 
                        onChange={handleChange} 
                        forceReadOnly={readOnly}
                        allPropertyDefs={properties}
                    />
                    <Section 
                        id="computed" 
                        label="Computed" 
                        props={computed} 
                        collapsed={collapsed} 
                        onToggle={toggle} 
                        pageProperties={pageProperties} 
                        onChange={handleChange} 
                        forceReadOnly={readOnly}
                        allPropertyDefs={properties}
                    />
                </DragDropContext>
            </div>
        </div>
    );
}
