import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables explicitly
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function purgeGhostFolders() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;

    if (!clientId || !clientSecret || !refreshToken || !rootFolderId) {
        console.error('Missing Google Drive environment variables.');
        process.exit(1);
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, 'http://localhost:3000/api/drive/callback');
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    console.log(`[Cleaner] Scraping Google Drive root folder: ${rootFolderId}`);

    try {
        let nextPageToken: string | undefined = undefined;
        let totalPurged = 0;

        do {
            const response = await drive.files.list({
                // Query exclusively for FOLDERS inside the root directory that are NOT trashed
                q: `'${rootFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
                fields: 'nextPageToken, files(id, name)',
                pageSize: 100, // Process in batches
                pageToken: nextPageToken
            });

            const folders = response.data.files || [];
            nextPageToken = response.data.nextPageToken || undefined;

            console.log(`[Cleaner] Found ${folders.length} folders in this batch.`);

            for (const folder of folders) {
                if (!folder.id) continue;

                console.log(`[Cleaner] Trashing ghost folder: "${folder.name}" (${folder.id})`);

                // Trash the folder
                await drive.files.update({
                    fileId: folder.id,
                    requestBody: {
                        trashed: true
                    }
                });

                totalPurged++;
                // Sleep for 200ms to avoid hitting Google's Rate Limits
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        } while (nextPageToken);

        console.log(`\n[Cleaner] SUCCESS: Purged a total of ${totalPurged} ghost folders.`);
        process.exit(0);

    } catch (error: any) {
        console.error('[Cleaner] Fatal Error during purge:', error.message);
        process.exit(1);
    }
}

purgeGhostFolders();
