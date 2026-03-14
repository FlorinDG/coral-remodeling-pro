import { NextResponse } from 'next/server';
import { getOAuth2Client } from '../auth/route';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const code = searchParams.get('code');

        if (!code) {
            return new NextResponse('Authorization Code Missing from Google Callback', { status: 400 });
        }

        const oauth2Client = getOAuth2Client();

        // Exchange the temporary auth code for the long-lived refresh token
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // Return a simple HTML page displaying the refresh token so the user can copy it
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Drive Authorization Success</title>
                <style>
                    body { font-family: system-ui, sans-serif; padding: 40px; background: #000; color: #fff; text-align: center; }
                    .token-box { background: #111; border: 1px solid #333; padding: 20px; border-radius: 8px; margin: 20px auto; max-width: 600px; word-break: break-all; font-family: monospace; font-size: 16px; color: #4ade80; }
                    h1 { color: #fff; }
                </style>
            </head>
            <body>
                <h1>✅ Google Drive Authorized!</h1>
                <p>Please copy the Refresh Token below and paste it into your <b>.env</b> file as GOOGLE_REFRESH_TOKEN</p>
                <div class="token-box">${tokens.refresh_token}</div>
                <p>You can close this window after copying the token.</p>
            </body>
            </html>
        `;

        return new NextResponse(html, {
            status: 200,
            headers: { 'Content-Type': 'text/html' }
        });
    } catch (error: any) {
        console.error('Failed to handle Google OAuth Callback:', error);
        return new NextResponse(
            JSON.stringify({
                error: 'OAuth Token Exchange Failed',
                message: error.message,
                hint: 'Please copy this entire message and send it back to the AI.'
            }, null, 2),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
}
