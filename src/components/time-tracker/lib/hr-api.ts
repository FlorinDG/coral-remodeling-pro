/**
 * HR API client — replaces direct Supabase calls.
 * All hooks import from here instead of the Supabase client.
 */

const BASE = '/api/hr';

export async function hrFetch<T = any>(entity: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE}/${entity}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `HR API error: ${res.status}`);
    }
    return res.json();
}

export async function hrList<T = any>(entity: string, params?: Record<string, string>): Promise<T[]> {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return hrFetch<T[]>(`${entity}${qs}`);
}

export async function hrCreate<T = any>(entity: string, data: Record<string, any>): Promise<T> {
    return hrFetch<T>(entity, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function hrUpdate<T = any>(entity: string, id: string, data: Record<string, any>): Promise<T> {
    return hrFetch<T>(`${entity}?id=${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
    });
}

export async function hrDelete(entity: string, id: string): Promise<void> {
    await hrFetch(`${entity}?id=${id}`, { method: 'DELETE' });
}
