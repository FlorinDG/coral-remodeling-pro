"use server";

import { auth } from '@/auth';
import { storage } from '@/lib/storage';

export async function listRecordFiles(recordType: string, recordId: string) {
    const session = await auth();
    if (!session?.user?.tenantId) {
        throw new Error('Unauthorized');
    }
    const tenantId = session.user.tenantId;

    if (!recordType || !recordId) {
        throw new Error('Missing recordType or recordId');
    }

    try {
        const prefix = `t_${tenantId}/${recordType}/${recordId}/`;
        const files = await storage.list(prefix);
        
        return {
            success: true,
            files: files.map(f => ({
                key: f.key,
                url: f.url,
                size: f.size,
                filename: f.key.split('/').pop() || f.key
            }))
        };
    } catch (e: any) {
        console.error("Failed to list record files:", e);
        return { success: false, error: e.message || 'Failed to list files' };
    }
}
