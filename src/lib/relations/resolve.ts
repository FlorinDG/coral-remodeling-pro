import { useMemo, useEffect } from 'react';
import type { Database, PageIndexEntry, Page } from '@/components/admin/database/types';
import { BASE_TO_KEY, getLockedDbId } from '@/lib/lockedDbUtils';

export interface RelationOption {
    id: string;
    title: string;
    databaseId: string;
}

export type RelationResolutionStatus = 'ready' | 'not-loaded' | 'unknown-database';

export interface RelationTargetResolution {
    status: RelationResolutionStatus;
    databaseId: string;            // always the tenant-scoped id
    options: RelationOption[];     // from the store, or pageIndex when not hydrated
    targetDatabase?: Database;
}

export interface ResolveRelationOptions {
    databases?: Database[];
    pageIndex?: Record<string, PageIndexEntry>;
    loadedDatabaseIds?: string[];
    loadingDatabaseIds?: string[];
    lockedDbIds?: Record<string, string>;
    resolveDbId?: (base: string) => string;
    displayPropertyId?: string;
}

// Store binding for client-side environments without circular or Node test dependencies
let _boundStore: any = null;
export function bindDatabaseStore(store: any) {
    _boundStore = store;
}

function getStoreState(): any {
    if (_boundStore?.getState) {
        return _boundStore.getState();
    }
    if (typeof window !== 'undefined') {
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const storeModule = require('@/components/admin/database/store');
            if (storeModule?.useDatabaseStore?.getState) {
                _boundStore = storeModule.useDatabaseStore;
                return storeModule.useDatabaseStore.getState();
            }
        } catch {
            // Safe fallback
        }
    }
    return null;
}

/**
 * resolveRelationTarget — PANEL-1 unified relation resolver
 *
 * Single source of truth for resolving relation targets across grid,
 * side panel (DbPropertiesPanel), and linked records.
 *
 * 1. Resolves logical keys (e.g. 'db-clients') through the book (lockedDbIds / tenant)
 * 2. Unchanged pass-through for already scoped IDs (reported until R1-1b)
 * 3. Handles custom databases explicitly by ID
 * 4. Universally falls back to pageIndex when database is not hydrated
 * 5. Returns a discriminated status ('ready' | 'not-loaded' | 'unknown-database')
 *    so callers never mistake 'not-loaded' for 'empty'.
 */
export function resolveRelationTarget(
    relationDatabaseId: string | undefined | null,
    options?: ResolveRelationOptions
): RelationTargetResolution {
    if (!relationDatabaseId || typeof relationDatabaseId !== 'string' || !relationDatabaseId.trim()) {
        return {
            status: 'unknown-database',
            databaseId: '',
            options: []
        };
    }

    const trimmedId = relationDatabaseId.trim();

    // Context resolution: use options if passed, else fallback to store state
    const storeState = getStoreState();
    const databases: Database[] = options?.databases ?? storeState?.databases ?? [];
    const pageIndex: Record<string, PageIndexEntry> = options?.pageIndex ?? storeState?.pageIndex ?? {};
    const loadedDatabaseIds: string[] = options?.loadedDatabaseIds ?? storeState?.loadedDatabaseIds ?? [];
    const loadingDatabaseIds: string[] = options?.loadingDatabaseIds ?? storeState?.loadingDatabaseIds ?? [];

    const lockedDbIds = options?.lockedDbIds ?? {};
    const resolveDbId = options?.resolveDbId ?? ((base: string) => getLockedDbId(base, lockedDbIds));
    const displayPropertyId = options?.displayPropertyId || 'title';

    let resolvedId = trimmedId;
    const isLogicalKey = Boolean(BASE_TO_KEY[trimmedId]);

    if (isLogicalKey) {
        // Resolve logicalKey through the book
        const bookResolved = resolveDbId(trimmedId);
        if (bookResolved && bookResolved !== trimmedId) {
            resolvedId = bookResolved;
        } else {
            // If resolveDbId returned bare ID (e.g. empty lockedDbIds), find tenant suffix in store
            const prefixMatch = databases.find(d => d.id.startsWith(trimmedId + '-'));
            if (prefixMatch) {
                resolvedId = prefixMatch.id;
            } else {
                const indexMatch = Object.values(pageIndex).find(e => e.databaseId.startsWith(trimmedId + '-'));
                if (indexMatch) {
                    resolvedId = indexMatch.databaseId;
                }
            }
        }
    } else {
        // Scoped ID or custom database
        const isKnownScoped = Object.keys(BASE_TO_KEY).some(base => trimmedId.startsWith(base + '-'));
        if (isKnownScoped) {
            // R1-1b tracking: report scoped ID until R1-1b schema migration lands
            if (process.env.NODE_ENV === 'development') {
                console.info(`[resolveRelationTarget] Scoped ID encountered before R1-1b migration: ${trimmedId}`);
            }
        }
    }

    // Locate target database object in loaded databases
    const targetDatabase = databases.find(d => d.id === resolvedId)
        || (resolvedId !== trimmedId ? databases.find(d => d.id === trimmedId) : undefined);

    // Check if target database exists or is known
    const hasIndexEntries = Object.values(pageIndex).some(
        e => e.databaseId === resolvedId || (resolvedId !== trimmedId && e.databaseId === trimmedId)
    );

    const isKnownDatabase = isLogicalKey ||
        Boolean(targetDatabase) ||
        hasIndexEntries ||
        databases.some(d => d.id === resolvedId);

    if (!isKnownDatabase) {
        return {
            status: 'unknown-database',
            databaseId: resolvedId,
            options: []
        };
    }

    // Extract options: priority 1: targetDatabase.pages if hydrated
    let optionsList: RelationOption[] = [];
    if (targetDatabase?.pages && targetDatabase.pages.length > 0) {
        optionsList = targetDatabase.pages.map(p => {
            const pageTitle = p.properties?.[displayPropertyId] ||
                p.properties?.['title'] ||
                p.properties?.['name'] ||
                p.properties?.['prop-title'] ||
                p.id.slice(0, 8);
            return {
                id: p.id,
                title: String(pageTitle || 'Untitled'),
                databaseId: resolvedId,
            };
        });
    } else {
        // Fallback: Query pageIndex for entries belonging to resolvedId or trimmedId
        const indexEntries = Object.values(pageIndex).filter(
            e => e.databaseId === resolvedId || (resolvedId !== trimmedId && e.databaseId === trimmedId)
        );
        optionsList = indexEntries.map(e => ({
            id: e.id,
            title: e.title || 'Untitled',
            databaseId: e.databaseId,
        }));
    }

    // Determine status
    const isLoaded = loadedDatabaseIds.includes(resolvedId) || (resolvedId !== trimmedId && loadedDatabaseIds.includes(trimmedId));
    const isLoading = loadingDatabaseIds.includes(resolvedId) || (resolvedId !== trimmedId && loadingDatabaseIds.includes(trimmedId));

    let status: RelationResolutionStatus;
    if (optionsList.length > 0 || isLoaded) {
        status = 'ready';
    } else if (isLoading || !isLoaded) {
        status = 'not-loaded';
    } else {
        status = 'ready';
    }

    return {
        status,
        databaseId: resolvedId,
        options: optionsList,
        targetDatabase,
    };
}

