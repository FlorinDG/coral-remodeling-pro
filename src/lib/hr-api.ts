import { withRetry } from "@/lib/fetch-retry";
/**
 * HR API client — replaces direct DB calls.
 * All hooks import from here instead of the legacy client.
 */

const BASE = '/api/hr';

/** A non-OK HR API response. Carries the status and parsed body so callers can act on them (e.g. a 409 payload). */
export class HrApiError extends Error {
    constructor(message: string, public readonly status: number, public readonly body: Record<string, any>) {
        super(message);
        this.name = 'HrApiError';
    }
}

export async function hrFetch<T = any>(entity: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE}/${entity}`, {
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        ...options,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new HrApiError(err.error || `HR API error: ${res.status}`, res.status, err);
    }
    return res.json();
}

export async function hrList<T = any>(entity: string, params?: Record<string, string>): Promise<T[]> {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    // Only wrap idempotent GET requests in withRetry
    return withRetry(() => hrFetch<T[]>(`${entity}${qs}`));
}

export async function hrCreate<T = any>(entity: string, data: Record<string, any>): Promise<T> {
    return hrFetch<T>(entity, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function hrUpdate<T = any>(entity: string, id: string, data: Record<string, any>, scope?: string): Promise<T> {
    return hrFetch<T>(`${entity}?id=${id}${scope && scope !== 'occurrence' ? `&scope=${scope}` : ''}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
    });
}

export async function hrDelete<T = unknown>(entity: string, id: string, scope?: string): Promise<T> {
    return hrFetch<T>(`${entity}?id=${id}${scope && scope !== 'occurrence' ? `&scope=${scope}` : ''}`, { method: 'DELETE' });
}
