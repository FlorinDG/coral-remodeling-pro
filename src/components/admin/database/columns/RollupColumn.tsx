import React, { useMemo } from 'react';
import { useOpenLinkedRecord } from '../hooks/useOpenLinkedRecord';
import { CellProps, Column } from 'react-datasheet-grid';
import { useDatabaseStore } from '../store';
import { collectRollup, applyRollupAggregation, locatorOf } from '@/lib/records/rollup';
import { Search } from 'lucide-react';

import { ExternalLink } from 'lucide-react';

// The rollup rule (collect + aggregate) lives in lib/records/rollup.ts — ONE rule for both grids and the record modal.
export { applyRollupAggregation, type RollupResult } from '@/lib/records/rollup';

interface RollupComponentProps extends CellProps<any, any> {
    rollupPropertyId: string;
    rollupTargetPropertyId: string;
    rollupAggregation?: string;
}

const RollupComponent = ({ rowData, rollupPropertyId, rollupTargetPropertyId, rollupAggregation }: RollupComponentProps) => {
    const databases = useDatabaseStore(state => state.databases);
    const openLinked = useOpenLinkedRecord();

    const aggregatedValues = useMemo(() => {
        if (!rowData || !rollupPropertyId || !rollupTargetPropertyId) return [];

        const results = collectRollup(rowData.properties?.[rollupPropertyId], locatorOf(databases), rollupTargetPropertyId);
        return applyRollupAggregation(results, rollupAggregation);
    }, [rowData, rollupPropertyId, rollupTargetPropertyId, rollupAggregation, databases]);

    if (aggregatedValues.length === 0) {
        return <div className="w-full h-full p-2 flex items-center text-neutral-400 text-sm italic">Empty</div>;
    }

    return (
        <div className="w-full h-full p-2 flex items-center gap-1 overflow-x-auto no-scrollbar">
            <Search className="w-3 h-3 text-neutral-400 flex-shrink-0 mr-1" />
            {aggregatedValues.map((item, i) => (
                <span key={i} className="px-1.5 py-0.5 bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-neutral-700 dark:text-neutral-300 rounded text-xs whitespace-nowrap inline-flex items-center group">
                    {item.value}
                    {item.targetDbId && item.targetPageId && (
                        <button
                            // The grid (react-datasheet-grid) activates the cell on a DOCUMENT mousedown and re-renders it into edit
                            // mode — this link was gone before its click fired. Act on mousedown and keep it from the grid.
                            onMouseDown={(e) => {
                                if (e.button !== 0) return;
                                e.preventDefault();
                                e.stopPropagation();
                                openLinked(item.targetDbId, item.targetPageId!);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all ml-0.5 text-orange-500 hover:text-orange-600"
                            title="Open related record"
                        >
                            <ExternalLink className="w-3 h-3" />
                        </button>
                    )}
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
