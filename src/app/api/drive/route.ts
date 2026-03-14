import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getOAuth2Client } from './auth/route';

// Helper to initialize the Drive API client using OAuth 2.0 User Consent
const getDriveClient = () => {
    try {
        const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

        if (!refreshToken) {
            throw new Error('GOOGLE_REFRESH_TOKEN is missing. Please Connect Drive from Admin Settings.');
        }

        const oauth2Client = getOAuth2Client();

        // Set the saved long-lived refresh token
        // The googleapis library will automatically handle fetching a new short-lived access_token
        oauth2Client.setCredentials({ refresh_token: refreshToken });

        return google.drive({ version: 'v3', auth: oauth2Client });
    } catch (error: any) {
        console.error('Failed to initialize Google Drive client via OAuth:', error);
        throw new Error('Drive API Authentication Failed: ' + error.message);
    }
};

/**
 * GET /api/drive?folderId=xxx
 * Lists all files and folders inside the specified Google Drive folder.
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const folderId = searchParams.get('folderId') || process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
        const tag = searchParams.get('tag');

        if (!folderId) {
            return NextResponse.json({ error: 'Missing GOOGLE_DRIVE_ROOT_FOLDER_ID environment variable' }, { status: 500 });
        }

        const drive = getDriveClient();

        let query = `'${folderId}' in parents and trashed=false`;
        if (tag) {
            // Search everywhere for files tagged with this specific module
            query = `appProperties has { key='module' and value='${tag}' } and trashed=false`;
        }

        // List files in the specified folder (or by tag)
        const response = await drive.files.list({
            q: query,
            fields: 'files(id, name, mimeType, size, createdTime, modifiedTime, webViewLink, webContentLink, parents, appProperties)',
            orderBy: 'folder, modifiedTime desc', // Folders first, then newest
            pageSize: 1000,
        });

        // Map the raw Google Drive response to our internal FileNode interface
        const nodes = response.data.files?.map((file) => ({
            id: file.id,
            name: file.name,
            // Google uses specific mime types to denote folders
            type: file.mimeType === 'application/vnd.google-apps.folder' ? 'folder' : 'file',
            mimeType: file.mimeType,
            size: file.size ? parseInt(file.size, 10) : undefined,
            url: file.webViewLink || file.webContentLink, // webViewLink opens in Drive UI
            // If the parent is the Root Folder, treat it as null so it appears at the top level of the File Manager
            parentId: file.parents ? (file.parents[0] === process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID ? null : file.parents[0]) : null,
            createdAt: file.createdTime,
            updatedAt: file.modifiedTime,
            // We will map contextType/Id on the frontend depending on where this data was requested
        })) || [];

        return NextResponse.json({ nodes });

    } catch (error: any) {
        console.error('Drive API Error (GET):', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * POST /api/drive
 * Handles creating new folders AND uploading files.
 */
export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const action = formData.get('action') as 'create_folder' | 'upload_file' | 'create_file';
        // Fall back to root folder if no specific node parent is provided
        const parentId = (formData.get('parentId') as string) || process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;

        if (!action || !parentId) {
            return NextResponse.json({ error: 'Missing required fields: action, parentId' }, { status: 400 });
        }

        const drive = getDriveClient();

        // --- Create Folder ---
        if (action === 'create_folder') {
            const folderName = formData.get('name') as string;
            if (!folderName) return NextResponse.json({ error: 'Missing folder name' }, { status: 400 });

            const fileMetadata = {
                name: folderName,
                mimeType: 'application/vnd.google-apps.folder',
                parents: [parentId]
            };

            const response = await drive.files.create({
                requestBody: fileMetadata,
                fields: 'id, name, mimeType, createdTime, modifiedTime, parents'
            });

            return NextResponse.json({ success: true, node: response.data });
        }

        // --- Upload File ---
        if (action === 'upload_file') {
            const file = formData.get('file') as File;
            if (!file) return NextResponse.json({ error: 'Missing file payload' }, { status: 400 });

            const moduleTag = formData.get('moduleTag') as string;
            const appProperties = moduleTag ? { module: moduleTag } : undefined;

            // Convert standard Web API File into a Node Buffer stream for googleapis
            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // We need to use a Readable stream to pass to the drive.files.create method
            const stream = require('stream');
            const bufferStream = new stream.PassThrough();
            bufferStream.end(buffer);

            const fileMetadata: any = {
                name: file.name,
                parents: [parentId]
            };
            if (appProperties) fileMetadata.appProperties = appProperties;

            const media = {
                mimeType: file.type,
                body: bufferStream,
            };

            const response = await drive.files.create({
                requestBody: fileMetadata,
                media: media,
                fields: 'id, name, mimeType, size, createdTime, modifiedTime, webViewLink, parents'
            });

            return NextResponse.json({ success: true, node: response.data });
        }

        // --- Create Google Workspace File ---
        if (action === 'create_file') {
            const fileName = formData.get('name') as string;
            const mimeType = formData.get('mimeType') as string;
            if (!fileName || !mimeType) return NextResponse.json({ error: 'Missing file name or mimeType' }, { status: 400 });

            const moduleTag = formData.get('moduleTag') as string;
            const appProperties = moduleTag ? { module: moduleTag } : undefined;

            const fileMetadata: any = {
                name: fileName,
                mimeType: mimeType,
                parents: [parentId]
            };
            if (appProperties) fileMetadata.appProperties = appProperties;

            const response = await drive.files.create({
                requestBody: fileMetadata,
                fields: 'id, name, mimeType, size, createdTime, modifiedTime, webViewLink, parents'
            });

            return NextResponse.json({ success: true, node: response.data });
        }

        return NextResponse.json({ error: 'Invalid action type' }, { status: 400 });

    } catch (error: any) {
        console.error('Drive API Error (POST):', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * DELETE /api/drive
 * Trashes a specific file or folder by ID.
 */
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const fileId = searchParams.get('fileId');

        if (!fileId) {
            return NextResponse.json({ error: 'Missing fileId parameter' }, { status: 400 });
        }

        const drive = getDriveClient();

        // Use the `update` method to move it to trash, rather than permanently delete
        await drive.files.update({
            fileId,
            requestBody: {
                trashed: true
            }
        });

        return NextResponse.json({ success: true, id: fileId });

    } catch (error: any) {
        console.error('Drive API Error (DELETE):', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
