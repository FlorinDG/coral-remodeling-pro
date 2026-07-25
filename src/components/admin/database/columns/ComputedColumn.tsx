import React from 'react';
import { Column } from 'react-datasheet-grid';

export const computedColumn = (computeFn: (row: any, allDatabases: any[]) => any): Column<any, any> => ({
    component: ({ rowData, rowIndex }) => {
        // We need allDatabases somehow, or we can just pass the store's databases if we inject it
        // A simpler way is to evaluate computeFn in the useGridColumns hook and pass the value
        return (
            <div className="w-full h-full flex items-center px-3 text-sm text-neutral-600 dark:text-neutral-400 bg-neutral-50/50 dark:bg-white/[0.02]">
                {rowData?.computedValue}
            </div>
        );
    },
    deleteValue: () => null,
    copyValue: ({ rowData }) => String(rowData?.computedValue || ''),
    pasteValue: () => null,
    isCellEmpty: () => false,
});
