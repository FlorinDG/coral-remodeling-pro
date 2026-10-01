"use client";
/**
 * 24-hour time picker (Belgium, LOC-1). A native <input type="time"> renders in the PHONE's region —
 * "9:00 AM" on an English/US iPhone — and the app cannot override that. Two selects show exactly
 * what they hold: 00–23 and 00–59. Value in/out: 'HH:mm'.
 */
interface Props {
    value: string;
    onChange: (value: string) => void;
    id?: string;
    minuteStep?: number;
    className?: string;
    ariaLabel?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function TimeSelect({ value, onChange, id, minuteStep = 1, className = '', ariaLabel }: Props) {
    const [h, m] = (value || '00:00').split(':');
    const hours = Array.from({ length: 24 }, (_, i) => pad(i));
    const minutes = Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) => pad(i * minuteStep));
    if (m && !minutes.includes(m)) minutes.push(m);
    const cls = 'h-12 px-3 rounded-xl border border-border bg-background text-base tabular-nums';
    return (
        <div className={`flex items-center gap-1 ${className}`} role="group" aria-label={ariaLabel}>
            <select id={id} value={h || '00'} onChange={e => onChange(`${e.target.value}:${m || '00'}`)} className={cls} aria-label={ariaLabel ? `${ariaLabel} — h` : undefined}>
                {hours.map(x => <option key={x} value={x}>{x}</option>)}
            </select>
            <span className="text-base font-semibold">:</span>
            <select value={m || '00'} onChange={e => onChange(`${h || '00'}:${e.target.value}`)} className={cls} aria-label={ariaLabel ? `${ariaLabel} — min` : undefined}>
                {minutes.sort().map(x => <option key={x} value={x}>{x}</option>)}
            </select>
        </div>
    );
}
