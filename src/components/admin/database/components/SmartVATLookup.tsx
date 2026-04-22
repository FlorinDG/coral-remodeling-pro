"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, Loader2, CheckCircle2, XCircle, Building2, MapPin, ArrowDownToLine } from 'lucide-react';

interface VATLookupResult {
    isValid: boolean;
    name: string;
    address: string;
    vatNumber: string;
    countryCode: string;
}

interface SmartVATLookupProps {
    value: string;
    onChange: (value: string) => void;
    onImport: (data: { name: string; address: string; vatNumber: string }) => void;
}

/** Detects if the input looks like a BTW/VAT number */
function looksLikeVAT(input: string): boolean {
    const clean = input.replace(/[\s.\-/]/g, '');
    // Starts with 2-letter country code + digits (e.g., BE0848970428)
    if (/^[A-Za-z]{2}\d{6,}$/.test(clean)) return true;
    // Pure digits, 8+ chars (Belgian enterprise number)
    if (/^\d{8,}$/.test(clean)) return true;
    // Starts with 0 + digits (Belgian format like 0848.970.428)
    if (/^0\d{7,}$/.test(clean)) return true;
    return false;
}

/** Formats a raw enterprise number into BTW display format */
function formatBTW(raw: string): string {
    const clean = raw.replace(/[^0-9]/g, '');
    if (clean.length === 10) {
        return `BE ${clean.substring(0, 4)}.${clean.substring(4, 7)}.${clean.substring(7, 10)}`;
    }
    if (clean.length === 9) {
        return `BE 0${clean.substring(0, 3)}.${clean.substring(3, 6)}.${clean.substring(6, 9)}`;
    }
    return raw;
}

