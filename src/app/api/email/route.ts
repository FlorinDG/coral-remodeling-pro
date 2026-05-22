import { NextResponse } from 'next/server';
import { PrismaClient } from "@prisma/client";
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { getGmailOAuth2Client } from './connect/google/route';
import { auth } from '@/auth';

const prisma = new PrismaClient();

async function ensureValidToken(account: { id: string; email: string; accessToken?: string | null; refreshToken?: string | null; expiresAt?: Date | null }) {
    if (!account.accessToken || !account.refreshToken) return account.accessToken;
    
    // If not expired, return current token (with 1 minute buffer)
    if (account.expiresAt && new Date(account.expiresAt).getTime() > Date.now() + 60000) {
        return account.accessToken;
    }
    
    try {
        // Refresh token
        const oauth2Client = getGmailOAuth2Client();
        oauth2Client.setCredentials({
            access_token: account.accessToken,
            refresh_token: account.refreshToken,
        });
        
        const { credentials } = await oauth2Client.refreshAccessToken();
        
        await prisma.connectedEmailAccount.update({
            where: { id: account.id },
            data: {
                accessToken: credentials.access_token,
                expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
            }
        });
        
        return credentials.access_token;
    } catch (err) {
        console.error('Failed to refresh Gmail token for', account.email, err);
        return null;
    }
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const folderParam = searchParams.get('folder') || 'inbox';
    const labelParam = searchParams.get('label');
    const accountEmail = searchParams.get('account');

    let client: ImapFlow | null = null;

    try {
        const session = await auth();
        const tenantId = session?.user?.tenantId;
        if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // 1. Retrieve the credentials from the database for this tenant
        const accounts = await prisma.connectedEmailAccount.findMany({
            where: { tenantId, isActive: true }
        });

        if (accounts.length === 0) {
            return NextResponse.json({ threads: [], source: 'empty' });
        }

        // Default to the first account if none specified
        const targetAccount = accountEmail ? accounts.find(a => a.email === accountEmail) : accounts[0];

        if (!targetAccount) {
            return NextResponse.json({ error: "Account not found" }, { status: 404 });
        }

        // 2. Initialize the direct IMAP client (supporting both password and OAuth2)
        const validToken = await ensureValidToken(targetAccount);

        client = new ImapFlow({
            host: targetAccount.imapHost || 'imap.gmail.com',
            port: targetAccount.imapPort || 993,
            secure: true,
            auth: validToken ? {
                user: targetAccount.email || '',
                accessToken: validToken
            } : {
                user: targetAccount.email || '',
                pass: targetAccount.password || undefined
            },
            logger: false // Disable logging to keep the console clean
        });

        await client.connect();

        // 3. Map the frontend folder to standard IMAP paths
        let imapPath = 'INBOX';
        switch (folderParam) {
            case 'sent': imapPath = '[Gmail]/Sent Mail'; break; // Simplified for Gmail
            case 'trash': imapPath = '[Gmail]/Trash'; break;
            case 'archive': imapPath = '[Gmail]/All Mail'; break;
            // Inbox is default
        }

        // Acquire a lock on the mailbox to safely read messages
        let lock;
        try {
            lock = await client.getMailboxLock(imapPath);
        } catch {
            // Fallback to INBOX if the specific label isn't found
            lock = await client.getMailboxLock('INBOX');
        }

        const threadsMap = new Map<string, { id: string; subject: string; isRead: boolean; lastActivityDate: string; emails: unknown[] }>();

        try {
            // 4. Fetch the most recent 40 messages or search by label
            let sequence: string | number[] = '';
            let useUid = false;

            if (labelParam) {
                // Smart Folder logic: Search by label string in subject or body
                const searchResults = await client.search({
                    or: [
                        { subject: labelParam },
                        { body: labelParam }
                    ]
                }, { uid: true });

                if (searchResults && searchResults.length > 0) {
                    sequence = searchResults.slice(-40); // Get up to 40 most recent matches
                    useUid = true;
                }
            } else {
                const boxCount = client.mailbox ? client.mailbox.exists : 0;
                if (boxCount > 0) {
                    const fetchStart = Math.max(1, boxCount - 39);
                    sequence = `${fetchStart}:*`;
                }
            }

            if (sequence && (Array.isArray(sequence) ? sequence.length > 0 : sequence.length > 0)) {
                for await (const message of client.fetch(sequence, { source: true, envelope: true, flags: true }, { uid: useUid })) {
                    if (!message.source) continue;

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const parsed = await simpleParser(message.source) as any;

                    // Normalize subject
                    let normalizedSubject = (parsed.subject || "No Subject").replace(/^(Re|Fwd|RE|FWD|re|fwd):\s*/g, '').trim();
                    if (!normalizedSubject) normalizedSubject = "No Subject";

                    // Process attachments safely
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const attachments = (parsed.attachments as any[])?.map((att: any) => ({
                        filename: att.filename || 'unnamed_attachment',
                        contentType: att.contentType,
                        size: att.size,
                        data: att.content ? att.content.toString('base64') : undefined
                    })) || [];

                    // Transform the native IMAP parsed message into our frontend JSON schema
                    const isRead = message.flags ? message.flags.has('\\Seen') : true;

                    const emailData = {
                        id: message.uid,
                        threadId: message.uid, // Will be updated if grouped
                        subject: parsed.subject || "No Subject",
                        snippet: parsed.text?.substring(0, 150) || "No content",
                        body: parsed.html || parsed.text || "No content",
                        isRead,
                        sentDate: parsed.date?.toISOString() || new Date().toISOString(),
                        sender: {
                            id: parsed.from?.value[0]?.address || 'unknown',
                            firstName: parsed.from?.value[0]?.name?.split(' ')[0] || '',
                            lastName: parsed.from?.value[0]?.name?.split(' ').slice(1).join(' ') || '',
                            email: parsed.from?.value[0]?.address || 'unknown@example.com',
                        },
                        attachments
                    };

                    if (!threadsMap.has(normalizedSubject)) {
                        emailData.threadId = message.uid; // first message uid as threadId
                        threadsMap.set(normalizedSubject, {
                            id: message.uid.toString(),
                            subject: normalizedSubject,
                            isRead: emailData.isRead,
                            lastActivityDate: emailData.sentDate,
                            emails: [emailData]
                        });
                    } else {
                        const existingThread = threadsMap.get(normalizedSubject);
                        if (existingThread) {
                            emailData.threadId = Number(existingThread.id);
                            existingThread.emails.push(emailData);

                            // If any email in the thread is unread, the thread is unread
                            if (!emailData.isRead) {
                                existingThread.isRead = false;
                            }

                            // Update lastActivityDate if this email is newer
                            if (new Date(emailData.sentDate) > new Date(existingThread.lastActivityDate)) {
                                existingThread.lastActivityDate = emailData.sentDate;
                            }
                        }
                    }
                }
            }
        } finally {
            if (lock) {
                lock.release();
            }
        }

        await client.logout();
        client = null;

        const threads = Array.from(threadsMap.values());

        // Sort threads by last activity (newest first)
        threads.sort((a, b) => new Date(b.lastActivityDate).getTime() - new Date(a.lastActivityDate).getTime());

        // Sort emails within each thread (newest first)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        threads.forEach((t) => (t as any).emails.sort((a: any, b: any) => new Date(b.sentDate).getTime() - new Date(a.sentDate).getTime()));

        return NextResponse.json({
            threads: threads,
            source: 'imapflow'
        });

    } catch (error: unknown) {
        if (client) {
            try {
                await client.logout();
            } catch { }
        }

        console.error("🔥 Native IMAP Engine Error:", error);

        return NextResponse.json(
            { error: "Failed to sync with IMAP provider", details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
