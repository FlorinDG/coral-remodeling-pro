import { NextResponse } from 'next/server';
import { PrismaClient } from "@prisma/client";
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

const prisma = new PrismaClient();

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const folderParam = searchParams.get('folder') || 'inbox';
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

        const threads = [];

        try {
            // 4. Fetch the most recent 20 messages
            const boxCount = client.mailbox ? client.mailbox.exists : 0;
            if (boxCount > 0) {
                const fetchStart = Math.max(1, boxCount - 19);
                const sequence = `${fetchStart}:*`;

                for await (const message of client.fetch(sequence, { source: true, envelope: true })) {
                    if (!message.source) continue;

                    const parsed: any = await simpleParser(message.source);

                    // Transform the native IMAP parsed message into our frontend JSON schema
                    threads.push({
                        id: message.uid,
                        subject: parsed.subject || "No Subject",
                        lastActivityDate: parsed.date?.toISOString() || new Date().toISOString(),
                        emails: [
                            {
                                id: message.uid,
                                threadId: message.uid,
                                subject: parsed.subject || "No Subject",
                                body: parsed.text?.substring(0, 150) || "No content", // Show snippet
                                sentDate: parsed.date?.toISOString() || new Date().toISOString(),
                                sender: {
                                    id: parsed.from?.value[0]?.address || 'unknown',
                                    firstName: parsed.from?.value[0]?.name?.split(' ')[0] || '',
                                    lastName: parsed.from?.value[0]?.name?.split(' ').slice(1).join(' ') || '',
                                    email: parsed.from?.value[0]?.address || 'unknown@example.com',
                                }
                            }
                        ]
                    });
                }
            }
        } finally {
            if (lock) {
                lock.release();
            }
        }

        await client.logout();
        client = null;

        // Reverse to get newest messages first (since IMAP sequence grabs oldest -> newest)
        threads.reverse();

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
