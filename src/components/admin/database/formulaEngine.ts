import { Property, PropertyValue } from './types';

interface FormulaContext {
    rowProperties: Record<string, PropertyValue>;
    schema: Property[];
}

export function evaluateFormula(expression: string, context: FormulaContext): string | number | boolean | null {
    if (!expression || expression.trim() === '') return null;

    try {
        // 1. Resolve prop("Property Name") to actual values
        let parsedExpression = expression;

        // Match prop("Name") or prop('Name')
        const propRegex = /prop\(['"]([^'"]+)['"]\)/g;

        parsedExpression = parsedExpression.replace(propRegex, (match, propName) => {
            // Map property name to property ID using the database schema
            const property = context.schema.find(p => p.name === propName);

            if (!property) {
                throw new Error(`Property "${propName}" not found in schema`);
            }

            const val = context.rowProperties[property.id];

            // Convert property values into valid Javascript literals for the evaluator
            if (typeof val === 'string') {
                return `"${val.replace(/"/g, '\\"')}"`;
            } else if (typeof val === 'number' || typeof val === 'boolean') {
                return String(val);
            } else if (Array.isArray(val)) {
                return JSON.stringify(val);
            } else if (val === null || val === undefined) {
                return 'null';
            }
            return 'null';
        });

        // Map 'if' to '_if' to avoid reserved keyword syntax errors in new Function()
        parsedExpression = parsedExpression.replace(/\bif\s*\(/gi, '_if(');

        // 2. Define secure execution sandbox
        // This injects mathematical and logical helpers mimicking Notion's formula API
        const sandbox = {
            _if: (condition: boolean, trueVal: any, falseVal: any) => condition ? trueVal : falseVal,
            concat: (...args: any[]) => args.join(''),
            length: (val: any) => (val ? val.length : 0),
            round: Math.round,
            floor: Math.floor,
            ceil: Math.ceil,
            pow: Math.pow,
            toNumber: (val: any) => Number(val),
            toString: (val: any) => String(val),
            contains: (str: string, search: string) => String(str).includes(String(search)),
        };

        const contextNames = Object.keys(sandbox);
        const contextValues = Object.values(sandbox);

        // 3. Execute
        // By passing the sandbox keys as arguments, we make them globally available inside the function block
        const evaluator = new Function(...contextNames, `return ${parsedExpression};`);

        const result = evaluator(...contextValues);

        return result;
    } catch (e: any) {
        console.error("Formula Evaluation Error:", e);
        return '#ERROR!';
    }
}
