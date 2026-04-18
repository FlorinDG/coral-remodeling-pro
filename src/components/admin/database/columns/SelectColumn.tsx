import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CellProps, Column } from 'react-datasheet-grid';
import { SelectOption } from '../types';
import { Check } from 'lucide-react';

interface SelectColumnOptions {
    choices: SelectOption[];
}

export const COLOR_STYLES: Record<string, { badge: string; dot: string }> = {
    yellow:  { badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',   dot: 'bg-amber-400' },
    blue:    { badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',       dot: 'bg-blue-500' },
    green:   { badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200', dot: 'bg-emerald-500' },
    red:     { badge: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',           dot: 'bg-red-500' },
    gray:    { badge: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400', dot: 'bg-neutral-400' },
    purple:  { badge: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200', dot: 'bg-purple-500' },
    pink:    { badge: 'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-200',       dot: 'bg-pink-500' },
    orange:  { badge: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200', dot: 'bg-orange-400' },
};

const SelectComponent = ({ rowData, setRowData, focus, active, stopEditing, columnData }: CellProps<any, SelectColumnOptions>) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const value = rowData;
    const choices = columnData.choices || [];
    const selectedOption = choices.find(c => c.id === value);
    const styles = selectedOption ? (COLOR_STYLES[selectedOption.color] || COLOR_STYLES.gray) : null;

    const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; minWidth: number } | null>(null);

    useLayoutEffect(() => {
        if ((focus || active) && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const left = Math.min(rect.left, window.innerWidth - 220);
            setDropdownPos({
                top: rect.bottom + 4,
                left,
                minWidth: Math.max(rect.width, 200),
            });
        } else {
            setDropdownPos(null);
        }
    }, [focus, active]);

    const handleSelect = (choiceId: string | null) => {
        setRowData(choiceId);
        setTimeout(() => stopEditing(), 10);
    };

    return (
        <div ref={containerRef} className="w-full h-full flex items-center px-2">
            {/* Badge chip display */}
            {selectedOption && styles ? (
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold ${styles.badge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${styles.dot} flex-shrink-0`} />
                    {selectedOption.name}
                </span>
            ) : (
                <span className="text-neutral-300 dark:text-neutral-600 text-xs select-none">—</span>
            )}

            {/* Custom dropdown portal */}
            {(focus || active) && dropdownPos && typeof document !== 'undefined' && createPortal(
                <div
                    className="fixed z-[99999] bg-white dark:bg-neutral-900 rounded-xl shadow-2xl border border-neutral-100 dark:border-neutral-700/80 py-1.5 overflow-hidden"
                    style={{ top: dropdownPos.top, left: dropdownPos.left, minWidth: dropdownPos.minWidth }}
                    onMouseDown={e => e.preventDefault()}
                >
                    {/* Empty option */}
                    <button
                        className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors text-left group"
                        onClick={() => handleSelect(null)}
                    >
                        <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                            {!value && <Check className="w-3 h-3 text-neutral-400" />}
                        </span>
                        <span className="text-xs text-neutral-400 italic font-medium">Empty</span>
                    </button>

                    {choices.length > 0 && (
                        <div className="h-px bg-neutral-100 dark:bg-neutral-800 mx-2 my-0.5" />
                    )}

                    {choices.map(choice => {
                        const c = COLOR_STYLES[choice.color] || COLOR_STYLES.gray;
                        const isSelected = choice.id === value;
                        return (
                            <button
                                key={choice.id}
                                className={`w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors ${isSelected ? 'bg-neutral-50 dark:bg-neutral-800/50' : ''}`}
                                onClick={() => handleSelect(choice.id)}
                            >
                                <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                                    {isSelected && <Check className="w-3 h-3 text-neutral-400 dark:text-neutral-500" />}
                                </span>
                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold ${c.badge}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${c.dot} flex-shrink-0`} />
                                    {choice.name}
                                </span>
                            </button>
                        );
                    })}
                </div>,
                document.body
            )}
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
