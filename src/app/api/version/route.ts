import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

/**
 * GET /api/version — returns the currently-deployed server version.
 * Used by the client VersionWatcher to detect stale builds.
 * force-dynamic + no-store ensures this always returns the LIVE deployment's SHA.
 */
export async function GET() {
    return NextResponse.json({
        version: process.env.VERCEL_GIT_COMMIT_SHA || 'dev',
        environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
    }, {
        headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
}
