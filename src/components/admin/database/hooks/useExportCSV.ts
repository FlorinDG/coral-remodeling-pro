/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback } from 'react';
import Papa from 'papaparse';
import type { Database, Page } from '../types';
import { useDatabaseStore } from '../store';

interface UseExportCSVParams {
    database: Database | undefined;
    filteredPages: Page[];
    selectedRowIds?: Set<string>;
}

/**
 * Handles CSV export of the current view or selection.
 * Clean data export: respects selection and never mutates/locks database records.
 */
export function useExportCSV({ database, filteredPages, selectedRowIds }: UseExportCSVParams) {
    return useCallback(() => {
        if (!database) return;

        // Export selected rows if selection is non-empty, otherwise filteredPages
        const pagesToExport = (selectedRowIds && selectedRowIds.size > 0)
            ? filteredPages.filter(page => selectedRowIds.has(page.id))
            : filteredPages;

        if (pagesToExport.length === 0) return;

        const store = useDatabaseStore.getState();
        const pageIndex = store.pageIndex || {};

        // Prepare rows
        const csvData = pagesToExport.map(page => {
            const row: Record<string, string> = {};
            database.properties.forEach(p => {
                // Skip the internal export flag from CSV output
                if (p.id === 'accountantExportedAt') return;
                const val = page.properties[p.id];
                if (val === undefined || val === null) {
                    row[p.name] = '';
                } else if (p.type === 'relation' && Array.isArray(val)) {
                    // Resolve relation UUIDs to human-readable titles
                    const targetDbId = p.config?.relationDatabaseId;
                    const targetDb = targetDbId ? store.databases.find(d => d.id === targetDbId) : undefined;
                    const resolvedTitles = val.map(id => {
                        const idStr = String(id);
                        const targetPage = targetDb?.pages.find(p => p.id === idStr);
                        if (targetPage) {
                            return (targetPage.properties as any)?.title || (targetPage.properties as any)?.name || (targetPage.properties as any)?.company || idStr;
                        }
                        const indexEntry = pageIndex[idStr];
                        if (indexEntry) {
                            return indexEntry.title || idStr;
                        }
                        return idStr;
                    });
                    row[p.name] = resolvedTitles.join(', ');
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
    }, [database, filteredPages, selectedRowIds]);
}

