/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef, useCallback } from 'react';
import type { Database } from '../types';

export type VatLookupState = {
    status: 'typing' | 'loading' | 'found' | 'not_found' | 'error';
    vatNumber: string;
    rowId: string;
    anchorRect: DOMRect | null;
    data?: { name: string | null; street: string | null; postalCode: string | null; city: string | null; peppolActive?: boolean };
} | null;

interface UseVatLookupParams {
    database: Database | undefined;
    rowData: any[];
    gridAreaRef: React.RefObject<HTMLDivElement | null>;
    updatePageProperty: (databaseId: string, pageId: string, propertyId: string, value: any) => void;
}

/**
 * Manages VAT company lookup: typing detection in VAT columns, API fetch,
 * Peppol auto-verification, and applying lookup results to row properties.
 */
export function useVatLookup({ database, rowData, gridAreaRef, updatePageProperty }: UseVatLookupParams) {
    const [vatLookup, setVatLookup] = useState<VatLookupState>(null);
    const vatDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Trigger API fetch when vatLookup enters 'loading' state
    useEffect(() => {
        if (!vatLookup || vatLookup.status !== 'loading') return;
        const controller = new AbortController();
        fetch(`/api/company/lookup?vat=${encodeURIComponent(vatLookup.vatNumber)}`, { signal: controller.signal })
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (!data?.isValid) {
                    setVatLookup(prev => prev ? { ...prev, status: 'not_found' } : null);
                    return;
                }
                const name = data.name && data.name !== '---' ? data.name : null;
                const addressParts = data.address && data.address !== '---' ? data.address.split('\n') : [];
                const streetLine = addressParts[0] || null;
                const cityLineParts = (addressParts[1] || '').match(/^(\d{4,5})\s+(.+)/);
                setVatLookup(prev => prev ? {
                    ...prev,
                    status: 'found',
                    data: {
                        name,
                        street: streetLine,
                        postalCode: cityLineParts?.[1] || null,
                        city: cityLineParts?.[2] || null,
                        peppolActive: !!data.peppolActive
                    }
                } : null);
            })
            .catch(() => setVatLookup(prev => prev ? { ...prev, status: 'error' } : null));
        return () => controller.abort();
    }, [vatLookup?.status, vatLookup?.vatNumber]);

    // ── Live VAT typing detection via event delegation ────────────────────────
    useEffect(() => {
        const gridEl = gridAreaRef.current;
        if (!gridEl || !database) return;

        const vatPropertyNames = ['vat', 'tva', 'btw', 'vat_number', 'vatnumber', 'n_tva', 'nrtva', 'btw_nummer', 'btwnr'];
        const vatPropIds = database.properties
            .filter(p => vatPropertyNames.some(v =>
                p.id.toLowerCase().replace(/[^a-z0-9]/g, '').includes(v.replace(/[^a-z0-9]/g, '')) ||
                (p.name || '').toLowerCase().replace(/[^a-z0-9]/g, '').includes(v.replace(/[^a-z0-9]/g, ''))
            ))
            .map(p => p.id);

        if (vatPropIds.length === 0) return;

        const handleInput = (e: Event) => {
            const input = e.target as HTMLInputElement;
            if (!input || input.tagName !== 'INPUT') return;

            const cell = input.closest('[class*="dsg-col-"]') as HTMLElement;
            if (!cell) return;

            const vatPropId = vatPropIds.find(id => cell.classList.contains(`dsg-col-${id}`));
            if (!vatPropId) return;

            const value = input.value.trim();

            if (vatDebounceRef.current) clearTimeout(vatDebounceRef.current);

            if (value.length < 2) {
                setVatLookup(null);
                return;
            }

            const rect = cell.getBoundingClientRect();

            // Find the row ID from the data-page-id attribute
            const rowId = cell.closest('[data-page-id]')?.getAttribute('data-page-id') || '';
            if (!rowId) return;

            const cleanVal = value.replace(/[\s.]/g, '').toUpperCase();
            let lookupVal = cleanVal;
            if (/^\d{9,10}$/.test(cleanVal)) {
                lookupVal = 'BE' + (cleanVal.length === 9 ? '0' + cleanVal : cleanVal);
            }
            const isValidVat = lookupVal.length >= 10 && /^[A-Z]{2}\d{8,12}$/.test(lookupVal);

            // Show flyout immediately in 'typing' state
            setVatLookup({
                status: 'typing',
                vatNumber: lookupVal,
                rowId,
                anchorRect: rect,
            });

            // Debounce: auto-trigger lookup if valid pattern
            vatDebounceRef.current = setTimeout(() => {
                if (isValidVat) {
                    setVatLookup(prev => prev ? { ...prev, status: 'loading', vatNumber: lookupVal } : null);
                }
            }, 400);
        };

        gridEl.addEventListener('input', handleInput, true);
        return () => {
            gridEl.removeEventListener('input', handleInput, true);
            if (vatDebounceRef.current) clearTimeout(vatDebounceRef.current);
        };
    }, [database?.id, database?.properties, rowData, gridAreaRef]);

    // ── Automatic Background Peppol Verification ──────────────────────────
    useEffect(() => {
        if (!database || (database.id !== 'db-suppliers' && database.id !== 'db-clients')) return;
        
        const vatPropId = database.properties.find(p => 
            ['vat', 'tva', 'btw', 'vat_number'].some(v => (p.name || '').toLowerCase().includes(v)) ||
            p.id.toLowerCase() === 'vat'
        )?.id;
        
        if (!vatPropId) return;

        // Find pages that have a VAT but no peppol_active flag (not even false)
        const uncheckedPages = database.pages.filter(p => {
            const vatVal = String(p.properties[vatPropId] || '').replace(/[\s.]/g, '');
            const hasVat = vatVal.length >= 8;
            const isUnchecked = p.properties['peppol_active'] === undefined;
            return hasVat && isUnchecked;
        }).slice(0, 3); // process in small batches of 3

        if (uncheckedPages.length === 0) return;

        const checkBatch = async () => {
            for (const page of uncheckedPages) {
                const vatVal = String(page.properties[vatPropId] || '').replace(/[\s.]/g, '');
                try {
                    const res = await fetch(`/api/company/lookup?vat=${encodeURIComponent(vatVal)}`);
                    if (res.ok) {
                        const data = await res.json();
                        updatePageProperty(database.id, page.id, 'peppol_active', !!data.peppolActive);
                    } else {
                        // Mark as checked (false) so we don't infinitely retry failed lookups
                        updatePageProperty(database.id, page.id, 'peppol_active', false);
                    }
                } catch (err) {
                    updatePageProperty(database.id, page.id, 'peppol_active', false);
                }
                // small delay between checks to avoid rate limits
                await new Promise(r => setTimeout(r, 1000));
            }
        };

        checkBatch();
    }, [database, database?.id, database?.pages.length, updatePageProperty]); // trigger on DB load or new pages

    // Apply the VAT lookup data to the row
    const applyVatLookup = useCallback(() => {
        if (!vatLookup?.data || !database) return;
        const findPropId = (patterns: string[]) =>
            database.properties.find(p =>
                patterns.some(pat => (p.name || '').toLowerCase().replace(/[^a-z0-9]/g, '').includes(pat))
            )?.id;
        const companyPropId = findPropId(['societe', 'société', 'company', 'bedrijf', 'onderneming', 'firmanaam']);
        const addressPropId = findPropId(['adresse', 'address', 'adres', 'straat', 'street', 'rue']);
        const cityPropId = findPropId(['ville', 'city', 'stad', 'gemeente', 'town']);
        const postalPropId = findPropId(['code postal', 'postal', 'postcode', 'postalcode', 'zip', 'plz']);

        const { name, street, city, postalCode, peppolActive } = vatLookup.data;
        if (companyPropId && name) updatePageProperty(database.id, vatLookup.rowId, companyPropId, name);
        if (addressPropId && street) updatePageProperty(database.id, vatLookup.rowId, addressPropId, street);
        if (cityPropId && city) updatePageProperty(database.id, vatLookup.rowId, cityPropId, city);
        if (postalPropId && postalCode) updatePageProperty(database.id, vatLookup.rowId, postalPropId, postalCode);
        
        // Save peppol_active flag internally
        updatePageProperty(database.id, vatLookup.rowId, 'peppol_active', !!peppolActive);
        
        setVatLookup(null);
    }, [vatLookup, database, updatePageProperty]);

    return { vatLookup, setVatLookup, applyVatLookup };
}
