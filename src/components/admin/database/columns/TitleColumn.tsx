import React, { useLayoutEffect, useRef, useState } from 'react';
import { CellProps, Column } from 'react-datasheet-grid';
import { Maximize2 } from 'lucide-react';

interface TitleComponentProps extends CellProps<any, any> {
    onOpen?: () => void;
    propId: string;
}

const TitleComponent = ({ rowData, setRowData, focus, active, stopEditing, onOpen, propId }: TitleComponentProps) => {
    const inputRef = useRef<HTMLInputElement>(null);
    // Extract the string value from the rowData
    const value = (rowData?.properties?.[propId] as string) || '';
    const [inputValue, setInputValue] = useState(value);

    // Keep local input state synced with external value changes (unless focused)
    useLayoutEffect(() => {
        if (!focus) {
            setInputValue(value);
        }
    }, [value, focus]);

    useLayoutEffect(() => {
        if (focus && inputRef.current) {
            inputRef.current.focus();
        }
    }, [focus]);

    // When the cell is focused, user is typing in it
    if (focus) {
        return (
            <input
                ref={inputRef}
                id="title-cell-input"
                name="title-cell-input"
                className="w-full h-full outline-none bg-white dark:bg-neutral-900 px-2 text-sm font-medium"
                value={inputValue}
                onChange={(e) => {
                    setInputValue(e.target.value);
                }}
                onBlur={() => {
                    // Commit value when focus leaves cell
                    if (inputValue !== value) {
                        setRowData({
                            ...rowData,
                            properties: {
                                ...(rowData?.properties || {}),
                                [propId]: inputValue
                            }
                        });
                    }
                    stopEditing();
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        // Natively commit value safely before grid steals focus to next row
                        if (inputValue !== value) {
                            setRowData({
                                ...rowData,
                                properties: {
                                    ...(rowData?.properties || {}),
                                    [propId]: inputValue
                                }
                            });
                        }
                    }
                }}
                placeholder="Untitled"
            />
        );
    }

    // Display mode (both active and inactive)
    return (
        <div
            className={`w-full h-full px-2 py-1 flex items-center relative text-sm font-medium ${active ? 'text-neutral-900 dark:text-neutral-100 bg-neutral-100 dark:bg-neutral-800' : 'text-neutral-900 dark:text-neutral-100'
                }`}
        >
            {/* Text Value */}
            <span className="truncate flex-1 pr-16" style={{ pointerEvents: 'none' }}>
                {value || <span className="text-neutral-400 font-normal">Untitled</span>}
            </span>

            {/* Active Open Action */}
            {active && onOpen && (
                <button
                    onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onOpen();
                    }}
                    className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 shadow-sm rounded text-xs font-semibold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-600 transition z-10"
                    style={{ pointerEvents: 'auto' }}
                >
                    <Maximize2 className="w-3 h-3" />
                    OPEN
                </button>
            )}
        </div>
    );
};

export const titleColumn = (propId: string, onOpenRow?: (rowData: any) => void): Column<any, any, string> => ({
    component: (props) => <TitleComponent {...props} propId={propId} onOpen={() => onOpenRow && onOpenRow(props.rowData)} />,
    keepFocus: true,
    deleteValue: ({ rowData }) => ({
        ...rowData,
        properties: { ...(rowData?.properties || {}), [propId]: '' }
    }),
    copyValue: ({ rowData }) => rowData?.properties?.[propId] || '',
    pasteValue: ({ rowData, value }) => ({
        ...rowData,
        properties: { ...(rowData?.properties || {}), [propId]: value || '' }
    }),
    isCellEmpty: ({ rowData }) => {
        const val = rowData?.properties?.[propId];
        return !val || typeof val !== 'string' || val.trim() === '';
    },
});
