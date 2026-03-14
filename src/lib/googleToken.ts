import prisma from "@/lib/prisma";

/**
 * Ensures the Google access token for a given account is valid.
 * If expired, it uses the refresh token to get a new one and updates the DB.
 */
export async function getValidAccessToken(accountId: string): Promise<string | null> {
    const account = await prisma.account.findUnique({
        where: { id: accountId }
    });

    if (!account || !account.access_token) return null;

    // Check if token is expired (giving a 1 minute buffer)
    const now = Math.floor(Date.now() / 1000);
    const isExpired = account.expires_at && account.expires_at < now + 60;

    if (!isExpired) {
        return account.access_token;
    }

    if (!account.refresh_token) {
        console.error(`Token expired for account ${accountId} but no refresh token is available.`);
        return null; // Cannot refresh
    }

    // Attempt to refresh the token
    try {
        const response = await fetch("https://oauth2.googleapis.com/token", {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: process.env.GOOGLE_CLIENT_ID!,
                client_secret: process.env.GOOGLE_CLIENT_SECRET!,
                grant_type: "refresh_token",
                refresh_token: account.refresh_token,
            }),
            method: "POST",
        });

        const tokens = await response.json();

        if (!response.ok) throw tokens;

        const updatedAccount = await prisma.account.update({
            where: { id: accountId },
            data: {
                access_token: tokens.access_token,
                expires_at: Math.floor(Date.now() / 1000) + tokens.expires_in,
                refresh_token: tokens.refresh_token ?? account.refresh_token, // Fall back to old refresh token
            },
        });

        return updatedAccount.access_token;

    } catch (error) {
        console.error("Error refreshing Google token", error);
        return null;
    }
}
