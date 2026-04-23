import { Property, PropertyValue } from './types';

interface FormulaContext {
    rowProperties: Record<string, PropertyValue>;
    schema: Property[];
}

// ────────────────────────────────────────────────────────────────────────────────
// Formula Engine V2 — Notion-compatible function library
// Evaluates formula expressions against a row's property values.
//
// Public API: evaluateFormula(expression, context)
//   - expression:  e.g. 'round(prop("Bruto") * (1 - prop("Lever.%") / 100), 2)'
//   - context:     { rowProperties, schema }
// ────────────────────────────────────────────────────────────────────────────────

// ── Helpers (not exposed to formulas) ─────────────────────────────────────────
const flat = (arr: any[]): any[] => arr.reduce((a, v) => a.concat(Array.isArray(v) ? flat(v) : v), []);
const nums = (...args: any[]): number[] => flat(args).map(Number).filter(n => !isNaN(n));

export function evaluateFormula(expression: string, context: FormulaContext): string | number | boolean | null {
    if (!expression || expression.trim() === '') return null;

    try {
        // 1. Resolve prop("Property Name") → literal JS values
        let parsed = expression;

        const propRegex = /prop\(['"]([^'"]+)['"]\)/g;
        parsed = parsed.replace(propRegex, (_match, propName) => {
            const property = context.schema.find(p => p.name === propName);
            if (!property) throw new Error(`Property "${propName}" not found in schema`);

            const val = context.rowProperties[property.id];
            if (typeof val === 'string') return `"${val.replace(/"/g, '\\"')}"`;
            if (typeof val === 'number' || typeof val === 'boolean') return String(val);
            if (Array.isArray(val)) return JSON.stringify(val);
            return 'null';
        });

        // 2. Preprocess operators
        // Map reserved-word function calls to sandbox aliases
        parsed = parsed.replace(/\bif\s*\(/gi, '_if(');
        parsed = parsed.replace(/\bifs\s*\(/gi, '_ifs(');
        // Keyword logical operators → JS equivalents
        parsed = parsed.replace(/\band\b(?!\s*\()/gi, '&&');
        parsed = parsed.replace(/\bor\b(?!\s*\()/gi, '||');
        parsed = parsed.replace(/\bnot\b(?!\s*\()/gi, '!');
        // Power operator: ^ → **  (avoid replacing !== / ==)
        parsed = parsed.replace(/(?<!=)\^/g, '**');

        // 3. Notion-compatible sandbox
        const sandbox: Record<string, any> = {

            // ── Logic ────────────────────────────────────────────────
            _if: (cond: any, t: any, f: any) => cond ? t : f,
            _ifs: (...args: any[]) => {
                for (let i = 0; i < args.length - 1; i += 2) {
                    if (args[i]) return args[i + 1];
                }
                return args.length % 2 === 1 ? args[args.length - 1] : null;
            },
            empty: (v: any) => v === null || v === undefined || v === '' || v === 0 || (Array.isArray(v) && v.length === 0),
            and: (...args: any[]) => args.every(Boolean),
            or: (...args: any[]) => args.some(Boolean),

            // ── Text ─────────────────────────────────────────────────
            concat: (...args: any[]) => args.join(''),
            length: (v: any) => (v == null ? 0 : typeof v === 'string' ? v.length : Array.isArray(v) ? v.length : 0),
            contains: (str: any, search: any) => String(str).includes(String(search)),
            substring: (str: any, start: number, end?: number) => String(str).substring(start, end),
            lower: (v: any) => String(v).toLowerCase(),
            upper: (v: any) => String(v).toUpperCase(),
            repeat: (v: any, n: number) => String(v).repeat(Math.max(0, Math.floor(n))),
            replace: (str: any, pattern: any, replacement: any) => String(str).replace(new RegExp(String(pattern)), String(replacement)),
            replaceAll: (str: any, pattern: any, replacement: any) => String(str).replace(new RegExp(String(pattern), 'g'), String(replacement)),
            test: (str: any, pattern: any) => new RegExp(String(pattern)).test(String(str)),
            match: (str: any, pattern: any) => String(str).match(new RegExp(String(pattern), 'g')) || [],
            split: (str: any, sep: any) => String(str).split(String(sep)),
            join: (arr: any[], sep?: string) => (Array.isArray(arr) ? arr : []).join(sep ?? ', '),
            trim: (v: any) => String(v).trim(),
            format: (v: any) => {
                if (v instanceof Date) return v.toLocaleString();
                return String(v);
            },

            // ── Math ─────────────────────────────────────────────────
            round: (v: any, decimals?: number) => {
                const n = Number(v);
                if (decimals === undefined || decimals === 0) return Math.round(n);
                const factor = Math.pow(10, decimals);
                return Math.round(n * factor) / factor;
            },
            round2: (v: any) => Math.round(Number(v) * 100) / 100,
            floor: (v: any) => Math.floor(Number(v)),
            ceil: (v: any) => Math.ceil(Number(v)),
            abs: (v: any) => Math.abs(Number(v)),
            sqrt: (v: any) => Math.sqrt(Number(v)),
            cbrt: (v: any) => Math.cbrt(Number(v)),
            sign: (v: any) => Math.sign(Number(v)),
            pow: (base: any, exp: any) => Math.pow(Number(base), Number(exp)),
            exp: (v: any) => Math.exp(Number(v)),
            ln: (v: any) => Math.log(Number(v)),
            log10: (v: any) => Math.log10(Number(v)),
            log2: (v: any) => Math.log2(Number(v)),
            mod: (a: any, b: any) => Number(a) % Number(b),
            pi: () => Math.PI,
            e: () => Math.E,

            // Aggregation (accept spread args + arrays)
            min: (...args: any[]) => Math.min(...nums(...args)),
            max: (...args: any[]) => Math.max(...nums(...args)),
            sum: (...args: any[]) => nums(...args).reduce((a, b) => a + b, 0),
            mean: (...args: any[]) => { const n = nums(...args); return n.length ? n.reduce((a, b) => a + b, 0) / n.length : 0; },
            median: (...args: any[]) => {
                const n = nums(...args).sort((a, b) => a - b);
                if (!n.length) return 0;
                const mid = Math.floor(n.length / 2);
                return n.length % 2 !== 0 ? n[mid] : (n[mid - 1] + n[mid]) / 2;
            },

            // ── Date ─────────────────────────────────────────────────
            now: () => new Date(),
            today: () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; },
            parseDate: (v: any) => new Date(String(v)),
            formatDate: (d: any, fmt?: string) => {
                const date = d instanceof Date ? d : new Date(String(d));
                if (!fmt) return date.toLocaleDateString();
                // Simple substitution for common tokens
                return fmt
                    .replace('YYYY', String(date.getFullYear()))
                    .replace('MM', String(date.getMonth() + 1).padStart(2, '0'))
                    .replace('DD', String(date.getDate()).padStart(2, '0'))
                    .replace('HH', String(date.getHours()).padStart(2, '0'))
                    .replace('mm', String(date.getMinutes()).padStart(2, '0'));
            },
            minute: (d: any) => (d instanceof Date ? d : new Date(String(d))).getMinutes(),
            hour: (d: any) => (d instanceof Date ? d : new Date(String(d))).getHours(),
            day: (d: any) => { const dow = (d instanceof Date ? d : new Date(String(d))).getDay(); return dow === 0 ? 7 : dow; },
            date: (d: any) => (d instanceof Date ? d : new Date(String(d))).getDate(),
            week: (d: any) => {
                const dt = d instanceof Date ? d : new Date(String(d));
                const start = new Date(dt.getFullYear(), 0, 1);
                const diff = dt.getTime() - start.getTime();
                return Math.ceil((diff / 86400000 + start.getDay() + 1) / 7);
            },
            month: (d: any) => (d instanceof Date ? d : new Date(String(d))).getMonth() + 1,
            year: (d: any) => (d instanceof Date ? d : new Date(String(d))).getFullYear(),
            dateAdd: (d: any, amount: number, unit: string) => {
                const dt = new Date(d instanceof Date ? d.getTime() : new Date(String(d)).getTime());
                switch (unit) {
                    case 'years': dt.setFullYear(dt.getFullYear() + amount); break;
                    case 'quarters': dt.setMonth(dt.getMonth() + amount * 3); break;
                    case 'months': dt.setMonth(dt.getMonth() + amount); break;
                    case 'weeks': dt.setDate(dt.getDate() + amount * 7); break;
                    case 'days': dt.setDate(dt.getDate() + amount); break;
                    case 'hours': dt.setHours(dt.getHours() + amount); break;
                    case 'minutes': dt.setMinutes(dt.getMinutes() + amount); break;
                }
                return dt;
            },
            dateSubtract: (d: any, amount: number, unit: string) => {
                return sandbox.dateAdd(d, -amount, unit);
            },
            dateBetween: (d1: any, d2: any, unit: string) => {
                const a = d1 instanceof Date ? d1 : new Date(String(d1));
                const b = d2 instanceof Date ? d2 : new Date(String(d2));
                const diffMs = a.getTime() - b.getTime();
                switch (unit) {
                    case 'years': return Math.floor(diffMs / (365.25 * 86400000));
                    case 'quarters': return Math.floor(diffMs / (91.3125 * 86400000));
                    case 'months': return (a.getFullYear() - b.getFullYear()) * 12 + (a.getMonth() - b.getMonth());
                    case 'weeks': return Math.floor(diffMs / (7 * 86400000));
                    case 'days': return Math.floor(diffMs / 86400000);
                    case 'hours': return Math.floor(diffMs / 3600000);
                    case 'minutes': return Math.floor(diffMs / 60000);
                    default: return Math.floor(diffMs / 86400000);
                }
            },

            // ── List ─────────────────────────────────────────────────
            at: (arr: any[], idx: number) => Array.isArray(arr) ? arr[idx] : null,
            first: (arr: any[]) => Array.isArray(arr) && arr.length > 0 ? arr[0] : null,
            last: (arr: any[]) => Array.isArray(arr) && arr.length > 0 ? arr[arr.length - 1] : null,
            slice: (arr: any[], start: number, end?: number) => Array.isArray(arr) ? arr.slice(start, end) : [],
            sort: (arr: any[]) => Array.isArray(arr) ? [...arr].sort() : [],
            reverse: (arr: any[]) => Array.isArray(arr) ? [...arr].reverse() : [],
            unique: (arr: any[]) => Array.isArray(arr) ? [...new Set(arr)] : [],
            flat: (arr: any[]) => Array.isArray(arr) ? flat(arr) : [],
            includes: (arr: any, v: any) => Array.isArray(arr) ? arr.includes(v) : String(arr).includes(String(v)),

            // ── Type conversion ──────────────────────────────────────
            toNumber: (v: any) => {
                if (v instanceof Date) return v.getTime();
                if (typeof v === 'boolean') return v ? 1 : 0;
                return Number(v);
            },
            toBoolean: (v: any) => Boolean(v),
        };

        const contextNames = Object.keys(sandbox);
        const contextValues = Object.values(sandbox);

        // 4. Execute in sandboxed scope
        const evaluator = new Function(...contextNames, `return ${parsed};`);
        const result = evaluator(...contextValues);

        // Format Date results back to string for display
        if (result instanceof Date) return result.toLocaleDateString();

        return result;
    } catch (e: any) {
        // Suppress to prevent Next.js dev overlay from crashing on expected user typos
        return '#ERROR!';
    }
}
