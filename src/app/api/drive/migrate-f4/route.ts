import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';

export async function POST(req: Request) {
    try {
        const session = await auth();
        // Ensure only admin or authorized user can run this. 
        // For now, we'll allow any authenticated user to trigger the migration since it's a one-time script.
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const parentFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
        if (!parentFolderId) {
            return NextResponse.json({ error: 'Missing GOOGLE_DRIVE_ROOT_FOLDER_ID' }, { status: 500 });
        }

        if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REFRESH_TOKEN) {
            return NextResponse.json({ error: 'Drive OAuth credentials missing' }, { status: 500 });
        }

        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
        );
        oauth2Client.setCredentials({
            refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
        });

        const drive = google.drive({ version: 'v3', auth: oauth2Client });

        const tenants = await prisma.tenant.findMany({
            where: {
                driveFolderId: { not: null }
            },
            select: { id: true, driveFolderId: true, companyName: true }
        });

        const results = [];

        for (const tenant of tenants) {
            if (!tenant.driveFolderId) continue;
            
            try {
                const fileRes = await drive.files.get({
                    fileId: tenant.driveFolderId,
                    fields: 'parents'
                });

                const parents = fileRes.data.parents || [];
                // If it's not already in the parent folder
                if (!parents.includes(parentFolderId)) {
                    // Move it
                    await drive.files.update({
                        fileId: tenant.driveFolderId,
                        addParents: parentFolderId,
                        removeParents: parents.join(','),
                        fields: 'id, parents'
                    });
                    results.push({ tenantId: tenant.id, name: tenant.companyName, status: 'moved', from: parents, to: parentFolderId });
                } else {
                    results.push({ tenantId: tenant.id, name: tenant.companyName, status: 'already_in_parent' });
                }
            } catch (err: any) {
                console.error(`Failed to move folder for tenant ${tenant.id}`, err);
                results.push({ tenantId: tenant.id, name: tenant.companyName, status: 'error', message: err.message });
            }
        }

        return NextResponse.json({ success: true, migrated: results.filter(r => r.status === 'moved').length, results });

    } catch (e: any) {
        console.error('Migration failed:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
