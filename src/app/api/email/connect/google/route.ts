import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { randomUUID } from 'crypto';
import { getGmailOAuth2Client, OAUTH_STATE_COOKIE } from '@/lib/mail/gmail-oauth';

export async function GET() {
    const session = await auth();
    if (!session?.user?.tenantId) {
        return NextResponse.json({ error: 'Unauthorized: Session or Tenant ID missing' }, { status: 401 });
    }

    try {
        const oauth2Client = getGmailOAuth2Client();
        const state = randomUUID();

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
            // MAIL-OAUTH-1: a one-time nonce, kept in an httpOnly cookie — never the tenant id. The callback takes the
            // tenant from its own session and accepts the code only when the state matches this browser's nonce.
            state,
        });

        const res = NextResponse.redirect(url);
        res.cookies.set(OAUTH_STATE_COOKIE, state, { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/email/connect/google', maxAge: 600 });
        return res;
    } catch (error: unknown) {
        console.error('Failed to initialize Gmail OAuth URL:', error);
        
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL 
            || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null)
            || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
            || 'https://app.coral-group.be';

        return NextResponse.redirect(`${baseUrl}/admin/email?error=oauth_init_failed`);
    }
}
