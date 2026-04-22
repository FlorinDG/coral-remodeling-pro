"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Search, X, FileText, Users, Receipt, FolderKanban, Database, ArrowRight } from 'lucide-react';
import { useDatabaseStore } from '@/components/admin/database/store';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';

// ── Lightweight fuzzy match ──────────────────────────────────────────────────
function fuzzyMatch(text: string, query: string): { match: boolean; score: number } {
    const lower = text.toLowerCase();
    const q = query.toLowerCase();

    // Exact substring match — highest score
    if (lower.includes(q)) {
        const idx = lower.indexOf(q);
        // Bonus for match at start of string
        const startBonus = idx === 0 ? 100 : 0;
        return { match: true, score: 200 + startBonus - idx };
    }

    // Character-sequence fuzzy match
    let qi = 0;
    let score = 0;
    let lastMatchIdx = -1;
    for (let i = 0; i < lower.length && qi < q.length; i++) {
        if (lower[i] === q[qi]) {
            // Consecutive matches get bonus
            score += (lastMatchIdx === i - 1) ? 10 : 1;
            lastMatchIdx = i;
            qi++;
        }
    }

    return { match: qi === q.length, score };
}

// ── Icon map by database base name ───────────────────────────────────────────
const DB_ICON_MAP: Record<string, React.ReactNode> = {
    'invoices': <Receipt className="w-3.5 h-3.5" />,
    'quotations': <Receipt className="w-3.5 h-3.5" />,
    'clients': <Users className="w-3.5 h-3.5" />,
    'suppliers': <Users className="w-3.5 h-3.5" />,
    'expenses': <Receipt className="w-3.5 h-3.5" />,
    'tickets': <Receipt className="w-3.5 h-3.5" />,
    'tasks': <FolderKanban className="w-3.5 h-3.5" />,
    'projects': <FolderKanban className="w-3.5 h-3.5" />,
    'articles': <FileText className="w-3.5 h-3.5" />,
};

function getDbIcon(dbId: string): React.ReactNode {
    for (const [key, icon] of Object.entries(DB_ICON_MAP)) {
        if (dbId.includes(key)) return icon;
    }
    return <Database className="w-3.5 h-3.5" />;
}

// ── Navigation routes ────────────────────────────────────────────────────────
const NAV_ITEMS = [
    { label: 'Dashboard', path: '/admin/dashboard', keywords: ['dashboard', 'home', 'overzicht'] },
    { label: 'Contacts', path: '/admin/contacts', keywords: ['contacts', 'klanten', 'clients'] },
    { label: 'Suppliers', path: '/admin/suppliers', keywords: ['suppliers', 'leveranciers'] },
    { label: 'Quotations', path: '/admin/quotations', keywords: ['quotations', 'offertes', 'quotes'] },
    { label: 'Sales Invoices', path: '/admin/financials/income/invoices', keywords: ['invoices', 'facturen', 'sales'] },
    { label: 'Purchase Invoices', path: '/admin/financials/expenses/invoices', keywords: ['expenses', 'aankoop', 'purchase'] },
    { label: 'Sales Pipeline', path: '/admin/crm', keywords: ['crm', 'pipeline', 'sales', 'leads'] },
    { label: 'Tasks', path: '/admin/tasks', keywords: ['tasks', 'taken', 'todo'] },
    { label: 'Files', path: '/admin/files', keywords: ['files', 'bestanden', 'documents'] },
    { label: 'Email', path: '/admin/email', keywords: ['email', 'mail', 'inbox'] },
    { label: 'Settings', path: '/admin/settings/company-info', keywords: ['settings', 'instellingen', 'config'] },
    { label: 'Article Library', path: '/admin/library/articles', keywords: ['library', 'articles', 'artikelen', 'catalog'] },
    { label: 'Bestek Library', path: '/admin/library/bestek', keywords: ['bestek', 'specifications', 'library'] },
    { label: 'Projects', path: '/admin/projects', keywords: ['projects', 'projecten'] },
    { label: 'Calendar', path: '/admin/calendar', keywords: ['calendar', 'agenda', 'kalender'] },
];

