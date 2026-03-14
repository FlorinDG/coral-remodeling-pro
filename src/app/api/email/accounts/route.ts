import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(request: Request) {
    try {
        const { email, password, host, port, type } = await request.json();

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
                imapPort,
                smtpHost,
                smtpPort,
                isActive: true
            },
            create: {
                email,
                password,
                imapHost,
                imapPort,
                smtpHost,
                smtpPort,
                isActive: true
            }
        });

        return NextResponse.json({
            success: true,
            message: "Account connected successfully."
        }, { status: 200 });

    } catch (error: any) {
        console.error("Account Registration Error:", error);
        return NextResponse.json({ error: error.message || "Failed to register account." }, { status: 500 });
    }
}
