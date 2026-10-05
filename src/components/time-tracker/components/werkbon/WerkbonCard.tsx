'use client';
/**
 * WO-4b · the SIGNED work order, shown on its own (Florin 2026-10-05: "the signed by client document should be more
 * prominent — add a label and separate it from the attachments section; it should also indicate the sending status
 * and recipients"). Facts → status: lib/records/werkbon-status.ts; read door: app/actions/werkbon.ts.
 * Renders nothing for an unsigned shift. Used by the shift editor and the hours print.
 */
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { FileSignature, FileText, Send, Clock } from 'lucide-react';
import { getWerkbonStatus } from '@/app/actions/werkbon';
import type { WerkbonStatus } from '@/lib/records/werkbon-status';
import { zonedParts } from '@/lib/kernel/shift-time';
import { resolveFileUrl } from '@/lib/files';

/** 'dd/MM/yyyy HH:mm' on the business clock — never the browser's zone. */
function brussels(isoTs: string): string {
    if (!isoTs) return '';
    const p = zonedParts(isoTs);
    return `${p.date.slice(8, 10)}/${p.date.slice(5, 7)}/${p.date.slice(0, 4)} ${p.time}`;
}

export function WerkbonCard({ shiftId, className = '' }: { shiftId: string | null | undefined; className?: string }) {
    const t = useTranslations('Admin.werkbon');
    const [status, setStatus] = useState<WerkbonStatus | null>(null);

    useEffect(() => {
        let alive = true;
        if (!shiftId) { setStatus(null); return; }
        getWerkbonStatus(shiftId).then(r => { if (alive) setStatus(r.ok ? r.status : null); }).catch(() => { if (alive) setStatus(null); });
        return () => { alive = false; };
    }, [shiftId]);

    if (!status) return null;
    return (
        <section className={`rounded-xl border-2 border-emerald-300 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/20 p-4 space-y-2 ${className}`}>
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <FileSignature className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                    <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">{t('title')}</h3>
                </div>
                {status.number && <span className="text-xs font-mono font-bold text-emerald-900 dark:text-emerald-200">{status.number}</span>}
            </div>
            <p className="text-xs text-neutral-700 dark:text-neutral-300">{t('signedBy', { name: status.signerName, date: brussels(status.signedAt) })}</p>
            {status.pdf ? (
                <a href={resolveFileUrl(status.pdf.key)} target="_blank" rel="noopener noreferrer"
                   className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 hover:underline">
                    <FileText className="w-3.5 h-3.5" /> {t('openPdf')} <span className="font-normal text-neutral-500">· {status.pdf.fileName}</span>
                </a>
            ) : (
                <p className="inline-flex items-center gap-1.5 text-xs text-amber-700"><Clock className="w-3.5 h-3.5" /> {t('pdfPending')}</p>
            )}
            <div className="pt-1 border-t border-emerald-200/70 dark:border-emerald-900/60 space-y-1">
                {status.sends.length === 0 ? (
                    <p className="inline-flex items-center gap-1.5 text-xs text-neutral-500"><Send className="w-3.5 h-3.5" /> {t('notSent')}</p>
                ) : status.sends.map((s, i) => (
                    <p key={i} className="flex items-start gap-1.5 text-xs text-neutral-700 dark:text-neutral-300">
                        <Send className="w-3.5 h-3.5 mt-0.5 text-emerald-700" />
                        <span>{t('sentTo', { date: brussels(s.at), to: s.to.join(', ') })}{s.cc.length ? ` · ${t('cc', { cc: s.cc.join(', ') })}` : ''}</span>
                    </p>
                ))}
            </div>
        </section>
    );
}
