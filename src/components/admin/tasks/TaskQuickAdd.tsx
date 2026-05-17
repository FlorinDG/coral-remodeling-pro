'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Search } from 'lucide-react';

// ── NLP Parser ────────────────────────────────────────────────────────────────

interface ParsedTask {
    title: string;
    due?: string;
    priority?: string;
    tags: string[];
    recurrence?: string;
    defer?: string;
    estimated?: number;
}

const DAY_NAMES = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

function parseNLP(raw: string): ParsedTask {
    const result: ParsedTask = { title: '', tags: [] };
    let text = raw;

    // Priority: p1/p2/p3/p4 or !1/!2/!3/!4
    const prioMatch = text.match(/\b(p[1-4]|![1-4])\b/i);
    if (prioMatch) {
        const n = prioMatch[1].replace(/^[p!]/i, '');
        result.priority = `opt-p${n}`;
        text = text.replace(prioMatch[0], '').trim();
    }

    // Tags: #tagname
    const tagMatches = [...text.matchAll(/#(\w+)/g)];
    result.tags = tagMatches.map(m => `tag-${m[1].toLowerCase()}`);
    text = text.replace(/#\w+/g, '').trim();

    // Estimate: ~30m, ~2h
    const estMatch = text.match(/~(\d+)(m|h)/i);
    if (estMatch) {
        result.estimated = estMatch[2].toLowerCase() === 'h'
            ? +estMatch[1] * 60
            : +estMatch[1];
        text = text.replace(estMatch[0], '').trim();
    }

    // Recurrence: "every …" patterns
    const recurMatch = text.match(/\b(every\s+\w+(\s+\w+)?|daily|weekly|monthly)\b/i);
    if (recurMatch) {
        result.recurrence = recurMatch[0].toLowerCase();
        text = text.replace(recurMatch[0], '').trim();
    }

    // Defer: "defer friday", "defer next week"
    const deferMatch = text.match(/\bdefer\s+(\w+(\s+\w+)?)/i);
    if (deferMatch) {
        result.defer = resolveDate(deferMatch[1]);
        text = text.replace(deferMatch[0], '').trim();
    }

    // Due date keywords
    const duePatterns: [RegExp, (m?: any) => string | undefined][] = [
        [/\btoday\b/i,    () => offsetDate(0)],
        [/\btomorrow\b/i, () => offsetDate(1)],
        [/\bnext week\b/i,() => offsetDate(7)],
        [/\bin (\d+) days?\b/i, m => offsetDate(m ? +m[1] : 0)],
        [new RegExp(`\\b(${DAY_NAMES.join('|')})\\b`, 'i'), m => nextWeekday(DAY_NAMES.indexOf(m ? m[1].toLowerCase() : ''))],
    ];
    for (const [re, fn] of duePatterns) {
        const m = text.match(re);
        if (m) {
            result.due = fn(m);
            text = text.replace(m[0], '').trim();
            break;
        }
    }

    result.title = text.replace(/\s+/g, ' ').trim() || 'Untitled Task';
    return result;
}

function offsetDate(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
}

function nextWeekday(targetDay: number): string {
    const d = new Date();
    const today = d.getDay();
    let diff = targetDay - today;
    if (diff <= 0) diff += 7;
    d.setDate(d.getDate() + diff);
    return d.toISOString().slice(0, 10);
}

function resolveDate(str: string): string | undefined {
    const s = str.toLowerCase().trim();
    if (s === 'today') return offsetDate(0);
    if (s === 'tomorrow') return offsetDate(1);
    if (s === 'next week') return offsetDate(7);
    const idx = DAY_NAMES.indexOf(s);
    if (idx >= 0) return nextWeekday(idx);
    return undefined;
}

function formatTokenDate(iso: string): string {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ── Component ─────────────────────────────────────────────────────────────────

interface TaskQuickAddProps {
    onAdd: (parsed: ParsedTask) => Promise<void>;
    placeholder?: string;
}

export function TaskQuickAdd({ onAdd, placeholder }: TaskQuickAddProps) {
    const [value, setValue] = useState('');
    const [loading, setLoading] = useState(false);
    const [parsed, setParsed] = useState<ParsedTask | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (value.trim().length > 1) {
            setParsed(parseNLP(value));
        } else {
            setParsed(null);
        }
    }, [value]);

    const handleSubmit = async () => {
        if (!value.trim() || loading) return;
        setLoading(true);
        try {
            await onAdd(parseNLP(value));
            setValue('');
            setParsed(null);
        } finally {
            setLoading(false);
        }
    };

    const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') handleSubmit();
        if (e.key === 'Escape') { setValue(''); setParsed(null); }
    };

    return (
        <div className="relative">
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-900 focus-within:border-orange-400 dark:focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-400/20 transition-all">
                <Search className="w-4 h-4 flex-shrink-0 text-neutral-400" />
                <input
                    ref={inputRef}
                    className="flex-1 bg-transparent text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 outline-none"
                    placeholder={placeholder ?? 'Add task… (p1 tomorrow #site ~30m every monday)'}
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    onKeyDown={handleKey}
                    disabled={loading}
                />
                {value && (
                    <button
                        className="flex-shrink-0 px-2.5 py-1 text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
                        onClick={handleSubmit}
                        disabled={loading}
                    >
                        {loading ? '…' : '+ Add'}
                    </button>
                )}
            </div>

            {/* Token preview */}
            {parsed && value.trim() && (
                <div className="flex flex-wrap gap-1.5 mt-2 px-1">
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-white/10 text-neutral-600 dark:text-neutral-300 font-medium">
                        📝 {parsed.title}
                    </span>
                    {parsed.priority && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 font-medium">
                            {parsed.priority.replace('opt-', '').toUpperCase()}
                        </span>
                    )}
                    {parsed.due && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                            📅 {formatTokenDate(parsed.due)}
                        </span>
                    )}
                    {parsed.tags.map(t => (
                        <span key={t} className="text-[11px] px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                            {t.replace('tag-', '#')}
                        </span>
                    ))}
                    {parsed.recurrence && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                            ↺ {parsed.recurrence}
                        </span>
                    )}
                    {parsed.estimated && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-white/10 text-neutral-600 dark:text-neutral-300">
                            🕐 {parsed.estimated >= 60 ? `${Math.round(parsed.estimated / 60)}h` : `${parsed.estimated}m`}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}

export type { ParsedTask };
