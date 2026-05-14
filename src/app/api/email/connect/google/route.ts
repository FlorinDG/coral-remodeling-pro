import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { auth } from '@/auth';

export function getGmailOAuth2Client() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL 
        || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null)
        || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
        || 'https://app.coral-group.be';
        
    const redirectUrl = `${baseUrl}/api/email/connect/google/callback`;

    if (!clientId || !clientSecret) {
        throw new Error('Google OAuth Client ID/Secret missing from environment variables.');
    }

    return new google.auth.OAuth2(clientId, clientSecret, redirectUrl);
}

export async function GET() {
    const session = await auth();
    if (!session?.user?.tenantId) {
        return NextResponse.json({ error: 'Unauthorized: Session or Tenant ID missing' }, { status: 401 });
    }

    try {
        const oauth2Client = getGmailOAuth2Client();

        // Generate a secure connection URL to Google's OAuth consent screen for GMAIL scopes
        const url = oauth2Client.generateAuthUrl({
            access_type: 'offline', // Requests a `refresh_token` allowing background syncing
            scope: [
                'https://www.googleapis.com/auth/userinfo.email',
                'https://www.googleapis.com/auth/userinfo.profile',
                'https://www.googleapis.com/auth/gmail.readonly',
                'https://www.googleapis.com/auth/gmail.modify',
                'https://www.googleapis.com/auth/gmail.send'
            ],
            prompt: 'consent', // Force consent so a `refresh_token` is always returned
            state: session.user.tenantId, // Pass the tenant ID to recover it in the callback
        });

        return NextResponse.redirect(url);
    } catch (error: unknown) {
        console.error('Failed to initialize Gmail OAuth URL:', error);
        return new NextResponse('Internal Server Error: ' + (error instanceof Error ? error.message : String(error)), { status: 500 });
    }
}
