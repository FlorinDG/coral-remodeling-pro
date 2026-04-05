import { google } from 'googleapis';
import { Readable } from 'stream';

// Initialize the Google Drive API Client using Service Account Auth
// This requires GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY in .env
const auth = new google.auth.GoogleAuth({
    credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        // Private keys in env might have escaped newlines
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/drive'],
});

const drive = google.drive({ version: 'v3', auth });

export async function createFolder(name: string, parentId?: string): Promise<string> {
    const fileMetadata = {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentId ? [parentId] : undefined,
    };

    const file = await drive.files.create({
        requestBody: fileMetadata,
        fields: 'id',
    });

    return file.data.id!;
}

export async function findOrCreateFolder(name: string, parentId: string): Promise<string> {
    const q = `'${parentId}' in parents and name = '${name.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const response = await drive.files.list({
        q,
        fields: 'files(id)',
        spaces: 'drive',
    });

    if (response.data.files && response.data.files.length > 0) {
        return response.data.files[0].id!;
    }
    return await createFolder(name, parentId);
}

export async function uploadFile(
    filename: string,
    mimeType: string,
    buffer: Buffer | Blob,
    parentId: string
): Promise<string> {
    // Convert Blob to Buffer if necessary
    const uploadBuffer = buffer instanceof Blob
        ? Buffer.from(await buffer.arrayBuffer())
        : buffer;

    const fileMetadata = {
        name: filename,
        parents: parentId ? [parentId] : undefined,
    };

    const media = {
        mimeType,
        body: Readable.from(uploadBuffer),
    };

    const file = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id',
    });

    return file.data.id!;
}

export async function listFiles(folderId: string) {
    const response = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: 'files(id, name, mimeType, webViewLink, webContentLink, iconLink, createdTime, size)',
        orderBy: 'folder, name',
        spaces: 'drive',
    });

    return response.data.files || [];
}

/**
 * Master Template Generator
 * Constructs the base folder hierarchy for a new Client.
 * Returns the Master Folder ID and internal Subfolder IDs.
 */
export async function generateClientFolderTemplate(clientName: string, masterParentId?: string) {
    // 1. Create root client folder
    const masterId = await createFolder(clientName, masterParentId);

    // 2. Create foundational subdirectories
    const offertesId = await createFolder('Offertes', masterId);
    const facturenId = await createFolder("Facturen & Creditnota's", masterId);
    const vorderingenId = await createFolder('Vorderingen', masterId);
    const projectenId = await createFolder('Projecten', masterId);
    const takenId = await createFolder('Taken', masterId);
    const portalsId = await createFolder('Portals', masterId);

    return {
        masterId,
        subfolders: {
            offertesId,
            facturenId,
            vorderingenId,
            projectenId,
            takenId,
            portalsId
        }
    };
}

/**
 * Generate subfolder hierarchy for a strictly governed specific Project.
 */
export async function generateProjectFolderTemplate(projectName: string, parentProjectenId: string) {
    const projectId = await createFolder(projectName, parentProjectenId);

    const supplierQuotesId = await createFolder('Supplier Quotes', projectId);
    const mediaId = await createFolder('Media', projectId);
    const otherFilesId = await createFolder('Other Files', projectId);

    return {
        projectId,
        subfolders: {
            supplierQuotesId,
            mediaId,
            otherFilesId
        }
    };
}
