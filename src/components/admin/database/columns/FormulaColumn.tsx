import React, { useMemo } from 'react';
import { CellProps, Column } from 'react-datasheet-grid';
import { useDatabaseStore } from '../store';
import { evaluateFormula } from '../formulaEngine';
import { Calculator } from 'lucide-react';

interface FormulaComponentProps extends CellProps<any, any> {
    formulaExpression: string;
    databaseId: string;
}

const FormulaComponent = ({ rowData, formulaExpression, databaseId }: FormulaComponentProps) => {
    const database = useDatabaseStore(state => state.databases.find(db => db.id === databaseId));

    const computedValue = useMemo(() => {
        if (!rowData || !formulaExpression || !database) return null;

        return evaluateFormula(formulaExpression, {
            rowProperties: rowData.properties || {},
            schema: database.properties
        });
    }, [rowData, formulaExpression, database]);

    if (computedValue === null || computedValue === undefined || computedValue === '') {
        return <div className="w-full h-full p-2 flex items-center text-neutral-400 text-sm italic">Empty</div>;
    }

    const isError = computedValue === '#ERROR!';

    return (
        <div className="w-full h-full p-2 flex items-center gap-2 overflow-hidden">
            <Calculator className={`w-3 h-3 flex-shrink-0 ${isError ? 'text-red-500' : 'text-neutral-400'}`} />
            <span className={`truncate text-sm ${isError ? 'text-red-500 font-medium' : 'text-neutral-700 dark:text-neutral-300'}`}>
                {String(computedValue)}
            </span>
        </div>
    );
};

export const formulaColumn = (formulaExpression: string, databaseId: string): Column<any, any> => ({
    component: (props) => <FormulaComponent {...props} formulaExpression={formulaExpression} databaseId={databaseId} />,
    keepFocus: false, // Read only
    disabled: true, // Formulas cannot be edited manually
    deleteValue: ({ rowData }) => rowData, // No-op
    copyValue: ({ rowData }) => {
        return 'Calculated Value';
    },
    pasteValue: ({ rowData }) => rowData, // No-op
    isCellEmpty: () => false,
});
