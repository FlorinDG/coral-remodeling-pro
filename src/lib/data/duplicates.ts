/**
 * DUP-1 · the duplicate door: which records of THIS database (the caller's tenant — scoped client) may the given one
 * duplicate? The candidates are read by the facts the rule compares (date, total, number); the rule decides
 * (lib/records/duplicates). Replaces lib/expense-dedup.ts (a raw query on the platform client).
 */
import type { TenantScopedClient } from './scope';
import { findDuplicates, DUPLICATE_QUERY_FIELDS, type DuplicateMatch } from '../records/duplicates';

type Props = Record<string, unknown>;

export async function findPurchaseDuplicates(
    db: TenantScopedClient,
    databaseId: string,
    role: string,
    candidate: { id?: string; properties: Props },
): Promise<DuplicateMatch[]> {
    const q = DUPLICATE_QUERY_FIELDS[role];
    if (!q) return [];
    const p = candidate.properties;
    const date = String(p[q.date] ?? '').slice(0, 10);
    const amount = typeof p[q.amount] === 'number' ? (p[q.amount] as number) : Number(String(p[q.amount] ?? '').replace(',', '.'));
    const title = role === 'expenses' ? String(p.title ?? '').trim() : '';
    const or: object[] = [];
    if (date) or.push({ properties: { path: [q.date], equals: date } });
    if (Number.isFinite(amount) && amount !== 0) or.push({ properties: { path: [q.amount], equals: amount } });
    if (title) or.push({ properties: { path: ['title'], equals: title } });
    if (!or.length) return [];
    const rows = await db.globalPage.findMany({
        where: { databaseId, OR: or, ...(candidate.id ? { id: { not: candidate.id } } : {}) },
        select: { id: true, properties: true },
        take: 200,
    });
    return findDuplicates(role, candidate, rows.map(r => ({ id: r.id, properties: (r.properties || {}) as Props })));
}
