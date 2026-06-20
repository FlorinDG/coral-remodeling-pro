'use server';

import { auth } from '@/auth';
import { storage } from '@/lib/storage';
import { v4 as uuidv4 } from 'uuid';

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

    try {
        const result = await storage.put(key, file, { contentType: file.type });
        return { success: true, key: result.key, recordId: finalRecordId };
    } catch (e: unknown) {
        console.error('Failed to upload file:', e);
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

