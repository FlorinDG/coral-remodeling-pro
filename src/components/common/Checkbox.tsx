import React from 'react';
import { Check } from 'lucide-react';

interface CheckboxProps {
    checked: boolean;
    onChange?: (checked: boolean) => void;
    className?: string;
    disabled?: boolean;
}

export function Checkbox({ checked, onChange, className = '', disabled = false }: CheckboxProps) {
    return (
        <div
            onClick={(e) => {
                if (disabled) return;
                e.stopPropagation();
                onChange?.(!checked);
            }}
            className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all duration-150 cursor-pointer shadow-sm
                ${checked 
                    ? 'bg-[var(--brand-color,#d35400)] border-[var(--brand-color,#d35400)] text-white scale-105' 
                    : 'border-neutral-350 dark:border-white/20 hover:border-[var(--brand-color,#d35400)]/60 dark:hover:border-white/45 bg-white dark:bg-neutral-900'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                ${className}
            `}
        >
            {checked && <Check className="w-3.5 h-3.5 stroke-[3] animate-in zoom-in-75 duration-100" />}
        </div>
    );
}
