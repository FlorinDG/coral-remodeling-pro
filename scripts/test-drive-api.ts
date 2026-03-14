import 'dotenv/config';
import { google } from 'googleapis';

async function testDriveOAuth() {
    console.log('Testing Google Drive API Authentication via OAuth 2.0...');

    try {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

        if (!clientId || !clientSecret || !refreshToken) {
            console.error('❌ Missing credentials.');
            console.error(`Client ID: ${clientId ? 'Found' : 'Missing'}`);
            console.error(`Client Secret: ${clientSecret ? 'Found' : 'Missing'}`);
            console.error(`Refresh Token: ${refreshToken ? 'Found' : 'Missing'}`);
            return;
        }

        console.log('Credentials found. Initializing OAuth2 client...');
        const oauth2Client = new google.auth.OAuth2(
            clientId,
            clientSecret,
            'http://localhost:3000/api/drive/callback'
        );

        // Provide the refresh token so googleapis can automatically fetch an access_token
        oauth2Client.setCredentials({ refresh_token: refreshToken });

        const drive = google.drive({ version: 'v3', auth: oauth2Client });

        const folderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
        console.log(`Querying folder ID: ${folderId}`);

        const response = await drive.files.list({
            q: `'${folderId}' in parents and trashed = false`,
            fields: 'files(id, name, mimeType)',
            pageSize: 5,
        });

        console.log('✅ Connection Successful! Found files:');
        console.log(response.data.files);

    } catch (error: any) {
        console.error('❌ Drive API Error:', error.message);
    }
}

testDriveOAuth();
