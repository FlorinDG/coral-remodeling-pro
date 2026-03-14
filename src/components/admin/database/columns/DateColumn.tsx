import React, { useLayoutEffect, useRef } from 'react';
import { CellProps, Column } from 'react-datasheet-grid';

const DateComponent = ({ rowData, setRowData, focus, active, stopEditing }: CellProps<string | null, any>) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const value = rowData || '';

    useLayoutEffect(() => {
        if (focus && inputRef.current) {
            inputRef.current.focus();
        }
    }, [focus]);

    if (!focus && !active) {
        if (!value) return <div className="w-full h-full p-2 flex items-center text-neutral-400 text-sm">Empty</div>;
        return (
            <div className="w-full h-full p-2 flex items-center text-sm text-neutral-800 dark:text-neutral-200">
                {new Date(value).toLocaleDateString()}
            </div>
        );
    }

    return (
        <input
            ref={inputRef}
            id="date-cell-input"
            name="date-cell-input"
            type="date"
            className="w-full h-full outline-none bg-white dark:bg-neutral-900 px-2 text-sm"
            value={value}
            onChange={(e) => {
                setRowData(e.target.value);
            }}
            onBlur={() => stopEditing()}
        />
    );
};

export const dateColumn: Column<string | null, any> = {
    component: DateComponent,
    keepFocus: true,
    deleteValue: () => null,
    copyValue: ({ rowData }) => rowData || '',
    pasteValue: ({ value }) => {
        const parsed = new Date(value);
        return isNaN(parsed.getTime()) ? null : parsed.toISOString().split('T')[0];
    },
    isCellEmpty: ({ rowData }) => !rowData,
};
