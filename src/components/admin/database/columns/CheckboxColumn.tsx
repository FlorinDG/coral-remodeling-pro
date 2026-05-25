import React, { useEffect, useRef } from 'react';
import { CellProps, Column } from 'react-datasheet-grid';
import { Check } from 'lucide-react';

export interface CheckboxColumnOptions {
    propId: string;
    onCommit: (rowId: string, value: boolean) => void;
}

const CheckboxComponent = ({ rowData: fullRow, setRowData, focus, active, columnData }: CellProps<any, CheckboxColumnOptions>) => {
    const value = !!fullRow?.[columnData.propId];
    const prevActive = useRef(active);

    const handleToggle = () => {
        if (!fullRow?.id) return;
        const newValue = !value;
        columnData.onCommit(fullRow.id, newValue);
        setRowData({ ...fullRow, [columnData.propId]: newValue });
    };

    // DSG intercepts the first click to activate the cell, so the component's
    // onClick never fires on that initial click. We detect activation via the
    // `active` prop transitioning from false→true and toggle immediately.
    useEffect(() => {
        if (active && !prevActive.current) {
            if (!fullRow?.id) return;
            const newValue = !value;
            columnData.onCommit(fullRow.id, newValue);
            setRowData({ ...fullRow, [columnData.propId]: newValue });
        }
        prevActive.current = active;
    }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div 
            className="w-full h-full flex items-center justify-center outline-none select-none"
            onClick={(e) => {
                e.stopPropagation();
                handleToggle();
            }}
            onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    handleToggle();
                }
            }}
            tabIndex={0}
        >
            <div
                className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all duration-150 cursor-pointer shadow-sm
                    ${value 
                        ? 'bg-[var(--brand-color,#d35400)] border-[var(--brand-color,#d35400)] text-white scale-105' 
                        : 'border-neutral-350 dark:border-white/20 hover:border-[var(--brand-color,#d35400)]/60 dark:hover:border-white/45 bg-white dark:bg-neutral-900'
                    }
                `}
            >
                {value && <Check className="w-3.5 h-3.5 stroke-[3] animate-in zoom-in-75 duration-100" />}
            </div>
        </div>
    );
};

export const checkboxColumnCustom = (options: CheckboxColumnOptions): Column<any, CheckboxColumnOptions> => ({
    component: CheckboxComponent,
    columnData: options,
    disableKeys: true,
    keepFocus: true,
    deleteValue: (row) => ({ ...row, [options.propId]: false }),
    copyValue: ({ rowData: fullRow }) => {
        return fullRow?.[options.propId] ? 'true' : 'false';
    },
    pasteValue: ({ value, rowData: fullRow }) => {
        const val = String(value || '').toLowerCase() === 'true' || value === '1' || String(value || '').toLowerCase() === 'yes';
        return { ...fullRow, [options.propId]: val };
    },
    isCellEmpty: ({ rowData: fullRow }) => !fullRow?.[options.propId],
});
