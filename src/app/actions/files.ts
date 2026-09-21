'use server';

import { auth } from '@/auth';
import { storage, DocumentArchivedError, StorageKeyConflictError } from '@/lib/storage';
import { v4 as uuidv4 } from 'uuid';

const STORAGE_ERROR_FALLBACKS: Record<string, Record<string, string>> = {
    nl: {
        documentAlreadyExists: 'Er is al een bestand met deze naam gekoppeld aan dit document. Vervang het, of hernoem het bestand.',
        documentArchivedCannotReplace: 'Dit document is gearchiveerd en kan niet worden vervangen.',
    },
    en: {
        documentAlreadyExists: 'A file with this name is already attached to this document. Replace it, or rename the file.',
        documentArchivedCannotReplace: 'This document is archived and cannot be replaced.',
    },
    fr: {
        documentAlreadyExists: 'Un fichier portant ce nom est déjà associé à ce document. Remplacez-le ou renommez le fichier.',
        documentArchivedCannotReplace: 'Ce document est archivé et ne peut pas être remplacé.',
    },
    ro: {
        documentAlreadyExists: 'Există deja un fișier cu acest nume atașat la acest document. Înlocuiți-l sau redenumiți fișierul.',
        documentArchivedCannotReplace: 'Acest document este arhivat și nu poate fi înlocuit.',
    },
};

async function getStorageErrorMessage(key: 'documentAlreadyExists' | 'documentArchivedCannotReplace'): Promise<string> {
    try {
        const { getTranslations } = await import('next-intl/server');
        const t = await getTranslations('Errors');
        const msg = t(key);
        if (msg && msg !== `Errors.${key}`) return msg;
    } catch {
        // Fall back gracefully when outside request context
    }
    return STORAGE_ERROR_FALLBACKS.nl[key];
}

export async function uploadFileAction(formData: FormData, recordType: string, recordId?: string) {
    const session = await auth();
    const tenantId = session?.user?.tenantId;

    if (!tenantId) {
        throw new Error('Unauthorized');
    }

    const file = formData.get('file') as File | null;
    if (!file) {
        throw new Error('No file provided');
    }

    // Generate a unique recordId if none provided (e.g. for uploads that happen before the record is created)
    const finalRecordId = recordId || uuidv4();

    // Key scheme: t_{tenantId}/{recordType}/{recordId}/{filename}
    // Clean filename to remove weird characters
    const cleanFilename = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const key = `t_${tenantId}/${recordType}/${finalRecordId}/${cleanFilename}`;

    // Refuse writes to archive paths (DOC-ARCH-1 / BLOB-7)
    if (recordType === 'document' || recordType === 'documents' || key.includes('/documents/')) {
        return {
            success: false,
            error: await getStorageErrorMessage('documentArchivedCannotReplace'),
        };
    }

    try {
        // BLOB-7: User explicitly attaching/replacing a file on their own record passes overwrite: true
        const result = await storage.put(key, file, { contentType: file.type, overwrite: true });
        return { success: true, key: result.key, recordId: finalRecordId };
    } catch (e: unknown) {
        console.error('Failed to upload file:', e);
        if (e instanceof DocumentArchivedError) {
            return { success: false, error: await getStorageErrorMessage('documentArchivedCannotReplace') };
        }
        if (e instanceof StorageKeyConflictError) {
            return { success: false, error: await getStorageErrorMessage('documentAlreadyExists') };
        }
        return { success: false, error: e instanceof Error ? e.message : 'Upload failed' };
    }
}

export async function listRecordFiles(recordType: string, recordId?: string) {
    const session = await auth();
    const tenantId = session?.user?.tenantId;

    if (!tenantId) {
        throw new Error('Unauthorized');
    }

    // Key prefix scheme: t_{tenantId}/{recordType}/{recordId}/
    const prefix = recordId 
        ? `t_${tenantId}/${recordType}/${recordId}/`
        : `t_${tenantId}/${recordType}/`;

    try {
        const list = await storage.list(prefix);
        return list.map(item => {
            const basename = item.key.split('/').pop() || item.key;
            return {
                id: item.key,
                name: basename,
                type: 'file' as const,
                size: item.size,
                url: item.url,
                parentId: null,
                createdAt: item.uploadedAt.toISOString(),
                updatedAt: item.uploadedAt.toISOString(),
            };
        });
    } catch (e: unknown) {
        console.error('Failed to list files:', e);
        throw new Error(e instanceof Error ? e.message : 'Failed to list files');
    }
}

export async function deleteFileAction(key: string) {
    const session = await auth();
    const tenantId = session?.user?.tenantId;

    if (!tenantId) {
        throw new Error('Unauthorized');
    }

    // Security: Assert key starts with tenant prefix
    const requiredPrefix = `t_${tenantId}/`;
    if (!key.startsWith(requiredPrefix)) {
        throw new Error('Forbidden: Access denied');
    }

    try {
        await storage.delete(key);
        return { success: true };
    } catch (e: unknown) {
        console.error('Failed to delete file:', e);
        return { success: false, error: e instanceof Error ? e.message : 'Delete failed' };
    }
}

export async function listAllTenantFiles() {
    const session = await auth();
    const tenantId = session?.user?.tenantId;

    if (!tenantId) {
        throw new Error('Unauthorized');
    }

    const prefix = `t_${tenantId}/`;

    try {
        const list = await storage.list(prefix);
        return list.map(item => {
            const basename = item.key.split('/').pop() || item.key;
            // Extract contextType and contextId from key: t_{tenantId}/{recordType}/{recordId}/filename
            const parts = item.key.split('/');
            const contextType = parts.length > 3 ? parts[1] : 'global';
            const contextId = parts.length > 3 ? parts[2] : 'unknown';

            return {
                id: item.key,
                name: basename,
                type: 'file' as const,
                size: item.size,
                url: item.url,
                parentId: null, // Legacy, kept for typing compatibility if needed
                createdAt: item.uploadedAt.toISOString(),
                updatedAt: item.uploadedAt.toISOString(),
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                contextType: contextType as any,
                contextId: contextId,
            };
        });
    } catch (e: unknown) {
        console.error('Failed to list all tenant files:', e);
        throw new Error(e instanceof Error ? e.message : 'Failed to list all files');
    }
}
