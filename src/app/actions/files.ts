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
    } catch (e: any) {
        console.error('Failed to upload file:', e);
        return { success: false, error: e.message || 'Upload failed' };
    }
}
