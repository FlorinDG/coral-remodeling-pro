"use client";
/**
 * WH-2 · WorkHub — Documents. The shared crew folder (global / workhub-shared), nothing else.
 *
 * Replaces the admin File Manager, which listed EVERY file in the tenant (invoices, receipts,
 * quotes) to any crew phone — closed server-side by crew-file-policy.ts; this screen asks only
 * for the one folder the crew may browse. HR roles can add a document here from the WorkHub.
 */
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { FileText, Image as ImageIcon, Loader2, Plus, FolderOpen } from 'lucide-react';
import FileViewer, { type ViewableFile } from '@/components/files/FileViewer';
import { listRecordFiles, uploadFileAction } from '@/app/actions/files';
import { resolveFileUrl } from '@/lib/files';
import { describeError } from '@/lib/describe-error';
import { formatDate } from '@/lib/format/date';
import { isTenantHrRole } from '@/lib/roles';
import { CREW_SHARED_DOCS } from '@/lib/crew-file-policy';

function isImage(name: string) {
  return /\.(jpe?g|png|webp|gif|heic|avif)$/i.test(name);
}
function sizeLabel(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentsScreen() {
  const { t, i18n } = useTranslation();
  const { data: session } = useSession();
  const tenantId = session?.user?.tenantId || 'no-tenant';
  const canAdd = isTenantHrRole((session?.user as { role?: string } | undefined)?.role);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [viewer, setViewer] = useState<number | null>(null);

  const q = useQuery({
    queryKey: ['workhub-shared-docs', tenantId],
    queryFn: () => listRecordFiles(CREW_SHARED_DOCS.recordType, CREW_SHARED_DOCS.recordId),
  });
  const docs = [...(q.data || [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const files: ViewableFile[] = docs.map(d => ({ id: d.id, name: d.name, url: resolveFileUrl(d.id), size: d.size }));

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files || []);
    e.target.value = '';
    if (!list.length) return;
    setUploading(true);
    try {
      for (const file of list) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await uploadFileAction(fd, CREW_SHARED_DOCS.recordType, CREW_SHARED_DOCS.recordId);
        if (!res.success) throw new Error(res.error || 'upload failed');
      }
      toast.success(t('documents.added'));
      await q.refetch();
    } catch (err) {
      console.error('[DocumentsScreen] upload failed:', err);
      toast.error(`${t('documents.addFailed')} — ${describeError(err)}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="pb-6">
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <h1 className="text-xl font-bold text-foreground">{t('documents.title')}</h1>
        {canAdd && (
          <>
            <input ref={inputRef} type="file" multiple className="hidden" onChange={onPick} />
            <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
              className="inline-flex items-center gap-1.5 h-11 px-4 rounded-full text-base font-semibold text-white bg-[var(--persian-green)] disabled:opacity-50">
              {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
              {t('documents.add')}
            </button>
          </>
        )}
      </div>

      {q.error && (
        <div className="mx-3 mb-3 p-3 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-sm">
          <p className="font-semibold">{t('documents.loadFailed')}</p>
          <p className="text-xs mt-0.5 break-words">{describeError(q.error)}</p>
          <button type="button" onClick={() => q.refetch()} className="mt-2 text-sm font-semibold underline">{t('timeOff.retry')}</button>
        </div>
      )}

      {q.isLoading ? (
        <div className="space-y-3 px-3 animate-pulse">
          {[0, 1, 2].map(i => <div key={i} className="h-20 rounded-2xl bg-muted/60" />)}
        </div>
      ) : !q.error && docs.length === 0 ? (
        <div className="flex flex-col items-center text-center px-8 py-16 text-muted-foreground">
          <FolderOpen className="w-12 h-12 mb-3" />
          <p className="text-base">{t('documents.empty')}</p>
        </div>
      ) : (
        <ul className="space-y-3 px-3">
          {docs.map((d, i) => (
            <li key={d.id}>
              <button type="button" onClick={() => setViewer(i)}
                className="w-full flex items-center gap-3 p-4 rounded-2xl border border-border bg-card shadow-sm text-left active:scale-[0.99] transition">
                <span className="w-12 h-12 rounded-xl bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center shrink-0">
                  {isImage(d.name) ? <ImageIcon className="w-6 h-6 text-muted-foreground" /> : <FileText className="w-6 h-6 text-muted-foreground" />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-base font-semibold text-foreground break-words">{d.name}</span>
                  <span className="block text-sm text-muted-foreground">
                    {formatDate(d.createdAt, i18n.language)}{d.size ? ` · ${sizeLabel(d.size)}` : ''}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {viewer !== null && (
        <FileViewer files={files} index={viewer} onIndexChange={setViewer} onClose={() => setViewer(null)} />
      )}
    </div>
  );
}
