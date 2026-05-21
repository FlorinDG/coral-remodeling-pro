"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Calculator, Search, Copy, Check, ChevronRight, Hash, AlertCircle } from 'lucide-react';
import { useDatabaseStore } from '../store';
import { evaluateFormula } from '../formulaEngine';
import { FORMULA_FUNCTIONS, CATEGORY_META, FormulaFunctionDef } from '../formulaReference';
import { Property } from '../types';

interface FormulaEditorModalProps {
    databaseId: string;
    propertyId: string;
    currentExpression: string;
    onSave: (expression: string) => void;
    onClose: () => void;
}

// ── Property pill component ─────────────────────────────────────────────────
function PropertyPill({ name }: { name: string }) {
    return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300 text-xs font-semibold mx-0.5">
            <Hash className="w-3 h-3" />
            {name}
        </span>
    );
}

// ── Syntax highlighted formula renderer ─────────────────────────────────────
function HighlightedFormula({ expression, properties }: { expression: string; properties: Property[] }) {
    const propNames = useMemo(() => properties.map(p => p.name), [properties]);

    const tokens = useMemo(() => {
        const result: React.ReactNode[] = [];
        let remaining = expression;
        let keyIdx = 0;

        while (remaining.length > 0) {
            // prop("Name") pattern
            const propMatch = remaining.match(/^prop\(['"]([^'"]+)['"]\)/);
            if (propMatch) {
                result.push(<PropertyPill key={keyIdx++} name={propMatch[1]} />);
                remaining = remaining.slice(propMatch[0].length);
                continue;
            }

            // Bare property name
            let foundProp = false;
            for (const name of propNames) {
                if (remaining.startsWith(name) && (remaining.length === name.length || /[^a-zA-Z0-9_]/.test(remaining[name.length]))) {
                    result.push(<PropertyPill key={keyIdx++} name={name} />);
                    remaining = remaining.slice(name.length);
                    foundProp = true;
                    break;
                }
            }
            if (foundProp) continue;

            // String literals
            const strMatch = remaining.match(/^"([^"]*)"/) || remaining.match(/^'([^']*)'/);
            if (strMatch) {
                result.push(<span key={keyIdx++} className="text-green-600 dark:text-green-400">{strMatch[0]}</span>);
                remaining = remaining.slice(strMatch[0].length);
                continue;
            }

            // Numbers
            const numMatch = remaining.match(/^\d+\.?\d*/);
            if (numMatch) {
                result.push(<span key={keyIdx++} className="text-orange-600 dark:text-orange-400">{numMatch[0]}</span>);
                remaining = remaining.slice(numMatch[0].length);
                continue;
            }

            // Function names (word followed by open paren)
            const fnMatch = remaining.match(/^([a-zA-Z_]\w*)\s*(?=\()/);
            if (fnMatch) {
                const isKnown = FORMULA_FUNCTIONS.some(f => f.name === fnMatch[1]);
                result.push(
                    <span key={keyIdx++} className={isKnown ? 'text-orange-600 dark:text-orange-400 font-semibold' : 'text-red-500'}>
                        {fnMatch[1]}
                    </span>
                );
                remaining = remaining.slice(fnMatch[1].length);
                continue;
            }

            // Operators
            if ('+-*/%^><=!&|?:'.includes(remaining[0])) {
                result.push(<span key={keyIdx++} className="text-neutral-500 dark:text-neutral-400 font-bold">{remaining[0]}</span>);
                remaining = remaining.slice(1);
                continue;
            }

            // Default: single character
            result.push(<span key={keyIdx++}>{remaining[0]}</span>);
            remaining = remaining.slice(1);
        }

        return result;
    }, [expression, propNames]);

    return <>{tokens}</>;
}

