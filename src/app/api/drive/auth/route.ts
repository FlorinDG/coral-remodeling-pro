import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export function getOAuth2Client() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    // The redirect URL MUST match exactly what is configured in the Google Cloud Console
    // In production, this needs to be environment-aware (e.g., https://coral-app.com/api/drive/callback)
    const redirectUrl = process.env.NODE_ENV === 'production'
        ? 'https://your-production-domain.com/api/drive/callback'
        : 'http://localhost:3000/api/drive/callback';

    if (!clientId || !clientSecret) {
        throw new Error('Google OAuth Client ID/Secret missing from environment variables.');
    }

    return new google.auth.OAuth2(clientId, clientSecret, redirectUrl);
}

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