/**
 * resolveRelationTitle — resolves title of a specific record ID
 * Works via pageIndex first, then loaded pages in target database, then all databases.
 */
export function resolveRelationTitle(
    recordId: string,
    context?: {
        pageIndex?: Record<string, PageIndexEntry>;
        targetDatabase?: Database;
        displayPropertyId?: string;
    }
): string | null {
    if (!recordId) return null;

    const storeState = getStoreState();
    const pageIndex = context?.pageIndex ?? storeState?.pageIndex ?? {};
    const storeDatabases: Database[] = storeState?.databases ?? [];

    // Priority 1: pageIndex (O(1) lookup, works even if target database pages are not loaded!)
    const entry = pageIndex[recordId];
    if (entry?.title) {
        return entry.title;
    }

    // Priority 2: targetDatabase pages if available
    const targetDb = context?.targetDatabase;
    if (targetDb?.pages) {
        const p = targetDb.pages.find((page: Page) => page.id === recordId);
        if (p) {
            const propId = context?.displayPropertyId || 'title';
            const title = p.properties?.[propId] || p.properties?.['title'] || p.properties?.['name'] || p.properties?.['prop-title'];
            if (title) return String(title);
        }
    }

    // Priority 3: Fallback search across all loaded databases in memory
    for (const db of storeDatabases) {
        const p = db.pages?.find((page: Page) => page.id === recordId);
        if (p) {
            const title = p.properties?.['title'] || p.properties?.['name'] || p.properties?.['prop-title'];
            if (title) return String(title);
        }
    }

    return null;
}

/**
 * useRelationTarget — React hook for components resolving a relation target
 * Subscribes reactively to useDatabaseStore and triggers auto-loading on 'not-loaded'.
 */
export function useRelationTarget(
    relationDatabaseId: string | undefined | null,
    options?: {
        displayPropertyId?: string;
        autoLoad?: boolean;
        lockedDbIds?: Record<string, string>;
        resolveDbId?: (base: string) => string;
        storeHook?: any;
    }
): RelationTargetResolution {
    const storeHook = options?.storeHook || _boundStore || (typeof window !== 'undefined' ? require('@/components/admin/database/store').useDatabaseStore : null);

    const databases = storeHook ? storeHook((s: any) => s.databases) : [];
    const pageIndex = storeHook ? storeHook((s: any) => s.pageIndex) : {};
    const loadedDatabaseIds = storeHook ? storeHook((s: any) => s.loadedDatabaseIds) : [];
    const loadingDatabaseIds = storeHook ? storeHook((s: any) => s.loadingDatabaseIds) : [];
    const loadDatabasePages = storeHook ? storeHook((s: any) => s.loadDatabasePages) : null;

    const resolution = useMemo(() => {
        return resolveRelationTarget(relationDatabaseId, {
            databases,
            pageIndex,
            loadedDatabaseIds,
            loadingDatabaseIds,
            lockedDbIds: options?.lockedDbIds,
            resolveDbId: options?.resolveDbId,
            displayPropertyId: options?.displayPropertyId,
        });
    }, [
        relationDatabaseId,
        databases,
        pageIndex,
        loadedDatabaseIds,
        loadingDatabaseIds,
        options?.lockedDbIds,
        options?.resolveDbId,
        options?.displayPropertyId,
    ]);

    // If not loaded and autoLoad is enabled, trigger background fetch
    useEffect(() => {
        if (options?.autoLoad !== false && resolution.status === 'not-loaded' && resolution.databaseId && loadDatabasePages) {
            loadDatabasePages(resolution.databaseId).catch((err: unknown) => {
                console.error(`[useRelationTarget] Failed to load database ${resolution.databaseId}:`, err);
            });
        }
    }, [resolution.status, resolution.databaseId, loadDatabasePages, options?.autoLoad]);

    return resolution;
}
