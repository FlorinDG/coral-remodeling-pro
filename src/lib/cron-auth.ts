/**
 * R5-1 · the ONE cron check — fail-closed. Every /api/cron route asks this, nothing else.
 *
 * Before 2026-10-04 the check was copied into four routes as `if (secret && header !== secret)`: with
 * CRON_SECRET unset, every cron (invoice status, trial expiry, reminders) ran for anyone who called it.
 * Now: no secret configured → refused, and the refusal is logged so a missing env var is seen, not silent.
 *
 * Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. The `?secret=` query form is kept only for
 * an external scheduler that cannot set headers (trial-notifications).
 */
import { timingSafeEqual } from 'node:crypto';

function same(a: string, b: string): boolean {
    const x = Buffer.from(a);
    const y = Buffer.from(b);
    return x.length === y.length && timingSafeEqual(x, y);
}

/** Pure decision (tested): may this request run a cron job? */
export function cronAuthorized(secret: string | undefined, authHeader: string | null, querySecret: string | null): boolean {
    if (!secret) return false;
    if (authHeader && same(authHeader, `Bearer ${secret}`)) return true;
    if (querySecret && same(querySecret, secret)) return true;
    return false;
}

export function isCronRequest(req: Request, opts: { allowQuerySecret?: boolean } = {}): boolean {
    const secret = process.env.CRON_SECRET;
    if (!secret) console.error('[cron] CRON_SECRET is not set — every cron request is refused');
    const query = opts.allowQuerySecret ? new URL(req.url).searchParams.get('secret') : null;
    return cronAuthorized(secret, req.headers.get('authorization'), query);
}
