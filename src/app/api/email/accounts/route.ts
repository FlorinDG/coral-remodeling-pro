import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';

export async function GET() {
    try {
        const session = await auth();
        const tenantId = session?.user?.tenantId;
        if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const accounts = await prisma.connectedEmailAccount.findMany({
            where: { tenantId, isActive: true },
            select: { id: true, email: true, isActive: true }
        });

        return NextResponse.json({ accounts });
    } catch (error: unknown) {
        console.error("Account Fetch Error:", error);
        return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch accounts." }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await auth();
        const tenantId = session?.user?.tenantId;
        if (!tenantId) return NextResponse.json({ error: 'Unauthorized: SaaS workspace context missing.' }, { status: 401 });

        const { email, password, host, port } = await req.json();

        if (!email || !password) {
            return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
        }

        // Upsert the user's email credentials into the database
        // Automatically defaulting to Google Workspace/Gmail hosts if not explicitly provided
        const isGoogle = email.includes('@gmail.com') || email.includes('@coral-group.be');

        const imapHost = host || (isGoogle ? 'imap.gmail.com' : 'imap.example.com');
        const imapPort = port ? parseInt(port) : 993;
        const smtpHost = host ? host.replace('imap', 'smtp') : (isGoogle ? 'smtp.gmail.com' : 'smtp.example.com');
        const smtpPort = 465;

        await prisma.connectedEmailAccount.upsert({
            where: { email },
            update: {
                password,
                imapHost,
                imapPort: Number(imapPort),
                smtpHost,
                smtpPort: Number(smtpPort),
                isActive: true,
                tenantId
            },
            create: {
                email,
                password,
                imapHost,
                imapPort: Number(imapPort),
                smtpHost,
                smtpPort: Number(smtpPort),
                isActive: true,
                tenantId
            }
        });

        return NextResponse.json({
            success: true,
            message: "Account connected successfully."
        }, { status: 200 });

    } catch (error: unknown) {
        console.error("Account Registration Error:", error);
        return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to register account." }, { status: 500 });
    }
}