export default function SmartVATLookup({ value, onChange, onImport }: SmartVATLookupProps) {
    const [isSearching, setIsSearching] = useState(false);
    const [result, setResult] = useState<VATLookupResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showResults, setShowResults] = useState(false);
    const [imported, setImported] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);
    const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);

    // Position the dropdown using getBoundingClientRect to escape overflow-hidden ancestors
    const updateDropdownPosition = useCallback(() => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            setDropdownPos({
                top: rect.bottom,
                left: rect.left,
                width: rect.width,
            });
        }
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            if (containerRef.current && !containerRef.current.contains(target)) {
                // Also check if the click is inside the portal dropdown
                const portalEl = document.getElementById('vat-lookup-dropdown');
                if (portalEl && portalEl.contains(target)) return;
                setShowResults(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Update dropdown position on scroll/resize
    useEffect(() => {
        if (!showResults) return;
        updateDropdownPosition();
        const onScroll = () => updateDropdownPosition();
        window.addEventListener('scroll', onScroll, true);
        window.addEventListener('resize', onScroll);
        return () => {
            window.removeEventListener('scroll', onScroll, true);
            window.removeEventListener('resize', onScroll);
        };
    }, [showResults, updateDropdownPosition]);

    const performLookup = useCallback(async (query: string) => {
        if (!query || query.trim().length < 4) return;

        setIsSearching(true);
        setError(null);
        setResult(null);
        setShowResults(true);
        setImported(false);
        updateDropdownPosition();

        try {
            const response = await fetch(`/api/company/lookup?vat=${encodeURIComponent(query)}`);
            if (!response.ok) throw new Error('API error');
            const data = await response.json();

            if (data.isValid) {
                setResult({
                    isValid: true,
                    name: data.name || '---',
                    address: data.address ? data.address.replace(/\n/g, ', ') : '---',
                    vatNumber: data.vatNumber || query,
                    countryCode: data.countryCode || 'BE',
                });
            } else {
                setError('BTW nummer niet gevonden in het VIES register.');
            }
        } catch (e) {
            setError('Kon het register niet bereiken. Probeer opnieuw.');
        } finally {
            setIsSearching(false);
        }
    }, [updateDropdownPosition]);

    const handleInputChange = (newValue: string) => {
        onChange(newValue);
        setImported(false);

        // Clear any pending debounce
        if (debounceRef.current) clearTimeout(debounceRef.current);

        // Auto-search if it looks like a VAT number and has enough chars
        const clean = newValue.replace(/[\s.\-/]/g, '');
        if (looksLikeVAT(newValue) && clean.length >= 10) {
            debounceRef.current = setTimeout(() => {
                performLookup(newValue);
            }, 600);
        } else {
            setResult(null);
            setError(null);
            setShowResults(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (debounceRef.current) clearTimeout(debounceRef.current);
            performLookup(value);
        }
        if (e.key === 'Escape') {
            setShowResults(false);
        }
    };

    const handleImport = () => {
        if (!result || !result.isValid) return;
        onImport({
            name: result.name !== '---' ? result.name : '',
            address: result.address !== '---' ? result.address : '',
            vatNumber: value,
        });
        setImported(true);
        setTimeout(() => setShowResults(false), 1200);
    };

    const isVATFormat = looksLikeVAT(value);

    const dropdown = showResults && dropdownPos && createPortal(
        <div
            id="vat-lookup-dropdown"
            className="fixed z-[999999] bg-white dark:bg-neutral-900 border border-t-0 border-neutral-200 dark:border-neutral-700/80 rounded-b-xl shadow-2xl overflow-hidden"
            style={{
                top: dropdownPos.top,
                left: dropdownPos.left,
                width: dropdownPos.width,
            }}
        >
            {/* Loading state */}
            {isSearching && (
                <div className="flex items-center gap-3 px-4 py-4 text-sm text-neutral-500">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                    <span>Zoeken in EU VIES register...</span>
                </div>
            )}

            {/* Error state */}
            {!isSearching && error && (
                <div className="flex items-start gap-3 px-4 py-4">
                    <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
                        <p className="text-xs text-neutral-400 mt-1">Controleer het nummer en probeer opnieuw.</p>
                    </div>
                </div>
            )}

            {/* Success result — preview card */}
            {!isSearching && result?.isValid && (
                <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {/* Company info */}
                    <div className="px-4 py-3 space-y-2">
                        <div className="flex items-start gap-2.5">
                            <Building2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100 truncate">{result.name}</p>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mt-0.5">
                                    ✓ Actief in VIES register
                                </p>
                            </div>
                        </div>

                        {result.address !== '---' && (
                            <div className="flex items-start gap-2.5">
                                <MapPin className="w-4 h-4 text-neutral-400 flex-shrink-0 mt-0.5" />
                                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">{result.address}</p>
                            </div>
                        )}

                        <div className="flex items-center gap-2.5">
                            <span className="w-4 h-4 flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-neutral-400">BTW</span>
                            <p className="text-xs font-mono text-neutral-600 dark:text-neutral-300">{formatBTW(value)}</p>
                        </div>
                    </div>

                    {/* Import button */}
                    <div className="px-4 py-2.5 bg-neutral-50 dark:bg-white/[0.03]">
                        {imported ? (
                            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="w-4 h-4" />
                                <span className="text-xs font-bold uppercase tracking-wider">Geïmporteerd!</span>
                            </div>
                        ) : (
                            <button
                                onClick={handleImport}
                                className="w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-md transition-colors text-xs font-bold uppercase tracking-wider"
                            >
                                <ArrowDownToLine className="w-3.5 h-3.5" />
                                Gegevens importeren
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>,
        document.body
    );

    return (
        <div ref={containerRef} className="relative w-full">
            {/* Search input */}
            <div className={`flex items-center gap-2 bg-white dark:bg-neutral-900 border rounded-lg px-3 py-1.5 transition-all ${
                showResults
                    ? 'border-neutral-300 dark:border-neutral-600 ring-1 ring-neutral-300/30 rounded-b-none'
                    : 'border-neutral-200 dark:border-neutral-700'
            }`}>
                <Search className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                <input
                    ref={inputRef}
                    type="text"
                    className="w-full bg-transparent outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-600 font-medium text-sm"
                    value={value}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => { if (result || error) { setShowResults(true); updateDropdownPosition(); } }}
                    placeholder="BTW nummer invoeren (bv. BE0848.970.428)"
                />
                {isSearching && <Loader2 className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0" />}
                {!isSearching && result?.isValid && <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
                {!isSearching && error && <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}

                {/* Hint badge */}
                {value && !isSearching && !showResults && (
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0 ${
                        isVATFormat
                            ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-500'
                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400'
                    }`}>
                        {isVATFormat ? '↵ Enter' : 'BTW?'}
                    </span>
                )}
            </div>

            {dropdown}
        </div>
    );
}
