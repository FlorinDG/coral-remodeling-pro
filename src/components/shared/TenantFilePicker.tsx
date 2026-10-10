'use client';

import React, { useMemo, useState } from 'react';
import { HardDrive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { listAllTenantFiles } from '@/app/actions/files';

export interface StoredFile { id: string; name: string; url: string; size: number; contextType?: string }

/**
 * Pick a file the tenant already has in its file store (Florin 2026-10-10: "file upload — only from local storage …
 * the tenant's blob file manager should be available"). Reads through the ONE gated door (actions/files
 * listAllTenantFiles: tenant prefix, office only — the crew is refused there). Loaded when opened; searched by name
 * and folder. FILES-1 replaces the listing with the file store's own browser; this picker's contract stays.
 */
export function TenantFilePicker({ onPick, label, searchLabel, emptyLabel, disabled }: {
    onPick: (f: StoredFile) => void; label: string; searchLabel: string; emptyLabel: string; disabled?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [files, setFiles] = useState<StoredFile[] | null>(null);
    const [q, setQ] = useState('');
    const load = async () => {
        try { setFiles((await listAllTenantFiles()).map(f => ({ id: f.id, name: f.name, url: f.url, size: f.size, contextType: f.contextType }))); }
        catch (e) { console.error('[TenantFilePicker] list failed', e); setFiles([]); }
    };
    const shown = useMemo(() => {
        const needle = q.trim().toLowerCase();
        return (files ?? []).filter(f => !needle || f.name.toLowerCase().includes(needle) || (f.contextType ?? '').toLowerCase().includes(needle)).slice(0, 200);
    }, [files, q]);
    return (
        <Popover open={open} onOpenChange={o => { setOpen(o); if (o && files === null) void load(); }}>
            <PopoverTrigger asChild>
                <Button type="button" variant="outline" size="sm" disabled={disabled}>
                    <HardDrive className="h-4 w-4 mr-1.5" />
                    {label}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96 p-3" align="start">
                <Input value={q} onChange={e => setQ(e.target.value)} placeholder={searchLabel} className="h-8 text-xs mb-2" autoFocus />
                <div className="space-y-1 max-h-64 overflow-y-auto">
                    {files === null ? <p className="text-xs text-muted-foreground">…</p>
                        : shown.length === 0 ? <p className="text-xs text-muted-foreground">{emptyLabel}</p>
                        : shown.map(f => (
                            <button key={f.id} type="button" onClick={() => { onPick(f); setOpen(false); }}
                                className="w-full text-left p-2 rounded hover:bg-muted text-xs flex items-center justify-between gap-2">
                                <span className="truncate">{f.name}</span>
                                {f.contextType && <span className="text-[10px] text-muted-foreground shrink-0">{f.contextType}</span>}
                            </button>
                        ))}
                </div>
            </PopoverContent>
        </Popover>
    );
}
