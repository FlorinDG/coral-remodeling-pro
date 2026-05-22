import { google } from 'googleapis';

export function getOAuth2Client() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    // The redirect URL MUST match exactly what is configured in the Google Cloud Console.
    // We try to derive the base URL from common Vercel/Next.js environment variables.
    // For absolute certainty in production, set NEXT_PUBLIC_APP_URL in your Vercel Environment Variables.
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
        || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null)
        || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
        || 'https://app.coral-group.be';

    const redirectUrl = `${baseUrl}/api/drive/callback`;

    if (!clientId || !clientSecret) {
        throw new Error('Google OAuth Client ID/Secret missing from environment variables.');
    }

    return new google.auth.OAuth2(clientId, clientSecret, redirectUrl);
}
