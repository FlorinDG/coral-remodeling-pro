"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useDatabaseStore } from '../store';
import { Database as DatabaseIcon, Search, ChevronRight, Hash, Type, Calendar, CheckSquare, ArrowRight } from 'lucide-react';

// ────────────────────────────────────────────────────────────────────────────────
// PropMentionFlyout — cursor-anchored, multi-step property picker
//
// Flow:  @prop → Step 1 (DB) → Step 2 (Property) → Step 3 (Aggregator) → Insert
//        @this_page → Step 2 (Property, scoped to current DB) → Insert
// ────────────────────────────────────────────────────────────────────────────────

export interface MentionResult {
    type: 'prop' | 'this_page';
    databaseId: string;
    databaseName: string;
    propertyId: string;
    propertyName: string;
    aggregator: 'first' | 'last' | 'count' | 'sum' | 'avg' | 'list';
}

interface PropMentionFlyoutProps {
    triggerType: 'prop' | 'this_page';
    currentDatabaseId?: string;         // For @this_page — scopes to current DB
    position: { top: number; left: number };
    onSelect: (result: MentionResult) => void;
    onClose: () => void;
}

type Step = 'database' | 'property' | 'aggregator';

const AGGREGATORS: { id: MentionResult['aggregator']; label: string; description: string }[] = [
    { id: 'first',  label: '.first',  description: 'First value (default)' },
    { id: 'last',   label: '.last',   description: 'Last value' },
    { id: 'list',   label: '.list',   description: 'All values as list' },
    { id: 'count',  label: '.count',  description: 'Number of values' },
    { id: 'sum',    label: '.sum',    description: 'Sum (numbers only)' },
    { id: 'avg',    label: '.avg',    description: 'Average (numbers only)' },
];

const propTypeIcon = (type: string) => {
    switch (type) {
        case 'number':
        case 'currency':
        case 'percent':
            return <Hash className="w-3.5 h-3.5" />;
        case 'date':
        case 'created_time':
        case 'last_edited_time':
            return <Calendar className="w-3.5 h-3.5" />;
        case 'checkbox':
            return <CheckSquare className="w-3.5 h-3.5" />;
        default:
            return <Type className="w-3.5 h-3.5" />;
    }
};

