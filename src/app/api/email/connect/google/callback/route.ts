import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getGmailOAuth2Client, OAUTH_STATE_COOKIE } from '@/lib/mail/gmail-oauth';
import { auth } from '@/auth';
import { cookies } from 'next/headers';
import { timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const code = searchParams.get('code');
        const state = searchParams.get('state');

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL 
            || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null)
            || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
            || 'https://app.coral-group.be';

        if (!code || !state) {
            return NextResponse.redirect(`${baseUrl}/admin/email?error=missing_auth_params`);
        }

        // MAIL-OAUTH-1: the tenant is the signed-in user's — never the URL's. Before, `state` WAS the tenant id: anyone
        // finishing Google's consent with another tenant's id in it attached their mailbox to that tenant.
        const session = await auth();
        const tenantId = session?.user?.tenantId;
        if (!tenantId) return NextResponse.redirect(`${baseUrl}/admin/email?error=not_signed_in`);
        const jar = await cookies();
        const expected = jar.get(OAUTH_STATE_COOKIE)?.value ?? '';
        jar.delete(OAUTH_STATE_COOKIE);
        const a = Buffer.from(expected), b = Buffer.from(state);
        if (!expected || a.length !== b.length || !timingSafeEqual(a, b)) {
            return NextResponse.redirect(`${baseUrl}/admin/email?error=oauth_state_mismatch`);
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

        // A mailbox connected to ANOTHER tenant is never moved here (the upsert by email used to take it over).
        const already = await prisma.connectedEmailAccount.findUnique({ where: { email }, select: { tenantId: true } });
        if (already && already.tenantId !== tenantId) {
            return NextResponse.redirect(`${baseUrl}/admin/email?error=account_connected_elsewhere`);
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
