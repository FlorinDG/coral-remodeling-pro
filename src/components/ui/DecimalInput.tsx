"use client";
/**
 * DEC-1 · the ONE field for a typed amount, quantity, price or percentage (Florin 2026-10-08: "comma / point in belgian
 * currency format not yet fixed. i am still typing period instead of comma").
 *
 * A browser `type="number"` field takes the decimal separator from the BROWSER's language — on an English browser a
 * Belgian comma is refused. This is a text field with the decimal keyboard on phones: a comma and a point both work
 * (lib/records/decimal — the one rule), it shows the Belgian comma, and it hands the caller a number (or null).
 */
import React, { useEffect, useState } from 'react';
import { parseDecimal, formatDecimalInput } from '@/lib/records/decimal';

interface DecimalInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
    value: number | string | null | undefined;
    /** Called on every keystroke with the number typed so far (null = empty / not a number). */
    onValueChange: (n: number | null) => void;
    /** Places shown when not editing (default 2). */
    decimals?: number;
}

export default function DecimalInput({ value, onValueChange, decimals = 2, onFocus, onBlur, ...rest }: DecimalInputProps) {
    const asNumber = typeof value === 'number' ? value : parseDecimal(value);
    const [text, setText] = useState(() => formatDecimalInput(asNumber, decimals));
    const [focused, setFocused] = useState(false);

    // Follow the value from outside while the person is not typing in this field
    useEffect(() => {
        if (!focused) setText(formatDecimalInput(asNumber, decimals));
    }, [asNumber, decimals, focused]);

    return (
        <input
            {...rest}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={text}
            onFocus={e => { setFocused(true); onFocus?.(e); }}
            onBlur={e => { setFocused(false); setText(formatDecimalInput(parseDecimal(text), decimals)); onBlur?.(e); }}
            onChange={e => {
                const v = e.target.value;
                if (!/^-?[\d\s.,]*$/.test(v)) return;   // digits, one sign, separators — nothing else
                setText(v);
                onValueChange(parseDecimal(v));
            }}
        />
    );
}
