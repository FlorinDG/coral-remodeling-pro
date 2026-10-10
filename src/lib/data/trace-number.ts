/**
 * TRACE-1 · the door that hands out trace numbers. The tenant's counter is incremented atomically (one UPDATE …
 * value = value + 1, or created at 1) INSIDE the caller's transaction: if the create that needs the number fails, the
 * increment rolls back with it. Every creation of a shift or an hours entry asks here (census:
 * tests/trace-number.test.ts).
 */
import { formatTraceNo, type TraceSeries } from '@/lib/records/trace-number';

/** Any client with the TraceCounter delegate — the scoped client, its transaction, or the raw client of a door. */
interface CounterClient {
    traceCounter: {
        upsert(args: {
            where: { tenantId_series: { tenantId: string; series: string } };
            create: { tenantId: string; series: string; value: number };
            update: { value: { increment: number } };
            select: { value: true };
        }): Promise<{ value: number }>;
    };
}

export async function nextTraceNo(db: CounterClient, tenantId: string, series: TraceSeries): Promise<string> {
    if (!tenantId) throw new Error('trace number: no tenant');
    const row = await db.traceCounter.upsert({
        where: { tenantId_series: { tenantId, series } },
        create: { tenantId, series, value: 1 },
        update: { value: { increment: 1 } },
        select: { value: true },
    });
    return formatTraceNo(series, row.value);
}
