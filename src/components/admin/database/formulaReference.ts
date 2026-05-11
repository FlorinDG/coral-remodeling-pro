/**
 * formulaReference.ts — Complete function catalog for the Formula Editor
 *
 * Each entry describes a function available in the formula engine,
 * grouped by category with signature, description, return type, and examples.
 */

export interface FormulaFunctionDef {
    name: string;
    category: 'logic' | 'text' | 'math' | 'date' | 'list' | 'type';
    signature: string;
    description: string;
    returnType: string;
    examples: { input: string; output: string }[];
}

export const FORMULA_FUNCTIONS: FormulaFunctionDef[] = [
    // ── Logic ──────────────────────────────────────────────────────────────
    {
        name: 'if',
        category: 'logic',
        signature: 'if(condition, value_if_true, value_if_false)',
        description: 'Returns one value if a condition is true, and another if false.',
        returnType: 'any',
        examples: [
            { input: 'if(2 > 1, "yes", "no")', output: '"yes"' },
            { input: 'if(empty(Name), "Unknown", Name)', output: '"John"' },
        ],
    },
    {
        name: 'ifs',
        category: 'logic',
        signature: 'ifs(cond1, val1, cond2, val2, ..., default)',
        description: 'Evaluates multiple conditions in order and returns the value of the first true condition. Optional last argument is the default.',
        returnType: 'any',
        examples: [
            { input: 'ifs(Score > 90, "A", Score > 80, "B", "C")', output: '"B"' },
        ],
    },
    {
        name: 'empty',
        category: 'logic',
        signature: 'empty(value)',
        description: 'Returns true if the value is null, undefined, empty string, 0, or an empty array.',
        returnType: 'boolean',
        examples: [
            { input: 'empty("")', output: 'true' },
            { input: 'empty(42)', output: 'false' },
        ],
    },
    {
        name: 'and',
        category: 'logic',
        signature: 'and(value1, value2, ...)',
        description: 'Returns true if all arguments are truthy.',
        returnType: 'boolean',
        examples: [
            { input: 'and(true, true)', output: 'true' },
            { input: 'and(true, false)', output: 'false' },
        ],
    },
    {
        name: 'or',
        category: 'logic',
        signature: 'or(value1, value2, ...)',
        description: 'Returns true if at least one argument is truthy.',
        returnType: 'boolean',
        examples: [
            { input: 'or(false, true)', output: 'true' },
            { input: 'or(false, false)', output: 'false' },
        ],
    },

    // ── Text ───────────────────────────────────────────────────────────────
    {
        name: 'concat',
        category: 'text',
        signature: 'concat(value1, value2, ...)',
        description: 'Joins all arguments into a single string.',
        returnType: 'string',
        examples: [
            { input: 'concat("Hello", " ", "World")', output: '"Hello World"' },
        ],
    },
    {
        name: 'length',
        category: 'text',
        signature: 'length(value)',
        description: 'Returns the number of characters in a string, or items in an array.',
        returnType: 'number',
        examples: [
            { input: 'length("Hello")', output: '5' },
        ],
    },
    {
        name: 'contains',
        category: 'text',
        signature: 'contains(text, search)',
        description: 'Returns true if the text contains the search string.',
        returnType: 'boolean',
        examples: [
            { input: 'contains("Hello World", "World")', output: 'true' },
        ],
    },
    {
        name: 'substring',
        category: 'text',
        signature: 'substring(text, start, end?)',
        description: 'Extracts characters from start to end (exclusive).',
        returnType: 'string',
        examples: [
            { input: 'substring("Hello", 0, 3)', output: '"Hel"' },
        ],
    },
    {
        name: 'lower',
        category: 'text',
        signature: 'lower(text)',
        description: 'Converts text to lowercase.',
        returnType: 'string',
        examples: [
            { input: 'lower("HELLO")', output: '"hello"' },
        ],
    },
    {
        name: 'upper',
        category: 'text',
        signature: 'upper(text)',
        description: 'Converts text to uppercase.',
        returnType: 'string',
        examples: [
            { input: 'upper("hello")', output: '"HELLO"' },
        ],
    },
    {
        name: 'replace',
        category: 'text',
        signature: 'replace(text, pattern, replacement)',
        description: 'Replaces the first occurrence of a pattern with a replacement string.',
        returnType: 'string',
        examples: [
            { input: 'replace("foo bar", "foo", "baz")', output: '"baz bar"' },
        ],
    },
    {
        name: 'replaceAll',
        category: 'text',
        signature: 'replaceAll(text, pattern, replacement)',
        description: 'Replaces all occurrences of a pattern.',
        returnType: 'string',
        examples: [
            { input: 'replaceAll("aabaa", "a", "x")', output: '"xxbxx"' },
        ],
    },
    {
        name: 'trim',
        category: 'text',
        signature: 'trim(text)',
        description: 'Removes leading and trailing whitespace.',
        returnType: 'string',
        examples: [
            { input: 'trim("  hi  ")', output: '"hi"' },
        ],
    },
    {
        name: 'split',
        category: 'text',
        signature: 'split(text, separator)',
        description: 'Splits text into an array of substrings.',
        returnType: 'list',
        examples: [
            { input: 'split("a,b,c", ",")', output: '["a","b","c"]' },
        ],
    },
    {
        name: 'join',
        category: 'text',
        signature: 'join(list, separator?)',
        description: 'Joins array elements into a single string with an optional separator.',
        returnType: 'string',
        examples: [
            { input: 'join(["a","b","c"], "-")', output: '"a-b-c"' },
        ],
    },
    {
        name: 'test',
        category: 'text',
        signature: 'test(text, regex)',
        description: 'Tests if the text matches a regular expression pattern.',
        returnType: 'boolean',
        examples: [
            { input: 'test("abc123", "\\\\d+")', output: 'true' },
        ],
    },
    {
        name: 'repeat',
        category: 'text',
        signature: 'repeat(text, count)',
        description: 'Repeats the text a specified number of times.',
        returnType: 'string',
        examples: [
            { input: 'repeat("ab", 3)', output: '"ababab"' },
        ],
    },
    {
        name: 'format',
        category: 'text',
        signature: 'format(value)',
        description: 'Converts a value to its string representation.',
        returnType: 'string',
        examples: [
            { input: 'format(42)', output: '"42"' },
        ],
    },

    // ── Math ───────────────────────────────────────────────────────────────
    {
        name: 'round',
        category: 'math',
        signature: 'round(number, decimals?)',
        description: 'Rounds a number to a specified number of decimal places.',
        returnType: 'number',
        examples: [
            { input: 'round(3.456, 2)', output: '3.46' },
            { input: 'round(3.5)', output: '4' },
        ],
    },
    {
        name: 'floor',
        category: 'math',
        signature: 'floor(number)',
        description: 'Rounds down to the nearest integer.',
        returnType: 'number',
        examples: [
            { input: 'floor(3.7)', output: '3' },
        ],
    },
    {
        name: 'ceil',
        category: 'math',
        signature: 'ceil(number)',
        description: 'Rounds up to the nearest integer.',
        returnType: 'number',
        examples: [
            { input: 'ceil(3.2)', output: '4' },
        ],
    },
    {
        name: 'abs',
        category: 'math',
        signature: 'abs(number)',
        description: 'Returns the absolute value.',
        returnType: 'number',
        examples: [
            { input: 'abs(-5)', output: '5' },
        ],
    },
    {
        name: 'sqrt',
        category: 'math',
        signature: 'sqrt(number)',
        description: 'Returns the square root.',
        returnType: 'number',
        examples: [
            { input: 'sqrt(16)', output: '4' },
        ],
    },
    {
        name: 'pow',
        category: 'math',
        signature: 'pow(base, exponent)',
        description: 'Returns base raised to the power of exponent.',
        returnType: 'number',
        examples: [
            { input: 'pow(2, 3)', output: '8' },
        ],
    },
    {
        name: 'mod',
        category: 'math',
        signature: 'mod(a, b)',
        description: 'Returns the remainder of dividing a by b.',
        returnType: 'number',
        examples: [
            { input: 'mod(10, 3)', output: '1' },
        ],
    },
    {
        name: 'min',
        category: 'math',
        signature: 'min(value1, value2, ...)',
        description: 'Returns the smallest value from the arguments.',
        returnType: 'number',
        examples: [
            { input: 'min(3, 1, 4, 1, 5)', output: '1' },
        ],
    },
    {
        name: 'max',
        category: 'math',
        signature: 'max(value1, value2, ...)',
        description: 'Returns the largest value from the arguments.',
        returnType: 'number',
        examples: [
            { input: 'max(3, 1, 4, 1, 5)', output: '5' },
        ],
    },
    {
        name: 'sum',
        category: 'math',
        signature: 'sum(value1, value2, ...)',
        description: 'Returns the sum of all numeric arguments.',
        returnType: 'number',
        examples: [
            { input: 'sum(1, 2, 3, 4)', output: '10' },
        ],
    },
    {
        name: 'mean',
        category: 'math',
        signature: 'mean(value1, value2, ...)',
        description: 'Returns the arithmetic average of all numeric arguments.',
        returnType: 'number',
        examples: [
            { input: 'mean(2, 4, 6)', output: '4' },
        ],
    },
    {
        name: 'median',
        category: 'math',
        signature: 'median(value1, value2, ...)',
        description: 'Returns the median value.',
        returnType: 'number',
        examples: [
            { input: 'median(1, 3, 5, 7)', output: '4' },
        ],
    },
    {
        name: 'sign',
        category: 'math',
        signature: 'sign(number)',
        description: 'Returns -1, 0, or 1 depending on the sign of the number.',
        returnType: 'number',
        examples: [
            { input: 'sign(-5)', output: '-1' },
            { input: 'sign(0)', output: '0' },
        ],
    },
    {
        name: 'pi',
        category: 'math',
        signature: 'pi()',
        description: 'Returns the value of π (pi).',
        returnType: 'number',
        examples: [
            { input: 'pi()', output: '3.14159...' },
        ],
    },
    {
        name: 'e',
        category: 'math',
        signature: 'e()',
        description: 'Returns the value of Euler\'s number e.',
        returnType: 'number',
        examples: [
            { input: 'e()', output: '2.71828...' },
        ],
    },
    {
        name: 'ln',
        category: 'math',
        signature: 'ln(number)',
        description: 'Returns the natural logarithm.',
        returnType: 'number',
        examples: [
            { input: 'ln(e())', output: '1' },
        ],
    },
    {
        name: 'log10',
        category: 'math',
        signature: 'log10(number)',
        description: 'Returns the base-10 logarithm.',
        returnType: 'number',
        examples: [
            { input: 'log10(100)', output: '2' },
        ],
    },

    // ── Date ───────────────────────────────────────────────────────────────
    {
        name: 'now',
        category: 'date',
        signature: 'now()',
        description: 'Returns the current date and time.',
        returnType: 'date',
        examples: [
            { input: 'now()', output: '2026-05-11T00:00:00' },
        ],
    },
    {
        name: 'today',
        category: 'date',
        signature: 'today()',
        description: 'Returns today\'s date at midnight.',
        returnType: 'date',
        examples: [
            { input: 'today()', output: '2026-05-11' },
        ],
    },
    {
        name: 'dateAdd',
        category: 'date',
        signature: 'dateAdd(date, amount, unit)',
        description: 'Adds a specified amount of time to a date. Units: years, months, weeks, days, hours, minutes.',
        returnType: 'date',
        examples: [
            { input: 'dateAdd(today(), 7, "days")', output: '7 days from now' },
        ],
    },
    {
        name: 'dateSubtract',
        category: 'date',
        signature: 'dateSubtract(date, amount, unit)',
        description: 'Subtracts a specified amount of time from a date.',
        returnType: 'date',
        examples: [
            { input: 'dateSubtract(today(), 1, "months")', output: '1 month ago' },
        ],
    },
    {
        name: 'dateBetween',
        category: 'date',
        signature: 'dateBetween(date1, date2, unit)',
        description: 'Returns the difference between two dates in the specified unit.',
        returnType: 'number',
        examples: [
            { input: 'dateBetween(Deadline, today(), "days")', output: '14' },
        ],
    },
    {
        name: 'formatDate',
        category: 'date',
        signature: 'formatDate(date, format?)',
        description: 'Formats a date as a string. Tokens: YYYY, MM, DD, HH, mm.',
        returnType: 'string',
        examples: [
            { input: 'formatDate(today(), "DD/MM/YYYY")', output: '"11/05/2026"' },
        ],
    },
    {
        name: 'year',
        category: 'date',
        signature: 'year(date)',
        description: 'Returns the year component of a date.',
        returnType: 'number',
        examples: [
            { input: 'year(today())', output: '2026' },
        ],
    },
    {
        name: 'month',
        category: 'date',
        signature: 'month(date)',
        description: 'Returns the month (1-12) of a date.',
        returnType: 'number',
        examples: [
            { input: 'month(today())', output: '5' },
        ],
    },
    {
        name: 'day',
        category: 'date',
        signature: 'day(date)',
        description: 'Returns the day of the week (1=Monday, 7=Sunday).',
        returnType: 'number',
        examples: [
            { input: 'day(today())', output: '1' },
        ],
    },
    {
        name: 'hour',
        category: 'date',
        signature: 'hour(date)',
        description: 'Returns the hour component (0-23).',
        returnType: 'number',
        examples: [
            { input: 'hour(now())', output: '14' },
        ],
    },
    {
        name: 'minute',
        category: 'date',
        signature: 'minute(date)',
        description: 'Returns the minute component (0-59).',
        returnType: 'number',
        examples: [
            { input: 'minute(now())', output: '30' },
        ],
    },
    {
        name: 'week',
        category: 'date',
        signature: 'week(date)',
        description: 'Returns the week number of the year.',
        returnType: 'number',
        examples: [
            { input: 'week(today())', output: '19' },
        ],
    },

    // ── List ───────────────────────────────────────────────────────────────
    {
        name: 'at',
        category: 'list',
        signature: 'at(list, index)',
        description: 'Returns the element at the specified index.',
        returnType: 'any',
        examples: [
            { input: 'at(["a","b","c"], 1)', output: '"b"' },
        ],
    },
    {
        name: 'first',
        category: 'list',
        signature: 'first(list)',
        description: 'Returns the first element of a list.',
        returnType: 'any',
        examples: [
            { input: 'first(["a","b","c"])', output: '"a"' },
        ],
    },
    {
        name: 'last',
        category: 'list',
        signature: 'last(list)',
        description: 'Returns the last element of a list.',
        returnType: 'any',
        examples: [
            { input: 'last(["a","b","c"])', output: '"c"' },
        ],
    },
    {
        name: 'slice',
        category: 'list',
        signature: 'slice(list, start, end?)',
        description: 'Returns a portion of a list from start to end.',
        returnType: 'list',
        examples: [
            { input: 'slice(["a","b","c","d"], 1, 3)', output: '["b","c"]' },
        ],
    },
    {
        name: 'sort',
        category: 'list',
        signature: 'sort(list)',
        description: 'Returns a sorted copy of the list.',
        returnType: 'list',
        examples: [
            { input: 'sort([3, 1, 2])', output: '[1, 2, 3]' },
        ],
    },
    {
        name: 'reverse',
        category: 'list',
        signature: 'reverse(list)',
        description: 'Returns a reversed copy of the list.',
        returnType: 'list',
        examples: [
            { input: 'reverse([1, 2, 3])', output: '[3, 2, 1]' },
        ],
    },
    {
        name: 'unique',
        category: 'list',
        signature: 'unique(list)',
        description: 'Returns a list with duplicate values removed.',
        returnType: 'list',
        examples: [
            { input: 'unique([1, 2, 2, 3])', output: '[1, 2, 3]' },
        ],
    },
    {
        name: 'flat',
        category: 'list',
        signature: 'flat(list)',
        description: 'Flattens a nested list into a single-level list.',
        returnType: 'list',
        examples: [
            { input: 'flat([[1, 2], [3, 4]])', output: '[1, 2, 3, 4]' },
        ],
    },
    {
        name: 'includes',
        category: 'list',
        signature: 'includes(list, value)',
        description: 'Returns true if the list contains the value.',
        returnType: 'boolean',
        examples: [
            { input: 'includes([1, 2, 3], 2)', output: 'true' },
        ],
    },

    // ── Type ───────────────────────────────────────────────────────────────
    {
        name: 'toNumber',
        category: 'type',
        signature: 'toNumber(value)',
        description: 'Converts a value to a number. Dates become timestamps, booleans become 0 or 1.',
        returnType: 'number',
        examples: [
            { input: 'toNumber("42")', output: '42' },
            { input: 'toNumber(true)', output: '1' },
        ],
    },
    {
        name: 'toBoolean',
        category: 'type',
        signature: 'toBoolean(value)',
        description: 'Converts a value to a boolean.',
        returnType: 'boolean',
        examples: [
            { input: 'toBoolean(1)', output: 'true' },
            { input: 'toBoolean("")', output: 'false' },
        ],
    },
];

// Category metadata for display
export const CATEGORY_META: Record<string, { label: string; icon: string }> = {
    logic: { label: 'Logic', icon: '⚡' },
    text:  { label: 'Text', icon: '📝' },
    math:  { label: 'Math', icon: '#' },
    date:  { label: 'Date', icon: '📅' },
    list:  { label: 'List', icon: '📋' },
    type:  { label: 'Type Conversion', icon: '🔄' },
};
