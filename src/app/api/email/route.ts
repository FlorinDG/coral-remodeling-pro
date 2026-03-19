import { NextResponse } from 'next/server';
import { PrismaClient } from "@prisma/client";
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

const prisma = new PrismaClient();

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const folderParam = searchParams.get('folder') || 'inbox';
    const labelParam = searchParams.get('label');
    const accountEmail = searchParams.get('account');

    let client: ImapFlow | null = null;

    try {
        // 1. Retrieve the credentials from the database
        const accounts = await prisma.connectedEmailAccount.findMany({
            where: { isActive: true }
        });

        if (accounts.length === 0) {
            return NextResponse.json({ threads: [], source: 'empty' });
        }

        // Default to the first account if none specified
        const targetAccount = accountEmail ? accounts.find(a => a.email === accountEmail) : accounts[0];

        if (!targetAccount) {
            return NextResponse.json({ error: "Account not found" }, { status: 404 });
        }

        // 2. Initialize the direct IMAP client
        client = new ImapFlow({
            host: targetAccount.imapHost,
            port: targetAccount.imapPort,
            secure: true,
            auth: {
                user: targetAccount.email,
                pass: targetAccount.password
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
        } catch (e) {
            // Fallback to INBOX if the specific label isn't found
            lock = await client.getMailboxLock('INBOX');
        }

        const threadsMap = new Map<string, any>();

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

                    const parsed: any = await simpleParser(message.source);

                    // Normalize subject
                    let normalizedSubject = (parsed.subject || "No Subject").replace(/^(Re|Fwd|RE|FWD|re|fwd):\s*/g, '').trim();
                    if (!normalizedSubject) normalizedSubject = "No Subject";

                    // Process attachments safely
                    const attachments = parsed.attachments?.map((att: any) => ({
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
                        emailData.threadId = existingThread.id;
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
        threads.forEach(t => t.emails.sort((a: any, b: any) => new Date(b.sentDate).getTime() - new Date(a.sentDate).getTime()));

        return NextResponse.json({
            threads: threads,
            source: 'imapflow'
        });

    } catch (error: any) {
        if (client) {
            try {
                await client.logout();
            } catch (e) { }
        }

        console.error("🔥 Native IMAP Engine Error:", error);

        return NextResponse.json(
            { error: "Failed to sync with IMAP provider", details: error.message },
            { status: 500 }
        );
    }
}
