import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { cookies } from 'next/headers';
import crypto from 'crypto';

const AUTH_SECRET = process.env.AUTH_SECRET || 'fallback-secret-for-dev';

// Function to generate an HMAC signature
function signPayload(payload: string): string {
    return crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('hex');
}

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        const user = session?.user;
        const tenantId = user?.tenantId;
        const userId = user?.id;

        if (!userId || !tenantId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const action = body.action; // 'enable' or 'disable'

        const cookieStore = await cookies();

        if (action === 'enable') {
            const exp = Date.now() + 30 * 60 * 1000; // 30 minutes
            const payloadStr = JSON.stringify({ tenantId, userId, exp });
            const signature = signPayload(payloadStr);
            const token = `${Buffer.from(payloadStr).toString('base64')}.${signature}`;

            cookieStore.set('timesheet_unlock', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
                maxAge: 30 * 60, // 30 mins
            });

            return NextResponse.json({ success: true, expiresAt: exp });
        } else if (action === 'disable') {
            cookieStore.delete('timesheet_unlock');
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (err) {
        console.error('Error toggling timesheet unlock:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
