import React, { useLayoutEffect, useRef } from 'react';
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

    // keyColumn wraps the value: rowData can be a primitive (number) for computed/synced values,
    // or an object { [propertyId]: value } for manually edited cells.
    const val = rowData != null && typeof rowData === 'object' ? rowData[propertyId] : rowData;

    if (!active || readOnly) {
        if (val === undefined || val === null || val === '') {
            return <div className="w-full h-full flex items-center px-3 py-1 text-neutral-400 text-sm tracking-wide">-</div>;
        }
        const numeric = Number(val);
        const formatted = isNaN(numeric) ? String(val) : numeric.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return (
            <div className={`w-full h-full flex items-center justify-end px-3 py-1 text-sm font-medium tracking-wide tabular-nums ${readOnly ? 'text-neutral-500 dark:text-neutral-400 bg-neutral-50/50 dark:bg-white/[0.02]' : 'text-neutral-700 dark:text-neutral-300'}`}>
                <span className="text-neutral-400 mr-auto select-none opacity-70">{symbol}</span>
                {formatted}
            </div>
        );
    }

    return (
        <div className="w-full h-full flex items-center px-3 py-1 bg-blue-50/50 dark:bg-blue-900/10">
            <span className="text-neutral-400 mr-2 select-none text-sm">{symbol}</span>
            <input
                ref={inputRef}
                className="w-full h-full text-sm bg-transparent outline-none focus:ring-0 text-right tabular-nums text-neutral-900 dark:text-white"
                value={val ?? ''}
                onChange={e => setRowData({ ...(rowData || {}), [propertyId]: e.target.value })}
                onBlur={(e) => {
                    const str = e.target.value.replace(/,/g, '.'); // Auto fix euro commas
                    if (str === '') {
                        setRowData({ ...(rowData || {}), [propertyId]: null });
                        return;
                    }
                    const parsed = parseFloat(str);
                    setRowData({ ...(rowData || {}), [propertyId]: isNaN(parsed) ? null : parsed });
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.currentTarget.blur();
                    }
                }}
            />
        </div>
    );
};

export const currencyColumn = (propertyId: string, symbol: string = '€', readOnly: boolean = false): Column<any, any> => ({
    component: (props) => <CurrencyComponent {...props} propertyId={propertyId} symbol={symbol} readOnly={readOnly} />,
    keepFocus: !readOnly,
    deleteValue: readOnly
        ? ({ rowData }) => rowData  // No-op: don't allow deleting computed values
        : ({ rowData }) => ({ ...(rowData || {}), [propertyId]: null }),
    pasteValue: readOnly
        ? ({ rowData }) => rowData  // No-op: don't allow pasting over computed values
        : ({ rowData, value }) => {
            const parsed = parseFloat(String(value).replace(/,/g, '.'));
            return { ...(rowData || {}), [propertyId]: isNaN(parsed) ? null : parsed };
        },
    copyValue: ({ rowData }) => {
        const val = rowData != null && typeof rowData === 'object' ? rowData[propertyId] : rowData;
        return val !== undefined && val !== null ? String(val) : '';
    },
    isCellEmpty: ({ rowData }) => {
        const val = rowData != null && typeof rowData === 'object' ? rowData[propertyId] : rowData;
        return val === undefined || val === null || val === '';
    },
});
