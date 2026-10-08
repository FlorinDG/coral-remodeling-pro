"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, Paperclip, Upload, FolderOpen, X, FileText, Image as ImageIcon, Download } from 'lucide-react';
import { WerkbonCard } from '@/components/time-tracker/components/werkbon/WerkbonCard';
import { isWerkbonArtifact } from '@/lib/records/werkbon-status';
import { isWerkbonFile } from '@/lib/records/werkbon-number';
import { AttachmentLink, AttachmentImage } from '@/components/ui/attachment-link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { hrList, hrCreate, hrDelete } from '@/lib/hr-api';
import { uploadFileAction, listRecordFiles } from '@/app/actions/files';
import { addShiftFile } from '@/lib/data/shift-files';
import { toast } from 'sonner';

export interface ShiftAttachmentItem {
  id: string;
  shiftId: string;
  name: string;
  url: string;
  type: string;
  size: number | null;
  createdAt?: string;
}

export interface ProjectAttachmentOption {
  id: string;
  project_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number | null;
}

interface ShiftAttachmentsTabProps {
  shiftId: string | null;
  projectId?: string | null;
  canManage?: boolean;
  isLocked?: boolean;
  onCountChange?: (count: number) => void;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(fileType: string) {
  if (fileType.startsWith('image/')) return ImageIcon;
  return FileText;
}

import { useTranslations } from 'next-intl';

export function ShiftAttachmentsTab({
  shiftId,
  projectId,
  canManage = true,
  isLocked = false,
  onCountChange,
}: ShiftAttachmentsTabProps) {
  const t = useTranslations('Hr.shifts.attachments');
  const [attachments, setAttachments] = useState<ShiftAttachmentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [projectAttachments, setProjectAttachments] = useState<ProjectAttachmentOption[]>([]);
  const [attachmentPopoverOpen, setAttachmentPopoverOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAttachments = useCallback(async () => {
    if (!shiftId) {
      setAttachments([]);
      return;
    }
    setLoading(true);
    try {
      const data = await hrList<ShiftAttachmentItem>('shift-attachments', { shiftId });
      setAttachments(data || []);
    } catch (err) {
      console.error('Failed to fetch shift attachments:', err);
    } finally {
      setLoading(false);
    }
  }, [shiftId]);

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

  // Fetch project attachments when project changes
  useEffect(() => {
    const fetchProjectAttachments = async () => {
      if (!projectId) {
        setProjectAttachments([]);
        return;
      }
      try {
        const files = await listRecordFiles('project', projectId);
        setProjectAttachments(
          files.map(f => ({
            id: f.id,
            project_id: projectId,
            file_name: f.name,
            file_path: f.url,
            file_type: f.name.split('.').pop() || '',
            file_size: f.size,
          }))
        );
      } catch (err) {
        console.error('Failed to fetch project files:', err);
        setProjectAttachments([]);
      }
    };

    fetchProjectAttachments();
  }, [projectId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !shiftId || isLocked) return;

    setUploadingFile(true);
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        const uploadRes = await uploadFileAction(formData, 'hr-shift', shiftId);
        if (!uploadRes.success || !uploadRes.key) {
          toast.error(`Upload mislukt: ${file.name}`);
          continue;
        }

        const addRes = await addShiftFile({
          shiftId,
          key: uploadRes.key,
          name: file.name,
          type: file.type,
          size: file.size,
        });

        if (!addRes.ok) {
          if (addRes.error === 'work_order_signed') {
            toast.error('Werkbon is ondertekend — bijlagen kunnen niet meer worden gewijzigd');
          } else {
            toast.error(`Kan bestand niet toevoegen: ${addRes.error}`);
          }
        }
      }
      await fetchAttachments();
    } catch {
      toast.error('Fout bij uploaden van bestand');
    } finally {
      setUploadingFile(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleAddFromProject = async (option: ProjectAttachmentOption) => {
    if (!shiftId || isLocked) return;

    // Check if already added
    if (attachments.some(a => a.url === option.file_path)) {
      toast.error('Bestand is al gekoppeld aan deze dienst');
      return;
    }

    try {
      await hrCreate('shift-attachments', {
        shiftId,
        name: option.file_name,
        url: option.file_path,
        type: option.file_type,
        size: option.file_size,
      });
      toast.success('Projectbestand toegevoegd');
      setAttachmentPopoverOpen(false);
      await fetchAttachments();
    } catch {
      toast.error('Kan projectbestand niet koppelen');
    }
  };

  const handleDeleteAttachment = async (id: string) => {
    if (isLocked) return;
    try {
      await hrDelete('shift-attachments', id);
      setAttachments(prev => prev.filter(a => a.id !== id));
      toast.success('Bijlage verwijderd');
    } catch {
      toast.error('Kan bijlage niet verwijderen');
    }
  };

  // Filter out signed work order artifacts (PDF & legacy signature PNG)
  const ordinaryAttachments = attachments.filter(a => !isWerkbonArtifact({ name: a.name }, isWerkbonFile));

  useEffect(() => {
    onCountChange?.(ordinaryAttachments.length);
  }, [ordinaryAttachments.length, onCountChange]);

  return (
    <div className="space-y-4 h-[min(648px,70vh)] overflow-y-auto pr-1">
      {/* WO-4b / C7: WerkbonCard at top of attachments tab */}
      <WerkbonCard shiftId={shiftId} />

      {/* Upload & project files controls */}
      {canManage && !isLocked && (
        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={uploadingFile}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 relative"
              disabled={uploadingFile}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadingFile ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-1.5" />
              )}
              {t('uploadButton')}
            </Button>
          </div>

          {projectAttachments.length > 0 && (
            <Popover open={attachmentPopoverOpen} onOpenChange={setAttachmentPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9">
                  <FolderOpen className="h-4 w-4 mr-1.5" />
                  {t('fromProject')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-3" align="start">
                <div className="space-y-2">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-neutral-500">
                    {t('projectFiles')}
                  </h4>
                  <ScrollArea className="h-48">
                    <div className="space-y-1">
                      {projectAttachments.map(pa => {
                        const Icon = getFileIcon(pa.file_type);
                        const alreadyAdded = attachments.some(a => a.url === pa.file_path);
                        return (
                          <button
                            key={pa.id}
                            type="button"
                            onClick={() => handleAddFromProject(pa)}
                            disabled={alreadyAdded}
                            className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/5 text-left text-xs disabled:opacity-50 transition"
                          >
                            <Icon className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                            <span className="truncate flex-1 font-medium">{pa.file_name}</span>
                            {alreadyAdded && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                {t('added')}
                              </Badge>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      )}

      {/* Attachments list */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
        </div>
      ) : ordinaryAttachments.length === 0 ? (
        <div className="text-center py-8 text-neutral-500">
          <Paperclip className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">{t('noFiles')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {ordinaryAttachments.map(attachment => {
            const fileType = attachment.type || '';
            const Icon = getFileIcon(fileType);
            const isImage = fileType.startsWith('image/');
            const fileName = attachment.name || '';
            const filePath = attachment.url || '';
            const fileSize = attachment.size;

            return (
              <div
                key={attachment.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-900/60 transition"
              >
                {isImage ? (
                  <AttachmentImage
                    filePath={filePath}
                    alt={fileName}
                    className="h-10 w-10 rounded-lg object-cover"
                    fallback={
                      <div className="h-10 w-10 rounded-lg bg-neutral-100 dark:bg-white/5 flex items-center justify-center">
                        <Icon className="h-5 w-5 text-neutral-400" />
                      </div>
                    }
                  />
                ) : (
                  <div className="h-10 w-10 rounded-lg bg-neutral-100 dark:bg-white/5 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-neutral-400" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate text-neutral-900 dark:text-white">
                    {fileName}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-neutral-500">
                    {fileSize ? <span>{formatFileSize(fileSize)}</span> : null}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <AttachmentLink
                    filePath={filePath}
                    className="inline-flex items-center justify-center h-8 w-8 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-400"
                  >
                    <Download className="h-4 w-4" />
                  </AttachmentLink>
                  {canManage && !isLocked && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-neutral-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                      onClick={() => handleDeleteAttachment(attachment.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
