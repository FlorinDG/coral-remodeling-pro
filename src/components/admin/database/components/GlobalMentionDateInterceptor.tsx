'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, addDays, startOfWeek, nextMonday } from 'date-fns';
import { nl, fr, enUS } from 'date-fns/locale';
import { Calendar as CalendarIcon, Clock } from 'lucide-react';
import { cn } from '@/components/time-tracker/lib/utils';
import { useParams } from 'next/navigation';
import { t } from '@/lib/document-i18n';

interface MentionPosition {
    top: number;
    left: number;
    target: HTMLElement;
    cursorPos: number; // for input/textarea
    selection?: Range; // for contenteditable
}

export default function GlobalMentionDateInterceptor() {
    const params = useParams();
    const localeStr = (params?.locale as string) || 'nl';
    const fnsLocale = localeStr === 'fr' ? fr : (localeStr === 'en' ? enUS : nl);

    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState<MentionPosition | null>(null);
    const [date, setDate] = useState<Date | undefined>(undefined);

    useEffect(() => {
        const handleInput = (e: Event) => {
            const target = e.target as HTMLElement;
            if (!target) return;

            const isInput = target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'text';
            const isTextarea = target.tagName === 'TEXTAREA';
            const isContentEditable = target.isContentEditable;

            if (!isInput && !isTextarea && !isContentEditable) return;

            let textBeforeCursor = '';
            let cursorPos = 0;
            let range: Range | undefined;
            let rect: DOMRect | undefined;

            if (isInput || isTextarea) {
                const el = target as HTMLInputElement | HTMLTextAreaElement;
                cursorPos = el.selectionStart || 0;
                textBeforeCursor = el.value.substring(0, cursorPos);
                rect = el.getBoundingClientRect();
            } else if (isContentEditable) {
                const selection = window.getSelection();
                if (selection && selection.rangeCount > 0) {
                    range = selection.getRangeAt(0);
                    // Extremely simplistic: check if the node's text ends with @
                    const textNode = range.startContainer;
                    if (textNode.nodeType === Node.TEXT_NODE) {
                        textBeforeCursor = textNode.textContent?.substring(0, range.startOffset) || '';
                        rect = range.getBoundingClientRect();
                    }
                }
            }

            if (textBeforeCursor.endsWith('@')) {
                // Trigger popover!
                const top = (rect?.bottom || 0) + window.scrollY;
                const left = (rect?.left || 0) + window.scrollX;
                setPos({ top, left, target, cursorPos, selection: range });
                setOpen(true);
            } else if (open) {
                setOpen(false);
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (open && e.key === 'Escape') {
                setOpen(false);
            }
        };

        document.addEventListener('input', handleInput, true); // use capture phase
        document.addEventListener('keydown', handleKeyDown, true);
        return () => {
            document.removeEventListener('input', handleInput, true);
            document.removeEventListener('keydown', handleKeyDown, true);
        };
    }, [open]);

    const insertDate = (selectedDate: Date) => {
        if (!pos) return;
        const dateStr = format(selectedDate, 'dd/MM/yyyy'); // e.g. Apr 15, 2026
        
        const isInput = pos.target.tagName === 'INPUT' || pos.target.tagName === 'TEXTAREA';
        if (isInput) {
            const el = pos.target as HTMLInputElement | HTMLTextAreaElement;
            const val = el.value;
            const before = val.substring(0, pos.cursorPos - 1); // remove @
            const after = val.substring(pos.cursorPos);
            const newValue = before + dateStr + after;
            el.value = newValue;
            
            // Dispatch input event so React state updates
            const event = new Event('input', { bubbles: true });
            el.dispatchEvent(event);
            
            // Fix cursor
            const newPos = before.length + dateStr.length;
            el.setSelectionRange(newPos, newPos);
            el.focus();
        } else if (pos.target.isContentEditable && pos.selection) {
            const selection = window.getSelection();
            if (selection) {
                selection.removeAllRanges();
                selection.addRange(pos.selection);
                
                // Delete the @ character
                document.execCommand('delete', false);
                // Insert the formatted date
                document.execCommand('insertText', false, dateStr);
                pos.target.focus();
            }
        }

        setOpen(false);
        setDate(undefined);
    };

    if (!open || !pos) return null;

    return (
        <div style={{ position: 'absolute', top: pos.top + 5, left: pos.left, zIndex: 9999 }}>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <div className="w-1 h-1 opacity-0" />
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start" autoFocus onOpenAutoFocus={e => e.preventDefault()}>
                    <div className="flex">
                        <div className="w-32 border-r border-neutral-100 dark:border-white/5 p-2 flex flex-col gap-1 bg-neutral-50/50 dark:bg-neutral-900/20">
                            <button onClick={() => insertDate(new Date())} className="text-left px-2 py-1.5 text-xs rounded-md hover:bg-neutral-100 dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-300 font-medium transition-colors">
                                {t('today', localeStr)}
                            </button>
                            <button onClick={() => insertDate(addDays(new Date(), 1))} className="text-left px-2 py-1.5 text-xs rounded-md hover:bg-neutral-100 dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-300 font-medium transition-colors">
                                {t('tomorrow', localeStr)}
                            </button>
                            <button onClick={() => insertDate(nextMonday(new Date()))} className="text-left px-2 py-1.5 text-xs rounded-md hover:bg-neutral-100 dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-300 font-medium transition-colors">
                                {t('next_monday', localeStr)}
                            </button>
                            <button onClick={() => insertDate(addDays(new Date(), 30))} className="text-left px-2 py-1.5 text-xs rounded-md hover:bg-neutral-100 dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-300 font-medium transition-colors">
                                {t('in_30_days', localeStr)}
                            </button>
                        </div>
                        <Calendar
                            mode="single"
                            selected={date}
                            onSelect={(d) => d && insertDate(d)}
                            initialFocus
                            locale={fnsLocale}
                            weekStartsOn={1}
                        />
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
}