export default function PropMentionFlyout({
    triggerType,
    currentDatabaseId,
    position,
    onSelect,
    onClose,
}: PropMentionFlyoutProps) {
    const databases = useDatabaseStore(state => state.databases);
    const flyoutRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    // Compute initial DB name for @this_page at mount time (avoids setState in effect)
    const initialDbName = triggerType === 'this_page' && currentDatabaseId
        ? databases.find(d => d.id === currentDatabaseId)?.name || ''
        : '';

    // State
    const [step, setStep] = useState<Step>(triggerType === 'this_page' ? 'property' : 'database');
    const [selectedDb, setSelectedDb] = useState<string>(triggerType === 'this_page' ? (currentDatabaseId || '') : '');
    const [selectedDbName, setSelectedDbName] = useState<string>(initialDbName);
    const [selectedPropId, setSelectedPropId] = useState<string>('');
    const [selectedPropName, setSelectedPropName] = useState<string>('');
    const [search, setSearch] = useState('');
    const [focusIndex, setFocusIndex] = useState(0);

    // Focus search on step change (side-effect only, no state)
    useEffect(() => {
        setTimeout(() => searchRef.current?.focus(), 50);
    }, [step]);

    // Reset search/focus when step changes (via event handlers, not effect)
    const handleStepChange = (newStep: Step) => {
        setSearch('');
        setFocusIndex(0);
        setStep(newStep);
    };

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (flyoutRef.current && !flyoutRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [onClose]);

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    // ── Filtered lists ──────────────────────────────────────────────────────────
    const filteredDatabases = useMemo(() => {
        const q = search.toLowerCase();
        return databases
            .filter(db => !db.isTemplate)
            .filter(db => db.name.toLowerCase().includes(q));
    }, [databases, search]);

    const selectedDatabase = useMemo(() => databases.find(d => d.id === selectedDb), [databases, selectedDb]);

    const filteredProperties = useMemo(() => {
        if (!selectedDatabase) return [];
        const q = search.toLowerCase();
        return selectedDatabase.properties.filter(p => p.name.toLowerCase().includes(q));
    }, [selectedDatabase, search]);

    const filteredAggregators = useMemo(() => {
        const q = search.toLowerCase();
        return AGGREGATORS.filter(a => a.label.toLowerCase().includes(q) || a.description.toLowerCase().includes(q));
    }, [search]);

    // ── Current items (for keyboard nav) ────────────────────────────────────────
    const currentItems = step === 'database' ? filteredDatabases
        : step === 'property' ? filteredProperties
        : filteredAggregators;

    // ── Selection handlers ───────────────────────────────────────────────────────
    const handleSelectDb = (dbId: string, dbName: string) => {
        setSelectedDb(dbId);
        setSelectedDbName(dbName);
        handleStepChange('property');
    };

    const handleSelectProperty = (propId: string, propName: string) => {
        setSelectedPropId(propId);
        setSelectedPropName(propName);
        // For single-value properties (current page context), skip aggregator
        if (triggerType === 'this_page') {
            onSelect({
                type: 'this_page',
                databaseId: selectedDb,
                databaseName: selectedDbName,
                propertyId: propId,
                propertyName: propName,
                aggregator: 'first',
            });
            return;
        }
        handleStepChange('aggregator');
    };

    const handleSelectAggregator = (agg: MentionResult['aggregator']) => {
        onSelect({
            type: triggerType,
            databaseId: selectedDb,
            databaseName: selectedDbName,
            propertyId: selectedPropId,
            propertyName: selectedPropName,
            aggregator: agg,
        });
    };

    // ── Keyboard navigation ─────────────────────────────────────────────────────
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setFocusIndex(i => Math.min(i + 1, currentItems.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setFocusIndex(i => Math.max(i - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (step === 'database' && filteredDatabases[focusIndex]) {
                handleSelectDb(filteredDatabases[focusIndex].id, filteredDatabases[focusIndex].name);
            } else if (step === 'property' && filteredProperties[focusIndex]) {
                handleSelectProperty(filteredProperties[focusIndex].id, filteredProperties[focusIndex].name);
            } else if (step === 'aggregator' && filteredAggregators[focusIndex]) {
                handleSelectAggregator(filteredAggregators[focusIndex].id);
            }
        } else if (e.key === 'Escape') {
            onClose();
        }
    };

    // ── Build expression preview ────────────────────────────────────────────────
    const expressionPreview = (() => {
        const prefix = triggerType === 'this_page' ? '@this_page' : '@prop';
        if (step === 'database') return `${prefix}(...)`;
        if (step === 'property') return `${prefix}(${selectedDbName}.▌)`;
        return `${prefix}(${selectedDbName}.${selectedPropName}).▌`;
    })();

    // ── Step label ──────────────────────────────────────────────────────────────
    const stepLabel = step === 'database' ? 'Select Database'
        : step === 'property' ? `${selectedDbName} → Select Property`
        : `${selectedDbName}.${selectedPropName} → Aggregator`;

    return (
        <div
            ref={flyoutRef}
            className="fixed z-[100] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-xl shadow-2xl w-72 max-h-96 flex flex-col overflow-hidden"
            style={{ top: position.top, left: position.left }}
            onKeyDown={handleKeyDown}
        >
            {/* Expression preview bar */}
            <div className="px-3 py-2 bg-neutral-50 dark:bg-white/5 border-b border-neutral-200 dark:border-white/10">
                <code className="text-[11px] font-mono text-neutral-600 dark:text-neutral-400 break-all">
                    {expressionPreview}
                </code>
            </div>

            {/* Search */}
            <div className="relative px-2 py-1.5 border-b border-neutral-100 dark:border-white/5">
                <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                    ref={searchRef}
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder={step === 'database' ? 'Search databases...' : step === 'property' ? 'Search properties...' : 'Search aggregators...'}
                    className="w-full text-xs bg-transparent outline-none pl-6 py-1 text-neutral-900 dark:text-white placeholder:text-neutral-400"
                    autoFocus
                />
            </div>

            {/* Step label */}
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 flex items-center gap-1">
                {step !== 'database' && (
                    <button
                        onClick={() => handleStepChange(step === 'aggregator' ? 'property' : 'database')}
                        className="hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                    >
                        ←
                    </button>
                )}
                {stepLabel}
            </div>

            {/* List */}
            <div className="overflow-y-auto flex-1 py-1">
                {step === 'database' && filteredDatabases.map((db, i) => (
                    <button
                        key={db.id}
                        onMouseDown={e => { e.preventDefault(); handleSelectDb(db.id, db.name); }}
                        onMouseEnter={() => setFocusIndex(i)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                            i === focusIndex ? 'bg-neutral-100 dark:bg-white/10' : 'hover:bg-neutral-50 dark:hover:bg-white/5'
                        }`}
                    >
                        <div className="w-6 h-6 rounded-md flex items-center justify-center text-neutral-500 dark:text-neutral-400" style={{ backgroundColor: 'color-mix(in srgb, var(--brand-color, #d35400) 10%, transparent)' }}>
                            <DatabaseIcon className="w-3.5 h-3.5" style={{ color: 'var(--brand-color, #d35400)' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-neutral-900 dark:text-white truncate">{db.name}</p>
                            <p className="text-[10px] text-neutral-400">{db.pages.length} records · {db.properties.length} props</p>
                        </div>
                        <ChevronRight className="w-3 h-3 text-neutral-300 flex-shrink-0" />
                    </button>
                ))}

                {step === 'property' && filteredProperties.map((prop, i) => (
                    <button
                        key={prop.id}
                        onMouseDown={e => { e.preventDefault(); handleSelectProperty(prop.id, prop.name); }}
                        onMouseEnter={() => setFocusIndex(i)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                            i === focusIndex ? 'bg-neutral-100 dark:bg-white/10' : 'hover:bg-neutral-50 dark:hover:bg-white/5'
                        }`}
                    >
                        <div className="w-6 h-6 rounded-md border border-neutral-200 dark:border-white/10 flex items-center justify-center text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-white/5">
                            {propTypeIcon(prop.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-neutral-900 dark:text-white truncate">{prop.name}</p>
                            <p className="text-[10px] text-neutral-400 capitalize">{prop.type.replace(/_/g, ' ')}</p>
                        </div>
                        {triggerType === 'prop' && <ArrowRight className="w-3 h-3 text-neutral-300 flex-shrink-0" />}
                    </button>
                ))}

                {step === 'aggregator' && filteredAggregators.map((agg, i) => (
                    <button
                        key={agg.id}
                        onMouseDown={e => { e.preventDefault(); handleSelectAggregator(agg.id); }}
                        onMouseEnter={() => setFocusIndex(i)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                            i === focusIndex ? 'bg-neutral-100 dark:bg-white/10' : 'hover:bg-neutral-50 dark:hover:bg-white/5'
                        }`}
                    >
                        <code className="text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-white/10 text-neutral-700 dark:text-neutral-300">{agg.label}</code>
                        <span className="text-[11px] text-neutral-500 dark:text-neutral-400">{agg.description}</span>
                    </button>
                ))}

                {currentItems.length === 0 && (
                    <div className="px-3 py-6 text-center text-xs text-neutral-400">No results</div>
                )}
            </div>
        </div>
    );
}