export default function FormulaEditorModal({
    databaseId,
    propertyId,
    currentExpression,
    onSave,
    onClose,
}: FormulaEditorModalProps) {
    const [expression, setExpression] = useState(currentExpression || '');
    const [search, setSearch] = useState('');
    const [selectedFunction, setSelectedFunction] = useState<FormulaFunctionDef | null>(null);
    const [hoveredFunction, setHoveredFunction] = useState<FormulaFunctionDef | null>(null);
    const [copied, setCopied] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const database = useDatabaseStore(state => state.databases.find(db => db.id === databaseId));
    const updateProperty = useDatabaseStore(state => state.updateProperty);

    const properties = database?.properties || [];
    const sampleRow = database?.pages?.[0];

    // Live preview
    const preview = useMemo(() => {
        if (!expression.trim() || !database) return null;
        try {
            const result = evaluateFormula(expression, {
                rowProperties: sampleRow?.properties || {},
                schema: properties,
            });
            return { value: result, error: false };
        } catch {
            return { value: '#ERROR!', error: true };
        }
    }, [expression, database, sampleRow, properties]);

    // Detect return type
    const resultType = useMemo(() => {
        if (!preview || preview.error) return 'unknown';
        const v: unknown = preview.value;
        if (v instanceof Date) return 'date';
        if (typeof v === 'number') return 'number';
        if (typeof v === 'boolean') return 'boolean';
        if (typeof v === 'string') return 'text';
        if (Array.isArray(v)) return 'list';
        return 'unknown';
    }, [preview]);

    // Filter functions
    const filteredFunctions = useMemo(() => {
        if (!search) return FORMULA_FUNCTIONS;
        const q = search.toLowerCase();
        return FORMULA_FUNCTIONS.filter(f =>
            f.name.toLowerCase().includes(q) ||
            f.description.toLowerCase().includes(q) ||
            f.category.includes(q)
        );
    }, [search]);

    // Group by category
    const categories = useMemo(() => {
        const groups = new Map<string, FormulaFunctionDef[]>();
        filteredFunctions.forEach(f => {
            const existing = groups.get(f.category) || [];
            existing.push(f);
            groups.set(f.category, existing);
        });
        return groups;
    }, [filteredFunctions]);

    const activeDocFunction = hoveredFunction || selectedFunction;

    // Insert function at cursor
    const insertFunction = useCallback((fn: FormulaFunctionDef) => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        const start = textarea.selectionStart;
        const before = expression.slice(0, start);
        const after = expression.slice(textarea.selectionEnd);
        const insertion = `${fn.name}()`;
        const newExpr = before + insertion + after;
        setExpression(newExpr);
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + fn.name.length + 1, start + fn.name.length + 1);
        }, 10);
    }, [expression]);

    // Insert property at cursor
    const insertProperty = useCallback((prop: Property) => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        const start = textarea.selectionStart;
        const before = expression.slice(0, start);
        const after = expression.slice(textarea.selectionEnd);
        const insertion = `prop("${prop.name}")`;
        const newExpr = before + insertion + after;
        setExpression(newExpr);
        setTimeout(() => {
            textarea.focus();
            const pos = start + insertion.length;
            textarea.setSelectionRange(pos, pos);
        }, 10);
    }, [expression]);

    const handleSave = () => {
        updateProperty(databaseId, propertyId, {
            config: { formulaExpression: expression },
        });
        onSave(expression);
        onClose();
    };

    const handleCopyExample = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    return createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div
                className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col"
                style={{ maxHeight: 'min(680px, 85vh)' }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 dark:border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-500/15 flex items-center justify-center">
                            <Calculator className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Edit formula</h2>
                            <p className="text-xs text-neutral-500">Write or edit a formula expression</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors"
                    >
                        <X className="w-5 h-5 text-neutral-500" />
                    </button>
                </div>

                {/* Editor zone */}
                <div className="px-6 py-4 border-b border-neutral-100 dark:border-white/5">
                    {/* Expression input */}
                    <div className="relative border border-orange-300 dark:border-orange-500/40 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-orange-200 dark:focus-within:ring-orange-500/20 transition-shadow">
                        <div className="absolute inset-0 p-4 text-sm font-mono pointer-events-none whitespace-pre-wrap break-words overflow-hidden text-neutral-800 dark:text-neutral-200" aria-hidden="true">
                            <HighlightedFormula expression={expression} properties={properties} />
                        </div>
                        <textarea
                            ref={textareaRef}
                            value={expression}
                            onChange={e => setExpression(e.target.value)}
                            placeholder={'e.g. round(prop("Bruto") * (1 - prop("Korting") / 100), 2)'}
                            rows={3}
                            className="w-full p-4 text-sm font-mono bg-transparent text-transparent caret-neutral-900 dark:caret-white resize-none outline-none relative z-10 placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
                            spellCheck={false}
                        />
                    </div>

                    {/* Preview bar */}
                    <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Preview</span>
                            {preview && (
                                <span className={`text-sm font-mono font-bold px-2 py-0.5 rounded ${
                                    preview.error
                                        ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400'
                                        : 'bg-neutral-100 dark:bg-white/5 text-neutral-900 dark:text-white'
                                }`}>
                                    {preview.error && <AlertCircle className="w-3 h-3 inline mr-1" />}
                                    {String(preview.value)}
                                </span>
                            )}
                            {!preview && expression && (
                                <span className="text-xs text-neutral-400 italic">No preview</span>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            {resultType !== 'unknown' && (
                                <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 px-2 py-1 rounded bg-neutral-100 dark:bg-white/5">
                                    Type: {resultType}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Property pills */}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 self-center mr-1">
                            Properties:
                        </span>
                        {properties.filter(p => p.id !== propertyId && p.type !== 'formula').map(prop => (
                            <button
                                key={prop.id}
                                onClick={() => insertProperty(prop)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 text-xs font-medium hover:bg-purple-100 dark:hover:bg-purple-500/20 transition-colors cursor-pointer border border-purple-200 dark:border-purple-500/20"
                            >
                                <Hash className="w-3 h-3" />
                                {prop.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Bottom zone: Function reference + Documentation */}
                <div className="flex flex-1 min-h-0 overflow-hidden">
                    {/* Left: Function list */}
                    <div className="w-64 border-r border-neutral-100 dark:border-white/5 flex flex-col flex-shrink-0">
                        <div className="p-3 border-b border-neutral-100 dark:border-white/5">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Search functions..."
                                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg outline-none focus:border-orange-400 transition-colors text-neutral-900 dark:text-white placeholder:text-neutral-400"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-1.5">
                            {Array.from(categories.entries()).map(([cat, fns]) => {
                                const meta = CATEGORY_META[cat];
                                return (
                                    <div key={cat} className="mb-2 last:mb-0">
                                        <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-500 flex items-center gap-1.5">
                                            <span>{meta?.icon || '\u2022'}</span>
                                            {meta?.label || cat}
                                        </div>
                                        {fns.map(fn => {
                                            const isActive = activeDocFunction?.name === fn.name;
                                            return (
                                                <button
                                                    key={fn.name}
                                                    onClick={() => {
                                                        setSelectedFunction(fn);
                                                        insertFunction(fn);
                                                    }}
                                                    onMouseEnter={() => setHoveredFunction(fn)}
                                                    onMouseLeave={() => setHoveredFunction(null)}
                                                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors ${
                                                        isActive
                                                            ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-300'
                                                            : 'hover:bg-neutral-100 dark:hover:bg-white/5 text-neutral-700 dark:text-neutral-300'
                                                    }`}
                                                >
                                                    <span className="text-neutral-400 dark:text-neutral-500 text-xs font-mono">#</span>
                                                    <span className="font-mono text-xs">{fn.name}()</span>
                                                    {isActive && <ChevronRight className="w-3 h-3 ml-auto text-orange-500" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right: Documentation */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
                        {activeDocFunction ? (
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-neutral-400 dark:text-neutral-500">#</span>
                                    <h3 className="text-lg font-bold font-mono text-neutral-900 dark:text-white">
                                        {activeDocFunction.name}(<span className="text-neutral-400 font-normal">{activeDocFunction.signature.split('(').slice(1).join('(').replace(')', '')}</span>)
                                    </h3>
                                </div>

                                <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed mb-5">
                                    {activeDocFunction.description}
                                </p>

                                <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-2">
                                    Returns: <span className="text-neutral-600 dark:text-neutral-300 normal-case tracking-normal font-mono">{activeDocFunction.returnType}</span>
                                </div>

                                <div className="mt-5 space-y-3">
                                    <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Examples</div>
                                    {activeDocFunction.examples.map((ex, i) => (
                                        <div key={i} className="relative group">
                                            <div className="bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg p-3 font-mono text-sm">
                                                <div className="text-red-600 dark:text-red-400">{ex.input}</div>
                                                <div className="text-neutral-500 dark:text-neutral-400 mt-1">= {ex.output}</div>
                                            </div>
                                            <button
                                                onClick={() => handleCopyExample(ex.input)}
                                                className="absolute top-2 right-2 p-1.5 rounded-md bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-white/10 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-neutral-100 dark:hover:bg-neutral-700"
                                            >
                                                {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-neutral-400" />}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-center">
                                <Calculator className="w-10 h-10 text-neutral-300 dark:text-neutral-600 mb-3" />
                                <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">
                                    Hover or click a function to see its documentation
                                </p>
                                <p className="text-xs text-neutral-400 mt-1">
                                    Click a property pill above to insert it into the formula
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-3 border-t border-neutral-100 dark:border-white/5 bg-neutral-50/50 dark:bg-black/20">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!expression.trim()}
                        className="px-5 py-2 text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    >
                        Save Formula
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
