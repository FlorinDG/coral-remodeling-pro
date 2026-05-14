import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getGmailOAuth2Client } from '../route';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const code = searchParams.get('code');
        const tenantId = searchParams.get('state');

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL 
            || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null)
            || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
            || 'https://app.coral-group.be';

        if (!code || !tenantId) {
            return NextResponse.redirect(`${baseUrl}/admin/email?error=missing_auth_params`);
        }

        const oauth2Client = getGmailOAuth2Client();

        // Exchange the temporary auth code for tokens
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // Retrieve user email to identify the account
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const userInfo = await oauth2.userinfo.get();
        const email = userInfo.data.email;

        if (!email) {
            return NextResponse.redirect(`${baseUrl}/admin/email?error=no_email_returned`);
        }

        // Upsert the connected account into the database with tokens
        await prisma.connectedEmailAccount.upsert({
            where: { email },
            update: {
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
                tenantId,
                isActive: true,
                imapHost: 'imap.gmail.com',
                imapPort: 993,
                smtpHost: 'smtp.gmail.com',
                smtpPort: 465,
            },
            create: {
                email,
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
                tenantId,
                isActive: true,
                imapHost: 'imap.gmail.com',
                imapPort: 993,
                smtpHost: 'smtp.gmail.com',
                smtpPort: 465,
            }
        });

        // Redirect back to the email module with a success flag
        return NextResponse.redirect(`${baseUrl}/admin/email?connected=true`);

    } catch (error: unknown) {
        console.error('Failed to handle Gmail OAuth Callback:', error);
        
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL 
            || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null)
            || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
            || 'https://app.coral-group.be';

        return NextResponse.redirect(`${baseUrl}/admin/email?error=oauth_exchange_failed`);
    }
}
