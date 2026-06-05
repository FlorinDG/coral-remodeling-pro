import { NextResponse } from "next/server";

/** Diagnostic: returns the git commit hash of the running deployment */
export async function GET() {
    return NextResponse.json({
        commit: process.env.VERCEL_GIT_COMMIT_SHA || 'unknown',
        deployedAt: process.env.VERCEL_GIT_COMMIT_MESSAGE || 'unknown',
        env: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
    });
}
