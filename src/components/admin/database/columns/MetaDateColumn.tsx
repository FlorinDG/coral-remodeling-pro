import React from 'react';
import { Column } from 'react-datasheet-grid';
import { Clock } from 'lucide-react';

const MetaDateComponent = ({ rowData }: { rowData: string | null }) => {
    if (!rowData) return <div className="w-full h-full p-2 flex items-center text-neutral-400 italic">Empty</div>;

    const date = new Date(rowData);
    if (isNaN(date.getTime())) return <div className="w-full h-full p-2 flex items-center text-red-500">{rowData}</div>;

    // Display formatted timestamp: DD/MM/YYYY HH:mm
    const display = date.toLocaleString('fr-BE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    return (
        <div className="w-full h-full p-2 flex items-center text-sm text-neutral-500 dark:text-neutral-500 select-none">
            <Clock className="w-3.5 h-3.5 mr-2 opacity-50" />
            {display}
        </div>
    );
};

export const metaDateColumn: Column<string | null, any> = {
    component: MetaDateComponent as any,
    keepFocus: false,
    disableKeys: true,
    deleteValue: () => null, // Should be read-only anyway
    copyValue: ({ rowData }) => rowData || '',
    isCellEmpty: ({ rowData }) => !rowData,
};
