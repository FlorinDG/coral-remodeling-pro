/**
 * Gmail OAuth — the client and the state cookie, shared by the connect route, its callback and the mail API (moved out
 * of a route file: a route exports only its HTTP handlers).
 */
import { google } from 'googleapis';

/** MAIL-OAUTH-1: the cookie holding this browser's one-time OAuth state. */
export const OAUTH_STATE_COOKIE = 'gmail_oauth_state';

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
