import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { incrementPeppolReceived } from '@/lib/plan-limits';

/**
 * POST /api/peppol/inbox/count
 * Increments the Peppol received counter by the given count.
 * Called after deduplication — only counts ACTUALLY NEW documents.
 * Body: { count: number }
 */
export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!(session?.user as any)?.tenantId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const tenantId = (session!.user as any).tenantId;

        const { count } = await req.json();
        const n = Math.min(Math.max(parseInt(count) || 0, 0), 100); // clamp 0-100

        for (let i = 0; i < n; i++) {
            await incrementPeppolReceived(tenantId);
        }

        return NextResponse.json({ success: true, incremented: n });
    } catch (error: any) {
        console.error('[Peppol Count] error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
