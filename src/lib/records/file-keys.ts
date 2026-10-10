/**
 * FILES-DUP-1 · the tenant file store's key scheme, written once: `t_{tenantId}/{recordType}/{recordId}/{name}`.
 * Every file door builds and checks keys through here (the tenant prefix IS the tenant fence of the store). Pure.
 */
export function tenantFilePrefix(tenantId: string): string {
    if (!tenantId) throw new Error('file key: no tenant');
    return `t_${tenantId}/`;
}

/** A record's folder; without recordId, every record of that type. */
export function recordFilePrefix(tenantId: string, recordType: string, recordId?: string | null): string {
    return recordId ? `${tenantFilePrefix(tenantId)}${recordType}/${recordId}/` : `${tenantFilePrefix(tenantId)}${recordType}/`;
}

export function recordFileKey(tenantId: string, recordType: string, recordId: string, storedName: string): string {
    return `${recordFilePrefix(tenantId, recordType, recordId)}${storedName}`;
}

/** Is this key inside the tenant's store? */
export function isTenantFileKey(key: string, tenantId: string): boolean {
    return !!tenantId && key.startsWith(tenantFilePrefix(tenantId));
}
