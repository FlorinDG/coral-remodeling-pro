import React, { useMemo } from 'react';
import { CellProps, Column } from 'react-datasheet-grid';
import { useDatabaseStore } from '../store';
import { Search } from 'lucide-react';

export function applyRollupAggregation(results: string[], aggregation?: string): string[] {
    if (!results || results.length === 0) return [];
    const agg = aggregation || 'show_original';

    switch (agg) {
        case 'extract_numbers':
            return results.map(r => r.replace(/[^\d+]/g, '')).filter(Boolean);
        case 'sum': {
            const sum = results.reduce((acc, curr) => acc + (parseFloat(curr.replace(/[^\d.-]/g, '')) || 0), 0);
            return [String(sum)];
        }
        case 'average': {
            const sum = results.reduce((acc, curr) => acc + (parseFloat(curr.replace(/[^\d.-]/g, '')) || 0), 0);
            return [String(Number((sum / results.length).toFixed(2)))];
        }
        case 'count':
            return [String(results.length)];
        case 'show_original':
        default:
            return results;
    }
}

interface RollupComponentProps extends CellProps<any, any> {
    rollupPropertyId: string;
    rollupTargetPropertyId: string;
    rollupAggregation?: string;
}

const RollupComponent = ({ rowData, rollupPropertyId, rollupTargetPropertyId, rollupAggregation }: RollupComponentProps) => {
    // A Rollup requires read-access to the entire DB registry to cross-reference
    const databases = useDatabaseStore(state => state.databases);

    const aggregatedValues = useMemo(() => {
        if (!rowData || !rollupPropertyId || !rollupTargetPropertyId) return [];

        // 1. Get the relation IDs from the current row
        const relationIds = rowData.properties?.[rollupPropertyId] as string[];
        if (!relationIds || !Array.isArray(relationIds) || relationIds.length === 0) return [];

        // 2. We need to figure out WHICH database these relation IDs belong to.
        // We can do this by inspecting the schema of our OWN database, but since we don't 
        // receive our databaseId in props by default, we just scan all DBs for the page IDs.
        // (A more optimized approach would pass the relation config down).

        const results: string[] = [];

        for (const targetPageId of relationIds) {
            // Find the database containing this page
            const targetDb = databases.find(db => db.pages.some(p => p.id === targetPageId));
            if (targetDb) {
                const targetPage = targetDb.pages.find(p => p.id === targetPageId);
                if (targetPage) {
                    const val = targetPage.properties[rollupTargetPropertyId];
                    if (val !== undefined && val !== null && String(val).trim() !== '') {
                        results.push(String(val));
                    }
                }
            }
        }

        return applyRollupAggregation(results, rollupAggregation);
    }, [rowData, rollupPropertyId, rollupTargetPropertyId, rollupAggregation, databases]);

    if (aggregatedValues.length === 0) {
        return <div className="w-full h-full p-2 flex items-center text-neutral-400 text-sm italic">Empty</div>;
    }

    return (
        <div className="w-full h-full p-2 flex items-center gap-1 overflow-x-auto no-scrollbar">
            <Search className="w-3 h-3 text-neutral-400 flex-shrink-0 mr-1" />
            {aggregatedValues.map((val, i) => (
                <span key={i} className="px-1.5 py-0.5 bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-neutral-700 dark:text-neutral-300 rounded text-xs whitespace-nowrap">
                    {val}
                </span>
            ))}
        </div>
    );
};

export const rollupColumn = (rollupPropertyId: string, rollupTargetPropertyId: string, rollupAggregation?: string): Column<any, any> => ({
    component: (props) => <RollupComponent {...props} rollupPropertyId={rollupPropertyId} rollupTargetPropertyId={rollupTargetPropertyId} rollupAggregation={rollupAggregation} />,
    keepFocus: false, // Read only
    disabled: true, // Rollups cannot be edited manually
    deleteValue: ({ rowData }) => rowData, // No-op
    copyValue: ({ rowData }) => {
        // We'd have to duplicate the logic here or pass it, for now we just return empty string on copy
        return 'Rollup Value';
    },
    pasteValue: ({ rowData }) => rowData, // No-op
    isCellEmpty: () => false,
});
