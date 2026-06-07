/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback } from 'react';
import Papa from 'papaparse';
import { toast } from 'sonner';
import type { Database, Page } from '../types';

interface UseExportCSVParams {
    database: Database | undefined;
    filteredPages: Page[];
    isAccountant: boolean;
    updatePageProperty: (databaseId: string, pageId: string, propertyId: string, value: any) => void;
}

/**
 * Handles CSV export of the current filtered/sorted view.
 * Accountant mode additionally stamps each exported record with an export timestamp.
 */
export function useExportCSV({ database, filteredPages, isAccountant, updatePageProperty }: UseExportCSVParams) {
    return useCallback(() => {
        if (!database) return;

        // Prepare rows (using filteredPages so it respects current filters)
        const csvData = filteredPages.map(page => {
            const row: Record<string, string> = {};
            database.properties.forEach(p => {
                // Skip the export flag from CSV output
                if (p.id === 'accountantExportedAt') return;
                const val = page.properties[p.id];
                if (val === undefined || val === null) {
                    row[p.name] = '';
                } else if (Array.isArray(val)) {
                    row[p.name] = val.map(String).join(', ');
                } else {
                    row[p.name] = String(val);
                }
            });
            return row;
        });

        const csvContent = Papa.unparse(csvData);

        // Add UTF-8 BOM for Excel compatibility
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        const dateStr = new Date().toISOString().split('T')[0];
        link.setAttribute('download', `${database.name}_${dateStr}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // ── Accountant export: stamp all exported records ─────────────
        if (isAccountant) {
            filteredPages.forEach(page => {
                if (!page.properties.accountantExportedAt) {
                    updatePageProperty(database.id, page.id, 'accountantExportedAt', true);
                }
            });
            toast.success(`${filteredPages.length} records exported & flagged`);
        }
    }, [database, filteredPages, isAccountant, updatePageProperty]);
}
