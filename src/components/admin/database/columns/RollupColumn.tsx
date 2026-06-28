import React, { useMemo } from 'react';
import { CellProps, Column } from 'react-datasheet-grid';
import { useDatabaseStore } from '../store';
import { Search } from 'lucide-react';

import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { ExternalLink } from 'lucide-react';

export interface RollupResult {
    value: string;
    targetDbId?: string;
    targetPageId?: string;
}

export function applyRollupAggregation(results: RollupResult[], aggregation?: string): RollupResult[] {
    if (!results || results.length === 0) return [];
    const agg = aggregation || 'show_original';

    switch (agg) {
        case 'extract_numbers':
            return results.map(r => ({ ...r, value: r.value.replace(/[^\d+]/g, '') })).filter(r => Boolean(r.value));
        case 'sum': {
            const sum = results.reduce((acc, curr) => acc + (parseFloat(curr.value.replace(/[^\d.-]/g, '')) || 0), 0);
            return [{ value: String(sum) }];
        }
        case 'average': {
            const sum = results.reduce((acc, curr) => acc + (parseFloat(curr.value.replace(/[^\d.-]/g, '')) || 0), 0);
            return [{ value: String(Number((sum / results.length).toFixed(2))) }];
        }
        case 'count':
            return [{ value: String(results.length) }];
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
    const databases = useDatabaseStore(state => state.databases);
    const router = useRouter();
    const locale = useLocale();

    const aggregatedValues = useMemo(() => {
        if (!rowData || !rollupPropertyId || !rollupTargetPropertyId) return [];

        const relationIds = rowData.properties?.[rollupPropertyId] as string[];
        if (!relationIds || !Array.isArray(relationIds) || relationIds.length === 0) return [];

        const results: RollupResult[] = [];

        for (const targetPageId of relationIds) {
            const targetDb = databases.find(db => db.pages.some(p => p.id === targetPageId));
            if (targetDb) {
                const targetPage = targetDb.pages.find(p => p.id === targetPageId);
                if (targetPage) {
                    const val = targetPage.properties[rollupTargetPropertyId];
                    if (val !== undefined && val !== null && String(val).trim() !== '') {
                        results.push({
                            value: String(val),
                            targetDbId: targetDb.id,
                            targetPageId: targetPage.id
                        });
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
            {aggregatedValues.map((item, i) => (
                <span key={i} className="px-1.5 py-0.5 bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-neutral-700 dark:text-neutral-300 rounded text-xs whitespace-nowrap inline-flex items-center group">
                    {item.value}
                    {item.targetDbId && item.targetPageId && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/${locale}/admin/database/${item.targetDbId}/${item.targetPageId}`);
                            }}
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
