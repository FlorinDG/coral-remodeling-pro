import React, { useLayoutEffect, useRef } from 'react';
import { CellProps, Column } from 'react-datasheet-grid';
import { SelectOption } from '../types';

interface SelectColumnOptions {
    choices: SelectOption[];
}

const colorMap: Record<string, string> = {
    yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    green: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    red: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    gray: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
    purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    pink: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
    orange: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
};

const SelectComponent = ({ rowData, setRowData, focus, active, stopEditing, columnData }: CellProps<any, SelectColumnOptions>) => {
    const selectRef = useRef<HTMLSelectElement>(null);
    const value = rowData;
    const choices = columnData.choices || [];
    const selectedOption = choices.find(c => c.id === value);

    useLayoutEffect(() => {
        if (focus && selectRef.current) {
            selectRef.current.focus();
        }
    }, [focus]);

    // Seamless 1-Click Select View
    return (
        <div className="relative w-full h-full flex items-center p-2 isolate">
            {/* Visual Formatting Layer (only visible when not active/editing) */}
            {(!focus && !active) && (
                <span className={`px-2 py-0.5 rounded-sm text-xs font-medium z-0 ${selectedOption ? (colorMap[selectedOption.color] || colorMap.gray) : 'opacity-0'}`}>
                    {selectedOption ? selectedOption.name : ''}
                </span>
            )}

            {/* Interactive Select Overlay */}
            <select
                ref={selectRef}
                className={`absolute inset-0 w-full h-full outline-none px-2 text-sm z-10 cursor-pointer ${(!focus && !active) ? 'opacity-0' : 'bg-white dark:bg-neutral-900 opacity-100'}`}
                value={value || ''}
                onMouseDown={(e) => {
                    // CRITICAL: Stop the grid from swallowing the native click!
                    // react-datasheet-grid usually calls e.preventDefault() on cells to trap focus.
                    // By stopping propagation here, the OS handles the click and natively opens the dropdown!
                    e.stopPropagation();
                }}
                onChange={(e) => {
                    setRowData(e.target.value);
                    if (focus || active) {
                        setTimeout(() => stopEditing(), 0);
                    }
                }}
                onBlur={() => {
                    if (focus) stopEditing();
                }}
            >
                <option value="">Empty</option>
                {choices.map(choice => (
                    <option key={choice.id} value={choice.id}>
                        {choice.name}
                    </option>
                ))}
            </select>
        </div>
    );
};

export const selectColumn = (options: SelectColumnOptions): Column<string | null, SelectColumnOptions> => ({
    component: SelectComponent,
    columnData: options,
    disableKeys: true,
    keepFocus: true,
    deleteValue: () => null,
    copyValue: ({ rowData }) => {
        const choice = options.choices.find(c => c.id === rowData);
        return choice ? choice.name : '';
    },
    pasteValue: ({ value }) => {
        const choice = options.choices.find(c => c.name.toLowerCase() === value.toLowerCase());
        return choice ? choice.id : null;
    },
    isCellEmpty: ({ rowData }) => !rowData,
});
