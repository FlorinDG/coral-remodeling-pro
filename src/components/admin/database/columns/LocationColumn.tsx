import React from 'react';
import { CellProps, Column } from 'react-datasheet-grid';
import { MapPin } from 'lucide-react';

export interface LocationColumnOptions {
    propId: string;
    onCommit: (rowId: string, value: any) => void;
}

const LocationComponent = ({ rowData: fullRow, setRowData, focus, active, columnData }: CellProps<any, LocationColumnOptions>) => {
    const value = fullRow?.[columnData.propId];

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!value) return;
        
        let url = '';
        if (value.lat && value.lng) {
            url = `https://www.google.com/maps/search/?api=1&query=${value.lat},${value.lng}`;
        } else if (value.address) {
            url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value.address)}`;
        }
        
        if (url) {
            window.open(url, '_blank');
        }
    };

    return (
        <div 
            className="w-full h-full flex items-center justify-between px-3 text-sm"
        >
            <div className="truncate text-neutral-600 dark:text-neutral-300">
                {value?.address || ''}
            </div>
            {value && (value.lat || value.address) && (
                <button 
                    onClick={handleClick}
                    className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded flex-shrink-0"
                    title="Open in Google Maps"
                >
                    <MapPin className="w-4 h-4 text-blue-500" />
                </button>
            )}
        </div>
    );
};

export const locationColumn = (options: LocationColumnOptions): Column<any, LocationColumnOptions> => ({
    component: LocationComponent,
    columnData: options,
    disableKeys: true,
    keepFocus: false,
    deleteValue: (row) => ({ ...row, [options.propId]: null }),
    copyValue: ({ rowData: fullRow }) => {
        return fullRow?.[options.propId]?.address || '';
    },
    pasteValue: ({ value, rowData: fullRow }) => {
        if (!value) return { ...fullRow, [options.propId]: null };
        return { ...fullRow, [options.propId]: { address: value } };
    },
    isCellEmpty: ({ rowData: fullRow }) => !fullRow?.[options.propId],
});
