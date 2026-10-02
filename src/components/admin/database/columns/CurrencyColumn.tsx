import React, { useLayoutEffect, useRef, useState } from 'react';
import { cellValue, parseCellInput } from './numberCell';
import { CellProps, Column } from 'react-datasheet-grid';

interface CurrencyComponentProps extends CellProps<any, any> {
    propertyId: string;
    symbol: string;
    readOnly?: boolean;
}

const CurrencyComponent = ({ focus, active, rowData, setRowData, propertyId, symbol, readOnly }: CurrencyComponentProps) => {
    const inputRef = useRef<HTMLInputElement>(null);

    useLayoutEffect(() => {
        if (focus && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [focus]);

    // Inside keyColumn `rowData` IS the field's value (numberCell.ts). Old values the previous version
    // stored as { [propertyId]: v } are unwrapped on read.
    const val = cellValue(rowData, propertyId);
    // While typing, the text stays local; the NUMBER is stored once, on blur / Enter.
    const [draft, setDraft] = useState<string | null>(null);

    if (!active || readOnly) {
        if (val === undefined || val === null || val === '') {
            return <div className="w-full h-full flex items-center px-3 py-1 text-neutral-400 text-sm tracking-wide">-</div>;
        }
        const numeric = Number(val);
        const formatted = isNaN(numeric) ? String(val) : numeric.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return (
            <div className={`w-full h-full flex items-center justify-end px-3 py-1 text-sm font-medium tracking-wide tabular-nums ${readOnly ? 'text-neutral-500 dark:text-neutral-400 bg-neutral-50/50 dark:bg-white/[0.02]' : 'text-neutral-700 dark:text-neutral-300'}`}>
                {symbol !== '%' && <span className="text-neutral-400 mr-auto select-none opacity-70">{symbol}</span>}
                {formatted}
                {symbol === '%' && <span className="text-neutral-400 ml-1 select-none opacity-70">%</span>}
            </div>
        );
    }

    return (
        <div className="w-full h-full flex items-center px-3 py-1 bg-orange-50/50 dark:bg-orange-900/10">
            {symbol !== '%' && <span className="text-neutral-400 mr-2 select-none text-sm">{symbol}</span>}
            <input
                ref={inputRef}
                className="w-full h-full text-sm bg-transparent outline-none focus:ring-0 text-right tabular-nums text-neutral-900 dark:text-white"
                value={draft ?? (val == null ? '' : String(val))}
                onChange={e => setDraft(e.target.value)}
                onBlur={(e) => {
                    setDraft(null);
                    setRowData(parseCellInput(e.target.value));   // the number itself — never an object
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.currentTarget.blur();
                    }
                }}
            />
            {symbol === '%' && <span className="text-neutral-400 ml-1 select-none text-sm">%</span>}
        </div>
    );
};

export const currencyColumn = (propertyId: string, symbol: string = '€', readOnly: boolean = false): Column<any, any> => ({
    component: (props) => <CurrencyComponent {...props} propertyId={propertyId} symbol={symbol} readOnly={readOnly} />,
    keepFocus: !readOnly,
    deleteValue: readOnly
        ? ({ rowData }) => rowData  // No-op: don't allow deleting computed values
        : () => null,
    pasteValue: readOnly
        ? ({ rowData }) => rowData  // No-op: don't allow pasting over computed values
        : ({ value }) => parseCellInput(value),
    copyValue: ({ rowData }) => {
        const val = cellValue(rowData, propertyId);
        return val !== undefined && val !== null ? String(val) : '';
    },
    isCellEmpty: ({ rowData }) => {
        const val = cellValue(rowData, propertyId);
        return val === undefined || val === null || val === '';
    },
});
