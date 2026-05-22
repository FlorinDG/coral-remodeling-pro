import { NextResponse } from 'next/server';
import { getOAuth2Client } from '@/lib/google-drive-oauth';

export async function GET() {
    try {
        const oauth2Client = getOAuth2Client();

        // Generate a secure connection URL to Google's OAuth consent screen
        const url = oauth2Client.generateAuthUrl({
            access_type: 'offline', // Requests a `refresh_token` allowing background syncing
            scope: ['https://www.googleapis.com/auth/drive'], // Full access to Google Drive
            prompt: 'consent', // Force consent so a `refresh_token` is always returned
        });

        // 302 Redirect the admin user directly to Google
        return NextResponse.redirect(url);
    } catch (error: any) {
        console.error('Failed to initialize OAuth URL:', error);
        return new NextResponse('Internal Server Error: ' + error.message, { status: 500 });
    }
}