interface SearchResult {
    id: string;
    title: string;
    subtitle?: string;
    dbName: string;
    dbId: string;
    path: string;
    score: number;
    icon: React.ReactNode;
}

interface NavResult {
    label: string;
    path: string;
    score: number;
}

export default function UniversalSearch() {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const router = useRouter();
    const locale = useLocale();

    const databases = useDatabaseStore(state => state.databases);

    // ⌘K / Ctrl+K shortcut
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(prev => !prev);
            }
            if (e.key === 'Escape') {
                setIsOpen(false);
            }
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, []);

    // Focus input when opening, reset state when closing
    useEffect(() => {
        if (isOpen) {
            const t = setTimeout(() => inputRef.current?.focus(), 50);
            return () => clearTimeout(t);
        } else {
            // Defer cleanup to avoid cascading-render lint warning
            const t = setTimeout(() => { setQuery(''); setSelectedIndex(0); }, 0);
            return () => clearTimeout(t);
        }
    }, [isOpen]);

    // Close on outside click
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isOpen]);

    // ── Search logic ─────────────────────────────────────────────────────────
    const { navResults, recordResults } = useMemo(() => {
        if (!query.trim()) return { navResults: [] as NavResult[], recordResults: [] as SearchResult[] };

        const q = query.trim();

        // Navigation items
        const navMatches: NavResult[] = [];
        for (const item of NAV_ITEMS) {
            const titleMatch = fuzzyMatch(item.label, q);
            const keywordMatch = item.keywords.some(k => fuzzyMatch(k, q).match);
            if (titleMatch.match || keywordMatch) {
                navMatches.push({ label: item.label, path: item.path, score: titleMatch.score + (keywordMatch ? 50 : 0) });
            }
        }
        navMatches.sort((a, b) => b.score - a.score);

        // Database records
        const records: SearchResult[] = [];
        const SEARCH_FIELDS = ['title', 'name', 'naam', 'betreft', 'company', 'email', 'phone', 'invoiceNumber'];

        for (const db of databases) {
            for (const page of db.pages) {
                let bestScore = 0;
                let matchFound = false;
                let matchedField = '';

                for (const field of SEARCH_FIELDS) {
                    const val = page.properties[field];
                    if (!val || typeof val !== 'string' && typeof val !== 'number') continue;
                    const result = fuzzyMatch(String(val), q);
                    if (result.match && result.score > bestScore) {
                        bestScore = result.score;
                        matchFound = true;
                        matchedField = field;
                    }
                }

                if (matchFound) {
                    const title = String(page.properties['title'] || page.properties['name'] || page.properties['naam'] || 'Untitled');
                    const subtitle = matchedField !== 'title' && matchedField !== 'name' && matchedField !== 'naam'
                        ? `${matchedField}: ${String(page.properties[matchedField]).substring(0, 50)}`
                        : undefined;

                    // Determine navigation path
                    let path = `/${locale}/admin/database/${db.id}/${page.id}`;
                    if (db.id.includes('quotations')) path = `/${locale}/admin/quotations/${page.id}`;
                    else if (db.id.includes('invoices') && !db.id.includes('expenses')) path = `/${locale}/admin/financials/income/invoices/${page.id}`;

                    records.push({
                        id: page.id,
                        title,
                        subtitle,
                        dbName: db.name,
                        dbId: db.id,
                        path,
                        score: bestScore,
                        icon: getDbIcon(db.id),
                    });
                }
            }
        }

        records.sort((a, b) => b.score - a.score);
        return { navResults: navMatches.slice(0, 5), recordResults: records.slice(0, 20) };
    }, [query, databases, locale]);

    const totalResults = navResults.length + recordResults.length;

    // Keyboard navigation
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => Math.min(prev + 1, totalResults - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            // Navigate to selected result
            if (selectedIndex < navResults.length) {
                router.push(`/${locale}${navResults[selectedIndex].path}`);
            } else {
                const recordIdx = selectedIndex - navResults.length;
                if (recordResults[recordIdx]) {
                    router.push(recordResults[recordIdx].path);
                }
            }
            setIsOpen(false);
        }
    }, [selectedIndex, navResults, recordResults, totalResults, router, locale]);

    const navigateTo = (path: string) => {
        router.push(path);
        setIsOpen(false);
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-xs text-neutral-400 dark:text-neutral-500 bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg hover:bg-neutral-200 dark:hover:bg-white/10 hover:text-neutral-600 dark:hover:text-neutral-300 transition-all cursor-pointer"
            >
                <Search className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Search...</span>
                <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded shadow-sm text-neutral-500 dark:text-neutral-400">
                    ⌘K
                </kbd>
            </button>
        );
    }

    return (
        <div ref={panelRef} className="relative z-[200]">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/20 dark:bg-black/40 backdrop-blur-sm z-[199]" onClick={() => setIsOpen(false)} />

            {/* Search Panel */}
            <div className="fixed top-[10vh] left-1/2 -translate-x-1/2 w-full max-w-xl z-[200] animate-in fade-in zoom-in-95 duration-150">
                <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-white/10 shadow-2xl overflow-hidden">
                    {/* Search Input */}
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-200 dark:border-white/10">
                        <Search className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
                            onKeyDown={handleKeyDown}
                            placeholder="Search records, pages, navigation..."
                            className="flex-1 bg-transparent outline-none text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400"
                        />
                        <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-neutral-100 dark:hover:bg-white/10 rounded transition-colors">
                            <X className="w-3.5 h-3.5 text-neutral-400" />
                        </button>
                    </div>

                    {/* Results */}
                    <div className="max-h-[60vh] overflow-y-auto">
                        {!query.trim() && (
                            <div className="p-6 text-center text-sm text-neutral-400">
                                <p className="font-medium mb-1">Type to search across all records</p>
                                <p className="text-xs">Contacts, invoices, quotations, articles, tasks, and more</p>
                            </div>
                        )}

                        {query.trim() && totalResults === 0 && (
                            <div className="p-6 text-center text-sm text-neutral-400">
                                <p className="font-medium">No results found</p>
                                <p className="text-xs mt-1">Try a different search term</p>
                            </div>
                        )}

                        {/* Navigation Results */}
                        {navResults.length > 0 && (
                            <div>
                                <div className="px-4 pt-3 pb-1">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Navigation</span>
                                </div>
                                {navResults.map((item, idx) => (
                                    <button
                                        key={item.path}
                                        onClick={() => navigateTo(`/${locale}${item.path}`)}
                                        onMouseEnter={() => setSelectedIndex(idx)}
                                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
                                            selectedIndex === idx
                                                ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300'
                                                : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5'
                                        }`}
                                    >
                                        <ArrowRight className="w-3.5 h-3.5 flex-shrink-0 opacity-50" />
                                        <span className="font-medium">{item.label}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Record Results */}
                        {recordResults.length > 0 && (
                            <div>
                                <div className="px-4 pt-3 pb-1 border-t border-neutral-100 dark:border-white/5">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Records</span>
                                </div>
                                {recordResults.map((item, idx) => {
                                    const globalIdx = navResults.length + idx;
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => navigateTo(item.path)}
                                            onMouseEnter={() => setSelectedIndex(globalIdx)}
                                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
                                                selectedIndex === globalIdx
                                                    ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300'
                                                    : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5'
                                            }`}
                                        >
                                            <span className="flex-shrink-0 opacity-50">{item.icon}</span>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium truncate">{item.title}</div>
                                                {item.subtitle && (
                                                    <div className="text-xs text-neutral-400 truncate">{item.subtitle}</div>
                                                )}
                                            </div>
                                            <span className="flex-shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-white/10 text-neutral-500 dark:text-neutral-400">
                                                {item.dbName}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center gap-4 px-4 py-2 border-t border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-neutral-950 text-[10px] text-neutral-400">
                        <span className="flex items-center gap-1"><kbd className="px-1 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded text-[9px]">↑↓</kbd> Navigate</span>
                        <span className="flex items-center gap-1"><kbd className="px-1 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded text-[9px]">↵</kbd> Open</span>
                        <span className="flex items-center gap-1"><kbd className="px-1 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded text-[9px]">esc</kbd> Close</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
